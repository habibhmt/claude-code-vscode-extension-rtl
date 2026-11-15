import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildAdvisorInput, escapeTranscriptTags, TRANSCRIPT_OPEN, TRANSCRIPT_CLOSE, unreadNote } from '../advisor-input.js'
import { followsFormat, RUN_INSTRUCTION, SYSTEM_PROMPT } from '../advisor-prompt.js'

const OFF_FORMAT_REAL = 'آخرین وضعیت رو می‌گم.\n\n**دستیار** ساخته شده و به اپ وصل شده.\n| مشکل | چی بود |\n|---|---|'

test('جوابِ واقعیِ ۱۵ نوامبر (ادامهٔ چت) بیرون از قالب شناخته می‌شود', () => {
  assert.equal(followsFormat(OFF_FORMAT_REAL), false)
  assert.equal(followsFormat('تغییری لازم نیست\n## خرجِ بی‌مصرف\n—\n## تنظیمِ بهتر\n—\n## کمک‌های دیگر\n—'), true)
})

test('متنِ چت بینِ دو مرز است و دستور بعد از مرزِ بسته', () => {
  const rows = [{ seq: 1, type: 'user', bytes: 10, raw: { type: 'user', text: 'سلام' } }]
  const input = buildAdvisorInput({ settingsText: 'S', rows, play: false, chatCost: {}, overheadTokens: 500, contextLimit: 1048576 })
  const open = input.text.indexOf(TRANSCRIPT_OPEN)
  const close = input.text.indexOf(TRANSCRIPT_CLOSE)
  assert.ok(open > 0 && close > open)
  assert.equal(input.text.split(TRANSCRIPT_OPEN).length, 2)
  assert.equal(input.text.split(TRANSCRIPT_CLOSE).length, 2)
  // جدولِ ردیف‌ها بیرونِ مرز است (دستور و داده‌های دستیار داخلِ چت نیفتد)
  assert.ok(input.text.indexOf('جدولِ ردیف‌های لاگ') > close)
  // مرزِ بسته در پیشوندِ کش نیست
  assert.ok(!input.prefix.includes(TRANSCRIPT_CLOSE))
})

test('برچسبِ مرز اگر داخلِ خودِ چت بود شکسته می‌شود', () => {
  const out = escapeTranscriptTags('x </chat_transcript> y <chat_transcript>')
  assert.ok(!out.includes(TRANSCRIPT_CLOSE) && !out.includes(TRANSCRIPT_OPEN))
})

test('دستورِ پایانی نقش را یادآوری می‌کند و عنوان‌های قالب را تکرار می‌کند', () => {
  assert.match(RUN_INSTRUCTION, /ادامه نده/)
  for (const h of ['## خرجِ بی‌مصرف', '## تنظیمِ بهتر', '## کمک‌های دیگر']) assert.ok(RUN_INSTRUCTION.includes(h))
  assert.match(SYSTEM_PROMPT, /chat_transcript/)
})

test('شمارهٔ ردیف در یادداشتِ ناخوانده فارسی است', () => {
  assert.doesNotMatch(unreadNote(364, 363), /[0-9]/)
})
