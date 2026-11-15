/**
 * آزمونِ «جدول در پنجرهٔ سؤال» (حبیب ۱۵ نوامبر ۲۰۲۶: «یه کاری کن که پنجره سوال فرمت جدول رو حفظ کنه»).
 * پنجرهٔ سؤالِ برنامه متن را خام در h2 می‌گذارد؛ region «ask-md» در client.js همان متن را
 * به جدول/پاراگراف/فهرست می‌سازد و h2 را فقط پنهان می‌کند.
 *  ۱) تابع‌های خالص (بی‌مرورگر، jsdom): بلوک‌ها، ساختِ امن (بی innerHTML)، نگهبانِ DOM.
 *  ۲) کرومِ واقعی (playwright): جدول واقعاً ستون‌دار و راست‌به‌چپ است، h2 پنهان است، و
 *     قاعدهٔ «table:has(code)» ِ همین فایل جدول را چپ‌به‌راست نمی‌کند.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { JSDOM } from 'jsdom'

const require = createRequire(import.meta.url)
const CLIENT = process.env.ASK_MD_CLIENT || new URL('../client.js', import.meta.url)
const source = readFileSync(CLIENT, 'utf8')

function region() {
  const a = source.indexOf('/* #region ask-md')
  const b = source.indexOf('/* #endregion ask-md */')
  assert.ok(a > 0 && b > a, 'region «ask-md» در client.js هست')
  return source.slice(a, b)
}
const api = new Function(region() + '\nreturn { askMdBlocks, askMdWorth, askMdRender, askMdSplitRow, startAskMarkdown }')()

/** همان شکلِ سؤالی که پنجره را خراب نشان می‌داد (عکسِ حبیب ۱۸:۱۵). */
const SAMPLE = [
  'بخشِ دومِ پیشنهادِ دستیار سه ردیف داشت:',
  '',
  '| ردیف | تازه بود؟ | درست بود؟ |',
  '|---|---|---|',
  '| ۱. «با کش امتحان کن» | **بله**، تازه | نه |',
  '| ۲. `a|b` در کد | نه | درست است |',
  '',
  'خلاصه: فقط یک چیزِ تازه داشت.',
  '- اول پشتیبان می‌گیرم.',
  '- بعد `npm test`.',
  '',
  'ساب‌ایجنت بذارم یا نه؟',
].join('\n')

test('بلوک‌ها: پاراگراف، جدول، پاراگراف، فهرست، پاراگراف', () => {
  const blocks = api.askMdBlocks(SAMPLE)
  assert.deepEqual(blocks.map(b => b.type), ['para', 'table', 'para', 'list', 'para'])
  const table = blocks[1]
  assert.deepEqual(table.head, ['ردیف', 'تازه بود؟', 'درست بود؟'])
  assert.equal(table.rows.length, 2)
  assert.equal(table.rows[1][0], '۲. `a|b` در کد', '«|» داخلِ کد ستون را نمی‌شکند')
  assert.equal(blocks[3].items.length, 2)
})

test('بی جدول/پررنگ/کد/فهرست ⇒ دست نمی‌خورد؛ «|» تنها جدول نیست', () => {
  assert.equal(api.askMdWorth('ساب‌ایجنت بذارم یا نه؟'), false)
  assert.equal(api.askMdWorth('a | b | c'), false)
  assert.equal(api.askMdWorth('| a | b |\n| c | d |'), false, 'بی خطِ جداکننده جدول نیست')
  assert.equal(api.askMdWorth(SAMPLE), true)
  assert.equal(api.askMdWorth('فقط **پررنگ**'), true)
})

