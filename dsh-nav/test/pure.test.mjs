/**
 * آزمونِ توابعِ خالص: نامِ پوشه، «9min»، ترتیبِ تازه‌ترین، فهرستِ چت‌ها، شاخهٔ ساب‌ایجنت.
 */
import assert from 'node:assert/strict'
import test from 'node:test'

import {
  folderName, folderLabel, relativeTime, relativeTimeLabel, sortByRecency,
  folderChats, folderList, workspaceOfSession, chatLineage, rootChatId, menuCounter,
} from '../nav-pure.js'

const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

test('نامِ پوشه: آخرین بخشِ مسیر', () => {
  assert.equal(folderName('/Users/habib/1-MY-WORK/136th-day-fix-rtl-claude'), '136th-day-fix-rtl-claude')
  assert.equal(folderName('/Users/habib/1-MY-WORK/136th-day-fix-rtl-claude/'), '136th-day-fix-rtl-claude')
  assert.equal(folderName('C:\\Users\\habib\\proj'), 'proj')
  assert.equal(folderName('/'), '/')
  assert.equal(folderName(''), '')
  assert.equal(folderName(undefined), '')
})

test('برچسبِ پوشه: عنوان، وگرنه نامِ مسیر', () => {
  assert.equal(folderLabel({ title: 'کارِ من', path: '/tmp/x' }), 'کارِ من')
  assert.equal(folderLabel({ title: '  ', path: '/tmp/x' }), 'x')
  assert.equal(folderLabel(null), '')
})

test('فاصلهٔ زمانی مثلِ سایدبار: now/min/h/d/mo/y', () => {
  const now = 10_000_000_000
  assert.deepEqual(relativeTime(now, now), { unit: 'now', n: 0 })
  assert.deepEqual(relativeTime(now - 30_000, now), { unit: 'now', n: 0 })
  assert.deepEqual(relativeTime(now - 9 * MIN, now), { unit: 'minutes', n: 9 })
  assert.deepEqual(relativeTime(now - 59 * MIN, now), { unit: 'minutes', n: 59 })
  assert.deepEqual(relativeTime(now - 2 * HOUR, now), { unit: 'hours', n: 2 })
  assert.deepEqual(relativeTime(now - 3 * DAY, now), { unit: 'days', n: 3 })
  assert.deepEqual(relativeTime(now - 45 * DAY, now), { unit: 'months', n: 1 })
  assert.deepEqual(relativeTime(now - 400 * DAY, now), { unit: 'years', n: 1 })
  // ساعتِ آینده منفی نمی‌شود
  assert.deepEqual(relativeTime(now + 5 * MIN, now), { unit: 'now', n: 0 })
})

test('رشتهٔ «9min» عیناً مثلِ سایدبار', () => {
  const now = 9_000_000_000
  assert.equal(relativeTimeLabel(now - 9 * MIN, now), '9min')
  assert.equal(relativeTimeLabel(now - 2 * HOUR, now), '2h')
  assert.equal(relativeTimeLabel(now - 3 * DAY, now), '3d')
  assert.equal(relativeTimeLabel(now - 60 * DAY, now), '2mo')
  assert.equal(relativeTimeLabel(now - 400 * DAY, now), '1y')
  assert.equal(relativeTimeLabel(now, now), 'now')
})

test('مرتب‌سازی: تازه‌ترین اول، و ترتیبِ ثابت وقتی زمان یکی است', () => {
  const rows = sortByRecency([
    { id: 'b', updatedAt: 100 },
    { id: 'a', updatedAt: 300 },
    { id: 'c', updatedAt: 100 },
  ])
  assert.deepEqual(rows.map(r => r.id), ['a', 'b', 'c'])
})

test('چت‌های یک پوشه: ساب‌ایجنت و بایگانی بیرون می‌مانند', () => {
  const byId = {
    s1: { id: 's1', displayTitle: 'اپوس-۱۳۶', updatedAt: 100, running: true },
    s2: { id: 's2', displayTitle: 'اپوس-۱۳۶-۲', updatedAt: 300, running: false },
    s3: { id: 's3', displayTitle: 'ساب', updatedAt: 500, origin: 'subagent', parentId: 's1' },
    s4: { id: 's4', displayTitle: 'بایگانی', updatedAt: 900 },
    s5: { id: 's5', updatedAt: 50 },
  }
  const rows = folderChats({ sessionIds: ['s1', 's2', 's3', 's4', 's5'], byId, archivedSessionIds: ['s4'] })
  assert.deepEqual(rows.map(r => r.id), ['s2', 's1', 's5'], 'تازه‌ترین اول، بی ساب‌ایجنت و بی بایگانی')
  assert.equal(rows[1].running, true)
  assert.equal(rows[2].label, 's5', 'بی عنوان ⇒ شناسه')
})

test('فهرستِ پوشه‌ها: نام، مسیر، و علامتِ پوشهٔ فعلی', () => {
  const items = folderList([
    { workspaceId: 'w1', title: 'الف', path: '/a', updatedAt: new Date(1000).toISOString() },
    { workspaceId: 'w2', path: '/Users/x/proj', updatedAt: new Date(5000).toISOString() },
  ], { currentWorkspaceId: 'w2' })
  assert.deepEqual(items.map(i => i.id), ['w2', 'w1'], 'تازه‌ترین اول')
  assert.equal(items[0].label, 'proj')
  assert.equal(items[0].current, true)
  assert.equal(items[1].current, false)
})

test('پوشهٔ یک چت از روی مسیرِ کاری', () => {
  const items = [{ workspaceId: 'w1', path: '/Users/a' }, { workspaceId: 'w2', path: '/Users/b' }]
  assert.equal(workspaceOfSession(items, '/Users/b'), 'w2')
  assert.equal(workspaceOfSession(items, '/nope'), undefined)
  assert.equal(workspaceOfSession(items, undefined), undefined)
})

test('شاخهٔ چت تا ساب‌ایجنت، از والد به فرزند', () => {
  const byId = {
    root: { id: 'root', displayTitle: 'چتِ اصلی' },
    child: { id: 'child', displayTitle: 'ساب-۱', parentId: 'root', origin: 'subagent' },
    grand: { id: 'grand', displayTitle: 'ساب-۲', parentId: 'child', origin: 'subagent' },
  }
  assert.deepEqual(chatLineage(byId, 'grand').map(c => c.id), ['root', 'child', 'grand'])
  assert.deepEqual(chatLineage(byId, 'root').map(c => c.id), ['root'])
  assert.equal(rootChatId(byId, 'grand'), 'root')
  assert.equal(rootChatId(byId, 'root'), 'root')
  assert.deepEqual(chatLineage(byId, 'missing'), [])
})

test('شمارندهٔ سرتیترِ منو', () => {
  assert.equal(menuCounter({ total: 3, running: 1 }), '3 چت · 1 در حال اجرا')
  assert.equal(menuCounter({ total: 2, running: 0 }), '2 چت')
})
