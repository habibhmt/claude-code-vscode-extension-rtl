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

# Reload the IDE window when done (default on an interactive run)
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
| `sav` | copy the current settings as JSON for `~/.claude-rtl-sizes.json` |
| `rst` | back to defaults |

Drag a column by its `⋮⋮` grip to move it anywhere on screen.

Settings live in the webview's `localStorage`. To make them the defaults for
every IDE and every extension update, press `sav` and paste the JSON into
`~/.claude-rtl-sizes.json` — the script seeds the panel from that file.

## How It Works

The script patches the Claude Code extension webview with RTL-specific CSS:

- Sets `direction: rtl` for text elements
- Preserves LTR for code blocks and diffs
- Optionally adds Vazirmatn font for better Persian/Arabic rendering

The CSS and the settings-panel script are injected **twice**: into
`webview/index.css` / `webview/index.js`, and into the inline `<style>` /
`<script nonce=...>` that `extension.js` builds for the webview HTML. The
second copy matters — the webview resource URLs carry no cache-buster, so a
plain window reload keeps serving the stale `index.css`, while the HTML is
rebuilt on every panel creation and is therefore never cached.

Backups are created automatically the first time (`index.css.backup`,
`index.js.backup`, `extension.js.backup`) and every run re-patches from those
backups, so repeated runs never stack up. `--revert` restores them.

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

To kill zombie processes:
```bash
ps aux | grep "claude-code.*native-binary/claude" | grep -v grep | awk '{print $2}' | xargs kill -9
```

## License

MIT License - See [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Feel free to open issues or submit pull requests.
