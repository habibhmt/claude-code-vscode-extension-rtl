// Hooks in the chat (Habib, 24 Oct): the VS Code panel never asked the CLI for hook events,
// so what a hook injected never showed. fix-rtl-claude.sh turns --include-hook-events on and
// passes every forwarded message through claude-host-hook.js's __crtl_khat_hook, which makes a
// hook's output an "informational" line the page already draws in the chat.
// No browser: runs the script's own python block on a copy of the installed extension.js.
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), vm = require('node:vm')
const { execFileSync } = require('node:child_process')
const assert = require('node:assert/strict')
const dir = __dirname
const out = {}

// 1. the host hook: a hook's output becomes one meta line with the Shamsi time; nothing else changes
const hookSrc = fs.readFileSync(process.env.HOST_HOOK_JS || path.join(dir, 'claude-host-hook.js'), 'utf8')
const g = { require, globalThis: null, process, console, Buffer }
g.globalThis = g
vm.runInNewContext(hookSrc, g)
const T = Date.parse('2026-10-24T16:39:00Z')
const line = g.__crtl_khat_hook({ type: 'system', subtype: 'hook_response', hook_name: 'UserPromptSubmit', output: '[20:09 +0330 -- habib] ok\n', uuid: 'u1' }, T)
out.hookLine = { type: line.type, subtype: line.subtype, level: line.level, content: line.content }
assert.deepEqual(out.hookLine, { type: 'system', subtype: 'informational', level: 'notice', content: '\u2063۲ آبان ۱۴۰۵ ۲۰:۰۹ · UserPromptSubmit · [20:09 +0330 -- habib] ok' })
// a one-line hook is not said twice when opened (26 Oct 05:47)
// the page drops level "info" (SY1): the line must never be "info"
assert.notEqual(line.level, 'info')
const other = { type: 'assistant', message: {} }
out.othersUntouched = g.__crtl_khat_hook(other) === other && g.__crtl_khat_hook({ type: 'system', subtype: 'hook_response', output: '  ' }).subtype === 'hook_response'
assert.equal(out.othersUntouched, true)
// readable for a person (Habib, 24 Oct 22:03: «اصلا قابل خوندن نیست»): a clock stamp, {} or
// nothing make no line; a JSON hook output is unpacked, real line breaks, short paths, and when
// it has a systemMessage (the panel prints that itself) only the injected context is shown
const hk = (out) => g.__crtl_khat_hook({ type: 'system', subtype: 'hook_response', hook_name: 'UserPromptSubmit', output: out }, T)
out.noise = ['[22:00 +0330 -- habib]', '{}', '  ', '{"continue":true}'].map((x) => hk(x).subtype)
assert.deepEqual(out.noise, ['hook_response', 'hook_response', 'hook_response', 'hook_response'])
const mem = JSON.stringify({ systemMessage: '🧠 حافظه: 2 سابقه تزریق شد', hookSpecificOutput: { hookEventName: 'UserPromptSubmit',
  additionalContext: '[حافظهٔ آزمایشیِ حبیب]\n1) حرفِ تو 10-22 16:37 — /Users/habib/Downloads/205th-day-mother-of-all-agent/doc/achar/11.md:40\n2) …' } })
