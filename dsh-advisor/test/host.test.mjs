import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { apply, createPlayTrigger, readDb, writeDb, rejectReason, readKey, chatHeaderInfo, profilePackageText, profilePatchText } from '../index.js'
import { cacheModeFor, chooseServer, isFlashModel, openRouterBody, pickFlash, shouldStick, FALLBACK_MODEL } from '../advisor-select.js'
import { buildMessages, SYSTEM_PROMPT } from '../advisor-prompt.js'
import { faMoneySafe, redactSecrets } from '../advisor-pure.js'

/* ------------------------------------------------------------------ سدِ مسیر */

test('سدِ مسیر: loopback مجاز، بقیه رد', () => {
  assert.equal(rejectReason({ headers: {} }), null)
  assert.equal(rejectReason({ headers: { host: '127.0.0.1:57752' } }), null)
  assert.equal(rejectReason({ headers: { host: 'localhost:3080', origin: 'http://localhost:3080', 'sec-fetch-site': 'same-origin' } }), null)
  assert.equal(rejectReason({ headers: { host: '127.0.0.1:57752', origin: 'dsh-app://app' } }), null)
  assert.equal(rejectReason({ headers: { host: 'evil.example:57752' } }), 'host')
  assert.equal(rejectReason({ headers: { host: '127.0.0.1:57752', 'sec-fetch-site': 'cross-site' } }), 'cross-site')
  assert.equal(rejectReason({ headers: { host: '127.0.0.1:57752', origin: 'https://evil.example' } }), 'origin')
})

/* ------------------------------------------------------------------ حالتِ سرور */

test('حالتِ کش: خودکار/بی‌کش/با کش', () => {
  assert.equal(cacheModeFor('auto', false), 'none')
  assert.equal(cacheModeFor('auto', true), 'with')
  assert.equal(cacheModeFor('no-cache', true), 'none')
  assert.equal(cacheModeFor('with-cache', false), 'with')
  assert.equal(shouldStick('with-cache', false), true)
  assert.equal(shouldStick('auto', false), false)
})

test('فقط فلش: pro و بقیه رد', () => {
  assert.equal(isFlashModel('deepseek/deepseek-v4.1-flash-1017'), true)
  assert.equal(isFlashModel('deepseek/deepseek-v4.1-pro'), false)
  assert.equal(isFlashModel('openai/gpt-flash'), false)
})

test('انتخاب: اولین فلش با اسلاگ', () => {
  const ranked = [
    { model: 'deepseek/deepseek-v4.1-pro', provider: 'Cheap', providerSlug: 'cheap' },
    { model: 'deepseek/deepseek-v4.1-flash-1017', provider: 'DeepInfra', providerSlug: 'deepinfra' },
  ]
  const picked = pickFlash(ranked)
  assert.equal(picked.model, 'deepseek/deepseek-v4.1-flash-1017')
  assert.equal(picked.providerSlug, 'deepinfra')
})

test('انتخاب: شکارچی در دسترس نیست ⇒ پریستِ پیش‌فرض', () => {
  const server = chooseServer({ mode: 'auto', play: false, ranked: null, previous: null })
  assert.equal(server.model, FALLBACK_MODEL)
  assert.equal(server.source, 'fallback')
  assert.equal(server.cache, 'none')
})

test('انتخاب: در حالتِ با کش سرورِ قبلی می‌ماند', () => {
  const previous = { model: 'deepseek/deepseek-v4.1-flash-1017', provider: 'DeepInfra', providerSlug: 'deepinfra' }
  const ranked = [{ model: 'deepseek/deepseek-v4.1-flash-1017', provider: 'Wafer', providerSlug: 'wafer' }]
  const sticky = chooseServer({ mode: 'auto', play: true, ranked, previous })
  assert.equal(sticky.source, 'sticky')
  assert.equal(sticky.providerSlug, 'deepinfra')
  const fresh = chooseServer({ mode: 'auto', play: false, ranked, previous })
  assert.equal(fresh.source, 'hunter')
  assert.equal(fresh.providerSlug, 'wafer')
})

test('بدنهٔ درخواست: پین روی همان سرور، بی‌فال‌بک، با usage', () => {
  const body = openRouterBody({ model: 'm', providerSlug: 'deepinfra', messages: [], maxTokens: 2000 })
  assert.deepEqual(body.provider, { order: ['deepinfra'], allow_fallbacks: false })
  assert.deepEqual(body.usage, { include: true })
  assert.equal(body.max_tokens, 2000)
})

/* ------------------------------------------------------------------ پرامپت */

test('پرامپتِ سیستم: سه بخش و قانونِ فلش', () => {
  assert.ok(SYSTEM_PROMPT.includes('خرجِ بی‌مصرف'))
  assert.ok(SYSTEM_PROMPT.includes('تنظیمِ بهتر'))
  assert.ok(SYSTEM_PROMPT.includes('کمک‌های دیگر'))
  assert.ok(SYSTEM_PROMPT.includes('تغییری لازم نیست'))
  assert.ok(SYSTEM_PROMPT.includes('بیرون از قانونِ تو'))
  assert.ok(SYSTEM_PROMPT.includes('۸۰ نویسه'))
})

test('پیام‌ها: سیستم ثابت اول، بعد prefix + tail، رسیدِ دستیار، و دستور در نوبتِ جدا', () => {
  const messages = buildMessages({ prefix: 'PREFIX', tail: 'TAIL' }, 'INSTR')
  assert.deepEqual(messages.map((m) => m.role), ['system', 'user', 'assistant', 'user'])
  assert.equal(messages[0].content, SYSTEM_PROMPT)
  assert.ok(messages[1].content.startsWith('PREFIX'))
  assert.ok(messages[1].content.indexOf('TAIL') > messages[1].content.indexOf('PREFIX'))
  assert.ok(!messages[1].content.includes('INSTR'))
  assert.equal(messages[3].content, 'INSTR')
})

/* ------------------------------------------------------------------ دادهٔ پایدار */

test('state.json: نوشتن و خواندن + فایلِ خراب', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'advisor-test-'))
  const file = path.join(dir, 'state.json')
  assert.deepEqual(Object.keys(readDb(file).sessions), [])
  writeDb({ version: 1, sessions: { s1: { play: true } } }, file)
  assert.equal(readDb(file).sessions.s1.play, true)
  fs.writeFileSync(file, '{oops')
  assert.deepEqual(readDb(file).sessions, {})
  fs.rmSync(dir, { recursive: true, force: true })
})

/* ------------------------------------------------------------------ تریگر */

test('تریگر: فقط turn/end و فقط با پلیِ روشن', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'advisor-trig-'))
  const file = path.join(dir, 'state.json')
  writeDb({ version: 1, sessions: { s1: { play: false } } }, file)
  const fired = []
  const trigger = createPlayTrigger({ fire: (id, seq) => fired.push([id, seq]), debounceMs: 1 })
  assert.equal(trigger.onSessionEvent('s1', { type: 'turn/end', seq: 3 }), false)
  trigger.dispose()
  fs.rmSync(dir, { recursive: true, force: true })
})
