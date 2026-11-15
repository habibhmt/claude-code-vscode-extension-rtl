/**
 * دستیار — منطقِ خالص (بی‌هیچ وابستگی به اپ و به شبکه)
 * -------------------------------------------------------
 * هر چیزی که می‌شود بدونِ Cordis و بدونِ fetch آزمود، همین‌جاست:
 *   ۱) لاگ را به ردیف‌های «شماره | زمان | نوع | حجم» تبدیل می‌کند و ردیفِ غیرعادی را با ⚠ علامت می‌زند.
 *   ۲) کلِ چت را متنِ خوانا می‌کند — هیچ چیز کوتاه نمی‌شود؛ فقط بلابِ غیرمتنی (امضای رمزشده، تصویرِ base64).
 *   ۳) اگر از حدِ زمینهٔ مدل بیشتر شد، فقط قدیمی‌ترین رخدادها می‌افتند و شمارشِ آن‌ها صریح گفته می‌شود.
 *   ۴) پولی که نباید داد: سهمیه، تکرارنشدن، لرزش‌گیرِ ۴۵ ثانیه.
 *   ۵) پاک‌کردنِ راز از متنِ تنظیمات.
 * ورودی‌ها همیشه رشته/آرایه‌اند؛ هر ورودیِ بی‌ربط بی‌خطا نادیده گرفته می‌شود.
 */

/* ------------------------------------------------------------------ عددِ فارسی */

const FA_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹']

/** عدد به رقمِ فارسی با جداکنندهٔ هزارگان («۱۲٬۳۴۵»). */
export function faInt(value) {
  const n = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : 0
  const grouped = String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '٬')
  return (n < 0 ? '−' : '') + grouped.replace(/\d/g, (d) => FA_DIGITS[Number(d)])
}

/** حجمِ خوانا: بایت / کیلوبایت / مگابایت با رقمِ فارسی. */
export function faBytes(bytes) {
  const n = typeof bytes === 'number' && Number.isFinite(bytes) ? bytes : 0
  if (n < 1000) return faInt(n) + ' بایت'
  if (n < 1000 * 1000) return faInt(n / 1000) + ' KB'
  return faInt(n / (1000 * 1000)) + ' MB'
}

/** دلار با رقمِ فارسی و ۴ رقمِ اعشار («۰٫۰۰۱۲»). */
export function faMoneySafe(value) {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : 0
  const digits = Math.abs(n) >= 1 ? 2 : 4
  const parts = Math.abs(n).toFixed(digits).split('.')
  const whole = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '٬')
  const both = whole + '٫' + parts[1]
  return (n < 0 ? '−' : '') + both.replace(/\d/g, (d) => FA_DIGITS[Number(d)])
}

/* ------------------------------------------------------------------ پاک‌کردنِ راز */

const SECRET_KEY = /key|token|secret|password/i
/** مقدارِ env-var (نامِ متغیر) — این خودش راز نیست. */
const ENV_NAME = /^[A-Z][A-Z0-9_]{2,}$/
const REDACTED = '[REDACTED]'

/**
 * آیا مقدارِ این کلید باید پنهان شود؟
 * «نامِ متغیرِ محیطی» راز نیست (apiKeyEnv: OPENROUTER_API_KEY)؛ هر مقدارِ دیگرِ کلیدِ حساس، راز است.
 * @param key - نامِ کلید.
 * @param value - مقدارِ همان کلید.
 */
export function isSecretValue(key, value) {
  if (typeof key !== 'string' || !SECRET_KEY.test(key)) return false
  if (value === null || value === undefined) return false
  const text = typeof value === 'string' ? value.trim() : String(value)
  if (text === '') return false
  if (ENV_NAME.test(text)) return false
  return true
}

