window.__ModuleLoader__.load({
  id: '@local/dsh-rtl',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

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
    }

    function clearAlignPass() {
      const marked = document.querySelectorAll('[data-dsh-rtl-skip="aligned"]');
      for (let i = 0; i < marked.length; i += 1) {
        marked[i].style.removeProperty('text-align');
        marked[i].removeAttribute('data-dsh-rtl-skip');
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
      );
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
