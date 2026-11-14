/**
 * Model Hunter — اندازه‌گیریِ واقعی از چت‌های خودمان
 * ----------------------------------------------------
 * قیمتِ فهرستِ OpenRouter کافی نیست: سرورِ ارزانی که کش را نگه ندارد، هر چند
 * درخواست یک بار کلِ تاریخچه را با قیمتِ کامل می‌خواند و گران‌تر درمی‌آید
 * (۱۴ نوامبر: Baidu ۴۲ بار از ۸۳۵ بی‌دلیل کش نخورد ⇒ ۲٫۲ دلار از ۸٫۷).
 *
 * این‌جا لاگِ همهٔ چت‌ها خوانده می‌شود، برای هر جوابِ OpenRouter (gen-…) سرورِ واقعی
 * و کشِ واقعی از /api/v1/generation گرفته می‌شود (روی دیسک نگه داشته می‌شود تا
 * دوباره پرسیده نشود)، و برای هر «مدل × سرور» درصدِ «کش‌نخوردنِ بی‌دلیل» حساب می‌شود:
 * همان سرور، همان مدل، کمتر از ۵ دقیقه بعد از درخواستِ قبلیِ همان چت، و باز هم کش نخورد.
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import zlib from 'node:zlib'
import { spawnSync } from 'node:child_process'

export const SESSIONS_ROOT = path.join(os.homedir(), '.dsh', 'sessions')
export const CACHE_FILE = path.join(os.homedir(), '.dsh', 'storages', 'model-hunter', 'generations.json')
const GAP_MS = 5 * 60 * 1000
const MISS_MIN_PROMPT = 20000

/** zstd ِ چندقابی (لاگِ زنده) ⇒ متن. */
export function decompress(buffer) {
  for (const bin of ['/opt/homebrew/bin/zstd', '/usr/local/bin/zstd', 'zstd']) {
    const out = spawnSync(bin, ['-dc'], { input: buffer, maxBuffer: 512 * 1024 * 1024 })
    if (out.stdout && out.stdout.length > 0) return out.stdout.toString('utf8')
  }
  if (typeof zlib.zstdDecompressSync === 'function') {
    const magic = Buffer.from([0x28, 0xb5, 0x2f, 0xfd])
    const parts = []
    let start = buffer.indexOf(magic)
    while (start >= 0) {
      const next = buffer.indexOf(magic, start + 4)
      try { parts.push(zlib.zstdDecompressSync(buffer.subarray(start, next < 0 ? buffer.length : next)).toString('utf8')) } catch { /* قابِ نیمه‌کاره */ }
      start = next
    }
    return parts.join('')
  }
  return ''
}

/**
 * جواب‌های OpenRouter ِ یک لاگ، به ترتیبِ زمان.
 * @returns [{ id, time, ref, model }] — model = شناسهٔ مدل بی‌preset
 */
export function requestsOfLog(text) {
  const rows = []
  for (const line of text.split('\n')) {
    if (!line.includes('"assistant/message"')) continue
    let event
    try { event = JSON.parse(line) } catch { continue }
    const source = event.data && event.data.message && event.data.message.source ? event.data.message.source : {}
    const response = source.replayState && source.replayState.response ? source.replayState.response : {}
    if (typeof response.responseId !== 'string' || !response.responseId.startsWith('gen-')) continue
    const ref = typeof source.model === 'string' ? source.model : ''
    rows.push({ id: response.responseId, time: event.time, ref, model: ref.split('@')[0] })
  }
  return rows
}

/** آخرین مدلی که هر چت با آن کار کرده (برای «فقط چت‌های همین مدل را عوض کن»). */
export function lastRefOfLog(text) {
  let ref = null
  for (const line of text.split('\n')) {
    if (line.includes('"assistant/message"') || line.includes('"model/selection"')) {
      let event
      try { event = JSON.parse(line) } catch { continue }
      const data = event.data || {}
      if (event.type === 'assistant/message' && data.message && data.message.source && typeof data.message.source.model === 'string') ref = data.message.source.model
      if (event.type === 'model/selection') {
        const m = data.model || (data.selection && data.selection.model)
        if (typeof m === 'string') ref = m
      }
    }
  }
  return ref
}

/** همهٔ لاگ‌های چند روزِ اخیر ⇒ { sessionId: rows } */
export function recentLogs({ root = SESSIONS_ROOT, days = 7, now = Date.now() } = {}) {
  const out = {}
  let dirs = []
  try { dirs = fs.readdirSync(root) } catch { return out }
  for (const dir of dirs) {
    let sessions = []
    try { sessions = fs.readdirSync(path.join(root, dir)) } catch { continue }
    for (const session of sessions) {
      const file = path.join(root, dir, session, 'session.v4.jsonl.zstd')
      let stat
      try { stat = fs.statSync(file) } catch { continue }
      if (now - stat.mtimeMs > days * 86400000) continue
      const rows = requestsOfLog(decompress(fs.readFileSync(file)))
      if (rows.length > 0) out[session] = rows
    }
  }
  return out
}