const mc = hk(mem).content
out.memory = { lines: mc.split('\n').length, rawJson: /hookSpecificOutput|\\n|"systemMessage"/.test(mc), shortPath: /11\.md:40/.test(mc) && !/\/Users\/habib/.test(mc), head: mc.split('\n')[0], twice: mc.includes('🧠 حافظه: 2 سابقه') }
assert.deepEqual(out.memory, { lines: 4, rawJson: false, shortPath: true, head: '\u2063۲ آبان ۱۴۰۵ ۲۰:۰۹ · UserPromptSubmit · متنِ تزریقی', twice: false })
out.jalali = [g.__crtl_tarikh_shamsi(2026, 3, 21).join('/'), g.__crtl_tarikh_shamsi(2025, 3, 20).join('/')]
// after a reload: the hook lines come back from the transcript, each after the message before it
// (Habib, 25 Oct: «من چند بار چند بار ریلود میکنم چند چت رو بعد اینو بکشه»)
const confDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crtl-conf-'))
const SID = '3cf957a7-caa8-4cb3-8194-247ba06b0055'
fs.mkdirSync(path.join(confDir, 'projects', '-Users-x'), { recursive: true })
const at = (ts, a, extra = {}) => JSON.stringify({ type: 'attachment', uuid: 'h-' + ts, timestamp: ts, attachment: a, ...extra })
fs.writeFileSync(path.join(confDir, 'projects', '-Users-x', SID + '.jsonl'), [
  JSON.stringify({ type: 'user', uuid: 'u1', timestamp: '2026-10-24T05:00:00.000Z', message: { content: 'old' } }),
  at('2026-10-24T05:00:01.000Z', { type: 'hook_success', hookName: 'UserPromptSubmit', content: 'before the first message shown' }),
  at('2026-10-24T05:38:01.000Z', { type: 'hook_success', hookName: 'UserPromptSubmit', content: '[09:08 +0330 -- habib]' }),
  at('2026-10-24T05:38:02.000Z', { type: 'hook_system_message', hookName: 'UserPromptSubmit', content: '🧠 حافظه: 3 سابقه تزریق شد' }),
  at('2026-10-24T05:38:02.500Z', { type: 'hook_additional_context', hookName: 'UserPromptSubmit', content: ['[حافظه]\n1) /Users/habib/Downloads/x/doc/achar/11.md:40'] }),
  at('2026-10-24T05:38:03.000Z', { type: 'hook_success', hookName: 'PreToolUse', content: '' }),
  at('2026-10-24T05:38:04.000Z', { type: 'hook_additional_context', hookName: 'PostToolUse:Bash', content: ['یادآوری'] }, { isSidechain: true }),
  at('2026-10-24T05:38:05.000Z', { type: 'hook_cancelled', hookName: 'UserPromptSubmit', content: 'x' }),
].join('\n') + '\n')
const prevConf = process.env.CLAUDE_CONFIG_DIR; process.env.CLAUDE_CONFIG_DIR = confDir
const msgs = [{ type: 'user', uuid: 'p1', timestamp: '2026-10-24T05:38:00.000Z' }, { type: 'assistant', uuid: 'p2', timestamp: '2026-10-24T05:39:00.000Z' }]
const back = g.__crtl_hook_tarikhche(msgs, SID)
out.reloadHooks = JSON.parse(JSON.stringify(back.map((m) => m.type === 'system' ? m.content.split('\n')[0] : m.uuid)))
// only the injected text, not the hook's message beside it, and no emoji at all (26 Oct 05:36)
assert.deepEqual(out.reloadHooks, ['p1', '\u2063۲ آبان ۱۴۰۵ ۰۹:۰۸ · UserPromptSubmit · متنِ تزریقی', 'p2'])
out.reloadShape = back.filter((m) => m.type === 'system').every((m) => m.subtype === 'informational' && m.level === 'notice' && m.session_id === SID && m.uuid) && !/\/Users\/habib/.test(JSON.stringify(back))
assert.equal(out.reloadShape, true)
// a session id that is not a uuid, or no transcript: the chat stays as it was
out.reloadSafe = g.__crtl_hook_tarikhche(msgs, '../x') === msgs && g.__crtl_hook_tarikhche(msgs, '00000000-0000-0000-0000-000000000000') === msgs
assert.equal(out.reloadSafe, true)
// a hook line cut by the 8 MB reading piece is still found whole
fs.writeFileSync(path.join(confDir, 'projects', '-Users-x', SID + '.jsonl'), 'x'.repeat(8 * 1024 * 1024 - 40) + '\n' +
  at('2026-10-24T05:38:02.000Z', { type: 'hook_system_message', hookName: 'Stop', content: 'سرِ مرز' }) + '\n')
out.reloadEdge = JSON.parse(JSON.stringify(g.__crtl_hook_tarikhche(msgs, SID).filter((m) => m.type === 'system').map((m) => m.content.split('\n')[0])))
assert.deepEqual(out.reloadEdge, ['\u2063۲ آبان ۱۴۰۵ ۰۹:۰۸ · Stop · سرِ مرز'])
if (prevConf === undefined) delete process.env.CLAUDE_CONFIG_DIR; else process.env.CLAUDE_CONFIG_DIR = prevConf
fs.rmSync(confDir, { recursive: true, force: true })
assert.deepEqual(out.jalali, ['1405/1/1', '1403/12/30'])

