/**
 * دستیار (dsh-advisor) — نیمهٔ سرور
 * ----------------------------------
 * حبیب: «ایجنت باید هر دفعه تنظیماتِ فعلیِ دیپ‌سیک‌هارنس و چت تا اون موقع رو بگیره و چک کنه
 * آیا تنظیمِ بهتری هست؛ یه دکمهٔ ران که فقط من زدم اجرا بشه، یا پلی که توی هر تموم‌شدنِ پاسخ
 * اجرا کنه» · «کلِ چت، نه خلاصه» · «جدولِ ردیف‌ها هم داده بشه که اگر یکی غیرمنطقی بالا بود چک کنه».
 *
 * هیچ اجرایی بی‌اجازهٔ کاربر نیست: نه ▶ زده نشده باشد، نه ⟳ روشن باشد ⇒ صفر تماس، صفر خرج.
 *
 * مسیرها (همان سدِ loopback/origin ِ dsh-side-panel):
 *   GET  /plugins/advisor/state?sessionId=      → وضعیت + نتیجه + خرجِ تجمیعی
 *   POST /plugins/advisor/run   {sessionId}     → یک اجرای دستی
 *   POST /plugins/advisor/play  {sessionId, on} → روشن/خاموشِ پلیِ همین چت
 *   POST /plugins/advisor/server {sessionId, mode} → «خودکار» / «همیشه بی‌کش» / «همیشه با کش»
 *
 * دادهٔ پایدار: ~/.dsh/advisor/state.json (پلی‌ها، نتیجه‌ها، کلیدِ تکرار، خرجِ تجمیعی، سرورِ هر چت).
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { decompressAsync, findSessionLog, summarizeChatCost, parseSessionLog, createPriceBook, createAnthropicPrices } from '../dsh-side-panel/cost-log.js'
import { splitLogLines } from '../dsh-side-panel/raw-log.js'
import {
  dedupeKey, estimateTokens, faInt, headline, lastTurnEndSeq, parseLogRows, quotaState, redactSecrets,
  shouldRunOnTurnEnd, DEBOUNCE_MS,
} from './advisor-pure.js'
import { buildAdvisorInput } from './advisor-input.js'
import { RUN_INSTRUCTION, SYSTEM_PROMPT, buildMessages, followsFormat } from './advisor-prompt.js'
import { FALLBACK_MODEL, FALLBACK_PROVIDER, SERVER_MODES, chooseServer, describeServer, openRouterBody } from './advisor-select.js'

export const name = '@local/dsh-advisor'
export const inject = []

const OPENROUTER = 'https://openrouter.ai/api/v1'
const ENV_PATH = path.join(os.homedir(), '.dsh', '.env')
const PROFILE_DIR = path.join(os.homedir(), '.dsh', 'profiles', 'desktop')
export const DATA_DIR = path.join(os.homedir(), '.dsh', 'advisor')
const DEFAULT_DATA_PATH = path.join(DATA_DIR, 'state.json')
/** مسیرِ فایلِ داده؛ آزمون‌ها با DSH_ADVISOR_STATE_DIR عوضش می‌کنند تا به فایلِ واقعی دست نزنند. */
export function dataPath() {
  const override = process.env.DSH_ADVISOR_STATE_DIR
  return override ? path.join(override, 'state.json') : DEFAULT_DATA_PATH
}
export const DATA_PATH = DEFAULT_DATA_PATH
const REQUEST_TIMEOUT_MS = 180000
const LOOPBACK = /^(127\.\d+\.\d+\.\d+|localhost|\[::1\])(:\d+)?$/i

/** کلیدِ OpenRouter را از env یا ~/.dsh/.env بخوان (همان الگوی dsh-side-panel). */
export function readKey(envPath = ENV_PATH) {
  if (process.env.OPENROUTER_API_KEY) return process.env.OPENROUTER_API_KEY.trim()
  try {
    const text = fs.readFileSync(envPath, 'utf8')
    for (const line of text.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue
      const index = trimmed.indexOf('=')
      if (trimmed.slice(0, index).trim() === 'OPENROUTER_API_KEY') return trimmed.slice(index + 1).trim()
    }
  } catch { return null }
  return null
}

/**
 * سدِ کمینه برای مسیرها (عیناً همان منطقِ dsh-side-panel).
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

export function refuse(req, res) {
  const reason = rejectReason(req)
  if (reason === null) return false
  res.statusCode = 403
  res.end(JSON.stringify({ error: 'forbidden: ' + reason }))
  return true
}

export function readJsonBody(req) {
  return new Promise((resolve) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > 16384) { resolve({}); req.destroy(); return }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (chunks.length === 0) { resolve({}); return }
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))) } catch { resolve({}) }
    })
    req.on('error', () => resolve({}))
  })
}

/* ------------------------------------------------------------------ دادهٔ پایدار */

const EMPTY_DB = { version: 1, sessions: {} }

/** خواندنِ state.json؛ فایلِ خراب ⇒ حالتِ خالی (این افزونه هیچ‌وقت اپ را نمی‌خواباند). */
export function readDb(file = null) {
  file = file || dataPath()
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'))
    if (!parsed || typeof parsed !== 'object' || !parsed.sessions || typeof parsed.sessions !== 'object') return { ...EMPTY_DB }
    return { version: 1, sessions: parsed.sessions }
  } catch {
    return { ...EMPTY_DB }
  }
}

/** نوشتنِ اتمی (موقت + rename)، تا برق‌قطع فایل را نصفه نکند. */
export function writeDb(db, file = null) {
  file = file || dataPath()
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const tmp = file + '.' + process.pid + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2))
  fs.renameSync(tmp, file)
}

