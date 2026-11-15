/**
 * آزمونِ نیمهٔ host در node: مسیرِ GET/POST ِ تنظیم‌ها، سدِ امنیتی، اعتبارسنجی،
 * نوشتنِ اتمیک و مهاجرتِ یک‌باره. خانهٔ کاربر با HOME ِ موقت جابه‌جا می‌شود.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  rejectReason, rtlHome, globalFile, projectFile, chatFile, loadLevels, saveLevel, seedGlobal, checkWorkspace,
} from '../index.js'

/**
 * یک HOME ِ موقت و یک پوشهٔ کارِ واقعی برای همین آزمون.
 * پوشهٔ موقتِ mac در /private/var است که سدِ «پوشهٔ سیستم» ردش می‌کند؛ پس
 * پوشهٔ آزمون را کنارِ خودِ این پروژه می‌سازیم و آخرِ کار پاک می‌کنیم.
 */
function sandbox() {
  const base = path.join(path.dirname(new URL(import.meta.url).pathname), '.sandbox')
  fs.mkdirSync(base, { recursive: true })
  const root = fs.mkdtempSync(path.join(base, 'rtl-set-'))
  const home = path.join(root, 'home')
  const work = path.join(root, 'work')
  fs.mkdirSync(home, { recursive: true })
  fs.mkdirSync(work, { recursive: true })
  const done = () => {
    fs.rmSync(root, { recursive: true, force: true })
    // پوشهٔ والدِ آزمون اگر خالی ماند هم بماند؛ ریپو باید تمیز بماند
    try { fs.rmdirSync(base) } catch (err) { /* خالی نبود یا هنوز آزمونِ دیگری کار می‌کند */ }
  }
  return { root, home, work, done }
}

/** بدنهٔ POST را در req ِ ساختگی می‌ریزد. */
function bodyReq(body) {
  const listeners = {}
  const req = {
    on(event, fn) { (listeners[event] ||= []).push(fn); return req },
    destroy() {},
  }
  setTimeout(() => {
    if (listeners.data && body !== undefined) listeners.data.forEach((fn) => fn(Buffer.from(JSON.stringify(body))))
    if (listeners.end) listeners.end.forEach((fn) => fn())
  }, 0)
  return req
}

test('سدِ مسیرها: cross-site و originِ غریبه رد، خودِ اپ مجاز', () => {
  assert.equal(rejectReason({ headers: {} }), null)
  assert.equal(rejectReason({ headers: { host: '127.0.0.1:60038' } }), null)
  assert.equal(rejectReason({ headers: { host: '127.0.0.1:60038', origin: 'http://127.0.0.1:60038' } }), null)
  assert.equal(rejectReason({ headers: { host: '127.0.0.1:60038', origin: 'dsh-app://app' } }), null)
  assert.equal(rejectReason({ headers: { host: 'evil.example:60038' } }), 'host')
  assert.equal(rejectReason({ headers: { host: '127.0.0.1:1', 'sec-fetch-site': 'cross-site' } }), 'cross-site')
  assert.equal(rejectReason({ headers: { host: '127.0.0.1:1', origin: 'https://evil.example' } }), 'origin')
})

test('مسیرها: سراسری در ~/.dsh/dsh-rtl، پروژه کنارِ پوشهٔ کار، چت در chats/', () => {
  const box = sandbox()
  assert.equal(rtlHome(box.home), path.join(box.home, '.dsh', 'dsh-rtl'))
  assert.equal(globalFile(box.home), path.join(box.home, '.dsh', 'dsh-rtl', 'settings.json'))
  assert.equal(chatFile(box.home, 'session-1'), path.join(box.home, '.dsh', 'dsh-rtl', 'chats', 'session-1.json'))
  assert.equal(projectFile(box.work), path.join(box.work, '.dsh-rtl.json'))
  box.done()
})

test('پوشهٔ کارِ ناموجود/ناامن رد می‌شود', () => {
  const box = sandbox()
  assert.equal(checkWorkspace(path.join(box.root, 'nope'), box.home).ok, false)
  assert.equal(checkWorkspace('/etc', box.home).ok, false, 'پوشهٔ سیستم')
  assert.equal(checkWorkspace(box.home, box.home).ok, false, 'پوشهٔ خانه')
  assert.equal(checkWorkspace(box.work + '/../work', box.home).ok, false, 'مسیر با ..')
  assert.equal(checkWorkspace(box.work, box.home).ok, true)
  fs.writeFileSync(path.join(box.root, 'file.txt'), 'x')
  assert.equal(checkWorkspace(path.join(box.root, 'file.txt'), box.home).ok, false, 'پرونده است، نه پوشه')
  box.done()
})

