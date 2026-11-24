#!/usr/bin/env python3
"""شماره‌های تکراریِ ردیف‌ها را پیدا می‌کند — معلق‌ها و دفترِ کارهای باز.

چرا: دو بار در یک ساعت شمارهٔ تکراری دستی جمع شد (معلق م۱۲/م۱۶… و دفتر ۱۰۷).
قاعدهٔ ۱۸ حبیب: کارِ تکراری ⇐ اسکریپت. این اسکریپت همان چشم است؛
هر بار `./test_all.sh` بزند، تکراری را قرمز می‌دهد.

زمینه‌آگاه است: شماره‌ها فقط **در یک جدولِ پیوسته** باید یکتا باشند؛
جدولِ دیگر (مثلِ «ریسک‌های auth») شمارهٔ خودش را از ۱ شروع می‌کند.

اجرا:  python3 Doc/abzar/chek_shomare.py            (قرمز = کدِ ۱)
        python3 Doc/abzar/chek_shomare.py --file X   (یک فایل)
"""
import collections
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DEFAULTS = ['moalagh.md', os.path.join('Doc', 'tarif', '19_open_tasks.md')]
ROW = re.compile(r'^\|\s*([مM]?[۰-۹0-9]+)\s*\|')


HEADER = re.compile(r'^\|\s*#\s*\|')


def tables(path):
    """جدول‌ها را با تیتر (`#` در سرستون یا خطِ #) جدا می‌کند، نه با خطِ خالی؛
    چون در این دو فایل ردیفِ جدول با خطِ خالی از هم جدا شده‌اند."""
    cur, out = [], []
    for i, line in enumerate(open(path, encoding='utf-8'), 1):
        if line.startswith('#') or HEADER.match(line):
            if cur:
                out.append(cur)
            cur = []
            continue
        m = ROW.match(line)
        if m:
            cur.append((m.group(1), i, line.strip()[:70]))
    if cur:
        out.append(cur)
    return out


FA = '۰۱۲۳۴۵۶۷۸۹'


def value(num):
    """عددِ فارسی/لاتین را برمی‌گرداند؛ «م۱۲» هم ۱۲. کم‌تر از ۵۰ نادیده است،
    چون جدول‌های کوچکِ دیگر (ریسک‌های auth) شمارهٔ خودشان را از ۱ دارند."""
    digits = ''.join(c for c in num if c in FA or c.isdigit())
    if not digits:
        return None
    return int(''.join(str(FA.index(c)) if c in FA else c for c in digits))


def check(path):
    """تکرار در **کلِ فایل**، نه فقط یک جدول: ردیفِ تازه معمولاً با خطِ خالی
    از ردیفِ قبلی جدا می‌شود و جدول‌بندیِ ساده آن را نمی‌بیند."""
    bad, seen = [], collections.defaultdict(list)
    for i, line in enumerate(open(path, encoding='utf-8'), 1):
        m = ROW.match(line)
        if not m:
            continue
        num = m.group(1)
        v = value(num)
        # «م۱۲» همیشه سنجیده می‌شود؛ عددِ بی‌حرف فقط اگر بزرگ باشد (دفتر)
        if num.startswith('م') or num.startswith('M'):
            pass
        elif v is None or v < 50:
            continue
        seen[m.group(1)].append((i, line.strip()[:70]))
    for num, hits in seen.items():
        if len(hits) > 1:
            bad.append((num, hits))
    return bad


def main():
    args = sys.argv[1:]
    files = [args[args.index('--file') + 1]] if '--file' in args else DEFAULTS
    files = [f if os.path.isabs(f) else os.path.join(ROOT, f) for f in files]
    total = 0
    for f in files:
        if not os.path.exists(f):
            print(f'❌ نیست: {os.path.relpath(f, ROOT)}')
            total += 1
            continue
        bad = check(f)
        rel = os.path.relpath(f, ROOT)
        if not bad:
            print(f'✅ {rel}: شمارهٔ تکراری ندارد')
            continue
        for num, hits in bad:
            total += 1
            print(f'❌ {rel}: «{num}» {len(hits)} بار — خط‌های ' + ' · '.join(str(h[0]) for h in hits))
            for ln, text in hits:
                print(f'     {ln}: {text}')
    if total:
        print(f'جمع: {total} تکرار — یک شماره را عوض کن، نه دو ردیف را حذف')
        return 1
    print('جمع: ۰ تکرار')
    return 0


if __name__ == '__main__':
    sys.exit(main())
