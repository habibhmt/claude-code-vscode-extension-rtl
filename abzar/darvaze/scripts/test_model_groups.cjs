// Two promises, both about a reload: the picker keeps providers apart, and the
// model an open chat already uses cannot move to another row.
// ۲۶ نوامبر ۲۰۲۶: دو حالت دارد — «فهرست از دروازه» (merged-models.json هست) و
// «کاتالوگِ قدیمی» (در کلونِ تازه). ادعاهای مخصوصِ هر حالت جدا سنجیده می‌شوند؛
// چیزهای مشترک (بلوک‌بندی، schema، رندر) در هر دو حالت.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const { modelChoices } = require('./vscode_model_catalog.cjs');
const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, '../claude-api/deepseek-models.json'), 'utf8'));
const gatewayFile = path.join(__dirname, '../.runtime/opencode-go/merged-models.json');
const capsFile = path.join(__dirname, '../claude-api/model-caps-picker.json');
const gatewayActive = fs.existsSync(gatewayFile);

const extDir = path.join(os.homedir(), '.vscode/extensions');
const registered = JSON.parse(fs.readFileSync(path.join(extDir, 'extensions.json'), 'utf8'));
const active = registered.find(e => e.identifier.id === 'anthropic.claude-code');
const bundle = fs.readFileSync(path.join(extDir, active.relativeLocation, 'webview/index.js'), 'utf8');

/* ---------- what the picker gets ---------- */

const choices = modelChoices();

// A reload must rebuild exactly the same list. Two calls stand in for it.
assert.deepEqual(modelChoices(), choices, 'modelChoices must be deterministic');

// Contiguous blocks: a provider or a family that reappears later would let the
// family fallback resolve to a different row than the one the chat was using.
const seenGroups = new Set();
let lastGroup = null;
const seenFamilies = new Set();
let lastFamily = null;
for (const m of choices) {
  assert.ok(m.group && m.family && m.familyLabel, 'every row needs group, family and familyLabel');
  assert.notEqual(m.group, m.familyLabel, 'provider header and family header repeat the same word: ' + m.group);
  if (m.group !== lastGroup) {
    assert.ok(!seenGroups.has(m.group), 'group appears in two separate blocks: ' + m.group);
    seenGroups.add(m.group);
    lastGroup = m.group;
    lastFamily = null;
  }
  const family = m.group + '/' + m.family;
  if (family !== lastFamily) {
    assert.ok(!seenFamilies.has(family), 'family appears in two separate blocks: ' + family);
    seenFamilies.add(family);
    lastFamily = family;
  }
}

