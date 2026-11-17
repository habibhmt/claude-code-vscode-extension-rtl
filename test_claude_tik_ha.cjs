// The «ابزارها» tab of the aA panel (Habib, 16 Nov 2026): the shared tick list (abzar/tik_ha.py), the host's part
// (claude-host-hook.js), the panel in a real browser, and the real engine through ~/.claude/claude_abzar_kam.sh.
// Run: NODE_PATH=node_modules node test_claude_tik_ha.cjs      Env for sabotage: TIK_PY, BUTTONS_JS, HOST_JS, WRAPPER
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), assert = require('node:assert/strict');
const { execFileSync, spawn } = require('node:child_process');
const PY = process.env.TIK_PY || path.join(__dirname, 'abzar/tik_ha.py');
const UI = process.env.BUTTONS_JS || path.join(__dirname, 'claude-ui-buttons.js');
const HOST = process.env.HOST_JS || path.join(__dirname, 'claude-host-hook.js');
const WRAPPER = process.env.WRAPPER || path.join(os.homedir(), '.claude/claude_abzar_kam.sh');
const BIN = process.env.CLAUDE_BIN || path.join(os.homedir(), '.nvm/versions/node/v22.23.2/lib/node_modules/@anthropic-ai/claude-code/bin/claude.exe');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tik-'));
const STORE = path.join(tmp, 'tik_ha.json'), DIDE = path.join(tmp, 'tik_ha_dide.json');
const P136 = '/Users/habib/1-MY-WORK/136th-day-fix-rtl-claude', PX = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'tik-px-')));
const env = { ...process.env, TIK_HA: STORE, TIK_HA_DIDE: DIDE };
const py = (args, input) => JSON.parse(execFileSync('python3', [PY, ...args], { env, input: input === undefined ? '' : JSON.stringify(input) }).toString());
const J = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
fs.writeFileSync(DIDE, JSON.stringify({ abzar: ['Agent', 'Bash', 'Read', 'Workflow'], mcp: ['hafeze', 'kompyuter'], afzune: ['hookify@claude-plugins-official'], eskil: ['nazer', 'watch'] }));

