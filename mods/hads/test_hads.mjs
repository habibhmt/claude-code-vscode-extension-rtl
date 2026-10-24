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
  session: { messages: async () => $.msgs, surfaces: async () => $.surf, id: async () => $.sid, root: async () => '/proj',
    usage: async () => ({ context: { tokens: $.ctx, window: 1e6 } }), model: async () => 'claude-opus-5-5' },
  env: { get: async (k) => (k === 'HOME' ? '/h' : undefined) },
  ui: { invalidate() {}, focus: async (o) => { calls.focus = o }, copy: async (o) => { calls.copy = o; return { isCopied: true } }, resolve: () => ({ Box: (p) => ({ t: 'Box', ...p }), Text: (p) => ({ t: 'Text', ...p }), Button: (p) => ({ t: 'Button', ...p }) }) },
  prompt: { fill: async (o) => calls.fill.push(o), submit: async (o) => calls.submit.push(o), read: async () => $.typed },
  store: { get: async (k) => store[k], set: async (k, v) => { store[k] = v } },
  clock: { after: (ms, fn) => { pending.push(fn()) }, now: async () => $.t },
  command: { register: async () => {} },
  fs: { write: async (f, t) => { flags[f] = t }, read: async (f) => { if (f in flags) return flags[f]; if ($.files[f] === undefined) throw new Error('no'); return $.files[f] }, list: async () => Object.keys($.files).map((k) => ({ name: k.replace('.remember/', '') })) },
}
const flags = {}
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
const row = (t) => t.children.find((c) => c.t === 'Box' && (c.children || []).some((x) => x && x.key === 'hads-x'))
// guess buttons drawn (× left out); 'engine' alone means the mod drew nothing
const isGuess = (c) => c.t === 'Button' && /^hads-\d+$/.test(String(c.key))
const guessLabels = (t) => t === 'engine' ? [] : row(t).children.filter(isGuess).map((c) => c.label)
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
const btns = row(tree).children.filter((c) => c.t === 'Button' && (isGuess(c) || c.key === 'hads-x'))
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

// busy guard: answers ending while one is told wait for it; then one more call tells the last, never dropped
calls.complete.length = 0; $.reply = '[{"label":"a","text":"b"}]'
const slow = $.guessModel; let release
$.guessModel = (o) => { calls.complete.push(o); return new Promise((res) => { release = () => res({ isAnswered: true, text: $.reply }) }) }
await H['turn.complete']($, {}, next); await H['turn.complete']($, {}, next); await H['turn.complete']($, {}, next)
await new Promise((r) => setTimeout(r, 5)); out.busy = calls.complete.length; assert.equal(out.busy, 1)
release(); await new Promise((r) => setTimeout(r, 5)); release(); await flush()
out.endNotDropped = calls.complete.length; assert.equal(out.endNotDropped, 2); $.guessModel = slow
// at most 5 guesses
$.reply = JSON.stringify(Array.from({ length: 15 }, (_, i) => ({ label: 'g' + i, text: 't' + i })))
await H['turn.complete']($, {}, next); await flush()
const t2 = await H['ui.render']($, { component: 'AbovePrompt' }, async () => null)
out.max = row(t2).children.filter((c) => c.t === 'Button' && (isGuess(c) || c.key === 'hads-x')).length; assert.equal(out.max, 6)
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
// the end of an answer: ONE fork over the whole chat gives both «دو جمله» and the guesses
const nowText2 = (t) => find(t, 'hads-now')
const cnt = () => [calls.fork.length, calls.now.length, calls.complete.length]
$.t += mod.GAP; $.files = { '/proj/Doc/tarif/00_vazhe_name.md': 'واژهٔ-حبیب' }
$.forkReply = { isAnswered: true, usage: { input_tokens: 9, output_tokens: 99, cache_read_input_tokens: 200000, cache_creation_input_tokens: 5 },
  text: 'بفرما: {"now": "الف کرد. ب ماند. پ.", "guesses": [{"label": "یک", "text": "کارِ یک"}, {"label": "دو", "text": "کارِ دو"}]}' }
