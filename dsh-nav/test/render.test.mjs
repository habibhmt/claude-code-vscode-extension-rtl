/**
 * آزمونِ رندر با jsdom: ردیف [پوشه] / [چت] / [ساب‌ایجنت] با همان مسیری که اپ بار می‌کند.
 * - منو باز و بسته می‌شود، ردیف‌ها درست‌اند، ردیفِ فعلی تیک دارد.
 * - کلیک روی ردیف همان تابعِ ناوبریِ اپ را صدا می‌زند.
 * - Escape و کلیکِ بیرون منو را می‌بندند.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import vm from 'node:vm'
import { JSDOM } from 'jsdom'

const dom = new JSDOM('<!doctype html><html dir="rtl"><head></head><body><div id="root"></div></body></html>', { pretendToBeVisual: true })
globalThis.window = dom.window
globalThis.document = dom.window.document
globalThis.Node = dom.window.Node
globalThis.IS_REACT_ACT_ENVIRONMENT = true

const require = createRequire(new URL('../../package.json', import.meta.url))
const React = require('react')
const { createRoot } = require('react-dom/client')
const { act } = require('react')

/** بدلِ کوچکِ اجزای primitives، تا آزمون به بستهٔ اپ وابسته نباشد. */
const primitivesStub = {
  MenuSurface: React.forwardRef(function MenuSurface(props, ref) {
    const { children, ...rest } = props
    return React.createElement('div', { ...rest, ref, 'data-menu-surface': '' }, children)
  }),
  StateDot: ({ state }) => React.createElement('span', { 'data-state': state || 'idle', 'data-state-dot': '' }),
  IconCheckOutlineRegular: (props) => React.createElement('svg', { 'data-check': '', ...props }),
}

/** بارگذاریِ client.js عیناً مثلِ اپ: __ModuleLoader__ + require با allowlist. */
function loadPlugin() {
  let loaded = null
  const context = vm.createContext({
    window: { __ModuleLoader__: { load(config) { loaded = config } } },
    document: dom.window.document,
    console,
    setTimeout, clearTimeout, setInterval, clearInterval, queueMicrotask,
    Date, Math, Map, Set, Array, Object, Number, String, Boolean, JSON, Promise, Error, RegExp,
  })
  vm.runInContext(readFileSync(new URL('../client.js', import.meta.url), 'utf8'), context, { filename: 'client.js' })
  assert.ok(loaded, 'client.js باید از __ModuleLoader__ استفاده کند')
  assert.equal(loaded.id, '@local/dsh-nav')
  const fakeRequire = (name) => {
    if (name === 'react') return React
    if (name === 'react-dom') return require('react-dom')
    if (name === '@deepseek-ai/dsh-client-ui-primitives') return primitivesStub
    throw new Error('require غیرمجاز: ' + name)
  }
  return loaded.factory(fakeRequire)
}

const NOW = Date.now()
const MIN = 60_000

/** دادهٔ نمونه، به شکلِ سرویس‌های اپ. */
function makeSources() {
  const sessions = {
    byId: {
      root: { id: 'root', displayTitle: 'اپوس-۱۳۶', updatedAt: NOW - 9 * MIN, running: true, cwd: '/Users/habib/1-MY-WORK/136th-day-fix-rtl-claude' },
      other: { id: 'other', displayTitle: 'اپوس-۱۳۶-۲', updatedAt: NOW - 40 * MIN, running: false, cwd: '/Users/habib/1-MY-WORK/136th-day-fix-rtl-claude' },
      child: { id: 'child', displayTitle: 'آزمایش ساب‌ایجنت دیپ‌سیک', updatedAt: NOW - 2 * MIN, origin: 'subagent', parentId: 'root', running: false },
      archived: { id: 'archived', displayTitle: 'بایگانی‌شده', updatedAt: NOW - 1 * MIN },
    },
    ids: ['root', 'other', 'child', 'archived'],
    projectionsBySession: {
      root: { values: { subagentCatalog: [
        { id: 'child', mode: 'continuable', label: 'آزمایش ساب‌ایجنت دیپ‌سیک', name: 'ds-test' },
      ] } },
    },
  }
  const workspaces = {
    items: [
      { workspaceId: 'w1', title: '136th-day-fix-rtl-claude', path: '/Users/habib/1-MY-WORK/136th-day-fix-rtl-claude', sessionIds: ['root', 'other'], updatedAt: new Date(NOW - 5 * MIN).toISOString() },
      { workspaceId: 'w2', title: 'Default workspace', path: '/Users/habib/Default', sessionIds: [], updatedAt: new Date(NOW - 3 * 60 * MIN).toISOString() },
    ],
    archivedSessionIds: ['archived'],
  }
  return { sessions, workspaces }
}

