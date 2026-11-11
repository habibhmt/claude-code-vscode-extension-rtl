#!/bin/zsh
# Claude Code as an MCP server for Claude Desktop (Habib, 11 Nov 2026 04:02: «برای کلود دسکتاپ چطوری
# میتونم وصلش کنم … به یه ایجنت توی کلود کد»; window: «۳. claude mcp serve»). The extension's binary
# moves with every version, so this finds the newest one each time instead of a fixed path in the config.
C=$(ls -d ~/.vscode/extensions/anthropic.claude-code-*-darwin-arm64/resources/native-binary/claude 2>/dev/null | sort -V | tail -1)
[ -x "$C" ] || C=$(command -v claude)
[ -x "$C" ] || { echo "claude-mcp-serve: claude پیدا نشد" >&2; exit 1; }
cd "$HOME/1-MY-WORK"
exec env -u CLAUDECODE -u CLAUDE_CODE_SESSION_ID -u CLAUDE_CODE_CHILD_SESSION "$C" mcp serve
