/** آزمونِ مغزِ خالصِ تبِ «ابزارها» (node --test). */
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  TIK_KIND, TIK_SATH, TIK_KIND_LABEL, emptyList, cleanList, mergeList, deepestFolder, effectiveList,
  deniedTools, pluginOwner, groupOf, applyChange, applyChanges, buildRows, summarize, isFreshChat, isKind, isSath, hasAny,
} from '../tik-pure.js'

test('چهار دسته و سه سطح، همان‌هایی که حبیب گفت', () => {
  assert.deepEqual(TIK_KIND, ['abzar_dsh', 'mcp', 'afzune', 'eskil'])
  assert.deepEqual(TIK_SATH, ['chat', 'poshe', 'sarasari'])
  for (const k of TIK_KIND) assert.ok(TIK_KIND_LABEL[k], k)
  assert.equal(isKind('mcp'), true)
  assert.equal(isKind('nope'), false)
  assert.equal(isSath('chat'), true)
  assert.equal(isSath('mah'), false)
})

test('فهرستِ خراب هیچ‌وقت خطا نمی‌دهد، فقط خالی می‌شود', () => {
  for (const bad of [null, undefined, 5, 'x', [], { mcp: 'x' }, { mcp: [1, 2] }]) assert.deepEqual(cleanList(bad), emptyList())
  // فقط بولینِ واقعی نگه داشته می‌شود
  const dirty = { mcp: { a: true, b: false, c: 'yes', '  ': true, d: 1 }, nope: { x: true } }
  assert.deepEqual(cleanList(dirty).mcp, { a: true, b: false })
  // دستهٔ ناشناخته نه نگه داشته می‌شود نه خطا می‌دهد
  assert.equal(cleanList(dirty).nope, undefined)
  assert.deepEqual(Object.keys(cleanList(dirty)), [...TIK_KIND])
})

test('mergeList: رویِ رو برنده است، هیچ‌کدام دست نمی‌خورد', () => {
  const base = { abzar_dsh: { A: true, B: true } }
  const over = { abzar_dsh: { B: false } }
  const out = mergeList(base, over)
  assert.deepEqual(out.abzar_dsh, { A: true, B: false })
  assert.equal(base.abzar_dsh.B, true, 'پایه نباید عوض شود')
  assert.equal(over.abzar_dsh.B, false)
})

test('عمیق‌ترین پوشه برنده است و مرزِ اسلش رعایت می‌شود', () => {
  const folders = { '/a': {}, '/a/b': {}, '/a/bc': {} }
  assert.equal(deepestFolder('/a/b/c', folders), '/a/b')
  assert.equal(deepestFolder('/a/b', folders), '/a/b')
  // /a/bc پیشوندِ /a/b/c نیست
  assert.equal(deepestFolder('/a/b/c', { '/a/bc': {} }), null)
  assert.equal(deepestFolder('/z', folders), null)
  // اسلشِ آخر یکی حساب می‌شود
  assert.equal(deepestFolder('/a/b/', { '/a/b': {} }), '/a/b')
})

test('ترتیبِ برنده‌شدن: چت ⇒ پوشه ⇒ سراسری ⇒ پایه', () => {
  const base = { abzar_dsh: { Tool1: true, Tool2: true, Tool3: true } }
  const globalList = { abzar_dsh: { Tool1: false } }
  const folderLists = { '/p': { abzar_dsh: { Tool2: false } } }
  const chatLists = { kanal1: { abzar_dsh: { Tool1: true } } }

  const onlyBase = effectiveList({ cwd: '/other', baseList: base })
  assert.equal(onlyBase.az, 'paye')
  assert.deepEqual(onlyBase.list.abzar_dsh, { Tool1: true, Tool2: true, Tool3: true })

  const withGlobal = effectiveList({ cwd: '/other', baseList: base, globalList: globalList })
  assert.equal(withGlobal.az, 'sarasari')
  assert.equal(withGlobal.list.abzar_dsh.Tool1, false)

  // پوشه بر سراسری مقدم است
  const withFolder = effectiveList({ cwd: '/p/x', baseList: base, globalList: globalList, folderLists: folderLists })
  assert.equal(withFolder.az, 'poshe')
  assert.equal(withFolder.folder, '/p')
  assert.equal(withFolder.list.abzar_dsh.Tool1, false, 'سراسری هنوز هست')
  assert.equal(withFolder.list.abzar_dsh.Tool2, false, 'پوشه اضافه شد')

  // چت بر همه مقدم است
  const withChat = effectiveList({ cwd: '/p/x', chat: 'kanal1', baseList: base, globalList: globalList, folderLists: folderLists, chatLists: chatLists })
  assert.equal(withChat.az, 'chat')
  assert.equal(withChat.list.abzar_dsh.Tool1, true, 'تیکِ خودِ چت برنده شد')
})

test('deniedTools فقط نام‌های موجود و خاموش را می‌دهد', () => {
  const opts = {
    known: ['Tool1', 'Tool2', 'Tool3'],
    baseList: { abzar_dsh: { Tool1: true, Tool2: true, Tool3: true } },
    globalList: { abzar_dsh: { Tool1: false, Ghost: false } },
    cwd: '/x',
  }
  assert.deepEqual(deniedTools(opts), ['Tool1'], 'Ghost وجود ندارد، پس در فهرست نمی‌آید')
  assert.deepEqual(deniedTools({ known: ['Tool1'], baseList: { abzar_dsh: { Tool1: true } }, cwd: '/x' }), [])
})

