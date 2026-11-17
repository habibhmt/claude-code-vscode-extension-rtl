window.__ModuleLoader__.load({
  id: '@local/dsh-rtl',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    /* ctx ِ نیمهٔ کلاینت (برای پرسیدنِ پوشهٔ کار و تنظیم‌های خودِ برنامه) */
    let clientCtx = null;

    // DSH's generic tool card shows the first recorded result, even after an
    // append-only history repair. Claude's ToolSearch returns names to display.
    function ClaudeToolSearchResult({ block, callId, phase, searchHistory, inspect }) {
      const subscribe = React.useCallback(listener => searchHistory?.subscribe(listener) || (() => {}), [searchHistory]);
      const read = React.useCallback(() => {
        if (phase !== 'result') return null;
        const repair = searchHistory?.getSnapshot().entries.findLast(({ event }) =>
          event.type === 'tool/result' && event.surfaceOp?.op === 'replace' &&
          event.surfaceOp.startSeq === block.seq && event.data.message.toolCallId === callId &&
          event.data.message.id?.startsWith('claude-history:'));
        return repair?.event.data.message.content || block.content;
      }, [block, callId, phase, searchHistory]);
      const content = React.useSyncExternalStore(subscribe, read);
      const text = (content || []).filter(item => item.type === 'text').map(item => item.text).join('\n');
      return h('details', null,
        h('summary', null, h('bdi', null, 'ToolSearch'), ' · جست‌وجوی ابزار'),
        h('div', { dir: 'auto' }, block.args?.text?.('query') || ''),
        text && h('pre', { dir: 'auto', style: { whiteSpace: 'pre-wrap' } }, text),
        inspect && h('button', { type: 'button', onClick: inspect }, 'جزئیات اجرا'));
    }

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
      aaTaze: true,       // در چتِ تازه، aA خودش روی تبِ «ابزارها» باز شود (حبیب، ۱۶ نوامبر)
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
    /* #region settings-inline — تولیدِ خودکار از settings-pure.js (tools/sync-plus.mjs) */

    /* ---------- سطح‌ها ---------- */

    /** ترتیبِ سطح‌ها از قوی‌تر به ضعیف‌تر (اولی برنده است). */
    const LEVELS = ['chat', 'project', 'global']

    /** نامِ فارسیِ سطح‌ها برای صفحه. */
    const LEVEL_NAMES = { global: 'سراسری', project: 'پروژه', chat: 'چت' }

    /** نامِ فارسیِ پیش‌فرض (وقتی هیچ سطحی مقداری ندارد). */
    const LEVEL_DEFAULT_NAME = 'پیش‌فرض'

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
    function readLayers(raw, keys) {
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
    function effectiveOf(layers, key, fallback) {
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
    function levelName(level) {
      return level === 'default' ? LEVEL_DEFAULT_NAME : (LEVEL_NAMES[level] || LEVEL_DEFAULT_NAME)
    }

    /**
     * یک لایه را عوض می‌کند بی‌آن‌که بقیه دست بخورند.
     * value === undefined ⇒ آن کلید از آن سطح پاک می‌شود.
     * @returns لایه‌های تازه (شیءِ نو؛ ورودی دست نمی‌خورد)
     */
    function setAt(layers, level, key, value) {
      const base = plainObject(layers) || {}
      if (!LEVELS.includes(level)) throw new Error('سطحِ نامعلوم: ' + String(level))
      const next = { global: { ...(plainObject(base.global) || {}) }, project: { ...(plainObject(base.project) || {}) }, chat: { ...(plainObject(base.chat) || {}) } }
      if (value === undefined) delete next[level][key]
      else next[level][key] = value
      return next
    }

    /** مقدارِ ذخیره‌شده در یک سطح (یا undefined). */
    function valueAt(layers, level, key) {
      const wrap = plainObject(layers) || {}
      const layer = plainObject(wrap[level])
      return layer && Object.prototype.hasOwnProperty.call(layer, key) ? layer[key] : undefined
    }

    /* ---------- امنیتِ شناسه و مسیر ---------- */

    /** شناسهٔ چتِ مجاز: حرف/رقم/نقطه/خط‌تیره/زیرخط، تا ۱۲۸ نویسه، بیِ «..». */
    const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/

    /**
     * آیا این شناسهٔ چت برای ساختنِ نامِ پرونده بی‌خطر است؟
     * «../..» و خالی و بی‌حرف و بلند رد می‌شوند.
     * @param {unknown} id
     * @returns {boolean}
     */
    function isSafeId(id) {
      if (typeof id !== 'string') return false
      if (!SAFE_ID.test(id)) return false
      if (id.includes('..')) return false
      return true
    }

    /** الگوی مسیرِ مطلقِ پوشه: /... یا C:\... یا \\\\server\\... */
    function isAbsolutePath(path) {
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
    function unsafeWorkspace(path, home) {
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
    function validatePref(key, value, tools) {
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
    const STRUCTURAL_PLUS_KEYS = ['commands', 'extras', 'profiles']

    /** همهٔ کلیدهای کلِ dsh-rtl برای بررسیِ اعتبار (booleans + plus). */
    function allKeys(prefsDefaults, plusDefaults) {
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
    function matchesQuery(hay, query) {
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
    const APP_KEY_FA = {
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
    const SECRET_KEY = /(secret|token|apikey|api_key|api-key|password|passwd|credential|authorization|^key$|_key$|keyid|bearer|cookie|session_?key|private)/i

    /** آیا این کلیدِ تنظیم راز است؟ (هیچ‌وقت مقدارش نشان داده نمی‌شود) */
    function isSecretKey(key) {
      return SECRET_KEY.test(String(key || ''))
    }

    /**
     * مقدارِ نهایی برای نمایش: بولی ⇒ روشن/خاموش · خالی ⇒ «—» · راز ⇒ «••••••».
     * @param {unknown} value
     * @param {string} key
     * @returns {string}
     */
    function displayValue(value, key) {
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
    function appSettingRows(view, locale) {
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
    function cleanFile(raw, keys) {
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
    function nowLine(info) {
      const text = info.value === undefined ? '—' : (typeof info.value === 'boolean' ? (info.value ? 'روشن' : 'خاموش') : String(info.value))
      const meaning = info.meaning ? '؛ یعنی ' + info.meaning : ''
      return 'الان: ' + text + ' از ' + levelName(info.level) + meaning
    }
    /* #endregion settings-inline */
    /* #region tik-inline — تولیدِ خودکار از tik-pure.js (tools/sync-plus.mjs) */

    /** دسته‌های چهارگانه، به همان ترتیبی که در تب می‌آیند. */
    const TIK_KIND = ['abzar_dsh', 'mcp', 'afzune', 'eskil']

    /** سه سطح. */
    const TIK_SATH = ['chat', 'poshe', 'sarasari']

    /** نامِ فارسیِ هر دسته، برای سرصفحهٔ تب. */
    const TIK_KIND_LABEL = {
      abzar_dsh: 'ابزارهای خودِ DSH',
      mcp: 'MCP (سرورهای ابزارِ بیرونی)',
      afzune: 'افزونه‌ها',
      eskil: 'اسکیل‌ها',
    }

    /** @returns {boolean} آیا این نام یک دستهٔ شناخته‌شده است. */
    function isKind(kind) {
      return TIK_KIND.includes(kind)
    }

    /** @returns {boolean} آیا این نام یک سطحِ شناخته‌شده است. */
    function isSath(sath) {
      return TIK_SATH.includes(sath)
    }

    /**
     * فهرستِ خالیِ چهار دسته.
     * @returns {Record<string, Record<string, boolean>>}
     */
    function emptyList() {
      const out = {}
      for (const k of TIK_KIND) out[k] = {}
      return out
    }

    /**
     * یک فهرست را از هر شکلِ ورودی، سالم و کامل می‌کند (بی‌آنکه چیزی را حذف کند).
     * ورودیِ خراب ⇒ فهرستِ خالی؛ هرگز خطا نمی‌دهد، چون در فایلِ کاربر ممکن است
     * هر چیزی باشد و ما باید همیشه بتوانیم ادامه بدهیم.
     * @param value هر چیزی که خوانده‌ایم.
     * @returns {Record<string, Record<string, boolean>>}
     */
    function cleanList(value) {
      const out = emptyList()
      if (!value || typeof value !== 'object' || Array.isArray(value)) return out
      for (const kind of TIK_KIND) {
        const part = value[kind]
        if (!part || typeof part !== 'object' || Array.isArray(part)) continue
        for (const [name, on] of Object.entries(part)) {
          const n = String(name || '').trim()
          if (!n) continue
          if (typeof on === 'boolean') out[kind][n] = on
        }
      }
      return out
    }

    /**
     * دو فهرست را روی هم می‌گذارد: هرچه `over` دارد، برنده است.
     * @param base فهرستِ پایه.
     * @param over فهرستِ رو.
     * @returns فهرستِ تازه (هر دو دست‌نخورده می‌مانند).
     */
    function mergeList(base, over) {
      const a = cleanList(base)
      const b = cleanList(over)
      const out = emptyList()
      for (const kind of TIK_KIND) Object.assign(out[kind], a[kind], b[kind])
      return out
    }

    /**
     * عمیق‌ترین پوشه‌ای که برای این مسیر فهرست دارد.
     * «عمیق‌تر» یعنی مسیرِ طولانی‌تر که پیشوندِ مسیرِ چت باشد؛ مرزِ اسلش رعایت می‌شود
     * تا «/a/bc» با «/a/b» قاطی نشود.
     * @param cwd پوشهٔ چت.
     * @param poshe‌ها نقشهٔ «مسیرِ پوشه ⇒ فهرست».
     * @returns {string|null} مسیرِ برنده، یا null.
     */
    function deepestFolder(cwd, folders) {
      const path = normPath(cwd)
      if (!path || !folders || typeof folders !== 'object') return null
      let best = null
      for (const key of Object.keys(folders)) {
        const p = normPath(key)
        if (!p) continue
        if (path !== p && !path.startsWith(p + '/')) continue
        if (best === null || p.split('/').length > normPath(best).split('/').length) best = key
      }
      return best
    }

    /** آیا این فهرست دستِ‌کم یک تیک دارد؟ */
    function hasAny(list) {
      const c = cleanList(list)
      for (const kind of TIK_KIND) if (Object.keys(c[kind]).length > 0) return true
      return false
    }

    /** مسیر را برای مقایسه یکدست می‌کند: اسلشِ آخر برداشته، چند اسلشِ پشتِ‌هم یکی. */
    function normPath(p) {
      return String(p || '').trim().replace(/\/{2,}/g, '/').replace(/\/+$/, '')
    }

    /**
     * فهرستِ موثرِ یک چت. ترتیب: چت ⇒ عمیق‌ترین پوشه ⇒ سراسری ⇒ پایه.
     * @param opts { chat, cwd, chatList, folderLists, globalList, baseList }
     * @returns {{ list: Record<string, Record<string, boolean>>, az: string, folder: string|null }}
     *   `az` می‌گوید این تصمیم از کدام سطح آمده (برای نمایش در تب).
     */
    function effectiveList(opts) {
      const o = opts || {}
      const chatKey = String(o.chat || '').trim()
      const chatList = chatKey && o.chatLists && o.chatLists[chatKey] ? o.chatLists[chatKey] : null
      const folder = deepestFolder(o.cwd, o.folderLists)
      const folderList = folder ? o.folderLists[folder] : null
      let list = cleanList(o.baseList)
      let az = 'paye'
      // فقط اگر فهرستِ سراسری واقعاً چیزی داشته باشد، در گزارش «سراسری» می‌شود؛
      // وگرنه مشتی صفر نشان داده می‌شد که دروغ است (سنجیده شد: با پروندهٔ نبوده «sarasari» می‌داد).
      if (o.globalList && hasAny(o.globalList)) { list = mergeList(list, o.globalList); az = 'sarasari' }
      if (folderList) { list = mergeList(list, folderList); az = 'poshe' }
      if (chatList) { list = mergeList(list, chatList); az = 'chat' }
      return { list: list, az: az, folder: folder }
    }

    /**
     * ابزارهایی که باید از فهرستِ مدل برداشته شوند (برای `agent.ctx.tools.restrict`).
     * فقط ابزارهایی که «خاموش» شده‌اند برمی‌گردند؛ نام‌هایی که در فهرستِ موجود نیستند
     * دور ریخته می‌شوند تا `restrict` خطای «unknown global tool» ندهد.
     * دو راهِ خاموشی: تیکِ ابزارِ خودِ DSH (`abzar_dsh`)، و تیکِ سرورِ MCP که ابزارهای
     * «mcp__سرور__ابزار» را با خودش می‌برد.
     * @param opts همان ورودیِ `effectiveList` به‌علاوهٔ `known` (نام‌های موجود).
     * @returns {string[]}
     */
    function deniedTools(opts) {
      const o = opts || {}
      const known = Array.isArray(o.known) ? o.known : []
      const { list } = effectiveList(o)
      const off = list.abzar_dsh || {}
      const out = new Set(known.filter((name) => off[name] === false))
      // MCP ِ خاموش، ابزارهایش را هم می‌برد («mcp__سرور__ابزار»)، وگرنه تیکِ مکپ بی‌اثر می‌ماند.
      const offMcp = list.mcp || {}
      for (const name of known) {
        if (!name.startsWith('mcp__')) continue
        const rest = name.slice('mcp__'.length)
        const at = rest.indexOf('__')
        const server = at > 0 ? rest.slice(0, at) : rest
        if (offMcp[server] === false) out.add(name)
      }
      return [...out]
    }

    /**
     * نامِ گروهِ یک چیز: ابزارِ افزونه یا MCP ِ یک افزونه، زیرِ همان افزونه می‌رود.
     * (همان کاری که در کلود کد کردیم: افزونه‌ای که خاموش است، اسکیل و MCP ِ خودش را هم می‌برد.)
     * @param opts { name, kind, plugins, isPluginChild }
     * @returns {string} نامِ گروه.
     */
    function groupOf(opts) {
      const o = opts || {}
      const name = String(o.name || '')
      if (o.kind === 'afzune') return name
      const plug = pluginOwner(o, name)
      return plug || name
    }

    /**
     * اگر این نام به افزونه‌ای تعلق دارد، نامِ آن افزونه را برمی‌گرداند.
     * @param opts { name, kind, plugins }
     * @returns {string|null}
     */
    function pluginOwner(opts) {
      const o = opts || {}
      if (o.kind === 'afzune') return null
      const plugins = Array.isArray(o.plugins) ? o.plugins : []
      const name = String(o.name || '')
      if (!name) return null
      // «plugin:server» برای MCP و «plugin:skill» یا پیشوندِ افزونه برای اسکیل
      const colon = name.indexOf(':')
      if (colon > 0) {
        const head = name.slice(0, colon)
        if (plugins.includes(head)) return head
      }
      for (const p of plugins) {
        if (!p || p === name) continue
        if (name.startsWith(p + ':') || name.startsWith(p + '-') || name.startsWith(p + '/')) return p
      }
      return null
    }

    /**
     * یک تغییر را روی فهرستِ یک سطح اعمال می‌کند و همان فهرستِ تازه را می‌دهد.
     * @param list فهرستِ آن سطح.
     * @param change { kind, name, on }.
     * @returns فهرستِ تازه.
     */
    function applyChange(list, change) {
      const out = cleanList(list)
      const c = change || {}
      if (!isKind(c.kind)) return out
      const name = String(c.name || '').trim()
      if (!name) return out
      out[c.kind][name] = c.on !== false
      return out
    }

    /**
     * تغییرها را یکی‌یکی روی یک فهرست اعمال می‌کند.
     * @param list فهرستِ پایه.
     * @param changes فهرستِ تغییرها.
     * @returns فهرستِ تازه.
     */
    function applyChanges(list, changes) {
      let out = cleanList(list)
      for (const c of Array.isArray(changes) ? changes : []) out = applyChange(out, c)
      return out
    }

    /**
     * نمودارِ چهار دسته برای نمایش در تب، به‌ترتیبِ حبیب و با شمارش.
     * @param opts { available, list, query }
     *   available = { abzar_dsh:[نام…], mcp:[…], afzune:[…], eskil:[…] }
     *   list = فهرستِ موثر.
     *   query = متنِ جست‌وجو.
     * @returns Array<{ kind, label, items: Array<{ name, on, owner }>, onCount, total }>
     */
    function buildRows(opts) {
      const o = opts || {}
      const avail = o.available || {}
      const list = cleanList(o.list)
      const q = String(o.query || '').trim().toLowerCase()
      const plugins = Array.isArray(avail.afzune) ? avail.afzune : []
      const rows = []
      for (const kind of TIK_KIND) {
        const names = Array.isArray(avail[kind]) ? avail[kind].slice() : []
        const seen = new Set()
        const items = []
        for (const raw of names) {
          const name = String(raw || '').trim()
          if (!name || seen.has(name)) continue
          seen.add(name)
          const owner = kind === 'afzune' ? null : pluginOwner({ name: name, kind: kind, plugins: plugins })
          if (q && !name.toLowerCase().includes(q) && !(owner && owner.toLowerCase().includes(q))) continue
          // خاموشیِ افزونه، اسکیل و MCP ِ خودش را هم خاموش نشان می‌دهد
          const selfOff = list[kind][name] === false
          const ownerOff = owner ? list.afzune[owner] === false : false
          items.push({ name: name, on: !selfOff && !ownerOff, owner: owner, by: ownerOff ? owner : '' })
        }
        const total = items.length
        const onCount = items.filter((i) => i.on).length
        rows.push({ kind: kind, label: TIK_KIND_LABEL[kind], items: items, onCount: onCount, total: total })
      }
      return rows
    }

    /**
     * چکیدهٔ یک ثبت: چه چیزی عوض می‌شود، برای پرسشِ «مطمئنی؟» و پیامِ نتیجه.
     * @param changes فهرستِ تغییرها.
     * @returns { on: string[], off: string[], matn: string }
     */
    function summarize(changes) {
      const on = []
      const off = []
      for (const c of Array.isArray(changes) ? changes : []) {
        const name = String((c && c.name) || '').trim()
        if (!name) continue
        if (c.on === false) off.push(name)
        else on.push(name)
      }
      const fa = (n) => String(n).replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)])
      const parts = []
      if (off.length) parts.push(fa(off.length) + ' تیک برداشته')
      if (on.length) parts.push(fa(on.length) + ' تیک زده')
      return { on: on, off: off, matn: parts.length ? parts.join(' · ') : 'تغییری نبود' }
    }

    /**
     * آیا این چت «تازه» است (پیش از ثبت دست‌نخورده، و هنوز پیامی ندارد)؟
     * دو شرط با هم: پیامی نفرستاده باشد، و زمانِ ثبتِ تیک‌ها بعد از بازشدنش باشد.
     * شرطِ دوم همان «چتِ بازِ قدیمی دست نمی‌خورد» ِ حبیب است.
     * @param opts { hasMessages, openedAt, savedAt }
     * @returns {boolean}
     */
    function isFreshChat(opts) {
      const o = opts || {}
      if (o.hasMessages !== false) return false
      const opened = Number(o.openedAt)
      const saved = Number(o.savedAt)
      if (!Number.isFinite(opened) || !Number.isFinite(saved)) return false
      return opened >= saved
    }
    /* #endregion tik-inline */
    /* #region app-locale-inline — تولیدِ خودکار از locale/app-settings-fa.json (tools/sync-plus.mjs) */
    const APP_SETTINGS_LOCALE = {
      "meta": {
        "sharh": "برچسب و شرحِ فارسیِ تنظیم‌های خودِ برنامه (DSH) برای صفحهٔ «تنظیم‌های خودِ اپ».",
        "sakht": "برای هر فضای‌نام (ns) یک ورودی با label و tozih و key_fa (برچسبِ فارسیِ هر فیلد)."
      },
      "ui-theme": {
        "label": "ظاهر و خوانایی",
        "tozih": "رنگ و اندازهٔ نوشته‌های برنامه. همان تنظیم‌هایی است که در Settings ← General ← Appearance هم هست؛ این‌جا فقط «الان» را نشان می‌دهد و می‌شود عوضش کرد.",
        "key_fa": {
          "preference": "تم (روشن / تیره / خودِ سیستم)",
          "fontSize": "اندازهٔ متنِ گفتگو (پیکسل)",
          "codeFontSize": "اندازهٔ متنِ کد (پیکسل)",
          "terminalFontSize": "اندازهٔ متنِ ترمینالِ کنار (پیکسل)",
          "textFontFamily": "فونتِ متن",
          "codeFontFamily": "فونتِ کد",
          "terminalFontFamily": "فونتِ ترمینال"
        }
      },
      "agent-loop": {
        "label": "حلقهٔ کارِ ایجنت",
        "tozih": "رفتارِ ایجنت وقتی چند ابزار را با هم می‌خواهد اجرا کند. عددِ بزرگ‌تر یعنی سریع‌تر ولی شلوغ‌تر.",
        "key_fa": {
          "maxParallelToolCalls": "چند ابزار هم‌زمان اجرا شود (۱ تا بی‌نهایت)"
        }
      },
      "agent-default-model": {
        "label": "مدلِ پیش‌فرضِ ایجنت",
        "tozih": "هر چتِ تازه با کدام مدل شروع شود و مدل چقدر فکر کند.",
        "key_fa": {
          "provider": "سرویس‌دهندهٔ مدل (مثلاً openrouter یا deepseek)",
          "model": "نامِ مدل",
          "reasoningEffort": "میزانِ فکرِ مدل (کم / معمولی / زیاد)"
        }
      },
      "subagent": {
        "label": "ساب‌ایجنت‌ها",
        "tozih": "چند ساب‌ایجنت هم‌زمان کار کنند و تا چند لایه تودرتو بروند.",
        "key_fa": {
          "maxDepth": "حداکثر لایهٔ تودرتویی",
          "maxActiveSubagents": "چند ساب‌ایجنت هم‌زمان"
        }
      },
      "bash-local": {
        "label": "اجرای فرمان در ترمینال",
        "tozih": "فرمان‌های بش با پوشهٔ کارِ پیش‌فرض، مهلت و سقفِ خروجی اجرا می‌شوند.",
        "key_fa": {
          "cwd": "پوشهٔ پیش‌فرضِ اجرا",
          "timeoutMs": "مهلتِ پیش‌فرضِ هر فرمان (میلی‌ثانیه)",
          "maxTimeoutMs": "بیشترین مهلتی که یک فرمان می‌تواند بگیرد",
          "maxOutputBytes": "سقفِ خروجیِ هر فرمان (بایت)",
          "maxSpillBytes": "سقفِ پروندهٔ سرریزِ خروجی",
          "graceMs": "مهلتِ مُلایم برای بستنِ برنامه (میلی‌ثانیه)"
        }
      },
      "permission-presets": {
        "label": "پیش‌تنظیم‌های اجازه",
        "tozih": "پیش‌تنظیمی که هر چتِ تازه با آن اجازه می‌گیرد (دسترسی به فایل‌ها و پرسیدن).",
        "key_fa": {
          "presets": "فهرستِ پیش‌تنظیم‌ها",
          "defaultPreset": "پیش‌تنظیمِ پیش‌فرضِ چت‌های تازه"
        }
      },
      "web": {
        "label": "جست‌وجو و خواندنِ وب",
        "tozih": "ابزارِ وب (web_fetch و جست‌وجو) با کدام سرویس کار کند.",
        "key_fa": {
          "searchProvider": "سرویسِ جست‌وجو",
          "fetchProvider": "سرویسِ خواندنِ صفحه"
        }
      },
      "cotTranslation": {
        "label": "ترجمهٔ فکرِ مدل",
        "tozih": "متنی که مدل در حالِ فکر کردن می‌نویسد به کدام زبان و با کدام سرویس ترجمه شود.",
        "key_fa": {
          "provider": "سرویسِ ترجمه",
          "targetLanguage": "زبانِ مقصد (auto = زبانِ خودِ برنامه)"
        }
      },
      "mcpManager": {
        "label": "سرورهای MCP",
        "tozih": "ابزارهای بیرونی که به برنامه وصل می‌شوند. آشکارسازانِ رمز (apiKey، token) هرگز نشان داده نمی‌شوند.",
        "key_fa": {
          "servers": "فهرستِ سرورها"
        }
      }
    };
    /* #endregion app-locale-inline */

    /* #region ask-md — جدول و پررنگ در پنجرهٔ سؤال (حبیب ۱۵ نوامبر ۲۰۲۶: «یه کاری کن که پنجره سوال فرمت جدول رو حفظ کنه»)
     * پنجرهٔ سؤالِ برنامه متنِ سؤال را خام در <h2 class="…_titlePreview"> می‌گذارد، پس جدولِ
     * مارک‌داون به‌صورتِ «| a | b |» و «|---|» دیده می‌شد. این‌جا همان متن خوانده و کنارِ h2 در
     * یک <div data-dsh-ask-md> به جدول/پاراگراف/فهرست ساخته می‌شود و h2 فقط پنهان می‌شود
     * (نه پاک)، تا دکمهٔ کپی، aria و Reactِ خودِ برنامه دست‌نخورده بمانند. همه‌چیز با
     * createElement و textContent ساخته می‌شود — هیچ innerHTMLی نیست، پس متنِ مدل نمی‌تواند
     * HTML تزریق کند. کدِ درون‌خطی <span> است نه <code>، چون قاعدهٔ «table:has(code)»
     * ِ همین فایل کلِ جدول را چپ‌به‌راست می‌کرد. */
    function askMdSplitRow(line) {
      let s = line.trim();
      if (s.startsWith('|')) s = s.slice(1);
      if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1);
      const cells = [];
      let cur = '';
      let inCode = false;
      for (let i = 0; i < s.length; i++) {
        const ch = s[i];
        if (ch === '\\' && s[i + 1] === '|') { cur += '|'; i++; continue; }
        if (ch === '`') inCode = !inCode;
        if (ch === '|' && !inCode) { cells.push(cur.trim()); cur = ''; continue; }
        cur += ch;
      }
      cells.push(cur.trim());
      return cells;
    }
    function askMdIsRow(line) {
      return /^\s*\|.*\|\s*$/.test(line);
    }
    function askMdIsSeparator(line) {
      if (!askMdIsRow(line)) return false;
      const cells = askMdSplitRow(line);
      return cells.length > 0 && cells.every((c) => /^:?-{2,}:?$/.test(c));
    }
    /** متن ⇒ بلوک‌ها: table {head, rows} · list {items} · para {lines}. */
    function askMdBlocks(text) {
      const lines = String(text == null ? '' : text).replace(/\r\n?/g, '\n').split('\n');
      const blocks = [];
      let para = null;
      let list = null;
      const close = () => { para = null; list = null; };
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (askMdIsRow(line) && i + 1 < lines.length && askMdIsSeparator(lines[i + 1])) {
          close();
          const head = askMdSplitRow(line);
          const rows = [];
          i += 2;
          while (i < lines.length && askMdIsRow(lines[i])) { rows.push(askMdSplitRow(lines[i])); i++; }
          i--;
          blocks.push({ type: 'table', head, rows });
          continue;
        }
        if (line.trim() === '') { close(); continue; }
        const bullet = /^\s*[-*•]\s+(.*)$/.exec(line);
        if (bullet) {
          para = null;
          if (!list) { list = { type: 'list', items: [] }; blocks.push(list); }
          list.items.push(bullet[1]);
          continue;
        }
        list = null;
        if (!para) { para = { type: 'para', lines: [] }; blocks.push(para); }
        para.lines.push(line);
      }
      return blocks;
    }
    /** آیا متن چیزی دارد که ارزشِ ساختن داشته باشد (جدول، پررنگ، کد، فهرست)؟ */
    function askMdWorth(text) {
      const blocks = askMdBlocks(text);
      if (blocks.some((b) => b.type === 'table' || b.type === 'list')) return true;
      return /\*\*[^*\n]+\*\*|`[^`\n]+`/.test(String(text || ''));
    }
    /** پررنگ (**…**) و کدِ درون‌خطی (`…`) ⇒ گره‌های امن. */
    function askMdInline(doc, parent, text) {
      const re = /`([^`\n]+)`|\*\*([^*\n]+?)\*\*/g;
      let last = 0;
      let m;
      const s = String(text);
      while ((m = re.exec(s))) {
        if (m.index > last) parent.appendChild(doc.createTextNode(s.slice(last, m.index)));
        if (m[1] !== undefined) {
          const code = doc.createElement('span');
          code.setAttribute('data-dsh-ask-code', '');
          code.setAttribute('dir', 'ltr');
          code.textContent = m[1];
          parent.appendChild(code);
        } else {
          const b = doc.createElement('strong');
          askMdInline(doc, b, m[2]);
          parent.appendChild(b);
        }
        last = re.lastIndex;
      }
      if (last < s.length) parent.appendChild(doc.createTextNode(s.slice(last)));
    }
    /** بلوک‌ها ⇒ یک <div data-dsh-ask-md>. */
    function askMdRender(doc, text) {
      const root = doc.createElement('div');
      root.setAttribute('data-dsh-ask-md', '');
      root.setAttribute('dir', /[\u0600-\u06FF]/.test(String(text || '')) ? 'rtl' : 'auto');
      for (const block of askMdBlocks(text)) {
        if (block.type === 'table') {
          const wrap = doc.createElement('div');
          wrap.setAttribute('data-dsh-ask-table', '');
          const table = doc.createElement('table');
          const thead = doc.createElement('thead');
          const tr = doc.createElement('tr');
          for (const cell of block.head) {
            const th = doc.createElement('th');
            askMdInline(doc, th, cell);
            tr.appendChild(th);
          }
          thead.appendChild(tr);
          table.appendChild(thead);
          const tbody = doc.createElement('tbody');
          for (const row of block.rows) {
            const r = doc.createElement('tr');
            for (let c = 0; c < block.head.length; c++) {
              const td = doc.createElement('td');
              askMdInline(doc, td, row[c] == null ? '' : row[c]);
              r.appendChild(td);
            }
            tbody.appendChild(r);
          }
          table.appendChild(tbody);
          wrap.appendChild(table);
          root.appendChild(wrap);
        } else if (block.type === 'list') {
          const ul = doc.createElement('ul');
          for (const item of block.items) {
            const li = doc.createElement('li');
            askMdInline(doc, li, item);
            ul.appendChild(li);
          }
          root.appendChild(ul);
        } else {
          const p = doc.createElement('p');
          block.lines.forEach((line, k) => {
            if (k > 0) p.appendChild(doc.createElement('br'));
            askMdInline(doc, p, line);
          });
          root.appendChild(p);
        }
      }
      return root;
    }
    /**
     * نگهبان: هر تیترِ سؤال که جدول/پررنگ/کد/فهرست دارد ⇒ نسخهٔ ساخته‌شده درست بعد از h2،
     * و h2 با data-dsh-ask-md-hidden پنهان. متنِ منبع در data-src ِ نسخه می‌ماند تا فقط با
     * عوض‌شدنِ متن دوباره ساخته شود (نه با هر تغییرِ DOM). خروجی: تابعِ پاک‌کننده.
     */
    function startAskMarkdown(win) {
      const doc = win.document;
      const SEL = '[data-question-key] [class*="_titlePreview"]';
      const sync = () => {
        let titles;
        try { titles = doc.querySelectorAll(SEL); } catch (err) { return; }
        for (let i = 0; i < titles.length; i++) {
          const h = titles[i];
          let text = '';
          for (let n = h.firstChild; n; n = n.nextSibling) if (n.nodeType === 3) text += n.nodeValue;
          const next = h.nextElementSibling;
          const mine = next && next.hasAttribute('data-dsh-ask-md') ? next : null;
          if (!askMdWorth(text)) {
            if (mine) mine.remove();
            if (h.hasAttribute('data-dsh-ask-md-hidden')) h.removeAttribute('data-dsh-ask-md-hidden');
            continue;
          }
          if (mine && mine.getAttribute('data-src') === text) {
            if (!h.hasAttribute('data-dsh-ask-md-hidden')) h.setAttribute('data-dsh-ask-md-hidden', '');
            continue;
          }
          const view = askMdRender(doc, text);
          view.setAttribute('data-src', text);
          if (mine) mine.replaceWith(view);
          else h.insertAdjacentElement('afterend', view);
          h.setAttribute('data-dsh-ask-md-hidden', '');
        }
      };
      let timer = 0;
      let pending = false;
      const schedule = () => {
        if (pending) return;
        pending = true;
        timer = win.setTimeout(() => { pending = false; sync(); }, 60);
      };
      sync();
      const observer = new win.MutationObserver(schedule);
      observer.observe(doc.body, { childList: true, subtree: true, characterData: true });
      return () => {
        win.clearTimeout(timer);
        observer.disconnect();
        const views = doc.querySelectorAll('[data-dsh-ask-md]');
        for (let i = 0; i < views.length; i++) views[i].remove();
        const hidden = doc.querySelectorAll('[data-dsh-ask-md-hidden]');
        for (let i = 0; i < hidden.length; i++) hidden[i].removeAttribute('data-dsh-ask-md-hidden');
      };
    }
    /* #endregion ask-md */

    /* ------------------------------------------------------------------ *
     * Preference store (browser-local, survives reload)
     * ------------------------------------------------------------------ */
    const STORE_KEY = 'dsh-rtl:prefs:v1';
    const DEFAULTS = { rtl: true, font: true, code: true, plaintext: true, chatFit: true };
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
      /* فقط false ِ صریح خاموش می‌کند — همان قاعدهٔ قبلیِ rtl/font/code/plaintext، تا مقدارِ
         string یا ۰ که از پروندهٔ تنظیم‌ها/کش می‌آید فیت را بی‌صدا خاموش نکند. */
      root.setAttribute('data-dsh-rtl-chatfit', prefs.chatFit === false ? 'off' : 'on');
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
      root.removeAttribute('data-dsh-rtl-chatfit');
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

/* --- نوارِ پایینِ کادرِ نوشتن: مدل، میکروفن، فرستادن به لبهٔ چپ --------- *
 * خودِ برنامه گروهِ «مدل + میکروفن + فرستادن» را با margin-left: auto به لبهٔ
 * راست می‌چسباند (InputBar.module.css، کلاسِ .trailing). در راست‌به‌چپ این
 * حاشیه آینه نمی‌شود، پس گروه سمتِ چپ می‌ماند و فاصلهٔ خالی بینِ «Full access»
 * و «+» می‌افتد (گزارشِ حبیب، عکسِ کادرِ نوشتن). با margin-inline-start: auto
 * همان گروه به لبهٔ چپ می‌رود و «+» و «Full access» سرِ جای راست می‌مانند.
 * فقط فرزندِ مستقیمِ ردیفِ نوار (‎_row > _trailing‎) — نه هر div ِ دیگری در اپ. */
html[data-dsh-rtl="on"] [class*="_row"] > [class*="_trailing"] {
  margin-inline-start: auto !important;
  margin-left: 0 !important;
}

/* #region soal-panh — پنجرهٔ سؤالِ تمام‌عرض (بارِ اول)
 * پنجرهٔ سؤالِ خودِ برنامه (کادرِ جای کادرِ نوشتن، بالای آن می‌چسبد) سه ایراد داشت:
 * باریک بود، حداکثر ۵۲۰px ارتفاع داشت که سؤالِ کوتاه هم اسکرول می‌خورد، و متنِ
 * انگلیسیِ سؤال/گزینه/کادرِ پاسخ با «direction: rtl» ِ کلِ صفحه به‌هم می‌ریخت
 * (نقطهٔ آخرِ جمله اول می‌رفت، پرانتز جابه‌جا). حالا پهن است، سقفِ ارتفاع به‌جای
 * ۵۲۰px درصدی است که از کفِ صفحه فراتر نمی‌رود، اسکرولِ داخلی فقط برای فهرستِ
 * بلندِ گزینه‌هاست، و متنِ خودِ پنجره راست‌چین است؛ ترتیبِ حرف‌های لاتین را تابعِ
 * startQuestionTextDir (پایین‌تر) با گذاشتنِ dir برگرداند.
 *
 * انتخابگرها: نامِ کلاس‌ها موقعِ اجرا «<هش>_<نام>» می‌شود (الان I1ptPW_*). اسم‌هایی
 * مثلِ frame/card/body/title در ۱۲ تا ۵۰ ماژولِ دیگرِ برنامه هم هست، پس فقط به یک
 * جدِ پایدارِ خودِ برنامه گیر می‌کنیم: ظرفِ کادرِ نوشتن [data-composer-seat]، ظرفِ
 * آخرین پرسشِ در انتظار [data-question-key]، و اسکرول‌پورتِ پنجره [data-question-scroll].
 * cardMinimized/questionTitle/optionRow/customRow فقط در همین ماژول‌اند و از همین
 * ظرف‌ها نه‌اندازه‌شان بزرگ‌تر است و نه بیرونشان می‌زنند.
 * نیمهٔ برچسبِ «هر دو زبان» (فقط جهشِ متن) زیرِ data-dsh-rtl نیست: فارسی خواندنِ
 * کد را خراب نمی‌کند. نیمهٔ «پهن/بلند» فقط با راست‌به‌چپ روشن است، مثلِ بقیهٔ فایل. */
/* فقط کارتی که واقعاً کارتِ پنجرهٔ سؤال است: کارتِ کادرِ نوشتن هم در همان جای
   کادرِ نوشتن است و نامش «_card» است، پس با «[data-composer-seat] > _card» پهن‌تر
   می‌شد (آزمون همین را گرفت). نشانهٔ قطعی، تیترِ سؤال و فهرستِ گزینه‌های خودِ
   پنجره است که در کارتِ نوشتن نیست. */
[data-question-key] > [class*="_card"]:has([class*="_questionTitle"], [class*="_optionRow"]) {
  max-width: none !important;
  max-height: min(85vh, calc(100dvh - 160px)) !important;
}
[data-question-key] > [class*="_card"] > [class*="_cardMinimized"] {
  max-height: none !important;
}
[data-question-scroll] {
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
}
/* پهن/بلند: سقف و حاشیهٔ کارت، متنِ خیلی بلندِ سؤال (سه خط) و توضیحِ گزینه (دو خط)
   کامل و بدونِ کلیپ، سؤال و توضیح و کادرِ پاسخ راست‌به‌چپ، و هر گزینه یک ردیفِ کامل. */
html[data-dsh-rtl="on"] [data-question-key] [class*="_questionTitle"] [class*="_titlePreview"],
html[data-dsh-rtl="on"] [data-question-key] [class*="_optionRow"] [class*="_description"] {
  max-height: none !important;
  animation: none !important;
  clip-path: none !important;
  -webkit-mask-image: none !important;
  mask-image: none !important;
}
/* فقط «شروع از لبهٔ راست». جهتِ خودِ متن (rtl یا ltr) را مقدارِ dir می‌دهد که
   تابعِ startQuestionTextDir روی تیتر/برچسب/توضیح می‌گذارد؛ این‌جا direction
   گذاشتن دوباره متنِ لاتین را وارونه می‌کرد و «dir=ltr» هم به‌خاطرِ ارث‌بریِ قوی‌ترِ
   این قاعده بی‌اثر می‌شد. */
html[data-dsh-rtl="on"] [data-question-key] [class*="_questionTitle"],
html[data-dsh-rtl="on"] [data-question-key] [class*="_detail"],
html[data-dsh-rtl="on"] [data-question-key] [class*="_optionLabel"],
html[data-dsh-rtl="on"] [data-question-key] [class*="_description"] {
  text-align: right;
}
html[data-dsh-rtl="on"] [data-question-key] [class*="_customRow"] {
  direction: rtl;
  text-align: right;
}
html[data-dsh-rtl="on"] [data-question-key] [class*="_optionRow"],
html[data-dsh-rtl="on"] [data-question-key] [class*="_customRow"] {
  width: 100%;
}
html[data-dsh-rtl="on"] [data-question-key] [class*="_option"],
html[data-dsh-rtl="on"] [data-question-key] [class*="_optionCopy"] {
  width: 100%;
  min-width: 0;
}
html[data-dsh-rtl="on"] [data-question-key] [class*="_optionCopy"],
html[data-dsh-rtl="on"] [data-question-key] [class*="_optionLine"] {
  flex: 1 1 auto;
  flex-wrap: wrap;
}
/* جدول/پررنگ/کد در متنِ سؤال (startAskMarkdown): h2 ِ خام پنهان و نسخهٔ ساخته‌شده جایش.
   بی‌شرط (در هر دو زبان)، چون جدولِ خام در انگلیسی هم خواناتر نیست. */
[data-question-key] [data-dsh-ask-md-hidden] {
  display: none !important;
}
[data-question-key] [data-dsh-ask-md] {
  flex: 1 1 auto;
  min-width: 0;
  line-height: 1.75;
}
[data-question-key] [data-dsh-ask-md] p {
  margin: 0 0 0.5em;
}
[data-question-key] [data-dsh-ask-md] ul {
  margin: 0 0 0.5em;
  padding-inline-start: 1.4em;
}
[data-question-key] [data-dsh-ask-md] [data-dsh-ask-table] {
  overflow-x: auto;
  margin: 0.25em 0 0.75em;
}
[data-question-key] [data-dsh-ask-md] table {
  border-collapse: collapse;
}
[data-question-key] [data-dsh-ask-md] th,
[data-question-key] [data-dsh-ask-md] td {
  border: 1px solid color-mix(in srgb, currentColor 25%, transparent);
  padding: 4px 10px;
  vertical-align: top;
  text-align: start;
}
[data-question-key] [data-dsh-ask-md] th {
  font-weight: 600;
  background: color-mix(in srgb, currentColor 8%, transparent);
}
[data-question-key] [data-dsh-ask-md] strong {
  font-weight: 700;
}
[data-question-key] [data-dsh-ask-md] [data-dsh-ask-code] {
  font-family: "Vazir Code Hack", "SF Mono", Menlo, Consolas, monospace;
  font-size: 0.9em;
  padding: 0 0.3em;
  border-radius: 4px;
  background: color-mix(in srgb, currentColor 12%, transparent);
  unicode-bidi: isolate;
}
/* #endregion soal-panh */

/* #region chat-fit — چت تمام‌پهنا: پیام‌ها و کادرِ نوشتن پنلِ خودشان را پر کنند
 * ایراد (عکسِ حبیب، پنجرهٔ ۲۷۳۰px با پنلِ راستِ باز): ستونِ گفتگو وسطِ پنل باریک
 * می‌ماند و دو حاشیهٔ خالیِ بزرگ دو طرف می‌افتد. علتش یک چیز است:
 * ConversationRoot.module.css (درونِ asar) روی ظرفِ .body دو متغیرِ عرض می‌سازد —
 *   --dsh-chat-content-width      = clamp(680px, 64% عرضِ ستون, 920px)
 *   --dsh-composer-card-max-width = آن + 32px
 * و پنج مصرف‌کننده با آن‌ها سقفِ عرض می‌گیرند: ستونِ پیام‌ها (ChatView .column،
 * max-width)، کارتِ کادرِ نوشتن و نوارِ اعلانش (InputBar .card/.notice)،
 * نوارِ دکمهٔ آمادهٔ خودمان (dsh-plus-bar[data-where="dock"]) و دستهٔ تغییرِ عرض
 * (ConversationWidthControls). هر پنج از همین دو متغیر می‌خوانند، پس همین دو
 * روی ظرفِ چت دوباره تعریف می‌شوند و ستون به تمامِ عرضِ پنل می‌رسد؛ ستونِ
 * دستیِ کشیده‌شده (--dsh-chat-user-width، حافظهٔ درگ) هم برای همین حالت بی‌اثر
 * می‌شود تا یک درگِ قدیمی فیت را برنگرداند.
 *
 * چرا فقط دو متغیر و نه پنج قاعدهٔ max-width: نام‌های .column/.card/.notice عمومی‌اند
 * و در ده‌ها ماژولِ دیگرِ برنامه هم هستند؛ متغیر فقط جایی اثر می‌گذارد که خودِ
 * برنامه آن را می‌خواند، یعنی همان ظرفِ گفتگو و کارتِ نوشتن — چه LTR چه RTL
 * (اندازه‌ها متقارن‌اند و این بلوک جهت نمی‌گذارد).
 *
 * لنگرِ انتخابگر: [data-conversation-content] که فقط روی ظرفِ چت است (یک جا
 * در کلِ برنامه؛ ConversationContent.tsx). سقف‌های کاربردیِ خودِ برنامه هم
 * این‌جا دوباره و درست نوشته می‌شوند، وگرنه با دو متغیر به اندازهٔ کلِ پنل باز
 * می‌شدند: نوارِ اعلان (۵۲۰px، کادرِ نوشتن از ستون باریک‌تر می‌ماند)، فهرستِ
 * بلندِ گزینهٔ پنجرهٔ سؤال (۵۲۰px، بلندتر از ۸۵vh دیده نمی‌شد) و کارتِ پاسخ به
 * سؤال (۸۲٪). ستونِ توکارِ پنلِ کنارِ گفتگو (embeddedBody = min(100% - 32px, 920px))
 * دست نمی‌خورد.
 *
 * فاصلهٔ کنار: ۲۴px هر طرف (max(0px, …) تا در پنلِ باریک منفی نشود). ستونِ
 * پیام‌ها max-width: 100% ِ خودش را دارد و با این دو حاشیه پر می‌شود؛ نوارِ
 * دکمه‌ها دو فاصلهٔ دیگر (۱۶+۲۴px کنارِ کادر) را هم برمی‌دارد تا با لبهٔ کادر و
 * پیام‌ها هم‌تراز شود. کلِ بلوک فقط با data-dsh-rtl-chatfit="on" کار می‌کند
 * (کلیدِ chatFit در صفحهٔ تنظیمات). */
html[data-dsh-rtl-chatfit="on"] [data-conversation-content]:not([class*="_embeddedBody"]) {
  --dsh-chat-content-width: max(0px, 100% - 48px);
  --dsh-chat-user-width: var(--dsh-chat-content-width);
  --dsh-composer-card-max-width: var(--dsh-chat-content-width);
}
html[data-dsh-rtl-chatfit="on"] [data-conversation-content]:not([class*="_embeddedBody"]) [class*="_notice"] {
  max-width: min(520px, 100%);
}
html[data-dsh-rtl-chatfit="on"] [data-conversation-content]:not([class*="_embeddedBody"]) [data-question-key] [class*="_card"]:has([class*="_questionTitle"], [class*="_optionRow"]) {
  /* !important یعنی بازگشت به سقفِ منطقیِ خودِ برنامه؛ قاعدهٔ بالا با none !important
     کارت را بی‌سقف کرد و بی این هم کارتِ سؤال با ستونِ تمام‌عرض آسمان‌خراش می‌شد. */
  max-width: min(calc(100% - 32px), 920px) !important;
}
html[data-dsh-rtl-chatfit="on"] [data-conversation-content]:not([class*="_embeddedBody"]) [data-question-reply] {
  max-width: 82%;
}
/* #endregion chat-fit */

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
/* --- صفحهٔ تنظیمات: جست‌وجو، بخش‌ها، خطِ «الان» و نشانِ سه سطح --- */
.dsh-rtl-search {
  width: 100%;
  box-sizing: border-box;
  margin: 0 0 12px;
  padding: 8px 12px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 10px;
  background: var(--dsw-alias-bg-layer-1, rgba(127,127,127,.08));
  color: inherit;
  font: inherit;
}
.dsh-rtl-search:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 1px; }
.dsh-rtl-section { margin-top: 22px; }
.dsh-rtl-section h3 {
  margin: 0;
  font-size: 14px;
  line-height: 1.7;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--dsw-alias-border-l2);
}
.dsh-rtl-section-hint {
  margin: 6px 0 0;
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  line-height: 1.8;
}
.dsh-rtl-row-now {
  display: block;
  margin-top: 5px;
  font-size: 12px;
  line-height: 1.8;
  color: var(--dsw-alias-label-secondary);
}
.dsh-rtl-badges { display: inline-flex; gap: 6px; margin-top: 6px; }
.dsh-rtl-level {
  display: inline-block;
  padding: 1px 8px;
  border-radius: 999px;
  border: 1px solid var(--dsw-alias-border-l2);
  background: transparent;
  color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary));
  font: inherit;
  font-size: 11px;
  line-height: 1.7;
  cursor: pointer;
}
.dsh-rtl-level[data-set="1"] { color: var(--dsw-alias-label-primary); border-color: var(--dsw-alias-border-l2); }
.dsh-rtl-level-on { background: var(--dsw-alias-bg-layer-2, rgba(127,127,127,.18)); font-weight: 600; }
.dsh-rtl-row-control { flex: 0 0 auto; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.dsh-rtl-row-level {
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 8px;
  background: var(--dsw-alias-bg-layer-1, rgba(127,127,127,.08));
  color: inherit;
  font: inherit;
  font-size: 12px;
  padding: 3px 6px;
}
.dsh-rtl-row-value {
  width: 84px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 8px;
  background: var(--dsw-alias-bg-layer-1, rgba(127,127,127,.08));
  color: inherit;
  font: inherit;
  padding: 3px 8px;
}
.dsh-rtl-save {
  border: 1px solid var(--dsw-alias-brand-primary);
  border-radius: 8px;
  background: transparent;
  color: var(--dsw-alias-brand-primary);
  font: inherit;
  font-size: 12px;
  padding: 3px 10px;
  cursor: pointer;
}
.dsh-rtl-save:hover { background: var(--dsw-alias-brand-primary); color: var(--dsw-alias-bg-layer-1, #1f1f1f); }
.dsh-rtl-only-global {
  display: inline-block;
  margin: 8px 0 0;
  padding: 2px 10px;
  border-radius: 999px;
  background: var(--dsw-alias-bg-layer-2, rgba(127,127,127,.18));
  color: var(--dsw-alias-label-secondary);
  font-size: 11px;
}
.dsh-rtl-host-note[data-host="missing"] { color: #d08c22; }
.dsh-rtl-empty { margin: 22px 0 0; color: var(--dsw-alias-label-secondary); font-size: 13px; }
.dsh-rtl-row-key { display: block; margin-top: 3px; font-size: 11px; color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary)); direction: ltr; text-align: right; }
.dsh-rtl-app-edit { display: inline-flex; gap: 6px; align-items: center; }
.dsh-rtl-app-edit input {
  width: 110px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 8px;
  background: var(--dsw-alias-bg-layer-1, rgba(127,127,127,.08));
  color: inherit;
  font: inherit;
  padding: 3px 8px;
}
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

/* ------------------------------------------------------------------ *
     * صفحهٔ تنظیمات: بخش‌ها، ردیف‌ها و معنیِ هر مقدار
     * برای هر ردیف: برچسبِ فارسی، یک خط شرحِ ساده، و «الان: X از Y؛ یعنی …».
     * ------------------------------------------------------------------ */
    const SECTION_SPECS = [
      {
        id: 'rtl',
        title: 'راست‌چین',
        hint: 'جهتِ صفحه، فونتِ فارسی، کد و متنِ دوطرفه.',
        rows: [
          { key: 'rtl', label: 'راست‌به‌چپ', hint: 'کل صفحه آینه می‌شود: نوارِ کنار سمتِ راست، پیام‌ها از راست، و متن‌ها با ترتیبِ فارسی و عربی.' },
          { key: 'font', label: 'فونتِ فارسی (Vazirmatn)', hint: 'متن‌های فارسی با Vazirmatn و کدها با Vazir Code Hack نوشته می‌شوند.' },
          { key: 'code', label: 'کد و خروجیِ ابزار چپ‌به‌راست بماند', hint: 'بلوک‌های کد، شمارهٔ خط‌ها، دیف و خروجیِ ابزارها برنمی‌گردند تا پرانتزها به‌هم نریزند.' },
          { key: 'plaintext', label: 'هر بلوک از متنِ خودش پیروی کند', hint: 'پاراگرافِ فارسی راست‌به‌چپ و پاراگرافِ انگلیسی چپ‌به‌راست می‌ماند.' },
          { key: 'soalPahn', type: 'bool', label: 'پنجرهٔ سؤالِ تمام‌عرض', hint: 'پنجره‌ای که ابزار از تو سؤال می‌پرسد پهن و بلند شود تا سؤالِ کوتاه هم اسکرول نخورد.', fallback: true },
          { key: 'chatFit', type: 'bool', label: 'چت تمام‌پهنا (پر کردنِ پنل)', hint: 'پیام‌ها، جدول‌ها، کادرِ نوشتن، نوارِ دکمه‌ها و نوارِ وضعیت تا لبه‌های پنلِ چت پهن می‌شوند (فقط ۲۴ پیکسل فاصله) و با باز و بسته شدنِ پنلِ کنار همراه می‌شوند.', fallback: true },
        ],
      },
      {
        id: 'look',
        title: 'ظاهر',
        hint: 'اندازه، فاصله، رنگ و جدول.',
        rows: [
          { key: 'lh', label: 'فاصلهٔ خطوط', hint: 'به دهم؛ ۰ یعنی خودِ برنامه تصمیم بگیرد. ۱۸ یعنی فاصلهٔ کمی بازتر برای خواندنِ راحت‌تر.' },
          { key: 'textColor', label: 'رنگِ متنِ گفتگو', hint: 'خالی = رنگِ خودِ تم. کدها رنگِ خودشان را نگه می‌دارند.' },
          { key: 'tableScroll', label: 'جدولِ پهن داخلِ خودش بچرخد', hint: 'جدولِ پهن صفحه را بیرون نمی‌زند؛ داخلِ خانهٔ خودش افقی می‌چرخد.' },
          { key: 'lines', label: 'پیامِ خودت چند خط دیده شود', hint: 'بیشتر از این خط‌ها جمع می‌شود؛ با موس یا کلیک کامل می‌شود. ۰ = همیشه کامل.' },
          { key: 'hoverMs', label: 'مکثِ موس تا باز شدن (میلی‌ثانیه)', hint: 'چند هزارمِ ثانیه موس روی پیام بماند تا کامل شود.' },
        ],
      },
      {
        id: 'messages',
        title: 'پیام‌ها و دکمه‌ها',
        hint: 'دکمه‌های آمادهٔ کنارِ کادر، و رفتارِ پیام هنگام فرستادن.',
        rows: [
          { key: 'buttons', label: 'دکمه‌های فرمان پیدا باشند (Ctrl+Alt+B)', hint: 'ردیفِ دکمه‌های آماده بالای کادرِ نوشتن یا کنارِ اسمِ چت. فقط متن را می‌گذارند و نمی‌فرستند (مگر دکمه‌های ⏎).' },
          { key: 'place', label: 'جای دکمه‌ها', hint: 'بالای کادرِ نوشتن، یا کنارِ اسمِ چت، یا هر دو.' },
          { key: 'btnSize', label: 'اندازهٔ دکمه‌ها', hint: 'اندازهٔ نوشتهٔ دکمه‌ها به پیکسل (۸ تا ۲۰).' },
          { key: 'opacity', label: 'پُری دکمه‌ها (درصد)', hint: 'کم = کم‌رنگ‌تر تا مزاحم نشوند؛ با موس پررنگ می‌شوند.' },
          { key: 'accent', label: 'رنگِ دکمه‌ها', hint: 'خالی = رنگِ خودِ تم.' },
          { key: 'noJump', label: 'با فرستادن، صفحه به پایین نپرد', hint: 'اگر بالاتر را می‌خواندی و Enter زدی، صفحه سرِ جایش می‌ماند.' },
          { key: 'quoteMenu', label: 'کلیکِ راست روی متنِ انتخاب‌شده ⇒ منوی نقل‌قول (Ctrl+Alt+Q)', hint: 'متنِ انتخاب‌شده را به‌صورتِ نقل‌قول در کادر می‌گذارد.' },
          { key: 'counter', label: 'شمارندهٔ نویسه‌های کادر', hint: 'زیرِ کادر می‌گوید چند نویسه نوشته‌ای.' },
          { key: 'aaTaze', type: 'bool', label: 'در چتِ تازه، تبِ «ابزارها» خودش باز شود', hint: 'وقتی چت هنوز پیامی ندارد، پنلِ aA خودش روی تبِ «ابزارها» باز می‌شود تا تیک‌های همان چت را بگذاری. خاموش کنی، aA بسته می‌ماند.', fallback: true },
        ],
      },
      {
        id: 'reach',
        title: 'پروفایل و انتقال',
        hint: 'پروفایل‌ها و انتقالِ تنظیمات در بخشِ aA پایینِ همین صفحه هستند.',
        rows: [],
      },
    ];

    /** معنیِ سادهٔ هر مقدار، برای خطِ «الان: …؛ یعنی …». */
    const MEANING = {
      rtl: (v) => (v ? 'چیدمانِ صفحه از راست شروع می‌شود' : 'صفحه مثلِ حالتِ عادی چپ‌به‌راست است'),
      font: (v) => (v ? 'حرف‌های فارسی با فونتِ Vazirmatn نوشته می‌شوند' : 'فونتِ پیش‌فرضِ سیستم استفاده می‌شود'),
      code: (v) => (v ? 'کد و خروجیِ ابزار چپ‌به‌راست می‌مانند' : 'کد هم مثلِ بقیه می‌چرخد'),
      plaintext: (v) => (v ? 'هر پاراگراف جهتِ خودش را دارد' : 'همه از جهتِ صفحه پیروی می‌کنند'),
      lh: (v) => Number(v) === 0 ? 'ارتفاعِ خطوطِ خودِ برنامه' : 'فاصلهٔ خطوط ' + (Number(v) / 10).toFixed(1) + ' برابر (تقریباً)',
      textColor: (v) => (v ? 'متنِ گفتگو این رنگ است' : 'رنگِ متن از تمِ برنامه می‌آید'),
      tableScroll: (v) => (v ? 'جدولِ پهن داخلِ خودش می‌چرخد' : 'جدولِ پهن صفحه را پهن می‌کند'),
      lines: (v) => Number(v) === 0 ? 'پیامِ خودت همیشه کامل دیده می‌شود' : 'بیش از ' + v + ' خط جمع می‌شود',
      hoverMs: (v) => (Number(v) === 0 ? 'بدونِ مکث باز می‌شود' : 'بعد از ' + v + ' هزارمِ ثانیه موس، پیام کامل می‌شود'),
      buttons: (v) => (v ? 'دکمه‌های آماده دیده می‌شوند' : 'دکمه‌های آماده پنهان‌اند'),
      place: (v) => (v === 'dock' ? 'بالای کادرِ نوشتن' : v === 'header' ? 'کنارِ اسمِ چت' : 'هر دو جا'),
      btnSize: (v) => 'نوشتهٔ دکمه‌ها ' + v + ' پیکسل است',
      opacity: (v) => 'دکمه‌ها ' + v + ' درصد پررنگ‌اند',
      accent: (v) => (v ? 'رنگِ دکمه‌ها از خودش است' : 'رنگِ دکمه‌ها از تم می‌آید'),
      noJump: (v) => (v ? 'صفحه وقتی Enter می‌زنی نمی‌پرد' : 'بعد از فرستادن، صفحه به آخر می‌رود'),
      quoteMenu: (v) => (v ? 'کلیکِ راست منوی نقل‌قول می‌دهد' : 'کلیکِ راست منوی خودِ مرورگر است'),
      counter: (v) => (v ? 'زیرِ کادر تعدادِ نویسه‌ها نوشته می‌شود' : 'شمارنده خاموش است'),
      aaTaze: (v) => (v ? 'در چتِ تازه، تبِ «ابزارها» خودش باز می‌شود' : 'aA در چتِ تازه بسته می‌ماند'),
      soalPahn: (v) => (v ? 'پنجرهٔ سؤال پهن و تمام‌قد است' : 'پنجرهٔ سؤال مثلِ حالتِ عادیِ برنامه است'),
      chatFit: (v) => (v ? 'پیام‌ها و کادرِ نوشتن تمامِ عرضِ پنلِ چت را می‌گیرند' : 'چت مثلِ حالتِ عادیِ برنامه وسطِ پنل باریک می‌ماند'),
    };


/* ------------------------------------------------------------------ *
     * سه سطحِ تنظیم (سراسری / پروژه / چت)
     * منبعِ راستین: پرونده‌ها، از راهِ نیمهٔ host در /plugins/rtl/settings.
     * localStorage فقط کشِ سریع و پشتیبان است: تا وقتی host راه نیفتاده (فقط Cmd+R خورده
     * و اپ بسته و باز نشده)، صفحه با مقدارهای localStorage کار می‌کند و یک خط می‌گوید
     * «برای ذخیره در پرونده، اپ یک بار بسته و باز شود».
     * ------------------------------------------------------------------ */
    const SETTINGS_ROUTE = '/plugins/rtl/settings';
    const SETTINGS_CACHE_KEY = 'dsh-rtl:levels:v1';
    const SETTINGS_DEFAULTS = Object.assign({}, DEFAULTS, PLUS_DEFAULTS);
    const SETTINGS_LEVELS = ['global', 'project', 'chat'];

    let workspaceCwd = '';
    let workspaceProbed = false;
    const settingsListeners = new Set();
    let settingsState = {
      host: 'loading',       // loading | ready | missing | error
      note: '',
      layers: { global: {}, project: {}, chat: {} },
      files: null,
      query: '',
      sessionId: '',
    };

    function settingsEmit(patch) {
      settingsState = Object.assign({}, settingsState, patch);
      settingsListeners.forEach((fn) => { try { fn(); } catch (err) { /* بقیه بمانند */ } });
    }

    /**
     * هوکِ صفحه: وضعیتِ سه سطح را می‌دهد و در اولین باری که صفحه باز شد پرونده‌ها را می‌خواند.
     * @param {boolean} [lazy] true = فقط وقتی این صفحه باز شد بخوان (آزمون هم همین را می‌دهد)
     */
    function useSettingsStore(lazy) {
      const [snap, setSnap] = React.useState(settingsState);
      React.useEffect(() => {
        const f = () => setSnap(settingsState);
        settingsListeners.add(f);
        f();
        if (!workspaceProbed) {
          workspaceProbed = true;
          initSettings().catch(() => {
            // خواندن نشد: پشتیبانِ localStorage می‌ماند و یک خط می‌گوید.
            settingsState = Object.assign({}, settingsState, { host: 'error', note: 'پروندهٔ تنظیم‌ها خوانده نشد؛ فعلاً از همین مرورگر استفاده می‌شود.' });
            settingsListeners.forEach((fn) => { try { fn(); } catch (err) { /* بقیه */ } });
          });
        }
        return () => { settingsListeners.delete(f); };
      }, []);
      return snap;
    }

    /** شناسهٔ چتِ همین پنجره (از کادرِ نوشتنِ زنده یا نشانی). */
    function currentSessionId() {
      const c = pickComposer();
      if (c && c.sid) return c.sid;
      try {
        const m = String(window.location.href).match(/session[\/=]([A-Za-z0-9._-]{4,128})/);
        if (m) return m[1];
      } catch (err) { /* بی نشانی */ }
      return '';
    }

    /**
     * پوشهٔ کارِ همین چت را از خودِ برنامه می‌پرسیم (نه از پوشهٔ کدِ افزونه).
     * ctx.sessions.list snapshot هر چت یک cwd دارد؛ همین است که برنامه هم استفاده می‌کند.
     */
    async function probeWorkspace(sid = currentSessionId()) {
      const ctx = clientCtx;
      const sessions = ctx && typeof ctx.get === 'function' ? ctx.get('sessions') : null;
      if (!sessions || !sessions.list || typeof sessions.list.getSnapshot !== 'function') return '';
      const cwdOf = () => {
        const snap = sessions.list.getSnapshot();
        if (!snap || !snap.byId) return '';
        const row = sid ? snap.byId[sid] : null;
        if (row && typeof row.cwd === 'string' && row.cwd) return row.cwd;
        const workspaces = ctx.get('workspaces')?.list?.getSnapshot?.();
        const owner = workspaces?.items?.find?.(w => w.sessionIds?.includes(sid));
        if (owner?.path) return owner.path;
        // چتِ تازه در فهرست نیست: اگر فقط یک پوشه در فهرست است، همان پوشهٔ کار است.
        const dirs = new Set();
        for (const id of (Array.isArray(snap.ids) ? snap.ids : [])) {
          const item = snap.byId[id];
          if (item && typeof item.cwd === 'string' && item.cwd) dirs.add(item.cwd);
        }
        return dirs.size === 1 ? (dirs.values().next().value || '') : '';
      };
      try {
        // فهرستِ چت‌ها که می‌آید pوشه‌اش هم می‌آید؛ حداکثر ۳ ثانیه صبر، بعد بی‌پوشه ادامه می‌دهیم.
        for (let i = 0; i < 20; i += 1) {
          const cwd = cwdOf();
          if (cwd) return cwd;
          await new Promise((r) => setTimeout(r, 150));
        }
      } catch (err) { /* بی دسترسی: سطحِ پروژه خاموش می‌ماند */ }
      return '';
    }

    function settingsCacheRead() {
      try {
        const raw = window.localStorage.getItem(SETTINGS_CACHE_KEY);
        if (!raw) return null;
        return readLayers(JSON.parse(raw), Object.keys(SETTINGS_DEFAULTS));
      } catch (err) { return null; }
    }
    function settingsCacheWrite(layers) {
      try { window.localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(layers)); } catch (err) { /* بی‌جا */ }
    }

    /** یک‌بار در هر بارگذاری: پرونده‌ها را می‌خواند و (اگر لازم بود) سراسری را از localStorage پر می‌کند. */
    async function initSettings() {
      workspaceProbed = true;
      const cached = settingsCacheRead();
      if (cached) settingsEmit({ layers: cached });
      const sid = currentSessionId();
      settingsEmit({ sessionId: sid });
      // پوشهٔ کار بی‌خطا: هر خطایی فقط سطحِ پروژه را خاموش می‌کند، نه خواندنِ پرونده‌ها را.
      try { workspaceCwd = (await probeWorkspace()) || ''; } catch (err) { workspaceCwd = ''; }
      const cwd = workspaceCwd || '';
      const url = settingsUrl(SETTINGS_ROUTE + '?sessionId=' + encodeURIComponent(sid) + '&cwd=' + encodeURIComponent(cwd));
      try {
        const res = await fetch(url, { headers: { accept: 'application/json' }, credentials: 'same-origin' });
        if (res.status === 404) {
          settingsEmit({ host: 'missing', note: 'برای ذخیره در پرونده، اپ یک بار بسته و باز شود' });
          return;
        }
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const body = await res.json();
        if (!body || body.ok !== true) throw new Error('پاسخِ نامعلوم');
        const layers = readLayers({ global: body.global, project: body.project, chat: body.chat }, Object.keys(SETTINGS_DEFAULTS));
        const globalHasNothing = !body.global || Object.keys(body.global).length === 0;
        if (globalHasNothing) await seedGlobalFromLocal();
        settingsCacheWrite(layers);
        settingsEmit({ layers: layers, host: 'ready', files: body.files || null, note: '' });
      } catch (err) {
        settingsEmit({ host: 'error', note: 'پروندهٔ تنظیم‌ها خوانده نشد؛ فعلاً از همین مرورگر استفاده می‌شود.' });
      }
    }

    /** مهاجرتِ یک‌باره: مقدارهای localStorage ِ همین مرورگر ⇒ پروندهٔ سراسری. */
    async function seedGlobalFromLocal() {
      try {
        const values = Object.assign({}, prefs, plus);
        delete values.commands; delete values.extras; delete values.profiles;
        await fetch(SETTINGS_ROUTE, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'seed', values: values }),
        });
      } catch (err) { /* پرونده نصفه‌کاره نماند؛ بارِ بعد دوباره */ }
    }

    /**
     * یک مقدار را در یک سطح ذخیره/پاک می‌کند.
     * value === undefined ⇒ آن کلید از آن سطح پاک می‌شود.
     */
    async function settingsSave(level, key, value) {
      if (!SETTINGS_LEVELS.includes(level)) return;
      const layers = setAt(settingsState.layers, level, key, value);
      settingsEmit({ layers: layers });
      settingsCacheWrite(layers);
      applySettingsToRuntime(key, value, level);
      // undefined در JSON نیست؛ پاک‌کردن با فهرستِ unset گفته می‌شود
      const patch = {};
      const unset = [];
      if (value === undefined) unset.push(key);
      else patch[key] = value;
      const body = {
        action: 'save', level: level, patch: patch, unset: unset,
        sessionId: currentSessionId(), cwd: workspaceCwd || '',
      };
      try {
        const res = await fetch(SETTINGS_ROUTE, {
          method: 'POST', credentials: 'same-origin',
          headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
        });
        if (res.status === 404) { settingsEmit({ host: 'missing', note: 'برای ذخیره در پرونده، اپ یک بار بسته و باز شود' }); return; }
        const answer = await res.json();
        if (!answer || answer.ok !== true) { toast('ذخیره نشد: ' + String(answer && answer.error ? answer.error : 'خطای نامعلوم')); return; }
        const fresh = readLayers({ global: answer.global, project: answer.project, chat: answer.chat }, Object.keys(SETTINGS_DEFAULTS));
        settingsCacheWrite(fresh);
        settingsEmit({ layers: fresh, host: 'ready', files: answer.files || null, note: '' });
      } catch (err) {
        toast('پروندهٔ تنظیم‌ها جواب نداد؛ مقدار در همین مرورگر ماند');
      }
    }

    /** مقدارِ مؤثر را همان لحظه روی CSS و ابزارها می‌نشاند. */
    function applySettingsToRuntime(key, value, level) {
      const effective = effectiveOf(settingsState.layers, key, SETTINGS_DEFAULTS[key]).value;
      const next = {};
      next[key] = effective;
      if (Object.prototype.hasOwnProperty.call(DEFAULTS, key)) writePrefs(next);
      else if (Object.prototype.hasOwnProperty.call(PLUS_DEFAULTS, key)) patchPlus(next);
    }

    function settingsSearch(query) {
      settingsEmit({ query: String(query || '') });
    }

    /** مقدارِ یک کلید از سه سطح (برای رندرِ مثلاً CSS). */
    function settingsEffective(key) {
      return effectiveOf(settingsState.layers, key, SETTINGS_DEFAULTS[key]).value;
    }

    /* --- «تنظیم‌های خودِ اپ»: فقط خواندن از describe ِ DSH (خودش رازها را می‌پوشاند) --- */
    let appSettingsState = { ready: false, error: '', rows: [], namespaces: [] };
    let appSettingsForms = null;
    const appSettingsListeners = new Set();

    function appSettingsEmit(patch) {
      appSettingsState = Object.assign({}, appSettingsState, patch);
      appSettingsListeners.forEach((fn) => { try { fn(); } catch (err) { /* بقیه */ } });
    }

    function useAppSettings() {
      const [snap, setSnap] = React.useState(appSettingsState);
      React.useEffect(() => {
        const f = () => setSnap(appSettingsState);
        appSettingsListeners.add(f);
        f();
        void loadAppSettings();
        return () => { appSettingsListeners.delete(f); };
      }, []);
      return snap;
    }

    /** نشانیِ مطلقِ یک مسیرِ همین اپ (client.js جز react چیزی import نمی‌کند، پس import.meta نداریم؛
        دامنه هم نسبی نوشته می‌شود تا از خودِ مرورگر گرفته شود). */
    function settingsUrl(pathname) {
      return pathname;
    }

    async function loadAppSettings() {
      const ctx = clientCtx;
      const forms = ctx && typeof ctx.get === 'function' ? ctx.get('configForms') : null;
      if (!forms || typeof forms.describe !== 'function') {
        appSettingsEmit({ ready: true, error: 'سرویسِ تنظیم‌های برنامه در دسترس نیست', rows: [] });
        return;
      }
      try {
        const face = forms.describe();
        await face.ensure();
        const read = () => {
          const snap = face.getSnapshot();
          return snap && snap.view ? snap.view : null;
        };
        // تا وقتیdescribe جواب نداده دوباره می‌پرسیم (حداکثر ~۶ ثانیه)؛ بعد صفحه خالی می‌ماند.
        let view = read();
        for (let i = 0; i < 12 && !view; i += 1) {
          await new Promise((r) => setTimeout(r, 500));
          await face.ensure();
          view = read();
        }
        if (!view) { appSettingsEmit({ ready: true, error: '', rows: [] }); return; }
        appSettingsForms = forms;
        const locale = (APP_SETTINGS_LOCALE && APP_SETTINGS_LOCALE.meta) ? APP_SETTINGS_LOCALE : {};
        const rows = [];
        for (const ns of view.namespaces || []) {
          for (const row of appSettingRows(ns, locale)) {
            if (!row.secret) rows.push(row);
          }
        }
        appSettingsEmit({ ready: true, error: '', rows: rows, namespaces: (view.namespaces || []).map((n) => n.ns) });
      } catch (err) {
        appSettingsEmit({ ready: true, error: String(err && err.message ? err.message : err), rows: [] });
      }
    }

    /** یک ردیفِ «تنظیم‌های خودِ اپ»: فقط مقدارِ الان + دکمهٔ تغییر (اگر فیلد volatile باشد) */
    function AppRow(props) {
      const row = props.row;
      let form = null;
      try { form = appSettingsForms ? appSettingsForms.get(row.ns) : null; } catch (err) { form = null; }
      return h('div', { className: 'dsh-rtl-row dsh-rtl-app-row', key: props.key, 'data-app': row.ns + '.' + row.key },
        h('div', { className: 'dsh-rtl-row-text' },
          h('span', { className: 'dsh-rtl-row-title' }, row.label),
          h('span', { className: 'dsh-rtl-row-hint' }, row.hint),
          h('span', { className: 'dsh-rtl-row-now' }, 'الان: ' + displayValue(row.value, row.key), ' ', h('span', { className: 'dsh-rtl-level', 'data-level': 'global' }, 'سراسری')),
          h('span', { className: 'dsh-rtl-row-key' }, row.ns + '.' + row.key)),
        form ? h(AppControl, { row: row, form: form }) : h('span', { className: 'dsh-rtl-note' }, 'فقط‌خواندنی'));
    }

    /** کنترلِ ویرایشِ زنده: عدد/بولی/متن، با همان configForm ِ خودِ صفحه‌های تنظیماتِ DSH */
    function AppControl(props) {
      const row = props.row;
      const form = props.form;
      const [value, setValue] = React.useState(row.value);
      const [busy, setBusy] = React.useState(false);
      const commit = () => {
        setBusy(true);
        form.set(row.key, value).then((ok) => {
          setBusy(false);
          if (!ok) toast('برنامه این مقدار را نپذیرفت');
        }, () => { setBusy(false); toast('ذخیره نشد'); });
      };
      if (typeof value === 'boolean') {
        return h(Switch, { checked: !!value, label: row.label, onToggle: () => { setValue(!value); commit(); } });
      }
      if (typeof value === 'number') {
        return h('span', { className: 'dsh-rtl-app-edit' },
          h('input', { type: 'number', value: value, disabled: busy, onChange: (e) => setValue(Number(e.target.value)) }),
          h('button', { type: 'button', onClick: commit, disabled: busy }, 'ثبت'));
      }
      if (typeof value === 'string') {
        return h('span', { className: 'dsh-rtl-app-edit' },
          h('input', { type: 'text', value: value, disabled: busy, onChange: (e) => setValue(e.target.value) }),
          h('button', { type: 'button', onClick: commit, disabled: busy }, 'ثبت'));
      }
      return h('span', { className: 'dsh-rtl-note' }, 'این مقدار از این‌جا تغییر نمی‌کند');
    }

    /** سه تیکِ سطحِ یک ردیف + چک‌باکسِ روشن/خاموش + کادرِ مقدار + ثبت */
    function SettingsRow(props) {
      const row = props.row;
      const st = props.st;
      const eff = effectiveOf(st.layers, row.key, fallbackOf(row));
      const [draft, setDraft] = React.useState(null);
      const [level, setLevel] = React.useState('global');
      const meaning = typeof MEANING[row.key] === 'function' ? MEANING[row.key](eff.value) : '';
      const isBool = row.type === 'bool' || typeof fallbackOf(row) === 'boolean';
      const save = (value) => settingsSave(level, row.key, value);
      const control = isBool
        ? h(Switch, { checked: !!eff.value, label: row.label, onToggle: () => save(!eff.value) })
        : h('input', {
          type: 'text',
          dir: 'ltr',
          className: 'dsh-rtl-row-value',
          value: draft === null ? (eff.value === undefined ? '' : String(eff.value)) : draft,
          onChange: (e) => setDraft(e.target.value),
        });
      const register = isBool
        ? null
        : h('button', { type: 'button', className: 'dsh-rtl-save', onClick: () => { save(draft === null ? eff.value : draft); setDraft(null); } }, 'ثبت');
      return h('div', { className: 'dsh-rtl-row', key: row.key, 'data-row': row.key },
        h('div', { className: 'dsh-rtl-row-text' },
          h('span', { className: 'dsh-rtl-row-title' }, row.label),
          h('span', { className: 'dsh-rtl-row-hint' }, row.hint),
          h('span', { className: 'dsh-rtl-row-now' }, nowLine({ level: eff.level, value: eff.value, meaning: meaning })),
          h('span', { className: 'dsh-rtl-badges' },
            SETTINGS_LEVELS.map((lvl) => h('button', {
              type: 'button',
              key: lvl,
              className: 'dsh-rtl-level' + (eff.level === lvl ? ' dsh-rtl-level-on' : '') + (valueAt(st.layers, lvl, row.key) !== undefined ? ' dsh-rtl-level-set' : ''),
              'data-level': lvl,
              'data-set': valueAt(st.layers, lvl, row.key) !== undefined ? '1' : '0',
              title: valueAt(st.layers, lvl, row.key) === undefined ? 'در این سطح مقداری نیست' : 'در «' + levelName(lvl) + '» مقدار دارد — کلیک = پاک کردن',
              onClick: () => settingsSave(lvl, row.key, undefined),
            }, levelName(lvl))))),
        h('span', { className: 'dsh-rtl-row-control' },
          h('select', { className: 'dsh-rtl-row-level', value: level, onChange: (e) => setLevel(e.target.value), 'aria-label': 'کجا ذخیره شود' },
            SETTINGS_LEVELS.map((lvl) => h('option', { key: lvl, value: lvl }, levelName(lvl)))),
          control,
          register));
    }

    /** پیش‌فرضِ یک ردیف: کلیدهای شناخته‌شده از SETTINGS_DEFAULTS، بقیه از fallback ِ خودِ ردیف. */
    function fallbackOf(row) {
      return Object.prototype.hasOwnProperty.call(SETTINGS_DEFAULTS, row.key) ? SETTINGS_DEFAULTS[row.key] : row.fallback;
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

      /* سه سطح: سراسری/پروژه/چت — پرونده‌ها را نیمهٔ host می‌خواند و می‌نویسد */
      const st = useSettingsStore(true);
      const app = useAppSettings();

      /* جست‌وجو: ردیف‌هایی که واژه‌ای در برچسب/شرح/کلید/مقدارشان نیست پنهان می‌شوند */
      const filterOn = !!st.query.trim();
      const valueOf = (row) => effectiveOf(st.layers, row.key, fallbackOf(row)).value;
      const keep = (row, value) => !filterOn || matchesQuery([
        { label: row.label, hint: row.hint, key: row.key, value: value === undefined ? '' : String(value) },
      ], st.query);

      const sections = SECTION_SPECS.map((spec) => {
        const rows = spec.rows.filter((row) => keep(row, valueOf(row)));
        if (!rows.length) return null;
        return h('section', { className: 'dsh-rtl-section', key: spec.id, 'data-section': spec.id },
          h('h3', null, spec.title),
          h('p', { className: 'dsh-rtl-section-hint' }, spec.hint),
          rows.map((row) => h(SettingsRow, { key: row.key, row: row, st: st })));
      }).filter(Boolean);

      const appRows = app.rows.filter((row) => !filterOn || matchesQuery([{ label: row.label, hint: row.hint, key: row.ns + '.' + row.key }], st.query));
      const appSection = appRows.length ? h('section', { className: 'dsh-rtl-section', key: 'app', 'data-section': 'app' },
        h('h3', null, 'تنظیم‌های خودِ اپ'),
        h('p', { className: 'dsh-rtl-section-hint' }, 'همان تنظیم‌هایی که در Settings ← General هم هست. فقط «سراسری»اند — برای پروژه یا چت جدا نمی‌شوند.'),
        h('div', { className: 'dsh-rtl-only-global' }, 'این‌ها فقط سراسری‌اند'),
        app.ready
          ? appRows.map((row) => h(AppRow, { row: row, app: app, key: row.ns + '.' + row.key }))
          : h('p', { className: 'dsh-rtl-note' }, app.error ? 'خواندنِ تنظیم‌های برنامه نشد: ' + app.error : 'در حال خواندنِ تنظیم‌های برنامه…')) : null;

      const body = h(
        'div',
        { className: 'dsh-rtl-page' },
        h('input', {
          type: 'search',
          className: 'dsh-rtl-search',
          placeholder: 'جست‌وجو در تنظیمات…',
          value: st.query,
          onChange: (e) => settingsSearch(String(e.target.value)),
          'aria-label': 'جست‌وجو در تنظیمات',
        }),
        st.host === 'missing'
          ? h('p', { className: 'dsh-rtl-note dsh-rtl-host-note', 'data-host': 'missing' },
            'برای ذخیره در پرونده، اپ یک بار بسته و باز شود')
          : st.note
            ? h('p', { className: 'dsh-rtl-note dsh-rtl-host-note', 'data-host': st.host }, st.note)
            : null,
        h('p', { className: 'dsh-rtl-note' }, 'مقدارِ مؤثر = چت ← پروژه ← سراسری ← پیش‌فرض. اگر یک تنظیم در چند جا باشد، «چت» برنده است.'),
        sections,
        appSection,
        st.query.trim() && !sections.length && !appSection
          ? h('p', { className: 'dsh-rtl-empty' }, 'چیزی با «' + st.query + '» پیدا نشد.')
          : null,
        h('div', { className: 'dsh-rtl-note' },
          'اگر جایی چیدمان به‌هم ریخت، اول «راست‌به‌چپ» را خاموش کن؛ بعد یکی‌یکی روشن کن تا معلوم شود کدام گزینه آن صفحه را به‌هم می‌زند.'),
        h(PlusPanel, { inSettings: true }),
      );
      return body;
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
    const aaNativePlus=JSON.parse(JSON.stringify(plus));
    let ReactDOM = null;
    try { ReactDOM = require('react-dom'); } catch (err) { ReactDOM = null; }

    let plusStyle = null;
    function applyPlusCss() {
      if (plusStyle) plusStyle.textContent = PLUS_BASE_CSS + '\n' + plusCss(plus);
    }
    const AA_KEYS = ['lines','tableScroll','accent','textColor','lh','opacity','counter','quoteMenu','aaTaze','btnSize','buttons','commands','extras','profiles'];
    let aaReady=false, aaScope='poshe', aaLayers={}, aaApplying=false, aaStamp='';
    let aaQueue=Promise.resolve(), aaPending=0, aaVersion=0, aaResolved=false;
    function aaRequest(patch, unset) {
      const write=!!(patch || unset), sid=currentSessionId(), scope=aaScope;
      if (!write && aaPending) return aaQueue;
      if (write) aaVersion++;
      const revision=aaVersion;
      aaPending++;
      aaQueue=aaQueue.then(async () => {
        const cwd=await probeWorkspace(sid);
        if(!cwd || (!write && sid!==currentSessionId())) return;
        const url='/plugins/rtl/aa-shared?sessionId='+encodeURIComponent(sid)+'&cwd='+encodeURIComponent(cwd);
        const opts=write?{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({scope,sessionId:sid,cwd,patch:patch||{},unset:unset||[]})}:{};
        const response=await fetch(url,opts);
        const got=await response.json();
        if(!got.ok || !got.layers || sid!==currentSessionId() || revision!==aaVersion) return;
        aaReady=true;
        aaLayers=got.layers;
        const stamp=JSON.stringify([sid,cwd,got.values]);
        if(stamp!==aaStamp){
          aaStamp=stamp;aaApplying=true;
          try { savePlus(Object.assign({},aaNativePlus,got.values)); } finally { aaApplying=false; }
        }
      }).catch(() => { if(sid===currentSessionId()) aaReady=false; }).finally(() => {
        aaPending--;
        if(!aaResolved){aaResolved=true;plus={...plus};plusListeners.forEach(fn=>fn());}
      });
      return aaQueue;
    }
    function savePlus(next) {
      next=readPlus(next);
      if(!aaApplying){const patch={};for(const k of AA_KEYS)if(JSON.stringify(next[k])!==JSON.stringify(plus[k]))patch[k]=next[k];if(Object.keys(patch).length)aaRequest(patch);}
      plus = readPlus(next);
      if(!aaApplying){
        for(const k of Object.keys(plus))if(!aaReady || !AA_KEYS.includes(k))aaNativePlus[k]=plus[k];
        try { window.localStorage.setItem(PLUS_KEY, JSON.stringify(aaNativePlus)); } catch (err) {}
      }
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
      '.dsh-tik-tabs{display:flex;gap:4px;border-bottom:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.25));padding-bottom:4px}',
      '.dsh-tik-tabs button{font:inherit;color:inherit;background:none;border:0;border-radius:6px 6px 0 0;padding:2px 10px;cursor:pointer;opacity:.7}',
      '.dsh-tik-tabs button[data-on="1"]{opacity:1;font-weight:700;background:rgba(127,127,127,.16)}',
      '.dsh-tik{display:flex;flex-direction:column;gap:6px}',
      '.dsh-tik-sath{display:flex;gap:4px}',
      '.dsh-tik-sath button{flex:1 1 0;font:inherit;color:inherit;background:rgba(127,127,127,.1);border:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.35));border-radius:6px;padding:3px 6px;cursor:pointer;opacity:.8}',
      '.dsh-tik-sath button[data-on="1"]{opacity:1;font-weight:700;background:rgba(127,127,127,.28)}',
      '.dsh-tik-search{width:100%;box-sizing:border-box;background:rgba(127,127,127,.12);border:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.35));border-radius:6px;color:inherit;font:inherit;padding:2px 8px}',
      '.dsh-tik-group h4{margin:6px 0 2px;font-size:12px;color:var(--dsw-alias-label-secondary);font-weight:600}',
      '.dsh-tik-row{display:grid;grid-template-columns:16px minmax(65px,1fr) minmax(105px,2fr) minmax(40px,.6fr);align-items:start;gap:6px;padding:1px 2px;border-radius:5px;cursor:pointer}',
      '.dsh-tik-row:hover{background:rgba(127,127,127,.1)}',
      '.dsh-tik-esm{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;direction:ltr;text-align:left;font:11px/1.6 ui-monospace,monospace}',
      '.dsh-tik-usage{min-width:0;white-space:normal;overflow-wrap:anywhere;direction:rtl;line-height:1.8}',
      '.dsh-tik-row .dsh-tik-esm{white-space:normal;overflow:visible;overflow-wrap:anywhere}',
      '@media(max-width:420px){.dsh-tik-row{grid-template-columns:16px minmax(60px,1fr) minmax(100px,1.6fr)}.dsh-tik-az{grid-column:2 / 4}}',
      '.dsh-tik-az{flex:0 0 auto;font-size:10px;color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary))}',
      '.dsh-tik-actions{display:flex;gap:4px;margin-top:4px}',
      '.dsh-tik-actions button{font:inherit;color:inherit;background:rgba(127,127,127,.16);border:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.35));border-radius:6px;padding:2px 10px;cursor:pointer}',
      '.dsh-tik-actions button:disabled{opacity:.45;cursor:default}',
      '.dsh-tik-note{color:var(--dsw-alias-label-secondary);font-size:10.5px;line-height:1.7;margin:0}',
      '.dsh-tik-ask{border:1px solid rgba(200,120,0,.5);border-radius:8px;padding:6px;background:rgba(200,120,0,.08)}',
      '.dsh-tik-ask p{margin:0 0 4px;font-size:11px}',
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
      const [tab, setTab] = React.useState('look');
      const aaRef = React.useRef(null);
      /* چتِ تازه: Aa خودش روی تبِ «ابزارها» باز می‌شود — ولی هر چت فقط یک‌بار،
         و فقط وقتی کاملاً خالی است (بی‌پیام و بی‌نمایشِ گفتگو). */
      const openedOnce = React.useRef('');
      React.useEffect(() => {
        if ((!aaReady && !aaResolved) || !s.aaTaze || where !== 'dock' || !sid || open) return undefined;
        if (openedOnce.current === sid) return undefined;
        let tries = 0;
        let alive = true;
        const tick = () => {
          if (!alive) return;
          const scroll = document.querySelector('[data-conversation-scroll]');
          const hollow = !scroll || !scroll.textContent || !scroll.textContent.trim();
          const raw = typeof draft === 'string' ? draft.trim() : '';
          if (hollow && raw === '') {
            openedOnce.current = sid;
            setTab('abzar');
            setOpen(true);
            return;
          }
          tries += 1;
          if (tries < 20) window.setTimeout(tick, 400);
        };
        const t = window.setTimeout(tick, 300);
        return () => { alive = false; window.clearTimeout(t); };
      }, [sid, where, s.aaTaze, aaReady, aaResolved, open, draft]);
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
          onClick: () => { if (open) { setOpen(false); } else { setTab('look'); setOpen(true); } },
        }, 'aA'),
        open ? renderFloating(h(PlusPanel, { onClose: () => setOpen(false), startTab: tab, sessionId: sid, cwd: (workspaceCwd || '') }), aaRef.current) : null);
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

    /* --- تبِ «ابزارها»: چهار دسته، سه سطح، پیش‌فرضِ چتِ تازه ---------------
     * منبعِ راستین: /plugins/rtl/tik (نیمهٔ host). تصمیم در tik-inline است.
     */
    const TIK_ROUTE = '/plugins/rtl/tik';
    const TIK_SATHA = [['chat', 'این چت'], ['poshe', 'این پوشه'], ['sarasari', 'سراسری']];

    function TikPanel(props) {
      const [state, setState] = React.useState({ loading: true, rows: [], az: '', folder: null, error: '' });
      const [sath, setSath] = React.useState('chat');
      const [q, setQ] = React.useState('');
      const [draft, setDraft] = React.useState({});   // "kind:name" -> bool
      const [ask, setAsk] = React.useState(null);     // تغییرهایی که باید برای «سراسری» تأیید شوند
      const [busy, setBusy] = React.useState(false);

      const sid = String(props.sessionId == null ? '' : props.sessionId);
      const cwdProp = String(props.cwd || '');
      // پوشهٔ کار را هنگامِ نیاز از خودِ برنامه می‌پرسیم؛ مقدارِ آغازین ممکن است هنوز نرسیده باشد
      // (در آزمونِ صفحه دیده شد: cwd خالی می‌رفت و ثبت رد می‌شد).
      const cwdRef = React.useRef(cwdProp);
      const cwdNow = React.useCallback(async () => {
        if (cwdRef.current) return cwdRef.current;
        try { cwdRef.current = (await probeWorkspace()) || cwdProp; } catch (err) { cwdRef.current = cwdProp; }
        return cwdRef.current;
      }, [cwdProp]);
      const cwd = cwdProp;

      const dirtyRef=React.useRef(false); dirtyRef.current=Object.keys(draft).length>0 || busy;
      React.useEffect(() => {
        let active = true;
        const refresh=()=>{if(dirtyRef.current)return;return cwdNow().then((dir) => {
          const url = TIK_ROUTE + '?sessionId=' + encodeURIComponent(sid) + '&cwd=' + encodeURIComponent(dir || '') + '&sath=' + sath;
          return fetch(url, { headers: { accept: 'application/json' }, credentials: 'same-origin' })
            .then((r) => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))))
            .then((d) => active && setState({ loading: false, rows: d.rows || [], az: d.az || '', folder: d.folder || null, chatLocked: d.chatLocked, error: '' }));
        }).catch((err) => active && setState({ loading: false, rows: [], az: '', folder: null, error: String(err && err.message ? err.message : err) }));
        };refresh();const poll=setInterval(refresh,1500);
        return () => { active = false; clearInterval(poll); };
      }, [sid, cwdNow, sath]);

      const key = (kind, name) => kind + ':' + name;
      const shown = (kind, name, original) => {
        const k = key(kind, name);
        return Object.prototype.hasOwnProperty.call(draft, k) ? draft[k] : original;
      };
      const toggle = (kind, name, original) => {
        const k = key(kind, name);
        setDraft((d) => {
          const n = Object.assign({}, d);
          const cur = Object.prototype.hasOwnProperty.call(d, k) ? d[k] : original;
          const next = !cur;
          // اگر همان مقدارِ اصلی شد، از فهرستِ تغییرها برو
          if (next === original) delete n[k]; else n[k] = next;
          return n;
        });
      };
      const changes = () => Object.keys(draft).map((k) => {
        const i = k.indexOf(':');
        return { kind: k.slice(0, i), name: k.slice(i + 1), on: draft[k] };
      });
      const n = changes().length;

      const submit = (list) => {
        if (!list.length) { toast('تغییری نکرده'); return; }
        setBusy(true);
        cwdNow().then((dir) => fetch(TIK_ROUTE, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ sessionId: sid, cwd: dir || '', sath: sath, taghir: list }),
        }))
          .then((r) => r.json())
          .then((d) => {
            setBusy(false);
            if (!d || d.ok !== true) { toast('ثبت نشد: ' + ((d && d.error) || 'نامعلوم') + (sath === 'poshe' && !cwdRef.current ? ' — پوشهٔ کار پیدا نشد' : '')); return; }
            setDraft({});
            setState({ loading: false, rows: d.rows || [], az: d.az || '', folder: d.folder || null, chatLocked: d.chatLocked, error: '' });
            toast((d.matn || 'ثبت شد') + ' — روی چت‌های تازه اثر دارد');
          })
          .catch((err) => { setBusy(false); toast('ثبت نشد'); });
      };
      const onSave = () => {
        const list = changes();
        if (!list.length) { toast('تغییری نکرده'); return; }
        if (sath === 'sarasari') { setAsk(list); return; }
        submit(list);
      };

      const azLabel = state.az === 'chat' ? 'تیک‌های همین چت' : state.az === 'poshe' ? 'تیک‌های این پوشه' : state.az === 'sarasari' ? 'تیک‌های سراسری' : 'پیش‌فرضِ برنامه';
      return h('div', { className: 'dsh-tik' },
        h('div', { className: 'dsh-tik-sath' },
          TIK_SATHA.map(([v, label]) => h('button', {
            key: v, type: 'button', 'data-on': sath === v ? '1' : undefined,
            title: v === 'chat' ? 'فقط همین چت (اگر تازه باشد)' : v === 'poshe' ? 'این پوشه و چت‌های تازهٔ بعدی‌اش' : 'همهٔ پوشه‌هایی که فهرستِ خودشان را ندارند',
            disabled: busy,
            onClick: () => { if (v !== sath) { setDraft({}); setAsk(null); setSath(v); } },
          }, label))),
        h('div', { className: 'dsh-tik-note' }, azLabel + (state.folder ? ' · ' + state.folder : '')),
        h('input', { type: 'text', className: 'dsh-tik-search', placeholder: 'جست‌وجو…', value: q, onChange: (e) => setQ(e.target.value) }),
        state.error ? h('p', { className: 'dsh-tik-note', style: { color: 'crimson' } }, 'فهرست نیامد: ' + state.error) : null,
        state.loading ? h('p', { className: 'dsh-tik-note' }, 'خواندن…') : null,
        h('div', { className:'dsh-tik-row dsh-tik-columns', 'aria-hidden':'true' }, ['', 'نام ابزار', 'کاربرد', 'سطح / منبع'].map((t,i)=>h('span',{key:i},t))),
        buildRows({ available: {}, list: {}, query: '' }).length && state.rows.map((row) => {
          const ql = q.trim().toLowerCase();
          const items = row.items.filter((i) => !ql || [i.name,i.usage,i.origin,i.owner,azLabel].join(' ').toLowerCase().includes(ql));
          if (!items.length) return null;
          return h('div', { key: row.kind, className: 'dsh-tik-group' },
            h('h4', null, row.label + ' (' + faDigits(items.length) + ')'),
            items.map((i) => {
              const on = shown(row.kind, i.name, i.on);
              return h('label', { key: i.name, className: 'dsh-tik-row', title: i.by ? 'خاموش با افزونهٔ ' + i.by : i.name },
                h('input', { type: 'checkbox', 'aria-label': i.name + ' — ' + (i.usage || ''), checked: on, disabled: sath === 'chat' && state.chatLocked, onChange: () => toggle(row.kind, i.name, i.on) }),
                h('span', { className: 'dsh-tik-esm' }, i.name),
                h('span', { className: 'dsh-tik-usage', title: i.definitionSource || '' }, i.usage || 'توضیحِ معتبرِ این مورد هنوز در دسترس نیست'),
                h('span', { className: 'dsh-tik-az' }, [i.by ? 'از ' + i.by : azLabel, i.origin || ''].filter(Boolean).join(' · ')));
            }));
        }),
        h('div', { className: 'dsh-tik-actions' },
          h('button', { type: 'button', disabled: busy || n === 0 || (sath === 'chat' && state.chatLocked), onClick: onSave }, n ? 'ثبت (' + faDigits(n) + ')' : 'ثبت'),
          n ? h('button', { type: 'button', onClick: () => setDraft({}) }, 'ردِ تغییرها') : null),
        h('p', { className: 'dsh-tik-note' }, sath === 'chat' && state.chatLocked ? 'این چت با همین تیک‌ها ادامه می‌یابد. برای چت‌های تازه «این پوشه» یا «سراسری» را انتخاب کن.' : 'تیک‌ها برای چت‌های تازه‌اند.'),
        ask ? h('div', { className: 'dsh-tik-ask' },
          h('p', null, 'این تغییر روی همهٔ پوشه‌هایی اثر می‌کند که فهرستِ خودشان را ندارند. مطمئنی؟'),
          h('div', { className: 'dsh-tik-actions' },
            h('button', { type: 'button', onClick: () => { const l = ask; setAsk(null); submit(l); } }, 'بله، سراسری ثبت کن'),
            h('button', { type: 'button', onClick: () => setAsk(null) }, 'نه'))) : null);
    }

    function PlusPanel(props) {
      const s = usePlus();
      const onClose = props.onClose;
      const [tab, setTab] = React.useState(props.startTab === 'abzar' ? 'abzar' : 'look');
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
        h('div', {className:'dsh-plus-line'},
          h('select',{className:'dsh-aa-scope',defaultValue:aaScope,onChange:e=>{aaScope=e.target.value;}},
            h('option',{value:'chat'},'این چت'),h('option',{value:'poshe'},'این پوشه'),h('option',{value:'sarasari'},'سراسری')),
          h('span',null,'مشترک با کلود · چت ← پوشه ← سراسری'),
          h('button',{type:'button',onClick:()=>aaRequest({},Object.keys(aaLayers[aaScope==='sarasari'?'global':aaScope==='poshe'?'project':'chat']||{}))},'برگشت به مقدار بالاتر')),
        h('div', { className: 'dsh-plus-head' },
          h('b', null, 'ابزارهای اکستنشن (aA)'),
          onClose ? h('button', { type: 'button', onClick: onClose, title: 'بستن (Esc)' }, '✕') : null),
        h('div', { className: 'dsh-tik-tabs' },
          h('button', { type: 'button', 'data-on': tab === 'look' ? '1' : undefined, onClick: () => setTab('look') }, 'ظاهر'),
          h('button', { type: 'button', 'data-on': tab === 'abzar' ? '1' : undefined, onClick: () => setTab('abzar') }, 'ابزارها')),
        tab === 'abzar' ? h(TikPanel, { sessionId: props.sessionId, cwd: props.cwd }) : h('div', null,
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
        ToggleLine('در چتِ تازه، تبِ «ابزارها» خودش باز شود', 'aaTaze', s, 'وقتی چت هنوز پیامی ندارد، پنلِ aA خودش روی تبِ «ابزارها» باز می‌شود.'),
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
          'اندازهٔ فونتِ متن و کد را خودِ DSH دارد: Settings ← General ← Appearance. نقل‌قولِ یک‌کلیکی هم از خودِ DSH است (دکمهٔ Quote روی متنِ انتخاب‌شده)؛ این منو گزینه‌های بیشتری اضافه می‌کند. همه‌چیز در همین مرورگر ذخیره می‌شود.')));
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
        clientCtx = ctx;
        aaRequest();
        ctx.effect(() => {
          const timer=setInterval(()=>aaRequest(),1000);
          timer.unref?.();
          return ()=>clearInterval(timer);
        });
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

