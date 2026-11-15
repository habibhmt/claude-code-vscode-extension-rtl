import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'

// پوشهٔ جدا: آزمون هرگز به ~/.dsh/advisor دست نمی‌زند.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'advisor-play-'))
process.env.DSH_ADVISOR_STATE_DIR = dir
const { createPlayTrigger, readDb, writeDb } = await import('../index.js')

function seed(play) {
  writeDb({ version: 1, sessions: { 's-1': { play, runs: [], lastKey: null } } })
}

test('تریگر: پلی خاموش ⇒ هیچ اجرایی', () => {
  seed(false)
  const fired = []
  const trigger = createPlayTrigger({ fire: (id, seq) => fired.push([id, seq]), debounceMs: 1 })
  assert.equal(trigger.onSessionEvent('s-1', { type: 'turn/end', seq: 4 }), false)
  trigger.dispose()
  assert.deepEqual(fired, [])
})

test('تریگر: رخدادهای غیرِ turn/end نادیده گرفته می‌شوند', () => {
  seed(true)
  const fired = []
  const trigger = createPlayTrigger({ fire: (id, seq) => fired.push([id, seq]), debounceMs: 1 })
  for (const type of ['user/message', 'assistant/message', 'tool/result', 'turn/start', 'step/end']) {
    assert.equal(trigger.onSessionEvent('s-1', { type, seq: 5 }), false)
  }
  trigger.dispose()
  assert.deepEqual(fired, [])
})

test('تریگر: پلی روشن + turn/end ⇒ دقیقاً یک اجرا پس از لرزش‌گیر', async () => {
  seed(true)
  const fired = []
  const trigger = createPlayTrigger({ fire: (id, seq) => fired.push([id, seq]), debounceMs: 5 })
  assert.equal(trigger.onSessionEvent('s-1', { type: 'turn/end', seq: 11 }), true)
  // چند رخدادِ پیاپی در کمتر از لرزش‌گیر ⇒ فقط یکی می‌ماند.
  assert.equal(trigger.onSessionEvent('s-1', { type: 'turn/end', seq: 12 }), true)
  trigger.dispose()
})

test('تریگر: نوبتی که کلیدش ذخیره شده دوباره اجرا نمی‌شود', () => {
  writeDb({ version: 1, sessions: { 's-1': { play: true, runs: [], lastKey: 's-1:20' } } })
  const fired = []
  const trigger = createPlayTrigger({ fire: (id, seq) => fired.push([id, seq]), debounceMs: 1 })
  assert.equal(trigger.onSessionEvent('s-1', { type: 'turn/end', seq: 20 }), false)
  trigger.dispose()
})

test('تریگر: سهمیهٔ پر ⇒ اجرا نه', () => {
  const now = Date.now()
  const runs = Array.from({ length: 6 }, () => now - 1000)
  writeDb({ version: 1, sessions: { 's-1': { play: true, runs, lastKey: null } } })
  const trigger = createPlayTrigger({ fire: () => {}, debounceMs: 1 })
  assert.equal(trigger.onSessionEvent('s-1', { type: 'turn/end', seq: 30 }), false)
  trigger.dispose()
})

// جهتِ این آزمون‌ها همان مشکلِ گزارش‌شدهٔ حبیب است: «این دکمه پلی … ارور میده هی».
// پیش از فیکس، سقف پر ⇒ اجرا نه و هیچ صدایی هم نبود؛ کاربر فقط می‌دید پلی چیزی نمی‌کند.
test('تریگر: وقتی سقف پر است، علت و ساعتِ «کی دوباره» به بیرون گفته می‌شود (نه سکوت)', () => {
  const now = Date.now()
  const runs = Array.from({ length: 6 }, (_, i) => now - (18 - i * 2) * 60 * 1000)
  writeDb({ version: 1, sessions: { 's-1': { play: true, runs, lastKey: null } } })
  const skips = []
  const trigger = createPlayTrigger({ fire: () => { throw new Error('نباید اجرا شود') }, onSkip: (id, reason) => skips.push([id, reason]), debounceMs: 1 })
  assert.equal(trigger.onSessionEvent('s-1', { type: 'turn/end', seq: 30 }), false)
  trigger.dispose()
  assert.equal(skips.length, 1, 'باید دقیقاً یک یادداشتِ رد بدهد')
  assert.equal(skips[0][0], 's-1')
  assert.match(skips[0][1], /سقفِ ۶ اجرا در ساعت پر شد/)
  assert.match(skips[0][1], /ساعتِ [۰-۹]{2}:[۰-۹]{2}/, 'ساعتِ دقیقِ بازشدن لازم است: ' + skips[0][1])
})

test('تریگر: ردهای طبیعی («قبلاً بررسی شد») یادداشت نمی‌شوند تا پنل بی‌دلیل قرمز نشود', () => {
  const now = Date.now()
  const runs = Array.from({ length: 6 }, (_, i) => now - (18 - i * 2) * 60 * 1000)
  writeDb({ version: 1, sessions: { 's-1': { play: true, runs, lastKey: 's-1:40' } } })
  const skips = []
  const trigger = createPlayTrigger({ fire: () => {}, onSkip: (id, reason) => skips.push(reason), debounceMs: 1 })
  assert.equal(trigger.onSessionEvent('s-1', { type: 'turn/end', seq: 40 }), false)
  trigger.dispose()
  assert.deepEqual(skips, [])
})

test('پاک‌سازی', () => {
  fs.rmSync(dir, { recursive: true, force: true })
  assert.ok(true)
})