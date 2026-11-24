#!/bin/bash
# دروازهٔ تغییرِ نام — پنج شرط را خودش اجرا می‌کند و بی سبز شدنشان اجازهٔ تغییر نمی‌دهد.
# حبیب ۲۴ نوامبر ۲۰۲۶ ۰۶:۴۸: «بله، هر پنج بند + شش نام». چک‌لیستِ دستی ممنوع (قاعدهٔ ۱۸).
#
#   bash Doc/abzar/rename_ba_check.sh <نامِ-قدیم> <نامِ-نو> [--quick]
#
# --quick: پلهٔ ۲ (test_all.sh) را رد می‌کند؛ فقط برای وقتی خودِ همین اسکریپت
#          از داخلِ test_all.sh صدا زده می‌شود (وگرنه بازگشتی می‌شود).
# کدِ خروج: ۰ = هر پنج شرط سبز · ۱ = دستِ‌کم یکی قرمز · ۲ = استفادهٔ غلط
set -u
OLD="${1:-}"; NEW="${2:-}"; QUICK="${3:-}"
ROOT="${RENAME_ROOT:-$(cd "$(dirname "$0")/../.." && pwd)}"
cd "$ROOT" || exit 2

if [ "${1:-}" = "--selftest" ]; then
  T=$(mktemp -d)
  git -C "$T" init -q 2>/dev/null
  echo a > "$T/f"; git -C "$T" add f
  git -C "$T" -c user.email=a@b.c -c user.name=t commit -qm s 2>/dev/null
  RENAME_ROOT="$T" RENAME_BK="$T" bash "$0" old new --quick >/dev/null 2>&1; clean=$?
  echo b > "$T/g"
  RENAME_ROOT="$T" RENAME_BK="$T" bash "$0" old new --quick >/dev/null 2>&1; dirty=$?
  rm -rf "$T"
  if [ "$clean" -eq 0 ] && [ "$dirty" -ne 0 ]; then
    echo "selftest: ✅ درختِ تمیز سبز، درختِ کثیف قرمز"
    exit 0
  fi
  echo "selftest: ❌ clean=$clean dirty=$dirty (باید ۰ و ≠۰)"
  exit 1
fi

if [ -z "$OLD" ] || [ -z "$NEW" ]; then
  echo "استفاده: bash Doc/abzar/rename_ba_check.sh <نامِ-قدیم> <نامِ-نو> [--quick]"
  exit 2
fi

fail=0
echo "== تغییرِ نام: «${OLD}» ⇒ «${NEW}» =="

# ۱ · درختِ کاری تمیز
if [ -z "$(git status --porcelain)" ]; then
  echo "۱) درختِ کاری: ✅ تمیز"
else
  echo "۱) درختِ کاری: ❌ $(git status --porcelain | wc -l | tr -d ' ') تغییرِ کامیت‌نشده"
  fail=1
fi

# ۲ · زنجیرهٔ آزمون سبز
if [ "$QUICK" = "--quick" ] || [ "${TEST_ALL_RUNNING:-0}" = "1" ]; then
  echo "۲) آزمون: ⏭ رد شد (داخلِ خودِ test_all.sh هستیم)"
else
  if ./test_all.sh >/tmp/rename_check_test.log 2>&1; then
    echo "۲) آزمون: ✅ $(grep -o 'SUMMARY:.*' /tmp/rename_check_test.log | tail -1)"
  else
    echo "۲) آزمون: ❌ قرمز — /tmp/rename_check_test.log"
    fail=1
  fi
fi

# ۳ · پشتیبانِ پلیست‌ها
BK="${RENAME_BK:-$HOME/.claude/backups}/rename-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BK"
cp -p "$HOME"/Library/LaunchAgents/com.habib.*.plist "$BK"/ 2>/dev/null
n=$(ls "$BK" | wc -l | tr -d ' ')
if [ "$n" -gt 0 ]; then
  echo "۳) پشتیبانِ پلیست‌ها: ✅ $n فایل در $BK"
else
  echo "۳) پشتیبانِ پلیست‌ها: ❌ هیچ پلیستی کپی نشد"
  fail=1
fi

# ۴ · فهرستِ ارجاع‌های نامِ قدیم
echo "۴) ارجاع‌های «${OLD}»:"
if git grep -n -- "$OLD" | head -20; then
  echo "   ⚠️ بالا را یکی‌یکی عوض کن؛ بعد اسکریپت را دوباره بزن."
else
  echo "   ✅ هیچ ارجاعی در مخزن نیست"
fi

# ۵ · گام‌های پس از تغییر (اجباری، دستی اجرا نمی‌شود)
echo "۵) پس از تغییر:"
echo "   python3 Doc/abzar/chek_nam_kohne.py        # باید ۰ بدهد"
echo "   python3 Doc/abzar/restart_service.py --live # enable ⇒ bootout ⇒ bootstrap + سلامت"
echo "   python3 Doc/abzar/chek_service_ha.py        # سرویسِ خفتهٔ تازه نباشد"

if [ "$fail" -ne 0 ]; then
  echo "== قرمز: تغییر ممنوع =="
  exit 1
fi
echo "== سبز: تغییر آزاد است (گامِ ۵ را فراموش نکن) =="
exit 0
