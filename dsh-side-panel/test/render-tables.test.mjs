/**
 * آزمونِ رندرِ جدول‌ها + بالا/پایین‌کردنِ کارت‌ها + دادهٔ خام (jsdom، fetch قلابی).
 * - «تراژکتوری» جدول دارد: سرِ ستون «نوبت»، ردیفِ قرمز data-waste="red".
 * - ▲/▼ جای کارت‌ها را در صفحه عوض می‌کند و در localStorage می‌ماند.
 * - کارتِ «دادهٔ خامِ کامل» با باز‌شدن fetch می‌کند و «نمایش» کلِ JSON را می‌ریزد.
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

// حافظهٔ قلابیِ مرورگر (بی فایل، بی مرورگر)
const store = new Map()
const fakeLocalStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => { store.set(k, String(v)) },
  removeItem: (k) => { store.delete(k) },
  clear: () => store.clear(),
}
const clip = []
const fakeNavigator = { clipboard: { writeText: async (text) => { clip.push(text) } } }

const row = (over = {}) => ({
  turn: 1, step: 1, time: 1794700000000, model: 'deepseek-v4.1-flash-1017', cost: 0.0123, pending: false, unpriceable: false,
  input: 1000, cached: 20000, output: 300, durationMs: 2000, tools: ['bash'], waste: 0,
  flags: [{ kind: 'dropped', level: 'red', text: 'سرورِ DeepInfra کش را نگه نداشت', waste: 0.004 }, { kind: 'pro', level: 'amber', text: 'مدلِ گران (pro)' }],
  ...over,
})
const payload = () => ({
  sessionId: 'session-x', found: true, ts: 1, requests: 2, priced: 2, pending: 0, unpriceable: 0, noId: 0,
  total: 0.02, tokens: { input: 2000, cached: 40000, output: 600, written: 0 }, providers: ['DeepInfra'],
  waste: { total: 0.004, unknown: 0, byKind: { dropped: { kind: 'dropped', level: 'red', count: 1, usd: 0.004, cost: 0.0123 } } },
  last: row(),
  top: [row()],
  topBy: 'cost',
  wasteTop: [row()],
  turns: [{ turn: 1, time: 1794700000000, cost: 0.02, requests: 2, waste: 0.004, trigger: { kind: 'حبیب', text: 'سلام' } }],
  list: [row(), row({ turn: 1, step: 2, flags: [{ kind: 'pro', level: 'amber', text: 'مدلِ گران (pro)' }] })],
  byModel: [{ model: 'deepseek-v4.1-flash-1017', count: 2, cost: 0.02, pending: 0, unpriced: 0, input: 2000, cached: 40000, output: 600 }],
})

// دادٔ خام: دو خط — یکی JSONِ بزرگ، یکی خراب
const RAW_LINE = JSON.stringify({
  type: 'assistant/message', seq: 7, time: 1794700000000,
  data: { turn: 1, step: 2, message: { role: 'assistant', content: [{ type: 'text', text: 'سلام حبیب، همه‌چیز خوب است ✓' }] } },
})
const RAW_BROKEN = 'نیمه‌خط خراب {'
const rawAnswer = {
  sessionId: 'session-x', found: true, totalAll: 2, total: 2, from: 0, limit: 50,
  lines: [
    { index: 0, seq: 7, time: 1794700000000, type: 'assistant/message', bytes: Buffer.byteLength(RAW_LINE, 'utf8'), text: RAW_LINE },
    { index: 1, bytes: Buffer.byteLength(RAW_BROKEN, 'utf8'), text: RAW_BROKEN },
  ],
}
let rawStatus = 200
let rawCalls = []

let loaded
// یک نسخهٔ react برای هر دو طرف
const { createRequire: mkRequire } = await import('node:module')
const reactShare = mkRequire(new URL('../../package.json', import.meta.url))('react')
const context = vm.createContext({
  window: { __ModuleLoader__: { load(config) { loaded = config } }, localStorage: fakeLocalStorage },
  document: dom.window.document, console, setTimeout, clearTimeout, setInterval, clearInterval,
  getComputedStyle: dom.window.getComputedStyle.bind(dom.window), MutationObserver: dom.window.MutationObserver,
  localStorage: fakeLocalStorage, navigator: fakeNavigator,
  fetch: async (url) => {
    const target = String(url)
    if (target.includes('/raw-log')) {
      rawCalls.push(target)
      if (rawStatus !== 200) return { ok: false, status: rawStatus, headers: { get: () => null }, json: async () => { throw new Error('not json') } }
      return { ok: true, status: 200, headers: { get: () => 'application/json; charset=utf-8' }, json: async () => rawAnswer }
    }
    return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => (target.includes('session-cost') ? payload() : { usage: 1, limit: 2, daily: 0.5 }) }
  },
  URL, URLSearchParams,
})
const require = createRequire(new URL('../../package.json', import.meta.url))
// reactِ همین require را داخلِ vm هم می‌گذاریم: فکتوری از این استفاده می‌کند و یک نسخه‌اند.
context.reactShare = require('react')
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

/** کلیکِ واقعیِ jsdom روی اولین عنصری که شرط را دارد. */
async function clickEl(el) {
  assert.ok(el, 'element to click must exist')
  return act(async () => { el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true })) })
}
const $ = (sel) => document.querySelector(sel)
const $$ = (sel) => [...document.querySelectorAll(sel)]
const cardIds = () => $$('[data-card-order]').map(el => el.getAttribute('data-card-order'))
const cardOf = (id) => document.querySelector('[data-card-id="' + id + '"]')

