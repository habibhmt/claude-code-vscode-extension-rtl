# Claude Code Extension RTL Fix

A simple script to add RTL (Right-to-Left) text support to the Claude Code extension in VS Code-based IDEs.

## Supported IDEs

- VSCode
- VSCode Insiders
- Cursor
- Windsurf
- Windsurf Next
- Devin

## Supported RTL Languages

- Persian (Farsi)
- Arabic
- Urdu
- Pashto
- Kurdish
- Dari
- Sindhi
- And other RTL scripts

## Installation

### macOS / Linux

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/claude-code-extension-rtl.git
cd claude-code-extension-rtl

# Make the script executable
chmod +x fix-rtl-claude.sh

# Run the script
./fix-rtl-claude.sh
```

#### Options

```bash
# Basic RTL support (no custom font)
./fix-rtl-claude.sh

# With Vazirmatn font (recommended for Persian/Arabic)
./fix-rtl-claude.sh --with-font

# Undo everything: restore every patched file from its .backup
./fix-rtl-claude.sh --revert

# Reload the frontmost IDE window when done (default on an interactive run)
./fix-rtl-claude.sh --reload
./fix-rtl-claude.sh --no-reload

# Show help
./fix-rtl-claude.sh --help
```

Default sizes can be overridden per run:

```bash
CHAT_FONT_SIZE=17px USER_MSG_LINES=2 ./fix-rtl-claude.sh
```

| Variable | Meaning | Default |
|---|---|---|
| `CHAT_FONT_SIZE` | conversation text | `15px` |
| `CHAT_LINE_HEIGHT` | conversation line height | `1.8` |
| `CODE_FONT_SIZE` | code blocks and tables | `12px` |
| `USER_MSG_LINES` | lines of your own messages (`0` = full) | `1` |
| `SIDE_BTN_FONT` | quick-command buttons | `9px` |
| `CHROME_FONT_SIZE` | header, footer, labels | `10px` |

### Windows

```powershell
# Clone the repository
git clone https://github.com/YOUR_USERNAME/claude-code-extension-rtl.git
cd claude-code-extension-rtl

# Run the script
.\fix-rtl-claude.ps1
```

#### Options

```powershell
# Basic RTL support (no custom font)
.\fix-rtl-claude.ps1

# With Vazirmatn font (recommended for Persian/Arabic)
.\fix-rtl-claude.ps1 -WithFont

