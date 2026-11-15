import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  BIG_BYTES, buildRowIndex, dedupeKey, estimateTokens, faBytes, faInt, headline, isSecretValue,
  lastTurnEndSeq, markUnusual, median, parseLogRows, quotaState, redactInline, redactSecrets,
  renderTranscript, shouldRunOnTurnEnd, trimOldest, DEBOUNCE_MS, QUOTA_PER_DAY, QUOTA_PER_HOUR,
} from '../advisor-pure.js'
import { buildAdvisorInput, unreadNote } from '../advisor-input.js'

const NL = '\n'

/** یک خطِ لاگِ مصنوعی. */
function line(seq, type, time, data, pad = 0) {
  const event = { type, seq, time, data }
  if (pad > 0) event.data = { ...data, pad: 'x'.repeat(pad) }
  return JSON.stringify(event)
}

const T0 = Date.UTC(2026, 10, 15, 3, 30, 0)

/* ------------------------------------------------------------------ پاک‌کردنِ راز */

test('redact: مقدارِ کلیدِ حساس پنهان می‌شود، نامِ متغیرِ محیطی نه', () => {
  assert.equal(isSecretValue('apiKey', 'sk-or-v1-abcdefgh'), true)
  assert.equal(isSecretValue('apiKeyEnv', 'OPENROUTER_API_KEY'), false)
  // قراردادِ سخت: /key|token|secret|password/i — «maxTokens» هم token دارد، پس مقدارش پنهان می‌شود
  assert.equal(isSecretValue('maxTokens', '2048'), true)
  assert.equal(isSecretValue('searchToken', 'abc123'), true)
  assert.equal(isSecretValue('apiKey', 'OPENROUTER_API_KEY'), false, 'نامِ متغیر راز نیست')
  assert.equal(isSecretValue('apiKey', 'sk-or-v1-real-key-123'), true)
})

test('redact: JSON و YAML و متنِ آزاد', () => {
  const json = redactSecrets('{"apiKey": "sk-or-v1-zzzzzzzzzzzz", "apiKeyEnv": "OPENROUTER_API_KEY", "model": "x"}')
  assert.ok(json.includes('"apiKey": "[REDACTED]"'), json)
  assert.ok(json.includes('"apiKeyEnv": "OPENROUTER_API_KEY"'), 'نامِ متغیر باید بماند')
  assert.ok(json.includes('"model": "x"'))
  const yaml = redactSecrets('  apiKey: hunter2' + NL + '  apiKeyEnv: OPENROUTER_API_KEY' + NL + '  token: abcdefgh')
  assert.ok(yaml.includes('apiKey: [REDACTED]'), yaml)
  assert.ok(yaml.includes('apiKeyEnv: OPENROUTER_API_KEY'), yaml)
  assert.ok(yaml.includes('token: [REDACTED]'), yaml)
  assert.ok(!yaml.includes('hunter2'))
  assert.ok(redactInline('key sk-or-v1-abcdefghij').includes('[REDACTED]'))
})

/* ------------------------------------------------------------------ ردیف‌ها و ⚠ */

test('median: زوج و فرد و خالی', () => {
  assert.equal(median([3, 1, 2]), 2)
  assert.equal(median([4, 1, 3, 2]), 2.5)
  assert.equal(median([]), null)
})

test('⚠: بیش از ۳ برابرِ میانهٔ همان نوع، یا بالای ۲۰ هزار', () => {
  const rows = [
    { type: 'a', bytes: 100 }, { type: 'a', bytes: 100 }, { type: 'a', bytes: 100 },
    { type: 'a', bytes: 301 },
    { type: 'a', bytes: 330 },
    { type: 'b', bytes: 50 }, { type: 'b', bytes: 50 }, { type: 'b', bytes: 900 },
    { type: 'c', bytes: 25000 },
    { type: 'd', bytes: 19999 },
  ]
  const { flagged } = markUnusual(rows)
  // ۳۰۱ دقیقاً ۳٫۰۱× است ⇒ بله؛ ۳۰۰ دقیقاً ۳× ⇒ نه. هر جا مرز پادره، > ۳× ملاک است.
  assert.deepEqual(flagged, [false, false, false, true, true, false, false, true, true, false])
})

