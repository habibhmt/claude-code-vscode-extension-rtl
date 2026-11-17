/**
 * آزمونِ تبِ «ابزارها» در aA — با fetch ِ ساختگی و React ِ واقعی (jsdom).
 * می‌سنجد: تب باز می‌شود، سه سطح هست، تیک زدن و ثبت، پرسشِ «سراسری»، و خود‌بازشدنِ
 * aA در چتِ خالی.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import toolHelp from '../tool-help.cjs'

const require = createRequire(import.meta.url)
let JSDOM, React, ReactDOMClient, act, Simulate
try {
  ({ JSDOM } = require('jsdom'))
  React = require('react')
  ReactDOMClient = require('react-dom/client')
  ;({ act, Simulate } = require('react-dom/test-utils'))
} catch (err) {
  test('jsdom/react نصب نیست', { skip: true }, () => {})
}

/** پاسخِ ساختگیِ مسیرِ تیک‌ها. */
const ROWS = [
  { kind: 'abzar_dsh', label: 'ابزارهای خودِ DSH', items: [{ name: 'web_search', on: true, owner: null, by: '' }, { name: 'bash', on: false, owner: null, by: '' }], onCount: 1, total: 2 },
  { kind: 'mcp', label: 'MCP (سرورهای ابزارِ بیرونی)', items: [{ name: 'hafeze', on: true, owner: null, by: '' }], onCount: 1, total: 1 },
  { kind: 'afzune', label: 'افزونه‌ها', items: [{ name: 'dsh-rtl', on: true, owner: null, by: '' }], onCount: 1, total: 1 },
  { kind: 'eskil', label: 'اسکیل‌ها', items: [], onCount: 0, total: 0 },
]

for(const row of ROWS)for(const i of row.items)Object.assign(i,toolHelp.resolveHelp(row.kind,i.name));

function boot(opts) {
  const o = opts || {}
  const getImpl = o.get || (() => undefined)
  const dom = new JSDOM('<!doctype html><html><head></head><body>' + (o.body || '<div id="root"></div>') + '</body></html>', {
    pretendToBeVisual: true, url: 'http://127.0.0.1/',
  })
  const w = dom.window
  globalThis.window = w
  globalThis.document = w.document
  Object.defineProperty(globalThis, 'navigator', { value: w.navigator, configurable: true, writable: true })
  globalThis.MutationObserver = w.MutationObserver
  globalThis.NodeFilter = w.NodeFilter
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  w.requestAnimationFrame = (f) => setTimeout(f, 0)
  w.cancelAnimationFrame = (i) => clearTimeout(i)
  w.CSS = { highlights: new Map() }
  if (o.seed) w.localStorage.setItem('dsh-rtl:plus:v1', JSON.stringify(o.seed))
  const calls = []
  const fetchStub = async (url, init) => {
    const target = new URL(String(url), 'http://127.0.0.1/').href
    const method = (init && init.method) || 'GET'
    const body = init && init.body ? JSON.parse(init.body) : null
    calls.push({ url: target, method: method, body: body })
    if (String(target).includes('/plugins/rtl/tik')) {
      if (method === 'POST') {
        return { ok: true, status: 200, json: async () => ({ ok: true, matn: '۱ تیک برداشته', rows: ROWS, az: 'chat', folder: null }) }
      }
      return { ok: true, status: 200, json: async () => ({ ok: true, rows: ROWS, az: 'poshe', folder: '/tmp/x', savedAt: 1 }) }
    }
    return { ok: true, status: 200, json: async () => ({ ok: true, global: {}, project: {}, chat: {}, levels: {}, files: {} }) }
  }
  w.fetch = fetchStub
  globalThis.fetch = fetchStub
  let plugin
  w.__ModuleLoader__ = { load: (def) => { plugin = def.factory((name) => { if (name === 'react') return React; throw new Error('no ' + name) }) } }
  w.eval(readFileSync(new URL('../client.js', import.meta.url), 'utf8'))
  const regs = []
  const ctx = {
    effect: (fn) => { fn() },
    get: getImpl,
    slots: { inject: (name, fn) => fn(), register: (meta, comp) => { regs.push({ meta, comp }); return () => {} } },
  }
  plugin.apply(ctx)
  return { w, regs, calls }
}

