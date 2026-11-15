import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { createRequire } from 'node:module'
const require2 = createRequire(import.meta.url)
const { JSDOM } = require2('jsdom')

const source = fs.readFileSync(path.join(import.meta.dirname, '..', 'client.js'), 'utf8')

// وقتی set شود، fetch داخلِ کلاینت جوابِ همین state را می‌دهد (شبیهِ route وضعیت).
let fetchStub = null

/** اجرای نیمهٔ کلاینت در یک محیطِ ساختگی تا مقدارِ factory را بگیریم. */
function loadClient(overrides) {
  let captured = null
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://127.0.0.1:57752/' })
  const fakeReact = {
    createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
    Fragment: 'Fragment',
    useState: (init) => [typeof init === 'function' ? init() : init, () => {}],
    useEffect: () => {},
    useRef: (v) => ({ current: v }),
    useMemo: (fn) => fn(),
    useCallback: (fn) => fn,
    cloneElement: (el, props) => el,
    ...(overrides || {}),
  }
  const sandbox = {
    window: {
      __ModuleLoader__: { load: (def) => { captured = def } },
      setTimeout: () => 0, setInterval: () => 0, clearTimeout: () => {}, clearInterval: () => {},
      localStorage: dom.window.localStorage,
    },
    document: dom.window.document,
    fetch: async () => ({ ok: true, json: async () => ({}) }),
    console,
    Intl,
    Date,
    Math,
    Number,
    String,
    Array,
    Object,
    JSON,
  }
  const fetchImpl = sandbox.fetch
  const fn = new Function('window', 'document', 'fetch', 'console', 'Intl', 'Date', 'Math', 'Number', 'String', 'Array', 'Object', 'JSON', 'require', source)
  fn(sandbox.window, sandbox.document, (url, init) => (fetchStub ? fetchStub(url, init) : fetchImpl(url, init)), console, Intl, Date, Math, Number, String, Array, Object, JSON, (name) => (name === 'react' ? fakeReact : {}))
  assert.ok(captured, 'client.js باید __ModuleLoader__.load را صدا بزند')
  return { def: captured, react: fakeReact }
}

test('کلاینت: با شناسهٔ درست ثبت می‌شود', () => {
  const { def } = loadClient()
  assert.equal(def.id, '@local/dsh-advisor')
  assert.equal(typeof def.factory, 'function')
})

