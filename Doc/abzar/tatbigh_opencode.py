#!/usr/bin/env python3
"""تطبیقِ مصرفِ اوپن کد — سه سبد، و شرطِ پذیرش: توضیح‌نشده = ۰.

سبدها (تعریف ۴۸):
  ۱) شمرده‌شده   : status 200 با list_cost عددی
  ۲) نباید شمرده  : status ≠ 200 · count_tokens · ردیفِ بی‌توکن (usage نرسیده)
  ۳) توضیح‌نشده   : status 200، توکن دارد، ولی هزینه ندارد  ← باید صفر باشد

اجرا:
  python3 Doc/abzar/tatbigh_opencode.py                 # از usage.jsonl
  python3 Doc/abzar/tatbigh_opencode.py --rows F.jsonl  # آزمون/خرابکاری
  python3 Doc/abzar/tatbigh_opencode.py --json
کدِ خروج: ۰ توضیح‌نشده=۰ · ۱ توضیح‌نشده>۰ · ۲ خطای استفاده
"""
import json
import os
import sys

RISHE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
USAGE = os.path.join(RISHE, 'abzar', 'darvaze', '.runtime', 'opencode-go', 'usage.jsonl')
HELP = __doc__


def tolid(r):
    return isinstance(r.get('input'), int) and r['input'] > 0


def sبدها(rows):
    shomorde, nabayad, tozih = [], [], []
    for r in rows:
        st = r.get('status')
        cost = r.get('list_cost')
        if st == 200 and isinstance(cost, (int, float)):
            shomorde.append(r)
        elif st != 200:
            nabayad.append(('status ' + str(st), r))
        elif (r.get('work_type') or '') == 'count_tokens':
            nabayad.append(('count_tokens', r))
        elif not tolid(r):
            nabayad.append(('بی‌توکن', r))
        else:
            tozih.append(r)
    return shomorde, nabayad, tozih


def main():
    args = sys.argv[1:]
    if '--help' in args or '-h' in args:
        print(HELP)
        return 0
    masir = args[args.index('--rows') + 1] if '--rows' in args else USAGE
    if not os.path.exists(masir):
        print('❌ فایلِ مصرف نیست:', masir)
        return 2
    rows = []
    for line in open(masir, encoding='utf-8', errors='replace'):
        line = line.strip()
        if not line:
            continue
        try:
            rows.append(json.loads(line))
        except ValueError:
            continue
    sh, nb, tz = sبدها(rows)
    jam = round(sum(r['list_cost'] for r in sh), 4)
    dalil = {}
    for d, _ in nb:
        dalil[d] = dalil.get(d, 0) + 1
    if '--json' in args:
        print(json.dumps({'rows': len(rows), 'shomorde': len(sh), 'sum_usd': jam,
                          'nabayad': len(nb), 'dalil': dalil, 'tozih': len(tz)}, ensure_ascii=False))
        return 0 if not tz else 1
    print(f'ردیف‌ها: {len(rows)}')
    # دامنه به تفکیکِ provider — بی‌provider ساکت حذف نمی‌شود (شرطِ ناظر-۱۳۶)
    import collections as _c
    for prov in ('opencode', 'openrouter', None):
        sub = [r for r in rows if (r.get('provider') or None) == prov]
        a, b, c = sبدها(sub)
        name = prov or 'بی‌provider'
        print(f'   دامنه {name:12s}: {len(sub):5d} · شمرده {len(a):5d} (${round(sum(r["list_cost"] for r in a),4)}) · نباید {len(b):4d} · توضیح‌نشده {len(c)}')
    print(f'۱) شمرده‌شده: {len(sh)} · جمع ${jam}')
    print(f'۲) نباید شمرده می‌شد: {len(nb)} · ' + ' · '.join(f'{k}={v}' for k, v in sorted(dalil.items())))
    print(f'۳) توضیح‌نشده: {len(tz)}')
    if tz:
        print('❌ توضیح‌نشده صفر نیست — نیایش:')
        for r in tz[:10]:
            print('  ', {k: r.get(k) for k in ('time_utc', 'provider', 'model', 'input', 'status')})
        return 1
    print('✅ توضیح‌نشده = ۰ (شرطِ تعریف ۴۸)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