/** اجرای apply با ctx قلابی که سرویس‌ها و اسلات را ثبت می‌کند. */
function mount(plugin) {
  const sources = makeSources()
  const calls = { openSession: [], startSession: [] }
  const registrations = []
  const snapshotOf = (value) => ({ getSnapshot: () => value, subscribe: () => () => {} })
  const ctx = {
    effect(fn) { const off = fn(); return typeof off === 'function' ? off : () => {} },
    sessions: { list: snapshotOf(sources.sessions) },
    workspaces: { list: snapshotOf(sources.workspaces) },
    uiWorkspace: {
      openSession(id) { calls.openSession.push(id) },
      startSession(id) { calls.startSession.push(id) },
    },
    slots: {
      inject(name, fn) { return fn() },
      register(options, component) { registrations.push({ options, component }); return () => {} },
    },
  }
  plugin.apply(ctx)
  return { registrations, calls, ctx }
}

test('client.js فقط react/react-dom/primitives را require می‌کند و اسلات lineage را پر می‌کند', () => {
  const plugin = loadPlugin()
  const { registrations } = mount(plugin)
  const reg = registrations.find(r => r.options.name === 'conversation.session.header.lineage')
  assert.ok(reg, 'باید در conversation.session.header.lineage ثبت شود')
  assert.ok(reg.options.priority < 0, 'برای جلو افتادن از ui-subagent اولویتِ کمتر لازم است')
  assert.equal(plugin.name, '@local/dsh-nav')
  assert.ok(plugin.inject.includes('slots'))
  assert.ok(plugin.inject.includes('sessions'))
  assert.ok(plugin.inject.includes('workspaces'))
  assert.ok(plugin.inject.includes('uiWorkspace'))
})

test('ردیفِ چتِ عادی: [پوشه] / [چت]، بی ساب‌ایجنت', async () => {
  const plugin = loadPlugin()
  const { registrations } = mount(plugin)
  const row = registrations[0].component
  const root = createRoot(document.getElementById('root'))
  await act(async () => { root.render(React.createElement(row, { lineageSessionId: 'root', displayTitle: 'اپوس-۱۳۶' })) })

  const triggers = [...document.querySelectorAll('[data-dsh-nav-trigger]')]
  assert.equal(triggers.length, 2, 'دو تکه: پوشه و چت')
  assert.equal(triggers[0].textContent.includes('136th-day-fix-rtl-claude'), true, 'نامِ پوشه')
  assert.equal(triggers[1].textContent.includes('اپوس-۱۳۶'), true, 'نامِ چت')
  assert.equal(document.querySelector('[data-dsh-nav-subagent]'), null, 'بی ساب‌ایجنت ⇒ بی تکهٔ سوم')
  const seps = [...document.querySelectorAll('.dsh-nav-sep')].map(s => s.textContent)
  assert.deepEqual(seps, ['/'], 'یک جداکننده بین پوشه و چت')
  await act(async () => { root.unmount() })
})

test('ردیفِ ساب‌ایجنت: سه تکه، با نامِ ساب‌ایجنت', async () => {
  const plugin = loadPlugin()
  const { registrations } = mount(plugin)
  const row = registrations[0].component
  const root = createRoot(document.getElementById('root'))
  await act(async () => { root.render(React.createElement(row, { lineageSessionId: 'child', displayTitle: 'آزمایش ساب‌ایجنت دیپ‌سیک' })) })
  const triggers = [...document.querySelectorAll('[data-dsh-nav-trigger]')]
  assert.equal(triggers.length, 3, 'سه تکه: پوشه، چت، ساب‌ایجنت')
  assert.ok(triggers[2].textContent.includes('آزمایش ساب‌ایجنت دیپ‌سیک'))
  await act(async () => { root.unmount() })
})

