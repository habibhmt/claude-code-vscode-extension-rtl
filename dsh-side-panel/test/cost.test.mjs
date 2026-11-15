/** آزمونِ خرجِ دقیقِ هر چت (نصفِ host) — بی‌شبکه، با لاگ و fetchِ قلابی. */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { parseSessionLog, summarizeChatCost, createPriceBook, createLogCache, findSessionLog, shortModel, flagWaste, summarizeWaste, parseAnthropicPricing, anthropicCost, anthropicModelKey, createAnthropicPrices, ANTHROPIC_FALLBACK } from '../cost-log.js'
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
assert.equal((await read('session-test1')).requests.length, 3, 'all frames read, not only the first')
// دو درخواستِ هم‌زمان (قرص + پنل) ⇒ یک بار باز کردن، همان شیء
const [p1, p2] = await Promise.all([read('session-test1'), read('session-test1')])
assert.equal(p1, p2, 'concurrent reads share one decompress')
const route = await chatCost('session-test1', { readChatLog: read, priceBook: { priceOf: id => prices[id], flush() {} } })
assert.equal(route.found, true)
assert.equal(route.priced, 2)
assert.equal((await chatCost('session-none', { readChatLog: read, priceBook: { priceOf() {}, flush() {} } })).found, false)
// باز کردن ناهمگام است: رشتهٔ اصلی در حینِ آن آزاد می‌ماند
{
  const big = path.join(root, '--x--', 'session-big1')
  fs.mkdirSync(big, { recursive: true })
  fs.writeFileSync(path.join(big, 'session.v4.jsonl.zstd'), frame((log + '\n').repeat(4000)))
  const fresh = createLogCache({ root })
  let ticks = 0
  const timer = setInterval(() => { ticks += 1 }, 1)
  const parsedBig = await fresh('session-big1')
  clearInterval(timer)
  assert.equal(parsedBig.requests.length, 3 * 4000)
  assert.ok(ticks > 0, 'event loop kept running while zstd worked')
}
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

// ۶ج) Anthropic: توکن × جدولِ رسمی (حبیب ۱۵ نوامبر). نمونهٔ واقعیِ لاگِ همین چت:
// input 2 · read 163,856 · write 931 · out 498 روی claude-opus-5-5 ($4 / $5 / $0.20 / $20)
{
  const md = [
    '## Model pricing', '',
    '| Model | Base input tokens | 5m cache writes | 1h cache writes | Cache hits and refreshes | Output tokens |',
    '| :-- | :-- | :-- | :-- | :-- | :-- |',
    '| Claude Mythos 5.2 ([limited availability](https://support.claude.com/x)) | $8 / MTok | $10 / MTok | $16 / MTok | $0.20 / MTok<sup>1</sup> | $40 / MTok |',
    '| Claude Opus 5.5                                  | $4 / MTok             | $5 / MTok       | $8 / MTok       | $0.20 / MTok<sup>2</sup> | $20 / MTok             |',
    '| Claude Haiku 5.5 (for prompts up to 100,000 tokens) | $0.10 / MTok | $0.125 / MTok | $0.20 / MTok | $0.01 / MTok | $0.50 / MTok |',
    '| Claude Haiku 5.5 (for prompts over 100,000 tokens) | $0.50 / MTok | $0.625 / MTok | $1 / MTok | $0.05 / MTok | $2.50 / MTok |',
    '', '## Cloud platform pricing', '| Claude Opus 5.5 | $99 / MTok | $99 / MTok | $99 / MTok | $99 / MTok | $99 / MTok |',
  ].join('\n')
  const table = parseAnthropicPricing(md)
  assert.deepEqual(table['claude-opus-5-5'], [{ in: 4, w5: 5, w1h: 8, read: 0.2, out: 20 }], 'only the Model pricing table is read')
  assert.ok(table['claude-mythos-5-2'], 'link in the name is dropped')
  assert.equal(table['claude-haiku-5-5'].length, 2)
  assert.equal(table['claude-haiku-5-5'][0].maxPrompt, 100000)
  assert.equal(parseAnthropicPricing('nothing here'), null)
  assert.equal(anthropicModelKey('claude-opus-4-5-20251101'), 'claude-opus-4-5')
  assert.equal(anthropicModelKey('anthropic/claude-opus-5.5'), 'claude-opus-5-5')

  const row = { input: 2, cached: 163856, written: 931, output: 498 }
  const want = (2 * 4 + 931 * 5 + 163856 * 0.2 + 498 * 20) / 1e6
  assert.ok(Math.abs(anthropicCost(row, table['claude-opus-5-5']) - want) < 1e-12)
  // Haiku 5.5: پرامپتِ بالای ۱۰۰ هزار (با کش) ⇒ پلهٔ گران
  assert.ok(Math.abs(anthropicCost({ input: 1000, cached: 150000, written: 0, output: 100 }, table['claude-haiku-5-5']) - (1000 * 0.5 + 150000 * 0.05 + 100 * 2.5) / 1e6) < 1e-12)
  assert.equal(anthropicCost(row, null), null)

  const log = parseSessionLog(JSON.stringify({ type: 'assistant/message', time: 5, data: { turn: 1, step: 1,
    usage: { inputTokens: 2, outputTokens: 498, cacheReadTokens: 163856, cacheWriteTokens: 931 },
    message: { content: [], source: { provider: 'anthropic', model: 'claude-opus-5-5', replayState: { response: { responseId: 'msg_1' } } } } } }))
  assert.equal(log.requests[0].written, 931)
  const asked2 = []
  const s = summarizeChatCost(log, id => { asked2.push(id); return 1 }, () => null, m => table[anthropicModelKey(m)] || null)
  assert.equal(asked2.length, 0, 'msg_… still never goes to OpenRouter')
  assert.equal(s.priced, 1)
  assert.equal(s.estimated, 1)
  assert.equal(s.unpriceable, 0)
  assert.ok(Math.abs(s.total - want) < 1e-12)
  assert.equal(s.tokens.written, 931)
  // مدلِ ناشناخته ⇒ هنوز «قیمت ندارد»، نه $0
  const unk = summarizeChatCost(parseSessionLog(JSON.stringify({ type: 'assistant/message', time: 5, data: { turn: 1, step: 1, usage: { inputTokens: 5, outputTokens: 5 },
    message: { content: [], source: { provider: 'anthropic', model: 'claude-unknown-9', replayState: { response: { responseId: 'msg_2' } } } } } })), () => 1, () => null, () => null)
  assert.equal(unk.priced, 0)
  assert.equal(unk.unpriceable, 1)

  // انبار: صفحهٔ رسمی ⇒ 'anthropic'؛ خطا ⇒ پشتیبان
  const live = createAnthropicPrices({ fetchImpl: async () => ({ ok: true, text: async () => md }) })
  assert.deepEqual(live.priceOf('claude-opus-5-5'), ANTHROPIC_FALLBACK['claude-opus-5-5'], 'fallback until the page arrives')
  await live.refresh()
  assert.equal(live.source(), 'anthropic')
  const down = createAnthropicPrices({ fetchImpl: async () => { throw new Error('offline') } })
  down.priceOf('x'); await down.refresh()
  assert.equal(down.source(), 'built-in')
  assert.ok(down.priceOf('claude-opus-5-5'))
}

