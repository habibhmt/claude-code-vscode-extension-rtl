// Fake-harness test for the hads mod: no session, no model.
import assert from 'node:assert/strict'
const mod = await import(process.env.HADS_JS || new URL('./hooks/register.js', import.meta.url))
const H = {}, calls = { complete: [], fill: [], submit: [] }
mod.register((ev, a, b) => { H[ev] = b || a; return { catch() {} } })
const store = {}
const $ = {
  model: { complete: async (o) => { calls.complete.push(o); return { isAnswered: true, text: $.reply } } },
  session: { messages: async () => $.msgs, surfaces: async () => $.surf, id: async () => $.sid },
  env: { get: async (k) => (k === 'HOME' ? '/h' : undefined) },
  ui: { invalidate() {}, resolve: () => ({ Box: (p) => ({ t: 'Box', ...p }), Text: (p) => ({ t: 'Text', ...p }), Button: (p) => ({ t: 'Button', ...p }) }) },
  prompt: { fill: async (o) => calls.fill.push(o), submit: async (o) => calls.submit.push(o), read: async () => $.typed },
  store: { get: async (k) => store[k], set: async (k, v) => { store[k] = v } },
  clock: { after: (ms, fn) => { pending.push(fn()) } },
  command: { register: async () => {} },
  fs: { write: async (f, t) => { flags[f] = t }, read: async (f) => { if (f in flags) return flags[f]; if ($.files[f] === undefined) throw new Error('no'); return $.files[f] }, list: async () => Object.keys($.files).map((k) => ({ name: k.replace('.remember/', '') })) },
}
const flags = {}
let pending = []
const flush = async () => { await Promise.all(pending); pending = [] }
const next = async (e) => e
const out = {}
$.msgs = [{ role: 'user', text: 'دکمه بساز' }, { role: 'assistant', text: 'ساختم' }]; $.surf = ['vscode']; $.typed = ''; $.files = {}
$.reply = '[{"label":"تست","text":"آزمون‌ها رو اجرا کن"},{"label":"کامیت","text":"کامیت و پوش کن"}]'
// subagent and aborted turns never call the model
await H['turn.complete']($, { agentId: 'x' }, next); await H['turn.complete']($, { isAborted: true }, next); await flush()
out.subagentOrAbort = calls.complete.length; assert.equal(out.subagentOrAbort, 0)
// a project nobody turned on stays off
await H['turn.complete']($, {}, next); await flush()
out.defaultOff = calls.complete.length; assert.equal(out.defaultOff, 0)
// on in chat A only: chat B (same folder) stays off, and A's switch is A's own file
$.sid = 'A'; await H['command.run']($, { args: 'on' })
out.flagA = flags['/h/.claude/hads-on/A']; assert.equal(out.flagA, 'on')
out.onlyOneFile = Object.keys(flags).filter((k) => k.startsWith('/h/.claude/hads-on/')).length; assert.equal(out.onlyOneFile, 1)
$.sid = 'B'; await H['turn.complete']($, {}, next); await flush()
out.otherChat = calls.complete.length; assert.equal(out.otherChat, 0)
// B turning off touches only B's file: A stays on
await H['command.run']($, { args: 'off' })
out.aAfterBOff = flags['/h/.claude/hads-on/A']; assert.equal(out.aAfterBOff, 'on')
// nothing is written into the project
out.projectFiles = Object.keys(flags).filter((k) => !k.startsWith('/h/.claude/hads-on/')).length; assert.equal(out.projectFiles, 0)
// the mod reloads (resume keeps the id): A is still on
const again = {}; mod.register((ev, a, b) => { again[ev] = b || a; return { catch() {} } })
$.sid = 'A'; out.answer = (await again['command.run']($, { args: 'on' })).text; assert.equal(out.answer, 'حدس برای همین چت روشن شد')
// a normal turn: Sonnet 5.5 by full name, then buttons
await H['turn.complete']($, {}, next); await flush()
out.model = calls.complete[0].model; assert.equal(out.model, 'claude-sonnet-5-5')
const tree = await H['ui.render']($, { component: 'AbovePrompt' }, async () => null)
const btns = tree.children[0].children.filter((c) => c.t === 'Button')
out.buttons = btns.map((b) => b.label); assert.deepEqual(out.buttons, ['تست', 'کامیت', '×'])
// after /clear (a new chat id) the old row is gone
$.sid = 'A2'; out.afterClear = await H['ui.render']($, { component: 'AbovePrompt' }, async () => 'engine'); assert.equal(out.afterClear, 'engine'); $.sid = 'A'
// a click fills the prompt, never sends
await btns[1].onPress(); out.fill = calls.fill.map((f) => f.text); out.submit = calls.submit.length
assert.deepEqual(out.fill, ['کامیت و پوش کن']); assert.equal(out.submit, 0)
// /hads off stops model calls
await H['command.run']($, { args: 'off' }); await H['turn.complete']($, {}, next); await flush()
out.afterOff = calls.complete.length; assert.equal(out.afterOff, 1)
await H['command.run']($, { args: 'on' })
// broken JSON: no crash, nothing shown
$.reply = 'not json {'; await H['turn.complete']($, {}, next); await flush()
out.broken = await H['ui.render']($, { component: 'AbovePrompt' }, async () => 'engine'); assert.equal(out.broken, 'engine')

