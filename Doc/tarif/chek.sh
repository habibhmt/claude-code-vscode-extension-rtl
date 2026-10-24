#!/bin/bash
# Runs the "چک" line of every definition; prints which one is broken (باطل).
cd "$(dirname "$0")/../.." || exit 2
export PATH="$HOME/.nvm/versions/node/v22.23.2/bin:$PATH"
bad=0
# tests 02 and 03 start a headless Google Chrome; NO_CHROME=1 skips them (Habib 22 Oct 05:25: no Chrome for now)
skip() { echo "⏭  $1 — رد شد: کروم فعلاً ممنوع"; }
ok()  { echo "✅ $1"; }
no()  { echo "❌ $1 — $2"; bad=$((bad+1)); }
o=$(node mods/hads/test_hads.mjs 2>/dev/null)
[[ $o == *'"defaultOff":0'* && $o == *'"otherChat":0'* && $o == *'"aAfterBOff":"on"'* && $o == *'"projectFiles":0'* && $o == *'"afterClear":"engine"'* && $o == *'"model":"claude-sonnet-5-5"'* && $o == *'"submit":0'* ]] && ok "۰۱ حدس" || no "۰۱ حدس" "آزمون جوابِ درست نداد"
[[ $o == *'"brake":1'* && $o == *'"endNotDropped":2'* && $o == *'"oneFork":[1,0,0]'* && $o == *'"forkBroken":[1,1,1]'* && $o == *'"bigChat":[0,1,1]'* && $o == *'"endWins":"پایان شد. منتظرِ حبیب."'* && $o == *'"coldWarn":true'* && $o == *'"btwNow":true'* && $o == *'"pinned":[60000,400000]'* && $o == *'"bothOff":[0,0,0]'* && $o == *'"noStale":false'* && $o == *'"allBack":"on"'* && $o == *'"histCap":50'* && $o == *'"histOrder":[true,true,true,true]'* && $o == *'"foldFile":"on -guess min"'* && $o == *'"tickKeeps":"on -ask +midfork"'* && $o == *'"twoOnly":"اول. دوم!"'* && $o == *'"fileDot":"ایجنت فایل register.js را در v2.10 عوض کرد. بعد تست زد."'* && $o == *'"maxLen":"300…"'* && $o == *'"untouched":"ok"'* && $o == *'"toolSurvives":"ok"'* && $o == *'"ask":{"fork":1,"fill":0,"submit":0}'* && $o == *'"nothingToFork":true'* ]] && ok "۱۰ دو جمله و بپرس" || no "۱۰ دو جمله و بپرس" "آزمون جوابِ درست نداد"
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
