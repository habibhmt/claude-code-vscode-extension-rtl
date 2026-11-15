/**
 * آزمونِ کرکرهٔ پهنا (jsdom): دکمه باز/بسته می‌کند، اسلایدر بازه دارد،
 * کلیکِ پیش‌فرض عرض را ذخیره می‌کند و روی صفحه اعمال می‌شود.
 * jsdom چیدمان ندارد ⇒ اندازه‌ها را خودمان جا می‌زنیم (rectهای قلابی).
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

const payload = () => ({
  sessionId: 'session-x', found: true, ts: 1, requests: 0, priced: 0, pending: 0, unpriceable: 0, noId: 0, estimated: 0,
  total: 0, tokens: { input: 0, cached: 0, written: 0, output: 0 }, providers: [], waste: { total: 0, unknown: 0, byKind: {} },
  last: null, top: [], topBy: 'cost', wasteTop: [], turns: [], list: [], byModel: [],
  subagents: [], subagentTotal: 0, subagentPending: 0, subagentModels: [], grandTotal: 0,
})

let loaded
const { createRequire: mkRequire } = await import('node:module')
const reactShare = mkRequire(new URL('../../package.json', import.meta.url))('react')
const context = vm.createContext({
  window: { __ModuleLoader__: { load(config) { loaded = config } }, localStorage: fakeLocalStorage },
  document: dom.window.document, console, setTimeout, clearTimeout, setInterval, clearInterval,
  getComputedStyle: dom.window.getComputedStyle.bind(dom.window), MutationObserver: dom.window.MutationObserver,
  localStorage: fakeLocalStorage, navigator: {},
  fetch: async () => ({ ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => payload() }),
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

// ---------- چیدمانِ قلابی: قاب ۱۶۰۰ پیکسل، سایدبار ۲۸۰، پنل ۵۲۰ ----------
const FRAME_W = 1600
const SIDEBAR = 280
// eslint-disable-next-line no-undef -- مالِ همین آزمون است
const layout = { colWidth: 520, handleLeft: 0 }
const frame = document.createElement('div')
frame.setAttribute('data-sp-layout', '')
frame.style.gridTemplateColumns = SIDEBAR + 'px minmax(360px, 1fr) minmax(0px, 520px)'
const col = document.createElement('div')
col.setAttribute('data-rightbar-col', '')
const handle = document.createElement('div')
handle.setAttribute('data-side', 'rightbar')
handle.style.left = '1080px'
frame.append(col, handle)
document.body.append(frame)
frame.getBoundingClientRect = () => ({ left: 0, top: 0, width: FRAME_W, height: 800, right: FRAME_W, bottom: 800, x: 0, y: 0 })
col.getBoundingClientRect = () => ({ left: FRAME_W - layout.colWidth, top: 0, width: layout.colWidth, height: 800, right: FRAME_W, bottom: 800, x: 0, y: 0 })
// کشیدنِ ساختگیِ دسته: مثلِ خودِ اپ، عرضِ پنل را عوض می‌کند (به راست ⇒ باریک‌تر).
let drags = 0
handle.addEventListener('pointerdown', (e) => { handle.__x0 = e.clientX })
handle.addEventListener('pointerup', (e) => {
  drags += 1
  const dx = e.clientX - (handle.__x0 ?? e.clientX)
  layout.colWidth = Math.max(300, Math.min(FRAME_W - SIDEBAR - 400, layout.colWidth - dx))
})

const root = createRoot(document.getElementById('root'))
await act(async () => { root.render(React.createElement(body, { sessionId: 'session-x' })) })
await act(async () => { await new Promise(r => setTimeout(r, 30)) })

// ---------- ۱) دکمه هست و کرکره بسته است ----------
const toggle = $('[data-width-toggle]')
assert.ok(toggle, 'پهنا button exists')
assert.equal(toggle.textContent, 'پهنا ⇔')
assert.equal(toggle.getAttribute('aria-expanded'), 'false')
assert.equal($('[data-width-shutter]'), null, 'کرکره پیش‌فرض بسته است')

// ---------- ۲) کلیک ⇒ کرکره باز می‌شود، اسلایدر با بازه ----------
await clickEl(toggle)
await act(async () => { await new Promise(r => setTimeout(r, 10)) })
assert.ok($('[data-width-shutter]'), 'کرکره باز شد')
assert.equal($('[data-width-toggle]').getAttribute('aria-expanded'), 'true')
const range = $('[data-width-range]')
assert.ok(range, 'اسلایدر هست')
assert.equal(range.getAttribute('min'), '300', 'کمینه ۳۰۰')
assert.equal(range.getAttribute('max'), String(FRAME_W - SIDEBAR - 400), 'بیشینه = قاب − سایدبار − ۴۰۰')
// عددِ فارسی کنارِ اسلایدر
assert.ok(/پهنا: [۰-۹]+ پیکسل/.test($('[data-width-label]').textContent), 'عددِ فارسی: ' + $('[data-width-label]').textContent)

// ---------- ۳) پیش‌فرض‌ها: کلیک روی «باریک» ⇒ عرض عوض و ذخیره می‌شود ----------
const narrow = $('[data-width-preset="360"]')
assert.ok(narrow, 'دکمهٔ «باریک» هست')
await clickEl(narrow)
await act(async () => { await new Promise(r => setTimeout(r, 30)) })
assert.equal(store.get('dsh-side-panel/width'), '360', 'عرض در حافظهٔ مرورگر ذخیره شد')
assert.equal(drags, 1, 'دسته یک بار کشیده شد')
assert.ok(Math.abs(layout.colWidth - 360) < 2, 'پنل واقعاً باریک شد: ' + layout.colWidth)

// ---------- ۴) «بیشترین» ⇒ سقفِ مجاز ----------
await clickEl($$('[data-width-preset]').find(b => b.textContent === 'بیشترین'))
await act(async () => { await new Promise(r => setTimeout(r, 30)) })
assert.equal(store.get('dsh-side-panel/width'), String(FRAME_W - SIDEBAR - 400), 'بیشترین = سقف')
assert.ok(Math.abs(layout.colWidth - (FRAME_W - SIDEBAR - 400)) < 2)

// ---------- ۵) اسلایدر: مقدار بیرون از بازه به بازه آورده می‌شود ----------
const rangeEl = $('[data-width-range]')
await act(async () => {
  rangeEl.value = '5000'
  rangeEl.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
})
await act(async () => { await new Promise(r => setTimeout(r, 40)) })
const saved = Number(store.get('dsh-side-panel/width'))
assert.ok(saved <= FRAME_W - SIDEBAR - 400, 'خارج از بازه ذخیره نمی‌شود: ' + saved)
assert.ok(saved >= 300)

// ---------- ۶) کلیکِ دوباره ⇒ کرکره بسته ----------
await clickEl($('[data-width-toggle]'))
await act(async () => { await new Promise(r => setTimeout(r, 10)) })
assert.equal($('[data-width-shutter]'), null, 'کرکره بسته شد')

// ---------- ۷) بی قاب (پنل پیدا نشد) ⇒ پیامِ ساده، نه خطا ----------
frame.remove()
await clickEl($('[data-width-toggle]'))
await act(async () => { await new Promise(r => setTimeout(r, 10)) })
const shutter = $('[data-width-shutter]')
assert.ok(shutter, 'کرکره باز می‌شود حتی بی قاب')
assert.ok(shutter.textContent.includes('پنل را باز کنید'), 'پیامِ ساده: ' + shutter.textContent)

await act(async () => { root.unmount() })
for (const off of disposers) if (typeof off === 'function') off()
dom.window.close()
console.log('render-width OK: کرکرهٔ پهنا باز/بسته + اسلایدر + پیش‌فرض‌ها + ذخیره + پیامِ بی‌قاب')
