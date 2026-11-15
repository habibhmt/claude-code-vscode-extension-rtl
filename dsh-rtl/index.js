/**
 * Host half of the RTL bundle.
 * ----------------------------
 * نیمهٔ کلاینتِ dsh-rtl تنظیم‌هایش را در localStorage نگه می‌داشت (فقط همین مرورگر).
 * حالا سه سطح دارد و هر سطح یک پروندهٔ واقعی است:
 *
 *   سراسری  ~/.dsh/dsh-rtl/settings.json
 *   پروژه   <پوشهٔ کار>/.dsh-rtl.json
 *   چت      ~/.dsh/dsh-rtl/chats/<sessionId>.json
 *
 * مقدارِ مؤثر = چت ?? پروژه ?? سراسری ?? پیش‌فرض (محاسبه‌اش در کلاینت است).
 *
 * مسیرها (همه زیرِ /plugins/rtl/settings):
 *   GET  …?sessionId=…&cwd=…   ⇒ { ok, global, project, chat, levels, files }
 *   POST …  { sessionId, cwd, level, patch }  ⇒ همان شکلِ GET
 *
 * قواعدِ امنیتی (همان الگوی dsh-side-panel):
 *   - Host باید loopback باشد، درخواستِ cross-site رد، Origin یا همان Host یا dsh-app:.
 *   - sessionId با الگوی امن، cwd باید پوشهٔ موجود و مطلق باشد (اینجا با stat سنجیده می‌شود).
 *   - مقدارها با همین readPlus تمیز می‌شوند؛ کلیدِ ناشناخته رد می‌شود.
 *   - نوشتن اتمیک: پروندهٔ موقت + rename.
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { readPlus, PLUS_DEFAULTS } from './plus-pure.js'
import { cleanFile, isSafeId, unsafeWorkspace, validatePref } from './settings-pure.js'

export const name = '@local/dsh-rtl'
export const inject = []

/** تنظیم‌های خودِ dsh-rtl (کلیدهایی که در صفحهٔ راست‌به‌چپ سوییچ دارند). */
const PREFS_DEFAULTS = { rtl: true, font: true, code: true, plaintext: true, soalPahn: true, chatFit: true }

/** همهٔ کلیدهای مجاز (booleans + میدان‌های aA/plus). */
const PREF_KEYS = Object.keys(PREFS_DEFAULTS).concat(Object.keys(PLUS_DEFAULTS))

/** کلیدهایی که ساختارِ سنگین دارند و در پروندهٔ سه‌سطحی ذخیره نمی‌شوند. */
const HEAVY_KEYS = new Set(['commands', 'extras', 'profiles'])

/** سقفِ بدنهٔ POST. */
const BODY_MAX = 64 * 1024

const LOOPBACK = /^(127\.\d+\.\d+\.\d+|localhost|\[::1\])(:\d+)?$/i

/**
 * سدِ کمینه برای مسیرهای این افزونه (کپیِ همان سدِ dsh-side-panel).
 * سرورِ وبِ DSH احرازِ هویتِ سراسری ندارد؛ بی این سد هر صفحهٔ وبِ دیگری در مرورگر
 * می‌توانست تنظیم‌ها را بخواند یا عوض کند.
 * @param req درخواستِ Node.
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

/** اگر رد شد، ۴۰۳ می‌نویسد و true برمی‌گرداند. */
function refuse(req, res) {
  const reason = rejectReason(req)
  if (reason === null) return false
  res.statusCode = 403
  res.end(JSON.stringify({ error: 'forbidden: ' + reason }))
  return true
}

/** بدنهٔ JSON یک POST را با سقفِ BODY_MAX می‌خواند. */
function readJsonBody(req) {
  return new Promise((resolve) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > BODY_MAX) { resolve({}); req.destroy(); return }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (chunks.length === 0) { resolve({}); return }
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))) } catch { resolve({}) }
    })
    req.on('error', () => resolve({}))
  })
}

/* ---------- جاهای پرونده ---------- */