test('⚠: نوعی با کمتر از ۳ ردیف میانه ندارد، پس فقط سقفِ ثابت', () => {
  const rows = [{ type: 'x', bytes: 10 }, { type: 'x', bytes: 1000 }]
  const { flagged } = markUnusual(rows)
  assert.deepEqual(flagged, [false, false])
  assert.equal(BIG_BYTES, 20000)
})

test('فهرستِ ردیف‌ها: seq | زمان | نوع | حجم + ⚠', () => {
  const rows = parseLogRows([
    line(0, 'turn/start', T0, { turn: 1 }),
    line(1, 'tool/result', T0 + 1000, { message: {} }, 25000),
  ])
  const index = buildRowIndex(rows)
  const lines = index.text.split(NL)
  assert.match(lines[0], /^\s+0 \| ۰۷:۰۰:۰۰ \| turn\/start \| /)
  assert.match(lines[1], /^⚠ 1 \| ۰۷:۰۰:۰۱ \| tool\/result \| /)
  assert.deepEqual(index.flaggedSeqs, [1])
})

test('خطِ خرابِ JSON هم ردیف است (نامعلوم) و چیزی از دست نمی‌رود', () => {
  const rows = parseLogRows(['{"seq":0,"type":"turn/start","time":1,"data":{}}', '{not json'])
  assert.equal(rows.length, 2)
  assert.equal(rows[1].type, 'نامعلوم')
  assert.equal(rows[1].seq, null)
})

/* ------------------------------------------------------------------ متنِ چت: بی‌بریدگی */

test('متنِ چت: پیامِ بلند کامل می‌آید، شمارهٔ رخداد می‌ماند', () => {
  const long = 'الف'.repeat(5000)
  const rows = parseLogRows([
    line(0, 'user/message', T0, { message: { role: 'user', content: [{ type: 'text', text: long }] } }),
    line(1, 'assistant/message', T0 + 1, { message: { role: 'assistant', content: [{ type: 'text', text: 'جوابِ کوتاه' }] } }),
  ])
  const { text } = renderTranscript(rows)
  assert.ok(text.includes(long), 'پیامِ ۵۰۰۰ نویسه‌ای نباید بریده شود')
  assert.ok(text.includes('[0] ۰۷:۰۰:۰۰ · user/message'))
  assert.ok(text.includes('[1] ۰۷:۰۰:۰۰ · assistant/message'))
  assert.ok(text.includes('جوابِ کوتاه'))
})

test('متنِ چت: خروجیِ ابزار هم کامل است', () => {
  const big = 'y'.repeat(40000)
  const rows = parseLogRows([line(3, 'tool/result', T0, { message: { role: 'tool', content: [{ type: 'text', text: big }] } })])
  const { text } = renderTranscript(rows)
  assert.ok(text.includes(big))
})

test('متنِ چت: فقط امضای رمزشده کوتاه می‌شود', () => {
  const signature = 'A'.repeat(400)
  const rows = parseLogRows([JSON.stringify({
    type: 'assistant/message', seq: 5, time: T0,
    data: {
      message: {
        role: 'assistant',
        content: [{ type: 'text', text: 'متنِ واقعی' }, { type: 'reasoning', text: 'فکر' }],
        source: { replayState: { blocks: [{ type: 'reasoning', thinkingSignature: signature }] } },
      },
    },
  })])
  const { text } = renderTranscript(rows)
  assert.ok(text.includes('متنِ واقعی'))
  assert.ok(text.includes('فکر'))
  assert.ok(text.includes('بایت]'), text.slice(0, 400))
  assert.ok(text.includes('بازپخش:'), 'replayState must surface as a placeholder')
  assert.ok(!text.includes(signature), 'امضا باید جایگزین شود')
})

