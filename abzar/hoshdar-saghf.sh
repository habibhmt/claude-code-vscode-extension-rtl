#!/bin/zsh
# Every 15 min (com.habib.136.hoshdar-saghf): reads Claude's Usage page (reset_ha.mjs, dry: nothing else touched)
# and, once the weekly limit reaches HAD% (default 95), tells Habib on the Mac, in this chat and in Bale, so he
# can press the free full reset himself at ~100% (Habib, 12 Nov 2026 04:3x, window: «ریست دمِ ۱۰۰٪»).
# The reset button is NEVER clicked by this or any script. After telling once, it removes its own LaunchAgent.
#   HAD=95 · HOSHDAR_AZMUN=<percent> ⇐ skip the browser and pretend the page said that (tests)
INJA=${0:A:h}; REPO=${INJA:h}; HAD=${HAD:-95}; LOG=$INJA/hoshdar-saghf.log
A203=/Users/habib/1-MY-WORK/203th-day-imac-cpu-tracker/doc/abzar
NODE=/Users/habib/.nvm/versions/node/v22.23.2/bin/node
PLIST=~/Library/LaunchAgents/com.habib.136.hoshdar-saghf.plist
say() { print -r -- "[$(date '+%F %T')] $1" >> $LOG }

if [[ -n $HOSHDAR_AZMUN ]]; then d=$HOSHDAR_AZMUN; else
  j=$(RESET_KHOSHK=1 RESET_LOG=$LOG $NODE $REPO/reset_ha.mjs 2>>$LOG)
  d=$(print -r -- $j | /usr/bin/python3 -I -c 'import json,sys,re
try: print(re.search(r"(\d+)% used", json.load(sys.stdin)["khande"]["claude"]["vaz"]).group(1))
except Exception: print("")')
fi
[[ -z $d ]] && { say "❌ درصدِ Claude خوانده نشد"; exit 1 }
say "Claude: ${d}% (حد ${HAD}%)"
(( d < HAD )) && exit 0

matn="سقفِ هفتگیِ Claude به ${d}٪ رسید. دمِ ۱۰۰٪ خودت دکمهٔ «Reset for free» را در claude.ai/settings/usage بزن (مهلت: پنجشنبه‌شب ۱۹ آذر)."
[[ -n $HOSHDAR_AZMUN ]] && { print -r -- "AZMUN $matn"; exit 0 }
/bin/zsh $A203/notif.sh "سقفِ Claude ${d}٪" "$matn" KhabarNoskhe hoshdar-saghf 'open https://claude.ai/settings/usage'
$A203/panjere_dokme "سقفِ Claude ${d}٪" 43200 'دیدم=didam' "$matn" &!
/bin/zsh $A203/alarm_be_saheb.sh 'مجری -۱۳۶- ایمک -نیو' "$matn" &!
/bin/zsh $INJA/bale-136.sh "⏰ $matn"
say "✅ خبر داده شد؛ LaunchAgent برداشته می‌شود"
[[ -f $PLIST ]] && { cp $PLIST /tmp/hoshdar-saghf.plist; rm -f $PLIST; launchctl bootout gui/$(id -u) /tmp/hoshdar-saghf.plist 2>/dev/null }
