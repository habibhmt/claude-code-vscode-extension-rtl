// The «تنظیمات کلود» tab of the aA panel, end to end: the host's store and files, the patches on the real bundle, the real
// engine with the flags the launch would give it, the panel in a real browser against the real host code, and the question
// window (Other, selection) on real React. Habib, 5 Nov 02:34.
// Run: NODE_PATH=node_modules node test_claude_tanzimat.cjs     Env for sabotage: BUTTONS_JS, HOST_JS, FIX_SH, FA_JSON, WRAPPER
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), assert = require('node:assert/strict');
const { execFileSync, spawn } = require('node:child_process');
const UI = process.env.BUTTONS_JS || __dirname + '/claude-ui-buttons.js', HOST = process.env.HOST_JS || __dirname + '/claude-host-hook.js';
const SH = process.env.FIX_SH || __dirname + '/fix-rtl-claude.sh', FA = process.env.FA_JSON || __dirname + '/claude-tanzimat-fa.json', TOZIH = process.env.TOZIH_JSON || __dirname + '/claude-tanzimat-tozih.json';
const WRAPPER = process.env.WRAPPER || path.join(os.homedir(), '.claude/claude_abzar_kam.sh');
const PANJERE_PY = path.join(os.homedir(), '1-MY-WORK/203th-day-imac-cpu-tracker/doc/abzar');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const realHome = process.env.HOME;
const extDir = path.join(realHome, '.vscode/extensions');
const ext = fs.readdirSync(extDir).filter((d) => /^anthropic\.claude-code-[\d.]+-/.test(d)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).pop();
const EXT = path.join(extDir, ext);
const SID1 = '11111111-2222-3333-4444-555555555555', SID2 = '99999999-2222-3333-4444-555555555555', SID3 = '33333333-2222-3333-4444-555555555555';
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'tz-'));
const CL = path.join(home, '.claude');
fs.mkdirSync(CL);
delete process.env.CRTL_TANZIMAT;
delete process.env.CLAUDE_CONFIG_DIR;
process.env.CRTL_SCHEMA = path.join(EXT, 'claude-code-settings.schema.json');
function loadHost() {
  process.env.CRTL_HOST_TEST = '1';
  process.env.HOME = home;
  delete global.__crtlHost;
  (0, eval)('(function(require){' + fs.readFileSync(HOST, 'utf8') + '\n})')(require);
  process.env.HOME = realHome;
  return global.__crtlHost;
}
const P1 = path.join(home, 'proj1'), P2 = path.join(home, 'proj2');
fs.mkdirSync(P1); fs.mkdirSync(P2);
const STORE = path.join(CL, 'crtl_tanzimat.json'), USER = path.join(CL, 'settings.json');
const J = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const local = (p) => path.join(p, '.claude/settings.local.json');

// the old effort row's file comes along once
fs.writeFileSync(path.join(CL, 'effort_chat.json'), JSON.stringify({ [SID3]: 'max', 'not-a-chat': 'low', [SID2]: 'huge' }));
const H = loadHost();
assert.ok(!fs.existsSync(STORE), 'loading the code in a test touches no file: other tests load it with the real home');
H.vaghtEffortGhadimi();
assert.equal(J(STORE).chat[SID3].effortLevel.v, 'max', 'the old file is imported');
assert.equal(J(STORE).chat['not-a-chat'], undefined, 'a bad id stays out');
assert.equal(J(STORE).chat[SID2], undefined, 'a bad level stays out');
assert.ok(!fs.existsSync(path.join(CL, 'effort_chat.json')) && fs.existsSync(path.join(CL, 'effort_chat.json.crtl-amad')), 'and steps aside');
assert.equal(globalThis.__crtl_baz_shodan(SID3, P1).effort, 'max', 'its chat still opens with max');
{ const a = J(STORE); delete a.chat[SID3]; fs.writeFileSync(STORE, JSON.stringify(a)); }