test('مالکِ افزونه: اسکیل و MCP ِ یک افزونه زیرِ خودش می‌رود', () => {
  const plugins = ['anthropic-skills', 'cc-plugin-rtl']
  assert.equal(pluginOwner({ name: 'anthropic-skills:moment', plugins }), 'anthropic-skills')
  assert.equal(pluginOwner({ name: 'cc-plugin-rtl', plugins }), null)
  assert.equal(pluginOwner({ name: 'plugin:server1', plugins }), null)
  assert.equal(pluginOwner({ name: 'other:x', plugins }), null)
  assert.equal(groupOf({ name: 'anthropic-skills:moment', kind: 'eskil', plugins }), 'anthropic-skills')
  assert.equal(groupOf({ name: 'hafeze', kind: 'mcp', plugins }), 'hafeze')
})

test('applyChange و applyChanges', () => {
  let l = emptyList()
  l = applyChange(l, { kind: 'mcp', name: 'hafeze', on: false })
  assert.equal(l.mcp.hafeze, false)
  l = applyChange(l, { kind: 'bad', name: 'x', on: true })
  assert.equal(l.bad, undefined)
  l = applyChange(l, { kind: 'mcp', name: '  ', on: true })
  assert.deepEqual(Object.keys(l.mcp), ['hafeze'])
  const two = applyChanges(emptyList(), [{ kind: 'eskil', name: 'a', on: false }, { kind: 'eskil', name: 'b', on: true }])
  assert.deepEqual(two.eskil, { a: false, b: true })
})

test('buildRows: خاموشیِ افزونه، اسکیلِ خودش را هم خاموش نشان می‌دهد', () => {
  const rows = buildRows({
    available: { abzar_dsh: ['A', 'B'], mcp: [], afzune: ['plug'], eskil: ['plug:one', 'two'] },
    list: { afzune: { plug: false } },
  })
  assert.deepEqual(rows.map((r) => r.kind), TIK_KIND)
  const afz = rows.find((r) => r.kind === 'afzune')
  assert.equal(afz.items[0].on, false)
  const esk = rows.find((r) => r.kind === 'eskil')
  const one = esk.items.find((i) => i.name === 'plug:one')
  assert.equal(one.on, false)
  assert.equal(one.by, 'plug')
  const two = esk.items.find((i) => i.name === 'two')
  assert.equal(two.on, true)
})

test('buildRows: جست‌وجو و شمارش', () => {
  const rows = buildRows({
    available: { abzar_dsh: ['Read', 'Write'], mcp: ['hafeze'], afzune: [], eskil: [] },
    list: { abzar_dsh: { Read: false } },
    query: 'read',
  })
  const ab = rows.find((r) => r.kind === 'abzar_dsh')
  assert.deepEqual(ab.items.map((i) => i.name), ['Read'])
  assert.equal(ab.onCount, 0)
  assert.equal(ab.total, 1)
  const mc = rows.find((r) => r.kind === 'mcp')
  assert.equal(mc.items.length, 0, 'جست‌وجوی read نباید hafeze را بیاورد')
})

test('summarize با رقمِ فارسی', () => {
  const s = summarize([{ kind: 'mcp', name: 'a', on: false }, { kind: 'mcp', name: 'b', on: false }, { kind: 'eskil', name: 'c', on: true }])
  assert.equal(s.matn, '۲ تیک برداشته · ۱ تیک زده')
  assert.deepEqual(s.off, ['a', 'b'])
  assert.equal(summarize([]).matn, 'تغییری نبود')
})

test('isFreshChat: چتِ بازِ قدیمی هرگز تازه حساب نمی‌شود', () => {
  // تازه: پیامی نفرستاده و بعد از ثبت باز شده
  assert.equal(isFreshChat({ hasMessages: false, openedAt: 200, savedAt: 100 }), true)
  // پیام دارد ⇒ کهنه، هرچقدر هم بعد از ثبت باز شده باشد
  assert.equal(isFreshChat({ hasMessages: true, openedAt: 200, savedAt: 100 }), false)
  // پیش از ثبت باز شده ⇒ کهنه
  assert.equal(isFreshChat({ hasMessages: false, openedAt: 50, savedAt: 100 }), false)
  // عددِ نامعلوم ⇒ کهنه (بی‌احتیاط نباش)
  assert.equal(isFreshChat({ hasMessages: false }), false)
  assert.equal(isFreshChat({}), false)
})

test('منبعِ تیک‌ها راست می‌گوید: فهرستِ سراسریِ خالی «سراسری» حساب نمی‌شود', () => {
  const base = { abzar_dsh: { A: true } }
  const empty = { abzar_dsh: {}, mcp: {}, afzune: {}, eskil: {} }
  assert.equal(hasAny(empty), false)
  assert.equal(hasAny(base), true)
  assert.equal(hasAny(null), false)
  // سراسریِ خالی ⇒ منبع باید «پایه» بماند، نه «سراسری»
  assert.equal(effectiveList({ cwd: '/x', baseList: base, globalList: empty }).az, 'paye')
  // سراسریِ واقعی ⇒ «سراسری»
  assert.equal(effectiveList({ cwd: '/x', baseList: base, globalList: { abzar_dsh: { A: false } } }).az, 'sarasari')
})
