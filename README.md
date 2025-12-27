# Claude Code Extension RTL Fix

A simple script to add RTL (Right-to-Left) text support to the Claude Code extension in VS Code-based IDEs.

## Supported IDEs

- VSCode
- VSCode Insiders
- Cursor
- Windsurf
- Windsurf Next

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

### Options

```bash
# Basic RTL support (no custom font)
./fix-rtl-claude.sh

# With Vazirmatn font (recommended for Persian/Arabic)
./fix-rtl-claude.sh --with-font

# Show help
./fix-rtl-claude.sh --help
```

## After Claude Code Updates

The extension updates may overwrite the CSS changes. Simply run the script again after each update:

```bash
./fix-rtl-claude.sh
```

## How It Works

The script patches the `index.css` file in the Claude Code extension webview folder with RTL-specific CSS rules:

- Sets `direction: rtl` for text elements
- Preserves LTR for code blocks and diffs
- Optionally adds Vazirmatn font for better Persian/Arabic rendering

A backup of the original CSS file is created automatically (`index.css.backup`).

## Troubleshooting

**No Claude Code extensions found**
- Make sure Claude Code extension is installed in your IDE
- The extension path should be: `~/.<ide-name>/extensions/anthropic.claude-code-*/webview/`

**Changes not visible**
- Restart your IDE after running the script
- Try closing and reopening the Claude Code panel

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
