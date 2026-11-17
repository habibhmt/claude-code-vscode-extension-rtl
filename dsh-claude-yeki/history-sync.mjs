import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { claudeProjectDirectory, claudeSessionId, publishDsh } from './history-claude.mjs'
import { fromClaude, liveAppendInputs, readClaudeTranscript } from './history-dsh.mjs'
import { nativeChoice, syncChoice } from './history-model.mjs'

const UUID = /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i
const ENOENT = error => error?.code === 'ENOENT'

async function readJson(file, fallback) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')) } catch (error) {
    if (ENOENT(error)) return fallback
    throw error
  }
}
async function stat(file) {
  try { return await fs.stat(file) } catch (error) { if (ENOENT(error)) return null; throw error }
}
async function entries(dir) {
  try { return await fs.readdir(dir, { withFileTypes: true }) } catch (error) { if (ENOENT(error)) return []; throw error }
}
async function writeState(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true, mode: 0o700 })
  const tmp = file + '.' + randomUUID() + '.tmp'
  try {
    await fs.writeFile(tmp, JSON.stringify(value) + '\n', { flag: 'wx', mode: 0o600 })
    await fs.rename(tmp, file)
  } finally { await fs.rm(tmp, { force: true }) }
}
function alive(pid) {
  if (!Number.isSafeInteger(pid) || pid < 1) return false
  try { process.kill(pid, 0); return true } catch (error) { return error.code === 'EPERM' }
}

async function nativeOwners(home) {
  const owners = new Set()
  for (const file of await entries(path.join(home, 'sessions'))) {
    if (!file.isFile() || !file.name.endsWith('.json')) continue
    let record
    try { record = await readJson(path.join(home, 'sessions', file.name), null) } catch { continue }
    if (record?.sessionId && record.status !== 'idle' && alive(record.pid)) owners.add(record.sessionId)
  }
  return owners
}
async function readEvents(store, sid, offset = 0) {
  const handle = await store.open(sid, 'read')
  try { return (await handle.read(offset)).events } finally { await handle.close() }
}
function lastTitle(events) {
  return events.findLast(event => event.type === 'session/title')?.data?.title
}
function busy(agent) {
  return !!agent && (agent.status === 'running' || agent.inbox?.nextTurn?.length > 0)
}
function version(st) {
  return st ? [st.ino, st.size, st.mtimeMs, st.ctimeMs].join('/') : ''
}

