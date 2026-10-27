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
  process: { run: async (argv, init) => { if (argv?.[0] === 'grep') { calls.sanad = [...(calls.sanad || []), argv]; const t = argv[5] in flags ? flags[argv[5]] : $.files[argv[5]]; return { exitCode: t !== undefined && String(t).includes(argv[4]) ? 0 : 1, stdout: '' } } if (argv?.[0] === 'git') { calls.git = [...(calls.git || []), argv]; return { exitCode: 0, stdout: argv.includes('-200') ? ($.gitLog || '') : ($.gitRecent || '') } } if (/hafeze_dayere\.py$/.test(argv?.[0] || '')) { const sid = argv[argv.indexOf('--chat') + 1]; calls.dayere = [...(calls.dayere || []), argv.slice(1)]; if (argv[1] === 'set' && !$.dayereBroken && !$.dayereSetIgnored) dayere[sid] = argv[2]; return { exitCode: 0, stdout: $.dayereBroken ? 'Traceback\n' : JSON.stringify({ dayere: dayere[sid] || 'poshe', az: 'sarasari' }) + '\n' } } if (/cat >>/.test(argv?.[2] || '') && /\.nakarde_anjam_shod\.jsonl$/.test(argv[4])) { flags[argv[4]] = (flags[argv[4]] || '') + init.stdin; return { exitCode: 0, stdout: '' } } if (/cat >>/.test(argv?.[2] || '')) { (/\.usage\.jsonl$/.test(argv[4]) ? usages : events).push(JSON.parse(init.stdin)); return { exitCode: 0, stdout: '' } } calls.run = (calls.run || 0) + 1; calls.argv = argv; if ($.tailFails) throw new Error('no tail'); return { exitCode: 0, stdout: $.tail || '' } } },
  fs: { write: async (f, t) => { flags[f] = t }, read: async (f) => { if (f in flags) return flags[f]; if ($.files[f] === undefined) throw new Error('no'); return $.files[f] }, list: async () => Object.keys($.files).map((k) => ({ name: k.replace('.remember/', '') })) },
}
const flags = {}
// ۲۰۵'s memory-scope setting, per chat id, as its hafeze_dayere.py keeps it
const dayere = {}
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
$.t += mod.do_jomle_fasele_ms; await tool(); await flush()
out.afterGap = calls.now.length; assert.equal(out.afterGap, 2)
// an answer's end always tells, even inside the gap
await H['turn.complete']($, {}, next); await flush()
out.turnAlways = calls.now.length; assert.equal(out.turnAlways, 3)
// the glossary of the project goes in, and the tool that just ran
$.files = { '/proj/Doc/tarif/00_vazhe_name.md': 'واژهٔ-حبیب' }; $.t += mod.do_jomle_fasele_ms; await tool({ command: 'npm test' }); await flush()
const np = calls.now.at(-1).prompt.map((b) => b.text).join('\n')
out.glossary = /واژهٔ-حبیب/.test(np) && /npm test/.test(np) && calls.now.at(-1).model === 'claude-sonnet-5-5'; assert.equal(out.glossary, true)
// a subagent's tools, or a chat that is off, never call
$.t += mod.do_jomle_fasele_ms; await tool({ agentId: 'sub' }); await flush(); $.sid = 'B'; $.t += mod.do_jomle_fasele_ms; await tool(); await flush(); $.sid = 'A'
out.subOrOff = calls.now.length; assert.equal(out.subOrOff, 4)
// five sentences from the model: two are shown
$.nowReply = 'اول. دوم! سوم؟ چهارم. پنجم.'; $.t += mod.do_jomle_fasele_ms; await tool(); await flush()
const nowText = (t) => find(t, 'hads-now')?.children[0]
out.twoOnly = nowText(await render()); assert.equal(out.twoOnly, 'اول. دوم!')
// a dot inside a file name or a version does not end the sentence
out.fileDot = mod.kutah_be_do_jomle('ایجنت فایل register.js را در v2.10 عوض کرد. بعد تست زد. سوم.'); assert.equal(out.fileDot, 'ایجنت فایل register.js را در v2.10 عوض کرد. بعد تست زد.')
// a «sentence» without a stop, 2000 long, is cut to MAX_NOW with …
const long = mod.kutah_be_do_jomle('ا'.repeat(2000)); out.maxLen = long.length + (long.endsWith('…') ? '…' : ''); assert.equal(out.maxLen, mod.had_do_jomle_harf + '…')
// the tool's result comes back untouched and never waits for the model
let hang; $.nowModel = () => new Promise((r) => { hang = r })
$.t += mod.do_jomle_fasele_ms; out.untouched = (await tool()).result; assert.equal(out.untouched, 'ok')
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
$.t += mod.do_jomle_fasele_ms; $.files = { '/proj/Doc/tarif/00_vazhe_name.md': 'واژهٔ-حبیب' }; $.nowReply = 'الف کرد. ب ماند. پ.'
$.forkReply = { isAnswered: true, usage: { input_tokens: 9, output_tokens: 99, cache_read_input_tokens: 200000, cache_creation_input_tokens: 5 },
  text: 'بفرما: {"hads": [{"label": "یک", "text": "کارِ یک"}, {"label": "دو", "text": "کارِ دو"}]}' }
$.sid = 'F'; await H['command.run']($, { args: 'on' })
let c0 = cnt(); await H['turn.complete']($, {}, next); await flush(); let c1 = cnt()
out.oneFork = [c1[0] - c0[0], c1[1] - c0[1], c1[2] - c0[2]]; assert.deepEqual(out.oneFork, [1, 1, 0])
const t5 = await render()
out.forkRow = { now: nowText2(t5).children[0], guesses: guessLabels(t5) }
assert.deepEqual(out.forkRow, { now: 'الف کرد. ب ماند.', guesses: ['کارِ یک', 'کارِ دو'] })
out.forkPrompt = /JSON/.test(calls.fork.at(-1).prompt) && /"hads"/.test(calls.fork.at(-1).prompt) && !/"do_jomle"/.test(calls.fork.at(-1).prompt); assert.equal(out.forkPrompt, true)
out.turnUsage = (await $.store.get('kharj_akhar_hads_fork'))?.rah; assert.equal(out.turnUsage, 'fork')
// the next GUESS_EVERY-1 answers: «دو جمله» only, no fork, the guesses stay
const between = []
for (let i = 1; i < mod.hads_har_chand_javab; i++) { c0 = cnt(); await H['turn.complete']($, {}, next); await flush(); c1 = cnt(); between.push([c1[0] - c0[0], c1[1] - c0[1], c1[2] - c0[2]]) }
out.between = between; assert.deepEqual(out.between, Array(mod.hads_har_chand_javab - 1).fill([0, 1, 0]))
out.guessesKept = guessLabels(await render()); assert.deepEqual(out.guessesKept, ['کارِ یک', 'کارِ دو'])
// a broken fork reply falls back to Sonnet for the guesses, never an empty row
$.forkReply = { isAnswered: true, text: 'not json', usage: {} }
c0 = cnt(); await H['turn.complete']($, {}, next); await flush(); c1 = cnt()
out.forkBroken = [c1[0] - c0[0], c1[1] - c0[1], c1[2] - c0[2]]; assert.deepEqual(out.forkBroken, [1, 1, 1])
// a chat over MAX_FORK tokens never forks for the guesses alone («نکرده‌ها» ticked off)
const fileF = flags['/h/.claude/hads-on/F']; flags['/h/.claude/hads-on/F'] = 'on -nakarde -khodkar -cron'
$.forkReply = { isAnswered: true, text: '{"hads": []}', usage: {} }; $.ctx = mod.had_fork_context_token + 1
c0 = cnt(); await H['command.run']($, { args: 'now' }); await flush(); c1 = cnt()
out.bigChat = [c1[0] - c0[0], c1[1] - c0[1], c1[2] - c0[2]]; assert.deepEqual(out.bigChat, [0, 1, 1])
// «نکرده‌ها» (Habib, 25 Oct 04:22): two each time, with the guesses; they need the whole chat, so even a
// big chat forks for them; Habib's words, when, why; the prompt carries the audit's rules and last time's items
flags['/h/.claude/hads-on/F'] = fileF
$.forkReply = { isAnswered: true, usage: {}, text: '{"hads": [{"label": "x", "text": "تست بزن"}], "nakarde": [{"harf": "اسمای قدیم رو جدید کن", "zaman": "۲۵ اکت ۰۲:۵۸", "chera": "۲۰۵ هنوز ریلود نشده"}, {"harf": "عکس بگیر", "zaman": "۲۵ اکت ۰۲:۲۸", "chera": "گفتی منتظرِ حبیب"}, {"harf": "سومی", "zaman": "", "chera": "نباید بیاید"}]}' }
const nk0 = calls.fork.length, ev0 = events.length; await H['command.run']($, { args: 'now' }); await flush()
const nkPrompt = calls.fork.slice(nk0).map((f) => f.prompt).join('\n')
const rN = await render()
out.nakarde = { fork: calls.fork.length - nk0, rules: /فقط حرفِ خودِ حبیب/.test(nkPrompt) && /خروجیِ یک ابزار در همین چت ثابتش کرد/.test(nkPrompt) && /حرفِ تازه‌ترِ حبیب جای حرفِ قدیمی‌اش/.test(nkPrompt) && /قولی که به حبیب یا به ایجنتِ دیگر دادی/.test(nkPrompt),
  shown: [0, 1, 2].map((i) => find(rN, 'hads-nk-' + i)?.children[0]).filter(Boolean),
  logged: events.slice(ev0).filter((e) => e.kind === 'nakarde').map((e) => e.nakarde_ha.length) }
