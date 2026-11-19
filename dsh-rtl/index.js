import toolHelp from './tool-help.cjs'
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

import aaShared from './aa-shared.cjs'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { readPlus, PLUS_DEFAULTS } from './plus-pure.js'
import { cleanFile, isSafeId, unsafeWorkspace, validatePref } from './settings-pure.js'
import {
  TIK_KIND, cleanList, effectiveList, deniedTools, applyChanges, buildRows, summarize, isFreshChat, isKind,
} from './tik-pure.js'

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

/** زمانِ ذخیره‌شده می‌تواند عددِ epoch یا رشتهٔ ISO باشد؛ هر دو را به میلی‌ثانیه برگردان. */
const zaman = (v) => {
  const n = Number(v)
  if (Number.isFinite(n)) return n
  const t = Date.parse(v)
  return Number.isFinite(t) ? t : 0
}

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
 * تبِ «ابزارها» — بخشِ هاست.
 * ---------------------------
 * چهار دسته (ابزارِ DSH، MCP، افزونه، اسکیل) و سه سطح (این چت، این پوشه، سراسری).
 * تصمیم در tik-pure.js گرفته می‌شود؛ این‌جا فقط خواندنِ پرونده و اعمالِ تیک است.
 *
 * پرونده: ~/.dsh/dsh-rtl/tik.json
 *   { sarasari: {دسته:{نام:بولین}}, poshe: {مسیر:{…}}, chat: {شناسه:{…}}, kooch: زمانِ ثبت }
 *
 * اعمال به DSH: agent.ctx.tools.restrict({deny}) — همان کاری که خودِ DSH
 * برای ساب‌ایجنت‌ها می‌کند (dsh-subagent/lib/index.js). ابزار از فهرستِ مدل
 * برداشته می‌شود و در هر قدم دوباره سنجیده می‌شود.
 */

/** پروندهٔ تیک‌ها. */
export function tikFile(home) { return path.join(rtlHome(home), 'tik.json') }

/**
 * پوشهٔ پروفایلِ جاری (همان‌جایی که package.json ِ افزونه‌ها می‌نشیند).
 * @returns {string} مسیرِ مطلق.
 */
export function profileDir() {
  const home = os.homedir()
  const name = String(process.env.DSH_PROFILE || 'desktop')
  return path.join(home, '.dsh', 'profiles', name)
}

/**
 * پروندهٔ تیک‌ها را می‌خواند. هر شکلِ خرابی ⇒ فهرستِ خالی (بی‌خطا).
 * @param home پوشهٔ خانه.
 * @returns {{ sarasari, poshe, chat, kooch }}
 */
export function loadTik(home) {
  // خواندنِ خام: readFileJson کلیدها را با فهرستِ مجازِ صفحهٔ تنظیم‌ها صافی می‌کند و
  // کلیدهای سطوحِ تیک را بی‌صدا می‌انداخت (سنجیده شد). این‌جا خودمان می‌خوانیم.
  let raw = null
  try { raw = JSON.parse(fs.readFileSync(tikFile(home), 'utf8')) } catch (err) { raw = null }
  const safe = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  const folders = {}
  if (safe.poshe && typeof safe.poshe === 'object' && !Array.isArray(safe.poshe)) {
    for (const [k, v] of Object.entries(safe.poshe)) if (typeof k === 'string' && k) folders[k] = cleanList(v)
  }
  const chats = {}
  if (safe.chat && typeof safe.chat === 'object' && !Array.isArray(safe.chat)) {
    for (const [k, v] of Object.entries(safe.chat)) if (typeof k === 'string' && k) chats[k] = cleanList(v)
  }
  const kooch = zaman(safe.kooch)
  return aaShared.tickOverlay(home, {
    sarasari: cleanList(safe.sarasari),
    poshe: folders,
    chat: chats,
    kooch,
    // Defaults immediately before the first edit by a snapshot-aware host.
    // A legacy chat first reopened *after* that edit must not inherit it.
    beforeSnapshots: safe.beforeSnapshots || null,
  }, 'abzar_dsh')
}

