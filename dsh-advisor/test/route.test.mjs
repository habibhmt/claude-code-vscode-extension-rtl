import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'

process.env.DSH_ADVISOR_STATE_DIR = path.join(os.tmpdir(), 'advisor-route-test-' + process.pid)
const { runOnce, BIG_INPUT_TOKENS } = await import('../index.js')
const { parseLogRows } = await import('../advisor-pure.js')
const { FALLBACK_MODEL } = await import('../advisor-select.js')

const GOOD = 'تغییری لازم نیست\n## خرجِ بی‌مصرف\n—\n## تنظیمِ بهتر\n—\n## کمک‌های دیگر\n—'
const T0 = Date.UTC(2026, 10, 15, 10, 0, 0)

function rowsOf(textLength) {
  const text = 'ا'.repeat(textLength)
  const lines = [
    { seq: 0, type: 'user/message', time: T0, data: { message: { role: 'user', content: [{ type: 'text', text }] } } },
    { seq: 1, type: 'turn/end', time: T0 + 1, data: { turn: 1, reason: { kind: 'completed' } } },
  ].map((o) => JSON.stringify(o))
  return parseLogRows(lines)
}

/** fetch جعلی: رتبه‌بندی ⇒ بایدو اول؛ هر مدل جوابِ از پیش نوشته. */
function fakeFetch(replies, calls) {
  return async (url, init) => {
    const u = String(url)
    if (u.includes('/plugins/model-hunter/rank')) {
      return { ok: true, json: async () => ({ rows: [{ model: 'deepseek/deepseek-v4-flash', provider: 'Baidu', providerSlug: 'baidu' }] }) }
    }
    if (u.endsWith('/endpoints')) {
      return { ok: true, json: async () => ({ data: { endpoints: [{ provider_name: 'Baidu', tag: 'baidu/fp8', context_length: 1048576 }, { provider_name: 'DeepInfra', tag: 'deepinfra/fp8', context_length: 1048576 }] } }) }
    }
    if (u.endsWith('/chat/completions')) {
      const body = JSON.parse(init.body)
      calls.push(body.model)
      const reply = replies[body.model]
      const json = { model: body.model, choices: [{ finish_reason: 'stop', message: { content: reply.content } }], usage: { prompt_tokens: 100, completion_tokens: 10, cost: reply.cost } }
      const text = JSON.stringify(json)
      return { ok: true, status: 200, text: async () => text }
    }
    throw new Error('unexpected ' + u)
  }
}

const base = { play: false, origin: 'http://127.0.0.1:9', key: 'k' }

test('چتِ کوچک، سرورِ ارزان درست جواب داد ⇒ همان، بی‌تلاشِ دوم', async () => {
  const calls = []
  const r = await runOnce('s-small-ok', { ...base, rows: rowsOf(1000), fetchImpl: fakeFetch({ 'deepseek/deepseek-v4-flash': { content: GOOD, cost: 0.001 } }, calls) })
  assert.deepEqual(calls, ['deepseek/deepseek-v4-flash'])
  assert.equal(r.server.providerSlug, 'baidu')
  assert.equal(r.failedCost, 0)
  assert.equal(r.verdict, 'nothing')
})

test('سرورِ ارزان جوابِ خالی داد ⇒ یک بار دیپ‌اینفرا، و خرجِ تلاشِ ناموفق ثبت می‌شود', async () => {
  const calls = []
  const r = await runOnce('s-empty', { ...base, rows: rowsOf(1000), fetchImpl: fakeFetch({ 'deepseek/deepseek-v4-flash': { content: '', cost: 0.0135 }, [FALLBACK_MODEL]: { content: GOOD, cost: 0.09 } }, calls) })
  assert.deepEqual(calls, ['deepseek/deepseek-v4-flash', FALLBACK_MODEL])
  assert.equal(r.server.model, FALLBACK_MODEL)
  assert.equal(r.failedCost, 0.0135)
  assert.equal(r.cost, 0.09)
  assert.equal(r.failedAttempts.length, 1)
})

test('سرورِ ارزان چت را ادامه داد (بیرون از قالب) ⇒ یک بار دیپ‌اینفرا', async () => {
  const calls = []
  const r = await runOnce('s-off', { ...base, rows: rowsOf(1000), fetchImpl: fakeFetch({ 'deepseek/deepseek-v4-flash': { content: 'بله ادامه می‌دم.', cost: 0.0136 }, [FALLBACK_MODEL]: { content: GOOD, cost: 0.09 } }, calls) })
  assert.deepEqual(calls, ['deepseek/deepseek-v4-flash', FALLBACK_MODEL])
  assert.equal(r.verdict, 'nothing')
  assert.equal(r.failedCost, 0.0136)
})

test('چتِ بزرگ ⇒ مستقیم دیپ‌اینفرا، سرورِ ارزان اصلاً امتحان نمی‌شود', async () => {
  const calls = []
  const r = await runOnce('s-big', { ...base, rows: rowsOf(Math.ceil(BIG_INPUT_TOKENS * 2.5) + 10000), fetchImpl: fakeFetch({ 'deepseek/deepseek-v4-flash': { content: GOOD, cost: 0.01 }, [FALLBACK_MODEL]: { content: GOOD, cost: 0.03 } }, calls) })
  assert.deepEqual(calls, [FALLBACK_MODEL])
  assert.equal(r.failedCost, 0)
  assert.match(r.server.note, /چتِ بزرگ/)
})

test('هر دو شکست ⇒ خطا با جمعِ هر دو خرج، و فقط دو تماس', async () => {
  const calls = []
  await assert.rejects(
    runOnce('s-both', { ...base, rows: rowsOf(1000), fetchImpl: fakeFetch({ 'deepseek/deepseek-v4-flash': { content: '', cost: 0.01 }, [FALLBACK_MODEL]: { content: '', cost: 0.02 } }, calls) }),
    (err) => Math.abs(err.cost - 0.03) < 1e-9 && /پیش از آن/.test(err.message),
  )
  assert.equal(calls.length, 2)
})
