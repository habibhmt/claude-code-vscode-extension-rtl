#!/bin/bash
# نامِ پوشهٔ دادهٔ IDE از مسیرِ پوشهٔ webviewِ افزونه.
#   ~/.vscode/extensions/anthropic.claude-code-2.1.328-darwin-arm64/webview ⇒ .vscode
# بیرون کشیده شد تا آزمون داشته باشد: اگر یکی از سه `dirname` کم شود، همهٔ IDEها
# بی‌صدا `[SKIP]` می‌شوند و هیچ‌چیز قرمز نمی‌شد (ناظر ۲۳ نوامبر).
ext_dir="${1:-}"
[ -n "$ext_dir" ] || exit 2
basename "$(dirname "$(dirname "$(dirname "$ext_dir")")")"