function pythonPart() {
  // before the first ticks a launch must not run open
  assert.throws(() => execFileSync('python3', [PY, 'settings', PX], { env, stdio: 'pipe' }), 'no store: settings fails, so the wrappers keep the old lock');
  assert.equal(py(['kooch']).ok, true);
  assert.equal(py(['kooch']).ok, false, 'the first ticks are made once');
  if (process.platform === 'darwin') {
    const gui = { ...env, PATH: '/usr/bin:/bin:/usr/sbin:/sbin' };
    const args = ['fehrest', PX, '--chat', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'];
    const actual = JSON.parse(execFileSync('/usr/bin/python3', [PY, ...args], { env: gui, encoding: 'utf8' }));
    assert.deepEqual(actual, py(args), 'VS Code launched from Finder must see the same ticks as the terminal');
  }
  // the old locks are the first ticks
  const s136 = py(['settings', P136]);
  ['Agent', 'Workflow', 'Task', 'CronCreate', 'NotebookEdit'].forEach((t) => assert.ok(s136.permissions.deny.includes(t), '136 has ' + t + ' off'));
  ['Bash', 'Read', 'Edit', 'Write', 'ToolSearch', 'AskUserQuestion', 'SendMessage', 'ListAgents', 'Skill', 'WebSearch', 'WebFetch'].forEach((t) => assert.ok(!s136.permissions.deny.includes(t), '136 keeps ' + t));
  assert.deepEqual(py(['settings', P136 + '/abzar']).permissions.deny, s136.permissions.deny, 'a subfolder takes its folder\'s list');
  assert.deepEqual(py(['settings', PX]).permissions.deny, ['Agent', 'Workflow', 'Task'], 'every other folder: Agent and Workflow off');
  const uc = py(['settings', P136, '--ultracode']).permissions.deny;
  assert.ok(!uc.includes('Agent') && !uc.includes('Workflow') && uc.includes('CronCreate'), 'ultracode opens Agent and Workflow, nothing else');
  // levels
  const sabt = (sath, taghir, extra = {}) => py(['sabt'], { sath, cwd: PX, taghir, ...extra });
  assert.equal(sabt('poshe', []).ok, false, 'nothing changed: nothing saved');
  assert.equal(sabt('chat', [{ kind: 'mcp', name: 'kompyuter', on: false }]).ok, false, 'a chat level needs the chat');
  assert.equal(sabt('poshe', [{ kind: 'mcp', name: 'kompyuter', on: false }]).ok, true);
  assert.deepEqual(J(STORE).poshe[PX].abzar, { Agent: false, Workflow: false }, 'a folder\'s list starts as a copy of the global one');
  assert.deepEqual(py(['settings', PX]).deniedMcpServers, [{ serverName: 'kompyuter' }], 'MCP off ⇒ deniedMcpServers');
  assert.equal(py(['settings', '/tmp']).deniedMcpServers, undefined, 'another folder is not touched');
  sabt('sarasari', [{ kind: 'eskil', name: 'watch', on: false }]);
  assert.equal(py(['settings', PX]).skillOverrides, undefined, 'a folder with its own list ignores a later global tick');
  assert.deepEqual(py(['settings', '/tmp']).skillOverrides, { watch: 'off' }, 'a folder without a list takes it');
  sabt('chat', [{ kind: 'mcp', name: 'kompyuter', on: true }, { kind: 'afzune', name: 'hookify@claude-plugins-official', on: false }], { chat: 'kanal-abc123' });
  const sc = py(['settings', PX, '--chat', 'kanal-abc123']);
  assert.equal(sc.deniedMcpServers, undefined, 'the chat\'s own tick beats its folder');
  assert.deepEqual(sc.enabledPlugins, { 'hookify@claude-plugins-official': false }, 'plugin off ⇒ enabledPlugins false');
  assert.deepEqual(py(['settings', PX]).deniedMcpServers, [{ serverName: 'kompyuter' }], 'other chats of the folder keep the folder\'s list');
  const SID = '0a157388-1111-2222-3333-444455556666';
  assert.equal(py(['chat-be-sid', 'kanal-abc123', SID]).ok, true);
  assert.deepEqual(py(['settings', PX, '--resume-args', '--resume', SID]).enabledPlugins, { 'hookify@claude-plugins-official': false }, 'from its first message the ticks follow the chat\'s id, --resume too');
  // the list
  const f = py(['fehrest', PX, '--chat', SID]);
  assert.equal(f.ghalam.mcp.find((r) => r.n === 'kompyuter').sath, 'chat', 'each tick says where it came from');
  assert.equal(f.ghalam.abzar.find((r) => r.n === 'Agent').on, false);
  assert.ok(f.ghalam.abzar.some((r) => r.n === 'Workflow'), 'a tool turned off still shows');
  assert.ok(!f.ghalam.abzar.some((r) => r.n === 'Task'), 'Agent and Task are one tick');
  // a broken store never opens a chat
  const ok = fs.readFileSync(STORE);
  fs.writeFileSync(STORE, '{broken');
  assert.throws(() => execFileSync('python3', [PY, 'settings', PX], { env, stdio: 'pipe' }), 'a broken store fails');
  fs.writeFileSync(STORE, ok);
  return 'python ok';
}

function loadHost() {
  process.env.CRTL_HOST_TEST = '1';
  process.env.CRTL_TIK_PY = PY;
  process.env.TIK_HA = STORE; process.env.TIK_HA_DIDE = DIDE;
  process.env.CRTL_TANZIMAT = path.join(tmp, 'crtl_tanzimat.json');
  delete global.__crtlHost;
  (0, eval)('(function(require){' + fs.readFileSync(HOST, 'utf8') + '\n})')(require);
  return global.__crtlHost;
}

async function hostPart() {
  const H = loadHost();
  const l = await H.tikFehrest({ reqId: 7, cwd: PX, kelid: 'kanal-zzz999' });
  assert.equal(l.type, 'crtl-tik-list'); assert.equal(l.reqId, 7);
  assert.equal(l.ghalam.mcp.find((r) => r.n === 'kompyuter').on, false, 'the host reads the shared list');
  const r = await H.tikSabt({ sath: 'chat', cwd: PX, kelid: 'kanal-zzz999', taghir: [{ kind: 'eskil', name: 'nazer', on: false }] });
  assert.equal(r.ok, true);
  assert.equal((await H.tikSabt({ sath: 'chat', cwd: PX, kelid: '../bad', taghir: [{ kind: 'eskil', name: 'nazer', on: false }] })).ok, false, 'a strange chat name is not taken');
  // the restart of a new chat carries its name to the next fresh launch in its folder, once
  assert.equal(globalThis.__crtl_baz_shodan('', PX).settings, undefined, 'no restart asked: nothing added');
  H.tikBadi({ cwd: PX, kelid: 'kanal-zzz999' });
  assert.equal(globalThis.__crtl_baz_shodan('', '/tmp').settings, undefined, 'another folder\'s launch does not take it');
  assert.equal(globalThis.__crtl_baz_shodan('0a157388-1111-2222-3333-444455556666', PX).settings, undefined, 'nor a resumed chat');
  assert.equal(globalThis.__crtl_baz_shodan('', PX).settings.__crtl_tik_chat, 'kanal-zzz999', 'the new chat\'s launch does');
  assert.equal(globalThis.__crtl_baz_shodan('', PX).settings, undefined, 'only once');
  // the channel born from that launch moves the ticks to the chat's id when it has one
  const ch = { cwd: PX, sessionId: undefined }, own = { channels: new Map([['c1', ch]]) };
  H.tikBadi({ cwd: PX, kelid: 'kanal-zzz999' });
  globalThis.__crtl_baz_shodan('', PX);
  globalThis.__crtl_kanal_taze(own, 'c1', ch);
  assert.equal(ch.__crtlTik, 'kanal-zzz999');
  ch.sessionId = '0b157388-1111-2222-3333-444455556666';
  for (let i = 0; i < 30 && !J(STORE).chat[ch.sessionId]; i++) await sleep(200);
  assert.deepEqual(J(STORE).chat[ch.sessionId].eskil, { nazer: false }, 'the ticks follow the chat\'s id');
  assert.equal(J(STORE).chat['kanal-zzz999'], undefined);
  // what the engine offers is remembered
  globalThis.__crtl_tik_dide({ type: 'system', subtype: 'init', tools: ['Bash', 'NewTool', 'mcp__x__y'], mcp_servers: [{ name: 'tazeh' }], plugins: [{ source: 'p@m' }], skills: ['s1'] });
  const d = J(DIDE);
  assert.ok(d.abzar.includes('NewTool') && !d.abzar.includes('mcp__x__y') && d.mcp.includes('tazeh') && d.afzune.includes('p@m') && d.eskil.includes('s1'), 'a new item is kept for the list');
  return 'host ok';
}

async function panelPart() {
  const H = global.__crtlHost;
  const { chromium } = require('playwright');
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  try {
    const pg = await (await b.newContext({ viewport: { width: 1200, height: 800 } })).newPage();
    const sent = [];
    await pg.exposeFunction('__hostMsg', async (m) => {
      sent.push(m);
      if (m.type === 'crtl-tik-list') return Object.assign(await H.tikFehrest(m), { type: m.type, reqId: m.reqId });
      if (m.type === 'crtl-tik-sabt') return Object.assign(await H.tikSabt(m), { type: m.type, reqId: m.reqId });
      if (m.type === 'crtl-tik-badi') return Object.assign(H.tikBadi(m), { type: m.type, reqId: m.reqId });
      return null;
    });
    await pg.route('http://t.local/', (r) => r.fulfill({ contentType: 'text/html', body: `<!doctype html><html dir="rtl"><body style="margin:0;font:13px sans-serif">
      <div class="chatContainer_y" style="position:relative;height:700px"><div class="messagesContainer_x" style="height:300px">گفتگو</div>
      <div class="inputContainer_y" style="position:absolute;bottom:0;left:0;right:0;margin:0 auto;max-width:680px"><div class="inputContainer_z"><div class="messageInputContainer_x"><div aria-label="Message input" contenteditable="true" style="min-height:40px"></div></div></div></div></div></body></html>` }));
    await pg.goto('http://t.local/');
    await pg.evaluate((cwd) => {
      window.acquireVsCodeApi = () => ({ postMessage: (m) => { window.__hostMsg(m).then((r) => { if (r) window.postMessage(r, '*'); }); }, getState: () => ({}), setState() {} });
      // the app's session object: a new chat with no messages
      window.__restarts = 0;
      window.__s = { claudeChannelId: 'chN', cwd: { value: cwd }, sessionId: { value: undefined }, blank: true,
        isUnusedBlankChat() { return false; }, holdsNoConversation() { return this.blank; }, restartClaude() { window.__restarts++; return Promise.resolve(); } };
      window.__crtl_sessions = new Set([window.__s]);
    }, PX);
    // «aaTaze» خاموش ⇒ هیچ‌وقت خودش باز نمی‌شود (همان کلید در DSH و اکستنشن)
    if (process.env.TIK_AA_OFF === '1') {
      await pg.evaluate(() => window.localStorage.setItem('crtl-sizes', JSON.stringify({ aaTaze: false })));
    }
    await pg.addScriptTag({ content: fs.readFileSync(UI, 'utf8') });
    await pg.evaluate(() => window.acquireVsCodeApi());
    await pg.waitForSelector('#crtl-panel', { state: 'attached' });
    if (process.env.TIK_AA_OFF === '1') {
      await new Promise((r) => setTimeout(r, 4000));
      const opened = await pg.evaluate(() => document.getElementById('crtl-panel').classList.contains('crtl-open'));
      assert.equal(opened, false, 'aaTaze=off ⇒ Aa خودش باز نمی‌شود');
      await pg.evaluate(() => window.__cleanup && window.__cleanup());
      return;
    }
    // a new chat opens Aa on «ابزارها» by itself
    await pg.waitForSelector('#crtl-panel.crtl-open #crtl-page-tik', { state: 'visible', timeout: 8000 });
    assert.equal(await pg.getByRole('tab', { name: 'ابزارها' }).getAttribute('aria-selected'), 'true', 'on the «ابزارها» tab');
    assert.deepEqual(await pg.$$eval('.crtl-tabs button', (x) => x.map((e) => e.textContent)), ['فونت', 'ابزارها', 'تنظیمات کلود'], 'its own tab, before Claude\'s settings');
    await pg.waitForSelector('.crtl-tik-row');
    const readUsage = pg.locator('.crtl-tik-row').filter({ has: pg.locator('.crtl-tik-esm', { hasText: /^Read$/ }) }).locator('.crtl-tik-usage');
    assert.equal(await readUsage.textContent(), 'محتوای یک فایل را می‌خواند', 'Read has its actual Persian purpose');
    const search = pg.locator('#crtl-page-tik .crtl-tz-search');
    await search.fill('می‌خواند');
    assert.equal(await readUsage.isVisible(), true, 'search finds Read by purpose');
    await search.fill('');
    const readGrid = await readUsage.evaluate(e => { const r=e.parentElement; return [...r.children].map(c=>c.className || c.tagName); });
    assert.deepEqual(readGrid, ['INPUT','crtl-tik-esm','crtl-tik-usage','crtl-tik-az'], 'purpose is between name and scope');
    const heads = await pg.$$eval('.crtl-tik-head', (x) => x.map((e) => e.textContent.split(' — ')[0]));
    assert.deepEqual(heads, ['ابزارهای خودِ کلود', 'MCP', 'افزونه‌ها', 'اسکیل‌ها'], 'the four kinds');
    assert.deepEqual(await pg.$$eval('.crtl-tik-sath button', (x) => x.map((e) => e.textContent)), ['این چت', 'این پوشه', 'سراسری'], 'the three levels');
    assert.match(await pg.locator('#crtl-tik-hal').textContent(), /چتِ تازه/, 'it says the tick acts on this new chat');
    // tick kompyuter back on for this folder, then save: the new chat restarts
    const row = (n) => pg.locator('.crtl-tik-row', { hasText: n }).first();
    assert.equal(await row('kompyuter').locator('input').isChecked(), false);
    assert.equal(await pg.locator('#crtl-tik-sabt').isDisabled(), true, 'nothing changed: no save');
    await row('kompyuter').locator('input').check();
    assert.match(await pg.locator('#crtl-tik-sabt').textContent(), /۱ تغییر در «این پوشه»/);
    await pg.locator('#crtl-tik-sabt').click();
    await pg.waitForFunction(() => window.__restarts === 1, null, { timeout: 8000 });
    const s = sent.find((m) => m.type === 'crtl-tik-sabt');
    assert.equal(s.sath, 'poshe'); assert.deepEqual(s.taghir, [{ kind: 'mcp', name: 'kompyuter', on: true }]);
    assert.ok(sent.findIndex((m) => m.type === 'crtl-tik-badi') > sent.indexOf(s), 'the host is told before the restart');
    assert.equal(py(['settings', PX]).deniedMcpServers, undefined, 'saved in the shared list');
    // «این چت»: under the chat's own name
    await pg.waitForFunction(() => /دوباره راه افتاد/.test(document.getElementById('crtl-tik-natije').textContent));
    await pg.locator('.crtl-tik-sath button', { hasText: 'این چت' }).click();
    await pg.waitForSelector('.crtl-tik-row');
    await row('watch').locator('input').setChecked(false);
    await pg.locator('#crtl-tik-sabt').click();
    await pg.waitForFunction(() => window.__restarts === 2, null, { timeout: 8000 });
    const kelid = sent.filter((m) => m.type === 'crtl-tik-sabt').pop().kelid;
    assert.match(kelid, /^kanal-/, 'a new chat\'s own ticks go under its own name');
    assert.equal(globalThis.__crtl_baz_shodan('', PX).settings.__crtl_tik_chat, kelid, 'and its restart carries that name');
    // «سراسری» asks first
    await pg.waitForFunction(() => /دوباره راه افتاد/.test(document.getElementById('crtl-tik-natije').textContent));
    await pg.locator('.crtl-tik-sath button', { hasText: 'سراسری' }).click();
    await row('nazer').locator('input').setChecked(false);
    await pg.locator('#crtl-tik-sabt').click();
    await pg.waitForSelector('.crtl-tz-popup');
    await pg.locator('.crtl-tz-popup button', { hasText: 'نه' }).click();
    assert.equal(sent.filter((m) => m.type === 'crtl-tik-sabt').length, 2, '«نه» saves nothing');
    // an old chat: saved for new chats, never restarted
    await pg.evaluate(() => { window.__s.blank = false; window.__s.sessionId.value = '0c157388-1111-2222-3333-444455556666'; });
    await pg.getByRole('tab', { name: 'فونت' }).click();
    await pg.getByRole('tab', { name: 'ابزارها' }).click();
    await pg.waitForFunction(() => /چتِ قدیمی/.test(document.getElementById('crtl-tik-hal').textContent));
    await pg.locator('.crtl-tik-sath button', { hasText: 'این پوشه' }).click();
    await row('hafeze').locator('input').setChecked(false);
    await pg.locator('#crtl-tik-sabt').click();
    await pg.waitForFunction(() => /چتِ قدیمی/.test(document.getElementById('crtl-tik-natije').textContent));
    await sleep(500);
    assert.equal(await pg.evaluate(() => window.__restarts), 2, 'an old chat is never restarted');
    // nothing outside the panel
    const over = await pg.evaluate(() => { const p = document.getElementById('crtl-panel'); return p.scrollWidth - p.clientWidth; });
    assert.ok(over <= 1, 'no sideways scroll: ' + over);
    await pg.screenshot({ path: path.join(tmp, 'tik-panel.png') });
    return 'panel ok · ' + path.join(tmp, 'tik-panel.png');
  } finally { await b.close(); }
}

// the real engine through the real VS Code wrapper: what the chat really gets
async function enginePart() {
  function init(cwd, settings) {
    return new Promise((ok, rad) => {
      const p = spawn('sh', [WRAPPER, BIN, '--output-format', 'stream-json', '--input-format', 'stream-json', '--verbose', ...(settings ? ['--settings', JSON.stringify(settings)] : [])], { cwd, env });
      let buf = '';
      const t = setTimeout(() => { p.kill(); rad(new Error('no init')); }, 60000);
      p.stdout.on('data', (c) => {
        buf += c;
        for (const line of buf.split('\n')) {
          try { const x = JSON.parse(line); if (x.subtype === 'init') { clearTimeout(t); p.kill(); return ok(x); } } catch (e) {}
        }
      });
      p.stdin.write(JSON.stringify({ type: 'user', message: { role: 'user', content: 'hi' } }) + '\n');
    });
  }
  const a = await init(P136);
  const b = a.tools.filter((t) => !t.startsWith('mcp__')).sort();
  assert.ok(!b.includes('Agent') && !b.includes('Task') && !b.includes('Workflow') && !b.includes('CronCreate') && b.includes('Bash') && b.length <= 11, '136: only its list: ' + b.join(','));
  // the folder PX (kompyuter on again, hafeze off) plus the chat's own ticks by name, as the host passes them
  py(['sabt'], { sath: 'chat', cwd: PX, chat: 'kanal-eng123', taghir: [{ kind: 'eskil', name: 'nazer', on: false }, { kind: 'afzune', name: 'hookify@claude-plugins-official', on: false }] });
  const c = await init(PX, { __crtl_tik_chat: 'kanal-eng123' });
  const m = c.mcp_servers.filter((x) => x.source === 'user').map((x) => x.name);
  assert.ok(!m.includes('hafeze') && m.includes('kompyuter'), 'folder MCP ticks: ' + m.join(','));
  assert.ok(!c.skills.includes('nazer'), 'the chat\'s skill tick');
  assert.ok(!c.plugins.some((x) => x.name === 'hookify'), 'the chat\'s plugin tick');
  assert.ok(!c.tools.includes('Agent') && !c.tools.includes('Workflow'), 'the folder\'s first ticks');
  return 'engine ok';
}

(async () => {
  const out = [pythonPart(), await hostPart()];
  if (!process.env.BI_SAFHE) out.push(await panelPart());
  if (!process.env.BI_MOTOR) out.push(await enginePart());
  console.log(out.join('\n') + '\ntik_ha: all green');
})().catch((e) => { console.error(e); process.exit(1); });
