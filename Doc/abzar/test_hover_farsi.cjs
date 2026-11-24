// آزمونِ هاورِ نام‌های فارسی (م۱۹) — حبیب ۲۴ نوامبر ۲۰۲۶ ۱۷:۵۴: «بزن».
//
// تشنه: `WORD = /[A-Za-z0-9_]/` حروفِ فارسی را کلمه نمی‌دانست، پس کارتِ نُه
// اصطلاحِ فارسی (`ناظر`، `مجری`، `دروازه` …) هرگز دیده نمی‌شد، هرچند کارتشان
// در شناسنامه بود. حالا حروفِ U+0600–U+06FF و نیم‌فاصله هم کلمه‌اند.
//
// سه آزمون: کارتِ نامِ فارسی · نیم‌فاصلهٔ داخلِ نام («ورک‌فلو») · همسایهٔ چسبیده
// به حرفِ فارسی («کارتناظر» نباید کارت بدهد).
//
// اجرا: node Doc/abzar/test_hover_farsi.cjs
// خرابکاری: `WORD` را به `[A-Za-z0-9_]` برگردان ⇒ آزمونِ ۱ و ۲ قرمز.
const {chromium} = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const script = fs.readFileSync(process.env.BUTTONS_JS || path.join(__dirname, '..', '..', 'claude-ui-buttons.js'), 'utf8');

const NAZER = 'ناظر';
const WORKFLOW = 'ورک‌فلو';          // با نیم‌فاصله
const CHASBIDE = 'کارتناظر';

const page = `<!doctype html><html dir="rtl"><head><meta charset="utf-8"></head>
<body style="margin:0;font:16px/26px sans-serif;width:700px">
<div class="messagesContainer_x" style="padding:18px">
  <div id="pA">سلام ${NAZER} عزیز</div>
  <div id="pB" style="margin-top:40px">این ${WORKFLOW} خوب است</div>
  <div id="pC" style="margin-top:40px">واژهٔ ${CHASBIDE} اینجا</div>
</div>
<div aria-label="Message input" contenteditable="true"></div></body></html>`;

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
  if (!r) return '';
  await p.mouse.move(r.x, r.y);
  await p.waitForTimeout(1500);
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
    const kart = (y) => ({root: '/r', p: '136', yani: y, noe: 'vaziat', ozv: 'abzar', kh: [], ba: [],
                          chera: 'چ', tayid: 'ت', tarif: [], loc: []});
    await p.evaluate((c) => window.__crtl_gloss_set(c), {
      [NAZER]: [kart('ناظر می‌خواند و می‌سنجد')],
      [WORKFLOW]: [kart('ورک‌فلو یعنی ابزارِ Workflow')]
    });

    let a = await blogh(p, 'pA', NAZER);
  if (!/می‌خواند و می‌سنجد/.test(a)) a = await blogh(p, 'pA', NAZER, 2);
    t('۱ نامِ فارسی کارت می‌دهد', /می‌خواند و می‌سنجد/.test(a), 'کارت نیامد: ' + JSON.stringify(a));

    const b = await blogh(p, 'pB', WORKFLOW);
    t('۲ نامِ فارسی با نیم‌فاصله کارت می‌دهد', /ابزارِ Workflow/.test(b), 'کارت نیامد: ' + JSON.stringify(b));

    const c = await blogh(p, 'pC', CHASBIDE);
    t('۳ واژهٔ چسبیده به «ناظر» کارت نمی‌دهد', c === '', 'بی‌جا کارت داد: ' + JSON.stringify(c));

    await ctx.close();
  } finally {
    await browser.close();
  }
  console.log('جمع: ' + (bad ? bad + ' قرمز' : 'سبز'));
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e.message); process.exit(1); });