/**
 * ریشهٔ پرونده‌های این افزونه.
 * @param home پوشهٔ خانه (در آزمون جابه‌جا می‌شود).
 * @returns پوشهٔ ~/.dsh/dsh-rtl
 */
export function rtlHome(home) {
  const base = typeof home === 'string' && home ? home : os.homedir()
  return path.join(base, '.dsh', 'dsh-rtl')
}

/** مسیرِ پروندهٔ سراسری. */
export function globalFile(home) { return path.join(rtlHome(home), 'settings.json') }

/** مسیرِ پروندهٔ یک چت. */
export function chatFile(home, sessionId) { return path.join(rtlHome(home), 'chats', sessionId + '.json') }

/** مسیرِ پروندهٔ پروژه. */
export function projectFile(cwd) { return path.join(cwd, '.dsh-rtl.json') }

/* ---------- خواندن/نوشتن ---------- */

/**
 * یک پروندهٔ JSON را می‌خواند؛ نبودِ پرونده یا JSON ِ خراب ⇒ {} و بی‌خطا.
 * @param file مسیرِ مطلق.
 * @returns شیءِ تمیز از کلیدهای مجاز.
 */
export function readFileJson(file) {
  let raw
  try { raw = fs.readFileSync(file, 'utf8') } catch (err) { return {} }
  try { raw = JSON.parse(raw) } catch (err) { return {} }
  return cleanFile(raw, PREF_KEYS)
}

/**
 * نوشتنِ اتمیک: پروندهٔ موقت در همان پوشه، بعد rename. اگر نوشتن نشد، پروندهٔ موقت پاک می‌شود.
 * @param file مسیرِ مقصد.
 * @param value شیءِ قابلِ JSON.
 */
export function writeFileAtomic(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const tmp = file + '.' + process.pid + '.' + Date.now().toString(36) + '.tmp'
  try {
    fs.writeFileSync(tmp, JSON.stringify(value, null, 2) + '\n', 'utf8')
    fs.renameSync(tmp, file)
  } catch (err) {
    try { fs.rmSync(tmp, { force: true }) } catch (ignored) { /* پاک‌شدن هم نشد */ }
    throw err
  }
}

/**
 * آیا این مسیر پرونده از قبل هست؟
 * @param file مسیرِ مطلق.
 * @returns boolean
 */
export function fileExists(file) {
  try { return fs.statSync(file).isFile() } catch (err) { return false }
}

/**
 * پوشهٔ کار را می‌سنجد: مطلق، مجاز و «واقعاً پوشهٔ موجود».
 * @param cwd مسیرِ پیشنهادی (از کلاینت).
 * @param home پوشهٔ خانه.
 * @returns { ok: true, cwd } یا { ok: false, reason }
 */
export function checkWorkspace(cwd, home) {
  if (typeof cwd !== 'string' || cwd === '') return { ok: false, reason: 'مسیرِ پوشه نیامد' }
  const bad = unsafeWorkspace(cwd, typeof home === 'string' && home ? home : os.homedir())
  if (bad) return { ok: false, reason: bad }
  let stat
  try { stat = fs.statSync(cwd) } catch (err) { return { ok: false, reason: 'پوشه پیدا نشد' } }
  if (!stat.isDirectory()) return { ok: false, reason: 'مسیر پوشه نیست' }
  return { ok: true, cwd }
}

/**
 * همهٔ لایه‌ها را می‌خواند.
 * @param opts { home, sessionId, cwd }
 * @returns {{ global, project, chat, levels, files }}
 */
