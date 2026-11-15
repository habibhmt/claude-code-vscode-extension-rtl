/**
 * آزمونِ صفحهٔ تنظیمات در jsdom با React ِ واقعی:
 *   - بخش‌های فارسی («راست‌چین»، «ظاهر»، «پیام‌ها و دکمه‌ها، ...) و جست‌وجو («فونت» ⇒ فقط ردیف‌های فونت)
 *   - نشانِ سطح («از سراسری/پروژه/چت/پیش‌فرض») و اولویتِ چت > پروژه > سراسری > پیش‌فرض
 *   - نوتِ «برای ذخیره در پرونده، اپ یک بار بسته و باز شود» وقتی مسیر ۴۰۴ می‌دهد
 * نیاز: jsdom و react و react-dom (همان‌ها که client.smoke.test.mjs لازم دارد).
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'

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

/**
 * افزونه را با یک fetch ِ ساختگی بالا می‌آورد.
 * @param {{ status?: number, body?: object }} answer پاسخِ مسیرِ تنظیم‌ها
 */
function boot(answer) {
  const dom = new JSDOM('<!doctype html><html><head></head><body><div id="root"></div></body></html>', {
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
  const calls = []
  // fetch ِ بی‌حرف در client.js موقعِ صدا زدن از global خوانده می‌شود (نه window)؛ هر دو را می‌گذاریم
  const fetchStub = async (url, opts) => {
    const target = new URL(String(url), 'http://127.0.0.1/').href
    calls.push({ url: target, opts: opts || {} })
    if (answer.status && answer.status !== 200) {
      return { ok: false, status: answer.status, json: async () => ({}) }
    }
    return { ok: true, status: 200, json: async () => answer.body }
  }
  w.fetch = fetchStub
  let plugin
  w.__ModuleLoader__ = { load: (def) => { plugin = def.factory((name) => { if (name === 'react') return React; throw new Error('no ' + name) }) } }
  w.eval(readFileSync(new URL('../client.js', import.meta.url), 'utf8'))
  const regs = []
  const ctx = {
    effect: (fn) => { fn() },
    get: () => undefined,
    slots: { inject: (name, fn) => fn(), register: (meta, comp) => { regs.push({ meta, comp }); return () => {} } },
  }
  plugin.apply(ctx)
  const section = regs.find((r) => r.meta.name === 'settings.section')
  /**
   * تایپ در input ِ کنترل‌شده.
   * رویدادِ DOM ِ دستی در test runner به onChange ِ React نمی‌رسد (سنجیده شد)، پس
   * هدفِ رویداد را می‌سازیم و با Simulate.change می‌فرستیم؛ همان کاری که مرورگر می‌کند.
   */
  const typeInto = async (input, text) => {
    await act(async () => {
      input.value = text
      Simulate.change(input, { target: input })
    })
    await act(async () => { await new Promise((r) => setTimeout(r, 20)) })
  }
  /**
   * test runner ها globalThis را در هر آزمون از نو می‌سازند؛ پس آرایهٔ جهانی باید *داخلِ*
   * همان آزمون (بدنهٔ test) تنظیم شود. این تابع را اولِ هر آزمون صدا بزن.
   */
  const install = () => {
    globalThis.fetch = fetchStub
    globalThis.window = w
    globalThis.document = w.document
    globalThis.navigator = w.navigator
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
  }
  return { w, plugin, regs, section, calls, typeInto, install }
}

/** صفحه را می‌نشاند و تا پایانِ خواندنِ پرونده‌ها صبر می‌کند. */
async function mount(section) {
  const root = ReactDOMClient.createRoot(globalThis.document.getElementById('root'))
  await act(async () => { root.render(React.createElement(section.comp, { close: () => {} })) })
  for (let i = 0; i < 12; i += 1) await act(async () => { await new Promise((r) => setTimeout(r, 25)) })
  return root
}

const BODY = {
  ok: true,
  global: { rtl: true, font: true, code: false, plaintext: true, lh: 18 },
  project: { lh: 21 },
  chat: { lh: 24 },
  files: { global: '/home/u/.dsh/dsh-rtl/settings.json', project: null, chat: null },
  levels: { global: { ok: true }, project: { ok: false, reason: 'شناسهٔ چت نیامد یا ناامن است' }, chat: { ok: false } },
}

if (JSDOM) {
  test('بخش‌های فارسی و ردیف‌های تنظیمات دیده می‌شوند', async () => {
    const booted = boot({ status: 200, body: BODY })
    booted.install()
    const { w, section } = booted
    const root = await mount(section)
    const doc = w.document
    const heads = [...doc.querySelectorAll('.dsh-rtl-section h3')].map((n) => n.textContent)
    for (const t of ['راست‌چین', 'ظاهر', 'پیام‌ها و دکمه‌ها']) assert.ok(heads.includes(t), t)
    assert.ok(doc.querySelector('input.dsh-rtl-search'), 'کادرِ جست‌وجو')
    assert.equal(doc.querySelector('input.dsh-rtl-search').getAttribute('placeholder'), 'جست‌وجو در تنظیمات…')
    const rows = [...doc.querySelectorAll('[data-row]')].map((n) => n.getAttribute('data-row'))
    for (const k of ['rtl', 'font', 'code', 'plaintext', 'lh', 'tableScroll']) assert.ok(rows.includes(k), k)
    // هر ردیف برچسب + شرح + خطِ «الان: …؛ یعنی …» دارد
    const rtlRow = doc.querySelector('[data-row="rtl"]')
    assert.match(rtlRow.textContent, /راست‌به‌چپ/)
    assert.match(rtlRow.textContent, /الان: روشن از سراسری/)
    await act(async () => { root.unmount() })
  })

  test('«الان» از درست‌ترین سطح می‌آید: چت برنده است، بعد پروژه، بعد سراسری', async () => {
    const booted = boot({ status: 200, body: BODY })
    booted.install()
    const { w, section } = booted
    const root = await mount(section)
    const doc = w.document
    // lh در هر سه سطح: چت (۲۴) برنده است
    assert.match(doc.querySelector('[data-row="lh"] .dsh-rtl-row-now').textContent, /الان: 24 از چت/)
    // code فقط در سراسری (false): «خاموش از سراسری»
    assert.match(doc.querySelector('[data-row="code"] .dsh-rtl-row-now').textContent, /الان: خاموش از سراسری/)
    // جدولی که هیچ‌جا نیست ⇒ پیش‌فرض
    await act(async () => { root.unmount() })
  })

  test('جست‌وجو: تایپ «فونت» فقط ردیف‌های فونت را نگه می‌دارد', async () => {
    const booted = boot({ status: 200, body: BODY })
    booted.install()
    const { w, section, typeInto } = booted
    const root = await mount(section)
    const doc = w.document
    const input = doc.querySelector('input.dsh-rtl-search')
    assert.ok(input)
    const before = [...doc.querySelectorAll('[data-row]')].map((n) => n.getAttribute('data-row'))
    assert.ok(before.includes('btnSize'), 'پیش از جست‌وجو همه هستند')
    const type = (text) => typeInto(input, text)
    await type('فونت')
    const after = [...doc.querySelectorAll('[data-row]')].map((n) => n.getAttribute('data-row'))
    assert.deepEqual(after, ['font'], 'فقط ردیفِ فونت می‌ماند')
    // جست‌وجوی انگلیسی هم کار می‌کند
    await type('tableScroll')
    assert.deepEqual([...doc.querySelectorAll('[data-row]')].map((n) => n.getAttribute('data-row')), ['tableScroll'])
    // واژهٔ بی‌ربط ⇒ پیامِ «پیدا نشد»
    await type('zzzz-نیست')
    assert.match(doc.querySelector('.dsh-rtl-empty') ? doc.querySelector('.dsh-rtl-empty').textContent : '', /پیدا نشد/)
    await act(async () => { root.unmount() })
  })

  test('نشانِ سطح: دکمه‌های global/project/chat با data-level و data-set', async () => {
    const booted = boot({ status: 200, body: BODY })
    booted.install()
    const { w, section } = booted
    const root = await mount(section)
    const doc = w.document
    const badges = [...doc.querySelectorAll('[data-row="lh"] .dsh-rtl-badges .dsh-rtl-level')]
    assert.equal(badges.length, 3)
    assert.deepEqual(badges.map((b) => b.getAttribute('data-level')), ['global', 'project', 'chat'])
    assert.deepEqual(badges.map((b) => b.getAttribute('data-set')), ['1', '1', '1'], 'هر سه سطح مقدار دارند')
    const on = badges.filter((b) => b.className.includes('dsh-rtl-level-on')).map((b) => b.getAttribute('data-level'))
    assert.deepEqual(on, ['chat'], 'سطحِ برنده چت است')
    // ردیفِ font فقط سراسری دارد
    const fontBadges = [...doc.querySelectorAll('[data-row="font"] .dsh-rtl-badges .dsh-rtl-level')]
    assert.deepEqual(fontBadges.map((b) => b.getAttribute('data-set')), ['1', '0', '0'])
    await act(async () => { root.unmount() })
  })

  test('مسیرِ ۴۰۴ (فقط Cmd+R، اپ بسته و باز نشده): نوتِ «در پرونده ذخیره شود»', async () => {
    const booted = boot({ status: 404, body: {} })
    booted.install()
    const { w, section } = booted
    const root = await mount(section)
    const doc = w.document
    const note = doc.querySelector('.dsh-rtl-host-note')
    assert.ok(note, 'نوتِ host هست')
    assert.match(note.textContent, /برای ذخیره در پرونده، اپ یک بار بسته و باز شود/)
    // صفحه خالی نمی‌شود: ردیف‌ها با مقدارِ پیش‌فرض دیده می‌شوند
    assert.ok(doc.querySelector('[data-row="rtl"]'))
    await act(async () => { root.unmount() })
  })

  test('ثبت در سطحِ انتخابی: POST درست می‌رود و نشان‌ها تازه می‌شوند', async () => {
    const booted = boot({ status: 200, body: BODY })
    booted.install()
    const { w, section, typeInto: _t } = booted
    const root = await mount(section)
    const doc = w.document
    // «سراسری» پیش‌فرضِ سطحِ هدف است
    const row = doc.querySelector('[data-row="lh"]')
    const select = row.querySelector('select.dsh-rtl-row-level')
    assert.equal(select.value, 'global')
    const input = row.querySelector('input.dsh-rtl-row-value')
    await act(async () => { input.value = '25'; Simulate.change(input) })
    const submit = [...row.querySelectorAll('button')].find((b) => b.textContent === 'ثبت')
    assert.ok(submit, 'دکمهٔ ثبت هست')
    await act(async () => { submit.click() })
    await act(async () => { await new Promise((r) => setTimeout(r, 40)) })
    const post = booted.calls.filter((c) => c.opts && c.opts.method === 'POST')
    assert.equal(post.length, 1, 'یک POST')
    const body = JSON.parse(post[0].opts.body)
    assert.equal(body.action, 'save')
    assert.equal(body.level, 'global')
    assert.equal(body.patch.lh, '25')
    await act(async () => { root.unmount() })
  })

  test('پاک‌کردنِ یک سطح: نشانِ کلیک‌شده ⇒ unset در POST', async () => {
    const booted = boot({ status: 200, body: BODY })
    booted.install()
    const { w, section } = booted
    const root = await mount(section)
    const doc = w.document
    const row = doc.querySelector('[data-row="lh"]')
    const chatBadge = [...row.querySelectorAll('.dsh-rtl-badges .dsh-rtl-level')].find((b) => b.getAttribute('data-level') === 'chat')
    assert.equal(chatBadge.getAttribute('data-set'), '1')
    await act(async () => { chatBadge.click() })
    await act(async () => { await new Promise((r) => setTimeout(r, 40)) })
    const posts = booted.calls.filter((c) => c.opts && c.opts.method === 'POST')
    const body = JSON.parse(posts[posts.length - 1].opts.body)
    assert.equal(body.level, 'chat')
    assert.deepEqual(body.unset, ['lh'])
    await act(async () => { root.unmount() })
  })

  test('ردیفِ «پنجرهٔ سؤالِ تمام‌عرض» (soalPahn) با پیش‌فرضِ روشن', async () => {
    const booted = boot({ status: 200, body: BODY })
    booted.install()
    const { w, section } = booted
    const root = await mount(section)
    const doc = w.document
    const row = doc.querySelector('[data-row="soalPahn"]')
    assert.ok(row, 'ردیف هست')
    assert.match(row.textContent, /پنجرهٔ سؤالِ تمام‌عرض/)
    assert.equal(row.querySelector('[role="switch"]').getAttribute('aria-checked'), 'true', 'پیش‌فرض روشن')
    await act(async () => { root.unmount() })
  })
}
