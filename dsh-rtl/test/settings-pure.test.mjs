/**
 * آزمونِ توابعِ خالصِ صفحهٔ تنظیمات (settings-pure.js):
 * سه سطح (اولویتِ چت > پروژه > سراسری > پیش‌فرض)، امنیتِ مسیر و شناسه،
 * اعتبارسنجی با readPlus، جست‌وجو، و ردیف‌های «تنظیم‌های خودِ اپ» (راز پنهان).
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  LEVELS, LEVEL_NAMES, readLayers, effectiveOf, levelName, setAt, valueAt,
  isSafeId, isAbsolutePath, unsafeWorkspace, validatePref, cleanFile, matchesQuery,
  appSettingRows, isSecretKey, displayValue, nowLine, allKeys, SAFE_ID,
} from '../settings-pure.js'
import { readPlus, PLUS_DEFAULTS } from '../plus-pure.js'

const PREFS = { rtl: true, font: true, code: true, plaintext: true }
const KEYS = Object.keys(PREFS).concat(Object.keys(PLUS_DEFAULTS))

test('سه سطح: ترتیبِ چت > پروژه > سراسری > پیش‌فرض', () => {
  const layers = { global: { lh: 18 }, project: { lh: 21 }, chat: { lh: 24 } }
  assert.deepEqual(effectiveOf(layers, 'lh', 0), { value: 24, level: 'chat' })
  assert.deepEqual(effectiveOf({ global: { lh: 18 }, project: { lh: 21 }, chat: {} }, 'lh', 0), { value: 21, level: 'project' })
  assert.deepEqual(effectiveOf({ global: { lh: 18 }, project: {}, chat: {} }, 'lh', 0), { value: 18, level: 'global' })
  assert.deepEqual(effectiveOf({ global: {}, project: {}, chat: {} }, 'lh', 0), { value: 0, level: 'default' })
  // کلیدِ ناموجود در یک سطح، سطحِ پایین‌تر را نشان می‌دهد
  assert.equal(effectiveOf({ global: { lh: 18 }, project: {}, chat: { btnSize: 9 } }, 'lh', 0).level, 'global')
  assert.deepEqual(LEVELS, ['chat', 'project', 'global'])
  assert.equal(levelName('chat'), 'چت')
  assert.equal(levelName('default'), 'پیش‌فرض')
})

test('setAt و valueAt: فقط یک سطح عوض می‌شود، ورودی دست نمی‌خورد', () => {
  const before = { global: { lh: 18 }, project: {}, chat: { lh: 24 } }
  const next = setAt(before, 'project', 'lh', 21)
  assert.equal(next.project.lh, 21)
  assert.equal(next.chat.lh, 24)
  assert.equal(next.global.lh, 18)
  assert.equal(before.project.lh, undefined, 'ورودی دست‌نخورده')
  const cleared = setAt(next, 'chat', 'lh', undefined)
  assert.equal('lh' in cleared.chat, false)
  assert.equal(valueAt(cleared, 'chat', 'lh'), undefined)
  assert.equal(valueAt(cleared, 'global', 'lh'), 18)
  assert.throws(() => setAt(before, 'nope', 'lh', 1))
})

test('readLayers: رشتهٔ JSON، کلیدهای ناشناخته، __proto__', () => {
  const layers = readLayers({
    global: '{"lh":18,"evil":1}',
    project: { btnSize: 9 },
    chat: null,
  }, KEYS)
  assert.deepEqual(layers.global, { lh: 18 })
  assert.deepEqual(layers.project, { btnSize: 9 })
  assert.deepEqual(layers.chat, {})
  // JSON ِ خراب ⇒ خالی و بی‌خطا
  assert.deepEqual(readLayers({ global: '{bad' }, KEYS).global, {})
  // کلیدِ خطرناک از راهِ JSON واردِ prototype نمی‌شود
  const hostile = readLayers({ global: '{"__proto__":{"polluted":1},"lh":1}' }, KEYS)
  assert.equal({}.polluted, undefined)
  assert.equal(hostile.global.lh, 1)
})

test('cleanFile: فقط کلیدهای مجاز، بی undefined', () => {
  assert.deepEqual(cleanFile({ rtl: true, evil: 1, lh: undefined }, KEYS), { rtl: true })
  assert.deepEqual(cleanFile(null, KEYS), {})
  assert.deepEqual(cleanFile([1, 2], KEYS), {})
})

test('شناسهٔ چت: فقط حرف/رقم/نقطه/خط‌تیره، بی ..', () => {
  assert.equal(isSafeId('session-abc_1.2'), true)
  assert.equal(isSafeId('a'), true)
  for (const bad of ['', '..', '../etc/passwd', 'a/b', 'a\\b', '-lead', '.hid', 'x'.repeat(200), null, 5]) {
    assert.equal(isSafeId(bad), false, String(bad))
  }
  assert.equal(SAFE_ID.test('ok'), true)
})

test('مسیر: مطلق بودن و سدِ پوشهٔ سیستم/خانه/ریشه', () => {
  assert.equal(isAbsolutePath('/Users/x/proj'), true)
  assert.equal(isAbsolutePath('rel/path'), false)
  assert.equal(isAbsolutePath(''), false)
  assert.equal(isAbsolutePath('/a\u0000b'), false)
  assert.equal(unsafeWorkspace('/etc/passwd', '/Users/x'), 'پوشهٔ سیستم')
  assert.equal(unsafeWorkspace('/usr', '/Users/x'), 'پوشهٔ سیستم')
  assert.equal(unsafeWorkspace('/', '/Users/x'), 'ریشهٔ دیسک')
  assert.equal(unsafeWorkspace('/Users/x', '/Users/x'), 'پوشهٔ خانه')
  assert.equal(unsafeWorkspace('/Users/x/../y', '/Users/x'), 'مسیر «..» دارد')
  assert.equal(unsafeWorkspace('rel', '/Users/x'), 'مسیر مطلق نیست')
  assert.equal(unsafeWorkspace('/Users/x/proj', '/Users/x'), null)
  // نامِ پوشه‌ای که فقط با /etc شروع می‌شود (مثلِ /etcetera) رد نمی‌شود
  assert.equal(unsafeWorkspace('/etcetera', '/Users/x'), null)
})

test('validatePref: سوییچ‌ها بولی، عددها در بازه، رنگِ ناامن', () => {
  const tools = { readPlus, prefs: PREFS }
  assert.deepEqual(validatePref('rtl', false, tools), { ok: true, value: false })
  assert.deepEqual(validatePref('rtl', 0, tools), { ok: true, value: false })
  assert.deepEqual(validatePref('rtl', 'x', tools), { ok: true, value: true })
  assert.equal(validatePref('lh', 99, tools).value, 30, 'بازهٔ readPlus')
  assert.equal(validatePref('btnSize', 1, tools).value, 8)
  assert.equal(validatePref('accent', 'red;}x', tools).value, '')
  assert.equal(validatePref('place', 'nowhere', tools).value, 'dock')
  assert.equal(validatePref('evil', 1, tools).ok, false)
  assert.equal(validatePref('commands', [], tools).ok, false, 'ساختارِ سنگین کلیدِ سه‌سطحی نیست')
})

test('allKeys: همهٔ کلیدهای prefs + plus', () => {
  const keys = allKeys(PREFS, PLUS_DEFAULTS)
  for (const k of ['rtl', 'font', 'code', 'plaintext', 'lh', 'btnSize', 'place']) assert.ok(keys.includes(k), k)
})

test('جست‌وجو: پرچندواژه، بی‌حساسیت، در شرح و کلیدِ انگلیسی', () => {
  const row = { label: 'فونتِ فارسی (Vazirmatn)', hint: 'متن‌های فارسی با Vazirmatn', key: 'font', value: true }
  assert.equal(matchesQuery([row], ''), true)
  assert.equal(matchesQuery([row], '   '), true)
  assert.equal(matchesQuery([row], 'فونت'), true)
  assert.equal(matchesQuery([row], 'vazirmatn'), true, 'بی‌حساسیت به بزرگ/کوچک')
  assert.equal(matchesQuery([row], 'font'), true, 'کلیدِ انگلیسی')
  assert.equal(matchesQuery([row], 'فونت فارسی'), true, 'همهٔ واژه‌ها')
  assert.equal(matchesQuery([row], 'فونت جدول'), false, 'یک واژه نبود')
  assert.equal(matchesQuery([row], 'روشن'), true, 'مقدارِ الان')
})

test('راز: کلیدهای رمز/توکن باید پنهان شوند', () => {
  for (const k of ['apiKey', 'token', 'SECRET', 'password', 'api_key', 'credential', 'key']) assert.equal(isSecretKey(k), true, k)
  for (const k of ['model', 'provider', 'maxDepth', 'fontSize']) assert.equal(isSecretKey(k), false, k)
  assert.equal(displayValue('sk-live-123', 'apiKey'), '•••••• (پنهان)')
  assert.equal(displayValue(true), 'روشن')
  assert.equal(displayValue(false), 'خاموش')
  assert.equal(displayValue(''), '—')
  assert.equal(displayValue(undefined), '—')
  assert.equal(displayValue({ a: 1 }), '{"a":1}')
})

const LOCALE = {
  'ui-theme': { label: 'ظاهر و خوانایی', tozih: 'رنگ و اندازهٔ نوشته‌ها.', key_fa: { fontSize: 'اندازهٔ متنِ گفتگو' } },
}

test('appSettingRows: برچسبِ فارسی، شرح، و ردیفِ راز پنهان', () => {
  const ns = {
    ns: 'ui-theme',
    value: { fontSize: 14, preference: 'dark', apiKey: 'sk-1' },
    secrets: [{ path: ['apiKey'], set: true }],
  }
  const rows = appSettingRows(ns, LOCALE)
  const font = rows.find((r) => r.key === 'fontSize')
  assert.equal(font.label, 'ظاهر و خوانایی — اندازهٔ متنِ گفتگو')
  assert.equal(font.hint, 'رنگ و اندازهٔ نوشته‌ها.')
  assert.equal(font.secret, false)
  const secret = rows.find((r) => r.key === 'apiKey')
  assert.equal(secret.secret, true, 'راز علامت خورده')
  assert.equal(secret.hint, 'این مقدار راز است و نشان داده نمی‌شود')
  // فضای‌نامِ بی‌برچسب: نامِ انگلیسی (کلید) می‌ماند
  const fallback = appSettingRows({ ns: 'unknown-ns', value: { someKey: 1 } }, LOCALE)
  assert.equal(fallback[0].label, 'unknown-ns — someKey')
  assert.deepEqual(appSettingRows(null, LOCALE), [])
  assert.deepEqual(appSettingRows({ ns: 'x' }, LOCALE), [])
})

test('nowLine: «الان: X از Y؛ یعنی …»', () => {
  assert.equal(nowLine({ level: 'chat', value: 24, meaning: 'فاصلهٔ بیشتر' }), 'الان: 24 از چت؛ یعنی فاصلهٔ بیشتر')
  assert.equal(nowLine({ level: 'global', value: true }), 'الان: روشن از سراسری')
  assert.equal(nowLine({ level: 'default', value: undefined }), 'الان: — از پیش‌فرض')
})
