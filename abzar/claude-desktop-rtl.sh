#!/bin/zsh
# RTL in the original Claude Desktop, with no change to Claude.app (Habib, 11 Nov 2026 19:10: «بله، دائمی کن»).
# Desktop loads "React DevTools" from ~/Library/Application Support/Claude/extensions/<its id> when it runs
# with REACT_PROFILE=1 and the Developer menu is on (allowDevTools); our RTL extension sits there under that id.
# Run by com.habib.claude-desktop-rtl at login.
EXT=~/1-MY-WORK/136th-day-fix-rtl-claude/rtl-extension
JA=~/Library/Application\ Support/Claude/extensions/fmkadmapgofadopljbjfkapdkoienihi
LOG=~/1-MY-WORK/136th-day-fix-rtl-claude/abzar/claude-desktop-rtl.log
say() { print -r -- "[$(date '+%F %T')] $1" >> $LOG }
notif() { osascript -e "display notification \"$1\" with title \"Claude Desktop RTL\"" 2>/dev/null }

[ -f "$EXT/manifest.json" ] || { say "❌ اکستنشن نیست: $EXT"; notif "اکستنشنِ RTL پیدا نشد"; exit 1 }
mkdir -p "${JA:h}"
if [ ! -L "$JA" ] || [ "$(readlink "$JA")" != "$EXT" ]; then rm -rf "$JA"; ln -s "$EXT" "$JA"; say "لینک ساخته شد ⇐ $EXT"; fi
grep -q '"allowDevTools": *true' ~/Library/Application\ Support/Claude/developer_settings.json 2>/dev/null \
  || { say "❌ منوی Developer خاموش است (allowDevTools)"; notif "منوی Developer ِ Claude خاموش است؛ RTL بار نمی‌شود"; }
launchctl setenv REACT_PROFILE 1
P=$(pgrep -f "/Applications/Claude.app/Contents/MacOS/Claude$" | head -1)
if [ -n "$P" ] && ! ps eww -p $P | grep -q REACT_PROFILE=1; then say "⚠️ Desktop بی REACT_PROFILE باز است"; notif "Claude Desktop را یک بار ببند و باز کن تا راست‌به‌چپ شود"; fi
say "✅ آماده"
