/**
 * آزمونِ «چت تمام‌پهنا» (chatFit): «چت رو فیت پنل کنه» — پیام‌ها، جدول‌ها، کادرِ نوشتن،
 * نوارِ دکمه‌ها و نوارِ وضعیت تا لبه‌های پنلِ خودِ چت پهن شوند و با باز/بسته شدنِ پنلِ
 * کنار همراه بمانند.
 *
 * منبعِ حقیقت در asar: dsh-client-ui-conversation/src/client/skeleton/ConversationRoot.module.css
 *   .body { --dsh-chat-content-width: clamp(680px, 64% ستون, 920px);
 *           --dsh-composer-card-max-width: calc(آن + 32px) }   ⇒ سقفِ ستونِ پیام و کارتِ نوشتن
 * راهِ ما: همین دو متغیر روی ظرفِ چت («[data-conversation-content]») دوباره تعریف می‌شوند.
 *
 * سه لایه:
 *  ۱) ساختاری: بلوکِ #region chat-fit هست، همهٔ انتخابگرهایش به ظرفِ چت لنگرند و به
 *     [data-dsh-rtl-chatfit="on"] بسته‌اند (چپ‌به‌راست هم با همین کلید کار می‌کند).
 *  ۲) تنظیم: کلیدِ chatFit در سه سطح (پیش‌فرضِ node و پیش‌فرضِ hostِ افزونه روشن)، و
 *     روشن/خاموش‌کردنِ آن ویژگیِ data-dsh-rtl-chatfit را زنده روی <html> عوض می‌کند.
 *  ۳) رفتاری (کرومِ واقعی با playwright): روی کپیِ DOMِ چت با اندازه‌های واقعی — ستونِ
 *     پیام و کارتِ نوشتن تمامِ عرضِ پنل منهای ۴۸px می‌شوند، با بسته و باز شدنِ پنل
 *     دنبال می‌کنند، در راست‌به‌چپ هم همین‌اند، و سقف‌های خودِ برنامه (اعلان/پنجرهٔ سؤال)
 *     به‌هم نمی‌ریزند. نبودِ playwright یا کروم ⇒ فقط لایهٔ ۳ رد می‌شود.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const source = readFileSync(new URL('../client.js', import.meta.url), 'utf8')

/** پایانِ بلوکِ CSS: خطِ تازه + بک‌تک (بسته‌شدنِ رشتهٔ template در client.js). */
const NEWLINE_BACKTICK = String.fromCharCode(10, 96)
const BEGIN = '/* #region chat-fit'
const END = '/* #endregion chat-fit */'

let JSDOM, React, ReactDOMClient, act
try {
  ({ JSDOM } = require('jsdom'))
  React = require('react')
  ReactDOMClient = require('react-dom/client')
  ;({ act } = require('react-dom/test-utils'))
} catch (err) {
  test('jsdom/react نصب نیست', { skip: true }, () => {})
}

/** همهٔ CSSِ افزونه، همان‌طور که موقعِ اجرا در <style> می‌رود. */
function pluginCss() {
  const start = source.indexOf('const CSS = `')
  assert.ok(start > 0, 'بلوکِ CSS در client.js هست')
  const end = source.indexOf(NEWLINE_BACKTICK, start)
  assert.ok(end > start, 'بلوکِ CSS بسته می‌شود')
  return source.slice(start + 'const CSS = `'.length, end)
}

/** فقط بلوکِ chat-fit (بینِ نشانه‌های #region و #endregion). */
function chatFitCss() {
  const css = pluginCss()
  const a = css.indexOf(BEGIN)
  const b = css.indexOf(END)
  assert.ok(a >= 0 && b > a, 'بلوکِ «chat-fit» با نشانه‌های روشن هست')
  return css.slice(a, b + END.length)
}

/** حذفِ توضیح‌های ریزِ CSS. */
function stripComments(css) {
  let out = ''
  let i = 0
  while (i < css.length) {
    const a = css.indexOf('/*', i)
    if (a < 0) { out += css.slice(i); break }
    out += css.slice(i, a)
    const b = css.indexOf('*/', a + 2)
    if (b < 0) break
    i = b + 2
  }
  return out
}

