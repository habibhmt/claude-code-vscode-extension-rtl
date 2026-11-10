#!/bin/bash
# Login item that survives reboots and power cuts.
set -euo pipefail
P="$HOME/Library/LaunchAgents/com.habib.ClaudeUsage.plist"
cat > "$P" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.habib.ClaudeUsage</string>
  <key>ProgramArguments</key>
  <array><string>/Applications/ClaudeUsage.app/Contents/MacOS/ClaudeUsage</string></array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><dict><key>SuccessfulExit</key><false/></dict>
  <key>ProcessType</key><string>Interactive</string>
</dict></plist>
PLIST
launchctl bootout gui/$(id -u)/com.habib.ClaudeUsage 2>/dev/null || true
launchctl bootstrap gui/$(id -u) "$P"
echo "autostart installed"
