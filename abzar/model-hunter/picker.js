/**
 * Model Hunter — منوی مدلِ خودِ چت
 * --------------------------------
 * حبیب (۱۵ نوامبر): «این مدل انتخاب کردن توی یه پنل بیرون از چت اشتباه هست؛ باید اون صفحه
 * باشه و خودکار بسنجه، همهٔ مدل‌ها اون‌جا باشن و موقعِ عوض کردن هشدارِ قیمتِ مدلِ جدیدِ بی‌کش
 * بده؛ افورتِ این مدل‌ها هم کجاست؟»
 *
 * این فایل خالص است (بی‌شبکه، بی‌دیسک) تا آزمون‌پذیر باشد:
 *   - effortsOf: سطح‌های فکر از /models ِ OpenRouter ⇒ `reasoningEfforts` ِ DSH.
 *     مدل‌های preset در کاتالوگِ نصب‌شدهٔ pi-ai نیستند، پس بی این فیلد «افورت» در منو نمی‌آید.
 *   - pickEndpoints/planCatalog: برای هر مدلِ دیپ‌سیک، ارزان‌ترین سرورها (با کش‌نخوردنِ
 *     اندازه‌گیری‌شده) + سرورِ رسمی ⇒ فهرستِ مدل‌های route ِ openrouter. چیزی حذف نمی‌شود.
 *   - pickerItems: قیمتِ هر گزینه برای «همین چت»: یک پیام با کش، یک پیام بی‌کش (هزینهٔ عوض کردن).
 */

export const THINKING_LEVELS = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max']
const OURS_PREFIX = 'Model Hunter — '

const num = (x, d = 0) => {
  const n = Number(x)
  return Number.isFinite(n) ? n : d
}

export function slugify(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)
}

export function presetSlug(model, providerSlug) {
  const fam = model.split('/')[1] || model
  return slugify(`mh-${fam}-${providerSlug}`)
}

/** شناسهٔ preset ⇒ { model, preset } ؛ شناسهٔ ساده ⇒ preset = null. */
export function parseRef(ref) {
  const s = String(ref || '')
  const at = s.indexOf('@preset/')
  return at < 0 ? { model: s, preset: null } : { model: s.slice(0, at), preset: s.slice(at + 8) }
}

/**
 * سطح‌های فکرِ OpenRouter ⇒ reasoningEfforts ِ pi-ai.
 * `none` یعنی «خاموش» و همان رشته روی سیم می‌رود. مدلی که سطح اعلام نکرده ⇒ undefined (دست نمی‌زنیم).
 */
export function effortsOf(reasoning) {
  const list = reasoning && Array.isArray(reasoning.supported_efforts) ? reasoning.supported_efforts : []
  const out = {}
  for (const e of list) {
    if (e === 'none') out.off = 'none'
    else if (THINKING_LEVELS.includes(e)) out[e] = e
  }
  if (!Object.keys(out).some(k => k !== 'off')) return undefined
  return Object.fromEntries(THINKING_LEVELS.filter(k => k in out).map(k => [k, out[k]]))
}

/** «DeepSeek: DeepSeek V4.1 Flash 1017» ⇒ «DeepSeek V4.1 Flash 1017» */
export function shortName(orName, model) {
  const s = String(orName || '').replace(/^[^:]+:\s*/, '').trim()
  return s || String(model || '').split('/').pop()
}

/** ردیفِ سرور برای یک preset (اسلاگِ preset از مدل و اسلاگِ سرور ساخته می‌شود). */
export function rowForRef(rows, ref) {
  const { model, preset } = parseRef(ref)
  if (!preset) return null
  const mine = (rows || []).filter(r => r.model === model && r.usable !== false)
  const std = mine.filter(r => !r.tier)
  for (const pool of [std, mine]) {
    const hit = pool.find(r => presetSlug(model, r.slug) === preset)
    if (hit) return hit
  }
  return null
}

/**
 * کدام سرورها در منو بیایند: برای هر مدل (بی batch) ارزان‌ترین `perModel` سرورِ سطحِ استاندارد
 * که ابزار (tools) را پشتیبانی می‌کنند و کیفیتشان از کف بالاتر است، بر اساسِ هزینهٔ مورد انتظار
 * (کش‌نخوردنِ اندازه‌گیری‌شده داخلش است) + سرورِ رسمیِ دیپ‌سیک برای مقایسه.
 * @returns [{ model, name, row, ref, slug, meta }] به ترتیبِ مدلِ تازه‌تر و بعد ارزان‌تر.
 */
