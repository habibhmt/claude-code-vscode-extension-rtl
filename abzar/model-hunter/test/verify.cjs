/**
 * ثابت می‌کند آزمون‌ها واقعاً سنجش می‌کنند: روی نسخهٔ سالم سبز، روی نسخهٔ عمداً خراب‌شده قرمز.
 *
 * چهار خرابکاری:
 *   ۱) مرتب‌سازی: clickSort بی‌اثر           → sort.test.cjs باید قرمز شود
 *   ۲) override مدل: نادیده گرفته شود        → recommend.test.cjs باید قرمز شود
 *   ۳) تطبیقِ مدل: زیررشته‌ای شود            → recommend.test.cjs باید قرمز شود
 *   ۴) فیلترِ خانواده: به indexOf برگردد     → family.test.cjs باید قرمز شود
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
for (const t of ['sort.test.cjs', 'recommend.test.cjs', 'family.test.cjs']) {
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

console.log(ok ? '\nنتیجه: هر سه آزمون واقعاً سنجش می‌کنند.' : '\nنتیجه: دست‌کم یک آزمون قابلِ اعتماد نیست.')
process.exit(ok ? 0 : 1)