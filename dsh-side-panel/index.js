/**
 * Side Panel — Host half
 * -----------------------
 * فقط یک کار می‌کند: هزینهٔ زندهٔ کلیدِ OpenRouter را می‌خواند و به کلاینت می‌دهد.
 * کلید هرگز به مرورگر نمی‌رود (قاعدهٔ امنیتی: poll فقط در host).
 *
 *   GET /plugins/side-panel/cost → {limit, usage, remaining, daily, ts}   (کلِ کلید)
 *   GET /plugins/side-panel/session-cost?sessionId=… → خرجِ دقیقِ همین چت (cost-log.js)
 *   GET /plugins/side-panel/raw-log?sessionId=…&from=&limit=&q=&download=1 → خط‌های خامِ لاگِ همین چت
 *   POST /plugins/side-panel/diag → یک خط در diag.log (تشخیص)
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { collectDescendants, createAnthropicPrices, createLogCache, createPriceBook, decompressAsync, findSessionLog, summarizeChatCost, summarizeSubagents } from './cost-log.js'
import { sliceRawLines, splitLogLines } from './raw-log.js'

const OPENROUTER = 'https://openrouter.ai/api/v1'
const ENV_PATH = path.join(os.homedir(), '.dsh', '.env')
const CACHE_MS = 1500
// کنارِ خودِ همین فایل (نه مسیرِ سخت‌نوشتهٔ پوشهٔ پروژه).
const DIAG_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), 'diag.log')

export const name = '@local/dsh-side-panel'
export const inject = []

/** کلیدِ استنتاج را از env یا ~/.dsh/.env بخوان. */
function readKey() {
  if (process.env.OPENROUTER_API_KEY) return process.env.OPENROUTER_API_KEY.trim()
  try {
    const text = fs.readFileSync(ENV_PATH, 'utf8')
    for (const line of text.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue
      const index = trimmed.indexOf('=')
      const key = trimmed.slice(0, index).trim()
      if (key === 'OPENROUTER_API_KEY') return trimmed.slice(index + 1).trim()
    }
  } catch (err) {
    return null
  }
  return null
}

let cache = { ts: 0, value: null }

const LOOPBACK = /^(127\.\d+\.\d+\.\d+|localhost|\[::1\])(:\d+)?$/i
const DIAG_MAX_BYTES = 1024 * 1024

/**
 * سدِ کمینه برای مسیرهای این افزونه. سرورِ وبِ DSH خودش احرازِ هویتِ سراسری ندارد
 * (README ِ dsh-host-webserver: «No server-wide authentication»)؛ پس بی این سد، هر
 * صفحهٔ وبِ دیگری در مرورگر می‌توانست به ‎/diag‎ بنویسد (POST ِ ساده، بی preflight)
 * یا با DNS-rebinding خرجِ چت‌ها و تکهٔ پیام‌های حبیب را بخواند.
 * - Host اگر هست باید loopback باشد (جلوی DNS-rebinding).
 * - درخواستِ cross-site ِ مرورگر رد می‌شود؛ Origin اگر هست باید همان Host یا اپِ دسکتاپ باشد.
 * درخواستِ خودِ پنل (same-origin یا dsh-app://) و curl ِ محلی رد نمی‌شوند.
 * @param req - درخواستِ Node.
 * @returns null یعنی مجاز؛ وگرنه علتِ رد.
 */
export function rejectReason(req) {
  const headers = (req && req.headers) || {}
  const host = typeof headers.host === 'string' ? headers.host.trim() : ''
  if (host !== '' && !LOOPBACK.test(host)) return 'host'
  if (headers['sec-fetch-site'] === 'cross-site') return 'cross-site'
  const origin = typeof headers.origin === 'string' ? headers.origin.trim() : ''
  if (origin !== '' && origin !== 'null') {
    let parsed
    try { parsed = new URL(origin) } catch { return 'origin' }
    const sameHost = host !== '' && parsed.host.toLowerCase() === host.toLowerCase()
    if (!sameHost && parsed.protocol !== 'dsh-app:' && parsed.protocol !== 'file:') return 'origin'
  }
  return null
}

/** اگر رد شد، 403 می‌نویسد و true برمی‌گرداند. */
function refuse(req, res) {
  const reason = rejectReason(req)
  if (reason === null) return false
  res.statusCode = 403
  res.end(JSON.stringify({ error: 'forbidden: ' + reason }))
  return true
}

/**
 * خواندنِ بدنهٔ JSON یک درخواستِ POST با سقفِ ۱۶ کیلوبایت.
 * @param req - درخواستِ Node.
 * @returns بدنهٔ تجزیه‌شده یا {}.
 */