// busy guard: two turns ending together call the model once
calls.complete.length = 0; $.reply = '[{"label":"a","text":"b"}]'
const slow = $.model.complete; let release
$.model.complete = (o) => { calls.complete.push(o); return new Promise((res) => { release = () => res({ isAnswered: true, text: $.reply }) }) }
await H['turn.complete']($, {}, next); await H['turn.complete']($, {}, next); release(); await flush()
out.busy = calls.complete.length; assert.equal(out.busy, 1); $.model.complete = slow
// at most 5 guesses
$.reply = JSON.stringify(Array.from({ length: 15 }, (_, i) => ({ label: 'g' + i, text: 't' + i })))
await H['turn.complete']($, {}, next); await flush()
const t2 = await H['ui.render']($, { component: 'AbovePrompt' }, async () => null)
out.max = t2.children[0].children.filter((c) => c.t === 'Button').length; assert.equal(out.max, 6)
// other agents' messages are labelled, not taken as the user's; reminders are cut out
calls.complete.length = 0
$.msgs = [{ role: 'user', text: '<system-reminder>یادآوری</system-reminder>\nپیامِ حبیب' },
  { role: 'user', text: 'Another Claude session sent a message:\n<cross-session-message from="x">جدولِ ناظر</cross-session-message>' },
  { role: 'assistant', text: 'جوابِ کلود' }]
$.files = { '.remember/now.md': 'هندآفِ الان', '.remember/today-2026-10-21.md': 'هندآفِ امروز', '.remember/today-2026-10-22.done.md': 'کهنه', '.remember/recent.md': 'هفته' }
await H['turn.complete']($, {}, next); await flush()
const [hp, mp] = calls.complete[0].prompt.map((b) => b.text)
const sec = (h) => mp.split('## ').find((x) => x.startsWith(h)) || ''
out.peerFiltered = /پیامِ حبیب/.test(sec('درخواست')) && !/جدولِ ناظر|یادآوری/.test(sec('درخواست')) && /جدولِ ناظر/.test(sec('پیامِ ایجنت')) && /جوابِ کلود/.test(sec('جواب'))
assert.equal(out.peerFiltered, true)
out.handoff = /هندآفِ الان/.test(hp) && /هندآفِ امروز/.test(hp) && /هفته/.test(hp) && !/کهنه/.test(hp) && calls.complete[0].prompt[0].cache === true
assert.equal(out.handoff, true)
// a click keeps what is already typed
calls.fill.length = 0; $.typed = 'نیمه‌نوشته'
const t3 = await H['ui.render']($, { component: 'AbovePrompt' }, async () => null)
await t3.children[0].children.find((c) => c.t === 'Button').onPress()
out.append = calls.fill[0].text; assert.equal(out.append, 'نیمه‌نوشته\nt0'); $.typed = ''
// no app attached (claude -p): no model call
calls.complete.length = 0; $.surf = []
await H['turn.complete']($, {}, next); await flush()
out.headless = calls.complete.length; assert.equal(out.headless, 0); $.surf = ['vscode']
// a model error does not crash and shows nothing
$.model.complete = async () => { throw new Error('timeout') }
await H['turn.complete']($, {}, next); await flush()
out.error = await H['ui.render']($, { component: 'AbovePrompt' }, async () => 'engine'); assert.equal(out.error, 'engine')
console.log(JSON.stringify(out))