export function pickEndpoints(families, { perModel = 3, qualityFloor = 85 } = {}) {
  const models = []
  for (const entries of Object.values(families || {})) {
    for (const m of entries) if (!m.batch && !String(m.model).endsWith(':batch')) models.push(m)
  }
  models.sort((a, b) => num(b.created) - num(a.created) || String(a.model).localeCompare(String(b.model)))
  const out = []
  for (const m of models) {
    const ok = (m.endpoints || []).filter(r => r.usable !== false && !r.tier && r.tools !== false)
    const good = ok.filter(r => num(r.quality) >= qualityFloor)
    const pool = (good.length ? good : ok).slice().sort((a, b) => num(a.costCalib, 1e9) - num(b.costCalib, 1e9))
    const chosen = []
    for (const r of pool) {
      if (chosen.length >= perModel) break
      if (!chosen.some(c => c.slug === r.slug)) chosen.push(r)
    }
    const official = ok.find(r => r.official)
    if (official && !chosen.some(c => c.slug === official.slug)) chosen.push(official)
    for (const row of chosen) {
      const slug = presetSlug(m.model, row.slug)
      out.push({ model: m.model, name: shortName(m.name, m.model), row, slug, ref: `${m.model}@preset/${slug}`, meta: m })
    }
  }
  return out
}

/** یک ورودیِ فهرستِ مدل برای pi-ai (نام + ظرفیت + ورودی‌ها + افورت). */
export function entryFor(pick) {
  const meta = pick.meta || {}
  const entry = { id: pick.ref, name: `${pick.name} · ${pick.row.provider}` }
  if (num(meta.context) > 0) entry.contextWindow = num(meta.context)
  const input = Array.isArray(meta.input) ? meta.input.filter(x => x === 'text' || x === 'image') : []
  if (input.includes('text')) entry.input = input
  const efforts = effortsOf(meta.reasoning)
  if (efforts) entry.reasoningEfforts = efforts
  return entry
}

function isOurs(e) {
  return String(e.name || '').startsWith(OURS_PREFIX) || /@preset\/mh-/.test(e.id)
}

/** فقط فیلدهای جاافتاده را از تازه پر می‌کند (ورودیِ دستیِ حبیب عوض نمی‌شود). */
function fill(old, fresh) {
  const add = {}
  for (const k of ['contextWindow', 'input', 'reasoningEfforts']) if (old[k] === undefined && fresh[k] !== undefined) add[k] = fresh[k]
  return add
}

/**
 * فهرستِ تازهٔ مدل‌های route: انتخاب‌شده‌ها به ترتیب، بعد هر ورودیِ قبلی که دیگر انتخاب نیست
 * (حذف نمی‌شود؛ ممکن است چتی رویش باشد). ورودی‌های قبلیِ «ما» (preset ِ mh-) نام و فرادادهٔ تازه
 * می‌گیرند؛ ورودی‌های دستیِ دیگر فقط افورت/ظرفیتِ جاافتاده می‌گیرند.
 * @param existing - فهرستِ فعلی.
 * @param picks - خروجیِ pickEndpoints (فقط آن‌هایی که preset شان آماده است).
 * @param lookup - ref ⇒ { pick } برای ورودی‌های قبلی (مدل و سرورشان در اسنپ‌شات).
 */
export function planCatalog(existing, picks, lookup = () => null) {
  const list = Array.isArray(existing) ? existing.filter(e => e && typeof e.id === 'string') : []
  const byId = new Map(list.map(e => [e.id, e]))
  const out = []
  const seen = new Set()
  for (const p of picks) {
    if (seen.has(p.ref)) continue
    seen.add(p.ref)
    const fresh = entryFor(p)
    const old = byId.get(p.ref)
    out.push(old && !isOurs(old) ? { ...old, ...fill(old, fresh) } : fresh)
  }
  for (const e of list) {
    if (seen.has(e.id)) continue
    seen.add(e.id)
    const p = lookup(e.id)
    if (!p) { out.push(e); continue }
    const fresh = entryFor(p)
    out.push(isOurs(e) ? { ...e, ...fresh } : { ...e, ...fill(e, fresh) })
  }
  return out
}

export function sameList(a, b) {
  return JSON.stringify(a || []) === JSON.stringify(b || [])
}

