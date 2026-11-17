/**
 * plus-pure — توابعِ خالصِ «ابزارهای اکستنشن» (دکمه‌های فرمانِ سریع، پنلِ aA، نقل‌قول، جست‌وجو، …).
 * این فایل در node آزموده می‌شود و با tools/sync-plus.mjs عیناً داخلِ client.js ریخته می‌شود،
 * چون نیمهٔ کلاینتِ DSH جز react چیزی را require نمی‌کند. هیچ DOM یا window این‌جا نیست.
 */

/* فهرستِ پیش‌فرضِ دکمه‌ها: همان dokme_ha.json ِ اکستنشن (نسخهٔ ۲)، منهای فرمان‌هایی که فقط در
   کلود کد معنا دارند (/usage، /context، /remember، /remote-control، /fast، /btw، /hads، Focus view). */
export const PLUS_DOKME_VERSION = 2
export const DEFAULT_COMMANDS = [
 {
  "label": "comp",
  "text": "/compact",
  "send": true
 },
 {
  "label": "ناظر",
  "text": "کارایی که میکنی باید با هماهنگی ناظر باشه ها",
  "send": false
 },
 {
  "label": "اسک",
  "text": "سوالاتو گزارش هات رو با اسک یوزر کوسشن بگو",
  "send": false
 },
 {
  "label": "داستان",
  "text": "الان از اول بگو داستان اصلی چی بود چیکارا کردین و کل داستان رفت و برگشت ها رو به زبون ساده بگو و توی جدول",
  "send": false
 },
 {
  "label": "اعتماد",
  "text": "به هیچ عنوان به حرف مجری اعتماد نکن و همه مواردی که میگه رو خودت توی ترمینال و توی کد چک بخون تا مطمئنش",
  "send": false
 },
 {
  "label": "قانون",
  "text": "تو کلود ام دی سراسری رو خوندی ؟ طبق قوانینش و مخصوصا قسمت ناظر مجری عمل کن",
  "send": false
 },
 {
  "label": "ایجنت",
  "text": "--------------------------------\nاین متن نظر یه ایجنت دیگه در مورد کار تو هست ، چک کن ببین درست میگه یا نه چون مسیولیت کار با تو هست نه اون ،اون فقط نظرشو گفت ؟ تو هم فعلا نظرتو بگو فقط ، به زبون ساده همه حرفات باید به زبان ساده با متغیر های من با مثال عددی قیمتی باشه توی جدول تا بفهمم من بگو تا بهت بگم ....",
  "send": false
 },
 {
  "label": "فایده",
  "text": "به چه دردی میخوره دقیقا و کجا میاد و مفهومش چیه به زبون ساده",
  "send": false
 },
 {
  "label": "سؤال",
  "text": "برای اینکه مطمین بشی اون چیزی که فهمیدی با اون چیزی که من از تو میخوام دقیقا یکی هست شروع کن یکی یکی سوال پرسیدن از من سوالایی که جوابشون بله و خیر هست و هر\n  سوالی که میپرسی بر اساس جواب قبلی من باشه و این سیستم رو تا جایی ادامه میدی که مطمین شی اون چیزی که من میخوامم با اون چیزی که تو فهمیدی یکی هست",
  "send": false
 },
 {
  "label": "ساده",
  "text": "نمیفهمم اینو به زبون ساده بگو",
  "send": false
 },
 {
  "label": "واژه",
  "text": "این واژگان مال من نیست با واژه گان من با من حرف بزن",
  "send": false
 },
 {
  "label": "جدول",
  "text": "توی جدول با مثال عددی ساده توضیح بده همه چی رو \nاصطلاحات تخصصی توضیح به زبان ساده داخل پرانتز\nدرصدهای قیمتی عدد $ هم نوشته شود",
  "send": false
 },
 {
  "label": "حدس",
  "text": "مثل اون قابلیتی هست که llm ها دارن حدس میزنه با توجه به درخواست های تا الانم چیا ممکنه بخوام اونارو لیست کن",
  "send": false
 },
 {
  "label": "ادامه",
  "text": "ادامه بده",
  "send": false
 },
 {
  "label": "بزن",
  "text": "بزن",
  "send": true
 },
 {
  "label": "همراه",
  "text": "قدم‌به‌قدم با من جلو برو: هر فرمانی که می‌زنی، بعدش به من بگو «این را سنجیدم، نتیجه اش این شد، حالا می‌خواهم این را بسنجم». و بعد فرمانِ بعدی را بزن.\n\n",
  "send": false
 }
]