/** رکوردِ یک چت (بی‌ساختن در فایل). */
export function sessionRecord(db, sessionId) {
  const rec = db && db.sessions ? db.sessions[sessionId] : null
  return rec && typeof rec === 'object' ? rec : null
}

/* ------------------------------------------------------------------ خواندنِ تنظیمات */

/** باندل‌ها و وابستگی‌های پروفایل، خوانا و بی‌راز. */
export function profilePackageText(dir = PROFILE_DIR) {
  const text = fs.readFileSync(path.join(dir, 'package.json'), 'utf8')
  try {
    const parsed = JSON.parse(text)
    const bundles = parsed && parsed.dsh && parsed.dsh.profile && Array.isArray(parsed.dsh.profile.bundles)
      ? parsed.dsh.profile.bundles : []
    const deps = parsed && parsed.dependencies && typeof parsed.dependencies === 'object' ? parsed.dependencies : {}
    const lines = []
    lines.push('bundles (' + faInt(bundles.length) + '):')
    for (const bundle of bundles) lines.push('- ' + bundle)
    lines.push('')
    lines.push('dependencies:')
    for (const [dep, version] of Object.entries(deps)) lines.push('- ' + dep + ': ' + version)
    return lines.join('\n')
  } catch {
    return redactSecrets(text)
  }
}

/** پچِ پروفایل، عیناً، با رازِ پاک‌شده. */
export function profilePatchText(dir = PROFILE_DIR) {
  try { return redactSecrets(fs.readFileSync(path.join(dir, 'cordis.patch.yml'), 'utf8')) } catch { return '(cordis.patch.yml خوانده نشد)' }
}

/** فهرستِ اسکیل‌ها اگر ارزان پیدا شود (فقط نامِ پوشه‌ها)؛ وگرنه خطِ «در دسترس نیست». */
export function skillsText(home = os.homedir()) {
  const roots = [path.join(home, '.agents', 'skills'), path.join(home, '.claude', 'skills')]
  const found = []
  for (const root of roots) {
    try {
      for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
        if (entry.isDirectory() && entry.name !== 'synced') found.push(entry.name)
      }
    } catch { /* پوشه نیست */ }
  }
  if (found.length === 0) return '(فهرستِ اسکیل‌ها در دسترس نبود)'
  return found.sort().join('، ')
}

/** عکسِ کاملِ تنظیمات (تقریباً ثابت ⇒ کش‌پذیر). */
export function settingsSnapshot(dir = PROFILE_DIR) {
  const parts = []
  parts.push('### پروفایل (package.json)')
  parts.push(profilePackageText(dir))
  parts.push('')
  parts.push('### cordis.patch.yml (عیناً، بی‌راز)')
  parts.push('~~~yaml')
  parts.push(profilePatchText(dir))
  parts.push('~~~')
  parts.push('')
  parts.push('### اسکیل‌های در دسترس (فقط نام)')
  parts.push(skillsText())
  return parts.join('\n')
}

/** مدل/افورت/ابزارهای همین چت از آخرین request/header ِ لاگ. */
export function chatHeaderInfo(rows) {
  const list = Array.isArray(rows) ? rows : []
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const row = list[i]
    if (!row || row.type !== 'request/header') continue
    const data = row.event && row.event.data ? row.event.data : {}
    const header = data.header && typeof data.header === 'object' ? data.header : {}
    const config = header.config && typeof header.config === 'object' ? header.config : {}
    const tools = Array.isArray(header.tools) ? header.tools.map((t) => t && t.name).filter(Boolean) : []
    return {
      seq: row.seq,
      model: config.model ?? null,
      provider: config.provider ?? null,
      reasoningEffort: config.reasoningEffort ?? null,
      cacheRetention: config.cacheRetention ?? null,
      tools,
    }
  }
  return null
}


/* ------------------------------------------------------------------ لاگ و خرجِ چت */

const logCache = new Map()

/** متنِ لاگِ یک سشن (کش با mtime+size، همان الگوی dsh-side-panel). */
export async function sessionLogText(sessionId) {
  const file = findSessionLog(sessionId)
  if (!file) return null
  const stat = await fs.promises.stat(file)
  const stamp = stat.mtimeMs + ':' + stat.size
  const hit = logCache.get(file)
  if (hit && hit.stamp === stamp) return hit.text
  const text = await decompressAsync(await fs.promises.readFile(file))
  logCache.set(file, { stamp, text })
  while (logCache.size > 3) logCache.delete(logCache.keys().next().value)
  return text
}

/** ردیف‌های یک سشن. */
export async function sessionRows(sessionId) {
  const text = await sessionLogText(sessionId)
  if (text === null) return null
  return parseLogRows(splitLogLines(text))
}

const priceBook = createPriceBook({ readKey })
const anthropicPrices = createAnthropicPrices()

/** خرجِ دقیقِ همین چت تا الان (همان حسابِ dsh-side-panel، فقط خواندنی). */
export async function chatCostOf(sessionId) {
  try {
    const text = await sessionLogText(sessionId)
    if (text === null) return { found: false }
    const parsed = parseSessionLog(text)
    const summary = summarizeChatCost(parsed, (id) => priceBook.priceOf(id), (id) => priceBook.detailOf(id), (m) => anthropicPrices.priceOf(m))
    priceBook.flush()
    return {
      found: true,
      total: typeof summary.total === 'number' ? summary.total : 0,
      priced: typeof summary.priced === 'number' ? summary.priced : 0,
      pending: typeof summary.pending === 'number' ? summary.pending : 0,
    }
  } catch (err) {
    return { found: false, error: String(err && err.message ? err.message : err) }
  }
}

