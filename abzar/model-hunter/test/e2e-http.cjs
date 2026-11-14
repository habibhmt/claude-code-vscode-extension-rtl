/**
 * آزمونِ سرتاسری از راهِ HTTP — همان مسیری که پنل صدا می‌زند.
 * نیمهٔ Host را با ctx بدلی بالا می‌آورد، مسیرهای `/plugins/model-hunter/*` را روی یک
 * سرورِ واقعیِ محلی ثبت می‌کند و خودش با fetch می‌خواند.
 *
 * شبکه لازم دارد، پس در آزمونِ پیش‌فرض اجرا نمی‌شود:
 *   MH_E2E=1 node test/e2e-http.cjs
 */
const http = require('http')
const path = require('path')
const { pathToFileURL } = require('url')

if (process.env.MH_E2E !== '1') {
  console.log('این آزمون شبکه می‌خواهد؛ با MH_E2E=1 اجرا کن.')
  process.exit(0)
}

const HOST = process.env.MH_HOST || path.join(__dirname, '..', 'index.js')
const failures = []
function check(name, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected)
  if (a === e) console.log(`  ✓ ${name}`)
  else { failures.push(`${name}: انتظار ${e} ولی شد ${a}`); console.log(`  ✗ ${name} — انتظار ${e} ولی شد ${a}`) }
}
function near(name, actual, expected, tol) {
  if (typeof actual === 'number' && Math.abs(actual - expected) <= tol) console.log(`  ✓ ${name} (${actual})`)
  else { failures.push(`${name}: انتظار ~${expected} ولی شد ${actual}`); console.log(`  ✗ ${name} — انتظار ~${expected} ولی شد ${actual}`) }
}

const handlers = new Map()
const fakeCtx = {
  logger: { info: () => {}, warn: () => {} },
  effect: (fn) => fn(),
  get: () => undefined,
  tools: { register: () => {} },
  inject: (names, cb) => cb({
    webServer: { register: (route) => { handlers.set(route.path, route.handler) } },
    effect: (fn) => fn(),
  }),
}

;(async () => {
  const mod = await import(pathToFileURL(HOST).href)
  mod.apply(fakeCtx, { focus: 'deepseek/deepseek-v4.1-flash-1017', refreshMinutes: 120 })

  const paths = ['/plugins/model-hunter/state', '/plugins/model-hunter/recommend', '/plugins/model-hunter/apply']
  check('هر سه مسیر ثبت شد', paths.every((p) => handlers.has(p)), true)

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1')
    const handler = handlers.get(url.pathname)
    if (!handler) { res.statusCode = 404; res.end('not found'); return }
    try { await handler(req, res) } catch (err) { res.statusCode = 500; res.end(String(err && err.message)) }
  })
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  const base = `http://127.0.0.1:${server.address().port}`
  console.log(`سرورِ محلی: ${base}`)

  // ---- recommend اول، چون فقط این مسیر اسکن را (اگر نشده) خودش انجام می‌دهد ----
  const t0 = Date.now()
  const recRes = await fetch(`${base}/plugins/model-hunter/recommend?scope=all`)
  const rec = await recRes.json()
  console.log(`  (اسکن ${Math.round((Date.now() - t0) / 1000)} ثانیه)`)

  // ---- state ----
  const stateRes = await fetch(`${base}/plugins/model-hunter/state`)
  const state = await stateRes.json()
  console.log(`  (${state.rows.length} ردیف، ${Object.keys(state.families || {}).length} خانواده، خطا: ${state.error})`)

  check('state: HTTP 200', stateRes.status, 200)
  check('state: اسکن بدونِ خطا', state.error, null)
  check('state: ردیف دارد', state.rows.length > 0, true)
  check('state: الگوی کالیبره را می‌دهد', state.calibration, { cacheSharePct: 92, promptTokens: 338000, outputTokens: 698 })
  check('state: هیچ ردیفی offPctِ اعلامی ندارد', state.rows.some((r) => Object.prototype.hasOwnProperty.call(r, 'offPct')), false)
  check('state: همهٔ ردیف‌ها costCalib دارند', state.rows.every((r) => typeof r.costCalib === 'number'), true)

  const flash = state.rows.filter((r) => r.model === 'deepseek/deepseek-v4.1-flash-1017' && r.usable)
  const baidu = flash.find((r) => r.provider === 'Baidu' && !r.tier)
  const official = flash.find((r) => r.official)
  check('فلش: ردیفِ بایدو هست', Boolean(baidu), true)
  near('فلش: آفِ واقعیِ بایدو ≈ ۳۴٪', baidu && baidu.realOffPct, 34, 0.6)
  near('فلش: $/درخواستِ بایدو', baidu && baidu.costCalib, 0.003568, 5e-6)
  check('فلش: پایهٔ رسمی صفر است', official && official.realOffPct, 0)

  const proBaidu = state.rows.find((r) => r.model === 'deepseek/deepseek-v4-pro-0813' && r.provider === 'Baidu' && !r.tier && r.usable)
  near('پرو-۰۸۱۳: آفِ واقعیِ بایدو ≈ ۱٫۴٪', proBaidu && proBaidu.realOffPct, 1.4, 0.4)

  const chatRows = state.rows.filter((r) => r.model === 'deepseek/deepseek-chat' && r.usable)
  check('مدلِ بی‌پایه (deepseek-chat): آفِ واقعی null', chatRows.every((r) => r.realOffPct === null), true)
  check('مدلِ بی‌پایه: $/درخواست پُر است', chatRows.every((r) => typeof r.costCalib === 'number'), true)
  const noCacheRows = state.rows.filter((r) => r.cacheRead1m == null)
  check('ردیف‌های بی‌قیمتِ کش: cacheKnown=false', noCacheRows.every((r) => r.cacheKnown === false), true)

  // ---- recommend ----
  check('recommend: ok', rec.ok, true)
  check('recommend: پیشنهاد realOffPct دارد', typeof rec.recommended.realOffPct, 'number')
  check('recommend: پایه realOffPct = ۰', rec.baseline && rec.baseline.realOffPct, 0)
  check('recommend: هزینهٔ دامنه‌ای هست', typeof rec.recommended.costPerRequest, 'number')
  console.log(`  (پیشنهاد: ${rec.recommended.provider} · آف واقعی ${rec.recommended.realOffPct}٪ · $${rec.recommended.costPerRequest}/درخواست · پایه $${rec.baseline && rec.baseline.costPerRequest})`)

  server.close()
  if (failures.length) {
    console.error(`\n${failures.length} شرط شکست خورد:`)
    for (const f of failures) console.error(' - ' + f)
    process.exit(1)
  }
  console.log('\nهمهٔ شرط‌های سرتاسری سبز.')
  process.exit(0)
})().catch((e) => { console.error('آزمون با خطا متوقف شد:', e && e.message); process.exit(1) })