/**
 * Side Panel — هزینهٔ دقیقِ هر چت (نصفِ host)
 * ------------------------------------------------
 * حبیب: «باید به تفکیک چت باشه» · «همون لحظه که ما تماس با مدل داریم».
 *
 * راه: لاگِ خودِ سشن (~/.dsh/sessions/<پوشه>/<sessionId>/session.v4.jsonl.zstd) را
 * می‌خوانیم؛ هر جوابِ مدل یک responseId (gen-…) دارد. OpenRouter برای هر gen-…
 * هزینهٔ دقیقِ دلاری را در /api/v1/generation?id= می‌دهد (همان عددِ صفحهٔ Activity).
 * جمعِ این‌ها = خرجِ واقعیِ همین چت؛ نه کلِ کلید، نه تخمین.
 *
 * کلید هرگز به مرورگر نمی‌رود؛ همهٔ تماس‌ها از همین‌جا (host) است.
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import zlib from 'node:zlib'
import { spawn, spawnSync } from 'node:child_process'

export const SESSIONS_ROOT = path.join(os.homedir(), '.dsh', 'sessions')
const SAFE_ID = /^[A-Za-z0-9_-]{4,120}$/

/**
 * مسیرِ لاگِ یک سشن را پیدا می‌کند.
 * @param sessionId - شناسهٔ سشن (فقط حروف/عدد/خط تیره؛ جلوی ../ گرفته می‌شود).
 * @param root - ریشهٔ پوشهٔ سشن‌ها.
 * @returns مسیرِ فایل یا null.
 */
export function findSessionLog(sessionId, root = SESSIONS_ROOT) {
  if (typeof sessionId !== 'string' || !SAFE_ID.test(sessionId)) return null
  let dirs = []
  try { dirs = fs.readdirSync(root) } catch { return null }
  for (const dir of dirs) {
    const candidate = path.join(root, dir, sessionId, 'session.v4.jsonl.zstd')
    if (fs.existsSync(candidate)) return candidate
  }
  return null
}

/**
 * باز کردنِ zstd. لاگِ زنده ممکن است قابِ آخرش نیمه‌کاره باشد؛ پس اگر zlib
 * خطا داد، با برنامهٔ zstd همان‌قدری که سالم است را می‌گیریم.
 * @param buffer - بایت‌های فایل.
 * @returns متنِ JSONL.
 */
export function decompress(buffer) {
  // فایل چند «قاب» پشتِ هم دارد (هر بار که لاگ نوشته می‌شود یکی اضافه می‌شود).
  // zlib ِ Node فقط قابِ اول را باز می‌کند ⇒ اول برنامهٔ zstd که همه را باز می‌کند.
  for (const bin of ['/opt/homebrew/bin/zstd', '/usr/local/bin/zstd', 'zstd']) {
    const out = spawnSync(bin, ['-dc'], { input: buffer, maxBuffer: 512 * 1024 * 1024 })
    if (out.stdout && out.stdout.length > 0) return out.stdout.toString('utf8')
  }
  if (typeof zlib.zstdDecompressSync === 'function') {
    // راهِ دوم: قاب‌به‌قاب با نشانهٔ آغازِ قاب (28 B5 2F FD).
    const magic = Buffer.from([0x28, 0xb5, 0x2f, 0xfd])
    const parts = []
    let start = buffer.indexOf(magic)
    while (start >= 0) {
      const next = buffer.indexOf(magic, start + 4)
      try { parts.push(zlib.zstdDecompressSync(buffer.subarray(start, next < 0 ? buffer.length : next)).toString('utf8')) } catch { /* قابِ نیمه‌کاره */ }
      start = next
    }
    if (parts.length > 0) return parts.join('')
  }
  throw new Error('zstd باز نشد (نه برنامهٔ zstd، نه zlib)')
}

const ZSTD_BINS = ['/opt/homebrew/bin/zstd', '/usr/local/bin/zstd', 'zstd']

