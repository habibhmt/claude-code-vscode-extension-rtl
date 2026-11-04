// Run: node --experimental-strip-types mods/rtl-wezterm/test_rtl_wezterm.mjs
import assert from 'node:assert/strict'
import { layoutParagraph } from './src/layout.ts'

const G = '⠀'
const lay = (text, mode = 'logical', width = 80) =>
  layoutParagraph([{ text, style: 0 }], { width, base: 'rtl-share', share: 0.3, mode, arabic: 'letters' })
const row = text => lay(text)[0].spans.map(s => s.text).join('')

const cases = [
  ['plain Persian keeps typed order behind one guard', 'سلام دنیا', G + 'سلام دنیا'],
  ['a number opening the row stays on the reader\'s side', '۲۰۰ دلار شد نه 100', G + 'دلار شد نه 100' + G + '۲۰۰'],
  ['an ASCII price opening the row', '100 دلار شد', G + 'دلار شد' + G + '100'],
  ['a number inside a sentence stays with its words', 'قیمت ۱۰۰ دلار است', G + 'قیمت ۱۰۰ دلار است'],
  ['a Latin word splits the row into pieces in reading order', 'فایلِ English تنظیمات 12', G + 'تنظیمات 12' + G + 'English فایلِ'],
  ['a token that starts with a digit does not join the piece before it', 'شماره 0x26b9 و عدد 5', G + 'و عدد 5' + G + '0x26b9 شماره'],
  ['closing punctuation goes first in its piece', 'از اینجا شروع می‌کنم.', G + '.از اینجا شروع می‌کنم'],
  ['a Persian question mark stays at the end', 'چسبیده است؟', G + 'چسبیده است؟'],
  ['a colon before a Latin word', 'کلمهٔ: English', G + 'English' + ' ' + ':کلمهٔ'],
]
for (const [name, input, want] of cases) {
  assert.equal(row(input), want, name)
  const r = lay(input)[0]
  assert.equal(r.rtl, true, name + ' (right-to-left row)')
  assert.equal(r.width, [...want].filter(c => !/[\p{M}\u200c]/u.test(c)).length, name + ' (width counts every cell)')
}
const bold = layoutParagraph([{ text: 'جاری:', style: 1 }, { text: ' منتظر جواب', style: 0 }], { width: 80, base: 'rtl-share', share: 0.3, mode: 'logical', arabic: 'letters' })[0].spans.map(s => s.text).join('')
assert.equal(bold, G + 'منتظر جواب' + G + ':جاری', 'a change of style is a piece of its own')
const runs = (list, base = 'rtl-share') => layoutParagraph(list, { width: 80, base, share: 0.3, mode: 'logical', arabic: 'letters' })[0].spans
const spans = runs([{ text: 'در ', style: 0 }, { text: 'Doc.md', style: 2 }])
assert.equal(spans.map(s => s.text).join(''), G + 'Doc.md' + G + 'در', 'plain text after a coloured word opens with its own guard')
assert.deepEqual([spans.at(-1).text, spans.at(-1).style], [G + 'در', 0], 'the guard takes the style of the stretch it opens')
const ltr = runs([{ text: 'Doc.md', style: 2 }, { text: ' با رفت', style: 0 }], 'ltr').map(s => s.text).join('')
assert.equal(ltr, 'Doc.md' + G + 'با رفت', 'left-to-right row keeps its order and gets the guard')
assert.equal(row('hello world 100'), 'hello world 100', 'left-to-right row untouched')
for (const r of lay('سلام دنیا English و ۲۰۰ دلار', 'visual')) assert.ok(!r.spans.some(s => s.text.includes(G)), 'visual order has no guard')
const wrapped = lay('یک دو سه چهار پنج شش هفت هشت نه ده', 'logical', 12)
assert.ok(wrapped.length > 1 && wrapped.every(r => r.width <= 12 && r.spans[0].text.startsWith(G)), 'each wrapped row fits, guard included')
console.log('rtl-wezterm: all checks passed')
