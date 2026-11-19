// XSS regression for the 186 app: a chat title/folder/model is data, never HTML.
// Run: NODE_PATH=node_modules node test_xss_186.cjs
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
  });
  try {
    const page = await browser.newPage();
    page.on('pageerror', (e) => console.error('PAGEERR', e.message));
    await page.addInitScript(() => {
      window.api = {
        onData: (cb) => { window.__render = cb; },
        onExpanded() {}, onOpacity() {}, onClickThrough() {},
        toggleExpand() {}, setSort() {}, setOpacity() {}, quit() {},
      };
    });
    const html = fs.readFileSync(path.join(__dirname, '186-montaghel/app/index.html'), 'utf8');
    await page.route('http://t.local/', (r) => r.fulfill({ contentType: 'text/html; charset=utf-8', body: html }));
    await page.route('**/invalid-image', (r) => r.fulfill({ status: 404, contentType: 'text/plain', body: '' }));
    await page.goto('http://t.local/');
    await page.waitForTimeout(300);

    await page.evaluate(() => window.__render({
      rows: [{ percent: 50, resets_at: '2030-01-01T00:00:00Z' }],
      sessions: [{
        folder: '<b>folder</b>',
        title: '<img src="invalid-image" onerror="window.__xss=42">',
        model: '<i>model</i>',
        ctxPct: 1,
        share: { session: 1, weekly: 1, fable: 1 },
        live: true,
      }],
      error: null, sort: 'recent',
    }));
    await page.waitForTimeout(1000);

    const result = await page.evaluate(() => ({
      xss: window.__xss,
      injectedImages: document.querySelectorAll('.title img, .folder img, .meta img, .h img').length,
      titleText: document.querySelector('.title')?.textContent,
      titleHTML: document.querySelector('.title')?.innerHTML,
      folderText: document.querySelector('.folder')?.textContent,
      folderHTML: document.querySelector('.folder')?.innerHTML,
      modelText: document.querySelector('.meta span')?.textContent,
      modelHTML: document.querySelector('.meta span')?.innerHTML,
      pctText: document.querySelector('.pct')?.textContent,
    }));
    console.log(JSON.stringify(result));

    assert.equal(result.xss, undefined, 'the onerror payload must not run');
    assert.equal(result.injectedImages, 0, 'no img element may be created from the title');
    assert.equal(result.titleText, '<img src="invalid-image" onerror="window.__xss=42">');
    assert.equal(result.titleHTML, '&lt;img src="invalid-image" onerror="window.__xss=42"&gt;');
    assert.equal(result.folderText, '<b>folder</b>');
    assert.equal(result.folderHTML, '&lt;b&gt;folder&lt;/b&gt;');
    assert.equal(result.modelText, '<i>model</i>');
    assert.equal(result.modelHTML, '&lt;i&gt;model&lt;/i&gt;');
    assert.equal(result.pctText, '50%');
    console.log('PASS');
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
