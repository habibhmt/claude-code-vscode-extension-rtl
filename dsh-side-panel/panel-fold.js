/**
 * Side Panel — توابعِ خالصِ «مترجمِ مدل»
 * ----------------------------------------
 * هیچ React و هیچ DOM در این فایل نیست: فقط تبدیلِ دادهٔ خامِ سشن به جمله‌های
 * فارسی. همه با آزمونِ واحد سنجیده می‌شوند (test/fold.test.mjs).
 */

/** شکلِ usage در لاگ ممکن است ناقص یا null باشد؛ این تابع همیشه عدد یا null می‌دهد. */
export function normalizeUsage(usage) {
  if (!usage || typeof usage !== 'object') return null
  const pick = (key) => (typeof usage[key] === 'number' && Number.isFinite(usage[key]) ? usage[key] : null)
  const input = pick('inputTokens')
  const output = pick('outputTokens')
  const total = pick('totalTokens') ?? (input !== null && output !== null ? input + output : null)
  const cacheRead = pick('cacheReadTokens')
  const cacheWrite = pick('cacheWriteTokens')
  if (input === null && output === null && total === null) return null
  return { input, output, total, cacheRead, cacheWrite }
}

/** مدتِ یک درخواست به میلی‌ثانیه، یا null وقتی تمام نشده. */
export function requestDurationMs(request) {
  if (!request || typeof request.startedAt !== 'number') return null
  if (typeof request.completedAt !== 'number') return null
  const value = request.completedAt - request.startedAt
  return Number.isFinite(value) && value >= 0 ? value : null
}

/** شناسهٔ مدلِ یک درخواست: «provider/model» یا «نامعلوم». */
export function requestModel(request) {
  const meta = request && request.providerMetadata
  if (!meta || typeof meta.model !== 'string' || meta.model === '') return 'نامعلوم'
  return typeof meta.provider === 'string' && meta.provider !== ''
    ? `${meta.provider}/${meta.model}`
    : meta.model
}

/**
 * هزینهٔ یک درخواست از روی توکن و قیمتِ هر میلیون توکن.
 * قیمت نامعلوم ⇒ null (نه صفر)، تا «نامعلوم» نشان داده شود نه «رایگان».
 */
export function requestCost(request, price) {
  const usage = normalizeUsage(request && request.usage)
  if (!usage || !price) return null
  const perMillionIn = typeof price.prompt === 'number' ? price.prompt : null
  const perMillionOut = typeof price.completion === 'number' ? price.completion : null
  if (perMillionIn === null || perMillionOut === null) return null
  const inputTokens = usage.input ?? 0
  const outputTokens = usage.output ?? 0
  const value = (inputTokens / 1_000_000) * perMillionIn + (outputTokens / 1_000_000) * perMillionOut
  return Number.isFinite(value) ? value : null
}

/** خلاصهٔ یک درخواست برای کارتِ «چه فرستادیم / چه برگشت». */
export function summarizeRequest(request) {
  const usage = normalizeUsage(request && request.usage)
  return {
    turn: request && typeof request.turn === 'number' ? request.turn : null,
    step: request && typeof request.step === 'number' ? request.step : null,
    model: requestModel(request),
    status: request && request.status ? request.status : 'نامعلوم',
    durationMs: requestDurationMs(request),
    inputTokens: usage ? usage.input : null,
    outputTokens: usage ? usage.output : null,
    cacheReadTokens: usage ? usage.cacheRead : null,
    retry: request && typeof request.retry === 'number' ? request.retry : null,
    error: request && typeof request.error === 'string' && request.error !== '' ? request.error : null,
  }
}

/**
 * مقایسهٔ دو درخواستِ متوالی برای کارتِ «چرا گران شد».
 * اگر قبلی نبود یا صفر بود، نسبت null می‌شود (نه بی‌نهایت).
 */
export function compareRequests(previous, current) {
  const before = normalizeUsage(previous && previous.usage)
  const after = normalizeUsage(current && current.usage)
  const ratio = (from, to) => {
    if (typeof from !== 'number' || typeof to !== 'number' || from === 0) return null
    return to / from
  }
  return {
    inputRatio: ratio(before && before.input, after && after.input),
    outputRatio: ratio(before && before.output, after && after.output),
    inputDelta: before && after && typeof before.input === 'number' && typeof after.input === 'number'
      ? after.input - before.input
      : null,
    cacheMissed: Boolean(before && after && (after.cacheRead === null || after.cacheRead === 0)),
  }
}