export const PLUS_DEFAULTS = {
  buttons: true,      // ردیفِ دکمه‌ها نشان داده شود
  place: 'dock',      // dock = بالای کادرِ نوشتن · header = سربرگِ چت · both = هر دو
  btnSize: 11,        // اندازهٔ نوشتهٔ دکمه‌ها (px)
  opacity: 75,        // پُری دکمه‌ها در حالتِ عادی (٪)
  accent: '',         // رنگِ دکمه‌ها؛ خالی = رنگِ خودِ تم
  lines: 2,           // پیامِ خودت چند خط بماند؛ ۰ = کامل
  hoverMs: 700,       // چند میلی‌ثانیه موس بماند تا پیام باز شود
  lh: 0,              // فاصلهٔ خطوطِ گفتگو به دهم؛ ۰ = خودِ برنامه
  textColor: '',      // رنگِ متنِ گفتگو؛ خالی = خودِ تم (کد رنگِ خودش را نگه می‌دارد)
  tableScroll: true,  // جدولِ پهن داخلِ خودش افقی بچرخد
  noJump: true,       // با فرستادن، صفحه به پایین نپرد (اگر بالاتر را می‌خواندی)
  quoteMenu: true,    // کلیکِ راست روی متنِ انتخاب‌شده ⇒ منوی نقل‌قول
  counter: true,      // شمارندهٔ نویسه‌های کادرِ نوشتن
  aaTaze: true,       // در چتِ تازه، aA خودش روی تبِ «ابزارها» باز شود (حبیب، ۱۶ نوامبر)
  commands: null,     // null = DEFAULT_COMMANDS
  extras: [],         // متن‌های ویژه: [{ text, on, pos: 'start'|'end', btn }]
  profiles: {},       // { نام: تنظیمات }
}

export const PLUS_LIMITS = { btnSize: [8, 20], opacity: [10, 100], lines: [0, 12], hoverMs: [0, 5000], lh: [0, 30] }

export const PLUS_PRESETS = {
  compact: { btnSize: 9, lines: 1, lh: 15 },
  normal: { btnSize: 11, lines: 2, lh: 0 },
  large: { btnSize: 13, lines: 3, lh: 19 },
}

const PLACES = ['dock', 'header', 'both']

/** عدد را در بازه نگه می‌دارد؛ غیرعدد ⇒ پیش‌فرض. */
export function clampNumber(value, lo, hi, fallback) {
  const n = typeof value === 'number' ? value : parseInt(value, 10)
  if (!Number.isFinite(n)) return fallback
  return Math.min(hi, Math.max(lo, Math.round(n)))
}

/** فقط رنگِ hex ِ ساده از فیلتر رد می‌شود، چون داخلِ استایل‌شیت می‌نشیند. */
export function safeHex(value) {
  return typeof value === 'string' && /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(value) ? value : ''
}

/** یک دکمه را تمیز می‌کند؛ دکمهٔ بی‌نام یا بی‌متن ⇒ null. */
export function normalizeCommand(c) {
  if (!c || typeof c !== 'object') return null
  const label = String(c.label == null ? '' : c.label).trim().slice(0, 24)
  const text = typeof c.text === 'string' ? c.text : ''
  if (!label || !text.trim()) return null
  return { label, text, send: c.send === true }
}

/** فهرستِ دکمه‌ها؛ فهرستِ خالی یا خراب ⇒ کپیِ فهرستِ پیش‌فرض. */
export function normalizeCommands(list) {
  if (!Array.isArray(list)) return DEFAULT_COMMANDS.map(c => ({ ...c }))
  const out = list.map(normalizeCommand).filter(Boolean)
  return out.length ? out : DEFAULT_COMMANDS.map(c => ({ ...c }))
}

/** متن‌های ویژه را تمیز می‌کند. */
export function normalizeExtras(list) {
  if (!Array.isArray(list)) return []
  return list
    .filter(x => x && typeof x === 'object' && typeof x.text === 'string' && x.text.trim())
    .map(x => ({ text: x.text, on: x.on !== false, pos: x.pos === 'start' ? 'start' : 'end', btn: x.btn === true }))
}

/** تنظیماتِ ذخیره‌شده (رشتهٔ JSON یا شیء) ⇒ تنظیماتِ کامل و در بازه. */
export function readPlus(raw) {
  let obj = raw
  if (typeof raw === 'string') {
    try { obj = JSON.parse(raw) } catch (err) { obj = null }
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) obj = {}
  const s = { ...PLUS_DEFAULTS, ...obj }
  for (const k of Object.keys(PLUS_LIMITS)) {
    const [lo, hi] = PLUS_LIMITS[k]
    s[k] = clampNumber(s[k], lo, hi, PLUS_DEFAULTS[k])
  }
  for (const k of ['buttons', 'tableScroll', 'noJump', 'quoteMenu', 'counter']) s[k] = s[k] !== false
  if (!PLACES.includes(s.place)) s.place = PLUS_DEFAULTS.place
  s.accent = safeHex(s.accent)
  s.textColor = safeHex(s.textColor)
  s.commands = Array.isArray(s.commands) ? normalizeCommands(s.commands) : null
  s.extras = normalizeExtras(s.extras)
  s.profiles = s.profiles && typeof s.profiles === 'object' && !Array.isArray(s.profiles) ? { ...s.profiles } : {}
  return s
}

