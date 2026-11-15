/**
 * آزمونِ «پنجرهٔ سؤالِ تمام‌عرض»: قاعده‌های CSS در client.js، محدود بودنِ انتخابگرها، و
 * رفتارِ واقعی‌شان روی یک کپی از DOMِ خودِ برنامه (نام‌های کلاس از سورسِ asar گرفته می‌شود).
 * کارِ حبیب با پنجرهٔ سؤال همان کارِ نسخهٔ VS Code است: «عرضِ صفحه رو کامل پر بکنه»،
 * «همیشه دیده بشه»، «گزینه‌ها راست‌چین و راحت انتخاب بشن». آزمون‌های کدِ قدیم:
 * test_claude_ask_width.cjs و test_claude_ask_visible.cjs در ریشهٔ پروژه.
 *
 * دو لایه آزمون:
 *  ۱) ساختاری (بی‌مرورگر): قاعده‌ها هست، به راست‌به‌چپ و ظرفِ سؤال محدودند، و هیچ
 *     انتخابگرِ پهن/خطرناکی اضافه نشده.
 *  ۲) رفتاری (کرومِ واقعی از راهِ playwright): روی DOMِ شبیه‌سازی‌شده اندازهٔ واقعی
 *     گرفته می‌شود — پنجره پهن می‌شود، متنِ انگلیسی وارونه نمی‌شود، و قاعده به بقیهٔ
 *     اجزای برنامه (کارتِ کادرِ نوشتن، پیام‌ها، پاسخِ ثبت‌شده) دست نمی‌زند.
 * نبودِ playwright یا کروم ⇒ فقط لایهٔ ۲ رد می‌شود، نه کلِ آزمون.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const source = readFileSync(new URL('../client.js', import.meta.url), 'utf8')

/** پایانِ بلوکِ CSS: خطِ تازه + بک‌تیک (بسته‌شدنِ رشتهٔ template در client.js). */
const NEWLINE_BACKTICK = String.fromCharCode(10, 96)

/** حذفِ توضیح‌های ریزِ CSS (باز و بسته‌شده با ستاره). */
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

/** همهٔ CSSِ افزونه، همان‌طور که موقعِ اجرا در <style> می‌رود. */
function pluginCss() {
  const start = source.indexOf('const CSS = `')
  assert.ok(start > 0, 'بلوکِ CSS در client.js هست')
  const end = source.indexOf(NEWLINE_BACKTICK, start)
  assert.ok(end > start, 'بلوکِ CSS بسته می‌شود')
  return source.slice(start + 'const CSS = `'.length, end)
}

/** همهٔ CSSِ افزونه به‌جزِ بلوکِ «soal-panh» (برای سنجشِ اینکه این بلوک فقط کارِ خودش را می‌کند). */
function pluginCssWithoutQuestions() {
  const css = pluginCss()
  const a = css.indexOf('/* #region soal-panh')
  const b = css.indexOf('/* #endregion soal-panh */')
  return css.slice(0, a) + css.slice(b + '/* #endregion soal-panh */'.length)
}
/** بخشِ تازهٔ پنجرهٔ سؤال (بینِ #region soal-panh و #endregion). */
function questionCss() {
  const css = pluginCss()
  const a = css.indexOf('/* #region soal-panh')
  const b = css.indexOf('/* #endregion soal-panh */')
  assert.ok(a >= 0 && b > a, 'بلوکِ «soal-panh» با نشانه‌های روشن هست')
  return css.slice(a, b + '/* #endregion soal-panh */'.length)
}

/** شکستنِ فهرستِ انتخابگر فقط روی کاماهای سطحِ بالا (کاماهای داخلِ پرانتز دست نمی‌خورند). */
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
  // توضیح‌های ریزِ CSS (/* ... */) برداشته می‌شوند تا تقسیمِ قاعده‌ها گم نشود
  const clean = stripComments(css)
  // قاعده‌ها را با شمارشِ پرانتز می‌شکنیم تا «:is(a, b)» به‌اشتباه دو انتخابگر نشود
  const found = []
  let depth = 0
  let start = 0
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i]
    if (ch === '{') { if (depth === 0) found.push({ selector: clean.slice(start, i).trim(), body: '' }) ; depth++ ; if (depth === 1) continue }
    if (ch === '}') { depth-- ; if (depth === 0) { start = i + 1 ; continue } }
    if (depth === 1) found[found.length - 1].body += ch
  }
  return found.map(r => ({ selector: r.selector.trim(), body: r.body.trim() }))
}

