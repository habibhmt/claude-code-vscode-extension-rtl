// MCP servers from Claude Code's ~/.claude.json (Habib, 16 Nov 2026, «بله، فقط سراسری»).
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { az_claude, apply } from '../index.js'

test('global servers map to the manager; folder-only, sse and bad names stay out', () => {
  const r = az_claude({
    mcpServers: {
      hafeze: { type: 'stdio', command: '/x/hafeze_mcp.py', args: [], env: [] },
      gh: { type: 'http', url: 'https://h/mcp', headers: { Authorization: 'Bearer k' } },
      old: { type: 'sse', url: 'https://s' },
      'bad name': { command: 'x' },
      nocmd: { type: 'stdio' },
      plain: { command: 'npx', args: ['-y', 'm', 3], env: { A: 'b', N: 1 } },
    },
    projects: { '/p': { mcpServers: { local: { command: 'y' } } } },
  })
  assert.deepEqual(r.entries, {
    hafeze: { transport: 'stdio', command: '/x/hafeze_mcp.py', args: [] },
    gh: { transport: 'streamable-http', url: 'https://h/mcp', headers: { Authorization: 'Bearer k' } },
    plain: { transport: 'stdio', command: 'npx', args: ['-y', 'm'], env: { A: 'b' } },
  })
  assert.deepEqual(r.skipped.map((x) => x.name).sort(), ['bad name', 'nocmd', 'old'])
})

test('follows the file: add, change, remove, and a half-written file keeps what is there', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'yeki-'))
  const file = path.join(dir, '.claude.json')
  const write = (o) => fs.writeFileSync(file, typeof o === 'string' ? o : JSON.stringify(o))
  write({ mcpServers: { a: { command: 'one' } } })
  const live = new Map(), log = []
  const cleanups = []
  const ctx = {
    logger: { info: () => {}, warn: (m) => log.push(m) },
    effect: (fn) => { cleanups.push(fn()) },
    mcpManager: {
      register(name, e) {
        if (live.has(name)) throw new Error('taken')
        live.set(name, e)
        return () => live.delete(name)
      },
    },
  }
  apply(ctx, { file, pollMs: 1000 })
  assert.deepEqual([...live.keys()], ['a'])
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))
  write({ mcpServers: { a: { command: 'two' }, b: { type: 'http', url: 'https://b' } } })
  await wait(2500)
  assert.deepEqual(Object.fromEntries(live), { a: { transport: 'stdio', command: 'two', args: [] }, b: { transport: 'streamable-http', url: 'https://b' } })
  write('{"mcpServers": {')
  await wait(2500)
  assert.deepEqual([...live.keys()].sort(), ['a', 'b'])
  write({ mcpServers: { b: { type: 'http', url: 'https://b' } } })
  await wait(2500)
  assert.deepEqual([...live.keys()], ['b'])
  cleanups.forEach((c) => c())
  assert.equal(live.size, 0)
  fs.rmSync(dir, { recursive: true, force: true })
})