const root = createRoot(document.getElementById('root'))
await act(async () => { root.render(React.createElement(body, { sessionId: 'session-x' })) })
await act(async () => { await new Promise(r => setTimeout(r, 30)) })

// ۱) جدول‌ها
const headers = $$('th').map(th => th.textContent)
for (const name of ['نوبت', 'گام', 'ساعت', 'خرج', 'فرستاده (توکن)', 'از کش', 'برگشت', 'زمان', 'ابزار', 'چرا']) {
  assert.ok(headers.includes(name), 'table header «' + name + '» must render')
}
const red = $('tr[data-waste="red"]')
assert.ok(red, 'a red row must render with data-waste="red"')
assert.ok(red.textContent.includes('کش را نگه نداشت'), 'flag text lives in the «چرا» cell')
assert.ok(red.textContent.includes('الکی:'), 'red row shows its waste money')
assert.ok(red.querySelectorAll('td').length === 10, 'red row has all ten cells')
assert.ok(!document.querySelector('tr[data-waste="amber"]'), 'row with only amber flags is not red')
const whyCell = red.querySelectorAll('td')[9]
assert.ok(whyCell.textContent.includes('مدلِ گران'), 'amber + red flags of one row share the «چرا» cell')

// ۱ب) کارتِ «الان چه خبر است»: خرج = جمعِ کلِ نوبت تا الان، نه فقط همین گام
// (حبیب ۱۵ نوامبر: «باید کل نوبت ۴۳ رو همه گامهاشو خرجشو تا الان بزنه»)
const soFar = $('[data-turn-so-far="1"]')
assert.ok(soFar, 'now card shows the turn-so-far cost cell')
assert.ok(soFar.querySelector('b').textContent.includes('0.0200'), 'bold value is the whole turn (0.02), not the step (0.0123): ' + soFar.textContent)
assert.ok(soFar.textContent.includes('۲ گام') && soFar.textContent.includes('این گام'), 'shows step count and this step: ' + soFar.textContent)
assert.ok($$('th').some(th => th.textContent === 'خرجِ کلِ نوبت تا الان'), 'now card header says the whole turn')
assert.equal($$('[data-turn-so-far]').length, 1, 'only the now card is cumulative; other tables keep per-step cost')

// ۲) ▲/▼: دکمه‌ها کارت را جابه‌جا می‌کنند و در حافظه می‌مانند
const before = cardIds()
assert.ok(before.includes('spend') && before.includes('now'), 'cards have stable ids')
assert.equal(before[0], 'waste', 'waste card is first by default')
assert.ok($('[data-card-order="waste"] [data-move="up"]').disabled, 'first card ▲ is disabled')
const lastId = before[before.length - 1]
assert.equal(lastId, 'raw', 'raw card is last by default')
assert.ok($('[data-card-order="raw"] [data-move="down"]').disabled, 'last card ▼ is disabled')
const downBtn = $('[data-card-order="spend"] [data-move="down"]')
await clickEl(downBtn)
const after = cardIds()
assert.notDeepEqual(after, before, 'DOM order changes after ▼')
assert.equal(after.indexOf('spend'), before.indexOf('spend') + 1, 'spend moved one place down')
const savedOrder = JSON.parse(store.get('dsh-side-panel/order/trajectory'))
assert.deepEqual(savedOrder, after, 'order persisted to localStorage')
// دکمهٔ ▲ کارت را به جایش برمی‌گرداند
await clickEl($('[data-card-order="spend"] [data-move="up"]'))
assert.deepEqual(cardIds(), before, '▲ undoes it')
assert.deepEqual(JSON.parse(store.get('dsh-side-panel/order/trajectory')), before)
// کلیکِ دکمه کارت را باز/بسته نمی‌کند
assert.ok(!store.has('dsh-side-panel/open/spend'), 'move buttons must not toggle the card')
assert.equal($('[data-card-order="spend"] [role="button"]').getAttribute('aria-expanded'), 'true')