// no cap on how many (Habib, 25 Oct 04:53: «محدودیت نداشته باشن تعدادشون»)
assert.deepEqual(out.nakarde, { fork: 1, rules: true, shown: ['ک-۱ «اسمای قدیم رو جدید کن» (۲۵ اکت ۰۲:۵۸) — ۲۰۵ هنوز ریلود نشده', 'ک-۲ «عکس بگیر» (۲۵ اکت ۰۲:۲۸) — گفتی منتظرِ حبیب', 'ک-۳ «سومی» — نباید بیاید'], logged: [3] })
// ⤵ puts it in the prompt box (never sends); the next time the prompt names last time's items so others come first
calls.fill.length = 0; await find(rN, 'hads-nk-dokme-0').onPress({}); out.nakardeFill = calls.fill.map((f) => f.text)
assert.deepEqual(out.nakardeFill, ['این را گفته بودم و هنوز نکردی، انجامش بده: «اسمای قدیم رو جدید کن» (۲۵ اکت ۰۲:۵۸)'])
// «✓ انجام شد» (Habib, 25 Oct 04:53: «یه گزینه داشته باشه که من بزنم نه انجام شده … و اون دیگه توی نکرده ها نیاد»):
// gone at once, kept in the chat's own file, the fork is told never to bring it, and a reply that brings it anyway is dropped
await find(await render(), 'hads-nk-anjam-0').onPress({})
const rDone = await render(); const afterDone = [0, 1, 2].map((i) => find(rDone, 'hads-nk-' + i)?.children[0]).filter(Boolean)
const nk1 = calls.fork.length; await H['command.run']($, { args: 'now' }); await flush()
const nkPrompt1 = calls.fork.slice(nk1).map((f) => f.prompt).join('\n')
const rFork = await render(); const afterFork = [0, 1, 2].map((i) => find(rFork, 'hads-nk-' + i)?.children[0]).filter(Boolean)
out.nakardeAnjam = { now: afterDone.length, file: String(flags['/h/.claude/hads-on/F'.replace('hads-on', 'hads-log') + '.nakarde_anjam_shod.jsonl'] || '').includes('اسمای قدیم رو جدید کن'),
  told: /حبیب این‌ها را خودش «انجام شد» زد.*«اسمای قدیم رو جدید کن»/.test(nkPrompt1), back: afterFork.some((x) => x.includes('اسمای قدیم رو جدید کن')),
  logged: events.some((e) => e.kind === 'nakarde_anjam_shod' && e.harf === 'اسمای قدیم رو جدید کن') }
// the number is kept too, so the same work in other words stays done (Habib 27 Oct 18:30)
out.nakardeAnjam.shomare = /"harf":"ک-[0-9]+"/.test(String(flags['/h/.claude/hads-log/F.nakarde_anjam_shod.jsonl'] || ''))
assert.deepEqual(out.nakardeAnjam, { now: 2, file: true, told: true, back: false, logged: true, shomare: true })
// ticked off: not asked for, not shown
$.ctx = 1000; await find(await render(), 'hads-tick-nakarde').onPress({}); const nk2 = calls.fork.length; await H['command.run']($, { args: 'now' }); await flush()
out.nakardeOff = { forked: calls.fork.length > nk2, asked: calls.fork.slice(nk2).some((f) => /nakarde/.test(f.prompt)), shown: !!find(await render(), 'hads-nk-0') }
assert.deepEqual(out.nakardeOff, { forked: true, asked: false, shown: false })
await find(await render(), 'hads-tick-nakarde').onPress({}); $.ctx = 1000
// a stale «نکرده» (Habib through ۲۰۵, 25 Oct 19:08: «بله، بسازد»): the fork sees the project's last commits and
// gives a check; one whose file holds the text, or whose project's commits say it, is not shown, and is logged
{
  $.gitRecent = '3a6013f 10-25 19:04 fix: حافظه'; $.gitLog = 'feat: دکمهٔ حافظه\nbody'; $.files['/x/tanzim.json'] = '{"ollama_ha": 1}'
  const keepReply = $.forkReply, sv0 = events.length, sf0 = calls.fork.length
  $.forkReply = { isAnswered: true, usage: {}, text: JSON.stringify({ hads: [], nakarde: [
    { harf: 'ollama رو اضافه کن', zaman: '', chera: 'هنوز در تنظیم نیست', sanad: { file: '/x/tanzim.json', matn: 'ollama_ha' } },
    { harf: 'دکمه رو بساز', zaman: '', chera: 'ساخته نشده', sanad: { git: '/proj', matn: 'دکمهٔ حافظه' } },
    { harf: 'لاگ رو عوض کن', zaman: '', chera: 'هنوز ۱۱۴۳۴', sanad: { file: '/x/tanzim.json', matn: '11435' } },
    { harf: 'عکس بگیر', zaman: '', chera: 'نگرفتی' },
    { harf: 'بد', zaman: '', chera: 'سند بی‌مسیر', sanad: { file: 'nisbi.txt', matn: 'x' } }] }) }
  await H['command.run']($, { args: 'now' }); await flush()
  const pr = calls.fork.slice(sf0).map((f) => f.prompt).join('\n'), rS = await render()
  out.nakardeSanad = { shown: [0, 1, 2, 3].map((i) => find(rS, 'hads-nk-' + i)?.children[0]).filter(Boolean).map((x) => x.replace(/^ک-[۰-۹]+ /, '').split('»')[0].slice(1)),
    prompt: /3a6013f 10-25 19:04 fix: حافظه/.test(pr) && /۷\) چیزی که بیرون از این چت انجام شده/.test(pr) && /"sanad"/.test(pr),
    logged: events.slice(sv0).filter((e) => e.kind === 'nakarde_ba_sanad').map((e) => e.anjam_shode.map((x) => x.harf)),
    root: calls.git.some((a) => a[2] === '/proj' && a.includes('-20')), onlyWhole: (calls.sanad || []).every((a) => a[5].startsWith('/')) }
  assert.deepEqual(out.nakardeSanad, { shown: ['لاگ رو عوض کن', 'عکس بگیر', 'بد'], prompt: true, logged: [['ollama رو اضافه کن', 'دکمه رو بساز']], root: true, onlyWhole: true })
  // what a check put aside is never hidden for good: one line counts them and opens them (۲۰۵, 19:17)
  const lineNks = find(rS, 'hads-nks')?.label; await find(rS, 'hads-nks').onPress(); const rO = await render()
  calls.fill.length = 0; await find(rO, 'hads-nks-dokme-0').onPress()
  out.nakardeKenar = { line: lineNks, open: [0, 1].map((i) => find(rO, 'hads-nks-' + i)?.children[0]), fill: /خودت بسنج واقعاً انجام شده یا نه: «ollama رو اضافه کن»/.test(calls.fill[0]?.text || '') }
  assert.deepEqual(out.nakardeKenar, { line: '▸ ۲ نکرده با سند کنار رفت', open: ['ک-۴ «ollama رو اضافه کن» — هست: «ollama_ha» در /x/tanzim.json', 'ک-۵ «دکمه رو بساز» — هست: «دکمهٔ حافظه» در commit‌های /proj'], fill: true })
  await find(rO, 'hads-nks').onPress()
  // after a reload the line is there again
  await new Promise((r) => setTimeout(r, 5))
  const rl2 = await import((process.env.HADS_JS || new URL('./hooks/register.js', import.meta.url).href) + '?reload2')
  const RL2 = {}; rl2.register((ev, a, b) => { RL2[ev] = b || a; return { catch() {} } })
  out.nakardeKenarReload = find(await RL2['ui.render']($, { component: 'AbovePrompt' }, async () => 'engine'), 'hads-nks')?.label
  assert.equal(out.nakardeKenarReload, '▸ ۲ نکرده با سند کنار رفت')
  // a word too short to prove anything is no check: «dayere» is in the file, yet the row stays
  $.forkReply = { isAnswered: true, usage: {}, text: JSON.stringify({ hads: [], nakarde: [{ harf: 'دایره رو بساز', zaman: '', chera: 'نیست', sanad: { file: '/x/tanzim.json', matn: 'ollama' } }] }) }
  await H['command.run']($, { args: 'now' }); await flush()
  out.sanadKutah = find(await render(), 'hads-nk-0')?.children[0]?.replace(/^ک-[۰-۹]+ /, '').startsWith('«دایره رو بساز»'); assert.equal(out.sanadKutah, true)
  $.forkReply = keepReply
}
$.sid = 'A'
// mid-work uses only the last three messages
$.msgs = Array.from({ length: 10 }, (_, i) => ({ role: 'user', text: 'پیامِ-' + i }))
$.t += mod.do_jomle_fasele_ms; await tool(); await flush()
const mp3 = calls.now.at(-1).prompt.map((b) => b.text).join('\n')
out.lastThree = !/پیامِ-6/.test(mp3) && /پیامِ-7/.test(mp3) && /پیامِ-9/.test(mp3); assert.equal(out.lastThree, true)
// deep in a long answer the last three are all the agent's: Habib's last request still goes in
const longTurn = [{ role: 'user', text: 'قدیمی' }, { role: 'user', text: 'خواستهٔ-حبیب' }, { role: 'user', text: 'Another Claude session sent a message: <cross-session-message>ایجنت</cross-session-message>' },
  ...Array.from({ length: 6 }, (_, i) => ({ role: 'assistant', text: 'کار-' + i }))]
