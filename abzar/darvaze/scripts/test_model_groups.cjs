// Two promises, both about a reload: the picker keeps providers apart, and the
// model an open chat already uses cannot move to another row.
// ۲۶ نوامبر ۲۰۲۶: دو حالت دارد — «فهرست از دروازه» (merged-models.json هست) و
// «کاتالوگِ قدیمی» (در کلونِ تازه). ادعاهای مخصوصِ هر حالت جدا سنجیده می‌شوند؛
// چیزهای مشترک (بلوک‌بندی، schema، رندر) در هر دو حالت.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

// سنجاق‌های واقعیِ حبیب نباید این آزمون را بشکنند: مسیرِ فایلِ سنجاق به یک فایلِ
// خالیِ موقت می‌رود. بلوکِ «★ سنجاق‌شده» جای خودش جدا سنجیده می‌شود (پایین‌تر).
const pinsProbe = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ccg-pins-')), 'pins.json');
fs.writeFileSync(pinsProbe, '{"pins":[]}');
process.env.CCG_PINS = pinsProbe;

const { modelChoices, gatewayFamilyLabel } = require('./vscode_model_catalog.cjs');
const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, '../claude-api/deepseek-models.json'), 'utf8'));
const gatewayFile = path.join(__dirname, '../.runtime/opencode-go/merged-models.json');
const capsFile = path.join(__dirname, '../claude-api/model-caps-picker.json');
const gatewayActive = fs.existsSync(gatewayFile);

const extDir = path.join(os.homedir(), '.vscode/extensions');
const registered = JSON.parse(fs.readFileSync(path.join(extDir, 'extensions.json'), 'utf8'));
const active = registered.find(e => e.identifier.id === 'anthropic.claude-code');
const bundle = fs.readFileSync(path.join(extDir, active.relativeLocation, 'webview/index.js'), 'utf8');

// The webview loads index.js as an ES module, and `node --check` on a `.js` file
// parses it as CommonJS — which is how a broken brace shipped on ۲۶ نوامبر ۲۰۲۶
// and the panel died with «Unexpected token '}'». Parse it the way the browser does.
const { execFileSync } = require('node:child_process');
const moduleCopy = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ccg-parse-')), 'index.mjs');
fs.writeFileSync(moduleCopy, bundle);
let parseError = null;
try {
  execFileSync(process.execPath, ['--check', moduleCopy], { stdio: 'pipe' });
} catch (error) {
  parseError = String(error.stderr || error.message).trim().slice(0, 400);
} finally {
  fs.rmSync(path.dirname(moduleCopy), { recursive: true, force: true });
}
assert.equal(parseError, null, 'the installed webview bundle does not parse as a module: ' + parseError);

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

/* ---------- خانواده یک‌بار می‌آید، نه ریزِ هر مدل ---------- */
// حبیب ۲۶ نوامبر ۰۲:۱۹: «تو نباید ریز مدل بزاری … mimo یه بار میاد و بعد بقیه
// مدل‌های همون دسته زیرش». شمارهٔ نسخه از برچسب می‌رود تا یک خانواده یک سرتیتر بگیرد.
assert.equal(gatewayFamilyLabel('MiMo-V2.6-Flash · OpenCode Go', 'OpenCode Go'), 'MiMo',
  'the version is still part of the family label');
assert.equal(gatewayFamilyLabel('MiMo-V2.6-Pro · OpenCode Go', 'OpenCode Go'), 'MiMo',
  'two versions of one family draw two different labels');
