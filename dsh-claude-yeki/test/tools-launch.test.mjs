import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import net from 'node:net'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import host from '../history-host.cjs'

test('VS Code adds the local MCP only for its trusted, matching chat and project', async t => {
  const temp = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'aa-')))
  const cwd = path.join(temp, 'workspace')
  const id = randomUUID(), bindingPath = path.join(temp, 'binding.json')
  const pointerPath = path.join(temp, id + '.json'), socket = path.join(temp, 's')
  const script = fileURLToPath(new URL('../tools-stdio.mjs', import.meta.url))
  await fs.mkdir(cwd)
  const server = net.createServer()
  await new Promise((resolve, reject) => server.once('error', reject).listen(socket, resolve))
  t.after(async () => {
    await new Promise(resolve => server.close(resolve))
    await fs.rm(temp, { recursive: true, force: true })
  })
  await fs.chmod(socket, 0o600)
  const pointer = { sessionId: 'session-' + id, cwd, stdio: script, bindingFile: bindingPath }
  await fs.writeFile(pointerPath, JSON.stringify(pointer), { mode: 0o600 })
  await fs.writeFile(bindingPath, JSON.stringify({ sessionId: pointer.sessionId, cwd, socket }), { mode: 0o600 })
  const local = { type: 'sdk', name: 'existing' }
  function start(session = id, project = cwd, trusted = true) {
    const options = { cwd: project, mcpServers: { existing: local } }
    host.launch(session, options, temp, trusted, temp)
    assert.equal(options.mcpServers.existing, local)
    return options.mcpServers.dsh_yeki
  }
  assert.deepEqual(start().args, [script, pointerPath, id, cwd])
  assert.equal(start(id, cwd, false), undefined)
  assert.equal(start(randomUUID()), undefined)
  assert.equal(start(id, temp), undefined)
  await fs.chmod(bindingPath, 0o644)
  assert.equal(start(), undefined)
  await fs.chmod(bindingPath, 0o600)
  await fs.writeFile(pointerPath, JSON.stringify({ ...pointer, stdio: '/tmp/some-other-script' }))
  assert.equal(start(), undefined)

  // The native tab is already open when Desktop restores this chat.
  await fs.rm(pointerPath)
  await fs.mkdir(path.join(temp, 'dsh-history'))
  await fs.writeFile(path.join(temp, 'dsh-history/workspaces.json'), JSON.stringify([{path:cwd,sessions:[id]}]))
  const channel = { cwd, mcpServers: { existing:local } }, changes = []
  let posture = 'withheld'
  const owner = {
    channels:new Map([['native-tab', channel]]),
    workspaceTrust:{ async postureFor(_cwd, opts) { assert.equal(opts.mayAsk,false); return {kind:posture} } },
    async setChannelMcpServers(ch, change) { ch.mcpServers = change(ch.mcpServers); changes.push(ch.mcpServers) },
  }
  const stop = host.watchToolChannel(owner, 'native-tab', channel, {home:temp,bindingDir:temp,interval:15})
  t.after(stop)
  const until = async condition => {
    const end = Date.now()+2500
    while (!condition() && Date.now()<end) await new Promise(resolve=>setTimeout(resolve,12))
    assert.ok(condition())
  }
  channel.sessionId = id
  await fs.writeFile(pointerPath, JSON.stringify(pointer), { mode:0o600 })
  await new Promise(resolve=>setTimeout(resolve,85))
  assert.equal(changes.length, 0)
  posture = 'trusted'
  await until(()=>!!channel.mcpServers.dsh_yeki)
  assert.equal(channel.mcpServers.existing, local)
  assert.deepEqual(channel.mcpServers.dsh_yeki.args, [script,pointerPath,id,cwd])
  channel.sessionId = randomUUID()
  await until(()=>!channel.mcpServers.dsh_yeki)
  assert.deepEqual(channel.mcpServers, {existing:local})
  assert.equal(changes.length, 2)
})
