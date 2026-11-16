/**
 * Claude Code ⇄ DeepSeek Harness, one setup — Host half: MCP servers.
 *
 * Habib, 16 Nov 2026: «ستینگ ام سی پی ها … اینجا بگیره از همون کلود کد»; window answer «بله، فقط سراسری»:
 * every server in the global `mcpServers` of ~/.claude.json (the one Claude Code reads for every folder) is
 * registered here under the same name, and follows that file: a server added, changed or removed there is added,
 * rebuilt or removed here within a few seconds. Folder-only servers (`projects[<dir>].mcpServers`) are left out on
 * purpose: DSH's MCP manager is one fleet for every chat.
 *
 * Mapping (Claude Code ⇒ dsh-mcp-manager):
 *   type stdio (or no type) + command/args/env ⇒ transport stdio
 *   type http + url/headers                    ⇒ transport streamable-http
 *   type sse                                   ⇒ skipped (the manager has no SSE transport)
 * Registrations are not written to any file; values stay in memory (a server's env may hold a key).
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export const name = 'claude-yeki-mcp'
export const inject = ['mcpManager']

const NAME = /^[A-Za-z0-9_-]{1,32}$/

function shey(o) { return o && typeof o === 'object' && !Array.isArray(o) ? o : {} }
function reshte_ha(a) { return Array.isArray(a) ? a.filter((x) => typeof x === 'string') : [] }
function naghshe_reshte(o) {
  const out = {}
  for (const [k, v] of Object.entries(shey(o))) if (typeof v === 'string') out[k] = v
  return out
}

/** Claude Code's global servers ⇒ { entries: {name: registration}, skipped: [{name, why}] }. */
export function az_claude(json) {
  const entries = {}, skipped = []
  for (const [esm, s0] of Object.entries(shey(shey(json).mcpServers))) {
    const s = shey(s0)
    const type = typeof s.type === 'string' ? s.type : (s.url ? 'http' : 'stdio')
    if (!NAME.test(esm)) { skipped.push({ name: esm, why: 'name must be 1-32 of A-Z a-z 0-9 _ -' }); continue }
    if (type === 'stdio') {
      if (typeof s.command !== 'string' || !s.command) { skipped.push({ name: esm, why: 'no command' }); continue }
      const e = { transport: 'stdio', command: s.command, args: reshte_ha(s.args) }
      const env = naghshe_reshte(s.env)
      if (Object.keys(env).length) e.env = env
      if (typeof s.cwd === 'string' && s.cwd) e.cwd = s.cwd
      entries[esm] = e
    } else if (type === 'http' || type === 'streamable-http') {
      if (typeof s.url !== 'string' || !s.url) { skipped.push({ name: esm, why: 'no url' }); continue }
      const e = { transport: 'streamable-http', url: s.url }
      const headers = naghshe_reshte(s.headers)
      if (Object.keys(headers).length) e.headers = headers
      entries[esm] = e
    } else skipped.push({ name: esm, why: `transport ${type} is not supported` })
  }
  return { entries, skipped }
}

export function apply(ctx, config) {
  const file = (config && config.file) || path.join(os.homedir(), '.claude.json')
  const pollMs = Math.max(1000, Number(config && config.pollMs) || 3000)
  const live = new Map() // name → { key, dispose }
  let akharin = null

  function hamahang() {
    let json
    try { json = JSON.parse(fs.readFileSync(file, 'utf8')) } catch (err) {
      // a half-written file (Claude Code rewrites it often): keep what is registered, try again on the next change
      if (err && err.code !== 'ENOENT') ctx.logger?.warn?.(`claude-yeki: ${file} unreadable now: ${err.message}`)
      if (err && err.code !== 'ENOENT') return
      json = {}
    }
    const { entries, skipped } = az_claude(json)
    const key = JSON.stringify(entries)
    if (key === akharin) return
    akharin = key
    for (const [esm, r] of live) {
      if (!(esm in entries) || r.key !== JSON.stringify(entries[esm])) { r.dispose(); live.delete(esm) }
    }
    for (const [esm, e] of Object.entries(entries)) {
      if (live.has(esm)) continue
      try {
        live.set(esm, { key: JSON.stringify(e), dispose: ctx.mcpManager.register(esm, e) })
        ctx.logger?.info?.(`claude-yeki: MCP server "${esm}" from Claude Code registered`)
      } catch (err) {
        ctx.logger?.warn?.(`claude-yeki: MCP server "${esm}" not registered: ${err && err.message || err}`)
      }
    }
    for (const s of skipped) ctx.logger?.warn?.(`claude-yeki: MCP server "${s.name}" skipped: ${s.why}`)
  }

  ctx.effect(() => {
    hamahang()
    const listener = () => hamahang()
    fs.watchFile(file, { interval: pollMs, persistent: false }, listener)
    return () => {
      fs.unwatchFile(file, listener)
      for (const r of live.values()) { try { r.dispose() } catch {} }
      live.clear()
    }
  }, 'claude-yeki MCP sync')
}