function readJsonBody(req) {
  return new Promise((resolve) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > 16_384) { resolve({}); req.destroy(); return }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (chunks.length === 0) { resolve({}); return }
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))) } catch { resolve({}) }
    })
    req.on('error', () => resolve({}))
  })
}

const readChatLog = createLogCache()
const priceBook = createPriceBook({ readKey })
const anthropicPrices = createAnthropicPrices()

/**
 * خرجِ دقیقِ یک چت: لاگِ سشن + قیمتِ هر gen-… از OpenRouter.
 * فرزندان (ساب‌ایجنت‌ها) هم حساب می‌شوند: هر کدام سشنِ خودش را دارد.
 * @param sessionId - شناسهٔ سشن.
 * @returns خلاصهٔ هزینه یا { found: false }.
 */
export async function chatCost(sessionId, deps = { readChatLog, priceBook, anthropicPrices }) {
  const parsed = await deps.readChatLog(sessionId)
  if (!parsed) return { sessionId, found: false }
  const anth = deps.anthropicPrices
  const price = {
    priceOf: id => deps.priceBook.priceOf(id),
    detailOf: id => (typeof deps.priceBook.detailOf === 'function' ? deps.priceBook.detailOf(id) : null),
    anthropic: model => (anth ? anth.priceOf(model) : null),
  }
  const summary = summarizeChatCost(parsed, price.priceOf, price.detailOf, price.anthropic)
  // ساب‌ایجنت‌ها: هر فرزند لاگِ خودش را دارد؛ تودرتو هم دنبال می‌شود (با سدِ دور و عمق).
  const children = await collectDescendants(async (childId) => {
    const childParsed = await deps.readChatLog(childId)
    if (!childParsed) return null
    // subagents لازم است: تا فرزندانِ خودِ این فرزند هم پیدا شوند (تودرتو).
    return {
      ...summarizeChatCost(childParsed, price.priceOf, price.detailOf, price.anthropic),
      subagents: Array.isArray(childParsed.subagents) ? childParsed.subagents : [],
    }
  }, Array.isArray(parsed.subagents) ? parsed.subagents : [])
  const kids = summarizeSubagents(children, summary.total)
  // صفِ قیمت یک بار برای همه (خودِ چت و همهٔ فرزندان).
  deps.priceBook.flush()
  return {
    sessionId,
    found: true,
    ts: Date.now(),
    ...summary,
    subagents: kids.subagents,
    subagentTotal: kids.subagentTotal,
    subagentPending: kids.subagentPending,
    subagentModels: kids.subagentModels,
    grandTotal: kids.grandTotal,
    anthropicSource: anth ? anth.source() : null,
  }
}

/** متنِ باز‌شدهٔ لاگ‌ها در حافظه: هر سشن فقط تا وقتی فایل عوض نشده. */
const rawTextCache = new Map()
const RAW_CACHE_MAX = 4

/**
 * متنِ خامِ لاگِ یک سشن (کلِ فایل، بی هیچ دست‌کاری).
 * @param sessionId - شناسهٔ سشن.
 * @returns {{ file: string, text: string } | null}
 */
export async function rawLogText(sessionId) {
  const file = findSessionLog(sessionId)
  if (!file) return null
  const stat = await fs.promises.stat(file)
  const stamp = `${stat.mtimeMs}:${stat.size}`
  const hit = rawTextCache.get(file)
  if (hit && hit.stamp === stamp) return { file, text: hit.text }
  const text = await decompressAsync(await fs.promises.readFile(file))
  rawTextCache.delete(file)
  rawTextCache.set(file, { stamp, text })
  // فقط چند چتِ آخر بماند (هر لاگ ده‌ها مگابایت متن است).
  while (rawTextCache.size > RAW_CACHE_MAX) rawTextCache.delete(rawTextCache.keys().next().value)
  return { file, text }
}

/**
 * جوابِ دادهٔ خامِ همین چت: صفحه‌بندی + جست‌وجو، یا کلِ فایل برای دانلود.
 * @param url - آدرسِ کاملِ درخواست (یا نسبی).
 * @returns جوابِ JSON / متن.
 */
export async function rawLogAnswer(url) {
  const params = new URL(url, 'http://localhost').searchParams
  const sessionId = params.get('sessionId') || ''
  const found = await rawLogText(sessionId)
  if (!found) return { kind: 'json', body: { sessionId, found: false } }
  if (params.get('download') === '1') return { kind: 'download', sessionId, text: found.text }
  const slice = sliceRawLines(splitLogLines(found.text), {
    from: params.get('from') ?? undefined,
    limit: params.get('limit') ?? undefined,
    q: params.get('q') ?? undefined,
  })
  return { kind: 'json', body: { sessionId, found: true, ...slice } }
}

