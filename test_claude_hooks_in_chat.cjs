// Hooks in the chat (Habib, 24 Oct): the VS Code panel never asked the CLI for hook events,
// so what a hook injected never showed. fix-rtl-claude.sh turns --include-hook-events on and
// passes every forwarded message through claude-host-hook.js's __crtlHookLine, which makes a
// hook's output an "informational" line the page already draws in the chat.
// No browser: runs the script's own python block on a copy of the installed extension.js.
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), vm = require('node:vm')
const { execFileSync } = require('node:child_process')
const assert = require('node:assert/strict')
const dir = __dirname
const out = {}

// 1. the host hook: a hook's output becomes one meta line with the Shamsi time; nothing else changes
const hookSrc = fs.readFileSync(process.env.HOST_HOOK_JS || path.join(dir, 'claude-host-hook.js'), 'utf8')
const g = { require, globalThis: null, process, console }
g.globalThis = g
vm.runInNewContext(hookSrc, g)
const T = Date.parse('2026-10-24T16:39:00Z')
const line = g.__crtlHookLine({ type: 'system', subtype: 'hook_response', hook_name: 'UserPromptSubmit', output: '[20:09 +0330 -- habib] ok\n', uuid: 'u1' }, T)
out.hookLine = { type: line.type, subtype: line.subtype, level: line.level, content: line.content }
assert.deepEqual(out.hookLine, { type: 'system', subtype: 'informational', level: 'notice', content: '🪝 ۲ آبان ۱۴۰۵ ۲۰:۰۹ · UserPromptSubmit · [20:09 +0330 -- habib] ok\n[20:09 +0330 -- habib] ok' })
// the page drops level "info" (SY1): the line must never be "info"
assert.notEqual(line.level, 'info')
const other = { type: 'assistant', message: {} }
out.othersUntouched = g.__crtlHookLine(other) === other && g.__crtlHookLine({ type: 'system', subtype: 'hook_response', output: '  ' }).subtype === 'hook_response'
assert.equal(out.othersUntouched, true)
// readable for a person (Habib, 24 Oct 22:03: «اصلا قابل خوندن نیست»): a clock stamp, {} or
// nothing make no line; a JSON hook output is unpacked, real line breaks, short paths, and when
// it has a systemMessage (the panel prints that itself) only the injected context is shown
const hk = (out) => g.__crtlHookLine({ type: 'system', subtype: 'hook_response', hook_name: 'UserPromptSubmit', output: out }, T)
out.noise = ['[22:00 +0330 -- habib]', '{}', '  ', '{"continue":true}'].map((x) => hk(x).subtype)
assert.deepEqual(out.noise, ['hook_response', 'hook_response', 'hook_response', 'hook_response'])
const mem = JSON.stringify({ systemMessage: '🧠 حافظه: 2 سابقه تزریق شد', hookSpecificOutput: { hookEventName: 'UserPromptSubmit',
  additionalContext: '[حافظهٔ آزمایشیِ حبیب]\n1) حرفِ تو 10-22 16:37 — /Users/habib/Downloads/205th-day-mother-of-all-agent/doc/achar/11.md:40\n2) …' } })
