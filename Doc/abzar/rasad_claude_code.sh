#!/bin/zsh
# What changed in Anthropic's public Claude Code repo since the last look (Habib, 3 Nov 2026: «تغییرات دونه دونه ما توش چک بکنیم»).
# Reads only: fetches, updates the local copy, lists new commits and the changed files that touch our work. `--dide` marks them seen.
set -e
R="$(cd "$(dirname "$0")/../.." && pwd)/claude-code-github"; M="$R/.git/rasad_akharin"
git -C "$R" fetch -q --tags origin main
[ -f "$M" ] || git -C "$R" rev-parse HEAD > "$M"
A=$(<"$M"); B=$(git -C "$R" rev-parse origin/main)
git -C "$R" merge -q --ff-only origin/main
print "از $A[1,7] تا $B[1,7] · کامیتِ تازه: $(git -C "$R" rev-list --count $A..$B)"
git -C "$R" log --format='%h %cs %s' $A..$B
print -- "--- فایل‌های عوض‌شده: $(git -C "$R" diff --name-only $A $B | wc -l | tr -d ' ')"
print -- "--- راهنمای پلاگین و تغییرات:"
git -C "$R" diff --stat $A $B -- mods/types CHANGELOG.md plugins | tail -6
[ "$1" = "--dide" ] && print $B > "$M" && print "دیده شد: $B[1,7]"
exit 0
