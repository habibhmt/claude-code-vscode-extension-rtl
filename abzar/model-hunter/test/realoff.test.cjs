/**
 * آزمونِ شرط‌دارِ «آفِ واقعی» (نیمهٔ Host).
 * جای درصدِ آفِ اعلامیِ OpenRouter را «صرفهٔ واقعی نسبت به دیپ‌سیکِ رسمی» می‌گیرد،
 * با الگوی مصرفِ خودمان: کش ۹۲٪ · ورودی ۳۳۸٬۰۰۰ توکن · خروجی ۶۹۸ توکن،
 * به‌علاوهٔ «کش‌نخوردنِ بی‌دلیلِ» هر سرور (اندازه‌گیری‌شده، یا ۳٪ ِ پیش‌فرض).
 *
 * باگ‌هایی که می‌پوشاند:
 *   ۱) آفِ اعلامی به‌جای هزینهٔ کالیبره گزارش شود
 *   ۲) قیمتِ کشِ منتشرنشده «صفر» (رایگان) حساب شود، نه قیمتِ کاملِ ورودی
 *   ۳) مدلِ بی‌پایه (بدونِ اندپوینتِ رسمیِ دیپ‌سیک) عددِ ساختگی بگیرد
 *
 * اجرا: node test/realoff.test.cjs
 * خرابکاری: MH_HOST=<نسخهٔ خراب> node test/realoff.test.cjs
 */
const path = require('path')

const HOST = process.env.MH_HOST || path.join(__dirname, '..', 'index.js')

const failures = []
function check(name, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected)
  if (a === e) console.log(`  ✓ ${name}`)
  else { failures.push(`${name}: انتظار ${e} ولی شد ${a}`); console.log(`  ✗ ${name} — انتظار ${e} ولی شد ${a}`) }
}
function near(name, actual, expected, tol = 0.05) {
  const okClose = typeof actual === 'number' && Math.abs(actual - expected) <= tol
  if (okClose) console.log(`  ✓ ${name} (${actual})`)
  else { failures.push(`${name}: انتظار ~${expected} ولی شد ${actual}`); console.log(`  ✗ ${name} — انتظار ~${expected} ولی شد ${actual}`) }
}

/** ردیف با قیمت‌های هر یک میلیون توکن — همان شکلِ خروجیِ scoreEndpoint */
function r(provider, priceIn1m, cacheRead1m, priceOut1m, official = false) {
  return {
    model: 'deepseek/x', provider, slug: provider.toLowerCase(), quantization: 'fp8', tier: null,
    quality: 90, priceIn: priceIn1m / 1e6, priceOut: priceOut1m / 1e6,
    priceIn1m, priceOut1m, cacheRead1m,
    cacheKnown: cacheRead1m != null,
    cacheBilled1m: cacheRead1m == null ? priceIn1m : cacheRead1m,
    listedIn1m: priceIn1m, listedOut1m: priceOut1m,
    usable: true, official, uptime: 100, status: 0, maxCompletion: 1000,
  }
}

// قیمت‌های واقعیِ OpenRouter (دلار به ازای یک میلیون توکن)
const flashOfficial = r('DeepSeek', 0.15, 0.003, 0.6, true)
const flashBaidu = r('Baidu', 0.0977, 0.002094, 0.3944)
const flashPrime = r('PrimeIntellect', 0.0437, 0.0024, 0.7)
const proOfficial = r('DeepSeek', 0.66, 0.022, 1.98, true)
const proBaidu = r('Baidu', 0.6587, 0.020958, 1.976)
const proDeepInfra = r('DeepInfra', 1.3, 0.1, 2.6)
const chatDeepInfra = r('DeepInfra', 0.32, null, 0.89) // کش منتشر نشده