// ---------------------------------------------------------------- لایهٔ ۱: ساختاری

test('قاعده‌های پنجرهٔ سؤال در client.js هست', () => {
  const css = questionCss()
  assert.match(css, /\[data-question-key\] > \[class\*="_card"\]:has\([^{]*\{[^}]*max-width:\s*none/, 'کارتِ سؤال سقفِ عرض ندارد')
  assert.match(css, /max-height:\s*min\(85vh,[^)]*100dvh[^)]*\)/, 'سقفِ ارتفاع درصدی است، نه ۵۲۰px')
  assert.match(css, /_cardMinimized[^{]*\{[^}]*max-height:\s*none/, 'حالتِ جمع‌شده سقف ندارد')
  for (const prop of ['max-height:', 'clip-path:', 'mask-image:']) {
    assert.match(css, new RegExp(prop + '[^;]*none'), 'کلیپِ متنِ بلند برداشته می‌شود: ' + prop)
  }
  assert.match(css, /_optionRow[^{]*\{[^}]*width:\s*100%/, 'هر گزینه تمامِ عرض')
  assert.match(css, /_option[^{]*\{[^}]*width:\s*100%/, 'دکمهٔ گزینه تمامِ عرضِ ردیف')
  assert.match(css, /text-align:\s*right/, 'متن از لبهٔ راست')
  assert.match(css, /\[data-question-scroll\][^{]*\{[^}]*overflow-y:\s*auto/, 'بدنهٔ پنجره خودش اسکرول می‌شود')
})

test('انتخابگرهای پنجرهٔ سؤال محدودند و به بقیهٔ برنامه دست نمی‌زنند', () => {
  const list = rules(questionCss())
  assert.ok(list.length >= 8, 'قاعده‌ها هست')
  for (const { selector } of list) {
    // انتخابگر را فقط روی کاماهای سطحِ بالا می‌شکنیم: «:has(a, b)» و «:is(a, b)» باید یک
    // انتخابگرِ واحد بمانند، وگرنه تکه‌های داخلِ پرانتز بی‌لنگر به نظر می‌رسند
    for (const one of splitSelectors(selector)) {
      assert.match(one, /\[data-composer-seat\]|\[data-question-key\]|\[data-question-scroll\]/,
        'انتخابگرِ بی‌لنگر: ' + one)
      assert.doesNotMatch(one, /(^|[\s>])\.(frame|card|body|options|option|title|header|footer)([\s>:{,]|$)/,
        'نامِ کلاسِ عمومی به‌جای [_name]: ' + one)
      assert.doesNotMatch(one, /^\*/, 'انتخابگرِ جهانی: ' + one)
      // قاعدهٔ اندازهٔ کارت/اسکرول‌پورت عمداً بی‌شرط است: به ظرفِ سؤال یا [data-question-scroll]
      // بسته است و اندازه‌اش در هر دو زبان یکی می‌ماند (هر دو فایلِ app.css یک‌اند)، پس همان
      // جا هم می‌تواند باشد. بقیهٔ قاعده‌ها فقط با راست‌به‌چپِ روشن کار می‌کنند.
      const globalRule = !/data-dsh-rtl/.test(one)
      if (!globalRule) assert.match(one, /^html\[data-dsh-rtl="on"\]/, 'قاعدهٔ بی‌شرط: ' + one)
    }
  }
})

test('تابعِ جهتِ متن ثبت شده و فقط روی ظرفِ سؤال کار می‌کند', () => {
  assert.match(source, /function startQuestionTextDir\(\)/, 'تابعِ startQuestionTextDir هست')
  assert.match(source, /ctx\.effect\(\(\) => startQuestionTextDir\(\), 'dsh-rtl:question-dir'\)/,
    'با ctx.effect ثبت شده تا با پاک‌شدنِ افزونه پاک شود')
  assert.match(source, /ctx\.effect\(\(\) => startPlusDom\(\), 'dsh-rtl:plus-dom'\)/, 'ثبتِ قبلی دست‌نخورده')
  const from = source.indexOf('function startQuestionTextDir()')
  const fn = source.slice(from, source.indexOf("ctx.effect(() => startQuestionTextDir()", from))
  assert.match(fn, /'\[data-question-key\] \[class\*="_titlePreview"\]'/, 'انتخابگر به ظرفِ سؤال محدود است')
  assert.match(fn, /observer\.disconnect\(\)/, 'پاک‌سازیِ observer هست')
})

// ---------------------------------------------------------------- لایهٔ ۲: رفتار در مرورگر

let chromium
try {
  ({ chromium } = require('playwright'))
} catch {
  chromium = undefined
}
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const canBrowse = Boolean(chromium) && existsSync(CHROME)

/**
 * DOMِ کپی‌شده از برنامه با نام‌های کلاسِ واقعیِ ماژولِ سؤال (I1ptPW_*، از lib/client.js
 * در asar) و بقیهٔ اجزای برنامه که نباید عوض شوند.
 */
function replica() {
  const q = n => 'I1ptPW_' + n
  const opt = (label, description) => '<div class="' + q('optionRow') + '" data-option-row>' +
    '<button type="button" class="' + q('option') + '" role="radio">' +
    '<span class="' + q('number') + '">1</span>' +
    '<span class="' + q('optionCopy') + '"><span class="' + q('optionLine') + '">' +
    '<span class="' + q('optionLabel') + '">' + label + '</span></span>' +
    '<span class="' + q('description') + '">' + description + '</span></span></button></div>'
  return '<!doctype html><html dir="rtl" data-dsh-rtl="on"><body style="margin:0;font:14px system-ui">' +
    '<div class="J1_body" data-conversation-content="" data-conversation-session="s1" style="display:flex;flex-direction:column;height:700px;width:1200px">' +
    '<div id="msg" class="MK_body" style="padding:8px">پیامِ گفتگو (نباید عوض شود)</div>' +
    '<div class="J1_scrollBody" data-conversation-scroll="" style="position:relative;display:flex;flex-direction:column;flex:1;min-height:0;overflow:auto">' +
    '<div id="reply" class="R1_frame" data-question-reply="" style="width:400px">پاسخِ ثبت‌شده</div>' +
    '<div class="J1_composerSeat" data-composer-seat="" data-conversation-region="composer" style="position:sticky;bottom:0;padding:0 16px">' +
    '<div id="input" class="J1_card" style="width:952px;max-width:952px;margin:0 auto;height:120px;background:#eee">کادرِ نوشتن</div>' +
    '</div>' +
    // پنجرهٔ سؤال در همان ستون، بالای کادرِ نوشتن (همان جای خودِ برنامه)
    '<div class="Q_frame" data-question-key="k1" style="display:flex;justify-content:center;padding:6px 32px 10px 32px">' +
    '<section id="qcard" class="' + q('card') + '" style="display:flex;flex-direction:column;width:100%;min-height:260px;max-width:760px;max-height:520px;overflow:hidden;border:1px solid #999">' +
    '<header class="' + q('header') + '">سر</header>' +
    '<div class="' + q('body') + '" data-question-scroll style="display:flex;flex-direction:column;flex:1 1 auto;min-height:0">' +
    '<div class="' + q('questionTitle') + '"><h2 id="qtitle" class="' + q('title') + ' ' + q('titlePreview') + '">(recommended) How do we do it?</h2></div>' +
    '<div class="' + q('options') + '">' + opt('(recommended) How do we do it?', 'Runs the whole suite') +
    opt('همیشه دیده شود', 'پنجرهٔ سؤال بالای کادر بماند') + '</div></div>' +
    '<footer class="' + q('footer') + '"><button style="width:60px;height:24px">Skip</button></footer>' +
    '</section></div></div></body></html>'
}

if (!canBrowse) {
  test('رفتار در کروم (playwright یا کروم نیست ⇒ رد شد)', { skip: true }, () => {})
} else {
  test('روی DOMِ کپی‌شده: پنجره پهن می‌شود و بقیهٔ برنامه دست‌نخورده می‌ماند', async () => {
    const browser = await chromium.launch({ executablePath: CHROME, headless: true })
    try {
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
      await page.setContent(replica())
      await page.addStyleTag({ content: pluginCss() })
      const box = (sel) => page.evaluate((s) => {
        const r = document.querySelector(s).getBoundingClientRect()
        return { left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width), height: Math.round(r.height) }
      }, sel)
      const column = await box('.J1_body')
      const card = await box('#qcard')
      const input = await box('#input')
      const reply = await box('#reply')
      assert.ok(card.width > 760, 'کارتِ سؤال پهن‌تر از سقفِ ۷۶۰pxِ آزمون: ' + card.width)
      assert.ok(card.width >= column.width - 100, 'عرضِ پنجره: ' + card.width + ' از ' + column.width)
      assert.equal(input.width, 952, 'کادرِ نوشتن دست‌نخورده')
      assert.equal(reply.width, 400, 'پاسخِ ثبت‌شده در گفتگو دست‌نخورده')
      const maxH = await page.evaluate(() => getComputedStyle(document.getElementById('qcard')).maxHeight)
      assert.notEqual(maxH, '520px', 'سقفِ ۵۲۰pxِ قبلی مانده')
      assert.ok(card.height > 200, 'پنجرهٔ سؤال خیلی کوتاه نشده: ' + card.height)
      const rows = await page.evaluate(() => [...document.querySelectorAll('[class*="_optionRow"]')].map(r => Math.round(r.getBoundingClientRect().width)))
      const inner = await page.evaluate(() => Math.round(document.querySelector('[class*="_options"]').getBoundingClientRect().width))
      for (const w of rows) assert.ok(w >= inner - 40, 'ردیفِ گزینه تمامِ عرض نیست: ' + w + ' از ' + inner)
      const align = await page.evaluate(() => getComputedStyle(document.querySelector('[class*="_optionLabel"]')).textAlign)
      assert.equal(align, 'right', 'برچسبِ گزینه از راست')
    } finally {
      await browser.close()
    }
  })

  test('روی DOMِ کپی‌شده: متنِ لاتین وارونه نمی‌شود و فارسی راست‌چین می‌ماند', async () => {
    const browser = await chromium.launch({ executablePath: CHROME, headless: true })
    try {
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
      await page.setContent(replica())
      await page.addStyleTag({ content: pluginCss() })
      // همان کاری که startQuestionTextDir می‌کند، روی همین DOM و بدونِ React
      const marked = await page.evaluate(() => {
        const PERSIAN = /[\u0600-\u06FF]/, LATIN = /[A-Za-z]/
        const SEL = '[data-question-key] [class*="_titlePreview"],[data-question-key] [class*="_optionLabel"],[data-question-key] [class*="_description"]'
        for (const el of document.querySelectorAll(SEL)) {
          let text = ''
          for (let n = el.firstChild; n; n = n.nextSibling) if (n.nodeType === 3) text += n.nodeValue
          const want = (PERSIAN.test(text) && !LATIN.test(text)) ? 'rtl' : (LATIN.test(text) && !PERSIAN.test(text)) ? 'ltr' : ''
          if (!want) el.removeAttribute('dir'); else el.setAttribute('dir', want)
        }
        // ترتیبِ واقعیِ نویسه‌ها روی صفحه: جای هر نویسه از چپ
        const read = (el) => {
          const n = el.firstChild, s = n.nodeValue, out = []
          for (let i = 0; i < s.length; i++) {
            const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + 1)
            const rects = r.getClientRects(); if (rects.length) out.push([s[i], Math.round(rects[0].left)])
          }
          return out
        }
        const title = document.getElementById('qtitle')
        const labels = [...document.querySelectorAll('[class*="_optionLabel"]')]
        return {
          titleDir: title.getAttribute('dir'),
          title: read(title),
          fa: { dir: labels[1].getAttribute('dir'), chars: read(labels[1]) },
          en: { dir: labels[0].getAttribute('dir'), chars: read(labels[0]) },
        }
      })
      // کارتِ سؤال: متن باید شروعِ راست‌به‌چپ را از قاعدهٔ خودِ ما گرفته باشد، نه از app.css
      const alignFromBlock = await page.evaluate(() => {
        const el = document.querySelector('[class*="_optionLabel"]')
        return getComputedStyle(el).textAlign
      })
      assert.equal(alignFromBlock, 'right', 'برچسبِ گزینه راست‌چین می‌شود (قاعدهٔ همین بلوک)')
      assert.equal(marked.titleDir, 'ltr', 'متنِ انگلیسیِ سؤال dir=ltr می‌گیرد')
      const t = marked.title
      assert.equal(t[0][0], '(', 'اولین نویسه پرانتز است')
      assert.equal(t[t.length - 1][0], '?', 'آخرین نویسه علامتِ سؤال است')
      assert.ok(t[0][1] < t[t.length - 1][1], 'جمله از چپ شروع می‌شود و به راست تمام («?How» نشده)')
      assert.equal(marked.en.dir, 'ltr')
      assert.ok(marked.en.chars[0][1] < marked.en.chars[marked.en.chars.length - 1][1], 'برچسبِ انگلیسیِ گزینه هم درست')
      assert.equal(marked.fa.dir, 'rtl', 'متنِ فارسی dir=rtl')
      const fa = marked.fa.chars
      assert.ok(fa[0][1] > fa[fa.length - 1][1], 'فارسی از راست شروع می‌شود')
      // متنِ فارسی با text-align:right باید نزدیکِ لبهٔ راستِ همان ستونِ متنی بنشیند
      const edges = await page.evaluate(() => {
        const el = [...document.querySelectorAll('[class*="_optionLabel"]')][1]
        const copy = el.closest('[class*="_optionCopy"]')
        return { text: Math.round(el.getBoundingClientRect().right), copy: Math.round(copy.getBoundingClientRect().right) }
      })
      assert.ok(edges.text >= edges.copy - 20, 'متنِ فارسی نزدیکِ لبهٔ راستِ ستون: ' + JSON.stringify(edges))
    } finally {
      await browser.close()
    }
  })

  test('روی DOMِ کپی‌شده: قاعده به پیام‌های گفتگو و پاسخِ ثبت‌شده دست نمی‌زند', async () => {
    const browser = await chromium.launch({ executablePath: CHROME, headless: true })
    try {
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
      await page.setContent(replica())
      await page.addStyleTag({ content: pluginCss() })
      // مقایسهٔ «با افزونه» و «بی افزونه»: هرچه ما عوض نکردیم باید عددِ یکسان بدهد
      const readAll = () => page.evaluate(() => {
        const css = (sel, prop) => getComputedStyle(document.querySelector(sel))[prop]
        return {
          msgAlign: css('#msg', 'textAlign'),
          replyWidth: Math.round(document.querySelector('#reply').getBoundingClientRect().width),
          replyAlign: css('#reply', 'textAlign'),
          inputMax: css('#input', 'maxWidth'),
          inputWidth: Math.round(document.querySelector('#input').getBoundingClientRect().width),
        }
      })
      const withPlugin = await readAll()
      // حالا همان برگه را با CSSِ افزونه منهای بلوکِ پنجرهٔ سؤال دوباره بسازیم
      await page.setContent(replica())
      await page.addStyleTag({ content: pluginCssWithoutQuestions() })
      const without = await readAll()
      assert.deepEqual(
        { a: withPlugin.msgAlign, r: withPlugin.replyAlign, rw: withPlugin.replyWidth, im: withPlugin.inputMax, iw: withPlugin.inputWidth },
        { a: without.msgAlign, r: without.replyAlign, rw: without.replyWidth, im: without.inputMax, iw: without.inputWidth },
        'قاعدهٔ پنجرهٔ سؤال به پیامِ گفتگو، پاسخِ ثبت‌شده و کارتِ کادرِ نوشتن دست نمی‌زند')
      assert.equal(without.replyWidth, 400, 'پاسخِ ثبت‌شده عرضِ خودش را دارد')
      assert.equal(without.inputMax, '952px', 'کادرِ نوشتن سقفِ خودش را دارد')
    } finally {
      await browser.close()
    }
  })
}
