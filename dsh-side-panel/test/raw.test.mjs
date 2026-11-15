/**
 * آزمونِ توابعِ خالصِ «دادهٔ خام» (raw-log.js): شکستنِ خط، فیلتر، صفحه‌بندی و فیلدها.
 * این‌ها فقط متنِ لاگ را تکه می‌کنند؛ هیچ خطی دست نمی‌خورد.
 */
import assert from 'node:assert/strict'
import { splitLogLines, sliceRawLines, extractFields, DEFAULT_LIMIT, MAX_LIMIT } from '../raw-log.js'

const ev = (type, seq, time, extra = {}) => JSON.stringify({ type, seq, time, ...extra })
const LINES = [
  ev('session', undefined, undefined, { id: 'abc' }).replace(',"seq":undefined,"time":undefined', ''),
  ev('turn/start', 0, 1000),
  ev('user/message', 1, 1001, { data: { text: 'سلام حبیب' } }),
  'نیمه‌خط خراب {',
  ev('assistant/message', 3, 1003),
  ev('turn/end', 4, 1004),
]

// ۱) شکستنِ متن: خطِ خالیِ ته/وسط می‌رود، خطِ خالیِ وسط می‌ماند، متن دست نمی‌خورد
assert.deepEqual(splitLogLines('a\nb\n'), ['a', 'b'])
assert.deepEqual(splitLogLines('a\n\nb'), ['a', '', 'b'], 'middle empty line stays (index must not shift)')
assert.deepEqual(splitLogLines(''), [])
assert.deepEqual(splitLogLines(null), [])
assert.deepEqual(splitLogLines('یک\n'), ['یک'])

// ۲) فیلدها از خودِ JSON
assert.deepEqual(extractFields(LINES[1]), { seq: 0, time: 1000, type: 'turn/start' })
assert.deepEqual(extractFields('{خراب'), { seq: undefined, time: undefined, type: undefined })
assert.deepEqual(extractFields(null), { seq: undefined, time: undefined, type: undefined })
assert.deepEqual(extractFields('[1,2]'), { seq: undefined, time: undefined, type: undefined })

// ۳) صفحهٔ اول: پیش‌فرض ۵۰ خط، index = شمارهٔ خطِ کلِ فایل، text عیناً
const all = sliceRawLines(LINES)
assert.equal(all.totalAll, 6)
assert.equal(all.total, 6)
assert.equal(all.from, 0)
assert.equal(all.limit, DEFAULT_LIMIT)
assert.equal(all.lines.length, 6)
assert.equal(all.lines[2].text, LINES[2], 'raw line untouched')
assert.equal(all.lines[2].index, 2)
assert.equal(all.lines[2].type, 'user/message')
assert.equal(all.lines[2].seq, 1)
assert.equal(all.lines[2].time, 1001)
assert.equal(all.lines[2].bytes, Buffer.byteLength(LINES[2], 'utf8'))
assert.ok(all.lines[2].text.includes('سلام حبیب'), 'Persian text kept verbatim')

// ۴) خطِ خراب هم عیناً برمی‌گردد، فقط بی seq/time/type
const broken = all.lines[3]
assert.equal(broken.text, 'نیمه‌خط خراب {')
assert.equal(broken.seq, undefined)
assert.equal(broken.index, 3)

// ۵) صفحه‌بندی
const page = sliceRawLines(LINES, { from: 2, limit: 2 })
assert.equal(page.lines.length, 2)
assert.deepEqual(page.lines.map(l => l.index), [2, 3])
assert.equal(page.from, 2)
const beyond = sliceRawLines(LINES, { from: 99, limit: 2 })
assert.equal(beyond.lines.length, 0, 'past the end ⇒ empty page, no crash')
assert.equal(beyond.total, 6)

// ۶) سقف‌ها: limit صفر/منفی/بزرگ/زباله
assert.equal(sliceRawLines(LINES, { limit: 0 }).limit, 1)
assert.equal(sliceRawLines(LINES, { limit: -5 }).limit, 1)
assert.equal(sliceRawLines(LINES, { limit: 100000 }).limit, MAX_LIMIT)
assert.equal(sliceRawLines(LINES, { limit: 'zzz' }).limit, DEFAULT_LIMIT)
assert.equal(sliceRawLines(LINES, { limit: '3' }).limit, 3, 'numeric string from the URL works')
assert.equal(sliceRawLines(LINES, { limit: 3.9 }).limit, 3)
assert.equal(sliceRawLines(LINES, { from: -3 }).from, 0)
assert.equal(sliceRawLines(LINES, { from: 'x' }).from, 0)
assert.equal(sliceRawLines(null).totalAll, 0, 'no lines ⇒ empty answer')

// ۷) جست‌وجو: بی‌توجه به بزرگی/کوچکیِ حروف، روی متنِ خامِ خط، بعد صفحه‌بندی
const found = sliceRawLines(LINES, { q: 'ASSISTANT' })
assert.equal(found.total, 1)
assert.equal(found.lines[0].index, 4)
assert.equal(found.totalAll, 6, 'totalAll is always the whole file')
assert.equal(sliceRawLines(LINES, { q: 'حبیب' }).lines[0].index, 2, 'Persian search works')
assert.equal(sliceRawLines(LINES, { q: '  turn/start  ' }).total, 1, 'trimmed')
assert.equal(sliceRawLines(LINES, { q: 'هیچ‌جا نیست' }).total, 0)
// فیلتر و صفحه با هم: از خطِ دومِ نتیجه‌ها
const pageFiltered = sliceRawLines(LINES, { q: 'turn', from: 1, limit: 1 })
assert.deepEqual(pageFiltered.lines.map(l => l.index), [5], 'from counts the filtered list, index stays the file line')
assert.equal(pageFiltered.total, 2)
// فیلتری که همه را می‌گیرد (کلیدواژهٔ مشترک JSON)
assert.equal(sliceRawLines(LINES, { q: '"type"' }).total, 5, 'the broken line has no "type"')

console.log('raw OK: شکستنِ خط + فیلدها + فیلتر + صفحه‌بندی + سقفِ limit')
