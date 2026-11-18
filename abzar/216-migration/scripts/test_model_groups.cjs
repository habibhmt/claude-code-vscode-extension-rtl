// Two promises, both about a reload: the picker keeps providers apart, and the
// model an open chat already uses cannot move to another row.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const { modelChoices } = require('./vscode_model_catalog.cjs');
const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, '../claude-api/deepseek-models.json'), 'utf8'));

const extDir = path.join(os.homedir(), '.vscode/extensions');
const registered = JSON.parse(fs.readFileSync(path.join(extDir, 'extensions.json'), 'utf8'));
const active = registered.find(e => e.identifier.id === 'anthropic.claude-code');
const bundle = fs.readFileSync(path.join(extDir, active.relativeLocation, 'webview/index.js'), 'utf8');

/* ---------- the catalog itself ---------- */

const choices = modelChoices();

// A reload must rebuild exactly the same list. Two calls stand in for it.
assert.deepEqual(modelChoices(), choices, 'modelChoices must be deterministic');

// The value an open chat saved has to survive: the picker resolves it by exact
// value first, and only falls back to the family when that fails.
const expected = catalog.flatMap(row => row.openRouterModel ? [row.openRouterModel, 'anthropic-api/' + row.value] : [row.value]);
assert.equal(choices.length, expected.length, 'row count changed');
assert.deepEqual([...choices.map(m => m.value)].sort(), [...expected].sort(), 'a saved model value disappeared');

// Contiguous blocks: a provider or a family that reappears later would let the
// family fallback resolve to a different row than the one the chat was using.
const seenGroups = new Set();
let lastGroup = null;
const seenFamilies = new Set();
let lastFamily = null;
for (const m of choices) {
  assert.ok(m.group && m.family && m.familyLabel, 'every row needs group, family and familyLabel');
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
assert.match(extension, /disabled:\w+\(\)\.optional\(\),group:\w+\(\)\.optional\(\),family:\w+\(\)\.optional\(\),familyLabel:\w+\(\)\.optional\(\)\}/,
  'the config schema drops group/family/familyLabel: run fix-rtl-claude.sh');

/* ---------- the patched renderer ---------- */

const START = 'children:z&&h.map(';
const at = bundle.indexOf(START);
assert.ok(at >= 0, 'patched picker render is missing from the installed webview: run fix-rtl-claude.sh');

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

const callArgs = balanced(bundle, at + 'children:z&&h.map'.length);
const render = new Function('m', 'h', 'z', 'YFn', 'AFt', 'ae', 'd', 'o', 'E', 'u', 'j', 'c', 'kl',
  'return h.map' + callArgs + ';');

function draw(models) {
  const made = [];
  const m = (type, props, key) => { const node = { type, props, key }; made.push(node); return node; };
  const nodes = render(m, models, true, 'ROW', i => 'row-' + i, new Set(), null, null, null,
    () => {}, () => {}, null, { sectionHeader: 'SH' });
  return nodes.flat(Infinity).filter(Boolean).map(n => ({
    kind: n.type === 'ROW' ? 'row' : (n.props.className === 'SH' ? 'header' : 'other'),
    text: n.type === 'ROW' ? n.props.model.value : n.props.children,
  }));
}

const drawn = draw(choices);
const headers = drawn.filter(n => n.kind === 'header').map(n => n.text);
const rows = drawn.filter(n => n.kind === 'row').map(n => n.text);
assert.deepEqual(rows, choices.map(m => m.value), 'the renderer dropped or reordered a model');
assert.deepEqual(headers.filter(h => h.includes('·') || h === 'Anthropic Console'),
  ['OpenRouter · DeepSeek', 'OpenRouter · Anthropic', 'Anthropic Console'], 'provider headers are wrong');
assert.equal(headers.length, seenGroups.size + seenFamilies.size,
  'expected one header per provider block and one per family block');
assert.ok(!drawn.some((n, i) => n.kind === 'header' && drawn[i - 1]?.kind === 'header' && false),
  'two headers in a row');

// Sabotage: strip the fields the headers depend on. A renderer that still
// draws headers is reading a constant, not the catalog, and proves nothing.
assert.equal(draw(choices.map(({ group, familyLabel, ...rest }) => rest)).filter(n => n.kind === 'header').length, 0,
  'headers appear even without group/familyLabel on the models');

console.log('model groups: ' + rows.length + ' rows, ' + headers.length + ' headers, providers and families contiguous');