out.hisRequest = mod.payam_ha_ye_akhar(longTurn).map((m) => m.text); assert.deepEqual(out.hisRequest, ['قدیمی', 'خواستهٔ-حبیب', 'کار-3', 'کار-4', 'کار-5'])
// a mid-work line that comes back after an answer's end does not hide the end's line
let late; let lateOnce = true
$.nowModel = (o) => { calls.now.push(o); if (lateOnce) { lateOnce = false; return new Promise((r) => { late = r }) } return { isAnswered: true, text: 'پایان شد. منتظرِ حبیب.' } }
$.t += mod.do_jomle_fasele_ms; await tool(); await new Promise((r) => setTimeout(r, 5))
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
// every plain text in the box (the answer sits in its part's own box since 25 Oct 19:10)
const ansText = (t) => { const o = []; const w = (x) => { if (!x || typeof x !== 'object') return; if (x.t === 'Text' && typeof x.children?.[0] === 'string') o.push(x.children[0]); for (const c of x.children || []) w(c) }; w(t); return o }
out.askShown = ansText(await render()).includes('یعنی دکمه ساخته شد.'); assert.equal(out.askShown, true)
out.askUsage = (await $.store.get('kharj_akhar_porsesh'))?.cache_read_input_tokens; assert.equal(out.askUsage, 3)
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
$.forkReply = { isAnswered: true, text: '{"do_jomle": "مجری دارد می‌سازد. منتظرِ ناظر است.", "hads": []}', usage: {} }
$.t += 1; await H['turn.complete']($, {}, next); await flush()
// «دو جمله» is plain text Habib selects and copies (Ctrl+C), not a button; no کپی buttons anywhere
const rSel = await render()
out.nowSelectable = find(rSel, 'hads-now')?.t === 'Text' && !JSON.stringify(rSel).includes('copy'); assert.equal(out.nowSelectable, true)
// a cold cache (idle past COLD): the first Enter only tells the cost, the second asks
$.t += mod.cache_sard_ms + 1; $.ctx = 200000; const f0 = calls.fork.length
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
out.when = mod.zaman_miladi(Date.UTC(2026, 9, 24, 15, 27)); assert.equal(out.when, '۲۴ اکت ۱۸:۵۷')
$.ui.resolve = () => withInput; $.sid = 'H'; await F['command.run']($, { args: 'on' })
for (let i = 0; i < 55; i++) {
  $.nowReply = 'جملهٔ-' + i + '. تمام.'; $.t += 1000
  await F['turn.complete']($, {}, next); await flush()
}
const histLines = String(flags['/h/.claude/hads-log/H.do_jomle_ghablia.jsonl']).trim().split('\n')
out.histCap = histLines.length; assert.equal(out.histCap, mod.had_ghablia_tedad)
let rH = await F['ui.render']($, { component: 'AbovePrompt' }, async () => 'engine')
out.histButton = find(rH, 'hads-hist')?.label; assert.equal(out.histButton, 'قبلی‌ها ۴۹')
await find(rH, 'hads-hist').onPress({}); rH = await F['ui.render']($, { component: 'AbovePrompt' }, async () => 'engine')
const h0 = find(rH, 'hads-hist-0')?.children[0], h9 = find(rH, 'hads-hist-9')?.children[0]
out.histOrder = [/جملهٔ-53\./.test(h0), /جملهٔ-44\./.test(h9), !find(rH, 'hads-hist-10'), / — /.test(h0) && /^[۰-۹]+ [^ ]+ [۰-۹]{2}:[۰-۹]{2} — /.test(h0)]
assert.deepEqual(out.histOrder, [true, true, true, true])
out.histText = find(rH, 'hads-hist-0')?.t === 'Text' && !find(rH, 'hads-hist-copy-0'); assert.equal(out.histText, true)
await find(rH, 'hads-hist').onPress({})
// another chat has its own history
$.sid = 'H2'; await F['command.run']($, { args: 'on' }); $.forkReply = { isAnswered: true, text: '{"do_jomle": "دیگری. بله."}', usage: {} }
await F['turn.complete']($, {}, next); await flush()
out.histOwn = String(flags['/h/.claude/hads-log/H2.do_jomle_ghablia.jsonl']).trim().split('\n').length; assert.equal(out.histOwn, 1); $.sid = 'H'
// two states (26 Oct 19:18): × leaves the one button, kept over a reload; the button opens the whole box; no ▾ line
await find(await F['ui.render']($, { component: 'AbovePrompt' }, async () => 'engine'), 'hads-tick-hads').onPress({})
let rO = await F['ui.render']($, { component: 'AbovePrompt' }, async () => 'engine')
out.noMin = !find(rO, 'hads-min'); assert.equal(out.noMin, true)
await find(rO, 'hads-x').onPress({}); out.dotFile = flags['/h/.claude/hads-on/H']; assert.equal(out.dotFile, 'on -hads tak_dokme')
const again2 = await import((process.env.HADS_JS || new URL('./hooks/register.js', import.meta.url).href) + '?again2')
const G = {}; again2.register((ev, a, b) => { G[ev] = b || a; return { catch() {} } })
let rD = await G['ui.render']($, { component: 'AbovePrompt' }, async () => 'engine')
out.dot = { button: find(rD, 'hads-dot')?.label, nothingElse: !find(rD, 'hads-min') && !find(rD, 'hads-ask') && !find(rD, 'hads-now') && !find(rD, 'hads-x') }
assert.deepEqual(out.dot, { button: 'حدس ▸', nothingElse: true })
await find(rD, 'hads-dot').onPress({}); out.dotToOpen = flags['/h/.claude/hads-on/H']; assert.equal(out.dotToOpen, 'on -hads')
// an old file with yek_khat shows the button, which opens the box
flags['/h/.claude/hads-on/H'] = 'on -hads yek_khat'; rD = await F['ui.render']($, { component: 'AbovePrompt' }, async () => 'engine')
out.oldLine = find(rD, 'hads-dot')?.label; assert.equal(out.oldLine, 'حدس ▸')
await find(rD, 'hads-dot').onPress({}); out.backOpen = flags['/h/.claude/hads-on/H']; assert.equal(out.backOpen, 'on -hads')
// a tick keeps the other words of the file
flags['/h/.claude/hads-on/H'] = 'on +do_jomle_fork yek_khat'; await F['ui.render']($, { component: 'AbovePrompt' }, async () => 'engine')
$.sid = 'H'; flags['/h/.claude/hads-on/H'] = 'on +do_jomle_fork'
await find(await F['ui.render']($, { component: 'AbovePrompt' }, async () => 'engine'), 'hads-tick-porsesh').onPress({})
out.tickKeeps = flags['/h/.claude/hads-on/H']; assert.equal(out.tickKeeps, 'on -porsesh +do_jomle_fork')
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
out.parseHooks = mod.khandan_hook_ha($.tail).map((h) => h.name + ':' + h.n)
assert.deepEqual(out.parseHooks, ['SessionStart:startup:1', 'UserPromptSubmit:1', 'PostToolUse:Bash:2', 'SessionStart:compact:1'])
$.ui.resolve = () => withInput; $.sid = 'K'; await F['command.run']($, { args: 'on' }); calls.run = 0
await F['turn.complete']($, {}, next); await new Promise((r) => setTimeout(r, 5)); await flush()
// the clock mock runs `after` at once; give the read its turn
await new Promise((r) => setTimeout(r, 5))
let rK = await F['ui.render']($, { component: 'AbovePrompt' }, async () => 'engine')
const hookTexts = (t) => [0, 1, 2, 3, 4, 5].map((i) => find(t, 'hads-hook-' + i)?.children?.[0]).filter(Boolean)
out.hooksSmall = hookTexts(rK)
assert.equal(out.hooksSmall.length, 4); assert.ok(out.hooksSmall.every((x) => x.length <= mod.had_hook_kuchak_harf))
// each hook with its Shamsi date and Tehran time
assert.equal(out.hooksSmall[1], '۲ آبان ۱۴۰۵ ۲۰:۰۹ · UserPromptSubmit · [20:09 +0330 -- habib]'); assert.ok(/^PostToolUse:Bash ×۲ · یادآوری/.test(out.hooksSmall[2]))
// only hook lines and typed prompts, the last TAIL of them: never the whole 16 MB transcript
out.tailOnly = calls.argv?.[0] === 'sh' && calls.argv?.[4] === mod.hook_transcript_grep && calls.argv?.[6] === String(mod.had_hook_transcript_khat) && calls.argv?.[7] === String(mod.had_hook_transcript_byte) && /^tail -c .*\| grep -E .*\| tail -n/.test(calls.argv?.[2]); assert.equal(out.tailOnly, true)
// big: the last HOOK_BIG_ROWS, each whole up to HOOK_BIG (selectable text, no کپی buttons)
await find(rK, 'hads-hook-size').onPress({}); rK = await F['ui.render']($, { component: 'AbovePrompt' }, async () => 'engine')
out.hooksBig = { file: flags['/h/.claude/hads-on/K'], rows: hookTexts(rK).length, whole: hookTexts(rK).some((x) => x.endsWith(LONG)), copy: JSON.stringify(rK).includes('copy') }
assert.deepEqual(out.hooksBig, { file: 'on hook_bozorg', rows: mod.had_hook_bozorg_radif, whole: true, copy: false })
// a pages-long hook (a SessionStart handoff) is cut: it filled the band and hid «دو جمله» (24 Oct)
const keepTail = $.tail; $.tail += '\n' + J({ attachment: { type: 'hook_success', hookName: 'SessionStart:resume', content: 'ه'.repeat(5000) } })
await F['turn.complete']($, {}, next); await new Promise((r) => setTimeout(r, 5)); await flush(); await new Promise((r) => setTimeout(r, 5))
rK = await F['ui.render']($, { component: 'AbovePrompt' }, async () => 'engine')
out.hookBigCut = Math.max(...hookTexts(rK).map((x) => x.length)); assert.ok(out.hookBigCut <= mod.had_hook_bozorg_harf + 60, 'big hook ' + out.hookBigCut)
// the ticks stay last, next to the prompt, whatever is above them
const lastRow = rK.children.at(-1); out.ticksLast = (lastRow.children || []).some((x) => x && /^hads-tick-/.test(String(x.key))); assert.equal(out.ticksLast, true)
// × on top, always in sight (24 Oct 22:41); only it since ▾ went (26 Oct 19:18)
const topRow = rK.children.find((c) => c && c.t === 'Box'); out.closeOnTop = topRow?.key === 'hads-top' && topRow.children.map((x) => x.label).join(' ') === '×'; assert.equal(out.closeOnTop, true)
$.tail = keepTail
// ticked off: the transcript is not read at all
await find(rK, 'hads-tick-hook').onPress({}); calls.run = 0
await F['turn.complete']($, {}, next); await new Promise((r) => setTimeout(r, 5)); await flush()
out.hooksOff = { runs: calls.run, rows: hookTexts(await F['ui.render']($, { component: 'AbovePrompt' }, async () => 'engine')).length }
assert.deepEqual(out.hooksOff, { runs: 0, rows: 0 })
// a failing tail never breaks anything
await find(await F['ui.render']($, { component: 'AbovePrompt' }, async () => 'engine'), 'hads-tick-hook').onPress({}); $.tailFails = true
await F['turn.complete']($, {}, next); await new Promise((r) => setTimeout(r, 5)); await flush(); out.tailFails = 'ok'; $.tailFails = false
$.ui.resolve = realResolve; $.sid = 'A'
// the numbers agreed with Habib and the ناظر (تعریفِ ۱۲): a change must turn this red
// GUESS_EVERY: Habib 24 Oct «حدسو بذار مدل اصلی بکنه … چند تا پیام به چند تا پیام»
out.pinned = [mod.do_jomle_fasele_ms, mod.had_fork_context_token, mod.hads_har_chand_javab]; assert.deepEqual(out.pinned, [60000, 400000, 3])
// ticks: one per part, this chat only; a part ticked off is neither drawn nor asked for
$.sid = 'A'; $.ui.resolve = () => withInput; await H['command.run']($, { args: 'on' })
const ticks = (t) => PARTS_KEYS.map((k) => find(t, 'hads-tick-' + k)?.label)
const PARTS_KEYS = ['hads', 'do_jomle', 'porsesh']
out.ticksOn = ticks(await render()); assert.deepEqual(out.ticksOn, ['✓ حدس', '✓ دو جمله', '✓ پرسش'])
await find(await render(), 'hads-tick-hads').onPress()
out.guessOffFile = flags['/h/.claude/hads-on/A']; assert.equal(out.guessOffFile, 'on -hads')
$.forkReply = { isAnswered: true, text: '{"hads": [{"label": "نه", "text": "نباید"}]}', usage: {} }; $.nowReply = 'فقط این. همین.'
const fk0 = calls.fork.length; await H['turn.complete']($, {}, next); await flush()
const t8 = await render()
out.guessOff = { labels: guessLabels(t8), asked: calls.fork.length > fk0, now: nowText2(t8)?.children[0] }
assert.deepEqual(out.guessOff, { labels: [], asked: false, now: 'فقط این. همین.' })
// what was made while «حدس» was ticked off never shows up when it comes back
await find(await render(), 'hads-tick-hads').onPress()
out.noStale = guessLabels(await render()).includes('نباید'); assert.equal(out.noStale, false)
await find(await render(), 'hads-tick-hads').onPress()
// another chat keeps its own ticks
$.sid = 'B'; await H['command.run']($, { args: 'on' }); out.otherTicks = ticks(await render()); assert.deepEqual(out.otherTicks, ['✓ حدس', '✓ دو جمله', '✓ پرسش']); $.sid = 'A'
// «حدس», «نکرده‌ها» and «دو جمله» all off: no model call at an answer's end or during work
await find(await render(), 'hads-tick-do_jomle').onPress(); await find(await render(), 'hads-tick-nakarde').onPress(); await find(await render(), 'hads-tick-khodkar').onPress(); await find(await render(), 'hads-tick-cron').onPress()
const z0 = cnt(); await H['turn.complete']($, {}, next); $.t += mod.do_jomle_fasele_ms; await tool(); await flush(); const z1 = cnt()
out.bothOff = [z1[0] - z0[0], z1[1] - z0[1], z1[2] - z0[2]]; assert.deepEqual(out.bothOff, [0, 0, 0])
// «پرسش» off: no box; the ticks stay so it can come back
await find(await render(), 'hads-tick-porsesh').onPress()
const t9 = await render(); out.askOff = { box: !!find(t9, 'hads-ask'), ticks: ticks(t9) }
assert.deepEqual(out.askOff, { box: false, ticks: ['✗ حدس', '✗ دو جمله', '✗ پرسش'] })
for (const k of PARTS_KEYS) await find(await render(), 'hads-tick-' + k).onPress()
await find(await render(), 'hads-tick-nakarde').onPress(); await find(await render(), 'hads-tick-khodkar').onPress(); await find(await render(), 'hads-tick-cron').onPress()
out.allBack = flags['/h/.claude/hads-on/A']; assert.equal(out.allBack, 'on')
$.ui.resolve = realResolve
// «دفترِ حدس» (with چتِ ۲۰۵): one line per event, appended, with sid and Tehran iso; «دو جمله» not twice
const kinds = new Set(events.map((e) => e.kind))
out.eventKinds = ['do_jomle', 'hads', 'porsesh'].every((k) => kinds.has(k)); assert.equal(out.eventKinds, true)
out.eventShape = events.every((e) => typeof e.t === 'number' && /\+03:30$/.test(e.iso) && e.sid); assert.equal(out.eventShape, true)
out.askLogged = events.some((e) => e.kind === 'porsesh' && e.porsesh_matn && e.javab_matn); assert.equal(out.askLogged, true)
// (this test loads the module more than once; each load is its own process, so look at one)
out.sameText = [mod.hamun_matn('ایجنت فایل را خواند و منتظر است.', 'ایجنت فایل را خواند و منتظر است!'), mod.hamun_matn('ایجنت فایل را خواند.', 'حبیب عکس فرستاد.')]
assert.deepEqual(out.sameText, [true, false])
$.sid = 'TW'; await H['command.run']($, { args: 'on' }); const tw0 = events.length; $.nowReply = 'همان جمله. باز همان.'
for (let i = 0; i < 3; i++) { $.t += mod.do_jomle_fasele_ms; await H['turn.complete']($, {}, next); await flush() }
out.noTwin = events.slice(tw0).filter((e) => e.kind === 'do_jomle').length; assert.equal(out.noTwin, 1); $.sid = 'A'
// a guess pressed then sent (as is, or edited) is logged as guess_sent; a plain prompt is not
$.ui.resolve = () => withInput; $.sid = 'G'; await H['command.run']($, { args: 'on' }); $.reply = '[{"label":"x","text":"تست‌ها رو اجرا کن و نتیجه رو بگو"}]'
await H['command.run']($, { args: 'now' }); await flush()
const before = events.length
const rG = await render(); const shown = guessLabels(rG)[0]
await find(rG, 'hads-0').onPress()
await H['prompt.submit']($, { text: shown + ' لطفاً' }, next)
await H['prompt.submit']($, { text: 'یه چیز دیگه' }, next)
const after = events.slice(before).map((e) => e.kind + (e.virayesh_shod ? ':virayesh_shod' : ''))
out.guessSent = after; assert.deepEqual(out.guessSent, ['hads_zadan', 'hads_ferestade'])
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
out.waitDropped = !calls.fork.slice(wq0).some((f) => /^منتظر/.test(f.prompt)); assert.equal(out.waitDropped, true)
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
$.nowReply = 'ایجنت فایل را خواند. منتظر نیست.'; $.t += mod.do_jomle_fasele_ms; await tool(); await flush()
$.nowReply = 'ایجنت تست را اجرا کرد. تست سبز شد.'; $.t += mod.do_jomle_fasele_ms; await tool(); await flush()
$.model.fork = async (o) => { calls.fork.push(o); return /جمع‌بندی/.test(o.prompt)
  ? { isAnswered: true, usage: {}, text: '{"text": "فایل خوانده و تست سبز شد. commit مانده.", "anjam_shod": ["خواندنِ فایل", "تست"], "anjam_nashod": ["commit"]}' }
  : { isAnswered: true, usage: {}, text: '{"hads": []}' } }
