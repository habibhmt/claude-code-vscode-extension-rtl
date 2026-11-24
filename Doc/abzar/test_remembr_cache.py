#!/usr/bin/env python3
"""آزمونِ بندِ ۵ تعریفِ ۳۰ — کشِ گرمِ رممبر (cache_read > 0 در ۱۰ تماسِ آخر).

پیش از این بندِ ۵ فقط با داده سنجیده شده بود و آزمون و خرابکاری نداشت
(ناظر-۱۳۶، ۲۴ نوامبر ۲۰۲۶ ۱۸:۰۸).

اجرا:
  python3 Doc/abzar/test_remembr_cache.py                 # از usage.jsonl
  python3 Doc/abzar/test_remembr_cache.py --rows F.jsonl  # برای خرابکاری
  python3 Doc/abzar/test_remembr_cache.py --force-zero    # خرابکاری: کش را صفر ببین
کدِ خروج: ۰ سبز · ۱ قرمز
"""
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
USAGE = os.path.join(ROOT, 'abzar', 'darvaze', '.runtime', 'opencode-go', 'usage.jsonl')
N = 10
HELP = __doc__


def khandan(masir):
    out = []
    for line in open(masir, encoding='utf-8', errors='replace'):
        line = line.strip()
        if not line:
            continue
        try:
            r = json.loads(line)
        except ValueError:
            continue
        if r.get('status') == 200 and isinstance(r.get('input'), int) and r['input'] > 0:
            out.append(r)
    return out


def main():
    args = sys.argv[1:]
    if '--help' in args or '-h' in args:
        print(HELP)
        return 0
    masir = args[args.index('--rows') + 1] if '--rows' in args else USAGE
    force = '--force-zero' in args
    if not os.path.exists(masir):
        print('❌ فایلِ مصرف نیست:', masir)
        return 1
    rows = khandan(masir)[-N:]
    if len(rows) < N:
        print(f'⚠️ فقط {len(rows)} تماسِ سالم پیدا شد (کمتر از {N}) — آزمون معنا ندارد')
        return 1
    garm = 0
    for r in rows:
        c = 0 if force else (r.get('cache_read') or 0)
        garm += 1 if isinstance(c, (int, float)) and c > 0 else 0
    print(f'۱۰ تماسِ آخر: {garm} با cache_read > 0')
    if garm >= 8:
        print('✅ کشِ گرم است (بندِ ۵ تعریف ۳۰)')
        return 0
    print('❌ کش سرد است — بندِ ۵ رد شد')
    return 1


if __name__ == '__main__':
    sys.exit(main())
