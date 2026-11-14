/**
 * Model Hunter — Host half
 * ------------------------
 * OpenRouter را می‌خواند، مدل‌های دیپ‌سیک را روی «کیفیت تحویل» و «off» رتبه می‌دهد،
 * با ابزار model_hunter در اختیار مدل می‌گذارد و انتخابِ مدل را (با preset برای پینِ
 * ارائه‌دهنده) روی DSH اعمال می‌کند.
 *
 * خروجیِ HTTP برای پنل:
 *   GET  /api/model-hunter/state   → اسنپ‌شات
 *   POST /api/model-hunter/apply   → {model, provider, quantization}
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const OPENROUTER = 'https://openrouter.ai/api/v1'
const FOCUS = 'deepseek/deepseek-v4.1-flash-1017'

const PRECISION = {
  fp32: 100, bf16: 97, fp16: 95, fp8: 88,
  int8: 74, nvfp4: 74, fp4: 58, mxfp4: 52, unknown: 62,
}
const TIER_BONUS = { priority: 4, ultrafast: 2, flex: -4 }

const DEFAULTS = {
  families: ['deepseek'],
  refreshMinutes: 120,
  focus: FOCUS,
  managementKeyEnv: 'OPENROUTER_MANAGEMENT_KEY',
}

let state = { ts: 0, families: {}, rows: [], error: null }

const num = (x, d = 0) => {
  const n = Number(x)
  return Number.isFinite(n) ? n : d
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
  let discount = num(pr.discount)
  if (discount > 1) discount = discount / 100
  discount = Math.max(0, Math.min(0.99, discount))
  const priceIn = num(pr.prompt)
  const priceOut = num(pr.completion)
  return {
    provider: e.provider_name || '?',
    slug,
    quantization: q,
    tier,
    uptime: uptime == null ? null : Math.round(num(uptime) * 100) / 100,
    status: e.status,
    quality: Math.round(quality * 100) / 100,
    offPct: Math.round(discount * 10000) / 100,
    priceIn, priceOut,
    cacheRead1m: Math.round(num(pr.input_cache_read) * 1e6 * 1e4) / 1e4,
    priceIn1m: Math.round(priceIn * 1e6 * 1e4) / 1e4,
    priceOut1m: Math.round(priceOut * 1e6 * 1e4) / 1e4,
    listedIn1m: Math.round((discount > 0 ? priceIn / (1 - discount) : priceIn) * 1e6 * 1e4) / 1e4,
    listedOut1m: Math.round((discount > 0 ? priceOut / (1 - discount) : priceOut) * 1e6 * 1e4) / 1e4,
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
  return 0.55 * (r.quality / 100) + 0.45 * (r.offPct / 100)
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
    const rows = []
    for (const e of eps) {
      const name = e.provider_name || '?'
      const row = scoreEndpoint(e, slugOf[name] || name.toLowerCase().replace(/[^a-z0-9]+/g, '-'))
      const key = `${row.provider}|${row.quantization}|${row.priceIn}|${row.priceOut}|${row.tier}`
      if (seen.has(key)) continue
      seen.add(key)
      rows.push(row)
    }
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
      winners: {
        quality: [...usable].sort((a, b) => b.quality - a.quality || b.offPct - a.offPct || a.priceIn - b.priceIn)[0] || null,
        off: [...usable].sort((a, b) => b.offPct - a.offPct || b.quality - a.quality || a.priceIn - b.priceIn)[0] || null,
        balanced: [...usable].sort((a, b) => taskScore(b, 'balanced') - taskScore(a, 'balanced') || a.priceIn - b.priceIn)[0] || null,
        cheap: [...usable].sort((a, b) => a.priceIn - b.priceIn)[0] || null,
      },
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
    `${i + 1}. ${r.model} | ${r.provider} (${r.quantization}${r.tier ? `, ${r.tier}` : ''}) | کیفیت ${r.quality} | off ${r.offPct}% | ورودی $${r.priceIn1m}/M`)
  return lines.join('\n')
}

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)
}

function presetSlug(model, provider) {
  const fam = model.split('/')[1] || model
  return slugify(`mh-${fam}-${provider}`)
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

async function switchSessions(ctx, ref, scope = 'all', currentSessionId = null) {
  const sc = ctx.get('sessionController')
  if (!sc || typeof sc.selectModel !== 'function') {
    return { scope, attempted: 0, switched: [], failed: [], note: 'sessionController unavailable' }
  }
  const rows = await allSessionRows(ctx)
  const live = (ctx.get('agents')?.list?.() || []).map((a) => a.id)
  const ids = new Set(pickTargets(rows, scope, currentSessionId))
  for (const id of live) if (ids.has(id) || scope === 'all') ids.add(id)
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
  return { scope, attempted: ids.size, switched, failed }
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

function costPerRequest(row, profile) {
  return (profile.avgUncachedPerRequest * row.priceIn
    + profile.avgCachedPerRequest * (row.cacheRead1m / 1e6)
    + profile.avgOutPerRequest * row.priceOut)
}

function recommendFromProfile(snap, profile, config, options = {}) {
  const focusModel = config.focus
  const all = snap.rows.filter((r) => r.model === focusModel && r.usable)
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
    offPct: r.offPct,
    priceIn1m: r.priceIn1m,
    cacheRead1m: r.cacheRead1m,
    priceOut1m: r.priceOut1m,
    uptime: r.uptime,
    costPerRequest: Math.round(costPerRequest(r, profile) * 1e6) / 1e6,
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
    priceIn1m: officialRow.priceIn1m,
    cacheRead1m: officialRow.cacheRead1m,
    priceOut1m: officialRow.priceOut1m,
    costPerRequest: Math.round(costPerRequest(officialRow, profile) * 1e6) / 1e6,
  } : null
  const savingsPct = baseline && baseline.costPerRequest > 0
    ? Math.round((1 - best.costPerRequest / baseline.costPerRequest) * 1000) / 10
    : null
  return {
    model: focusModel,
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
      await svc.saveSelection({ ...current, model: preset.ref })
    }
  }
  return { model, provider: row.provider, ref: preset.ref, listed, live }
}

function fmtApply(result) {
  return `مدل ست شد: ${result.ref}\nارائه‌دهنده پین‌شده: ${result.provider}`
}

export const name = 'model-hunter'
export const inject = ['tools']

export function apply(ctx, config) {
  const cfg = { ...DEFAULTS, ...(config || {}) }

  const refresh = async () => {
    try {
      state = await scan(cfg)
      ctx.logger?.info?.(`model-hunter: ${state.rows.length} ارائه‌دهنده در ${Object.keys(state.families).length} خانواده`)
    } catch (err) {
      state = { ...state, error: String(err), ts: Date.now() }
      ctx.logger?.warn?.(`model-hunter: اسکن شکست خورد: ${err}`)
    }
  }

  ctx.effect(() => {
    const t1 = setTimeout(refresh, 3000)
    const t2 = setInterval(refresh, Math.max(5, cfg.refreshMinutes) * 60_000)
    return () => { clearTimeout(t1); clearInterval(t2) }
  })

  const tool = {
    name: 'model_hunter',
    description:
      'رتبه‌بندیِ مدل‌های دیپ‌سیک در OpenRouter بر اساس کیفیت تحویل و تخفیف (off). '
      + 'action=list فهرست برترین‌ها، action=suggest پیشنهاد برای یک نوع کار، '
      + 'action=apply فقط وقتی کاربر صریحاً خواست مدل عوض شود.',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['list', 'suggest', 'recommend', 'apply'], description: 'نوع عملیات' },
        task: { type: 'string', enum: ['balanced', 'code', 'long', 'cheap', 'fast'], description: 'نوع کار برای suggest' },
        limit: { type: 'integer', minimum: 1, maximum: 30, description: 'تعداد ردیف' },
        model: { type: 'string', description: 'شناسهٔ مدل برای apply' },
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
        const rec = recommendFromProfile(state, profile, cfg)
        const label = { session: 'همین چت', project: 'همین پروژه', all: 'همهٔ پروژه‌ها' }[scope] || scope
        const lines = [
          `دامنه: ${label} — ${profile.sessions} چت، ${profile.requests} درخواست (${profile.missing ? `${profile.missing} بدونِ آمار، ` : ''}کش ${profile.cacheShare}٪)`,
          `میانگینِ هر درخواست: ورودی ${profile.avgPromptPerRequest} (کش ${profile.avgCachedPerRequest})، خروجی ${profile.avgOutPerRequest}`,
          `پیشنهاد: ${rec.recommended.provider} · سطح ${rec.recommended.tier || 'استاندارد'} · ${rec.recommended.quantization} — هزینهٔ هر درخواست $${rec.recommended.costPerRequest}، کیفیت ${rec.recommended.quality}`,
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
          if (!state.ts) await refresh()
          const profile = await buildProfile(ctx, scope, sessionId)
          const result = recommendFromProfile(state, profile, cfg)
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