const sf0 = calls.fork.length, sn0 = calls.now.length, se0 = events.length
$.t += 1; await H['turn.complete']($, {}, next); await flush(); await new Promise((r) => setTimeout(r, 5))
const sumFork = calls.fork.slice(sf0).find((f) => /جمع‌بندی/.test(f.prompt))
const rS = await render()
out.summary = { asked: !!sumFork && /فایل را خواند/.test(sumFork.prompt) && /تست را اجرا کرد/.test(sumFork.prompt), noSonnet: calls.now.length === sn0,
  shown: find(rS, 'hads-now')?.children[0], done: find(rS, 'hads-sum-anjam_shod')?.children[0], not: find(rS, 'hads-sum-anjam_nashod')?.children[0],
  logged: events.slice(se0).filter((e) => e.kind === 'jambandi_nobat').map((e) => e.anjam_nashod) }
assert.deepEqual(out.summary, { asked: true, noSonnet: true, shown: 'فایل خوانده و تست سبز شد. commit مانده.', done: '✓ خواندنِ فایل · تست', not: '✗ commit', logged: [['commit']] })
// it is injected into later chats' memory, so it must be right (Habib, 24 Oct 23:37): the fork reads
// the whole turn (every tool's output), the «دو جمله» are only hints, done needs a tool's proof,
// unproven ⇒ not_done; and Habib's own words of the turn are logged as they were sent
out.summaryRules = { whole: /هر فراخوانیِ ابزار و خروجی‌اش/.test(sumFork.prompt), hints: /فقط راهنما‌اند، منبع نیستند/.test(sumFork.prompt),
  proof: /در anjam_shod فقط چیزی که خروجیِ یک ابزار در همین نوبت ثابتش کرد/.test(sumFork.prompt), unsure: /سنجیده‌نشده ⇒ anjam_nashod با «چک نشد»/.test(sumFork.prompt),
  numbers: /عدد، ساعت، اسمِ فایل و commit فقط اگر عیناً در خروجیِ یک ابزارِ همین نوبت/.test(sumFork.prompt),
  asked: events.slice(se0).filter((e) => e.kind === 'jambandi_nobat').map((e) => e.khaste_habib) }