export function loadLevels(opts) {
  const home = opts && opts.home
  const sessionId = opts && opts.sessionId
  const workspace = checkWorkspace(opts && opts.cwd, home)
  const chatOk = isSafeId(sessionId)
  const global = readFileJson(globalFile(home))
  const project = workspace.ok ? readFileJson(projectFile(workspace.cwd)) : {}
  const chat = chatOk ? readFileJson(chatFile(home, sessionId)) : {}
  return {
    global,
    project,
    chat,
    levels: {
      global: { file: globalFile(home), ok: true },
      project: { file: workspace.ok ? projectFile(workspace.cwd) : null, ok: workspace.ok, reason: workspace.ok ? null : workspace.reason },
      chat: { file: chatOk ? chatFile(home, sessionId) : null, ok: chatOk, reason: chatOk ? null : 'شناسهٔ چت نیامد یا ناامن است' },
    },
    files: { global: globalFile(home), project: workspace.ok ? projectFile(workspace.cwd) : null, chat: chatOk ? chatFile(home, sessionId) : null },
  }
}

/**
 * مقدارها را در یک سطح می‌نویسد و کلیدهای unset را از همان سطح پاک می‌کند.
 * (undefined در JSON جایی ندارد، پس پاک‌کردن با فهرستِ unset گفته می‌شود.)
 * @param opts { home, sessionId, cwd, level, patch, unset }
 * @returns { ok: true, after: {...} } یا { ok: false, error, status }
 */
export function saveLevel(opts) {
  const home = opts && opts.home
  const level = opts && opts.level
  const patch = opts && opts.patch
  const unset = Array.isArray(opts && opts.unset) ? opts.unset : []
  if (!['global', 'project', 'chat'].includes(level)) return { ok: false, status: 400, error: 'سطحِ نامعلوم: ' + String(level) }
  if (patch === null || typeof patch !== 'object' || Array.isArray(patch)) return { ok: false, status: 400, error: 'مقدارها باید یک شیء باشند' }
  const keys = Object.keys(patch)
  if (keys.length === 0 && unset.length === 0) return { ok: false, status: 400, error: 'هیچ مقداری نیامد' }
  if (keys.length > 40 || unset.length > 40) return { ok: false, status: 400, error: 'مقدارها زیادند' }

  const cleaned = {}
  let storable = 0
  for (const key of keys) {
    if (HEAVY_KEYS.has(key)) continue
    if (!PREF_KEYS.includes(key)) return { ok: false, status: 400, error: 'کلیدِ ناشناخته: ' + key }
    const checked = validatePref(key, patch[key], { readPlus, prefs: PREFS_DEFAULTS })
    if (!checked.ok) return { ok: false, status: 400, error: checked.error }
    storable += 1
    cleaned[key] = checked.value
  }
  for (const key of unset) {
    if (typeof key !== 'string' || !PREF_KEYS.includes(key)) return { ok: false, status: 400, error: 'کلیدِ ناشناخته: ' + String(key) }
    storable += 1
    delete cleaned[key]
  }
  if (storable === 0) return { ok: false, status: 400, error: 'این کلیدها در پرونده ذخیره نمی‌شوند' }

  let file
  if (level === 'global') file = globalFile(home)
  else if (level === 'chat') {
    if (!isSafeId(opts.sessionId)) return { ok: false, status: 400, error: 'شناسهٔ چت ناامن است' }
    file = chatFile(home, opts.sessionId)
  } else {
    const workspace = checkWorkspace(opts.cwd, home)
    if (!workspace.ok) return { ok: false, status: 400, error: workspace.reason }
    file = projectFile(workspace.cwd)
  }

  // کل پرونده را می‌خوانیم و فقط این چند کلید را عوض می‌کنیم (بقیهٔ مقدارهای همان سطح بمانند).
  const current = readFileJson(file)
  const merged = { ...current, ...cleaned }
  for (const key of unset) delete merged[key]
  for (const key of Object.keys(merged)) if (merged[key] === undefined) delete merged[key]
  try { writeFileAtomic(file, merged) } catch (err) {
    return { ok: false, status: 500, error: 'نوشتنِ پرونده نشد: ' + String(err && err.message ? err.message : err) }
  }
  return { ok: true, after: loadLevels(opts) }
}

/**
 * یک‌بار پروندهٔ سراسری را از مقدارهای localStorage پر می‌کند (مهاجرت).
 * اگر پرونده از قبل هست، دست نمی‌زند.
 * @param opts { home, values } مقدارهای خامِ کلاینت (فقط کلیدهای شناخته‌شده)
 * @returns {{ seeded: boolean, reason?: string }}
 */