/** دکمه‌هایی که الان باید دیده شوند. */
export function commandsOf(s) {
  return Array.isArray(s && s.commands) && s.commands.length ? s.commands : DEFAULT_COMMANDS
}

/** پیش‌تنظیم را روی تنظیمات می‌نشاند (فشرده/معمولی/درشت). */
export function applyPreset(s, name) {
  const p = PLUS_PRESETS[name]
  return p ? readPlus({ ...s, ...p }) : readPlus(s)
}

/** پروفایل: عکسِ تنظیمات بی‌خودِ پروفایل‌ها. */
export function profileSnapshot(s) {
  const copy = { ...readPlus(s) }
  delete copy.profiles
  return JSON.parse(JSON.stringify(copy))
}

/** پروفایلِ ذخیره‌شده را برمی‌گرداند و فهرستِ پروفایل‌ها را نگه می‌دارد. */
export function loadProfile(s, name) {
  const p = s && s.profiles && s.profiles[name]
  if (!p) return readPlus(s)
  return readPlus({ ...p, profiles: s.profiles })
}

/**
 * متنی که دکمه در کادر می‌گذارد: هر دکمه یک جملهٔ کامل است و روی خطِ خودش می‌نشیند،
 * پس اگر کادر چیزی دارد که با خطِ تازه تمام نشده، یک خطِ تازه جلویش می‌آید.
 */
export function lineInsertion(draft, text) {
  const d = typeof draft === 'string' ? draft : ''
  if (!d.trim()) return text
  return (/\n$/.test(d) ? '' : '\n') + text
}

/** نقل‌قولِ مارک‌داون: جلوی هر خط «> ». */
export function quoteBlock(text) {
  return String(text).replace(/\r\n?/g, '\n').split('\n').map(l => '> ' + l).join('\n')
}

/**
 * متن‌های ویژه را جلو/پشتِ متن می‌چسباند (بینشان یک خطِ خالی).
 * from = 'menu' ⇒ همهٔ تیک‌خورده‌ها · 'btn' ⇒ فقط آن‌هایی که 📋 هم دارند (دکمهٔ کپیِ زیرِ پاسخ).
 */
export function withExtras(text, extras, from) {
  const list = normalizeExtras(extras).filter(x => x.on && (from !== 'btn' || x.btn))
  const pick = start => list.filter(x => (x.pos === 'start') === start).map(x => x.text.trim())
  return pick(true).concat([text], pick(false)).join('\n\n')
}

/** جای همهٔ پیداشده‌ها در یک متن (بی‌حساسیت به بزرگ/کوچک)، بی‌هم‌پوشانی. */
export function findRanges(haystack, needle) {
  const out = []
  if (typeof haystack !== 'string' || typeof needle !== 'string' || !needle) return out
  const h = haystack.toLowerCase()
  const n = needle.toLowerCase()
  let i = h.indexOf(n)
  while (i !== -1) {
    out.push([i, i + n.length])
    i = h.indexOf(n, i + n.length)
  }
  return out
}

/** آیا خواننده ته صفحه است؟ */
export function nearBottom(scrollTop, scrollHeight, clientHeight, threshold = 80) {
  return scrollHeight - scrollTop - clientHeight <= threshold
}

/**
 * نگهبانِ «پایین نپر»: پس از فرستادن، اگر برنامه خودش صفحه را پایین برد (کاربر دست نزده و
 * هنوز در مهلت است)، جای قبلی برگردانده می‌شود.
 */
export function shouldRestoreScroll({ savedTop, top, userActed, now, until }) {
  if (savedTop == null || userActed || now > until) return false
  return top > savedTop + 4
}

/** رقم‌های فارسی. */
export function faDigits(n) {
  return String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d])
}

/** برچسبِ شمارنده: «۱۲۳ نویسه». */
export function counterLabel(text) {
  const n = typeof text === 'string' ? Array.from(text).length : 0
  return faDigits(n) + ' نویسه'
}

