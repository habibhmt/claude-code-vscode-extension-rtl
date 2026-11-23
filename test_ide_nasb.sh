#!/bin/bash
# آزمونِ «اپِ نصب‌شده» (۲۳ نوامبر ۲۰۲۶): پوشهٔ افزونهٔ بدونِ اپ نباید پچ شود و
# نباید `[FAIL] Model picker` بدهد. `CRTL_APPS_DIR` قلابی است تا به /Applications
# دست نزنیم. خرابکاری: `abzar/ide_nasb.sh` را همیشه `exit 0` کن ⇒ این آزمون قرمز می‌شود.
set -u
cd "$(dirname "$0")"
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
mkdir -p "$TMP/Applications/Fake Code.app/Contents/Resources/app"
printf '{"dataFolderName": ".vscode"}' > "$TMP/Applications/Fake Code.app/Contents/Resources/app/product.json"
ok=0; bad=0
check() { # نام، کدِ انتظار، پوشهٔ اپ
    local nam=$1 entezar=$2 apps=$3 rc=0
    CRTL_APPS_DIR="$apps" bash abzar/ide_nasb.sh "$nam" || rc=$?
    if [ "$rc" -eq "$entezar" ]; then ok=$((ok + 1)); else
        echo "FAIL: $nam ⇒ $rc (انتظار: $entezar)"; bad=$((bad + 1)); fi
}
check .vscode 0 "$TMP/Applications"      # اپ هست
check .cursor 1 "$TMP/Applications"      # فقط پوشهٔ افزونه مانده
check .vscode 2 "$TMP/bi-app"            # هیچ اپی نیست ⇒ نمی‌شود گفت
# نامِ پوشهٔ داده از مسیرِ webview (سه dirname) — اگر یکی کم شود، همه SKIP می‌شوند
d1=$(bash abzar/ide_data_name.sh "$HOME/.vscode/extensions/anthropic.claude-code-2.1.328-darwin-arm64/webview")
if [ "$d1" = ".vscode" ]; then ok=$((ok + 1)); else echo "FAIL: نامِ پوشهٔ داده ⇒ '$d1' (انتظار: .vscode)"; bad=$((bad + 1)); fi
d2=$(bash abzar/ide_data_name.sh "/x/.cursor/extensions/anthropic.claude-code-2.1.302-darwin-arm64/webview")
if [ "$d2" = ".cursor" ]; then ok=$((ok + 1)); else echo "FAIL: نامِ پوشهٔ داده ⇒ '$d2' (انتظار: .cursor)"; bad=$((bad + 1)); fi
echo "ide_nasb: $ok ok, $bad bad"
[ "$bad" -eq 0 ]