/** تیک زدن روی checkbox ِ کنترل‌شده: Simulate.change، همان کاری که مرورگر می‌کند. */
async function flip(input) {
  await act(async () => {
    input.checked = !input.checked
    Simulate.change(input, { target: input })
  })
  await act(async () => { await new Promise((r) => setTimeout(r, 20)) })
}

function fakeInput(draft) {
  const state = { draft: draft || '' }
  const actions = {
    setDraft: (t) => { state.draft = t },
    insertText: (t) => { state.draft += t; return true },
    captureInsertion: () => ({ rev: 1 }),
    insertQuote: () => true,
    submit: () => {},
  }
  return { actions, useInput: (sel) => sel(state) }
}

if (JSDOM) {
  test('تبِ «ابزارها»: چهار گروه، سه سطح، و ثبت با سطحِ درست', async () => {
    const { w, regs, calls } = boot()
    const dock = regs.find((r) => r.meta.name === 'conversation.input.dock')
    const inp = fakeInput('')
    const root = ReactDOMClient.createRoot(w.document.getElementById('root'))
    await act(async () => { root.render(React.createElement(dock.comp, { sessionId: 'session-1', inputActions: inp.actions, useInput: inp.useInput })) })
    // aA باز می‌کند
    await act(async () => { w.document.querySelector('.dsh-plus-aa').click() })
    const tabs = [...w.document.querySelectorAll('.dsh-tik-tabs button')].map((b) => b.textContent)
    assert.deepEqual(tabs, ['ظاهر', 'ابزارها'])
    // به تبِ ابزارها
    const abzarTab = [...w.document.querySelectorAll('.dsh-tik-tabs button')].find((b) => b.textContent === 'ابزارها')
    await act(async () => { abzarTab.click() })
    await act(async () => { await new Promise(r=>setTimeout(r,30)) })
    const bashRow=[...w.document.querySelectorAll('label.dsh-tik-row')].find(r=>r.querySelector('.dsh-tik-esm').textContent==='bash')
    assert.equal(bashRow.querySelector('.dsh-tik-usage').textContent,'فرمان را در ترمینال اجرا می‌کند')
    assert.deepEqual([...bashRow.children].map(e=>e.className||e.tagName),['INPUT','dsh-tik-esm','dsh-tik-usage','dsh-tik-az'])
    const search=w.document.querySelector('.dsh-tik-search')
    await act(async()=>{Simulate.change(search,{target:{value:'ترمینال'}})})
    assert.equal(w.document.querySelectorAll('label.dsh-tik-row').length,1,'Persian purpose search')
    await act(async()=>{Simulate.change(search,{target:{value:''}})})
    await act(async () => { await new Promise((r) => setTimeout(r, 60)) })
    // سه سطح
    const sath = [...w.document.querySelectorAll('.dsh-tik-sath button')].map((b) => b.textContent)
    assert.deepEqual(sath, ['این چت', 'این پوشه', 'سراسری'])
    // گروه‌ها
    const groups = [...w.document.querySelectorAll('.dsh-tik-group h4')].map((h) => h.textContent)
    assert.equal(groups.length, 3, 'اسکیلِ خالی نمایش داده نمی‌شود')
    assert.match(groups[0], /ابزارهای خودِ DSH/)
    // ردیف‌ها
    const names = [...w.document.querySelectorAll('.dsh-tik-esm')].map((s) => s.textContent)
    assert.deepEqual(names, ['web_search', 'bash', 'hafeze', 'dsh-rtl'])
    // تیک زدن bash و ثبت در سطحِ «این چت» (پیش‌فرض)
    const bash = [...w.document.querySelectorAll('label.dsh-tik-row')].find((r) => r.textContent.includes('bash'))
    await flip(bash.querySelector('input'))
    const saveBtn = [...w.document.querySelectorAll('.dsh-tik-actions button')].find((b) => b.textContent.startsWith('ثبت'))
    assert.match(saveBtn.textContent, /ثبت \(۱\)/)
    await act(async () => { saveBtn.click() })
    await act(async () => { await new Promise((r) => setTimeout(r, 60)) })
    const post = calls.find((c) => c.method === 'POST')
    assert.ok(post, 'POST رفت')
    assert.equal(post.body.sath, 'chat')
    assert.deepEqual(post.body.taghir, [{ kind: 'abzar_dsh', name: 'bash', on: true }])
    await act(async () => { root.unmount() })
  })

  test('سطحِ «سراسری» اول می‌پرسد و بدونِ «بله» نمی‌فرستد', async () => {
    const { w, regs, calls } = boot()
    const dock = regs.find((r) => r.meta.name === 'conversation.input.dock')
    const inp = fakeInput('')
    const root = ReactDOMClient.createRoot(w.document.getElementById('root'))
    await act(async () => { root.render(React.createElement(dock.comp, { sessionId: 'session-9', inputActions: inp.actions, useInput: inp.useInput })) })
    await act(async () => { w.document.querySelector('.dsh-plus-aa').click() })
    await act(async () => { [...w.document.querySelectorAll('.dsh-tik-tabs button')].find((b) => b.textContent === 'ابزارها').click() })
    await act(async () => { await new Promise((r) => setTimeout(r, 60)) })
    await act(async () => { [...w.document.querySelectorAll('.dsh-tik-sath button')].find((b) => b.textContent === 'سراسری').click() })
    const hafeze = [...w.document.querySelectorAll('label.dsh-tik-row')].find((r) => r.textContent.includes('hafeze'))
    await flip(hafeze.querySelector('input'))
    const saveBtn = [...w.document.querySelectorAll('.dsh-tik-actions button')].find((b) => b.textContent.startsWith('ثبت'))
    await act(async () => { saveBtn.click() })
    // هنوز چیزی نرفته، ولی پرسش آمده
    assert.equal(calls.filter((c) => c.method === 'POST').length, 0)
    assert.ok(w.document.querySelector('.dsh-tik-ask'), 'پرسشِ سراسری آمد')
    // «نه» ⇒ هیچ
    await act(async () => { [...w.document.querySelectorAll('.dsh-tik-ask button')].find((b) => b.textContent === 'نه').click() })
    assert.equal(calls.filter((c) => c.method === 'POST').length, 0)
    assert.equal(w.document.querySelector('.dsh-tik-ask'), null)
    // دوباره: «بله»
    await act(async () => { [...w.document.querySelectorAll('.dsh-tik-actions button')].find((b) => b.textContent.startsWith('ثبت')).click() })
    await act(async () => { [...w.document.querySelectorAll('.dsh-tik-ask button')].find((b) => b.textContent.startsWith('بله')).click() })
    await act(async () => { await new Promise((r) => setTimeout(r, 60)) })
    const posts = calls.filter((c) => c.method === 'POST')
    assert.equal(posts.length, 1)
    assert.equal(posts[0].body.sath, 'sarasari')
    await act(async () => { root.unmount() })
  })

  test('چتِ خالی: aA خودش روی تبِ «ابزارها» باز می‌شود', async () => {
    const { w, regs, calls } = boot({ body: '<div data-conversation-scroll></div><div id="root"></div>' })
    const dock = regs.find((r) => r.meta.name === 'conversation.input.dock')
    const inp = fakeInput('')
    const root = ReactDOMClient.createRoot(w.document.getElementById('root'))
    await act(async () => { root.render(React.createElement(dock.comp, { sessionId: 'session-new', inputActions: inp.actions, useInput: inp.useInput })) })
    await act(async () => { await new Promise((r) => setTimeout(r, 500)) })
    const panel = w.document.querySelector('.dsh-plus-panel')
    assert.ok(panel, 'پنلِ aA خودش باز شد')
    const on1 = [...panel.querySelectorAll('.dsh-tik-tabs button')].filter((b) => b.getAttribute('data-on') === '1').map((b) => b.textContent)
    assert.deepEqual(on1, ['ابزارها'], 'روی تبِ ابزارها باز شد')
    assert.ok(calls.some((c) => String(c.url).includes('/plugins/rtl/tik')), 'فهرست از host خوانده شد')
    await act(async () => { root.unmount() })
  })

  test('چتِ پرشده: aA خودش باز نمی‌شود', async () => {
    const { w, regs } = boot({ body: '<div data-conversation-scroll><p>پیامِ قبلی</p></div><div id="root"></div>' })
    const dock = regs.find((r) => r.meta.name === 'conversation.input.dock')
    const inp = fakeInput('')
    const root = ReactDOMClient.createRoot(w.document.getElementById('root'))
    await act(async () => { root.render(React.createElement(dock.comp, { sessionId: 'session-old', inputActions: inp.actions, useInput: inp.useInput })) })
    await act(async () => { await new Promise((r) => setTimeout(r, 600)) })
    assert.equal(w.document.querySelector('.dsh-plus-panel'), null, 'پنل بسته ماند')
    await act(async () => { root.unmount() })
  })

  test('aaTaze خاموش: هیچ‌وقت خودش باز نمی‌شود', async () => {
    const { w, regs } = boot({ body: '<div data-conversation-scroll></div><div id="root"></div>', seed: { aaTaze: false } })
    const dock = regs.find((r) => r.meta.name === 'conversation.input.dock')
    const inp = fakeInput('')
    const root = ReactDOMClient.createRoot(w.document.getElementById('root'))
    await act(async () => { root.render(React.createElement(dock.comp, { sessionId: 'session-x', inputActions: inp.actions, useInput: inp.useInput })) })
    await act(async () => { await new Promise((r) => setTimeout(r, 600)) })
    assert.equal(w.document.querySelector('.dsh-plus-panel'), null)
    await act(async () => { root.unmount() })
  })
}

