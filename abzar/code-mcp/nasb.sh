#!/bin/bash
# نصبِ «فورکِ کد مود» بیرونِ مخزن — ۲۶ نوامبر ۲۰۲۶
#
# چرا: ثبتِ MCP سراسری است، ولی کد داخلِ پوشهٔ روزشمارِ ۱۳۶ بود. اگر آن پوشه
# روزی عوض یا رها شود، ابزارِ کد مود در همهٔ پروژه‌ها می‌میرد. حالا کد در
# ~/.claude/mcp/fork_code_mode/ نصب می‌شود و مخزن منبعِ حقیقت می‌ماند.
#
#   bash abzar/code-mcp/nasb.sh           ← نصب/به‌روزرسانی
#   bash abzar/code-mcp/nasb.sh --check    ← اگر دو نسخه یکی نبودند، قرمز (خروجی ۱)
#
# ── شرطِ باطل: حبیب بگوید «فورکِ کهنه اجرا شد» ⇐ همین --check قرمز می‌دهد، به‌شرطِ
#    اینکه در test_all.sh صدا زده شود (همان‌جا هست: «fork code nasb»).

set -u

SRC="$(cd "$(dirname "$0")" && pwd)"
DST="$HOME/.claude/mcp/fork_code_mode"
FILES=(server.mjs mcp_pool.mjs)

mode="${1:-install}"

case "$mode" in
  install)
    mkdir -p "$DST" || exit 1
    for f in "${FILES[@]}"; do
      cp -p "$SRC/$f" "$DST/$f" || { echo "نصب نشد: $f"; exit 1; }
      echo "نصب شد: $DST/$f"
    done
    echo "یادت باشد: ~/.claude.json باید به همین مسیر اشاره کند (args[0])."
    ;;
  --check)
    rc=0
    for f in "${FILES[@]}"; do
      if [ ! -f "$DST/$f" ]; then
        echo "قرمز: نسخهٔ نصب‌شده نیست: $DST/$f"
        rc=1
      elif ! cmp -s "$SRC/$f" "$DST/$f"; then
        echo "قرمز: دو نسخهٔ $f یکی نیستند (مخزن با نصب‌شده فرق دارد)."
        echo "       درستش: bash abzar/code-mcp/nasb.sh"
        rc=1
      else
        echo "سبز: $f یکی است"
      fi
    done
    exit "$rc"
    ;;
  *)
    echo "استفاده: bash abzar/code-mcp/nasb.sh [--check]" >&2
    exit 2
    ;;
esac
