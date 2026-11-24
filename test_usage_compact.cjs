// Compact mode of the usage panel: only the worst number stays, everything comes
// back on hover. Runs the real index.html in headless Chrome with a fake api.
// Run: NODE_PATH=node_modules node test_usage_compact.cjs
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
        onCompact: (cb) => { window.__compact = cb; },
        hover: (v) => { window.__hover = v; },
        toggleExpand() {}, setSort() {}, setOpacity() {}, quit() {},
      };
    });
    const html = fs.readFileSync(path.join(__dirname, 'apps/claude-usage/app/index.html'), 'utf8');
    await page.route('http://t.local/', (r) => r.fulfill({ contentType: 'text/html; charset=utf-8', body: html }));
    await page.goto('http://t.local/');
    await page.waitForTimeout(200);

    await page.evaluate(() => window.__render({
      rows: [
        { percent: 50, resets_at: '2030-01-01T00:00:00Z' },
        { percent: 87, resets_at: '2030-01-01T00:00:00Z' },
        { percent: 20, resets_at: '2030-01-01T00:00:00Z' },
      ],
      sessions: [], error: null, sort: 'recent',
    }));

    // the worst row is marked before anything is hidden
    let worst = await page.evaluate(() =>
      [...document.querySelectorAll('.row')].map(r => r.classList.contains('worst')));
    assert.deepEqual(worst, [false, true, false], 'the 87% row is the worst one');

    // compact on ⇒ exactly one row stays on screen
    await page.evaluate(() => window.__compact(true));
    const compact = await page.evaluate(() => ({
      cls: document.body.classList.contains('compact'),
      visible: [...document.querySelectorAll('.row')].filter(r => r.offsetParent !== null).length,
      shownPct: [...document.querySelectorAll('.row')].find(r => r.offsetParent !== null)?.querySelector('.pct')?.textContent,
      resetShown: (() => {
        const r = [...document.querySelectorAll('.row')].find(x => x.offsetParent !== null);
        return r?.querySelector('.reset')?.offsetParent !== null;
      })(),
    }));
    assert.equal(compact.cls, true);
    assert.equal(compact.visible, 1, 'compact shows a single row');
    assert.equal(compact.shownPct, '87%', 'the surviving row is the worst number');
    assert.equal(compact.resetShown, false, 'the reset time is hidden in compact');

    // hover brings them all back and tells the main process to grow the window
    await page.evaluate(() => document.body.dispatchEvent(new MouseEvent('mouseenter')));
    await page.waitForTimeout(100);
    const hovered = await page.evaluate(() => ({
      hover: window.__hover,
      cls: document.body.classList.contains('hover'),
      visible: [...document.querySelectorAll('.row')].filter(r => r.offsetParent !== null).length,
    }));
    assert.equal(hovered.hover, true, 'hover is reported to main');
    assert.equal(hovered.cls, true);
    assert.equal(hovered.visible, 3, 'all rows come back on hover');

    // leaving shrinks again
    await page.evaluate(() => document.body.dispatchEvent(new MouseEvent('mouseleave')));
    const left = await page.evaluate(() => ({
      hover: window.__hover,
      visible: [...document.querySelectorAll('.row')].filter(r => r.offsetParent !== null).length,
    }));
    assert.equal(left.hover, false);
    assert.equal(left.visible, 1);

    // compact off ⇒ every row is always visible
    await page.evaluate(() => window.__compact(false));
    const normal = await page.evaluate(() =>
      [...document.querySelectorAll('.row')].filter(r => r.offsetParent !== null).length);
    assert.equal(normal, 3);

    console.log('PASS');
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