# Show help
.\fix-rtl-claude.ps1 -Help
```

> **Note:** If you get an execution policy error, run PowerShell as Administrator and execute:
> ```powershell
> Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
> ```

## After Claude Code Updates

The extension updates may overwrite the CSS changes. Simply run the script again after each update:

**macOS/Linux:**
```bash
./fix-rtl-claude.sh
```

**Windows:**
```powershell
.\fix-rtl-claude.ps1
```

## Chat does not jump to the bottom when you send

`fix-rtl-claude.sh` turns off `claudeCode.scrollToBottomOnSend` (extension 2.1.276+) in the
`settings.json` of VSCode, Cursor, Windsurf and Devin, through `ensure-scroll-setting.py`.
Reading higher up, pressing Enter or a streaming reply no longer drags the page down; scroll
to the bottom yourself and it follows new text again. The key is only added when missing — set
it to `true` and the script leaves it alone. On a second machine: `git status` (must be clean),
then `git pull && ./auto-update-claude-code.sh`, then reload the IDE.

## The in-panel settings (`aA`)

The patch injects a small settings panel into the chat panel itself, so sizes
can be tuned live without touching any file. Click **`aA`** at the bottom edge.

| Control | What it does |
|---|---|
| فشرده / معمولی / درشت | one-click presets |
| متن گفتگو | conversation font size (slider + number box) |
| کد و جدول | code block and table font size |
| حواشی | header, footer, labels |
| دکمه‌ها | the quick-command buttons themselves |
| پیام خودت | collapse your own messages to 1, 2, 3 lines or show them in full — hover or click to expand |
| جای دکمه‌ها | both edges / all left / all right |
| جمع | shrink and dim `Thinking` and tool-call blocks until hovered |
| جدول | horizontal scroll for wide tables and code instead of stretching the page |
| دکمه‌ها: مخفی | hide the button columns — shortcut `Ctrl+Alt+B` |
| لیست دکمه‌ها (JSON) | add, remove or rename the quick-command buttons in place |
| شفافیت / رنگ | button opacity and an accent colour (empty = follow the theme) |
| پروفایل | save the current settings under a name and switch between them |
| جست‌وجو | find text in the conversation and step through hits — `Ctrl+Alt+F` |
| کپی گفتگو | copy the whole conversation as Markdown |
| متن ویژه | a text box plus «اول متن / آخر متن»; the first right-click item «کپی با الصاق متن ویژه» copies the selection with that text glued before or after it, one blank line between. The «☑ دکمهٔ کپی» toggle makes the copy button under each reply add it too (code-block copies and Cmd+C never do) |
| کپی همه | copy this chat's identity in one go; the first line is a ready `SendMessage to: "<title> [ref]"` that an agent on another device can use over Remote Control. The ref is sha256("bridge-session:<bridgeSessionId>")[:6] and survives a resume; with Remote Control off it says so instead of a code |
| `sel` | push the editor's current selection into the chat |
| شمارنده | character count of the composer, plus the app's own usage line when it renders one |
| `sav` | copy the current settings as JSON for `~/.claude-rtl-sizes.json` |
| `rst` | back to defaults |

A folded `Thinking` or tool-call block opens on hover, and a click pins it open.

## Quoting a message

Select any text in the conversation and right-click it:

| Menu entry | What it does |
|---|---|
| ↩︎ نقل‌قول در چت | drops the selection into the composer as a `>` quote |
| ✎ بدون علامت نقل‌قول | same, without the quote marker |
| ⧉ کپی | plain copy |
| 🔍 جست‌وجوی همین متن | opens the find bar preloaded with the selection |
| ؟ بپرس دربارهٔ… | quotes it and starts a question about that passage |

`Ctrl+Alt+Q` quotes the selection without opening the menu. The menu only
appears over conversation text — the composer keeps VSCode's own context menu,
and so does a right-click with nothing selected. Toggle it from the panel.

Drag a column by its `⋮⋮` grip to move it anywhere on screen.

Settings live in the webview's `localStorage`. To make them the defaults for
every IDE and every extension update, press `sav` and paste the JSON into
`~/.claude-rtl-sizes.json` — the script seeds the panel from that file. See
[`sizes.example.json`](sizes.example.json) for the shape. Keep that file in
your dotfiles and symlink it to carry the same setup across machines:

```bash
ln -sf ~/dotfiles/claude-rtl-sizes.json ~/.claude-rtl-sizes.json
```

## How It Works

The script patches the Claude Code extension webview with RTL-specific CSS:

- Sets `direction: rtl` for text elements
- Preserves LTR for code blocks and diffs
- Optionally adds Vazirmatn font for better Persian/Arabic rendering

The CSS goes into `webview/index.css` **and** into the inline `<style>` that
`extension.js` builds for the webview HTML. The second copy matters — the
webview resource URLs carry no cache-buster, so a plain window reload keeps
serving the stale `index.css`, while the HTML is rebuilt on every panel
creation and is therefore never cached.

The settings-panel script rides along in that same HTML, as an inline
`<script nonce=...>`, and **only there**: appending it to `webview/index.js`
as well would run the whole thing twice in one webview. `index.js` is only
used as a fallback when `python3` is missing or its rewrite fails, in which
case the run warns and carries on instead of dying half-patched.

### The composer is two layers — do not style it

Since 2.1.267 the message box is stacked: `.messageInput_*` holds the real text
but paints it transparent (`color:#0000`, only the caret shows), and
`.mentionMirror_*` is an absolutely positioned overlay that paints what you
actually see, mention chips included.

