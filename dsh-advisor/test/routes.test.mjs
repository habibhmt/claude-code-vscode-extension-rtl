import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'advisor-route-'))
process.env.DSH_ADVISOR_STATE_DIR = dir
const { apply, executeRun, readDb, writeDb } = await import('../index.js')
const { parseLogRows } = await import('../advisor-pure.js')

/** Cordis و webServerِ ساختگی که مسیرها را نگه می‌دارد. */
function harness() {
  const routes = new Map()
  const listeners = []
  const effect = (fn) => { const off = fn(); return typeof off === 'function' ? off : () => {} }
  const webServer = { register(route) { routes.set(route.path, route.handler); return () => routes.delete(route.path) } }
  const ctx = {
    effect,
    on(event, cb) { listeners.push([event, cb]); return () => {} },
    inject(deps, cb) { cb({ webServer, effect }) },
    logger: { warn() {}, info() {} },
  }
  return { ctx, routes, listeners }
}

function call(handler, options = {}) {
  const body = options.body === undefined ? null : JSON.stringify(options.body)
  return new Promise((resolve) => {
    const req = {
      method: options.method || 'GET',
      url: options.url || '/',
      headers: { host: '127.0.0.1:57752', 'content-type': 'application/json', ...(options.headers || {}) },
      on(event, cb) {
        if (event === 'data' && body) cb(Buffer.from(body))
        if (event === 'end') cb()
        return req
      },
      destroy() {},
    }
    const res = {
      statusCode: 200,
      headers: {},
      setHeader(k, v) { this.headers[k.toLowerCase()] = v },
      end(payload) {
        let json = null
        try { json = payload ? JSON.parse(payload) : null } catch { json = payload }
        resolve({ status: this.statusCode, json })
      },
    }
    handler(req, res)
  })
}


/** دو ردیفِ ساده برای یک اجرای کامل در آزمون (بی خواندنِ لاگِ واقعی). */
function rowsForRun() {
  const t = Date.UTC(2026, 10, 15, 10, 0, 0)
  return parseLogRows([
    JSON.stringify({ seq: 0, type: 'user/message', time: t, data: { message: { role: 'user', content: [{ type: 'text', text: 'سلام' }] } } }),
    JSON.stringify({ seq: 1, type: 'turn/end', time: t + 1, data: { turn: 1, reason: { kind: 'completed' } } }),
  ])
}

/** fetch جعلی: هیچ تماسِ واقعیِ OpenRouter؛ مدل جوابِ درست می‌دهد. */
function fakeFetchOk() {
  const GOOD = 'تغییری لازم نیست\n## خرجِ بی‌مصرف\n—\n## تنظیمِ بهتر\n—\n## کمک‌های دیگر\n—'
  return async (url) => {
    const u = String(url)
    if (u.includes('/plugins/model-hunter/rank')) return { ok: true, json: async () => ({ rows: [] }) }
    if (u.endsWith('/endpoints')) return { ok: true, json: async () => ({ data: { endpoints: [{ provider_name: 'DeepInfra', tag: 'deepinfra/fp8', context_length: 1048576 }] } }) }
    if (u.endsWith('/chat/completions')) {
      const text = JSON.stringify({ model: 'deepseek/deepseek-v4.1-flash-1017', choices: [{ finish_reason: 'stop', message: { content: GOOD } }], usage: { prompt_tokens: 100, completion_tokens: 10, cost: 0.001 } })
      return { ok: true, status: 200, text: async () => text }
    }
    throw new Error('unexpected ' + u)
  }
}

const { ctx, routes, listeners } = harness()
apply(ctx)

test('مسیرها ثبت شده‌اند', () => {
  for (const p of ['/plugins/advisor/state', '/plugins/advisor/run', '/plugins/advisor/play', '/plugins/advisor/server']) {
    assert.equal(typeof routes.get(p), 'function', p)
  }
})

test('شنوندهٔ session/event ثبت شده است', () => {
  assert.ok(listeners.some(([event]) => event === 'session/event'))
})

test('state: پیش‌فرض‌ها', async () => {
  const flat = [];
  const r = await call(routes.get('/plugins/advisor/state'), { url: '/plugins/advisor/state?sessionId=s-9' })
  assert.equal(r.status, 200)
  assert.equal(r.json.play, false)
  assert.equal(r.json.running, false)
  assert.equal(r.json.serverMode, 'auto')
  assert.ok(r.json.quota)
  assert.equal(r.json.cost.advisorRuns, 0)
})