test('کلاینت: سرویس‌های تزریقی و سه جای ثبت', () => {
  const { def, react } = loadClient()
  const required = def.factory((name) => (name === 'react' ? react : {}))
  assert.deepEqual(required.inject.slice().sort(), ['layout', 'sidebarRight', 'sidebarRightTabs', 'slots'].sort())
  const registered = []
  const ctx = {
    effect: (fn) => { fn(); return () => {} },
    slots: { inject: (key, cb) => { cb(); return () => {} }, register: (opts) => { registered.push(opts); return () => {} } },
    sidebarRightTabs: { register: (opts) => { registered.push(opts); return () => {} } },
    sidebarRight: { openTab: () => {} },
    layout: { openRightbar: () => {} },
  }
  required.apply(ctx)
  const tabType = registered.find((r) => r.kind === 'advisor')
  assert.ok(tabType, 'نوعِ تب باید ثبت شود')
  assert.ok(registered.some((r) => r.name === 'sidebar.right.pane.tab'), 'بدنهٔ تب')
  assert.ok(registered.some((r) => r.name === 'conversation.session.header.actions'), 'چیپِ سرصفحه')
  assert.ok(registered.some((r) => r.name === 'sidebar.panellist'), 'آیکنِ فهرست')
})
/** رندرِ پنل با یک state ساختگی تا متن‌های سرصفحهٔ «پیشنهادها» را بگیریم. */
async function renderPanel(withNodes) {
  // Reactِ ساختگیِ حالت‌دار: هر useState جای خودش (با ترتیبِ هوک‌ها) نگه می‌دارد و
  // setState همان‌جا عوضش می‌کند — مثلِ React، ولی رندر را خودمان بعد از fetch صدا می‌زنیم.
  let store = []
  let hookIndex = 0
  const useStateful = (init) => {
    const slot = hookIndex++
    if (store[slot] === undefined) store[slot] = typeof init === 'function' ? init() : init
    const set = (next) => { store[slot] = typeof next === 'function' ? next(store[slot]) : next }
    // اولین useStateِ پنل همان stateِ usePoll است؛ پاسخ را از قبل «ست‌شده» برمی‌گردانیم.
    if (store[slot] && store[slot].status === 'loading' && stubbedState) store[slot] = { status: 'ok', value: stubbedState }
    return [store[slot], set]
  }
  const { def, react } = loadClient({ useState: useStateful })
  const required = def.factory((name) => (name === 'react' ? react : {}))
  let body = null
  const ctx = {
    effect: (fn) => { fn(); return () => {} },
    slots: {
      inject: (key, cb) => { cb(); return () => {} },
      register: (opts, comp) => { if (opts && opts.name === 'sidebar.right.pane.tab') body = comp; return () => {} },
    },
    sidebarRightTabs: { register: () => () => {} },
    sidebarRight: { openTab: () => {} },
    layout: { openRightbar: () => {} },
  }
  required.apply(ctx)
  assert.ok(body, 'بدنهٔ تب باید ثبت شود')
  // در اپ React این را دوباره بعد از رسیدنِ fetch رندر می‌کند؛ این‌جا خودمان بعد از حل‌شدنِ
  // Promiseهای useEffect دوباره صدا می‌زنیم تا متنِ نهاییِ پنل را ببینیم.
  const render = () => { hookIndex = 0; const el = body({ sessionId: 's-test', ctx }); return el && el.type ? el.type(el.props) : el }
  render()
  await new Promise((done) => setTimeout(done, 20))
  const el = render()
  const texts = []
  const nodes = []
  const walk = (node) => {
    if (node == null || node === false) return
    if (typeof node === 'string' || typeof node === 'number') { texts.push(String(node)); return }
    if (Array.isArray(node)) { node.forEach(walk); return }
    if (withNodes && node.type) nodes.push(node)
    if (node.children) node.children.forEach(walk)
  }
  // المانِ AdvisorBody تبدیل‌نشده برمی‌گردد؛ خودش را با همان props صدا می‌زنیم.
  if (el && typeof el === 'object' && typeof el.type === 'function') walk(el.type(el.props))
  else walk(el)
  return { texts, el, nodes }
}

/** شبیهِ state route: lastResult با at و play. */
function fakeState(at, play) {
  return {
    ok: true,
    play: Boolean(play),
    running: false,
    lastRunAt: at,
    quota: null,
    cost: null,
    serverMode: 'auto',
    lastResult: {
      at, play: Boolean(play), headline: 'سرصفحهٔ نمونه', content: 'متنِ پیشنهاد', verdict: 'advice',
      serverLabel: 'نمونه/سرور', usage: { promptTokens: 10, completionTokens: 5 }, cost: 0.001,
    },
  }
}

// state را جایگزین fetch می‌کنیم تا usePoll دادهٔ ما را بخواند (polling واقعی نداریم).
let stubbedState = null
function stubStateFetch(stateJson) {
  stubbedState = stateJson
  fetchStub = async () => ({ ok: true, json: async () => stateJson })
}

test('سرصفحهٔ پیشنهادها: ساعتِ پیشنهاد و منبع (دستی) کنارِ عنوان', async () => {
  const at = Date.now() - 2 * 60 * 1000 // دو دقیقه پیش، امروز
  stubStateFetch(fakeState(at, false))
  const { texts } = await renderPanel()
  const clock = new Intl.DateTimeFormat('fa-IR', { timeZone: 'Asia/Tehran', hour: '2-digit', minute: '2-digit' }).format(new Date(at))
  const heading = texts.find((t) => t.startsWith('— '))
  assert.ok(heading, 'وقتِ پیشنهاد باید کنارِ «پیشنهادها» بیاید: ' + JSON.stringify(texts))
  assert.ok(heading.includes('ساعتِ ' + clock), 'ساعتِ تهران باید باشد: ' + heading)
  assert.ok(heading.includes('امروز'), 'برای امروز «امروز» می‌آید: ' + heading)
  assert.ok(heading.includes('· دستی'), 'منبعِ دستی باید باشد: ' + heading)
  assert.ok(!/روز پیش/.test(heading), 'برای امروز «روز پیش» نباید باشد: ' + heading)
})

