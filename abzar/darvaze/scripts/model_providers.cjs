'use strict';

// The «پرووایدرها» tab asks the host, the host asks this file. Kept out of the
// hook so the tree it sends to the panel can be tested without VS Code.

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const catalog = require('./vscode_model_catalog.cjs');

const FILTER = path.join(ROOT, 'claude-api', 'model-filter.json');
const OPENROUTER = path.join(ROOT, 'claude-api', 'openrouter-catalog.json');

// Anything the panel sends is untrusted: a stray key would end up in the file
// that the model picker reads on every rebuild.
const SAFE = { provider: /^[a-z0-9~._-]{1,40}$/, family: /^[A-Za-z0-9._-]{1,80}$/ };

function families(rows) {
  const seen = new Map();
  for (const row of rows) {
    const hit = seen.get(row.family);
    if (hit) hit.count += 1;
    else seen.set(row.family, { key: row.family, label: row.familyLabel, count: 1 });
  }
  return [...seen.values()];
}

function clean(filter) {
  const source = filter && typeof filter === 'object' ? filter : {};
  const keep = (list, rule) => (Array.isArray(list) ? list : [])
    .filter(x => typeof x === 'string' && rule.test(x));
  return {
    version: 1,
    providers: keep(source.providers, SAFE.provider),
    hiddenFamilies: keep(source.hiddenFamilies, SAFE.family),
  };
}

function view(filter, root = ROOT) {
  // The unfiltered list is the reference: it is what the curated blocks hold today.
  const rows = catalog.modelChoices(undefined, {
    filter: { providers: [], hiddenFamilies: [] }, used: new Set(),
  });
  const curated = [
    ['deepseek', 'OpenRouter · DeepSeek', catalog.DEEPSEEK_GROUP],
    ['anthropic', 'OpenRouter · Anthropic', catalog.ANTHROPIC_GROUP],
    ['console', 'Anthropic Console', catalog.CONSOLE_GROUP],
  ].map(([key, label, group]) => {
    const mine = rows.filter(r => r.group === group);
    return { key: 'curated:' + key, label, curated: true, count: mine.length, families: families(mine) };
  });
  let document = { models: [], generated: null, counts: {} };
  try {
    document = JSON.parse(fs.readFileSync(path.join(root, 'claude-api/openrouter-catalog.json'), 'utf8'));
  } catch { /* no catalogue yet: the curated blocks still work */ }
  const byProvider = new Map();
  for (const model of document.models || []) {
    // deepseek and anthropic are already curated above; listing them twice
    // would offer the same models under two switches.
    if (model.provider === 'deepseek' || model.provider === 'anthropic') continue;
    if (!byProvider.has(model.provider)) byProvider.set(model.provider, []);
    byProvider.get(model.provider).push(model);
  }
  const extras = [...byProvider.keys()].sort().map(provider => {
    const list = byProvider.get(provider);
    return {
      key: 'openrouter:' + provider, label: 'OpenRouter · ' + provider, curated: false,
      count: list.length, on: filter.providers.includes(provider),
      families: families(list.map(m => ({ family: m.family, familyLabel: m.name }))),
    };
  });
  const hidden = {};
  for (const family of filter.hiddenFamilies) hidden[family] = true;
  return { groups: [...curated, ...extras], filter, hidden,
           generated: document.generated || null, counts: document.counts || {} };
}

function save(filter, file = FILTER) {
  const safe = clean(filter);
  const temporary = file + '.tmp';
  fs.writeFileSync(temporary, JSON.stringify(safe, null, 1) + '\n');
  fs.renameSync(temporary, file);
  return safe;
}

/** One message in, one message out — the shape the webview expects. */
function handle(message, file = FILTER, root = ROOT) {
  const filter = message.type === 'crtl-provider-sabt' ? save(message.filter, file) : catalog.readFilter(file);
  return view(filter, root);
}

module.exports = { view, save, handle, families, clean, FILTER };
