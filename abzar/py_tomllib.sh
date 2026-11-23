#!/bin/bash
# یک نسخهٔ مشترک: مسیرِ پایتونی را چاپ می‌کند که `tomllib` دارد (۳٫۱۱+).
# هم fix-rtl-claude.sh و هم هوکِ میزبان (claude-host-hook.js) همین را صدا می‌زنند؛
# دو نسخه نمی‌شود، وگرنه یکی به‌روز می‌شود و آن یکی نه.
# چرا لازم است: زیرِ launchd با PATHِ محیطِ GUI، `python3` همان ۳٫۹٫۶ است که
# `tomllib` ندارد؛ پارسرِ شُل حذف شده، پس باید مفسرِ درست را پیدا کنیم، نه فرض.
# خروجی: مسیرِ مطلق روی stdout، صفر = پیدا شد · یک = هیچ‌کدام، با پیام روی stderr.
# فهرست با متغیرِ محیطی هم عوض می‌شود، تا آزمون بتواند حالتِ «هیچ‌کدام نبود» را
# واقعاً بسازد بی آنکه به فایل‌های سیستم دست بزند.
NAMZADHA="${PY_TOMLLIB_CANDIDATES:-/opt/homebrew/bin/python3 /usr/local/bin/python3 python3}"
for p in $NAMZADHA; do
    if "$p" -c 'import tomllib' >/dev/null 2>&1; then
        command -v "$p" 2>/dev/null || printf '%s\n' "$p"
        exit 0
    fi
done
printf 'پایتونِ ۳٫۱۱+ (با tomllib) پیدا نشد؛ امتحان شد: %s\n' "$NAMZADHA" >&2
exit 1
