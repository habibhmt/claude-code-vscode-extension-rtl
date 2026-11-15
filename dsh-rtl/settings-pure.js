/**
 * settings-pure — توابعِ خالصِ صفحهٔ تنظیمات: سه سطح (سراسری/پروژه/چت)، درهم‌آمیزی،
 * اعتبارسنجی، امنیتِ مسیر و شناسه، و ردیف‌های جست‌وجوپذیر.
 *
 * این فایل هم در node آزموده می‌شود (test/settings-pure.test.mjs، test/host.test.mjs)
 * و هم با tools/sync-plus.mjs عیناً داخلِ client.js ریخته می‌شود، چون نیمهٔ کلاینتِ DSH
 * جز react چیزی را require نمی‌کند. هیچ DOM یا window این‌جا نیست.
 *
 * ذخیره در «پرونده»ها (نه فقط localStorage):
 *   سراسری  ~/.dsh/dsh-rtl/settings.json
 *   پروژه   <پوشهٔ کار>/.dsh-rtl.json
 *   چت       ~/.dsh/dsh-rtl/chats/<sessionId>.json
 * مقدارِ مؤثر = چت ?? پروژه ?? سراسری ?? پیش‌فرض
 */

/* ---------- سطح‌ها ---------- */

/** ترتیبِ سطح‌ها از قوی‌تر به ضعیف‌تر (اولی برنده است). */
export const LEVELS = ['chat', 'project', 'global']

/** نامِ فارسیِ سطح‌ها برای صفحه. */
export const LEVEL_NAMES = { global: 'سراسری', project: 'پروژه', chat: 'چت' }

/** نامِ فارسیِ پیش‌فرض (وقتی هیچ سطحی مقداری ندارد). */
export const LEVEL_DEFAULT_NAME = 'پیش‌فرض'

function plainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : null
}

/** یک سطح را از حملهٔ prototype بیرون نگه می‌دارد و کلیدهای ناشناخته را می‌ریزد. */
function cleanLayer(raw, keys) {
  const obj = plainObject(raw)
  const out = {}
  if (!obj) return out
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(obj, key)) continue
    const value = obj[key]
    if (value === undefined) continue
    out[key] = value
  }
  return out
}

/**
 * سه لایهٔ خام (هر کدام رشتهٔ JSON یا شیء یا هیچ) ⇒ لایه‌های تمیز با کلیدهای مجاز.
 * @param {{ global?: unknown, project?: unknown, chat?: unknown }} raw
 * @param {string[]} keys کلیدهای مجازِ تنظیماتِ dsh-rtl
 * @returns {{ global: object, project: object, chat: object }}
 */
export function readLayers(raw, keys) {
  const wrap = plainObject(raw) || {}
  const pick = (value) => {
    let obj = value
    if (typeof value === 'string') {
      try { obj = JSON.parse(value) } catch (err) { obj = null }
    }
    return cleanLayer(obj, keys)
  }
  return { global: pick(wrap.global), project: pick(wrap.project), chat: pick(wrap.chat) }
}

/**
 * مقدارِ مؤثر و اینکه از کدام سطح آمده.
 * @param {{ global?: object, project?: object, chat?: object }} layers
 * @param {string} key
 * @param {unknown} fallback پیش‌فرض
 * @returns {{ value: unknown, level: 'chat'|'project'|'global'|'default' }}
 */
export function effectiveOf(layers, key, fallback) {
  const wrap = plainObject(layers) || {}
  for (const level of LEVELS) {
    const layer = plainObject(wrap[level])
    if (layer && Object.prototype.hasOwnProperty.call(layer, key) && layer[key] !== undefined) {
      return { value: layer[key], level }
    }
  }
  return { value: fallback, level: 'default' }
}

/** برچسبِ فارسیِ سطحِ برنده برای نشانِ ردیف. */
export function levelName(level) {
  return level === 'default' ? LEVEL_DEFAULT_NAME : (LEVEL_NAMES[level] || LEVEL_DEFAULT_NAME)
}

/**
 * یک لایه را عوض می‌کند بی‌آن‌که بقیه دست بخورند.
 * value === undefined ⇒ آن کلید از آن سطح پاک می‌شود.
 * @returns لایه‌های تازه (شیءِ نو؛ ورودی دست نمی‌خورد)
 */