assert.equal(gatewayFamilyLabel('Kimi-K3.1-Pro · OpenCode Go', 'OpenCode Go'), 'Kimi');
assert.equal(gatewayFamilyLabel('LongCat-2.5 · OpenCode Go', 'OpenCode Go'), 'LongCat');
assert.deepEqual(choices.filter(m => /\d/.test(m.familyLabel)).map(m => m.familyLabel), [],
  'a version number is still sitting in a family header');

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
  // حبیب ۲۶ نوامبر ۰۳:۳۹: «اداپتیو باشه و برای هر مدلی طبق همون چیزی که براش
  // تعریف شده بیاد». این سه ردیف عمداً سه شکلِ مختلف دارند: یکی از دروازه سه سطح
  // می‌گیرد، یکی پنج سطح از کاتالوگِ OpenRouter، و یکی (kimi-k3) فقط یک سطح.
  const pinned = {
    'aion-labs/aion-3.5': ['low', 'high', 'max'],
    'deepseek-v4.1-flash': ['low', 'high', 'max'],
    'openai/gpt-5.2': ['low', 'medium', 'high', 'xhigh'],
    'kimi-k3': ['max'],
  };
  for (const [value, levels] of Object.entries(pinned)) {
    const row = byValue.get(value);
    assert.ok(row, 'a pinned model disappeared from the picker: ' + value);
    assert.deepEqual(row.supportedEffortLevels, levels, 'effort levels changed for ' + value);
  }
  // …and the other direction: a model whose vendor publishes no reasoning
  // levels must stay without a slider, not inherit one from its neighbours.
  for (const value of ['gemini-decision-1', 'hungerg-free']) {
    const row = byValue.get(value);
    if (!row) continue;
    assert.ok(!row.supportsEffort, 'a model without published levels got an effort slider: ' + value);
  }

  // قانونِ اداپتیو، برای *همهٔ* ردیف‌ها و از منبعِ خودشان: اگر دروازه برای مدل
  // `effort` می‌دهد همان باید در منو باشد؛ وگرنه فهرستِ `reasoning` کاتالوگِ
  // OpenRouter. هر اختلافی یعنی منو سطحی نشان می‌دهد که سرویس اعلام نکرده.
  const ORDER = ['low', 'medium', 'high', 'xhigh', 'max'];
  const norm = list => ORDER.filter(l => list.map(x => String(x).toLowerCase()).includes(l));
  const mergedEffort = new Map(merged.filter(m => Array.isArray(m.effort) && m.effort.length)
    .map(m => [m.id, m.effort]));
  const catalogReasoning = new Map((JSON.parse(fs.readFileSync(
    path.join(__dirname, '../claude-api/openrouter-catalog.json'), 'utf8')).models || [])
    .filter(m => Array.isArray(m.reasoning)).map(m => [m.id, m.reasoning]));
  let checked = 0;
  for (const m of choices) {
    const evidence = mergedEffort.get(m.value) || catalogReasoning.get(m.value);
    const expected = evidence ? norm(evidence) : [];
    assert.deepEqual(m.supportedEffortLevels ? [...m.supportedEffortLevels].sort() : [],
      [...expected].sort(), 'the effort menu does not match what this model publishes: ' + m.value);
    if (expected.length) checked += 1;
  }
  assert.ok(checked > 100, 'almost no model carries evidence — the adaptive check is vacuous');
  // هر ردیف همان چیزی را می‌گوید که دفترچهٔ رسمیِ خودِ سرویس می‌گوید — قیمتِ
  // ورودی/خروجی/کش بر میلیون، پنجرهٔ متن، سقفِ خروجی، ابزار و جنسِ ورودی
  // (حبیب ۲۶ نوامبر ۰۰:۵۶: «توضیحات مزخرف/چرت را بردار، فقط قیمت و کانتکست»).
  const arabic = /[؀-ۿ]/;
  for (const m of choices) {
    assert.ok(m.description, 'row without a spec line: ' + m.value);
    assert.ok(!arabic.test(m.description), 'a Persian sentence is back in the spec line: ' + m.value);
    assert.match(m.description, /(free|in \$-?[\d.]+\/M)/, 'no published price in the spec line: ' + m.value);
    assert.match(m.description, /ctx [\d.]+[KM]/, 'no context window in the spec line: ' + m.value);
  }
  const line = value => choices.find(m => m.value === value).description;
  assert.match(line('deepseek-v4.1-flash'), /^in \$0\.15\/M · out \$0\.6\/M · cache \$0\.003\/M · ctx 1M/,
    'the OpenCode spec line drifted from the vendor sheet');
  assert.match(line('beam-free'), /^free · ctx /, 'a zero-priced model must read "free"');
  // The picker shows the gateway's own line; it must not re-word it.
  for (const row of merged) {
    const shown = byValue.get(row.id);
    if (!shown) continue;
    assert.equal(shown.description, row.description || '', 'the picker changed the gateway spec line: ' + row.id);
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
// فهرست دیگر مستقیم `.map` نمی‌شود؛ از دلِ `__ccgSort(...)` بیرون می‌آید، پس
// پیش از `.map(` یک `)` است نه نامِ متغیر. نام فقط وقتی لازم است که مستقیم باشد.
const listVarMatch = /([\w$]+)$/.exec(bundle.slice(0, before));
const listVar = listVarMatch ? listVarMatch[1] : null;

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
    ...(listVar ? { [listVar]: models } : {}),
    mo: { sectionHeader: 'SH' },
    Q: new Set(), p: null, r: null, M: { current: null },
    f: () => {}, B: () => {}, c: null, nle: i => 'row-' + i,
  };
  // ستونِ «ردیفِ قبلی» در باندل از `globalThis.__ccgR` می‌آید (نتیجهٔ مرتب‌سازی).
  globalThis.__ccgR = models;
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