/**
 * تیک‌های یک چت را روی یک سطح می‌نویسد (نوشتنِ اتمیک).
 * @param opts { home, sath, cwd, chat, changes }
 * @returns {{ ok: true, store, summary } | { ok: false, status, error }}
 */
export function saveTik(opts) {
  const home = opts && opts.home
  const sath = opts && opts.sath
  const requestedChanges = Array.isArray(opts && opts.changes) ? opts.changes : []
  let changes = requestedChanges
  if (!['chat', 'poshe', 'sarasari'].includes(sath)) return { ok: false, status: 400, error: 'سطحِ نامعلوم: ' + String(sath) }
  if (changes.length === 0) return { ok: false, status: 400, error: 'هیچ تیکی نیامد' }
  if (changes.length > 400) return { ok: false, status: 400, error: 'تغییرها زیادند' }
  for (const c of changes) {
    if (!c || !isKind(c.kind)) return { ok: false, status: 400, error: 'دستهٔ نامعلوم: ' + String(c && c.kind) }
    if (typeof c.name !== 'string' || !c.name.trim()) return { ok: false, status: 400, error: 'نامِ خالی' }
    if (c.name.length > 200) return { ok: false, status: 400, error: 'نامِ بلند' }
  }
  const chat = String((opts && opts.chat) || '').trim()
  const store = loadTik(home)
  const sharedChanges = toolHelp.expandAliasChanges(changes,toolHelp.effectiveAliasPolicy({home,cwd:opts?.cwd,sessionId:chat,scope:sath,baseList:policyIn(store,sath==='chat'?chat:'',sath==='sarasari'?'':opts?.cwd).list}))
  changes=sharedChanges.filter(c=>isKind(c.kind))
  if (!store.beforeSnapshots) {
    store.beforeSnapshots = {
      sarasari: store.sarasari, poshe: { ...store.poshe }, chat: { ...store.chat }, kooch: store.kooch,
    }
  }
  if (sath === 'chat') {
    if (!isSafeId(chat)) return { ok: false, status: 400, error: 'شناسهٔ چت نیامد یا ناامن است' }
    store.chat[chat] = applyChanges(store.chat[chat], changes)
  } else if (sath === 'poshe') {
    const workspace = checkWorkspace(opts && opts.cwd, home)
    if (!workspace.ok) return { ok: false, status: 400, error: workspace.reason }
    store.poshe[workspace.cwd] = applyChanges(store.poshe[workspace.cwd], changes)
  } else {
    store.sarasari = applyChanges(store.sarasari, changes)
  }
  store.kooch = Date.now()
  try { writeFileAtomic(tikFile(home), store); aaShared.saveTicks(home, sath, opts.cwd || '', chat, sharedChanges) } catch (err) {
    return { ok: false, status: 500, error: 'نوشتنِ پرونده نشد: ' + String(err && err.message ? err.message : err) }
  }
  return { ok: true, store: store, changes: changes, summary: summarize(requestedChanges) }
}

/**
 * فهرستِ موثرِ یک چت را از پرونده می‌سازد (بدونِ نام‌های موجودِ DSH).
 * @param opts { home, sessionId, cwd }
 * @returns {{ list, az, folder, savedAt }}
 */
export function tikEffective(opts) {
  const store = loadTik(opts && opts.home)
  return policyIn(store, opts?.sessionId, opts?.cwd)
}

function policyIn(store, sid, cwd) {
  const effective = effectiveList({ chat: sid, cwd, chatLists: store.chat, folderLists: store.poshe, globalList: store.sarasari })
  return { ...effective, savedAt: store.kooch }
}

function policyFile(home, sid) {
  if (!isSafeId(sid)) throw new Error('شناسهٔ چت معتبر نیست')
  return path.join(rtlHome(home), 'tik-sessions', sid + '.json')
}

function readPolicy(home, sid) {
  try {
    const policy = JSON.parse(fs.readFileSync(policyFile(home, sid), 'utf8'))
    if (!policy?.list || typeof policy.list !== 'object') throw new Error('فهرست ذخیره‌شدهٔ این چت خراب است')
    return policy
  } catch (err) {
    if (err.code === 'ENOENT') return null
    throw err
  }
}