let c0 = cnt(); await H['turn.complete']($, {}, next); await flush(); let c1 = cnt()
out.oneFork = [c1[0] - c0[0], c1[1] - c0[1], c1[2] - c0[2]]; assert.deepEqual(out.oneFork, [1, 0, 0])
const t5 = await render()
out.forkRow = { now: nowText2(t5).children?.[0] ?? nowText2(t5).label, guesses: guessLabels(t5) }
assert.deepEqual(out.forkRow, { now: 'الف کرد. ب ماند.', guesses: ['یک', 'دو'] })
out.forkPrompt = /واژهٔ-حبیب/.test(calls.fork.at(-1).prompt) && /JSON/.test(calls.fork.at(-1).prompt); assert.equal(out.forkPrompt, true)
out.turnUsage = (await $.store.get('lastTurnUsage'))?.via; assert.equal(out.turnUsage, 'fork')
// a broken fork reply falls back to Sonnet (guess + two sentences), never an empty row
$.forkReply = { isAnswered: true, text: 'not json', usage: {} }
c0 = cnt(); await H['turn.complete']($, {}, next); await flush(); c1 = cnt()
out.forkBroken = [c1[0] - c0[0], c1[1] - c0[1], c1[2] - c0[2]]; assert.deepEqual(out.forkBroken, [1, 1, 1])
// a chat over MAX_FORK tokens never forks
$.forkReply = { isAnswered: true, text: '{"now": "x. y.", "guesses": []}', usage: {} }; $.ctx = mod.MAX_FORK + 1
c0 = cnt(); await H['turn.complete']($, {}, next); await flush(); c1 = cnt()
out.bigChat = [c1[0] - c0[0], c1[1] - c0[1], c1[2] - c0[2]]; assert.deepEqual(out.bigChat, [0, 1, 1]); $.ctx = 1000
// mid-work uses only the last three messages
$.msgs = Array.from({ length: 10 }, (_, i) => ({ role: 'user', text: 'پیامِ-' + i }))
$.t += mod.GAP; await tool(); await flush()
const mp3 = calls.now.at(-1).prompt.map((b) => b.text).join('\n')
out.lastThree = !/پیامِ-6/.test(mp3) && /پیامِ-7/.test(mp3) && /پیامِ-9/.test(mp3); assert.equal(out.lastThree, true)
// a mid-work line that comes back after an answer's end does not hide the end's line
let late; $.nowModel = (o) => { calls.now.push(o); return new Promise((r) => { late = r }) }
$.forkReply = { isAnswered: true, text: '{"now": "پایان شد. منتظرِ حبیب.", "guesses": []}', usage: {} }
$.t += mod.GAP; await tool(); await new Promise((r) => setTimeout(r, 5))
$.t += 1; await H['turn.complete']($, {}, next); await new Promise((r) => setTimeout(r, 5))
late({ isAnswered: true, text: 'وسطِ کار. هنوز.' }); await flush()
const t6 = await render(); out.endWins = nowText2(t6).children?.[0] ?? nowText2(t6).label; assert.equal(out.endWins, 'پایان شد. منتظرِ حبیب.')
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
const nowBtn = find(await render(), 'hads-now'); await nowBtn.onPress()
out.btwNow = row(await render()).children.find((c) => c.t === 'Input').value.startsWith('دربارهٔ این: «') && calls.focus?.key === 'hads-ask'
assert.equal(out.btwNow, true)
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
await find(r10, 'hads-ans-copy').onPress({ surface: 'terminal' })
out.copyAnswer = calls.copy?.text === 'جوابِ دکمه.' && calls.copy?.surface === 'terminal'; assert.equal(out.copyAnswer, true)
// the fork is told not to use tools or go on with the work (mid-work it saw a tool call in flight)
out.noTools = /ابزاری صدا نزن/.test(calls.fork.at(-1).prompt); assert.equal(out.noTools, true)
// a cold warning has «باشه، بپرس»: a press asks
await F['classic.SessionStart']($, { seconds_since_last_response: 600, prompt_cache_likely_expired: true }, next)
await askVia('سردِ دکمه'); f1 = calls.fork.length
await find(await F['ui.render']($, { component: 'AbovePrompt' }, async () => 'engine'), 'hads-ans-go').onPress({}); await flush()
out.coldButton = calls.fork.length === f1 + 1; assert.equal(out.coldButton, true)
$.ui.resolve = realResolve
// the numbers agreed with Habib and the ناظر (تعریفِ ۱۰): a change must turn this red
out.pinned = [mod.GAP, mod.MAX_FORK]; assert.deepEqual(out.pinned, [60000, 400000])
// ticks: one per part, this chat only; a part ticked off is neither drawn nor asked for
$.sid = 'A'; $.ui.resolve = () => withInput; await H['command.run']($, { args: 'on' })
const ticks = (t) => PARTS_KEYS.map((k) => find(t, 'hads-tick-' + k)?.label)
const PARTS_KEYS = ['guess', 'now', 'ask']
out.ticksOn = ticks(await render()); assert.deepEqual(out.ticksOn, ['✓ حدس', '✓ دو جمله', '✓ پرسش'])
await find(await render(), 'hads-tick-guess').onPress()
out.guessOffFile = flags['/h/.claude/hads-on/A']; assert.equal(out.guessOffFile, 'on -guess')
$.forkReply = { isAnswered: true, text: '{"now": "فقط این. همین.", "guesses": [{"label": "نه", "text": "نباید"}]}', usage: {} }
await H['turn.complete']($, {}, next); await flush()
const t8 = await render()
out.guessOff = { labels: guessLabels(t8), asked: /guesses/.test(calls.fork.at(-1).prompt), now: nowText2(t8)?.label }
assert.deepEqual(out.guessOff, { labels: [], asked: false, now: 'فقط این. همین.' })
// what was made while «حدس» was ticked off never shows up when it comes back
await find(await render(), 'hads-tick-guess').onPress()
out.noStale = guessLabels(await render()).includes('نه'); assert.equal(out.noStale, false)
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
console.log(JSON.stringify(out))
