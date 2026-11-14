/**
 * ثابت می‌کند آزمون‌ها واقعاً سنجش می‌کنند: روی نسخهٔ سالم سبز، روی نسخهٔ عمداً خراب‌شده قرمز.
 *
 * هشت خرابکاری:
 *   ۱) مرتب‌سازی: clickSort بی‌اثر                     → sort.test.cjs باید قرمز شود
 *   ۲) override مدل: نادیده گرفته شود                  → recommend.test.cjs باید قرمز شود
 *   ۳) تطبیقِ مدل: زیررشته‌ای شود                      → recommend.test.cjs باید قرمز شود
 *   ۴) فیلترِ خانواده: به indexOf برگردد               → family.test.cjs باید قرمز شود
 *   ۵) آفِ واقعی از قیمتِ ورودیِ خالی حساب شود         → realoff.test.cjs باید قرمز شود
 *   ۶) قیمتِ کشِ نامعلوم صفر (رایگان) شود              → realoff.test.cjs باید قرمز شود
 *   ۷) مسیرِ «پیشنهاد» کشِ نامعلوم را صفر بگیرد        → recommend.test.cjs باید قرمز شود
 *   ۸) ستونِ «آف واقعی» به offPctِ اعلامی وصل شود      → sort.test.cjs باید قرمز شود
 *
 * اجرا: node test/verify.cjs
 */
const fs = require('fs')
const os = require('os')
const path = require('path')
const { spawnSync } = require('child_process')

const dir = __dirname
const HOST = path.join(dir, '..', 'index.js')
const CLIENT = path.join(dir, '..', 'client.js')

function run(testFile, env) {
  const r = spawnSync(process.execPath, [path.join(dir, testFile)], {
    env: { ...process.env, ...env }, encoding: 'utf8',
  })
  return { status: r.status, out: (r.stdout || '') + (r.stderr || '') }
}

let ok = true
const results = []

function scenario(title, { test, env, file, from, to }) {
  const ext = file === HOST ? '.mjs' : '.cjs'
  const tmp = path.join(os.tmpdir(), `mh-sabotage-${process.pid}-${Math.random().toString(36).slice(2)}${ext}`)
  const src = fs.readFileSync(file, 'utf8')
  if (!src.includes(from)) {
    console.log(`  ✗ ${title}: الگوی خرابکاری پیدا نشد`)
    ok = false
    return
  }
  fs.writeFileSync(tmp, src.replace(from, to))
  const r = run(test, { ...env, [file === HOST ? 'MH_HOST' : 'MH_CLIENT']: tmp })
  const failed = r.out.split('\n').filter((l) => l.includes('✗')).length
  if (r.status === 0) {
    console.log(`  ✗ ${title}: خرابکاری قرمز نداد (EXIT=0) — آزمون بی‌ارزش است`)
    ok = false
  } else {
    console.log(`  ✓ ${title}: EXIT=${r.status} · ${failed} شرط قرمز`)
  }
  results.push({ title, status: r.status, failed })
  fs.unlinkSync(tmp)
}

console.log('== ۰) نسخهٔ سالم — همه باید سبز باشند')
for (const t of ['sort.test.cjs', 'recommend.test.cjs', 'family.test.cjs', 'realoff.test.cjs']) {
  const r = run(t, {})
  if (r.status !== 0) { ok = false; console.log(`  ✗ ${t}: EXIT=${r.status}`); console.log(r.out.slice(-500)) }
  else console.log(`  ✓ ${t}: EXIT=0`)
}

console.log('\n== ۱) خرابکاریِ مرتب‌سازی')
scenario('clickSort بی‌اثر', {
  test: 'sort.test.cjs', env: {}, file: CLIENT,
  from: 'const clickSort = React.useCallback((key) => {',
  to: 'const clickSort = React.useCallback((key) => { return; ',
})

console.log('\n== ۲) خرابکاریِ overrideِ مدل')
scenario('options.model نادیده گرفته شود', {
  test: 'recommend.test.cjs', env: {}, file: HOST,
  from: 'const focusModel = (options && options.model) || config.focus',
  to: 'const focusModel = config.focus',
})

console.log('\n== ۳) خرابکاریِ تطبیقِ مدل (زیررشته)')
scenario('modelMatches زیررشته‌ای شود', {
  test: 'recommend.test.cjs', env: {}, file: HOST,
  from: "  if (rowModel === requested) return true\n  const slash = rowModel.indexOf('/')\n  return slash >= 0 && rowModel.slice(slash + 1) === requested",
  to: '  return rowModel.indexOf(requested) >= 0',
})

console.log('\n== ۴) خرابکاریِ فیلترِ خانواده')
scenario('فیلتر به indexOf برگردد', {
  test: 'family.test.cjs', env: {}, file: CLIENT,
  from: "          const tail = (m) => { const i = m.indexOf('/'); return i >= 0 ? m.slice(i + 1) : m }\n          list = list.filter((r) => r.model === family || tail(r.model) === family)",
  to: '          list = list.filter((r) => r.model.indexOf(family) >= 0)',
})

console.log('\n== ۵) خرابکاریِ آفِ واقعی (ورودیِ خالی به‌جای هزینهٔ کالیبره)')
scenario('آف از قیمتِ ورودی تنها حساب شود', {
  test: 'realoff.test.cjs', env: {}, file: HOST,
  from: '  const costs = rows.map((r) => calibratedCost(r, calib))',
  to: '  const costs = rows.map((r) => num(r.priceIn1m))',
})

console.log('\n== ۶) خرابکاریِ قیمتِ کشِ نامعلوم (صفر = رایگان)')
scenario('effCachePrice برای کشِ نامعلوم صفر بدهد', {
  test: 'realoff.test.cjs', env: {}, file: HOST,
  from: '  return cacheReadPerM == null ? num(priceInPerM) : num(cacheReadPerM)',
  to: '  return cacheReadPerM == null ? 0 : num(cacheReadPerM)',
})

console.log('\n== ۷) خرابکاریِ مسیرِ پیشنهاد (کشِ نامعلوم صفر)')
scenario('costPerRequest کشِ نامعلوم را رایگان بگیرد', {
  test: 'recommend.test.cjs', env: {}, file: HOST,
  from: '  const cachePerM = effCachePrice(row.priceIn1m ?? row.priceIn * 1e6, row.cacheRead1m)',
  to: '  const cachePerM = row.cacheRead1m || 0',
})

console.log('\n== ۸) خرابکاریِ ستونِ «آف واقعی» در پنل')
scenario('ستونِ آف واقعی به offPctِ اعلامی وصل شود', {
  test: 'sort.test.cjs', env: {}, file: CLIENT,
  from: "(r) => (r.realOffPct == null ? -1e9 : r.realOffPct), 'desc'",
  to: "(r) => (r.offPct || 0), 'desc'",
})

console.log(ok ? '\nنتیجه: هر هشت آزمون واقعاً سنجش می‌کنند.' : '\nنتیجه: دست‌کم یک آزمون قابلِ اعتماد نیست.')
process.exit(ok ? 0 : 1)