/** شمارشِ رخدادها برای کارتِ «ابزارها» و نوارِ خلاصه. */
export function summarizeEvents(eventNodes) {
  const nodes = Array.isArray(eventNodes) ? eventNodes : []
  const byKind = new Map()
  const tools = []
  for (const node of nodes) {
    const kind = node && typeof node.kind === 'string' ? node.kind : 'نامعلوم'
    byKind.set(kind, (byKind.get(kind) ?? 0) + 1)
    if (kind === 'tool-result') {
      tools.push({
        name: typeof node.name === 'string' && node.name !== '' ? node.name : 'ابزار',
        time: typeof node.time === 'number' ? node.time : null,
        isError: Boolean(node.isError),
      })
    }
  }
  return { total: nodes.length, byKind: Object.fromEntries(byKind), tools }
}

/** عددِ دلاری با چهار رقمِ اعشار؛ null ⇒ «نامعلوم». */
export function formatMoney(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'نامعلوم'
  return `$${value.toFixed(4)}`
}

/** درصدِ مصرف از سقف؛ سقف صفر یا نامعلوم ⇒ null. */
export function usagePercent(usage, limit) {
  if (typeof usage !== 'number' || typeof limit !== 'number' || limit <= 0) return null
  const percent = (usage / limit) * 100
  return Number.isFinite(percent) ? Math.max(0, Math.min(100, percent)) : null
}

/** خلاصهٔ کلِ سشن: تعدادِ درخواست، مدل‌ها، جمعِ توکن. */
export function summarizeSession(snapshot) {
  const requests = Array.isArray(snapshot && snapshot.requests) ? snapshot.requests : []
  const events = summarizeEvents(snapshot && snapshot.eventNodes)
  let input = 0
  let output = 0
  let known = 0
  const models = new Map()
  for (const request of requests) {
    const usage = normalizeUsage(request && request.usage)
    if (usage) {
      if (typeof usage.input === 'number') input += usage.input
      if (typeof usage.output === 'number') output += usage.output
      known += 1
    }
    const model = requestModel(request)
    models.set(model, (models.get(model) ?? 0) + 1)
  }
  return {
    requests: requests.length,
    events: events.total,
    tools: events.tools.length,
    inputTokens: known > 0 ? input : null,
    outputTokens: known > 0 ? output : null,
    models: [...models.entries()].map(([model, count]) => ({ model, count })),
  }
}
/**
 * خلاصهٔ آمارِ سشن از `StatsSnapshot` (پنلِ Statistics).
 * شکل: { turns: StatsTurnMetrics[], stepCount }
 * هیچ‌وقت throw نمی‌کند: دادهٔ ناقص ⇒ null، نه NaN.
 */
