/**
 * آزمونِ رندرِ زندهٔ پنل با jsdom (effectها اجرا می‌شوند، fetch قلابی):
 * - تا قیمت‌ها «در راه»اند، جمع «ناقص» علامت می‌خورد (lead، ۰۱:۰۹: $0.35 ⇒ $0.69 ⇒ $1.91).
 * - جمعِ مدلی که قیمتش نیامده «$0» ِ دروغ نیست.
 * - «$» داخلِ جملهٔ فارسی جدا (LRI…PDI) می‌ماند.
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

const payload = (pending) => ({
  sessionId: 'session-x', found: true, ts: 1, requests: 3, priced: 3 - pending, pending, unpriceable: 0, noId: 0,
  total: 0.35, tokens: { input: 10, cached: 20, output: 5 }, providers: ['DeepInfra'],
  waste: { total: 0, unknown: 0, byKind: {} }, last: null, top: [], topBy: 'cost', wasteTop: [], turns: [], list: [],
  byModel: [
    { model: 'deepseek-v4-pro-0813', count: 2, cost: 0.35, pending: Math.max(0, pending - 1), unpriced: 0, input: 1, cached: 1, output: 1 },
    { model: 'deepseek-v4.1-flash-1017', count: 1, cost: 0, pending: pending > 0 ? 1 : 0, unpriced: 0, input: 1, cached: 1, output: 1 },
  ],
})
let pendingNow = 2
let loaded
const context = vm.createContext({
  window: { __ModuleLoader__: { load(config) { loaded = config } } },
  document: dom.window.document, console, setTimeout, clearTimeout, setInterval, clearInterval,
  getComputedStyle: dom.window.getComputedStyle.bind(dom.window), MutationObserver: dom.window.MutationObserver,
  fetch: async (url) => ({ ok: true, status: 200, json: async () => (String(url).includes('session-cost') ? payload(pendingNow) : { usage: 1, limit: 2, daily: 0.5 }) }),
  URL, URLSearchParams,
})
vm.runInContext(readFileSync(new URL('../client.js', import.meta.url), 'utf8'), context, { filename: 'client.js' })
const require = createRequire(new URL('../../package.json', import.meta.url))
const mod = loaded.factory(require)
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

const root = createRoot(document.getElementById('root'))
await act(async () => { root.render(React.createElement('div', null, React.createElement(body, { sessionId: 'session-x' }), React.createElement(pill, { sessionId: 'session-x' }))) })
await act(async () => { await new Promise(r => setTimeout(r, 20)) })
let text = document.body.textContent
assert.ok(text.includes('▲ ناقص — هنوز بالا می‌رود'), 'pending prices ⇒ total marked incomplete')
assert.ok(text.includes('قیمت در راه…'), 'model with no price yet shows «در راه», not $0')
assert.ok(text.includes('\u2066$0.3500\u2069'), 'money isolated LTR')
assert.ok(document.querySelector('[data-side-panel-cost-pill]').textContent.includes('$0.3500\u2069…'), 'pill shows … while incomplete')

pendingNow = 0
await act(async () => { root.render(React.createElement('div', null, React.createElement(body, { sessionId: 'session-y' }), React.createElement(pill, { sessionId: 'session-y' }))) })
await act(async () => { await new Promise(r => setTimeout(r, 20)) })
text = document.body.textContent
assert.ok(!text.includes('ناقص'), 'complete ⇒ no incomplete marker')
assert.ok(text.includes('عدد دقیق است'), 'complete ⇒ exact')
await act(async () => { root.unmount() })
for (const off of disposers) if (typeof off === 'function') off() // تایمرِ چیدمان و کلیک‌گیر
dom.window.close()
console.log('render OK: ناقص تا قیمت‌ها برسد + مدلِ بی‌قیمت «در راه» + $ جدا')
