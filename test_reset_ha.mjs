// node test_reset_ha.mjs [path to reset_ha.mjs]   fixtures only: no browser, no notification
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
const FILE = process.argv[2] || new URL('./reset_ha.mjs', import.meta.url).pathname
const R = await import(FILE)
const alan = Date.UTC(2026, 10, 11, 20, 0)
// «Dec 11, 1:30 AM GMT+3:30» is Dec 10 22:00 UTC, i.e. Thursday night in Tehran
assert.equal(R.tarikh('Expires Dec 11, 1:30 AM GMT+3:30', alan), Date.UTC(2026, 11, 10, 22, 0))
assert.equal(R.tarikh('Expires Jan 3, 11:05 PM GMT+3:30', alan), Date.UTC(2027, 0, 3, 19, 35), 'next year')
assert.equal(R.tarikh('soon', alan), null)
assert.match(R.mohlat_fa(Date.UTC(2026, 11, 10, 22, 0)), /جمعه ۲۰ آذر.*پنجشنبه ۱۹ آذر/)
const claude = { txt: 'Usage\nThis week\n\nResets Monday 12:30 PM\n52% used\n', dokme: [{ label: 'Reset for free', tooltip: 'Weekly reset | Expires Dec 11, 1:30 AM GMT+3:30' }, { label: 'Reset for free', tooltip: '' }] }
const chatgpt = { txt: 'Usage\nWeekly limit\nResets in 4d 4h\n46% left\nUsage limit resets\nUse a reset\nAvailable\n1\nHistory\nFull reset\nExpires Dec 2, 2:05 AM GMT+3:30\nUse reset\nCredits\n0 credits' }
const c = R.estekhraj_claude(claude, alan), g = R.estekhraj_chatgpt(chatgpt, alan)
assert.equal(c.ha.filter((h) => h.mohlat).length, 1); assert.equal(c.vaz, '52% used، Resets Monday 12:30 PM')
assert.deepEqual(g.ha.map(R.shenase), ['chatgpt|Expires Dec 2, 2:05 AM GMT+3:30']); assert.match(g.vaz, /ریستِ موجود: 1/)
assert.equal(R.estekhraj_chatgpt({ txt: 'Log in\nSign up' }, alan).vaz, '', 'a login page has no state')

// whole runs, each in its own process
const D = mkdtempSync(join(tmpdir(), 'reset-ha-'))
const run = (safhe, extra = {}) => {
  writeFileSync(join(D, 'safhe.json'), JSON.stringify(safhe))
  try { execFileSync(process.execPath, [FILE], { env: { ...process.env, RESET_SAFHE: join(D, 'safhe.json'), RESET_DIDE: join(D, 'dide.json'), RESET_GOZARESH_DIR: join(D, 'out'), RESET_LOG: join(D, 'log'), RESET_ALARM_DIR: join(D, 'alarm'), RESET_ALAN: String(alan), RESET_AZMUN: '1', ...extra } }) } catch (e) { return e.status }
  return 0
}
const log = () => readFileSync(join(D, 'log'), 'utf8')
assert.equal(run({ claude, chatgpt }), 0)
assert.match(log(), /🆕 ریستِ تازه: .*Claude.*ChatGPT/s, 'first sight of both is news')
assert.equal(readdirSync(join(D, 'alarm')).filter((f) => f.endsWith('.json')).length, 2, 'one alarm entry each')
assert.equal(run({ claude, chatgpt }), 0); assert.match(log().split('\n').filter(Boolean).at(-2) + log().split('\n').filter(Boolean).at(-1), /تازه‌ای نبود/, 'second day: nothing new, and said so')
// the ChatGPT reset is gone: not dropped on the first miss (a tooltip may fail once), dropped on the second
const bi = { claude, chatgpt: { txt: chatgpt.txt.replace('Available\n1', 'Available\n0').replace('Full reset\nExpires Dec 2, 2:05 AM GMT+3:30\n', '') } }
run(bi); assert.equal(readdirSync(join(D, 'alarm')).filter((f) => f.endsWith('.json')).length, 2, 'first miss keeps the alarm')
run(bi); assert.equal(readdirSync(join(D, 'alarm')).filter((f) => f.endsWith('.json')).length, 1, 'second miss drops it'); assert.match(log(), /⏹ دیگر نیست: ChatGPT/)
// a page that was not read is an error, and its resets are not called gone
assert.equal(run({ claude: { txt: 'Log in' }, chatgpt: bi.chatgpt }), 1); assert.match(log(), /❌ صفحهٔ Usage ِ Claude خوانده نشد/)
assert.ok(!JSON.parse(readFileSync(join(D, 'dide.json'), 'utf8')).ha['claude|Expires Dec 11, 1:30 AM GMT+3:30'].raft)
assert.ok(existsSync(join(D, 'out')))
console.log('reset_ha: ok')