/* ---------- the search box over the list ---------- */

// حبیب ۲۶ نوامبر ۰۰:۵۶: «برای مدل‌ها یه سرچ هم بگذار». فیلتر بی‌state است و با
// style.display کار می‌کند، پس همین‌جا بدون مرورگر هم می‌شود سنجیدش.
const searchAt = bundle.indexOf('"ccg-search"');
assert.ok(searchAt > 0, 'the model search box is missing: run fix-rtl-claude.sh');
const inputAt = bundle.indexOf('onInput:(e)=>{', searchAt);
assert.ok(inputAt > 0, 'the search box has no input handler');

function braces(text, openIndex) {
  let depth = 0;
  for (let i = openIndex; i < text.length; i++) {
    if (text[i] === '{') depth += 1;
    else if (text[i] === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(openIndex + 1, i);
    }
  }
  throw Error('unbalanced search handler');
}

const handlerBody = braces(bundle, inputAt + 'onInput:(e)=>'.length);
const filter = value => {
  const input = { value, style: {}, getAttribute: () => null };
  const header = { textContent: 'OpenCode Go', style: {}, getAttribute: () => null };
  const row = (text, style = {}) => ({ textContent: text, style, getAttribute: a => (a === 'role' ? 'option' : null) });
  const deep = row('DeepSeek V4.1 Flash 1017 · OpenCode Go');
  const beam = row('Beam Free · OpenCode Go');
  input.parentElement = { children: [input, header, deep, beam] };
  new Function('e', handlerBody)({ target: input });
  return { deep: deep.style.display, beam: beam.style.display, header: header.style.display };
};

assert.deepEqual(filter('deepseek'), { deep: '', beam: 'none', header: 'none' },
  'typing in the search box does not hide the models that do not match');
assert.deepEqual(filter('BEAM'), { deep: 'none', beam: '', header: 'none' },
  'the search is case-sensitive or misses the second row');
assert.deepEqual(filter(''), { deep: '', beam: '', header: '' },
  'clearing the search does not bring the list back');

/* ---------- the pin star (ستارهٔ سنجاق) ---------- */

// حبیب ۲۶ نوامبر ۰۱:۲۹: «ستاره که توپر بشه بره بالا … یه چیزِ قشنگ کدل مک او اس».
// ستاره را `ref` ِ همان کادرِ جست‌وجو داخلِ ردیف‌ها می‌گذارد. با jsdom واقعاً
// کلیک می‌شود: پیام باید به افزونه برود و ردیف باید برود بالای فهرست.
const { JSDOM } = require('jsdom');
const refAt = bundle.indexOf('ref:(node)=>{', searchAt);
assert.ok(refAt > 0, 'the search box has no star mount: run fix-rtl-claude.sh');
const refBody = braces(bundle, refAt + 'ref:(node)=>'.length);
// دستگیرهٔ پیام باید از globalThis بیاید: متغیرِ محلیِ bootstrap در دامنهٔ رندرِ
// منو نیست و ستاره با ReferenceErrorِ بی‌صدا پیام نمی‌فرستاد (۲۶ نوامبر ۰۱:۵۰).
assert.ok(bundle.includes('globalThis.__ccgApi=acquireVsCodeApi()'),
  'the vscode api handle is not exported to globalThis');
assert.ok(refBody.includes('__ccgIds') && refBody.includes('globalThis.__ccgApi'),
  'the star lost its id map or its message to the extension');
globalThis.__ccgApi = { postMessage: message => sent.push(message) };

const dom = new JSDOM('<!doctype html><body><div id="list"><input id="q">'
  + '<div role="option" id="model-selector-list-option-0"><span>beam-free</span></div>'
  + '<div role="option" id="model-selector-list-option-1"><span>deepseek</span></div>'
  + '<div role="option" id="model-selector-list-option-2"><span>glm</span></div>'
  + '</div></body>');
const { document, MutationObserver, MouseEvent } = dom.window;
const sent = [];

globalThis.__ccgIds = { 0: 'beam-free', 1: 'deepseek-v4.1-flash', 2: 'glm-5.3' };
globalThis.__ccgPinned = { 'deepseek-v4.1-flash': true };
const mount = new Function('document', 'MutationObserver',
  'return (node)=>{' + refBody + '};')(document, MutationObserver);
