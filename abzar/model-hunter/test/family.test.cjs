/**
 * آزمونِ شرط‌دارِ فیلترِ خانواده در جدولِ پنل (نیمهٔ Client).
 * باگ: فیلتر با `indexOf` بود، پس `deepseek-chat` سه مدل را می‌آورد.
 *
 * اجرا: node test/family.test.cjs
 * خرابکاری: MH_CLIENT=<نسخهٔ خراب> node test/family.test.cjs
 */
const fs = require('fs')
const path = require('path')
const { JSDOM } = require('jsdom')

const CLIENT = process.env.MH_CLIENT || path.join(__dirname, '..', 'client.js')

const mk = (model, provider, price) => ({
  model, provider, slug: provider.toLowerCase(), tier: null, quantization: 'fp8',
  quality: 91, offPct: 0, priceIn1m: price, cacheRead1m: 0.002, priceOut1m: price * 4,
  listedIn1m: price, listedOut1m: price * 4, uptime: 100, status: 0, usable: true, official: false,
  maxCompletion: 1000,
})
const rows = [
  mk('deepseek/deepseek-chat', 'DeepInfra', 0.257),
  mk('deepseek/deepseek-chat-v3.1', 'Fireworks', 0.250),
  mk('deepseek/deepseek-chat-v3-0324', 'Together', 0.290),
  mk('deepseek/deepseek-v4-pro-0813', 'Parasail', 1.98),
]
const state = {
  ts: Date.now(), focus: 'deepseek/deepseek-v4.1-flash-1017', error: null,
  families: { 'deepseek-chat': [], 'deepseek-chat-v3.1': [], 'deepseek-chat-v3-0324': [], 'deepseek-v4-pro-0813': [] },
  rows,
}

const failures = []
function check(name, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected)
  if (a === e) console.log(`  ✓ ${name}`)
  else { failures.push(`${name}: انتظار ${e} ولی شد ${a}`); console.log(`  ✗ ${name} — انتظار ${e} ولی شد ${a}`) }
}

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { pretendToBeVisual: true })
global.window = dom.window
global.document = dom.window.document
global.navigator = dom.window.navigator
global.HTMLElement = dom.window.HTMLElement
global.Element = dom.window.Element
global.IS_REACT_ACT_ENVIRONMENT = true

global.fetch = async (url) => ({ ok: true, status: 200,
  json: async () => (String(url).includes('recommend')
    ? { ok: true, model: 'deepseek/deepseek-v4-pro-0813', profile: { scope: 'session', sessions: 1, requests: 5, cacheShare: 90, avgPromptPerRequest: 1000, avgCachedPerRequest: 900, avgOutPerRequest: 10 },
        recommended: { provider: 'Parasail', tier: null, quantization: 'fp8', quality: 91, priceIn1m: 1.98, cacheRead1m: 0.066, priceOut1m: 5.94, costPerRequest: 0.01 },
        baseline: null, savingsPct: null, alternatives: [], projectedPer1000Requests: 10 }
    : state) })

let factory
global.window.__ModuleLoader__ = { load: ({ factory: f }) => { factory = f } }
const React = require('react')
const ReactDOM = require('react-dom/client')
const act = React.act || require('react-dom/test-utils').act
const requireShim = (n) => { if (n === 'react') return React; throw new Error('unexpected ' + n) }
new Function('window', 'require', fs.readFileSync(CLIENT, 'utf8'))(global.window, requireShim)

const mod = factory(requireShim)
const regs = []
mod.apply({ effect: (fn) => fn(), slots: { inject: (k, cb) => cb(), register: (o, C) => regs.push({ o, C }) } })
const panel = regs.find((r) => r.o.name === 'main')
const root = ReactDOM.createRoot(document.getElementById('root'))

const providers = () => [...document.querySelectorAll('tbody tr')].map((tr) => tr.children[1].textContent.trim())
const familySelect = () => [...document.querySelectorAll('select')].find((s) =>
  [...s.options].some((o) => o.textContent.includes('همهٔ خانواده‌ها')))

;(async () => {
  await act(async () => { root.render(React.createElement(panel.C, {})) })
  await act(async () => { await new Promise((r) => setTimeout(r, 60)) })

  check('بدونِ فیلتر: هر ۴ مدل', providers().length, 4)

  const sel = familySelect()
  check('منوی خانواده پیدا شد', Boolean(sel), true)

  await act(async () => {
    sel.value = 'deepseek-chat'
    sel.dispatchEvent(new dom.window.Event('change', { bubbles: true }))
  })
  await act(async () => { await new Promise((r) => setTimeout(r, 40)) })

  check('انتخاب «deepseek-chat» فقط ۱ ردیف', providers().length, 1)
  check('همان ردیف درست است', providers(), ['DeepInfra'])

  await act(async () => {
    const s2 = familySelect()
    s2.value = 'deepseek-v4-pro-0813'
    s2.dispatchEvent(new dom.window.Event('change', { bubbles: true }))
  })
  await act(async () => { await new Promise((r) => setTimeout(r, 40)) })
  check('انتخاب «پرو ۸۱۳» فقط ۱ ردیف', providers(), ['Parasail'])

  if (failures.length) {
    console.error(`\n${failures.length} شرط شکست خورد:`)
    for (const f of failures) console.error(' - ' + f)
    process.exit(1)
  }
  console.log('\nهمهٔ شرط‌ها سبز.')
  process.exit(0)
})().catch((e) => { console.error('آزمون با خطا متوقف شد:', e.message); process.exit(1) })