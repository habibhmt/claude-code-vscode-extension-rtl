#!/bin/bash
# Runs the "چک" line of every definition; prints which one is broken (باطل).
cd "$(dirname "$0")/../.." || exit 2
export PATH="$HOME/.nvm/versions/node/v22.23.2/bin:$PATH"
bad=0
ok()  { echo "✅ $1"; }
no()  { echo "❌ $1 — $2"; bad=$((bad+1)); }
o=$(node mods/hads/test_hads.mjs 2>/dev/null)
[[ $o == *'"defaultOff":0'* && $o == *'"otherProject":0'* && $o == *'"model":"claude-sonnet-5-5"'* && $o == *'"submit":0'* ]] && ok "۰۱ حدس" || no "۰۱ حدس" "آزمون جوابِ درست نداد"
o=$(node test_claude_top_buttons.cjs 2>/dev/null)
[[ $o == *'"topCount":14'* && $o == *'"hadsText":["/hads on","/hads off"]'* && $o == *'"dragTyped":""'* && $o == *'"submitted":0'* && $o == *'"notInBanner":true'* ]] && ok "۰۲ نوارِ بالا" || no "۰۲ نوارِ بالا" "آزمون جوابِ درست نداد"
o=$(node test_claude_stamp.cjs 2>/dev/null)
n=$(cat ~/.vscode/extensions/anthropic.claude-code-*/webview/index.js 2>/dev/null | grep -c "data-message-stamp")
[[ $o == *'"answerClearsDot":true'* && $o == *'"promptInBubble":true'* && $n -gt 0 ]] && ok "۰۳ ساعتِ پیام" || no "۰۳ ساعتِ پیام" "آزمون یا اسمِ data-message-stamp"
z=0; for f in ~/.*/extensions/anthropic.claude-code-*; do [ "$(grep -c crtl-panel "$f/extension.js" 2>/dev/null)" -gt 0 ] || z=$((z+1)); done
l=$(launchctl list | grep -c com.habib.fix-rtl-claude)
[[ $z -eq 0 && $l -ge 1 ]] && ok "۰۴ پچِ RTL" || no "۰۴ پچِ RTL" "بی‌پچ: $z · launchd: $l"
echo "باطل: $bad"; exit $bad
