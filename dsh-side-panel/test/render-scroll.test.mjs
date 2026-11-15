/**
 * آزمونِ «پرش» (حبیب: «وقتی لاگِ جدید میاد پرش می‌کنه جدول‌ها و اگه پایین باشم میاد بالا»).
 * pollِ واقعی شبیه‌سازی می‌شود: همان تایمرِ setInterval دستی زده می‌شود (بدونِ انتظارِ ۳ ثانیه).
 * - قاب و ناحیهٔ اسکرول دوبر ساخته نمی‌شوند؛ scrollTop همان می‌ماند.
 * - ردیف‌های قبلی همان عنصرِ DOM می‌مانند (کلیدِ پایدار).
 * - یک دورِ خطا، دادهٔ سالمِ قبلی و جای اسکرول را حفظ می‌کند.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import { JSDOM } from 'jsdom'

const dom = new JSDOM('<!doctype html><html dir="rtl"><head></head><body><div id="root"></div></body></html>', { pretendToBeVisual: true })
globalThis.window = dom.window
globalThis.document = dom.window.document
globalThis.IS_REACT_ACT_ENVIRONMENT = true

const store = new Map()
const fakeLocalStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => { store.set(k, String(v)) },
  removeItem: (k) => { store.delete(k) },
  clear: () => store.clear(),
}

const wait = (ms) => new Promise(r => setTimeout(r, ms))
const MODEL = 'deepseek-v4.1-flash-1017'
const modelRow = (model, count, cost) => ({ model, count, cost, pending: 0, unpriced: 0, input: 100, cached: 200, output: 50 })
const tripRow = (over = {}) => ({
  turn: 1, step: 1, time: 1794700000000, model: MODEL, cost: 0.0123, pending: false, unpriceable: false,
  input: 1000, cached: 20000, output: 300, durationMs: 2000, tools: ['bash'], waste: 0, flags: [], ...over,
})

/** مثلِ بدنهٔ JSONِ واقعی: هر دور شیءهای نو (نه همان شیءِ قبلی). */
function payload(n) {
  return JSON.parse(JSON.stringify({
    sessionId: 'session-x', found: true, ts: n, requests: n, priced: n, pending: 0, unpriceable: 0, noId: 0, estimated: 0,
    total: 0.01 * n, tokens: { input: 100, cached: 200, output: 50 }, providers: ['DeepInfra'],
    waste: { total: 0, unknown: 0, byKind: {} },
    last: tripRow(), top: [tripRow()], topBy: 'cost', wasteTop: [],
    byModel: [modelRow(MODEL, n, 0.01 * n)],
    turns: Array.from({ length: n }, (_, i) => ({ turn: n - i, time: 1794700000000 + i, cost: 0.01, requests: 1, waste: 0, trigger: { kind: 'حبیب', text: 'پیامِ ' + (n - i) } })),
    list: Array.from({ length: n }, (_, i) => tripRow({ turn: n - i, step: 1, responseId: 'gen-' + (n - i) })),
    subagents: Array.from({ length: Math.min(n, 3) }, (_, i) => ({
      childId: 'c-' + i, name: 'ds-' + i, label: 'کارِ ' + i, turn: 1, time: 1794700000000 + i,
      found: true, requests: 5, priced: 5, pending: 0, total: 0.01, estimated: 0, unpriceable: 0,
      tokens: { input: 10, cached: 20, written: 0, output: 5 }, byModel: [modelRow(MODEL, 5, 0.01)], providers: ['DeepInfra'], depth: 0, parentId: null,
    })),
    subagentTotal: 0.03, subagentPending: 0, subagentModels: [modelRow(MODEL, 15, 0.03)], grandTotal: 0.03 + 0.01 * n,
  }))
}

let loaded
const reactShare = createRequire(new URL('../../package.json', import.meta.url))('react')

// تایمرها را خودمان می‌زنیم: pollِ هر ۳ ثانیه را دستی اجرا می‌کنیم.
const pollers = []
const setIntervalSpy = (fn, ms) => { const t = { fn, ms, id: pollers.length }; pollers.push(t); return t.id }
const clearIntervalSpy = (id) => { const t = pollers.find(p => p.id === id); if (t) t.fn = null }
const runPolls = async () => {
  for (const p of pollers) if (typeof p.fn === 'function') p.fn()
  await wait(40)
}

