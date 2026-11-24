#!/bin/bash
# آلارمِ مدل‌های Stealthِ OpenRouter (حبیب، ۱۶ نوامبر ۲۰۲۶)
# هر بار صفحهٔ openrouter.ai/stealth را می‌خواند؛ اگر مدلِ تازه‌ای ظاهر شد، اعلانِ مک می‌دهد و در لاگ می‌نویسد.
# مدل‌های stealth در /v1/models نیستند، پس ناچاریم صفحه را بخوانیم.
set -euo pipefail

DIR="$HOME/.claude/stealth_watch"
mkdir -p "$DIR"
BASE="$DIR/baseline.txt"
LOG="$DIR/alarm.log"
PAGE="$DIR/page.$$.html"

if ! curl -sL --max-time 30 "https://openrouter.ai/stealth" -o "$PAGE"; then
  echo "$(date '+%F %T') fetch failed" >> "$LOG"
  rm -f "$PAGE"
  exit 1
fi

grep -oE 'stealth/[a-z0-9-]+' "$PAGE" | sort -u > "$DIR/current.txt" || true
rm -f "$PAGE"

if [ ! -s "$DIR/current.txt" ]; then
  echo "$(date '+%F %T') no models parsed (page changed?)" >> "$LOG"
  exit 1
fi

# بارِ اول: فقط baseline بساز
if [ ! -f "$BASE" ]; then
  cp "$DIR/current.txt" "$BASE"
  echo "$(date '+%F %T') baseline created: $(tr '\n' ' ' < "$BASE")" >> "$LOG"
  exit 0
fi

# مدل‌هایی که در current هستند ولی در baseline نبودند = تازه
NEW=$(comm -13 "$BASE" "$DIR/current.txt" || true)
if [ -n "$NEW" ]; then
  while IFS= read -r m; do
    [ -n "$m" ] || continue
    echo "$(date '+%F %T') NEW STEALTH MODEL: $m" >> "$LOG"
    # اعلان از راهِ notif.sh ِ ۲۰۳ (terminal-notifier) چون اعلانِ osascript روی این مک خاموش است.
    NOTIF="$HOME/1-MY-WORK/203th-day-imac-cpu-tracker/doc/abzar/notif.sh"
    if [ -x "$NOTIF" ]; then
      "$NOTIF" "OpenRouter Stealth" "مدل Stealth تازه آمد: $m" "Glass" "stealth-watch" || true
    else
      /usr/bin/osascript -e 'on run argv' -e 'display notification (item 2 of argv) with title (item 1 of argv)' -e 'end run' "OpenRouter Stealth" "مدل Stealth تازه آمد: $m" >/dev/null 2>&1 || true
    fi
    # هشدار به گوشیِ حبیب در بله (حبیب، ۱۶ نوامبر ۲۰۲۶: «بله، وصل کن»)
    BALE="$HOME/1-MY-WORK/136th-day-fix-rtl-claude/abzar/bale-136.sh"
    if [ -x "$BALE" ]; then
      "$BALE" "مدل Stealth تازه آمد: $m" || true
    fi
  done <<< "$NEW"
  # فهرستِ مشترک هم تازه شود: مدلِ stealth در /v1/models نیست، پس تنها راهِ رسیدنش
  # به منوی مدل همین تازه‌سازی است. خطا فقط در لاگ می‌نشیند تا آلارم از دست نرود.
  REFRESH="$HOME/1-MY-WORK/136th-day-fix-rtl-claude/abzar/darvaze/scripts/refresh_openrouter_catalog.py"
  if [ -f "$REFRESH" ]; then
    python3 "$REFRESH" >> "$LOG" 2>&1 || echo "$(date '+%F %T') catalogue refresh failed" >> "$LOG"
  fi
  # baseline = اجتماعِ همهٔ مدل‌های دیده‌شده (پس حذفِ موقت دوباره آلارم نمی‌دهد)
  { cat "$BASE"; cat "$DIR/current.txt"; } | sort -u > "$BASE.tmp" && mv "$BASE.tmp" "$BASE"
fi