test('سرصفحهٔ پیشنهادها: منبعِ پلی', async () => {
  const at = Date.now() - 60 * 1000
  stubStateFetch(fakeState(at, true))
  const { texts } = await renderPanel()
  const heading = texts.find((t) => t.startsWith('— '))
  assert.ok(heading, 'وقتِ پیشنهاد باید کنارِ «پیشنهادها» بیاید')
  assert.ok(heading.includes('· پلی'), 'منبعِ پلی باید باشد: ' + heading)
  assert.ok(!heading.includes('دستی'), 'وقتی پلی است «دستی» نباید باشد: ' + heading)
})

test('سرصفحهٔ پیشنهادها: تاریخِ شمسی برای روزِ غیرامروز', async () => {
  const at = Date.now() - 3 * 86400000
  stubStateFetch(fakeState(at, false))
  const { texts } = await renderPanel()
  const clock = new Intl.DateTimeFormat('fa-IR', { timeZone: 'Asia/Tehran', hour: '2-digit', minute: '2-digit' }).format(new Date(at))
  const date = new Intl.DateTimeFormat('fa-IR', { timeZone: 'Asia/Tehran', month: 'long', day: 'numeric' }).format(new Date(at))
  const heading = texts.find((t) => t.startsWith('— '))
  assert.ok(heading, 'وقتِ پیشنهاد باید کنارِ «پیشنهادها» بیاید')
  assert.ok(heading.includes(date), 'تاریخِ شمسی باید باشد: ' + heading + ' / انتظار: ' + date)
  assert.ok(heading.includes(clock), 'ساعت باید باشد: ' + heading)
  assert.ok(heading.includes('روز پیش'), 'فاصله باید با «روز پیش» بیاید: ' + heading)
  assert.ok(!heading.includes('امروز'), 'برای غیرامروز «امروز» نباید باشد: ' + heading)
})

test('سرصفحهٔ پیشنهادها: بی at هیچ چیزِ اضافه‌ای نمی‌آید', async () => {
  const state = fakeState(Date.now(), false)
  delete state.lastResult.at
  stubStateFetch(state)
  const { texts } = await renderPanel()
  assert.ok(!texts.some((t) => t.startsWith('— ')), 'بی at نباید چیزی اضافه شود: ' + JSON.stringify(texts))
  assert.ok(texts.includes('پیشنهادها'), 'عنوانِ «پیشنهادها» می‌ماند')
})

test('دکمهٔ فعال: متنش سفید-روی-برندِ روشن نمی‌شود (تمِ تاریک)', async () => {
  const state = fakeState(Date.now(), true)
  state.running = true // دکمهٔ «⋯ در حال بررسی» و «پلی: روشن» فعال می‌شوند
  stubStateFetch(state)
  const { nodes } = await renderPanel(true)
  const buttons = nodes.filter((n) => n && n.type === 'button' && n.props && n.props.style && n.props.style.background === 'var(--dsw-alias-brand-primary, #3b82f6)')
  assert.ok(buttons.length >= 2, 'دکمه‌های فعال باید پیدا شوند: ' + buttons.length)
  for (const b of buttons) {
    const color = String(b.props.style.color)
    assert.notEqual(color, '#fff', "'#fff' روی برندِ روشنِ تمِ تاریک خوانده نمی‌شود")
    assert.ok(color.includes('--dsw-alias-label-primary-inverted'), 'رنگِ متن باید خلافِ برند باشد: ' + color)
  }
})

test('رندرِ جدولِ مارک‌داون: thead/tbody و rtl', () => {
  const source = fs.readFileSync(path.join(import.meta.dirname, '..', 'client.js'), 'utf8')
  assert.ok(source.includes('isSeparator'), 'شناساییِ خطِ جداکنندهٔ جدول')
  assert.ok(source.includes("'thead'"), 'جدول باید thead بسازد')
  assert.ok(source.includes("'tbody'"), 'جدول باید tbody بسازد')
  assert.ok(source.includes("dir: 'rtl'"), 'جدولِ نتیجه باید راست‌به‌چپ باشد')
})