const list = document.getElementById('list');
const input = document.getElementById('q');
const [beamRow, deepRow, glmRow] = list.querySelectorAll('[role="option"]');
mount(input);

const stars = list.querySelectorAll('.ccg-star');
assert.equal(stars.length, 3, 'not every row got a star');
assert.ok(deepRow.querySelector('.ccg-star').classList.contains('is-pinned'),
  'a pinned model does not start with a filled star');
assert.equal(deepRow.querySelector('.ccg-star').textContent, '★', 'a pinned star is not filled');
assert.equal(beamRow.querySelector('.ccg-star').textContent, '☆', 'an unpinned star is not hollow');

// کلیک روی ستارهٔ توپر: تُهی می‌شود و پیامِ بی‌سنجاق به افزونه می‌رود.
deepRow.querySelector('.ccg-star').dispatchEvent(new MouseEvent('click', { bubbles: true }));
assert.deepEqual(sent, [{ type: 'ccg-pin', id: 'deepseek-v4.1-flash', pinned: false }],
  'clicking a filled star does not send the unpin message');
assert.ok(!deepRow.querySelector('.ccg-star').classList.contains('is-pinned'), 'a star did not empty out');

// کلیک روی ستارهٔ تُهیِ ردیفِ *آخر*: توپر، پیامِ سنجاق، و کوچک‌ترین رتبه تا در
// مرتب‌سازی بالای فهرست بنشیند. ردیف آخر عمداً انتخاب شده: ردیفی که از قبل اول
// است «بالا رفتن» را ثابت نمی‌کند.
glmRow.querySelector('.ccg-star').dispatchEvent(new MouseEvent('click', { bubbles: true }));
assert.deepEqual(sent.at(-1), { type: 'ccg-pin', id: 'glm-5.3', pinned: true },
  'clicking an empty star does not send the pin message');
assert.ok(glmRow.querySelector('.ccg-star').classList.contains('is-pinned'), 'a star did not fill in');
const rank = globalThis.__ccgPinned;
const others = Object.entries(rank).filter(([k]) => k !== 'glm-5.3').map(([, v]) => v);
assert.ok(typeof rank['glm-5.3'] === 'number' && rank['glm-5.3'] < Math.min(...others),
  'a newly pinned model did not get the smallest rank');

// جابه‌جاییِ DOM حذف شد: ردیف‌های React را دستکاری می‌کرد و سرتیترها را قاطی
// می‌کرد (۲۶ نوامبر ۰۲:۱۰). جای آن، خودِ تابعِ مرتب‌سازیِ داخلِ باندل روی داده
// اجرا می‌شود و باید ردیفِ سنجاق‌شده را اول بیاورد — همان چیزی که منو می‌کشد.
const sortAt = bundle.indexOf('globalThis.__ccgSort=');
assert.ok(sortAt > 0, 'the picker has no pin ordering: run fix-rtl-claude.sh');
const sortStart = bundle.indexOf('(__r)=>{', sortAt);
assert.ok(sortStart > 0, 'the pin sort has an unexpected shape');
const sort = new Function('__r', braces(bundle, sortStart + '(__r)=>'.length));
const catalogRows = [
  { value: 'beam-free', group: 'G' },
  { value: 'deepseek-v4.1-flash', group: 'G', pinned: true },
  { value: 'glm-5.3', group: 'G' },
];
// `deepseek` بالاتر بی‌سنجاق شده بود، پس جای دیگری جز بالا ندارد؛ ستارهٔ تازه
// (glm) اول می‌آید و بقیه ترتیبِ اصلیِ خودشان را نگه می‌دارند.
assert.deepEqual(sort(catalogRows).map(m => m.value),
  ['glm-5.3', 'beam-free', 'deepseek-v4.1-flash'],
  'the pin sort does not lift the pinned row above the rest');
// و از حالتِ تازه: ردیفی که خودِ فهرست `pinned:true` داده بالای بقیه می‌نشیند.
globalThis.__ccgPinned = {};
globalThis.__ccgUnpinned = {};
assert.deepEqual(sort(catalogRows).map(m => m.value),
  ['deepseek-v4.1-flash', 'beam-free', 'glm-5.3'],
  'a row the catalog marks as pinned does not start at the top');
// هم شمارندهٔ کلیک، هم حضورش در وابستگی‌های useMemo لازم است: اگر فقط شمارنده
// باشد، ناوبری پس از سنجاق با ترتیبِ کهنه می‌ماند.
assert.ok(bundle.includes('globalThis.__ccgVer=(globalThis.__ccgVer||0)+1'),
  'a pin does not bump the navigation version');
