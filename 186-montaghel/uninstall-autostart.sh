#!/bin/bash
launchctl bootout gui/$(id -u)/com.habib.ClaudeUsage 2>/dev/null || true
rm -f "$HOME/Library/LaunchAgents/com.habib.ClaudeUsage.plist"
echo "autostart removed"