test('play: روشن و خاموش', async () => {
  const on = await call(routes.get('/plugins/advisor/play'), { method: 'POST', body: { sessionId: 's-9', on: true } })
  assert.equal(on.status, 200)
  assert.equal(on.json.play, true)
  assert.equal(readDb().sessions['s-9'].play, true)
  const off = await call(routes.get('/plugins/advisor/play'), { method: 'POST', body: { sessionId: 's-9', on: false } })
  assert.equal(off.json.play, false)
})

test('play: بی‌sessionId ⇒ 400', async () => {
  const r = await call(routes.get('/plugins/advisor/play'), { method: 'POST', body: {} })
  assert.equal(r.status, 400)
})

// مشکلِ واقعیِ حبیب: پلی روشن می‌شد، سقفِ ۶تایی می‌سوخت و بعدش هیچ صدایی نبود — فقط «ارور» می‌ماند.
// پیش از فیکس، همین نشست‌کردن روی سقف ۲۰۰ می‌داد و پلی را روشن می‌گذاشت.
test('play: سقفِ ساعت پر ⇒ ۴۲۹ با علت و ساعتِ «کی دوباره»، و پلی روشن نمی‌شود', async () => {
  const now = Date.now()
  const runs = Array.from({ length: 6 }, (_, i) => now - (18 - i * 2) * 60 * 1000)
  writeDb({ version: 1, sessions: { 's-capped': { play: false, runs, lastKey: null } } })
  const r = await call(routes.get('/plugins/advisor/play'), { method: 'POST', body: { sessionId: 's-capped', on: true } })
  assert.equal(r.status, 429)
  assert.match(r.json.message, /سقفِ ۶ اجرا در ساعت پر شد/)
  // ساعت فارسی است؛ با همان ارقامِ فارسی می‌سنجیم (نه \d که فقط لاتین است).
  assert.match(r.json.message, /ساعتِ [۰-۹]{2}:[۰-۹]{2} دوباره کار می‌کند/)
  assert.ok(Number.isFinite(r.json.retryAt) && r.json.retryAt > now, 'زمانِ بازشدن باید در آینده باشد')
  assert.equal(r.json.play, false)
  assert.equal(readDb().sessions['s-capped'].play, false, 'پلی نباید روشن بماند')
})

test('play: سقف پر ولی خاموش‌کردن همیشه جواب می‌دهد', async () => {
  const now = Date.now()
  const runs = Array.from({ length: 6 }, (_, i) => now - (18 - i * 2) * 60 * 1000)
  writeDb({ version: 1, sessions: { 's-capped2': { play: true, runs, lastKey: null } } })
  const r = await call(routes.get('/plugins/advisor/play'), { method: 'POST', body: { sessionId: 's-capped2', on: false } })
  assert.equal(r.status, 200)
  assert.equal(r.json.play, false)
})

test('play: زیرِ سقف ⇒ روشن می‌شود و تعدادِ اجرای باقی‌مانده را هم می‌گوید', async () => {
  const now = Date.now()
  writeDb({ version: 1, sessions: { 's-ok': { play: false, runs: [now - 60000], lastKey: null } } })
  const r = await call(routes.get('/plugins/advisor/play'), { method: 'POST', body: { sessionId: 's-ok', on: true } })
  assert.equal(r.status, 200)
  assert.equal(r.json.play, true)
  assert.equal(r.json.quota.hour, 1)
  assert.equal(r.json.quota.maxHour, 6)
})

test('state: وقتی پلی روشن است و سقف پر، پنل علت + زمانِ «کی دوباره» را می‌گیرد', async () => {
  const now = Date.now()
  const runs = Array.from({ length: 6 }, (_, i) => now - (18 - i * 2) * 60 * 1000)
  writeDb({ version: 1, sessions: { 's-idle': { play: true, runs, lastKey: null } } })
  const r = await call(routes.get('/plugins/advisor/state'), { url: '/plugins/advisor/state?sessionId=s-idle' })
  assert.equal(r.status, 200)
  assert.ok(r.json.playIdle, 'پنل باید بگوید چرا پلی کاری نمی‌کند')
  assert.equal(r.json.playIdle.kind, 'quota')
  assert.match(r.json.playIdle.reason, /سقفِ ۶ اجرا در ساعت پر شد/)
  assert.ok(r.json.playIdle.retryAt > now)
})