if (gatewayActive) {
  /* ---------- gateway mode: one block per provider, evidence-only effort ---------- */

  const merged = JSON.parse(fs.readFileSync(gatewayFile, 'utf8'));
  const caps = JSON.parse(fs.readFileSync(capsFile, 'utf8'));
  assert.deepEqual(choices.map(m => m.value).sort(), merged.map(m => m.id).sort(),
    'the picker must carry every gateway model exactly once');

  assert.deepEqual([...seenGroups], ['OpenCode Go', 'OpenRouter'], 'provider blocks are out of order');
  for (const m of choices) {
    const label = m.group === 'OpenCode Go' ? 'OpenCode Go' : 'OpenRouter';
    assert.ok(m.displayName.endsWith('· ' + label), 'provider label missing on the row: ' + m.displayName);
  }

  // Effort comes only from the evidence map (حبیب ۲۶ نوامبر: «الف»).
  const allowed = ['low', 'medium', 'high', 'xhigh', 'max'];
  const withCaps = choices.filter(m => m.supportsEffort === true);
  assert.equal(withCaps.length, Object.keys(caps.rows).length, 'the number of effort rows changed');
  // Pinned by name, not just counted: a map and a picker that lose the same row
  // together would agree on the total and still take the slider away.
  const byValue = new Map(choices.map(m => [m.value, m]));
  const pinned = {
    'aion-labs/aion-3.5': ['low', 'high', 'max'],
    'deepseek-v4.1-flash': ['low', 'medium', 'high', 'max'],
    'openai/gpt-5.2': ['low', 'medium', 'high', 'xhigh'],
  };
  for (const [value, levels] of Object.entries(pinned)) {
    const row = byValue.get(value);
    assert.ok(row, 'a pinned model disappeared from the picker: ' + value);
    assert.deepEqual(row.supportedEffortLevels, levels, 'effort levels changed for ' + value);
  }
  // …and the other direction: a model whose vendor publishes no reasoning
  // levels must stay without a slider, not inherit one from its neighbours.
  for (const value of ['beam-free', 'glm-5.3']) {
    const row = byValue.get(value);
    if (!row) continue;
    assert.ok(!row.supportsEffort, 'a model without published levels got an effort slider: ' + value);
  }
  for (const m of choices) {
    const evidence = caps.rows[m.value];
    if (!evidence) {
      assert.ok(!m.supportsEffort, 'a model without evidence got an effort slider: ' + m.value);
      continue;
    }
    assert.equal(m.supportsEffort, true, 'an evidenced model lost its effort slider: ' + m.value);
    assert.ok(Array.isArray(m.supportedEffortLevels) && m.supportedEffortLevels.length > 0,
      'effort row without levels: ' + m.value);
    for (const level of m.supportedEffortLevels) {
      assert.ok(allowed.includes(level), 'unknown effort level ' + level);
    }
  }
  console.log('gateway mode: ' + choices.length + ' rows, ' + withCaps.length + ' with evidence-backed effort');
} else {
  /* ---------- catalogue mode (fresh clone, no gateway file) ---------- */

  // The value an open chat saved has to survive: the picker resolves it by exact
  // value first, and only falls back to the family when that fails.
  const expected = catalog.flatMap(row => row.openRouterModel ? [row.openRouterModel, 'anthropic-api/' + row.value] : [row.value]);
  assert.equal(choices.length, expected.length, 'row count changed');
  assert.deepEqual([...choices.map(m => m.value)].sort(), [...expected].sort(), 'a saved model value disappeared');
  assert.deepEqual([...seenGroups], ['OpenRouter · DeepSeek', 'OpenRouter · Anthropic', 'Anthropic Console'],
    'provider blocks are out of order');

  /* ---------- the provider filter ---------- */

  const none = { providers: [], hiddenFamilies: [] };
  const noUsed = new Set();

  // Hiding a family is the whole point of the Aa tab, so it has to actually hide.
  const hidden = modelChoices(catalog, { filter: { ...none, hiddenFamilies: ['deepseek-v3.2'] }, used: noUsed });
  assert.ok(!hidden.some(m => m.family === 'deepseek-v3.2'), 'a hidden family still appears');
  assert.equal(hidden.length, choices.length - choices.filter(m => m.family === 'deepseek-v3.2').length);

  // …except for a model a chat has already run on. Dropping that row would leave
  // an open chat pointing at something its picker can no longer draw.
  const running = choices.find(m => m.family === 'deepseek-v3.2').value;
  const protectedRun = modelChoices(catalog, {
    filter: { ...none, hiddenFamilies: ['deepseek-v3.2'] }, used: new Set([running]),
  });
  assert.deepEqual(protectedRun.filter(m => m.family === 'deepseek-v3.2').map(m => m.value), [running],
    'hiding a family removed the model an open chat is using');

  // Turning a provider on appends its block after the curated ones, still contiguous.
  const withOpenAi = modelChoices(catalog, { filter: { ...none, providers: ['openai'] }, used: noUsed });
  const added = withOpenAi.filter(m => m.group === 'OpenRouter · openai');
  assert.ok(added.length > 20, 'enabling openai added nothing');
  assert.equal(withOpenAi.slice(-added.length).every(m => m.group === 'OpenRouter · openai'), true,
    'the extra provider block is not contiguous at the end');
  assert.equal(new Set(withOpenAi.map(m => m.value)).size, withOpenAi.length, 'duplicate model after filtering');
  assert.deepEqual(modelChoices(catalog, { filter: { ...none, providers: ['openai'] }, used: noUsed }), withOpenAi,
    'a filtered list must be deterministic too');
}

