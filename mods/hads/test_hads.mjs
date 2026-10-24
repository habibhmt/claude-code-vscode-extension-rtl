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
  session: { messages: async () => $.msgs, surfaces: async () => $.surf, id: async () => $.sid, root: async () => '/proj', cwd: async () => '/proj',
    usage: async () => ({ context: { tokens: $.ctx, window: 1e6 } }), model: async () => 'claude-opus-5-5' },
  env: { get: async (k) => (k === 'HOME' ? '/h' : undefined) },
  ui: { invalidate() {}, focus: async (o) => { calls.focus = o }, copy: async (o) => { calls.copy = o; return { isCopied: true } }, resolve: () => ({ Box: (p) => ({ t: 'Box', ...p }), Text: (p) => ({ t: 'Text', ...p }), Button: (p) => ({ t: 'Button', ...p }) }) },
  prompt: { fill: async (o) => calls.fill.push(o), submit: async (o) => calls.submit.push(o), read: async () => $.typed },
  store: { get: async (k) => store[k], set: async (k, v) => { store[k] = v } },
  clock: { after: (ms, fn) => { pending.push(fn()) }, now: async () => $.t },
  command: { register: async () => {} },
  process: { run: async (argv, init) => { if (/cat >>/.test(argv?.[2] || '')) { (/\.usage\.jsonl$/.test(argv[4]) ? usages : events).push(JSON.parse(init.stdin)); return { exitCode: 0, stdout: '' } } calls.run = (calls.run || 0) + 1; calls.argv = argv; if ($.tailFails) throw new Error('no tail'); return { exitCode: 0, stdout: $.tail || '' } } },
  fs: { write: async (f, t) => { flags[f] = t }, read: async (f) => { if (f in flags) return flags[f]; if ($.files[f] === undefined) throw new Error('no'); return $.files[f] }, list: async () => Object.keys($.files).map((k) => ({ name: k.replace('.remember/', '') })) },
}
const flags = {}
const events = []
const usages = []
$.t = 0
$.ctx = 1000
// no fork reply at first: the end of an answer falls back to the two Sonnet calls
$.forkReply = { isAnswered: false, reason: 'nothing-to-fork' }
$.guessModel = async (o) => { calls.complete.push(o); return { isAnswered: true, text: $.reply } }
$.nowModel = async (o) => { calls.now.push(o); return { isAnswered: true, text: $.nowReply } }
$.nowReply = 'یک. دو.'
let pending = []
const flush = async () => { await Promise.all(pending); pending = [] }
const next = async (e) => e
const out = {}
const render = (e = {}) => H['ui.render']($, { component: 'AbovePrompt', ...e }, async () => 'engine')
// the row with the guesses, «پرسش» and the ticks (the one holding ×)
// the row with «پرسش» and the ticks (▾ and × sit in their own row on top)
const row = (t) => t.children.find((c) => c.t === 'Box' && (c.children || []).some((x) => x && /^hads-tick-/.test(String(x.key))))
// guess buttons drawn (× left out); 'engine' alone means the mod drew nothing
const isGuess = (c) => c.t === 'Button' && /^hads-\d+$/.test(String(c.key))
// the guesses: whole sentences (Text hads-g-i), each with a ⤵ button (hads-i)
const guessLabels = (t) => t === 'engine' ? [] : [0, 1, 2, 3, 4].map((i) => find(t, 'hads-g-' + i)?.children?.[0]).filter(Boolean)
// any element by key, however deep
const find = (t, key) => { if (!t || typeof t !== 'object') return null; if (t.key === key) return t; for (const c of t.children || []) { const f = find(c, key); if (f) return f } return null }
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
const btns = [0, 1].map((i) => find(tree, 'hads-' + i))
out.buttons = [...guessLabels(tree), ...btns.map((b) => b.label)]; assert.deepEqual(out.buttons, ['آزمون‌ها رو اجرا کن', 'کامیت و پوش کن', '⤵', '⤵'])
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

// busy guard: answers ending while «دو جمله» is told wait for it; then one more call tells the last, never dropped
calls.now.length = 0; $.reply = '[{"label":"a","text":"b"}]'
const slow = $.guessModel; const nowFast = $.nowModel; let release
$.nowModel = (o) => { calls.now.push(o); return new Promise((res) => { release = () => res({ isAnswered: true, text: $.nowReply }) }) }
await H['turn.complete']($, {}, next); await H['turn.complete']($, {}, next); await H['turn.complete']($, {}, next)
await new Promise((r) => setTimeout(r, 5)); out.busy = calls.now.length; assert.equal(out.busy, 1)
release(); await new Promise((r) => setTimeout(r, 5)); release(); await flush()
out.endNotDropped = calls.now.length; assert.equal(out.endNotDropped, 2); $.nowModel = nowFast
$.reply = JSON.stringify(Array.from({ length: 15 }, (_, i) => ({ label: 'g' + i, text: 't' + i })))
// guesses come every GUESS_EVERY answers: /hads now asks for them at once
const guessNow = async () => { await H['command.run']($, { args: 'now' }); await flush() }
await guessNow()
const t2 = await H['ui.render']($, { component: 'AbovePrompt' }, async () => null)
// at most 2 (Habib, 24 Oct: «یکی دو تا بیشتر حدس نشه … جمله کاملش بیاد»)
out.max = guessLabels(t2).length; assert.equal(out.max, 2)
// other agents' messages are labelled, not taken as the user's; reminders are cut out
calls.complete.length = 0
$.msgs = [{ role: 'user', text: '<system-reminder>یادآوری</system-reminder>\nپیامِ حبیب' },
  { role: 'user', text: 'Another Claude session sent a message:\n<cross-session-message from="x">جدولِ ناظر</cross-session-message>' },
  { role: 'assistant', text: 'جوابِ کلود' }]