test('منوی پوشه: انتخابِ پوشه پنجره را عوض نمی‌کند؛ فقط فهرستِ چت‌ها عوض می‌شود و منوی چت باز می‌شود', async () => {
  const plugin = loadPlugin()
  const { registrations, calls } = mount(plugin)
  const row = registrations[0].component
  const root = createRoot(document.getElementById('root'))
  await act(async () => { root.render(React.createElement(row, { lineageSessionId: 'root', displayTitle: 'اپوس-۱۳۶' })) })

  const folderTrigger = document.querySelector('[data-dsh-nav-folder] [data-dsh-nav-trigger]')
  assert.equal(folderTrigger.getAttribute('aria-expanded'), 'false')
  await act(async () => { folderTrigger.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })) })

  const panel = document.querySelector('[data-dsh-nav-panel]')
  assert.ok(panel, 'منو باید باز شود')
  assert.ok(panel.textContent.includes('پوشه‌ها'))
  const rows = [...panel.querySelectorAll('[data-dsh-nav-row]')]
  assert.equal(rows.length, 2, 'دو پوشه')
  assert.equal(rows[0].getAttribute('data-dsh-nav-row'), 'w1', 'تازه‌ترین اول')
  assert.ok(panel.querySelector('[data-dsh-nav-row="w1"] [data-dsh-nav-current]'), 'پوشهٔ فعلی تیک دارد')
  assert.equal(panel.querySelector('[data-dsh-nav-row="w2"] [data-dsh-nav-current]'), null)

  // کلیک روی پوشهٔ دیگر: هیچ پنجره‌ای عوض نمی‌شود
  await act(async () => { panel.querySelector('[data-dsh-nav-row="w2"]').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })) })
  assert.deepEqual(calls.startSession, [], 'انتخابِ پوشه نباید چت بسازد')
  assert.deepEqual(calls.openSession, [], 'انتخابِ پوشه نباید چت باز کند')
  const triggers = [...document.querySelectorAll('[data-dsh-nav-trigger]')]
  assert.ok(triggers[0].textContent.includes('Default workspace'), 'تکهٔ پوشه پوشهٔ انتخاب‌شده را نشان می‌دهد')
  assert.ok(triggers[1].textContent.includes('یک چت انتخاب کن'))
  const chatPanel = document.querySelector('[data-dsh-nav-panel]')
  assert.ok(chatPanel && chatPanel.textContent.includes('چت‌های این پوشه'), 'منوی چت‌های پوشهٔ تازه خودش باز می‌شود')
  assert.ok(chatPanel.textContent.includes('چتی در این پوشه نیست'))

  // دکمهٔ «+ چتِ جدید» در همان پوشه
  await act(async () => { chatPanel.querySelector('[data-dsh-nav-new-chat]').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })) })
  assert.deepEqual(calls.startSession, ['w2'], '+ باید در پوشهٔ انتخاب‌شده چت بسازد')
  assert.equal(document.querySelector('[data-dsh-nav-panel]'), null, 'بعد از + بسته می‌شود')
  await act(async () => { root.unmount() })
})

test('منوی چت: دکمهٔ + در پوشهٔ فعلی چتِ جدید می‌سازد', async () => {
  const plugin = loadPlugin()
  const { registrations, calls } = mount(plugin)
  const row = registrations[0].component
  const root = createRoot(document.getElementById('root'))
  await act(async () => { root.render(React.createElement(row, { lineageSessionId: 'root', displayTitle: 'اپوس-۱۳۶' })) })
  const chatTrigger = document.querySelector('[data-dsh-nav-chat] [data-dsh-nav-trigger]')
  await act(async () => { chatTrigger.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })) })
  const plus = document.querySelector('[data-dsh-nav-panel] [data-dsh-nav-new-chat]')
  assert.ok(plus, 'دکمهٔ + در سرِ منوی چت')
  await act(async () => { plus.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })) })
  assert.deepEqual(calls.startSession, ['w1'])
  await act(async () => { root.unmount() })
})

