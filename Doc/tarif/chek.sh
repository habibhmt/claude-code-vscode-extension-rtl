#!/bin/bash
# Runs the "چک" line of every definition; prints which one is broken (باطل).
cd "$(dirname "$0")/../.." || exit 2
export PATH="$HOME/.nvm/versions/node/v22.23.2/bin:$PATH"
bad=0
# tests 02 and 03 start a headless Google Chrome; NO_CHROME=1 skips them (Habib 22 Oct 05:25: no Chrome for now)
skip() { echo "⏭  $1 — رد شد: کروم فعلاً ممنوع"; }
ok()  { echo "✅ $1"; }
no()  { echo "❌ $1 — $2"; bad=$((bad+1)); }
python3 mods/hads/test_esm_ghadim_be_taze.py >/dev/null 2>&1 && ok "۱۰ب اسمِ قدیم در دفترها به تازه" || no "۱۰ب اسمِ قدیم در دفترها به تازه" "mods/hads/test_esm_ghadim_be_taze.py قرمز"
o=$(node mods/hads/test_hads.mjs 2>/dev/null)
[[ $o == *'"nakarde":{"fork":1,"rules":true'* && $o == *'"nakardeGhabli":true'* && $o == *'"nakardeOff":{"forked":true,"asked":false,"shown":false}'* ]] && ok "۱۴ نکرده‌ها" || no "۱۴ نکرده‌ها" "آزمون جوابِ درست نداد"
[[ $o == *'"defaultOff":0'* && $o == *'"otherChat":0'* && $o == *'"aAfterBOff":"on"'* && $o == *'"projectFiles":0'* && $o == *'"afterClear":"engine"'* && $o == *'"model":"claude-sonnet-5-5"'* && $o == *'"submit":0'* ]] && ok "۰۱ حدس" || no "۰۱ حدس" "آزمون جوابِ درست نداد"
[[ $o == *'"brake":1'* && $o == *'"endNotDropped":2'* && $o == *'"oneFork":[1,1,0]'* && $o == *'"between":[[0,1,0],[0,1,0]]'* && $o == *'"forkBroken":[1,1,1]'* && $o == *'"bigChat":[0,1,1]'* && $o == *'"endWins":"پایان شد. منتظرِ حبیب."'* && $o == *'"coldWarn":true'* && $o == *'"nowSelectable":true'* && $o == *'"ticksLast":true'* && $o == *'"pinned":[60000,400000,3]'* && $o == *'"max":2'* && $o == *'"eventKinds":true'* && $o == *'"eventShape":true'* && $o == *'"noTwin":1'* && $o == *'"guessSent":["hads_zadan","hads_ferestade"]'* && $o == *'"bothOff":[0,0,0]'* && $o == *'"noStale":false'* && $o == *'"allBack":"on"'* && $o == *'"histCap":50'* && $o == *'"histOrder":[true,true,true,true]'* && $o == *'"foldFile":"on -hads yek_khat"'* && $o == *'"tickKeeps":"on -porsesh +do_jomle_fork"'* && $o == *'"twoOnly":"اول. دوم!"'* && $o == *'"fileDot":"ایجنت فایل register.js را در v2.10 عوض کرد. بعد تست زد."'* && $o == *'"maxLen":"300…"'* && $o == *'"untouched":"ok"'* && $o == *'"toolSurvives":"ok"'* && $o == *'"ask":{"fork":1,"fill":0,"submit":0}'* && $o == *'"nothingToFork":true'* ]] && ok "۱۲ دو جمله و پرسش" || no "۱۲ دو جمله و پرسش" "آزمون جوابِ درست نداد"
[[ $o == *'"esmGhadimJson":true'* && $o == *'"noOldNames":{"kinds":0,"fields":0,"usage":0,"words":[]}'* && $o == *'"esmRule":{"upper":[],"glued":[]}'* && $o == *'"oldWords":{"line":"▸ حدس","ticks":false,"file":"on -hads -hook"}'* && $o == *'"oldHist":["قدیمی","تازه. همین."]'* ]] && ok "۱۰ اسمِ متغیر" || no "۱۰ اسمِ متغیر" "اسمِ قدیمی، اسمِ بزرگ‌حرف یا اسمِ چسبانده در کد"
if [[ -n $NO_CHROME ]]; then skip "۰۲ نوارِ بالا"; else
o=$(node test_claude_top_buttons.cjs 2>/dev/null)
[[ $o == *'"topCount":14'* && $o == *'"hadsText":["/hads on","/hads off"]'* && $o == *'"dragTyped":""'* && $o == *'"submitted":0'* && $o == *'"notInBanner":true'* ]] && ok "۰۲ نوارِ بالا" || no "۰۲ نوارِ بالا" "آزمون جوابِ درست نداد"
fi
if [[ -n $NO_CHROME ]]; then skip "۰۳ ساعتِ پیام"; else
o=$(node test_claude_stamp.cjs 2>/dev/null)
n=$(cat ~/.vscode/extensions/anthropic.claude-code-*/webview/index.js 2>/dev/null | grep -c "data-message-stamp")
[[ $o == *'"answerClearsDot":true'* && $o == *'"promptInBubble":true'* && $n -gt 0 ]] && ok "۰۳ ساعتِ پیام" || no "۰۳ ساعتِ پیام" "آزمون یا اسمِ data-message-stamp"
fi
z=0; for f in ~/.*/extensions/anthropic.claude-code-*; do [ "$(grep -c crtl-panel "$f/extension.js" 2>/dev/null)" -gt 0 ] || z=$((z+1)); done
l=$(launchctl list | grep -c com.habib.fix-rtl-claude)
[[ $z -eq 0 && $l -ge 1 ]] && ok "۰۴ پچِ RTL" || no "۰۴ پچِ RTL" "بی‌پچ: $z · launchd: $l"
python3 Doc/tarif/naghl_chek.py >/dev/null && ok "همهٔ Doc/tarif: نقل‌های حبیب عین منبع" || no "نقل‌ها" "python3 Doc/tarif/naghl_chek.py را ببین"
a=$(git log origin/main..main --oneline 2>/dev/null | wc -l | tr -d ' '); p=$(grep -c push Doc/moallagh.md)
[[ $a -eq 0 || $p -ge 1 ]] && ok "۰۹ commit بی‌push (مانده: $a)" || no "۰۹ commit بی‌push" "commit ِ مانده بی‌ثبت در moallagh"
echo "دستی، هر گزارش: ۰۵ کار به دوشِ حبیب · ۰۶ واژه‌ها · ۰۷ سؤال با منشی · ۰۸ سرچِ عمیق"
echo "باطل: $bad"; exit $bad