$.files = { '.remember/now.md': 'هندآفِ الان', '.remember/today-2026-10-21.md': 'هندآفِ امروز', '.remember/today-2026-10-22.done.md': 'کهنه', '.remember/recent.md': 'هفته' }
await guessNow()
const [hp, mp] = calls.complete[0].prompt.map((b) => b.text)
const sec = (h) => mp.split('## ').find((x) => x.startsWith(h)) || ''
out.peerFiltered = /پیامِ حبیب/.test(sec('درخواست')) && !/جدولِ ناظر|یادآوری/.test(sec('درخواست')) && /جدولِ ناظر/.test(sec('پیامِ ایجنت')) && /جوابِ کلود/.test(sec('جواب'))
assert.equal(out.peerFiltered, true)
out.handoff = /هندآفِ الان/.test(hp) && /هندآفِ امروز/.test(hp) && /هفته/.test(hp) && !/کهنه/.test(hp) && calls.complete[0].prompt[0].cache === true
assert.equal(out.handoff, true)
// a click keeps what is already typed
calls.fill.length = 0; $.typed = 'نیمه‌نوشته'
const t3 = await H['ui.render']($, { component: 'AbovePrompt' }, async () => null)
await find(t3, 'hads-0').onPress()
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
// the glossary of the project goes in, and the tool that just ran
$.files = { '/proj/Doc/tarif/00_vazhe_name.md': 'واژهٔ-حبیب' }; $.t += mod.GAP; await tool({ command: 'npm test' }); await flush()
const np = calls.now.at(-1).prompt.map((b) => b.text).join('\n')
out.glossary = /واژهٔ-حبیب/.test(np) && /npm test/.test(np) && calls.now.at(-1).model === 'claude-sonnet-5-5'; assert.equal(out.glossary, true)
// a subagent's tools, or a chat that is off, never call
$.t += mod.GAP; await tool({ agentId: 'sub' }); await flush(); $.sid = 'B'; $.t += mod.GAP; await tool(); await flush(); $.sid = 'A'
out.subOrOff = calls.now.length; assert.equal(out.subOrOff, 4)
// five sentences from the model: two are shown
$.nowReply = 'اول. دوم! سوم؟ چهارم. پنجم.'; $.t += mod.GAP; await tool(); await flush()
const nowText = (t) => find(t, 'hads-now')?.children[0]
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
$.nowModel = async (o) => { calls.now.push(o); return { isAnswered: true, text: $.nowReply } }
// a failure in «دو جمله» never breaks the tool (clock throws inside the hook's own work)
const realNow = $.clock.now; $.clock.now = async () => { throw new Error('boom') }
out.toolSurvives = (await tool()).result; await flush(); assert.equal(out.toolSurvives, 'ok'); $.clock.now = realNow
// the end of an answer: «دو جمله» from Sonnet (cheap), the guesses from ONE fork of the chat
// itself (its own model, warm cache) — only every GUESS_EVERY answers
const nowText2 = (t) => find(t, 'hads-now')
const cnt = () => [calls.fork.length, calls.now.length, calls.complete.length]
$.t += mod.GAP; $.files = { '/proj/Doc/tarif/00_vazhe_name.md': 'واژهٔ-حبیب' }; $.nowReply = 'الف کرد. ب ماند. پ.'
$.forkReply = { isAnswered: true, usage: { input_tokens: 9, output_tokens: 99, cache_read_input_tokens: 200000, cache_creation_input_tokens: 5 },
  text: 'بفرما: {"guesses": [{"label": "یک", "text": "کارِ یک"}, {"label": "دو", "text": "کارِ دو"}]}' }
$.sid = 'F'; await H['command.run']($, { args: 'on' })
let c0 = cnt(); await H['turn.complete']($, {}, next); await flush(); let c1 = cnt()
out.oneFork = [c1[0] - c0[0], c1[1] - c0[1], c1[2] - c0[2]]; assert.deepEqual(out.oneFork, [1, 1, 0])
const t5 = await render()
out.forkRow = { now: nowText2(t5).children[0], guesses: guessLabels(t5) }
assert.deepEqual(out.forkRow, { now: 'الف کرد. ب ماند.', guesses: ['کارِ یک', 'کارِ دو'] })
out.forkPrompt = /JSON/.test(calls.fork.at(-1).prompt) && /guesses/.test(calls.fork.at(-1).prompt) && !/"now"/.test(calls.fork.at(-1).prompt); assert.equal(out.forkPrompt, true)
out.turnUsage = (await $.store.get('lastTurnUsage'))?.via; assert.equal(out.turnUsage, 'fork')
// the next GUESS_EVERY-1 answers: «دو جمله» only, no fork, the guesses stay
const between = []
for (let i = 1; i < mod.GUESS_EVERY; i++) { c0 = cnt(); await H['turn.complete']($, {}, next); await flush(); c1 = cnt(); between.push([c1[0] - c0[0], c1[1] - c0[1], c1[2] - c0[2]]) }
out.between = between; assert.deepEqual(out.between, Array(mod.GUESS_EVERY - 1).fill([0, 1, 0]))
out.guessesKept = guessLabels(await render()); assert.deepEqual(out.guessesKept, ['کارِ یک', 'کارِ دو'])
// a broken fork reply falls back to Sonnet for the guesses, never an empty row
$.forkReply = { isAnswered: true, text: 'not json', usage: {} }
c0 = cnt(); await H['turn.complete']($, {}, next); await flush(); c1 = cnt()
out.forkBroken = [c1[0] - c0[0], c1[1] - c0[1], c1[2] - c0[2]]; assert.deepEqual(out.forkBroken, [1, 1, 1])
// a chat over MAX_FORK tokens never forks
$.forkReply = { isAnswered: true, text: '{"guesses": []}', usage: {} }; $.ctx = mod.MAX_FORK + 1
c0 = cnt(); await H['command.run']($, { args: 'now' }); await flush(); c1 = cnt()
out.bigChat = [c1[0] - c0[0], c1[1] - c0[1], c1[2] - c0[2]]; assert.deepEqual(out.bigChat, [0, 1, 1]); $.ctx = 1000
$.sid = 'A'
// mid-work uses only the last three messages
$.msgs = Array.from({ length: 10 }, (_, i) => ({ role: 'user', text: 'پیامِ-' + i }))
$.t += mod.GAP; await tool(); await flush()
const mp3 = calls.now.at(-1).prompt.map((b) => b.text).join('\n')
out.lastThree = !/پیامِ-6/.test(mp3) && /پیامِ-7/.test(mp3) && /پیامِ-9/.test(mp3); assert.equal(out.lastThree, true)
// deep in a long answer the last three are all the agent's: Habib's last request still goes in
const longTurn = [{ role: 'user', text: 'قدیمی' }, { role: 'user', text: 'خواستهٔ-حبیب' }, { role: 'user', text: 'Another Claude session sent a message: <cross-session-message>ایجنت</cross-session-message>' },
  ...Array.from({ length: 6 }, (_, i) => ({ role: 'assistant', text: 'کار-' + i }))]