/** شناسهٔ سشن ⇒ مسیرِ لاگ (فقط حروف/عدد/خط تیره). */
export function logPathOf(sessionId, root = SESSIONS_ROOT) {
  if (typeof sessionId !== 'string' || !/^[A-Za-z0-9_-]{4,120}$/.test(sessionId)) return null
  let dirs = []
  try { dirs = fs.readdirSync(root) } catch { return null }
  for (const dir of dirs) {
    const file = path.join(root, dir, sessionId, 'session.v4.jsonl.zstd')
    if (fs.existsSync(file)) return file
  }
  return null
}

/** آمارِ هر «مدل × سرور» از روی جزئیاتِ OpenRouter. خالص؛ آزمون‌پذیر. */
export function providerStats(logs, detailOf) {
  const stats = new Map()
  const entry = (key, model, provider) => {
    if (!stats.has(key)) stats.set(key, { model, provider, requests: 0, eligible: 0, misses: 0, cost: 0, prompt: 0, cached: 0, fallbacks: 0 })
    return stats.get(key)
  }
  for (const rows of Object.values(logs)) {
    let prev = null
    for (const row of rows) {
      const d = detailOf(row.id)
      if (!d || !d.provider) { prev = null; continue }
      const s = entry(row.model + '|' + d.provider, row.model, d.provider)
      s.requests += 1
      s.cost += d.cost || 0
      s.prompt += d.prompt || 0
      s.cached += d.cached || 0
      const presetSlug = (row.ref.match(/@preset\/(mh-.+)$/) || [])[1]
      if (presetSlug && !presetSlug.endsWith('-' + String(d.provider).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''))) s.fallbacks += 1
      // «باید کش می‌خورد»: همان سرور و همان مدل، کمتر از ۵ دقیقه بعد، و پرامپتِ بزرگ.
      if (prev && prev.provider === d.provider && prev.ref === row.ref && row.time - prev.time <= GAP_MS && (d.prompt || 0) >= MISS_MIN_PROMPT) {
        s.eligible += 1
        if ((d.cached || 0) / d.prompt < 0.5) s.misses += 1
      }
      prev = { provider: d.provider, ref: row.ref, time: row.time }
    }
  }
  return [...stats.values()].map(s => ({
    ...s,
    missPct: s.eligible > 0 ? Math.round((s.misses / s.eligible) * 1000) / 10 : null,
    cachePct: s.prompt > 0 ? Math.round((s.cached / s.prompt) * 1000) / 10 : null,
    costPerRequest: s.requests > 0 ? s.cost / s.requests : null,
  }))
}

/** دفترِ جزئیاتِ OpenRouter روی دیسک: هر gen-… یک بار پرسیده می‌شود. */
export function createGenerationBook({ readKey, file = CACHE_FILE, fetchImpl = fetch, concurrency = 6 }) {
  let book = {}
  try { book = JSON.parse(fs.readFileSync(file, 'utf8')) } catch { book = {} }
  const save = () => {
    try { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(book)) } catch { /* فقط کش است */ }
  }
  return {
    detailOf: (id) => book[id] || null,
    /** جزئیاتِ نپرسیده‌ها را می‌گیرد (حداکثر limit تا، تازه‌ترها اول). */
    async fill(ids, limit = 3000) {
      const key = readKey()
      if (!key) return 0
      const todo = ids.filter(id => !(id in book)).slice(-limit).reverse()
      let i = 0
      let got = 0
      const worker = async () => {
        while (i < todo.length) {
          const id = todo[i++]
          try {
            const res = await fetchImpl('https://openrouter.ai/api/v1/generation?id=' + encodeURIComponent(id), { headers: { authorization: 'Bearer ' + key } })
            if (!res.ok) continue
            const data = ((await res.json()) || {}).data || {}
            book[id] = {
              provider: data.provider_name || null,
              cost: typeof data.total_cost === 'number' ? data.total_cost : typeof data.usage === 'number' ? data.usage : 0,
              prompt: data.native_tokens_prompt || 0,
              cached: data.native_tokens_cached || 0,
              output: data.native_tokens_completion || 0,
            }
            got += 1
          } catch { /* بعداً */ }
        }
      }
      await Promise.all(Array.from({ length: concurrency }, worker))
      if (got > 0) save()
      return got
    },
  }
}