test('state: پلی خاموش ⇒ هیچ پیامِ «پلی کاری نکرد» داده نمی‌شود', async () => {
  const now = Date.now()
  const runs = Array.from({ length: 6 }, () => now - 60000)
  writeDb({ version: 1, sessions: { 's-off': { play: false, runs, lastKey: null } } })
  const r = await call(routes.get('/plugins/advisor/state'), { url: '/plugins/advisor/state?sessionId=s-off' })
  assert.ok(!r.json.playIdle, 'پلی خاموش است ⇒ پیامی نباید باشد')
  assert.equal(r.json.quota.blocked, true)
})

// باگ: playSkipReason نوشته می‌شد و هیچ‌جا پاک نمی‌شد ⇒ پنل تا ابد «⏳ پلی رد کرد» با علتِ کهنه نشان می‌داد.
test('state: علتِ ردِ کهنه بعد از یک اجرای موفق پاک می‌شود (نه تا ابد)', async () => {
  writeDb({ version: 1, sessions: { 's-stale': { play: true, runs: [], lastKey: null, playSkipReason: 'سقفِ ۶ اجرا در ساعت پر شد؛ ساعتِ ۱۰:۰۰ دوباره کار می‌کند', playSkippedAt: Date.now() - 60000 } } })
  // هنوز کهنه است ⇒ پیام دیده می‌شود
  const before = await call(routes.get('/plugins/advisor/state'), { url: '/plugins/advisor/state?sessionId=s-stale' })
  assert.equal(before.json.playIdle && before.json.playIdle.kind, 'skipped')
  // یک اجرای موفقِ کامل با fetch جعلی (بی تماسِ واقعی) ⇒ علتِ کهنه باید برود
  await executeRun('s-stale', { play: false, rows: rowsForRun(), fetchImpl: fakeFetchOk() })
  const after = await call(routes.get('/plugins/advisor/state'), { url: '/plugins/advisor/state?sessionId=s-stale' })
  assert.equal(after.json.playSkipReason, null, 'علتِ رد باید پاک شود')
  assert.equal(after.json.playSkippedAt, null)
  assert.equal(after.json.playIdle, null, 'بعد از اجرای موفق هیچ پیامِ کهنه‌ای نباید بماند')
})

test('play: عوض‌کردنِ پلی علتِ ردِ کهنه را پاک می‌کند', async () => {
  writeDb({ version: 1, sessions: { 's-toggle': { play: false, runs: [], lastKey: null, playSkipReason: 'سقفِ ۶ اجرا در ساعت پر شد؛ ساعتِ ۱۰:۰۰ دوباره کار می‌کند', playSkippedAt: Date.now() - 60000 } } })
  const on = await call(routes.get('/plugins/advisor/play'), { method: 'POST', body: { sessionId: 's-toggle', on: true } })
  assert.equal(on.status, 200)
  assert.equal(readDb().sessions['s-toggle'].playSkipReason, null)
  assert.equal(readDb().sessions['s-toggle'].playSkippedAt, null)
})

test('سرور: سه حالت، حالتِ نامعلوم رد', async () => {
  const ok = await call(routes.get('/plugins/advisor/server'), { method: 'POST', body: { sessionId: 's-9', mode: 'no-cache' } })
  assert.equal(ok.json.mode, 'no-cache')
  assert.equal(readDb().sessions['s-9'].serverMode, 'no-cache')
  const bad = await call(routes.get('/plugins/advisor/server'), { method: 'POST', body: { sessionId: 's-9', mode: 'free' } })
  assert.equal(bad.status, 400)
})

test('POST فقط: GET روی run ⇒ 405', async () => {
  const r = await call(routes.get('/plugins/advisor/run'), { method: 'GET' })
  assert.equal(r.status, 405)
})

test('نوعِ بدنه: text/plain ⇒ 415', async () => {
  const r = await call(routes.get('/plugins/advisor/run'), { method: 'POST', body: {}, headers: { 'content-type': 'text/plain' } })
  assert.equal(r.status, 415)
})

test('سد: درخواستِ cross-site ⇒ 403 روی همهٔ مسیرها', async () => {
  for (const p of ['state', 'run', 'play', 'server']) {
    const r = await call(routes.get('/plugins/advisor/' + p), { method: 'POST', body: { sessionId: 's-9' }, headers: { 'sec-fetch-site': 'cross-site' } })
    assert.equal(r.status, 403, p)
  }
})

test('پاک‌سازی', () => {
  fs.rmSync(dir, { recursive: true, force: true })
  assert.ok(true)
})