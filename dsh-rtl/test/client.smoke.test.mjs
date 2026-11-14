/**
 * آزمونِ دودِ client.js در jsdom با React ِ واقعی: افزونه بالا می‌آید، اسلات‌ها ثبت می‌شوند،
 * نوارِ دکمه‌ها با inputActions ِ ساختگی کار می‌کند، منوی کلیکِ راست و جست‌وجو و «پایین نپر» رفتار درست دارند.
 * نیاز: jsdom و react و react-dom در node_modules ِ ریشهٔ پروژه (devDependencies).
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'

const require = createRequire(import.meta.url)
let JSDOM, React, ReactDOMClient, act
try {
  ({ JSDOM } = require('jsdom'))
  React = require('react')
  ReactDOMClient = require('react-dom/client')
  ;({ act } = require('react-dom/test-utils'))
} catch (err) {
  test('jsdom/react نصب نیست', { skip: true }, () => {})
}

function boot(seed) {
  const dom = new JSDOM('<!doctype html><html><head></head><body><div id="scroll" data-conversation-scroll><div data-message-bubble data-text-interaction-source><p>سلام دنیا Foo foo</p></div><p id="ans">پاسخِ دستیار foo</p></div><div id="root"></div></body></html>', { pretendToBeVisual: true, url: 'http://127.0.0.1/' })
  const w = dom.window
  globalThis.window = w; globalThis.document = w.document
  Object.defineProperty(globalThis, 'navigator', { value: w.navigator, configurable: true, writable: true })
  if (seed) w.localStorage.setItem('dsh-rtl:plus:v1', JSON.stringify(seed))
  globalThis.MutationObserver = w.MutationObserver; globalThis.NodeFilter = w.NodeFilter
  globalThis.WheelEvent = w.WheelEvent || w.Event
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  w.requestAnimationFrame = (f) => setTimeout(f, 0); w.cancelAnimationFrame = (i) => clearTimeout(i)
  const hl = new Map()
  w.CSS = { highlights: hl }
  w.Highlight = class { constructor(...r) { this.ranges = r } }
  const clip = []
  Object.defineProperty(w.navigator, 'clipboard', { value: { writeText: async (t) => { clip.push(t) } }, configurable: true })
  let plugin
  w.__ModuleLoader__ = { load: (def) => { plugin = def.factory((name) => { if (name === 'react') return React; throw new Error('no ' + name) }) } }
  w.eval(readFileSync(new URL('../client.js', import.meta.url), 'utf8'))
  const regs = []
  const effects = []
  const ctx = {
    effect: (fn) => { effects.push(fn()) },
    slots: { inject: (name, fn) => fn(), register: (meta, comp) => { regs.push({ meta, comp }); return () => {} } },
  }
  plugin.apply(ctx)
  return { w, plugin, regs, effects, hl, clip }
}

function fakeInput(draft = '') {
  const calls = []
  const state = { draft }
  const actions = {
    setDraft: (t) => { calls.push(['setDraft', t]); state.draft = t },
    insertText: (t) => { calls.push(['insertText', t]); state.draft += t; return true },
    captureInsertion: () => ({ rev: 1 }),
    insertQuote: (t) => { calls.push(['insertQuote', t]); return true },
    submit: () => calls.push(['submit']),
  }
  return { calls, actions, useInput: (sel) => sel(state) }
}

if (JSDOM) {
  test('اسلات‌ها ثبت می‌شوند و نوارِ دکمه‌ها کار می‌کند', async () => {
    const { w, regs } = boot()
    const names = regs.map(r => r.meta.name)
    for (const n of ['conversation.input.dock', 'conversation.session.header.actions', 'conversation.composer.dock', 'settings.section']) assert.ok(names.includes(n), n)
    const dock = regs.find(r => r.meta.name === 'conversation.input.dock')
    const inp = fakeInput('')
    const root = ReactDOMClient.createRoot(w.document.getElementById('root'))
    await act(async () => { root.render(React.createElement(dock.comp, { sessionId: 'session-1', inputActions: inp.actions, useInput: inp.useInput })) })
    const btns = [...w.document.querySelectorAll('.dsh-plus-bar .dsh-plus-btn')]
    const nazer = btns.find(b => b.textContent === 'ناظر')
    assert.ok(nazer, 'دکمهٔ ناظر هست')
    await act(async () => { nazer.click() })
    assert.deepEqual(inp.calls[0], ['setDraft', 'کارایی که میکنی باید با هماهنگی ناظر باشه ها'])
    // کادر پر است ⇒ جملهٔ بعدی روی خطِ تازه
    await act(async () => { root.render(React.createElement(dock.comp, { sessionId: 'session-1', inputActions: inp.actions, useInput: inp.useInput })) })
    const saade = [...w.document.querySelectorAll('.dsh-plus-btn')].find(b => b.textContent === 'ساده')
    await act(async () => { saade.click() })
    assert.deepEqual(inp.calls[1], ['insertText', '\nنمیفهمم اینو به زبون ساده بگو'])
    // «بزن» خودش می‌فرستد
    const bezan = [...w.document.querySelectorAll('.dsh-plus-btn')].find(b => b.textContent === 'بزن')
    await act(async () => { bezan.click() })
    await new Promise(r => setTimeout(r, 100))
    assert.deepEqual(inp.calls.at(-1), ['submit'])
    // فرمانِ «/» روی کادرِ پر ⇒ دست نمی‌زند
    const before = inp.calls.length
    const comp = [...w.document.querySelectorAll('.dsh-plus-btn')].find(b => b.textContent === 'comp')
    await act(async () => { comp.click() })
    assert.equal(inp.calls.length, before)
    assert.match(w.document.querySelector('.dsh-plus-flash').textContent, /خالی کن/)
    // aA پنل را باز می‌کند و پیش‌تنظیمِ «درشت» ذخیره می‌شود
    await act(async () => { w.document.querySelector('.dsh-plus-aa').click() })
    const panel = w.document.querySelector('.dsh-plus-panel')
    assert.ok(panel, 'پنلِ aA باز شد')
    const large = [...panel.querySelectorAll('button')].find(b => b.textContent === 'درشت')
    await act(async () => { large.click() })
    assert.equal(JSON.parse(w.localStorage.getItem('dsh-rtl:plus:v1')).lines, 3)
    assert.match(w.document.querySelector('style[data-dsh-rtl="plus"]').textContent, /calc\(3lh/)
    await act(async () => { root.unmount() })
  })

  test('منوی کلیکِ راست: نقل‌قول با insertQuote ِ خودِ DSH', async () => {
    const { w, regs } = boot()
    const dock = regs.find(r => r.meta.name === 'conversation.input.dock')
    const inp = fakeInput('')
    const root = ReactDOMClient.createRoot(w.document.getElementById('root'))
    await act(async () => { root.render(React.createElement(dock.comp, { sessionId: 'session-2', inputActions: inp.actions, useInput: inp.useInput })) })
    const p = w.document.querySelector('[data-message-bubble] p')
    const range = w.document.createRange(); range.selectNodeContents(p)
    w.getSelection().removeAllRanges(); w.getSelection().addRange(range)
    const ev = new w.MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 10, clientY: 10 })
    p.dispatchEvent(ev)
    assert.equal(ev.defaultPrevented, true)
    const items = [...w.document.querySelectorAll('#dsh-plus-ctx button')].map(b => b.textContent)
    assert.ok(items.includes('↩︎ نقل‌قول در چت'))
    ;[...w.document.querySelectorAll('#dsh-plus-ctx button')].find(b => b.textContent === '↩︎ نقل‌قول در چت').click()
    assert.deepEqual(inp.calls.at(-1), ['insertQuote', 'سلام دنیا Foo foo'])
    // بیرونِ گفتگو ⇒ منوی خودِ مرورگر
    const r2 = w.document.createRange(); r2.selectNodeContents(w.document.getElementById('root'))
    w.getSelection().removeAllRanges()
    const ev2 = new w.MouseEvent('contextmenu', { bubbles: true, cancelable: true })
    w.document.body.dispatchEvent(ev2)
    assert.equal(ev2.defaultPrevented, false)
    await act(async () => { root.unmount() })
  })

  test('جست‌وجو: همهٔ موردها رنگ می‌گیرند، DOM دست نمی‌خورد', async () => {
    const { w, hl } = boot()
    const html = w.document.getElementById('scroll').innerHTML
    w.document.dispatchEvent(new w.KeyboardEvent('keydown', { code: 'KeyF', key: 'f', ctrlKey: true, altKey: true, bubbles: true }))
    const input = w.document.querySelector('#dsh-plus-find input')
    assert.ok(input)
    input.value = 'foo'
    input.dispatchEvent(new w.Event('input'))
    await new Promise(r => setTimeout(r, 200))
    assert.equal(hl.get('dsh-plus-find').ranges.length, 3)
    assert.match(w.document.querySelector('#dsh-plus-find span').textContent, /۱ از ۳/)
    assert.equal(w.document.getElementById('scroll').innerHTML, html)
    input.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    assert.equal(w.document.getElementById('dsh-plus-find'), null)
    assert.equal(hl.size, 0)
  })

  test('«پایین نپر»: پرشِ خودکار برمی‌گردد، اسکرولِ خودِ کاربر نه', async () => {
    const { w } = boot()
    const sc = w.document.getElementById('scroll')
    Object.defineProperty(sc, 'scrollHeight', { value: 5000, configurable: true })
    Object.defineProperty(sc, 'clientHeight', { value: 500, configurable: true })
    Object.defineProperty(sc, 'clientWidth', { value: 800, configurable: true })
    sc.scrollTop = 1000
    const ed = w.document.createElement('div'); ed.setAttribute('contenteditable', 'true'); w.document.body.appendChild(ed)
    Object.defineProperty(ed, 'isContentEditable', { value: true })
    ed.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    sc.scrollTop = 4500 // برنامه پایین برد
    await new Promise(r => setTimeout(r, 30))
    assert.equal(sc.scrollTop, 1000)
    // خودِ کاربر چرخ زد ⇒ دیگر برنگردان
    w.document.dispatchEvent(new w.WheelEvent('wheel', { bubbles: true }))
  })

  test('دکمهٔ کپیِ زیرِ پاسخ متنِ ویژهٔ 📋دار را می‌چسباند؛ کپیِ دیگر نه', async () => {
    const third = boot({ extras: [{ text: 'امضا', on: true, pos: 'end', btn: true }] })
    const btn = third.w.document.createElement('button'); btn.setAttribute('aria-label', 'Copy')
    third.w.document.getElementById('scroll').appendChild(btn)
    btn.click()
    await third.w.navigator.clipboard.writeText('پاسخ')
    await third.w.navigator.clipboard.writeText('کپیِ معمولی')
    assert.deepEqual(third.clip, ['پاسخ\n\nامضا', 'کپیِ معمولی'])
  })
  test('متنِ لاتینِ عدددار dir="ltr" می‌گیرد؛ نوارِ دکمه‌ها نه؛ خانهٔ ✅ راست‌چین', async () => {
    const { w } = boot()
    const d = w.document
    d.body.insertAdjacentHTML('beforeend', '<button id="pill"><span>7 turns 239 steps</span> · <span>144 tok/s</span></button><div id="bar"><button>Default</button><span id="price">$0.0007 Flash 1017</span></div><span id="fa">۲ مورد pending</span><span id="en">Compaction could not produce a summary.</span><table><tr><th>داخلِ کامیت؟</th></tr><tr><td id="ok">✅</td></tr></table>')
    await new Promise(r => setTimeout(r, 700)) // گذرِ debounce (۴۰۰ms)
    assert.equal(d.getElementById('pill').getAttribute('dir'), 'ltr')
    assert.equal(d.getElementById('price').getAttribute('dir'), 'ltr')
    assert.equal(d.getElementById('bar').getAttribute('dir'), null, 'نوارِ کنترل‌ها برنمی‌گردد')
    assert.equal(d.getElementById('fa').getAttribute('dir'), null, 'متنِ فارسی دست نمی‌خورد')
    assert.equal(d.getElementById('en').getAttribute('dir'), 'ltr')
    assert.equal(d.getElementById('ok').style.getPropertyValue('text-align'), 'right')
  })
}