/** آخرین وضعیتِ کلید؛ حداکثر هر ۱.۵ ثانیه یک درخواست. */
async function keyState() {
  if (cache.value && Date.now() - cache.ts < CACHE_MS) return cache.value
  const apiKey = readKey()
  if (!apiKey) throw new Error('OPENROUTER_API_KEY پیدا نشد (نه در env، نه در ~/.dsh/.env)')
  const res = await fetch(`${OPENROUTER}/key`, {
    headers: { authorization: `Bearer ${apiKey}`, accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`openrouter /key → HTTP ${res.status}`)
  const body = await res.json()
  const data = body.data || {}
  const value = {
    limit: data.limit ?? null,
    usage: data.usage ?? null,
    remaining: data.limit_remaining ?? null,
    daily: data.usage_daily ?? null,
    ts: Date.now(),
  }
  cache = { ts: Date.now(), value }
  return value
}

/**
 * ثبتِ مسیرِ HTTP و سرویسِ داده.
 * @param ctx - Cordis context.
 */
export function apply(ctx) {
  ctx.inject(['webServer'], web => {
    const server = web.webServer
    web.effect(() => server.register({
      kind: 'exact',
      path: '/plugins/side-panel/cost',
      handler: async (req, res) => {
        res.setHeader('content-type', 'application/json; charset=utf-8')
        res.setHeader('cache-control', 'no-store')
        if (refuse(req, res)) return
        try {
          res.end(JSON.stringify(await keyState()))
        } catch (err) {
          res.statusCode = 502
          res.end(JSON.stringify({ error: String(err && err.message ? err.message : err) }))
        }
      },
    }))

    web.effect(() => server.register({
      kind: 'exact',
      path: '/plugins/side-panel/diag',
      // ثبتِ تشخیصی: هر POST یک خط JSON در diag.log داخلِ پوشهٔ پروژه می‌نویسد.
      handler: async (req, res) => {
        res.setHeader('content-type', 'application/json; charset=utf-8')
        res.setHeader('cache-control', 'no-store')
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.setHeader('allow', 'POST')
          res.end(JSON.stringify({ error: 'فقط POST' }))
          return
        }
        if (refuse(req, res)) return
        // فقط application/json: فرمِ سادهٔ مرورگر (text/plain، بی preflight) راه ندارد.
        if (!/^application\/json\b/i.test(String(req.headers && req.headers['content-type'] || ''))) {
          res.statusCode = 415
          res.end(JSON.stringify({ error: 'فقط application/json' }))
          return
        }
        try {
          const body = await readJsonBody(req)
          const line = JSON.stringify({ ts: new Date().toISOString(), ...body }) + '\n'
          // سقفِ ۱ مگابایت: diag.log نباید بی‌حد بزرگ شود.
          let size = 0
          try { size = fs.statSync(DIAG_PATH).size } catch { size = 0 }
          if (size + Buffer.byteLength(line) > DIAG_MAX_BYTES) {
            res.statusCode = 507
            res.end(JSON.stringify({ error: 'diag.log پر است (۱ مگابایت)' }))
            return
          }
          fs.appendFileSync(DIAG_PATH, line)
          res.end(JSON.stringify({ ok: true }))
        } catch (err) {
          res.statusCode = 500
          res.end(JSON.stringify({ error: String(err && err.message ? err.message : err) }))
        }
      },
    }))

    web.effect(() => server.register({
      kind: 'exact',
      path: '/plugins/side-panel/session-cost',
      handler: async (req, res) => {
        res.setHeader('content-type', 'application/json; charset=utf-8')
        res.setHeader('cache-control', 'no-store')
        if (refuse(req, res)) return
        try {
          const url = new URL(req.url, 'http://localhost')
          const sessionId = url.searchParams.get('sessionId') || ''
          res.end(JSON.stringify(await chatCost(sessionId)))
        } catch (err) {
          res.statusCode = 500
          res.end(JSON.stringify({ error: String(err && err.message ? err.message : err) }))
        }
      },
    }))

    web.effect(() => server.register({
      kind: 'exact',
      path: '/plugins/side-panel/raw-log',
      handler: async (req, res) => {
        res.setHeader('cache-control', 'no-store')
        if (refuse(req, res)) return
        try {
          const answer = await rawLogAnswer(req.url)
          if (answer.kind === 'download') {
            res.setHeader('content-type', 'application/x-ndjson; charset=utf-8')
            res.setHeader('content-disposition', `attachment; filename="${String(answer.sessionId).replace(/[^A-Za-z0-9_-]/g, '')}.jsonl"`)
            res.end(answer.text)
            return
          }
          res.setHeader('content-type', 'application/json; charset=utf-8')
          res.end(JSON.stringify(answer.body))
        } catch (err) {
          res.statusCode = 500
          res.setHeader('content-type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({ error: String(err && err.message ? err.message : err) }))
        }
      },
    }))
  })
}