/* ---------- a chat's used model is remembered in two files ---------- */

// Two config files, because the VS Code session and the terminal disagree about
// where a chat's model is remembered. Missing one leaves half the chats unprotected.
const { usedModels } = require('./vscode_model_catalog.cjs');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'used-'));
try {
  const first = path.join(scratch, 'a.json');
  const second = path.join(scratch, 'b.json');
  fs.writeFileSync(first, JSON.stringify({ clientDataCacheSlots: { one: { model: 'deepseek/a' } } }));
  fs.writeFileSync(second, JSON.stringify({ clientDataCacheSlots: { two: { model: 'claude-opus-5-5' } } }));
  assert.deepEqual([...usedModels([first, second])].sort(), ['claude-opus-5-5', 'deepseek/a']);
  assert.deepEqual([...usedModels([first])], ['deepseek/a']);
  assert.deepEqual([...usedModels([path.join(scratch, 'missing.json')])], [], 'a missing file must not throw');
} finally {
  fs.rmSync(scratch, { recursive: true, force: true });
}

// A filter file that cannot be read must never take the picker down.
const fsRead = require('node:fs');
const realRead = fsRead.readFileSync;
fsRead.readFileSync = (file, ...rest) => {
  if (String(file).endsWith('model-filter.json')) throw Error('unreadable');
  return realRead(file, ...rest);
};
try {
  assert.deepEqual(require('./vscode_model_catalog.cjs').readFilter(), { providers: [], hiddenFamilies: [] });
} finally {
  fsRead.readFileSync = realRead;
}

/* ---------- the config schema ---------- */

// zod drops keys it does not declare, so without this the headers would appear
// only in a fresh window and vanish the moment the cached config is read back.
const extension = fs.readFileSync(path.join(extDir, active.relativeLocation, 'extension.js'), 'utf8');
// The minified schema names its validators `$e()`, `H()`, `Ct()` — `\w` alone
// misses the `$`, and a regex that never matches would "pass" only by failing.
assert.match(extension, /disabled:[\w$]+\(\)\.optional\(\),group:[\w$]+\(\)\.optional\(\),family:[\w$]+\(\)\.optional\(\),familyLabel:[\w$]+\(\)\.optional\(\)\}/,
  'the config schema drops group/family/familyLabel: run fix-rtl-claude.sh');
assert.match(extension, /supportsEffort:[\w$]+\(\)\.optional\(\)/,
  'the config schema drops supportsEffort: the slider cannot survive a cached read');
assert.match(extension, /supportedEffortLevels:[^(]*\(([\w$]+)\(\["low","medium","high","xhigh","max"\]\)\)/,
  'the config schema drops the effort levels: max would be stripped from a cached read');

/* ---------- the patched renderer ---------- */

// The bundle is minified anew on every extension update, so nothing here is
// matched by variable name: the row callback is located by the marker the patch
// itself writes (`__ccg1`), and whatever it closes over is handed to it.
assert.ok(bundle.includes('/* project216-model-groups */') || bundle.includes('__ccg1'),
  'patched picker render is missing from the installed webview: run fix-rtl-claude.sh');

const marker = bundle.indexOf('__ccg1');
assert.ok(marker > 0, 'the header patch is not in the installed webview: run fix-rtl-claude.sh');
const before = bundle.lastIndexOf('.map(', marker);
assert.ok(before > 0, 'could not find the model list map in the picker render');
const listVar = /([\w$]+)$/.exec(bundle.slice(0, before))[1];

function balanced(text, openIndex) {
  let depth = 0;
  for (let i = openIndex; i < text.length; i++) {
    if (text[i] === '(') depth += 1;
    else if (text[i] === ')') {
      depth -= 1;
      if (depth === 0) return text.slice(openIndex, i + 1);
    }
  }
  throw Error('unbalanced model picker render');
}

const rowCallback = balanced(bundle, before + '.map'.length);
const declared = /^\(([^)]*)\)\s*=>/.exec(rowCallback);
assert.ok(declared, 'the model row callback does not start with a parameter list');
const declaredNames = declared[1].split(',').map(x => x.trim()).filter(Boolean);

