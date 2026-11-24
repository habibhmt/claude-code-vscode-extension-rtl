// The «پرووایدرها» tab: the tree the panel draws, and the file it writes back.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const providers = require('./model_providers.cjs');
const { modelChoices } = require('./vscode_model_catalog.cjs');

const none = { providers: [], hiddenFamilies: [] };
const view = providers.view(none);

/* ---------- the tree ---------- */

const curated = view.groups.filter(g => g.curated);
assert.deepEqual(curated.map(g => g.label),
  ['OpenRouter · DeepSeek', 'OpenRouter · Anthropic', 'Anthropic Console'], 'curated blocks are out of order');
assert.equal(curated.reduce((n, g) => n + g.count, 0), modelChoices().length,
  'the tab and the picker disagree about how many curated models exist');

// DeepSeek and Anthropic are curated, so offering them again as extra providers
// would let one model sit behind two switches.
assert.ok(!view.groups.some(g => g.key === 'openrouter:deepseek' || g.key === 'openrouter:anthropic'),
  'a curated provider is offered twice');
assert.ok(!view.groups.some(g => g.key.startsWith('openrouter:') && !g.families.length), 'a provider with no families');

// Stealth models are the whole reason the alarm exists; they must be switchable.
const stealth = view.groups.find(g => g.key === 'openrouter:stealth');
assert.ok(stealth, 'stealth models are missing from the provider list');
assert.equal(stealth.count, 4);
assert.equal(stealth.on, false, 'stealth is off until asked for');

/* ---------- the file ---------- */

const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'prv-'));
const file = path.join(folder, 'model-filter.json');
try {
  assert.deepEqual(providers.save({ providers: ['openai'], hiddenFamilies: ['deepseek-v3.2'] }, file),
    { version: 1, providers: ['openai'], hiddenFamilies: ['deepseek-v3.2'] });
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')),
    { version: 1, providers: ['openai'], hiddenFamilies: ['deepseek-v3.2'] });

  // The panel is not a trusted writer: only plain slugs reach the picker's file.
  const dirty = providers.save({
    providers: ['openai', '../../etc/passwd', 42, null, 'has space'],
    hiddenFamilies: ['deepseek-v3.2', 'x/y', {}, 'ok.family-1'],
  }, file);
  assert.deepEqual(dirty.providers, ['openai']);
  assert.deepEqual(dirty.hiddenFamilies, ['deepseek-v3.2', 'ok.family-1']);

  // A round trip through the message the hook actually handles.
  const listed = providers.handle({ type: 'crtl-provider-sabt', filter: { providers: ['stealth'], hiddenFamilies: [] } }, file);
  assert.equal(listed.groups.find(g => g.key === 'openrouter:stealth').on, true);
  const reread = providers.handle({ type: 'crtl-provider-list' }, file);
  assert.deepEqual(reread.filter.providers, ['stealth'], 'the tick did not survive a re-read');

  // A half-written file must never take the picker down.
  fs.writeFileSync(file, '{not json');
  assert.deepEqual(require('./vscode_model_catalog.cjs').readFilter(file), none);
} finally {
  fs.rmSync(folder, { recursive: true, force: true });
}

/* ---------- the filter reaches the picker ---------- */

const saved = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'prv2-')), 'f.json');
try {
  providers.save({ providers: ['stealth'], hiddenFamilies: [] }, saved);
  const filter = require('./vscode_model_catalog.cjs').readFilter(saved);
  const rows = modelChoices(undefined, { filter, used: new Set() });
  assert.deepEqual(rows.filter(m => m.group === 'OpenRouter · stealth').map(m => m.value).sort(),
    ['stealth/crouton-alpha', 'stealth/ox-alpha', 'stealth/space-bunny-alpha', 'stealth/union-alpha'],
    'ticking stealth in the tab does not put the stealth models in the picker');
} finally {
  fs.rmSync(path.dirname(saved), { recursive: true, force: true });
}

console.log('model providers: ' + view.groups.length + ' groups, ' + curated.length + ' curated, stealth switchable');
