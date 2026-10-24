// Fake-harness test for the hads mod: no session, no model.
import assert from 'node:assert/strict'
const mod = await import(process.env.HADS_JS || new URL('./hooks/register.js', import.meta.url))
const H = {}, calls = { complete: [], now: [], fork: [], fill: [], submit: [] }
mod.register((ev, a, b) => { H[ev] = b || a; return { catch() {} } })
const store = {}
const $ = {
  // «دو جمله» calls go to calls.now (maxTokens 200), guesses to calls.complete
  model: {
    complete: async (o) => o.maxTokens === 200 ? $.nowModel(o) : $.guessModel(o),
    fork: async (o) => { calls.fork.push(o); return $.forkReply },
  },
  session: { messages: async () => $.msgs, surfaces: async () => $.surf, id: async () => $.sid, root: async () => '/proj' },
  env: { get: async (k) => (k === 'HOME' ? '/h' : undefined) },
  ui: { invalidate() {}, resolve: () => ({ Box: (p) => ({ t: 'Box', ...p }), Text: (p) => ({ t: 'Text', ...p }), Button: (p) => ({ t: 'Button', ...p }) }) },
  prompt: { fill: async (o) => calls.fill.push(o), submit: async (o) => calls.submit.push(o), read: async () => $.typed },
  store: { get: async (k) => store[k], set: async (k, v) => { store[k] = v } },
  clock: { after: (ms, fn) => { pending.push(fn()) }, now: async () => $.t },
  command: { register: async () => {} },
  fs: { write: async (f, t) => { flags[f] = t }, read: async (f) => { if (f in flags) return flags[f]; if ($.files[f] === undefined) throw new Error('no'); return $.files[f] }, list: async () => Object.keys($.files).map((k) => ({ name: k.replace('.remember/', '') })) },
}
const flags = {}
$.t = 0
$.guessModel = async (o) => { calls.complete.push(o); return { isAnswered: true, text: $.reply } }
$.nowModel = async (o) => { calls.now.push(o); return { isAnswered: true, text: $.nowReply } }
$.nowReply = 'یک. دو.'
let pending = []
const flush = async () => { await Promise.all(pending); pending = [] }
const next = async (e) => e
const out = {}
const render = (e = {}) => H['ui.render']($, { component: 'AbovePrompt', ...e }, async () => 'engine')
const row = (t) => t.children.find((c) => c.t === 'Box' && c.flexDirection === 'row')
// guess buttons drawn (× left out); 'engine' alone means the mod drew nothing
const guessLabels = (t) => t === 'engine' ? [] : row(t).children.filter((c) => c.t === 'Button' && c.label !== '×').map((c) => c.label)
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
const btns = row(tree).children.filter((c) => c.t === 'Button')
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
out.broken = guessLabels(await render()); assert.deepEqual(out.broken, [])

