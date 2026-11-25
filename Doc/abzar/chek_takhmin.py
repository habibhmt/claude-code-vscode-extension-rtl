#!/usr/bin/env python3
"""سنجشِ «حدس کنسل شد» — هیچ عددِ دلاریِ تخمینی در تعریف‌ها نمانده باشد.

حبیب ۲۵ نوامبر ۲۰۲۶ ۰۵:۵۴: «پس دیگه حدس قسمت کنسل هست و همه چی باید دقیق در بیاد»

هر خطی از `Doc/tarif/*.md` که هم واژهٔ «تخمین» دارد و هم علامتِ دلار، تخمینِ
دلاری است — مگر خطی که **با** نشانهٔ «نمونهٔ باطل‌شده» شروع شود (آن خط، خودِ
نمونهٔ کنسل‌شده را نقل می‌کند تا کسی دوباره تکرارش نکند).

نشانه باید **اولِ خطِ سند** باشد، نه جایی در آن: اگر هر جایی کافی بود، یک جمله
که همان واژه را دارد و تخمینِ واقعی می‌نویسد، فرمان را کور می‌کرد (ناظر-۱۳۶، ۰۶:۰۰).

اجرا:
  python3 Doc/abzar/chek_takhmin.py              # پوشهٔ Doc/tarif
  python3 Doc/abzar/chek_takhmin.py --dir D      # پوشهٔ دیگر (خرابکاری)
کدِ خروج: ۰ هیچ تخمینی نیست · ۱ هست (خط‌ها چاپ می‌شوند) · ۲ خطای استفاده
"""
import os
import re
import sys

RISHE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PISHFARZ_DIR = os.path.join(RISHE, 'Doc', 'tarif')
KALAME = 'تخمین'
NESHANE = 'نمونهٔ باطل‌شده'
HELP = __doc__


def ghesmat(dir_masir):
    """خطوطِ تخمینیِ دلاری، بی آن‌هایی که با نشانه شروع می‌شوند."""
    bad = []
    if not os.path.isdir(dir_masir):
        return None
    for f in sorted(os.listdir(dir_masir)):
        if not f.endswith('.md'):
            continue
        p = os.path.join(dir_masir, f)
        for i, line in enumerate(open(p, encoding='utf-8', errors='replace'), 1):
            if KALAME not in line or '$' not in line:
                continue
            matn = line.strip().lstrip('>|*-# ').strip()
            if matn.startswith(NESHANE):
                continue
            bad.append(f'{f}:{i}: {line.strip()[:110]}')
    return bad


def main():
    args = sys.argv[1:]
    if '--help' in args or '-h' in args:
        print(HELP)
        return 0
    dir_masir = args[args.index('--dir') + 1] if '--dir' in args else PISHFARZ_DIR
    bad = ghesmat(dir_masir)
    if bad is None:
        print('❌ پوشه نیست:', dir_masir)
        return 2
    if not bad:
        print('✅ هیچ عددِ دلاریِ تخمینی نیست')
        return 0
    print(f'❌ {len(bad)} خطِ تخمینی:')
    for b in bad:
        print('  ', b)
    return 1


if __name__ == '__main__':
    sys.exit(main())
