#!/bin/bash
# Every 10 min (launchd com.habib.fix-rtl-autopull): take what the other machine pushed and patch with it.
# Habib, 7 Nov: «چرا خودکار نیست اینگار پول شدن مک بوک». Never touches uncommitted work or a split history.
cd "$(dirname "$0")" || exit 1
[ -d /opt/homebrew/bin ] && PATH="/opt/homebrew/bin:$PATH" && export PATH
LOG="$PWD/autopull.log"
say() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$LOG"; }
git fetch -q origin main 2>/dev/null || { say "fetch failed (offline?)"; exit 0; }
old=$(git rev-parse HEAD); new=$(git rev-parse origin/main)
[ "$old" = "$new" ] && exit 0
git merge-base --is-ancestor HEAD origin/main || { say "split from origin (local commits) — skipped"; exit 0; }
[ -z "$(git status --porcelain --untracked-files=no)" ] || { say "uncommitted changes — skipped"; exit 0; }
git merge -q --ff-only origin/main || { say "fast-forward failed"; exit 0; }
say "pulled ${old:0:7} -> ${new:0:7}"
bash ./fix-rtl-claude.sh --with-font >> "$LOG" 2>&1 && say "claude patched" || say "claude patch FAILED"
python3 ./fix-rtl-chatgpt.py --with-font >> "$LOG" 2>&1 && say "chatgpt patched" || say "chatgpt patch FAILED"