assert.deepEqual(out.summaryRules, { whole: true, hints: true, proof: true, unsure: true, numbers: true, asked: ['کار کن'] })
// 205, 25 Oct: an evidence proves only what it shows (an edit is «code added», not «it works»)
out.proofScope = /ویرایشِ کد ⇒ «کد اضافه شد»، نه «کار می‌کند»/.test(sumFork.prompt); assert.equal(out.proofScope, true)
// a turn started by Claude Code itself or another chat logs no request of Habib's
out.notHabib = ['Continue from where you left off.', '<task-notification>x</task-notification>', 'This session is being continued from a previous conversation', 'Another Claude session sent a message: <cross-session-message>x</cross-session-message>', 'این کار رو بکن']
  .map((t) => mod.harf_habib(t) === mod.matn_bi_harfe_habib)
assert.deepEqual(out.notHabib, [true, true, true, true, false])
// a short turn (fewer than SUMMARY_MIN lines): no summary fork, the plain Sonnet «دو جمله»
await H['prompt.submit']($, { text: 'سلام' }, next); const sf1 = calls.fork.length, sn1 = calls.now.length
$.t += 1; await H['turn.complete']($, {}, next); await flush()
out.shortTurn = { fork: calls.fork.slice(sf1).some((f) => /جمع‌بندی/.test(f.prompt)), sonnet: calls.now.length - sn1 }
assert.deepEqual(out.shortTurn, { fork: false, sonnet: 1 })
// an aborted turn (Esc) leaves its lines; the next prompt starts clean, so they never join its summary
$.nowReply = 'کارِ نیمه‌تمام. قطع شد.'; $.t += mod.do_jomle_fasele_ms; await tool(); await flush(); $.t += mod.do_jomle_fasele_ms; await tool(); await flush()
await H['turn.complete']($, { isAborted: true }, next); await flush()
await H['prompt.submit']($, { text: 'کارِ تازه' }, next); $.nowReply = 'کارِ تازه شروع شد. ادامه دارد.'; $.t += mod.do_jomle_fasele_ms; await tool(); await flush()
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
$.ctx = mod.had_fork_context_token + 1; const savedNow = $.nowModel
$.nowModel = async (o) => { calls.now.push(o); return { isAnswered: true, text: 'خط' } }
$.guessModel = async (o) => { calls.complete.push(o); return { isAnswered: true, text: o.maxTokens === 500 ? '{"text": "تست اجرا شد.", "anjam_shod": ["تست"], "anjam_nashod": []}' : $.reply } }
$.model.fork = async (o) => { calls.fork.push(o); return /جمع‌بندی/.test(o.prompt) ? { isAnswered: true, usage: {}, text: '{"text": "تست اجرا شد.", "anjam_shod": ["تست ⇐ npm test"], "anjam_nashod": []}' } : { isAnswered: true, usage: {}, text: '{"hads": []}' } }
const se5 = events.length, sc5 = calls.complete.length; $.t += 1; await H['turn.complete']($, {}, next); await flush()
out.bigSummary = { via: events.slice(se5).filter((e) => e.kind === 'jambandi_nobat').map((e) => e.rah), sonnetSummary: calls.complete.slice(sc5).some((c) => c.maxTokens === 500) }
assert.deepEqual(out.bigSummary, { via: ['fork'], sonnetSummary: false })
$.ctx = 1000; $.nowModel = savedNow; $.guessModel = slow
$.model.fork = async (o) => { calls.fork.push(o); return $.forkReply }
// «خودکار» and «کرون‌جاب» (Habib, 25 Oct 16:48 and 16:52), and ONE fork for everything at an answer's end:
// the summary, guesses, «نکرده‌ها», «خودکار», «کرون‌جاب» together («نه هر کدوم یکی یه دفعه»)
$.sid = 'K'; await H['command.run']($, { args: 'on' }); await H['prompt.submit']($, { text: 'اپ رو چک کن' }, next)
$.t += mod.do_jomle_fasele_ms; await tool(); await flush()
$.forkReply = { isAnswered: true, usage: {}, text: '{"text": "اپ چک شد. گزارش مانده.", "anjam_shod": ["چک ⇐ ls"], "anjam_nashod": [], "hads": [{"label": "x", "text": "پوش کن"}], "nakarde": [], ' +
  '"khodkar": [{"kar": "چکِ اپ", "abzar": "Bash: xcrun simctl", "chek": "عکس از شبیه‌ساز", "chera": "حبیب گفته خودت امتحان کن"}, {"kar": "حرفِ قبلیِ حبیب", "abzar": "hafeze_search.py", "chera": ""}], ' +
  '"cron": [{"kar": "چکِ نسخهٔ افزونه", "zaman": "هر روز ۰۸:۰۰ (0 8 * * *)", "rah": "launchd"}]}' }
const k0 = calls.fork.length, kn0 = calls.now.length, ke0 = events.length
$.t += 1; await H['turn.complete']($, {}, next); await flush(); await new Promise((r) => setTimeout(r, 5))
const khForks = calls.fork.slice(k0), rKh = await render()
calls.fill.length = 0; await find(rKh, 'hads-kh-dokme-0').onPress({}); await find(rKh, 'hads-cr-dokme-0').onPress({})
out.yekFork = { forks: khForks.length, all: /جمع‌بندی/.test(khForks[0]?.prompt) && /"hads"/.test(khForks[0]?.prompt) && /"nakarde"/.test(khForks[0]?.prompt) && /"khodkar"/.test(khForks[0]?.prompt) && /"cron"/.test(khForks[0]?.prompt),
  tools: ['Agent', 'Bash', 'Read', 'Write', 'Edit', 'NotebookEdit', 'Glob', 'Grep', 'LSP', 'WebSearch', 'WebFetch', 'Monitor', 'CronCreate', 'CronList', 'CronDelete', 'ScheduleWakeup', 'RemoteTrigger', 'PushNotification',
    'SendUserFile', 'SendMessage', 'ListAgents', 'TaskCreate', 'TaskGet', 'TaskList', 'TaskUpdate', 'TaskStop', 'Workflow', 'Skill', 'ToolSearch', 'WaitForMcpServers', 'ListMcpResourcesTool', 'ReadMcpResourceTool',
    'EnterWorktree', 'ExitWorktree', 'EnterPlanMode', 'ExitPlanMode', 'Artifact', 'AskUserQuestion', 'ReportFindings', 'SendFeedback', 'ShareOnboardingGuide', 'SubagentHandback', 'TodoWrite', 'PowerShell', 'EndConversation'].filter((n) => !new RegExp('\\b' + n + '\\b').test(khForks[0]?.prompt)),
  rules: /hafeze_search/.test(khForks[0]?.prompt) && /سرچ در چت‌های قبلی برای حرفِ حبیب/.test(khForks[0]?.prompt) && /کامپیوتر یوز/.test(khForks[0]?.prompt) && /CDP/.test(khForks[0]?.prompt), sonnet: calls.now.length - kn0,
  now: find(rKh, 'hads-now')?.children[0], kh: [0, 1].map((i) => find(rKh, 'hads-kh-' + i)?.children[0]), cr: find(rKh, 'hads-cr-0')?.children[0],
  fill: calls.fill.map((f) => f.text), logged: events.slice(ke0).filter((e) => e.kind === 'khodkar' || e.kind === 'cron').map((e) => e.kind) }
