/**
 * آزمونِ حالتِ «بی‌کش» در رتبه‌بندیِ شکارچی مدل (حبیب ۱۵ نوامبر: «شکارچی مدل مقایسش رو بدون کش در نظر بگیره»).
 * شرط: سروری که کشِ ارزان دارد ولی ورودیِ کاملش گران است، در حالتِ بی‌کش باید پایین‌تر از حالتِ با کش بیفتد.
 *
 * اجرا:  node test/nocache.test.cjs
 */
const path = require('path')
const assert = require('assert')

const failure = []
function check(name, fn) {
  try { fn(); console.log('✓ ' + name) } catch (err) { failure.push(name + ' — ' + err.message); console.log('✗ ' + name + ' — ' + err.message) }
}

async function main() {
  const host = await import(path.join(__dirname, '..', 'index.js'))
  assert.ok(typeof host.rankRows === 'function', 'rankRows باید صادر شود')
  assert.ok(typeof host.rankCost === 'function', 'rankCost باید صادر شود')

  // «CacheCheap»: کشِ بسیار ارزان (۰٫۰۰۰۱)، ولی ورودیِ کاملِ گران (۰٫۲).
  // «InputCheap»: کشش گران‌تر است (۰٫۰۵)، ولی ورودیِ کاملش (۰٫۱) ارزان.
  // با کشِ ۹۷٪ ⇒ CacheCheap اول؛ بی‌کش (کلِ پرامپت به قیمتِ کامل) ⇒ InputCheap اول.
  const base = { usable: true, quality: 90, tier: null, quantization: 'fp8', maxCompletion: 100000 }
  const cacheCheap = { ...base, provider: 'CacheCheap', slug: 'cache-cheap', model: 'deepseek/flash-test',
    priceIn: 0.0000002, priceIn1m: 0.2, priceOut1m: 3.0, cacheRead1m: 0.0001, cacheKnown: true, realOffPct: 0, measured: null }
  const inputCheap = { ...base, provider: 'InputCheap', slug: 'input-cheap', model: 'deepseek/flash-test',
    priceIn: 0.0000001, priceIn1m: 0.1, priceOut1m: 3.0, cacheRead1m: 0.05, cacheKnown: true, realOffPct: 0, measured: null }
  const snap = { ts: 1, rows: [cacheCheap, inputCheap] }

  check('بی‌کش گران‌تر از با کش حساب می‌شود', () => {
    assert.ok(host.rankCost(cacheCheap, 'none') > host.rankCost(cacheCheap, 'with'))
    assert.ok(host.rankCost(inputCheap, 'none') > host.rankCost(inputCheap, 'with'))
  })

  check('با کش: CacheCheap اول است', () => {
    const rows = host.rankRows(snap, { task: 'cheap', cache: 'with', limit: 10 })
    assert.strictEqual(rows[0].provider, 'CacheCheap', JSON.stringify(rows.map((r) => r.provider)))
  })

  check('بی‌کش: InputCheap اول می‌شود', () => {
    const rows = host.rankRows(snap, { task: 'cheap', cache: 'none', limit: 10 })
    assert.strictEqual(rows[0].provider, 'InputCheap', JSON.stringify(rows.map((r) => r.provider)))
  })

  check('پیش‌فرض همان رفتارِ قدیم است (with)', () => {
    const rows = host.rankRows(snap, { task: 'cheap', limit: 10 })
    assert.strictEqual(rows[0].provider, 'CacheCheap')
    assert.strictEqual(rows[0].cache, 'with')
  })

  check('ردیف‌ها فیلدهای لازم را دارند', () => {
    const row = host.rankRows(snap, { task: 'balanced', cache: 'none', limit: 1 })[0]
    for (const field of ['model', 'provider', 'providerSlug', 'priceIn1m', 'cacheRead1m', 'priceOut1m', 'quality', 'costPerRequest']) {
      assert.ok(field in row, 'missing ' + field)
    }
    assert.strictEqual(row.providerSlug, 'input-cheap')
  })

  if (failure.length) { console.error('\n' + failure.length + ' آزمون شکست خورد'); process.exit(1) }
  console.log('\nهمهٔ آزمون‌های بی‌کش سبز.')
}

main().catch((err) => { console.error(err); process.exit(1) })
