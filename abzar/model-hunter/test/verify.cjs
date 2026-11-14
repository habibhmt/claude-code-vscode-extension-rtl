/**
 * ثابت می‌کند آزمونِ مرتب‌سازی واقعاً سنجش می‌کند، نه فقط چاپ.
 * ۱) روی فایلِ اصلی → باید سبز شود (exit 0)
 * ۲) روی نسخهٔ عمداً خراب‌شده (clickSort بی‌اثر) → باید قرمز شود (exit ≠ 0)
 *
 * اجرا:  node test/verify.cjs
 */
const fs = require('fs')
const os = require('os')
const path = require('path')
const { spawnSync } = require('child_process')

const dir = __dirname
const real = path.join(dir, '..', 'client.js')
const testFile = path.join(dir, 'sort.test.cjs')

function runOn(clientPath) {
  return spawnSync(process.execPath, [testFile], {
    env: { ...process.env, MH_CLIENT: clientPath },
    encoding: 'utf8',
  })
}

let ok = true

console.log('== ۱) فایلِ اصلی: انتظار سبز (exit 0)')
const good = runOn(real)
const goodExit = good.status
console.log(`   exit=${goodExit}`)
if (goodExit !== 0) {
  ok = false
  console.log('   ✗ فایلِ اصلی نباید قرمز شود')
  console.log(good.stdout || good.stderr)
} else {
  console.log('   ✓ سبز شد، همان‌طور که باید')
}

console.log('\n== ۲) خرابکاریِ عمدی: clickSort بی‌اثر → انتظار قرمز (exit ≠ 0)')
const src = fs.readFileSync(real, 'utf8')
const sabotaged = src.replace(
  /const clickSort = React\.useCallback\(\(key\) => \{[\s\S]*?\}, \[sortKey\]\)/,
  'const clickSort = React.useCallback((key) => { /* عمداً بی‌اثر */ }, [sortKey])',
)
if (sabotaged === src) {
  ok = false
  console.log('   ✗ خرابکاری اعمال نشد؛ الگوی clickSort پیدا نشد')
} else {
  const tmp = path.join(os.tmpdir(), `mh-sabotaged-${process.pid}.cjs`)
  fs.writeFileSync(tmp, sabotaged)
  const bad = runOn(tmp)
  const badExit = bad.status
  console.log(`   exit=${badExit}`)
  if (badExit === 0) {
    ok = false
    console.log('   ✗ خرابکاری قرمز نداد! آزمون بی‌ارزش است')
    console.log(bad.stdout)
  } else {
    const failed = String(bad.stdout).split('\n').filter((l) => l.includes('✗'))
    console.log(`   ✓ قرمز شد (${failed.length} شرط شکست)`)
    for (const l of failed.slice(0, 3)) console.log('     ' + l.trim())
  }
  fs.unlinkSync(tmp)
}

console.log(ok ? '\nنتیجه: آزمون واقعاً سنجش می‌کند.' : '\nنتیجه: آزمون قابلِ اعتماد نیست.')
process.exit(ok ? 0 : 1)