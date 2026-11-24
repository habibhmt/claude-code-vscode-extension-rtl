#!/usr/bin/env python3
"""سنجشِ تعریف ۴۹ — چهار شمارنده: بی‌صاحب · بی‌قیمت · بی‌usage · بی‌provider.

حبیب ۲۴ نوامبر ۲۰۲۶ ۲۱:۳۴ (پاسخِ پنجره): «از این به بعد دیگه ما نه بی صاحب داریم نه
بی قیمت داریم نه بی یوسج داریم … هر فراخوانی مال کی بوده و چقدر بوده چه مدلی بوده».

دامنه: ردیف‌های پیش از برش، **میراثی**اند و در حکم نمی‌آیند — حبیب گفت «از این به بعد».

اجرا:
  python3 Doc/abzar/chek_log_kamel.py                    # کلِ تاریخچه (میراثی + امروز)
  python3 Doc/abzar/chek_log_kamel.py --az 2026-11-24T22:00:00Z   # حکم از برش
  python3 Doc/abzar/chek_log_kamel.py --rows F.jsonl      # آزمون/خرابکاری
  python3 Doc/abzar/chek_log_kamel.py --baseline F.json   # قرمز فقط اگر از خطِ پایه بالا رفت
  python3 Doc/abzar/chek_log_kamel.py --json
کدِ خروج: ۰ صفر (یا از خطِ پایه بالا نرفت) · ۱ حکم رد شد · ۲ خطای استفاده
"""
import json
import os
import sys

RISHE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
USAGE = os.path.join(RISHE, 'abzar', 'darvaze', '.runtime', 'opencode-go', 'usage.jsonl')
# برشِ پیش‌فرض: لحظه‌ای که هر دو نقطهٔ نوشتنِ ازقلمافتاده بسته شد (۵۰۴ و ۴۰۰).
# ردیف‌های پیش از این، میراثی‌اند و عقب‌گردکردنی نیستند.
BRESH_PISHFARZ = '2026-11-24T18:46:00Z'
HELP = __doc__

SHOMARANDE_HA = [
    # (اسم، شرطِ شمردن)
    ('بی_صاحب', lambda r: not (r.get('session_id') or '').strip()),
    ('بی_قیمت', lambda r: r.get('status') == 200
     and not isinstance(r.get('list_cost'), (int, float))
     and (r.get('work_type') or '') != 'count_tokens'),
    ('بی_usage', lambda r: r.get('status') == 200
     and bool(r.get('model'))
     and not (isinstance(r.get('input'), int) and r['input'] > 0)
     and (r.get('work_type') or '') != 'count_tokens'),
    ('بی_provider', lambda r: not (r.get('provider') or '').strip()),
]


def khandan(masir):
    out = []
    for line in open(masir, encoding='utf-8', errors='replace'):
        line = line.strip()
        if not line:
            continue
        try:
            out.append(json.loads(line))
        except ValueError:
            continue
    return out


def beshmar(rows):
    return [(nom, sum(1 for r in rows if shart(r))) for nom, shart in SHOMARANDE_HA]


def main():
    args = sys.argv[1:]
    if '--help' in args or '-h' in args:
        print(HELP)
        return 0
    masir = args[args.index('--rows') + 1] if '--rows' in args else USAGE
    if not os.path.exists(masir):
        print('❌ فایلِ مصرف نیست:', masir)
        return 2
    az = args[args.index('--az') + 1] if '--az' in args else None
    base_masir = args[args.index('--baseline') + 1] if '--baseline' in args else None
    rows = khandan(masir)
    mirasi = [r for r in rows if az and (r.get('time_utc') or '') < az]
    domain = [r for r in rows if not az or (r.get('time_utc') or '') >= az]
    shomaresh = beshmar(domain)
    shomaresh_kol = beshmar(rows)

    if '--json' in args:
        print(json.dumps({'rows': len(rows), 'domain': len(domain), 'az': az,
                          'shomarde_domain': dict(shomaresh), 'shomarde_kol': dict(shomaresh_kol),
                          'baseline': base_masir}, ensure_ascii=False))
        # کدِ خروج در حالتِ json از baseline/حکم می‌آید
    else:
        print(f'ردیف‌ها: {len(rows)} · دامنهٔ حکم: {len(domain)}' +
              (f' (از {az})' if az else ' (کلِ تاریخچه — میراثی هم داخل)'))
        if mirasi:
            print(f'  میراثی (پیش از برش): {len(mirasi)}')
        for nom, c in shomaresh:
            kol = dict(shomaresh_kol)[nom]
            ezafe = f' · کلِ تاریخچه {kol}' if az else ''
            print(f'  {nom}: {c}{ezafe}')

    bad = []
    if base_masir:
        # گیتِ زنجیره: قرمز فقط اگر شمارنده از خطِ پایه **بالا رفت** (رجعت ممنوع).
        try:
            base = json.load(open(base_masir, encoding='utf-8'))
        except (OSError, ValueError):
            print('❌ خطِ پایه خوانده نشد:', base_masir)
            return 2
        for nom, c in shomaresh:
            ghabl = base.get(nom, 0)
            if c > ghabl:
                bad.append(f'{nom} از {ghabl} به {c} بالا رفت')
        if '--json' not in args:
            if bad:
                print('❌ رجعت: ' + ' · '.join(bad))
            else:
                print('✅ هیچ شمارنده‌ای از خطِ پایه بالا نرفت')
        return 1 if bad else 0

    if '--report' in args:
        # حبیب ۲۴ نوامبر ۲۲:۱۵ (پاسخِ پنجره): «گزارش‌گر شود» — عددها می‌آیند، ولی
        # زنجیره را نمی‌خواباند تا بدهیِ استریمِ خالی درمان شود. بدهی پنهان نمی‌شود:
        # همین خط و ردیفِ دفتر ۱۱۳ عدد را نگه می‌دارند.
        print('گزارشِ بدهیِ تعریف ۴۹ (گیت نیست): ' +
              ' · '.join(f'{n}={c}' for n, c in shomaresh))
        return 0
    kharab = [(n, c) for n, c in shomaresh if c]
    if '--json' in args:
        return 1 if kharab else 0
    if not kharab:
        print('✅ هر چهار شمارنده در دامنهٔ حکم صفر — تعریف ۴۹ برآورده شد')
        return 0
    print('❌ تعریف ۴۹ برآورده نشده: ' + ' · '.join(f'{n}={c}' for n, c in kharab))
    return 1


if __name__ == '__main__':
    sys.exit(main())
