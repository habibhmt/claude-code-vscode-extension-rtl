/**
 * Side Panel — دادهٔ خامِ کاملِ لاگِ سشن (نصفِ host)
 * ---------------------------------------------------
 * حبیب (۱۵ نوامبر): «به اصل و کلِ اون راو دیتا هم بشه کامل دیتای کاملِ خام رو دید».
 *
 * این فایل هیچ چیزِ لاگ را دست نمی‌زند: هر خط (رخداد) عیناً همان متنِ فایل است؛
 * فقط تکه‌تکه و صفحه‌صفحه می‌شود تا پنلِ باریک بتواند بی‌یخ‌زدگی نشانش بدهد.
 */

export const DEFAULT_LIMIT = 50
export const MAX_LIMIT = 500

/** متنِ JSONL ⇒ خط‌ها (خطِ خالیِ تهِ فایل دور ریخته می‌شود، بقیه دست‌نخورده). */
export function splitLogLines(text) {
  if (typeof text !== 'string' || text === '') return []
  const lines = text.split('\n')
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop()
  return lines
}

/** عددِ کوئری ⇒ عددِ صحیحِ در محدوده؛ هر چیزِ دیگر ⇒ پیش‌فرض. */
function intIn(value, fallback, min, max) {
  const n = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(n)) return fallback
  return Math.max(min, Math.min(max, Math.trunc(n)))
}

/** فیلدهای کوتاهِ یک خط: seq/time/type از JSONِ همان خط (اگر بود). */
export function extractFields(line) {
  const out = { seq: undefined, time: undefined, type: undefined }
  if (typeof line !== 'string') return out
  let event
  try { event = JSON.parse(line) } catch { return out }
  if (!event || typeof event !== 'object') return out
  if (typeof event.seq === 'number' && Number.isFinite(event.seq)) out.seq = event.seq
  if (typeof event.time === 'number' && Number.isFinite(event.time)) out.time = event.time
  if (typeof event.type === 'string' && event.type !== '') out.type = event.type
  return out
}

/**
 * خط‌ها را می‌گردد، فیلتر می‌کند و یک صفحه بیرون می‌دهد.
 * شمارهٔ هر خط (index) شمارهٔ خط در کلِ فایل است — با فیلتر هم عوض نمی‌شود.
 * خطِ خراب (JSONِ ناقص) هم عیناً برمی‌گردد، فقط بی seq/time/type.
 * @param {string[]} lines - خروجیِ splitLogLines.
 * @param {{ from?: unknown, limit?: unknown, q?: unknown }} options
 * @returns {{ totalAll: number, total: number, from: number, limit: number, lines: Array<{index:number,seq?:number,time?:number,type?:string,bytes:number,text:string}> }}
 */
export function sliceRawLines(lines, options = {}) {
  const all = Array.isArray(lines) ? lines : []
  const from = intIn(options.from, 0, 0, Number.MAX_SAFE_INTEGER)
  const limit = intIn(options.limit, DEFAULT_LIMIT, 1, MAX_LIMIT)
  const needle = typeof options.q === 'string' ? options.q.trim().toLowerCase() : ''
  const matched = []
  for (let index = 0; index < all.length; index += 1) {
    const text = typeof all[index] === 'string' ? all[index] : ''
    if (needle !== '' && !text.toLowerCase().includes(needle)) continue
    matched.push({ index, text })
  }
  const page = matched.slice(from, from + limit).map(({ index, text }) => {
    const { seq, time, type } = extractFields(text)
    const entry = { index, bytes: Buffer.byteLength(text, 'utf8') }
    if (seq !== undefined) entry.seq = seq
    if (time !== undefined) entry.time = time
    if (type !== undefined) entry.type = type
    entry.text = text
    return entry
  })
  return { totalAll: all.length, total: matched.length, from, limit, lines: page }
}