assert.deepEqual(out.yekFork, { forks: 1, all: true, tools: [], rules: true, sonnet: 0, now: 'اپ چک شد. گزارش مانده.',
  kh: ['چکِ اپ ⇐ Bash: xcrun simctl · چک: عکس از شبیه‌ساز — حبیب گفته خودت امتحان کن', 'حرفِ قبلیِ حبیب ⇐ hafeze_search.py'], cr: 'چکِ نسخهٔ افزونه ⇐ هر روز ۰۸:۰۰ (0 8 * * *) — launchd',
  fill: ['این را خودت انجام بده و از من نپرس: چکِ اپ ⇐ با Bash: xcrun simctl؛ نتیجه را خودت چک کن: عکس از شبیه‌ساز. اگر حبیب قبلاً درباره‌اش حرفی زده (سرچ در چت‌های قبلی)، طبقِ همان.', 'برای این کار کرون‌جاب بساز و با خرابکاریِ عمدی بسنج که اجرا می‌شود: چکِ نسخهٔ افزونه ⇐ هر روز ۰۸:۰۰ (0 8 * * *) (launchd)'],
  logged: ['cron', 'khodkar'] })
// a reload of VS Code (a new process, every variable empty) shows the same box again, «قبلی‌ها» too
// (Habib, 25 Oct 18:09: «وقتی که VS Code رو ریلود میکنیم اون متنایی که تو پنجره هدس هست اونا همه پاک میشه»)
const radif_ha = (t) => ['hads-now', 'hads-g-0', 'hads-kh-0', 'hads-kh-1', 'hads-cr-0'].map((k) => find(t, k)?.children?.[0] || null)
const ghabl = radif_ha(rKh)
const reload = await import((process.env.HADS_JS || new URL('./hooks/register.js', import.meta.url).href) + '?reload')
const RL = {}; reload.register((ev, a, b) => { RL[ev] = b || a; return { catch() {} } })
const rRl = await RL['ui.render']($, { component: 'AbovePrompt' }, async () => 'engine')
out.reload = { same: JSON.stringify(radif_ha(rRl)) === JSON.stringify(ghabl), full: ghabl.every(Boolean), summary: find(rRl, 'hads-sum-anjam_shod')?.children[0],
  file: !!flags['/h/.claude/hads-log/K.akharin.json'] }
assert.deepEqual(out.reload, { same: true, full: true, summary: '✓ چک ⇐ ls', file: true })
// the order of the parts (Habib, 25 Oct 18:01: «اگه حدس اوله میشه ردیف یک»): the ticks and the rows
// follow ~/.claude/hads-tartib, the same in every chat; ▾ × stay first, the ticks last
const tartib_kelid = (t) => { const o = []; const w = (x) => { if (!x || typeof x !== 'object') return; if (x.key) o.push(x.key); for (const c of x.children || []) w(c) }; w(t); return o }
flags['/h/.claude/hads-tartib'] = 'cron do_jomle hads\n'
const rT = await render(), kT = tartib_kelid(rT)
out.tartib = { ticks: kT.filter((k) => k.startsWith('hads-tick-')).map((k) => k.slice(10)),
  rows: ['hads-cr-0', 'hads-now', 'hads-g-0', 'hads-kh-0'].map((k) => kT.indexOf(k)).every((x, i, a) => x > 0 && (!i || x > a[i - 1])),
  top: kT[0], last: kT.slice(-2).join(' ') === 'hads-tick-zaban hads-hafeze', field: !!find(rT, 'hads-tartib'),
  // one box per part that has rows, in the same order (the page script keeps each from shrinking)
  bakhsh: kT.filter((k) => k.startsWith('hads-bakhsh-')).map((k) => k.slice(12)) }
assert.deepEqual(out.tartib, { ticks: ['cron', 'do_jomle', 'hads', 'nakarde', 'khodkar', 'porsesh', 'hook', 'zaban'], rows: true, top: 'hads-top', last: true, field: false, bakhsh: ['cron', 'do_jomle', 'hads', 'khodkar', 'hook'] })
// VS Code: a hidden field takes the order the dragged ticks give (claude-ui-buttons.js); anything else is not an order
const keepResolve = $.ui.resolve; $.ui.resolve = () => withInput
const rV = await render({ surface: 'vscode' }); const fld = find(rV, 'hads-tartib')
await fld.onInput('khodkar hads hads chizi')
out.tartibField = { value: fld.value, file: flags['/h/.claude/hads-tartib'], notMobile: !find(await render({ surface: 'mobile' }), 'hads-tartib') }
assert.deepEqual(out.tartibField, { value: 'cron do_jomle hads nakarde khodkar porsesh hook zaban', file: 'khodkar hads nakarde cron do_jomle porsesh hook zaban\n', notMobile: true })
$.ui.resolve = keepResolve; delete flags['/h/.claude/hads-tartib']
// «🔎 حافظه» (Habib to ۲۰۵, 25 Oct 18:30: «بله، بسازید»): the label is what ۲۰۵'s `get` says; a press moves
// this chat one on (همین چت ⇐ همین پروژه ⇐ همهٔ پروژه‌ها ⇐ همین چت) and no other chat; /hads hafeze works with the box off
const hafeze_label = async () => { await flush(); await new Promise((r) => setTimeout(r, 5)); return find(await render(), 'hads-hafeze')?.label }
const lb0 = await hafeze_label()
const labels = [lb0]
for (let i = 0; i < 3; i++) { await find(await render(), 'hads-hafeze').onPress(); labels.push(await hafeze_label()) }
const kSid = $.sid; $.sid = 'K2'; await H['command.run']($, { args: 'on' }); const otherLb = await hafeze_label(); $.sid = kSid
out.hafeze = { labels, other: otherLb, store: { K: dayere.K, K2: dayere.K2 }, sets: calls.dayere.filter((a) => a[0] === 'set').map((a) => a[1] + '>' + a[3]),
  logged: events.filter((e) => e.kind === 'hafeze_dayere').map((e) => e.hast) }
assert.deepEqual(out.hafeze, { labels: ['🔎 حافظه: همین پروژه', '🔎 حافظه: همهٔ پروژه‌ها', '🔎 حافظه: همین چت', '🔎 حافظه: همین پروژه'], other: '🔎 حافظه: همین پروژه',
  store: { K: 'poshe', K2: undefined }, sets: ['hame>K', 'chat>K', 'poshe>K'], logged: ['hame', 'chat', 'poshe'] })