out.hisRequest = mod.recent(longTurn).map((m) => m.text); assert.deepEqual(out.hisRequest, ['قدیمی', 'خواستهٔ-حبیب', 'کار-3', 'کار-4', 'کار-5'])
// a mid-work line that comes back after an answer's end does not hide the end's line
let late; let lateOnce = true
$.nowModel = (o) => { calls.now.push(o); if (lateOnce) { lateOnce = false; return new Promise((r) => { late = r }) } return { isAnswered: true, text: 'پایان شد. منتظرِ حبیب.' } }
$.t += mod.GAP; await tool(); await new Promise((r) => setTimeout(r, 5))
$.t += 1; await H['turn.complete']($, {}, next); await new Promise((r) => setTimeout(r, 5))
late({ isAnswered: true, text: 'وسطِ کار. هنوز.' }); await flush(); await new Promise((r) => setTimeout(r, 5)); await flush()
const t6 = await render(); out.endWins = nowText2(t6).children[0]; assert.equal(out.endWins, 'پایان شد. منتظرِ حبیب.')
$.nowModel = async (o) => { calls.now.push(o); return { isAnswered: true, text: $.nowReply } }
// h-on says at once when the row comes
$.sid = 'N'; await H['command.run']($, { args: 'on' })
const t7 = await render(); out.onLine = /بعد از جوابِ بعدی/.test(nowText2(t7).children?.[0] ?? nowText2(t7).label); assert.equal(out.onLine, true)
$.sid = 'A'
// «بپرس» is a side question: $.model.fork, nothing typed into or sent from the prompt
const withInput = { Box: (p) => ({ t: 'Box', ...p }), Text: (p) => ({ t: 'Text', ...p }), Button: (p) => ({ t: 'Button', ...p }), Input: (p) => ({ t: 'Input', ...p }) }
const realResolve = $.ui.resolve; $.ui.resolve = () => withInput
calls.fill.length = 0; calls.submit.length = 0; calls.fork.length = 0
$.forkReply = { isAnswered: true, text: 'یعنی دکمه ساخته شد.', usage: { input_tokens: 1, output_tokens: 2, cache_read_input_tokens: 3, cache_creation_input_tokens: 0 } }
const box = row(await render()).children.find((c) => c.t === 'Input')
await box.onSubmit('این یعنی چی؟'); await flush()
out.ask = { fork: calls.fork.length, fill: calls.fill.length, submit: calls.submit.length }; assert.deepEqual(out.ask, { fork: 1, fill: 0, submit: 0 })
const ansText = (t) => t.children.filter((c) => c.t === 'Box' && c.flexDirection === 'column').flatMap((c) => c.children).filter((c) => c.t === 'Text').map((c) => c.children[0])
out.askShown = ansText(await render()).includes('یعنی دکمه ساخته شد.'); assert.equal(out.askShown, true)
out.askUsage = (await $.store.get('lastAskUsage'))?.cache_read_input_tokens; assert.equal(out.askUsage, 3)
// after /clear the fork has nothing, and the chat has nothing either: a plain message, never an empty answer
$.forkReply = { isAnswered: false, reason: 'nothing-to-fork' }; const keepMsgs = $.msgs; $.msgs = []; $.ctx = 0
await row(await render()).children.find((c) => c.t === 'Input').onSubmit('چی شد؟'); await flush()
out.nothingToFork = ansText(await render()).some((x) => /\/clear/.test(x)); assert.equal(out.nothingToFork, true)
// a chat with a story (resume, a turn still running) but no request yet: the question waits, then goes by itself
$.msgs = keepMsgs; $.ctx = 1000
await row(await render()).children.find((c) => c.t === 'Input').onSubmit('صبر کن'); await flush()
out.waitShown = ansText(await render()).some((x) => /بعد از جوابِ بعدیِ کلود/.test(x)) && !ansText(await render()).some((x) => /\/clear/.test(x)); assert.equal(out.waitShown, true)
$.forkReply = { isAnswered: true, text: 'حالا جواب.', usage: {} }; const w0 = calls.fork.length
await H['turn.complete']($, {}, next); await flush(); await flush()
out.waitAsked = calls.fork.filter((f, i) => i >= w0 && /^صبر کن/.test(f.prompt)).length; assert.equal(out.waitAsked, 1)
// btw on «دو جمله»: a press fills «بپرس» with it and moves the keyboard there
$.ui.resolve = () => withInput
$.forkReply = { isAnswered: true, text: '{"now": "مجری دارد می‌سازد. منتظرِ ناظر است.", "guesses": []}', usage: {} }
$.t += 1; await H['turn.complete']($, {}, next); await flush()
// «دو جمله» is plain text Habib selects and copies (Ctrl+C), not a button; no کپی buttons anywhere
const rSel = await render()
out.nowSelectable = find(rSel, 'hads-now')?.t === 'Text' && !JSON.stringify(rSel).includes('copy'); assert.equal(out.nowSelectable, true)
// a cold cache (idle past COLD): the first Enter only tells the cost, the second asks
$.t += mod.COLD + 1; $.ctx = 200000; const f0 = calls.fork.length
await row(await render()).children.find((c) => c.t === 'Input').onSubmit('سرد؟'); await flush()
out.coldWarn = calls.fork.length === f0 && ansText(await render()).some((x) => /\$1\.00 تا \$1\.60/.test(x)); assert.equal(out.coldWarn, true)
await row(await render()).children.find((c) => c.t === 'Input').onSubmit('سرد؟'); await flush()
out.coldSecond = calls.fork.length - f0; assert.equal(out.coldSecond, 1); $.ctx = 1000
$.ui.resolve = realResolve
// on mobile (no Input) the row still draws
out.noInput = row(await render()).children.some((c) => c.t === 'Input'); assert.equal(out.noInput, false)
// the cache's state on a resume comes from Claude Code itself (classic.SessionStart)
const fresh = await import((process.env.HADS_JS || new URL('./hooks/register.js', import.meta.url).href) + '?fresh')
const F = {}; fresh.register((ev, a, b) => { F[ev] = b || a; return { catch() {} } })
const askVia = async (q) => { const r = await F['ui.render']($, { component: 'AbovePrompt' }, async () => 'engine'); await row(r).children.find((c) => c.t === 'Input').onSubmit(q); await flush(); return ansText(await F['ui.render']($, { component: 'AbovePrompt' }, async () => 'engine')) }
$.ui.resolve = () => withInput; $.ctx = 411000; $.forkReply = { isAnswered: true, text: 'جوابِ گرم.', usage: {} }
await F['turn.complete']($, { agentId: 'sub' }, next)
// nothing known at all: no false «cold», an honest «I don't know» with the price
out.unknownHonest = (await askVia('ناشناس')).some((x) => /نمی‌دانم کشِ چت گرم است یا نه/.test(x) && /\$2\.06 تا \$3\.29/.test(x)); assert.equal(out.unknownHonest, true)
// resumed 2 minutes after the last answer, cache warm: asked at once, no warning
await F['classic.SessionStart']($, { seconds_since_last_response: 120, prompt_cache_likely_expired: false }, next)
let f1 = calls.fork.length; out.resumeWarm = (await askVia('گرم؟')).includes('جوابِ گرم.') && calls.fork.length === f1 + 1; assert.equal(out.resumeWarm, true)
// resumed after 10 minutes, Claude Code says expired (a 5 min TTL): warned, though 10 min < COLD
await F['classic.SessionStart']($, { seconds_since_last_response: 600, prompt_cache_likely_expired: true }, next)
f1 = calls.fork.length; out.resumeCold = (await askVia('سرد؟')).some((x) => /کشِ چت سرد است/.test(x)) && calls.fork.length === f1; assert.equal(out.resumeCold, true)
// a 5 min TTL (told by a model switch): 10 minutes idle is cold
await F['turn.complete']($, {}, next); await flush()
await F['classic.PostModelSwitch']($, { cache_ttl: '5m', from_model: 'x', to_model: 'x' }, next)
$.t += 10 * 60000; f1 = calls.fork.length
out.ttl5m = (await askVia('پنج دقیقه')).some((x) => /سرد است/.test(x)) && calls.fork.length === f1; assert.equal(out.ttl5m, true)
$.ui.resolve = realResolve; $.ctx = 1000
// «بفرست ⏎» on the screen asks what the box holds; «کپی» puts the text on the clipboard
$.ui.resolve = () => withInput; $.forkReply = { isAnswered: true, text: 'جوابِ دکمه.', usage: {} }; $.t += 1
await F['turn.complete']($, {}, next); await flush()
let r10 = await F['ui.render']($, { component: 'AbovePrompt' }, async () => 'engine')
await find(r10, 'hads-ask').onInput('با دکمه'); r10 = await F['ui.render']($, { component: 'AbovePrompt' }, async () => 'engine')
f1 = calls.fork.length; await find(r10, 'hads-ask-send').onPress({}); await flush()
out.sendButton = calls.fork.length === f1 + 1 && /^با دکمه/.test(calls.fork.at(-1).prompt); assert.equal(out.sendButton, true)
r10 = await F['ui.render']($, { component: 'AbovePrompt' }, async () => 'engine')
out.answerText = !find(r10, 'hads-ans-copy') && JSON.stringify(r10).includes('جوابِ دکمه.'); assert.equal(out.answerText, true)
// the fork is told not to use tools or go on with the work (mid-work it saw a tool call in flight)
out.noTools = /ابزاری صدا نزن/.test(calls.fork.at(-1).prompt); assert.equal(out.noTools, true)
// a cold warning has «باشه، بپرس»: a press asks
await F['classic.SessionStart']($, { seconds_since_last_response: 600, prompt_cache_likely_expired: true }, next)
await askVia('سردِ دکمه'); f1 = calls.fork.length
await find(await F['ui.render']($, { component: 'AbovePrompt' }, async () => 'engine'), 'hads-ans-go').onPress({}); await flush()
out.coldButton = calls.fork.length === f1 + 1; assert.equal(out.coldButton, true)
$.ui.resolve = realResolve
// «قبلی‌ها»: every «دو جمله» kept with its time, this chat only, the last HIST, newest first
out.when = mod.when(Date.UTC(2026, 9, 24, 15, 27)); assert.equal(out.when, '۲۴ اکت ۱۸:۵۷')
$.ui.resolve = () => withInput; $.sid = 'H'; await F['command.run']($, { args: 'on' })
for (let i = 0; i < 55; i++) {
  $.nowReply = 'جملهٔ-' + i + '. تمام.'; $.t += 1000
  await F['turn.complete']($, {}, next); await flush()
}
const histLines = String(flags['/h/.claude/hads-log/H.now.jsonl']).trim().split('\n')
out.histCap = histLines.length; assert.equal(out.histCap, mod.HIST)
let rH = await F['ui.render']($, { component: 'AbovePrompt' }, async () => 'engine')
out.histButton = find(rH, 'hads-hist')?.label; assert.equal(out.histButton, 'قبلی‌ها ۴۹')
await find(rH, 'hads-hist').onPress({}); rH = await F['ui.render']($, { component: 'AbovePrompt' }, async () => 'engine')
const h0 = find(rH, 'hads-hist-0')?.children[0], h9 = find(rH, 'hads-hist-9')?.children[0]
out.histOrder = [/جملهٔ-53\./.test(h0), /جملهٔ-44\./.test(h9), !find(rH, 'hads-hist-10'), / — /.test(h0) && /^[۰-۹]+ [^ ]+ [۰-۹]{2}:[۰-۹]{2} — /.test(h0)]
assert.deepEqual(out.histOrder, [true, true, true, true])
out.histText = find(rH, 'hads-hist-0')?.t === 'Text' && !find(rH, 'hads-hist-copy-0'); assert.equal(out.histText, true)
await find(rH, 'hads-hist').onPress({})
// another chat has its own history
$.sid = 'H2'; await F['command.run']($, { args: 'on' }); $.forkReply = { isAnswered: true, text: '{"now": "دیگری. بله."}', usage: {} }
await F['turn.complete']($, {}, next); await flush()
out.histOwn = String(flags['/h/.claude/hads-log/H2.now.jsonl']).trim().split('\n').length; assert.equal(out.histOwn, 1); $.sid = 'H'
// ▾ folds the whole band to one line; it stays folded after a reload; ▸ opens it; ticks are kept
await find(await F['ui.render']($, { component: 'AbovePrompt' }, async () => 'engine'), 'hads-tick-guess').onPress({})
await find(await F['ui.render']($, { component: 'AbovePrompt' }, async () => 'engine'), 'hads-min').onPress({})
out.foldFile = flags['/h/.claude/hads-on/H']; assert.equal(out.foldFile, 'on -guess min')
const again2 = await import((process.env.HADS_JS || new URL('./hooks/register.js', import.meta.url).href) + '?again2')
const G = {}; again2.register((ev, a, b) => { G[ev] = b || a; return { catch() {} } })
const rF = await G['ui.render']($, { component: 'AbovePrompt' }, async () => 'engine')
out.folded = { open: find(rF, 'hads-min')?.label, ask: !!find(rF, 'hads-ask'), ticks: !!find(rF, 'hads-tick-now') }
assert.deepEqual(out.folded, { open: '▸ حدس', ask: false, ticks: false })
await find(rF, 'hads-min').onPress({}); out.unfoldFile = flags['/h/.claude/hads-on/H']; assert.equal(out.unfoldFile, 'on -guess')
// the third state: just one small button; it opens the folded line, which opens the box (24 Oct 22:52)
let rD = await F['ui.render']($, { component: 'AbovePrompt' }, async () => 'engine')
await find(rD, 'hads-to-dot').onPress({}); out.dotFile = flags['/h/.claude/hads-on/H']; assert.equal(out.dotFile, 'on -guess dot')
rD = await F['ui.render']($, { component: 'AbovePrompt' }, async () => 'engine')
out.dot = { button: find(rD, 'hads-dot')?.label, nothingElse: !find(rD, 'hads-min') && !find(rD, 'hads-ask') && !find(rD, 'hads-now') && !find(rD, 'hads-x') }
assert.deepEqual(out.dot, { button: 'حدس ▸', nothingElse: true })
await find(rD, 'hads-dot').onPress({}); out.dotToMin = flags['/h/.claude/hads-on/H']; assert.equal(out.dotToMin, 'on -guess min')
rD = await F['ui.render']($, { component: 'AbovePrompt' }, async () => 'engine'); await find(rD, 'hads-min').onPress({})
out.backOpen = flags['/h/.claude/hads-on/H']; assert.equal(out.backOpen, 'on -guess')
// a tick keeps the other words of the file
flags['/h/.claude/hads-on/H'] = 'on +midfork min'; await F['ui.render']($, { component: 'AbovePrompt' }, async () => 'engine')
$.sid = 'H'; flags['/h/.claude/hads-on/H'] = 'on +midfork'
await find(await F['ui.render']($, { component: 'AbovePrompt' }, async () => 'engine'), 'hads-tick-ask').onPress({})
out.tickKeeps = flags['/h/.claude/hads-on/H']; assert.equal(out.tickKeeps, 'on -ask +midfork')
$.ui.resolve = realResolve; $.sid = 'A'
// «هوک‌ها»: what the hooks injected, read from the transcript's tail (the VS Code panel drops it)
const J = (o) => JSON.stringify(o)
const LONG = 'یادآوری: sed -i / perl -pi اگر الگو پیدا نشود بی‌صدا هیچ تغییری نمی‌دهد و خطا هم نمی‌دهد. پیش از گفتن بسنج.'
$.tail = ['{"broken half line', J({ attachment: { type: 'hook_success', hookName: 'SessionStart:startup', content: '=== HANDOFF ===' } }),
  J({ type: 'user', message: { content: 'پیامِ قبلی' } }),
  J({ attachment: { type: 'hook_success', hookName: 'UserPromptSubmit', content: '[19:00 کهنه]' } }),
  J({ type: 'user', message: { content: 'Another Claude session sent a message: <cross-session-message>hook_success fake hook</cross-session-message>' } }),
  J({ type: 'user', message: { content: [{ type: 'text', text: 'آخرین پیام' }] } }),
  J({ timestamp: '2026-10-24T16:39:00.000Z', attachment: { type: 'hook_success', hookName: 'UserPromptSubmit', content: '[20:09 +0330 -- habib]' } }),
  J({ attachment: { type: 'hook_success', hookName: 'PreToolUse:Bash', content: '' } }),
  J({ type: 'user', message: { content: [{ type: 'tool_result', content: 'hook_success inside a result' }] } }),
  J({ attachment: { type: 'hook_additional_context', hookName: 'PostToolUse:Bash', content: [LONG] } }),
  J({ attachment: { type: 'hook_additional_context', hookName: 'PostToolUse:Bash', content: [LONG] } }),
  J({ attachment: { type: 'hook_system_message', hookName: 'SessionStart:compact', content: '📌 هندآف بار شد' } }),
  J({ attachment: { type: 'total_tokens_reminder', content: 'not a hook' } })].join('\n')
