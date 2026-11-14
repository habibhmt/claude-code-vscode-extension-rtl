/** آزمونِ توابعِ خالصِ مترجمِ مدل. */
import assert from 'node:assert/strict'
import {
  normalizeUsage, requestDurationMs, requestModel, requestCost, summarizeRequest,
  compareRequests, summarizeEvents, formatMoney, usagePercent, summarizeSession, summarizeStats,
  splitTracks, swapMiddleTracks, firstTrackPx, faNum, faMoney, explainCost, preferredPanelWidth,
} from '../panel-fold.js'

const req = (over = {}) => ({
  turn: 1, step: 2, status: 'complete', startedAt: 1000, completedAt: 3000,
  providerMetadata: { provider: 'openrouter', model: 'deepseek/x' },
  usage: { inputTokens: 1000, outputTokens: 200, totalTokens: 1200 },
  ...over,
})

// ۱) usage ناقص ⇒ null، نه NaN
assert.deepEqual(normalizeUsage(null), null)
assert.deepEqual(normalizeUsage({}), null)
assert.deepEqual(normalizeUsage({ inputTokens: 5, outputTokens: 7 }), { input: 5, output: 7, total: 12, cacheRead: null, cacheWrite: null })
assert.equal(normalizeUsage({ inputTokens: 'x' }), null)

// ۲) مدت
assert.equal(requestDurationMs(req()), 2000)
assert.equal(requestDurationMs({ startedAt: 1000, completedAt: null }), null)
assert.equal(requestDurationMs({ startedAt: 3000, completedAt: 1000 }), null)
assert.equal(requestDurationMs(null), null)

// ۳) مدل
assert.equal(requestModel(req()), 'openrouter/deepseek/x')
assert.equal(requestModel({ providerMetadata: { provider: 'openrouter' } }), 'نامعلوم')
assert.equal(requestModel(null), 'نامعلوم')

// ۴) هزینه: قیمت نامعلوم ⇒ null، نه صفر
assert.equal(requestCost(req(), null), null)
assert.equal(requestCost(req(), { prompt: null, completion: 1 }), null)
const cost = requestCost(req(), { prompt: 0.14, completion: 0.28 })
assert.ok(Math.abs(cost - (1000 / 1e6 * 0.14 + 200 / 1e6 * 0.28)) < 1e-12, 'cost math')

// ۵) خلاصه
const sum = summarizeRequest(req())
assert.equal(sum.inputTokens, 1000)
assert.equal(sum.durationMs, 2000)
assert.equal(sum.error, null)
assert.equal(summarizeRequest(req({ error: 'boom' })).error, 'boom')

// ۶) مقایسه: قبلی صفر ⇒ نسبت null نه Infinity
const cmpZero = compareRequests(req({ usage: { inputTokens: 0, outputTokens: 0 } }), req())
assert.equal(cmpZero.inputRatio, null)
const cmp = compareRequests(
  req({ usage: { inputTokens: 100, outputTokens: 10, cacheReadTokens: 5 } }),
  req({ usage: { inputTokens: 300, outputTokens: 30, cacheReadTokens: 0 } }),
)
assert.equal(cmp.inputRatio, 3)
assert.equal(cmp.inputDelta, 200)
assert.equal(cmp.cacheMissed, true)

// ۷) رخدادها
const events = summarizeEvents([
  { kind: 'user' }, { kind: 'assistant' },
  { kind: 'tool-result', name: 'bash', time: 5 }, { kind: 'tool-result', name: '', isError: true },
])
assert.equal(events.total, 4)
assert.equal(events.byKind['tool-result'], 2)
assert.equal(events.tools.length, 2)
assert.equal(events.tools[1].name, 'ابزار')
assert.equal(events.tools[1].isError, true)
assert.equal(summarizeEvents(undefined).total, 0)

// ۸) پول و درصد
assert.equal(formatMoney(1.23456), '$1.2346')
assert.equal(formatMoney(null), 'نامعلوم')
assert.equal(formatMoney(NaN), 'نامعلوم')
assert.equal(usagePercent(5, 10), 50)
assert.equal(usagePercent(20, 10), 100)
assert.equal(usagePercent(5, 0), null)
assert.equal(usagePercent(null, 10), null)