// a write that did not take (the file refused it): the label still says what get says, not what was asked
$.dayereSetIgnored = true; await find(await render(), 'hads-hafeze').onPress(); out.hafezeTruth = [await hafeze_label(), dayere.K]; $.dayereSetIgnored = false
assert.deepEqual(out.hafezeTruth, ['🔎 حافظه: همین پروژه', 'poshe'])
// the command, with the box off; a word that is no scope is refused; a broken command is said, not guessed
await H['command.run']($, { args: 'off' })
const hc1 = await H['command.run']($, { args: 'hafeze hame' }), hc2 = await H['command.run']($, { args: 'hafeze koja' })
$.dayereBroken = true; const hc3 = await H['command.run']($, { args: 'hafeze' }); $.dayereBroken = false
out.hafezeCmd = [hc1.text, hc2.text, hc3.text, dayere.K]
assert.deepEqual(out.hafezeCmd, ['دایرهٔ سرچِ حافظه برای همین چت: همهٔ پروژه‌ها', 'یکی از این‌ها: /hads hafeze chat | poshe | hame', 'فرمانِ حافظهٔ ۲۰۵ جواب نداد', 'hame'])
// the chat's folder goes with every call; a change made elsewhere shows at the next answer, no reload
out.hafezePoshe = calls.dayere.every((a) => a.slice(-2).join(' ') === '--poshe /proj')
assert.equal(out.hafezePoshe, true)
await H['command.run']($, { args: 'on' }); dayere.K = 'chat'; await H['turn.complete']($, {}, next); await flush()
out.hafezeTaze = await hafeze_label(); assert.equal(out.hafezeTaze, '🔎 حافظه: همین چت')
await H['command.run']($, { args: 'on' })
// ticked off: not asked, not shown
await find(await render(), 'hads-tick-khodkar').onPress(); await find(await render(), 'hads-tick-cron').onPress()
const k1 = calls.fork.length; await H['command.run']($, { args: 'now' }); await flush()
out.khodkarOff = { asked: calls.fork.slice(k1).some((f) => /"khodkar"|"cron"/.test(f.prompt)), shown: !!find(await render(), 'hads-kh-0') || !!find(await render(), 'hads-cr-0'), file: flags['/h/.claude/hads-on/K'] }
assert.deepEqual(out.khodkarOff, { asked: false, shown: false, file: 'on -khodkar -cron' })
// «خودکار» goes to the chat by itself, a turn of its own; each once, and its «نکرده» once (Habib, 26 Oct 03:06 and 03:35)
$.sid = 'X'; await H['command.run']($, { args: 'on' }); calls.submit.length = 0
const khX = [{ kar: 'چکِ اپ', abzar: 'Bash: xcrun simctl', chek: 'عکس' }, { kar: 'سرچِ حرفِ حبیب', abzar: 'hafeze_search.py' }]
const dowr = async (nakarde) => { $.forkReply = { isAnswered: true, usage: {}, text: JSON.stringify({ hads: [], nakarde, khodkar: khX, cron: [] }) }; $.t += 1; await H['command.run']($, { args: 'now' }); await flush(); await new Promise((r) => setTimeout(r, 5)) }
const xf0 = calls.fork.length
await dowr([])
const sub1 = calls.submit.map((c) => c.text), rX = await render()
await dowr([{ harf: 'چکِ اپ', zaman: '', chera: 'عکسی نیامد' }, { harf: 'حرفِ دیگرِ حبیب', zaman: '', chera: 'نه' }])
const sub2 = calls.submit.slice(1).map((c) => c.text), rX2 = await render()
await dowr([{ harf: 'چکِ اپ', zaman: '', chera: 'عکسی نیامد' }])
out.khodkarFerestade = { first: sub1.length === 1 && /۱\. چکِ اپ ⇐ با Bash: xcrun simctl؛ چک: عکس/.test(sub1[0]) && /۲\. سرچِ حرفِ حبیب/.test(sub1[0]) && !/نکرده/.test(sub1[0]),
  tick: [0, 1].map((i) => find(rX, 'hads-kh-ferestade-' + i)?.children[0]),
  second: sub2.length === 1 && /هنوز انجام نشده \(نکرده\):\n۱\. چکِ اپ — عکسی نیامد/.test(sub2[0]) && !/xcrun/.test(sub2[0]) && !/حرفِ دیگرِ حبیب/.test(sub2[0]),
  rule: /۸\).*«چکِ اپ» · «سرچِ حرفِ حبیب»/.test(calls.fork[calls.fork.length - 1].prompt),
  nkRow: [0, 1].map((i) => find(rX2, 'hads-nk-' + i)?.children[0].split(' (')[0].split(' — ')[0]),
  third: calls.submit.length, file: flags['/h/.claude/hads-log/X.khodkar_ferestade.json'],
  logged: events.filter((e) => e.kind === 'khodkar_ferestade' && e.sid === 'X').length }
assert.deepEqual(out.khodkarFerestade, { first: true, tick: ['✓ فرستاده شد', '✓ فرستاده شد'], second: true, rule: true,
  nkRow: ['ک-۱ خودکار: چکِ اپ ✓ فرستاده شد', 'ک-۲ «حرفِ دیگرِ حبیب»'], third: 2, file: '{"khodkar":["چکِ اپ","سرچِ حرفِ حبیب"],"nakarde":["چکِ اپ"],"rah":["چکِ اپ ⇐ Bash: xcrun simctl","سرچِ حرفِ حبیب ⇐ hafeze_search.py"],"tedad":{"چکِ اپ":2,"سرچِ حرفِ حبیب":1}}\n', logged: 2 })
// an excuse gets a new way, not a wait (Habib, 26 Oct 07:44): the fork is told what was sent and to answer excuses; the same
// work with a NEW way goes again, the same way does not; an excuse does not take a «نکرده» out
{
  const lastP = calls.fork[calls.fork.length - 1].prompt
  khX[0] = { kar: 'چکِ اپ', abzar: 'SendMessage به ۲۰۳ (کامپیوتر یوز)', chek: 'عکسِ ۲۰۳' }
  const s0 = calls.submit.length
  await dowr([])
  const sub4 = calls.submit.slice(s0).map((c) => c.text)
  out.bahane = { told: /قبلاً به چت فرستادی \(کار ⇐ راه\): «چکِ اپ ⇐ Bash: xcrun simctl»/.test(lastP) && /بهانه، راهکار می‌خواهد نه صبر/.test(lastP) && /۲۰۳/.test(lastP),
    nakardeRule: /بهانهٔ ایجنت .* آن را از نکرده بیرون نمی‌برد؛ فقط دو چیز بیرونش می‌برد: حبیب گفته باشد نه، یا انجام شدنش با خروجیِ یک ابزار دیده شود/.test(lastP),
    newWay: sub4.length === 1 && /۱\. چکِ اپ ⇐ با SendMessage به ۲۰۳/.test(sub4[0]) && !/سرچِ حرفِ حبیب/.test(sub4[0]),
    header: /منتظر نمان/.test(sub4[0] || '') }
  assert.deepEqual(out.bahane, { told: true, nakardeRule: true, newWay: true, header: true })
  // the same work a third time (here: «خودکار», «نکرده», then a new way) asks Habib's help; a fourth time it does not go
  // (Habib, 26 Oct 07:50: «دفعه سوم … به زبون ساده به حبیب توضیح بده و ازش بخواه کمکت کنه … و دفعه چهارم دیگه نفرستتش»)
  khX[0] = { kar: 'چکِ اپ', abzar: 'Chrome CDP روی 9229', chek: 'عکس' }
  const s1 = calls.submit.length
  await dowr([])
  out.barSevom = { third: sub4[0].includes(mod.matn_bar_sevom), fourth: calls.submit.length - s1 }
  assert.deepEqual(out.barSevom, { third: true, fourth: 0 })
}

// «هوک‌ها» in the box: no emoji, and a hook's message beside its injected text is left out (26 Oct 05:36)
out.hookBiEmoji = [mod.bi_emoji('📌 🧠 حافظه: 3 سابقه ✅'), mod.bi_payam_tekrari([{ kind: 'hook_system_message', name: 'U', t: 1000 }, { kind: 'hook_additional_context', name: 'U', t: 1500 }, { kind: 'hook_system_message', name: 'Stop', t: 1000 }]).map((h) => h.kind + ':' + h.name)]
assert.deepEqual(out.hookBiEmoji, ['حافظه: 3 سابقه', ['hook_additional_context:U', 'hook_system_message:Stop']])
// «پرسش» with saved prompts (Habib, 26 Oct 05:41 and 05:44): + adds, ✎ edits, × deletes, a press turns one on;
// the warm-cache question goes with the one that is on
{
  const keepR = $.ui.resolve; $.ui.resolve = () => withInput
  $.sid = 'PR'; await H['command.run']($, { args: 'on' })
  const r = () => H['ui.render']($, { component: 'AbovePrompt', surface: 'vscode' }, async () => null)
  await find(await r(), 'hads-pr-add').onPress()
  const fld = find(await r(), 'hads-pr-matn'); fld.onInput('جواب در جدول، با واژه‌های من'); await find(await r(), 'hads-pr-save').onPress()
  await find(await r(), 'hads-pr-add').onPress(); await find(await r(), 'hads-pr-matn').onSubmit('کوتاه بگو')
  await find(await r(), 'hads-pr-ed-1').onPress(); await find(await r(), 'hads-pr-matn').onSubmit('خیلی کوتاه بگو')
  await find(await r(), 'hads-pr-0').onPress()
  const t1 = await r()
  const fk0 = calls.fork.length; $.forkReply = { isAnswered: true, text: 'جواب.', usage: {} }; $.t += 1
  await H['command.run']($, { args: 'ask چی شد؟' }); await flush(); await new Promise((res) => setTimeout(res, 5))
  const askP = calls.fork.slice(fk0).map((f) => f.prompt).find((x) => /چی شد؟/.test(x)) || ''
  await find(await r(), 'hads-pr-x-0').onPress()
  const t2 = await r()
  out.promptHa = { labels: [0, 1].map((i) => find(t1, 'hads-pr-' + i)?.label), short: [...find(t1, 'hads-pr-0').label].length <= mod.had_harf_dokme_prompt + 2,
    asked: askP === '' ? 'cold' : /جواب در جدول، با واژه‌های من[\s\S]*چی شد؟/.test(askP),
    afterX: [0, 1].map((i) => find(t2, 'hads-pr-' + i)?.label || null), file: flags['/h/.claude/hads-prompt-ha.json'] }
  assert.deepEqual(out.promptHa, { labels: ['✓ جواب در جدول، با …', 'خیلی کوتاه بگو'], short: true, asked: true, afterX: ['خیلی کوتاه بگو', null], file: '["خیلی کوتاه بگو"]\n' })
  $.ui.resolve = keepR
}
$.sid = 'A'
// تعریفِ ۱۰ (اسمِ متغیر): every name the mod writes is a new one. The old names, written out here only
// to look for them (Habib, 25 Oct 02:58: «دیگه اثری ازش نباشه»; the mod no longer reads them)
const fsN = await import('node:fs')
const kind_ghadim = ['now', 'guess', 'guess_click', 'guess_sent', 'ask', 'ask_wait', 'turn_summary']
const khane_ghadim = ['items', 'guess', 'sent', 'edited', 'q', 'a', 'asked', 'done', 'not_done', 'from', 'tools', 'via', 'tokens']
const kalame_ghadim = ['-guess', '-now', '-ask', '-hooks', '+midfork', 'min', 'dot', 'hookbig']
out.noOldNames = { kinds: events.filter((e) => kind_ghadim.includes(e.kind)).length, fields: events.filter((e) => Object.keys(e).some((k) => khane_ghadim.includes(k))).length,
  usage: usages.filter((u) => 'part' in u || 'via' in u || ['now', 'guess', 'ask', 'summary', 'end'].includes(u.bakhsh)).length,
  words: Object.entries(flags).filter(([k, v]) => k.includes('/hads-on/') && String(v).split(' ').some((w) => kalame_ghadim.includes(w))).map(([k, v]) => k + '=' + v),
  ghablia: Object.keys(flags).filter((k) => k.endsWith('.now.jsonl')).length }