const mc = hk(mem).content
out.memory = { lines: mc.split('\n').length, rawJson: /hookSpecificOutput|\\n|"systemMessage"/.test(mc), shortPath: /11\.md:40/.test(mc) && !/\/Users\/habib/.test(mc), head: mc.split('\n')[0], twice: mc.includes('🧠 حافظه: 2 سابقه') }
assert.deepEqual(out.memory, { lines: 4, rawJson: false, shortPath: true, head: '🪝 ۲ آبان ۱۴۰۵ ۲۰:۰۹ · UserPromptSubmit · متنِ تزریقی', twice: false })
out.jalali = [g.__crtlJalali(2026, 3, 21).join('/'), g.__crtlJalali(2025, 3, 20).join('/')]
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
  forwardWrapped: /this\.send\(\{type:"io_message",channelId:[^,]+,message:\(globalThis\.__crtlHookLine\?globalThis\.__crtlHookLine\(\w+\):\w+\),done:!1,hostForwardedAt:Date\.now\(\)\}\)/.test(patched),
  parses: (() => { try { execFileSync(process.execPath, ['--check', extJs]); return true } catch { return false } })(),
}
assert.deepEqual(out.patch, { flagAlwaysOn: true, forwardWrapped: true, parses: true })
// a bundle that names the args and the message with $ (esbuild does): still matched
const pyDollar = py.replace("src = open(path + '.backup', encoding='utf-8').read()", "src = open(path + '.backup', encoding='utf-8').read().replace('if(this.options.includeHookEvents)a.push(', 'if(this.options.includeHookEvents)$a.push(').replace(',message:K1,done:!1,hostForwardedAt', ',message:K$,done:!1,hostForwardedAt')")
fs.writeFileSync(path.join(tmp, 'p2.py'), pyDollar)
execFileSync('python3', [path.join(tmp, 'p2.py')], { env: { ...process.env, CRTL_CSS_FILE: path.join(tmp, 'x.css'), CRTL_EXT_JS: extJs,
  CRTL_BUTTONS_JS: path.join(dir, 'claude-ui-buttons.js'), CRTL_HOST_HOOK_JS: process.env.HOST_HOOK_JS || path.join(dir, 'claude-host-hook.js') } })
const p2 = fs.readFileSync(extJs, 'utf8')
out.dollarNames = p2.includes('$a.push("--include-hook-events")') && !p2.includes('if(this.options.includeHookEvents)$a') && p2.includes('globalThis.__crtlHookLine(K$)')
assert.equal(out.dollarNames, true)
// 3. the page folds them: the buttons script tags 🪝 meta lines and knows focus view
const btn = fs.readFileSync(process.env.BUTTONS_JS || path.join(dir, 'claude-ui-buttons.js'), 'utf8')
// the size must beat the chat's own «msg p{font-size:…!important}»: same !important, higher specificity,
// and on the line's children too (24 Oct 22:11: the slider changed nothing)
out.sizeWins = /\[class\*="messagesContainer_"\] \[class\*="metaMessage_"\]\.crtl-hook \*\{font-size:var\(--crtl-hook-size,13px\)!important/.test(btn)
assert.equal(out.sizeWins, true)
// the «حدس» box above the prompt: its text selectable (the app root is user-select:none)
out.panelSelectable = /\[class\*="abovePrompt_"\] \[class\*="band_"\][^']*user-select:text!important/.test(btn)
assert.equal(out.panelSelectable, true)
// the «حدس» card, macOS look: only the box whose header says «hads plugin» is tagged and styled
out.hadsCard = /hads plugin/.test(btn) && /card\.classList\.add\('crtl-hads'\)/.test(btn) && /\.crtl-hads\{[^']*border-radius:12px/.test(btn) && /crtl-tick-on\{background:#0a84ff/.test(btn)
assert.equal(out.hadsCard, true)
// its see-through level is a setting in the aA panel (24 Oct 22:45: «ترانسپرنسی»)
out.hadsAlpha = /var\(--crtl-hads-alpha,80%\),transparent/.test(btn) && /sizeRow\('پُری کادرِ حدس ٪', 'hadsAlpha'/.test(btn) && /--crtl-hads-alpha:' \+ \(s\.hadsAlpha/.test(btn)
assert.equal(out.hadsAlpha, true)
out.pageFolds = /--crtl-hook-size/.test(btn) && /sizeRow\('هوک‌ها', 'hook'/.test(btn) && /crtl-hook-open/.test(btn) && /focusFoldRow_/.test(btn) && /\[class\*="metaMessage_"\]\.crtl-hook:not\(\.crtl-hook-open\)[^']*nowrap/.test(btn)
assert.equal(out.pageFolds, true)
fs.rmSync(tmp, { recursive: true, force: true })
console.log(JSON.stringify(out))