// the rows
const rows = H.radifha();
assert.equal(rows.length, 174, '173 settings of the schema and the browser switch');
assert.equal(rows.find((r) => r.k === 'claudeInChromeDefaultEnabled').no, 'onoff', 'the browser switch is an on-off row');
['effortLevel', 'model', 'remoteControlAtStartup', 'ultracode', 'autoCompactWindow'].forEach((k) => assert.ok(rows.some((r) => r.k === k), k + ' is there'));
['apiKeyHelper', 'proxyAuthHelper', 'awsCredentialExport', 'awsAuthRefresh', 'gcpAuthRefresh', 'processWrapper', 'otelHeadersHelper', '$schema'].forEach((k) => assert.ok(!rows.some((r) => r.k === k), k + ' never appears'));
const count = (no) => rows.filter((r) => r.no === no).length;
const choiceOrText = rows.filter((r) => r.pish).map((r) => r.k).sort();
assert.deepEqual(choiceOrText, ['theme', 'timeFormat'], 'a choice-or-text setting is a one-line text box that offers its choices');
assert.equal(count('json') + choiceOrText.length, 55, '55 complex settings get a text box');
assert.equal(rows.length - count('json') - choiceOrText.length, 119, '119 simple settings');
assert.deepEqual(rows.find((r) => r.k === 'theme').pish.slice(0, 2), ['auto', 'dark'], 'a choice-or-text setting offers its choices');
// every row has its Persian line, and no line is left over
const fa = J(FA);
rows.forEach((r) => assert.ok(typeof fa[r.k] === 'string' && /[؀-ۿ]/.test(fa[r.k]), 'Persian line for ' + r.k));
Object.keys(fa).forEach((k) => assert.ok(rows.some((r) => r.k === k), 'a Persian line with no setting: ' + k));
// Habib, 5 Nov: every setting explains itself in simple words with an example
const tozih = J(TOZIH);
rows.forEach((r) => assert.ok(typeof tozih[r.k].sharh === 'string' && /[؀-ۿ]/.test(tozih[r.k].sharh) && /مثال/.test(tozih[r.k].sharh), 'an explanation with an example for ' + r.k));
// Habib, 5 Nov: the value's meaning: on and off, or a line carrying the value, and what empty means
rows.forEach((r) => {
  const e = tozih[r.k];
  assert.ok((e.on && e.off) || e.ba, 'the meaning of a value for ' + r.k);
  assert.ok(r.k === 'claudeInChromeDefaultEnabled' || 'pish' in e || e.khali, 'the default or the meaning of empty for ' + r.k);
  // a default the app states in words is the default here: never one from my head
  const m = /\(defaults? (?:to )?:?\s*([\w.]+)|\bdefault[: ]+([\w.]+)|Defaults to ["']?([\w.]+)/i.exec(r.desc || '');
  if (m && /^(true|false|\d[\d.]*|never|5m|bash)$/.test(m[1] || m[2] || m[3]) && 'pish' in e) assert.equal(String(e.pish), m[1] || m[2] || m[3], 'the app states the default of ' + r.k);
});
assert.equal(tozih.cleanupPeriodDays.pish, 30, 'the app says 30');
assert.equal(tozih.bashOutputMaxChars.pish, 30000, 'the app says 30000');
Object.keys(tozih).forEach((k) => assert.ok(rows.some((r) => r.k === k), 'an explanation with no setting: ' + k));

// the validator, on the app's real schema
const schema = J(process.env.CRTL_SCHEMA).properties;
assert.ok(H.sanjesh(schema.permissions, { allow: ['Bash'] }), 'a good object passes');
assert.ok(!H.sanjesh(schema.permissions, { allow: 'Bash' }), 'a wrong shape fails');
assert.ok(H.sanjesh(schema.cleanupPeriodDays, 30), 'an integer passes');
assert.ok(!H.sanjesh(schema.cleanupPeriodDays, 0), 'exclusiveMinimum holds');
assert.ok(!H.sanjesh(schema.cleanupPeriodDays, 1.5), 'a fraction fails an integer');
assert.ok(H.sanjesh(schema.theme, 'custom:x') && !H.sanjesh(schema.theme, 'zzz'), 'anyOf and pattern hold');
assert.ok(H.sanjesh(schema.forceLoginOrgUUID, 'abc') && H.sanjesh(schema.forceLoginOrgUUID, ['abc']) && !H.sanjesh(schema.forceLoginOrgUUID, 5), 'string or list');

// two fake chats in one window, one in each folder
function fakeChat(sid, cwd, uc) {
  const applied = { model: 'claude-opus-5-5', effort: 'medium', ultracode: !!uc, ultracodeRequested: !!uc };
  const ch = { sessionId: sid, cwd, remoteControlState: { status: 'connected' }, calls: [], applied, query: {
    applyFlagSettings: async (s) => { ch.calls.push(s); if ('effortLevel' in s) applied.effort = s.effortLevel; if ('model' in s && s.model) applied.model = s.model; if ('ultracode' in s) applied.ultracodeRequested = !!s.ultracode; },
    getSettings: async () => ({ applied: { ...applied }, effective: { language: 'persian', env: { RAZ2: 'nabayad-bebini' } }, sources: [{ source: 'localSettings', settings: { language: 'persian', env: { RAZ2: 'nabayad-bebini' } } }] }),
    getContextUsage: async () => ({ autoCompactThreshold: 267000 }),
    supportedModels: async () => [{ value: 'default', displayName: 'Default' }, { value: 'opus', displayName: 'Opus' }, { value: 'sonnet', displayName: 'Sonnet' }],
  } };
  return ch;
}
const owner = { channels: new Map(), toggles: [], async toggleRemoteControl(id, on) { this.toggles.push([id, on]); const c = this.channels.get(id); c.remoteControlState.status = on ? 'connected' : 'disconnected'; } };
const c1 = fakeChat(SID1, P1), c2 = fakeChat(SID2, P2);
owner.channels.set('ch1', c1); owner.channels.set('ch2', c2);
H.SAHEB.add(owner);
const posted = [];
H.SAFHE.add({ postMessage: (m) => { posted.push(m); } });
const save = (o) => H.sabtTanzim({ channel: '', ...o });
const launch = (s, c) => globalThis.__crtl_baz_shodan(s, c);
const reset = () => { c1.calls.length = 0; c2.calls.length = 0; owner.toggles.length = 0; };

async function hostLogic() {
  // ---- row 7: the last save wins, row 4: a popup's words
  let r = await save({ sath: 'chat', key: 'effortLevel', value: 'low', sid: SID1 });
  assert.ok(r.ok && r.matn.includes('ثبت شد'), 'the popup says it was saved: ' + r.matn);
  assert.deepEqual(c1.calls, [{ effortLevel: 'low' }], 'this chat changes now');
  assert.deepEqual(c2.calls, [], 'the other chat does not');
  assert.ok(!fs.existsSync(USER), 'a chat save writes no settings file');
  assert.equal(launch(SID1, P1).effort, 'low', 'and opens with it after a reload');
  assert.equal(launch(SID2, P2).effort, undefined, 'the other chat keeps what it has');
  reset();
  r = await save({ sath: 'sarasari', key: 'effortLevel', value: 'max', sid: SID1 });
  assert.ok(r.ok && r.matn.includes('۲ چت'), 'global reaches both chats: ' + r.matn);
  assert.deepEqual(c1.calls, [{ effortLevel: 'max' }], 'chat 189 low + global max ⇒ max');
  assert.deepEqual(c2.calls, [{ effortLevel: 'max' }]);
  assert.equal(launch(SID1, P1).effort, 'max'); assert.equal(launch(SID2, P2).effort, 'max');
  assert.equal(J(STORE).chat[SID1].effortLevel, undefined, 'the chat entry that lost is gone');
  // the file: the engine reads effort by model, and refuses max in a file (measured)
  assert.equal(J(USER).effortLevel, undefined, 'no top-level effort: the engine ignores it');
  assert.equal(J(USER).modelSettings['claude-opus-5-5'].effortLevel, 'xhigh', 'max stays xhigh in the file');
  assert.ok(r.matn.includes('xhigh'), 'and the popup says so');
  reset();
  r = await save({ sath: 'poshe', key: 'effortLevel', value: 'low', sid: SID1 });
  assert.deepEqual(c1.calls, [{ effortLevel: 'low' }], 'project: chats of that folder');
  assert.deepEqual(c2.calls, [], 'not another folder');
  assert.equal(launch(SID3, P1).effort, 'low', 'every chat of the folder opens with it');
  assert.equal(launch(SID2, P2).effort, 'max', 'another folder keeps global');
  assert.equal(J(local(P1)).effortLevel, 'low', 'written to the folder\'s own file');
  reset();
  await sleep(5);
  await save({ sath: 'chat', key: 'effortLevel', value: 'high', sid: SID1 });
  assert.equal(launch(SID1, P1).effort, 'high', 'a newer chat save beats the project');
  await sleep(5);
  await save({ sath: 'poshe', key: 'effortLevel', value: 'medium', sid: SID1 });
  assert.equal(launch(SID1, P1).effort, 'medium', 'a newer project save beats the chat');
  assert.deepEqual(c1.calls.at(-1), { effortLevel: 'medium' });
  // a global save clears the older levels, and the project's file too; the rest of that file stays
  fs.writeFileSync(local(P1), JSON.stringify({ ...J(local(P1)), permissions: { allow: ['Bash'] } }));
  await sleep(5);
  await save({ sath: 'sarasari', key: 'effortLevel', value: 'high', sid: SID1 });
  assert.equal(J(local(P1)).effortLevel, undefined, 'the older project value leaves its file');
  assert.deepEqual(J(local(P1)).permissions, { allow: ['Bash'] }, 'nothing else in that file moves');
  assert.ok(fs.existsSync(local(P1) + '.crtl-bak'), 'the file as it was stays beside it');
  assert.equal(launch(SID3, P1).effort, 'high');

  // ---- an empty box lets go at that level
  reset();
  r = await save({ sath: 'chat', key: 'effortLevel', value: '', sid: SID2 });
  assert.ok(!r.ok && r.matn.includes('مقداری نداشت'), 'nothing to remove says so');
  await save({ sath: 'chat', key: 'effortLevel', value: 'low', sid: SID2 });
  r = await save({ sath: 'chat', key: 'effortLevel', value: '', sid: SID2 });
  assert.ok(r.ok && r.matn.includes('پاک شد'), r.matn);
  assert.equal(launch(SID2, P2).effort, 'high', 'back to the next winner');

  // ---- rows 3 and 10: auto-compact, the typed number is the real compaction point
  reset();
  r = await save({ sath: 'poshe', key: 'autoCompactWindow', value: '300000', sid: SID1 });
  assert.ok(r.ok, r.matn);
  assert.equal(J(STORE).poshe[P1].autoCompactWindow.v, 333000, 'typed 300K is stored as window 333K');
  assert.equal(J(local(P1)).autoCompactWindow, 333000, 'and in the folder file');
  assert.equal(launch(SID1, P1).settings.autoCompactWindow, 333000, 'and goes on the launch');
  assert.ok(r.matn.includes('کامپکت سر ۳۰۰ هزار') && r.matn.includes('رممبر سر ۲۸۰ هزار') && r.matn.includes('ریلود'), r.matn);
  assert.deepEqual(c1.calls, [], 'the running engine ignores it (measured): no push');
  ['۳۰۰', '300', '300,000', '۳۰۰۰۰۰'].forEach((t) => assert.equal(H.khamBeMaghdar('autoCompactWindow', t).v, 333000, 'typed ' + t));
  assert.equal(H.khamBeMaghdar('autoCompactWindow', '967000').v, 1000000, 'the top of the range');
  assert.ok(H.khamBeMaghdar('autoCompactWindow', '2000000').sagf, 'above it: capped, and told');
  assert.equal(H.khamBeMaghdar('autoCompactWindow', '2000000').v, 1000000);
  assert.ok(H.khamBeMaghdar('autoCompactWindow', '50000').khata.includes('۶۷'), 'below 67K is refused');
  assert.ok(H.khamBeMaghdar('autoCompactWindow', 'abc').khata, 'words are refused');
  // the timer and the remember hook of repo 203 read the same number from the same store
  if (fs.existsSync(path.join(PANJERE_PY, 'panjere_chat.py'))) {
    const out = execFileSync('python3', ['-c', 'import sys;sys.path.insert(0,sys.argv[1]);import panjere_chat as p;print(p.noghte(sys.argv[2],sys.argv[3]))', PANJERE_PY, SID1, P1], { env: { ...process.env, CRTL_TANZIMAT: STORE, PYTHONDONTWRITEBYTECODE: '1' } }).toString().trim();
    assert.equal(out, '300000', 'panjere_chat.py reads the compaction point');
  }
  // global: the per-model numbers that would beat it leave the file, the rest of the per-model entries stay
  { const u = J(USER); u.modelSettings['claude-opus-5-5'].autoCompactWindow = 1000000; u.modelSettings['claude-haiku-5-5'] = { effortLevel: 'xhigh' }; fs.writeFileSync(USER, JSON.stringify(u)); }
  r = await save({ sath: 'sarasari', key: 'autoCompactWindow', value: '400000', sid: SID1 });
  assert.ok(r.ok, r.matn);
  assert.equal(J(USER).autoCompactWindow, 433000, 'the top-level number');
  assert.equal(J(USER).modelSettings['claude-opus-5-5'].autoCompactWindow, undefined, 'the per-model one leaves');
  assert.equal(J(USER).modelSettings['claude-haiku-5-5'].effortLevel, 'xhigh', 'the rest stays');
  assert.equal(J(STORE).poshe[P1].autoCompactWindow, undefined, 'global is the newest: the project value goes');

  // ---- rows 11: ultracode, on the launch and live; effort never turns it off (measured: it does unless sent along)
  reset();
  r = await save({ sath: 'chat', key: 'ultracode', value: 'true', sid: SID1 });
  assert.ok(r.matn.includes('ایجنت و ورک‌فلو بعد از ریلود باز'), r.matn);
  assert.deepEqual(c1.calls, [{ ultracode: true }]);
  assert.equal(launch(SID1, P1).settings.ultracode, true, 'the launch carries it, and the wrapper opens Agent and Workflow on it');
  reset();
  c1.applied.ultracodeRequested = true;
  await save({ sath: 'chat', key: 'effortLevel', value: 'low', sid: SID1 });
  assert.deepEqual(c1.calls, [{ effortLevel: 'low', ultracode: true }], 'effort goes with ultracode, or the engine drops it');
  c1.applied.ultracodeRequested = false;
  reset();
  await save({ sath: 'chat', key: 'ultracode', value: '', sid: SID1 });
  assert.deepEqual(c1.calls, [{ ultracode: null }], 'letting go goes back to the engine as null');

  // ---- model: first the model, then this chat's effort again, because a model brings its own effort (measured)
  reset();
  await save({ sath: 'chat', key: 'model', value: 'sonnet', sid: SID1 });
  assert.deepEqual(c1.calls, [{ model: 'sonnet' }, { effortLevel: 'low' }], 'model first, effort after');
  assert.equal(launch(SID1, P1).model, 'sonnet');
  assert.equal(launch(SID1, P1).settings && launch(SID1, P1).settings.model, undefined, 'model goes as --model, not in --settings');
  assert.equal(launch(SID1, P1).settings && launch(SID1, P1).settings.effortLevel, undefined, 'effort goes as --effort');

  // ---- remote control
  reset();
  c1.remoteControlState.status = 'connected';
  r = await save({ sath: 'chat', key: 'remoteControlAtStartup', value: 'false', sid: SID1 });
  assert.ok(r.ok, r.matn);
  assert.deepEqual(owner.toggles, [['ch1', false]], 'turns off now, this chat only');
  assert.deepEqual(c1.calls, [], 'not through the flag layer: the engine reads it elsewhere');
  assert.equal((launch(SID1, P1).settings || {}).remoteControlAtStartup, undefined, 'not on the launch flags');
  reset();
  await save({ sath: 'sarasari', key: 'remoteControlAtStartup', value: 'true', sid: SID1 });
  assert.deepEqual(owner.toggles, [['ch1', true]], 'global on: only the chat that is off gets a knock');
  assert.equal(J(USER).remoteControlAtStartup, true, 'and the file holds it for the host\'s own path');
  // a toggle that fails is said in the popup, the save stays
  reset();
  const realToggle = owner.toggleRemoteControl;
  owner.toggleRemoteControl = async () => { throw new Error('Remote Control is only available when ...'); };
  c1.remoteControlState.status = 'connected';
  r = await save({ sath: 'chat', key: 'remoteControlAtStartup', value: 'false', sid: SID1 });
  assert.ok(r.ok && r.matn.includes('ننشست') && r.matn.includes('only available'), 'the popup says what did not land: ' + r.matn);
  assert.equal(J(STORE).chat[SID1].remoteControlAtStartup.v, false, 'and the save stays for the next opening');
  owner.toggleRemoteControl = realToggle;
  await save({ sath: 'chat', key: 'remoteControlAtStartup', value: '', sid: SID1 });
  // nothing to change on an open chat is said too
  reset();
  await save({ sath: 'chat', key: 'effortLevel', value: 'medium', sid: SID3 });
  r = await save({ sath: 'chat', key: 'effortLevel', value: 'medium', sid: SID3 });
  assert.ok(r.matn.includes('چتی عوض نشد'), 'no chat changed: ' + r.matn);
  await save({ sath: 'chat', key: 'effortLevel', value: '', sid: SID3 });
  c1.remoteControlState.status = 'disconnected';
  // a new chat: off goes first, on waits and knocks only if it stayed off
  H.tanzimRemoteSabr(30);
  reset();
  const c3 = fakeChat(SID3, P1); c3.remoteControlState.status = 'disconnected';
  owner.channels.set('ch3', c3);
  globalThis.__crtl_kanal_taze(owner, 'ch3', c3);
  await sleep(120);
  assert.deepEqual(owner.toggles, [['ch3', true]], 'stayed off: turned on');
  reset();
  const c4 = fakeChat('44444444-2222-3333-4444-555555555555', P1);
  owner.channels.set('ch4', c4);
  globalThis.__crtl_kanal_taze(owner, 'ch4', c4);
  await sleep(120);
  assert.deepEqual(owner.toggles, [], 'already on: left alone');
  owner.channels.delete('ch3'); owner.channels.delete('ch4');
  await save({ sath: 'sarasari', key: 'remoteControlAtStartup', value: 'false', sid: SID1 });
  reset();
  const c5 = fakeChat('55555555-2222-3333-4444-555555555555', P1);
  owner.channels.set('ch5', c5);
  globalThis.__crtl_kanal_taze(owner, 'ch5', c5);
  await sleep(60);
  assert.deepEqual(owner.toggles, [['ch5', false]], 'saved off: decided at once, before the engine turns it on');
  owner.channels.delete('ch5');

  // ---- values that don't fit are refused and nothing is written
  const before = fs.readFileSync(STORE, 'utf8');
  for (const [k, v, why] of [['apiKeyHelper', 'x', 'runs a program'], ['$schema', 'x', 'not a setting'], ['nope', 'x', 'unknown'], ['effortLevel', 'huge', 'unknown level'],
    ['permissions', '{bad', 'bad JSON'], ['permissions', '{"allow":"Bash"}', 'wrong shape'], ['cleanupPeriodDays', 'abc', 'not a number'], ['cleanupPeriodDays', '-3', 'out of range'],
    ['viewMode', 'zzz', 'not in its list'], ['theme', 'zzz', 'not in its list or pattern'], ['verbose', 'maybe', 'not on or off']]) {
    r = await save({ sath: 'chat', key: k, value: v, sid: SID1 });
    assert.equal(r.ok, false, k + ' ' + why);
    assert.ok(r.matn, 'with a reason');
  }
  r = await save({ sath: 'nowhere', key: 'verbose', value: 'true', sid: SID1 });
  assert.equal(r.ok, false, 'no tick, no save');
  r = await save({ sath: 'chat', key: 'verbose', value: 'true' });
  assert.equal(r.ok, false, 'a chat save needs the chat\'s id');
  assert.equal(fs.readFileSync(STORE, 'utf8'), before, 'nothing was written');
  // a broken settings file is never overwritten
  const goodUser = fs.readFileSync(USER, 'utf8');
  fs.writeFileSync(USER, '{ broken');
  r = await save({ sath: 'sarasari', key: 'verbose', value: 'true', sid: SID1 });
  assert.equal(r.ok, false, 'refused');
  assert.equal(fs.readFileSync(USER, 'utf8'), '{ broken', 'left as it was');
  assert.equal(fs.readFileSync(STORE, 'utf8'), before, 'and not half saved');
  fs.writeFileSync(USER, goodUser);

  // ---- the other settings: simple ones also go on the flag layer; objects from a file level stay in the file alone
  reset();
  r = await save({ sath: 'sarasari', key: 'language', value: 'persian', sid: SID1 });
  assert.ok(r.ok && r.matn.includes('ریلود'), r.matn);
  assert.deepEqual(c1.calls.at(-1), { language: 'persian' }, 'a simple value goes live');
  assert.equal(launch(SID1, P1).settings.language, 'persian');
  assert.equal(J(USER).language, 'persian');
  reset();
  await save({ sath: 'sarasari', key: 'permissions', value: '{"allow":["Bash(ls)"]}', sid: SID1 });
  assert.deepEqual(J(USER).permissions, { allow: ['Bash(ls)'] }, 'in the file');
  assert.equal(launch(SID1, P1).settings.permissions, undefined, 'not on the flags: lists and hooks would run twice across layers');
  assert.deepEqual(c1.calls, [], 'and not pushed');
  await save({ sath: 'chat', key: 'permissions', value: '{"allow":["Bash(pwd)"]}', sid: SID1 });
  assert.deepEqual(launch(SID1, P1).settings.permissions, { allow: ['Bash(pwd)'] }, 'a chat level has no file: its object goes on the flags');
  assert.deepEqual(c1.calls, [{ permissions: { allow: ['Bash(pwd)'] } }]);
  await save({ sath: 'chat', key: 'permissions', value: '', sid: SID1 });

  // ---- row 9: Claude's own menu changes this chat only
  const menu = globalThis.__crtl_menu_chat;
  assert.equal(menu(owner, 'ch2', { effortLevel: 'xhigh' }), true, 'the writer goes flags-only');
  assert.equal(J(STORE).chat[SID2].effortLevel.v, 'xhigh', 'recorded for this chat, so a reload keeps it');
  assert.equal(launch(SID2, P2).effort, 'xhigh'); assert.equal(launch(SID1, P1).effort, 'low', 'not for another chat');
  assert.equal(menu(owner, 'ch2', { effortLevel: 'max', ultracode: true }), true, 'effort with ultracode, as the page sends it');
  assert.equal(menu(owner, 'ch2', { model: 'haiku' }), true);
  assert.equal(launch(SID2, P2).model, 'haiku');
  assert.equal(menu(owner, 'ch2', { model: null }), true, 'Default in the menu lets go');
  assert.equal(launch(SID2, P2).model, undefined);
  assert.equal(menu(owner, 'ch2', { fastMode: true }), false, 'anything else stays as the app does it');
  assert.equal(menu(owner, 'ch2', { effortLevel: 'low', fastMode: true }), false, 'a mix too');
  assert.equal(menu(owner, 'ch2', { ultracode: true }), false, 'ultracode alone is not this path');
  assert.equal(menu(owner, 'gone', { effortLevel: 'low' }), true, 'no channel yet: still never the global file');
  // the winner already says it: no entry, so a later project save isn't beaten by a click that changed nothing
  { const a = J(STORE); delete a.chat[SID2]; fs.writeFileSync(STORE, JSON.stringify(a)); }
  await save({ sath: 'sarasari', key: 'effortLevel', value: 'medium', sid: SID1 });
  menu(owner, 'ch2', { effortLevel: 'medium' });
  assert.equal((J(STORE).chat[SID2] || {}).effortLevel, undefined, 'no entry when nothing changes');
  // the menu's change is already on the engine: no second push when the store's change comes around
  reset();
  menu(owner, 'ch2', { effortLevel: 'low' });
  await H.pushHame();
  assert.deepEqual(c2.calls, [], 'not pushed twice');
  // a new chat has no id until its first message: the click waits for it
  const c6 = fakeChat(undefined, P2), SID6 = '66666666-2222-3333-4444-555555555555';
  owner.channels.set('ch6', c6);
  const realSetInterval = global.setInterval;
  global.setInterval = (f) => realSetInterval(f, 20);
  menu(owner, 'ch6', { effortLevel: 'high' });
  global.setInterval = realSetInterval;
  await sleep(50);
  assert.equal(launch(SID6, P2).effort, 'medium', 'not yet');
  c6.sessionId = SID6;
  await sleep(60);
  assert.equal(launch(SID6, P2).effort, 'high', 'saved once the id arrived');
  owner.channels.delete('ch6');

  // ---- the extension's own labels are told, and another window's save reaches this window's chats
  posted.length = 0;
  reset();
  await save({ sath: 'chat', key: 'effortLevel', value: 'xhigh', sid: SID1 });
  assert.ok(posted.some((m) => m.type === 'crtl-tanzimat-taze' && m.channelId === 'ch1'), 'the page re-reads its labels');
  reset();
  c1.__crtlZende = c1.__crtlZende; // the watcher starts at the first channel; written below as another process would
  const other = J(STORE); other.chat[SID1].effortLevel = { v: 'high', t: Date.now() };
  fs.writeFileSync(STORE, JSON.stringify(other));
  for (let i = 0; i < 40 && !c1.calls.length; i++) await sleep(100);
  assert.deepEqual(c1.calls, [{ effortLevel: 'high' }], 'a save from another window reaches this chat by itself');

  // ---- what the tab reads
  const f = await H.fehrestTanzim({ reqId: 7, sid: SID1, channel: 'ch1' });
  assert.equal(f.reqId, 7); assert.equal(f.rows.length, 174); assert.equal(f.cwd, P1);
  assert.equal(f.alan.thr, 267000, 'the engine\'s own compaction point');
  assert.equal(f.alan.remote, c1.remoteControlState.status);
  assert.deepEqual(f.models.map((m) => m.value), ['default', 'opus', 'sonnet']);
  assert.equal(f.barande.effortLevel.sath, 'chat');
  const fNo = await H.fehrestTanzim({ reqId: 8, sid: '', cwd: P2 });
  assert.equal(fNo.alan, null, 'no chat yet: the tab still opens');
  assert.equal(fNo.cwd, P2);

  // ---- the browser switch. Habib, 5 Nov: «فقط تنظیمات چت بذار و فعلاً هم سراسری خاموشش کن»
  const CK = 'claudeInChromeDefaultEnabled', cj = path.join(home, '.claude.json');
  fs.writeFileSync(cj, JSON.stringify({ claudeInChromeDefaultEnabled: true, nashan: 1 }));
  fs.writeFileSync(USER, JSON.stringify({ theme: 'dark' }));
  fs.rmSync(STORE, { force: true });
  const chromeLog = [];
  owner.chromeSettingFlipCount = 5;
  owner.setChromeSetting = async (id, on) => {
    chromeLog.push(['global', id, on]);
    if (owner.chromeErr) return { error: owner.chromeErr };
    return { dialog: { enabled_by_default: owner.chromeMande ? !on : on } };
  };
  owner.ensureChromeMcpEnabled = async (id, t) => { chromeLog.push(['on', id, t && t.bySetting && t.bySetting.flips]); owner.channels.get(id).chromeMcpState = { status: 'connected' }; };
  owner.disableChromeMcp = async (id, t) => { chromeLog.push(['off', id, !!(t && t.quiet)]); owner.channels.get(id).chromeMcpState = { status: 'disconnected' }; };
  c1.chromeMcpState = { status: 'disconnected' }; c2.chromeMcpState = { status: 'disconnected' };
  delete c1.__crtlChrome; delete c2.__crtlChrome;
  const userBefore = fs.readFileSync(USER, 'utf8');
  let rc = await save({ sath: 'chat', key: CK, value: 'true', sid: SID1 });
  assert.ok(rc.ok, rc.matn);
  assert.deepEqual(chromeLog, [['on', 'ch1', 5]], 'one chat connects, by the door the app uses for its own switch');
  assert.equal(J(STORE).chat[SID1][CK].v, true, 'the chat level is kept');
  assert.equal(fs.readFileSync(USER, 'utf8'), userBefore, 'settings.json is not touched');
  assert.equal(J(cj).claudeInChromeDefaultEnabled, true, 'nor the global switch');
  assert.ok(!(CK in (launch(SID1, P1).settings || {})), 'not on the flags of a launch');
  chromeLog.length = 0;
  rc = await save({ sath: 'chat', key: CK, value: 'true', sid: SID1 });
  assert.deepEqual(chromeLog, [], 'same value: nothing knocks');
  assert.match(rc.matn, /چتی عوض نشد/);
  rc = await save({ sath: 'chat', key: CK, value: 'false', sid: SID1 });
  assert.deepEqual(chromeLog, [['off', 'ch1', true]], 'off goes the quiet way, so the model is not sent a message');
  chromeLog.length = 0;
  c1.chromeMcpState = { status: 'connected' }; c1.chromeToolsAutoAllowed = true;
  rc = await save({ sath: 'chat', key: CK, value: 'true', sid: SID1 });
  assert.deepEqual(chromeLog, [], 'already connected by hand: nothing knocks');
  rc = await save({ sath: 'chat', key: CK, value: 'false', sid: SID1 });
  assert.deepEqual(chromeLog, [['off', 'ch1', false]], 'a chat connected by hand needs the loud door, or it would stay connected');
  c1.chromeToolsAutoAllowed = false;
  chromeLog.length = 0;
  // the project level holds in the store only, and reaches only that folder
  rc = await save({ sath: 'poshe', key: CK, value: 'true', sid: SID2 });
  assert.ok(rc.ok, rc.matn);
  assert.deepEqual(chromeLog, [['on', 'ch2', 5]], 'only the chat of that folder');
  assert.ok(!(fs.existsSync(local(P2)) && CK in J(local(P2))), 'no such key in the project file');
  chromeLog.length = 0;
  // the fresh global save goes through the app and beats everything older
  rc = await save({ sath: 'sarasari', key: CK, value: 'false', sid: SID1 });
  assert.ok(rc.ok, rc.matn);
  assert.deepEqual(chromeLog[0], ['global', 'ch1', false], 'the app\'s own save');
  assert.match(rc.matn, /چت تازه خودکار وصل نمی‌شود/);
  assert.equal(J(STORE).sarasari[CK].v, false);
  assert.ok(!(CK in J(STORE).chat[SID1]) && !(CK in (J(STORE).poshe[P2] || {})), 'older levels step aside');
  assert.ok(chromeLog.some((x) => x[0] === 'off' && x[1] === 'ch2'), 'the project\'s chat goes off too');
  assert.ok(!(CK in J(USER)), 'never in settings.json');
  // what can go wrong with the global save
  const anbarPish = fs.readFileSync(STORE, 'utf8');
  rc = await H.sabtTanzim({ sath: 'sarasari', key: CK, value: 'true', sid: '', channel: '' });
  assert.equal(rc.ok, false); assert.match(rc.matn, /چت باز/, 'no chat to ask');
  owner.chromeErr = 'boom';
  rc = await save({ sath: 'sarasari', key: CK, value: 'true', sid: SID1 });
  assert.equal(rc.ok, false); assert.equal(rc.matn, 'boom', 'the app\'s own words');
  delete owner.chromeErr; owner.chromeMande = true;
  rc = await save({ sath: 'sarasari', key: CK, value: 'true', sid: SID1 });
  assert.equal(rc.ok, false); assert.match(rc.matn, /مقدار قبلی/, 'written but not taken: said');
  delete owner.chromeMande;
  assert.equal(fs.readFileSync(STORE, 'utf8'), anbarPish, 'a failed save keeps nothing');
  rc = await save({ sath: 'chat', key: CK, value: 'maybe', sid: SID1 });
  assert.equal(rc.ok, false); assert.match(rc.matn, /روشن یا خاموش/);
  rc = await save({ sath: 'chat', key: CK, value: '', sid: SID1 });
  assert.equal(rc.ok, false); assert.match(rc.matn, /مقداری نداشت/);
  // the tab reads the real switch and this chat's connection
  c1.chromeMcpState = { status: 'connected' };
  let fc = await H.fehrestTanzim({ reqId: 9, sid: SID1, channel: 'ch1' });
  assert.deepEqual(fc.chrome, { on: true, vasl: 'connected' });
  fs.writeFileSync(cj, JSON.stringify({ claudeInChromeDefaultEnabled: false }));
  fc = await H.fehrestTanzim({ reqId: 10, sid: '', cwd: P2 });
  assert.deepEqual(fc.chrome, { on: false, vasl: '' }, 'no chat: only the switch');
  // a chat born later hears its level, twice, and knocks once
  fs.writeFileSync(STORE, JSON.stringify({ chat: { [SID3]: { [CK]: { v: true, t: 9 } } } }));
  const cTaze = fakeChat(SID3, P1); cTaze.chromeMcpState = { status: 'disconnected' };
  owner.channels.set('ch3', cTaze);
  chromeLog.length = 0;
  H.tanzimRemoteSabr(20);
  globalThis.__crtl_kanal_taze(owner, 'ch3', cTaze);
  await sleep(150);
  assert.deepEqual(chromeLog, [['on', 'ch3', 5]], 'born connected by its own level');
  owner.channels.delete('ch3');
  // an older app has none of these doors: no crash
  delete owner.ensureChromeMcpEnabled; delete owner.disableChromeMcp; delete owner.setChromeSetting;
  fs.rmSync(STORE, { force: true }); delete c1.__crtlChrome;
  rc = await save({ sath: 'chat', key: CK, value: 'true', sid: SID1 });
  assert.ok(rc.ok, rc.matn);
  rc = await save({ sath: 'sarasari', key: CK, value: 'false', sid: SID1 });
  assert.equal(rc.ok, false, 'the global level says it cannot');

  owner.channels.clear();
  H.SAHEB.clear();
}

function patches() {
  // ---- the three patches on the real bundle; each regex must land, and the result must parse
  const sh = fs.readFileSync(SH, 'utf8');
  assert.ok(/TANZIMAT_FA_FILE/.test(sh.split('hash_stdin')[0]) && /\$\(cat "\$TANZIMAT_FA_FILE"/.test(sh), 'the Persian lines are part of the stamp');
  assert.ok(/\$\(cat "\$TANZIMAT_TOZIH_FILE"/.test(sh), 'the explanations are part of the stamp');
  assert.ok(/CRTL_TANZIMAT_TOZIH_FILE="\$TANZIMAT_TOZIH_FILE"/.test(sh) && /seed \+= 'window\.__CRTL_TANZIMAT_TOZIH='/.test(sh), 'and reach the page');
  const pyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tzpy-'));
  const runPy = (src, block, name) => {
    const inF = path.join(pyDir, name), py = path.join(pyDir, name + '.py');
    fs.copyFileSync(src, inF);
    fs.writeFileSync(py, 'import re,sys\nout=s=open(sys.argv[1],encoding="utf-8").read()\n' + block + '\nopen(sys.argv[1],"w",encoding="utf-8").write(out if out!=s else s)\n');
    execFileSync('python3', ['-I', py, inF]);
    return inF;
  };
  const block = sh.match(/    # The «تنظیمات کلود» tab \(Habib, 5 Nov 02:34\)\. Three places[\s\S]*?(?=    open\(path, 'w')/)[0].split('\n').map((l) => l.replace(/^    /, '')).join('\n');
  const extF = runPy(path.join(EXT, 'extension.js.backup'), block, 'ext.js');
  const out = fs.readFileSync(extF, 'utf8');
  const re1 = /\{let crtlC=globalThis\.__crtl_baz_shodan&&globalThis\.__crtl_baz_shodan\(([\w$]+),([\w$]+)\.cwd\);if\(crtlC\)\{if\(crtlC\.effort\)\2\.effort=crtlC\.effort;if\(crtlC\.model\)\2\.model=crtlC\.model;if\(crtlC\.settings\)\2\.extraArgs=\{\.\.\.\2\.extraArgs,settings:JSON\.stringify\(crtlC\.settings\)\}\}\}let [\w$]+="[\d.]+";if\(this\.output\.info\(`Spawning/;
  assert.ok(re1.test(out), 'the launch takes the winners');
  assert.ok(/this\.channels\.set\(([\w$]+),([\w$]+)\),globalThis\.__crtl_kanal_taze&&globalThis\.__crtl_kanal_taze\(this,\1,\2\),this\.pendingChannels\.delete\(\1\)/.test(out), 'a new channel is announced');
  assert.ok(/async writeUserSettingsAndPush\(([\w$]+),([\w$]+),([\w$]+),([\w$]+)\)\{if\(!\3&&\4!=="localSettings"&&globalThis\.__crtl_menu_chat&&globalThis\.__crtl_menu_chat\(this,\1,\2\)\)\3=!0;/.test(out), 'the menu goes flags-only for this chat');
  assert.ok(!/__crtl_effort_baraye/.test(sh), 'the old effort patch is gone');
  assert.ok(!/==="effortLevel"\)/.test(block), 'and the whitelist patch with it');
  execFileSync(process.execPath, ['--check', extF]);
  const webBlock = sh.match(/# A save in the «تنظیمات کلود» tab changes[\s\S]*?(?=open\(path, 'w')/)[0];
  const webF = runPy(path.join(EXT, 'webview/index.js.backup'), webBlock + '\nout=s', 'index.js');
  const webOut = fs.readFileSync(webF, 'utf8');
  assert.ok(/\}\),\(globalThis\.__crtl_sessions\|\|\(globalThis\.__crtl_sessions=new Set\)\)\.add\(this\),xn\(\(\)=>\{let [\w$]+=this\.connection\.value\?\.config\.value,/.test(webOut), 'the page knows its sessions');
  execFileSync(process.execPath, ['--check', webF]);
}

function wrapper() {
  // ---- row 11: the wrapper opens Agent and Workflow when the launch says ultracode, and only then
  const pyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tzwr-'));
  const fake = path.join(pyDir, 'fakecli.sh');
  fs.writeFileSync(fake, '#!/bin/sh\nfor a in "$@"; do printf "%s\\n" "$a"; done\n');
  fs.chmodSync(fake, 0o755);
  const wrap = (cwd, ...a) => execFileSync('/bin/sh', [WRAPPER, fake, '--input-format', 'stream-json', ...a], { cwd, env: { ...process.env, HOME: home } }).toString().split('\n').filter(Boolean);
  const plain = wrap(P1);
  assert.ok(plain.includes('--disallowedTools'), 'no ultracode: locked as before');
  const on = wrap(P1, '--settings', JSON.stringify({ ultracode: true, autoCompactWindow: 333000 }));
  assert.ok(!on.includes('--disallowedTools') && !on.includes('--tools'), 'ultracode on the launch: open');
  assert.ok(on.includes('--settings'), 'and its flags pass through untouched');
  const off = wrap(P1, '--settings', JSON.stringify({ ultracode: false }));
  assert.ok(off.includes('--disallowedTools'), 'ultracode false: still locked');
  const notCli = execFileSync('/bin/sh', [WRAPPER, fake, '--version'], { cwd: P1, env: { ...process.env, HOME: home } }).toString();
  assert.ok(!notCli.includes('--disallowedTools'), 'not a chat: untouched');
}

(async () => {
  const only = (process.env.TZ_ONLY || '').split(',').filter(Boolean), run = (n) => !only.length || only.includes(n);
  if (run('host')) { await hostLogic(); console.log('tanzimat: host logic passed'); }
  if (run('patches')) { patches(); console.log('tanzimat: patches passed'); }
  if (run('wrapper')) { wrapper(); console.log('tanzimat: wrapper passed'); }
  // the real engine, given exactly what the launch would give it
  const bin = path.join(EXT, 'resources/native-binary/claude');
  if (run('engine')) {
    if (!fs.existsSync(bin)) throw new Error('no engine at ' + bin);
    await realEngine(bin);
    console.log('tanzimat: real engine passed');
  }
  if (run('panel')) { await panelInBrowser(); console.log('tanzimat: panel passed'); }
  if (run('question')) { await questionWindow(); console.log('tanzimat: question window passed'); }
  console.log('tanzimat: all checks passed');
  process.exit(0);
})().catch((e) => { console.error(e.stack || e.message); process.exit(1); });

function startEngine(bin, cwd, launchArgs) {
  const a = ['--print', '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose', '--tools', '', '--strict-mcp-config', '--no-session-persistence', '--setting-sources=user,project,local', ...launchArgs];
  const p = spawn(bin, a, { cwd, stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, CLAUDE_CONFIG_DIR: CL, HOME: realHome } });
  let buf = '', n = 0; const wait = {};
  p.stdout.on('data', (d) => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const l = buf.slice(0, i); buf = buf.slice(i + 1); try { const m = JSON.parse(l); if (m.type === 'control_response') wait[m.response.request_id]?.(m.response); } catch {} } });
  const req = (r) => new Promise((res, rej) => { const id = 'r' + (++n); wait[id] = res; p.stdin.write(JSON.stringify({ type: 'control_request', request_id: id, request: r }) + '\n'); setTimeout(() => rej(new Error('engine timeout ' + r.subtype)), 180000).unref(); });
  return { p, req, async look() { const g = await req({ subtype: 'get_settings' }), c = await req({ subtype: 'get_context_usage' }); return { ...g.response.applied, thr: c.response.autoCompactThreshold }; } };
}
function launchArgs(c) {
  const a = [];
  if (c && c.effort) a.push('--effort=' + c.effort);
  a.push('--model', c && c.model || 'claude-opus-5-5');
  if (c && c.settings) a.push('--settings', JSON.stringify(c.settings));
  return a;
}
async function realEngine(bin) {
  const proj = fs.mkdtempSync(path.join(home, 'real-'));
  fs.rmSync(STORE, { force: true });
  fs.writeFileSync(USER, JSON.stringify({ modelSettings: { 'claude-opus-5-5': { effortLevel: 'xhigh', autoCompactWindow: 1000000 } }, autoCompactWindow: 300000 }));
  const SR = '77777777-2222-3333-4444-555555555555';
  const s = (o) => H.sabtTanzim({ sid: SR, cwd: proj, ...o });
  // this chat's own values: everything goes through the launch
  for (const [k, v] of [['effortLevel', 'max'], ['model', 'fable'], ['ultracode', 'true'], ['autoCompactWindow', '300000']]) {
    const r = await s({ sath: 'chat', key: k, value: v });
    assert.ok(r.ok, k + ': ' + r.matn);
  }
  let e = startEngine(bin, proj, launchArgs(launch(SR, proj)));
  await e.req({ subtype: 'initialize' });
  let v = await e.look();
  assert.equal(v.effort, 'max', 'effort max on the real engine, which refuses it in a file');
  assert.equal(v.model, 'claude-fable-5-1', 'the model');
  assert.equal(v.ultracode, true, 'ultracode');
  assert.equal(v.thr, 300000, 'typed 300K ⇒ the real compaction point is 300K, over the 1M per-model entry in the file');
  // row 8: the same engine, changed live by a save, the way the host does it
  const ch = { sessionId: SR, cwd: proj, remoteControlState: { status: 'disconnected' }, query: {
    applyFlagSettings: (x) => e.req({ subtype: 'apply_flag_settings', settings: x }),
    getSettings: async () => (await e.req({ subtype: 'get_settings' })).response,
    getContextUsage: async () => (await e.req({ subtype: 'get_context_usage' })).response,
    supportedModels: async () => (await e.req({ subtype: 'initialize' })).response.models } };
  const own = { channels: new Map([['real', ch]]), async toggleRemoteControl() {} };
  H.SAHEB.add(own);
  globalThis.__crtl_kanal_taze(own, 'real', ch);
  let r = await s({ sath: 'sarasari', key: 'effortLevel', value: 'low', channel: 'real' });
  assert.ok(r.ok, r.matn);
  v = await e.look();
  assert.equal(v.effort, 'low', 'global low reaches the running chat, whose own value was max');
  assert.equal(v.ultracode, true, 'ultracode survives: the engine drops it unless it goes along');
  assert.equal(v.model, 'claude-fable-5-1', 'the model does not move');
  assert.equal(J(USER).modelSettings['claude-fable-5-1'].effortLevel, 'low', 'the running model joins the file');
  r = await s({ sath: 'poshe', key: 'model', value: 'sonnet', channel: 'real' });
  assert.ok(r.ok, r.matn);
  v = await e.look();
  assert.equal(v.model, 'claude-sonnet-5-5', 'project model reaches it');
  assert.equal(v.effort, 'low', 'and effort stays, though a model brings its own');
  r = await s({ sath: 'chat', key: 'ultracode', value: 'false', channel: 'real' });
  v = await e.look();
  assert.equal(v.ultracode, false, 'ultracode off, live');
  r = await s({ sath: 'sarasari', key: 'autoCompactWindow', value: '500000', channel: 'real' });
  assert.ok(r.ok && r.matn.includes('ریلود'), r.matn);
  v = await e.look();
  assert.equal(v.thr, 300000, 'the running engine ignores it, as the popup says');
  const f = await H.fehrestTanzim({ reqId: 1, sid: SR, channel: 'real' });
  assert.equal(f.alan.thr, 300000);
  assert.equal(f.alan.applied.effort, 'low', 'the tab reads the same');
  assert.ok(f.models.some((m) => m.value === 'sonnet'), 'and the real model list');
  H.SAHEB.clear();
  e.p.kill();
  // after a reload
  e = startEngine(bin, proj, launchArgs(launch(SR, proj)));
  await e.req({ subtype: 'initialize' });
  v = await e.look();
  assert.equal(v.thr, 500000, 'after a reload: the typed number');
  assert.equal(v.effort, 'low'); assert.equal(v.model, 'claude-sonnet-5-5');
  e.p.kill();
  // a terminal chat reads only the files: the global window is there with the per-model number gone, and the project model
  e = startEngine(bin, proj, ['--model', 'claude-fable-5-1']);
  await e.req({ subtype: 'initialize' });
  v = await e.look();
  assert.equal(v.effort, 'low', 'a terminal chat on that model sees the global effort from the file');
  assert.equal(v.thr, 500000, 'and the global window, 33K on the typed number');
  e.p.kill();
  fs.rmSync(STORE, { force: true });
}

const NODE_PATH = path.join(__dirname, 'node_modules');
async function panelInBrowser() {
  const { chromium } = require('playwright');
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  fs.writeFileSync(USER, JSON.stringify({ modelSettings: { 'claude-opus-5-5': { effortLevel: 'xhigh' } } }));
  fs.rmSync(STORE, { force: true });
  const cp = fakeChat(SID1, P1);
  const own = { channels: new Map([['chP', cp]]), toggles: [], async toggleRemoteControl() {}, chromeSettingFlipCount: 1,
    async ensureChromeMcpEnabled() { cp.chromeMcpState = { status: 'connected' }; }, async disableChromeMcp() { cp.chromeMcpState = { status: 'disconnected' }; } };
  cp.chromeMcpState = { status: 'disconnected' };
  fs.writeFileSync(path.join(home, '.claude.json'), JSON.stringify({ claudeInChromeDefaultEnabled: false, verbose: true, env: { RAZ: 'nabayad-bebini' } }));
  H.SAHEB.add(own);
  globalThis.__crtl_kanal_taze(own, 'chP', cp);
  const ctx = await b.newContext({ viewport: { width: 1200, height: 800 } });
  const pg = await ctx.newPage();
  await pg.exposeFunction('__hostMsg', async (m) => {
    if (m.type === 'crtl-tanzimat-list') return H.fehrestTanzim(m);
    if (m.type === 'crtl-tanzimat-sabt') { const r = await H.sabtTanzim(m); return { type: m.type, reqId: m.reqId, ok: r.ok, matn: r.matn }; }
    return null;
  });
  await pg.route('http://t.local/', (r) => r.fulfill({ contentType: 'text/html', body: `<!doctype html><html dir="rtl"><body style="margin:0;font:13px sans-serif;user-select:none">
    <div class="chatContainer_y" style="position:relative;height:700px"><div class="messagesContainer_x" style="height:300px">گفتگو</div>
    <div class="inputContainer_y" style="position:absolute;bottom:0;left:0;right:0;margin:0 auto;max-width:680px"><div class="inputContainer_z"><div class="messageInputContainer_x"><div aria-label="Message input" contenteditable="true" style="min-height:40px"></div></div></div></div></div></body></html>` }));
  await pg.goto('http://t.local/');
  await pg.evaluate((sid) => {
    window.acquireVsCodeApi = () => ({ postMessage: (m) => { window.__hostMsg(m).then((r) => { if (r) window.postMessage(r, '*'); }); }, getState: () => ({ sessionID: sid }), setState() {} });
  }, SID1);
  await pg.addScriptTag({ content: 'window.__CRTL_TANZIMAT_FA=' + JSON.stringify(J(FA)) + ';window.__CRTL_TANZIMAT_TOZIH=' + JSON.stringify(J(TOZIH)) + ';' + fs.readFileSync(UI, 'utf8') });
  await pg.evaluate(() => window.acquireVsCodeApi());
  await pg.waitForSelector('#crtl-panel', { state: 'attached' });
  // row 1: page one keeps its things, without the effort row; the tab is separate
  await pg.locator('.crtl-gear .crtl-btn', { hasText: 'aA' }).click();
  assert.equal(await pg.locator('#crtl-effort-row').count(), 0, 'the effort row left page one');
  assert.equal(await pg.locator('#crtl-page-font').isVisible(), true, 'page one shows first');
  assert.equal(await pg.locator('#crtl-page-claude').isVisible(), false);
  assert.ok(await pg.locator('#crtl-page-font').getByText('اسم چت').isVisible(), 'the chat names stay on page one');
  const pw = (await pg.locator('#crtl-panel').boundingBox()).width;
  await pg.getByRole('tab', { name: 'تنظیمات کلود' }).click();
  await pg.waitForSelector('.crtl-tz-row[data-k="effortLevel"]');
  assert.equal(await pg.locator('#crtl-page-font').isVisible(), false, 'the tab replaces page one');
  assert.ok((await pg.locator('#crtl-panel').boundingBox()).width > pw + 100, 'and is wider');
  // rows 2 and 3
  assert.equal(await pg.locator('.crtl-tz-row').count(), 174, 'every setting has a row');
  assert.deepEqual(await pg.$$eval('.crtl-tz-row', (r) => r.slice(0, 5).map((x) => x.dataset.k)), ['effortLevel', 'model', 'remoteControlAtStartup', 'ultracode', 'autoCompactWindow'], 'his five on top');
  assert.equal(await pg.locator('.crtl-tz-row[data-k="permissions"] textarea').count(), 1, 'a complex setting has a text box');
  assert.equal(await pg.locator('.crtl-tz-row[data-k="verbose"] select').count(), 1, 'on-off is a menu');
  assert.equal(await pg.locator('.crtl-tz-row[data-k="viewMode"] select option').count(), 4, 'a choice lists its choices, with a blank');
  // the first row's note reads the engine
  const row = (k) => pg.locator(`.crtl-tz-row[data-k="${k}"]`);
  await pg.waitForFunction(() => /medium/.test(document.querySelector('.crtl-tz-row[data-k="effortLevel"] .crtl-tz-note').textContent));
  assert.equal(await row('language').locator('.crtl-tz-note').textContent(), 'الان: persian از پروژه؛ یعنی مدل به زبان persian جواب می‌دهد', 'the note says what, from where, and what it means');
  assert.equal(await row('autoCompactWindow').locator('.crtl-tz-note').textContent(), 'الان: کامپکت سر ۲۶۷ هزار (پیش‌فرض کلود)؛ یعنی وقتی کانتکست به ۲۶۷ هزار توکن برسد چت خلاصه می‌شود', 'the compaction point from the engine');
  assert.ok(await row('model').locator('select option[value="sonnet"]').count() === 1, 'models from the engine');
  assert.equal(await row('model').locator('select option[value="default"]').count(), 0, 'no Default among them');
  assert.ok(await row('model').locator('select option[value="claude-opus-5-5"]').count() === 1, 'the full names in the file too');
  // no sideways scroll, nothing outside, at two widths
  const inside = () => pg.evaluate(() => {
    const p = document.getElementById('crtl-panel'), r = p.getBoundingClientRect();
    const out = [...p.querySelectorAll('.crtl-tz-kontrol,.crtl-tz-sabt,.crtl-tz-ticks label,.crtl-tz-fa,.crtl-tabs button')].filter((e) => { const q = e.getBoundingClientRect(); return q.width > 0 && (q.right > r.right + 1 || q.left < r.left - 1); }).map((e) => e.textContent.slice(0, 20));
    return { out, over: p.scrollWidth - p.clientWidth, w: Math.round(r.width), left: Math.round(r.left), right: Math.round(r.right), vw: innerWidth };
  });
  let m = await inside();
  assert.deepEqual(m.out, [], 'all inside at 1200px');
  assert.ok(m.over <= 1, 'no sideways scroll: ' + JSON.stringify(m));
  await pg.setViewportSize({ width: 420, height: 700 });
  m = await inside();
  assert.deepEqual(m.out, [], 'all inside at 420px');
  assert.ok(m.over <= 1, 'no sideways scroll on a narrow window: ' + JSON.stringify(m));
  assert.ok(m.left >= 0 && m.right <= m.vw, 'the panel stays on screen: ' + JSON.stringify(m));
  await pg.setViewportSize({ width: 1200, height: 800 });
  // the chat steps aside by the tab's width, not the old width
  const pad = await pg.evaluate(() => { const e = document.querySelector('.messagesContainer_x'), s = getComputedStyle(e); return Math.max(parseFloat(s.paddingLeft), parseFloat(s.paddingRight)); });
  assert.ok(pad >= 500, 'the conversation makes room: ' + pad);
  const kadr = await pg.evaluate(() => {
    const k = document.querySelector('[aria-label="Message input"]').getBoundingClientRect(), p = document.getElementById('crtl-panel').getBoundingClientRect();
    return { w: Math.round(k.width), clear: k.left >= p.right || k.right <= p.left };
  });
  assert.ok(kadr.w > 400, 'the typing box is not squeezed beside the wide tab: ' + JSON.stringify(kadr));
  assert.ok(kadr.clear, 'and the tab does not sit on it: ' + JSON.stringify(kadr));
  // row 4: nothing armed at the start, one tick only
  const sabt = row('effortLevel').locator('.crtl-tz-sabt');
  const tick = (k, s) => row(k).locator(`input[data-sath="${s}"]`);
  assert.equal(await sabt.isDisabled(), true, 'no tick, no ثبت');
  for (const s of ['sarasari', 'poshe', 'chat']) assert.equal(await tick('effortLevel', s).isChecked(), false, 'ticks start empty');
  await tick('effortLevel', 'poshe').click();
  assert.equal(await sabt.isDisabled(), false, 'a tick arms it');
  await tick('effortLevel', 'chat').click();
  assert.equal(await tick('effortLevel', 'poshe').isChecked(), false, 'only one lands');
  assert.equal(await tick('effortLevel', 'chat').isChecked(), true);
  await tick('effortLevel', 'chat').click();
  assert.equal(await tick('effortLevel', 'chat').isChecked(), false, 'a ticked box unticks');
  assert.equal(await sabt.isDisabled(), true);
  // row 5: the global tick asks first; no OK, no tick
  const popup = pg.locator('#crtl-panel .crtl-tz-popup');
  await tick('effortLevel', 'poshe').click();
  await tick('effortLevel', 'sarasari').click();
  assert.equal(await popup.count(), 1, 'the popup comes the moment it is ticked');
  assert.match(await popup.textContent(), /مطمئنی/);
  assert.equal(await tick('effortLevel', 'sarasari').isChecked(), false, 'not ticked before OK');
  assert.equal(await tick('effortLevel', 'poshe').isChecked(), true, 'the other tick waits');
  const box = await popup.boundingBox();
  assert.ok(box.width >= 1190 && box.height >= 790, 'the popup covers the window, the panel\'s scrolling does not cut it: ' + JSON.stringify(box));
  await popup.getByRole('button', { name: 'نه', exact: true }).click();
  assert.equal(await popup.count(), 0);
  assert.equal(await tick('effortLevel', 'sarasari').isChecked(), false, 'no: still not ticked');
  assert.equal(await pg.locator('#crtl-panel').evaluate((p) => p.classList.contains('crtl-open')), true, 'the panel stays open');
  await tick('effortLevel', 'sarasari').click();
  await popup.getByRole('button', { name: /مطمئنم/ }).click();
  assert.equal(await tick('effortLevel', 'sarasari').isChecked(), true, 'OK: it lands');
  assert.equal(await tick('effortLevel', 'poshe').isChecked(), false, 'and the other goes');
  assert.equal(await row('effortLevel').locator('select').inputValue(), 'xhigh', 'the box shows what that level holds now');
  await row('effortLevel').locator('select').selectOption('max');
  await sabt.click();
  await pg.waitForFunction(() => /ثبت شد/.test((document.querySelector('#crtl-panel .crtl-tz-popup') || {}).textContent || ''));
  assert.equal(J(STORE).sarasari.effortLevel.v, 'max', 'saved at the level ticked');
  assert.deepEqual(cp.calls.at(-1), { effortLevel: 'max' }, 'and live on the chat');
  assert.equal(await tick('effortLevel', 'sarasari').isChecked(), false, 'the tick clears after a save');
  assert.equal(await sabt.isDisabled(), true);
  await popup.getByRole('button', { name: 'باشه' }).click();
  await pg.waitForFunction(() => document.querySelector('.crtl-tz-row[data-k="effortLevel"] .crtl-tz-note').textContent === 'الان: max از سراسری؛ یعنی مدل بیشترین فکر را می‌کند و گران‌ترین است');
  // Esc: the popup first, the panel after
  await tick('effortLevel', 'sarasari').click();
  await pg.keyboard.press('Escape');
  assert.equal(await popup.count(), 0, 'Esc closes the popup');
  assert.equal(await pg.locator('#crtl-panel').evaluate((p) => p.classList.contains('crtl-open')), true, 'not the panel');
  // row 10: the number, its hint, its popup, its note
  const acInput = row('autoCompactWindow').locator('input[type=text]');
  await acInput.fill('300000');
  assert.equal(await row('autoCompactWindow').locator('.crtl-tz-hint').textContent(), 'کامپکت سر ۳۰۰ هزار و رممبر سر ۲۸۰ هزار');
  await tick('autoCompactWindow', 'poshe').click();
  assert.equal(await acInput.inputValue(), '300000', 'a tick does not throw away what was typed');
  await row('autoCompactWindow').locator('.crtl-tz-sabt').click();
  await pg.waitForFunction(() => /ریلود/.test((document.querySelector('#crtl-panel .crtl-tz-popup') || {}).textContent || ''));
  assert.equal(J(local(P1)).autoCompactWindow, 333000);
  await popup.getByRole('button', { name: 'باشه' }).click();
  await pg.waitForFunction(() => document.querySelector('.crtl-tz-row[data-k="autoCompactWindow"] .crtl-tz-note').textContent === 'الان: کامپکت سر ۲۶۷ هزار از پروژه؛ یعنی وقتی کانتکست به ۲۶۷ هزار توکن برسد چت خلاصه می‌شود · ثبت‌شده: ۳۰۰ هزار؛ بعد از ریلود');
  // a level's own value fills the box when its tick lands, typed back as the number he knows
  await tick('autoCompactWindow', 'poshe').click();
  assert.equal(await acInput.inputValue(), '300000', 'typed number, not the window');
  await tick('autoCompactWindow', 'poshe').click();
  // a refused value: the popup says why, the tick stays
  await row('permissions').locator('textarea').fill('{bad');
  await tick('permissions', 'chat').click();
  await row('permissions').locator('.crtl-tz-sabt').click();
  await pg.waitForFunction(() => /JSON/.test((document.querySelector('#crtl-panel .crtl-tz-popup') || {}).textContent || ''));
  assert.equal(await tick('permissions', 'chat').isChecked(), true, 'refused: the tick stays');
  assert.equal(await row('permissions').locator('.crtl-tz-sabt').isDisabled(), false);
  await popup.getByRole('button', { name: 'باشه' }).click();
  // a click inside the popup is not a click outside the panel
  await tick('verbose', 'sarasari').click();
  await popup.locator('.crtl-tz-box').click({ position: { x: 5, y: 5 } });
  assert.equal(await pg.locator('#crtl-panel').evaluate((p) => p.classList.contains('crtl-open')), true, 'the panel stays open');
  await popup.getByRole('button', { name: 'نه', exact: true }).click();
  // Habib, 5 Nov: a click on a setting explains it, with a simple example
  const ckRow = row('claudeInChromeDefaultEnabled');
  assert.equal(await pg.$$eval('.crtl-tz-row', (r) => r.filter((x) => !x.querySelector('.crtl-tz-tozih')).length), 0, 'every row has its explanation');
  assert.equal(await ckRow.locator('.crtl-tz-tozih').isVisible(), true, 'open from the start');
  assert.match(await ckRow.locator('.crtl-tz-tozih').textContent(), /مثال/);
  assert.match(await ckRow.locator('.crtl-tz-tozih').textContent(), /CDP/, 'it says the numbered Chromes are something else');
  assert.equal(await ckRow.locator('.crtl-tz-head').getAttribute('aria-expanded'), 'true');
  await ckRow.locator('.crtl-tz-fa').click();
  assert.equal(await ckRow.locator('.crtl-tz-tozih').isVisible(), false, 'a click closes it');
  assert.equal(await ckRow.locator('.crtl-tz-head').getAttribute('aria-expanded'), 'false');
  assert.equal(await ckRow.locator('input[type=checkbox]:checked').count(), 0, 'a click on the name ticks nothing');
  assert.equal(await ckRow.locator('.crtl-tz-note').isVisible(), true, 'the value stays when the explanation closes');
  await ckRow.locator('.crtl-tz-head').click();
  assert.equal(await ckRow.locator('.crtl-tz-tozih').isVisible(), true, 'a second click opens it');
  await ckRow.locator('.crtl-tz-head').focus();
  await pg.keyboard.press('Enter');
  assert.equal(await ckRow.locator('.crtl-tz-tozih').isVisible(), false, 'the keyboard closes it too');
  await pg.keyboard.press('Enter');
  // Habib, 5 Nov: under each row the real value and what it means, never a bare dash
  assert.equal(await row('verbose').locator('.crtl-tz-note').textContent(), 'الان: روشن از ‎~/.claude.json؛ یعنی خروجی ابزارها کامل نشان داده می‌شود', 'a value in the engine\'s other file is not the default');
  assert.match(await row('env').locator('.crtl-tz-note').textContent(), /RAZ2/, 'the variable\'s name shows');
  assert.ok(!/nabayad-bebini/.test(await row('env').locator('.crtl-tz-note').textContent()), 'a variable\'s value never shows');
  assert.deepEqual((await H.fehrestTanzim({ sid: SID1 })).jahani, { verbose: true }, 'only settings, and never the file\'s variables');
  assert.equal(await row('cleanupPeriodDays').locator('.crtl-tz-note').textContent(), 'الان: 30 (پیش‌فرض کلود)؛ یعنی فایل هر چت 30 روز می‌ماند و بعد خودکار پاک می‌شود', 'the default the app states');
  assert.equal(await row('policyHelper').locator('.crtl-tz-note').textContent(), 'الان: خالی؛ یعنی هیچ برنامه‌ای برای ساختن تنظیمات سازمان اجرا نمی‌شود', 'no default: empty and its meaning');
  assert.equal(await row('respectGitignore').locator('.crtl-tz-note').textContent(), 'الان: روشن (پیش‌فرض کلود)؛ یعنی فایل‌های داخل .gitignore در پیشنهاد @ نمی‌آیند');
  assert.equal(await pg.$$eval('.crtl-tz-note', (n) => n.filter((x) => /—/.test(x.textContent) || x.textContent.trim() === '').length), 0, 'no row shows a bare dash or nothing');
  // the browser row: three levels, the real switch, this chat's connection
  assert.equal(await ckRow.locator('input[type=checkbox]').count(), 3, 'global, project, chat');
  assert.equal(await ckRow.locator('.crtl-tz-note').textContent(), 'الان: سراسری خاموش · این چت وصل نیست؛ یعنی مرورگر فقط با @browser یا کلید همین چت وصل می‌شود');
  await tick('claudeInChromeDefaultEnabled', 'sarasari').click();
  assert.match(await popup.textContent(), /کروم‌های شماره‌دار/, 'the popup says the numbered Chromes stay');
  await popup.getByRole('button', { name: /مطمئنم/ }).click();
  assert.equal(await ckRow.locator('select').inputValue(), 'false', 'the box shows the real switch');
  await tick('claudeInChromeDefaultEnabled', 'chat').click();
  await ckRow.locator('select').selectOption('true');
  await ckRow.locator('.crtl-tz-sabt').click();
  await pg.waitForFunction(() => /ثبت شد/.test((document.querySelector('#crtl-panel .crtl-tz-popup') || {}).textContent || ''));
  assert.equal(J(STORE).chat[SID1].claudeInChromeDefaultEnabled.v, true, 'saved for this chat');
  await popup.getByRole('button', { name: 'باشه' }).click();
  await pg.waitForFunction(() => /این چت وصل است · آخرین ثبت: روشن از چت/.test(document.querySelector('.crtl-tz-row[data-k="claudeInChromeDefaultEnabled"] .crtl-tz-note').textContent));
  assert.equal(await ckRow.locator('.crtl-tz-note').textContent(), 'الان: سراسری خاموش · این چت وصل است · آخرین ثبت: روشن از چت؛ یعنی مرورگر فقط با @browser یا کلید همین چت وصل می‌شود', 'the switch stays off, this chat is on');
  // search
  const search = pg.locator('.crtl-tz-search');
  for (const w of ['browser', 'برازر', 'مرورگر', 'chrome']) {
    await search.fill(w);
    assert.ok((await pg.$$eval('.crtl-tz-row', (r) => r.filter((x) => x.offsetParent).map((x) => x.dataset.k))).includes('claudeInChromeDefaultEnabled'), 'found by ' + w);
  }
  await search.fill('ریموت');
  const seen = await pg.$$eval('.crtl-tz-row', (r) => r.filter((x) => x.offsetParent).map((x) => x.dataset.k));
  assert.ok(seen.includes('remoteControlAtStartup') && seen.includes('disableRemoteControl') && seen.length < 8, 'Persian search: ' + seen);
  await search.fill('autocompact');
  const seen2 = await pg.$$eval('.crtl-tz-row', (r) => r.filter((x) => x.offsetParent).map((x) => x.dataset.k));
  assert.ok(seen2.includes('autoCompactWindow') && seen2.includes('autoCompactEnabled'), 'English search: ' + seen2);
  await search.fill('');
  assert.equal(await pg.$$eval('.crtl-tz-row', (r) => r.filter((x) => x.offsetParent).length), 174);
  // another save reaches the open tab, and the extension's own labels re-read
  await pg.evaluate(() => { window.__crtl_sessions = new Set([{ claudeChannelId: 'chP', n: 0, rereadAppliedSettings() { this.n++; } }, { claudeChannelId: 'other', n: 0, rereadAppliedSettings() { this.n++; } }]); });
  await pg.evaluate(() => window.postMessage({ type: 'crtl-tanzimat-taze', channelId: 'chP' }, '*'));
  await pg.waitForFunction(() => { const s = [...window.__crtl_sessions]; return s[0].n === 1; });
  assert.equal(await pg.evaluate(() => [...window.__crtl_sessions][1].n), 0, 'only the session of that channel');
  // the tab survives a rebuild of the panel; page one's buttons still work
  await pg.getByRole('tab', { name: 'فونت' }).click();
  assert.equal(await pg.locator('#crtl-page-font').isVisible(), true);
  await pg.locator('#crtl-page-font').getByRole('button', { name: 'فشرده' }).click();
  assert.equal(await pg.locator('#crtl-page-font').isVisible(), true, 'a rebuild keeps page one showing');
  await pg.getByRole('tab', { name: 'تنظیمات کلود' }).click();
  await pg.waitForFunction(() => document.querySelectorAll('.crtl-tz-row').length === 174);
  await b.close();
  H.SAHEB.clear();
}

async function questionWindow() {
  const { chromium } = require('playwright');
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  const T1 = 'کارایی که میکنی باید با هماهنگی باشه', T2 = '/compact';
  const dokme = { nosakhe: 2, commands: [{ label: 'b1', text: T1, side: 'top', send: false }, { label: 'b2', text: T2, side: 'top', send: true }] };
  const open = async (multi) => {
    const pg = await (await b.newContext({ viewport: { width: 1000, height: 700 } })).newPage();
    await pg.route('http://t.local/', (r) => r.fulfill({ contentType: 'text/html', body: `<!doctype html><html dir="rtl"><body style="margin:0;font:14px sans-serif;user-select:none">
      <div class="header_aqhumA" style="display:flex"><div class="titleGroup_aqhumA"><button class="titleText_aqhumA">چت</button></div><div class="headerSpacer_aqhumA" style="flex:1"></div></div>
      <div id="root"></div>
      <div aria-label="Message input" contenteditable="true" style="min-height:40px;border:1px solid #888"></div></body></html>` }));
    await pg.goto('http://t.local/');
    await pg.addScriptTag({ path: path.join(NODE_PATH, 'react/umd/react.production.min.js') });
    await pg.addScriptTag({ path: path.join(NODE_PATH, 'react-dom/umd/react-dom.production.min.js') });
    // a copy of the bundle's own _se and eW, 2.1.318 (option: onClick on the whole row; the box: plaintext-only, writes textContent back)
    await pg.addScriptTag({ content: `(function(){var e=React.createElement,M=${!!multi};
      var Box=React.forwardRef(function(p,ref){var l=ref||React.useRef(null);
        React.useEffect(function(){if(l.current&&(l.current.textContent||'')!==p.value)l.current.textContent=p.value},[p.value]);
        return e('div',{className:'wrapper_q'},e('div',{ref:l,className:'input_q',contentEditable:'plaintext-only',role:'textbox',suppressContentEditableWarning:true,style:{whiteSpace:'pre-wrap',minHeight:'30px'},onInput:function(){p.onChange(l.current.textContent||'')},onKeyDown:function(z){if(!z.metaKey&&!z.ctrlKey)z.stopPropagation()}}))});
      function Opt(p){return e('div',{className:'option_h',tabIndex:0,role:M?'checkbox':'radio','aria-checked':p.selected,onClick:p.onSelect,onKeyDown:function(f){if(f.key==='Enter'||f.key===' '){f.preventDefault();p.onSelect()}}},
        e('div',{className:'optionCheckbox_h',style:{width:'16px',height:'16px',border:'1px solid #888',display:'inline-block'}}),
        e('div',{className:'optionContent_h'},e('div',{className:'optionLabel_h'},p.label),p.desc&&e('div',{className:'optionDescription_h'},p.desc),p.children))}
      function Q(){var S=React.useState([]),a=S[0],setA=S[1],O=React.useState(''),o=O[0],setO=O[1],d=React.useRef(null),clicks=React.useRef(0),FF=React.useState(false),fold=FF[0],setFold=FF[1];
        window.__q=function(){return{ans:a,other:o}};
        function R(l){setA(function(pr){if(M)return pr.indexOf(l)>=0?pr.filter(function(x){return x!==l}):pr.concat(l);return[l]});if(l==='Other')setTimeout(function(){d.current&&d.current.focus()},0)}
        function has(l){return a.indexOf(l)>=0}
        return e('div',{className:'permissionRequestContainer_q',tabIndex:0,onFocus:function(ke){if(ke.target===ke.currentTarget){ke.currentTarget.blur();var fo=ke.currentTarget.querySelector('[role=radio],[role=checkbox]');if(fo)fo.focus()}}},e('div',{className:'withPreview_h'},e('button',{className:'navTab_h navTabActive_h',onClick:function(){if(fold)setFold(false)}},'سربرگ'),e('button',{id:'tafold',onClick:function(){setFold(!fold)}},'جمع'),e('div',{className:'questionsContainer_h'+(fold?' questionsContainerFolded_h':''),style:fold?{display:'none'}:null},e('div',{className:'questionBlock_h'},e('div',{className:'questionText_h'},'سوال این پنجره چیست و چرا باید کپی شود'),
          e('div',{className:'optionsContainer_h'},['بله','خیر'].map(function(l){return e(Opt,{key:l,label:l+' گزینهٔ بلند برای انتخاب متن',desc:'توضیح '+l+' که می‌شود کپی‌اش کرد',selected:has(l),onSelect:function(){R(l)}})}),
            e(Opt,{label:'Other',selected:has('Other'),onSelect:function(){R('Other')}},has('Other')&&e('div',{onClick:function(z){z.stopPropagation()}},e(Box,{ref:d,value:o,onChange:setO})))))),
          e('div',{className:'previewPane_h',role:'region',tabIndex:-1},e('table',null,e('tbody',null,e('tr',null,e('td',{id:'cell'},'خانهٔ جدول پیش‌نمایش که باید کپی شود')))))))}
      ReactDOM.createRoot(document.getElementById('root')).render(e(Q));})()` });
    await pg.addScriptTag({ content: 'window.__CRTL_DOKME=' + JSON.stringify(dokme) + ';' + fs.readFileSync(UI, 'utf8') });
    await pg.waitForSelector('#crtl-panel', { state: 'attached' });
    await pg.waitForSelector('.crtl-top .crtl-btn');
    return pg;
  };
  const q = (pg) => pg.evaluate(() => window.__q());
  const drag = async (pg, loc) => {
    const r = await loc.boundingBox();
    await pg.mouse.move(r.x + r.width - 3, r.y + r.height / 2);
    await pg.mouse.down();
    await pg.mouse.move(r.x + r.width / 2, r.y + r.height / 2, { steps: 4 });
    await pg.mouse.move(r.x + 3, r.y + r.height / 2, { steps: 4 });
    await pg.mouse.up();
  };
  const selText = (pg) => pg.evaluate(() => String(window.getSelection()));
  // ---- one answer at a time
  let pg = await open(false);
  const label = (i) => pg.locator('[class*="optionLabel_"]').nth(i), desc = (i) => pg.locator('[class*="optionDescription_"]').nth(i);
  for (const sel of ['[class*="questionText_"]', '[class*="optionLabel_"]', '[class*="optionDescription_"]', '#cell']) {
    assert.equal(await pg.locator(sel).first().evaluate((e) => getComputedStyle(e).userSelect), 'text', sel + ' can be selected inside an unselectable app');
  }
  // the question, an answer's words, the table: selected, and nothing picked
  await drag(pg, pg.locator('[class*="questionText_"]'));
  assert.ok((await selText(pg)).length > 5, 'the question\'s words select, though the window moves its own focus on');
  await drag(pg, desc(0));
  assert.ok((await selText(pg)).length > 5, 'an answer\'s words select');
  await sleep(600);
  assert.deepEqual((await q(pg)).ans, [], 'selecting the words does not pick the answer');
  await drag(pg, label(1));
  assert.ok((await selText(pg)).length > 5);
  await sleep(600);
  assert.deepEqual((await q(pg)).ans, [], 'nor on the label');
  await drag(pg, pg.locator('#cell'));
  assert.ok((await selText(pg)).length > 5, 'the table\'s words select');
  // a plain click still picks: it only waits a moment for a possible second click
  await label(0).click();
  await pg.waitForFunction(() => window.__q().ans.length === 1, null, { timeout: 5000 }).catch(() => assert.fail('a plain click on the words picks'));
  assert.match((await q(pg)).ans[0], /^بله/);
  // a double click selects a word and picks nothing
  { const r = await desc(1).boundingBox(); await pg.mouse.dblclick(r.x + r.width - 20, r.y + r.height / 2); }   // the words sit at the right edge
  assert.ok((await selText(pg)).trim().length > 0, 'a double click selects a word');
  await sleep(600);
  assert.match((await q(pg)).ans[0], /^بله/, 'and the answer did not change');
  // the circle answers at once
  await pg.locator('[class*="optionCheckbox_"]').nth(1).click();
  assert.equal(await pg.evaluate(() => new Promise((ok) => { const t0 = performance.now(); (function w() { if (/^خیر/.test(window.__q().ans[0])) return ok(true); if (performance.now() - t0 > 120) return ok(false); setTimeout(w, 5); })(); })), true, 'the circle picks at once, without the wait a click on the words has');
  // keyboard stays
  await pg.locator('[role="radio"]').nth(0).focus();
  await pg.keyboard.press('Enter');
  await pg.waitForFunction(() => /^بله/.test(window.__q().ans[0]), null, { timeout: 3000 }).catch(() => assert.fail('Enter on an option picks'));
  // ---- a top button: Other ticks itself and the text goes in its box, not the typing box
  await pg.locator('.crtl-top .crtl-btn', { hasText: 'b1' }).click();
  await pg.waitForFunction((t) => window.__q().other === t, T1);
  assert.deepEqual((await q(pg)).ans, ['Other'], 'Other ticked');
  assert.equal(await pg.locator('[role="radio"]').last().getAttribute('aria-checked'), 'true');
  assert.equal(await pg.locator('[aria-label="Message input"]').textContent(), '', 'the typing box stays empty');
  // what he wrote stays; the next text comes after it on its own line
  const box = pg.locator('[class*="optionsContainer_"] [contenteditable]');
  await box.focus();
  await pg.keyboard.press('End');
  await pg.keyboard.type(' سلام');
  await pg.waitForFunction((t) => window.__q().other === t + ' سلام', T1);
  await pg.locator('.crtl-top .crtl-btn', { hasText: 'b1' }).click();
  await pg.waitForFunction((t) => window.__q().other === t + ' سلام\n' + t, T1);
  assert.deepEqual((await q(pg)).ans, ['Other'], 'still ticked');
  // a sending button sends nothing from here: the question is still open and the text is in the box
  await pg.locator('.crtl-top .crtl-btn', { hasText: 'b2' }).click();
  await pg.waitForFunction((t) => window.__q().other.endsWith('\n' + t), T2);
  assert.equal(await pg.locator('[class*="questionsContainer_"]').count(), 1);
  // words in the box can still be selected and the box typed in, the guard leaves it alone
  await box.click();
  await pg.keyboard.type('X');
  await pg.waitForFunction(() => window.__q().other.includes('X'));
  assert.deepEqual((await q(pg)).ans, ['Other'], 'a click in the box does not untick');
  await pg.context().close();
  // ---- several answers: an already ticked Other stays ticked, others stay too
  pg = await open(true);
  await pg.locator('[role="checkbox"]').nth(0).locator('[class*="optionCheckbox_"]').click();
  await pg.locator('.crtl-top .crtl-btn', { hasText: 'b1' }).click();
  await pg.waitForFunction((t) => window.__q().other === t, T1);
  await pg.locator('.crtl-top .crtl-btn', { hasText: 'b1' }).click();
  await pg.waitForFunction((t) => window.__q().other === t + '\n' + t, T1);
  const st = await q(pg);
  assert.ok(st.ans.includes('Other') && st.ans.length === 2, 'Other stays ticked beside the other answer: ' + JSON.stringify(st.ans));
  // here a click would untick: a click in the box must never reach the row
  await pg.locator('[class*="optionsContainer_"] [contenteditable]').click();
  await sleep(600);
  assert.ok((await q(pg)).ans.includes('Other'), 'a click in the box leaves Other ticked');
  await pg.context().close();
  // ---- a folded window (the app's display:none): it opens, and the text lands where he can see it
  pg = await open(false);
  await pg.locator('#tafold').click();
  assert.equal(await pg.locator('[class*="optionsContainer_"]').isVisible(), false, 'folded');
  await pg.locator('.crtl-top .crtl-btn', { hasText: 'b1' }).click();
  await pg.waitForFunction((t) => window.__q().other === t, T1);
  assert.equal(await pg.locator('[class*="optionsContainer_"] [contenteditable]').isVisible(), true, 'the window opened and the box is seen');
  assert.equal(await pg.locator('[aria-label="Message input"]').textContent(), '', 'the typing box stays empty');
  await pg.context().close();
  // ---- with no question open the button writes in the typing box, as always
  pg = await open(false);
  await pg.evaluate(() => document.querySelector('[class*="questionsContainer_"]').remove());
  await pg.locator('.crtl-top .crtl-btn', { hasText: 'b1' }).click();
  await pg.waitForFunction((t) => document.querySelector('[aria-label="Message input"]').textContent === t, T1);
  await pg.context().close();
  await b.close();
}