/** یک بار اجرای zstd -dc بی‌آنکه رشتهٔ اصلیِ host بایستد. */
function zstdAsync(bin, buffer) {
  return new Promise((resolve) => {
    let child
    try { child = spawn(bin, ['-dc'], { stdio: ['pipe', 'pipe', 'ignore'] }) } catch { resolve(null); return }
    const chunks = []
    child.stdout.on('data', chunk => chunks.push(chunk))
    child.on('error', () => resolve(null))
    // لاگِ زنده ممکن است قابِ آخرش نیمه‌کاره باشد ⇒ zstd کدِ خطا می‌دهد ولی هرچه سالم بود بیرون داده.
    child.on('close', () => resolve(chunks.length > 0 ? Buffer.concat(chunks).toString('utf8') : null))
    child.stdin.on('error', () => { /* zstd زودتر بسته شد */ })
    child.stdin.end(buffer)
  })
}

/**
 * همان decompress، ولی ناهمگام: باز کردنِ لاگِ چندمگابایتی (۵۰–۱۵۰ میلی‌ثانیه) دیگر
 * رشتهٔ اصلیِ host را — که جریانِ زندهٔ همهٔ چت‌ها را هم می‌گرداند — قفل نمی‌کند.
 * @param buffer - بایت‌های فایل.
 * @returns متنِ JSONL.
 */
export async function decompressAsync(buffer) {
  for (const bin of ZSTD_BINS) {
    const text = await zstdAsync(bin, buffer)
    if (text) return text
  }
  return decompress(buffer)
}

/** نامِ کوتاهِ مدل: «deepseek/deepseek-v4.1-flash-1017@preset/…» ⇒ «deepseek-v4.1-flash-1017». */
export function shortModel(model) {
  if (typeof model !== 'string' || model === '') return 'نامعلوم'
  const base = model.split('@')[0]
  const parts = base.split('/')
  return parts[parts.length - 1] || base
}

/** اولین متنِ یک پیام، تمیز و کوتاه. */
function firstText(content, max = 160) {
  if (!Array.isArray(content)) return ''
  for (const block of content) {
    if (block && block.type === 'text' && typeof block.text === 'string') {
      // یادداشت‌های خودکارِ اپ (system-reminder، زمان، کانتکست) حرفِ کسی نیستند.
      if (/^\s*(<system-reminder>|Time sampled|Context injection)/.test(block.text)) continue
      let text = block.text
      // پیامِ همتا: سرصفحهٔ [session-message]… (خطِ اول + خط‌های «کلید: مقدار» تا خطِ خالی)
      // را رد کن تا خودِ حرف بیاید — چه declared-write-scopes داشته باشد چه نه.
      text = text.replace(/^\[session-message\][^\n]*\n(?:[a-z-]+: [^\n]*\n)*\n?/, '')
      text = text.replace(/\s+/g, ' ').trim()
      return text.length > max ? text.slice(0, max) + '…' : text
    }
  }
  return ''
}

/**
 * لاگِ JSONL را به فهرستِ رفت‌وبرگشت‌ها با مدل تبدیل می‌کند.
 * @param text - متنِ JSONL.
 * @returns { requests, turns }
 */
export function parseSessionLog(text) {
  const requests = []
  const turns = new Map()
  const stepStart = new Map()
  let pendingTrigger = null
  let currentTurn = null
  for (const line of text.split('\n')) {
    if (line === '') continue
    let event
    try { event = JSON.parse(line) } catch { continue }
    const data = event.data || {}
    if (event.type === 'user/message') {
      const kind = data.source && data.source.kind
      if (kind === 'user' || kind === 'session-message') {
        const trigger = { kind: kind === 'user' ? 'حبیب' : 'پیامِ همتا', text: firstText(data.content) }
        // اپ اول turn/start را می‌نویسد، بعد پیامی که نوبت را راه انداخت.
        const open = currentTurn === null ? null : turns.get(currentTurn)
        if (open && open.trigger === null) open.trigger = trigger
        else pendingTrigger = trigger
      }
    } else if (event.type === 'turn/start' && typeof data.turn === 'number') {
      turns.set(data.turn, { turn: data.turn, time: event.time, trigger: pendingTrigger })
      pendingTrigger = null
      currentTurn = data.turn
    } else if (event.type === 'turn/end') {
      currentTurn = null
    } else if (event.type === 'step/start' && typeof data.turn === 'number') {
      stepStart.set(`${data.turn}:${data.step}`, event.time)
    } else if (event.type === 'assistant/message' && data.message) {
      const source = data.message.source || {}
      const response = source.replayState && source.replayState.response ? source.replayState.response : {}
      const usage = data.usage || {}
      const tools = []
      for (const block of Array.isArray(data.message.content) ? data.message.content : []) {
        if (block && block.type === 'tool-call' && typeof block.name === 'string') tools.push(block.name)
      }
      const started = stepStart.get(`${data.turn}:${data.step}`)
      requests.push({
        turn: data.turn ?? null,
        step: data.step ?? null,
        time: event.time ?? null,
        durationMs: typeof started === 'number' && typeof event.time === 'number' ? event.time - started : null,
        provider: source.provider ?? null,
        model: shortModel(response.responseModel || source.model),
        ref: typeof source.model === 'string' ? source.model : null,
        responseId: typeof response.responseId === 'string' ? response.responseId : null,
        stop: response.stopReason ?? null,
        input: typeof usage.inputTokens === 'number' ? usage.inputTokens : null,
        cached: typeof usage.cacheReadTokens === 'number' ? usage.cacheReadTokens : 0,
        output: typeof usage.outputTokens === 'number' ? usage.outputTokens : null,
        tools,
      })
    }
  }
  return { requests, turns }
}