// busy guard: two turns ending together call the model once
calls.complete.length = 0; $.reply = '[{"label":"a","text":"b"}]'
const slow = $.guessModel; let release
$.guessModel = (o) => { calls.complete.push(o); return new Promise((res) => { release = () => res({ isAnswered: true, text: $.reply }) }) }
await H['turn.complete']($, {}, next); await H['turn.complete']($, {}, next); release(); await flush()
out.busy = calls.complete.length; assert.equal(out.busy, 1); $.guessModel = slow
// at most 5 guesses
$.reply = JSON.stringify(Array.from({ length: 15 }, (_, i) => ({ label: 'g' + i, text: 't' + i })))
await H['turn.complete']($, {}, next); await flush()
const t2 = await H['ui.render']($, { component: 'AbovePrompt' }, async () => null)
out.max = row(t2).children.filter((c) => c.t === 'Button').length; assert.equal(out.max, 6)
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
await row(t3).children.find((c) => c.t === 'Button').onPress()
out.append = calls.fill[0].text; assert.equal(out.append, 'نیمه‌نوشته\nt0'); $.typed = ''
// no app attached (claude -p): no model call
calls.complete.length = 0; $.surf = []
await H['turn.complete']($, {}, next); await flush()
out.headless = calls.complete.length; assert.equal(out.headless, 0); $.surf = ['vscode']
// a model error does not crash and shows nothing
$.guessModel = $.nowModel = async () => { throw new Error('timeout') }
await H['turn.complete']($, {}, next); await flush()
out.error = guessLabels(await render()); assert.deepEqual(out.error, [])
// «دو جمله» after tools: at most one call per GAP, and only when this chat is on
$.guessModel = slow; $.nowModel = async (o) => { calls.now.push(o); return { isAnswered: true, text: $.nowReply } }
$.msgs = [{ role: 'user', text: 'دکمه بساز' }]; $.sid = 'A'; calls.now.length = 0; $.t = 1e9
const tool = (e = {}) => H['tool.call']($, { tool: 'Bash', command: 'ls', ...e }, async () => ({ result: 'ok' }))
// each one finished before the next: only the time brake can hold them back
for (let i = 0; i < 5; i++) { await tool(); await flush() }
out.brake = calls.now.length; assert.equal(out.brake, 1)
$.t += mod.GAP; await tool(); await flush()
out.afterGap = calls.now.length; assert.equal(out.afterGap, 2)
// an answer's end always tells, even inside the gap
await H['turn.complete']($, {}, next); await flush()
out.turnAlways = calls.now.length; assert.equal(out.turnAlways, 3)
// one at a time: answers ending while a call runs wait for it, then one more call tells the end
let free; $.nowModel = (o) => { calls.now.push(o); return new Promise((r) => { free = () => r({ isAnswered: true, text: $.nowReply }) }) }
await H['turn.complete']($, {}, next); await H['turn.complete']($, {}, next); await H['turn.complete']($, {}, next)
await new Promise((r) => setTimeout(r, 5)); out.oneAtATime = calls.now.length; assert.equal(out.oneAtATime, 4)
free(); await new Promise((r) => setTimeout(r, 5)); free(); await flush()
out.endNotDropped = calls.now.length; assert.equal(out.endNotDropped, 5)
$.nowModel = async (o) => { calls.now.push(o); return { isAnswered: true, text: $.nowReply } }
// the glossary of the project goes in, and the tool that just ran
$.files = { '/proj/Doc/tarif/00_vazhe_name.md': 'واژهٔ-حبیب' }; $.t += mod.GAP; await tool({ command: 'npm test' }); await flush()
const np = calls.now.at(-1).prompt.map((b) => b.text).join('\n')
out.glossary = /واژهٔ-حبیب/.test(np) && /npm test/.test(np) && calls.now.at(-1).model === 'claude-sonnet-5-5'; assert.equal(out.glossary, true)
// a subagent's tools, or a chat that is off, never call
$.t += mod.GAP; await tool({ agentId: 'sub' }); await flush(); $.sid = 'B'; $.t += mod.GAP; await tool(); await flush(); $.sid = 'A'
out.subOrOff = calls.now.length; assert.equal(out.subOrOff, 6)
// five sentences from the model: two are shown
$.nowReply = 'اول. دوم! سوم؟ چهارم. پنجم.'; $.t += mod.GAP; await tool(); await flush()
const nowText = (t) => t.children.find((c) => c.key === 'hads-now')?.children[0]
out.twoOnly = nowText(await render()); assert.equal(out.twoOnly, 'اول. دوم!')
// a dot inside a file name or a version does not end the sentence
out.fileDot = mod.twoSentences('ایجنت فایل register.js را در v2.10 عوض کرد. بعد تست زد. سوم.'); assert.equal(out.fileDot, 'ایجنت فایل register.js را در v2.10 عوض کرد. بعد تست زد.')
// a «sentence» without a stop, 2000 long, is cut to MAX_NOW with …
const long = mod.twoSentences('ا'.repeat(2000)); out.maxLen = long.length + (long.endsWith('…') ? '…' : ''); assert.equal(out.maxLen, mod.MAX_NOW + '…')
// the tool's result comes back untouched and never waits for the model
let hang; $.nowModel = () => new Promise((r) => { hang = r })
$.t += mod.GAP; out.untouched = (await tool()).result; assert.equal(out.untouched, 'ok')
await new Promise((r) => setTimeout(r, 5)); out.modelWasCalled = typeof hang; assert.equal(out.modelWasCalled, 'function')
hang({ isAnswered: false, reason: 'aborted' }); await flush()
// a failure in «دو جمله» never breaks the tool (clock throws inside the hook's own work)
const realNow = $.clock.now; $.clock.now = async () => { throw new Error('boom') }
out.toolSurvives = (await tool()).result; await flush(); assert.equal(out.toolSurvives, 'ok'); $.clock.now = realNow
// «بپرس» is a side question: $.model.fork, nothing typed into or sent from the prompt
const withInput = { Box: (p) => ({ t: 'Box', ...p }), Text: (p) => ({ t: 'Text', ...p }), Button: (p) => ({ t: 'Button', ...p }), Input: (p) => ({ t: 'Input', ...p }) }
const realResolve = $.ui.resolve; $.ui.resolve = () => withInput
calls.fill.length = 0; calls.submit.length = 0
$.forkReply = { isAnswered: true, text: 'یعنی دکمه ساخته شد.', usage: { input_tokens: 1, output_tokens: 2, cache_read_input_tokens: 3, cache_creation_input_tokens: 0 } }
const box = row(await render()).children.find((c) => c.t === 'Input')
await box.onSubmit('این یعنی چی؟'); await flush()
out.ask = { fork: calls.fork.length, fill: calls.fill.length, submit: calls.submit.length }; assert.deepEqual(out.ask, { fork: 1, fill: 0, submit: 0 })
const ansText = (t) => t.children.filter((c) => c.t === 'Box' && c.flexDirection === 'column').flatMap((c) => c.children).filter((c) => c.t === 'Text').map((c) => c.children[0])
out.askShown = ansText(await render()).includes('یعنی دکمه ساخته شد.'); assert.equal(out.askShown, true)
out.askUsage = (await $.store.get('lastAskUsage'))?.cache_read_input_tokens; assert.equal(out.askUsage, 3)
// after /clear the fork has nothing: a plain message, never an empty answer
$.forkReply = { isAnswered: false, reason: 'nothing-to-fork' }
await row(await render()).children.find((c) => c.t === 'Input').onSubmit('چی شد؟'); await flush()
out.nothingToFork = ansText(await render()).some((x) => /\/clear/.test(x)); assert.equal(out.nothingToFork, true)
$.ui.resolve = realResolve
// on mobile (no Input) the row still draws
out.noInput = row(await render()).children.some((c) => c.t === 'Input'); assert.equal(out.noInput, false)
console.log(JSON.stringify(out))