let round = 3
let failNext = false
const context = vm.createContext({
  window: { __ModuleLoader__: { load(config) { loaded = config } }, localStorage: fakeLocalStorage },
  document: dom.window.document, console, setTimeout, clearTimeout,
  setInterval: setIntervalSpy, clearInterval: clearIntervalSpy,
  getComputedStyle: dom.window.getComputedStyle.bind(dom.window), MutationObserver: dom.window.MutationObserver,
  localStorage: fakeLocalStorage, navigator: {},
  fetch: async () => {
    if (failNext) { failNext = false; throw new Error('شبکه قطع شد') }
    return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => payload(round) }
  },
  URL, URLSearchParams, requestAnimationFrame: (fn) => setTimeout(fn, 0),
})
const require = createRequire(new URL('../../package.json', import.meta.url))
vm.runInContext(readFileSync(new URL('../client.js', import.meta.url), 'utf8'), context, { filename: 'client.js' })
const mod = loaded.factory((name) => (name === 'react' ? reactShare : require(name)))
const slots = []
const disposers = []
mod.apply({
  effect(fn) { const off = fn(); disposers.push(off); return off },
  sidebarRightTabs: { register() { return () => {} } },
  sidebarRight: { openTab() {} },
  layout: { openRightbar() {}, selectPanel() {} },
  uiConversation: null,
  slots: { inject(name, fn) { return fn() }, register(options, component) { slots.push({ options, component }); return () => {} }, entries() { return [] } },
})
const React = require('react')
const { createRoot } = require('react-dom/client')
const { act } = require('react')
const body = slots.find(s => s.options.name === 'sidebar.right.pane.tab').component
const $ = (sel) => document.querySelector(sel)
const $$ = (sel) => [...document.querySelectorAll(sel)]
const clickEl = (el) => act(async () => { el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true })) })

const root = createRoot(document.getElementById('root'))
await act(async () => { root.render(React.createElement(body, { sessionId: 'session-x' })) })
await act(async () => { await wait(60) })

// جدول‌ها را باز کن: «هر نوبت» و «همهٔ رفت‌وبرگشت‌ها» پیش‌فرض بسته‌اند
await clickEl($('[data-card-id="turns"]').querySelector('div[role="button"]'))
await clickEl($('[data-card-id="all"]').querySelector('div[role="button"]'))
await act(async () => { await wait(30) })

// ---------- ۱) شروع ----------
const panelRoot = $('[data-side-panel=""]')
assert.ok(panelRoot, 'ناحیهٔ اسکرول هست')
assert.ok(pollers.some(p => p.ms === 3000), 'poll هر ۳ ثانیه ثبت شده')
panelRoot.scrollTop = 420
const before = $$('[data-card-id="all"] tbody tr')
assert.equal(before.length, 3, 'سه ردیفِ اول')

// ---------- ۲) یک دورِ poll تازه: دادهٔ بیشتری می‌آید ----------
round = 8
await act(async () => { await runPolls() })
assert.equal($('[data-side-panel=""]'), panelRoot, 'قاب دوباره ساخته نشد')
assert.equal($('[data-side-panel=""]').scrollTop, 420, 'جای اسکرول نپرید')
const after = $$('[data-card-id="all"] tbody tr')
assert.equal(after.length, 8, 'ردیف‌های تازه آمدند')
// ردیف‌های قبلی همان عنصرِ DOM مانده‌اند (کلیدِ پایدار، نه شمارندهٔ فهرست)
for (const el of before) assert.ok(after.includes(el), 'هیچ ردیفِ قبلی‌ای از نو ساخته نشد')

// ---------- ۳) یک دورِ خطا: جدول‌ها خالی نمی‌شوند، اسکرول نمی‌پرد ----------
panelRoot.scrollTop = 300
failNext = true
await act(async () => { await runPolls() })
assert.equal($('[data-side-panel=""]'), panelRoot, 'قابِ همان می‌ماند')
assert.equal($('[data-side-panel=""]').scrollTop, 300, 'خطای یک دور، اسکرول را نمی‌پراند')
assert.equal($$('[data-card-id="all"] tbody tr').length, 8, 'دادهٔ سالمِ قبلی پاک نشد')
assert.ok(!$('[data-spend-line="own"]').textContent.includes('در حالِ خواندن'), 'کارتِ خرج به «در حالِ خواندن» برنگشت')

await act(async () => { root.unmount() })
for (const off of disposers) if (typeof off === 'function') off()
dom.window.close()
console.log('render-scroll OK: pollِ دستی + قاب ثابت + اسکرول ثابت + ردیف‌های پایدار + خطای یک دور بی‌پرش')