// ۶ب) سرصفحهٔ پیامِ همتا بی declared-write-scopes هم پاک شود
{
  const peer = parseSessionLog([
    ev('turn/start', 1, { turn: 1 }),
    ev('user/message', 2, { source: { kind: 'session-message' }, content: [{ type: 'text', text: '[session-message] Sent by another user-launched Harness session, not by the current user.\nfrom: session-x\nsent-at: 2026-11-15T00:00:00Z\n\nسلام مجری' }] }),
  ].join('\n'))
  assert.equal(peer.turns.get(1).trigger.text.startsWith('سلام مجری'), true, 'header without scopes is stripped')
}

// ۶ج) جمعِ هر مدل: قیمتِ نیامده جدا، جوابِ OpenRouter بی gen-… جدا از «غیرِ OpenRouter»
{
  const mix = parseSessionLog([
    ev('turn/start', 1, { turn: 1 }),
    am(1, 1, 10, 'gen-p1', { inputTokens: 10, outputTokens: 1 }),
    am(1, 2, 20, 'gen-p2', { inputTokens: 10, outputTokens: 1 }),
    am(1, 3, 30, null, { inputTokens: 10, outputTokens: 1 }),
  ].join('\n'))
  const s = summarizeChatCost(mix, id => (id === 'gen-p1' ? 0.01 : undefined))
  assert.equal(s.byModel[0].pending, 1)
  assert.equal(s.byModel[0].unpriced, 1)
  assert.equal(s.noId, 1, 'openrouter row without gen id counted as noId')
  assert.equal(s.unpriceable, 1)
}

// ۶د) صفِ قیمت: تازه‌ترینِ هر دور اول، صفِ قبلی به هم نمی‌ریزد
{
  const order = []
  const gate = []
  const book2 = createPriceBook({
    readKey: () => 'k', retryMs: 0, concurrency: 1,
    fetchImpl: async (url) => { order.push(url.split('id=')[1]); await new Promise(r => gate.push(r)); return { ok: true, json: async () => ({ data: { total_cost: 1 } }) } },
  })
  for (const id of ['gen-1', 'gen-2', 'gen-3']) book2.priceOf(id)
  book2.flush() // gen-3 در پرواز؛ صف: gen-2, gen-1
  for (const id of ['gen-1', 'gen-2', 'gen-3', 'gen-4', 'gen-5']) book2.priceOf(id)
  book2.flush() // تازه‌ها: gen-5, gen-4 جلوی gen-2, gen-1
  while (order.length < 5) { await new Promise(r => setTimeout(r, 1)); const g = gate.shift(); if (g) g() }
  gate.forEach(g => g())
  assert.deepEqual(order, ['gen-3', 'gen-5', 'gen-4', 'gen-2', 'gen-1'])
}

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
  assert.ok(rows[6].flags.find(f => f.kind === 'big').text.includes('۲۵۰ هزار'), 'Persian digits in flag text')
  assert.ok(!/[0-9]/.test(rows[6].flags.find(f => f.kind === 'big').text), 'no Latin digits next to Persian text')
  const w = summarizeWaste(rows)
  assert.equal(w.byKind.dropped.count, 1)
  assert.ok(w.total > 0.03, 'red waste summed')
}

console.log('cost OK: پارس + جمعِ دقیق + pending + دفترِ قیمت + لاگِ چندقابی')