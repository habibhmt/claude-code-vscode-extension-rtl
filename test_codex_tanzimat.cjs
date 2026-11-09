// تبِ «تنظیمات Codex» (تعریف ۲۵): کرومِ بی‌پنجره + همان کدِ میزبان که در extension.js می‌نشیند + موتورِ واقعیِ codex app-server.
// هیچ فایلِ واقعیِ حبیب دست نمی‌خورد: CODEX_HOME و پوشهٔ پروژه هر دو موقتی‌اند.
// اجرا: NODE_PATH=node_modules node test_codex_tanzimat.cjs
const {chromium} = require('playwright');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), cp = require('node:child_process');
const assert = require('node:assert/strict');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'crtl-codex-test-'));
const home = path.join(tmp, 'home'), proj = path.join(tmp, 'proj');
fs.mkdirSync(home); fs.mkdirSync(path.join(proj, '.git'), {recursive: true});
fs.writeFileSync(path.join(home, 'config.toml'), `# یادداشتِ حبیب می‌ماند\nmodel = "gpt-old"\n[projects."${fs.realpathSync(proj)}"]\ntrust_level = "trusted"\n`);
process.env.CODEX_HOME = home;
const codex = (process.env.CODEX_BIN || fs.readdirSync(path.join(os.homedir(), '.vscode/extensions')).filter(d => d.startsWith('openai.chatgpt-')).sort().map(d => {
  const b = path.join(os.homedir(), '.vscode/extensions', d, 'bin');
  return fs.readdirSync(b).map(x => path.join(b, x, 'codex')).find(fs.existsSync);
}).filter(Boolean).pop());
assert.ok(codex, 'codex binary');

// the host part, built exactly as the patch builds it
const hostJs = cp.execFileSync('python3', ['-I', '-c', 'import sys;sys.path.insert(0,sys.argv[1]);import codex_tanzimat_build as b;print(b.build_host())', __dirname]).toString();
const Mod = require('node:module');
const realLoad = Mod._load;
Mod._load = function (req, ...a) { return req === 'vscode' ? {workspace: {workspaceFolders: [{uri: {fsPath: fs.realpathSync(proj)}}]}} : realLoad.call(this, req, ...a); };
new Function('require', '__dirname', 'globalThis', hostJs)(require, __dirname, globalThis);
const T = globalThis.__crtlCodexTanzimat;
T._test.setBin(() => codex);

const ui = cp.execFileSync('python3', ['-I', '-c', `
import sys, importlib.util
from pathlib import Path
s = importlib.util.spec_from_file_location('ad', sys.argv[1] + '/chatgpt-adapter.py'); m = importlib.util.module_from_spec(s); s.loader.exec_module(m)
print(m.build_ui(Path(sys.argv[1]), {}))`, __dirname], {maxBuffer: 1 << 26}).toString();
const css = fs.readFileSync(__dirname + '/chatgpt-rtl.css', 'utf8');

