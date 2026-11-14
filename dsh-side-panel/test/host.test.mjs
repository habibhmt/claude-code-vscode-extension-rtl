import { apply, name, inject } from '../index.js'

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
