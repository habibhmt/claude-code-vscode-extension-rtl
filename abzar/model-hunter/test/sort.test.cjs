/**
 * آزمونِ واقعیِ مرتب‌سازیِ جدولِ «شکارچی مدل».
 * شرط‌دار است: هر ادعا با assert سنجیده می‌شود و در صورت شکست با کدِ ۱ خارج می‌شود.
 * متغیرِ MH_CLIENT می‌تواند مسیرِ فایلِ کلاینت را عوض کند (برای آزمونِ خرابکاری).
 *
 * اجرا:  node test/sort.test.cjs
 */
const fs = require('fs')
const path = require('path')
const { JSDOM } = require('jsdom')

const CLIENT = process.env.MH_CLIENT || path.join(__dirname, '..', 'client.js')

const rows = [
  { model: 'deepseek/x', provider: 'Bravo', tier: 'priority', quantization: 'fp8', quality: 95, offPct: 10, priceIn1m: 0.30, cacheRead1m: 0.009, priceOut1m: 0.90, listedIn1m: 0.30, listedOut1m: 0.90, uptime: 100, status: 0, usable: true, official: false, maxCompletion: 1 },
  { model: 'deepseek/x', provider: 'Alpha', tier: null, quantization: 'fp8', quality: 91, offPct: 65, priceIn1m: 0.10, cacheRead1m: 0.002, priceOut1m: 0.40, listedIn1m: 0.30, listedOut1m: 1.20, uptime: 100, status: 0, usable: true, official: false, maxCompletion: 1 },
  { model: 'deepseek/x', provider: 'Zeta', tier: 'flex', quantization: 'fp4', quality: 87, offPct: 0, priceIn1m: 0.05, cacheRead1m: 0.001, priceOut1m: 0.20, listedIn1m: 0.05, listedOut1m: 0.20, uptime: 66, status: 0, usable: true, official: false, maxCompletion: 1 },
  { model: 'deepseek/x', provider: 'DeepSeek', tier: null, quantization: 'unknown', quality: 88, offPct: 0, priceIn1m: 0.15, cacheRead1m: 0.003, priceOut1m: 0.60, listedIn1m: 0.15, listedOut1m: 0.60, uptime: 100, status: 0, usable: true, official: true, maxCompletion: 1 },
]
const state = { ts: Date.now(), focus: 'deepseek/x', error: null, families: { x: [] }, rows }

// ---------- شرط‌ها ----------
const failures = []
function check(name, actual, expected) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a === e) {
    console.log(`  ✓ ${name}`)
  } else {
    failures.push(`${name}: انتظار ${e} ولی شد ${a}`)
    console.log(`  ✗ ${name} — انتظار ${e} ولی شد ${a}`)
  }
}

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { pretendToBeVisual: true })
global.window = dom.window
global.document = dom.window.document
global.navigator = dom.window.navigator
global.HTMLElement = dom.window.HTMLElement
global.Element = dom.window.Element
global.IS_REACT_ACT_ENVIRONMENT = true

global.fetch = async (url) => ({
  ok: true,
  status: 200,
  json: async () => (String(url).includes('recommend')
    ? { ok: true, profile: { scope: 'project', sessions: 1, requests: 1, cacheShare: 90, avgPromptPerRequest: 1000, avgCachedPerRequest: 900, avgOutPerRequest: 10 }, recommended: { provider: 'Alpha', tier: null, quantization: 'fp8', quality: 91, priceIn1m: 0.1, cacheRead1m: 0.002, priceOut1m: 0.4, costPerRequest: 0.001 }, baseline: null, savingsPct: null, alternatives: [] }
    : state),
})

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

;(async () => {
  check('پنل در Slotِ main ثبت شده', Boolean(panel), true)
  await act(async () => { root.render(React.createElement(panel.C, {})) })
  await act(async () => { await new Promise((r) => setTimeout(r, 60)) })

  const ths = () => [...document.querySelectorAll('th')]
  const providers = () => [...document.querySelectorAll('tbody tr')].map((tr) => tr.children[1].textContent.trim())
  const arrow = (label) => {
    const th = ths().find((h) => h.textContent.includes(label))
    if (!th) return null
    const t = th.textContent
    if (t.includes('▲')) return '▲'
    if (t.includes('▼')) return '▼'
    return ''
  }
  const click = async (label) => {
    const th = ths().find((h) => h.textContent.includes(label))
    if (!th) throw new Error('هدر پیدا نشد: ' + label)
    await act(async () => { th.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })) })
    await act(async () => { await new Promise((r) => setTimeout(r, 30)) })
  }

  check('ترتیبِ پیش‌فرض (مرجعِ دیپ‌سیک اول)', providers(), ['DeepSeek', 'Alpha', 'Bravo', 'Zeta'])
  check('بدونِ کلیک هیچ فلشی نیست', ths().every((h) => !h.textContent.includes('▲') && !h.textContent.includes('▼')), true)

  await click('ورودی')
  check('کلیک «ورودی» → صعودی', providers(), ['Zeta', 'Alpha', 'DeepSeek', 'Bravo'])
  check('فلشِ صعودی ▲', arrow('ورودی'), '▲')

  await click('ورودی')
  check('کلیک دوم → نزولی', providers(), ['Bravo', 'DeepSeek', 'Alpha', 'Zeta'])
  check('فلشِ نزولی ▼', arrow('ورودی'), '▼')

  await click('کیفیت')
  check('کلیک «کیفیت» → نزولی', providers(), ['Bravo', 'Alpha', 'DeepSeek', 'Zeta'])
  check('فلشِ کیفیت ▼', arrow('کیفیت'), '▼')

  await click('ارائه‌دهنده')
  check('کلیک «ارائه‌دهنده» → صعودی', providers(), ['Alpha', 'Bravo', 'DeepSeek', 'Zeta'])
  check('فلشِ ارائه‌دهنده ▲', arrow('ارائه‌دهنده'), '▲')

  // خواستهٔ حبیب: هیچ tooltip با هاور نباشد
  check('هیچ هدری title ندارد (بدونِ tooltip)', ths().every((h) => !h.getAttribute('title')), true)
  check('بدونِ cursor:help', ths().every((h) => !(h.getAttribute('class') || '').includes('cursor')), true)

  if (failures.length > 0) {
    console.error(`\n${failures.length} شرط شکست خورد:`)
    for (const f of failures) console.error(' - ' + f)
    process.exit(1)
  }
  console.log('\nهمهٔ شرط‌ها سبز.')
  process.exit(0)
})().catch((e) => {
  console.error('آزمون با خطا متوقف شد:', e.message)
  process.exit(1)
})