// ۳) دادهٔ خامِ کامل: با بازکردن کارت fetch می‌شود، «نمایش» کلِ JSON را می‌ریزد
// کارتِ دادهٔ خام پیش‌فرض بسته است؛ اگر حافظه از قبل باز بودنش را نگفته باشد، باید بی‌درخواست بماند.
assert.equal(store.get('dsh-side-panel/open/raw'), undefined)
assert.equal(rawCalls.length, 0, 'raw card fetches nothing while closed')
await clickEl(cardOf('raw').querySelector('div[role="button"]'))
await act(async () => { await new Promise(r => setTimeout(r, 30)) })
assert.ok(rawCalls.length >= 1, 'raw card fetches on open')
assert.ok(rawCalls[rawCalls.length - 1].startsWith('/plugins/side-panel/raw-log?'), 'fetches the host route: ' + rawCalls[rawCalls.length - 1])
assert.ok(rawCalls[rawCalls.length - 1].includes('sessionId=session-x'))
assert.ok(document.body.textContent.includes('کل: ۲ خط'), 'line count shown')
assert.ok(cardOf('raw').querySelector('input[placeholder="جست‌وجو در دادهٔ خام…"]'), 'search box')
assert.ok(cardOf('raw').querySelector('a[href*="download=1"]'), 'download link to the whole file')
const showBtn = $$('button').find(b => b.textContent === 'نمایش')
assert.ok(showBtn, '«نمایش» button per line')
await clickEl(showBtn)
const pre = $('tr[data-line-pre="0"] pre')
assert.ok(pre, 'expanded row has a <pre>')
assert.equal(pre.getAttribute('dir'), 'ltr')
assert.equal(pre.textContent, JSON.stringify(JSON.parse(RAW_LINE), null, 2), 'pre holds the full pretty JSON')
assert.ok(pre.textContent.includes('سلام حبیب، همه‌چیز خوب است ✓'), 'no character is lost')
const copyBtn = $$('button').find(b => b.textContent === 'کپی')
assert.ok(copyBtn, '«کپی» button')
await clickEl(copyBtn)
await act(async () => { await new Promise(r => setTimeout(r, 5)) })
assert.deepEqual(clip, [RAW_LINE], 'copies the raw line, untouched')
// خطِ خراب: همان متنِ خام، بی خطا
const showBtns = $$('button').filter(b => b.textContent === 'نمایش')
await clickEl(showBtns[0])
const brokenPre = $('tr[data-line-pre="1"] pre')
assert.ok(brokenPre && brokenPre.textContent === RAW_BROKEN, 'broken JSON shows the raw text')

// ۴) hostِ قدیم (۴۰۴) ⇒ پیامِ ساده برای حبیب (ری‌مانتِ کامل، مثلِ بازکردنِ دوبارهٔ پنل)
await act(async () => { root.unmount() })
const root2 = createRoot(document.getElementById('root'))
rawStatus = 404
store.delete('dsh-side-panel/open/raw')
await act(async () => { root2.render(React.createElement(body, { sessionId: 'session-x' })) })
await act(async () => { await new Promise(r => setTimeout(r, 10)) })
await clickEl(cardOf('raw').querySelector('div[role="button"]'))
await act(async () => { await new Promise(r => setTimeout(r, 30)) })
assert.ok(cardOf('raw').textContent.includes('برای دیدنِ دادهٔ خام، اپ یک بار بسته و باز شود'), 'friendly hint for the old host')

await act(async () => { root2.unmount() })

// ۵) بخشِ آمار: «به تفکیکِ مدل» جدول است و کارتِ «دادهٔ خامِ آمار» همان snapshotِ کامل را نشان می‌دهد
const root3 = createRoot(document.getElementById('root'))
rawStatus = 200
await act(async () => { root3.render(React.createElement(body, { sessionId: 'session-x' })) })
await act(async () => { await new Promise(r => setTimeout(r, 20)) })
await clickEl($$('button').find(b => b.textContent === 'آمار'))
await act(async () => { await new Promise(r => setTimeout(r, 20)) })
const statsHeaders = $$('th').map(th => th.textContent)
for (const name of ['مدل', 'بار', 'خرج', 'ورودیِ تازه', 'از کش', 'خروجی']) {
  assert.ok(statsHeaders.includes(name), 'stats table header «' + name + '» must render')
}
const modelCell = $$('td').find(td => td.textContent === 'deepseek-v4.1-flash-1017')
assert.equal(modelCell.getAttribute('style') !== null && /ltr/.test(modelCell.getAttribute('style')), true, 'model name stays ltr in its cell')
// شناسهٔ کارتِ خام در آمار statsRaw است (تراژکتوری raw) تا باز/بسته‌ها به هم نخورد
await clickEl(cardOf('statsRaw').querySelector('div[role="button"]'))
await act(async () => { await new Promise(r => setTimeout(r, 5)) })
const statsPre = $('pre[data-stats-raw]')
assert.ok(statsPre, 'stats raw card shows a <pre>')
assert.equal(statsPre.getAttribute('dir'), 'ltr')
// با دادهٔ قلابی، snapshotِ آمار تهی است ⇒ همان «null»؛ مهم: پرِ کامل و بی‌برش
assert.equal(statsPre.textContent, JSON.stringify(null, null, 2))
await act(async () => { root3.unmount() })
for (const off of disposers) if (typeof off === 'function') off()
dom.window.close()
console.log('render-tables OK: جدولِ تراژکتوری + ▲/▼ و حافظه + دادهٔ خامِ کامل + پیامِ hostِ قدیم')
