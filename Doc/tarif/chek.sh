#!/bin/bash
# Runs the "چک" line of every definition; prints which one is broken (باطل).
cd "$(dirname "$0")/../.." || exit 2
export PATH="$HOME/.nvm/versions/node/v22.23.2/bin:$PATH"
bad=0
# tests 02 and 03 are «شبیه‌سازیِ افزونه در کروم» (Habib's word, 25 Oct 04:59): a Google Chrome with no window
# and a throwaway profile builds the panel page and checks it; NO_CHROME=1 skips them.
# Habib 22 Oct: no Chrome for now; 25 Oct 04:30, question window: «بله، بی‌پنجره اشکال ندارد»
skip() { echo "⏭  $1 — رد شد: شبیه‌سازیِ افزونه در کروم زده نشد (NO_CHROME)"; }
ok()  { echo "✅ $1"; }
no()  { echo "❌ $1 — $2"; bad=$((bad+1)); }
tail -n +3 Doc/ghanoon_az_91/10_tarif_esm_motaghayer_v1.md | cmp -s - "$HOME/1-MY-WORK/91th-minimal-2/doc/tarif/10_tarif_esm_motaghayer_v1.md" && ok "۱۰ج کپیِ قانونِ ۹۱ تازه است" || no "۱۰ج کپیِ قانونِ ۹۱ تازه است" "اصل در ۹۱ عوض شده؛ دوباره کپی کن"
o=$(node mods/hads/test_hads.mjs 2>/dev/null)
[[ $o == *'"nakarde":{"fork":1,"rules":true'* && $o == *'"nakardeAnjam":{"now":2,"file":true,"told":true,"back":false,"logged":true}'* && $o == *'"nakardeOff":{"forked":true,"asked":false,"shown":false}'* ]] && ok "۱۴ نکرده‌ها" || no "۱۴ نکرده‌ها" "آزمون جوابِ درست نداد"
[[ $o == *'"yekFork":{"forks":1,"all":true,"tools":[],"rules":true,"sonnet":0'* && $o == *'"khodkarOff":{"asked":false,"shown":false,"file":"on -khodkar -cron"}'* ]] && ok "۱۵ خودکار، کرون‌جاب، یک fork" || no "۱۵ خودکار، کرون‌جاب، یک fork" "آزمون جوابِ درست نداد"
[[ $o == *'"reload":{"same":true,"full":true'* && $o == *'"tartib":{"ticks":["cron","do_jomle","hads"'* && $o == *'"rows":true,"top":"hads-top","last":true,"field":false}'* && $o == *'"notMobile":true}'* ]] && ok "۱۶ ترتیبِ بخش‌ها و برگشت بعد از ریلود (مود)" || no "۱۶ ترتیب و ریلود" "آزمون جوابِ درست نداد"
t16=$(node test_claude_hads_tartib.cjs 2>&1); [[ $t16 == *'"fieldHidden":"none"'* && $t16 == *'"dragSelf":[0,0]'* && $t16 == *'"dragAfter":"nakarde khodkar cron hads do_jomle porsesh hook"'* ]] && ok "۱۶ کشیدنِ تیک‌ها (شبیه‌سازیِ افزونه در کروم)" || no "۱۶ کشیدنِ تیک‌ها" "آزمون جوابِ درست نداد"
[[ $o == *'"defaultOff":0'* && $o == *'"otherChat":0'* && $o == *'"aAfterBOff":"on"'* && $o == *'"projectFiles":0'* && $o == *'"afterClear":"engine"'* && $o == *'"model":"claude-sonnet-5-5"'* && $o == *'"submit":0'* ]] && ok "۰۱ حدس" || no "۰۱ حدس" "آزمون جوابِ درست نداد"
[[ $o == *'"brake":1'* && $o == *'"endNotDropped":2'* && $o == *'"oneFork":[1,1,0]'* && $o == *'"between":[[0,1,0],[0,1,0]]'* && $o == *'"forkBroken":[1,1,1]'* && $o == *'"bigChat":[0,1,1]'* && $o == *'"endWins":"پایان شد. منتظرِ حبیب."'* && $o == *'"coldWarn":true'* && $o == *'"nowSelectable":true'* && $o == *'"ticksLast":true'* && $o == *'"pinned":[60000,400000,3]'* && $o == *'"max":2'* && $o == *'"eventKinds":true'* && $o == *'"eventShape":true'* && $o == *'"noTwin":1'* && $o == *'"guessSent":["hads_zadan","hads_ferestade"]'* && $o == *'"bothOff":[0,0,0]'* && $o == *'"noStale":false'* && $o == *'"allBack":"on"'* && $o == *'"histCap":50'* && $o == *'"histOrder":[true,true,true,true]'* && $o == *'"foldFile":"on -hads yek_khat"'* && $o == *'"tickKeeps":"on -porsesh +do_jomle_fork"'* && $o == *'"twoOnly":"اول. دوم!"'* && $o == *'"fileDot":"ایجنت فایل register.js را در v2.10 عوض کرد. بعد تست زد."'* && $o == *'"maxLen":"300…"'* && $o == *'"untouched":"ok"'* && $o == *'"toolSurvives":"ok"'* && $o == *'"ask":{"fork":1,"fill":0,"submit":0}'* && $o == *'"nothingToFork":true'* ]] && ok "۱۲ دو جمله و پرسش" || no "۱۲ دو جمله و پرسش" "آزمون جوابِ درست نداد"
[[ $o == *'"noOldNames":{"kinds":0,"fields":0,"usage":0,"words":[],"ghablia":0}'* && $o == *'"esmRule":{"upper":[],"glued":[],"bad_spell":[]}'* ]] && ok "۱۰ اسمِ متغیر" || no "۱۰ اسمِ متغیر" "اسمِ قدیمی، اسمِ بزرگ‌حرف یا اسمِ چسبانده در کد"
if [[ -n $NO_CHROME ]]; then skip "۰۲ نوارِ بالا"; else
o=$(node test_claude_top_buttons.cjs 2>/dev/null)
[[ $o == *'"topCount":14'* && $o == *'"hadsText":["/hads on","/hads off"]'* && $o == *'"dragTyped":""'* && $o == *'"submitted":0'* && $o == *'"notInBanner":true'* ]] && ok "۰۲ نوارِ بالا (شبیه‌سازیِ افزونه در کروم)" || no "۰۲ نوارِ بالا" "آزمون جوابِ درست نداد"
fi
if [[ -n $NO_CHROME ]]; then skip "۰۳ ساعتِ پیام"; else
o=$(node test_claude_stamp.cjs 2>/dev/null)
n=$(cat ~/.vscode/extensions/anthropic.claude-code-*/webview/index.js 2>/dev/null | grep -c "data-message-stamp")
[[ $o == *'"answerClearsDot":true'* && $o == *'"promptInBubble":true'* && $n -gt 0 ]] && ok "۰۳ ساعتِ پیام (شبیه‌سازیِ افزونه در کروم)" || no "۰۳ ساعتِ پیام" "آزمون یا اسمِ data-message-stamp"
fi
z=0; for f in ~/.*/extensions/anthropic.claude-code-*; do [ "$(grep -c crtl-panel "$f/extension.js" 2>/dev/null)" -gt 0 ] || z=$((z+1)); done
l=$(launchctl list | grep -c com.habib.fix-rtl-claude)
[[ $z -eq 0 && $l -ge 1 ]] && ok "۰۴ پچِ RTL" || no "۰۴ پچِ RTL" "بی‌پچ: $z · launchd: $l"
python3 Doc/tarif/naghl_chek.py >/dev/null && ok "همهٔ Doc/tarif: نقل‌های حبیب عین منبع" || no "نقل‌ها" "python3 Doc/tarif/naghl_chek.py را ببین"
a=$(git log origin/main..main --oneline 2>/dev/null | wc -l | tr -d ' '); p=$(grep -c push Doc/moallagh.md)
[[ $a -eq 0 || $p -ge 1 ]] && ok "۰۹ commit بی‌push (مانده: $a)" || no "۰۹ commit بی‌push" "commit ِ مانده بی‌ثبت در moallagh"
echo "دستی، هر گزارش: ۰۵ کار به دوشِ حبیب · ۰۶ واژه‌ها · ۰۷ سؤال با منشی · ۰۸ سرچِ عمیق"
echo "باطل: $bad"; exit $bad