export function seedGlobal(opts) {
  const home = opts && opts.home
  const values = opts && opts.values
  const file = globalFile(home)
  if (fileExists(file)) return { seeded: false, reason: 'exists' }
  if (!values || typeof values !== 'object' || Array.isArray(values)) return { seeded: false, reason: 'empty' }
  const clean = cleanFile(values, PREF_KEYS)
  const out = {}
  for (const key of Object.keys(clean)) {
    if (HEAVY_KEYS.has(key)) continue
    if (!PREF_KEYS.includes(key)) continue
    const checked = validatePref(key, clean[key], { readPlus, prefs: PREFS_DEFAULTS })
    if (checked.ok && checked.value !== undefined) out[key] = checked.value
  }
  if (Object.keys(out).length === 0) return { seeded: false, reason: 'empty' }
  try { writeFileAtomic(file, out) } catch (err) { return { seeded: false, reason: String(err && err.message ? err.message : err) } }
  return { seeded: true }
}

/* ---------- مسیرهای HTTP ---------- */

/** پاسخِ JSON یکدست. */
function sendJson(res, status, body) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(JSON.stringify(body))
}

/**
 * اجزای درخواست را از query (GET) یا بدنه (POST) می‌خواند.
 * @param url آدرسِ درخواست.
 * @param body بدنهٔ تجزیه‌شده.
 * @returns { sessionId, cwd, values, level, patch }
 */
function requestParts(url, body) {
  const params = new URL(url || '/', 'http://localhost').searchParams
  const b = body && typeof body === 'object' ? body : {}
  const pick = (name) => (b[name] !== undefined ? b[name] : params.get(name))
  return {
    sessionId: typeof pick('sessionId') === 'string' ? pick('sessionId') : '',
    cwd: typeof pick('cwd') === 'string' ? pick('cwd') : '',
    values: b.values,
    level: b.level,
    patch: b.patch,
    unset: b.unset,
  }
}

/**
 * ثبتِ مسیرهای HTTP و سرویسِ تنظیم‌ها.
 * @param ctx Cordis context.
 */
export function apply(ctx) {
  ctx.inject(['webServer'], (web) => {
    const server = web.webServer
    web.effect(() => server.register({
      kind: 'exact',
      path: '/plugins/rtl/settings',
      handler: async (req, res) => {
        if (refuse(req, res)) return
        const method = String(req.method || 'GET').toUpperCase()
        try {
          if (method === 'GET') {
            const parts = requestParts(req.url, null)
            sendJson(res, 200, { ok: true, ...loadLevels({ sessionId: parts.sessionId, cwd: parts.cwd }) })
            return
          }
          if (method !== 'POST') {
            res.setHeader('allow', 'GET, POST')
            sendJson(res, 405, { error: 'فقط GET و POST' })
            return
          }
          if (!/^application\/json\b/i.test(String((req.headers && req.headers['content-type']) || ''))) {
            sendJson(res, 415, { error: 'فقط application/json' })
            return
          }
          const body = await readJsonBody(req)
          const parts = requestParts(req.url, body)
          const action = typeof body.action === 'string' ? body.action : 'save'
          if (action === 'seed') {
            const result = seedGlobal({ values: parts.values })
            sendJson(res, 200, { ok: true, ...result, ...loadLevels({ sessionId: parts.sessionId, cwd: parts.cwd }) })
            return
          }
          const result = saveLevel({
            sessionId: parts.sessionId, cwd: parts.cwd, level: parts.level, patch: parts.patch, unset: parts.unset,
          })
          if (!result.ok) { sendJson(res, result.status || 400, { ok: false, error: result.error }); return }
          sendJson(res, 200, { ok: true, ...result.after })
        } catch (err) {
          sendJson(res, 500, { ok: false, error: String(err && err.message ? err.message : err) })
        }
      },
    }))
  })
}
