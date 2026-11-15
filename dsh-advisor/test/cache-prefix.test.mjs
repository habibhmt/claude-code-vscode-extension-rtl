/**
 * کشِ پیشوندی: نقطهٔ برشِ چتِ بزرگ باید به‌اندازهٔ بلوک جابه‌جا شود، نه ردیف‌به‌ردیف.
 * ---------------------------------------------------------------------------------
 * صورتِ مسئله (حبیب، ۱۵ نوامبر): چتِ ~۹۵۰ هزار توکنی هر اجرا کلِ پرامپت را تازه می‌فرستاد
 * و فقط ۱٫۸–۲٫۸ هزار توکن کش می‌خورد. کشِ پیشوندیِ دیپ‌اینفرا (و هر ارائه‌دهندهٔ دیگر)
 * فقط وقتی می‌خورد که «اولِ» پرامپت بیت‌به‌بیت با اجرای قبلی یکی باشد.
 *
 * این فایل همان سه شرط را می‌سنجد:
 *   (الف) تا وقتی بلوکِ تازه‌ای نمی‌افتد، پیشوندِ قبلی پیشوندِ جدید است (کش می‌خورد).
 *   (ب) وقتی رشد، بلوکِ تازه را لازم می‌کند، برش یک‌دفعه ~${0} ردیف جلو می‌رود.
 *   (ج) یادداشتِ «چند ردیف خوانده نشد» در دُم است، نه پیشوند.
 *   (د) ردیف‌هایی که می‌مانند در «جا» جا می‌شوند.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseLogRows } from '../advisor-pure.js'
import {
  DROP_BLOCK_ROWS, buildAdvisorInput, minimalDrop, roundUpToBlock,
  TRANSCRIPT_CLOSE, TRANSCRIPT_OPEN, unreadNote,
} from '../advisor-input.js'

const T0 = Date.UTC(2026, 10, 15, 3, 30, 0)
const NOTE_MARK = 'ردیفِ اولِ این چت خوانده نشد'
const OVERHEAD = 5000
const LIMIT = 500000

/** یک خطِ لاگِ مصنوعی (بدونِ شبکه، بدونِ کلید). */
function line(seq, type, time, data) {
  return JSON.stringify({ type, seq, time, data })
}

/** چند ردیفِ متنی؛ هر ردیف ~۳۲۰ توکن تخمینی (۸۰۰ نویسه ÷ ۲٫۵). */
function rows(count, from = 0, pad = 800) {
  const out = []
  for (let i = from; i < count; i += 1) {
    out.push(...parseLogRows([line(i, 'user/message', T0 + i, { message: { role: 'user', content: [{ type: 'text', text: 'س'.repeat(pad) }] } })]))
  }
  return out
}

function build(list) {
  return buildAdvisorInput({
    settingsText: 'S', rows: list, play: false, chatCost: {}, overheadTokens: OVERHEAD, contextLimit: LIMIT,
  })
}

test('بلوک: عددِ برش به بالا روی مضربِ ۵۰۰ می‌رود', () => {
  assert.equal(DROP_BLOCK_ROWS, 500)
  assert.equal(roundUpToBlock(0), 0)
  assert.equal(roundUpToBlock(1), 500)
  assert.equal(roundUpToBlock(499), 500)
  assert.equal(roundUpToBlock(500), 500)
  assert.equal(roundUpToBlock(501), 1000)
  assert.equal(roundUpToBlock(-3), 0)
  // کمترین برش هم همان پیمایشِ قدیمی است (فقط برای شمردن)
  assert.equal(minimalDrop([10, 10, 10], 100), 0)
  assert.equal(minimalDrop([10, 10, 10], 25), 1)
  assert.equal(minimalDrop([10, 10, 10], 10), 2)
})

test('(الف) رشدِ کوچک: پیشوندِ قبلی پیشوندِ جدید است (کش می‌خورد)', () => {
  const base = build(rows(3000))
  assert.ok(base.dropped > 0, 'این چت باید از جا بزرگ‌تر باشد')
  assert.equal(base.dropped % DROP_BLOCK_ROWS, 0, 'برش باید مضربِ بلوک باشد')
  for (const extra of [1, 10, 50, 200]) {
    const grown = build(rows(3000 + extra))
    assert.equal(grown.dropped, base.dropped, 'رشدِ کوچک نباید برش را جابه‌جا کند (extra=' + extra + ')')
    assert.ok(grown.prefix.startsWith(base.prefix), 'پیشوندِ کش باید بیت‌به‌بیت یکی بماند (extra=' + extra + ')')
    assert.ok(grown.prefix.length > base.prefix.length, 'فقط آخرِ پیشوند رشد می‌کند')
  }
})