/** مقدارِ اسرارآمیز در متنِ آزاد (مثلِ «apiKey: sk-or-v1-…») را پنهان می‌کند. */
export function redactInline(text) {
  if (typeof text !== 'string' || text === '') return ''
  return text
    // apiKey: sk-or-v1-xxxx  |  "token":"abc"  |  password = hunter2
    .replace(/(\b[A-Za-z_][\w-]*(?:key|token|secret|password)[\w-]*\b\s*[:=]\s*)(["']?)([^\s"',}]{4,})\2/gi,
      (whole, head, quote, secret) => (ENV_NAME.test(secret) ? whole : head + quote + REDACTED + quote))
    // کلیدِ خامِ OpenRouter / Anthropic در هر جای متن
    .replace(/\b(sk-or-v1-|sk-ant-|sk-proj-)[A-Za-z0-9_-]{8,}/g, REDACTED)
}

/**
 * متنِ تنظیمات را با حفظِ ساختار پاک می‌کند: کلیدهای حساس در JSON و YAML و «key: value» در متنِ آزاد.
 * @param text - متنِ خام.
 * @returns متنِ پاک‌شده (یا رشتهٔ خالی).
 */
export function redactSecrets(text) {
  if (typeof text !== 'string' || text === '') return ''
  const lines = text.split('\n')
  const out = lines.map((line) => {
    let next = line
    // کلیدِ JSON: "apiKey": "sk-…"
    next = next.replace(/"([^"\n]*)"(\s*:\s*)"([^"\n]*)"/g, (whole, key, colon, value) =>
      isSecretValue(key, value) ? '"' + key + '"' + colon + '"' + REDACTED + '"' : whole)
    // کلیدِ YAML: apiKey: sk-…  (مقدارِ بی‌کوتیشن)
    next = next.replace(/^(\s*-?\s*)([A-Za-z_][\w.-]*)(\s*:\s*)(\S.*)$/, (whole, lead, key, colon, value) => {
      const bare = value.trim()
      if (!isSecretValue(key, bare)) return whole
      return lead + key + colon + REDACTED
    })
    return redactInline(next)
  })
  return out.join('\n')
}

/* ------------------------------------------------------------------ ردیف‌های لاگ + ⚠ */

/** میانهٔ عددی؛ آرایهٔ خالی ⇒ null. */
export function median(values) {
  if (!Array.isArray(values) || values.length === 0) return null
  const sorted = values.slice().sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

/** بازهٔ کمتر از ۳ ردیف میانهٔ معنادار ندارد. */
export const MIN_ROWS_FOR_MEDIAN = 3
/** هر ردیفِ بالای این حجم، هر چه هم باشد، علامت می‌خورد. */
export const BIG_BYTES = 20000
export const BIG_FACTOR = 3

/**
 * ردیف‌های غیرعادی را پیدا می‌کند: حجم بیش از ۳ برابرِ میانهٔ همان نوع (نوعی که دست‌کم ۳ ردیف دارد)
 * یا حجمِ بیش از ۲۰٬۰۰۰ بایت.
 * @param rows - [{ type, bytes }]
 * @returns { flagged: boolean[], medians: Map<string, number> }
 */
export function markUnusual(rows) {
  const list = Array.isArray(rows) ? rows : []
  const byType = new Map()
  for (const row of list) {
    const type = row && typeof row.type === 'string' ? row.type : ''
    if (!byType.has(type)) byType.set(type, [])
    byType.get(type).push(typeof row.bytes === 'number' && Number.isFinite(row.bytes) ? row.bytes : 0)
  }
  const medians = new Map()
  for (const [type, values] of byType) {
    if (values.length >= MIN_ROWS_FOR_MEDIAN) medians.set(type, median(values))
  }
  const flagged = list.map((row) => {
    const bytes = row && typeof row.bytes === 'number' && Number.isFinite(row.bytes) ? row.bytes : 0
    if (bytes > BIG_BYTES) return true
    const type = row && typeof row.type === 'string' ? row.type : ''
    const mid = medians.get(type)
    if (mid === undefined || mid === null || mid <= 0) return false
    // «بیش از ۳ برابر» دقیقاً یعنی > ۳×؛ برابرِ دقیقِ ۳× رسمِ مرز است و علامت نمی‌خورد.
    return bytes > BIG_FACTOR * mid
  })
  return { flagged, medians }
}

const TEHRAN = 'Asia/Tehran'

/** ثانیهٔ دقیقه از ساعتِ تهران: «۱۴:۰۷:۳۲». */
export function tehranClock(timeMs) {
  const t = typeof timeMs === 'number' && Number.isFinite(timeMs) ? timeMs : 0
  try {
    const text = new Intl.DateTimeFormat('en-GB', {
      timeZone: TEHRAN, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    }).format(new Date(t))
    return text.replace(/\d/g, (d) => FA_DIGITS[Number(d)])
  } catch {
    return '--:--:--'
  }
}

/** تاریخِ تهران: «۱۱/۲۵». */
export function tehranDate(timeMs) {
  const t = typeof timeMs === 'number' && Number.isFinite(timeMs) ? timeMs : 0
  try {
    const text = new Intl.DateTimeFormat('en-GB', { timeZone: TEHRAN, month: '2-digit', day: '2-digit' }).format(new Date(t))
    return text.replace(/\d/g, (d) => FA_DIGITS[Number(d)])
  } catch {
    return '--/--'
  }
}

/**
 * خط‌های خامِ JSONL ⇒ ردیف‌ها. خطِ خراب هم یک ردیف است (نوعش «نامعلوم»)، تا چیزی از چشم نیفتد.
 * @param lines - خط‌های متنِ لاگ.
 * @returns آرایهٔ ردیف‌ها به ترتیبِ لاگ.
 */
export function parseLogRows(lines) {
  const list = Array.isArray(lines) ? lines : []
  const rows = []
  for (let i = 0; i < list.length; i += 1) {
    const text = typeof list[i] === 'string' ? list[i] : ''
    if (text === '') continue
    let event = null
    try { event = JSON.parse(text) } catch { event = null }
    const bytes = Buffer.byteLength(text, 'utf8')
    if (!event || typeof event !== 'object') {
      rows.push({ seq: null, time: null, type: 'نامعلوم', bytes, event: null, raw: text })
      continue
    }
    rows.push({
      seq: typeof event.seq === 'number' ? event.seq : null,
      time: typeof event.time === 'number' ? event.time : null,
      type: typeof event.type === 'string' && event.type !== '' ? event.type : 'نامعلوم',
      bytes,
      event,
      raw: text,
    })
  }
  return rows
}

/**
 * فهرستِ فشردهٔ همهٔ ردیف‌ها: «شماره | زمان | نوع | حجم» و ⚠ برای غیرعادی.
 * @param rows - خروجیِ parseLogRows.
 * @returns { text: string, flaggedSeqs: number[], count: number }
 */
export function buildRowIndex(rows) {
  const list = Array.isArray(rows) ? rows : []
  const { flagged } = markUnusual(list.map((row) => ({ type: row.type, bytes: row.bytes })))
  const flaggedSeqs = []
  const lines = []
  for (let i = 0; i < list.length; i += 1) {
    const row = list[i]
    const mark = flagged[i] ? '⚠' : ' '
    const seq = row.seq === null ? '—' : String(row.seq)
    const time = row.time === null ? '--:--:--' : tehranClock(row.time)
    lines.push(mark + ' ' + seq + ' | ' + time + ' | ' + row.type + ' | ' + faBytes(row.bytes))
    if (flagged[i] && row.seq !== null) flaggedSeqs.push(row.seq)
  }
  return { text: lines.join('\n'), flaggedSeqs, count: list.length, flagged }
}

/* ------------------------------------------------------------------ بلاب‌های غیرمتنی */

const B64 = /^[A-Za-z0-9+/=\r\n]{200,}$/

/** رشتهٔ base64/دادهٔ باینریِ بزرگ ⇒ جایگزینِ کوتاه. بقیه را دست نمی‌زند. */
function shrinkBlob(text, kind) {
  if (typeof text !== 'string' || text.length < 200) return text
  const trimmed = text.trim()
  if (!B64.test(trimmed)) return text
  const bytes = Math.floor(trimmed.length * 0.75)
  if (kind === 'image') return '[تصویر ' + faBytes(bytes) + ']'
  if (kind === 'signature') return '[امضای رمزشده ' + faBytes(bytes) + ']'
  return '[دادهٔ باینری ' + faBytes(bytes) + ']'
}

/** کلیدهایی که دادهٔ عظیمِ غیرمتن را در خود دارند. */
const BLOB_KEYS = new Set(['thinkingSignature', 'signature', 'encryptedContent', 'data', 'base64', 'imageData'])

/**
 * یک مقدار را تا ته می‌گردد و پرحجم‌ترین بخش‌های غیرمتنی را با جایگزینِ کوتاه عوض می‌کند.
 * هیچ متنِ خواندنی‌ای کوتاه نمی‌شود.
 */
export function shrinkBlobs(value, depth = 0) {
  if (depth > 12) return value
  if (typeof value === 'string') return shrinkBlob(value, /^image\/|^data:image/.test(value) ? 'image' : 'binary')
  if (Array.isArray(value)) return value.map((item) => shrinkBlobs(item, depth + 1))
  if (!value || typeof value !== 'object') return value
  const out = {}
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === 'string' && BLOB_KEYS.has(key)) {
      const kind = key === 'thinkingSignature' || key === 'signature' ? 'signature' : key === 'imageData' ? 'image' : 'binary'
      out[key] = shrinkBlob(item, kind)
      continue
    }
    if (key === 'stream') {
      // جریانِ خامِ توکن‌به‌توکن فقط تکرارِ همان متن است؛ خروجیِ نهایی همه‌جا هست.
      const count = Array.isArray(item) ? item.length : 0
      out[key] = '[جریانِ خام ' + faInt(count) + ' تکه — متنش در خروجیِ نهایی هست]'
      continue
    }
    out[key] = shrinkBlobs(item, depth + 1)
  }
  return out
}

/* ------------------------------------------------------------------ متنِ کلِ چت */

/** متنِ قطعه‌های یک محتوا (آرایهٔ block‌های پیام). */
function renderContentBlocks(content) {
  const blocks = Array.isArray(content) ? content : []
  const parts = []
  for (const block of blocks) {
    if (!block || typeof block !== 'object') continue
    if (block.type === 'text' && typeof block.text === 'string') { parts.push(block.text); continue }
    if (block.type === 'reasoning' && typeof block.text === 'string') {
      parts.push('  [فکرِ مدل]\n' + indent(block.text)); continue
    }
    if (block.type === 'tool-call') {
      parts.push('  [فراخوانیِ ابزار «' + String(block.name || '?') + '»]\n' + indent(String(block.arguments || '')))
      continue
    }
    if (block.type === 'image' || block.type === 'image-url') {
      parts.push('  [تصویر]'); continue
    }
    parts.push('  [' + String(block.type || 'بلوک') + ']')
  }
  return parts.join('\n')
}

/** هر خطِ متن را دو فاصله تو می‌برد (برای تو رفتگیِ خوانا). */
function indent(text) {
  return String(text).split('\n').map((line) => '  ' + line).join('\n')
}

const CONTENT_EVENTS = new Set([
  'user/message', 'assistant/message', 'tool/result', 'system/message', 'developer/message',
])

/** سرصفحهٔ یک رخداد: «[شمارهٔ ۹] ۱۴:۰۷:۳۲ · user/message». */
function eventHeader(row) {
  const time = row.time === null ? '--:--:--' : tehranClock(row.time)
  const seq = row.seq === null ? '—' : String(row.seq)
  return '[' + seq + '] ' + time + ' · ' + row.type
}

/** متنِ یک رخداد به ترتیبِ لاگ — بی‌کوتاه‌کردن. */
export function renderEvent(row) {
  if (!row || typeof row !== 'object') return ''
  const header = '###### ' + eventHeader(row)
  const event = row.event
  if (!event) return header + '\n' + String(row.raw || '')
  const data = event.data && typeof event.data === 'object' ? event.data : {}
  const lines = [header]
  if (CONTENT_EVENTS.has(row.type)) {
    const message = data.message && typeof data.message === 'object' ? data.message : data
    const role = typeof message.role === 'string' ? message.role : row.type
    const source = message.source && typeof message.source === 'object' && typeof message.source.kind === 'string'
      ? ' · منبع: ' + message.source.kind : ''
    lines.push('نقش: ' + role + source)
    lines.push(renderContentBlocks(message.content))
    // امضاها/بلاب‌های غیرمتنی در source.replayState پنهان‌اند و در content دیده نمی‌شوند.
    if (message.source && typeof message.source === 'object' && message.source.replayState) {
      lines.push('  [بازپخش: ' + JSON.stringify(shrinkBlobs(message.source.replayState)) + ']')
    }
    if (Array.isArray(data.stream)) {
      lines.push('  [جریانِ خام ' + faInt(data.stream.length) + ' تکه — متنِ نهایی‌اش در همین رخداد/رخدادِ بعدی هست]')
    }
    if (row.type === 'tool/result' && typeof data.message === 'object' && data.message && data.message.isError === true) {
      lines.push('  (خطا)')
    }
    const usage = data.usage && typeof data.usage === 'object' ? data.usage : null
    if (usage) {
      lines.push('  [توکن: ورودی ' + faInt(usage.inputTokens || 0) + ' · خروجی ' + faInt(usage.outputTokens || 0)
        + (typeof usage.cacheReadTokens === 'number' ? ' · کش ' + faInt(usage.cacheReadTokens) : '') + ']')
    }
    return lines.join('\n')
  }
  if (row.type === 'turn/end' || row.type === 'turn/start' || row.type === 'step/start' || row.type === 'step/end') {
    lines.push('نوبت ' + String(data.turn ?? '?') + (data.step === undefined ? '' : ' · قدم ' + String(data.step))
      + (data.reason ? ' · دلیلِ پایان: ' + String(data.reason.kind ?? JSON.stringify(data.reason)) : ''))
    return lines.join('\n')
  }
  if (row.type === 'request/header') {
    const headerData = data.header && typeof data.header === 'object' ? data.header : {}
    const config = headerData.config && typeof headerData.config === 'object' ? headerData.config : {}
    const tools = Array.isArray(headerData.tools) ? headerData.tools.map((tool) => tool && tool.name).filter(Boolean) : []
    lines.push('مدل: ' + String(config.model ?? 'نامعلوم') + ' · ارائه‌دهنده: ' + String(config.provider ?? 'نامعلوم')
      + (config.reasoningEffort ? ' · درجهٔ فکری: ' + String(config.reasoningEffort) : '')
      + (config.cacheRetention ? ' · کش: ' + String(config.cacheRetention) : ''))
    lines.push('ابزارها (' + faInt(tools.length) + '): ' + (tools.join(', ') || '—'))
    return lines.join('\n')
  }
  lines.push(JSON.stringify(shrinkBlobs(data)))
  return lines.join('\n')
}

/**
 * کلِ چت از رخدادِ اول تا آخر، به ترتیبِ شماره — بی‌هیچ خلاصه.
 * @param rows - خروجیِ parseLogRows.
 * @returns { text: string, count: number }
 */
export function renderTranscript(rows) {
  const list = Array.isArray(rows) ? rows : []
  const parts = []
  for (const row of list) {
    const text = renderEvent(row)
    if (text) parts.push(text)
  }
  return { text: parts.join('\n\n'), count: list.length }
}

/* ------------------------------------------------------------------ حدِ زمینه */

/** هیچ چتی بی‌این سقف کوچک‌تر از حدِ مدل فرض نمی‌شود. */
export const FALLBACK_CONTEXT = 1000000
/** تخمینِ محافظه‌کارانه: هر توکن دست‌کم ۲٫۵ نویسه (فارسی/چینی بدترین حالت). */
export const CHARS_PER_TOKEN = 2.5
/** جای خروجیِ مدل + سرصفحهٔ سیستم + نگهبانِ خطا. */
export const OUTPUT_RESERVE = 16000

/** تخمینِ تعدادِ توکن از طولِ متن. */
export function estimateTokens(text) {
  const length = typeof text === 'string' ? text.length : 0
  return Math.ceil(length / CHARS_PER_TOKEN)
}

/**
 * اگر متن از حدِ زمینه بزرگ‌تر شد، قدیمی‌ترین رخدادها را می‌اندازد.
 * فقط بخشِ (ج) — یعنی همین رخدادها — کوتاه می‌شود؛ بقیهٔ متنِ ورودی دست نمی‌خورد.
 * @param parts - متنِ هر رخداد به ترتیب.
 * @param limitTokens - حدِ توکنِ در دسترس.
 * @returns { kept: number[], dropped: number, text: string, tokens: number }
 */
export function trimOldest(parts, limitTokens) {
  const list = Array.isArray(parts) ? parts : []
  const limit = typeof limitTokens === 'number' && limitTokens > 0 ? limitTokens : FALLBACK_CONTEXT
  let used = 0
  let firstKept = list.length
  // آخرین رخداد همیشه می‌ماند (حتی اگر دقیقاً پر کند): بی آخرین رخداد اصلاً چیزی برای بررسی نیست.
  let first = true
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const cost = estimateTokens(list[i]) + 1
    if (!first && used + cost > limit) break
    used += cost
    firstKept = i
    first = false
  }
  const keptParts = list.slice(firstKept)
  return {
    kept: list.map((_, i) => i).slice(firstKept),
    dropped: firstKept,
    text: keptParts.join('\n\n'),
    tokens: used,
  }
}