// All DSH mutations go through its active Session or an exclusive persistence handle.
// Claude's files are append-only. Delayed outbound rows stay in DSH until ownership is free.
export function sharedHistory(ctx, options = {}) {
  const home = options.claudeHome || process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude')
  const dir = path.join(home, 'dsh-history')
  const observed = new Map()
  const errors = new Map()
  const store = ctx.sessionPersistence
  const scopeFile = path.join(dir, 'workspaces.json')
  async function pair(workspace, uuid, owners) {
    const cwd = workspace.path
    const file = path.join(claudeProjectDirectory(cwd, home), uuid + '.jsonl')
    const sid = workspace.sessionIds.find(id => id === uuid || id === 'session-' + uuid) || 'session-' + uuid
    const agent = ctx.agents.get(sid)
    const live = ctx.sessions.get(sid)
    const [native, disk] = await Promise.all([stat(file), store.stat(sid)])
    if (!native && !live && !disk) return
    if (disk?.header.cwd && disk.header.cwd !== cwd || live?.header.cwd && live.header.cwd !== cwd) return
    const chosen = await nativeChoice(home, uuid, cwd)
    const token = [version(native), live ? live.seq : JSON.stringify(disk?.revision), owners.has(uuid), agent?.status || 'cold', chosen.time, chosen.value,chosen.effortTime,chosen.effort].join(':')
    if (observed.get(file) === token) return
    const statePath = path.join(dir, 'links', uuid + '.json')
    const state = await readJson(statePath, { cwd, sid, outbound: 0, tail: null })
    if (state.cwd !== cwd || state.sid !== sid) throw Error('Session identity is already linked to another workspace')
    if (state.outbound > (live?.seq ?? disk?.eventCount ?? Infinity)) throw Error('DSH history is shorter than its saved position')
    const nativeChanged = !!native && (state.nativeVersion !== version(native) || !state.toolReferencesChecked)
    let prior, view, added = 0
    let current = live
    if (nativeChanged) {
      view = await readClaudeTranscript(file, uuid, cwd)
      if (!view) return
      prior = current ? current.snapshotEvents() : disk ? await readEvents(store, sid) : []
      const independent = prior.some(e => e.type === 'user/message' && e.data.source?.kind === 'user' &&
        !String(e.data.id || '').startsWith('claude-history:'))
      if (independent && !view.bridgeOwned && !state.source) {
        throw Error('Both programs already have independent history for this UUID')
      }
      if (state.tail && state.tail !== view.tail && !view.branch.some(row => row.uuid === state.tail)) {
        throw Error('The selected Claude branch diverged; the source files were preserved')
      }
      if (busy(ctx.agents.get(sid)) || owners.has(uuid)) return
      let delta = fromClaude(view, { sessionId: sid, prior })
      if (!disk && !current && !delta.length) return
      if (delta.length || (!disk && !current)) {
        current = ctx.sessions.get(sid)
        if (current) {
          if (busy(ctx.agents.get(sid)) || current.seq !== prior.length) return
          current.append(liveAppendInputs(delta))
          await store.flush()
        } else {
          const time = Date.parse(view.branch[0]?.timestamp)
          const header = disk?.header || { version: 4, id: sid, cwd, isSeeded: false, createdAt: Number.isFinite(time) ? time : Date.now() }
          const handle = disk ? await store.open(sid, 'write') : await store.create(header)
          try {
            if (disk && (await handle.read(prior.length, 1)).events.length) return
            await handle.append(delta)
            await handle.flush()
          } finally { await handle.close() }
          ctx.get?.('sessionProjectionCache')?.coldSnapshot(header, 0, [...prior, ...delta])
        }
        added = delta.length
      }
      if (!workspace.sessionIds.includes(sid)) await workspace.attachSession(sid)
      state.source ||= view.bridgeOwned ? 'dsh' : 'claude'
      if (!state.firstMessageSource) {
        const firstUser = view.branch.find(r => r.type === 'user' && (typeof r.message?.content === 'string' ||
          r.message?.content?.some?.(block => block.type === 'text' || block.type === 'image')))
        if (firstUser) state.firstMessageSource = firstUser.dshSource ? 'dsh' : 'claude'
      }
      state.tail = view.tail
      state.nativeVersion = version(native)
      state.toolReferencesChecked = true
    }
    const intervalStart = state.outbound
    let outgoing
    if (current) outgoing = current.snapshotEvents(intervalStart)
    else if (disk || added) outgoing = await readEvents(store, sid, intervalStart)
    else outgoing = []
    if (outgoing.length && !owners.has(uuid)) {
      // Revalidate disk/time after awaited DSH reads; a changed native tail is consumed next pass.
      if (version(await stat(file)) !== version(native)) return
      const link = native && state.tail ? { file, sessionId: uuid, expectedTailUuid: state.tail } : null
      const published = await publishDsh({
        sessionId: sid, cwd, title: lastTitle(outgoing) || view?.title, events: outgoing,
        claudeHome: home, activeNative: false, incremental: intervalStart > 0 || !!native, link,
      })
      state.tail = published.tailUuid ?? state.tail
      state.nativeVersion = version(await stat(file))
      state.outbound += outgoing.length
      if (published.added) state.source ||= 'dsh'
    }
    if (outgoing.length && owners.has(uuid)) {
      // Inbound history remains visible while the native process owns the transcript.
      // A later dispatch publishes only outstanding DSH-origin rows once the writer releases.
      if (!nativeChanged) { observed.set(file, token); return }
    }
    const snapshot = ctx.get?.('sessionProjectionCache')
    // Opening an empty Desktop chat creates native events. Its defaults must not
    // win if the first actual message is eventually sent from VS Code.
    if (!state.firstMessageSource && (state.source || outgoing.length)) {
      const history = intervalStart === 0 ? outgoing : (prior || (current ? current.snapshotEvents() : await readEvents(store, sid)))
      const firstUser = history.find(e => e.type === 'user/message' && e.data.source?.kind === 'user')
      if (firstUser) state.firstMessageSource = String(firstUser.data.id || '').startsWith('claude-history:') ? 'claude' : 'dsh'
    }
    if (state.firstMessageSource) {
      const modelRow = await readJson(path.join(options.dshHome || path.join(os.homedir(), '.dsh'), 'storages', 'session_projcache', 'sessions', sid + '.json'), null)
      const optionsRow = modelRow?.record?.identity?.cwd === cwd && modelRow.record?.rows?.modelSelection?.val
      const next = agent?.model?.current?.() || optionsRow?.pending || optionsRow?.lastUsed || ctx.get?.('agentDefaultModel')?.currentSelection?.()
      const initialChoice = !state.confirmedOrigin && state.firstMessageSource !== state.source
      if (initialChoice) delete state.choice
      let original = chosen
      if (!state.choice && state.firstMessageSource === 'claude' && native && (!chosen.value || !chosen.explicitEffort)) {
        const transcript = view || await readClaudeTranscript(file, uuid, cwd)
        if (transcript?.selection) {
          original = { ...chosen, model:chosen.value || transcript.selection.model }
          if (!chosen.explicitEffort && Object.hasOwn(transcript.selection, 'effort')) original.effort = transcript.selection.effort
        }
      }
      await syncChoice({state, id: uuid, native: original, dsh: next, origin: state.firstMessageSource, applyDsh: async selection => {
        if (busy(ctx.agents.get(sid))) return false
        const engine = ctx.agents.get(sid)
        if (engine?.model) engine.model.select(selection)
        else if (ctx.sessions.get(sid)) ctx.sessions.get(sid).append('model/selection', selection)
        else {
          const stored = await store.stat(sid)
          if (!stored) return false
          const handle = await store.open(sid, 'write')
          try {
            const events = (await handle.read(0)).events
            const event = {seq: events.length, time: Date.now(), type:'model/selection', data:selection}
            await handle.append([event]); await handle.flush()
            snapshot?.coldSnapshot(stored.header, 0, [...events,event])
          } finally { await handle.close() }
        }
        return true
      }})
      if (state.choice) state.confirmedOrigin = true
    }
    if (!state.source && !nativeChanged && !outgoing.length) return
    await writeState(statePath, state)
    observed.set(file, token)
  }

  async function tick() {
    const config = options.workspaces ?? await readJson(scopeFile, [])
    if (!Array.isArray(config) || !config.length) return
    const owners = await nativeOwners(home)
    const workspaces = ctx.workspaceRegistry.list()
    for (const item of config) {
      const workspace = workspaces.find(w => w.path === item.path)
      if (!workspace) continue
      const ids = new Set()
      if (Array.isArray(item.sessions)) {
        for (const id of item.sessions) ids.add(claudeSessionId(id))
      } else {
        for (const dotted of workspace.sessionIds) {
          const id = String(dotted).replace(/^session-/, '')
          if (UUID.test(id)) ids.add(id)
        }
        for (const file of await entries(claudeProjectDirectory(workspace.path, home))) {
          if (file.isFile() && file.name.endsWith('.jsonl') && UUID.test(file.name.slice(0,-6))) ids.add(file.name.slice(0,-6))
        }
      }
      for (const id of ids) {
        const key = workspace.path + '/' + id
        try { await pair(workspace, id, owners); errors.delete(key) } catch (error) {
          if (errors.get(key) !== error.message) ctx.logger?.warn('history: %s: %s', id, error.message)
          errors.set(key, error.message)
        }
      }
    }
  }
  return { tick, errors }
}

export function mountSharedHistory(ctx) {
  const sync = sharedHistory(ctx)
  ctx.effect(() => {
    let stopped = false, pending, timer
    const run = () => {
      if (stopped) return
      pending = sync.tick().catch(error => ctx.logger.warn('history: %s',error.message)).finally(() => {
        if (!stopped) { timer = setTimeout(run, 1500); timer.unref?.() }
      })
    }
    timer = setTimeout(run, 100)
    return async () => { stopped = true; clearTimeout(timer); await pending }
  }, 'shared Claude and DSH conversation history')
}