// For chats from before this feature we have no past revisions. Apply inherited
// defaults only when they were already saved at birth; retain explicit chat ticks.
function initialPolicy(store, session, cwd, source) {
  const born = zaman(session.header?.createdAt)
  if (source === 'startup' || born >= store.kooch) return policyIn(store, session.id, cwd)
  const baseline = store.beforeSnapshots || store
  if (born >= zaman(baseline.kooch)) return policyIn(baseline, session.id, cwd)
  return policyIn({ chat: baseline.chat, kooch: zaman(baseline.kooch) }, session.id, cwd)
}

/**
 * نام‌های خاموشی که باید از فهرستِ مدل برداشته شوند.
 * @param opts { home, sessionId, cwd, known }
 * @returns {string[]}
 */
export function tikDeniedFor(opts) {
  const store = loadTik(opts && opts.home)
  return deniedTools({
    chat: (opts && opts.sessionId) || '',
    cwd: (opts && opts.cwd) || '',
    chatLists: store.chat,
    folderLists: store.poshe,
    globalList: store.sarasari,
    known: (opts && opts.known) || [],
  })
}

/**
 * نمودارِ چهار دسته برای کلاینت.
 * @param opts { home, sessionId, cwd, available, query }
 * @returns { rows, az, folder, savedAt }
 */
export function tikRows(opts) {
  const got = opts?.policy || tikEffective(opts)
  const aliasPolicy=toolHelp.effectiveAliasPolicy({home:opts?.home,cwd:opts?.cwd,sessionId:opts?.sessionId,scope:opts?.sessionId?'chat':opts?.cwd?'poshe':'sarasari',baseList:got.list})
  return {
    rows: buildRows({ available: (opts && opts.available) || {}, list: got.list, query: '' }).map(group => ({ ...group, items: group.items.map(i => ({ ...i, on: toolHelp.importedName(i.name) ? toolHelp.importedTickOn({home:opts?.home,cwd:opts?.cwd,sessionId:opts?.sessionId,scope:opts?.sessionId?'chat':opts?.cwd?'poshe':'sarasari',name:i.name,source:opts?.available?.metadata?.[group.kind]?.[i.name]?.source||'claude',list:aliasPolicy}) : i.on, ...toolHelp.resolveHelp(group.kind, i.name, opts?.available?.metadata?.[group.kind]?.[i.name] || {}) })).filter(i => !opts?.query || [i.name,i.usage,i.origin,i.owner,got.az].join(' ').toLowerCase().includes(opts.query.toLowerCase())) })),
    az: got.az,
    folder: got.folder,
    savedAt: got.savedAt,
  }
}

export { isFreshChat, TIK_KIND }

/**
 * یک‌بار پروندهٔ سراسری را از مقدارهای localStorage پر می‌کند (مهاجرت).
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
 * نام‌های موجودِ DSH برای چهار دسته (از سرویس‌های خودِ اپ).
 * هر سرویسی نبود، همان دسته خالی می‌ماند بی‌آنکه بقیه بخوابند.
 * @param ctx Cordis context.
 * @returns {{ abzar_dsh: string[], mcp: string[], afzune: string[], eskil: string[] }}
 */