// 2. the script's own python block on a copy of the installed extension.js
// no VS Code here (CI, Cursor or Windsurf only): skip the patch part, never crash
const extRoot = path.join(os.homedir(), '.vscode/extensions')
const exts = fs.existsSync(extRoot) ? fs.readdirSync(extRoot).filter((d) => d.startsWith('anthropic.claude-code-')).sort() : []
const ext = exts.length && path.join(os.homedir(), '.vscode/extensions', exts.at(-1))
if (!ext || !fs.existsSync(path.join(ext, 'extension.js.backup'))) {
  console.log(JSON.stringify({ ...out, patch: 'skipped: no installed extension.js.backup' }))
  process.exit(0)
}
const sh = fs.readFileSync(path.join(dir, 'fix-rtl-claude.sh'), 'utf8')
const py = sh.split("python3 - <<'PYEOF' || py_ok=false\n")[1].split('\nPYEOF')[0]
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'crtl-hooks-'))
const extJs = path.join(tmp, 'extension.js')
fs.copyFileSync(path.join(ext, 'extension.js.backup'), extJs + '.backup')
fs.writeFileSync(path.join(tmp, 'x.css'), '')
fs.writeFileSync(path.join(tmp, 'p.py'), py)
execFileSync('python3', [path.join(tmp, 'p.py')], { env: { ...process.env, CRTL_CSS_FILE: path.join(tmp, 'x.css'), CRTL_EXT_JS: extJs,
  CRTL_BUTTONS_JS: path.join(dir, 'claude-ui-buttons.js'), CRTL_HOST_HOOK_JS: process.env.HOST_HOOK_JS || path.join(dir, 'claude-host-hook.js') } })
