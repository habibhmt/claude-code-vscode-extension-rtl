/**
 * آزمونِ شرط‌دارِ منطقِ پیشنهاد (نیمهٔ Host).
 * سه باگ را می‌پوشاند:
 *   ۱) مدلِ درخواستی (options.model) باید جای مدلِ فوکوس بنشیند
 *   ۲) تطبیقِ مدل باید برابری باشد، نه زیررشته (`deepseek-chat` ≠ `deepseek-chat-v3.1`)
 *   ۳) بدونِ درخواست، پیش‌فرض باید همان `flash-1017` بماند
 *
 * اجرا: node test/recommend.test.cjs
 * خرابکاری: MH_HOST=<نسخهٔ خراب> node test/recommend.test.cjs
 */
const path = require('path')

const HOST = process.env.MH_HOST || path.join(__dirname, '..', 'index.js')
const FOCUS = 'deepseek/deepseek-v4.1-flash-1017'

const failures = []
function check(name, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected)
  if (a === e) console.log(`  ✓ ${name}`)
  else { failures.push(`${name}: انتظار ${e} ولی شد ${a}`); console.log(`  ✗ ${name} — انتظار ${e} ولی شد ${a}`) }
}

function row(model, provider, priceIn, cacheRead, priceOut) {
  return { model, provider, slug: provider.toLowerCase(), quantization: 'fp8', tier: null,
    quality: 90, offPct: 0, usable: true, official: false,
    priceIn, priceOut, cacheRead1m: cacheRead, priceIn1m: priceIn, priceOut1m: priceOut,
    listedIn1m: priceIn, listedOut1m: priceOut, uptime: 100, status: 0 }
}

const snap = { rows: [
  row(FOCUS, 'StepFun', 105e-9, 2.1e-6, 420e-9),
  row(FOCUS, 'Baidu', 97.7e-9, 2.1e-6, 394.4e-9),
  row('deepseek/deepseek-v4-pro-0813', 'Parasail', 1.98e-6, 66e-6, 5.94e-6),
  row('deepseek/deepseek-v4-pro-0813', 'Baidu', 483.3e-9, 2.6e-6, 966.7e-9),
  row('deepseek/deepseek-chat', 'DeepInfra', 257e-9, 130e-6, 1028e-9),
  row('deepseek/deepseek-chat-v3.1', 'DeepInfra', 250e-9, 130e-6, 950e-9),
  row('deepseek/deepseek-chat-v3-0324', 'DeepInfra', 290e-9, 110e-6, 1140e-9),
  // ردیفی که OpenRouter قیمتِ کش را برایش منتشر نکرده (یعنی کش ندارد)
  { model: 'deepseek/deepseek-nocache', provider: 'DeepInfra', slug: 'deepinfra', quantization: 'fp8', tier: null,
    quality: 90, usable: true, official: false, priceIn: 0.32e-6, priceOut: 0.89e-6,
    cacheRead1m: null, cacheKnown: false, priceIn1m: 0.32, priceOut1m: 0.89, uptime: 100, status: 0 },
] }
const cfg = { focus: FOCUS, qualityFloor: 85 }
const profile = { scope: 'session', sessions: 1, requests: 10, cacheShare: 96,
  avgPromptPerRequest: 300000, avgCachedPerRequest: 288000, avgUncachedPerRequest: 12000,
  avgOutPerRequest: 600, outToInPct: 0.2, totals: {} }

;(async () => {
  const mod = await import(path.resolve(HOST))

  // ---- باگ ۲: تطبیقِ برابری ----
  check('modelMatches: کلِ شناسه', mod.modelMatches(FOCUS, FOCUS), true)
  check('modelMatches: بدونِ پیشوند', mod.modelMatches(FOCUS, 'deepseek-v4.1-flash-1017'), true)
  check('modelMatches: زیررشته نباید بگیرد (chat ≠ chat-v3.1)',
    mod.modelMatches('deepseek/deepseek-chat-v3.1', 'deepseek-chat'), false)
  check('modelMatches: زیررشته نباید بگیرد (chat ≠ chat-v3-0324)',
    mod.modelMatches('deepseek/deepseek-chat-v3-0324', 'deepseek-chat'), false)
  check('modelMatches: فلگ‌دار (:batch) جدا', mod.modelMatches(FOCUS + ':batch', FOCUS), false)

  // ---- باگ ۱: مدلِ درخواستی ----
  const pro = mod.recommendFromProfile(snap, profile, cfg, { model: 'deepseek-v4-pro-0813' })
  check('override: مدل = pro-0813', pro.model, 'deepseek/deepseek-v4-pro-0813')
  check('override: تعدادِ کاندید = ۲', pro.alternatives.length + 1, 2)
  check('override: هیچ ردیفی از flash نیامده',
    [...pro.alternatives, pro.recommended].every((a) => a.provider === 'Parasail' || a.provider === 'Baidu'), true)

  // ---- باگ ۲ در عمل: فقط یک مدلِ chat ----
  const chat = mod.recommendFromProfile(snap, profile, cfg, { model: 'deepseek-chat' })
  check('override: deepseek-chat فقط خودش', chat.model, 'deepseek/deepseek-chat')
  check('override: chat کاندید = ۱', chat.alternatives.length + 1, 1)

  // ---- کشِ منتشرنشده نباید «رایگان» حساب شود ----
  const nc = mod.recommendFromProfile(snap, profile, cfg, { model: 'deepseek-nocache' })
  check('مدلِ بی‌پایه: آفِ واقعی null (پایهٔ رسمی ندارد)', nc.recommended.realOffPct, null)
  check('مدلِ بی‌پایه: هزینهٔ هر درخواست = همهٔ ورودی با قیمتِ کامل',
    Math.abs(nc.recommended.costPerRequest - 0.096534) < 1e-9, true)
  check('خروجیِ پیشنهاد دیگر offPctِ اعلامی ندارد',
    Object.prototype.hasOwnProperty.call(nc.recommended, 'offPct'), false)
  check('خروجیِ پیشنهاد realOffPct دارد',
    Object.prototype.hasOwnProperty.call(pro.recommended, 'realOffPct'), true)

  // ---- باگ ۳: پیش‌فرض ----
  const def = mod.recommendFromProfile(snap, profile, cfg)
  check('پیش‌فرض بدونِ override = flash-1017', def.model, FOCUS)

  if (failures.length) {
    console.error(`\n${failures.length} شرط شکست خورد:`)
    for (const f of failures) console.error(' - ' + f)
    process.exit(1)
  }
  console.log('\nهمهٔ شرط‌ها سبز.')
  process.exit(0)
})().catch((e) => { console.error('آزمون با خطا متوقف شد:', e.message); process.exit(1) })