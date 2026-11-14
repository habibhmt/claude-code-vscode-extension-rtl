/** آزمونِ توابعِ خالصِ ابزارهای اکستنشن (node --test dsh-rtl/test). */
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_COMMANDS, PLUS_DEFAULTS, clampNumber, safeHex, normalizeCommand, normalizeCommands, normalizeExtras,
  readPlus, commandsOf, applyPreset, profileSnapshot, loadProfile, lineInsertion, quoteBlock, withExtras,
  findRanges, nearBottom, shouldRestoreScroll, faDigits, counterLabel, sessionIdentity, titleFromDocument,
  exportSettings, importSettings, plusCss, isLatinWithDigits, hasNoLetters, isLatinText,
} from '../plus-pure.js'

test('فهرستِ پیش‌فرض: دکمه‌های فارسیِ حبیب هست، فرمان‌های فقط-کلود نیست', () => {
  const labels = DEFAULT_COMMANDS.map(c => c.label)
  for (const l of ['ناظر', 'اسک', 'داستان', 'اعتماد', 'جدول', 'ساده', 'بزن', 'comp']) assert.ok(labels.includes(l), l)
  for (const t of ['/usage', '/context', '/hads on', '/remote-control', '/fast']) assert.ok(!DEFAULT_COMMANDS.some(c => c.text === t), t)
  assert.equal(DEFAULT_COMMANDS.find(c => c.label === 'بزن').send, true)
  assert.equal(DEFAULT_COMMANDS.find(c => c.label === 'ناظر').send, false)
})

test('clampNumber و safeHex', () => {
  assert.equal(clampNumber(50, 0, 10, 3), 10)
  assert.equal(clampNumber('x', 0, 10, 3), 3)
  assert.equal(clampNumber('7', 0, 10, 3), 7)
  assert.equal(safeHex('#abc'), '#abc')
  assert.equal(safeHex('#a1b2c3'), '#a1b2c3')
  assert.equal(safeHex('red;}body{x'), '')
  assert.equal(safeHex('#abcd'), '')
})

test('دکمه: بی‌نام یا بی‌متن رد می‌شود؛ send فقط true ِ واقعی', () => {
  assert.equal(normalizeCommand({ label: ' ', text: 'x' }), null)
  assert.equal(normalizeCommand({ label: 'a', text: '  ' }), null)
  assert.deepEqual(normalizeCommand({ label: ' a ', text: 'hi', send: 'yes' }), { label: 'a', text: 'hi', send: false })
  assert.deepEqual(normalizeCommands([]), DEFAULT_COMMANDS)
  assert.deepEqual(normalizeCommands('bad'), DEFAULT_COMMANDS)
  assert.deepEqual(normalizeCommands([{ label: 'x', text: 'y', send: true }, null]), [{ label: 'x', text: 'y', send: true }])
  // کپی است، نه همان شیء
  const copy = normalizeCommands(null); copy[0].label = 'zzz'
  assert.notEqual(DEFAULT_COMMANDS[0].label, 'zzz')
})

test('readPlus: پیش‌فرض، بازه، رنگِ ناامن، JSON ِ خراب', () => {
  assert.deepEqual(readPlus(null), { ...PLUS_DEFAULTS, commands: null, extras: [], profiles: {} })
  assert.equal(readPlus('{not json').lines, PLUS_DEFAULTS.lines)
  const s = readPlus({ lines: 99, btnSize: 1, place: 'nowhere', accent: 'url(x)', noJump: 0, quoteMenu: false })
  assert.equal(s.lines, 12)
  assert.equal(s.btnSize, 8)
  assert.equal(s.place, 'dock')
  assert.equal(s.accent, '')
  assert.equal(s.noJump, true) // فقط false ِ صریح خاموش می‌کند
  assert.equal(s.quoteMenu, false)
  assert.equal(readPlus({ lines: 0 }).lines, 0) // صفر یعنی کامل، نه «خالی»
})

test('commandsOf / applyPreset / پروفایل', () => {
  assert.equal(commandsOf(readPlus({})), DEFAULT_COMMANDS)
  assert.deepEqual(commandsOf(readPlus({ commands: [{ label: 'q', text: 'w' }] })), [{ label: 'q', text: 'w', send: false }])
  const big = applyPreset(readPlus({}), 'large')
  assert.equal(big.lines, 3); assert.equal(big.btnSize, 13)
  assert.equal(applyPreset(readPlus({ lines: 5 }), 'nope').lines, 5)
  const s = readPlus({ lines: 4, profiles: {} })
  const snap = profileSnapshot(s)
  assert.equal('profiles' in snap, false)
  const withP = readPlus({ lines: 1, profiles: { کار: snap } })
  const loaded = loadProfile(withP, 'کار')
  assert.equal(loaded.lines, 4)
  assert.ok(loaded.profiles.کار, 'فهرستِ پروفایل‌ها گم نشود')
  assert.equal(loadProfile(withP, 'نیست').lines, 1)
})

test('lineInsertion: جملهٔ دکمه روی خطِ خودش', () => {
  assert.equal(lineInsertion('', 'سلام'), 'سلام')
  assert.equal(lineInsertion('   ', 'سلام'), 'سلام')
  assert.equal(lineInsertion('متن', 'سلام'), '\nسلام')
  assert.equal(lineInsertion('متن\n', 'سلام'), 'سلام')
})

