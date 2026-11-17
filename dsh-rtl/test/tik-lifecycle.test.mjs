import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { Readable } from 'node:stream'
import { apply, tikFile } from '../index.js'

// Drive the same HTTP and lifecycle entry points as the Desktop plugin, without
// touching a real session, opening an app or sending anything to a model.
function host(existing = []) {
  const routes = new Map(), listeners = new Map(), cleanup = []
  const agents = new Map(existing.map(a => [a.session.id, a]))
  const registry = {
    list: () => [...agents.values()], get: id => agents.get(id),
    turnBoundaryOf: session => ({ lastTurn: session.turns }),
  }
  apply({
    logger: { warn: () => {}, info: () => {} },
    get: key => key === 'agents' ? registry : undefined,
    inject: (deps, callback) => callback(deps.includes('webServer') ? {
      webServer: { register: r => routes.set(r.path, r.handler) }, effect: fn => fn(),
    } : { on: (e, f) => listeners.set(e, f), effect: fn => cleanup.push(fn()) }),
  })
  return {
    enter(agent, source) { agents.set(agent.session.id, agent); listeners.get('agent/created')({ agent, source }) },
    stop() { for (const release of cleanup) release() },
    async call(method, agent, level, on, name = 'web_search') {
      const args = { sessionId: agent.session.id, cwd: agent.session.header.cwd, sath: level }
      const req = Readable.from([Buffer.from(JSON.stringify({ ...args, taghir: [{ kind: 'abzar_dsh', name, on }] }))])
      req.url = '/plugins/rtl/tik?' + new URLSearchParams(args)
      req.method = method
      req.headers = { host: 'localhost', 'content-type': 'application/json' }
      let result
      const res = { setHeader() {}, end(body) { result = { status: this.statusCode, ...JSON.parse(body) } } }
      await routes.get('/plugins/rtl/tik')(req, res)
      return result
    },
  }
}

function agent(id, createdAt = Date.now(), turns = 0) {
  const masks = new Set()
  return {
    session: { id, turns, header: { createdAt, cwd: process.cwd() } },
    status: 'idle', inbox: { nextTurn: [] },
    ctx: { tools: {
      definitions: () => [{ name: 'web_search' }, { name: 'bash' }],
      restrict(mask) { masks.add(mask); return () => masks.delete(mask) },
    } },
    canSearch: () => ![...masks].some(m => m.deny.includes('web_search')),
  }
}

function scratch(t) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tik-lifecycle-'))
  t.mock.method(os, 'homedir', () => tmp)
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }))
  return tmp
}

test('folder edits preserve old chats across resume; draft changes apply and can be undone', async t => {
  scratch(t)
  let h = host()
  const old = agent('old'), blank = agent('blank')
  h.enter(old, 'startup')
  old.session.turns = 1
  h.enter(blank, 'startup')
  assert.equal((await h.call('POST', old, 'poshe', false)).status, 200)
  assert.equal(old.canSearch(), true, 'saving a default from an old chat must not take its tool')
  assert.equal(blank.canSearch(), true, 'previously opened sibling stays untouched')
  assert.equal((await h.call('POST', old, 'chat', false)).status, 409)
  assert.equal((await h.call('GET', old, 'chat')).chatLocked, true)
  await h.call('POST', blank, 'chat', false, 'bash')
  assert.equal(blank.canSearch(), true, 'changing one draft tick must keep its other original ticks')
  const inherited = agent('inherited')
  h.enter(inherited, 'startup')
  inherited.session.turns = 1
  const next = agent('next')
  h.enter(next, 'startup')
  assert.equal(next.canSearch(), false, 'a later chat inherits the new folder tick')
  assert.equal((await h.call('POST', next, 'chat', true)).status, 200)
  assert.equal(next.canSearch(), true, 'an explicit draft edit releases the prior restriction')
  await h.call('POST', next, 'chat', false)
  assert.equal(next.canSearch(), false)
  next.session.turns = 1
  await h.call('POST', old, 'poshe', true)
  assert.equal(next.canSearch(), false, 'another chat cannot change this one')
  h.stop()

  h = host()
  const resumedOld = agent('old', old.session.header.createdAt, 1)
  const resumedNext = agent('next', next.session.header.createdAt, 1)
  const resumedInherited = agent('inherited', inherited.session.header.createdAt, 1)
  h.enter(resumedOld, 'resume')
  h.enter(resumedNext, 'resume')
  h.enter(resumedInherited, 'resume')
  assert.equal(resumedOld.canSearch(), true)
  assert.equal(resumedNext.canSearch(), false, 'restore uses the saved policy after a restart')
  assert.equal(resumedInherited.canSearch(), false, 'restore retains inherited ticks despite later relaxed defaults')
  h.stop()
})

test('loading the plugin around existing chats cannot apply a later default', async t => {
  const home = scratch(t)
  const old = agent('legacy', 1000, 2)
  fs.mkdirSync(path.dirname(tikFile(home)), { recursive: true })
  fs.writeFileSync(tikFile(home), JSON.stringify({ kooch: 2000, sarasari: { abzar_dsh: { web_search: false } } }))
  const h = host([old])
  assert.equal(old.canSearch(), true, 'the old chat predates the only known default')
  const next = agent('fresh')
  h.enter(next, 'startup')
  assert.equal(next.canSearch(), false)
  const queued = agent('queued')
  h.enter(queued, 'startup')
  queued.inbox.nextTurn.push('pending')
  assert.equal((await h.call('POST', queued, 'chat', true)).status, 409)
  h.stop()
})