assert.deepEqual(out.noOldNames, { kinds: 0, fields: 0, usage: 0, words: [], ghablia: 0 })
// the source: exported names lower snake_case, never a name glued as '-' + k or 'x_' + y
const src = fsN.readFileSync(new URL('./hooks/register.js', import.meta.url), 'utf8')
out.esmRule = { upper: (src.match(/export const [A-Z][A-Z_0-9]*\b/g) || []), glued: (src.match(/'[-+]' \+ |'[a-z]+_' \+ /g) || []),
  // an English word keeps its English spelling (91, بندِ ۲: کلمهٔ انگلیسی با اسپلِ درست): cache, context, copy — not kash, kontekst, kopi (Habib, 25 Oct 05:24: «اسم copy»)
  bad_spell: [...new Set(src.match(/\b[a-z_]*(kash|kontekst|kopi|profail|menyu|sesheen)[a-z_]*\b/g) || [])] }
assert.deepEqual(out.esmRule, { upper: [], glued: [], bad_spell: [] })
// «تماس‌ها» (26 Oct 21:54): per part, last hour / 24 h / all; one fork serving four parts counts in each; dollars per call
{
  const now = 1e13
  const L = [
    { t: now - 10 * 60e3, bakhsh: 'hads_va_nakarde_va_khodkar_va_cron', rah: 'fork', usage: { input_tokens: 1000, output_tokens: 100, cache_read_input_tokens: 100000, cache_creation_input_tokens: 0 } },
    { t: now - 5 * 3600e3, bakhsh: 'do_jomle', rah: 'sonnet', usage: { input_tokens: 1000, output_tokens: 100 } },
    { t: now - 3 * 86400e3, bakhsh: 'jambandi_nobat_va_hads', rah: 'fork', usage: {} },
  ]
  L.reverse() // the file is oldest first
  const A = mod.hesab_amar(L, now)
  out.amar = { saat: [A.saat.kol, A.saat.hads, A.saat.cron, A.saat.do_jomle], ruz: [A.ruz.kol, A.ruz.do_jomle], hame: [A.hame.kol, A.hame.hads, A.hame.jambandi_nobat], hameUsd: A.hame.usd, usd: A.riz[0].usd, newest: A.riz[0].b.join(' ') }
  assert.deepEqual(out.amar, { saat: [1, 1, 1, 0], ruz: [2, 1], hame: [3, 2, 1], hameUsd: 0.029, usd: 0.026, newest: 'hads nakarde khodkar cron' })
  // the box hands it to the page as one hidden line, in every state
  const sid0 = $.sid; $.sid = 'AM'; flags['/h/.claude/hads-on/AM'] = 'on tak_dokme'
  flags['/h/.claude/hads-log/AM.usage.jsonl'] = L.map((x) => JSON.stringify(x)).join('\n') + '\n'
  const rA = await F['ui.render']($, { component: 'AbovePrompt' }, async () => 'engine')
  const tA = find(rA, 'hads-amar'), body = tA && String(tA.children[0])
  out.amarLine = !!body && body.startsWith(mod.neshane_amar) && JSON.parse(body.slice(mod.neshane_amar.length)).hame.kol === 3
  assert.equal(out.amarLine, true)
  $.sid = sid0
}
// «دفترِ کارها» (Habib 27 Oct 18:30 «یه کد عددی … یه تغییر کوچیک کلمه باعث نشه که … تیک نخوره»): one number per work for good
{
  const a = mod.shomare_dadan([{ harf: 'ریلود کن و با عکس ببین کدِ رنگی درست اومده', chera: 'x', sanad: { hast: '/tmp/a.png' } }], { akhar: 0, kar: [] })
  // the same work, other words, no check this time: same number, the old check comes back
  const b = mod.shomare_dadan([{ harf: 'عکسِ کدِ رنگی بعد از ریلود', chera: 'y', sh: 1 }, { harf: 'کارِ دیگر', chera: 'z' }], a.daftar)
  // the fork forgot the number: the words still find it when close enough
  const c = mod.shomare_dadan([{ harf: 'ریلود کن و با عکس ببین کدِ رنگی درست اومده', chera: 'x' }], b.daftar)
  out.shomare = { a: a.list[0].sh, b: b.list.map((x) => x.sh), bSanad: b.list[0].sanad?.hast, c: c.list[0].sh, akhar: c.daftar.akhar,
    anjam: mod.hanuz_nakarde(b.list, ['ک-1']).map((x) => x.sh), hast: mod.khandan_sanad({ hast: '/x/y.png' }), hastNesbi: mod.khandan_sanad({ hast: 'y.png' }),
    dasti: mod.khandan_nakarde([{ harf: 'h', chera: 'c', sanad: { dasti: true }, shomare: 4 }])[0] }
  assert.deepEqual(out.shomare, { a: 1, b: [1, 2], bSanad: '/tmp/a.png', c: 1, akhar: 2, anjam: [2], hast: { hast: '/x/y.png' }, hastNesbi: null,
    dasti: { harf: 'h', zaman: '', chera: 'c', sh: 4, dasti: true } })
}
// 25 Oct 02:20 («اسمِ تابع‌های داخلِ کد … بزن»): the functions and the chat-wide variables have Habib's words too
const codeOnly = src.replace(/\/\/.*$/gm, '').replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
out.esmTabe = ["answer", "askText", "buildPrompt", "busy", "cacheExpired", "clicked", "coldAfter", "coldCost", "endAgain", "endAt", "endBusy", "fillAppend", "flagPath", "flagWords", "fold", "forkPrompt", "guess", "guessFork", "guesses", "handoffs", "harfeHabib", "histOpen", "histPath", "hookLine", "hooks", "hooksAt", "interactive", "isAgent", "isOn", "jalali", "lastActivity", "lastLogged", "lastNow", "logEvent", "logUsage", "madeFor", "nowAgain", "nowBusy", "parseBoth", "parseGuesses", "parseHooks", "parseSummary", "pendingAsk", "readFlag", "readHist", "readHooks", "recent", "sameText", "setMode", "setNow", "small", "summarize", "tPath", "tellNow", "tick", "turnAsked", "turnEnd", "turnNows", "turnTools", "turnsOf", "twoSentences", "vazhe", "when", "whenFa", "bepors"].filter((x) => new RegExp('(?<![\\w$.])' + x + '(?![\\w$])').test(codeOnly))
assert.deepEqual(out.esmTabe, [])
// «زبان» (28 Oct 02:20): an English answer gets one reminder to speak Persian; never twice in a row
out.zabanTashkhis = [mod.englisi_ast('Text is right in the box (in a fresh test chat). Sending with Enter now.'), mod.englisi_ast('همه سبز است و `npm test` و https://example.com/some/long/english/path هم.'), mod.englisi_ast('ok')]
assert.deepEqual(out.zabanTashkhis, [true, false, false])
$.sid = 'Z'; flags['/h/.claude/hads-on/Z'] = 'on -hads -nakarde -khodkar -cron -do_jomle -porsesh -hook'
$.msgs = [{ role: 'user', text: 'چی شد' }, { role: 'assistant', text: 'The tests for the native app are still running in the simulator, I will report back.' }]
let n0 = calls.submit.length; await H['turn.complete']($, {}, next); await flush()
const zs = calls.submit.slice(n0).map((x) => x.text)
await H['turn.complete']($, {}, next); await flush()
const zs2 = calls.submit.length - n0
$.msgs = [{ role: 'assistant', text: 'همه سبز شد و کامیت هم زدم، چیزِ دیگری نمانده است.' }]; await H['turn.complete']($, {}, next); await flush()
$.msgs = [{ role: 'assistant', text: 'The tests for the native app are still running in the simulator, I will report back.' }]; await H['turn.complete']($, {}, next); await flush()
const zs3 = calls.submit.length - n0
flags['/h/.claude/hads-on/Z'] = 'on -hads -nakarde -khodkar -cron -do_jomle -porsesh -hook -zaban'; await H['turn.complete']($, {}, next); await flush()
out.zaban = { yek: zs.length === 1 && zs[0] === mod.matn_yadavari_zaban, dobare: zs2, bad_az_farsi: zs3, khamush: calls.submit.length - n0 }
assert.deepEqual(out.zaban, { yek: true, dobare: 1, bad_az_farsi: 2, khamush: 2 })
$.sid = 'A'
console.log(JSON.stringify(out))
