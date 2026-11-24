// Execute the installed extension's startup and cached-picker methods with synthetic data.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const extDir = path.join(os.homedir(), '.vscode/extensions');
const registered = JSON.parse(fs.readFileSync(path.join(extDir, 'extensions.json'), 'utf8'));
const active = registered.find(e => e.identifier.id === 'anthropic.claude-code');
const file = process.argv[2] || path.join(extDir, active.relativeLocation, 'extension.js');
const text = fs.readFileSync(file, 'utf8');
const catalog = JSON.parse(fs.readFileSync(path.join(__dirname,'../claude-api/deepseek-models.json'),'utf8'));
const stale = {models:[{value:'old-model',displayName:'Old'}],unavailable_models:[{value:'old-unavailable'}],
  commands:[{name:'fixture'}],capabilities:{fixture:true},account:{apiProvider:'anthropic'}};

function method(start, end) {
  const a = text.indexOf(start), b = text.indexOf(end, a + start.length);
  assert(a >= 0 && b > a, 'method anchors: ' + start);
  return text.slice(a,b);
}

function instance(body, bindings = {}) {
  const Class = new Function('require', ...Object.keys(bindings), 'return class {' + body + '}')(require, ...Object.values(bindings));
  return new Class();
}

function check(config) {
  const ids = config.models.map(model => model.value);
  assert.equal(ids.length, catalog.length + catalog.filter(x => x.openRouterModel).length);
  assert.equal(new Set(ids).size, ids.length);
  for (const row of catalog) {
    if (!row.openRouterModel) {
      assert(ids.includes(row.value));
      continue;
    }
    assert(config.models.some(m => m.value === row.openRouterModel && m.displayName === row.displayName + ' — OpenRouter API Key'));
    assert(config.models.some(m => m.value === 'anthropic-api/' + row.value && m.displayName === row.displayName + ' — Anthropic API Key'));
  }
  assert.deepEqual(config.unavailable_models, []);
  assert.deepEqual(config.commands, stale.commands);
}

async function run() {
  const q = instance(method('async initialize({first:e}', 'buildInitializeRequest(e){'));
  Object.assign(q,{initializeHasBeenWritten:true,sdkMcpToolsChangedDuringCapture:new Set(),
    buildInitializeRequest:()=>({subtype:'initialize'}),request:async()=>({response:structuredClone(stale)}),hasHookSetToBlock:()=>false});
  check(await q.initialize());

  const modern = text.includes('draw(e){let t=') && !text.includes('read(e){let t=this.record(),n=this.login.current();');
  const cached = modern ? method('draw(e){let t=', 'keep(e,t,n){') : method('read(e){let t=this.record(),n=this.login.current();','keep(e,t){');
  const schema = cached.match(/([\w$]+)\.safeParse\(/)[1];
  const cache = instance(cached,{[schema]:{safeParse: data => ({success:true,data})}});
  const record = () => ({login:'fixture', cwd:'/project',config:structuredClone(stale)});
  Object.assign(cache,{record, login:{current:()=> 'fixture'},forget(){throw Error('unexpected forget');}});
  check(modern ? cache.draw(record()) : cache.read('/project'));

  const seed = instance(method('adoptStartupSeed(e=this.surfaceCwd())','startFallbackProbe(e){'));
  Object.assign(seed,{isLoginInFlight:()=>false,peerStartupSeed:()=>record()});
  seed.adoptStartupSeed('/project');
  check(await seed.config);

  const sdk = instance(method('async supportedModels()', 'async supportedAgents()'));
  sdk.initialization = Promise.resolve(stale);
  check({...stale, models:await sdk.supportedModels(), unavailable_models:[]});

  const live = text.match(/\{models:(require\("[^"]+vscode_model_catalog\.cjs"\)\.modelChoices\(\)),unavailable_models:\[\]/);
  assert(live, 'running-channel initialization must refresh models');
  check({...stale, models:new Function('require','return '+live[1])(require), unavailable_models:[]});
  console.log(path.basename(path.dirname(file)) + ': startup, cache, peer, SDK, live list OK');
}

run().catch(error => { console.error(error.message); process.exitCode = 1; });