assert.ok(bundle.includes(',globalThis.__ccgVer])'),
  'the navigation array is not invalidated after a pin');
assert.ok(bundle.includes('globalThis.__ccgSort(m)'),
  'the arrow-key navigation does not follow the pinned order');

// کلیکِ دوم همان ستاره: بی‌سنجاق، و از بالای فهرست برمی‌گردد.
glmRow.querySelector('.ccg-star').dispatchEvent(new MouseEvent('click', { bubbles: true }));
assert.deepEqual(sent.at(-1), { type: 'ccg-pin', id: 'glm-5.3', pinned: false },
  'a second click does not unpin');
assert.equal(globalThis.__ccgPinned['glm-5.3'], undefined, 'the rank survived an unpin');
assert.notEqual(sort(catalogRows)[0].value, 'glm-5.3',
  'an unpinned row is still drawn at the top of the list');
delete globalThis.__ccgIds;
delete globalThis.__ccgPinned;
delete globalThis.__ccgUnpinned;
delete globalThis.__ccgSort;
delete globalThis.__ccgApi;


/* ---------- the thinking toggle (دکمهٔ فکر) ---------- */

// حبیب ۲۶ نوامبر ۲۰۲۶: «اون دکمه خاموش روشن ثینکینگ رو هم پس بیاری توش».
// افزونه خودش دستورِ `toggle-thinking` را در بخشِ «Model» منوی «/» ثبت می‌کند و
// منوی مدل آن را نمی‌کشد؛ پچ ما همان دستور را داخلِ بخشِ افورت می‌گذارد. آزمون:
// خودِ عبارتِ تزریق‌شده از باندل بیرون کشیده و با رجیستریِ ساختگی اجرا می‌شود.
const thinkAt = bundle.indexOf('getCommand("toggle-thinking")', searchAt);
assert.ok(thinkAt > 0, 'the model picker has no thinking row: run fix-rtl-claude.sh');
assert.ok(bundle.includes('executeCommand("toggle-thinking")'),
  'the thinking row does not run the extension command');
const thinkStart = bundle.lastIndexOf('(()=>{', thinkAt);
assert.ok(thinkStart > 0, 'the thinking row has an unexpected shape');
const thinkBody = braces(bundle, thinkStart + 5);
// نام‌های مینیفای‌شده در هر بیلد عوض می‌شوند؛ از خودِ عبارت خوانده می‌شوند تا
// آزمون به نامِ یک نسخه گره نخورد.
const thinkReg = /(\w+)&&\1\.getCommand\("toggle-thinking"\)/.exec(thinkBody);
const thinkEl = /(\w+)\((\w+),\{command:/.exec(thinkBody);
assert.ok(thinkReg && thinkEl, 'the thinking row does not read the command registry');
const think = new Function(thinkReg[1], thinkEl[1], thinkEl[2],
  'return (()=>{' + thinkBody + '})();');
const called = [];
const reg = { getCommand: id => (id === 'toggle-thinking' ? { id, label: 'Thinking' } : undefined),
              executeCommand: id => called.push(id) };
const el = (comp, props) => ({ comp, props });
const row = think(reg, el, 'ROW');
assert.ok(row && row.comp === 'ROW' && row.props.command.id === 'toggle-thinking',
  'the thinking row is not drawn into the effort section');
assert.equal(typeof row.props.onClick, 'function', 'the thinking row has no click handler');
row.props.onClick();
assert.deepEqual(called, ['toggle-thinking'],
  'clicking the thinking row does not run the extension command');
assert.equal(think({ getCommand: () => undefined }, el, 'ROW'), null,
  'the thinking row is drawn even when the extension registered no such command');
// سوییچِ روشن/خاموش را خودِ دستورِ افزونه می‌سازد (`trailingComponent`)، پس ردیفِ
// ما نباید وضعیت را از خودش بسازد؛ نبودِ آن یعنی ردیف بی‌سوییچ است.
assert.ok(bundle.includes('currentModelSupportsThinkingOff'),
  'the extension no longer decides which models can turn thinking off');

// Sabotage: strip the fields the headers depend on. A renderer that still
// draws headers is reading a constant, not the catalog, and proves nothing.
assert.equal(draw(choices.map(({ group, familyLabel, ...rest }) => rest)).filter(n => n.kind === 'header').length, 0,
  'headers appear even without group/familyLabel on the models');

console.log('model groups: ' + rows.length + ' rows, ' + headers.length + ' headers, providers and families contiguous');