/* ------------------------------------------------------------------ شکارچی مدل */

/**
 * فهرستِ رتبه‌بندی‌شده از خودِ همین اپ (/plugins/model-hunter/rank).
 * @returns آرایه، یا null اگر مسیر در دسترس نبود.
 */
export async function fetchRanking(origin, cache, fetchImpl = fetch) {
  try {
    const url = String(origin).replace(/\/$/, '') + '/plugins/model-hunter/rank?task=cheap&cache=' + encodeURIComponent(cache) + '&limit=12'
    const res = await fetchImpl(url, { headers: { accept: 'application/json' } })
    if (!res.ok) return null
    const json = await res.json()
    return Array.isArray(json && json.rows) ? json.rows : null
  } catch {
    return null
  }
}

/* ------------------------------------------------------------------ حدِ زمینه */

const contextCache = new Map()

/**
 * حدِ زمینهٔ همان سروری که انتخاب شد، از OpenRouter.
 * سرور پیدا نشد ⇒ کوچک‌ترین حدِ همهٔ سرورهای همان مدل (امن‌ترین). بی‌نتیجه ⇒ ۱٬۰۰۰٬۰۰۰.
 * @param fetchImpl - fetch (در آزمون جعلی).
 * @param server - { model, provider, providerSlug } (اختیاری؛ پیش‌فرض: فلشِ ۴٫۱).
 */
export async function contextLimit(fetchImpl = fetch, server = null) {
  const s = server && typeof server === 'object' ? server : {}
  const model = String(s.model || 'deepseek/deepseek-v4.1-flash-1017').split('@')[0].replace(/:[a-z]+$/i, '')
  const slug = String(s.providerSlug || '').toLowerCase()
  const name = String(s.provider || '').toLowerCase()
  const cacheKey = model + '|' + slug + '|' + name
  const hit = contextCache.get(cacheKey)
  if (hit && Date.now() - hit.ts < 6 * 3600 * 1000) return hit.limit
  try {
    const res = await fetchImpl(OPENROUTER + '/models/' + model + '/endpoints', { headers: { accept: 'application/json' } })
    const json = await res.json()
    const endpoints = (json && json.data && Array.isArray(json.data.endpoints) ? json.data.endpoints : [])
      .filter((e) => e && Number.isFinite(e.context_length) && e.context_length > 0)
    if (endpoints.length === 0) return 1000000
    const mine = endpoints.filter((e) => {
      const tag = String(e.tag || '').toLowerCase()
      const pname = String(e.provider_name || '').toLowerCase()
      return (slug !== '' && (tag === slug || tag.startsWith(slug + '/'))) || (name !== '' && pname === name)
    })
    const pool = mine.length > 0 ? mine : endpoints
    const limit = Math.min(...pool.map((e) => e.context_length))
    contextCache.set(cacheKey, { ts: Date.now(), limit })
    return limit
  } catch {
    return 1000000
  }
}


/* ------------------------------------------------------------------ اجرا */

/**
 * سقفِ خروجی. فلش پیش از جواب «فکر» می‌کند و توکن‌های فکر هم از همین سقف کم می‌شود؛
 * با ۲۰۰۰ روی چتِ بزرگ همه‌اش خرجِ فکر شد و جواب خالی آمد (۱۵ نوامبر ۱۵:۴۶).
 */
export const RUN_MAX_TOKENS = 16000

/**
 * بالاتر از این (تخمینِ توکنِ ورودی) سرورِ ارزان امتحان نمی‌شود و مستقیم دیپ‌اینفرا.
 * مدرک (۱۵ نوامبر، همین چت، ~۹۲۵ هزار توکن): بایدو/فلشِ ۴ ⇒ ۲ بار خالی، ۲ بار ادامهٔ چت به‌جای بررسی؛
 * سیل‌ریسرچ/فلشِ ۴٫۱ ⇒ ۱۸۰ ثانیه بی‌جواب؛ دیپ‌اینفرا/فلشِ ۴٫۱ ⇒ درست، ۹٫۳ سنت، ۸۰ ثانیه.
 */
export const BIG_INPUT_TOKENS = 300000

/** سرورِ مطمئن (همان پریستِ ساب‌ایجنت‌ها). */
export function fallbackServer(cache, note) {
  return { model: FALLBACK_MODEL, provider: FALLBACK_PROVIDER, providerSlug: 'deepinfra', cache: cache === 'with' ? 'with' : 'none', source: 'fallback', note }
}

export function isFallbackServer(server) {
  return Boolean(server) && server.model === FALLBACK_MODEL
}

/**
 * یک تماس با OpenRouter. جوابِ خالی ⇒ خطا با خرجِ همان تماس (err.cost).
 * @returns { json, content, usage, realCost, formatOk, messages }
 */
