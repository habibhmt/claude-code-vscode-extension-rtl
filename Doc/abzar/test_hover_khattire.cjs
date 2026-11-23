// آزمونِ هاورِ نام‌های خط‌تیره‌دار (ناظر-۱۳۶، ۲۳ نوامبر ۲۰۲۶ ۲۳:۲۶).
//
// تشنه: `var WORD = /[A-Za-z0-9_]/` خطِ تیره را جزوِ کلمه نمی‌دانست، پس روی
// `harness-cli-claude-code` هدف «cli» یا «harness» می‌شد و کارتِ خودش نمی‌آمد.
// حالا تا انتهای خط‌تیره‌ها باز می‌شود، ولی فقط اگر عیناً نامِ ثبت‌شده باشد.
//
// چهار آزمون: کارتِ نامِ خط‌تیره‌دار · کارتِ ندادن به عبارتِ ناشناس ·
// بلندترین نام برنده (نه کارتِ چتر) · کارتِ چتر روی واژهٔ تنها.
//
// اجرا: node Doc/abzar/test_hover_khattire.cjs
// خرابکاری: در دو حلقهٔ da/db، `WORD_DASH` را به `WORD` برگردان ⇒ آزمونِ ۱ قرمز.
//            شرطِ «فقط نامِ ثبت‌شده» را بردار ⇒ آزمونِ ۲ قرمز.
//            در حلقهٔ نام‌ها `em.length > tole_bozorgtar.length` را به `<` عوض کن ⇒ آزمونِ ۳ قرمز.
const {chromium} = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const script = fs.readFileSync(process.env.BUTTONS_JS || path.join(__dirname, '..', '..', 'claude-ui-buttons.js'), 'utf8');

const NAM = 'harness-cli-claude-code';
const KUTAH = 'harness-cli';
const NASAKHTE = 'foo-bar-baz';

const page = `<!doctype html><html dir="rtl"><head><meta charset="utf-8"></head>
<body style="margin:0;font:16px/26px sans-serif;width:700px">
<div class="messagesContainer_x" style="padding:18px">
  <div id="wA">الف ${NAM} ب ${NASAKHTE} ج</div>
  <div id="wB" style="margin-top:40px">تنها ${KUTAH} اینجا</div>
  <div id="wC" style="margin-top:40px">تنها harness اینجا</div>
</div>
<div aria-label="Message input" contenteditable="true"></div></body></html>`;

function kart(yani) {
  return {root: '/r', p: '136', yani, noe: 'vaziat', ozv: 'harness', kh: [], ba: [],
          chera: 'چ', tayid: 'ت', tarif: [], loc: []};
}

// neshan: نقطهٔ هاور را می‌دهد. `kardan` = کاراکترِ چندمِ خودِ کلمه (پیش‌فرض: وسط).
// برای سنجشِ «بلندترین برنده است» باید روی بخشِ مشترکِ دو نام بایستیم، وگرنه
// فقط نامِ بلند زیرِ نشانگر است و آزمون هیچ رقابتی را نمی‌سنجد (تله‌ای که خودم
// گرفتم: خرابکاریِ «بلندترین ⟶ کوتاه‌ترین» سبز ماند).
async function neshan(p, id, kalame, kardan) {
  return p.evaluate(([i, k, d]) => {
    const t = document.getElementById(i).firstChild;
    const j = t.nodeValue.indexOf(k);
    if (j < 0) return null;
    const off = d == null ? Math.floor(k.length / 2) : d;
    const r = document.createRange();
    r.setStart(t, j + off); r.setEnd(t, j + off + 1);
    const b = r.getBoundingClientRect();
    return {x: b.x + b.width / 2, y: b.y + b.height / 2};
  }, [id, kalame, kardan == null ? null : kardan]);
}

async function blogh(p, id, kalame, kardan) {
  await p.mouse.move(5, 5);
  await p.waitForTimeout(250);
  const r = await neshan(p, id, kalame, kardan);
  await p.mouse.move(r.x, r.y);
  await p.waitForTimeout(900);
  return p.evaluate(() => {
    const b = document.getElementById('crtl-gloss');
    return b && b.style.display === 'block' ? b.innerText : '';
  });
}

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true
  });
  let bad = 0;
  const t = (n, ok, mehr) => { if (!ok) bad++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok ? '' : ' — ' + mehr)); };
  try {
    const ctx = await browser.newContext({viewport: {width: 900, height: 500}});
    const p = await ctx.newPage();
    await p.route('http://k.local/', r => r.fulfill({contentType: 'text/html', body: page}));
    await p.goto('http://k.local/');
    await p.addScriptTag({content: script});
    await p.waitForSelector('#crtl-panel', {state: 'attached', timeout: 20000});
    await p.waitForTimeout(1200);
    const C = (y) => p.evaluate((t) => window.__crtl_gloss_set(t), {
      [NAM]: [{root: '/r', p: '136', yani: 'کارتِ هارنسِ خط فرمان', noe: 'vaziat', ozv: 'harness', kh: [], ba: [], chera: 'چ', tayid: 'ت', tarif: [], loc: []}],
      [KUTAH]: [{root: '/r', p: '136', yani: 'کارتِ نامِ کوتاه', noe: 'vaziat', ozv: 'harness', kh: [], ba: [], chera: 'چ', tayid: 'ت', tarif: [], loc: []}],
      harness: [{root: '/r', p: '136', yani: 'کارتِ چترِ هارنس', noe: 'vaziat', ozv: 'harness', kh: [], ba: [], chera: 'چ', tayid: 'ت', tarif: [], loc: []}]
    });
    await C();

    const yes = await blogh(p, 'wA', NAM);
    t('۱ نامِ خط‌تیره‌دارِ ثبت‌شده کارت می‌دهد', /هارنسِ خط فرمان/.test(yes), 'کارت نیامد: ' + JSON.stringify(yes));

    const no = await blogh(p, 'wA', NASAKHTE);
    t('۲ عبارتِ خط‌تیره‌دارِ ناشناس کارت نمی‌دهد', no === '', 'بی‌جا کارت داد: ' + JSON.stringify(no));

    // ۳ دو نامِ خط‌تیره‌دار که یکی پیشوندِ دیگری است: روی بخشِ مشترک می‌ایستیم،
    // پس هر دو نام واجدِ شرط‌اند و بلندترین باید ببرد.
    const moshtarak = await blogh(p, 'wA', NAM, 3);
    t('۳ بلندترینِ دو نامِ تودرتو برنده است', /هارنسِ خط فرمان/.test(moshtarak) && !/نامِ کوتاه/.test(moshtarak), 'کارتِ کوتاه آمد: ' + JSON.stringify(moshtarak));

    const kutah = await blogh(p, 'wB', KUTAH);
    t('۴ نامِ کوتاه روی واژهٔ خودش کارتِ خودش را می‌دهد', /نامِ کوتاه/.test(kutah), 'کارت نیامد: ' + JSON.stringify(kutah));

    const chtar = await blogh(p, 'wC', 'harness');
    t('۵ کارتِ چتر روی واژهٔ تنها هنوز کار می‌کند', /چترِ هارنس/.test(chtar), 'کارتِ چتر نیامد: ' + JSON.stringify(chtar));

    await ctx.close();
  } finally {
    await browser.close();
  }
  console.log('جمع: ' + (bad ? bad + ' قرمز' : 'سبز'));
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e.message); process.exit(1); });