test('ساخت: جدولِ واقعی، پررنگ، کد به‌صورتِ span (نه code)، و هیچ HTMLِ تزریقی', () => {
  const { window } = new JSDOM('<!doctype html><body></body>')
  const doc = window.document
  const view = api.askMdRender(doc, SAMPLE + '\n\n<img src=x onerror="alert(1)"> **<b>x</b>**')
  assert.equal(view.getAttribute('dir'), 'rtl')
  const table = view.querySelector('table')
  assert.ok(table, 'جدول ساخته شد')
  assert.deepEqual([...table.querySelectorAll('th')].map(th => th.textContent), ['ردیف', 'تازه بود؟', 'درست بود؟'])
  assert.equal(table.querySelectorAll('tbody tr').length, 2)
  assert.equal(table.querySelectorAll('tbody tr')[0].children.length, 3)
  assert.equal(table.querySelector('strong').textContent, 'بله')
  assert.equal(view.querySelector('code'), null, 'هیچ <code>ی نیست (قاعدهٔ table:has(code))')
  const codes = [...view.querySelectorAll('[data-dsh-ask-code]')].map(c => c.textContent)
  assert.deepEqual(codes, ['a|b', 'npm test'])
  assert.equal(view.querySelectorAll('ul li').length, 2)
  assert.equal(view.querySelector('img'), null, 'img ساخته نشد')
  assert.equal(view.querySelector('b'), null, 'b ساخته نشد')
  assert.ok(view.textContent.includes('<img src=x'), 'متنِ HTML به‌صورتِ متن ماند')
})

/** DOMِ کپی با نام‌های کلاسِ ماژولِ سؤال (I1ptPW_*)، مثلِ ask-window.test.mjs. */
function replicaHtml(title) {
  const q = n => 'I1ptPW_' + n
  return '<!doctype html><html dir="rtl" data-dsh-rtl="on" data-dsh-rtl-code="on"><body style="margin:0;font:14px system-ui">' +
    '<div id="msg"><table><tr><td>جدولِ پیام (نباید عوض شود)</td></tr></table></div>' +
    '<div class="Q_frame" data-question-key="k1"><section class="' + q('card') + '" style="width:900px">' +
    '<div class="' + q('body') + '" data-question-scroll>' +
    '<div class="' + q('questionTitle') + '" style="display:flex">' +
    '<h2 id="qtitle" class="' + q('title') + ' ' + q('titlePreview') + '"></h2>' +
    '<button id="toggle" type="button">v</button></div>' +
    '</div></section></div></body></html>'
}

test('نگهبان: نسخه بعد از h2، h2 پنهان؛ عوض‌شدنِ متن ⇒ دوباره؛ متنِ ساده ⇒ برمی‌گردد؛ پاک‌کننده', async () => {
  const dom = new JSDOM(replicaHtml(), { pretendToBeVisual: true })
  const { window } = dom
  const doc = window.document
  const h2 = doc.getElementById('qtitle')
  h2.textContent = SAMPLE
  const stop = api.startAskMarkdown(window)
  const view = () => doc.querySelector('[data-question-key] [data-dsh-ask-md]')
  assert.ok(view(), 'نسخه ساخته شد')
  assert.equal(h2.nextElementSibling, view(), 'درست بعد از h2، قبل از دکمه')
  assert.equal(view().nextElementSibling.id, 'toggle')
  assert.ok(h2.hasAttribute('data-dsh-ask-md-hidden'), 'h2 پنهان شد')
  assert.equal(h2.textContent, SAMPLE, 'متنِ h2 دست نخورد (کپی/aria)')
  assert.equal(doc.querySelectorAll('[data-dsh-ask-md]').length, 1)
  assert.equal(doc.querySelector('#msg table').hasAttribute('data-dsh-ask-md'), false, 'جدولِ پیام دست نخورد')
  const first = view()
  // یک تغییرِ بی‌ربط در DOM (مثلِ رسیدنِ پیامِ تازه) نگهبان را بیدار می‌کند
  doc.body.appendChild(doc.createElement('div'))
  await new Promise(r => setTimeout(r, 150))
  assert.equal(view(), first, 'بی تغییرِ متن دوباره ساخته نمی‌شود (حلقهٔ بی‌پایان نیست)')
  // سؤالِ بعدی (React فقط متنِ h2 را عوض می‌کند)
  h2.firstChild.nodeValue = '| a | b |\n|---|---|\n| 1 | 2 |'
  await new Promise(r => setTimeout(r, 150))
  assert.notEqual(view(), first, 'متنِ تازه ⇒ نسخهٔ تازه')
  assert.deepEqual([...view().querySelectorAll('td')].map(td => td.textContent), ['1', '2'])
  assert.equal(doc.querySelectorAll('[data-dsh-ask-md]').length, 1, 'نسخهٔ قدیم ماند')
  h2.firstChild.nodeValue = 'ساب‌ایجنت بذارم یا نه؟'
  await new Promise(r => setTimeout(r, 150))
  assert.equal(view(), null, 'متنِ ساده ⇒ نسخه برداشته شد')
  assert.equal(h2.hasAttribute('data-dsh-ask-md-hidden'), false, 'h2 دوباره دیده می‌شود')
  h2.firstChild.nodeValue = SAMPLE
  await new Promise(r => setTimeout(r, 150))
  assert.ok(view())
  stop()
  assert.equal(doc.querySelector('[data-dsh-ask-md]'), null, 'پاک‌کننده نسخه را برداشت')
  assert.equal(h2.hasAttribute('data-dsh-ask-md-hidden'), false, 'پاک‌کننده h2 را برگرداند')
  window.close()
})