export function setAt(layers, level, key, value) {
  const base = plainObject(layers) || {}
  if (!LEVELS.includes(level)) throw new Error('سطحِ نامعلوم: ' + String(level))
  const next = { global: { ...(plainObject(base.global) || {}) }, project: { ...(plainObject(base.project) || {}) }, chat: { ...(plainObject(base.chat) || {}) } }
  if (value === undefined) delete next[level][key]
  else next[level][key] = value
  return next
}

/** مقدارِ ذخیره‌شده در یک سطح (یا undefined). */
export function valueAt(layers, level, key) {
  const wrap = plainObject(layers) || {}
  const layer = plainObject(wrap[level])
  return layer && Object.prototype.hasOwnProperty.call(layer, key) ? layer[key] : undefined
}

/* ---------- امنیتِ شناسه و مسیر ---------- */

/** شناسهٔ چتِ مجاز: حرف/رقم/نقطه/خط‌تیره/زیرخط، تا ۱۲۸ نویسه، بیِ «..». */
export const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/

/**
 * آیا این شناسهٔ چت برای ساختنِ نامِ پرونده بی‌خطر است؟
 * «../..» و خالی و بی‌حرف و بلند رد می‌شوند.
 * @param {unknown} id
 * @returns {boolean}
 */
export function isSafeId(id) {
  if (typeof id !== 'string') return false
  if (!SAFE_ID.test(id)) return false
  if (id.includes('..')) return false
  return true
}

/** الگوی مسیرِ مطلقِ پوشه: /... یا C:\... یا \\\\server\\... */
export function isAbsolutePath(path) {
  if (typeof path !== 'string' || path.length === 0 || path.length > 4096) return false
  if (/\u0000/.test(path)) return false
  return path.startsWith('/') || /^[A-Za-z]:[^0-9]/.test(path) || path.startsWith('\\\\')
}

/**
 * آیا این مسیر برای نوشتنِ «.dsh-rtl.json» ِ پروژه، پوشهٔ کار است و نه جای حساس؟
 * سدِ کاملاً سمتِگام: جلوی «/»، پوشهٔ خانه، پوشه‌های سیستم و هر مسیرِ شاملِ «..» را می‌گیرد.
 * (گامِ اصلی، سنجشِ واقعیِ پوشه در نیمهٔ host است: موجود است؟ پوشه است؟)
 * @param {string} path پوشهٔ کار
 * @param {string} [home] پوشهٔ خانهٔ کاربر
 * @returns {string|null} علتِ رد، یا null یعنی مجاز
 */
export function unsafeWorkspace(path, home) {
  if (!isAbsolutePath(path)) return 'مسیر مطلق نیست'
  if (path.split(/[\\/]/).includes('..')) return 'مسیر «..» دارد'
  const clean = path.replace(/[\\/]+$/, '')
  if (/^[A-Za-z]:$/.test(clean)) return 'ریشهٔ درایو'
  if (clean === '') return 'ریشهٔ دیسک'
  if (typeof home === 'string' && home) {
    const h = home.replace(/[\\/]+$/, '')
    if (h && clean === h) return 'پوشهٔ خانه'
  }
  const lower = clean.replace(/\\/g, '/').toLowerCase()
  for (const sys of ['/etc', '/usr', '/bin', '/sbin', '/var', '/boot', '/dev', '/proc', '/sys', '/Library', '/System', '/private/etc', '/private/var']) {
    if (lower === sys.toLowerCase() || lower.startsWith(sys.toLowerCase() + '/')) return 'پوشهٔ سیستم'
  }
  return null
}

/* ---------- اعتبارسنجیِ مقدار ---------- */

/**
 * یک کلیدِ تنظیماتِ dsh-rtl را با همان ابزارِ readPlus تمیز می‌کند.
 * کلیدهای booleans همیشه true/false می‌شوند (فقط false ِ صریح خاموش می‌کند).
 * @param {string} key
 * @param {unknown} value
 * @param {{ readPlus: (raw: unknown) => object }} tools
 * @returns {{ ok: true, value: unknown } | { ok: false, error: string }}
 */
