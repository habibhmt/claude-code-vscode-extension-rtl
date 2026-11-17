// «جای دکمه» باید همان‌جایی بنشیند که کاربر انتخاب کرده — بالا، چپ یا راست.
// حبیب ۱۷ نوامبر ۰۴:۳۰: «تنظیمات رو درست کن که خودم هر جا خواستم بگذارمشون».
// پیش از این، فهرستِ مشترک «جا» را دور می‌ریخت و همهٔ دکمه‌ها بی‌صدا چپ می‌افتادند.
const fs = require('fs'), os = require('os'), path = require('path'), assert = require('assert/strict');
const { chromium } = require('playwright');

const home = fs.mkdtempSync(path.join(os.homedir(), 'ja-dokme-test-'));
const cwd = path.join(home, 'work'); fs.mkdirSync(cwd);
process.env.CRTL_AA_SHARED = path.join(home, 'aa.json');
process.env.CRTL_HOST_TEST = '1';
require('./dsh-rtl/aa-shared.cjs');
os.homedir = () => home;
require('./claude-host-hook.js');
const H = global.__crtlHost;

(async () => {
  let browser;
  try {
    browser = await chromium.launch({
      executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      headless: true
    });
    const page = await (await browser.newContext()).newPage();
    page.setDefaultTimeout(8000);
    await page.route('http://cc.local/', r => r.fulfill({ contentType: 'text/html', body: '<div id="app"></div>' }));
    await page.exposeFunction('__host', m => {
      if (m.type === 'crtl-aa-read' || m.type === 'crtl-aa-save') return { type: 'crtl-aa-state', ok: true, ...H.aaPrefs(m, cwd) };
      return null;
    });
    await page.goto('http://cc.local/');
    await page.evaluate(cwd => {
      window.acquireVsCodeApi = () => ({
        postMessage: m => window.__host(m).then(r => { if (r) window.postMessage(r, '*'); }),
        getState: () => ({}), setState() {}
      });
      window.__crtl_sessions = new Set([{ claudeChannelId: 'cc-channel', cwd: { value: cwd }, sessionId: { value: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' }, holdsNoConversation: () => false }]);
    }, cwd);

    // سه دکمه در انبارِ مشترک: یکی «بالا»، یکی «چپ»، و یکی بی‌جا (reme) که باید
    // جای پیش‌فرضِ خودش در فهرستِ محلی — یعنی «راست» — را بگیرد، نه «چپ».
    H.aaPrefs({
      type: 'crtl-aa-save', scope: 'sarasari', patch: {
        commands: [
          { label: 'بالایی', text: 'متنِ بالا', send: false, side: 'top' },
          { label: 'چپی', text: 'متنِ چپ', send: false, side: 'left' },
          { label: 'reme', text: '/remember:remember', send: false }
        ]
      }
    }, cwd);

    await page.addScriptTag({ content: fs.readFileSync(path.join(__dirname, 'claude-ui-buttons.js'), 'utf8') });
    await page.evaluate(() => window.acquireVsCodeApi());
    await page.evaluate(async () => {
      const data = await window.__host({ type: 'crtl-aa-read' });
      window.dispatchEvent(new MessageEvent('message', { data }));
      document.querySelector('#app').innerHTML =
        '<div class="chatContainer_y">' +
          '<div class="header_x"><span class="titleText_x">چت</span><div class="headerSpacer_x"></div></div>' +
          '<div class="messagesContainer_x">قدیمی</div>' +
          '<div class="inputContainer_y"><div class="messageInputContainer_x">' +
            '<div aria-label="Message input" contenteditable="true"></div>' +
          '</div></div>' +
        '</div>';
    });

    await page.waitForSelector('.crtl-top', { state: 'attached' });

    // بی‌انتظار بخوان: نبودنِ ستون باید پیامِ روشن بدهد، نه تایم‌اوت
    const barText = sel => page.evaluate(s => { const el = document.querySelector(s); return el ? el.innerText : ''; }, sel);
    const topText = await barText('.crtl-top');
    const leftText = await barText('.crtl-bar:not(.crtl-gear)[data-side="left"]');
    const rightText = await barText('.crtl-bar:not(.crtl-gear)[data-side="right"]');

    assert.match(topText, /بالایی/, 'دکمهٔ «بالا» باید در ردیفِ بالای چت بنشیند');
    assert.doesNotMatch(leftText, /بالایی/, 'دکمهٔ «بالا» نباید در ستونِ چپ بیفتد');
    assert.match(leftText, /چپی/, 'دکمهٔ «چپ» باید در ستونِ چپ بماند');
    assert.match(rightText, /reme/, 'دکمهٔ بی‌جا باید جای پیش‌فرضِ محلیِ خودش (راست) را بگیرد');

    // و همان انتخاب باید در پنل aA هم دیده شود
    const panelSides = await page.evaluate(() => {
      const out = {};
      document.querySelectorAll('#crtl-cmds .crtl-cmd-row').forEach(r => {
        out[r.querySelector('.crtl-cmd-label').value] = r.querySelector('.crtl-cmd-side').value;
      });
      return out;
    });
    assert.equal(panelSides['بالایی'], 'top', 'پنل aA باید «بالا» نشان دهد');
    assert.equal(panelSides['چپی'], 'left', 'پنل aA باید «چپ» نشان دهد');

    // «همه → چپ»: جابه‌جاییِ یک‌جای همه، و همان لحظه در انبارِ مشترک ذخیره شود
    const hame = await page.evaluate(() => {
      const b = [...document.querySelectorAll('#crtl-panel .crtl-btn')].find(x => x.textContent === 'همه → چپ');
      if (!b) return false;
      b.click(); return true;
    });
    assert.equal(hame, true, 'دکمهٔ «همه → چپ» باید در پنل باشد');
    await page.waitForTimeout(400);
    assert.match(await barText('.crtl-bar:not(.crtl-gear)[data-side="left"]'), /بالایی/, 'بعد از «همه → چپ» دکمهٔ بالا هم باید چپ شود');
    assert.doesNotMatch(await barText('.crtl-top'), /بالایی/, 'بعد از «همه → چپ» ردیفِ بالا نباید دکمهٔ بالا را داشته باشد');
    const saved = H.aaPrefs({ type: 'crtl-aa-read' }, cwd).values.commands;
    assert.ok(saved.every(c => c.side === 'left'), 'جای تازه باید در انبارِ مشترک بماند: ' + JSON.stringify(saved.map(c => c.side)));

    console.log('سبز: بالا → ردیفِ بالا · چپ → ستونِ چپ · بی‌جا → جای محلی · پنل aA همان را نشان می‌دهد · «همه → چپ» ذخیره شد');
  } finally {
    if (browser) await browser.close();
    fs.rmSync(home, { recursive: true, force: true });
  }
})().catch(e => { console.error('قرمز:', e && e.message ? e.message : e); process.exitCode = 1; });