test('پوشه: اگر props.cwd خالی آید، از خودِ برنامه پرسیده می‌شود (باگِ ۲۱:۲۰)', async () => {
  // برنامه پوشهٔ چت را از سرویسِ sessions می‌دهد — همان چیزی که در آزمونِ صفحه خالی می‌آمد
  const REAL = '/Users/habib/1-MY-WORK/136th-day-fix-rtl-claude'
  const { w, regs, calls } = boot({
    get: (name) => (name === 'sessions' ? {
      list: { getSnapshot: () => ({ ids: ['session-1'], byId: { 'session-1': { cwd: REAL } } }) },
    } : undefined),
  })
  // برنامه پوشهٔ چت را از sessions می‌دهد؛ props.cwd عمداً خالی می‌ماند
  const dock = regs.find((r) => r.meta.name === 'conversation.input.dock')
  const inp = fakeInput('')
  const root = ReactDOMClient.createRoot(w.document.getElementById('root'))
  await act(async () => { root.render(React.createElement(dock.comp, { sessionId: 'session-1', inputActions: inp.actions, useInput: inp.useInput })) })
  await act(async () => { w.document.querySelector('.dsh-plus-aa').click() })
  await act(async () => { [...w.document.querySelectorAll('.dsh-tik-tabs button')].find((b) => b.textContent === 'ابزارها').click() })
  await act(async () => { await new Promise((r) => setTimeout(r, 80)) })
  const tikCalls = calls.filter((c) => String(c.url).includes('/plugins/rtl/tik'))
  assert.ok(tikCalls.length > 0, 'درخواست رفت')
  // یا پوشه از props آمده، یا از probeWorkspace؛ در آزمونِ بی‌ctx دومی خالی است و این درست است.
  const sentCwd = new URL(tikCalls[0].url, 'http://127.0.0.1/').searchParams.get('cwd')
  assert.equal(sentCwd, REAL, 'پوشه از خودِ برنامه گرفته شد، نه خالی')
  await act(async () => { root.unmount() })
})

test('کلیدِ aaTaze در تبِ «ظاهر» واقعاً هست (نه فقط مقدارِ پیش‌فرض)', async () => {
  const { w, regs } = boot()
  const dock = regs.find((r) => r.meta.name === 'conversation.input.dock')
  const inp = fakeInput('')
  const root = ReactDOMClient.createRoot(w.document.getElementById('root'))
  await act(async () => { root.render(React.createElement(dock.comp, { sessionId: 'session-k', inputActions: inp.actions, useInput: inp.useInput })) })
  await act(async () => { w.document.querySelector('.dsh-plus-aa').click() })
  await act(async () => { await new Promise((r) => setTimeout(r, 80)) })
  const labels = [...w.document.querySelectorAll('.dsh-plus-panel .dsh-plus-line span, .dsh-plus-panel label span')].map((e) => e.textContent)
  assert.ok(labels.some((t) => /تبِ «ابزارها» خودش باز شود/.test(t)), 'ردیفِ خاموش‌کردن در تبِ «ظاهر» هست')
  await act(async () => { root.unmount() })
})
