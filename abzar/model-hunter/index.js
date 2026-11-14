/**
 * Model Hunter — Host half
 * ------------------------
 * OpenRouter را می‌خواند، مدل‌های دیپ‌سیک را روی «کیفیت تحویل» و «صرفهٔ واقعی نسبت به
 * دیپ‌سیکِ رسمی» رتبه می‌دهد، با ابزار model_hunter در اختیار مدل می‌گذارد و انتخابِ مدل
 * را (با preset برای پینِ ارائه‌دهنده) روی DSH اعمال می‌کند.
 *
 * خروجیِ HTTP برای پنل (بیرونِ `/api` تا از فنسِ نشست رد نشود):
 *   GET  /plugins/model-hunter/state      → اسنپ‌شات + الگوی کالیبره
 *   GET  /plugins/model-hunter/recommend  → پیشنهاد بر اساسِ مصرفِ واقعیِ چت‌ها
 *   POST /plugins/model-hunter/apply      → {model, provider, scope, sessionId}
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { recentLogs, providerStats, createGenerationBook, lastRefOfLog, logPathOf, decompress } from './measure.js'

const OPENROUTER = 'https://openrouter.ai/api/v1'
const FOCUS = 'deepseek/deepseek-v4.1-flash-1017'

const PRECISION = {
  fp32: 100, bf16: 97, fp16: 95, fp8: 88,
  int8: 74, nvfp4: 74, fp4: 58, mxfp4: 52, unknown: 62,
}
const TIER_BONUS = { priority: 4, ultrafast: 2, flex: -4 }

/**
 * الگوی مصرفِ خودِ ما، برای «کالیبره»کردنِ هزینه — اعدادِ حبیب:
 * کش ۹۲٪، ورودیِ هر درخواست ۳۳۸٬۰۰۰ توکن، خروجی ۶۹۸ توکن.
 * با این الگو، هزینهٔ هر درخواست در هر ارائه‌دهنده حساب می‌شود و آفِ واقعی
 * نسبت به «دیپ‌سیکِ رسمیِ همان مدل» درمی‌آید (نه تخفیفِ اعلامیِ OpenRouter).
 */
const CALIBRATION = { cacheSharePct: 97, promptTokens: 338000, outputTokens: 698 }

/**
 * سهمِ «کش‌نخوردنِ بی‌دلیل» وقتی هنوز اندازه نگرفته‌ایم (کمتر از ۳۰ نمونه): میانگینِ
 * اندازه‌گیریِ ۱۴ نوامبر روی ۱۹۸۵ درخواست (۵۷ بار) ≈ ۳٪. بدبینانه‌تر از بهترین سرور،
 * تا سرورِ ناآزموده الکی اول نشود.
 */
export const PRIOR_MISS = 0.03
export const MIN_SAMPLES = 30

const DEFAULTS = {
  families: ['deepseek'],
  refreshMinutes: 120,
  focus: FOCUS,
  managementKeyEnv: 'OPENROUTER_MANAGEMENT_KEY',
  calibration: CALIBRATION,
}

let state = { ts: 0, families: {}, rows: [], error: null }

const num = (x, d = 0) => {
  const n = Number(x)
  return Number.isFinite(n) ? n : d
}

/**
 * قیمت‌ِ مؤثرِ توکنِ کش‌شده (دلار به ازای یک میلیون).
 * اگر ارائه‌دهنده قیمتِ کش را منتشر نکرده باشد (`null`)، یعنی کش ندارد و همان
 * توکن‌ها به قیمتِ کاملِ ورودی حساب می‌شوند. «۰» گذاشتن، هزینه را رایگان و
 * آف را دروغین می‌کند.
 */
export function effCachePrice(priceInPerM, cacheReadPerM) {
  return cacheReadPerM == null ? num(priceInPerM) : num(cacheReadPerM)
}

/**
 * هزینهٔ یک درخواست وقتی کش می‌خورد، با الگوی کالیبره (دلار).
 * cacheSharePct این‌جا «سهمِ کش در درخواستِ کش‌خورده» است (۹۷٪ ِ اندازه‌گیری‌شده)، نه
 * میانگینِ کل؛ کش‌نخوردن‌ها جدا در expectedCost حساب می‌شوند.
 */
export function calibratedCost(row, calib = CALIBRATION) {
  const c = { ...CALIBRATION, ...(calib || {}) }
  const share = Math.max(0, Math.min(1, num(c.cacheSharePct, 92) / 100))
  const prompt = num(c.promptTokens, 338000)
  const out = num(c.outputTokens, 698)
  const cachePerM = effCachePrice(row.priceIn1m, row.cacheRead1m)
  return (prompt * share * cachePerM + prompt * (1 - share) * num(row.priceIn1m) + out * num(row.priceOut1m)) / 1e6
}

