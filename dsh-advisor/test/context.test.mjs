import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'

process.env.DSH_ADVISOR_STATE_DIR = path.join(os.tmpdir(), 'advisor-ctx-test-' + process.pid)
const { contextLimit } = await import('../index.js')

function fakeFetch(endpoints, seen) {
  return async (url) => {
    seen.push(String(url))
    return { json: async () => ({ data: { endpoints } }) }
  }
}

const ENDPOINTS = [
  { provider_name: 'Baidu', tag: 'baidu/fp8', context_length: 1048576 },
  { provider_name: 'StreamLake', tag: 'streamlake/fp8', context_length: 1024000 },
  { provider_name: 'Venice', tag: 'venice', context_length: 1000000 },
]

test('حدِ زمینه: همان سرورِ انتخاب‌شده، نه همیشه دیپ‌اینفرا', async () => {
  const seen = []
  const limit = await contextLimit(fakeFetch(ENDPOINTS, seen), { model: 'deepseek/deepseek-v4-flash', provider: 'StreamLake', providerSlug: 'streamlake' })
  assert.equal(limit, 1024000)
  assert.match(seen[0], /\/models\/deepseek\/deepseek-v4-flash\/endpoints$/)
})

test('حدِ زمینه: سرور پیدا نشد ⇒ کوچک‌ترینِ همه (امن)', async () => {
  const limit = await contextLimit(fakeFetch(ENDPOINTS, []), { model: 'deepseek/deepseek-v4-flash', provider: 'Nobody', providerSlug: 'nobody' })
  assert.equal(limit, 1000000)
})

test('حدِ زمینه: پسوندِ پریست و :batch از نامِ مدل در نشانی حذف می‌شود', async () => {
  const seen = []
  await contextLimit(fakeFetch(ENDPOINTS, seen), { model: 'deepseek/deepseek-v4.1-flash-1017:batch', provider: 'Baidu', providerSlug: 'baidu' })
  await contextLimit(fakeFetch(ENDPOINTS, seen), { model: 'deepseek/deepseek-v4.1-flash-1017@preset/mh-x', provider: 'Venice', providerSlug: 'venice' })
  for (const url of seen) assert.match(url, /\/models\/deepseek\/deepseek-v4\.1-flash-1017\/endpoints$/)
})