export function validatePref(key, value, tools) {
  if (STRUCTURAL_PLUS_KEYS.includes(key)) return { ok: false, error: 'کلیدِ ساختاری: ' + String(key) }
  const prefs = plainObject(tools && tools.prefs) || {}
  const inPrefs = Object.prototype.hasOwnProperty.call(prefs, key)
  const plusDefaults = tools && tools.readPlus ? tools.readPlus({}) : {}
  const inPlus = Object.prototype.hasOwnProperty.call(plusDefaults, key)
  if (!inPrefs && !inPlus) return { ok: false, error: 'کلیدِ ناشناخته: ' + String(key) }
  if (inPrefs) {
    // سوییچ‌های صفحه (rtl/font/code/plaintext): فقط false ِ صریح خاموش می‌کند — هم‌رفتار با applyDom.
    if (value === undefined) return { ok: true, value: prefs[key] }
    return { ok: true, value: value !== false && value !== 'false' && value !== 0 && value !== '0' }
  }
  // مقدارهای aA با همان readPlus ِ خودِ کلاینت جور می‌شوند (بازه، رنگ، جای دکمه).
  if (value === undefined) return { ok: true, value: plusDefaults[key] }
  const probe = { [key]: value }
  const one = tools.readPlus(probe)[key]
  return { ok: true, value: one }
}

/**
 * کلیدهایی از بشکه که نباید در سه سطح ذخیره شوند (فهرست و پروفایل‌ها ساختارِ سنگین دارند
 * و دکمه‌ها/متن‌های ویژه در صفحهٔ aA ویرایش می‌شوند؛ سه‌سطحی‌کردنشان بی‌فایده و پرخطاست).
 */
export const STRUCTURAL_PLUS_KEYS = ['commands', 'extras', 'profiles']

/** همهٔ کلیدهای کلِ dsh-rtl برای بررسیِ اعتبار (booleans + plus). */
export function allKeys(prefsDefaults, plusDefaults) {
  const keys = []
  for (const k of Object.keys(prefsDefaults || {})) keys.push(k)
  for (const k of Object.keys(plusDefaults || {})) keys.push(k)
  return keys
}

/* ---------- جست‌وجو ---------- */

/**
 * آیا این ردیف با واژهٔ جست‌وجو می‌خواند؟ در برچسب/شرح/کلیدِ انگلیسی/مقدارِ الان می‌گردد.
 * بی‌حساسیت به بزرگ/کوچک و به نیم‌فاصله.
 * @param {{ label?: string, hint?: string, key?: string, value?: unknown }[]} hay
 * @param {string} query
 * @returns {boolean}
 */
export function matchesQuery(hay, query) {
  const q = String(query == null ? '' : query).trim().toLowerCase().replace(/\u200c/g, ' ')
  if (!q) return true
  const word = (v) => (v === undefined ? '' : (v === true ? 'روشن' : v === false ? 'خاموش' : String(v)))
  const text = (Array.isArray(hay) ? hay : [])
    .map((h) => [h && h.label, h && h.hint, h && h.key, word(h && h.value)].join(' '))
    .join(' ')
    .toLowerCase()
    .replace(/\u200c/g, ' ')
  for (const word of q.split(/\s+/)) if (word && text.indexOf(word) === -1) return false
  return true
}

/* ---------- ردیف‌های «تنظیم‌های خودِ اپ» ---------- */

/** نام‌های فارسیِ fallback برای کلیدهای شناخته‌شدهٔ اپ (بیِ این، کلیدِ انگلیسی نشان داده می‌شود). */
export const APP_KEY_FA = {
  'ui-theme': 'ظاهرِ برنامه',
  preference: 'تم (روشن/تیره)',
  fontSize: 'اندازهٔ متنِ گفتگو',
  codeFontSize: 'اندازهٔ متنِ کد',
  terminalFontSize: 'اندازهٔ متنِ ترمینال',
  textFontFamily: 'فونتِ متن',
  codeFontFamily: 'فونتِ کد',
  terminalFontFamily: 'فونتِ ترمینال',
  'agent-loop': 'حلقهٔ کارِ ایجنت',
  maxParallelToolCalls: 'چند ابزار هم‌زمان',
  'agent-default-model': 'مدلِ پیش‌فرض',
  provider: 'سرویس‌دهندهٔ مدل',
  model: 'نامِ مدل',
  reasoningEffort: 'میزانِ فکرِ مدل',
  subagent: 'ساب‌ایجنت',
  maxDepth: 'حداکثرِ تودرتویی',
  maxActiveSubagents: 'چند ساب‌ایجنت هم‌زمان',
  'bash-local': 'اجرای فرمانِ بش',
  cwd: 'پوشهٔ اجرای فرمان',
  timeoutMs: 'مهلتِ فرمان (میلی‌ثانیه)',
  maxTimeoutMs: 'بیشترین مهلتِ فرمان',
  maxOutputBytes: 'سقفِ خروجیِ فرمان',
  maxSpillBytes: 'سقفِ پروندهٔ سرریز',
  graceMs: 'مهلتِ مِهرَبانی برای بستن',
}