test('(ب) رشدِ بزرگ: برش یک‌دفعه به‌اندازهٔ یک بلوک جلو می‌رود', () => {
  const base = build(rows(3000))
  const grown = build(rows(3400))
  assert.ok(grown.dropped > base.dropped, 'با ۴۰۰ ردیفِ تازه باید یک بلوکِ کامل برود')
  assert.equal(grown.dropped - base.dropped, DROP_BLOCK_ROWS, 'پرش باید دقیقاً یک بلوک باشد')
  assert.equal(grown.firstKeptSeq - base.firstKeptSeq, DROP_BLOCK_ROWS, 'شمارهٔ اولین ردیفِ خوانده‌شده هم یک بلوک جلو می‌رود')
  assert.equal(grown.prefix.startsWith(base.prefix), false, 'وقتی بلوک جابه‌جا شد، کش شکسته است (اجتناب‌ناپذیر)')
})

test('(ج) یادداشتِ ناخوانده در دُم است، نه در پیشوند', () => {
  const input = build(rows(2600))
  assert.ok(input.dropped > 0)
  const note = unreadNote(input.dropped, input.firstKeptSeq)
  assert.ok(note.includes(NOTE_MARK))
  assert.ok(!input.prefix.includes(NOTE_MARK), 'یادداشت نباید در پیشوندِ کش باشد')
  assert.ok(!input.prefix.includes('⚠'), 'هیچ ⚠ِ تازه‌ای اولِ چت نیست')
  const close = input.tail.indexOf(TRANSCRIPT_CLOSE)
  const noteAt = input.tail.indexOf(NOTE_MARK)
  const tableAt = input.tail.indexOf('## جدولِ ردیف‌های لاگ')
  assert.ok(close >= 0 && noteAt > close, 'یادداشت باید بعد از مرزِ بستهٔ چت بیاید')
  assert.ok(tableAt > noteAt, 'و قبل از جدولِ ردیف‌ها')
  assert.ok(input.text.includes(note), 'متنِ کامل باید یادداشت را داشته باشد')
  assert.equal(input.text.split(TRANSCRIPT_OPEN).length, 2)
  assert.equal(input.text.split(TRANSCRIPT_CLOSE).length, 2)
})

test('(ج۲) متنِ یادداشت با رشدِ چت عوض می‌شود ولی پیشوند دست نمی‌خورد', () => {
  const a = build(rows(2600))
  const b = build(rows(2601))
  assert.notEqual(a.note, '', 'این چت باید یادداشت داشته باشد')
  assert.equal(b.prefix.startsWith(a.prefix), true, 'برش ثابت مانده ⇒ پیشوند باید یکی بماند')
  assert.ok(b.tail.includes(b.note))
})

test('(د) ردیف‌های خوانده‌شده در جا جا می‌شوند', () => {
  for (const total of [3000, 3400, 4200]) {
    const input = build(rows(total))
    assert.ok(input.dropped > 0)
    assert.equal(input.keptRows, input.totalRows - input.dropped)
    assert.equal(input.firstKeptSeq, input.dropped, 'شمارهٔ ردیف = شمارهٔ خطِ لاگ در این دادهٔ مصنوعی')
    assert.ok(input.transcriptTokens + input.tailTokens <= LIMIT - OVERHEAD - 16000,
      'دُم + چت باید از جا بگذرد (total=' + total + ')')
  }
})

test('(د۲) کوچک‌تر از بلوک: بی جا ماندن هیچ ردیفی نمی‌افتد؛ با جا ماندن کلِ چت جز آخرین ردیف', () => {
  const tiny = build(rows(100))
  assert.equal(tiny.dropped, 0)
  assert.equal(tiny.note, '')
  // چتِ ۲۰۰ ردیفی که فقط ۱۰ ردیفش جا می‌شود: بلوکِ ۵۰۰ بزرگ‌تر از چت است ⇒ نباید همه بیفتند.
  const tight = buildAdvisorInput({
    settingsText: 'S', rows: rows(200), play: false, chatCost: {}, overheadTokens: OVERHEAD, contextLimit: 40000,
  })
  assert.ok(tight.dropped > 0)
  assert.ok(tight.keptRows >= 1, 'دست‌کم آخرین ردیف باید بماند')
  assert.equal(tight.firstKeptSeq, tight.dropped)
})