/** هزینهٔ یک درخواست وقتی کش نخورد: کلِ پرامپت با قیمتِ کاملِ ورودی. */
export function missCost(row, calib = CALIBRATION) {
  const c = { ...CALIBRATION, ...(calib || {}) }
  return (num(c.promptTokens, 338000) * num(row.priceIn1m) + num(c.outputTokens, 698) * num(row.priceOut1m)) / 1e6
}

/** نرخِ کش‌نخوردنِ بی‌دلیل برای یک ردیف: اندازه‌گیری‌شده اگر نمونه کافی است، وگرنه PRIOR_MISS. */
export function missRateOf(row) {
  return row && row.measured && row.measured.eligible >= MIN_SAMPLES && row.measured.missPct != null
    ? row.measured.missPct / 100
    : PRIOR_MISS
}

/**
 * هزینهٔ مورد انتظارِ یک درخواست = کش‌خورده × (۱ − m) + کش‌نخورده × m.
 * m از چت‌های خودمان اندازه گرفته می‌شود؛ سرورِ ارزانی که کش را نگه نمی‌دارد این‌جا گران درمی‌آید.
 */
export function expectedCost(row, calib = CALIBRATION) {
  const m = missRateOf(row)
  return (1 - m) * calibratedCost(row, calib) + m * missCost(row, calib)
}

/**
 * به هر ردیفِ یک مدل، هزینهٔ کالیبره و «آفِ واقعی» را می‌چسباند.
 * پایه = اندپوینتِ رسمیِ DeepSeek همان مدل؛ اگر آن مدل در OpenRouter ارائه‌دهندهٔ
 * رسمیِ دیپ‌سیک ندارد، آفِ واقعی `null` می‌ماند (حدس نمی‌زنیم).
 */
export function withRealOff(rows, calib = CALIBRATION) {
  const costs = rows.map((r) => expectedCost(r, calib))
  const officialIndex = rows.findIndex((r) => r.official)
  const base = officialIndex >= 0 ? costs[officialIndex] : null
  return rows.map((r, i) => ({
    ...r,
    costCalib: Math.round(costs[i] * 1e6) / 1e6,
    realOffPct: base && base > 0 ? Math.round((1 - costs[i] / base) * 1000) / 10 : null,
  }))
}

async function getJson(url) {
  const r = await fetch(url, { headers: { accept: 'application/json', 'user-agent': 'DSH-ModelHunter/1.0' } })
  if (!r.ok) throw new Error(`${url} → HTTP ${r.status}`)
  return r.json()
}

function scoreEndpoint(e, slug) {
  const pr = e.pricing || {}
  const q = String(e.quantization || 'unknown').toLowerCase()
  const uptime = e.uptime_last_30m
  const uptimeVal = uptime == null ? 60 : num(uptime, 60)
  const tier = e.service_tier || null
  const quality = Math.max(0, Math.min(100, 0.72 * (PRECISION[q] ?? 62) + 0.28 * uptimeVal + (TIER_BONUS[tier] ?? 0)))
  const priceIn = num(pr.prompt)
  const priceOut = num(pr.completion)
  const cacheReadRaw = pr.input_cache_read == null ? null : num(pr.input_cache_read)
  const priceIn1m = Math.round(priceIn * 1e6 * 1e4) / 1e4
  return {
    provider: e.provider_name || '?',
    slug,
    quantization: q,
    tier,
    uptime: uptime == null ? null : Math.round(num(uptime) * 100) / 100,
    status: e.status,
    quality: Math.round(quality * 100) / 100,
    priceIn, priceOut,
    // آفِ اعلامیِ OpenRouter حذف شد؛ فقط «آفِ واقعی» (realOffPct در withRealOff) معنا دارد
    cacheKnown: cacheReadRaw != null,
    cacheRead1m: cacheReadRaw == null ? null : Math.round(cacheReadRaw * 1e6 * 1e4) / 1e4,
    cacheBilled1m: Math.round(effCachePrice(priceIn, cacheReadRaw) * 1e6 * 1e4) / 1e4,
    priceIn1m,
    priceOut1m: Math.round(priceOut * 1e6 * 1e4) / 1e4,
    official: slug === 'deepseek',
    maxCompletion: e.max_completion_tokens || null,
    usable: e.status === 0 || e.status == null,
  }
}

function taskScore(r, task) {
  if (task === 'cheap') return -r.priceIn
  if (task === 'fast') return (r.tier === 'priority' ? 100 : r.tier === 'ultrafast' ? 60 : 0) + r.quality
  if (task === 'long') return r.maxCompletion * 1e-6 + r.quality
  if (task === 'code') return r.quality + (r.quantization === 'fp8' || r.quantization === 'fp16' ? 5 : 0)
  return 0.55 * (r.quality / 100) + 0.45 * (Math.max(0, num(r.realOffPct)) / 100)
}

