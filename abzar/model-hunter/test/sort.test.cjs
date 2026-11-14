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
  { model: 'deepseek/x', provider: 'Bravo', tier: 'priority', quantization: 'fp8', quality: 95, realOffPct: 10, costCalib: 0.009, priceIn1m: 0.30, cacheRead1m: 0.009, cacheKnown: true, priceOut1m: 0.90, uptime: 100, status: 0, usable: true, official: false, maxCompletion: 1 },
  { model: 'deepseek/x', provider: 'Alpha', tier: null, quantization: 'fp8', quality: 91, realOffPct: 30, costCalib: 0.004, priceIn1m: 0.10, cacheRead1m: 0.002, cacheKnown: true, priceOut1m: 0.40, uptime: 100, status: 0, usable: true, official: false, maxCompletion: 1 },
  { model: 'deepseek/x', provider: 'Zeta', tier: 'flex', quantization: 'fp4', quality: 87, realOffPct: 0, costCalib: 0.002, priceIn1m: 0.05, cacheRead1m: 0.001, cacheKnown: true, priceOut1m: 0.20, uptime: 66, status: 0, usable: true, official: false, maxCompletion: 1 },
  { model: 'deepseek/x', provider: 'DeepSeek', tier: null, quantization: 'unknown', quality: 88, realOffPct: 0, costCalib: 0.005, priceIn1m: 0.15, cacheRead1m: 0.003, cacheKnown: true, priceOut1m: 0.60, uptime: 100, status: 0, usable: true, official: true, maxCompletion: 1 },
  { model: 'deepseek/x', provider: 'NoCache', tier: null, quantization: 'fp8', quality: 60, realOffPct: null, costCalib: 0.050, priceIn1m: 0.20, cacheRead1m: null, cacheKnown: false, priceOut1m: 0.50, uptime: 99, status: 0, usable: true, official: false, maxCompletion: 1 },
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

  check('ترتیبِ پیش‌فرض (مرجعِ دیپ‌سیک اول)', providers(), ['DeepSeek', 'Alpha', 'Bravo', 'Zeta', 'NoCache'])
  check('بدونِ کلیک هیچ فلشی نیست', ths().every((h) => !h.textContent.includes('▲') && !h.textContent.includes('▼')), true)

  // ---- ستون‌های تازه: آفِ اعلامی حذف، «آف واقعی» و «$/درخواست» جایش ----
  const labels = () => ths().map((h) => h.textContent.replace(/[▲▼]/g, '').trim())
  check('سرستونِ «آف واقعی» هست', labels().includes('آف واقعی'), true)
  check('سرستونِ «آف واقعی» دقیقاً یکی', labels().filter((l) => l === 'آف واقعی').length, 1)
  check('سرستونِ «$/درخواست» هست', labels().includes('$/درخواست'), true)
  check('ستونِ آفِ اعلامی (off) حذف شده', labels().includes('off'), false)
  check('ستونِ «اعلامی ورودی/خروجی» حذف شده', labels().some((l) => l.includes('اعلامی')), false)

  const cells = (provider) => {
    const tr = [...document.querySelectorAll('tbody tr')].find((r) => r.children[1].textContent.includes(provider))
    return [...tr.children].map((td) => td.textContent.trim())
  }
  check('آفِ واقعیِ مثبت با علامت +', cells('Alpha')[5], '+30.0٪')
  check('آفِ واقعیِ صفر', cells('DeepSeek')[5], '0.0٪')
  check('آفِ واقعیِ بی‌پایه «—»', cells('NoCache')[5], '—')
  check('قیمتِ کشِ منتشرنشده «—»', cells('NoCache')[8], '—')
  check('ستونِ $/درخواست ۵ رقمِ اعشار', cells('Alpha')[6], '0.00400')

  await click('آف واقعی')
  check('کلیک «آف واقعی» → نزولی', providers(), ['Alpha', 'Bravo', 'DeepSeek', 'Zeta', 'NoCache'])
  check('فلشِ آف واقعی ▼', arrow('آف واقعی'), '▼')

  await click('$/درخواست')
  check('کلیک «$/درخواست» → صعودی', providers(), ['Zeta', 'Alpha', 'DeepSeek', 'Bravo', 'NoCache'])
  check('فلشِ $/درخواست ▲', arrow('$/درخواست'), '▲')

  await click('ورودی')
  check('کلیک «ورودی» → صعودی', providers(), ['Zeta', 'Alpha', 'DeepSeek', 'NoCache', 'Bravo'])
  check('فلشِ صعودی ▲', arrow('ورودی'), '▲')

  await click('ورودی')
  check('کلیک دوم → نزولی', providers(), ['Bravo', 'NoCache', 'DeepSeek', 'Alpha', 'Zeta'])
  check('فلشِ نزولی ▼', arrow('ورودی'), '▼')

  await click('کیفیت')
  check('کلیک «کیفیت» → نزولی', providers(), ['Bravo', 'Alpha', 'DeepSeek', 'Zeta', 'NoCache'])
  check('فلشِ کیفیت ▼', arrow('کیفیت'), '▼')

  await click('ارائه‌دهنده')
  check('کلیک «ارائه‌دهنده» → صعودی', providers(), ['Alpha', 'Bravo', 'DeepSeek', 'NoCache', 'Zeta'])
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