const KEYWORDS = new Set(['if', 'else', 'return', 'const', 'let', 'var', 'true', 'false', 'null', 'undefined',
  'void', 'typeof', 'new', 'function', 'of', 'in', 'this', 'number', 'string']);
const freeNames = [...new Set([...rowCallback.matchAll(/(?<![.\w$'])([A-Za-z_$][\w$]*)(?![\w$]*\s*:)/g)].map(x => x[1]))]
  .filter(n => !declaredNames.includes(n) && !KEYWORDS.has(n) && !/^\d/.test(n))
  .filter(n => n !== 'className');  // only after a dot, guarded above; belt and braces

function draw(models) {
  const nodes = [];
  const make = (type, props) => { nodes.push({ type, props: props || {} }); return null; };
  const state = {
    u: make, g: make, jsx: make, jsxs: make, z3e: 'ROW',
    [listVar]: models,
    mo: { sectionHeader: 'SH' },
    Q: new Set(), p: null, r: null, M: { current: null },
    f: () => {}, B: () => {}, c: null, nle: i => 'row-' + i,
  };
  const known = n => Object.prototype.hasOwnProperty.call(state, n);
  const names = freeNames.filter(known);
  const makeRow = new Function(...names, 'return ' + rowCallback + ';')(...names.map(n => state[n]));
  models.forEach((model, index) => {
    const out = makeRow(model, index);
    if (Array.isArray(out)) nodes.push(...out.filter(Boolean).map(n => ({ type: 'NESTED', props: {} })));
  });
  return nodes.map(n => ({
    kind: n.type === 'ROW' || n.props.model ? 'row' : (n.props.className === 'SH' ? 'header' : 'other'),
    text: n.props.model ? n.props.model.value : n.props.children,
  }));
}

const drawn = draw(choices);
const headers = drawn.filter(n => n.kind === 'header').map(n => n.text);
const rows = drawn.filter(n => n.kind === 'row').map(n => n.text);
assert.deepEqual(rows, choices.map(m => m.value), 'the renderer dropped or reordered a model');
// The exact words and order: two providers may both have a «DeepSeek», but each
// must be announced once under its own provider, never twice inside one block.
const expectedHeaders = [];
choices.forEach((m, i) => {
  const prev = i ? choices[i - 1] : null;
  if (m.group && (!prev || m.group !== prev.group)) expectedHeaders.push(m.group);
  if (m.familyLabel && (!prev || m.group !== prev.group || m.familyLabel !== prev.familyLabel)) {
    expectedHeaders.push(m.familyLabel);
  }
});
assert.deepEqual(headers, expectedHeaders, 'the drawn headers do not match the model list');
assert.ok(drawn.at(-1)?.kind === 'row', 'the list ends on a header with no model under it');

// A family name that repeats in the next provider must be announced again:
// the header follows its provider, not the row before it (v2 of the patch).
const boundary = draw([
  { value: 'a', group: 'Alpha', family: 'x:same', familyLabel: 'Same' },
  { value: 'b', group: 'Beta', family: 'y:same', familyLabel: 'Same' },
]);
assert.deepEqual(boundary.filter(n => n.kind === 'header').map(n => n.text),
  ['Alpha', 'Same', 'Beta', 'Same'], 'the family header is not redrawn after a provider change');

// Sabotage: strip the fields the headers depend on. A renderer that still
// draws headers is reading a constant, not the catalog, and proves nothing.
assert.equal(draw(choices.map(({ group, familyLabel, ...rest }) => rest)).filter(n => n.kind === 'header').length, 0,
  'headers appear even without group/familyLabel on the models');

console.log('model groups: ' + rows.length + ' rows, ' + headers.length + ' headers, providers and families contiguous');
