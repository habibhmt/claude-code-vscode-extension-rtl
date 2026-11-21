// Host-side folder scope for the new ChatGPT/Codex bundle (26.1111.21308).
// The old test ran the webview React code; this build bundles it, so this test
// executes the patched requestThreadList itself and checks the real thread/list
// params. Run: node test_chatgpt_folder_query_new.cjs [out/extension.js]
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

function latestExtension() {
  const base = path.join(process.env.HOME, '.vscode/extensions');
  let dirs = [];
  try { dirs = fs.readdirSync(base).filter((n) => n.startsWith('openai.chatgpt-')).sort(); } catch {}
  return dirs.length ? path.join(base, dirs[dirs.length - 1]) : null;
}
const picked = process.argv[2] || process.env.CODEX_TEST_EXTENSION || latestExtension();
if (!picked) {
  console.log('SKIP: no openai.chatgpt extension in ~/.vscode/extensions');
  process.exit(77);
}
const target = picked;
const file = target.endsWith('.js') ? target : path.join(target, 'out/extension.js');
const source = fs.readFileSync(file, 'utf8');

assert.equal((source.match(/cwd:crtlCwd\(\)/g) || []).length, 2, 'both thread/list calls carry cwd');
assert.equal((source.match(/function crtlCwd\(\)/g) || []).length, 1, 'one workspace-root helper');
assert.match(source, /function crtlCwd\(\)\{try\{let w=require\("vscode"\)\.workspace\.workspaceFolders;return w&&w\.length\?w\.map\(f=>f\.uri\.fsPath\):void 0\}catch\(e\)\{return void 0\}\}/, 'helper reads workspaceFolders');

const start = source.indexOf('A9=class{');
assert.ok(start >= 0, 'A9 provider class not found');
const end = source.indexOf(';function _He', start);
assert.ok(end > start, 'A9 class end not found');
const cls = source.slice(start, end).replace(/^A9=/, '');
const helperText = 'function crtlCwd(){try{let w=require("vscode").workspace.workspaceFolders;return w&&w.length?w.map(f=>f.uri.fsPath):void 0}catch(e){return void 0}}';
const make = new Function('bHe', 'YI', 'ug', '_He', 'vHe', 'x9', 'SHe', 'crtlCwd', 'return (' + cls + ');');

function paramsFor(roots) {
  const fakeRequire = () => ({ workspace: { workspaceFolders: roots } });
  const crtlCwd = new Function('require', helperText + ';return crtlCwd;')(fakeRequire);
  const Provider = make('thread/list', 'copilot', [], (x) => String(x), (x) => x, '', 80, crtlCwd);
  let cb = null;
  const fake = { params: null,
    registerProvider(_m, fn) { cb = fn; },
    sendRequest(_m, id, _ch, params) { this.params = params; cb.onResult({ id, result: { data: [] } }); } };
  const inst = new Provider(fake);
  return inst.requestThreadList(false).then(() => fake.params);
}

(async () => {
  const roots = [{ uri: { fsPath: '/work/project' } }, { uri: { fsPath: '/work/other' } }];
  const withRoots = await paramsFor(roots);
  assert.deepEqual(withRoots.cwd, ['/work/project', '/work/other'], 'thread/list gets the workspace roots');
  assert.equal(withRoots.limit, 50, 'the rest of the request is untouched');
  const without = await paramsFor(undefined);
  assert.equal(without.cwd, undefined, 'no workspace → no cwd');
  console.log(JSON.stringify({ file, cwd: withRoots.cwd, noWorkspace: without.cwd === undefined }));
  console.log('PASS');
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
