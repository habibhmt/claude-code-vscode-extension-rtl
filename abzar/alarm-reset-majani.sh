#!/bin/zsh
# Alarm for the free full weekly reset (Habib, 11 Nov 2026 22:03: «چرا آلارم ندادی؟ که من استفاده بکنم از این ریست»;
# window 22:04: «بزن»). Deadline: Dec 10 2:00PM PT = Friday 20 Azar 1405 01:30 Tehran, i.e. Thursday night.
# Standard: definition 25 of 203 (report, urgent window, silence is news, sound, register).
# Run by com.habib.136.alarm-reset-majani every 30 min and at login: a stage whose time has passed and that
# has not fired yet fires once (the latest one only, so a Mac that was off does not fire four at once).
# Habib said «زدم» (window button, or the file <dir>/zadam) ⇐ no more alarms. After the deadline it removes itself.
#   test: RESET_ALAN=<epoch> RESET_DIR=<dir> RESET_DRY=1 zsh alarm-reset-majani.sh
LABEL=com.habib.136.alarm-reset-majani
A203=~/1-MY-WORK/203th-day-imac-cpu-tracker/doc/abzar
DIR=${RESET_DIR:-~/1-MY-WORK/136th-day-fix-rtl-claude/abzar/alarm-reset-majani.d}
CHAT='مجری -۱۳۶- ایمک -نیو'
mkdir -p $DIR
ep() { TZ=Asia/Tehran date -j -f '%Y-%m-%d %H:%M' "$1" +%s }
alan=${RESET_ALAN:-$(date +%s)}
mohlat=$(ep '2026-12-11 01:30')
say() { print -r -- "[$(TZ=Asia/Tehran date '+%F %T')] $1" >> $DIR/log }
print -r -- $alan > $DIR/akharin_ejra
bardar() { [[ -n $RESET_DRY ]] && { print "BARDAR"; return }; rm -f ~/Library/LaunchAgents/$LABEL.plist; launchctl bootout gui/$UID/$LABEL 2>/dev/null }
if [[ -f $DIR/zadam ]]; then say "حبیب ریست را زده؛ آلارم برداشته شد"; bardar; exit 0; fi
if (( alan >= mohlat )); then
  say "❌ مهلت گذشت و «زدم» ثبت نشد"
  [[ -n $RESET_DRY ]] && print "GOZASHT" || NOTIF_DRY= zsh $A203/notif.sh "ریستِ مجانیِ Claude" "مهلت گذشت (۲۰ آذر ۰۱:۳۰) و «زدم» ثبت نشد" KhabarNoskhe reset-majani
  bardar; exit 0
fi
# stage: time, kind (banner | panjere), text
marhale=(
  "1|$(ep '2026-12-03 10:00')|banner|یک هفته مانده: ریستِ کاملِ مجانی تا پنجشنبه‌شب ۱۹ آذر (جمعه ۰۱:۳۰ بامداد). صفحهٔ Usage ⇐ Reset"
  "2|$(ep '2026-12-10 10:00')|banner|امشب آخرین شب است: ریستِ کاملِ مجانی تا ۰۱:۳۰ بامدادِ امشب. صفحهٔ Usage ⇐ Reset"
  "3|$(ep '2026-12-10 20:00')|panjere|ریستِ کاملِ مجانی ۵ ساعت و نیمِ دیگر می‌سوزد (۰۱:۳۰ بامداد)."
  "4|$(ep '2026-12-10 23:00')|panjere|ریستِ کاملِ مجانی ۲ ساعت و نیمِ دیگر می‌سوزد (۰۱:۳۰ بامداد). آخرین یادآور."
)
entekhab=
for m in $marhale; do
  p=("${(@s:|:)m}")
  (( alan >= p[2] )) && [[ ! -f $DIR/shod_$p[1] ]] && entekhab=$m
done
[[ -z $entekhab ]] && exit 0
p=("${(@s:|:)entekhab}")
# earlier stages that were missed count as done: only the latest one speaks
for m in $marhale; do q=("${(@s:|:)m}"); (( q[1] <= p[1] )) && : > $DIR/shod_$q[1]; done
say "مرحلهٔ $p[1] ($p[3]): $p[4]"
if [[ -n $RESET_DRY ]]; then print -r -- "MARHALE $p[1] $p[3] $p[4]"; exit 0; fi
zsh $A203/notif.sh "ریستِ مجانیِ Claude" "$p[4]" KhabarNoskhe reset-majani "open https://claude.ai/settings/usage"
if [[ $p[3] == panjere ]]; then
  (zsh $A203/alarm_be_saheb.sh "$CHAT" "ریستِ مجانی: $p[4] حبیب هنوز «زدم» نگفته." >/dev/null 2>&1 &)
  sabr=$(( p[1] == 3 ? 9000 : mohlat - alan - 300 ))
  j=$($A203/panjere_dokme "ریستِ مجانیِ Claude" $sabr "زدم=zadam|بعداً یادم بنداز=bad" "$p[4]" "Claude ⇐ Settings ⇐ Usage ⇐ دکمهٔ Reset" "ltr:https://claude.ai/settings/usage" 2>/dev/null)
  say "جوابِ پنجره: $j"
  [[ $j == zadam ]] && { : > $DIR/zadam; say "حبیب: زدم"; bardar }
fi
exit 0