const seenToolDefinitions = new Map()
export async function collectAvailable(ctx, sessionId = '', cwd = '', home = os.homedir()) {
  const out = { abzar_dsh: [], mcp: [], afzune: [], eskil: [], metadata: {abzar_dsh:{},mcp:{},afzune:{},eskil:{}} }
  try {
    const tools = ctx.get('tools')
    if (tools) {
      const agent = sessionId ? ctx.get('agents')?.get?.(sessionId) : undefined
      const defs = tools.definitions(agent)
      const seen = seenToolDefinitions.get(sessionId) || new Map()
      for (const d of defs) if(d?.name) seen.set(d.name, {name:d.name,description:d.description||'',source:'deepseek'})
      // view().knownNames includes tools hidden by restrictions; observing it grants no permission.
      const known = tools.view?.(agent)?.knownNames || []
      for(const name of known) if(!seen.has(name)) { const d=tools.get?.(name); seen.set(name,{name,description:d?.description||'',source:'deepseek'}) }
      seenToolDefinitions.set(sessionId, seen)
      out.abzar_dsh = [...seen.keys()].sort()
      out.metadata.abzar_dsh = Object.fromEntries(seen)
    }
  } catch (err) { /* دستهٔ ابزار بی‌خبر خالی می‌ماند */ }
  try {
    const mcp = ctx.get('mcpManager')
    if (mcp) { const defs=mcp.list(); out.mcp=defs.map(s=>s.name).filter(Boolean).sort(); for(const d of defs) out.metadata.mcp[d.name]={description:d.description||'',source:'deepseek'} }
  } catch (err) { /* همان */ }
  try {
    const skills = ctx.get('skills')
    if (skills) {
      const got = await skills.list({})
      out.eskil = (Array.isArray(got) ? got : []).map((s) => s && (s.name || s.id)).filter(Boolean).sort(); for(const d of Array.isArray(got)?got:[]) if(d)out.metadata.eskil[d.name||d.id]={description:d.description||'',source:'deepseek'}
    }
  } catch (err) { /* همان */ }
  try {
    // «افزونه‌های حبیب» یعنی بسته‌های pnpm ِ خودش (package.json ِ پروفایل)، نه ۲۲۶ ردیفِ
    // درونیِ لودر که configEditor می‌دهد. پس از package.json می‌خوانیم تا فهرست کوتاه و
    // واقعی باشد؛ ردیف‌های لودر تنها با تنظیمِ صریح اجازه دارند دیده شوند.
    const raw = JSON.parse(fs.readFileSync(path.join(profileDir(), 'package.json'), 'utf8'))
    const deps = Object.assign({}, raw.dependencies, raw.devDependencies)
    // همهٔ بسته‌های خودِ پروفایل افزونه‌اند: هم @local/… و هم آنهایی که خودِ حبیب از
    // @deepseek-ai نصب کرده (مثلِ زیر-ایجنت‌ها). فقط بستهٔ بدنهٔ اپ حذف می‌شود.
    out.afzune = Object.keys(deps).filter((n) => n && n !== '@deepseek-ai/dsh').sort(); for(const n of out.afzune){try{const file=path.join(profileDir(),'node_modules',n,'package.json'); const d=JSON.parse(fs.readFileSync(file,'utf8'));out.metadata.afzune[n]={description:d.description||'',definitionSource:file,source:'deepseek'}}catch{}}
  } catch (err) { /* همان */ }
  const agent = sessionId ? ctx.get('agents')?.get?.(sessionId) : undefined
  try { cwd = ctx.get('workingDirectory')?.get?.(agent?.session) || agent?.session?.header?.cwd || cwd } catch {}
  const imported=toolHelp.bridgeRows(home,cwd,sessionId).filter(r=>r.source==='claude')
  const allowed=new Set(imported.map(r=>r.name))
  for(const kind of ['abzar_dsh','mcp','eskil']){
    out[kind]=out[kind].filter(name=>!toolHelp.importedName(name)||(kind==='mcp'&&allowed.has(name)))
    for(const name of Object.keys(out.metadata[kind]))if(toolHelp.importedName(name)&&!(kind==='mcp'&&allowed.has(name)))delete out.metadata[kind][name]
  }
  for(const r of imported){if(!out.mcp.includes(r.name))out.mcp.push(r.name);out.metadata.mcp[r.name]=r}
  return out
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

  /* --- تبِ «ابزارها»: مسیرِ HTTP و اعمال روی چتِ تازه ------------------
   * قانونِ حبیب: تیک پیش‌فرضِ چت‌های تازه است؛ چتِ بازِ الان دست نمی‌خورد.
   * انتخاب هر چت جدا ذخیره می‌شود تا پس از بازشدن دوباره هم باقی بماند.
   */
  const home = os.homedir()
  ctx.inject(['webServer'], (web) => {
    web.effect(() => web.webServer.register({ kind: 'exact', path: '/plugins/rtl/aa-shared', handler: async (req,res) => {
      if (refuse(req,res)) return
      try {
        const method=String(req.method||'GET').toUpperCase()
        if(!['GET','POST'].includes(method)){sendJson(res,405,{ok:false});return}
        if(method==='POST' && !/^application\/json\b/i.test(String(req.headers?.['content-type'] || ''))){sendJson(res,415,{ok:false});return}
        const body=method==='POST'?await readJsonBody(req):null
        const parts=requestParts(req.url,body)
        const cwd=agentCwd(registry()?.get?.(parts.sessionId),parts.cwd)
        if(!cwd || !checkWorkspace(cwd,home).ok){sendJson(res,400,{ok:false,error:'پوشه معلوم نیست'});return}
        const result=body?aaShared.save(home,'prefs',body.scope,cwd,parts.sessionId,body.patch,body.unset):aaShared.view(home,'prefs',cwd,parts.sessionId)
        sendJson(res,200,{ok:true,...result})
      }catch(err){sendJson(res,400,{ok:false,error:String(err.message)})}
    }}))
  })
  const applied = new Map() // live agent object -> restriction owned by this plugin
  const registry = () => typeof ctx.get === 'function' ? ctx.get('agents') : undefined

  function isEmptyAgent(agent) {
    return !!agent && registry()?.turnBoundaryOf?.(agent.session)?.lastTurn === 0 &&
      agent.status !== 'running' && !agent.inbox?.nextTurn?.length && !agent.session.header?.isSeeded
  }

  function agentCwd(agent, fallback = '') {
    if (!agent) return fallback
    try {
      const dir = ctx.get?.('workingDirectory')?.get?.(agent.session)
      if (typeof dir === 'string' && dir.startsWith('/')) return dir
    } catch (err) { /* use the directory recorded in the session header */ }
    return agent.session.header?.cwd || fallback
  }

  /**
   * تیک‌ها را روی یک چتِ زنده اعمال می‌کند. هر خطایی فقط لاگ می‌شود، نه شکستنِ چت.
   * @param agent agent ِ DSH.
   * @param why رویدادِ ساخت، بازگشایی یا ثبتِ پیش از اولین پیام.
   * @returns {string[]} نام‌هایی که واقعاً بسته شدند.
   */
  const applyTik = (agent, why, draftEdit) => {
    try {
      const sid = String(agent && agent.session && agent.session.id ? agent.session.id : '')
      if (!sid || !agent.ctx || !agent.ctx.tools) return []
      const cwd = agentCwd(agent)
      try { const seen=seenToolDefinitions.get(sid)||new Map(); for(const d of agent.ctx.tools.definitions(agent)) if(d?.name)seen.set(d.name,{name:d.name,description:d.description||'',source:'deepseek'});seenToolDefinitions.set(sid,seen) } catch {}
      const pinned = readPolicy(home, sid)
      let policy = pinned || initialPolicy(loadTik(home), agent.session, cwd, why)
      if (draftEdit) {
        const effective = policyIn(draftEdit.store, sid, cwd)
        const edits = draftEdit.changes.map(({ kind, name }) => ({
          kind, name, on: effective.list[kind][name.trim()] !== false,
        }))
        policy = { ...effective, list: applyChanges(policy.list, edits) }
      }
      if (!pinned || draftEdit) writeFileAtomic(policyFile(home, sid), policy)
      const known = agent.ctx.tools.definitions().map((d) => d.name)
      const deny = deniedTools({ known, globalList: policy.list })
      const before = applied.get(agent)
      const same = before && before.deny.length === deny.length && deny.every((n) => before.deny.includes(n))
      if (same) return deny
      // بی هیچ نامِ معتبری، restrict صدا زده نمی‌شود: خودِ DSH فیلترِ خالی را خطای پیکربندی می‌داند
      // («tools.restrict({}) is a no-op») و هر چتِ تازه بی‌دلیل کارِ بیهوده می‌کرد.
      const release = deny.length ? agent.ctx.tools.restrict({ deny }) : undefined
      before?.release?.()
      applied.set(agent, { deny, release })
      ctx.logger.info('tik: %s %s -> deny %o', why, sid, deny)
      return deny
    } catch (err) {
      ctx.logger.warn('tik: اعمال روی چت نشد: %s', String(err && err.message ? err.message : err))
      if (draftEdit) throw err
      return []
    }
  }

  ctx.inject(['webServer'], (web) => {
    web.effect(() => web.webServer.register({
      kind: 'exact',
      path: '/plugins/rtl/tik',
      handler: async (req, res) => {
        if (refuse(req, res)) return
        const method = String(req.method || 'GET').toUpperCase()
        try {
          if (method === 'GET') {
            const parts = requestParts(req.url, null)
            const available = await collectAvailable(ctx, parts.sessionId, parts.cwd, home)
            const level = new URL(req.url, 'http://localhost').searchParams.get('sath') || 'chat'
            const pinned = isSafeId(parts.sessionId) ? readPolicy(home, parts.sessionId) : null
            const live = registry()?.get?.(parts.sessionId)
            const cwd = agentCwd(live, parts.cwd)
            const chatLocked = !!(live || pinned) && !isEmptyAgent(live)
            const got = tikRows({ home, sessionId: level === 'poshe' || level === 'sarasari' ? '' : parts.sessionId,
              cwd: level === 'sarasari' ? '' : cwd, available, policy: level === 'chat' ? pinned : null })
            sendJson(res, 200, { ok: true, available, ...got, chatLocked })
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
          const sath = body && body.sath === 'sarasari' ? 'sarasari' : body && body.sath === 'poshe' ? 'poshe' : 'chat'
          const live = registry()?.get?.(parts.sessionId)
          const cwd = agentCwd(live, parts.cwd)
          const draft = isEmptyAgent(live)
          if (sath === 'chat' && isSafeId(parts.sessionId) && !draft && (live || readPolicy(home, parts.sessionId))) {
            sendJson(res, 409, { ok: false, error: 'تیک‌های این چت ثابت شده‌اند. برای چت‌های تازه «این پوشه» یا «سراسری» را انتخاب کن.' })
            return
          }
          const saved = saveTik({ home, sath, cwd, chat: parts.sessionId, changes: body && body.taghir })
          if (!saved.ok) { sendJson(res, saved.status || 400, { ok: false, error: saved.error }); return }
          // چتِ همین حالا هم اگر تازه باشد، بی‌بستن دوباره تیک می‌گیرد
          if (draft) {
            applyTik(live, 'baad-az-sabt', { store: saved.store, changes: saved.changes })
            toolHelp.updateDraftTickSnapshot({home,cwd:fs.realpathSync(cwd),sessionId:parts.sessionId,changes:saved.changes})
          }
          const available = await collectAvailable(ctx, parts.sessionId, parts.cwd, home)
          const policy = sath === 'chat' ? readPolicy(home, parts.sessionId) : null
          const got = tikRows({ home, sessionId: sath === 'chat' ? parts.sessionId : '', cwd: sath === 'sarasari' ? '' : cwd, available, policy })
          sendJson(res, 200, { ok: true, matn: saved.summary.matn, available, ...got, chatLocked: !!live && !draft })
        } catch (err) {
          sendJson(res, 500, { ok: false, error: String(err && err.message ? err.message : err) })
        }
      },
    }))
  })

  // هر چتی که باز می‌شود، تیک‌های خودش را می‌گیرد
  ctx.inject(['tools'], (scoped) => {
    if (typeof scoped.on === 'function') {
      scoped.on('agent/created', ({ agent, source = 'startup' }) => {
        applyTik(agent, source)
        return undefined
      }, { global: true })
      scoped.on('agent/disposed', ({ agent }) => {
        applied.get(agent)?.release?.()
        applied.delete(agent)
      }, { global: true })
    }
    scoped.effect?.(() => () => {
      for (const mask of applied.values()) mask.release?.()
      applied.clear()
    })
    // چت‌هایی که همین حالا بازند (بعد از نصب یا ری‌استارتِ افزونه) هم تیک بگیرند
    try {
      const agents = typeof ctx.get === 'function' ? ctx.get('agents') : undefined
      for (const agent of (agents && typeof agents.list === 'function' ? agents.list() : [])) applyTik(agent, 'hejrat')
    } catch (err) { /* لاگِ پایین کافی است */ }
  })
}
