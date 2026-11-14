/** آزمونِ خرجِ دقیقِ هر چت (نصفِ host) — بی‌شبکه، با لاگ و fetchِ قلابی. */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { parseSessionLog, summarizeChatCost, createPriceBook, createLogCache, findSessionLog, shortModel, flagWaste, summarizeWaste } from '../cost-log.js'
import { chatCost } from '../index.js'

const ev = (type, time, data) => JSON.stringify({ type, time, data })
const am = (turn, step, time, id, usage, tools = []) => ev('assistant/message', time, {
  turn, step, usage,
  message: { role: 'assistant', content: tools.map(name => ({ type: 'tool-call', name })),
    source: { kind: 'model', provider: 'openrouter', model: 'deepseek/deepseek-v4.1-flash-1017@preset/x',
      replayState: { response: { responseId: id, responseModel: 'deepseek/deepseek-v4.1-flash-1017', stopReason: 'stop' } } } },
})
const log = [
  ev('user/message', 1, { source: { kind: 'user' }, content: [{ type: 'text', text: 'سلام، این را درست کن' }] }),
  ev('turn/start', 2, { turn: 1 }),
  ev('step/start', 3, { turn: 1, step: 1 }),
  am(1, 1, 1003, 'gen-a', { inputTokens: 50000, outputTokens: 300 }, ['bash']),
  ev('step/start', 1004, { turn: 1, step: 2 }),
  am(1, 2, 3004, 'gen-b', { inputTokens: 100, outputTokens: 5000, cacheReadTokens: 49000 }),
  ev('user/message', 4000, { source: { kind: 'session-message' }, content: [{ type: 'text', text: '[session-message] Sent by…\nfrom: x\ndeclared-write-scopes: a\n**ناظر:** چک کن' }] }),
  ev('turn/start', 4001, { turn: 2 }),
  am(2, 1, 4500, 'gen-c', { inputTokens: 10, outputTokens: 10, cacheReadTokens: 50000 }),
  'نیمه‌خط خراب {',
].join('\n')

// ۱) پارس
const parsed = parseSessionLog(log)
assert.equal(parsed.requests.length, 3)
assert.deepEqual(parsed.requests[0].tools, ['bash'])
assert.equal(parsed.requests[0].durationMs, 1000)
assert.equal(parsed.requests[1].cached, 49000)
assert.equal(parsed.requests[0].model, 'deepseek-v4.1-flash-1017')
assert.equal(parsed.turns.get(1).trigger.kind, 'حبیب')
assert.equal(parsed.turns.get(2).trigger.text, '**ناظر:** چک کن', 'peer header stripped')
assert.equal(shortModel(''), 'نامعلوم')

// ۲) جمع: قیمتِ نیامده ⇒ pending، نه صفرِ دروغ
const prices = { 'gen-a': 0.02, 'gen-b': 0.003 }
const sum = summarizeChatCost(parsed, id => prices[id])
assert.equal(sum.requests, 3)
assert.equal(sum.priced, 2)
assert.equal(sum.pending, 1)
assert.ok(Math.abs(sum.total - 0.023) < 1e-12)
assert.equal(sum.top[0].responseId, 'gen-a', 'most expensive first')
assert.equal(sum.list[0].responseId, 'gen-c', 'newest first')
assert.equal(sum.turns[0].turn, 2)
assert.ok(Math.abs(sum.turns[1].cost - 0.023) < 1e-12)

// ۳) دفترِ قیمت: ۴۰۴ ⇒ دوباره؛ ۲۰۰ ⇒ عدد؛ کلید فقط در هدر
const seen = []
let ready = false
const book = createPriceBook({
  readKey: () => 'sk-test', retryMs: 0, concurrency: 2,
  fetchImpl: async (url, init) => {
    seen.push(url)
    assert.equal(init.headers.authorization, 'Bearer sk-test')
    assert.ok(!url.includes('sk-test'), 'key never in the URL')
    if (!ready) return { ok: false, status: 404, json: async () => ({}) }
    return { ok: true, status: 200, json: async () => ({ data: { total_cost: 0.0042 } }) }
  },
})
assert.equal(book.priceOf('gen-z'), undefined)
book.flush()
await new Promise(r => setTimeout(r, 10))
assert.equal(book.priceOf('gen-z'), undefined, '404 ⇒ still pending')
ready = true
book.flush()
await new Promise(r => setTimeout(r, 10))
assert.equal(book.priceOf('gen-z'), 0.0042)
assert.ok(seen[0].includes('/api/v1/generation?id=gen-z'))

// ۴) شناسهٔ ناامن ⇒ هیچ (جلوی ../)
assert.equal(findSessionLog('../../etc'), null)