function winnersOf(usable) {
  return {
    quality: [...usable].sort((a, b) => b.quality - a.quality || num(b.realOffPct, -1e9) - num(a.realOffPct, -1e9) || a.priceIn - b.priceIn)[0] || null,
    saving: [...usable].sort((a, b) => num(b.realOffPct, -1e9) - num(a.realOffPct, -1e9) || b.quality - a.quality || a.priceIn - b.priceIn)[0] || null,
    balanced: [...usable].sort((a, b) => taskScore(b, 'balanced') - taskScore(a, 'balanced') || a.priceIn - b.priceIn)[0] || null,
    cheap: [...usable].sort((a, b) => a.priceIn - b.priceIn)[0] || null,
  }
}

/**
 * اندازه‌گیریِ واقعی را روی اسنپ‌شات می‌نشاند و هزینه/آف/برنده‌ها را از نو حساب می‌کند.
 * @param snap - اسنپ‌شاتِ scan.
 * @param measured - خروجیِ providerStats.
 * @returns اسنپ‌شاتِ تازه (بی‌تغییرِ اصلی).
 */
export function applyMeasured(snap, measured, calib = CALIBRATION) {
  const byKey = new Map((measured || []).map(m => [m.model + '|' + m.provider, m]))
  const families = {}
  const rows = []
  for (const [fam, entries] of Object.entries(snap.families || {})) {
    families[fam] = entries.map((entry) => {
      // اندازه‌گیری فقط روی سطحِ استاندارد می‌نشیند: presetها سرور را پین می‌کنند، نه سطح را،
      // پس دادهٔ ما مالِ سطحِ پیش‌فرض است؛ flex/priority ِ همان سرور هنوز «ناآزموده»‌اند (۳٪ فرض).
      const endpoints = withRealOff(entry.endpoints.map(r => ({ ...r, measured: r.tier ? null : (byKey.get(entry.model + '|' + r.provider) || null) })), calib)
      rows.push(...endpoints.map(r => ({ ...r, model: entry.model })))
      return { ...entry, endpoints, winners: winnersOf(endpoints.filter(r => r.usable)) }
    })
  }
  return { ...snap, families, rows, measuredTs: Date.now() }
}

async function scan(config) {
  const modelList = (await getJson(`${OPENROUTER}/models`)).data || []
  const providers = (await getJson(`${OPENROUTER}/providers`)).data || []
  const slugOf = Object.fromEntries(providers.filter((p) => p.name && p.slug).map((p) => [p.name, p.slug]))
  const familiesWanted = config.families && config.families.length ? config.families : ['deepseek']

  const picked = modelList.filter((m) => familiesWanted.some((f) => m.id.startsWith(`${f}/`)))
  const families = {}
  const allRows = []
  for (const m of picked) {
    let eps = []
    try {
      const d = await getJson(`${OPENROUTER}/models/${m.id}/endpoints`)
      eps = d.data?.endpoints || []
    } catch (err) {
      continue
    }
    const seen = new Set()
    const raw = []
    for (const e of eps) {
      const name = e.provider_name || '?'
      const row = scoreEndpoint(e, slugOf[name] || name.toLowerCase().replace(/[^a-z0-9]+/g, '-'))
      const key = `${row.provider}|${row.quantization}|${row.priceIn}|${row.priceOut}|${row.tier}`
      if (seen.has(key)) continue
      seen.add(key)
      raw.push(row)
    }
    const rows = withRealOff(raw, config.calibration)
    const usable = rows.filter((r) => r.usable)
    const fam = (m.id.split('/')[1] || m.id).replace(/:batch$/, '')
    const entry = {
      model: m.id,
      name: m.name,
      family: fam,
      batch: m.id.endsWith(':batch'),
      context: m.context_length || null,
      created: m.created || null,
      endpoints: rows,
      winners: winnersOf(usable),
    }
    if (!families[fam]) families[fam] = []
    families[fam].push(entry)
    allRows.push(...rows.map((r) => ({ ...r, model: m.id })))
  }
  return { ts: Date.now(), families, rows: allRows, error: null }
}

function topText(snap, task, limit, familyFilter) {
  const rows = snap.rows.filter((r) => r.usable && (!familyFilter || r.model.includes(familyFilter)))
  const sorted = [...rows].sort((a, b) => taskScore(b, task) - taskScore(a, task))
  const lines = sorted.slice(0, limit).map((r, i) =>
    `${i + 1}. ${r.model} | ${r.provider} (${r.quantization}${r.tier ? `, ${r.tier}` : ''}) | کیفیت ${r.quality} | آف واقعی ${r.realOffPct == null ? '—' : `${r.realOffPct}%`} | $${r.costCalib}/درخواست | ورودی $${r.priceIn1m}/M`)
  return lines.join('\n')
}

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)
}