test('متنِ چت: جریانِ خامِ توکن‌ها فقط شمارش می‌شود', () => {
  const chunks = Array.from({ length: 500 }, (_, i) => ({ type: 'chunk', time: i, chunk: { type: 'text' } }))
  const rows = parseLogRows([JSON.stringify({ type: 'assistant/message', seq: 2, time: T0, data: { message: { role: 'assistant', content: [] }, stream: chunks } })])
  const { text } = renderTranscript(rows)
  // نشانهٔ ASCII/عددِ مستقل از اعراب، تا آزمون به املا گره نخورد.
  assert.ok(text.includes('تکه —'), text.slice(0, 200))
  assert.ok(/[S+ ?S* ?[۰-۹]+ تکه/.test(text), text.slice(0, 200))
  assert.ok(text.length < 1000, 'جریان نباید کلِ حجم را بیاورد')
})

/* ------------------------------------------------------------------ حدِ زمینه */

test('بریدن: هیچ‌چیز اگر جا هست', () => {
  const parts = ['a', 'b', 'c']
  const result = trimOldest(parts, 1000)
  assert.equal(result.dropped, 0)
  assert.equal(result.text, 'a' + NL + NL + 'b' + NL + NL + 'c')
})

test('بریدن: قدیمی‌ترین‌ها می‌افتند و شمارش برمی‌گردد', () => {
  // هر بخش ۴۰ توکن (+۱ برای جداکننده) ⇒ با سقفِ ۹۰ فقط دو ردیفِ آخر جا می‌شوند.
  const parts = ['x'.repeat(100), 'y'.repeat(100), 'z'.repeat(100)]
  const result = trimOldest(parts, 90)
  assert.deepEqual(result.kept, [1, 2])
  assert.equal(result.dropped, 1)
  assert.equal(result.text, parts[1] + NL + NL + parts[2])
  assert.equal(estimateTokens(parts[0]), 40)
  const tighter = trimOldest(parts, 40)
  assert.deepEqual(tighter.kept, [2])
  assert.equal(tighter.dropped, 2)
})

test('بریدن: در ورودیِ کامل، شمارشِ ناخوانده صریح گفته می‌شود', () => {
  const rows = []
  for (let i = 0; i < 30; i += 1) {
    rows.push(...parseLogRows([line(i, 'user/message', T0 + i, { message: { role: 'user', content: [{ type: 'text', text: 'ب'.repeat(4000) }] } })]))
  }
  const input = buildAdvisorInput({
    settingsText: 'تنظیمات', rows, play: false, chatCost: {},
    overheadTokens: 1000, contextLimit: 60000,
  })
  assert.ok(input.dropped > 0, 'با این حجم باید چیزی بیفتد')
  assert.ok(input.text.includes(unreadNote(input.dropped, input.firstKeptSeq)))
  assert.ok(input.text.includes('ردیفِ اولِ این چت خوانده نشد'))
  assert.ok(input.text.includes('ردیف‌های خوانده‌شده از شمارهٔ'))
})

test('حدِ زمینه: اگر جا هست، هیچ ردیفی نمی‌افتد', () => {
  const rows = parseLogRows([line(0, 'user/message', T0, { message: { role: 'user', content: [{ type: 'text', text: 'سلام' }] } })])
  const input = buildAdvisorInput({ settingsText: 's', rows, play: false, chatCost: {}, overheadTokens: 500, contextLimit: 1048576 })
  assert.equal(input.dropped, 0)
  assert.equal(input.note, '')
})

/* ------------------------------------------------------------------ کش: پیشوندِ ثابت */

test('کش: دو اجرای پیاپی، چت فقط بزرگ‌تر ⇒ پیشوند کاملاً یکی', () => {
  const base = [
    line(0, 'user/message', T0, { message: { role: 'user', content: [{ type: 'text', text: 'اول' }] } }),
    line(1, 'assistant/message', T0 + 1, { message: { role: 'assistant', content: [{ type: 'text', text: 'دوم' }] } }),
    line(2, 'turn/end', T0 + 2, { turn: 1, reason: { kind: 'completed' } }),
  ]
  const grown = base.concat([
    line(3, 'user/message', T0 + 10, { message: { role: 'user', content: [{ type: 'text', text: 'سوم' }] } }),
    line(4, 'assistant/message', T0 + 11, { message: { role: 'assistant', content: [{ type: 'text', text: 'چهارم' }] } }),
    line(5, 'turn/end', T0 + 12, { turn: 2, reason: { kind: 'completed' } }),
  ])
  const first = buildAdvisorInput({
    settingsText: 'S', rows: parseLogRows(base), play: true,
    chatCost: { chatTotal: 0.1, chatPriced: 1, advisorTotal: 0.001, advisorRuns: 1 },
    overheadTokens: 500, contextLimit: 1048576,
  })
  const second = buildAdvisorInput({
    settingsText: 'S', rows: parseLogRows(grown), play: true,
    chatCost: { chatTotal: 0.2, chatPriced: 2, advisorTotal: 0.002, advisorRuns: 2 },
    overheadTokens: 500, contextLimit: 1048576,
  })
  assert.ok(second.prefix.startsWith(first.prefix), 'پیشوندِ کش باید بیت‌به‌بیت یکی بماند')
  assert.ok(second.text.indexOf('جدولِ ردیف‌های لاگ') > second.text.indexOf('چهارم'))
  assert.ok(second.text.indexOf('خرجِ تجمیعیِ همین چت') > second.text.indexOf('چهارم'))
})

test('کش: ورودیِ دُم بعد از کلِ چت می‌آید و خرج را دارد', () => {
  const rows = parseLogRows([line(0, 'user/message', T0, { message: { role: 'user', content: [{ type: 'text', text: 'متنِ چتِ من' }] } })])
  const input = buildAdvisorInput({ settingsText: 'S', rows, play: false, chatCost: { chatTotal: 1.5, chatPriced: 3, advisorTotal: 0.01, advisorRuns: 4 }, overheadTokens: 500, contextLimit: 1048576 })
  assert.ok(input.tail.includes('جدولِ ردیف‌های لاگ'))
  assert.ok(input.tail.includes('۴ بار اجرا'))
  assert.ok(input.tail.includes('۱٫۵۰'))
})

/* ------------------------------------------------------------------ سهمیه/تکرار */

test('سهمیه: ۶ در ساعت و ۳۰ در روز', () => {
  const now = T0
  const runs = Array.from({ length: QUOTA_PER_HOUR }, () => now - 60000)
  const q = quotaState(runs, now)
  assert.equal(q.hour, QUOTA_PER_HOUR)
  assert.equal(q.blocked, true)
  assert.match(q.reason, /سقفِ ۶ اجرا در ساعت پر شد/)
  // ۳۰ اجرا در ۲۴ ساعتِ گذشته (فاصلهٔ ۳۰ دقیقه) ⇒ سهمیهٔ روزانه پر.
  const many = Array.from({ length: QUOTA_PER_DAY }, (_, i) => now - (i + 1) * 30 * 60 * 1000)
  const q2 = quotaState(many, now)
  assert.equal(q2.blocked, true)
  assert.match(q2.reason, /سقفِ ۳۰ اجرا در روز پر شد/)
})

test('سهمیه: پیامِ سقف می‌گوید «چرا» و «کی دوباره» (ساعتِ تهران، ساعتِ بازشدنِ قدیمی‌ترین اجرا)', () => {
  const now = T0
  // شش اجرا در ۲۰ دقیقهٔ گذشته — همان چیدمانِ واقعیِ ۱۵ نوامبر (۱۵:۴۶ تا ۱۶:۰۶).
  const runs = [18, 16, 13, 10, 8, 7].map((min) => now - min * 60000)
  const q = quotaState(runs, now)
  assert.equal(q.blocked, true)
  // قدیمی‌ترین (۱۸ دقیقه پیش) ۴۲ دقیقهٔ دیگر از پنجرهٔ ساعت بیرون می‌افتد ⇒ همان لحظه جا باز می‌شود.
  assert.equal(q.retryAt, now - 18 * 60000 + 3600 * 1000)
  assert.ok(q.resetInMs > 41 * 60000 && q.resetInMs < 43 * 60000)
  const clock = new Intl.DateTimeFormat('fa-IR', { timeZone: 'Asia/Tehran', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(q.retryAt))
  assert.ok(q.reason.includes('ساعتِ ' + clock), 'علت باید ساعتِ دقیقِ بازشدن را داشته باشد: ' + q.reason)
  assert.ok(q.reason.includes('۴۲ دقیقهٔ دیگر'), q.reason)
  assert.equal(q.blockedUntil, q.retryAt)
})

test('سهمیه: پیامِ سقف عددِ لاتین ندارد و ساعتِ گذشته را نمی‌گوید', () => {
  const now = T0
  // شش اجرا از ۵۹ تا ۹ دقیقهٔ پیش ⇒ پنجره پر است و قدیمی‌ترین (۵۹ دقیقه پیش) یک دقیقهٔ دیگر آزاد می‌شود.
  const q = quotaState(Array.from({ length: QUOTA_PER_HOUR }, (_, i) => now - (59 - i * 10) * 60 * 1000), now)
  assert.equal(q.blocked, true)
  assert.doesNotMatch(q.reason, /[0-9]/)
  // قدیمی‌ترین (۶۰ دقیقه پیش) در ثانیهٔ بعد آزاد می‌شود ⇒ «۱ دقیقهٔ دیگر»، نه «۱ ساعتِ دیگر» و نه ساعتِ گذشته.
  assert.ok(q.resetInMs > 0 && q.resetInMs <= 60 * 1000, 'باید زیرِ یک دقیقه باشد: ' + q.resetInMs)
  assert.ok(q.reason.includes('۱ دقیقهٔ دیگر'), q.reason)
  assert.equal(quotaState([], now).retryAt, null)
})

test('سهمیه: خالی ⇒ آزاد', () => {
  const q = quotaState([], T0)
  assert.equal(q.blocked, false)
  assert.equal(q.hour, 0)
})

test('ترکیبِ تریگر: پلی خاموش / در جریان / تکراری / سهمیه', () => {
  assert.equal(shouldRunOnTurnEnd({ play: false, running: false, turnSeq: 7, lastKey: null, runs: [], now: T0 }).run, false)
  assert.equal(shouldRunOnTurnEnd({ play: true, running: true, turnSeq: 7, lastKey: null, runs: [], now: T0 }).run, false)
  assert.equal(shouldRunOnTurnEnd({ play: true, running: false, sessionId: 's', turnSeq: 7, lastKey: dedupeKey('s', 7), runs: [], now: T0 }).run, false)
  assert.equal(shouldRunOnTurnEnd({ play: true, running: false, sessionId: 's', turnSeq: 7, lastKey: dedupeKey('s', 6), runs: [], now: T0 }).run, true)
  assert.equal(shouldRunOnTurnEnd({ play: true, running: false, turnSeq: 9, lastKey: dedupeKey('s', 8), runs: new Array(QUOTA_PER_HOUR).fill(T0 - 1000), now: T0 }).run, false)
})

test('ترکیبِ تریگر: نوبتی که کلید ندارد ⇒ اجرا نه', () => {
  assert.equal(shouldRunOnTurnEnd({ play: true, running: false, turnSeq: null, lastKey: null, runs: [], now: T0 }).run, false)
})

test('آخرین turn/end و کلیدِ تکرار', () => {
  const rows = parseLogRows([
    line(0, 'turn/end', T0, { turn: 1 }),
    line(1, 'turn/start', T0, { turn: 2 }),
    line(2, 'turn/end', T0, { turn: 2 }),
  ])
  assert.equal(lastTurnEndSeq(rows), 2)
  assert.equal(dedupeKey('sess', 2), 'sess:2')
  assert.equal(DEBOUNCE_MS, 45000)
})

/* ------------------------------------------------------------------ نمایش */

test('سرصفحه: یک خط، حداکثر ۸۰ نویسه', () => {
  assert.equal(headline('۲ ردیفِ پرحجم، ۱ تنظیمِ بهتر'), '۲ ردیفِ پرحجم، ۱ تنظیمِ بهتر')
  const long = 'ظ'.repeat(200)
  assert.equal(headline(long).length, 80)
  assert.equal(headline(undefined, ''), 'تغییری لازم نیست')
  assert.equal(headline('خطِ اول' + NL + 'خطِ دوم'), 'خطِ اول خطِ دوم')
})

test('رقم و حجمِ فارسی', () => {
  assert.equal(faInt(12345), '۱۲٬۳۴۵')
  assert.equal(faBytes(500), '۵۰۰ بایت')
  assert.equal(faBytes(2500), '۳ KB')
})