;(async () => {
  const mod = await import(path.resolve(HOST))

  // ---- ۱) هزینهٔ کالیبره ----
  const cal = { cacheSharePct: 92, promptTokens: 338000, outputTokens: 698 }
  const baseCost = mod.calibratedCost(flashOfficial, cal)
  near('هزینهٔ دیپ‌سیکِ رسمیِ فلش با الگوی خودمان ($/درخواست)', Math.round(baseCost * 1e6) / 1e6, 0.005408, 1e-6)
  near('هزینهٔ بایدو روی فلش', Math.round(mod.calibratedCost(flashBaidu, cal) * 1e6) / 1e6, 0.003568, 1e-6)

  // ---- ۲) آفِ واقعی روی فلش ----
  const flash = mod.withRealOff([flashOfficial, flashBaidu, flashPrime], cal)
  check('فلش: ردیفِ رسمی = پایه', flash[0].realOffPct, 0)
  // هر سه بی‌اندازه‌گیری ⇒ ۳٪ کش‌نخوردنِ پیش‌فرض روی همه (رسمی ۰٫۰۰۶۷۸ $/درخواست)
  near('فلش: آفِ واقعیِ بایدو (نه ۶۵٪ اعلامی)', flash[1].realOffPct, 34.2)
  near('فلش: آفِ واقعیِ PrimeIntellect (اعلامی ۰٪ بود)', flash[2].realOffPct, 58.7)
  check('فلش: هزینهٔ کالیبره در خروجی هست', typeof flash[1].costCalib, 'number')

  // ---- ۳) آفِ واقعی روی مدلِ واقعیِ کاربر (pro-0813) ----
  const pro = mod.withRealOff([proOfficial, proBaidu, proDeepInfra], cal)
  near('پرو-۰۸۱۳: آفِ واقعیِ بایدو', pro[1].realOffPct, 1.1)
  // با کش‌نخوردنِ پیش‌فرضِ ۳٪ (هیچ‌کدام اندازه‌گیری نشده‌اند): رسمی ۰٫۰۳۲۰۲، DeepInfra ۰٫۰۷۹۲۶ ⇒ −۱۴۷٫۵٪
  near('پرو-۰۸۱۳: آفِ واقعیِ DeepInfra منفی', pro[2].realOffPct, -147.5, 0.1)

  // ---- ۴) مدلِ بی‌پایه: حدس نمی‌زنیم ----
  const noBase = mod.withRealOff([chatDeepInfra], cal)
  check('مدلِ بی‌پایه: آفِ واقعی = null', noBase[0].realOffPct, null)
  check('مدلِ بی‌پایه: هزینهٔ کالیبره پُر است', typeof noBase[0].costCalib, 'number')

  // ---- ۵) قاعدهٔ کشِ منتشرنشده = قیمتِ کاملِ ورودی ----
  check('effCachePrice: کشِ نامعلوم → قیمتِ ورودی', mod.effCachePrice(0.32, null), 0.32)
  check('effCachePrice: کشِ معلوم → خودش', mod.effCachePrice(0.32, 0.021), 0.021)
  near('هزینهٔ ردیفِ بی‌کش = همهٔ ورودی با قیمتِ کامل', noBase[0].costCalib,
    Math.round(((338000 * 0.32 + 698 * 0.89) / 1e6) * 1e6) / 1e6, 1e-6)

  // ---- ۶) الگو قابلِ تغییر است (کانفیگ) ----
  const allCached = mod.withRealOff([flashOfficial, flashBaidu], { cacheSharePct: 100, promptTokens: 338000, outputTokens: 0 })
  // کش ۱۰۰٪ در حالتِ کش‌خورده، ولی ۳٪ ِ درخواست‌ها (پیش‌فرض) کش نمی‌خورند و کاملِ ورودی را می‌دهند
  near('با کشِ ۱۰۰٪ + ۳٪ کش‌نخوردن', allCached[1].costCalib, Math.round((0.97 * 338000 * 0.002094 / 1e6 + 0.03 * 338000 * 0.0977 / 1e6) * 1e6) / 1e6, 1e-6)
  near('آف با الگوی دیگر هم حساب می‌شود', allCached[1].realOffPct, 33.0, 0.2)

  // ---- ۶ب) کش‌نخوردنِ اندازه‌گیری‌شده رتبه را برمی‌گرداند (۱۴ نوامبر، داده‌های واقعی) ----
  // بایدو ارزان‌تر است ولی ۵٫۹٪ بی‌دلیل کش نمی‌خورد؛ DeepInfra ۰٫۲٪.
  const flashDeepInfra = r('DeepInfra', 0.098, 0.0029, 0.294)
  const cal97 = { cacheSharePct: 97, promptTokens: 338000, outputTokens: 698 }
  const measured = mod.withRealOff([
    flashOfficial,
    { ...flashBaidu, measured: { eligible: 614, missPct: 5.9 } },
    { ...flashDeepInfra, measured: { eligible: 403, missPct: 0.2 } },
  ], cal97)
  near('بایدو با ۵٫۹٪ کش‌نخوردن ($/درخواست)', measured[1].costCalib, 0.0038, 0.0001)
  near('DeepInfra با ۰٫۲٪ ($/درخواست)', measured[2].costCalib, 0.00221, 0.0001)
  check('با اندازه‌گیری، DeepInfra از بایدو ارزان‌تر درمی‌آید', measured[2].costCalib < measured[1].costCalib, true)
  check('بی‌اندازه‌گیری (فقط قیمتِ فهرست)، بایدو ارزان‌تر به نظر می‌آمد',
    mod.calibratedCost(flashBaidu, cal97) < mod.calibratedCost(flashDeepInfra, cal97), true)
  check('نمونهٔ کم (<۳۰) ⇒ پیش‌فرضِ ۳٪، نه عددِ اندازه‌گیری', mod.missRateOf({ measured: { eligible: 5, missPct: 50 } }), 0.03)
  check('filterSameModel: چتِ pro با انتخابِ flash عوض نمی‌شود', mod.filterSameModel(['a', 'b', 'c'], 'deepseek/x-flash@preset/mh-x', (id) => ({ a: 'deepseek/x-pro@preset/p', b: 'deepseek/x-flash@preset/mh-x', c: 'deepseek/x-flash@preset/other' })[id], 'all').targets, ['c'])
  check('filterSameModel: scope=session همیشه همان چت', mod.filterSameModel(['a'], 'deepseek/x-flash@preset/mh-x', () => 'deepseek/x-pro', 'session').targets, ['a'])

  // ---- ۷) هیچ فیلدِ درصدِ اعلامی در ردیف نمانده ----
  check('ردیف دیگر offPct ندارد', Object.prototype.hasOwnProperty.call(flashBaidu, 'offPct'), false)

  if (failures.length) {
    console.error(`\n${failures.length} شرط شکست خورد:`)
    for (const f of failures) console.error(' - ' + f)
    process.exit(1)
  }
  console.log('\nهمهٔ شرط‌ها سبز.')
  process.exit(0)
})().catch((e) => { console.error('آزمون با خطا متوقف شد:', e.message); process.exit(1) })