test('quoteBlock و withExtras', () => {
  assert.equal(quoteBlock('a\r\nb'), '> a\n> b')
  const extras = [
    { text: 'اول', on: true, pos: 'start' },
    { text: 'آخر', on: true, pos: 'end', btn: true },
    { text: 'خاموش', on: false, pos: 'end', btn: true },
  ]
  assert.equal(withExtras('متن', extras, 'menu'), 'اول\n\nمتن\n\nآخر')
  assert.equal(withExtras('متن', extras, 'btn'), 'متن\n\nآخر')
  assert.equal(withExtras('متن', [], 'menu'), 'متن')
  assert.deepEqual(normalizeExtras([{ text: ' ' }, 5, { text: 'x', pos: 'mid' }]), [{ text: 'x', on: true, pos: 'end', btn: false }])
})

test('findRanges: بی‌حساسیت، بی‌هم‌پوشانی، فارسی', () => {
  assert.deepEqual(findRanges('Foo foo FOO', 'foo'), [[0, 3], [4, 7], [8, 11]])
  assert.deepEqual(findRanges('aaaa', 'aa'), [[0, 2], [2, 4]])
  assert.deepEqual(findRanges('سلام دنیا سلام', 'سلام'), [[0, 4], [10, 14]])
  assert.deepEqual(findRanges('abc', ''), [])
  assert.deepEqual(findRanges(null, 'a'), [])
})

test('nearBottom و نگهبانِ «پایین نپر»', () => {
  assert.equal(nearBottom(900, 1000, 100), true)
  assert.equal(nearBottom(500, 1000, 100), false)
  const base = { savedTop: 300, now: 1000, until: 3000, userActed: false }
  assert.equal(shouldRestoreScroll({ ...base, top: 900 }), true)
  assert.equal(shouldRestoreScroll({ ...base, top: 302 }), false)
  assert.equal(shouldRestoreScroll({ ...base, top: 900, userActed: true }), false)
  assert.equal(shouldRestoreScroll({ ...base, top: 900, now: 4000 }), false)
  assert.equal(shouldRestoreScroll({ ...base, savedTop: null, top: 900 }), false)
})

test('شمارنده، رقم فارسی، شناسهٔ چت، عنوان', () => {
  assert.equal(faDigits(1205), '۱۲۰۵')
  assert.equal(counterLabel('سلام 😀'), '۶ نویسه')
  assert.equal(counterLabel(undefined), '۰ نویسه')
  assert.match(sessionIdentity('مجری-۱۳۶', 'session-abc'), /targetSessionId: "session-abc".*مجری-۱۳۶/)
  assert.match(sessionIdentity('x', ''), /معلوم نیست/)
  assert.equal(titleFromDocument('رفع هزینه — DeepSeek Harness'), 'رفع هزینه')
  assert.equal(titleFromDocument('رفع هزینه — DSH Local Build'), 'رفع هزینه')
})

test('خروجی/ورودیِ تنظیمات', () => {
  const s = readPlus({ lines: 3 })
  const back = importSettings(exportSettings(s))
  assert.equal(back.ok, true); assert.equal(back.settings.lines, 3)
  assert.equal(importSettings('{').ok, false)
  assert.equal(importSettings('[1]').ok, false)
})

test('plusCss: هر گزینه قاعدهٔ خودش را دارد', () => {
  const d = plusCss({})
  assert.match(d, /--dsh-plus-btn-size:11px/)
  assert.match(d, /\[data-message-bubble\]:not\(\[data-dsh-plus-open\]\)\{max-height:calc\(2lh/)
  assert.match(d, /table:not\(:has\(code\)\)/)
  assert.match(d, /\[data-dsh-plus-long\]\{cursor:pointer;-webkit-mask-image/)
  assert.doesNotMatch(d.split('\n').find(l => l.includes('max-height:calc')), /mask-image/) // پیامِ کوتاه محو نمی‌شود
  assert.doesNotMatch(d, /line-height/)
  const full = plusCss({ lines: 0, tableScroll: false, lh: 18, textColor: '#ccc', accent: '#f00', buttons: false })
  assert.doesNotMatch(full, /data-message-bubble/)
  assert.doesNotMatch(full, /overflow-x:auto/)
  assert.match(full, /line-height:1\.80!important/)
  assert.match(full, /color:#ccc!important/)
  assert.match(full, /border-color:#f00/)
  assert.match(full, /dsh-plus-btn:not\(\.dsh-plus-aa\)\{display:none/)
  assert.doesNotMatch(plusCss({ textColor: 'red}html{x' }), /red/)
})

test('isLatinWithDigits: فقط متنِ لاتینِ عدددار و کوتاه', () => {
  assert.equal(isLatinWithDigits('7 turns 239 steps · 144 tok/s'), true)
  assert.equal(isLatinWithDigits('2 pending'), true)
  assert.equal(isLatinWithDigits('Deep diving for 1m 47s'), true)
  assert.equal(isLatinWithDigits('New Session'), false)      // بی‌عدد ⇒ دست نمی‌خورد
  assert.equal(isLatinWithDigits('۲ مورد pending 2'), false) // فارسی دارد
  assert.equal(isLatinWithDigits('123'), false)               // حرف ندارد
  assert.equal(isLatinWithDigits('a1'.repeat(100)), false)    // بلند
  assert.equal(isLatinWithDigits(null), false)
})

test('hasNoLetters: خانهٔ فقط-نشانه', () => {
  assert.equal(hasNoLetters('✅'), true)
  assert.equal(hasNoLetters(' 12% '), true)
  assert.equal(hasNoLetters('✅ done'), false)
  assert.equal(hasNoLetters('✅ شد'), false)
  assert.equal(hasNoLetters(''), false)
})

test('isLatinText', () => {
  assert.equal(isLatinText('Compaction could not produce a useful summary.'), true)
  assert.equal(isLatinText('سلام world'), false)
  assert.equal(isLatinText('✅'), false)
  assert.equal(isLatinText('x'.repeat(301)), false)
})
