/**
 * Side Panel — Host half
 * -----------------------
 * فقط یک کار می‌کند: هزینهٔ زندهٔ کلیدِ OpenRouter را می‌خواند و به کلاینت می‌دهد.
 * کلید هرگز به مرورگر نمی‌رود (قاعدهٔ امنیتی: poll فقط در host).
 *
 *   GET /plugins/side-panel/cost → {limit, usage, remaining, daily, ts}   (کلِ کلید)
 *   GET /plugins/side-panel/session-cost?sessionId=… → خرجِ دقیقِ همین چت (cost-log.js)
 *   POST /plugins/side-panel/diag → یک خط در diag.log (تشخیص)
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createLogCache, createPriceBook, summarizeChatCost } from './cost-log.js'

const OPENROUTER = 'https://openrouter.ai/api/v1'
const ENV_PATH = path.join(os.homedir(), '.dsh', '.env')
const CACHE_MS = 1500

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

/**
 * خرجِ دقیقِ یک چت: لاگِ سشن + قیمتِ هر gen-… از OpenRouter.
 * @param sessionId - شناسهٔ سشن.
 * @returns خلاصهٔ هزینه یا { found: false }.
 */
export function chatCost(sessionId, deps = { readChatLog, priceBook }) {
  const parsed = deps.readChatLog(sessionId)
  if (!parsed) return { sessionId, found: false }
  const summary = summarizeChatCost(parsed, id => deps.priceBook.priceOf(id), id => (typeof deps.priceBook.detailOf === 'function' ? deps.priceBook.detailOf(id) : null))
  deps.priceBook.flush()
  return { sessionId, found: true, ts: Date.now(), ...summary }
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
        try {
          const body = await readJsonBody(req)
          const line = JSON.stringify({ ts: new Date().toISOString(), ...body }) + '\n'
          fs.appendFileSync(path.join(os.homedir(), '1-MY-WORK', '136th-day-fix-rtl-claude', 'dsh-side-panel', 'diag.log'), line)
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
        try {
          const url = new URL(req.url, 'http://localhost')
          const sessionId = url.searchParams.get('sessionId') || ''
          res.end(JSON.stringify(chatCost(sessionId)))
        } catch (err) {
          res.statusCode = 500
          res.end(JSON.stringify({ error: String(err && err.message ? err.message : err) }))
        }
      },
    }))
  })
}