export function summarizeStats(statsSnapshot) {
  const turns = Array.isArray(statsSnapshot && statsSnapshot.turns) ? statsSnapshot.turns : []
  const last = turns.length > 0 ? turns[turns.length - 1] : null
  const sum = (field) => {
    let total = 0
    let seen = false
    for (const turn of turns) {
      const value = turn && turn[field]
      if (typeof value === 'number' && Number.isFinite(value)) { total += value; seen = true }
    }
    return seen ? total : null
  }
  const tools = new Map()
  for (const turn of turns) {
    const list = Array.isArray(turn && turn.tools) ? turn.tools : []
    for (const entry of list) {
      if (!entry || typeof entry.name !== 'string') continue
      tools.set(entry.name, (tools.get(entry.name) ?? 0) + (typeof entry.count === 'number' ? entry.count : 0))
    }
  }
  return {
    turns: turns.length,
    steps: typeof (statsSnapshot && statsSnapshot.stepCount) === 'number' ? statsSnapshot.stepCount : null,
    context: sum('context'),
    output: sum('output'),
    ttft: last && typeof last.ttft === 'number' ? last.ttft : null,
    modelMs: sum('model'),
    toolMs: sum('tool'),
    tps: last && typeof last.tps === 'number' ? last.tps : null,
    cacheHit: last && typeof last.cacheHit === 'number' ? last.cacheHit : null,
    cacheRead: sum('cacheRead'),
    tools: [...tools.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
  }
}

/**
 * قالبِ ستون‌های فریم را به سه تکه می‌شکند (فاصله‌های داخلِ پرانتز نمی‌شکنند).
 * «280px minmax(360px, 1fr) minmax(0px, 520px)» ⇒ ['280px', 'minmax(360px, 1fr)', 'minmax(0px, 520px)']
 */
export function splitTracks(template) {
  if (typeof template !== 'string') return []
  const parts = []
  let depth = 0
  let current = ''
  for (const ch of template.trim()) {
    if (ch === '(') depth += 1
    if (ch === ')') depth = Math.max(0, depth - 1)
    if (/\s/.test(ch) && depth === 0) {
      if (current !== '') { parts.push(current); current = '' }
      continue
    }
    current += ch
  }
  if (current !== '') parts.push(current)
  return parts
}

/**
 * جای ستونِ چت و ستونِ پنل را عوض می‌کند (ستونِ اول = سایدبار، دست نمی‌خورد).
 * در چیدمانِ راست‌به‌چپ یعنی: سایدبار راست، پنل کنارش، چت سمتِ چپ.
 * قالبِ ناشناخته ⇒ null (هیچ کاری نکن).
 */
export function swapMiddleTracks(template) {
  const parts = splitTracks(template)
  if (parts.length !== 3) return null
  return [parts[0], parts[2], parts[1]].join(' ')
}

/** عرضِ ستونِ اول به پیکسل (سایدبار)؛ ناشناخته ⇒ null. */
export function firstTrackPx(template) {
  const first = splitTracks(template)[0]
  if (!first || !/^-?\d+(\.\d+)?px$/.test(first)) return null
  return Number.parseFloat(first)
}

/** عددِ فارسی با جداکننده: 12345 ⇒ «۱۲٬۳۴۵». */
export function faNum(value, digits = 0) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
  return value.toLocaleString('fa-IR', { maximumFractionDigits: digits, minimumFractionDigits: digits })
}

/** دلار: کمتر از یک سنت با ۵ رقم، بقیه با ۴ رقم. */
export function faMoney(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
  // LRI…PDI (جداسازِ چپ‌به‌راست): وسطِ جملهٔ فارسی، «$» به آن سرِ عدد نمی‌پرد
  // (بی این، «نوبتِ ۲ · $0.0151» روی صفحه «0.0151$» می‌شد — قاعدهٔ W2 ِ یونیکد).
  return '\u2066$' + value.toFixed(Math.abs(value) < 0.01 ? 5 : 4) + '\u2069'
}

/**
 * یک جملهٔ سادهٔ فارسی: «چرا این رفت‌وبرگشت این‌قدر خرج داشت».
 * row = { input (توکنِ تازه/بی‌کش), cached, output, cost }
 */
export function explainCost(row) {
  if (!row) return ''
  const fresh = typeof row.input === 'number' ? row.input : 0
  const cached = typeof row.cached === 'number' ? row.cached : 0
  const output = typeof row.output === 'number' ? row.output : 0
  const sent = fresh + cached
  if (sent === 0 && output === 0) return 'توکنی ثبت نشده.'
  const cachedShare = sent > 0 ? cached / sent : 0
  const reasons = []
  if (sent > 0 && cachedShare < 0.5 && fresh > 20000) {
    reasons.push(`کش نخورد: ${faNum(fresh)} توکن تازه فرستاده شد (گران‌ترین بخش)`)
  } else if (cachedShare >= 0.9) {
    reasons.push(`${faNum(Math.round(cachedShare * 100))}٪ ورودی از کش آمد (ارزان)`)
  } else if (fresh > 0) {
    reasons.push(`${faNum(fresh)} توکن تازه + ${faNum(cached)} از کش`)
  }
  if (sent > 150000) reasons.push(`تاریخچهٔ چت بزرگ است (${faNum(Math.round(sent / 1000))} هزار توکن هر بار فرستاده می‌شود)`)
  if (output > 4000) reasons.push(`جوابِ بلند: ${faNum(output)} توکن`)
  return reasons.length > 0 ? reasons.join(' · ') : 'رفت‌وبرگشتِ کوچک'
}


/** پهنای پیش‌فرضِ پنل (توافقِ ۲۱:۲۰، سؤالِ ۴): حداکثر ۵۲۰، و چت دستِ‌کم ۶۸۰ بماند. */
export function preferredPanelWidth(frameWidth, sidebarWidth) {
  return Math.min(520, frameWidth - (sidebarWidth || 0) - 680)
}