/* ------------------------------------------------------------------ سهمیه و تکرار */

export const QUOTA_PER_HOUR = 6
export const QUOTA_PER_DAY = 30
export const DEBOUNCE_MS = 45000

/** ساعتِ تهران به شکلِ «۱۷:۰۵» — همان ساعتی که در پیامِ سقف می‌گفتیم «فلان ساعت دوباره کار می‌کند». */
export function clockFa(ms) {
  return new Intl.DateTimeFormat('fa-IR', {
    timeZone: 'Asia/Tehran', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(ms))
}

/**
 * سهمیهٔ یک سشن در پنجرهٔ یک ساعت و یک روز.
 *
 * چرا این‌قدر با شرح: بعد از اجرای ششم، پلی بی‌صدا هیچ کاری نمی‌کرد و حبیب فقط «ارور می‌دهد» را می‌دید
 * («این دکمه پلی که یه دفعه دستیار رو ران میکنه ارور میده هی»). پس هر رد باید بگوید «چرا» و «کی دوباره».
 *
 * @returns { hour, day, maxHour, maxDay, blocked, reason, blockedUntil, retryAt, resetInMs }
 *   retryAt = لحظه‌ای که این چت دوباره جا دارد (null یعنی سقفی جلویش نیست).
 */
export function quotaState(runs, now) {
  const list = Array.isArray(runs) ? runs.filter((t) => typeof t === 'number' && Number.isFinite(t)).sort((a, b) => a - b) : []
  const at = typeof now === 'number' ? now : Date.now()
  const hourRuns = list.filter((t) => at - t < 3600 * 1000)
  const dayRuns = list.filter((t) => at - t < 24 * 3600 * 1000)
  const hour = hourRuns.length
  const day = dayRuns.length
  const hourlyFull = hour >= QUOTA_PER_HOUR
  const dailyFull = day >= QUOTA_PER_DAY
  // جا باز می‌شود وقتی قدیمی‌ترین اجرا از پنجره بیرون بیفتد (ساعتی) یا وقتی پنجرهٔ روز آزاد شود (روزانه).
  const hourFreeIn = hourlyFull ? hourRuns[0] + 3600 * 1000 - at : 0
  const dayFreeIn = dailyFull ? dayRuns[0] + 24 * 3600 * 1000 - at : 0
  const blocked = hourlyFull || dailyFull
  const resetInMs = !blocked ? 0 : dailyFull && dayFreeIn > hourFreeIn ? dayFreeIn : hourFreeIn
  const retryAt = blocked ? at + resetInMs : null
  let reason = null
  if (hourlyFull && (!dailyFull || dayFreeIn <= hourFreeIn)) {
    reason = 'سقفِ ' + faInt(QUOTA_PER_HOUR) + ' اجرا در ساعت پر شد؛ ساعتِ ' + clockFa(retryAt) + ' دوباره کار می‌کند'
      + ' (' + faInt(Math.max(1, Math.ceil(resetInMs / 60000))) + ' دقیقهٔ دیگر)'
  } else if (dailyFull) {
    reason = 'سقفِ ' + faInt(QUOTA_PER_DAY) + ' اجرا در روز پر شد؛ ساعتِ ' + clockFa(retryAt) + ' دوباره کار می‌کند'
  }
  return {
    hour, day,
    maxHour: QUOTA_PER_HOUR,
    maxDay: QUOTA_PER_DAY,
    blocked,
    reason,
    blockedUntil: retryAt,
    retryAt,
    resetInMs: blocked ? Math.max(1000, Math.round(resetInMs)) : 0,
  }
}

/**
 * آیا این پایانِ نوبت باید اجرا شود؟
 * هر نوبت یک بار: کلید = شناسهٔ سشن + شمارهٔ آخرین turn/end.
 * @returns { run: boolean, reason: string | null }
 */
export function shouldRunOnTurnEnd(input) {
  const opt = input && typeof input === 'object' ? input : {}
  if (!opt.play) return { run: false, reason: 'پلی خاموش است' }
  if (opt.running) return { run: false, reason: 'یک اجرا در جریان است' }
  if (opt.turnSeq === null || opt.turnSeq === undefined) return { run: false, reason: 'پایانِ نوبتی پیدا نشد' }
  // کلید ذخیره‌شده «شناسهٔ سشن:شمارهٔ نوبت» است؛ همین‌جا با همان شکل ساخته و مقایسه می‌شود،
  // وگرنه «7» با «s:7» هیچ‌وقت یکی نمی‌شد و هر turn/end دوباره پول خرج می‌کرد.
  const expectedKey = opt.sessionId ? dedupeKey(opt.sessionId, opt.turnSeq) : String(opt.turnSeq)
  if (opt.lastKey !== null && opt.lastKey !== undefined && String(opt.lastKey) === expectedKey) {
    return { run: false, reason: 'این نوبت قبلاً بررسی شد' }
  }
  const quota = quotaState(opt.runs, opt.now)
  if (quota.blocked) return { run: false, reason: quota.reason }
  return { run: true, reason: null }
}

/** کلیدِ تکرارِ یک نوبت. */
export function dedupeKey(sessionId, turnSeq) {
  return String(sessionId) + ':' + String(turnSeq)
}

/** آخرین رخدادِ turn/end در ردیف‌ها (شماره‌اش). */
export function lastTurnEndSeq(rows) {
  const list = Array.isArray(rows) ? rows : []
  for (let i = list.length - 1; i >= 0; i -= 1) {
    if (list[i] && list[i].type === 'turn/end' && typeof list[i].seq === 'number') return list[i].seq
  }
  return null
}

/* ------------------------------------------------------------------ سرصفحهٔ نتیجه */

/** سرصفحهٔ یک‌خطی: بی‌شکستنِ خط، حداکثر ۸۰ نویسه. */
export function headline(...candidates) {
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue
    const flat = candidate.replace(/\s+/g, ' ').trim()
    if (flat === '') continue
    return flat.length <= 80 ? flat : flat.slice(0, 79) + '…'
  }
  return 'تغییری لازم نیست'
}

/** سه بخشِ خروجی، همان‌طور که خواسته شده. */
export const SECTIONS = ['خرجِ بی‌مصرف', 'تنظیمِ بهتر', 'کمک‌های دیگر']