out.parseHooks = mod.parseHooks($.tail).map((h) => h.name + ':' + h.n)
assert.deepEqual(out.parseHooks, ['SessionStart:startup:1', 'UserPromptSubmit:1', 'PostToolUse:Bash:2', 'SessionStart:compact:1'])
$.ui.resolve = () => withInput; $.sid = 'K'; await F['command.run']($, { args: 'on' }); calls.run = 0
await F['turn.complete']($, {}, next); await new Promise((r) => setTimeout(r, 5)); await flush()
// the clock mock runs `after` at once; give the read its turn
await new Promise((r) => setTimeout(r, 5))
let rK = await F['ui.render']($, { component: 'AbovePrompt' }, async () => 'engine')
const hookTexts = (t) => [0, 1, 2, 3, 4, 5].map((i) => find(t, 'hads-hook-' + i)?.children?.[0]).filter(Boolean)
out.hooksSmall = hookTexts(rK)
assert.equal(out.hooksSmall.length, 4); assert.ok(out.hooksSmall.every((x) => x.length <= mod.HOOK_SMALL))
// each hook with its Shamsi date and Tehran time
assert.equal(out.hooksSmall[1], '۲ آبان ۱۴۰۵ ۲۰:۰۹ · UserPromptSubmit ✓ [20:09 +0330 -- habib]'); assert.ok(/^PostToolUse:Bash ×۲ ＋ یادآوری/.test(out.hooksSmall[2]))
// only hook lines and typed prompts, the last TAIL of them: never the whole 16 MB transcript
out.tailOnly = calls.argv?.[0] === 'sh' && calls.argv?.[4] === mod.PICK && calls.argv?.[6] === String(mod.TAIL) && calls.argv?.[7] === String(mod.TAIL_BYTES) && /^tail -c .*\| grep -E .*\| tail -n/.test(calls.argv?.[2]); assert.equal(out.tailOnly, true)
// big: the last HOOK_BIG_ROWS, each whole up to HOOK_BIG (selectable text, no کپی buttons)
await find(rK, 'hads-hook-size').onPress({}); rK = await F['ui.render']($, { component: 'AbovePrompt' }, async () => 'engine')
out.hooksBig = { file: flags['/h/.claude/hads-on/K'], rows: hookTexts(rK).length, whole: hookTexts(rK).some((x) => x.endsWith(LONG)), copy: JSON.stringify(rK).includes('copy') }
assert.deepEqual(out.hooksBig, { file: 'on hookbig', rows: mod.HOOK_BIG_ROWS, whole: true, copy: false })
// a pages-long hook (a SessionStart handoff) is cut: it filled the band and hid «دو جمله» (24 Oct)
const keepTail = $.tail; $.tail += '\n' + J({ attachment: { type: 'hook_success', hookName: 'SessionStart:resume', content: 'ه'.repeat(5000) } })
await F['turn.complete']($, {}, next); await new Promise((r) => setTimeout(r, 5)); await flush(); await new Promise((r) => setTimeout(r, 5))
rK = await F['ui.render']($, { component: 'AbovePrompt' }, async () => 'engine')
out.hookBigCut = Math.max(...hookTexts(rK).map((x) => x.length)); assert.ok(out.hookBigCut <= mod.HOOK_BIG + 60, 'big hook ' + out.hookBigCut)
// the ticks stay last, next to the prompt, whatever is above them
const lastRow = rK.children.at(-1); out.ticksLast = (lastRow.children || []).some((x) => x && /^hads-tick-/.test(String(x.key))); assert.equal(out.ticksLast, true)
// ▾ and × on top, always in sight (24 Oct 22:41)
const topRow = rK.children.find((c) => c && c.t === 'Box'); out.closeOnTop = topRow?.key === 'hads-top' && ['hads-min', 'hads-to-dot', 'hads-x'].every((k) => topRow.children.some((x) => x.key === k)); assert.equal(out.closeOnTop, true)
$.tail = keepTail
// ticked off: the transcript is not read at all
await find(rK, 'hads-tick-hooks').onPress({}); calls.run = 0
await F['turn.complete']($, {}, next); await new Promise((r) => setTimeout(r, 5)); await flush()
out.hooksOff = { runs: calls.run, rows: hookTexts(await F['ui.render']($, { component: 'AbovePrompt' }, async () => 'engine')).length }
assert.deepEqual(out.hooksOff, { runs: 0, rows: 0 })
// a failing tail never breaks anything
await find(await F['ui.render']($, { component: 'AbovePrompt' }, async () => 'engine'), 'hads-tick-hooks').onPress({}); $.tailFails = true
await F['turn.complete']($, {}, next); await new Promise((r) => setTimeout(r, 5)); await flush(); out.tailFails = 'ok'; $.tailFails = false
$.ui.resolve = realResolve; $.sid = 'A'
// the numbers agreed with Habib and the ناظر (تعریفِ ۱۰): a change must turn this red
// GUESS_EVERY: Habib 24 Oct «حدسو بذار مدل اصلی بکنه … چند تا پیام به چند تا پیام»
out.pinned = [mod.GAP, mod.MAX_FORK, mod.GUESS_EVERY]; assert.deepEqual(out.pinned, [60000, 400000, 3])
// ticks: one per part, this chat only; a part ticked off is neither drawn nor asked for
$.sid = 'A'; $.ui.resolve = () => withInput; await H['command.run']($, { args: 'on' })
const ticks = (t) => PARTS_KEYS.map((k) => find(t, 'hads-tick-' + k)?.label)
const PARTS_KEYS = ['guess', 'now', 'ask']
out.ticksOn = ticks(await render()); assert.deepEqual(out.ticksOn, ['✓ حدس', '✓ دو جمله', '✓ پرسش'])
await find(await render(), 'hads-tick-guess').onPress()
out.guessOffFile = flags['/h/.claude/hads-on/A']; assert.equal(out.guessOffFile, 'on -guess')
$.forkReply = { isAnswered: true, text: '{"guesses": [{"label": "نه", "text": "نباید"}]}', usage: {} }; $.nowReply = 'فقط این. همین.'
const fk0 = calls.fork.length; await H['turn.complete']($, {}, next); await flush()
const t8 = await render()
out.guessOff = { labels: guessLabels(t8), asked: calls.fork.length > fk0, now: nowText2(t8)?.children[0] }
assert.deepEqual(out.guessOff, { labels: [], asked: false, now: 'فقط این. همین.' })
// what was made while «حدس» was ticked off never shows up when it comes back
await find(await render(), 'hads-tick-guess').onPress()
out.noStale = guessLabels(await render()).includes('نباید'); assert.equal(out.noStale, false)
await find(await render(), 'hads-tick-guess').onPress()
// another chat keeps its own ticks
$.sid = 'B'; await H['command.run']($, { args: 'on' }); out.otherTicks = ticks(await render()); assert.deepEqual(out.otherTicks, ['✓ حدس', '✓ دو جمله', '✓ پرسش']); $.sid = 'A'
// «حدس» and «دو جمله» both off: no model call at an answer's end or during work
await find(await render(), 'hads-tick-now').onPress()
const z0 = cnt(); await H['turn.complete']($, {}, next); $.t += mod.GAP; await tool(); await flush(); const z1 = cnt()
out.bothOff = [z1[0] - z0[0], z1[1] - z0[1], z1[2] - z0[2]]; assert.deepEqual(out.bothOff, [0, 0, 0])
// «پرسش» off: no box; the ticks stay so it can come back
await find(await render(), 'hads-tick-ask').onPress()
const t9 = await render(); out.askOff = { box: !!find(t9, 'hads-ask'), ticks: ticks(t9) }
assert.deepEqual(out.askOff, { box: false, ticks: ['✗ حدس', '✗ دو جمله', '✗ پرسش'] })
for (const k of PARTS_KEYS) await find(await render(), 'hads-tick-' + k).onPress()
out.allBack = flags['/h/.claude/hads-on/A']; assert.equal(out.allBack, 'on')
$.ui.resolve = realResolve
// «دفترِ حدس» (with چتِ ۲۰۵): one line per event, appended, with sid and Tehran iso; «دو جمله» not twice
const kinds = new Set(events.map((e) => e.kind))
out.eventKinds = ['now', 'guess', 'ask'].every((k) => kinds.has(k)); assert.equal(out.eventKinds, true)
out.eventShape = events.every((e) => typeof e.t === 'number' && /\+03:30$/.test(e.iso) && e.sid); assert.equal(out.eventShape, true)
out.askLogged = events.some((e) => e.kind === 'ask' && e.q && e.a); assert.equal(out.askLogged, true)
// (this test loads the module more than once; each load is its own process, so look at one)
out.sameText = [mod.sameText('ایجنت فایل را خواند و منتظر است.', 'ایجنت فایل را خواند و منتظر است!'), mod.sameText('ایجنت فایل را خواند.', 'حبیب عکس فرستاد.')]
assert.deepEqual(out.sameText, [true, false])
$.sid = 'TW'; await H['command.run']($, { args: 'on' }); const tw0 = events.length; $.nowReply = 'همان جمله. باز همان.'
for (let i = 0; i < 3; i++) { $.t += mod.GAP; await H['turn.complete']($, {}, next); await flush() }
out.noTwin = events.slice(tw0).filter((e) => e.kind === 'now').length; assert.equal(out.noTwin, 1); $.sid = 'A'
// a guess pressed then sent (as is, or edited) is logged as guess_sent; a plain prompt is not
$.ui.resolve = () => withInput; $.sid = 'G'; await H['command.run']($, { args: 'on' }); $.reply = '[{"label":"x","text":"تست‌ها رو اجرا کن و نتیجه رو بگو"}]'
await H['command.run']($, { args: 'now' }); await flush()
const before = events.length
const rG = await render(); const shown = guessLabels(rG)[0]
await find(rG, 'hads-0').onPress()
await H['prompt.submit']($, { text: shown + ' لطفاً' }, next)
await H['prompt.submit']($, { text: 'یه چیز دیگه' }, next)
const after = events.slice(before).map((e) => e.kind + (e.edited ? ':edited' : ''))
out.guessSent = after; assert.deepEqual(out.guessSent, ['guess_click', 'guess_sent'])
$.ui.resolve = realResolve
// cloud review, 24 Oct: (1) × while a «پرسش» fork runs never throws or lands in a newer box
$.ui.resolve = () => withInput; $.sid = 'R'; await H['command.run']($, { args: 'on' }); await H['turn.complete']($, {}, next); await flush()
let relF; $.model.fork = (o) => { calls.fork.push(o); return new Promise((r) => { relF = r }) }
const pAsk = H['command.run']($, { args: 'ask سؤالِ یک' }); await flush(); await new Promise((r) => setTimeout(r, 5))
const x1 = find(await render(), 'hads-ans-x'); x1 && x1.onPress()
let threw = false; relF({ isAnswered: true, text: 'جوابِ یک', usage: {} }); await new Promise((r) => setTimeout(r, 5)); try { await flush() } catch { threw = true }
out.askClosed = { threw, shown: JSON.stringify(await render()).includes('جوابِ یک') }; assert.deepEqual(out.askClosed, { threw: false, shown: false })
// a newer question while the first is still out: the first answer never lands in the second's box
let rel1, rel2; let nth = 0
$.model.fork = (o) => { calls.fork.push(o); nth++; return new Promise((r) => { if (nth === 1) rel1 = r; else rel2 = r }) }
H['command.run']($, { args: 'ask اول' }); await new Promise((r) => setTimeout(r, 5))
H['command.run']($, { args: 'ask دوم' }); await new Promise((r) => setTimeout(r, 5))
rel1({ isAnswered: true, text: 'جوابِ اول', usage: {} }); await new Promise((r) => setTimeout(r, 5))
const rQ = JSON.stringify(await render()); out.askNewer = rQ.includes('پرسش: دوم') && !rQ.includes('جوابِ اول'); assert.equal(out.askNewer, true)
rel2({ isAnswered: true, text: 'جوابِ دوم', usage: {} }); await flush()
// a «پرسش» that waits (nothing-to-fork) and then /hads off: no fork at the next answer
$.model.fork = async (o) => { calls.fork.push(o); return { isAnswered: false, reason: 'nothing-to-fork' } }
await H['command.run']($, { args: 'ask منتظر' }); await flush()
await H['command.run']($, { args: 'off' }); await H['command.run']($, { args: 'on' }); const wq0 = calls.fork.length; $.t = $.t || 1e12
$.model.fork = async (o) => { calls.fork.push(o); return { isAnswered: true, text: '{}', usage: {} } }
await H['turn.complete']($, {}, next); await flush(); await new Promise((r) => setTimeout(r, 5))
out.waitDropped = !calls.fork.slice(wq0).some((f) => /منتظر/.test(f.prompt)); assert.equal(out.waitDropped, true)
$.model.fork = async (o) => { calls.fork.push(o); return $.forkReply }
// (2) off: /hads now, /hads ask and a waiting «پرسش» never pay for a model call
await H['command.run']($, { args: 'off' }); const off0 = cnt()
out.nowOff = (await H['command.run']($, { args: 'now' })).text; await H['command.run']($, { args: 'ask چیزی' }); await flush()
const off1 = cnt(); out.offCalls = [off1[0] - off0[0], off1[1] - off0[1], off1[2] - off0[2]]; assert.deepEqual(out.offCalls, [0, 0, 0])
// (4) an answer that ends during a running end, then /hads off: the queued re-run is dropped
await H['command.run']($, { args: 'on' }); let relN; const nowKeep = $.nowModel
$.nowModel = (o) => { calls.now.push(o); return new Promise((r) => { relN = r }) }
await H['turn.complete']($, {}, next); await new Promise((r) => setTimeout(r, 5)); await H['turn.complete']($, {}, next)
await H['command.run']($, { args: 'off' }); const q0 = cnt()
$.nowModel = nowKeep; relN({ isAnswered: true, text: 'یک. دو.' }); await new Promise((r) => setTimeout(r, 10)); await flush()
const q1 = cnt(); out.endAgainOff = [q1[0] - q0[0], q1[1] - q0[1], q1[2] - q0[2]]; assert.deepEqual(out.endAgainOff, [0, 0, 0])
// (6) usage lines are appended, never read and rewritten
out.usageAppend = usages.length > 0 && !Object.keys(flags).some((k) => k.endsWith('.usage.jsonl')); assert.equal(out.usageAppend, true)
$.ui.resolve = realResolve
// the end of an exchange: one warm fork sums up this turn's «دو جمله» (done / not done), shown and logged
$.sid = 'S'; await H['command.run']($, { args: 'on' }); await H['prompt.submit']($, { text: 'کار کن' }, next)
$.nowReply = 'ایجنت فایل را خواند. منتظر نیست.'; $.t += mod.GAP; await tool(); await flush()
$.nowReply = 'ایجنت تست را اجرا کرد. تست سبز شد.'; $.t += mod.GAP; await tool(); await flush()
$.model.fork = async (o) => { calls.fork.push(o); return /جمع‌بندی/.test(o.prompt)
  ? { isAnswered: true, usage: {}, text: '{"text": "فایل خوانده و تست سبز شد. commit مانده.", "done": ["خواندنِ فایل", "تست"], "not_done": ["commit"]}' }
  : { isAnswered: true, usage: {}, text: '{"guesses": []}' } }