/**
 * جمع‌بندیِ هزینه از فهرستِ رفت‌وبرگشت‌ها و قیمت‌های دقیق.
 * @param parsed - خروجیِ parseSessionLog.
 * @param priceOf - (responseId) ⇒ عددِ دلار یا undefined (هنوز نیامده) یا null (ندارد).
 * @returns خلاصهٔ آمادهٔ نمایش.
 */

/** نامِ سرور به شکلِ اسلاگ: «Particle AI» ⇒ «particle-ai». */
function slugOf(name) {
  return String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

/** عددِ صحیح با رقمِ فارسی (برچسب‌ها کنارِ متنِ فارسی می‌نشینند؛ قبلاً «318 هزار» لاتین بود). */
function faInt(value) {
  return Math.round(value).toLocaleString('fa-IR', { useGrouping: false })
}

const GAP_MS = 5 * 60 * 1000
const MISS_MIN_PROMPT = 20000
const BIG_PROMPT = 200000
const MANY_STEPS = 20

/**
 * «پولِ الکی»: به هر رفت‌وبرگشت برچسبِ قرمز/زرد می‌زند و می‌گوید چقدر بی‌دلیل خرج شد.
 * قرمز = پولی که می‌شد نداد (کش نخورد چون سرور/مدل عوض شد، مکث، یا سرور کش را نگه نداشت؛
 * یا preset روی یک سرور بود و سرورِ دیگری جواب داد). زرد = گران ولی دلیل دارد (مدلِ pro،
 * چتِ خیلی بزرگ، نوبتِ پرقدم).
 * waste = هزینه − «همین درخواست اگر کش می‌خورد» (نرخِ کش از رفت‌وبرگشت‌های کش‌خوردهٔ
 * همان مدل و همان سرور در همین چت؛ اگر نبود، همان مدل با هر سرور؛ اگر نبود، نامعلوم).
 * @param rows - ردیف‌ها به ترتیبِ زمان، با cost و detail.
 * @returns همان ردیف‌ها با flags و waste.
 */
export function flagWaste(rows) {
  const ratio = (row) => (row.promptN > 0 ? row.cachedN / row.promptN : 1)
  const hitRates = new Map()
  const push = (key, value) => { const list = hitRates.get(key) ?? []; list.push(value); hitRates.set(key, list) }
  for (const row of rows) {
    if (row.cost === null || !(row.promptN > 0) || ratio(row) < 0.9) continue
    push(row.model + '|' + (row.real || ''), row.cost / row.promptN)
    push(row.model + '|*', row.cost / row.promptN)
  }
  const median = (list) => { const s = list.slice().sort((a, b) => a - b); return s[Math.floor(s.length / 2)] }
  const rateFor = (row) => {
    const own = hitRates.get(row.model + '|' + (row.real || ''))
    if (own && own.length > 0) return median(own)
    const any = hitRates.get(row.model + '|*')
    return any && any.length > 0 ? median(any) : null
  }
  const stepsPerTurn = new Map()
  for (const row of rows) stepsPerTurn.set(row.turn, (stepsPerTurn.get(row.turn) ?? 0) + 1)

  let prev = null
  return rows.map((row) => {
    const flags = []
    let waste = 0
    const miss = row.promptN >= MISS_MIN_PROMPT && ratio(row) < 0.5
    if (miss) {
      let kind
      let text
      if (prev === null) { kind = 'first'; text = 'اولین درخواستِ چت — کش هنوز ساخته نشده (طبیعی)' }
      else if (prev.ref !== row.ref) { kind = 'model'; text = 'مدل/preset وسطِ چت عوض شد ⇒ کش از دست رفت' }
      else if (prev.real && row.real && prev.real !== row.real) { kind = 'provider'; text = 'سرور عوض شد: ' + prev.real + ' ← ' + row.real + ' ⇒ کشِ سرورِ قبلی به کار نیامد' }
      else if (typeof prev.time === 'number' && typeof row.time === 'number' && row.time - prev.time > GAP_MS) { kind = 'gap'; text = 'بیش از ۵ دقیقه مکث ⇒ سرور کش را پاک کرد' }
      else { kind = 'dropped'; text = 'سرورِ ' + (row.real || '؟') + ' کش را نگه نداشت (همان سرور، کمتر از ۵ دقیقه بعد)' }
      const rate = rateFor(row)
      const ifCached = rate === null ? null : row.promptN * rate
      waste = kind === 'first' || row.cost === null || ifCached === null ? 0 : Math.max(0, row.cost - ifCached)
      flags.push({ kind, level: kind === 'first' ? 'info' : 'red', text, waste: kind === 'first' ? 0 : (ifCached === null ? null : waste) })
    }
    const presetMatch = typeof row.ref === 'string' ? row.ref.match(/@preset\/mh-.+$/) : null
    if (presetMatch && row.real && !presetMatch[0].endsWith('-' + slugOf(row.real))) {
      flags.push({ kind: 'fallback', level: 'red', text: 'preset روی سرورِ دیگری بود ولی ' + row.real + ' جواب داد (جایگزینِ خودکار) ⇒ کش به خطر افتاد' })
    }
    if (/-pro(\b|-)/.test(row.model || '')) flags.push({ kind: 'pro', level: 'amber', text: 'مدلِ گران (pro) — هر توکن چند برابرِ flash' })
    if (row.promptN > BIG_PROMPT) flags.push({ kind: 'big', level: 'amber', text: 'چت خیلی بزرگ است: ' + faInt(row.promptN / 1000) + ' هزار توکن در هر درخواست' })
    if ((stepsPerTurn.get(row.turn) ?? 0) > MANY_STEPS) flags.push({ kind: 'steps', level: 'amber', text: 'این نوبت ' + faInt(stepsPerTurn.get(row.turn)) + ' رفت‌وبرگشت داشت؛ هر قدم کلِ تاریخچه را دوباره می‌فرستد' })
    if (row.responseId && row.responseId.startsWith('gen-')) prev = row
    return { ...row, flags, waste }
  })
}

/** جمعِ «پولِ الکی» به تفکیکِ علت. */
export function summarizeWaste(rows) {
  const byKind = {}
  let total = 0
  let unknown = 0
  for (const row of rows) {
    for (const flag of row.flags || []) {
      const entry = byKind[flag.kind] ?? { kind: flag.kind, level: flag.level, count: 0, usd: 0, cost: 0 }
      entry.count += 1
      entry.cost += row.cost ?? 0
      if (typeof flag.waste === 'number') entry.usd += flag.waste
      else if (flag.level === 'red' && flag.waste === null) unknown += 1
      byKind[flag.kind] = entry
    }
    total += row.waste || 0
  }
  return { total, unknown, byKind }
}

/** وزنِ تقریبیِ یک رفت‌وبرگشت وقتی قیمتِ دقیق نیست. */
function weight(row) {
  return (row.input ?? 0) + (row.cached ?? 0) * 0.1 + (row.output ?? 0) * 4
}

/** فقط جواب‌های OpenRouter شناسهٔ gen-… دارند و قیمتِ دقیق‌شان قابلِ پرسیدن است. */
export function isOpenRouterId(id) {
  return typeof id === 'string' && id.startsWith('gen-')
}

export function summarizeChatCost(parsed, priceOf, detailOf = () => null) {
  const pricedRows = parsed.requests.map((row) => {
    const base = { ...row, promptN: (row.input ?? 0) + (row.cached ?? 0), cachedN: row.cached ?? 0, real: null }
    // جوابِ OpenRouter که شناسهٔ gen-… ندارد (قطع‌شده/خطا) هم بی‌قیمت است، ولی «غیرِ OpenRouter» نیست.
    if (!isOpenRouterId(row.responseId)) return { ...base, cost: null, pending: false, unpriceable: true, noId: row.provider === 'openrouter' }
    const cost = priceOf(row.responseId)
    const detail = detailOf(row.responseId)
    return {
      ...base,
      cost: typeof cost === 'number' ? cost : null,
      pending: cost === undefined,
      unpriceable: false,
      real: detail && detail.provider ? detail.provider : null,
      promptN: detail && typeof detail.prompt === 'number' ? detail.prompt : base.promptN,
      cachedN: detail && typeof detail.cached === 'number' ? detail.cached : base.cachedN,
    }
  })
  const rows = flagWaste(pricedRows)
  const waste = summarizeWaste(rows)
  let total = 0
  let priced = 0
  let pending = 0
  let unpriceable = 0
  let noId = 0
  const tokens = { input: 0, cached: 0, output: 0 }
  const providers = new Set()
  const byModel = new Map()
  const byTurn = new Map()
  for (const row of rows) {
    if (row.cost !== null) { total += row.cost; priced += 1 }
    if (row.pending) pending += 1
    if (row.unpriceable) unpriceable += 1
    if (row.noId) noId += 1
    tokens.input += row.input ?? 0
    tokens.cached += row.cached ?? 0
    tokens.output += row.output ?? 0
    if (row.real || row.provider) providers.add(row.real || row.provider)
    const model = byModel.get(row.model) ?? { model: row.model, count: 0, cost: 0, pending: 0, unpriced: 0, input: 0, cached: 0, output: 0 }
    model.count += 1
    // قیمتِ نیامده جمعِ مدل را «$0» ِ دروغ نکند: جدا شمرده می‌شود.
    if (row.pending) model.pending += 1
    if (row.unpriceable) model.unpriced += 1
    model.cost += row.cost ?? 0
    model.input += row.input ?? 0
    model.cached += row.cached ?? 0
    model.output += row.output ?? 0
    byModel.set(row.model, model)
    const turnInfo = parsed.turns.get(row.turn)
    const turn = byTurn.get(row.turn) ?? { turn: row.turn, cost: 0, requests: 0, trigger: turnInfo ? turnInfo.trigger : null, time: turnInfo ? turnInfo.time : row.time }
    turn.cost += row.cost ?? 0
    turn.waste = (turn.waste ?? 0) + (row.waste || 0)
    turn.requests += 1
    byTurn.set(row.turn, turn)
  }
  const newestFirst = rows.slice().reverse()
  return {
    requests: rows.length,
    priced,
    pending,
    unpriceable,
    noId,
    waste,
    providers: [...providers],
    tokens,
    total,
    last: newestFirst[0] ?? null,
    byModel: [...byModel.values()].sort((a, b) => b.cost - a.cost),
    // با قیمت ⇒ پرخرج‌ترین‌ها؛ بی‌قیمت (غیر OpenRouter) ⇒ سنگین‌ترین‌ها بر اساسِ توکن
    // (وزنِ تقریبیِ قیمت‌ها: ورودیِ تازه ۱، کش ۰٫۱، خروجی ۴).
    top: priced > 0
      ? rows.filter(row => row.cost !== null).sort((a, b) => b.cost - a.cost).slice(0, 5)
      : rows.slice().sort((a, b) => weight(b) - weight(a)).slice(0, 5),
    topBy: priced > 0 ? 'cost' : 'tokens',
    wasteTop: rows.filter(row => row.waste > 0).sort((a, b) => b.waste - a.waste).slice(0, 5),
    turns: [...byTurn.values()].reverse().slice(0, 25),
    list: newestFirst.slice(0, 80),
  }
}

/**
 * انبارِ قیمت‌ها: هر gen-… فقط یک بار از OpenRouter پرسیده می‌شود.
 * جوابِ تازه ممکن است چند ثانیه ۴۰۴ بدهد ⇒ دوباره، با فاصله.
 */
export function createPriceBook({ readKey, fetchImpl = fetch, concurrency = 4, retryMs = 4000 }) {
  const prices = new Map() // id ⇒ number | null
  const details = new Map() // id ⇒ { provider, prompt, cached, output }
  const retryAt = new Map() // id ⇒ زمانِ تلاشِ بعدی
  const attempts = new Map()
  const queue = []
  const fresh = [] // شناسه‌های تازه در همین دور (به ترتیبِ زمان)
  const queued = new Set()
  const flying = new Set() // در حالِ پرسیدن ⇒ دوباره در صف نرود (پرسشِ تکراری)
  let inFlight = 0

  const pump = () => {
    while (inFlight < concurrency && queue.length > 0) {
      const id = queue.shift()
      queued.delete(id)
      inFlight += 1
      flying.add(id)
      lookup(id).finally(() => { inFlight -= 1; flying.delete(id); pump() })
    }
  }

  async function lookup(id) {
    const key = readKey()
    if (!key) return
    try {
      const res = await fetchImpl(`https://openrouter.ai/api/v1/generation?id=${encodeURIComponent(id)}`, {
        headers: { authorization: `Bearer ${key}`, accept: 'application/json' },
      })
      if (res.ok) {
        const body = await res.json()
        const data = body && body.data ? body.data : {}
        const cost = typeof data.total_cost === 'number' ? data.total_cost : typeof data.usage === 'number' ? data.usage : null
        details.set(id, {
          provider: typeof data.provider_name === 'string' ? data.provider_name : null,
          prompt: typeof data.native_tokens_prompt === 'number' ? data.native_tokens_prompt : null,
          cached: typeof data.native_tokens_cached === 'number' ? data.native_tokens_cached : null,
          output: typeof data.native_tokens_completion === 'number' ? data.native_tokens_completion : null,
        })
        prices.set(id, cost)
        return
      }
      const tries = (attempts.get(id) ?? 0) + 1
      attempts.set(id, tries)
      // بعد از ۸ بار (حدودِ نیم دقیقه) دیگر نمی‌پرسیم: این جواب قیمت ندارد.
      if (tries >= 8 || res.status === 400) prices.set(id, null)
      else retryAt.set(id, Date.now() + retryMs)
    } catch {
      retryAt.set(id, Date.now() + retryMs)
    }
  }

  return {
    /** قیمتِ یک gen-…؛ undefined یعنی هنوز نیامده (و در صف گذاشته می‌شود). */
    priceOf(id) {
      if (prices.has(id)) return prices.get(id)
      const wait = retryAt.get(id)
      if (!queued.has(id) && !flying.has(id) && (wait === undefined || wait <= Date.now())) {
        retryAt.delete(id)
        queued.add(id)
        fresh.push(id)
      }
      return undefined
    },
    /** جزئیاتِ OpenRouter برای یک gen-… (سرورِ واقعی و کشِ واقعی) یا null. */
    detailOf(id) { return details.get(id) ?? null },
    /**
     * پس از هر دورِ priceOf صدا بزن تا صف راه بیفتد: تازه‌ترینِ این دور اول، بعد
     * باقیِ صفِ قبلی به همان ترتیبِ خودش (قبلاً کلِ صف هر بار برعکس می‌شد ⇒ ترتیب
     * یک‌درمیان عوض می‌شد و قدیمی‌ها گاهی جلو می‌افتادند).
     */
    flush() { queue.unshift(...fresh.reverse()); fresh.length = 0; pump() },
    size() { return prices.size },
  }
}

/**
 * لاگِ پارس‌شده را تا وقتی فایل عوض نشده نگه می‌دارد (ناهمگام).
 * چند درخواستِ هم‌زمان برای یک فایل (قرصِ پایین + پنل) فقط یک بار باز می‌کنند.
 * @returns read(sessionId) ⇒ Promise<parsed | null>
 */
export function createLogCache({ root = SESSIONS_ROOT, max = 12 } = {}) {
  const cache = new Map()
  const inflight = new Map()
  return async function read(sessionId) {
    const file = findSessionLog(sessionId, root)
    if (!file) return null
    const stat = await fs.promises.stat(file)
    const stamp = `${stat.size}:${stat.mtimeMs}`
    const hit = cache.get(file)
    if (hit && hit.stamp === stamp) return hit.parsed
    const key = file + '|' + stamp
    if (inflight.has(key)) return inflight.get(key)
    const job = (async () => {
      const parsed = parseSessionLog(await decompressAsync(await fs.promises.readFile(file)))
      cache.delete(file)
      cache.set(file, { stamp, parsed })
      // فقط چند چتِ آخر در حافظه بماند (هر لاگِ بزرگ ده‌ها مگابایت متن است).
      while (cache.size > max) cache.delete(cache.keys().next().value)
      return parsed
    })()
    inflight.set(key, job)
    try { return await job } finally { inflight.delete(key) }
  }
}