// ۹) سشن
const session = summarizeSession({
  requests: [req(), req({ usage: null, providerMetadata: { provider: 'openrouter', model: 'other' } })],
  eventNodes: [{ kind: 'tool-result', name: 'read' }],
})
assert.equal(session.requests, 2)
assert.equal(session.tools, 1)
assert.equal(session.inputTokens, 1000)
assert.equal(session.models.length, 2)
assert.equal(summarizeSession(null).requests, 0)
assert.equal(summarizeSession({}).inputTokens, null)

// ۱۰) آمار (Statistics)
const stats = summarizeStats({
  stepCount: 3,
  turns: [
    { turn: 1, context: 100, output: 10, ttft: 800, model: 1200, tool: 400, tps: 42.5, cacheHit: 0.25, cacheRead: 50, tools: [{ name: 'bash', count: 2 }] },
    { turn: 2, context: 150, output: 20, ttft: 900, model: 1500, tool: 600, tps: 55, cacheHit: 0.5, cacheRead: 70, tools: [{ name: 'bash', count: 1 }, { name: 'read', count: 4 }] },
  ],
})
assert.equal(stats.turns, 2)
assert.equal(stats.steps, 3)
assert.equal(stats.context, 250)
assert.equal(stats.output, 30)
assert.equal(stats.ttft, 900)
assert.equal(stats.modelMs, 2700)
assert.equal(stats.toolMs, 1000)
assert.equal(stats.tps, 55)
assert.equal(stats.cacheHit, 0.5)
assert.equal(stats.tools[0].name, 'read')
assert.equal(stats.tools[0].count, 4)
assert.equal(stats.tools[1].count, 3)

const emptyStats = summarizeStats(null)
assert.equal(emptyStats.turns, 0)
assert.equal(emptyStats.context, null)
assert.equal(emptyStats.ttft, null)
assert.equal(summarizeStats({ turns: [{ context: 'x' }] }).context, null)

// ۱۱) چیدمان: جای چت و پنل عوض می‌شود، سایدبار نه
assert.deepEqual(splitTracks('280px minmax(360px, 1fr) minmax(0px, 520px)'), ['280px', 'minmax(360px, 1fr)', 'minmax(0px, 520px)'])
assert.equal(swapMiddleTracks('280px minmax(360px, 1fr) minmax(0px, 520px)'), '280px minmax(0px, 520px) minmax(360px, 1fr)')
assert.equal(swapMiddleTracks(swapMiddleTracks('0px minmax(0px, 1fr) minmax(0px, 0px)')), '0px minmax(0px, 1fr) minmax(0px, 0px)', 'two swaps = original')
assert.equal(swapMiddleTracks('1fr 2fr'), null, 'unknown template ⇒ hands off')
assert.equal(firstTrackPx('280px a b'), 280)
assert.equal(firstTrackPx('auto a b'), null)

// ۱۲) فارسی
assert.equal(faNum(12345), '۱۲٬۳۴۵')
assert.equal(faMoney(0.000913), '\u2066$0.00091\u2069', 'LTR isolate: $ stays before the number inside Persian text')
assert.equal(faMoney(0.0247), '\u2066$0.0247\u2069')
assert.equal(faMoney(0.0247).replace(/[\u2066\u2069]/g, ''), '$0.0247')
assert.equal(faMoney(null), '—')
assert.match(explainCost({ input: 251582, cached: 4096, output: 275 }), /کش نخورد/)
assert.match(explainCost({ input: 128, cached: 295168, output: 112 }), /از کش آمد/)
assert.match(explainCost({ input: 100, cached: 1000, output: 9000 }), /جوابِ بلند/)

// ۱۳) پهنای پیش‌فرض
assert.equal(preferredPanelWidth(1600, 280), 520)
assert.equal(preferredPanelWidth(1300, 280), 340, 'chat keeps 680')

console.log('fold OK: همهٔ ۱۳ گروه آزمون سبز')