const sf0 = calls.fork.length, sn0 = calls.now.length, se0 = events.length
$.t += 1; await H['turn.complete']($, {}, next); await flush(); await new Promise((r) => setTimeout(r, 5))
const sumFork = calls.fork.slice(sf0).find((f) => /جمع‌بندی/.test(f.prompt))
const rS = await render()
out.summary = { asked: !!sumFork && /فایل را خواند/.test(sumFork.prompt) && /تست را اجرا کرد/.test(sumFork.prompt), noSonnet: calls.now.length === sn0,
  shown: find(rS, 'hads-now')?.children[0], done: find(rS, 'hads-sum-done')?.children[0], not: find(rS, 'hads-sum-not')?.children[0],
  logged: events.slice(se0).filter((e) => e.kind === 'turn_summary').map((e) => e.not_done) }
assert.deepEqual(out.summary, { asked: true, noSonnet: true, shown: 'فایل خوانده و تست سبز شد. commit مانده.', done: '✓ خواندنِ فایل · تست', not: '✗ commit', logged: [['commit']] })
// it is injected into later chats' memory, so it must be right (Habib, 24 Oct 23:37): the fork reads
// the whole turn (every tool's output), the «دو جمله» are only hints, done needs a tool's proof,
// unproven ⇒ not_done; and Habib's own words of the turn are logged as they were sent
out.summaryRules = { whole: /هر فراخوانیِ ابزار و خروجی‌اش/.test(sumFork.prompt), hints: /فقط راهنما‌اند، منبع نیستند/.test(sumFork.prompt),
  proof: /در done فقط چیزی که خروجیِ یک ابزار در همین نوبت ثابتش کرد/.test(sumFork.prompt), unsure: /سنجیده‌نشده ⇒ not_done با «چک نشد»/.test(sumFork.prompt),
  numbers: /عدد، ساعت، اسمِ فایل و commit فقط اگر عیناً در خروجیِ یک ابزارِ همین نوبت/.test(sumFork.prompt),
  asked: events.slice(se0).filter((e) => e.kind === 'turn_summary').map((e) => e.asked) }