test('سه سطح: نوشتن و خواندن با هم‌آمدنِ درستِ پرونده‌ها', () => {
  const box = sandbox()
  const sid = 'session-abc'
  const g = saveLevel({ home: box.home, level: 'global', patch: { rtl: true, lh: 18, btnSize: 99 } })
  assert.equal(g.ok, true)
  // عددِ بیرونِ بازه با حداقل/حداکثرِ readPlus جور می‌شود
  assert.equal(JSON.parse(fs.readFileSync(globalFile(box.home), 'utf8')).btnSize, 20)
  const p = saveLevel({ home: box.home, level: 'project', patch: { lh: 21 }, cwd: box.work })
  assert.equal(p.ok, true)
  const c = saveLevel({ home: box.home, level: 'chat', patch: { lh: 24 }, sessionId: sid })
  assert.equal(c.ok, true)
  const levels = loadLevels({ home: box.home, sessionId: sid, cwd: box.work })
  assert.equal(levels.global.lh, 18)
  assert.equal(levels.project.lh, 21)
  assert.equal(levels.chat.lh, 24)
  assert.equal(levels.levels.project.ok, true)
  // پاک‌کردنِ یک کلید از یک سطح (undefined در JSON نیست، پس با unset گفته می‌شود)
  const del = saveLevel({ home: box.home, level: 'chat', patch: {}, unset: ['lh'], sessionId: sid })
  assert.equal(del.ok, true)
  assert.equal(loadLevels({ home: box.home, sessionId: sid, cwd: box.work }).chat.lh, undefined)
  assert.equal(loadLevels({ home: box.home, sessionId: sid, cwd: box.work }).global.lh, 18, 'سراسری دست نمی‌خورد')
  assert.equal(saveLevel({ home: box.home, level: 'chat', patch: {}, unset: ['evil'], sessionId: sid }).ok, false, 'unset ِ ناشناخته')
  box.done()
})

test('کلیدِ ناشناخته، سطحِ ناشناخته، شناسهٔ ناامن و پوشهٔ غلط رد می‌شوند', () => {
  const box = sandbox()
  assert.equal(saveLevel({ home: box.home, level: 'nope', patch: { rtl: true } }).ok, false)
  assert.equal(saveLevel({ home: box.home, level: 'global', patch: { evil: 1 } }).ok, false, 'کلیدِ ناشناخته')
  assert.equal(saveLevel({ home: box.home, level: 'global', patch: {} }).ok, false, 'بدونِ مقدار')
  assert.equal(saveLevel({ home: box.home, level: 'chat', patch: { rtl: true }, sessionId: '../../etc/passwd' }).ok, false, 'شناسهٔ ناامن')
  assert.equal(saveLevel({ home: box.home, level: 'chat', patch: { rtl: true }, sessionId: '' }).ok, false, 'شناسهٔ خالی')
  assert.equal(saveLevel({ home: box.home, level: 'project', patch: { rtl: true }, cwd: '/etc' }).ok, false, 'پوشهٔ سیستم')
  // و هیچ پرونده‌ای بیرونِ خانه ساخته نشد
  assert.equal(fs.existsSync('/etc/.dsh-rtl.json'), false)
  box.done()
})

test('JSON ِ خراب یا دستی‌کاری‌شده: بی‌خطا، و فقط کلیدهای مجاز خوانده می‌شوند', () => {
  const box = sandbox()
  fs.mkdirSync(path.dirname(globalFile(box.home)), { recursive: true })
  fs.writeFileSync(globalFile(box.home), '{ not json ')
  assert.deepEqual(loadLevels({ home: box.home }).global, {})
  fs.writeFileSync(globalFile(box.home), JSON.stringify({ rtl: false, evilKey: 'x', __proto__: { bad: 1 } }))
  const levels = loadLevels({ home: box.home })
  assert.equal(levels.global.rtl, false)
  assert.equal('evilKey' in levels.global, false)
  assert.equal('commands' in levels.global, false)
  box.done()
})

