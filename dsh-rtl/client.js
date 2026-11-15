window.__ModuleLoader__.load({
  id: '@local/dsh-rtl',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    /* #region plus-inline — تولیدِ خودکار از plus-pure.js (tools/sync-plus.mjs) */

    /* فهرستِ پیش‌فرضِ دکمه‌ها: همان dokme_ha.json ِ اکستنشن (نسخهٔ ۲)، منهای فرمان‌هایی که فقط در
       کلود کد معنا دارند (/usage، /context، /remember، /remote-control، /fast، /btw، /hads، Focus view). */
    const PLUS_DOKME_VERSION = 2
    const DEFAULT_COMMANDS = [
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

    const PLUS_DEFAULTS = {
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
      commands: null,     // null = DEFAULT_COMMANDS
      extras: [],         // متن‌های ویژه: [{ text, on, pos: 'start'|'end', btn }]
      profiles: {},       // { نام: تنظیمات }
    }

    const PLUS_LIMITS = { btnSize: [8, 20], opacity: [10, 100], lines: [0, 12], hoverMs: [0, 5000], lh: [0, 30] }

    const PLUS_PRESETS = {
      compact: { btnSize: 9, lines: 1, lh: 15 },
      normal: { btnSize: 11, lines: 2, lh: 0 },
      large: { btnSize: 13, lines: 3, lh: 19 },
    }

    const PLACES = ['dock', 'header', 'both']

    /** عدد را در بازه نگه می‌دارد؛ غیرعدد ⇒ پیش‌فرض. */
    function clampNumber(value, lo, hi, fallback) {
      const n = typeof value === 'number' ? value : parseInt(value, 10)
      if (!Number.isFinite(n)) return fallback
      return Math.min(hi, Math.max(lo, Math.round(n)))
    }

    /** فقط رنگِ hex ِ ساده از فیلتر رد می‌شود، چون داخلِ استایل‌شیت می‌نشیند. */
    function safeHex(value) {
      return typeof value === 'string' && /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(value) ? value : ''
    }

    /** یک دکمه را تمیز می‌کند؛ دکمهٔ بی‌نام یا بی‌متن ⇒ null. */
    function normalizeCommand(c) {
      if (!c || typeof c !== 'object') return null
      const label = String(c.label == null ? '' : c.label).trim().slice(0, 24)
      const text = typeof c.text === 'string' ? c.text : ''
      if (!label || !text.trim()) return null
      return { label, text, send: c.send === true }
    }

    /** فهرستِ دکمه‌ها؛ فهرستِ خالی یا خراب ⇒ کپیِ فهرستِ پیش‌فرض. */
    function normalizeCommands(list) {
      if (!Array.isArray(list)) return DEFAULT_COMMANDS.map(c => ({ ...c }))
      const out = list.map(normalizeCommand).filter(Boolean)
      return out.length ? out : DEFAULT_COMMANDS.map(c => ({ ...c }))
    }

    /** متن‌های ویژه را تمیز می‌کند. */
    function normalizeExtras(list) {
      if (!Array.isArray(list)) return []
      return list
        .filter(x => x && typeof x === 'object' && typeof x.text === 'string' && x.text.trim())
        .map(x => ({ text: x.text, on: x.on !== false, pos: x.pos === 'start' ? 'start' : 'end', btn: x.btn === true }))
    }

    /** تنظیماتِ ذخیره‌شده (رشتهٔ JSON یا شیء) ⇒ تنظیماتِ کامل و در بازه. */
    function readPlus(raw) {
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
    function commandsOf(s) {
      return Array.isArray(s && s.commands) && s.commands.length ? s.commands : DEFAULT_COMMANDS
    }

    /** پیش‌تنظیم را روی تنظیمات می‌نشاند (فشرده/معمولی/درشت). */
    function applyPreset(s, name) {
      const p = PLUS_PRESETS[name]
      return p ? readPlus({ ...s, ...p }) : readPlus(s)
    }

    /** پروفایل: عکسِ تنظیمات بی‌خودِ پروفایل‌ها. */
    function profileSnapshot(s) {
      const copy = { ...readPlus(s) }
      delete copy.profiles
      return JSON.parse(JSON.stringify(copy))
    }

    /** پروفایلِ ذخیره‌شده را برمی‌گرداند و فهرستِ پروفایل‌ها را نگه می‌دارد. */
    function loadProfile(s, name) {
      const p = s && s.profiles && s.profiles[name]
      if (!p) return readPlus(s)
      return readPlus({ ...p, profiles: s.profiles })
    }

    /**
     * متنی که دکمه در کادر می‌گذارد: هر دکمه یک جملهٔ کامل است و روی خطِ خودش می‌نشیند،
     * پس اگر کادر چیزی دارد که با خطِ تازه تمام نشده، یک خطِ تازه جلویش می‌آید.
     */
    function lineInsertion(draft, text) {
      const d = typeof draft === 'string' ? draft : ''
      if (!d.trim()) return text
      return (/\n$/.test(d) ? '' : '\n') + text
    }

    /** نقل‌قولِ مارک‌داون: جلوی هر خط «> ». */
    function quoteBlock(text) {
      return String(text).replace(/\r\n?/g, '\n').split('\n').map(l => '> ' + l).join('\n')
    }

    /**
     * متن‌های ویژه را جلو/پشتِ متن می‌چسباند (بینشان یک خطِ خالی).
     * from = 'menu' ⇒ همهٔ تیک‌خورده‌ها · 'btn' ⇒ فقط آن‌هایی که 📋 هم دارند (دکمهٔ کپیِ زیرِ پاسخ).
     */
    function withExtras(text, extras, from) {
      const list = normalizeExtras(extras).filter(x => x.on && (from !== 'btn' || x.btn))
      const pick = start => list.filter(x => (x.pos === 'start') === start).map(x => x.text.trim())
      return pick(true).concat([text], pick(false)).join('\n\n')
    }

    /** جای همهٔ پیداشده‌ها در یک متن (بی‌حساسیت به بزرگ/کوچک)، بی‌هم‌پوشانی. */
    function findRanges(haystack, needle) {
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
    function nearBottom(scrollTop, scrollHeight, clientHeight, threshold = 80) {
      return scrollHeight - scrollTop - clientHeight <= threshold
    }

    /**
     * نگهبانِ «پایین نپر»: پس از فرستادن، اگر برنامه خودش صفحه را پایین برد (کاربر دست نزده و
     * هنوز در مهلت است)، جای قبلی برگردانده می‌شود.
     */
    function shouldRestoreScroll({ savedTop, top, userActed, now, until }) {
      if (savedTop == null || userActed || now > until) return false
      return top > savedTop + 4
    }

    /** رقم‌های فارسی. */
    function faDigits(n) {
      return String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d])
    }

    /** برچسبِ شمارنده: «۱۲۳ نویسه». */
    function counterLabel(text) {
      const n = typeof text === 'string' ? Array.from(text).length : 0
      return faDigits(n) + ' نویسه'
    }

    /** خطی که ایجنتِ دیگر برای پیام دادن به این چت لازم دارد. */
    function sessionIdentity(title, sessionId) {
      const t = String(title || '').trim() || 'بی‌نام'
      const id = String(sessionId || '').trim()
      return id ? 'session_send → targetSessionId: "' + id + '"   (چت: «' + t + '»)' : 'شناسهٔ این چت هنوز معلوم نیست'
    }

    /** عنوانِ چت از عنوانِ پنجره: «عنوان — DeepSeek Harness». */
    function titleFromDocument(docTitle) {
      return String(docTitle || '').replace(/\s+[—-]\s+(DeepSeek Harness|DSH[^—-]*)$/u, '').trim()
    }

    /** تنظیمات برای کپی (sav). */
    function exportSettings(s) {
      return JSON.stringify(readPlus(s), null, 1)
    }

    /** متنِ پیست‌شده ⇒ تنظیمات؛ خراب ⇒ { ok: false }. */
    function importSettings(text) {
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
    function isLatinWithDigits(text) {
      const t = typeof text === 'string' ? text.trim() : ''
      if (!t || t.length > 160) return false
      return /[A-Za-z]/.test(t) && /\d/.test(t) && !RTL_LETTERS.test(t)
    }

    /** متنِ تمام‌لاتین (بی‌حرفِ فارسی/عربی/عبری)، تا ۳۰۰ نویسه؛ برای گرهِ درون‌خطیِ بی‌فرزند که نقطهٔ تهش به اولِ خط می‌پرید. */
    function isLatinText(text) {
      const t = typeof text === 'string' ? text.trim() : ''
      if (!t || t.length > 300) return false
      return /[A-Za-z]/.test(t) && !RTL_LETTERS.test(t)
    }

    /** خانهٔ جدول که هیچ حرفی ندارد (فقط ✅ یا عدد یا نشانه)؛ در جدولِ راست‌به‌چپ باید راست‌چین شود. */
    function hasNoLetters(text) {
      const t = typeof text === 'string' ? text.trim() : ''
      return t.length > 0 && !/[A-Za-z]/.test(t) && !RTL_LETTERS.test(t)
    }

    /** استایل‌شیتی که از تنظیمات ساخته می‌شود. */
    function plusCss(s) {
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
    /* #endregion plus-inline */

    /* ------------------------------------------------------------------ *
     * Preference store (browser-local, survives reload)
     * ------------------------------------------------------------------ */
    const STORE_KEY = 'dsh-rtl:prefs:v1';
    const DEFAULTS = { rtl: true, font: true, code: true, plaintext: true };
    const listeners = new Set();
    let prefs = Object.assign({}, DEFAULTS);

    try {
      const raw = window.localStorage.getItem(STORE_KEY);
      if (raw) prefs = Object.assign({}, DEFAULTS, JSON.parse(raw));
    } catch (err) {
      /* private mode / bad payload: keep defaults */
    }

    let originalDir = null;
    let dirCaptured = false;

    function applyDom() {
      const root = document.documentElement;
      if (!root) return;
      if (!dirCaptured) {
        originalDir = root.getAttribute('dir');
        dirCaptured = true;
      }
      root.setAttribute('data-dsh-rtl', prefs.rtl ? 'on' : 'off');
      root.setAttribute('data-dsh-rtl-font', prefs.font ? 'on' : 'off');
      root.setAttribute('data-dsh-rtl-code', prefs.code ? 'on' : 'off');
      root.setAttribute('data-dsh-rtl-plaintext', prefs.plaintext ? 'on' : 'off');
      if (prefs.rtl) root.setAttribute('dir', 'rtl');
      else if (originalDir === null) root.removeAttribute('dir');
      else root.setAttribute('dir', originalDir);
    }

    function restoreDom() {
      const root = document.documentElement;
      if (!root) return;
      root.removeAttribute('data-dsh-rtl');
      root.removeAttribute('data-dsh-rtl-font');
      root.removeAttribute('data-dsh-rtl-code');
      root.removeAttribute('data-dsh-rtl-plaintext');
      if (originalDir === null) root.removeAttribute('dir');
      else root.setAttribute('dir', originalDir);
    }

    function writePrefs(patch) {
      prefs = Object.assign({}, prefs, patch);
      try {
        window.localStorage.setItem(STORE_KEY, JSON.stringify(prefs));
      } catch (err) {
        /* ignore quota/private-mode failures */
      }
      applyDom();
      /* خاموش‌کردنِ راست‌به‌چپ باید اثرِ چسباندنِ متن را هم پاک کند، وگرنه
         متن‌های راست‌چین‌شده تا نوسازیِ بعدی همان‌طور می‌مانند. */
      if (prefs.rtl && prefs.plaintext) alignPass();
      else clearAlignPass();
      listeners.forEach((fn) => {
        try {
          fn();
        } catch (err) {
          /* a broken listener must not stop the others */
        }
      });
    }

    /* ------------------------------------------------------------------ *
     * Stylesheet
     * ------------------------------------------------------------------ */
    const CSS = `
/* --- ۱) کلِ برنامه آینه می‌شود (همان قاعدهٔ پچِ کلود کد) ------------- */
html[data-dsh-rtl="on"],
html[data-dsh-rtl="on"] body {
  direction: rtl;
  text-align: right;
}

/* --- ۲) فونتِ فارسی ------------------------------------------------ */
html[data-dsh-rtl-font="on"] body,
html[data-dsh-rtl-font="on"] p,
html[data-dsh-rtl-font="on"] li,
html[data-dsh-rtl-font="on"] td,
html[data-dsh-rtl-font="on"] th,
html[data-dsh-rtl-font="on"] h1,
html[data-dsh-rtl-font="on"] h2,
html[data-dsh-rtl-font="on"] h3,
html[data-dsh-rtl-font="on"] h4,
html[data-dsh-rtl-font="on"] h5,
html[data-dsh-rtl-font="on"] h6,
html[data-dsh-rtl-font="on"] blockquote,
html[data-dsh-rtl-font="on"] button,
html[data-dsh-rtl-font="on"] input,
html[data-dsh-rtl-font="on"] textarea,
html[data-dsh-rtl-font="on"] label,
html[data-dsh-rtl-font="on"] a {
  font-family: "Vazirmatn", "Vazir", system-ui, sans-serif;
}
html[data-dsh-rtl-font="on"] pre,
html[data-dsh-rtl-font="on"] pre *,
html[data-dsh-rtl-font="on"] code,
html[data-dsh-rtl-font="on"] code *,
html[data-dsh-rtl-font="on"] kbd,
html[data-dsh-rtl-font="on"] samp {
  font-family: "Vazir Code Hack", "SF Mono", Menlo, Consolas, monospace;
}

/* --- ۳) کد و خروجیِ ابزار چپ‌به‌راست -------------------------------- *
 * روی فرزندانِ کد فقط جهت و تراز عوض می‌شود؛ unicode-bidi:isolate زده
 * نمی‌شود، چون حروفِ فارسیِ داخلِ کد را از هم جدا می‌کرد.               */
html[data-dsh-rtl-code="on"] pre,
html[data-dsh-rtl-code="on"] pre *,
html[data-dsh-rtl-code="on"] code,
html[data-dsh-rtl-code="on"] code *,
html[data-dsh-rtl-code="on"] kbd,
html[data-dsh-rtl-code="on"] samp,
html[data-dsh-rtl-code="on"] .monaco-editor,
html[data-dsh-rtl-code="on"] .monaco-editor *,
html[data-dsh-rtl-code="on"] .cm-editor,
html[data-dsh-rtl-code="on"] .cm-editor * {
  direction: ltr !important;
  text-align: left !important;
}

/* پاراگرافی که تنها محتوایش کد است = بلوکِ کد؛ تمام‌عرض و چپ‌به‌راست */
html[data-dsh-rtl-code="on"] p:has(> code:only-child),
html[data-dsh-rtl-code="on"] p:has(> code:only-child) > code,
html[data-dsh-rtl-code="on"] p:has(> code:only-child) > code * {
  direction: ltr !important;
  text-align: left !important;
}
html[data-dsh-rtl-code="on"] p:has(> code:only-child) > code {
  display: block;
}

/* جدولی که کد دارد = بلوکِ کد با ستونِ شمارهٔ خط؛ باید چپ‌به‌راست بماند،
   وگرنه ستونِ شماره‌ها می‌رود سمتِ راست (حبیب ۱۴ نوامبر: «شماره‌های خط
   سمتِ راست است، خراب حساب می‌شود»)                                  */
html[data-dsh-rtl-code="on"] table:has(code),
html[data-dsh-rtl-code="on"] table:has(code) * {
  direction: ltr !important;
  text-align: left !important;
}
html[data-dsh-rtl-code="on"] table:has(code) td:first-child,
html[data-dsh-rtl-code="on"] table:has(code) th:first-child {
  text-align: right !important;
}

/* ظرف‌های کد با نام‌های محتمل */
html[data-dsh-rtl-code="on"] [class*="code" i],
html[data-dsh-rtl-code="on"] [class*="code" i] *,
html[data-dsh-rtl-code="on"] [class*="fence" i],
html[data-dsh-rtl-code="on"] [class*="fence" i] *,
html[data-dsh-rtl-code="on"] [class*="shiki" i],
html[data-dsh-rtl-code="on"] [class*="shiki" i] *,
html[data-dsh-rtl-code="on"] [class*="highlight" i],
html[data-dsh-rtl-code="on"] [class*="highlight" i] *,
html[data-dsh-rtl-code="on"] [data-language],
html[data-dsh-rtl-code="on"] [data-language] * {
  direction: ltr !important;
  text-align: left !important;
}

/* بلوکِ کدِ واقعیِ این رابط: هر خط یک div است و شمارهٔ خط در ابتدای همان
   خط می‌نشیند. در راست‌به‌چپ، ابتدای خط سمتِ راست می‌شود و شماره‌ها آن‌جا
   می‌افتند؛ پس خط و ظرفش چپ‌به‌راست می‌شوند (حبیب ۱۴ نوامبر: «شماره‌های
   خط سمتِ راست است، خراب حساب می‌شود»).                              */
html[data-dsh-rtl-code="on"] [class*="_lineNumber_"],
html[data-dsh-rtl-code="on"] [class*="_line_"]:has(> [class*="_lineNumber_"]),
html[data-dsh-rtl-code="on"] div:has(> [class*="_line_"] > [class*="_lineNumber_"]) {
  direction: ltr !important;
  text-align: left !important;
}

/* پیامِ خودِ کاربر: در چیدمانِ چپ‌به‌راست به لبهٔ راست چسبیده بود؛ در
   راست‌به‌چپ flex-end به سمتِ چپ می‌رود، پس به flex-start برمی‌گردد.   */
html[data-dsh-rtl="on"] [class*="userRow"],
html[data-dsh-rtl="on"] [class*="userStack"] {
  align-items: flex-start !important;
}

/* دیفِ فایل‌ها (کارتِ فایل‌های تغییرکرده و پیش‌نمایشِ شناورش): هر خط یک
   شبکهٔ چهارستونی است — شمارهٔ خطِ قبل، شمارهٔ خطِ بعد، علامت، متن. در
   راست‌به‌چپ ستون‌ها از راست چیده می‌شوند و شماره‌ها می‌افتند سمتِ راست؛
   پس جهتِ کلِ دیف چپ‌به‌راست می‌شود. ترازِ خودِ شماره‌ها دست‌نخورده
   می‌ماند، چون قاعدهٔ خودش (راست‌چین داخلِ ستون) بر ارث‌بری مقدم است. */
html[data-dsh-rtl-code="on"] [class*="tWMzGW_"] {
  direction: ltr !important;
}
html[data-dsh-rtl-code="on"] [class*="tWMzGW_text"] {
  text-align: left !important;
}
/* همان قاعده، بی‌تکیه بر پیشوندِ رمزِ نسخه: هر ردیفِ دیفی که ستونِ شماره
   دارد، و هر ردیفِ یک‌طرفه یا دوسویه یا سرِ قطعه، چپ‌به‌راست می‌شود. */
html[data-dsh-rtl-code="on"] [class*="_line"]:has(> [class*="_number"]),
html[data-dsh-rtl-code="on"] [class*="_cell"]:has(> [class*="_number"]),
html[data-dsh-rtl-code="on"] [class*="_sideLine"],
html[data-dsh-rtl-code="on"] [class*="_splitLine"],
html[data-dsh-rtl-code="on"] [class*="_hunkHeader"] {
  direction: ltr !important;
}

/* --- ۴) هر بلوک جهتش را از محتوای خودش می‌گیرد ---------------------- */
html[data-dsh-rtl-plaintext="on"] p,
html[data-dsh-rtl-plaintext="on"] li,
html[data-dsh-rtl-plaintext="on"] td,
html[data-dsh-rtl-plaintext="on"] th,
html[data-dsh-rtl-plaintext="on"] h1,
html[data-dsh-rtl-plaintext="on"] h2,
html[data-dsh-rtl-plaintext="on"] h3,
html[data-dsh-rtl-plaintext="on"] h4,
html[data-dsh-rtl-plaintext="on"] h5,
html[data-dsh-rtl-plaintext="on"] h6,
html[data-dsh-rtl-plaintext="on"] blockquote,
html[data-dsh-rtl-plaintext="on"] dd,
html[data-dsh-rtl-plaintext="on"] dt,
html[data-dsh-rtl-plaintext="on"] summary,
html[data-dsh-rtl-plaintext="on"] figcaption,
html[data-dsh-rtl-plaintext="on"] [contenteditable="true"],
html[data-dsh-rtl-plaintext="on"] textarea,
html[data-dsh-rtl-plaintext="on"] input[type="text"],
html[data-dsh-rtl-plaintext="on"] input:not([type]) {
  unicode-bidi: plaintext;
  text-align: start !important;
}
html[data-dsh-rtl-plaintext="on"] table:not(:has(code)) { direction: rtl; }
html[data-dsh-rtl-plaintext="on"] ul,
html[data-dsh-rtl-plaintext="on"] ol { padding-inline-start: 1.5em; }

/* --- نردبانِ «Turn navigation» کنارِ گفتگو برداشته می‌شود -------------- *
 * خط‌های ریزِ عمودیِ لبهٔ راستِ گفتگو (یکی برای هر نوبت). حبیب ۱۵ نوامبر:
 * «این هم یه چیز اضافه هست برش دار». نشانه: nav ای که دکمه‌های data-index دارد
 * (TurnNavigator.tsx)، مستقل از زبان و نامِ رمزیِ کلاس. */
nav:has(button[data-index]) {
  display: none !important;
}

/* --- کلیدهای خودِ برنامه (role=switch) چپ‌به‌راست ------------------- *
 * دستگیره با translate(16px) به راست می‌رود؛ در راست‌به‌چپ از لبهٔ راست شروع
 * می‌کرد و بیرون از کلید می‌افتاد = «لکهٔ سیاه» (حبیب ۱۵ نوامبر). کلیدِ
 * خودِ این افزونه (.dsh-rtl-switch) برای راست‌به‌چپ ساخته شده و جدا است. */
html[data-dsh-rtl="on"] [role="switch"]:not(.dsh-rtl-switch) {
  direction: ltr;
}

/* --- نشانی‌ها ترتیبِ خواندنِ خودشان را نگه می‌دارند -------------------- */
html[data-dsh-rtl="on"] a[href] {
  unicode-bidi: isolate;
}

/* --- ۵) صفحهٔ تنظیمات ---------------------------------------------- */
.dsh-rtl-page {
  direction: rtl;
  text-align: right;
  color: var(--dsw-alias-label-primary);
  padding: 4px 2px 24px;
  max-width: 720px;
}
.dsh-rtl-lead {
  margin: 0 0 20px;
  color: var(--dsw-alias-label-secondary);
  font-size: 13px;
  line-height: 1.9;
}
.dsh-rtl-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 0;
  border-top: 1px solid var(--dsw-alias-border-l1);
}
.dsh-rtl-row-text { flex: 1 1 auto; min-width: 0; }
.dsh-rtl-row-title {
  display: block;
  font-size: 14px;
  line-height: 1.6;
}
.dsh-rtl-row-hint {
  display: block;
  margin-top: 4px;
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  line-height: 1.8;
}
.dsh-rtl-switch {
  flex: 0 0 auto;
  position: relative;
  width: 40px;
  height: 22px;
  margin-top: 2px;
  border: 0;
  border-radius: 999px;
  background: var(--dsw-alias-border-l2);
  cursor: pointer;
  transition: background 160ms ease;
  padding: 0;
}
.dsh-rtl-switch:focus-visible {
  outline: 2px solid var(--dsw-alias-brand-primary);
  outline-offset: 2px;
}
.dsh-rtl-switch[aria-checked="true"] { background: var(--dsw-alias-brand-primary); }
.dsh-rtl-knob {
  position: absolute;
  top: 3px;
  right: 3px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.35);
  transition: transform 160ms ease;
}
.dsh-rtl-switch[aria-checked="true"] .dsh-rtl-knob { transform: translateX(-18px); }
.dsh-rtl-note {
  margin-top: 22px;
  padding: 12px 14px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 10px;
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  line-height: 1.9;
}

`;

    /* ------------------------------------------------------------------ *
     * Runtime alignment pass
     *
     * The app's own stylesheets pin some blocks to the left with hashed
     * class names we cannot target. This pass finds text blocks that still
     * compute to a left alignment while holding Persian letters and moves
     * them to the right. Code is skipped.
     * ------------------------------------------------------------------ */
    const PERSIAN = /[\u0600-\u06FF]/;
    const SKIP = 'pre, code, kbd, samp, .monaco-editor, .cm-editor, [data-dsh-rtl-skip]';
    const BLOCKS = 'p, li, div, span, td, th, h1, h2, h3, h4, h5, h6, blockquote, label';

    function alignPass() {
      if (!prefs.rtl || !prefs.plaintext) return;
      let touched = 0;
      const nodes = document.querySelectorAll(BLOCKS);
      for (let i = 0; i < nodes.length && touched < 400; i += 1) {
        const el = nodes[i];
        if (el.closest(SKIP)) continue;
        const text = el.textContent;
        if (!text || text.length > 4000 || !PERSIAN.test(text)) continue;
        const style = window.getComputedStyle(el);
        if (style.textAlign !== 'left') continue;
        el.style.setProperty('text-align', 'right', 'important');
        el.setAttribute('data-dsh-rtl-skip', 'aligned');
        touched += 1;
      }
      ltrPass();
    }

    /* متنِ تمام‌لاتینِ عدددار (قرصِ «7 turns 239 steps»، «2 pending» ِ To-dos، «Deep diving for 1m 47s»)
       در راست‌به‌چپ عددِ اولش به تهِ خط می‌پرید؛ چنین گرهی dir="ltr" می‌گیرد. فقط گرهی که درونش
       کنترل یا بلوکِ چیدمان نیست، تا ترتیبِ دکمه‌های یک نوار برنگردد (گزارشِ app-audit، ۱۵ نوامبر).
       خانهٔ جدولِ بی‌حرف (مثلاً فقط ✅) هم مثلِ سرستونش راست‌چین می‌شود. */
    const LTR_CANDIDATES = 'button, span, a, label, li, summary, [role="status"]';
    const LTR_BLOCKERS = 'button, input, textarea, select, div, p, ul, ol, table, [contenteditable]';
    function ltrPass() {
      if (!prefs.rtl) return;
      let touched = 0;
      const nodes = document.querySelectorAll(LTR_CANDIDATES);
      for (let i = 0; i < nodes.length && touched < 300; i += 1) {
        const el = nodes[i];
        if (el.hasAttribute('data-dsh-rtl-ltr') || el.hasAttribute('dir')) continue;
        if (el.closest(SKIP) || el.closest('[contenteditable="true"],.dsh-plus-bar,.dsh-plus-pop,#dsh-plus-find,#dsh-plus-ctx')) continue;
        const text = el.textContent;
        let style = null;
        if (isLatinWithDigits(text)) {
          if (el.querySelector(LTR_BLOCKERS)) continue;
        } else {
          // جملهٔ انگلیسیِ درون‌خطیِ بی‌فرزند: نقطهٔ تهش در راست‌به‌چپ به اولِ خط می‌رفت
          // («.Compaction could not …»)؛ برای span ِ درون‌خطی dir فقط ترتیب را عوض می‌کند، نه تراز را.
          if (el.children.length || !isLatinText(text)) continue;
          style = window.getComputedStyle(el);
          if (style.display.indexOf('inline') !== 0) continue;
        }
        if ((style || window.getComputedStyle(el)).direction !== 'rtl') continue;
        el.setAttribute('dir', 'ltr');
        el.setAttribute('data-dsh-rtl-ltr', '');
        touched += 1;
      }
      touched = englishBlockPass(touched);
      const cells = document.querySelectorAll('td, th');
      for (let i = 0; i < cells.length && touched < 600; i += 1) {
        const el = cells[i];
        if (el.hasAttribute('data-dsh-rtl-skip') || el.closest('table:has(code)')) continue;
        if (!hasNoLetters(el.textContent)) continue;
        if (window.getComputedStyle(el).textAlign === 'right') continue;
        el.style.setProperty('text-align', 'right', 'important');
        el.setAttribute('data-dsh-rtl-skip', 'aligned');
        touched += 1;
      }
    }

    /* بلوکِ تمام‌انگلیسی (توضیحِ کارت‌های صفحهٔ Plugins: «.Set Subagent recursion depth…») در
       راست‌به‌چپ راست‌چین بود و نقطهٔ تهش به اولِ خط می‌رفت. حبیب ۱۵ نوامبر: «این انگلیسی‌ها رو هم
       چپ‌چین کن». دو جور گره dir="ltr" می‌گیرد:
       (الف) ستونِ عمودیِ تمام‌لاتین (عنوان + توضیح) که درونش کنترل، آیکون یا کد نیست؛
       (ب) گرهِ برگِ بلوکی (بی‌فرزند) که در ستون یا بلوک نشسته، نه در ردیفی کنارِ آیکون؛
       تا نامِ پوشه و برچسبِ کنارِ آیکونِ نوارِ کنار سرِ جایش بماند. پیامِ خودِ کاربر و نوارِ کنار
       دست نمی‌خورند. متنی که بعداً فارسی شد، dir اش برداشته می‌شود. */
    const EN_COL_BLOCKERS = 'input, textarea, select, [role="switch"], [contenteditable], svg, img, pre, code, table';
    const EN_OUTSIDE = 'nav, aside, [class*="sidebar" i], [class*="userRow"], [class*="userStack"], [contenteditable="true"], .dsh-rtl-page, .dsh-plus-bar, .dsh-plus-pop, #dsh-plus-find, #dsh-plus-ctx';
    function isColumn(style) {
      if (style.display === 'flex' || style.display === 'inline-flex') return style.flexDirection.indexOf('column') === 0;
      return style.display === 'block' || style.display === 'flow-root' || style.display === 'list-item';
    }
    /* مثلِ isLatinText ولی تا ۲۰۰۰ نویسه: توضیحِ کارت در صفحه کوتاه‌شده («…») است ولی متنِ کاملش بلندتر از ۳۰۰. */
    function isLatinBlock(text) {
      const t = typeof text === 'string' ? text.trim() : '';
      if (!t || t.length > 2000) return false;
      return /[A-Za-z]/.test(t) && !RTL_LETTERS.test(t);
    }
    function englishBlockPass(touched) {
      const marked = document.querySelectorAll('[data-dsh-rtl-ltr="en"]');
      for (let i = 0; i < marked.length; i += 1) {
        if (RTL_LETTERS.test(marked[i].textContent || '')) {
          marked[i].removeAttribute('dir');
          marked[i].removeAttribute('data-dsh-rtl-ltr');
        }
      }
      const nodes = document.querySelectorAll('div, span, p, h1, h2, h3, h4, h5, h6, label, dd, dt');
      for (let i = 0; i < nodes.length && touched < 500; i += 1) {
        const el = nodes[i];
        if (el.hasAttribute('dir') || el.hasAttribute('data-dsh-rtl-ltr')) continue;
        if (!isLatinBlock(el.textContent)) continue;
        if (el.closest(SKIP) || el.closest(EN_OUTSIDE) || el.closest('[dir="ltr"]')) continue;
        const style = window.getComputedStyle(el);
        if (style.direction !== 'rtl' || style.display === 'none') continue;
        let ok = false;
        if (el.children.length === 0) {
          // (ب) برگ: خودش بلوکی، پدرش ستون
          if (style.display.indexOf('inline') === 0) continue;
          const parent = el.parentElement;
          ok = !!parent && isColumn(window.getComputedStyle(parent));
        } else if (el.tagName === 'DIV') {
          // (الف) ستونِ عنوان + توضیح
          const ai = style.alignItems;
          ok = style.display.indexOf('flex') !== -1 && style.flexDirection.indexOf('column') === 0
            && (ai === 'normal' || ai === 'stretch' || ai === '')
            && !el.querySelector(EN_COL_BLOCKERS);
        }
        if (!ok) continue;
        el.setAttribute('dir', 'ltr');
        el.setAttribute('data-dsh-rtl-ltr', 'en');
        touched += 1;
      }
      return touched;
    }

    function clearAlignPass() {
      const marked = document.querySelectorAll('[data-dsh-rtl-skip="aligned"]');
      for (let i = 0; i < marked.length; i += 1) {
        marked[i].style.removeProperty('text-align');
        marked[i].removeAttribute('data-dsh-rtl-skip');
      }
      const ltr = document.querySelectorAll('[data-dsh-rtl-ltr]');
      for (let i = 0; i < ltr.length; i += 1) {
        ltr[i].removeAttribute('dir');
        ltr[i].removeAttribute('data-dsh-rtl-ltr');
      }
    }

    /* ------------------------------------------------------------------ *
     * Settings section component
     * ------------------------------------------------------------------ */
    const ROWS = [
      {
        key: 'rtl',
        title: 'راست‌به‌چپ',
        hint: 'کل صفحه آینه می‌شود: نوارِ کنار سمتِ راست، پیام‌ها از راست، و متن‌ها با ترتیبِ فارسی.',
      },
      {
        key: 'font',
        title: 'فونتِ فارسی (Vazirmatn)',
        hint: 'متن‌های فارسی با Vazirmatn و کدها با Vazir Code Hack نوشته می‌شوند؛ مثلِ همان پچی که در کلود کد داشتیم.',
      },
      {
        key: 'code',
        title: 'کد و خروجیِ ابزار چپ‌به‌راست بماند',
        hint: 'بلوک‌های کد، شمارهٔ خط‌ها، دیف و خروجیِ ابزارها برنمی‌گردند، تا ستون‌ها و پرانتزها درست خوانده شوند.',
      },
      {
        key: 'plaintext',
        title: 'هر بلوک از متنِ خودش پیروی کند',
        hint: 'پاراگرافِ فارسی راست‌به‌چپ و پاراگرافِ انگلیسی چپ‌به‌راست می‌ماند؛ برای جدول و کادرِ نوشتن هم همین قاعده.',
      },
    ];

    function Switch(props) {
      return h(
        'button',
        {
          type: 'button',
          className: 'dsh-rtl-switch',
          role: 'switch',
          'aria-checked': props.checked ? 'true' : 'false',
          'aria-label': props.label,
          onClick: props.onToggle,
        },
        h('span', { className: 'dsh-rtl-knob' }),
      );
    }

    function RtlSection() {
      const [snapshot, setSnapshot] = React.useState(prefs);
      React.useEffect(() => {
        const update = () => setSnapshot(prefs);
        listeners.add(update);
        update();
        return () => {
          listeners.delete(update);
        };
      }, []);

      const rows = ROWS.map((row) =>
        h(
          'div',
          { className: 'dsh-rtl-row', key: row.key },
          h(
            'div',
            { className: 'dsh-rtl-row-text' },
            h('span', { className: 'dsh-rtl-row-title' }, row.title),
            h('span', { className: 'dsh-rtl-row-hint' }, row.hint),
          ),
          h(Switch, {
            checked: !!snapshot[row.key],
            label: row.title,
            onToggle: () => writePrefs({ [row.key]: !snapshot[row.key] }),
          }),
        ),
      );

      return h(
        'div',
        { className: 'dsh-rtl-page' },
        h(
          'p',
          { className: 'dsh-rtl-lead' },
          'همان کارهایی که اکستنشنِ راست‌به‌چپِ کلود کد برایت می‌کرد، این‌جا هم انجام می‌شود. هر تغییر همان لحظه روی همین صفحه اثر می‌گذارد و در همین مرورگر می‌ماند.',
        ),
        rows,
        h(
          'div',
          { className: 'dsh-rtl-note' },
          'اگر جایی چیدمان به‌هم ریخت، اول «راست‌به‌چپ» را خاموش کن؛ بعد یکی‌یکی روشن کن تا معلوم شود کدام گزینه آن صفحه را به‌هم می‌زند. گزینه‌ها فقط روی همین مرورگر ذخیره می‌شوند.',
        ),
        h(PlusPanel, { inSettings: true }),
      );
    }

    /* ------------------------------------------------------------------ *
     * ابزارهای اکستنشن — پورتِ claude-ui-buttons.js به DSH
     * دکمه‌های فرمانِ سریع، پنلِ aA، منوی کلیکِ راستِ نقل‌قول، جست‌وجو در گفتگو،
     * متن‌های ویژه، «پایین نپر»، جمع‌شدنِ پیامِ خودت، شمارنده. توابعِ خالص در
     * plus-pure.js هستند (بالای همین فایل تزریق شده‌اند).
     * ------------------------------------------------------------------ */
    const PLUS_KEY = 'dsh-rtl:plus:v1';
    const plusListeners = new Set();
    let plus = readPlus(null);
    try { plus = readPlus(window.localStorage.getItem(PLUS_KEY)); } catch (err) { /* حالتِ خصوصی */ }
    let ReactDOM = null;
    try { ReactDOM = require('react-dom'); } catch (err) { ReactDOM = null; }

    let plusStyle = null;
    function applyPlusCss() {
      if (plusStyle) plusStyle.textContent = PLUS_BASE_CSS + '\n' + plusCss(plus);
    }
    function savePlus(next) {
      plus = readPlus(next);
      try { window.localStorage.setItem(PLUS_KEY, JSON.stringify(plus)); } catch (err) { /* بی‌جا */ }
      applyPlusCss();
      plusListeners.forEach((fn) => { try { fn(); } catch (err) { /* بقیه بمانند */ } });
    }
    function patchPlus(patch) { savePlus(Object.assign({}, plus, patch)); }
    function usePlus() {
      const [snap, setSnap] = React.useState(plus);
      React.useEffect(() => {
        const f = () => setSnap(plus);
        plusListeners.add(f);
        f();
        return () => { plusListeners.delete(f); };
      }, []);
      return snap;
    }

    const PLUS_BASE_CSS = [
      '.dsh-plus-bar{position:relative;display:flex;align-items:center;gap:4px;direction:rtl;min-width:0;width:100%;max-width:100%;box-sizing:border-box;padding:2px 6px 4px}',
      // هم‌عرضِ کارتِ To-dos ِ خودِ DSH (TodoPanel.module.css): همان فرمولِ عرض و فاصله از لبه
      '.dsh-plus-bar[data-where="dock"]{flex:none;margin:0 auto;padding:0;width:calc(100% - 2 * var(--dsh-composer-side-clearance,16px) - 4 * var(--dsh-composer-dock-inset,8px));max-width:calc(var(--dsh-composer-card-max-width,780px) - 4 * var(--dsh-composer-dock-inset,8px))}',
      '.dsh-plus-bar[data-where="header"]{padding:0 4px;max-width:46vw}',
      '.dsh-plus-row{display:flex;gap:4px;overflow-x:auto;scrollbar-width:none;flex:1 1 auto;min-width:0;align-items:center}',
      '.dsh-plus-row::-webkit-scrollbar{display:none}',
      '.dsh-plus-btn{flex:0 0 auto;font:var(--dsh-plus-btn-size,11px)/1.6 "Vazirmatn","Vazir",system-ui,sans-serif;padding:0 8px;border-radius:999px;',
      'border:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.35));background:var(--dsw-alias-bg-layer-1,rgba(127,127,127,.12));',
      'color:var(--dsw-alias-label-secondary,inherit);cursor:pointer;white-space:nowrap;opacity:var(--dsh-plus-btn-opacity,.75);transition:opacity .12s}',
      '.dsh-plus-btn:hover{opacity:1;color:var(--dsw-alias-label-primary,inherit)}',
      '.dsh-plus-btn[data-send]::after{content:" ⏎";opacity:.5}',
      '.dsh-plus-aa{font-weight:700;opacity:.9}',
      '.dsh-plus-flash{font-size:11px;color:var(--dsw-alias-label-secondary);white-space:nowrap}',
      '.dsh-plus-anchor{height:0;width:100%}',
      '.dsh-plus-count{font-size:11px;color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary));white-space:nowrap;direction:rtl}',
      '.dsh-plus-pop{position:fixed;z-index:2147483000;bottom:140px;right:24px;width:min(400px,calc(100vw - 48px));max-height:min(72vh,760px);overflow:auto;',
      'background:var(--dsw-alias-bg-layer-1,#1f1f1f);border:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.4));border-radius:12px;padding:10px 12px;box-shadow:0 12px 36px rgba(0,0,0,.5)}',
      '.dsh-plus-pop.dsh-plus-pop-inline{position:absolute;bottom:calc(100% + 6px);right:0}',
      '.dsh-plus-panel{direction:rtl;text-align:right;font:12px/1.7 "Vazirmatn","Vazir",system-ui,sans-serif;color:var(--dsw-alias-label-primary);display:flex;flex-direction:column;gap:6px}',
      '.dsh-plus-panel h4{margin:8px 0 2px;font-size:12px;color:var(--dsw-alias-label-secondary);font-weight:600}',
      '.dsh-plus-head{display:flex;justify-content:space-between;align-items:center;gap:8px}',
      '.dsh-plus-head b{font-size:13px}',
      '.dsh-plus-line{display:flex;align-items:center;gap:6px;justify-content:space-between;min-width:0}',
      '.dsh-plus-line>label{flex:0 0 auto;color:var(--dsw-alias-label-secondary)}',
      '.dsh-plus-line input[type=range]{flex:1;min-width:0;direction:ltr}',
      '.dsh-plus-line input[type=number]{width:52px;direction:ltr;text-align:center}',
      '.dsh-plus-panel input[type=text],.dsh-plus-panel input[type=number],.dsh-plus-panel select,.dsh-plus-panel textarea{background:rgba(127,127,127,.12);border:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.35));border-radius:6px;color:inherit;font:inherit;padding:1px 6px;box-sizing:border-box}',
      '.dsh-plus-panel textarea{width:100%;min-height:54px;resize:vertical}',
      '.dsh-plus-panel textarea.dsh-plus-json{direction:ltr;text-align:left;font:10px/1.4 monospace;min-height:70px}',
      '.dsh-plus-panel button{font:inherit;color:inherit;background:rgba(127,127,127,.14);border:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.35));border-radius:6px;padding:0 8px;cursor:pointer}',
      '.dsh-plus-panel button:hover{background:rgba(127,127,127,.28)}',
      '.dsh-plus-actions{display:flex;flex-wrap:wrap;gap:4px}',
      '.dsh-plus-list{display:flex;flex-direction:column;gap:4px}',
      '.dsh-plus-item{display:flex;flex-wrap:wrap;gap:4px;align-items:center;padding:4px;border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.2));border-radius:8px}',
      '.dsh-plus-item .dsh-plus-grow{flex:1 1 120px;min-width:0}',
      '.dsh-plus-item .dsh-plus-preview{flex:1 1 120px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;unicode-bidi:plaintext}',
      '.dsh-plus-note{color:var(--dsw-alias-label-secondary);font-size:11px;line-height:1.8}',
      '.dsh-plus-settings{margin-top:22px;padding-top:12px;border-top:1px solid var(--dsw-alias-border-l1)}',
      '#dsh-plus-ctx{position:fixed;z-index:2147483600;display:flex;flex-direction:column;min-width:170px;padding:4px;direction:rtl;text-align:right;',
      'background:var(--dsw-alias-bg-layer-1,#1f1f1f);border:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.4));border-radius:8px;box-shadow:0 8px 26px rgba(0,0,0,.5);font:12px/1.7 "Vazirmatn",system-ui,sans-serif;color:var(--dsw-alias-label-primary)}',
      '#dsh-plus-ctx button{background:none;border:0;color:inherit;text-align:right;padding:3px 10px;border-radius:5px;cursor:pointer;font:inherit;white-space:nowrap}',
      '#dsh-plus-ctx button:hover{background:rgba(127,127,127,.25)}',
      '#dsh-plus-find{position:fixed;z-index:2147483500;top:52px;left:50%;transform:translateX(-50%);display:flex;gap:6px;align-items:center;direction:rtl;padding:6px 8px;',
      'background:var(--dsw-alias-bg-layer-1,#1f1f1f);border:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.4));border-radius:10px;box-shadow:0 8px 26px rgba(0,0,0,.45);font:12px "Vazirmatn",system-ui,sans-serif;color:var(--dsw-alias-label-primary)}',
      '#dsh-plus-find input{width:220px;direction:rtl;unicode-bidi:plaintext;background:rgba(127,127,127,.12);border:1px solid rgba(127,127,127,.35);border-radius:6px;color:inherit;font:inherit;padding:2px 6px}',
      '#dsh-plus-find button{background:rgba(127,127,127,.14);border:1px solid rgba(127,127,127,.35);border-radius:6px;color:inherit;font:inherit;cursor:pointer;padding:0 7px}',
      '#dsh-plus-find span{min-width:70px;color:var(--dsw-alias-label-secondary)}',
      '::highlight(dsh-plus-find){background-color:rgba(255,200,0,.38)}',
      '::highlight(dsh-plus-find-now){background-color:rgba(255,140,0,.9);color:#000}',
      '#dsh-plus-toast{position:fixed;z-index:2147483600;bottom:24px;left:50%;transform:translateX(-50%);padding:6px 12px;border-radius:8px;direction:rtl;',
      'background:var(--dsw-alias-bg-layer-1,#1f1f1f);border:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.4));font:12px "Vazirmatn",system-ui,sans-serif;color:var(--dsw-alias-label-primary);box-shadow:0 6px 20px rgba(0,0,0,.4)}',
    ].join('\n');

    /* --- کادرهای نوشتن: هر نوارِ دکمه کادرِ چتِ خودش را ثبت می‌کند --------- */
    const composers = new Map(); // sessionId -> { sid, actions, draft }
    function pickComposer() {
      let best = null;
      let bestW = -1;
      const marks = document.querySelectorAll('[data-dsh-plus-sid]');
      for (let i = 0; i < marks.length; i += 1) {
        const w = marks[i].getBoundingClientRect().width;
        const c = composers.get(marks[i].getAttribute('data-dsh-plus-sid'));
        if (c && w > bestW) { best = c; bestW = w; }
      }
      if (best) return best;
      let last = null;
      composers.forEach((c) => { last = c; });
      return last;
    }

    let toastTimer = 0;
    function toast(msg) {
      let t = document.getElementById('dsh-plus-toast');
      if (!t) {
        t = document.createElement('div');
        t.id = 'dsh-plus-toast';
        document.body.appendChild(t);
      }
      t.textContent = msg;
      t.style.display = 'block';
      window.clearTimeout(toastTimer);
      toastTimer = window.setTimeout(() => { t.style.display = 'none'; }, 2600);
    }

    let origWriteText = null;
    function copyText(text, okMsg) {
      const cb = navigator.clipboard;
      const write = origWriteText || (cb && cb.writeText ? cb.writeText.bind(cb) : null);
      if (!write) { toast('کلیپ‌بورد در دسترس نیست'); return; }
      write(text).then(() => toast(okMsg || 'کپی شد'), () => toast('کلیپ‌بورد اجازه نداد'));
    }

    /** دکمه‌ای را اجرا می‌کند؛ پیامِ خطا یا ''. */
    function runCommand(c, actions, draft) {
      if (!actions) return 'کادرِ نوشتن پیدا نشد';
      const d = typeof draft === 'string' ? draft : '';
      const text = c.text;
      if (/^\//.test(text.trim()) && d.trim()) return 'اول کادر را خالی کن؛ فرمانِ «/» باید اولِ پیام باشد';
      if (!d.trim()) {
        actions.setDraft(c.send ? text.replace(/\s+$/, '') : text);
      } else {
        const ok = actions.insertText(lineInsertion(d, text), actions.captureInsertion());
        if (!ok) return 'کادر الان قفل است (در حالِ فرستادن)';
      }
      if (c.send) window.setTimeout(() => { try { actions.submit(); } catch (err) { toast('فرستادن نشد'); } }, 60);
      return '';
    }

    function quoteIntoComposer(text, mode) {
      const c = pickComposer();
      if (!c || !c.actions) { toast('کادرِ نوشتن پیدا نشد'); return; }
      const a = c.actions;
      if (mode === 'plain') {
        if (!a.insertText(lineInsertion(c.draft, text) + '\n', a.captureInsertion())) toast('کادر الان قفل است');
        return;
      }
      let ok = false;
      try { ok = a.insertQuote(text); } catch (err) { ok = false; }
      if (!ok) ok = a.insertText(lineInsertion(c.draft, quoteBlock(text)) + '\n\n', a.captureInsertion());
      if (!ok) { toast('کادر الان قفل است'); return; }
      if (mode === 'ask') {
        window.setTimeout(() => { a.insertText('دربارهٔ این بخش توضیح بده: ', a.captureInsertion()); }, 40);
      }
    }

    /* --- نوارِ دکمه‌ها --------------------------------------------------- */
    /** جای پنل: بالای دکمهٔ aA، هم‌لبه با آن، داخلِ پنجره. */
    function popStyle(anchor) {
      if (!anchor || !anchor.getBoundingClientRect) return undefined;
      const r = anchor.getBoundingClientRect();
      const width = Math.min(400, window.innerWidth - 24);
      const left = Math.max(12, Math.min(r.left, window.innerWidth - width - 12));
      const bottom = Math.max(12, window.innerHeight - r.top + 6);
      return { left: left + 'px', right: 'auto', bottom: bottom + 'px', width: width + 'px', maxHeight: Math.max(240, r.top - 24) + 'px' };
    }
    function renderFloating(node, anchor) {
      const pop = h('div', { className: 'dsh-plus-pop', style: popStyle(anchor), onMouseDown: (e) => e.stopPropagation() }, node);
      if (ReactDOM && typeof ReactDOM.createPortal === 'function' && typeof document !== 'undefined') {
        return ReactDOM.createPortal(pop, document.body);
      }
      return h('div', { className: 'dsh-plus-pop dsh-plus-pop-inline', onMouseDown: (e) => e.stopPropagation() }, node);
    }

    function useDraft(props) {
      const hook = props && props.useInput;
      const read = (st) => (st && typeof st.draft === 'string' ? st.draft : '');
      return typeof hook === 'function' ? hook(read) || '' : '';
    }

    function QuickBar(props) {
      const s = usePlus();
      const where = props.where;
      const draft = useDraft(props);
      const sid = props.sessionId == null ? '' : String(props.sessionId);
      const actions = props.inputActions;
      const [open, setOpen] = React.useState(false);
      const [flash, setFlash] = React.useState('');
      const aaRef = React.useRef(null);
      React.useEffect(() => {
        if (where === 'dock' && sid) composers.set(sid, { sid: sid, actions: actions, draft: draft });
      });
      React.useEffect(() => () => {
        const cur = composers.get(sid);
        if (where === 'dock' && cur && cur.actions === actions) composers.delete(sid);
      }, [sid, actions, where]);
      const show = s.place === where || s.place === 'both';
      if (!show) return where === 'dock' ? h('div', { className: 'dsh-plus-anchor', 'data-dsh-plus-sid': sid }) : null;
      const run = (c) => {
        const msg = runCommand(c, actions, draft);
        if (msg) { setFlash(msg); window.setTimeout(() => setFlash(''), 3000); }
      };
      const buttons = commandsOf(s).map((c, i) => h('button', {
        key: i + ':' + c.label,
        type: 'button',
        className: 'dsh-plus-btn',
        'data-send': c.send ? '1' : undefined,
        title: (c.send ? '⏎ خودش می‌فرستد\n' : '') + c.text,
        onMouseDown: (e) => e.preventDefault(), // فوکوس و جای مکان‌نما در کادر بماند
        onClick: () => run(c),
      }, c.label));
      return h('div', { className: 'dsh-plus-bar', 'data-where': where, 'data-dsh-plus-sid': where === 'dock' ? sid : undefined, dir: 'rtl' },
        h('div', { className: 'dsh-plus-row' }, buttons),
        flash ? h('span', { className: 'dsh-plus-flash' }, flash) : null,
        h('button', {
          type: 'button',
          className: 'dsh-plus-btn dsh-plus-aa',
          ref: aaRef,
          title: 'تنظیماتِ ابزارها (aA) — Ctrl+Alt+B دکمه‌ها را پنهان/پیدا می‌کند',
          'aria-expanded': open ? 'true' : 'false',
          onMouseDown: (e) => e.preventDefault(),
          onClick: () => setOpen(!open),
        }, 'aA'),
        open ? renderFloating(h(PlusPanel, { onClose: () => setOpen(false) }), aaRef.current) : null);
    }

    function CounterPill(props) {
      const s = usePlus();
      const draft = useDraft(props);
      if (!s.counter || !draft) return null;
      return h('span', { className: 'dsh-plus-count', title: 'نویسه‌های کادرِ نوشتن' }, counterLabel(draft));
    }

    /* --- پنلِ aA --------------------------------------------------------- */
    function Line(label, control) {
      return h('div', { className: 'dsh-plus-line' }, h('label', null, label), control);
    }
    function NumberLine(label, key, s, opts) {
      const lim = PLUS_LIMITS[key];
      const step = (opts && opts.step) || 1;
      const set = (v) => patchPlus({ [key]: clampNumber(v, lim[0], lim[1], PLUS_DEFAULTS[key]) });
      return h('div', { className: 'dsh-plus-line' },
        h('label', null, label),
        h('input', { type: 'range', min: lim[0], max: lim[1], step: step, value: s[key], onChange: (e) => set(e.target.value) }),
        h('input', { type: 'number', min: lim[0], max: lim[1], step: step, value: s[key], onChange: (e) => set(e.target.value) }));
    }
    function ToggleLine(label, key, s, hint) {
      return h('label', { className: 'dsh-plus-line', title: hint || '' },
        h('span', null, label),
        h('input', { type: 'checkbox', checked: !!s[key], onChange: () => patchPlus({ [key]: !s[key] }) }));
    }
    function ColorLine(label, key, s) {
      return Line(label, h('span', { className: 'dsh-plus-actions' },
        h('input', { type: 'color', value: s[key] || '#888888', onChange: (e) => patchPlus({ [key]: e.target.value }) }),
        h('button', { type: 'button', onClick: () => patchPlus({ [key]: '' }) }, s[key] ? 'بی‌رنگ (تم)' : '— رنگِ تم')));
    }

    function ExtrasEditor(props) {
      const s = props.s;
      const [draft, setDraft] = React.useState('');
      const [confirm, setConfirm] = React.useState(-1);
      const [editing, setEditing] = React.useState(-1);
      const list = s.extras;
      const put = (next) => patchPlus({ extras: next });
      const move = (i, d) => {
        const j = i + d;
        if (j < 0 || j >= list.length) return;
        const next = list.slice();
        const tmp = next[i]; next[i] = next[j]; next[j] = tmp;
        put(next);
      };
      return h('div', { className: 'dsh-plus-list' },
        list.map((x, i) => h('div', { className: 'dsh-plus-item', key: i },
          h('input', { type: 'checkbox', checked: x.on, title: 'این متن بچسبد؟', onChange: () => put(list.map((y, k) => (k === i ? Object.assign({}, y, { on: !y.on }) : y))) }),
          editing === i
            ? h('textarea', { className: 'dsh-plus-grow', defaultValue: x.text, autoFocus: true, onBlur: (e) => { put(list.map((y, k) => (k === i ? Object.assign({}, y, { text: e.target.value }) : y)).filter((y) => y.text.trim())); setEditing(-1); } })
            : h('span', { className: 'dsh-plus-preview', title: x.text }, x.text),
          h('button', { type: 'button', title: 'اول یا آخرِ متن', onClick: () => put(list.map((y, k) => (k === i ? Object.assign({}, y, { pos: y.pos === 'start' ? 'end' : 'start' }) : y))) }, x.pos === 'start' ? 'اول' : 'آخر'),
          h('button', { type: 'button', title: 'روی دکمهٔ کپیِ زیرِ هر پاسخ هم بچسبد', style: { opacity: x.btn ? 1 : 0.45 }, onClick: () => put(list.map((y, k) => (k === i ? Object.assign({}, y, { btn: !y.btn }) : y))) }, '📋'),
          h('button', { type: 'button', title: 'بالاتر = جلوتر', onClick: () => move(i, -1) }, '↑'),
          h('button', { type: 'button', onClick: () => move(i, 1) }, '↓'),
          h('button', { type: 'button', title: 'ویرایش', onClick: () => setEditing(i) }, '✎'),
          h('button', { type: 'button', title: 'دو بار بزن تا پاک شود', onClick: () => { if (confirm === i) { put(list.filter((_, k) => k !== i)); setConfirm(-1); } else setConfirm(i); } }, confirm === i ? 'پاک؟' : '✕'))),
        h('textarea', { placeholder: 'متنِ ویژهٔ تازه — می‌تواند چندخطی باشد', value: draft, onChange: (e) => setDraft(e.target.value) }),
        h('div', { className: 'dsh-plus-actions' },
          h('button', { type: 'button', onClick: () => { if (!draft.trim()) return; put(list.concat([{ text: draft, on: true, pos: 'end', btn: false }])); setDraft(''); } }, '+ افزودن')));
    }

    function CommandsEditor(props) {
      const s = props.s;
      const [rows, setRows] = React.useState(() => commandsOf(s).map((c) => Object.assign({}, c)));
      const [msg, setMsg] = React.useState('');
      const set = (i, patch) => setRows(rows.map((r, k) => (k === i ? Object.assign({}, r, patch) : r)));
      const move = (i, d) => {
        const j = i + d;
        if (j < 0 || j >= rows.length) return;
        const next = rows.slice();
        const tmp = next[i]; next[i] = next[j]; next[j] = tmp;
        setRows(next);
      };
      return h('div', { className: 'dsh-plus-list' },
        rows.map((r, i) => h('div', { className: 'dsh-plus-item', key: i },
          h('input', { type: 'text', value: r.label, placeholder: 'کلمه', style: { width: '70px' }, onChange: (e) => set(i, { label: e.target.value }) }),
          h('textarea', { className: 'dsh-plus-grow', value: r.text, placeholder: 'متنی که در کادر می‌نشیند', style: { minHeight: '30px' }, onChange: (e) => set(i, { text: e.target.value }) }),
          h('label', { title: 'تیک: خودش می‌فرستد · بی‌تیک: فقط در کادر می‌گذارد' }, h('input', { type: 'checkbox', checked: !!r.send, onChange: () => set(i, { send: !r.send }) }), '⏎'),
          h('button', { type: 'button', onClick: () => move(i, -1) }, '↑'),
          h('button', { type: 'button', onClick: () => move(i, 1) }, '↓'),
          h('button', { type: 'button', onClick: () => setRows(rows.filter((_, k) => k !== i)) }, '×'))),
        h('div', { className: 'dsh-plus-actions' },
          h('button', { type: 'button', onClick: () => setRows(rows.concat([{ label: '', text: '', send: false }])) }, '+ دکمهٔ تازه'),
          h('button', { type: 'button', onClick: () => { const clean = normalizeCommands(rows); patchPlus({ commands: clean }); setRows(clean.map((c) => Object.assign({}, c))); setMsg('ذخیره شد ✓'); } }, 'ذخیرهٔ دکمه‌ها'),
          h('button', { type: 'button', onClick: () => { patchPlus({ commands: null }); setRows(DEFAULT_COMMANDS.map((c) => Object.assign({}, c))); setMsg('فهرستِ پیش‌فرض برگشت'); } }, 'لیستِ پیش‌فرض'),
          msg ? h('span', { className: 'dsh-plus-note' }, msg) : null));
    }

    function ProfilesEditor(props) {
      const s = props.s;
      const names = Object.keys(s.profiles);
      const [name, setName] = React.useState('');
      return h('div', { className: 'dsh-plus-actions' },
        h('select', { value: '', onChange: (e) => { if (e.target.value) { savePlus(loadProfile(plus, e.target.value)); toast('پروفایلِ «' + e.target.value + '» آمد'); } } },
          h('option', { value: '' }, names.length ? 'بارگذاریِ پروفایل…' : 'پروفایلی نیست'),
          names.map((n) => h('option', { key: n, value: n }, n))),
        h('input', { type: 'text', placeholder: 'نامِ پروفایل…', value: name, style: { width: '110px' }, onChange: (e) => setName(e.target.value) }),
        h('button', { type: 'button', onClick: () => { const n = name.trim(); if (!n) return; patchPlus({ profiles: Object.assign({}, plus.profiles, { [n]: profileSnapshot(plus) }) }); toast('پروفایلِ «' + n + '» ذخیره شد'); } }, 'ذخیره'),
        h('button', { type: 'button', onClick: () => { const n = name.trim(); if (!n || !plus.profiles[n]) return; const p = Object.assign({}, plus.profiles); delete p[n]; patchPlus({ profiles: p }); toast('پروفایلِ «' + n + '» پاک شد'); } }, 'حذف'));
    }

    function TransferEditor() {
      const [text, setText] = React.useState('');
      return h('div', { className: 'dsh-plus-list' },
        h('textarea', { className: 'dsh-plus-json', placeholder: 'تنظیماتِ کپی‌شده را این‌جا پیست کن…', value: text, onChange: (e) => setText(e.target.value) }),
        h('div', { className: 'dsh-plus-actions' },
          h('button', { type: 'button', title: 'همهٔ تنظیماتِ این بخش به‌صورتِ JSON', onClick: () => copyText(exportSettings(plus), 'تنظیمات کپی شد') }, 'کپیِ تنظیمات (sav)'),
          h('button', { type: 'button', onClick: () => { const r = importSettings(text); if (!r.ok) { toast(r.error); return; } savePlus(r.settings); setText(''); toast('تنظیمات اعمال شد'); } }, 'اعمال'),
          h('button', { type: 'button', title: 'برگشت به پیش‌فرض (پروفایل‌ها می‌مانند)', onClick: () => { savePlus({ profiles: plus.profiles }); toast('به پیش‌فرض برگشت'); } }, 'rst')));
    }

    function PlusPanel(props) {
      const s = usePlus();
      const onClose = props.onClose;
      React.useEffect(() => {
        if (!onClose) return undefined;
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', onKey, true);
        return () => document.removeEventListener('keydown', onKey, true);
      }, [onClose]);
      const identity = () => {
        const c = pickComposer();
        copyText(sessionIdentity(titleFromDocument(document.title), c && c.sid), 'شناسهٔ چت کپی شد');
      };
      return h('div', { className: 'dsh-plus-panel' + (props.inSettings ? ' dsh-plus-settings' : '') },
        h('div', { className: 'dsh-plus-head' },
          h('b', null, 'ابزارهای اکستنشن (aA)'),
          onClose ? h('button', { type: 'button', onClick: onClose, title: 'بستن (Esc)' }, '✕') : null),
        h('div', { className: 'dsh-plus-actions' },
          h('button', { type: 'button', onClick: () => savePlus(applyPreset(plus, 'compact')) }, 'فشرده'),
          h('button', { type: 'button', onClick: () => savePlus(applyPreset(plus, 'normal')) }, 'معمولی'),
          h('button', { type: 'button', onClick: () => savePlus(applyPreset(plus, 'large')) }, 'درشت')),
        h('h4', null, 'دکمه‌ها'),
        ToggleLine('دکمه‌های فرمان پیدا باشند (Ctrl+Alt+B)', 'buttons', s),
        Line('جای دکمه‌ها', h('select', { value: s.place, onChange: (e) => patchPlus({ place: e.target.value }) },
          h('option', { value: 'dock' }, 'بالای کادرِ نوشتن'),
          h('option', { value: 'header' }, 'سربرگِ چت (کنارِ اسمِ چت)'),
          h('option', { value: 'both' }, 'هر دو'))),
        NumberLine('اندازهٔ دکمه‌ها', 'btnSize', s),
        NumberLine('پُری دکمه‌ها ٪', 'opacity', s),
        ColorLine('رنگِ دکمه‌ها', 'accent', s),
        h('h4', null, 'گفتگو'),
        Line('پیامِ خودت', h('select', { value: String(s.lines), onChange: (e) => patchPlus({ lines: Number(e.target.value) }) },
          [1, 2, 3, 4, 6].map((n) => h('option', { key: n, value: String(n) }, faDigits(n) + ' خط (موس یا کلیک ⇒ کامل)')),
          h('option', { value: '0' }, 'کامل'))),
        NumberLine('مکثِ موس تا باز شدن (میلی‌ثانیه)', 'hoverMs', s, { step: 100 }),
        NumberLine('فاصلهٔ خطوط (۰ = خودِ برنامه)', 'lh', s),
        ColorLine('رنگِ متنِ گفتگو', 'textColor', s),
        ToggleLine('جدولِ پهن داخلِ خودش افقی بچرخد', 'tableScroll', s),
        ToggleLine('با فرستادن، صفحه به پایین نپرد', 'noJump', s, 'اگر بالاتر را می‌خواندی و Enter زدی، صفحه سرِ جایش می‌ماند؛ خودت پایین بروی، دوباره دنبالِ متنِ تازه می‌رود'),
        ToggleLine('کلیکِ راست روی متنِ انتخاب‌شده ⇒ منوی نقل‌قول (Ctrl+Alt+Q)', 'quoteMenu', s),
        ToggleLine('شمارندهٔ نویسه‌های کادر', 'counter', s),
        h('div', { className: 'dsh-plus-actions' },
          h('button', { type: 'button', onClick: () => openFind('') }, '🔍 جست‌وجو در گفتگو (Ctrl+Alt+F)'),
          h('button', { type: 'button', title: 'خطِ آماده برای session_send از چتِ دیگر', onClick: identity }, 'کپیِ شناسهٔ چت')),
        h('h4', null, 'متن‌های ویژه — تیک بزن کدام‌ها هنگامِ کپی بچسبند (بالاتر جلوتر)'),
        h(ExtrasEditor, { s: s }),
        h('h4', null, 'فهرستِ دکمه‌ها (کلمه · متن · ⏎ خودش بفرستد)'),
        h(CommandsEditor, { s: s }),
        h('h4', null, 'پروفایل'),
        h(ProfilesEditor, { s: s }),
        h('h4', null, 'انتقالِ تنظیمات'),
        h(TransferEditor, null),
        h('p', { className: 'dsh-plus-note' },
          'اندازهٔ فونتِ متن و کد را خودِ DSH دارد: Settings ← General ← Appearance. نقل‌قولِ یک‌کلیکی هم از خودِ DSH است (دکمهٔ Quote روی متنِ انتخاب‌شده)؛ این منو گزینه‌های بیشتری اضافه می‌کند. همه‌چیز در همین مرورگر ذخیره می‌شود.'));
    }

    /* --- جست‌وجو در گفتگو (بی‌دست‌زدن به DOM ِ React: CSS Highlight API) --- */
    const findState = { box: null, input: null, info: null, ranges: [], idx: -1 };
    function clearFindHighlights() {
      const hl = window.CSS && window.CSS.highlights;
      if (hl) { hl.delete('dsh-plus-find'); hl.delete('dsh-plus-find-now'); }
      findState.ranges = [];
      findState.idx = -1;
    }
    function closeFind() {
      clearFindHighlights();
      if (findState.box) findState.box.remove();
      findState.box = null;
    }
    function runFind() {
      clearFindHighlights();
      const q = findState.input ? findState.input.value.trim() : '';
      if (!q) { findState.info.textContent = ''; return; }
      const hl = window.CSS && window.CSS.highlights;
      const roots = document.querySelectorAll('[data-conversation-scroll]');
      const ranges = [];
      for (let r = 0; r < roots.length && ranges.length < 2000; r += 1) {
        const walker = document.createTreeWalker(roots[r], NodeFilter.SHOW_TEXT, {
          acceptNode(node) {
            const p = node.parentElement;
            if (!p || p.closest('[contenteditable="true"],#dsh-plus-find,.dsh-plus-bar,.dsh-plus-pop,script,style')) return NodeFilter.FILTER_REJECT;
            return NodeFilter.FILTER_ACCEPT;
          },
        });
        let node = walker.nextNode();
        while (node && ranges.length < 2000) {
          const spans = findRanges(node.nodeValue, q);
          for (let k = 0; k < spans.length; k += 1) {
            const range = document.createRange();
            range.setStart(node, spans[k][0]);
            range.setEnd(node, spans[k][1]);
            ranges.push(range);
          }
          node = walker.nextNode();
        }
      }
      findState.ranges = ranges;
      if (hl && ranges.length && typeof window.Highlight === 'function') hl.set('dsh-plus-find', new window.Highlight(...ranges));
      if (!ranges.length) { findState.info.textContent = 'چیزی پیدا نشد'; return; }
      goFind(0);
    }
    function goFind(i) {
      const n = findState.ranges.length;
      if (!n) return;
      findState.idx = ((i % n) + n) % n;
      const range = findState.ranges[findState.idx];
      const hl = window.CSS && window.CSS.highlights;
      if (hl && typeof window.Highlight === 'function') hl.set('dsh-plus-find-now', new window.Highlight(range));
      const el = range.startContainer && range.startContainer.parentElement;
      if (el && el.scrollIntoView) el.scrollIntoView({ block: 'center' });
      findState.info.textContent = faDigits(findState.idx + 1) + ' از ' + faDigits(n);
    }
    function openFind(q) {
      if (!findState.box) {
        const box = document.createElement('div');
        box.id = 'dsh-plus-find';
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'جست‌وجو در گفتگو…';
        const info = document.createElement('span');
        const mk = (label, title, fn) => {
          const b = document.createElement('button');
          b.type = 'button'; b.textContent = label; b.title = title;
          b.addEventListener('click', fn);
          return b;
        };
        let timer = 0;
        input.addEventListener('input', () => { window.clearTimeout(timer); timer = window.setTimeout(runFind, 150); });
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeFind(); return; }
          if (e.key === 'Enter') { e.preventDefault(); goFind(findState.idx + (e.shiftKey ? -1 : 1)); }
        });
        box.appendChild(input);
        box.appendChild(info);
        box.appendChild(mk('↑', 'قبلی (Shift+Enter)', () => goFind(findState.idx - 1)));
        box.appendChild(mk('↓', 'بعدی (Enter)', () => goFind(findState.idx + 1)));
        box.appendChild(mk('✕', 'بستن (Esc)', closeFind));
        document.body.appendChild(box);
        findState.box = box; findState.input = input; findState.info = info;
      }
      if (typeof q === 'string' && q) findState.input.value = q;
      findState.input.focus();
      findState.input.select();
      runFind();
    }

    /* --- منوی کلیکِ راست ------------------------------------------------- */
    function closeCtx() {
      const m = document.getElementById('dsh-plus-ctx');
      if (m) m.style.display = 'none';
    }
    function openCtx(x, y, text) {
      let m = document.getElementById('dsh-plus-ctx');
      if (!m) {
        m = document.createElement('div');
        m.id = 'dsh-plus-ctx';
        m.setAttribute('role', 'menu');
        document.body.appendChild(m);
      }
      m.textContent = '';
      const short = text.length > 30 ? text.slice(0, 30) + '…' : text;
      const items = [];
      if (plus.extras.some((e) => e.on)) items.push(['⧉ کپی با الصاقِ متنِ ویژه', () => copyText(withExtras(text, plus.extras, 'menu'), 'با متنِ ویژه کپی شد')]);
      items.push(['↩︎ نقل‌قول در چت', () => quoteIntoComposer(text, 'quote')]);
      items.push(['✎ بدونِ علامتِ نقل‌قول', () => quoteIntoComposer(text, 'plain')]);
      items.push(['⧉ کپی', () => copyText(text)]);
      items.push(['🔍 جست‌وجوی همین متن', () => openFind(text.slice(0, 60))]);
      items.push(['؟ بپرس دربارهٔ «' + short + '»', () => quoteIntoComposer(text, 'ask')]);
      items.forEach((it) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.setAttribute('role', 'menuitem');
        b.textContent = it[0];
        b.addEventListener('mousedown', (ev) => ev.preventDefault());
        b.addEventListener('click', (ev) => { ev.preventDefault(); closeCtx(); it[1](); });
        m.appendChild(b);
      });
      m.style.display = 'flex';
      m.style.left = '0px';
      m.style.top = '0px';
      const r = m.getBoundingClientRect();
      m.style.left = Math.max(4, Math.min(x, window.innerWidth - r.width - 6)) + 'px';
      m.style.top = Math.max(4, Math.min(y, window.innerHeight - r.height - 6)) + 'px';
    }
    function selectionInChat() {
      const sel = window.getSelection ? window.getSelection() : null;
      const text = sel ? String(sel).trim() : '';
      if (!text || !sel.anchorNode) return '';
      const el = sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement;
      if (!el || !el.closest('[data-conversation-scroll]')) return '';
      if (el.closest('[contenteditable="true"],input,textarea')) return '';
      return text;
    }

    /* --- «پایین نپر» ----------------------------------------------------- */
    const jump = { sc: null, saved: null, until: 0, acted: false, nudged: false, raf: 0 };
    function mainScroller() {
      const all = document.querySelectorAll('[data-conversation-scroll]');
      let best = null;
      for (let i = 0; i < all.length; i += 1) if (!best || all[i].clientWidth > best.clientWidth) best = all[i];
      return best;
    }
    function guardJump() {
      const sc = jump.sc;
      if (!sc) return;
      if (shouldRestoreScroll({ savedTop: jump.saved, top: sc.scrollTop, userActed: jump.acted, now: Date.now(), until: jump.until })) {
        sc.scrollTop = jump.saved;
        if (!jump.nudged) {
          jump.nudged = true;
          // به خودِ برنامه بفهمان «خواننده بالا رفت» تا دنبال‌کردنِ ته را رها کند
          try { sc.dispatchEvent(new WheelEvent('wheel', { deltaY: -1, bubbles: true, cancelable: true })); } catch (err) { /* قدیمی */ }
        }
      }
    }
    function armNoJump() {
      if (!plus.noJump) return;
      const sc = mainScroller();
      if (!sc || nearBottom(sc.scrollTop, sc.scrollHeight, sc.clientHeight)) return;
      jump.sc = sc; jump.saved = sc.scrollTop; jump.until = Date.now() + 4000; jump.acted = false; jump.nudged = false;
      window.cancelAnimationFrame(jump.raf);
      const tick = () => {
        guardJump();
        if (Date.now() < jump.until && !jump.acted) jump.raf = window.requestAnimationFrame(tick);
        else jump.sc = null;
      };
      jump.raf = window.requestAnimationFrame(tick);
      sc.addEventListener('scroll', guardJump, { passive: true });
      window.setTimeout(() => sc.removeEventListener('scroll', guardJump), 4100);
    }

    /* --- همهٔ رفتارهای DOM ِ این بخش؛ پاک‌شدنی با ctx.effect --------------- */
    function startPlusDom() {
      const off = [];
      const on = (target, type, fn, opt) => { target.addEventListener(type, fn, opt); off.push(() => target.removeEventListener(type, fn, opt)); };

      plusStyle = document.createElement('style');
      plusStyle.setAttribute('data-dsh-rtl', 'plus');
      document.head.appendChild(plusStyle);
      applyPlusCss();

      // پیامِ بلند نشان می‌خورد تا فقط همان محو و کلیک‌پذیر شود
      let longTimer = 0;
      const markLong = () => {
        const bubbles = document.querySelectorAll('[data-conversation-scroll] [data-message-bubble]');
        for (let i = 0; i < bubbles.length; i += 1) {
          const b = bubbles[i];
          if (b.hasAttribute('data-dsh-plus-open')) continue;
          const long = plus.lines > 0 && b.scrollHeight > b.clientHeight + 2;
          if (long) b.setAttribute('data-dsh-plus-long', ''); else b.removeAttribute('data-dsh-plus-long');
        }
      };
      const observer = new MutationObserver(() => { window.clearTimeout(longTimer); longTimer = window.setTimeout(markLong, 300); });
      observer.observe(document.body, { childList: true, subtree: true });
      off.push(() => { observer.disconnect(); window.clearTimeout(longTimer); });
      plusListeners.add(markLong);
      off.push(() => plusListeners.delete(markLong));
      window.setTimeout(markLong, 500);

      // موس روی پیامِ خودت بماند ⇒ کامل باز می‌شود؛ برود ⇒ بسته؛ کلیک ⇒ باز می‌ماند
      let hoverTimer = 0;
      let hoverEl = null;
      on(document, 'mouseover', (e) => {
        const b = e.target && e.target.closest ? e.target.closest('[data-conversation-scroll] [data-message-bubble]') : null;
        if (b === hoverEl) return;
        window.clearTimeout(hoverTimer);
        if (hoverEl && hoverEl.getAttribute('data-dsh-plus-open') === 'hover') hoverEl.removeAttribute('data-dsh-plus-open');
        hoverEl = b;
        if (b && plus.lines > 0 && b.hasAttribute('data-dsh-plus-long') && !b.hasAttribute('data-dsh-plus-open')) {
          hoverTimer = window.setTimeout(() => b.setAttribute('data-dsh-plus-open', 'hover'), plus.hoverMs);
        }
      }, true);
      on(document, 'click', (e) => {
        if (plus.lines <= 0) return;
        const t = e.target;
        if (!t || !t.closest || t.closest('a,button,input,textarea,select,[role="button"],[contenteditable="true"]')) return;
        const b = t.closest('[data-conversation-scroll] [data-message-bubble]');
        if (!b) return;
        const sel = window.getSelection ? String(window.getSelection()) : '';
        if (sel) return;
        if (b.getAttribute('data-dsh-plus-open') === 'pin') b.removeAttribute('data-dsh-plus-open');
        else if (b.hasAttribute('data-dsh-plus-long') || b.hasAttribute('data-dsh-plus-open')) b.setAttribute('data-dsh-plus-open', 'pin');
      }, true);

      // منوی کلیکِ راست
      on(document, 'contextmenu', (e) => {
        if (!plus.quoteMenu) return;
        const text = selectionInChat();
        if (!text) return;
        e.preventDefault();
        e.stopPropagation();
        openCtx(e.clientX, e.clientY, text);
      }, true);
      on(document, 'mousedown', (e) => {
        const m = document.getElementById('dsh-plus-ctx');
        if (m && !m.contains(e.target)) closeCtx();
      }, true);
      on(document, 'scroll', closeCtx, true);

      // میان‌برها
      on(document, 'keydown', (e) => {
        if (e.key === 'Escape') closeCtx();
        if (!(e.ctrlKey && e.altKey) || e.metaKey) return;
        if (e.code === 'KeyQ') {
          const text = selectionInChat();
          if (!text) return;
          e.preventDefault();
          quoteIntoComposer(text, 'quote');
        } else if (e.code === 'KeyF') {
          e.preventDefault();
          openFind(selectionInChat().slice(0, 60));
        } else if (e.code === 'KeyB') {
          e.preventDefault();
          patchPlus({ buttons: !plus.buttons });
          toast(plus.buttons ? 'دکمه‌ها پیدا شدند' : 'دکمه‌ها پنهان شدند (Ctrl+Alt+B)');
        }
      }, true);

      // «پایین نپر»: Enter در کادرِ نوشتن یا کلیکِ دکمهٔ فرستادن
      on(document, 'keydown', (e) => {
        if (e.key !== 'Enter' || e.shiftKey || e.altKey || e.isComposing || e.keyCode === 229) return;
        const t = e.target;
        if (!t || !t.isContentEditable || (t.closest && t.closest('[data-message-bubble]'))) return;
        armNoJump();
      }, true);
      on(document, 'pointerdown', (e) => {
        const b = e.target && e.target.closest ? e.target.closest('button[aria-label]') : null;
        if (!b) return;
        const label = b.getAttribute('aria-label') || '';
        if (/^(Send|Queue message|Steer message)/.test(label)) window.setTimeout(armNoJump, 0);
      }, true);
      const acted = (e) => { if (e.isTrusted) jump.acted = true; };
      on(document, 'wheel', acted, { capture: true, passive: true });
      on(document, 'touchmove', acted, { capture: true, passive: true });
      on(document, 'pointerdown', (e) => { if (jump.sc && e.target === jump.sc) jump.acted = true; }, true);
      on(document, 'keydown', (e) => {
        if (/^(PageUp|PageDown|Home|End|ArrowUp|ArrowDown)$/.test(e.key) && !(e.target && e.target.isContentEditable)) jump.acted = true;
      }, true);

      // دکمهٔ کپیِ زیرِ پاسخ ⇒ متن‌های ویژهٔ 📋دار هم می‌چسبند
      let armedUntil = 0;
      on(document, 'click', (e) => {
        const b = e.target && e.target.closest ? e.target.closest('button[aria-label="Copy"]') : null;
        if (b && b.closest('[data-conversation-scroll]') && !b.closest('pre,[data-code-block-banner]')) armedUntil = Date.now() + 1000;
      }, true);
      const cb = navigator.clipboard;
      if (cb && typeof cb.writeText === 'function' && !cb.writeText.__dshPlus) {
        const orig = cb.writeText;
        origWriteText = orig.bind(cb);
        const wrapped = function (t) {
          const hit = Date.now() < armedUntil;
          armedUntil = 0;
          if (hit && typeof t === 'string' && plus.extras.some((x) => x.on && x.btn)) t = withExtras(t, plus.extras, 'btn');
          return origWriteText(t);
        };
        wrapped.__dshPlus = true;
        try { cb.writeText = wrapped; off.push(() => { try { cb.writeText = orig; } catch (err) { /* */ } }); } catch (err) { /* فقط‌خواندنی */ }
      }

      return () => {
        off.forEach((fn) => { try { fn(); } catch (err) { /* */ } });
        closeFind();
        closeCtx();
        const t = document.getElementById('dsh-plus-toast');
        if (t) t.remove();
        const m = document.getElementById('dsh-plus-ctx');
        if (m) m.remove();
        if (plusStyle) plusStyle.remove();
        plusStyle = null;
        const marked = document.querySelectorAll('[data-dsh-plus-open],[data-dsh-plus-long]');
        for (let i = 0; i < marked.length; i += 1) { marked[i].removeAttribute('data-dsh-plus-open'); marked[i].removeAttribute('data-dsh-plus-long'); }
      };
    }

    /* ------------------------------------------------------------------ *
     * Plugin body
     * ------------------------------------------------------------------ */
    return {
      inject: ['slots'],
      apply(ctx) {
        applyDom();
        if (typeof window !== 'undefined') {
          window.addEventListener('storage', (event) => {
            if (event.key !== STORE_KEY || !event.newValue) return;
            try {
              prefs = Object.assign({}, DEFAULTS, JSON.parse(event.newValue));
              applyDom();
              listeners.forEach((fn) => fn());
            } catch (err) {
              /* ignore malformed cross-tab payloads */
            }
          });
        }

        ctx.effect(() => {
          const style = document.createElement('style');
          style.setAttribute('data-dsh-rtl', 'stylesheet');
          style.textContent = CSS;
          document.head.appendChild(style);
          return () => {
            style.remove();
          };
        }, 'dsh-rtl:stylesheet');

        ctx.effect(() => () => restoreDom(), 'dsh-rtl:document-direction');

        /* the alignment pass: once now, then debounced after DOM changes */
        ctx.effect(() => {
          let timer = 0;
          const schedule = () => {
            window.clearTimeout(timer);
            timer = window.setTimeout(alignPass, 400);
          };
          alignPass();
          const observer = new MutationObserver(schedule);
          observer.observe(document.body, { childList: true, subtree: true });
          return () => {
            window.clearTimeout(timer);
            observer.disconnect();
            clearAlignPass();
          };
        }, 'dsh-rtl:alignment');

        ctx.effect(() => startPlusDom(), 'dsh-rtl:plus-dom');

        /* دکمه‌های فرمانِ سریع: بالای کادرِ نوشتن و/یا سربرگِ چت */
        try {
          ctx.slots.inject('conversation.input.dock', () => ctx.slots.register({
            name: 'conversation.input.dock',
            id: 'dsh-rtl-quick',
            order: 50,
          }, (props) => h(QuickBar, Object.assign({}, props, { where: 'dock' }))));
        } catch (err) { console.warn('dsh-rtl: quick dock', err); }
        try {
          ctx.slots.inject('conversation.session.header.actions', () => ctx.slots.register({
            name: 'conversation.session.header.actions',
            id: 'dsh-rtl-quick',
            order: 90,
          }, (props) => h(QuickBar, Object.assign({}, props, { where: 'header' }))));
        } catch (err) { console.warn('dsh-rtl: quick header', err); }
        try {
          ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register({
            name: 'conversation.composer.dock',
            id: 'dsh-rtl-counter',
            order: 1,
          }, CounterPill));
        } catch (err) { console.warn('dsh-rtl: counter', err); }

        ctx.slots.inject('settings.section', () =>
          ctx.slots.register(
            {
              name: 'settings.section',
              id: 'rtl',
              order: 18,
              label: () => 'راست‌به‌چپ (RTL)',
            },
            RtlSection,
          ),
        );
      },
    };
  },
});