/** پوشاندنِ رازها: هر کلیدی که بوی رمز/توکن/کلید/رمز عبور دارد. */
export const SECRET_KEY = /(secret|token|apikey|api_key|api-key|password|passwd|credential|authorization|^key$|_key$|keyid|bearer|cookie|session_?key|private)/i

/** آیا این کلیدِ تنظیم راز است؟ (هیچ‌وقت مقدارش نشان داده نمی‌شود) */
export function isSecretKey(key) {
  return SECRET_KEY.test(String(key || ''))
}

/**
 * مقدارِ نهایی برای نمایش: بولی ⇒ روشن/خاموش · خالی ⇒ «—» · راز ⇒ «••••••».
 * @param {unknown} value
 * @param {string} key
 * @returns {string}
 */
export function displayValue(value, key) {
  if (key !== undefined && isSecretKey(key)) return '•••••• (پنهان)'
  if (value === undefined || value === null || value === '') return '—'
  if (value === true) return 'روشن'
  if (value === false) return 'خاموش'
  if (typeof value === 'object') {
    const json = JSON.stringify(value)
    return json.length > 80 ? json.slice(0, 80) + '…' : json
  }
  return String(value)
}

/**
 * از یک namespace ِ describe ِ DSH یک فهرستِ ردیفِ فارسی/شرح می‌سازد؛ همین ترتیب در صفحه می‌آید.
 * فیلدِ راز نشان داده نمی‌شود (value پنهان می‌ماند و ویرایشی ندارد).
 * @param {{ ns: string, value: object, schema?: object }} view
 * @param {Record<string, {label?: string, tozih?: string, key_fa?: Record<string,string>}>} locale
 * @returns {{ ns: string, key: string, label: string, hint: string, value: unknown, secret: boolean }[]}
 */
export function appSettingRows(view, locale) {
  const rows = []
  if (!view || typeof view !== 'object' || typeof view.ns !== 'string') return rows
  const value = plainObject(view.value) || {}
  const entry = plainObject(locale && locale[view.ns]) || {}
  const keysFa = plainObject(entry.key_fa) || {}
  const nsLabel = entry.label || APP_KEY_FA[view.ns] || view.ns
  for (const key of Object.keys(value)) {
    const secret = isSecretKey(key) || hasSecretPath(view, key)
    const fieldFa = keysFa[key] || APP_KEY_FA[key] || key
    rows.push({
      ns: view.ns,
      key,
      label: secret ? fieldFa : nsLabel + ' — ' + fieldFa,
      hint: secret ? 'این مقدار راز است و نشان داده نمی‌شود' : (entry.tozih || 'تنظیمِ خودِ برنامه؛ مقدارِ الان را می‌گوید.'),
      value,
      secret,
    })
  }
  return rows
}

/** آیا مسیرِ این فیلد در «secrets» ِ describe اعلام شده؟ */
function hasSecretPath(view, key) {
  const list = Array.isArray(view.secrets) ? view.secrets : []
  return list.some((s) => s && Array.isArray(s.path) && s.path.length === 1 && s.path[0] === key)
}

/* ---------- فایلِ تنظیمِ سه‌سطحی ---------- */

/** پاک‌سازیِ شیئی که می‌خواهیم در پرونده بنویسیم: فقط کلیدهای مجاز، بیِ undefined. */
export function cleanFile(raw, keys) {
  const obj = plainObject(raw)
  if (!obj) return {}
  const out = {}
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(obj, key)) continue
    if (obj[key] === undefined) continue
    out[key] = obj[key]
  }
  return out
}

/**
 * پاسخِ «الان» در یک ردیف: «الان: X از سراسری؛ یعنی …»
 * @param {{ level: string, value: unknown, meaning?: string }} info
 * @returns {string}
 */
export function nowLine(info) {
  const text = info.value === undefined ? '—' : (typeof info.value === 'boolean' ? (info.value ? 'روشن' : 'خاموش') : String(info.value))
  const meaning = info.meaning ? '؛ یعنی ' + info.meaning : ''
  return 'الان: ' + text + ' از ' + levelName(info.level) + meaning
}
