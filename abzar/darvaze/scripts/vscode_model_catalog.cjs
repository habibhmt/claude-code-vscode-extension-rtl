'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const catalog = path.join(ROOT, 'claude-api', 'deepseek-models.json');
const openRouter = path.join(ROOT, 'claude-api', 'openrouter-catalog.json');
const filterFile = path.join(ROOT, 'claude-api', 'model-filter.json');

// Providers are emitted as fixed, contiguous blocks. A reload must never
// reshuffle them: an open chat remembers its model by `value`, and a stable
// order keeps the family fallback from landing on a different row.
const DEEPSEEK_GROUP = 'OpenRouter · DeepSeek';
const ANTHROPIC_GROUP = 'OpenRouter · Anthropic';
const CONSOLE_GROUP = 'Anthropic Console';

// Family key comes from the model slug, not the display name, so renaming a
// row can never move it into another family or change the saved model.
function familyKey(value) {
  // "@preset/…" carries its own slash, so drop it before taking the last segment:
  // deepseek/deepseek-v4.1-flash-1017@preset/mh-…-deepinfra -> deepseek-v4.1-flash-1017
  const slug = value.replace(/^anthropic-api\//, '').split('@')[0].split('/').pop();
  const claude = /^(claude)-(opus|sonnet|haiku|fable)/.exec(slug);
  return claude ? claude[1] + '-' + claude[2] : slug;
}

// Display-only: "DeepSeek V4.1 Flash 1017 · DeepInfra ⭐" -> "DeepSeek V4.1 Flash 1017",
// "DeepSeek: DeepSeek V4.1 Flash 1017" -> "DeepSeek V4.1 Flash 1017", "Claude Opus 5.5" -> "Claude Opus".
function familyLabel(name) {
  for (const sep of ['·', ':', '—']) {
    if (name.includes(sep)) {
      const parts = name.split(sep);
      return (sep === ':' ? parts[1] : parts[0]).trim();
    }
  }
  return name.split(/\s+/).slice(0, 2).join(' ');
}

// Families stay contiguous, in the order the catalog first mentions them, and
// rows keep their catalog order inside a family.
function byFamily(rows) {
  const order = [];
  const buckets = new Map();
  for (const row of rows) {
    const key = familyKey(row.value);
    if (!buckets.has(key)) {
      buckets.set(key, []);
      order.push(key);
    }
    buckets.get(key).push(row);
  }
  return order.flatMap(key => buckets.get(key));
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Models a chat has actually run on. Hiding one of these would leave an open
 * chat pointing at a row its picker can no longer draw, so the filter never
 * removes them. Missing or unreadable file simply means "nothing to protect".
 */
function usedModels(files = [path.join(os.homedir(), '.claude.json'),
                             path.join(os.homedir(), '.claude', '.claude.json')]) {
  // Two files, not one: the VS Code session runs with CLAUDE_CONFIG_DIR=~/.claude
  // and records its chats in ~/.claude/.claude.json, while the terminal records
  // them in ~/.claude.json. Reading only one would protect half the chats.
  const used = new Set();
  for (const file of [].concat(files)) {
    const slots = readJson(file)?.clientDataCacheSlots;
    if (!slots || typeof slots !== 'object') continue;
    for (const slot of Object.values(slots)) {
      if (slot && typeof slot.model === 'string' && slot.model) used.add(slot.model);
    }
  }
  return used;
}

/** `{providers: [...], hiddenFamilies: [...]}`; anything unreadable means "no filter". */
function readFilter(file = filterFile) {
  const data = readJson(file);
  if (!data || typeof data !== 'object') return { providers: [], hiddenFamilies: [] };
  const strings = value => Array.isArray(value) ? value.filter(x => typeof x === 'string') : [];
  return { providers: strings(data.providers), hiddenFamilies: strings(data.hiddenFamilies) };
}

function priceLabel(model) {
  if (model.tier === 'free') return 'رایگان · OpenRouter';
  if (model.prompt === null || model.prompt === undefined) return 'OpenRouter';
  return '$' + model.prompt + '/M in · $' + model.completion + '/M out · OpenRouter';
}

/** Extra OpenRouter rows, one block per provider the filter switched on. */
function extraChoices(filter, taken) {
  if (!filter.providers.length) return [];
  const document = readJson(openRouter);
  if (!document || !Array.isArray(document.models)) return [];
  const wanted = new Set(filter.providers);
  // Stealth rows are included on purpose: they are the reason the alarm exists,
  // and ticking that provider is the only way to reach them.
  const rows = document.models.filter(m => wanted.has(m.provider) && !taken.has(m.id));
  const groups = [];
  for (const provider of filter.providers) {
    const mine = rows.filter(m => m.provider === provider).map(m => ({
      value: m.id,
      displayName: m.name + ' — OpenRouter API Key',
      description: priceLabel(m),
      group: 'OpenRouter · ' + provider,
      family: m.family,
      familyLabel: m.name,
    }));
    groups.push(...byFamily(mine));
  }
  return groups;
}

const GATEWAY_MERGED = path.join(ROOT, '.runtime/opencode-go/merged-models.json');
const PICKER_CAPS = path.join(ROOT, 'claude-api/model-caps-picker.json');
const PROVIDER_LABEL = { opencode: 'OpenCode Go', openrouter: 'OpenRouter' };

/** Capability rows are evidence only — built by saz_model_caps_picker.py from the
 *  OpenRouter catalogue's own `reasoning` list and the old DeepSeek catalogue.
 *  A missing or unreadable file means "no row shows effort"; never a made-up slider. */
function pickerCaps() {
  const data = readJson(PICKER_CAPS);
  if (!data || typeof data !== 'object' || !data.rows || typeof data.rows !== 'object') return {};
  return data.rows;
}

// "DeepSeek V4.1 Flash 1017" -> "DeepSeek" · "AionLabs: Aion-2.0" -> "AionLabs".
// A name that merely repeats its provider ("OpenRouter: Fusion") would draw the
// same word twice; the part after the colon is used instead of lying twice.
function gatewayFamilyLabel(name, group) {
  const parts = name.split(/[:·—]/);
  const head = parts[0].trim();
  const label = head.split(/\s+/)[0] || head;
  if (label && label.toLowerCase() !== group.toLowerCase()) return label;
  const tail = (parts[1] || '').trim().split(/\s+/)[0];
  if (tail) return tail;
  return name.trim();
}

// Providers stay in blocks, families stay contiguous inside each block; an open
// chat resolves its saved model by value, but a stable order keeps the family
// fallback landing on the same row after every reload.
function byProviderAndFamily(rows) {
  const groups = [];
  const buckets = new Map();
  for (const row of rows) {
    if (!groups.includes(row.group)) groups.push(row.group);
    const key = row.group + '\u0000' + row.family;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(row);
  }
  return groups.flatMap(group => [...buckets.entries()]
    .filter(([key]) => key.startsWith(group + '\u0000'))
    .flatMap(([, mine]) => mine));
}

/** Rows from the gateway's single source (/local/models.json), shaped for this picker.
 *  حبیب ۲۱:۱۳: منوی VS Code نباید فهرستِ قدیمیِ OpenRouter را نشان بدهد؛ منبعِ
 *  حقیقت همان دروازه است. اگر فایل نبود/خراب بود، مسیرِ قبلی دست‌نخورده می‌ماند.
 *  حبیب ۲۶ نوامبر ۰۰:۱۶ («الف»): فقط ردیف‌هایی که مدرکِ توانایی دارند اسلایدر
 *  می‌گیرند (۱۶۰ از ۴۱۱)؛ بقیه بی‌اسلایدر می‌مانند تا اسلایدرِ دروغین ساخته نشود.
 *  سرتیتر = پرووایدر، زیرسرتیتر = خانواده، و پرووایدر روی خودِ ردیف هم می‌آید. */
function gatewayChoices() {
  const rows = readJson(GATEWAY_MERGED);
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const caps = pickerCaps();
  const out = [];
  for (const row of rows) {
    if (!row || typeof row.id !== 'string' || !row.id) continue;
    const provider = row.provider === 'opencode' ? 'opencode' : 'openrouter';
    const label = PROVIDER_LABEL[provider];
    const name = row.name || row.id;
    const label2 = gatewayFamilyLabel(name, label);
    const entry = {
      value: row.id,
      displayName: name.endsWith('· ' + label) ? name : name + ' · ' + label,
      description: row.description || '',
      group: label,
      // The family key IS the drawn sub-header. Two rows sharing a family key
      // but drawing different labels would put a second sub-header inside one
      // block; keying by the label keeps one header per label, always.
      family: provider + ':' + label2.toLowerCase(),
      familyLabel: label2,
    };
    const capability = caps[row.id];
    if (capability && capability.supportsEffort === true
        && Array.isArray(capability.supportedEffortLevels)
        && capability.supportedEffortLevels.length > 0) {
      entry.supportsEffort = true;
      entry.supportedEffortLevels = [...capability.supportedEffortLevels];
      for (const key of ['supportsAdaptiveThinking', 'supportsThinkingOff', 'supportsAutoMode', 'supportsFastMode']) {
        if (capability[key] === true) entry[key] = true;
      }
    }
    out.push(entry);
  }
  if (!out.length) return null;
  if (new Set(out.map(m => m.value)).size !== out.length) return null;
  return byProviderAndFamily(out);
}

function modelChoices(rows = readJson(catalog), options = {}) {
  const fromGateway = gatewayChoices();
  if (fromGateway) return fromGateway;
  if (!Array.isArray(rows) || rows.length === 0) throw Error('Invalid VS Code model catalog');
  const filter = options.filter || readFilter();
  const used = options.used || usedModels();
  const openRouterRows = [];
  const consoleApi = [];
  // One label per family, taken from its first row: a family whose rows are
  // named differently would otherwise draw a second header inside one block.
  const labels = new Map();
  for (const row of rows) {
    if (typeof row?.value !== 'string' || row.value.includes(':') || !row.displayName) {
      throw Error('Invalid VS Code model catalog');
    }
    const family = familyKey(row.value);
    if (!labels.has(family)) labels.set(family, familyLabel(row.displayName));
    const familyLabelText = labels.get(family);
    if (row.value.startsWith('deepseek/')) {
      // The display name must stay byte-identical to the previous release: the
      // open chat's saved model is matched by value, but its label is rebuilt
      // from this string on every reload.
      openRouterRows.push({ ...row, displayName: row.displayName + ' — OpenRouter API Key',
                            family, familyLabel: familyLabelText, group: DEEPSEEK_GROUP });
      continue;
    }
    const { openRouterModel, ...model } = row;
    if (!/^claude-[a-z0-9-]+$/.test(model.value) || !/^anthropic\/claude-[a-z0-9.-]+$/.test(openRouterModel)) {
      throw Error('Invalid Claude account pair');
    }
    openRouterRows.push({ ...model, value: openRouterModel, displayName: model.displayName + ' — OpenRouter API Key',
                          description: 'Billed to OpenRouter.', group: ANTHROPIC_GROUP, family, familyLabel: familyLabelText });
    consoleApi.push({ ...model, value: 'anthropic-api/' + model.value, displayName: model.displayName + ' — Anthropic API Key',
                      description: 'Billed to Anthropic Console.', group: CONSOLE_GROUP, family, familyLabel: familyLabelText });
  }
  const hidden = new Set(filter.hiddenFamilies);
  const keep = row => !hidden.has(row.family) || used.has(row.value);
  const curated = [...byFamily(openRouterRows), ...byFamily(consoleApi)];
  const taken = new Set(curated.map(m => m.value));
  const choices = [...curated.filter(keep), ...extraChoices(filter, taken).filter(keep)];
  if (choices.length === 0) throw Error('Invalid VS Code model catalog');
  if (new Set(choices.map(m => m.value)).size !== choices.length) throw Error('Duplicate VS Code model choice');
  return choices;
}

module.exports = { modelChoices, familyKey, familyLabel, usedModels, readFilter,
                   DEEPSEEK_GROUP, ANTHROPIC_GROUP, CONSOLE_GROUP };