const patched = fs.readFileSync(extJs, 'utf8')
out.patch = {
  flagAlwaysOn: /\w+\.push\("--include-hook-events"\)/.test(patched) && !/if\(this\.options\.includeHookEvents\)\w+\.push\("--include-hook-events"\)/.test(patched),
  forwardWrapped: /this\.send\(\{type:"io_message",channelId:[^,]+,message:\(globalThis\.__crtl_khat_hook\?globalThis\.__crtl_khat_hook\(\w+\):\w+\),done:!1,hostForwardedAt:Date\.now\(\)\}\)/.test(patched),
  parses: (() => { try { execFileSync(process.execPath, ['--check', extJs]); return true } catch { return false } })(),
  reloadWrapped: /readTrailingHookNotices\([\w$]+,[\w$]+\)[\s\S]{0,600}?return\{type:"get_session_response",messages:this\.stampReplayedFrames\(\(globalThis\.__crtl_hook_tarikhche\?globalThis\.__crtl_hook_tarikhche\(\[\.\.\.[\w$]+,\.\.\.[\w$]+\],[\w$]+\):\[\.\.\.[\w$]+,\.\.\.[\w$]+\]\)\)/.test(patched),
}
assert.deepEqual(out.patch, { flagAlwaysOn: true, forwardWrapped: true, parses: true, reloadWrapped: true })
// a bundle that names the args and the message with $ (esbuild does): still matched
// rename the bundle's own minified names (they change every build: a/K1 in 2.1.310, i/z1 in 2.1.311) to $-names
const src0 = fs.readFileSync(extJs + '.backup', 'utf8')
const argsName = src0.match(/if\(this\.options\.includeHookEvents\)([\w$]+)\.push\(/)[1]
const msgName = src0.match(/,message:([\w$]+),done:!1,hostForwardedAt/)[1]
const pyDollar = py.replace("src = open(path + '.backup', encoding='utf-8').read()", `src = open(path + '.backup', encoding='utf-8').read().replace('if(this.options.includeHookEvents)${argsName}.push(', 'if(this.options.includeHookEvents)$a.push(').replace(',message:${msgName},done:!1,hostForwardedAt', ',message:K$,done:!1,hostForwardedAt')`)
fs.writeFileSync(path.join(tmp, 'p2.py'), pyDollar)
execFileSync('python3', [path.join(tmp, 'p2.py')], { env: { ...process.env, CRTL_CSS_FILE: path.join(tmp, 'x.css'), CRTL_EXT_JS: extJs,
  CRTL_BUTTONS_JS: path.join(dir, 'claude-ui-buttons.js'), CRTL_HOST_HOOK_JS: process.env.HOST_HOOK_JS || path.join(dir, 'claude-host-hook.js') } })
const p2 = fs.readFileSync(extJs, 'utf8')
out.dollarNames = p2.includes('$a.push("--include-hook-events")') && !p2.includes('if(this.options.includeHookEvents)$a') && p2.includes('globalThis.__crtl_khat_hook(K$)')
assert.equal(out.dollarNames, true)
// 3. the page folds them: the buttons script tags 🪝 meta lines and knows focus view
const btn = fs.readFileSync(process.env.BUTTONS_JS || path.join(dir, 'claude-ui-buttons.js'), 'utf8')
// the size must beat the chat's own «msg p{font-size:…!important}»: same !important, higher specificity,
// and on the line's children too (24 Oct 22:11: the slider changed nothing)
out.sizeWins = /\[class\*="messagesContainer_"\] \[class\*="metaMessage_"\]\.crtl-hook \*\{font-size:var\(--crtl-hook-font-px,13px\)!important/.test(btn)
assert.equal(out.sizeWins, true)
// the «حدس» box above the prompt: its text selectable (the app root is user-select:none)
out.panelSelectable = /\[class\*="abovePrompt_"\] \[class\*="band_"\][^']*user-select:text!important/.test(btn)
assert.equal(out.panelSelectable, true)
// the «حدس» card, macOS look: only the box whose header says «hads plugin» is tagged and styled
out.hadsCard = /hads plugin/.test(btn) && /card\.classList\.add\('crtl-hads'\)/.test(btn) && /\.crtl-hads\{[^']*border-radius:12px/.test(btn) && /crtl-tik-roshan\{background:#0a84ff/.test(btn)
assert.equal(out.hadsCard, true)
// its see-through level is a setting in the aA panel (24 Oct 22:45: «ترانسپرنسی»)
out.hadsAlpha = /var\(--crtl-hads-pori-darsad,80%\),transparent/.test(btn) && /radif_andaze\('پُری کادرِ حدس ٪', 'hads_pori_darsad'/.test(btn) && /--crtl-hads-pori-darsad:' \+ \(s\.hads_pori_darsad/.test(btn)
assert.equal(out.hadsAlpha, true)
// down to 0: fully see-through, no blur; 0 is kept, not turned back into the default (24 Oct 23:03)
out.hadsGlass = /hads_pori_darsad: \[0, 100\]/.test(btn) && /--crtl-hads-tari-px:/.test(btn) && /blur\(var\(--crtl-hads-tari-px/.test(btn) && /isNaN\(n\) \? DEF\[field\] : n/.test(btn) && !/\(s\.hads_pori_darsad \|\| 80\)/.test(btn)
assert.equal(out.hadsGlass, true)
// compact: ▾ ◂ × ride on the header line; the one-button state shrinks the card to that button
out.hadsCompact = /\.crtl-hads \.crtl-hads-radif-bala\{position:sticky!important;top:0/.test(btn) && /crtl-hads-tak-dokme\{width:max-content/.test(btn) && /toggle\('crtl-hads-tak-dokme'/.test(btn)
assert.equal(out.hadsCompact, true)
// the top row is found by its × key, hads-x (▾ and the folded line went 26 Oct 19:18). The band keeps its
// own scroll (overflow:auto, max 12 lines): «overflow:visible» let the box spill over the chat and the
// chat stopped scrolling (25 Oct 00:04: «دیگه اسکرول نمیشه»); so the top row sticks to the band's top
out.topRowSafe = /if \(bs\[b\]\.getAttribute\('data-press-key'\) === 'hads-x' && bs\[b\]\.parentElement/.test(btn) && !/if \(tx === '×' && bs\[b\]\.parentElement/.test(btn) && !/tx === '◂'\) && bs\[b\]\.parentElement/.test(btn) && !/crtl-hads \[class\*="band_"\][^']*overflow:visible/.test(btn) && !/crtl-hads \[class\*="band_"\][^']*contain:none/.test(btn) && /\.crtl-hads-radif-bala\{position:sticky!important;top:0/.test(btn) && !/crtl-hads-radif-bala\{[^']*height:0/.test(btn) && /crtl-hads:has\(\.crtl-hads-radif-bala\) \[data-engine-mark\]\{position:absolute!important;top:7px;left:76px;right:auto/.test(btn)
assert.equal(out.topRowSafe, true)
out.pageFolds = /--crtl-hook-font-px/.test(btn) && /radif_andaze\('هوک‌ها', 'hook_font_px'/.test(btn) && /crtl-hook-baz/.test(btn) && /\[class\*="metaMessage_"\]\.crtl-hook:not\(\.crtl-hook-baz\)[^']*nowrap/.test(btn)
assert.equal(out.pageFolds, true)
// folded whatever the focus view: no rule may open them by focus (24 Oct 22:55)
out.foldAlways = /crtl-hook:not\(\.crtl-hook-baz\)\{max-height:1\.9em!important/.test(btn) && !/\.crtl-focus-on [^']*crtl-hook/.test(btn)
assert.equal(out.foldAlways, true)
// تعریفِ ۱۰ (اسمِ متغیر), 25 Oct: the new names only; a value saved under an old setting name is read as the new one
const btnNoTable = btn.replace(/var esm_ghadim_tanzim = \{[^}]*\};/, '')
out.esmUi = { table: /var esm_ghadim_tanzim = \{ hook: 'hook_font_px', hadsAlpha: 'hads_pori_darsad' \};/.test(btn),
  old: (btnNoTable.match(/hadsAlpha|\bhook: \d|'hook'|crtl-hook-size|crtl-hads-alpha|crtl-hads-blur|crtl-hads-dot|crtl-hads-top|crtl-hook-open|crtl-tick-on|crtl-tick-off|crtl-insert/g) || []),
  host: !/__crtlHook|__crtlJalali/.test(hookSrc) && typeof g.__crtl_khat_hook === 'function',
  // the hooks part's own functions with Habib's words too (25 Oct 02:20)
  hostTabe: ['readable', 'whenFa', 'jalali', 'shortPaths', 'khatHook', 'khatHayeHook', 'transcriptPath', 'GOROOH_HOOK', 'NESHANE_HOOK']
    .filter((x) => new RegExp('(?<![\\w$.])' + x + '(?![\\w$])').test(hookSrc.slice(hookSrc.indexOf('// Hooks in the chat.')).replace(/\/\/.*$/gm, ''))) }
assert.deepEqual(out.esmUi, { table: true, old: [], host: true, hostTabe: [] })
// the 62 file-level functions of the buttons file with Habib's words too (25 Oct 05:54: «بزن همه ۶۲ تا رو عوض کن»)
out.btnTabe = ['sidFromState', 'askSession', 'paintSession', 'guard', 'fresh', 'load', 'seedTop', 'sharedProfileNames', 'save', 'commands', 'applyCss', 'input', 'caretToEnd', 'insertLines', 'type', 'typeLine', 'send', 'setValue', 'clickMenu', 'btn', 'row', 'sizeRow', 'wireHoverIntent', 'wireExpand', 'wireBlocks', 'findBar', 'closePanel', 'wireGlossary', 'wirePanelDismiss', 'closeFind', 'wireFindEscape', 'clearMarks', 'withExtra', 'copyConversation', 'quoteInto', 'ctxMenu', 'wireQuoteMenu', 'counterTick', 'syncCounter', 'applyPos', 'makeDraggable', 'diagnose', 'clampReport', 'mirrorParity', 'copyText', 'exportable', 'panelNote', 'copySettings', 'loadFromFile', 'applyImported', 'sideOf', 'topHost', 'runCommand', 'wireTopDrag', 'renderTop', 'watchTop', 'renderBars', 'renderPanel', 'renderToggle', 'syncPanelRoom', 'rerender', 'build']
  .filter((x) => new RegExp('(?<![\\w$.\'-])' + x + '\\s*\\(').test(btn.replace(/\/\/.*$/gm, '').replace(/'(?:\\.|[^'\\])*'/g, "''")))
assert.deepEqual(out.btnTabe, [])
// a user message keeps the app's own up-down scroll: the hook lines under it are not clamped, and
// «overflow:hidden» cut them with no way to scroll (25 Oct 00:09: «کادر پیامهای من هم اسکرول نمیشه»)
out.userMsgScrolls = /userMessage_"\]:not\(\.crtl-expanded\)\{overflow-x:hidden!important\}/.test(btn) && !/userMessage_"\]:not\(\.crtl-expanded\)\{overflow:hidden/.test(btn)
assert.equal(out.userMsgScrolls, true)
fs.rmSync(tmp, { recursive: true, force: true })
// a hook's own emoji goes too: 🧠 and the like, anywhere in the line
out.biEmoji = g.__crtl_bi_emoji('🧠 حافظه: 3 سابقه ✅ تزریق شد 🇮🇷 · ۲۰۵')
assert.equal(out.biEmoji, 'حافظه: 3 سابقه تزریق شد · ۲۰۵')
// the panel's own «X says: …» line is hidden; a hook line is not
{
  const {JSDOM} = (() => { try { return require('jsdom') } catch (e) { return {} } })()
  out.saysRule = /crtl-hook-says\{display:none!important\}/.test(btn) && /says: \//.test(btn)
  assert.equal(out.saysRule, true)
}
console.log(JSON.stringify(out))