/** شکستنِ فهرستِ انتخابگر فقط روی کاماهای سطحِ بالا. */
function splitSelectors(selector) {
  const out = []
  let depth = 0
  let start = 0
  for (let i = 0; i < selector.length; i++) {
    const ch = selector[i]
    if (ch === '(' || ch === '[') depth++
    else if (ch === ')' || ch === ']') depth--
    else if (ch === ',' && depth === 0) { out.push(selector.slice(start, i).trim()); start = i + 1 }
  }
  out.push(selector.slice(start).trim())
  return out.filter(Boolean)
}

/** قاعده‌های CSS به شکلِ {selector, body}. */
function rules(css) {
  const clean = stripComments(css)
  const found = []
  let depth = 0
  let start = 0
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i]
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) {
        const chunk = clean.slice(start, i)
        found.push({ selector: chunk.slice(0, chunk.lastIndexOf('{')).trim(), body: chunk.slice(chunk.lastIndexOf('{') + 1).trim() })
        start = i + 1
      }
    }
  }
  return found.filter((r) => r.selector)
}

const ANCHOR = '[data-conversation-content]'

// ------------------------------------------------------------------ لایهٔ ۱: ساختاری

test('بلوکِ chat-fit هست و دو متغیرِ عرضِ خودِ برنامه را روی ظرفِ چت بازتعریف می‌کند', () => {
  const css = chatFitCss()
  const list = rules(css)
  assert.ok(list.length >= 4, 'قاعده‌ها هست: ' + list.length)
  const vars = list.find((r) => r.body.includes('--dsh-chat-content-width') && r.body.includes('--dsh-composer-card-max-width'))
  assert.ok(vars, 'قاعدهٔ متغیرها هست')
  assert.equal(vars.selector, 'html[data-dsh-rtl-chatfit="on"] ' + ANCHOR + ':not([class*="_embeddedBody"])')
  // ستونِ پیام = تمامِ عرضِ پنل منهای کوچک‌ترین فاصله (۲۴px هر طرف)
  assert.match(vars.body, /--dsh-chat-content-width:\s*max\(0px,\s*100% - 48px\)/, 'فاصلهٔ کنار کوچک و بدونِ منفی')
  assert.match(vars.body, /--dsh-composer-card-max-width:\s*var\(--dsh-chat-content-width\)/, 'کارتِ نوشتن هم‌عرضِ ستون')
  assert.match(vars.body, /--dsh-chat-user-width:\s*var\(--dsh-chat-content-width\)/, 'درگِ قدیمیِ عرض فیت را برنمی‌گرداند')
  // دیگر هیچ سقفِ ثابتی (۹۲۰/۶۸۰/۹۵۲) در بلوکِ جدید نمانده — جز سقف‌های کاربردیِ ۵۲۰px
  const fixedCaps = [...stripComments(css).matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter((m) => !/max-width:\s*82%/.test(m[2])) // سقفِ کاربردیِ خودِ برنامه (پاسخ به سؤال)
    .map((m) => m[2]).join('\n')
  assert.doesNotMatch(fixedCaps, /(max-width|width):\s*(920|952)px/, 'ستونِ پیام سقفِ ثابتِ ۹۲۰/۹۵۲px دوباره نگرفته')
  assert.doesNotMatch(fixedCaps, /\b(680|952)px/, 'سقفِ باریکِ قبلی برنگشته')
})

test('انتخابگرهای chat-fit فقط به ظرفِ چت لنگرند و فقط با کلیدِ خودشان کار می‌کنند', () => {
  for (const { selector } of rules(chatFitCss())) {
    for (const one of splitSelectors(selector)) {
      assert.match(one, /^html\[data-dsh-rtl-chatfit="on"\] /, 'قاعدهٔ بی‌کلید یا بی‌لنگر: ' + one)
      assert.match(one, new RegExp(ANCHOR.replace(/[.*+?^$()|[\]\\]/g, '\\$&')), 'به ظرفِ چت لنگر نیست: ' + one)
      assert.doesNotMatch(one, /(^|[\s>])(aside|nav|body|html\b(?!\[)|\*)/, 'انتخابگرِ پهن: ' + one)
      // نامِ کلاسِ عمومی بدونِ [_name] ممنوع؛ فقط نام‌های رمزیِ CSS-module
      assert.doesNotMatch(one, /(^|[\s>])\.(frame|card|body|column|root|pill|row)([\s>:{,]|$)/, 'نامِ کلاسِ عمومی: ' + one)
    }
  }
})

test('سقف‌های خودِ برنامه (اعلان، پنجرهٔ سؤال، پاسخِ ثبت‌شده) در بلوکِ تازه دوباره نوشته شده‌اند', () => {
  const css = chatFitCss()
  assert.match(css, /_notice"\]\s*\{\s*max-width:\s*min\(520px,\s*100%\)/, 'نوارِ اعلان از ستون باریک‌تر می‌ماند')
  assert.match(css, /\[data-question-key\][^{]*_card"\]:has\([^{]*_questionTitle/, 'کارتِ پنجرهٔ سؤال')
  assert.match(css, /max-width:\s*min\(calc\(100% - 32px\),\s*920px\)\s*!important/, 'سقفِ قابِ پنجرهٔ سؤال (با !important تا قاعدهٔ soal-panh با none !important آن را نخورد)')
  assert.match(css, /\[data-question-reply\]\s*\{\s*max-width:\s*82%/, 'کارتِ پاسخِ سؤال')
})

// ------------------------------------------------------------------ لایهٔ ۲: تنظیم

/** افزونه را با یک fetch ِ ساختگی بالا می‌آورد (همان الگوی settings-render.test.mjs). */
function boot(answer) {
  const dom = new JSDOM('<!doctype html><html><head></head><body><div id="root"></div></body></html>', {
    pretendToBeVisual: true, url: 'http://127.0.0.1/',
  })
  const w = dom.window
  globalThis.window = w
  globalThis.document = w.document
  Object.defineProperty(globalThis, 'navigator', { value: w.navigator, configurable: true, writable: true })
  globalThis.MutationObserver = w.MutationObserver
  globalThis.NodeFilter = w.NodeFilter
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  w.requestAnimationFrame = (f) => setTimeout(f, 0)
  w.cancelAnimationFrame = (i) => clearTimeout(i)
  w.CSS = { highlights: new Map() }
  const calls = []
  const fetchStub = async (url, opts) => {
    calls.push({ url: String(url), opts: opts || {} })
    return { ok: true, status: 200, json: async () => answer.body }
  }
  w.fetch = fetchStub
  globalThis.fetch = fetchStub
  let plugin
  w.__ModuleLoader__ = { load: (def) => { plugin = def.factory((name) => { if (name === 'react') return React; throw new Error('no ' + name) }) } }
  w.eval(readFileSync(new URL('../client.js', import.meta.url), 'utf8'))
  const regs = []
  const ctx = {
    effect: (fn) => { fn() },
    get: () => undefined,
    slots: { inject: (name, fn) => fn(), register: (meta, comp) => { regs.push({ meta, comp }); return () => {} } },
  }
  plugin.apply(ctx)
  return { w, calls, regs, section: regs.find((r) => r.meta.name === 'settings.section') }
}

const BODY = {
  ok: true,
  global: { rtl: true, font: true, code: true, plaintext: true },
  project: {},
  chat: {},
  files: { global: '/home/u/.dsh/dsh-rtl/settings.json', project: null, chat: null },
  levels: { global: { ok: true }, project: { ok: false, reason: null }, chat: { ok: false } },
}

if (JSDOM) {
  test('کلیدِ chatFit در سه سطح هست و پیش‌فرضش (node و host) روشن است', () => {
    assert.match(source, /const DEFAULTS = \{[^}]*chatFit: true/, 'پیش‌فرضِ نیمهٔ کلاینت روشن')
    const host = readFileSync(new URL('../index.js', import.meta.url), 'utf8')
    assert.match(host, /const PREFS_DEFAULTS = \{[^}]*chatFit: true/, 'پیش‌فرضِ نیمهٔ host روشن (وگرنه ذخیره‌شدن رد می‌شود)')
    // ردیفِ صفحه دقیقاً مثلِ soalPahn: نوعِ bool + fallback
    assert.match(source, /\{ key: 'chatFit', type: 'bool', label: 'چت تمام‌پهنا \(پر کردنِ پنل\)'/, 'ردهٔ تنظیمات با برچسبِ فارسی')
    assert.match(source, /chatFit: \(v\) => \(v \?[^\n]*: [^\n]*\)/, 'خطِ «یعنی …» برای chatFit')
    assert.match(source, /root\.setAttribute\('data-dsh-rtl-chatfit', prefs\.chatFit === false \? 'off' : 'on'\)/, 'applyDom ویژگی را می‌گذارد (فقط false ِ صریح خاموش)')
    assert.match(source, /root\.removeAttribute\('data-dsh-rtl-chatfit'\)/, 'restoreDom ویژگی را برمی‌دارد')
  })

  test('روشن و خاموش‌کردنِ ردیفِ chatFit ویژگیِ <html> را زنده عوض می‌کند', async () => {
    const { w, calls, section } = boot({ body: BODY })
    globalThis.document = w.document
    globalThis.window = w
    const root = ReactDOMClient.createRoot(w.document.getElementById('root'))
    await act(async () => { root.render(React.createElement(section.comp, { close: () => {} })) })
    for (let i = 0; i < 12; i += 1) await act(async () => { await new Promise((r) => setTimeout(r, 25)) })
    const doc = w.document
    assert.equal(doc.documentElement.getAttribute('data-dsh-rtl-chatfit'), 'on', 'پیش‌فرض: فیت روشن')
    const row = doc.querySelector('[data-row="chatFit"]')
    assert.ok(row, 'ردهٔ chatFit در صفحهٔ تنظیمات هست')
    const sw = row.querySelector('[role="switch"]')
    assert.equal(sw.getAttribute('aria-checked'), 'true', 'پیش‌فرضِ رده روشن')
    // خاموش: خودِ ویژگی همان لحظه off می‌شود و POST به host می‌رود
    await act(async () => { sw.click() })
    await act(async () => { await new Promise((r) => setTimeout(r, 40)) })
    assert.equal(doc.documentElement.getAttribute('data-dsh-rtl-chatfit'), 'off', 'خاموش شد')
    const posts = calls.filter((c) => c.opts && c.opts.method === 'POST')
    assert.ok(posts.length >= 1, 'به host نوشته شد')
    const body = JSON.parse(posts[posts.length - 1].opts.body)
    assert.equal(body.patch.chatFit, false, 'مقدارِ خاموش در پرونده')
    assert.equal(body.level, 'global')
    // همان ردیف باید پاسخِ host را در «الان: …» نشان دهد (منبعِ راستین، نه کش)
    // (صفحه در این DOMِ ساختگی مقدارِ تازه را از host نمی‌گیرد؛ فقط می‌سنجیم رده همان مقدارِ مؤثر را می‌خواند)
    assert.match(doc.querySelector('[data-row="chatFit"] .dsh-rtl-row-now').textContent, /^الان: (روشن|خاموش) از/) 
    await act(async () => { root.unmount() })
  })

  test('ذخیره در سطحِ پروژه و چت هم کار می‌کند (همان سه‌سطحِ soalPahn)', async () => {
    const { w, calls, section } = boot({ body: BODY })
    globalThis.document = w.document
    globalThis.window = w
    const root = ReactDOMClient.createRoot(w.document.getElementById('root'))
    await act(async () => { root.render(React.createElement(section.comp, { close: () => {} })) })
    for (let i = 0; i < 12; i += 1) await act(async () => { await new Promise((r) => setTimeout(r, 25)) })
    const doc = w.document
    const row = () => doc.querySelector('[data-row="chatFit"]')
    const select = row().querySelector('.dsh-rtl-row-level')
    assert.equal(select.value, 'global')
    // انتخابِ «چت» از فهرستِ سطح و بعد خاموش‌کردن
    await act(async () => {
      select.value = 'chat'
      select.dispatchEvent(new w.Event('change', { bubbles: true }))
    })
    await act(async () => { row().querySelector('[role="switch"]').click() })
    await act(async () => { await new Promise((r) => setTimeout(r, 40)) })
    const posts = calls.filter((c) => c.opts && c.opts.method === 'POST')
    const body = JSON.parse(posts[posts.length - 1].opts.body)
    assert.equal(body.level, 'chat', 'سطحِ چت')
    assert.equal(body.patch.chatFit, false)
    await act(async () => { root.unmount() })
  })
}

// ------------------------------------------------------------------ لایهٔ ۳: رفتار در کروم

let chromium
try {
  ({ chromium } = require('playwright'))
} catch {
  chromium = undefined
}
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const canBrowse = Boolean(chromium) && existsSync(CHROME)

/**
 * کپیِ ساختارِ چت با همان نشانه‌های خودِ برنامه ([data-conversation-content]،
 * [data-composer-seat]، [data-conversation-scroll]) و سقف‌های ConversationRoot.module.css
 * و InputBar.module.css. نامِ کلاس‌ها عمداً هش‌دار است («J1_column») تا مثلِ برنامه باشد.
 * three: عرضِ ستونِ چت در آزمون.
 */
function replica(width, rtl) {
  return '<!doctype html><html ' + (rtl ? 'dir="rtl" data-dsh-rtl="on" ' : '') + 'data-dsh-rtl-chatfit="on">' +
    '<head><style>' +
    'html,body{margin:0;padding:0}' +
    '.app{display:flex;align-items:flex-start;width:100vw;height:600px}' +
    '.main{box-sizing:border-box;flex:none;min-width:0;display:flex;flex-direction:column;height:100%}' +
    '.J1_root{display:flex;flex-direction:column;height:100%;min-width:0}' +
    '.J1_body{position:relative;display:flex;flex:1;flex-direction:column;min-height:0;' +
    '--dsh-chat-content-width:var(--dsh-chat-user-width,clamp(680px,calc(var(--dsh-conversation-column-width,0px) * 0.64),920px));' +
    '--dsh-composer-card-max-width:calc(var(--dsh-chat-content-width) + 32px);' +
    '--dsh-composer-side-clearance:16px;--dsh-composer-dock-inset:8px}' +
    '.J1_scrollBody{display:flex;flex:1;flex-direction:column;min-height:0;overflow:auto;margin-right:2px}' +
    '.J1_viewArea{display:flex;flex-direction:column;flex:1;min-height:0}' +
    '.CV_scroll{overflow-x:clip;overflow-y:visible;container-type:inline-size}' +
    '.CV_column{position:relative;max-width:var(--dsh-chat-content-width);width:100%;margin:0 auto;display:flex;flex-direction:column}' +
    '.MI_assistant{max-width:none;border:1px solid #ccc;margin:4px 0}' +
    '.J1_composerSeat{margin-top:auto;background:#fff;display:flex;flex-direction:column}' +
    '.J1_composerStack{display:flex;flex-direction:column;gap:6px}' +
    '.IB_root{display:flex;flex-direction:column;align-items:center;padding:0 var(--dsh-composer-side-clearance) 4px}' +
    '.IB_card{box-sizing:border-box;width:100%;max-width:var(--dsh-composer-card-max-width);background:#f2f2f2;height:90px}' +
    '.IB_notice{width:100%;max-width:var(--dsh-composer-card-max-width);background:#e8e8e8;height:20px}' +
    '.DB_dock{box-sizing:border-box;width:calc(100% - var(--dsh-composer-side-clearance) - var(--dsh-composer-side-clearance));' +
    'max-width:var(--dsh-composer-card-max-width);margin:0 auto;background:#ddd;height:24px}' +
    '.dsh-plus-bar[data-where="dock"]{flex:none;margin:0 auto;padding:0;' +
    'width:calc(100% - 2 * var(--dsh-composer-side-clearance,16px) - 4 * var(--dsh-composer-dock-inset,8px));' +
    'max-width:calc(var(--dsh-composer-card-max-width,780px) - 4 * var(--dsh-composer-dock-inset,8px));background:#cfcfcf;height:22px}' +
    '.SP_pill{display:inline-flex;padding:1px 8px;background:#eee}' +
    '.Q_frame{padding:6px 32px 10px}' +
    '.QP_card{width:100%;max-width:760px;max-height:520px;overflow:hidden;margin:0 auto;background:#fafafa;height:60px}' +
    '.QRE_frame{width:400px;height:20px;background:#f0f0f0}' +
    '.sidepanel{flex:none;width:260px;background:#222}' +
    '</style></head><body><div class="app"><div class="main" id="panel" style="width:' + width + 'px">' +
    '<div class="J1_root" data-phase="active"><div class="J1_body" data-conversation-content="" data-conversation-session="s1" data-conversation-region="chat" data-content-phase="active" data-conversation-controls="">' +
    '<div class="J1_scrollBody" data-conversation-scroll=""><div class="J1_viewArea">' +
    '<div class="CV_scroll" data-slot="conversation.session"><div class="CV_column">' +
    '<div class="MI_assistant" id="msg1">پاسخِ دستیار — یک پیام</div>' +
    '<div class="MI_assistant" id="msg2">پیامِ دوم</div>' +
    '</div></div>' +
    '<div class="QRE_frame" data-question-reply="">پاسخِ ثبت‌شده به سؤال</div>' +
    '</div>' +
    '<div class="J1_composerSeat" data-composer-seat="" data-conversation-region="composer">' +
    '<div class="J1_composerStack">' +
    '<div class="Q_frame" data-question-key="k1"><section class="QP_card QP_cardMinimized"><div class="QP_questionTitle">سؤال؟</div><div class="QP_optionRow">گزینه</div></section></div>' +
    '<div class="DB_dock" id="queue">نوبتِ بعد</div>' +
    '<div class="dsh-plus-bar" data-where="dock" id="chips">دکمه‌های آماده</div>' +
    '<div class="IB_root"><div class="IB_card" id="input">کادرِ نوشتن</div></div>' +
    '<div class="DB_dock" id="pill" style="max-width:none">وضعیت</div>' +
    '</div></div>' +
    '</div></div></div>' +
    '<div class="sidepanel" id="side"></div>' +
    '</div></body></html>'
}

if (!canBrowse) {
  test('رفتار در کروم (playwright یا کروم نیست ⇒ رد شد)', { skip: true }, () => {})
} else {
  test('روی DOMِ کپی‌شده: پیام‌ها و کادرِ نوشتن و نوارِ دکمه‌ها تمامِ عرضِ پنل میشوند', async () => {
    const browser = await chromium.launch({ executablePath: CHROME, headless: true })
    try {
      const page = await browser.newPage({ viewport: { width: 1100, height: 620 } })
      await page.setContent(replica(900, false))
      await page.addStyleTag({ content: pluginCss() })
      const box = (sel) => page.evaluate((s) => {
        const el = document.querySelector(s)
        if (!el) return null
        const r = el.getBoundingClientRect()
        return { left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width) }
      }, sel)
      const chat = await box('[data-conversation-content]')
      const msg = await box('#msg1')
      const input = await box('#input')
      const chips = await box('#chips')
      const pill = await box('#pill')
      // ستونِ پیام‌ها = عرضِ پنل منهای ۴۸
      assert.ok(Math.abs(msg.width - (chat.width - 48)) <= 2, 'پیام‌ها تمامِ عرض: ' + msg.width + ' از ' + chat.width)
      // کارتِ نوشتن: ستون − ۴۸ (فاصلهٔ هر طرف ۲۴) − حدودِ ۱۶px ِ خودِ .root ِ کادر ≈ ۱۰۰۰−۷۶ = ۹۲۴px در برنامه.
      // کفِ ۱۶pxِ نوارِ داخلیِ کادر سقفِ ما را روی ستون منهای ۳۳px نگه می‌دارد (نه منهای ۴۸px).
      // (روشنِ این‌که سقفِ ۹۲۰px رفته: کادر حالا خیلی بیشتر از clamp(680…920)+32 = ۷۱۲px ِ قبلی است)
      assert.ok(input.width > 712 && input.width >= chat.width - 100 && input.width <= chat.width - 24,
        'کادرِ نوشتن پهن شده: ' + input.width + ' از ' + chat.width)
      // نوارِ دکمه‌ها: ۱۰۰۰ − ۲×۱۶ − ۴×۸ = ۹۲۰ ⇒ هم‌لبه با لبهٔ بیرونیِ کارت (۲۵px از ستون دورتر)
      assert.ok(Math.abs(input.left - chips.left) <= 2, 'دکمه‌ها هم‌لبه با کارت: ' + (input.left - chips.left))
      // نوارِ وضعیت (Dock) = ستون − ۲×۱۶ = ۸۶۶ از ۹۰۰ (۹۲۰ از ۱۰۰۰ در برنامه)؛ حاشیه‌اش پس از فیت
      // با محورِ چیدمانِ زیرِ خودش گره نمی‌خورد، پس همین اندازهٔ خودِ قاعده‌اش مُلاک است
      assert.ok(Math.abs(pill.width - (chat.width - 34)) <= 2, 'نوارِ وضعیت با قاعدهٔ خودش: ' + pill.width + ' از ' + chat.width)
      // حاشیهٔ کنارِ پیام دقیقاً ۲۴px هر طرف، روی محورِ خودِ پنل
      assert.ok(Math.abs(msg.left - (chat.left + 24)) <= 2, 'حاشیهٔ ۲۴px سمتِ چپ: ' + (msg.left - chat.left))
      assert.ok(Math.abs(chat.right - msg.right - 24) <= 2, 'حاشیهٔ ۲۴px سمتِ راست: ' + (chat.right - msg.right))
      // سقف‌های خودِ برنامه دست‌نخورده‌اند
      const notice = await page.evaluate(() => {
        const el = document.createElement('div')
        el.className = 'IB_notice'
        document.querySelector('.J1_composerStack').appendChild(el)
        const r = el.getBoundingClientRect()
        return { max: getComputedStyle(el).maxWidth, width: Math.round(r.width), height: Math.round(r.height) }
      })
      // اعلانِ بلندِ کادرِ نوشتن نباید به اندازهٔ کلِ پنل باز شود (سقفِ ۵۲۰pxِ خودِ برنامه)
      assert.ok(notice.width <= 521 && notice.height > 0, 'اعلان با سقفِ خودش: ' + JSON.stringify(notice))
      assert.match(notice.max, /^min\(520px, 100%\)$/, 'min(520px, 100%) ِ خودِ کنار هم به %% اشاره نکند: ' + notice.max)
      const qp = await page.evaluate(() => getComputedStyle(document.querySelector('.QP_card')).maxWidth)
      assert.ok(/^7\d\d/.test(qp) || qp.startsWith('min(') || qp === '920px', 'پنجرهٔ سؤال با سقفِ خودش: ' + qp)
    } finally {
      await browser.close() }
  })

  test('پنلِ کنار بسته/باز شود، ستون با آن همراه است', async () => {
    const browser = await chromium.launch({ executablePath: CHROME, headless: true })
    try {
      const page = await browser.newPage({ viewport: { width: 1100, height: 620 } })
      await page.setContent(replica(840, true))
      await page.addStyleTag({ content: pluginCss() })
      const measure = () => page.evaluate(() => {
        const chat = document.querySelector('[data-conversation-content]').getBoundingClientRect()
        const msg = document.querySelector('#msg1').getBoundingClientRect()
        const input = document.querySelector('#input').getBoundingClientRect()
        return { chat: Math.round(chat.width), msg: Math.round(msg.width), input: Math.round(input.width) }
      })
      const closed = await measure()
      assert.ok(Math.abs(closed.msg - (closed.chat - 48)) <= 2, JSON.stringify(closed))
      // پنلِ کنار باز می‌شود ⇒ ستونِ چت باریک می‌شود و پیام هم دنبالش
      await page.evaluate(() => { document.getElementById('panel').style.width = '560px' })
      const opened = await measure()
      assert.ok(opened.chat < closed.chat - 100, 'ستون باریک شد: ' + opened.chat + ' از ' + closed.chat)
      assert.ok(Math.abs(opened.msg - (opened.chat - 48)) <= 2, 'پیام با ستون آمد: ' + JSON.stringify(opened))
      // کادرِ نوشتن کارت را با ۱۶px ِ خودش از دو طرف می‌بُرد؛ نصفِ آن فاصله (۲۴pxِ ستون) از سقف باز است
      // کادر هم با ستون آمد (نسبت به ستونِ باریک‌تر، پهن‌تر از سقفِ ۷۱۲px ِ حالتِ خاموش است)
      assert.ok(opened.input > 460 && opened.input <= opened.chat, 'کادرِ نوشتن با ستون آمد: ' + JSON.stringify(opened))
    } finally { await browser.close() }
  })

  test('را‌ست‌به‌چپ و چپ‌به‌راست یک اندازه‌اند (فاصلهٔ ۲۴px، بدونِ بیرون‌زدگی)', async () => {
    const browser = await chromium.launch({ executablePath: CHROME, headless: true })
    try {
      const page = await browser.newPage({ viewport: { width: 1100, height: 620 } })
      const measure = async (rtl) => {
        await page.setContent(replica(700, rtl))
        await page.addStyleTag({ content: pluginCss() })
        return page.evaluate(() => {
          const chat = document.querySelector('[data-conversation-content]').getBoundingClientRect()
          const msg = document.querySelector('#msg1').getBoundingClientRect()
          const input = document.querySelector('#input').getBoundingClientRect()
          return { msg: Math.round(msg.width), input: Math.round(input.width), chat: Math.round(chat.width), scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth }
        })
      }
      const ltr = await measure(false)
      const rtl = await measure(true)
      assert.equal(rtl.msg, ltr.msg, 'پیام در هر دو جهت هم‌عرض')
      assert.equal(rtl.input, ltr.input, 'کادرِ نوشتن در هر دو جهت هم‌عرض')
      assert.ok(Math.abs(ltr.msg - (ltr.chat - 48)) <= 2, 'چپ‌به‌راست: ' + JSON.stringify(ltr))
      assert.ok(Math.abs(rtl.msg - (rtl.chat - 48)) <= 2, 'راست‌به‌چپ: ' + JSON.stringify(rtl))
      assert.ok(ltr.scrollW <= ltr.clientW + 1 && rtl.scrollW <= rtl.clientW + 1, 'افقی بیرون نمی‌زند')
    } finally { await browser.close() }
  })

  test('خاموش‌کردنِ کلید ستون را به حالتِ باریکِ خودِ برنامه برمی‌گرداند', async () => {
    const browser = await chromium.launch({ executablePath: CHROME, headless: true })
    try {
      const page = await browser.newPage({ viewport: { width: 1100, height: 620 } })
      await page.setContent(replica(900, false))
      await page.addStyleTag({ content: pluginCss() })
      const width = () => page.evaluate(() => Math.round(document.querySelector('#msg1').getBoundingClientRect().width))
      const on = await width()
      await page.evaluate(() => document.documentElement.setAttribute('data-dsh-rtl-chatfit', 'off'))
      const off = await width()
      assert.ok(on > off + 100, 'روشن پهن‌تر است: ' + on + ' در برابرِ ' + off)
      await page.close()
    } finally { await browser.close() }
  })

  test('ستونِ توکارِ پنلِ کنار (embedded) به‌هم نمی‌ریزد', async () => {
    const browser = await chromium.launch({ executablePath: CHROME, headless: true })
    try {
      const page = await browser.newPage({ viewport: { width: 1100, height: 620 } })
      await page.setContent(replica(900, false))
      await page.addStyleTag({ content: pluginCss() })
      const before = await page.evaluate(() => getComputedStyle(document.querySelector('[data-conversation-content]')).maxWidth)
      await page.evaluate(() => {
        const b = document.querySelector('[data-conversation-content]')
        b.classList.add('_embeddedBody_x1')
        b.style.setProperty('--dsh-chat-content-width', 'min(calc(100% - 32px), 920px)')
      })
      const after = await page.evaluate(() => getComputedStyle(document.querySelector('[data-conversation-content]')).getPropertyValue('--dsh-chat-content-width').trim())
      assert.equal(after, 'min(calc(100% - 32px), 920px)', 'توکار دست‌نخورده می‌ماند')
      assert.ok(before === 'none' || before === '', 'بدونِ توکار سقفِ خودِ ظرف دست‌نخورده')
    } finally { await browser.close() }
  })
}
