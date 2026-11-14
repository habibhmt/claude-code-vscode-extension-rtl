/**
 * آزمونِ منوی مدلِ خودِ چت (picker.js).
 * باگ‌هایی که می‌پوشاند:
 *   ۱) مدلِ preset بی «افورت» بماند (همان چیزی که حبیب پرسید: «افورت کجاست؟»)
 *   ۲) سرورِ ارزانِ کش‌نخور در منو «ارزان‌ترین» شود (اندازه‌گیری نادیده گرفته شود)
 *   ۳) ورودیِ قبلی (چتی رویش است) از فهرست حذف شود، یا ورودیِ دستیِ حبیب بازنویسی شود
 *   ۴) هزینهٔ «عوض کردن» کمتر از کلِ تاریخچهٔ بی‌کش حساب شود
 *   ۵) سرورِ بی‌ابزار (tools) در منو بیاید
 * اجرا: node --test abzar/model-hunter/test/
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { effortsOf, pickEndpoints, planCatalog, pickerItems, messageCost, contextTokensOfLog, presetSlug, rowForRef, anthropicKey } from '../picker.js'

const row = (provider, slug, cost, extra = {}) => ({ provider, slug, costCalib: cost, quality: 90, usable: true, tier: null, tools: true, priceIn1m: 0.1, cacheRead1m: 0.01, priceOut1m: 0.5, cacheKnown: true, ...extra })
const fam = (model, endpoints, extra = {}) => ({ model, name: 'DeepSeek: ' + model.split('/')[1], created: 1, context: 1048576, input: ['text'], reasoning: { supported_efforts: ['max', 'high', 'low', 'none'] }, endpoints, ...extra })

test('افورت از OpenRouter: none ⇒ off و ترتیبِ pi-ai', () => {
  assert.deepEqual(effortsOf({ supported_efforts: ['max', 'high', 'low', 'none'] }), { off: 'none', low: 'low', high: 'high', max: 'max' })
  assert.deepEqual(effortsOf({ supported_efforts: ['xhigh', 'high', 'none'] }), { off: 'none', high: 'high', xhigh: 'xhigh' })
  assert.equal(effortsOf({ supported_efforts: ['none'] }), undefined)
  assert.equal(effortsOf({ mandatory: false }), undefined)
})

test('هر مدل: ارزان‌ترین‌ها + رسمی؛ بی‌ابزار و flex نمی‌آیند', () => {
  const f = { x: [fam('deepseek/a', [
    row('Cheap', 'cheap', 1), row('NoTools', 'notools', 0.1, { tools: false }), row('Flex', 'flex', 0.05, { tier: 'flex' }),
    row('Mid', 'mid', 2), row('High', 'high', 3), row('Extra', 'extra', 4), row('DeepSeek', 'deepseek', 9, { official: true }),
  ]), fam('deepseek/a:batch', [row('B', 'b', 0.01)], { batch: true })] }
  const picks = pickEndpoints(f, { perModel: 3 })
  assert.deepEqual(picks.map(p => p.row.provider), ['Cheap', 'Mid', 'High', 'DeepSeek'])
  assert.equal(picks[0].ref, 'deepseek/a@preset/' + presetSlug('deepseek/a', 'cheap'))
})

test('فهرست: قبلی‌ها حذف نمی‌شوند، دستیِ حبیب بازنویسی نمی‌شود، مالِ ما نام و افورت می‌گیرد', () => {
  const f = { x: [fam('deepseek/a', [row('Cheap', 'cheap', 1)])] }
  const picks = pickEndpoints(f, { perModel: 1 })
  const oldOurs = { id: picks[0].ref, name: 'Model Hunter — mh-a-cheap' }
  const manual = { id: 'deepseek/a@preset/my-own', name: 'دستیِ حبیب', contextWindow: 5 }
  const gone = { id: 'deepseek/a@preset/mh-a-gone', name: 'Model Hunter — mh-a-gone' }
  const next = planCatalog([manual, oldOurs, gone], picks, () => null)
  assert.equal(next.length, 3)
  assert.equal(next[0].name, 'a · Cheap')
  assert.deepEqual(next[0].reasoningEfforts, { off: 'none', low: 'low', high: 'high', max: 'max' })
  assert.equal(next.find(e => e.id === manual.id).name, 'دستیِ حبیب')
  assert.equal(next.find(e => e.id === manual.id).contextWindow, 5)
  assert.ok(next.find(e => e.id === gone.id), 'ورودیِ قبلی حذف شد')
})

test('ارزان‌ترین با کش‌نخوردنِ اندازه‌گیری‌شده، نه فقط قیمتِ فهرست', () => {
  const rows = [
    { ...row('Baidu', 'baidu', 1), model: 'deepseek/a', priceIn1m: 0.1, cacheRead1m: 0.001, measured: { eligible: 600, missPct: 6 } },
    { ...row('DeepInfra', 'deepinfra', 1), model: 'deepseek/a', priceIn1m: 0.1, cacheRead1m: 0.0025, measured: { eligible: 400, missPct: 0.2 } },
  ]
  const list = rows.map(r => ({ id: 'deepseek/a@preset/' + presetSlug('deepseek/a', r.slug) }))
  const { items, best } = pickerItems({ openrouter: list, rows, tokens: 300000 })
  assert.equal(best['deepseek/a'], list[1].id)
  assert.equal(items['openrouter|' + list[0].id].missPct, 6)
})

test('هزینهٔ عوض کردن = کلِ تاریخچه با قیمتِ کاملِ ورودی', () => {
  const c = messageCost({ in1m: 1, cache1m: 0.1, out1m: 0, miss: 0 }, 1_000_000, 0, 0)
  assert.equal(c.cold, 1)
  assert.ok(Math.abs(c.warm - 0.1) < 1e-9)
  const a = messageCost({ in1m: 4, cache1m: 0.2, write1m: 5, out1m: 0, miss: 0 }, 1_000_000, 0, 0)
  assert.equal(a.cold, 5, 'Anthropic: نوشتنِ کش ۱٫۲۵ برابر')
})

test('اندازهٔ تاریخچه از آخرین جوابِ لاگ', () => {
  const log = [
    JSON.stringify({ type: 'assistant/message', data: { usage: { totalTokens: 1000 } } }),
    JSON.stringify({ type: 'user/message', data: {} }),
    JSON.stringify({ type: 'assistant/message', data: { usage: { inputTokens: 10, cacheReadTokens: 5000, outputTokens: 90 } } }),
    '{"type":"assistant/message","usage": نیمه',
  ].join('\n')
  assert.equal(contextTokensOfLog(log), 5100)
})

test('preset ⇒ ردیفِ سطحِ استاندارد؛ کلیدِ Anthropic', () => {
  const rows = [{ ...row('X', 'x', 1), model: 'm/a', tier: 'flex' }, { ...row('X', 'x', 1), model: 'm/a' }]
  assert.equal(rowForRef(rows, 'm/a@preset/' + presetSlug('m/a', 'x')).tier, null)
  assert.equal(rowForRef(rows, 'm/a'), null)
  assert.equal(anthropicKey('anthropic/claude-opus-5.5'), anthropicKey('claude-opus-5-5'))
})

test('سد: سایتِ بیگانه نمی‌تواند به مسیرهای شکارچی بزند', async () => {
  const { rejectReason } = await import('../index.js')
  assert.equal(rejectReason({ headers: { host: '127.0.0.1:62141' } }), null)
  assert.equal(rejectReason({ headers: { host: '127.0.0.1:62141', origin: 'http://127.0.0.1:62141' } }), null)
  assert.equal(rejectReason({ headers: { host: '127.0.0.1:62141', origin: 'https://evil.example' } }), 'origin')
  assert.equal(rejectReason({ headers: { host: 'evil.example:62141' } }), 'host')
  assert.equal(rejectReason({ headers: { host: '127.0.0.1:1', 'sec-fetch-site': 'cross-site' } }), 'cross-site')
})