/** «claude-opus-5-5» ⇔ «anthropic/claude-opus-5.5» */
export function anthropicKey(id) {
  return String(id || '').replace(/^anthropic\//, '').replace(/:.*$/, '').toLowerCase().replace(/\./g, '-')
}

/**
 * هزینهٔ یک پیام در همین چت.
 * @param price - { in1m, cache1m (null ⇒ کش ندارد), write1m (نوشتنِ کش؛ Anthropic؛ null ⇒ همان ورودی), out1m, miss (0..1) }
 * @param tokens - اندازهٔ تاریخچهٔ همین چت (توکن)
 * @returns { warm, cold } — warm: پیامِ بعدی وقتی روی همین سرور می‌مانی (کش‌نخوردنِ اندازه‌گیری‌شده داخلش)،
 *          cold: پیامِ اولِ بعد از عوض کردن (کلِ تاریخچه بی‌کش؛ Anthropic: نوشتنِ کش).
 */
export function messageCost(price, tokens, out = 700, newTokens = 2000) {
  const t = Math.max(0, num(tokens))
  const in1m = num(price.in1m)
  const cache1m = price.cache1m == null ? in1m : num(price.cache1m)
  const write1m = price.write1m == null ? in1m : num(price.write1m)
  const miss = Math.max(0, Math.min(1, num(price.miss, 0.03)))
  const outCost = out * num(price.out1m) / 1e6
  const hit = (t * cache1m + newTokens * write1m) / 1e6 + outCost
  const cold = ((t + newTokens) * write1m) / 1e6 + outCost
  return { warm: (1 - miss) * hit + miss * cold, cold }
}

/** اندازهٔ تاریخچهٔ یک چت از لاگ: totalTokens ِ آخرین جواب (پرامپت + خروجی ≈ پرامپتِ بعدی). */
export function contextTokensOfLog(text) {
  const lines = String(text || '').split('\n')
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]
    if (!line.includes('"assistant/message"') || !line.includes('"usage"')) continue
    try {
      const u = (JSON.parse(line).data || {}).usage || {}
      const total = num(u.totalTokens) || (num(u.inputTokens) + num(u.cacheReadTokens) + num(u.cacheWriteTokens) + num(u.outputTokens))
      if (total > 0) return total
    } catch { /* خطِ نیمه‌کاره */ }
  }
  return 0
}

function round6(x) { return Math.round(num(x) * 1e6) / 1e6 }

/**
 * قیمتِ هر گزینهٔ منو برای این چت.
 * @returns { items: { 'provider|model': item }, best: { model: ref } } — best = ارزان‌ترین سرورِ هر مدل.
 */
export function pickerItems({ openrouter = [], rows = [], anthropic = [], tokens = 0, out = 700, priorMiss = 0.03, minSamples = 30 }) {
  const items = {}
  const best = {}
  for (const e of openrouter) {
    const row = rowForRef(rows, e.id)
    if (!row) continue
    const measuredOk = Boolean(row.measured && num(row.measured.eligible) >= minSamples && row.measured.missPct != null)
    const miss = measuredOk ? row.measured.missPct / 100 : priorMiss
    const price = { in1m: row.priceIn1m, cache1m: row.cacheKnown === false ? null : row.cacheRead1m, out1m: row.priceOut1m, miss }
    const c = messageCost(price, tokens, out)
    const model = parseRef(e.id).model
    items['openrouter|' + e.id] = {
      model, provider: row.provider, quality: row.quality,
      in1m: row.priceIn1m, cache1m: price.cache1m, out1m: row.priceOut1m,
      missPct: measuredOk ? row.measured.missPct : null, missSamples: row.measured ? num(row.measured.eligible) : 0,
      fallbacks: row.measured ? num(row.measured.fallbacks) : 0,
      warm: round6(c.warm), cold: round6(c.cold),
    }
    if (!best[model] || items['openrouter|' + best[model]].warm > c.warm) best[model] = e.id
  }
  // مدل‌های Anthropic با کلیدِ عادی‌شده (claude-opus-5-5)؛ کلاینت با همین anthropicKey پیدا می‌کند.
  for (const m of anthropic || []) {
    if (!m || !m.pricing || String(m.id).includes(':')) continue
    const id = anthropicKey(m.id)
    const p = m.pricing
    const price = {
      in1m: num(p.prompt) * 1e6,
      cache1m: p.input_cache_read == null ? null : num(p.input_cache_read) * 1e6,
      write1m: p.input_cache_write == null ? null : num(p.input_cache_write) * 1e6,
      out1m: num(p.completion) * 1e6,
      miss: 0,
    }
    const c = messageCost(price, tokens, out)
    items['anthropic|' + id] = {
      model: id, provider: 'Anthropic', in1m: round6(price.in1m), cache1m: price.cache1m == null ? null : round6(price.cache1m), out1m: round6(price.out1m),
      missPct: null, missSamples: 0, fallbacks: 0, warm: round6(c.warm), cold: round6(c.cold), priceSource: m.id,
    }
  }
  return { items, best }
}