/** خطی که ایجنتِ دیگر برای پیام دادن به این چت لازم دارد. */
export function sessionIdentity(title, sessionId) {
  const t = String(title || '').trim() || 'بی‌نام'
  const id = String(sessionId || '').trim()
  return id ? 'session_send → targetSessionId: "' + id + '"   (چت: «' + t + '»)' : 'شناسهٔ این چت هنوز معلوم نیست'
}

/** عنوانِ چت از عنوانِ پنجره: «عنوان — DeepSeek Harness». */
export function titleFromDocument(docTitle) {
  return String(docTitle || '').replace(/\s+[—-]\s+(DeepSeek Harness|DSH[^—-]*)$/u, '').trim()
}

/** تنظیمات برای کپی (sav). */
export function exportSettings(s) {
  return JSON.stringify(readPlus(s), null, 1)
}

/** متنِ پیست‌شده ⇒ تنظیمات؛ خراب ⇒ { ok: false }. */
export function importSettings(text) {
  let obj
  try { obj = JSON.parse(text) } catch (err) { return { ok: false, error: 'JSON درست نیست' } }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return { ok: false, error: 'باید یک شیء {…} باشد' }
  return { ok: true, settings: readPlus(obj) }
}

const RTL_LETTERS = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFC]/

/**
 * متنِ تمام‌لاتینِ عدددار (مثلِ «7 turns 239 steps · 144 tok/s» یا «2 pending») در صفحهٔ راست‌به‌چپ
 * عددِ اولش را به تهِ خط می‌برد؛ چنین متنی باید چپ‌به‌راست نوشته شود. فقط متنِ کوتاه.
 */
export function isLatinWithDigits(text) {
  const t = typeof text === 'string' ? text.trim() : ''
  if (!t || t.length > 160) return false
  return /[A-Za-z]/.test(t) && /\d/.test(t) && !RTL_LETTERS.test(t)
}

/** متنِ تمام‌لاتین (بی‌حرفِ فارسی/عربی/عبری)، تا ۳۰۰ نویسه؛ برای گرهِ درون‌خطیِ بی‌فرزند که نقطهٔ تهش به اولِ خط می‌پرید. */
export function isLatinText(text) {
  const t = typeof text === 'string' ? text.trim() : ''
  if (!t || t.length > 300) return false
  return /[A-Za-z]/.test(t) && !RTL_LETTERS.test(t)
}

/** خانهٔ جدول که هیچ حرفی ندارد (فقط ✅ یا عدد یا نشانه)؛ در جدولِ راست‌به‌چپ باید راست‌چین شود. */
export function hasNoLetters(text) {
  const t = typeof text === 'string' ? text.trim() : ''
  return t.length > 0 && !/[A-Za-z]/.test(t) && !RTL_LETTERS.test(t)
}

/** استایل‌شیتی که از تنظیمات ساخته می‌شود. */
export function plusCss(s) {
  const t = readPlus(s)
  const out = []
  out.push(':root{--dsh-plus-btn-size:' + t.btnSize + 'px;--dsh-plus-btn-opacity:' + (t.opacity / 100) + '}')
  if (t.accent) out.push('.dsh-plus-btn{border-color:' + t.accent + '!important;color:' + t.accent + '!important}')
  if (!t.buttons) out.push('.dsh-plus-bar .dsh-plus-btn:not(.dsh-plus-aa){display:none!important}')
  const scroll = '[data-conversation-scroll]'
  if (t.lines > 0) {
    // فقط پیامی که از N خط بلندتر است (نشانِ data-dsh-plus-long را client.js می‌زند) محو و دست‌نما می‌شود؛
    // پیامِ کوتاه دست نمی‌خورد.
    const sel = scroll + ' [data-message-bubble]:not([data-dsh-plus-open])'
    out.push(sel + '{max-height:calc(' + t.lines + 'lh + 1.25em)!important;overflow:hidden!important}')
    out.push(sel + '[data-dsh-plus-long]{cursor:pointer;' +
      '-webkit-mask-image:linear-gradient(to bottom,#000 calc(100% - .9em),transparent);mask-image:linear-gradient(to bottom,#000 calc(100% - .9em),transparent)}')
  }
  if (t.lh > 0) {
    const v = (t.lh / 10).toFixed(2)
    out.push(scroll + ' p,' + scroll + ' li,' + scroll + ' td,' + scroll + ' th,' + scroll + ' blockquote{line-height:' + v + '!important}')
  }
  if (t.textColor) {
    out.push([' p', ' li', ' td', ' th', ' h1', ' h2', ' h3', ' h4', ' strong', ' blockquote']
      .map(x => scroll + x).join(',') + '{color:' + t.textColor + '!important}')
  }
  if (t.tableScroll) {
    out.push(scroll + ' table:not(:has(code)){display:block;max-width:100%;overflow-x:auto}')
  }
  return out.join('\n')
}
