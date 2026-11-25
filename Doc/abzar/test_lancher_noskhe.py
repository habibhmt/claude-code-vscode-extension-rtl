#!/usr/bin/env python3
"""لانچر نباید به شمارهٔ نسخه گره خورده باشد.

ریشه (۲۶ نوامبر ۲۰۲۶): `CLAUDE_BIN` روی `…/versions/2.1.327` هاردکد بود. زنجیرهٔ
زنده مسیر را `$1` می‌دهد و به آن نمی‌رسد؛ ولی هر فراخوانِ بی‌مسیر (fallback)
بی‌صدا با نسخهٔ خوابیده اجرا می‌شد. پوشهٔ ۲٫۱٫۳۲۷ هم هنوز روی دیسک بود، پس
خطا نمی‌داد — بدتر: بی‌صدا کهنه بود.

آزمون سه چیز را می‌سنجد:
۱) هیچ مسیرِ `versions/<شماره>` در لانچر نمانده باشد؛
۲) مسیرِ پیش‌فرض وجود داشته باشد و به یک نسخه اشاره کند؛
۳) فراخوانِ بی‌مسیر، همان نسخه‌ای را بدهد که `claude --version` می‌دهد.

خرابکاریِ عمدی: برگرداندنِ خطِ قدیمی باید این آزمون را قرمز کند.
"""
import os
import re
import subprocess
import sys
from pathlib import Path

LAUNCHER = Path.home() / '.claude' / 'claude_abzar_kam.sh'
PINNED = re.compile(r'versions/\d+\.\d+\.\d+')

failures = []


def check(condition, message):
    if condition:
        print(f'✅ {message}')
    else:
        print(f'❌ {message}')
        failures.append(message)


def main():
    if not LAUNCHER.is_file():
        print(f'❌ لانچر نیست: {LAUNCHER}')
        return 1
    text = LAUNCHER.read_text(encoding='utf8')

    check(not PINNED.search(text),
          'لانچر هیچ شمارهٔ نسخهٔ هاردکد ندارد' if not PINNED.search(text)
          else f'شمارهٔ نسخه در لانچر مانده: {PINNED.search(text).group(0)}')

    default = re.search(r'CLAUDE_BIN=\$\{CLAUDE_BIN:-([^}]+)\}', text)
    check(default is not None, 'خطِ CLAUDE_BIN پیدا شد')
    if default:
        raw = default.group(1).strip()
        # `$HOME` و `${HOME}` هر دو رایج‌اند؛ به مسیرِ واقعی تبدیل می‌شوند.
        expanded = raw.replace('${HOME}', os.path.expanduser('~')).replace('$HOME', os.path.expanduser('~'))
        expanded = os.path.expanduser(expanded)
        check(PINNED.search(raw) is None, f'پیش‌فرض شمارهٔ نسخه ندارد ({raw})')
        check(Path(expanded).exists(), f'پیش‌فرض روی دیسک هست ({expanded})')
        check(os.access(expanded, os.X_OK), f'پیش‌فرض اجراشدنی است ({expanded})')

    try:
        pinned = subprocess.run([str(LAUNCHER), '--version'], capture_output=True,
                                text=True, timeout=60)
        own = subprocess.run(['claude', '--version'], capture_output=True,
                             text=True, timeout=60)
        check(pinned.returncode == 0, f'لانچرِ بی‌مسیر اجرا شد (rc={pinned.returncode})')
        check(own.returncode == 0, f'claude --version اجرا شد (rc={own.returncode})')
        if pinned.returncode == 0 and own.returncode == 0:
            a = (pinned.stdout + pinned.stderr).strip().splitlines()[0]
            b = (own.stdout + own.stderr).strip().splitlines()[0]
            check(a == b, f'نسخهٔ لانچر همان نسخهٔ فعال است («{a}» در برابر «{b}»)')
    except (OSError, subprocess.SubprocessError) as error:
        check(False, f'اجرای لانچر نشد: {type(error).__name__}')

    print()
    if failures:
        print(f'FAILED: {len(failures)}')
        return 1
    print('OK')
    return 0


if __name__ == '__main__':
    sys.exit(main())