// ۵) فایلِ واقعیِ zstd با چند قاب (همان شکلِ لاگِ زندهٔ اپ)
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sp-cost-'))
const dir = path.join(root, '--x--', 'session-test1')
fs.mkdirSync(dir, { recursive: true })
const half = log.split('\n')
const frame = text => spawnSync('/opt/homebrew/bin/zstd', ['-c'], { input: Buffer.from(text) }).stdout
fs.writeFileSync(path.join(dir, 'session.v4.jsonl.zstd'), Buffer.concat([frame(half.slice(0, 4).join('\n') + '\n'), frame(half.slice(4).join('\n'))]))
const read = createLogCache({ root })
assert.equal(read('session-test1').requests.length, 3, 'all frames read, not only the first')
const route = chatCost('session-test1', { readChatLog: read, priceBook: { priceOf: id => prices[id], flush() {} } })
assert.equal(route.found, true)
assert.equal(route.priced, 2)
assert.equal(chatCost('session-none', { readChatLog: read, priceBook: { priceOf() {}, flush() {} } }).found, false)
fs.rmSync(root, { recursive: true, force: true })

// ۶) چتِ غیرِ OpenRouter (مثلاً anthropic با msg_…): هیچ پرسشی، هیچ $0 ِ دروغ
const asked = []
const anth = parseSessionLog([
  ev('turn/start', 1, { turn: 1 }),
  ev('user/message', 2, { source: { kind: 'user' }, content: [{ type: 'text', text: '<system-reminder>x' }, { type: 'text', text: 'حرفِ حبیب' }] }),
  JSON.stringify({ type: 'assistant/message', time: 5, data: { turn: 1, step: 1, usage: { inputTokens: 2, outputTokens: 700, cacheReadTokens: 290000 },
    message: { content: [], source: { provider: 'anthropic', model: 'claude-opus-5-5', replayState: { response: { responseId: 'msg_011C' } } } } } }),
].join('\n'))
assert.equal(anth.turns.get(1).trigger.text, 'حرفِ حبیب', 'turn/start comes first in the real log; reminders skipped')
const anthSum = summarizeChatCost(anth, id => { asked.push(id); return 1 })
assert.equal(asked.length, 0, 'msg_… must never be sent to OpenRouter')
assert.equal(anthSum.priced, 0)
assert.equal(anthSum.unpriceable, 1)
assert.equal(anthSum.list[0].cost, null)
assert.equal(anthSum.topBy, 'tokens')
assert.deepEqual(anthSum.providers, ['anthropic'])

// ۷) «پولِ الکی»: علتِ هر کش‌نخوردن + دلارِ الکی
{
  const mk = (i, over) => ({ turn: 1, step: i, time: i * 60000, model: 'deepseek-v4.1-flash-1017', ref: 'x@preset/mh-deepseek-v4-1-flash-1017-deepinfra', responseId: 'gen-' + i, real: 'DeepInfra', promptN: 100000, cachedN: 99000, cost: 0.001, tools: [], ...over })
  const rows = flagWaste([
    mk(1, { cachedN: 0, cost: 0.01 }), // اولین ⇒ طبیعی
    mk(2, {}), // کش خورد
    mk(3, { cachedN: 0, cost: 0.01 }), // همان سرور، ۱ دقیقه بعد ⇒ سرور کش را نگه نداشت
    mk(4, { real: 'Baidu', cachedN: 0, cost: 0.01 }), // سرور عوض شد + preset روی deepinfra بود
    mk(5, { real: 'Baidu', time: 5 * 60000 + 6 * 60000, cachedN: 0, cost: 0.01 }), // مکث > ۵ دقیقه
    mk(6, { real: 'Baidu', ref: 'y@preset/other', cachedN: 0, cost: 0.01 }), // مدل/preset عوض شد
    mk(7, { model: 'deepseek-v4-pro-0813', ref: 'y@preset/other', real: 'Baidu', promptN: 250000, cachedN: 249000 }), // pro + بزرگ
  ])
  const kinds = rows.map(r => r.flags.map(f => f.kind).join(','))
  assert.deepEqual(kinds, ['first', '', 'dropped', 'provider,fallback', 'gap,fallback', 'model', 'pro,big'])
  assert.equal(rows[0].waste, 0, 'first request is not waste')
  assert.ok(Math.abs(rows[2].waste - (0.01 - 100000 * 0.001 / 99000 * 99000 / 100000 * 100000 / 100000)) < 0.002, 'waste = cost minus cached-equivalent')
  assert.ok(rows[2].flags[0].level === 'red' && rows[6].flags[0].level === 'amber')
  const w = summarizeWaste(rows)
  assert.equal(w.byKind.dropped.count, 1)
  assert.ok(w.total > 0.03, 'red waste summed')
}

console.log('cost OK: پارس + جمعِ دقیق + pending + دفترِ قیمت + لاگِ چندقابی')