(async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true});
  const toml = () => fs.readFileSync(path.join(home, 'config.toml'), 'utf8');
  const projToml = () => { try { return fs.readFileSync(path.join(proj, '.codex/config.toml'), 'utf8'); } catch (_) { return ''; } };
  const store = () => JSON.parse(fs.readFileSync(path.join(home, 'crtl_tanzimat.json'), 'utf8'));
  try {
    const page = await browser.newPage({viewport: {width: 900, height: 800}});
    page.on('pageerror', e => { console.error('pageerror', e); process.exitCode = 1; });
    await page.exposeFunction('crtlHost', msg => {
      T.handle({}, {postMessage: d => page.evaluate(x => window.postMessage(x, '*'), d)}, msg);
    });
    await page.route('https://codex.test/**', r => r.fulfill({contentType: 'text/html', body: '<html><body><div data-composer-surface-variant><div contenteditable="true"></div></div></body></html>'}));
    await page.goto('https://codex.test/');
    await page.evaluate(() => { window.__crtlCodexPost = m => window.crtlHost(m); });
    await page.addStyleTag({content: css});
    await page.addScriptTag({content: ui});
    // chatgpt-tabs.js has no router here; this chat is th-test
    await page.evaluate(() => { window.__crtlCodexPath = () => '/local/th-test'; });
    await page.locator('.crtl-gear button').click();
    await page.locator('.crtl-tabs button', {hasText: 'تنظیمات Codex'}).click();
    await page.waitForSelector('.crtl-tz-row', {timeout: 30000});
    assert.equal(await page.locator('.crtl-tabs button', {hasText: 'تنظیمات کلود'}).count(), 0, 'no Claude tab inside Codex');
    assert.equal(await page.locator('.crtl-tz-row').count(), 103, 'all 103 Codex settings');
    const row = k => page.locator(`.crtl-tz-row[data-k="${k}"]`);
    assert.match(await row('model').locator('.crtl-tz-note').innerText(), /gpt-old/, 'now-line reads the real value');
    assert.match(await row('model_reasoning_effort').locator('.crtl-tz-fa').innerText(), /افورت/);
    assert.ok(await row('tools').locator('input[data-sath=chat]').isDisabled(), 'chat tick greyed for a non-chat key');
    assert.ok(!(await row('model_reasoning_effort').locator('input[data-sath=chat]').isDisabled()), 'chat tick open for effort');
    const ok = async () => { await page.waitForSelector('.crtl-tz-popup', {timeout: 30000}); const t = await page.locator('.crtl-tz-popup').innerText(); await page.locator('.crtl-tz-popup button').first().click(); return t; };

    // chat
    await row('model_reasoning_effort').locator('input[data-sath=chat]').check();
    await row('model_reasoning_effort').locator('select').selectOption('high');
    await row('model_reasoning_effort').locator('.crtl-tz-sabt').click();
    assert.match(await ok(), /✓.*همین چت/);
    assert.equal(store().chat['th-test'].v.model_reasoning_effort, 'high');
    assert.equal(T.turn('turn/start', {threadId: 'th-test'}).effort, 'high', 'turn/start of this chat carries it');
    assert.equal(T.turn('turn/start', {threadId: 'other'}).effort, undefined, 'another chat is untouched');

    // project
    await row('model_verbosity').locator('input[data-sath=poshe]').check();
    await row('model_verbosity').locator('select').selectOption('low');
    await row('model_verbosity').locator('.crtl-tz-sabt').click();
    assert.match(await ok(), /✓.*پروژه/);
    assert.match(projToml(), /model_verbosity = "low"/);

    // global: no OK, no tick
    const g = row('model_verbosity').locator('input[data-sath=sarasari]');
    await g.click();
    await page.waitForSelector('.crtl-tz-popup');
    await page.locator('.crtl-tz-popup button', {hasText: 'نه'}).click();
    assert.ok(!(await g.isChecked()), 'no OK, no global tick');
    await g.click();
    await page.locator('.crtl-tz-popup button', {hasText: 'مطمئنم'}).click();
    assert.ok(await g.isChecked());
    await row('model_verbosity').locator('select').selectOption('high');
    await row('model_verbosity').locator('.crtl-tz-sabt').click();
    assert.match(await ok(), /✓.*سراسری/);
    assert.match(toml(), /model_verbosity = "high"/);
    assert.match(toml(), /# یادداشتِ حبیب می‌ماند/, 'comments survive the official writer');
    assert.doesNotMatch(projToml(), /model_verbosity/, 'the global save took it back from the project');

    // a wrong number is refused, nothing written
    const before = toml();
    await row('project_doc_max_bytes').locator('input[data-sath=sarasari]').click();
    await page.locator('.crtl-tz-popup button', {hasText: 'مطمئنم'}).click();
    await row('project_doc_max_bytes').locator('input.crtl-tz-kontrol').fill('abc');
    await row('project_doc_max_bytes').locator('.crtl-tz-sabt').click();
    assert.match(await ok(), /✗/);
    assert.equal(toml(), before);

    // global effort also clears this chat's own value
    await row('model_reasoning_effort').locator('input[data-sath=sarasari]').click();
    await page.locator('.crtl-tz-popup button', {hasText: 'مطمئنم'}).click();
    await row('model_reasoning_effort').locator('select').selectOption('low');
    await row('model_reasoning_effort').locator('.crtl-tz-sabt').click();
    assert.match(await ok(), /از 1 چت هم برداشته شد/);
    assert.equal(T.turn('turn/start', {threadId: 'th-test'}).effort, undefined);
    await page.waitForFunction(() => /low/.test(document.querySelector('.crtl-tz-row[data-k="model_reasoning_effort"] .crtl-tz-note').textContent), null, {timeout: 30000});
    console.log('OK test_codex_tanzimat');
  } finally {
    await browser.close();
    fs.rmSync(tmp, {recursive: true, force: true});
  }
})().catch(e => { console.error(e); process.exit(1); });