test('فراخوانیِ مهاجرت: فقط اگر پروندهٔ سراسری نبود، و فقط یک بار', () => {
  const box = sandbox()
  const first = seedGlobal({ home: box.home, values: { rtl: false, lh: 20, commands: [{ label: 'x', text: 'y' }] } })
  assert.equal(first.seeded, true)
  const saved = JSON.parse(fs.readFileSync(globalFile(box.home), 'utf8'))
  assert.equal(saved.rtl, false)
  assert.equal(saved.lh, 20)
  assert.equal('commands' in saved, false, 'ساختارِ سنگین ذخیره نمی‌شود')
  const second = seedGlobal({ home: box.home, values: { rtl: true } })
  assert.equal(second.seeded, false, 'پرونده از قبل هست')
  assert.equal(JSON.parse(fs.readFileSync(globalFile(box.home), 'utf8')).rtl, false, 'بازنویسی نشد')
  box.done()
})

test('مسیرِ HTTP: GET و POST با req/res ِ ساختگی، و ۴۰۳ برای خاستگاهِ غریبه', async () => {
  const box = sandbox()
  const routes = new Map()
  const webServer = { register(route) { routes.set(route.path, route.handler); return () => routes.delete(route.path) } }
  const fake = { webServer, effect: (fn) => { const off = fn(); return off }, inject: (deps, cb) => cb({ webServer, effect: (fn) => { const off = fn(); return off } }) }
  const original = os.homedir
  const saved = process.env.HOME
  process.env.HOME = box.home
  try {
    // store هم از همین HOME می‌خواند
    const mod = await import('../index.js?' + Date.now())
    mod.apply({ inject: (deps, cb) => cb(fake) })
    const handler = routes.get('/plugins/rtl/settings')
    assert.equal(typeof handler, 'function', 'مسیر ثبت شد')

    const call = (req) => new Promise((resolve) => {
      const res = {
        statusCode: 200, headers: {},
        setHeader(k, v) { this.headers[k] = v },
        end(body) { resolve({ status: this.statusCode, headers: this.headers, body: JSON.parse(body) }) },
      }
      handler(req, res)
    })
    const url = '/plugins/rtl/settings?sessionId=session-1&cwd=' + encodeURIComponent(box.work)
    const post = (body, extra) => Object.assign({
      method: 'POST', url,
      headers: Object.assign({ host: '127.0.0.1:1', 'content-type': 'application/json' }, extra || {}),
    }, bodyReq(body))

    // GET ِ خالی
    const empty = await call({ method: 'GET', url, headers: { host: '127.0.0.1:1' } })
    assert.equal(empty.status, 200)
    assert.deepEqual(empty.body.global, {})
    // ۴۰۳ برای خاستگاهِ غریبه
    const bad = await call(post({ level: 'global', patch: { rtl: true } }, { origin: 'https://evil.example' }))
    assert.equal(bad.status, 403)
    // ۴۱۵ برای بدنهٔ غیرِ JSON
    const wrongType = await call(post({ level: 'global', patch: { rtl: true } }, { 'content-type': 'text/plain' }))
    assert.equal(wrongType.status, 415)
    // POST ِ درست
    const saved2 = await call(post({ level: 'global', patch: { rtl: true, lh: 18 } }))
    assert.equal(saved2.status, 200)
    assert.equal(saved2.body.ok, true)
    assert.equal(saved2.body.global.lh, 18)
    // GET دوباره همان را می‌خواند
    const again = await call({ method: 'GET', url, headers: { host: '127.0.0.1:1' } })
    assert.equal(again.body.global.lh, 18)
    // سطحِ چت با شناسهٔ امن
    const chat = await call(post({ level: 'chat', patch: { lh: 24 } }))
    assert.equal(chat.body.chat.lh, 24)
    // کلیدِ ناشناخته ⇒ ۴۰۰
    const unknown = await call(post({ level: 'global', patch: { evil: 1 } }))
    assert.equal(unknown.status, 400)
    // ۴۰۵ برای متدِ دیگر
    const put = await call({ method: 'PUT', url, headers: { host: '127.0.0.1:1' } })
    assert.equal(put.status, 405)
  } finally {
    process.env.HOME = saved
    box.done()
  }
})
