import assert from 'node:assert/strict'
const R = await import(process.argv[2] || new URL('./hooks/register.js', import.meta.url))
const javab = [{ isAnswered: false, reason: 'api-error', usage: {} }, { isAnswered: true, usage: {}, text: '{"text":"-","fekr":{"fekr":"الف","kard":"ب","bad":"پ"}}' }]
let forks = 0, sabr = 0; const daftar = [], prompts = []
const $ = { session: { id: async () => 'T', usage: async () => ({ context: { tokens: 1 } }) }, env: { get: async () => '/h' },
  fs: { read: async (f) => f.includes('hads-on') ? 'on' : '{}', write: async () => {} },
  clock: { now: async () => 1, after: (ms, fn) => { sabr = ms; fn() } },
  model: { fork: async (o) => { prompts.push(o.prompt); return javab[forks++] || javab[0] } },
  process: { run: async (a, o) => { daftar.push(o?.stdin || '') } }, ui: { invalidate() {} } }
assert.equal(await R.fekr_vasat($, true), true, 'بعد از api-error دوباره بفرستد')
assert.equal(forks, 2); assert.equal(sabr, R.fekr_dobare_ms)
forks = 0; javab[1] = javab[0]
assert.equal(await R.fekr_vasat($, true), false); assert.equal(forks, 2, 'فقط یک بار دوباره')
assert.ok(daftar.some((x) => /"dobare":true/.test(x)))
console.log('dobare: ok')