test('ثبت با ctx.effect و CSS محدود به ظرفِ سؤال', () => {
  assert.match(source, /ctx\.effect\(\(\) => startAskMarkdown\(window\), 'dsh-rtl:ask-md'\)/)
  assert.match(source, /\[data-question-key\] \[data-dsh-ask-md-hidden\] \{\s*display: none !important;/)
  const code = region().replace(/\/\*[\s\S]*?\*\//g, '')
  assert.doesNotMatch(code, /innerHTML|outerHTML|insertAdjacentHTML/, 'هیچ HTMLِ خام')
})

let chromium
try { ({ chromium } = require('playwright')) } catch { chromium = undefined }
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const canBrowse = Boolean(chromium) && existsSync(CHROME)

function pluginCss() {
  const start = source.indexOf('const CSS = `')
  const end = source.indexOf(String.fromCharCode(10, 96), start)
  return source.slice(start + 'const CSS = `'.length, end)
}

if (!canBrowse) {
  test('کرومِ واقعی (playwright یا کروم نیست ⇒ رد شد)', { skip: true }, () => {})
} else {
  test('کرومِ واقعی: جدولِ ستون‌دارِ راست‌به‌چپ، h2 پنهان، کد جدول را چپ‌به‌راست نمی‌کند', async () => {
    const browser = await chromium.launch({ executablePath: CHROME, headless: true })
    try {
      const page = await browser.newPage({ viewport: { width: 1200, height: 900 } })
      await page.setContent(replicaHtml())
      await page.addStyleTag({ content: pluginCss() })
      await page.evaluate(({ code, text }) => {
        document.getElementById('qtitle').textContent = text
        const api = new Function(code + '\nreturn { startAskMarkdown }')()
        api.startAskMarkdown(window)
      }, { code: region(), text: SAMPLE })
      const out = await page.evaluate(() => {
        const h2 = document.getElementById('qtitle')
        const table = document.querySelector('[data-dsh-ask-md] table')
        const th = [...table.querySelectorAll('th')].map(e => Math.round(e.getBoundingClientRect().left))
        const td = table.querySelector('td')
        return {
          h2Display: getComputedStyle(h2).display,
          tableDir: getComputedStyle(table).direction,
          th,
          border: getComputedStyle(td).borderTopStyle,
          rows: table.querySelectorAll('tr').length,
          tableHeight: Math.round(table.getBoundingClientRect().height),
        }
      })
      assert.equal(out.h2Display, 'none', 'متنِ خام پنهان است')
      assert.equal(out.tableDir, 'rtl', 'جدول راست‌به‌چپ (قاعدهٔ table:has(code) اثر نکرد)')
      assert.ok(out.th[0] > out.th[1] && out.th[1] > out.th[2], 'ستونِ اول سمتِ راست: ' + out.th)
      assert.equal(out.border, 'solid', 'خانه‌ها خط دارند')
      assert.equal(out.rows, 3)
      assert.ok(out.tableHeight > 40, 'جدول واقعاً ارتفاع دارد: ' + out.tableHeight)
      await page.screenshot({ path: '/tmp/ask-md-shot.png', fullPage: true })
    } finally {
      await browser.close()
    }
  })
}
