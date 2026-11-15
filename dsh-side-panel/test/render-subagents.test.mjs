/**
 * آزمونِ رندرِ خرجِ ساب‌ایجنت‌ها (jsdom، fetch قلابی):
 * - قرصِ پایین، خرجِ خودِ چت را جدا و ساب‌ایجنت‌ها را جدا نشان می‌دهد.
 * - کارتِ «ساب‌ایجنت‌ها» جدولِ نام|کار|نوبت|مدل|… دارد، تودرتو با «↳».
 * - کارتِ خرج سه خط دارد: خودِ چت / ساب‌ایجنت‌ها / جمعِ کل.
 * - ستونِ «ساب‌ایجنت» در جدولِ «هر نوبت چه بود» و مدلِ «(ساب‌ایجنت)» در آمار.
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

const M = 'deepseek-v4.1-flash-1017'
const modelRow = (model, count, cost, over = {}) => ({ model, count, cost, pending: 0, unpriced: 0, input: 100, cached: 200, output: 50, ...over })
const sub = (over) => ({
  childId: 'c-' + Math.random().toString(16).slice(2), name: 'ds-x', label: 'کار', turn: 1, time: 1794700000000,
  found: true, requests: 10, priced: 10, pending: 0, total: 0.1, estimated: 0, unpriceable: 0,
  tokens: { input: 1000, cached: 5000, written: 0, output: 300 },
  byModel: [modelRow(M, 10, 0.1)], providers: ['DeepInfra'], depth: 0, parentId: null, ...over,
})

const payload = (over = {}) => ({
  sessionId: 'session-x', found: true, ts: 1, requests: 5, priced: 5, pending: 0, unpriceable: 0, noId: 0, estimated: 0,
  total: 2.8332, tokens: { input: 1000, cached: 2000, written: 0, output: 500 }, providers: ['DeepInfra'],
  waste: { total: 0, unknown: 0, byKind: {} },
  last: { turn: 1, step: 1, time: 1794700000000, model: M, cost: 0.5, pending: false, unpriceable: false, input: 10, cached: 20, output: 5, durationMs: 1000, tools: [], waste: 0, flags: [] },
  top: [], topBy: 'cost', wasteTop: [], list: [],
  turns: [
    { turn: 2, time: 1794700100000, cost: 0.3, requests: 2, waste: 0, trigger: { kind: 'حبیب', text: 'دومی' } },
    { turn: 1, time: 1794700000000, cost: 2.5, requests: 3, waste: 0, trigger: { kind: 'حبیب', text: 'اولی' } },
  ],
  byModel: [modelRow(M, 5, 2.8332)],
  subagents: [
    sub({ childId: 'aaaaaaaa-1', name: 'ds-traj', label: 'جدولی‌کردن تراژکتوری', turn: 1, total: 0.1599, time: 1794700000000 }),
    sub({ childId: 'bbbbbbbb-2', name: 'ds-test', label: 'آزمایش ساب‌ایجنت', turn: 1, total: 0.0026, time: 1794700001000 }),
    sub({ childId: 'cccccccc-3', name: 'ds-grand', label: 'نوه', turn: 2, total: 0.0041, depth: 1, parentId: 'aaaaaaaa-1', time: 1794700050000 }),
  ],
  subagentTotal: 0.1666,
  subagentPending: 0,
  subagentModels: [modelRow(M, 25, 0.1666)],
  grandTotal: 2.9998,
  ...over,
})

let loaded
const { createRequire: mkRequire } = await import('node:module')
const reactShare = mkRequire(new URL('../../package.json', import.meta.url))('react')
let reply = payload()
const context = vm.createContext({
  window: { __ModuleLoader__: { load(config) { loaded = config } }, localStorage: fakeLocalStorage },
  document: dom.window.document, console, setTimeout, clearTimeout, setInterval, clearInterval,
  getComputedStyle: dom.window.getComputedStyle.bind(dom.window), MutationObserver: dom.window.MutationObserver,
  localStorage: fakeLocalStorage, navigator: {},
  fetch: async (url) => {
    const target = String(url)
    if (target.includes('session-cost')) return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => reply }
    return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => ({ usage: 1, limit: 2, daily: 0.5 }) }
  },
  URL, URLSearchParams,
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
const pill = slots.find(s => s.options.name === 'conversation.composer.dock').component
const $ = (sel) => document.querySelector(sel)
const $$ = (sel) => [...document.querySelectorAll(sel)]
const clickEl = (el) => act(async () => { el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true })) })
const cardOf = (id) => document.querySelector('[data-card-id="' + id + '"]')

const root = createRoot(document.getElementById('root'))
await act(async () => { root.render(React.createElement('div', null, React.createElement(body, { sessionId: 'session-x' }), React.createElement(pill, { sessionId: 'session-x' }))) })
await act(async () => { await new Promise(r => setTimeout(r, 40)) })

// ---------- ۱) قرصِ پایین ----------
const pillEl = $('[data-side-panel-cost-pill]')
assert.ok(pillEl, 'pill renders')
const pillText = pillEl.textContent
assert.ok(pillText.includes('2.8332'), 'pill shows the main chat cost: ' + pillText)
assert.ok(pillText.includes('ساب‌ایجنت'), 'pill shows the subagent part: ' + pillText)
assert.ok(pillEl.querySelector('[data-pill="subagents"]'), 'subagent part is its own span')
assert.ok(/⁦\$2\.8332⁩/.test(pillText), 'own cost is LTR-isolated')
const tip = pillEl.getAttribute('title')
assert.ok(tip.includes('خرجِ خودِ این چت'), 'tooltip names the chat part')
assert.ok(tip.includes('خرجِ ساب‌ایجنت‌ها (۳ تا)'), 'tooltip names the subagent part with the count: ' + tip)
assert.ok(tip.includes('جمعِ کل'), 'tooltip has the grand total')

// ---------- ۲) کارتِ خرج: سه خط ----------
const spend = cardOf('spend')
assert.ok(spend, 'spend card renders')
assert.ok(spend.querySelector('[data-spend-line="own"]'), 'line: own chat')
assert.ok(spend.querySelector('[data-spend-line="subagents"]'), 'line: subagents')
assert.ok(spend.querySelector('[data-spend-line="grand"]'), 'line: grand total')
assert.ok(spend.querySelector('[data-spend-line="subagents"]').textContent.includes('۳ تا'), 'subagent line counts them in Persian digits')

// ---------- ۳) کارتِ ساب‌ایجنت‌ها: پیش‌فرض باز، جدول، تودرتو ----------
const card = cardOf('subagents')
assert.ok(card, 'subagents card exists with a stable id')
assert.equal(card.querySelector('[role="button"]').getAttribute('aria-expanded'), 'true', 'subagents card is open by default')
assert.ok(card.textContent.includes('ساب‌ایجنت‌ها (هر کدام چقدر خرج کرد)'), 'card title')
const headers = [...card.querySelectorAll('th')].map(th => th.textContent)
for (const name of ['نام', 'کار', 'نوبت', 'مدل', 'رفت‌وبرگشت', 'فرستاده', 'برگشت', 'خرج', 'وضعیت']) {
  assert.ok(headers.includes(name), 'subagent table header «' + name + '» must render')
}
const rows = [...card.querySelectorAll('tbody tr')]
assert.equal(rows.length, 3, 'one row per subagent')
assert.equal(rows[0].getAttribute('data-depth'), '0')
const nested = rows.find(r => r.getAttribute('data-depth') === '1')
assert.ok(nested, 'nested subagent row exists')
assert.ok(nested.textContent.includes('↳'), 'nested row is marked with ↳')
assert.ok(rows[0].textContent.includes('ds-traj'), 'name shown')
assert.ok(rows[0].textContent.includes('جدولی‌کردن تراژکتوری'), 'label shown')
assert.ok(rows[0].querySelectorAll('td')[3].getAttribute('style').includes('ltr'), 'model cell is ltr')
assert.ok(rows[0].textContent.includes('حساب شد'), 'status column filled')
// نوبتِ درست
assert.equal(rows[0].querySelectorAll('td')[2].textContent, '۱', 'turn 1 in Persian digits')

// ---------- ۴) ستونِ «ساب‌ایجنت» در جدولِ هر نوبت ----------
const turnsCard = cardOf('turns')
assert.ok(turnsCard, 'turns card exists')
// کارتِ هر نوبت پیش‌فرض بسته است ⇒ بازش کن تا جدول ساخته شود
await clickEl(turnsCard.querySelector('div[role="button"]'))
await act(async () => { await new Promise(r => setTimeout(r, 10)) })
const turnHeaders = [...turnsCard.querySelectorAll('th')].map(th => th.textContent)
assert.ok(turnHeaders.includes('ساب‌ایجنت'), 'turn table has a subagent column: ' + turnHeaders.join('|'))
const turnRows = [...turnsCard.querySelectorAll('tbody tr')]
const t1cell = turnsCard.querySelector('[data-turn-subagents="1"]')
assert.ok(t1cell, 'turn 1 has a subagent cell')
assert.ok(t1cell.textContent.includes('0.16'), 'turn 1 sums its two subagents: ' + t1cell.textContent)
const t2cell = turnsCard.querySelector('[data-turn-subagents="2"]')
assert.ok(t2cell.textContent.includes('0.00'), 'turn 2 has the nested one: ' + t2cell.textContent)
assert.ok(turnRows.length >= 2)

// ---------- ۵) آمار: مدلِ ساب‌ایجنت با برچسب ----------
await clickEl($$('button').find(b => b.textContent === 'آمار'))
await act(async () => { await new Promise(r => setTimeout(r, 30)) })
const subModelRow = $('[data-subagent-model]')
assert.ok(subModelRow, 'stats table has a subagent model row')
assert.ok(subModelRow.textContent.includes('(ساب‌ایجنت)'), 'marked as subagent')
assert.ok(subModelRow.textContent.includes(M), 'same model name still shown')

// ---------- ۶) وقتی ساب‌ایجنت نیست: قرص فقط عددِ خودِ چت، کارت پیامِ خالی ----------
reply = payload({ subagents: [], subagentTotal: 0, subagentPending: 0, subagentModels: [], grandTotal: 2.8332 })
await act(async () => { root.unmount() })
const root2 = createRoot(document.getElementById('root'))
await act(async () => { root2.render(React.createElement('div', null, React.createElement(body, { sessionId: 'session-y' }), React.createElement(pill, { sessionId: 'session-y' }))) })
await act(async () => { await new Promise(r => setTimeout(r, 40)) })
// بخشِ قبل «آمار» بود؛ برگرد به «تراژکتوری» تا کارت‌ها دوباره ساخته شوند.
await clickEl($$('button').find(b => b.textContent === 'تراژکتوری (به فارسی)'))
await act(async () => { await new Promise(r => setTimeout(r, 20)) })
const pill2 = $('[data-side-panel-cost-pill]')
assert.ok(!pill2.textContent.includes('ساب‌ایجنت'), 'no subagent part when there are none: ' + pill2.textContent)
assert.ok(!pill2.querySelector('[data-pill="subagents"]'))
assert.ok(cardOf('subagents').textContent.includes('هنوز ساب‌ایجنت‌ی'), 'empty state in Persian')
assert.ok(!cardOf('spend').querySelector('[data-spend-line="subagents"]'), 'no subagent line when none')

// ---------- ۷) قیمتِ در راه: قرص «…» می‌گذارد ----------
reply = payload({ subagents: [sub({ childId: 'z1', name: 'ds-z', label: 'در راه', pending: 4, priced: 0, total: 0 })], subagentTotal: 0, subagentPending: 4, subagentModels: [modelRow(M, 4, 0, { pending: 4 })], grandTotal: 2.8332 })
await act(async () => { root2.unmount() })
const root3 = createRoot(document.getElementById('root'))
await act(async () => { root3.render(React.createElement('div', null, React.createElement(body, { sessionId: 'session-z' }), React.createElement(pill, { sessionId: 'session-z' }))) })
await act(async () => { await new Promise(r => setTimeout(r, 40)) })
const pill3 = $('[data-side-panel-cost-pill]')
assert.ok(pill3.textContent.includes('…'), 'pending subagent prices add «…»: ' + pill3.textContent)
assert.ok(pill3.getAttribute('title').includes('هنوز در راه'), 'tooltip explains the pending prices')
assert.ok(cardOf('subagents').textContent.includes('قیمت در راه'), 'status column says «قیمت در راه»')

await act(async () => { root3.unmount() })
for (const off of disposers) if (typeof off === 'function') off()
dom.window.close()
console.log('render-subagents OK: قرصِ جدا برای ساب‌ایجنت + کارتِ جدولی + سه خطِ خرج + ستونِ نوبت + مدلِ ساب‌ایجنت')