export async function callModel({ server, input, key, fetchImpl }) {
  const messages = buildMessages(input, RUN_INSTRUCTION)
  const body = openRouterBody({ model: server.model, providerSlug: server.providerSlug, messages, maxTokens: RUN_MAX_TOKENS })
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  let json
  try {
    const res = await fetchImpl(OPENROUTER + '/chat/completions', {
      method: 'POST',
      headers: {
        authorization: 'Bearer ' + key,
        'content-type': 'application/json',
        accept: 'application/json',
        'x-title': 'DSH Advisor',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    const text = await res.text()
    if (!res.ok) throw new Error('OpenRouter HTTP ' + res.status + ': ' + text.slice(0, 400))
    json = JSON.parse(text)
  } catch (err) {
    if (err && err.name === 'AbortError') throw new Error('بعد از ' + faInt(REQUEST_TIMEOUT_MS / 1000) + ' ثانیه جوابی نیامد')
    throw err
  } finally {
    clearTimeout(timer)
  }
  const choice = Array.isArray(json.choices) ? json.choices[0] : null
  const content = choice && choice.message && typeof choice.message.content === 'string' ? choice.message.content : ''
  const usage = json.usage && typeof json.usage === 'object' ? json.usage : {}
  const realCost = typeof usage.cost === 'number' ? usage.cost : null
  if (content.trim() === '') {
    const finish = choice ? String(choice.finish_reason || choice.native_finish_reason || '') : ''
    const reasoningTokens = usage.completion_tokens_details && Number.isFinite(usage.completion_tokens_details.reasoning_tokens)
      ? usage.completion_tokens_details.reasoning_tokens : null
    const err = new Error(finish === 'length'
      ? 'جوابِ مدل خالی آمد: سقفِ خروجی (' + faInt(RUN_MAX_TOKENS) + ' توکن) پیش از جواب، صرفِ «فکر کردن» شد'
        + (reasoningTokens !== null ? ' (' + faInt(reasoningTokens) + ' توکنِ فکر)' : '')
      : 'جوابِ مدل خالی آمد' + (finish ? ' (پایان: ' + finish + ')' : ''))
    err.cost = realCost
    throw err
  }
  return { json, content, usage, realCost, formatOk: followsFormat(content), messages }
}

/** یک اجرای در جریان به ازای هر سشن. */
export const inFlight = new Map()

/**
 * یک اجرای کامل: خواندن، انتخابِ سرور، ساختنِ ورودی، تماس، ثبتِ خرج.
 * @param sessionId - شناسهٔ سشن.
 * @param options - { play, origin, fetchImpl, key, now }
 * @returns نتیجهٔ آماده برای ذخیره.
 */
export async function runOnce(sessionId, options = {}) {
  const opt = options && typeof options === 'object' ? options : {}
  const fetchImpl = opt.fetchImpl || fetch
  const now = typeof opt.now === 'number' ? opt.now : Date.now()
  const db = readDb()
  const record = sessionRecord(db, sessionId) || {}

  const key = opt.key !== undefined ? opt.key : readKey()
  if (!key) throw new Error('کلیدِ OPENROUTER_API_KEY پیدا نشد (نه در env، نه در ~/.dsh/.env)')

  const rows = Array.isArray(opt.rows) ? opt.rows : await sessionRows(sessionId)
  if (!rows) throw new Error('لاگِ این چت پیدا نشد')

  const play = Boolean(opt.play)
  const mode = SERVER_MODES.includes(record.serverMode) ? record.serverMode : 'auto'
  const ranking = await fetchRanking(opt.origin || 'http://127.0.0.1:1', play ? 'with' : 'none', fetchImpl)
  const serverChoice = chooseServer({ mode, play, ranked: ranking, previous: record.server || null })

  const cost = await chatCostOf(sessionId)
  const header = chatHeaderInfo(rows)
  const settingsWithHeader = settingsSnapshot()
    + '\n\n### مدل و ابزارهای همین چت (از آخرین request/header)'
    + '\n' + (header
      ? '- مدل: ' + header.model + ' · ارائه‌دهنده: ' + header.provider
        + (header.reasoningEffort ? ' · درجهٔ فکری: ' + header.reasoningEffort : '')
        + (header.cacheRetention ? ' · کش: ' + header.cacheRetention : '')
        + '\n- ابزارها (' + faInt(header.tools.length) + '): ' + header.tools.join(', ')
      : '(header پیدا نشد)')

  const chatCost = {
    chatTotal: cost.total,
    chatPriced: cost.priced,
    chatPending: cost.pending,
    advisorTotal: record.advisorCost || 0,
    advisorRuns: record.advisorRuns || 0,
  }
  const inputFor = async (srv) => buildAdvisorInput({
    settingsText: settingsWithHeader,
    rows,
    play,
    chatCost,
    overheadTokens: estimateTokens(SYSTEM_PROMPT) + 1200,
    contextLimit: await contextLimit(fetchImpl, srv),
  })

  let server = serverChoice
  let input = await inputFor(server)
  // چتِ بزرگ ⇒ مستقیم سرورِ مطمئن (مدرک: ۱۵ نوامبر، چتِ ۹۲۵ هزار توکنی: بایدو ۳ بار از ۳ خالی/بیرون از قالب، سیل‌ریسرچ تایم‌اوت، دیپ‌اینفرا درست).
  if (server.source === 'hunter' && !isFallbackServer(server) && input.transcriptTokens + input.tailTokens > BIG_INPUT_TOKENS) {
    server = fallbackServer(server.cache, 'چتِ بزرگ (بیش از ' + faInt(BIG_INPUT_TOKENS) + ' توکن): سرورهای ارزان‌تر روی چتِ این‌قدر بزرگ جوابِ درست نداده‌اند؛ رفت سراغِ دیپ‌اینفرا.')
    input = await inputFor(server)
  }

  const failedAttempts = []
  let call
  try {
    call = await callModel({ server, input, key, fetchImpl })
    if (!call.formatOk && !isFallbackServer(server)) {
      const err = new Error('جوابِ این سرور از قالب بیرون زد')
      err.cost = call.realCost
      throw err
    }
  } catch (err) {
    if (isFallbackServer(server)) throw err
    // یک بار، فقط یک بار، با سرورِ مطمئن. خرجِ تلاشِ ناموفق هم ثبت می‌شود.
    failedAttempts.push({ label: describeServer(server), error: String(err && err.message ? err.message : err), cost: err && typeof err.cost === 'number' ? err.cost : null })
    server = fallbackServer(server.cache, 'سرورِ اول جوابِ درست نداد (' + failedAttempts[0].error + ')؛ یک بار با دیپ‌اینفرا دوباره رفت.')
    input = await inputFor(server)
    try {
      call = await callModel({ server, input, key, fetchImpl })
    } catch (err2) {
      const failed = failedAttempts.reduce((sum, a) => sum + (a.cost || 0), 0)
      if (typeof err2.cost === 'number' || failed > 0) err2.cost = (typeof err2.cost === 'number' ? err2.cost : 0) + failed
      err2.message = err2.message + ' — پیش از آن: ' + failedAttempts[0].label + ': ' + failedAttempts[0].error
      throw err2
    }
  }

  const { json, content, usage, realCost, formatOk, messages } = call
  const failedCost = failedAttempts.reduce((sum, a) => sum + (a.cost || 0), 0)
  const promptTokens = Number.isFinite(usage.prompt_tokens) ? usage.prompt_tokens : estimateTokens(messages.map((m) => m.content).join(''))
  const completionTokens = Number.isFinite(usage.completion_tokens) ? usage.completion_tokens : estimateTokens(content)
  const cachedTokens = usage.prompt_tokens_details && Number.isFinite(usage.prompt_tokens_details.cached_tokens)
    ? usage.prompt_tokens_details.cached_tokens : 0
  const limit = await contextLimit(fetchImpl, server)

  const firstLine = content.split('\n').find((line) => line.trim() !== '')
  // مدل اگر از نقش بیرون زد (مثلاً خودش چت را ادامه داد) پنهان نمی‌شود: سرصفحه صریح می‌گوید.
  const cleanHeadline = formatOk ? headline(firstLine, 'تغییری لازم نیست') : '⚠ جوابِ دستیار از قالب بیرون زد — به آن اعتماد نکن'

  return {
    at: now,
    play,
    sessionId,
    headline: cleanHeadline,
    content,
    model: json.model || server.model,
    server: {
      model: server.model,
      provider: server.provider,
      providerSlug: server.providerSlug,
      cache: server.cache,
      source: server.source,
      note: server.note,
    },
    serverLabel: describeServer(server),
    verdict: !formatOk ? 'off-format' : /تغییری لازم نیست/.test(cleanHeadline) ? 'nothing' : 'advice',
    failedAttempts,
    failedCost: failedCost > 0 ? Math.round(failedCost * 1e6) / 1e6 : 0,
    usage: { promptTokens, completionTokens, cachedTokens, totalTokens: promptTokens + completionTokens },
    cost: realCost,
    unread: { dropped: input.dropped, totalRows: input.totalRows, keptRows: input.keptRows, note: input.note },
    flaggedCount: input.flagged.length,
    transcriptTokens: input.transcriptTokens,
    tailTokens: input.tailTokens,
    contextLimit: limit,
    inputChars: input.text.length,
  }
}

/**
 * اجرا + ثبت در فایل.
 * @param sessionId - شناسهٔ سشن.
 * @param options - { play, origin, turnSeq }
 */
export async function executeRun(sessionId, options) {
  const opt = options || {}
  const startedAt = Date.now()
  try {
    // rows/fetchImpl/key فقط دستهٔ آزمون‌اند (آزمون بی لاگِ واقعی و بی تماسِ واقعی)؛ در اپ هیچ‌کدام نمی‌آید.
    const result = await runOnce(sessionId, {
      play: Boolean(opt.play), origin: opt.origin,
      rows: opt.rows, fetchImpl: opt.fetchImpl, key: opt.key,
    })
    const db = readDb()
    if (!db.sessions[sessionId]) db.sessions[sessionId] = {}
    const record = db.sessions[sessionId]
    record.lastResult = result
    record.lastRunAt = result.at
    record.lastError = null
    record.server = result.server
    record.advisorCost = Math.round(((record.advisorCost || 0) + (result.cost || 0) + (result.failedCost || 0)) * 1e6) / 1e6
    if (result.failedCost) record.advisorFailedCost = Math.round(((record.advisorFailedCost || 0) + result.failedCost) * 1e6) / 1e6
    record.advisorRuns = (record.advisorRuns || 0) + 1
    const runs = Array.isArray(record.runs) ? record.runs : []
    runs.push(result.at)
    record.runs = runs.filter((t) => result.at - t < 24 * 3600 * 1000)
    // اجرای موفق یعنی علتِ ردِ قبلی («سقف پر است») دیگر راست نیست؛ وگرنه برای همیشه می‌ماند.
    record.playSkipReason = null
    record.playSkippedAt = null
    if (opt.turnSeq !== undefined && opt.turnSeq !== null) record.lastKey = dedupeKey(sessionId, opt.turnSeq)
    writeDb(db)
    return result
  } catch (err) {
    const db = readDb()
    if (!db.sessions[sessionId]) db.sessions[sessionId] = {}
    const record = db.sessions[sessionId]
    record.lastError = String(err && err.message ? err.message : err)
    record.lastErrorAt = startedAt
    // اجرای ناموفق هم ممکن است پول گرفته باشد (مثلاً جوابِ خالی) ⇒ در خرجِ تجمیعی بیاید.
    if (err && typeof err.cost === 'number' && err.cost > 0) {
      record.advisorCost = Math.round(((record.advisorCost || 0) + err.cost) * 1e6) / 1e6
      record.advisorFailedCost = Math.round(((record.advisorFailedCost || 0) + err.cost) * 1e6) / 1e6
    }
    const runs = Array.isArray(record.runs) ? record.runs : []
    runs.push(startedAt)
    record.runs = runs.filter((t) => startedAt - t < 24 * 3600 * 1000)
    if (opt.turnSeq !== undefined && opt.turnSeq !== null) record.lastKey = dedupeKey(sessionId, opt.turnSeq)
    writeDb(db)
    throw err
  } finally {
    inFlight.delete(sessionId)
  }
}


/* ------------------------------------------------------------------ تریگرِ پلی */

/**
 * «پایانِ پاسخِ ایجنت» = رخدادِ turn/end در فیدِ session/event.
 * مدرک: dsh/docs/subsystems/session.md:1406-1427 (session/event، پس از commit، fire-and-forget)
 * و استفادهٔ واقعیِ خودِ اپ: dsh-session-persistence-jsonl/lib/index.js:422 —
 *   yield ctx.on("session/event", (session, event) => { … })
 * شکلِ رخداد: SessionEvent { type, seq, time, data }  (dsh-session/src/types.ts:508-531)
 */
export function createPlayTrigger(deps) {
  const d = deps && typeof deps === 'object' ? deps : {}
  const timers = new Map()
  // هر رد، در فایلِ پلی نوشته می‌شود؛ وگرنه پلی در سکوت می‌مرد و کاربر فقط نمی‌فهمید چرا.
  const note = (sessionId, reason) => {
    try { if (typeof d.onSkip === 'function') d.onSkip(sessionId, reason) } catch { /* یادداشت هم نباید چیزی را بشکند */ }
  }
  return {
    /** یک رخدادِ لاگ آمد. */
    onSessionEvent(sessionId, event) {
      if (!event || event.type !== 'turn/end') return false
      const db = readDb()
      const record = sessionRecord(db, sessionId)
      if (!record || record.play !== true) return false
      const turnSeq = typeof event.seq === 'number' ? event.seq : null
      if (turnSeq === null) return false
      const decision = shouldRunOnTurnEnd({
        play: true,
        running: inFlight.has(sessionId),
        sessionId,
        turnSeq,
        lastKey: record.lastKey || null,
        runs: Array.isArray(record.runs) ? record.runs : [],
        now: Date.now(),
      })
      if (!decision.run) {
        // «قبلاً بررسی شد» و «یکی در جریان است» طبیعی است؛ سقف و خطای قبلی باید گفته شوند.
        if (decision.reason && decision.reason !== 'این نوبت قبلاً بررسی شد' && decision.reason !== 'یک اجرا در جریان است') {
          note(sessionId, decision.reason)
        }
        return false
      }
      // لرزش‌گیرِ ۴۵ ثانیه‌ای: چند turn/endِ پشتِ‌سرِهم فقط یک اجرا.
      const previous = timers.get(sessionId)
      if (previous) clearTimeout(previous)
      const handle = setTimeout(() => {
        timers.delete(sessionId)
        Promise.resolve().then(() => (d.fire ? d.fire(sessionId, turnSeq) : undefined)).catch(() => {})
      }, typeof d.debounceMs === 'number' ? d.debounceMs : DEBOUNCE_MS)
      if (handle && typeof handle.unref === 'function') handle.unref()
      timers.set(sessionId, handle)
      return true
    },
    /** چند تایمرِ منتظر. */
    pending() {
      return timers.size
    },
    dispose() {
      for (const handle of timers.values()) clearTimeout(handle)
      timers.clear()
    },
  }
}

/** اجرای پلی پس از لرزش‌گیر (دوباره سنجیده می‌شود). */
/** نشانیِ سرورِ اپ که از درخواست‌های کلاینت یاد گرفته می‌شود (رویدادِ session/event نشانی ندارد). */
let knownOrigin = null

/** از Host ِ درخواست نشانیِ سرورِ محلی را یاد بگیر. */
function learnOrigin(req) {
  const host = req && req.headers && typeof req.headers.host === 'string' ? req.headers.host : ''
  if (/^(127\.\d+\.\d+\.\d+|localhost|\[::1\])(:\d+)?$/i.test(host)) knownOrigin = 'http://' + host
}

/** یادداشتِ «پلی اجرا نکرد و چرا» در فایلِ پلی؛ خودِ یادداشت هرگز اجرا را نمی‌شکند. */
export function recordPlaySkip(sessionId, reason) {
  if (typeof sessionId !== 'string' || sessionId === '' || !reason) return
  try {
    const db = readDb()
    const record = sessionRecord(db, sessionId)
    if (!record) return
    record.playSkippedAt = Date.now()
    record.playSkipReason = String(reason)
    writeDb(db)
  } catch { /* فقط یادداشت است */ }
}

/**
 * «پلی روشن است ولی بعد از روشن‌شدن هیچ کاری نکرد» — با علتِ دقیق و ساعتِ «کی دوباره».
 * مدرکِ کاربری: حبیب پلی را روشن می‌گذاشت و هر اجرا تا سقفِ ۶‌تایی می‌سوخت و بقیه بی‌صدا رد می‌شد
 * («این دکمه پلی که یه دفعه دستیار رو ران میکنه ارور میده هی»).
 * @returns null وقتی پلی کاری برای گفتن ندارد؛ وگرنه { kind, reason, retryAt, lastError }
 */
export async function playIdleNote(sessionId, record, quota) {
  const rec = record && typeof record === 'object' ? record : {}
  if (rec.play !== true) return null
  const q = quota && typeof quota === 'object' ? quota : quotaState(Array.isArray(rec.runs) ? rec.runs : [], Date.now())
  if (q.blocked) return { kind: 'quota', reason: q.reason, retryAt: q.retryAt, lastError: rec.lastError || null }
  // خطای اجرای قبلی که هیچ اجرای موفقِ بعدی آن را پاک نکرده.
  const lastErrorAt = typeof rec.lastErrorAt === 'number' ? rec.lastErrorAt : 0
  const lastRunAt = typeof rec.lastRunAt === 'number' ? rec.lastRunAt : 0
  if (rec.lastError && lastErrorAt > lastRunAt) {
    return { kind: 'error', reason: 'آخرین اجرا خطا داد: ' + rec.lastError, retryAt: null, lastError: rec.lastError }
  }
  if (rec.playSkipReason) {
    return { kind: 'skipped', reason: rec.playSkipReason, retryAt: q.retryAt, lastError: null }
  }
  // نوبتی بعد از روشن‌شدن تمام شد و هیچ اجرایی از پلی نیامد.
  if (typeof rec.playWatchAt === 'number' && (rec.lastRunAt || 0) < rec.playWatchAt) {
    let latest = null
    try { latest = lastTurnEndSeq(await sessionRows(sessionId)) } catch { latest = null }
    const base = typeof rec.playWatchTurn === 'number' ? rec.playWatchTurn : null
    if (latest !== null && base !== null && latest > base) {
      return { kind: 'idle', reason: 'پلی روشن است و از وقتی روشن شد ' + faInt(latest - base) + ' نوبتِ تازه گذشت، ولی هیچ اجرایی نکرد — یک بار سهمیهٔ اجرا و پیامِ خطایش را ببین.', retryAt: q.retryAt, lastError: rec.lastError || null }
    }
  }
  return null
}

export async function schedulePlayRun(sessionId, turnSeq) {
  if (inFlight.has(sessionId)) return null
  const db = readDb()
  const record = sessionRecord(db, sessionId)
  if (!record || record.play !== true) return null
  const decision = shouldRunOnTurnEnd({
    play: true,
    running: inFlight.has(sessionId),
    sessionId,
    turnSeq,
    lastKey: record.lastKey || null,
    runs: Array.isArray(record.runs) ? record.runs : [],
    now: Date.now(),
  })
  if (!decision.run) {
    if (decision.reason && decision.reason !== 'این نوبت قبلاً بررسی شد' && decision.reason !== 'یک اجرا در جریان است') {
      recordPlaySkip(sessionId, decision.reason)
    }
    return null
  }
  inFlight.set(sessionId, true)
  try {
    // نشانیِ سرورِ اپ از آخرین درخواستِ کلاینت (برای رتبه‌بندیِ شکارچیِ مدل)؛ بی آن به پریستِ DeepInfra برمی‌گردد.
    return await executeRun(sessionId, { play: true, origin: knownOrigin, turnSeq })
  } catch {
    return null
  } finally {
    inFlight.delete(sessionId)
  }
}


/* ------------------------------------------------------------------ ثبتِ مسیرها */

/**
 * ثبتِ مسیرهای HTTP و شنوندهٔ تریگرِ پلی.
 * @param ctx - Cordis context.
 */
export function apply(ctx) {
  // تریگرِ پلی روی فیدِ خودِ اپ (نه روی کلاینت): پلی حتی وقتی تبِ چت بسته است هم کار می‌کند.
  try {
    ctx.effect(() => {
      const trigger = createPlayTrigger({
        fire: (sessionId, turnSeq) => schedulePlayRun(sessionId, turnSeq),
        onSkip: (sessionId, reason) => recordPlaySkip(sessionId, reason),
      })
      const off = ctx.on('session/event', (session, event) => {
        try {
          const id = session && (session.id || session.sessionId)
          if (typeof id === 'string' && id !== '') trigger.onSessionEvent(id, event)
        } catch { /* شنوندهٔ خراب نباید چیزی را بشکند */ }
      })
      return () => {
        try { if (typeof off === 'function') off() } catch { /* ignore */ }
        trigger.dispose()
      }
    }, 'advisor: play trigger')
  } catch (err) {
    ctx.logger?.warn?.('advisor: play trigger ثبت نشد: ' + err)
  }

  ctx.inject(['webServer'], (web) => {
    const server = web.webServer

    web.effect(() => server.register({
      kind: 'exact',
      path: '/plugins/advisor/state',
      handler: async (req, res) => {
        res.setHeader('content-type', 'application/json; charset=utf-8')
        res.setHeader('cache-control', 'no-store')
        if (refuse(req, res)) return
        learnOrigin(req)
        try {
          const url = new URL(req.url, 'http://localhost')
          const sessionId = url.searchParams.get('sessionId') || ''
          const db = readDb()
          const record = sessionRecord(db, sessionId) || {}
          const cost = sessionId ? await chatCostOf(sessionId) : { found: false }
          const quota = quotaState(Array.isArray(record.runs) ? record.runs : [], Date.now())
          const nextPlayNote = await playIdleNote(sessionId, record, quota)
          res.end(JSON.stringify({
            sessionId,
            play: record.play === true,
            running: inFlight.has(sessionId),
            lastResult: record.lastResult || null,
            lastRunAt: record.lastRunAt || null,
            lastError: record.lastError || null,
            lastErrorAt: record.lastErrorAt || null,
            quota,
            playSkippedAt: record.playSkippedAt || null,
            playSkipReason: record.playSkipReason || null,
            // «پلی روشن است اما کاری نکرده» — با شمارهٔ نوبتی که در زمانِ روشن‌شدن بود.
            playIdle: record.play === true && !inFlight.has(sessionId) && nextPlayNote,
            serverMode: SERVER_MODES.includes(record.serverMode) ? record.serverMode : 'auto',
            server: record.server || null,
            cost: {
              advisorTotal: record.advisorCost || 0,
              advisorRuns: record.advisorRuns || 0,
              advisorFailedCost: record.advisorFailedCost || 0,
              chatTotal: cost.total || 0,
              chatPriced: cost.priced || 0,
              chatPending: cost.pending || 0,
              chatFound: Boolean(cost.found),
              sum: (cost.total || 0) + (record.advisorCost || 0),
            },
          }))
        } catch (err) {
          res.statusCode = 500
          res.end(JSON.stringify({ error: String(err && err.message ? err.message : err) }))
        }
      },
    }))

    web.effect(() => server.register({
      kind: 'exact',
      path: '/plugins/advisor/run',
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
        if (!/^application\/json\b/i.test(String((req.headers && req.headers['content-type']) || ''))) {
          res.statusCode = 415
          res.end(JSON.stringify({ error: 'فقط application/json' }))
          return
        }
        const body = await readJsonBody(req)
        const sessionId = typeof body.sessionId === 'string' ? body.sessionId : ''
        if (sessionId === '') { res.statusCode = 400; res.end(JSON.stringify({ error: 'sessionId لازم است' })); return }
        if (inFlight.has(sessionId)) { res.statusCode = 409; res.end(JSON.stringify({ error: 'busy', message: 'یک اجرا برای همین چت در جریان است' })); return }
        // اجرای دستی سقف ندارد: حبیب خودش زده. سقفِ ساعتی/روزانه فقط برای پلی است.
        const origin = 'http://' + ((req.headers && req.headers.host) || '127.0.0.1')
        inFlight.set(sessionId, true)
        res.statusCode = 202
        res.end(JSON.stringify({ accepted: true }))
        void executeRun(sessionId, { play: false, origin }).catch(() => {})
      },
    }))

    web.effect(() => server.register({
      kind: 'exact',
      path: '/plugins/advisor/play',
      handler: async (req, res) => {
        res.setHeader('content-type', 'application/json; charset=utf-8')
        res.setHeader('cache-control', 'no-store')
        if (req.method !== 'POST') { res.statusCode = 405; res.setHeader('allow', 'POST'); res.end(JSON.stringify({ error: 'فقط POST' })); return }
        if (refuse(req, res)) return
        learnOrigin(req)
        if (!/^application\/json\b/i.test(String((req.headers && req.headers['content-type']) || ''))) {
          res.statusCode = 415
          res.end(JSON.stringify({ error: 'فقط application/json' }))
          return
        }
        const body = await readJsonBody(req)
        const sessionId = typeof body.sessionId === 'string' ? body.sessionId : ''
        if (sessionId === '') { res.statusCode = 400; res.end(JSON.stringify({ error: 'sessionId لازم است' })); return }
        const db = readDb()
        if (!db.sessions[sessionId]) db.sessions[sessionId] = {}
        const record = db.sessions[sessionId]
        const wantOn = body.on === true
        // روشن‌کردنِ پلی وقتی سقف پر است = پلی‌ای که بی‌صدا هیچ کاری نمی‌کند و فقط به حبیب «ارور» می‌داد.
        // پس همان‌جا با ساعتِ دقیقِ «کی دوباره» رد می‌شود و چیزی روشن نمی‌ماند.
        const quota = quotaState(Array.isArray(record.runs) ? record.runs : [], Date.now())
        if (wantOn && quota.blocked) {
          res.statusCode = 429
          res.setHeader('retry-after', String(Math.ceil(quota.resetInMs / 1000)))
          res.end(JSON.stringify({ error: quota.reason, message: quota.reason, quota, retryAt: quota.retryAt, play: record.play === true }))
          return
        }
        record.play = wantOn
        record.playWatchTurn = null
        record.playWatchAt = null
        // کاربر خودش پلی را عوض کرد ⇒ علتِ ردِ قبلی کهنه است و نباید پنل را قرمز نگه دارد.
        record.playSkipReason = null
        record.playSkippedAt = null
        if (wantOn) {
          // برای پیامِ «پلی روشن است اما فایده‌ای ندارد»: شمارهٔ آخرین نوبتِ همین چت.
          try {
            const rows = await sessionRows(sessionId)
            record.playWatchTurn = lastTurnEndSeq(rows)
          } catch { record.playWatchTurn = null }
          record.playWatchAt = Date.now()
        }
        writeDb(db)
        res.end(JSON.stringify({ ok: true, play: record.play, quota }))
      },
    }))

    web.effect(() => server.register({
      kind: 'exact',
      path: '/plugins/advisor/server',
      handler: async (req, res) => {
        res.setHeader('content-type', 'application/json; charset=utf-8')
        res.setHeader('cache-control', 'no-store')
        if (req.method !== 'POST') { res.statusCode = 405; res.setHeader('allow', 'POST'); res.end(JSON.stringify({ error: 'فقط POST' })); return }
        if (refuse(req, res)) return
        if (!/^application\/json\b/i.test(String((req.headers && req.headers['content-type']) || ''))) {
          res.statusCode = 415
          res.end(JSON.stringify({ error: 'فقط application/json' }))
          return
        }
        const body = await readJsonBody(req)
        const sessionId = typeof body.sessionId === 'string' ? body.sessionId : ''
        if (sessionId === '') { res.statusCode = 400; res.end(JSON.stringify({ error: 'sessionId لازم است' })); return }
        if (!SERVER_MODES.includes(body.mode)) { res.statusCode = 400; res.end(JSON.stringify({ error: 'mode نامعلوم' })); return }
        const db = readDb()
        if (!db.sessions[sessionId]) db.sessions[sessionId] = {}
        db.sessions[sessionId].serverMode = body.mode
        // کاربر خودش تنظیم را عوض کرد ⇒ سرورِ قبلی دیگر پین نمی‌شود.
        db.sessions[sessionId].server = null
        writeDb(db)
        res.end(JSON.stringify({ ok: true, mode: body.mode }))
      },
    }))
  })
}