So the text you **see** and the text you **select** live in different elements.
Any property set on one must be set identically on the other — font, size,
line-height, letter-spacing, padding, direction, bidi — or the two drift and
selections land in the wrong place. An earlier version of this patch shrank
`inputMentionChip_*` to 9px because the class contains "Chip", which broke
exactly that.

The rule this patch follows: **do not style the composer subtree at all.**
Every selector here excludes `[class*="messageInputContainer_"] *`, and the
Vazirmatn override hands that subtree back to `var(--vscode-chat-font-family)`.
2.1.267 also gave the composer `unicode-bidi:plaintext` — each line takes its
direction from its own first strong character — which is the correct RTL
behaviour and must not be overridden.

Press `aA` → `تست` in the panel to print a computed-style comparison of the two
layers; every row should read `ok`.

### The launchd agent uses `--with-font`

`com.habib.fix-rtl-claude.plist` runs the script with `--with-font`, so the CSS
that actually lands on the machine is always the Vazirmatn variant. A plain
`./fix-rtl-claude.sh` run produces *different* CSS and will be overwritten the
next time the agent fires. **Test with `./fix-rtl-claude.sh --with-font`** so
you are looking at what the agent will produce.

Backups are created automatically the first time (`index.css.backup`,
`index.js.backup`, `extension.js.backup`) and every run re-patches from those
backups, so repeated runs never stack up. `--revert` restores them.

Each patched folder gets a `.crtl-stamp` holding a hash of the injected
payload — CSS, the buttons script, and `~/.claude-rtl-sizes.json`, so editing
the seed file is enough to trigger a re-patch. A run whose output would be byte-identical exits silently and writes
nothing to the log — the launchd agent fires on every touch of the extensions
folder, and re-patching each time was the only thing growing `autofix.log`.
`--force` patches anyway.

After patching, the script runs `node --check` on both injected files and
confirms the panel marker is present. A file that fails is rolled back from its
backup rather than left broken.

## Troubleshooting

**No Claude Code extensions found**
- Make sure Claude Code extension is installed in your IDE
- Extension paths:
  - **macOS/Linux:** `~/.<ide-name>/extensions/anthropic.claude-code-*/webview/`
  - **Windows:** `%USERPROFILE%\.<ide-name>\extensions\anthropic.claude-code-*\webview\`

**Changes not visible**
- Press `Cmd+R` (Reload Window). The inline injection survives the webview
  cache, so a reload is enough — a full restart is not needed.
- If it still looks stale, clear the webview cache:
  `rm -rf ~/Library/Application\ Support/Code/Cache/* ~/Library/Application\ Support/Code/Code\ Cache/*`

**The patch disappeared after an extension update**
- An update installs a new extension folder, which starts unpatched. Run the
  script again; it patches every installed version and prints a `[WARN]` line
  for any version it finds unpatched.

**PowerShell execution policy error (Windows)**
- Run: `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`
- Or run the script with: `powershell -ExecutionPolicy Bypass -File .\fix-rtl-claude.ps1`

## Known Issues

### High CPU Usage

This is a known bug in Claude Code itself (not related to this RTL fix):
- [Issue #11615](https://github.com/anthropics/claude-code/issues/11615)
- [Issue #11473](https://github.com/anthropics/claude-code/issues/11473)

To kill runaway processes:

```bash
# interactive: lists anything above 80% CPU, then asks
./kill-claude-zombies.sh

# unattended, higher bar
./kill-claude-zombies.sh --yes --threshold 90

# everything, no threshold
./kill-claude-zombies.sh --all
```

`--threshold` insists on a number: a missing or non-numeric value used to make
awk compare against an empty string and match every process — a silent
`--all`. It now exits with an error instead.

To reap them automatically every 10 minutes:

```bash
cp com.habib.kill-claude-zombies.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.habib.kill-claude-zombies.plist
```

The patcher can do it in the same pass with `./fix-rtl-claude.sh --kill-zombies`.

## License

MIT License - See [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Feel free to open issues or submit pull requests.
