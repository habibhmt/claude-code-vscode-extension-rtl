/**
 * آزمونِ نصفِ client — بدونِ مرورگر.
 * client.js را در VM اجرا می‌کند، apply(ctx) را با ctxِ قلابی صدا می‌زند و
 * ثبت‌ها، کلیک‌گیرِ «همان دکمه»، و رندرِ پنل را می‌سنجد.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'

const source = readFileSync(new URL('../client.js', import.meta.url), 'utf8')
for (const match of source.matchAll(/require\(([^)]*)\)/g)) {
  const spec = match[1].trim()
  assert.ok(spec === "'react'" || spec === '"react"', 'client.js must only require react, found ' + match[0])
}

let loaded
const listeners = []
const document = {
  addEventListener(type, fn, capture) { listeners.push({ type, fn, capture }) },
  removeEventListener(type, fn) { const i = listeners.findIndex(l => l.fn === fn); if (i >= 0) listeners.splice(i, 1) },
}
const context = vm.createContext({
  window: { __ModuleLoader__: { load(config) { loaded = config } } },
  document, console, setTimeout, clearTimeout,
  setInterval: () => 0, clearInterval: () => {},
  fetch: async () => { throw new Error('no network in test') },
  URL, URLSearchParams,
})
vm.runInContext(source, context, { filename: 'client.js' })
assert.ok(loaded, '__ModuleLoader__.load was not called')
assert.equal(loaded.id, '@local/dsh-side-panel')

const require = createRequire(new URL('../../package.json', import.meta.url))
const mod = loaded.factory(require)
assert.equal(mod.name, '@local/dsh-side-panel')
for (const service of ['slots', 'sidebarRightTabs', 'sidebarRight', 'layout', 'uiConversation']) {
  assert.ok(mod.inject.includes(service), 'inject must declare ' + service)
}

// --- ctx قلابی -------------------------------------------------------------
const registered = { tabs: [], slots: [] }
const calls = []
const ctx = {
  effect(fn) { return fn() },
  sidebarRightTabs: { register(def) { registered.tabs.push(def); return () => {} } },
  sidebarRight: { openTab(kind) { calls.push('openTab:' + kind) } },
  layout: { openRightbar(track, full) { calls.push('openRightbar:' + track + ',' + full) }, selectPanel(id) { calls.push('selectPanel:' + id) } },
  slots: {
    inject(name, fn) { return fn() },
    register(options, component) { registered.slots.push({ options, component }); return () => {} },
    entries(name) {
      assert.equal(name, 'conversation.view')
      return [
        { options: { id: 'chat', label: () => 'Chat' } },
        { options: { id: 'trajectory', label: () => 'Trajectory' } },
        { options: { id: 'stats', label: () => 'Statistics' } },
      ]
    },
  },
}
mod.apply(ctx)

assert.equal(registered.tabs.length, 1)
assert.equal(registered.tabs[0].kind, 'side-panel')
const body = registered.slots.find(e => e.options.name === 'sidebar.right.pane.tab')
assert.ok(body && body.options.key === registered.tabs[0].id, 'tab body key = tab id')
const icon = registered.slots.find(e => e.options.name === 'sidebar.panellist')
assert.ok(icon && icon.options.id === 'side-panel', 'panellist icon')
const pill = registered.slots.find(e => e.options.name === 'conversation.composer.dock')
assert.ok(pill && pill.options.id === 'side-panel-cost', 'cost pill next to Cache hit / tok/s')
const main = registered.slots.find(e => e.options.name === 'main')
assert.ok(main && main.options.key === 'side-panel', 'main safety net (selectPanel would throw without it)')

// --- کلیک‌گیر ---------------------------------------------------------------
const clickers = listeners.filter(l => l.type === 'click')
assert.equal(clickers.length, 1, 'exactly one click listener')
assert.equal(clickers[0].capture, true, 'must run in capture phase (before React)')
const fire = (target, extra = {}) => {
  const ev = { target, prevented: false, stopped: false, altKey: false, ...extra,
    preventDefault() { this.prevented = true }, stopPropagation() { this.stopped = true } }
  clickers[0].fn(ev)
  return ev
}
// عنصرِ قلابی: closest با جدولِ انتخابگرها
const el = (map, text = '') => ({
  textContent: text,
  attrs: {},
  setAttribute(k, v) { this.attrs[k] = v },
  closest(sel) { return Object.prototype.hasOwnProperty.call(map, sel) ? (map[sel] === 'self' ? this : map[sel]) : null },
  querySelector(sel) { return map['qs:' + sel] ?? null },
})
const TAB = '[data-conversation-tabs] [role="tab"]'

// ۱) کلیک روی خودِ نقاشیِ آیکون
calls.length = 0
let ev = fire(el({ '[data-side-panel-trigger]': {} }))
assert.ok(ev.prevented && ev.stopped, 'svg click must be captured')
assert.deepEqual(calls, ['openRightbar:true,false', 'openTab:side-panel'])

// ۲) کلیک روی حاشیهٔ دکمه (نه خودِ svg) — قبلاً در می‌رفت
calls.length = 0
const outerButton = el({ 'qs:[data-side-panel-trigger]': {} })
ev = fire(el({ button: outerButton }))
assert.ok(ev.prevented, 'click on the button padding must be captured too')
assert.deepEqual(calls, ['openRightbar:true,false', 'openTab:side-panel'])

// ۳) «همان دکمه»: Trajectory ⇒ پنل، چت می‌ماند
calls.length = 0
const trajectoryTab = el({ [TAB]: 'self' }, 'Trajectory')
ev = fire(trajectoryTab)
assert.ok(ev.prevented && ev.stopped, 'Trajectory tab must open the side panel instead of the full page')
assert.deepEqual(calls, ['openRightbar:true,false', 'openTab:side-panel'])
assert.equal(trajectoryTab.attrs['data-side-panel-view'], 'trajectory')

// ۴) Statistics هم
calls.length = 0
ev = fire(el({ [TAB]: 'self' }, 'Statistics'))
assert.ok(ev.prevented, 'Statistics tab must open the side panel')

// ۵) Option+کلیک ⇒ صفحهٔ کاملِ قدیم (دست نمی‌زنیم)
calls.length = 0
ev = fire(el({ [TAB]: 'self' }, 'Trajectory'), { altKey: true })
assert.ok(!ev.prevented && calls.length === 0, 'Alt-click must keep the old full page')

// ۶) Chat و هر تبِ دیگر دست‌نخورده
ev = fire(el({ [TAB]: 'self' }, 'Chat'))
assert.ok(!ev.prevented, 'Chat tab must not be touched')
ev = fire(el({}, 'هر چیز'))
assert.ok(!ev.prevented, 'unrelated clicks must not be touched')

// --- رندرِ پنل (SSR؛ effectها اجرا نمی‌شوند) -------------------------------
const React = require('react')
const { renderToString } = require('react-dom/server')
fire(el({ [TAB]: 'self' }, 'Trajectory')) // بخشِ تراژکتوری
const html = renderToString(React.createElement(body.component, { sessionId: 'session-x' }))
for (const text of ['تراژکتوری (به فارسی)', 'آمار', 'تمام‌صفحه', 'همین چت تا الان چقدر خرج کرد', 'چرا گران شد', 'هر نوبت چه بود']) {
  assert.ok(html.includes(text), 'panel must show: ' + text)
}
assert.ok(!html.includes('همه مدل'), 'no account-wide headline')
fire(el({ [TAB]: 'self' }, 'Statistics')) // همان دکمه ⇒ بخشِ آمار
const statsHtml = renderToString(React.createElement(body.component, { sessionId: 'session-x' }))
assert.ok(statsHtml.includes('آمارِ همین چت') && statsHtml.includes('به تفکیکِ مدل'), 'Statistics button must show the stats section')

// --- چیدمان ---------------------------------------------------------------
assert.ok(source.includes('[data-sp-layout] > [data-rightbar-col] { grid-column: 2 !important; }'), 'panel column moves next to the sidebar')
assert.ok(source.includes("getComputedStyle(frame).direction === 'rtl'"), 'layout fix only in RTL')
assert.ok(source.includes("'/plugins/side-panel/session-cost?sessionId='"), 'per-chat cost is polled')
assert.ok(source.includes('preferredPanelWidth(limits.frameWidth, limits.sidebar)'), 'agreed default width 520 is applied')
assert.ok(source.includes("const WIDTH_KEY = 'dsh-side-panel/width'"), 'saved width is remembered')
assert.ok(source.includes('function setPanelWidth(target, save = true)'), 'width is set through one reusable function')
assert.ok(source.includes('[data-sp-layout] > [data-side="sidebar"] { display: none !important; }'), 'misplaced sidebar drag strip is removed from the chat in RTL')
assert.ok(source.includes('tokens: raw.tokens || (raw.byModel || []).reduce('), 'old host payload: tokens rebuilt from byModel, never a fake 0')
assert.ok(source.includes("row.unpriceable ? 'بی‌قیمت (غیرِ OpenRouter)'"), 'non-OpenRouter rows never show a fake $0')

const { withInlinedFold } = await import('../tools/sync-fold.mjs?check=1')
assert.equal(withInlinedFold(source), source, 'inline fold is out of sync — run node tools/sync-fold.mjs')

console.log('client OK: همان دکمه + آیکون + Option-کلیک + رندرِ پنل + چیدمان')