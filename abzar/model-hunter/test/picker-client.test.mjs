/**
 * آزمونِ نیمهٔ client ِ منوی مدلِ چت، در jsdom (بی مرورگر و بی اپ).
 * باگ‌هایی که می‌پوشاند:
 *   ۱) کنارِ گزینه‌ها قیمت/کش‌نخوردن/ارزان‌ترین/هزینهٔ عوض کردن نیاید
 *   ۲) گزینهٔ Anthropic (claude-opus-5-5) قیمتش پیدا نشود
 *   ۳) کلیک روی گزینهٔ گران بی‌پرسش رد شود، یا «نه» گفتن جلوی عوض کردن را نگیرد
 *   ۴) گزینهٔ فعلی یا عوض کردنِ ارزان بی‌دلیل بپرسد
 *   ۵) پنلِ بیرون هنوز دکمهٔ «ست کن» داشته باشد
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { JSDOM } from 'jsdom'

const require = createRequire(new URL('../../../package.json', import.meta.url))
const React = require('react')
const { createRoot } = require('react-dom/client')
const { act } = require('react')

const source = readFileSync(new URL('../client.js', import.meta.url), 'utf8')
const flashRef = 'deepseek/x@preset/mh-x-deepinfra'
const baiduRef = 'deepseek/x@preset/mh-x-baidu'
const PICKER = {
  ok: true, tokens: 300000, best: { 'deepseek/x': flashRef },
  items: {
    ['openrouter|' + flashRef]: { model: 'deepseek/x', provider: 'DeepInfra', in1m: 0.1, cache1m: 0.0025, out1m: 0.5, missPct: 0.2, missSamples: 400, warm: 0.0013, cold: 0.0293 },
    ['openrouter|' + baiduRef]: { model: 'deepseek/x', provider: 'Baidu', in1m: 0.09, cache1m: 0.001, out1m: 0.5, missPct: 5.9, missSamples: 614, warm: 0.0028, cold: 0.0293 },
    'anthropic|claude-opus-5-5': { model: 'claude-opus-5-5', provider: 'Anthropic', in1m: 4, cache1m: 0.2, out1m: 20, missPct: null, missSamples: 0, warm: 0.083, cold: 1.499 },
  },
}

function boot() {
  const dom = new JSDOM('<!doctype html><html dir="rtl"><head></head><body></body></html>', { url: 'http://127.0.0.1/' })
  const { window } = dom
  let loaded
  window.__ModuleLoader__ = { load(cfg) { loaded = cfg } }
  const fetched = []
  window.fetch = async (url) => { fetched.push(String(url)); return { ok: true, json: async () => (String(url).includes('/picker') ? PICKER : {}) } }
  Object.assign(globalThis, { window, document: window.document, HTMLElement: window.HTMLElement, fetch: window.fetch, IS_REACT_ACT_ENVIRONMENT: true })
  window.eval(source)
  const mod = loaded.factory(require)
  const slots = {}
  const ctx = {
    effect(fn) { return fn() },
    slots: { inject(n, fn) { return fn() }, register(opts, comp) { slots[opts.name] = comp; return () => {} } },
  }
  mod.apply(ctx)
  return { window, slots, fetched }
}

const tick = () => act(async () => { await new Promise(r => setTimeout(r, 0)) })

test('کنارِ هر گزینه: قیمت، کش‌نخوردنِ قرمز، ارزان‌ترین، هزینهٔ عوض کردن', async () => {
  const { window, slots, fetched } = boot()
  assert.ok(slots['conversation.input.model.label'], 'label ثبت نشد')
  assert.ok(slots['conversation.input.model.options'], 'options ثبت نشد')
  const Label = slots['conversation.input.model.label']
  const Summary = slots['conversation.input.model.options']
  const host = window.document.createElement('div')
  window.document.body.appendChild(host)
  const root = createRoot(host)
  const sid = 'session-1'
  const or = { id: 'openrouter', name: 'openrouter' }
  await act(async () => {
    root.render(React.createElement('div', null,
      React.createElement('span', { id: 't' }, React.createElement(Label, { sessionId: sid, provider: or, model: { id: baiduRef, name: 'X · Baidu' }, placement: 'trigger', selected: true })),
      React.createElement('span', { id: 'o1' }, React.createElement(Label, { sessionId: sid, provider: or, model: { id: flashRef, name: 'X · DeepInfra' }, placement: 'option', selected: false })),
      React.createElement('span', { id: 'o2' }, React.createElement(Label, { sessionId: sid, provider: or, model: { id: baiduRef, name: 'X · Baidu' }, placement: 'option', selected: true })),
      React.createElement('span', { id: 'o3' }, React.createElement(Label, { sessionId: sid, provider: { id: 'anthropic', name: 'Anthropic' }, model: { id: 'claude-opus-5-5', name: 'Claude Opus 5.5' }, placement: 'option', selected: false })),
      React.createElement('div', { id: 's' }, React.createElement(Summary, { sessionId: sid }))))
  })
  await tick(); await tick()
  assert.ok(fetched.some(u => u.includes('/plugins/model-hunter/picker?sessionId=session-1')))
  const q = (id) => window.document.getElementById(id)
  assert.match(q('o1').textContent, /\$0\.0013\/پیام/)
  assert.match(q('o1').textContent, /ارزان‌ترین/)
  assert.match(q('o1').textContent, /عوض کنی: \$0\.029/)
  assert.ok(q('o2').querySelector('.mh-red'), 'کش‌نخوردنِ ۵٫۹٪ قرمز نشد')
  assert.doesNotMatch(q('o2').textContent, /عوض کنی/, 'گزینهٔ فعلی هشدارِ عوض کردن گرفت')
  assert.match(q('o3').textContent, /عوض کنی: \$1\.50/)
  assert.ok(q('o3').querySelector('.mh-red'), 'عوض کردنِ ۱٫۵ دلاری قرمز نشد')
  assert.match(q('s').textContent, /ارزان‌ترین سرورِ همین مدل: DeepInfra/)
  assert.match(q('s').textContent, /۳۰۰ هزار/)

  // پرسش پیش از عوض کردن: «نه» ⇒ کلیک به منو نمی‌رسد؛ «بله» ⇒ می‌رسد
  const mk = (provider, model, checked) => {
    const b = window.document.createElement('button')
    b.setAttribute('role', 'menuitemradio'); b.setAttribute('aria-checked', String(checked)); b.title = model
    const s = window.document.createElement('span'); s.setAttribute('data-provider-id', provider); s.setAttribute('data-model-id', model)
    b.appendChild(s); window.document.body.appendChild(b); return { b, s }
  }
  let reached = 0
  window.document.body.addEventListener('click', () => { reached++ })
  const asked = []
  window.confirm = (m) => { asked.push(m); return false }
  const opus = mk('anthropic', 'claude-opus-5-5', false)
  opus.s.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
  assert.equal(asked.length, 1, 'برای عوض کردنِ گران نپرسید')
  assert.match(asked[0], /بی‌کش/)
  assert.equal(reached, 0, '«نه» جلوی عوض کردن را نگرفت')
  window.confirm = (m) => { asked.push(m); return true }
  opus.s.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
  assert.equal(reached, 1, '«بله» عوض کردن را رد کرد')
  // گزینهٔ فعلی ⇒ بی‌پرسش
  const cur = mk('openrouter', baiduRef, true)
  cur.s.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
  assert.equal(asked.length, 2)
  await act(async () => root.unmount())
})

test('پنلِ بیرون دیگر «ست کن» ندارد', () => {
  assert.doesNotMatch(source, /'ست کن/)
})
