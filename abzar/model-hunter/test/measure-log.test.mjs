import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import zlib from 'node:zlib'
import { recentLogsAsync } from '../measure.js'

function responseFrame(id, time) {
  const event = { type: 'assistant/message', time, data: { message: { source: {
    model: 'test-model', replayState: { response: { responseId: id } },
  } } } }
  const input = Buffer.from(JSON.stringify(event) + '\n')
  return zlib.zstdCompressSync ? zlib.zstdCompressSync(input) : execFileSync('zstd', ['-qc'], { input })
}

test('خواندن چند قابِ لاگ، رویدادهای پنجره را منتظر نمی‌گذارد', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'model-hunter-log-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const dir = path.join(root, 'project', 'session-test')
  fs.mkdirSync(dir, { recursive: true })
  const frames = [responseFrame('gen-first', 1), responseFrame('gen-second', 2)]
  // The host can read a live file between two writes to its last frame.
  const partial = responseFrame('gen-unfinished', 3).subarray(0, 5)
  fs.writeFileSync(path.join(dir, 'session.v4.jsonl.zstd'), Buffer.concat([...frames, partial]))

  let handled = false
  const event = setImmediate(() => { handled = true })
  t.after(() => clearImmediate(event))
  const result = await recentLogsAsync({ root })
  assert.equal(handled, true, 'the window must get a turn while logs are read')
  assert.deepEqual(result['session-test'].map(row => row.id), ['gen-first', 'gen-second'])
})