test('منوی چت: چت‌های همین پوشه، تازه‌ترین اول، بی بایگانی، کلیک openSession', async () => {
  const plugin = loadPlugin()
  const { registrations, calls } = mount(plugin)
  const row = registrations[0].component
  const root = createRoot(document.getElementById('root'))
  await act(async () => { root.render(React.createElement(row, { lineageSessionId: 'root', displayTitle: 'اپوس-۱۳۶' })) })

  const chatTrigger = document.querySelector('[data-dsh-nav-chat] [data-dsh-nav-trigger]')
  await act(async () => { chatTrigger.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })) })
  const panel = document.querySelector('[data-dsh-nav-panel]')
  assert.ok(panel)
  const rows = [...panel.querySelectorAll('[data-dsh-nav-row]')]
  assert.deepEqual(rows.map(r => r.getAttribute('data-dsh-nav-row')), ['root', 'other'], 'تازه‌ترین اول')
  assert.ok(rows[0].textContent.includes('9min'), 'زمانِ نسبی مثلِ سایدبار')
  assert.ok(rows[1].textContent.includes('40min'))
  assert.ok(rows[0].querySelector('[data-dsh-nav-current]'), 'چتِ فعلی تیک دارد')
  // چتِ در حال اجرا نقطهٔ ongoing دارد
  assert.equal(rows[0].querySelector('[data-state="ongoing"]') !== null, true, 'چتِ در حال اجرا اسپینر دارد')

  await act(async () => { panel.querySelector('[data-dsh-nav-row="other"]').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })) })
  assert.deepEqual(calls.openSession, ['other'])
  await act(async () => { root.unmount() })
})

test('Escape منو را می‌بندد و کلیکِ بیرون هم', async () => {
  const plugin = loadPlugin()
  const { registrations } = mount(plugin)
  const row = registrations[0].component
  const root = createRoot(document.getElementById('root'))
  await act(async () => { root.render(React.createElement(row, { lineageSessionId: 'root', displayTitle: 'اپوس-۱۳۶' })) })

  const trigger = () => document.querySelector('[data-dsh-nav-chat] [data-dsh-nav-trigger]')
  await act(async () => { trigger().dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })) })
  assert.ok(document.querySelector('[data-dsh-nav-panel]'), 'باز شد')
  await act(async () => { document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })) })
  assert.equal(document.querySelector('[data-dsh-nav-panel]'), null, 'Escape بست')

  await act(async () => { trigger().dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })) })
  assert.ok(document.querySelector('[data-dsh-nav-panel]'), 'دوباره باز شد')
  await act(async () => { document.body.dispatchEvent(new dom.window.MouseEvent('pointerdown', { bubbles: true })) })
  assert.equal(document.querySelector('[data-dsh-nav-panel]'), null, 'کلیکِ بیرون بست')
  await act(async () => { root.unmount() })
})

test('منوی ساب‌ایجنت: فرزندانِ چت با نام و وضعیت', async () => {
  const plugin = loadPlugin()
  const { registrations, calls } = mount(plugin)
  const row = registrations[0].component
  const root = createRoot(document.getElementById('root'))
  await act(async () => { root.render(React.createElement(row, { lineageSessionId: 'child', displayTitle: 'آزمایش ساب‌ایجنت دیپ‌سیک' })) })
  const sub = document.querySelector('[data-dsh-nav-subagent] [data-dsh-nav-trigger]')
  await act(async () => { sub.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })) })
  const panel = document.querySelector('[data-dsh-nav-panel]')
  const rows = [...panel.querySelectorAll('[data-dsh-nav-row]')]
  assert.deepEqual(rows.map(r => r.getAttribute('data-dsh-nav-row')), ['child'])
  assert.ok(rows[0].textContent.includes('آزمایش ساب‌ایجنت دیپ‌سیک'))
  assert.ok(rows[0].querySelector('[data-dsh-nav-current]'), 'ساب‌ایجنتِ فعلی تیک دارد')
  await act(async () => { root.unmount() })
})