function presetSlug(model, provider) {
  const fam = model.split('/')[1] || model
  return slugify(`mh-${fam}-${provider}`)
}

function readEnvKeySync(name) {
  try {
    const text = fs.readFileSync(path.join(os.homedir(), '.dsh', '.env'), 'utf8')
    for (const line of text.split('\n')) {
      const t = line.trim()
      if (t.startsWith(`${name}=`)) return t.slice(name.length + 1).trim()
    }
  } catch { /* ignore */ }
  return undefined
}

async function readEnvFileKey(name) {
  try {
    const fs = await import('node:fs')
    const os = await import('node:os')
    const path = await import('node:path')
    const file = path.join(os.homedir(), '.dsh', '.env')
    const text = fs.readFileSync(file, 'utf8')
    for (const line of text.split('\n')) {
      const t = line.trim()
      if (t.startsWith(`${name}=`)) return t.slice(name.length + 1).trim()
    }
  } catch {
    /* ignore */
  }
  return undefined
}

async function ensurePreset(ctx, config, model, row) {
  const envName = config.managementKeyEnv || DEFAULTS.managementKeyEnv
  const key = process.env[envName] || (await readEnvFileKey(envName))
  if (!key) throw new Error(`کلید مدیریت تنظیم نشده است (${config.managementKeyEnv || DEFAULTS.managementKeyEnv})`)
  const slug = presetSlug(model, row.slug)
  const body = {
    model,
    provider: {
      order: [row.slug],
      allow_fallbacks: true,
      ...(row.quantization !== 'unknown' ? { quantizations: [row.quantization] } : {}),
    },
  }
  const res = await fetch(`${OPENROUTER}/presets/${slug}/chat/completions`, {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`ساختِ preset شکست خورد (HTTP ${res.status}): ${text.slice(0, 300)}`)
  return { slug, ref: `${model}@preset/${slug}` }
}

async function ensureModelListed(ctx, ref) {
  const editor = ctx.get('configEditor')
  if (!editor || typeof editor.configuration !== 'function') return false
  let rows = []
  try { rows = editor.configuration() } catch { return false }
  const row = rows.find((r) => {
    const merged = { ...(r.inherited || {}), ...(r.override || {}) }
    return Boolean(merged?.providers?.openrouter)
  })
  if (!row) return false
  const merged = { ...(row.inherited || {}), ...(row.override || {}) }
  const models = merged?.providers?.openrouter?.models
  if (Array.isArray(models) && models.some((m) => m && m.id === ref)) return true
  await editor.edit(row.entry, (current, inherited) => {
    const base = { ...(inherited || {}), ...(current || {}) }
    const providers = { ...(base.providers || {}) }
    const openrouter = { ...(providers.openrouter || {}) }
    const list = Array.isArray(openrouter.models) ? [...openrouter.models] : []
    if (!list.some((m) => m && m.id === ref)) list.push({ id: ref, name: `Model Hunter — ${ref.split('@preset/')[1] || ref}` })
    openrouter.models = list
    providers.openrouter = openrouter
    return { ...base, providers }
  })
  return true
}

async function allSessionRows(ctx) {
  const sc = ctx.get('sessionController')
  if (!sc || typeof sc.list !== 'function') return []
  const listed = await sc.list({})
  return listed?.items || []
}

function pickTargets(rows, scope, currentSessionId) {
  const all = rows.map((r) => r.sessionId).filter(Boolean)
  if (scope === 'all') return all
  if (!currentSessionId) throw new Error('سشنِ جاری معلوم نیست؛ برای دامنهٔ محدود باید از داخلِ یک چت بزنی')
  if (scope === 'session') return [currentSessionId]
  const current = rows.find((r) => r.sessionId === currentSessionId)
  const cwd = current?.cwd
  if (!cwd) throw new Error('پوشهٔ همین پروژه معلوم نشد')
  return rows.filter((r) => r.cwd === cwd).map((r) => r.sessionId)
}

/** مدلِ فعلیِ یک چت از لاگش (آخرین جواب یا انتخابِ مدل)؛ نامعلوم ⇒ null. */
function currentRefOf(sessionId) {
  const file = logPathOf(sessionId)
  if (!file) return null
  try { return lastRefOfLog(decompress(fs.readFileSync(file))) } catch { return null }
}

/**
 * کدام چت‌ها باید عوض شوند؟ فقط چت‌هایی که همین الان روی **همین مدل** (با هر سرور)
 * هستند. چتی که pro است با انتخابِ سرورِ flash، flash نمی‌شود؛ و چتی که همین الان
 * روی همین preset است دست نمی‌خورد (عوض‌کردنِ بی‌دلیل یعنی یک بار کلِ تاریخچه بی‌کش).
 * scope=session همیشه همان یک چت را عوض می‌کند (انتخابِ صریح).
 */
export function filterSameModel(ids, ref, refOf, scope) {
  if (scope === 'session') return { targets: [...ids], kept: [] }
  const model = ref.split('@')[0]
  const targets = []
  const kept = []
  for (const id of ids) {
    const current = refOf(id)
    if (current === ref) { kept.push({ id, reason: 'همین الان روی همین است' }); continue }
    if (current !== null && current.split('@')[0] !== model) { kept.push({ id, reason: 'مدلِ دیگری دارد: ' + current.split('@')[0] }); continue }
    targets.push(id)
  }
  return { targets, kept }
}

async function switchSessions(ctx, ref, scope = 'all', currentSessionId = null) {
  const sc = ctx.get('sessionController')
  if (!sc || typeof sc.selectModel !== 'function') {
    return { scope, attempted: 0, switched: [], failed: [], kept: [], note: 'sessionController unavailable' }
  }
  const rows = await allSessionRows(ctx)
  const live = (ctx.get('agents')?.list?.() || []).map((a) => a.id)
  const all = new Set(pickTargets(rows, scope, currentSessionId))
  for (const id of live) if (all.has(id) || scope === 'all') all.add(id)
  const { targets, kept } = filterSameModel(all, ref, currentRefOf, scope)
  const ids = new Set(targets)
  const switched = []
  const failed = []
  for (const id of ids) {
    try {
      await sc.selectModel({ sessionId: id, provider: 'openrouter', model: ref })
      switched.push(id)
    } catch (err) {
      failed.push({ id, error: String(err?.message || err) })
    }
  }
  return { scope, attempted: ids.size, switched, failed, kept }
}

function projCacheFile(sessionId) {
  return path.join(os.homedir(), '.dsh', 'storages', 'session_projcache', 'sessions', `${sessionId}.json`)
}

function readSessionUsage(sessionId) {
  try {
    const d = JSON.parse(fs.readFileSync(projCacheFile(sessionId), 'utf8'))
    const rows = d?.record?.rows || {}
    const totals = rows.tokenUsage?.val?.totals
    if (!totals) return null
    const stats = rows.sessionStats?.val || {}
    return {
      uncached: totals.uncachedInputTokens || 0,
      cached: totals.cacheReadTokens || 0,
      out: totals.outputTokens || 0,
      requests: stats.steps || 0,
      turns: stats.turns || 0,
    }
  } catch {
    return null
  }
}

async function buildProfile(ctx, scope, currentSessionId) {
  const rows = await allSessionRows(ctx)
  const ids = scope === 'all' ? rows.map((r) => r.sessionId) : pickTargets(rows, scope, currentSessionId)
  const agg = { uncached: 0, cached: 0, out: 0, requests: 0, sessions: 0, missing: 0 }
  for (const id of ids) {
    const u = readSessionUsage(id)
    if (!u) { agg.missing += 1; continue }
    agg.sessions += 1
    agg.uncached += u.uncached
    agg.cached += u.cached
    agg.out += u.out
    agg.requests += u.requests
  }
  const promptTotal = agg.uncached + agg.cached
  const cacheShare = promptTotal > 0 ? agg.cached / promptTotal : 0
  const reqCount = agg.requests || agg.sessions || 1
  return {
    scope,
    sessions: agg.sessions,
    missing: agg.missing,
    requests: reqCount,
    cacheShare: Math.round(cacheShare * 1000) / 10,
    avgPromptPerRequest: Math.round(promptTotal / reqCount),
    avgCachedPerRequest: Math.round(agg.cached / reqCount),
    avgUncachedPerRequest: Math.round(agg.uncached / reqCount),
    avgOutPerRequest: Math.round(agg.out / reqCount),
    outToInPct: promptTotal > 0 ? Math.round((agg.out / promptTotal) * 10000) / 100 : 0,
    totals: { prompt: promptTotal, cached: agg.cached, uncached: agg.uncached, out: agg.out },
  }
}

function costPerRequest(row, profile, calib = CALIBRATION) {
  // اندازهٔ درخواست از مصرفِ واقعیِ دامنه؛ سهمِ کش در حالتِ کش‌خورده از کالیبره؛
  // و کش‌نخوردنِ بی‌دلیلِ همین سرور از اندازه‌گیری (expectedCost).
  const shape = { ...CALIBRATION, ...(calib || {}) }
  if (profile && profile.avgPromptPerRequest > 0) shape.promptTokens = profile.avgPromptPerRequest
  if (profile && profile.avgOutPerRequest > 0) shape.outputTokens = profile.avgOutPerRequest
  return expectedCost(row, shape)
}

/**
 * تطبیقِ شناسهٔ مدل با مقدارِ ورودی.
 * مقدارِ منوی پنل شناسهٔ بدونِ پیشوندِ ارائه‌دهنده است (مثلِ `deepseek-v4-pro-0813`)
 * ولی ردیف‌های اسنپ‌شات شناسهٔ کامل دارند (`deepseek/deepseek-v4-pro-0813`).
 * تطبیق با **برابری** است نه زیررشته، وگرنه `deepseek-chat` سه مدل را می‌گیرد.
 */
export function modelMatches(rowModel, requested) {
  if (typeof rowModel !== 'string' || typeof requested !== 'string' || !rowModel || !requested) return false
  if (rowModel === requested) return true
  const slash = rowModel.indexOf('/')
  return slash >= 0 && rowModel.slice(slash + 1) === requested
}

export function recommendFromProfile(snap, profile, config, options = {}) {
  const focusModel = (options && options.model) || config.focus
  const all = snap.rows.filter((r) => modelMatches(r.model, focusModel) && r.usable)
  // همهٔ سطح‌ها همیشه در رتبه‌بندی می‌آیند؛ سطحِ هر ردیف در ستونِ «سطح» نوشته می‌شود
  const rows = all
  if (!rows.length) throw new Error('برای مدلِ فوکوس ارائه‌دهندهٔ سالمی نیست')
  const floor = config.qualityFloor ?? 85
  const scored = rows.map((r) => ({
    provider: r.provider,
    slug: r.slug,
    quantization: r.quantization,
    tier: r.tier || null,
    quality: r.quality,
    realOffPct: r.realOffPct == null ? null : r.realOffPct,
    costCalib: r.costCalib ?? Math.round(expectedCost(r, config.calibration) * 1e6) / 1e6,
    priceIn1m: r.priceIn1m,
    cacheRead1m: r.cacheRead1m,
    cacheKnown: r.cacheKnown !== false,
    priceOut1m: r.priceOut1m,
    uptime: r.uptime,
    costPerRequest: Math.round(costPerRequest(r, profile, config.calibration) * 1e6) / 1e6,
    missPct: r.measured && r.measured.eligible >= MIN_SAMPLES ? r.measured.missPct : null,
    missSamples: r.measured ? r.measured.eligible : 0,
    measuredCostPerRequest: r.measured && r.measured.requests >= MIN_SAMPLES ? r.measured.costPerRequest : null,
  }))
  const eligible = scored.filter((r) => r.quality >= floor)
  const pool = eligible.length ? eligible : scored
  const byCost = [...pool].sort((a, b) => a.costPerRequest - b.costPerRequest)
  const best = byCost[0]
  const qualityFirst = [...pool].sort((a, b) => b.quality - a.quality || a.costPerRequest - b.costPerRequest)[0]
  const officialRow = rows.find((r) => r.official)
  const baseline = officialRow ? {
    provider: officialRow.provider,
    quantization: officialRow.quantization,
    tier: officialRow.tier || null,
    quality: officialRow.quality,
    realOffPct: 0,
    costCalib: Math.round(expectedCost(officialRow, config.calibration) * 1e6) / 1e6,
    priceIn1m: officialRow.priceIn1m,
    cacheRead1m: officialRow.cacheRead1m,
    priceOut1m: officialRow.priceOut1m,
    costPerRequest: Math.round(costPerRequest(officialRow, profile, config.calibration) * 1e6) / 1e6,
  } : null
  const savingsPct = baseline && baseline.costPerRequest > 0
    ? Math.round((1 - best.costPerRequest / baseline.costPerRequest) * 1000) / 10
    : null
  return {
    model: (all[0] && all[0].model) || focusModel,
    profile,
    qualityFloor: floor,
    recommended: best,
    baseline,
    savingsPct,
    highestQuality: qualityFirst,
    alternatives: byCost.slice(1, 6),
    projectedPer1000Requests: Math.round(best.costPerRequest * 1000 * 1e4) / 1e4,
  }
}

async function applyChoice(ctx, config, model, provider, scope = 'all', currentSessionId = null) {
  const snap = state
  const row = snap.rows.find((r) => r.model === model && (r.provider === provider || r.slug === provider) && r.usable)
  if (!row) throw new Error('این ترکیبِ مدل/ارائه‌دهنده در اسنپ‌شات نیست یا سالم نیست')
  const preset = await ensurePreset(ctx, config, model, row)
  let listed = false
  try { listed = await ensureModelListed(ctx, preset.ref) } catch (err) { ctx.logger?.warn?.(`model-hunter: ثبت مدل در فهرست ناموفق: ${err}`) }
  const live = await switchSessions(ctx, preset.ref, scope, currentSessionId)
  if (scope === 'all') {
    const svc = ctx.get('agentDefaultModel')
    if (svc) {
      const current = svc.currentSelection()
      // پیش‌فرضِ چت‌های تازه هم فقط وقتی عوض می‌شود که همین مدل باشد (pro با انتخابِ سرورِ flash، flash نمی‌شود).
      const currentModel = current && typeof current.model === 'string' ? current.model.split('@')[0] : null
      if (!currentModel || currentModel === model || current.provider !== 'openrouter') await svc.saveSelection({ ...current, model: preset.ref })
    }
  }
  return { model, provider: row.provider, ref: preset.ref, listed, live }
}

function fmtApply(result) {
  const live = result.live || {}
  const kept = (live.kept || []).length
  return `مدل ست شد: ${result.ref}\nارائه‌دهنده پین‌شده: ${result.provider}\n${(live.switched || []).length} چت عوض شد` + (kept ? `، ${kept} چت دست نخورد (مدلِ دیگری داشتند یا همین الان روی همین بودند)` : '') + '\nهر چتی که عوض شد، درخواستِ بعدی‌اش یک بار بی‌کش است (سرورِ تازه کش را از صفر می‌سازد).'
}

export const name = 'model-hunter'
export const inject = ['tools']

export function apply(ctx, config) {
  const cfg = { ...DEFAULTS, ...(config || {}) }

  const book = createGenerationBook({ readKey: () => process.env.OPENROUTER_API_KEY || readEnvKeySync('OPENROUTER_API_KEY') })
  let measured = []
  const measure = async () => {
    try {
      const logs = recentLogs({ days: cfg.measureDays || 7 })
      await book.fill(Object.values(logs).flat().map(r => r.id))
      measured = providerStats(logs, book.detailOf)
      if (state.ts) state = applyMeasured(state, measured, cfg.calibration)
    } catch (err) {
      ctx.logger?.warn?.(`model-hunter: اندازه‌گیری شکست خورد: ${err}`)
    }
  }

  const refresh = async () => {
    try {
      state = applyMeasured(await scan(cfg), measured, cfg.calibration)
      ctx.logger?.info?.(`model-hunter: ${state.rows.length} ارائه‌دهنده در ${Object.keys(state.families).length} خانواده`)
    } catch (err) {
      state = { ...state, error: String(err), ts: Date.now() }
      ctx.logger?.warn?.(`model-hunter: اسکن شکست خورد: ${err}`)
    }
  }

  ctx.effect(() => {
    const t1 = setTimeout(async () => { await measure(); await refresh() }, 3000)
    const t2 = setInterval(refresh, Math.max(5, cfg.refreshMinutes) * 60_000)
    const t3 = setInterval(measure, 10 * 60_000)
    return () => { clearTimeout(t1); clearInterval(t2); clearInterval(t3) }
  })

  const tool = {
    name: 'model_hunter',
    description:
      'رتبه‌بندیِ مدل‌های دیپ‌سیک در OpenRouter بر اساس کیفیت تحویل و صرفهٔ واقعی نسبت به دیپ‌سیکِ رسمی. '
      + 'action=list فهرست برترین‌ها، action=suggest پیشنهاد برای یک نوع کار، '
      + 'action=apply فقط وقتی کاربر صریحاً خواست مدل عوض شود.',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['list', 'suggest', 'recommend', 'apply'], description: 'نوع عملیات' },
        task: { type: 'string', enum: ['balanced', 'code', 'long', 'cheap', 'fast'], description: 'نوع کار برای suggest' },
        limit: { type: 'integer', minimum: 1, maximum: 30, description: 'تعداد ردیف' },
        model: { type: 'string', description: 'شناسهٔ مدل (برای apply) یا مدلِ هدفِ پیشنهاد (برای recommend)' },
        provider: { type: 'string', description: 'نام یا اسلاگِ ارائه‌دهنده برای apply' },
        scope: {
          type: 'string',
          enum: ['session', 'project', 'all'],
          description: 'دامنهٔ اعمال: session فقط همین چت، project همهٔ چت‌های همین پروژه، all همهٔ چت‌های همهٔ پروژه‌ها (پیش‌فرض)',
        },
      },
      required: ['action'],
      additionalProperties: false,
    },
    output: {
      schema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'], additionalProperties: false },
      render: (_args, value) => [{ type: 'text', text: String(value?.text ?? '') }],
    },
    async execute(args, exec) {
      const action = args?.action || 'list'
      if (!state.ts) await refresh()
      if (action === 'apply') {
        if (!args.model) throw new Error('برای apply باید model بدهی')
        const result = await applyChoice(ctx, cfg, args.model, args.provider || '', args.scope || 'all', exec?.agent?.id || null)
        return { text: fmtApply(result) }
      }
      if (action === 'recommend') {
        const scope = args.scope || 'project'
        const profile = await buildProfile(ctx, scope, exec?.agent?.id || null)
        const rec = recommendFromProfile(state, profile, cfg, { model: args.model })
        const label = { session: 'همین چت', project: 'همین پروژه', all: 'همهٔ پروژه‌ها' }[scope] || scope
        const lines = [
          `دامنه: ${label} — ${profile.sessions} چت، ${profile.requests} درخواست (${profile.missing ? `${profile.missing} بدونِ آمار، ` : ''}کش ${profile.cacheShare}٪)`,
          `میانگینِ هر درخواست: ورودی ${profile.avgPromptPerRequest} (کش ${profile.avgCachedPerRequest})، خروجی ${profile.avgOutPerRequest}`,
          `پیشنهاد: ${rec.recommended.provider} · سطح ${rec.recommended.tier || 'استاندارد'} · ${rec.recommended.quantization} — هزینهٔ هر درخواست $${rec.recommended.costPerRequest}، کیفیت ${rec.recommended.quality}، آف واقعی ${rec.recommended.realOffPct == null ? '—' : `${rec.recommended.realOffPct}%`}`,
          `هزینهٔ ۱۰۰۰ درخواست: $${rec.projectedPer1000Requests}`,
          '',
          'گزینه‌های بعدی:',
          ...rec.alternatives.map((a, i) => `${i + 2}. ${a.provider} — $${a.costPerRequest}/درخواست، کیفیت ${a.quality}`),
        ]
        return { text: lines.join('\n') }
      }
      const task = args?.task || 'balanced'
      const limit = Math.min(30, Math.max(1, args?.limit || 10))
      const head = `اسنپ‌شات: ${new Date(state.ts).toLocaleString('fa-IR')} | ${state.rows.length} ارائه‌دهنده\n`
      return { text: head + topText(state, task, limit) }
    },
  }
  ctx.effect(() => ctx.tools.register(tool))

  ctx.inject(['webServer'], (webCtx) => {
    const web = webCtx.webServer

    webCtx.effect(() => web.register({
      kind: 'exact',
      path: '/plugins/model-hunter/state',
      handler: (req, res) => {
        res.setHeader('content-type', 'application/json; charset=utf-8')
        res.end(JSON.stringify({
          ts: state.ts,
          error: state.error,
          focus: cfg.focus,
          calibration: cfg.calibration || CALIBRATION,
          measured,
          priorMissPct: PRIOR_MISS * 100,
          minSamples: MIN_SAMPLES,
          families: Object.fromEntries(Object.entries(state.families).map(([k, v]) => [k, v.map((m) => ({
            model: m.model, name: m.name, batch: m.batch, context: m.context, winners: m.winners,
          }))])),
          rows: state.rows,
        }))
      },
    }))

    webCtx.effect(() => web.register({
      kind: 'exact',
      path: '/plugins/model-hunter/recommend',
      handler: async (req, res) => {
        res.setHeader('content-type', 'application/json; charset=utf-8')
        try {
          const url = new URL(req.url, 'http://localhost')
          const scope = url.searchParams.get('scope') || 'project'
          const sessionId = url.searchParams.get('sessionId') || null
          const modelParam = url.searchParams.get('model') || undefined
          if (!state.ts) await refresh()
          const profile = await buildProfile(ctx, scope, sessionId)
          const result = recommendFromProfile(state, profile, cfg, { model: modelParam })
          res.end(JSON.stringify({ ok: true, ...result }))
        } catch (err) {
          res.statusCode = 400
          res.end(JSON.stringify({ ok: false, error: String(err?.message || err) }))
        }
      },
    }))

    webCtx.effect(() => web.register({
      kind: 'exact',
      path: '/plugins/model-hunter/apply',
      handler: async (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end('POST only'); return }
        let body = ''
        for await (const chunk of req) body += chunk
        try {
          const input = JSON.parse(body || '{}')
          const result = await applyChoice(ctx, cfg, input.model, input.provider, input.scope || 'all', input.sessionId || null)
          res.setHeader('content-type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({ ok: true, ...result }))
        } catch (err) {
          res.statusCode = 400
          res.setHeader('content-type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({ ok: false, error: String(err?.message || err) }))
        }
      },
    }))
  })
}