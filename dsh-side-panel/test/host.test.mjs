import assert from 'node:assert/strict'
import { apply, name, inject, rejectReason } from '../index.js'

/** Minimal Cordis stand-in that records the registered HTTP routes. */
function harness() {
  const routes = new Map()
  const effects = []
  const webServer = {
    register(route) { routes.set(route.path, route.handler); return () => routes.delete(route.path) },
  }
  const effect = (fn) => { const off = fn(); effects.push(off); return off }
  const ctx = {
    effect,
    inject(deps, cb) { cb({ webServer, effect }) },
  }
  return { ctx, routes, effects }
}

function call(handler) {
  return new Promise((resolve) => {
    const res = {
      statusCode: 200,
      headers: {},
      setHeader(k, v) { this.headers[k] = v },
      end(body) { resolve({ status: this.statusCode, headers: this.headers, body: JSON.parse(body) }) },
    }
    handler({ url: '/plugins/side-panel/cost' }, res)
  })
}

const { ctx, routes } = harness()
apply(ctx)
const handler = routes.get('/plugins/side-panel/cost')
if (typeof handler !== 'function') throw new Error('route not registered')
const first = await call(handler)
if (first.status !== 200) throw new Error(`expected 200, got ${first.status}: ${JSON.stringify(first.body)}`)
for (const field of ['usage', 'limit', 'remaining', 'daily', 'ts']) {
  if (!(field in first.body)) throw new Error(`missing field ${field}`)
}
if (typeof first.body.usage !== 'number' || first.body.usage <= 0) throw new Error('usage must be a positive number')
console.log('host route OK:', JSON.stringify(first.body))
console.log('package name/inject:', name, JSON.stringify(inject))

// سدِ مسیرها: صفحهٔ وبِ دیگر / DNS-rebinding رد؛ خودِ پنل و curl ِ محلی مجاز
assert.equal(rejectReason({ headers: {} }), null, 'local curl / IPC without headers')
assert.equal(rejectReason({ headers: { host: '127.0.0.1:55499' } }), null)
assert.equal(rejectReason({ headers: { host: 'localhost:3080', origin: 'http://localhost:3080', 'sec-fetch-site': 'same-origin' } }), null, 'web GUI same-origin')
assert.equal(rejectReason({ headers: { host: '127.0.0.1:55499', origin: 'dsh-app://app' } }), null, 'desktop app origin')
assert.equal(rejectReason({ headers: { host: 'evil.example:55499' } }), 'host', 'DNS rebinding')
assert.equal(rejectReason({ headers: { host: '127.0.0.1:55499', 'sec-fetch-site': 'cross-site' } }), 'cross-site')
assert.equal(rejectReason({ headers: { host: '127.0.0.1:55499', origin: 'https://evil.example' } }), 'origin')

function send(handler, req) {
  return new Promise((resolve) => {
    const res = {
      statusCode: 200, headers: {},
      setHeader(k, v) { this.headers[k] = v },
      end(body) { resolve({ status: this.statusCode, body: JSON.parse(body) }) },
    }
    handler(req, res)
  })
}
const diag = routes.get('/plugins/side-panel/diag')
assert.equal((await send(diag, { method: 'GET', headers: {} })).status, 405)
assert.equal((await send(diag, { method: 'POST', headers: { host: '127.0.0.1:1', origin: 'https://evil.example', 'content-type': 'application/json' } })).status, 403, 'cross-origin diag write refused')
assert.equal((await send(diag, { method: 'POST', headers: { host: '127.0.0.1:1', 'content-type': 'text/plain' } })).status, 415, 'simple (no-preflight) form refused')
const sessionCost = routes.get('/plugins/side-panel/session-cost')
assert.equal((await send(sessionCost, { url: '/plugins/side-panel/session-cost?sessionId=x', headers: { host: 'evil.example' } })).status, 403)
const none = await send(sessionCost, { url: '/plugins/side-panel/session-cost?sessionId=session-does-not-exist-000', headers: {} })
assert.equal(none.status, 200)
assert.equal(none.body.found, false, 'async route answers')

// ---------- مسیرِ دادهٔ خام (raw-log) ----------
function sendRaw(handler, url, headers = {}) {
  return new Promise((resolve) => {
    const res = {
      statusCode: 200, headers: {},
      setHeader(k, v) { this.headers[k] = v },
      end(body) { resolve({ status: this.statusCode, headers: this.headers, body }) },
    }
    handler({ url, headers }, res)
  })
}
const raw = routes.get('/plugins/side-panel/raw-log')
assert.equal(typeof raw, 'function', 'raw-log route is registered')
// سدِ مسیرها مثلِ بقیه (cross-origin ⇒ ۴۰۳)
assert.equal((await sendRaw(raw, '/plugins/side-panel/raw-log?sessionId=x', { host: 'evil.example' })).status, 403)
assert.equal((await sendRaw(raw, '/plugins/side-panel/raw-log?sessionId=x', { host: '127.0.0.1:1', 'sec-fetch-site': 'cross-site' })).status, 403)
// چتِ ناموجود ⇒ ۲۰۰ با found:false، بی خطا
const rawNone = await sendRaw(raw, '/plugins/side-panel/raw-log?sessionId=session-does-not-exist-000')
assert.equal(rawNone.status, 200)
assert.equal(JSON.parse(rawNone.body).found, false)
// شناسهٔ ناامن (../) هم همین‌طور بی‌خطر
assert.equal(JSON.parse((await sendRaw(raw, '/plugins/side-panel/raw-log?sessionId=../../etc/passwd')).body).found, false)
// چتِ واقعی (لاگِ همین پکیج‌کد را در ریشهٔ سشن‌های قلابی می‌سازیم)
{
  const fs = await import('node:fs')
  const os = await import('node:os')
  const path = await import('node:path')
  const { spawnSync } = await import('node:child_process')
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sp-raw-'))
  const dir = path.join(root, '--x--', 'session-raw1')
  fs.mkdirSync(dir, { recursive: true })
  const lines = [
    JSON.stringify({ type: 'session', id: 'session-raw1' }),
    JSON.stringify({ type: 'turn/start', seq: 0, time: 1794700000000, data: { turn: 1 } }),
    'نیمه‌خط خراب {',
  ]
  const frame = spawnSync('/opt/homebrew/bin/zstd', ['-c'], { input: Buffer.from(lines.join('\n') + '\n') }).stdout
  fs.writeFileSync(path.join(dir, 'session.v4.jsonl.zstd'), frame)
  const { rawLogText, rawLogAnswer } = await import('../index.js')
  // با rootِ واقعیِ home پیدا نمی‌شود؛ پس خودِ تابع را با همان فایل می‌سنجیم
  const text = (await import('../cost-log.js')).decompress(frame)
  const { splitLogLines, sliceRawLines } = await import('../raw-log.js')
  const page = sliceRawLines(splitLogLines(text))
  assert.equal(page.totalAll, 3)
  assert.equal(page.lines[2].text, 'نیمه‌خط خراب {', 'خراب هم عیناً می‌آید')
  fs.rmSync(root, { recursive: true, force: true })
  assert.equal(typeof rawLogAnswer, 'function')
  assert.equal(typeof rawLogText, 'function')
}
// دانلودِ چتِ ناموجود ⇒ باز هم JSONِ found:false (نه فایل)
const dl = await sendRaw(raw, '/plugins/side-panel/raw-log?sessionId=session-does-not-exist-000&download=1')
assert.equal(dl.status, 200)
assert.equal(JSON.parse(dl.body).found, false)
console.log('host guards OK (+ raw-log route)')