/* --- پنجرهٔ سؤال: جهتِ هر متن از خودِ حرف‌هایش -------------------------- *
 * «direction: rtl» کلِ صفحه متنِ انگلیسیِ سؤال/گزینه/توضیح را هم وارونه می‌کند
 * («How do we do it?» را «?How do we do it» نشان می‌دهد، پرانتز آخرِ جمله به
 * اول می‌رود — با کرومِ واقعی سنجیده شد). کلاس‌ها موقعِ اجرا «<هش>_<نام>»‌اند و
 * card/body/title بینِ ماژول‌های دیگر مشترک، پس فقط داخلِ [data-question-key] (ظرفِ
 * آخرین پرسشِ در انتظار) و با نامِ کلاس‌هایی که فقط در ماژولِ سؤال‌اند. متنِ
 * فارسیِ کامل rtl می‌گیرد، متنِ لاتینِ کامل ltr (ترتیبش درست می‌شود و از لبهٔ
 * راست شروع می‌شود)، و متنِ آمیخته دست‌نخورده می‌ماند تا مرورگر با unicode-bidi
 * خودش جور کند. هر تغییرِ DOM دوباره می‌سنجد (پاسخ‌ها که برمی‌گردند). */
        function startQuestionTextDir() {
          const SEL = [
            '[data-question-key] [class*="_titlePreview"]',
            '[data-question-key] [class*="_optionLabel"]',
            '[data-question-key] [class*="_description"]',
          ].join(',');
          const PERSIAN = /[\u0600-\u06FF]/;
          const LATIN = /[A-Za-z]/;
          const isPersian = (text) => PERSIAN.test(text) && !LATIN.test(text);
          const isLatin = (text) => LATIN.test(text) && !PERSIAN.test(text);
          const mark = () => {
            let nodes;
            try {
              nodes = document.querySelectorAll(SEL);
            } catch (err) {
              return; // موتورِ قدیمی: انتخابگرِ نامعتبر ⇒ بی‌آسیب رها می‌شود
            }
            for (let i = 0; i < nodes.length; i++) {
              const el = nodes[i];
              let text = '';
              for (let n = el.firstChild; n; n = n.nextSibling) {
                if (n.nodeType === 3) text += n.nodeValue;
              }
              const want = isPersian(text) ? 'rtl' : isLatin(text) ? 'ltr' : '';
              const have = el.getAttribute('dir') || '';
              if (!want) {
                if (have) el.removeAttribute('dir');
              } else if (have !== want) {
                el.setAttribute('dir', want);
              }
            }
          };
          let timer = 0;
          const schedule = () => {
            window.clearTimeout(timer);
            timer = window.setTimeout(mark, 300);
          };
          mark();
          const observer = new MutationObserver(schedule);
          observer.observe(document.body, { childList: true, subtree: true, characterData: true });
          return () => {
            window.clearTimeout(timer);
            observer.disconnect();
          };
        }

        ctx.effect(() => startQuestionTextDir(), 'dsh-rtl:question-dir');

        /* جدول/پررنگ/کد در متنِ پنجرهٔ سؤال (region ask-md بالای فایل) */
        ctx.effect(() => startAskMarkdown(window), 'dsh-rtl:ask-md');

        ctx.effect(() => startPlusDom(), 'dsh-rtl:plus-dom');

        ctx.inject?.(['slots', 'sessions'], sessionCtx => {
          sessionCtx.slots.inject('tool.call.toolview', () => sessionCtx.slots.register({
            name: 'tool.call.toolview', key: 'ToolSearch',
            inject: sessionId => ({ searchHistory: sessionCtx.sessions.binding(sessionId)?.eventSource }),
          }, ClaudeToolSearchResult));
        });

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