assert.deepEqual(out.summaryRules, { whole: true, hints: true, proof: true, unsure: true, numbers: true, asked: ['کار کن'] })
// a short turn (fewer than SUMMARY_MIN lines): no summary fork, the plain Sonnet «دو جمله»
await H['prompt.submit']($, { text: 'سلام' }, next); const sf1 = calls.fork.length, sn1 = calls.now.length
$.t += 1; await H['turn.complete']($, {}, next); await flush()
out.shortTurn = { fork: calls.fork.slice(sf1).some((f) => /جمع‌بندی/.test(f.prompt)), sonnet: calls.now.length - sn1 }
assert.deepEqual(out.shortTurn, { fork: false, sonnet: 1 })
// an aborted turn (Esc) leaves its lines; the next prompt starts clean, so they never join its summary
$.nowReply = 'کارِ نیمه‌تمام. قطع شد.'; $.t += mod.GAP; await tool(); await flush(); $.t += mod.GAP; await tool(); await flush()
await H['turn.complete']($, { isAborted: true }, next); await flush()
await H['prompt.submit']($, { text: 'کارِ تازه' }, next); $.nowReply = 'کارِ تازه شروع شد. ادامه دارد.'; $.t += mod.GAP; await tool(); await flush()
const sf2 = calls.fork.length; $.t += 1; await H['turn.complete']($, {}, next); await flush()
const sumNew = calls.fork.slice(sf2).find((f) => /جمع‌بندی/.test(f.prompt))
out.newTurnClean = !!sumNew && /کارِ تازه شروع شد/.test(sumNew.prompt) && !/نیمه‌تمام/.test(sumNew.prompt); assert.equal(out.newTurnClean, true)
// a turn with no tool and no «دو جمله» (a plain chat answer): no summary, the plain Sonnet line
await H['prompt.submit']($, { text: 'سلام' }, next); const sf3 = calls.fork.length, sn3 = calls.now.length
$.t += 1; await H['turn.complete']($, {}, next); await flush()
out.chatTurn = { fork: calls.fork.slice(sf3).some((f) => /جمع‌بندی/.test(f.prompt)), sonnet: calls.now.length - sn3 }
assert.deepEqual(out.chatTurn, { fork: false, sonnet: 1 })
// a turn with one tool only (shorter than a minute: no «دو جمله» yet) is summed up too (۲۰۳, 24 Oct 22:58)
await H['prompt.submit']($, { text: 'یه کار کوتاه' }, next); $.t += 1; await tool({ command: 'git status' }); await flush()
const sf4 = calls.fork.length; $.t += 1; await H['turn.complete']($, {}, next); await flush()
const sumTool = calls.fork.slice(sf4).find((f) => /جمع‌بندی/.test(f.prompt))
out.toolTurn = !!sumTool && /git status/.test(sumTool.prompt); assert.equal(out.toolTurn, true)
// a chat over MAX_FORK: still its own warm fork, never Sonnet (Habib, 24 Oct 23:37: «با مدل اصلی»)
await H['prompt.submit']($, { text: 'کار در چتِ بزرگ' }, next); $.t += 1; await tool({ command: 'npm test' }); await flush()
$.ctx = mod.MAX_FORK + 1; const savedNow = $.nowModel
$.nowModel = async (o) => { calls.now.push(o); return { isAnswered: true, text: 'خط' } }
$.guessModel = async (o) => { calls.complete.push(o); return { isAnswered: true, text: o.maxTokens === 500 ? '{"text": "تست اجرا شد.", "done": ["تست"], "not_done": []}' : $.reply } }
$.model.fork = async (o) => { calls.fork.push(o); return /جمع‌بندی/.test(o.prompt) ? { isAnswered: true, usage: {}, text: '{"text": "تست اجرا شد.", "done": ["تست ⇐ npm test"], "not_done": []}' } : { isAnswered: true, usage: {}, text: '{"guesses": []}' } }
const se5 = events.length, sc5 = calls.complete.length; $.t += 1; await H['turn.complete']($, {}, next); await flush()
out.bigSummary = { via: events.slice(se5).filter((e) => e.kind === 'turn_summary').map((e) => e.via), sonnetSummary: calls.complete.slice(sc5).some((c) => c.maxTokens === 500) }
assert.deepEqual(out.bigSummary, { via: ['fork'], sonnetSummary: false })
$.ctx = 1000; $.nowModel = savedNow; $.guessModel = slow
$.model.fork = async (o) => { calls.fork.push(o); return $.forkReply }
console.log(JSON.stringify(out))
