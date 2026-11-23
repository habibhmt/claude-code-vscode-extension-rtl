#!/bin/bash
# آیا اپی که این پوشهٔ افزونه مالِ آن است نصب است؟
#
# چرا: پوشهٔ `~/.cursor/extensions` بعد از پاک‌شدنِ خودِ Cursor می‌ماند. پچ روی آن
# می‌افتاد، لنگرِ مدل‌پیکر پیدا نمی‌شد و کلِ اجرا با `[FAIL] Model picker headers`
# تمام می‌شد — در حالی که IDEی در کار نبود (حبیب ۲۳ نوامبر ۱۹:۰۷).
#
# ورودی: نامِ پوشهٔ داده (`dataFolderName`، مثلِ `.vscode` یا `.cursor`)
# خروجی: 0 = نصب است · 1 = نصب نیست (فقط پوشهٔ افزونه مانده) · 2 = هیچ اپی پیدا نشد
#        (مثلاً لینوکس) ⇒ تصمیم با صداکننده است، نه ردِ خودکار.
# آزمون: `CRTL_APPS_DIR` را عوض کن تا بی‌دست‌زدن به /Applications آزموده شود.
APPS="${CRTL_APPS_DIR:-/Applications}"
name="${1:-}"
[ -n "$name" ] || exit 2
peyda=0
for prod in "$APPS"/*/Contents/Resources/app/product.json; do
    [ -f "$prod" ] || continue
    peyda=1
    d=$(/usr/bin/python3 -c 'import json,sys;print(json.load(open(sys.argv[1])).get("dataFolderName",""))' "$prod" 2>/dev/null)
    [ "$d" = "$name" ] && exit 0
done
[ "$peyda" -eq 0 ] && exit 2
exit 1
