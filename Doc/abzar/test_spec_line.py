#!/usr/bin/env python3
"""آزمونِ خطِ مشخصاتِ ردیف‌های مدل — همان چیزی که زیرِ نامِ هر مدل در منو می‌آید.

حبیب ۲۶ نوامبر ۲۰۲۶ ۰۰:۵۶: «اون توضیحات مزخرف فارسی … و اون توضیحات چرت انگلیسی
اوپن کد رو بردار به جاشون فقط قیمت کامل به همون صورت ریز … با کانتکست و این
چیزاشو بنویس و طبق داکیومنت رسمی خودشون باشه».

سه چیز سنجیده می‌شود:
۱) قالب دقیقِ خط (قیمت بر میلیون · کانتکست · سقفِ خروجی · ابزار · جنسِ ورودی)
۲) رایگان بودنِ مدلِ صفرقیمت، و نبودِ جملهٔ فارسی/تبلیغاتی
۳) خواندنِ داده از فهرستِ رسمی — یعنی همان چیزی که در merged-models.json نشسته

اجرا: python3 Doc/abzar/test_spec_line.py     (کدِ خروج: ۰ سبز · ۱ قرمز)
"""
import importlib.util
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
GATEWAY = os.path.join(ROOT, 'abzar', 'darvaze', 'scripts', 'opencode_gateway.py')
MERGED = os.path.join(ROOT, 'abzar', 'darvaze', '.runtime', 'opencode-go', 'merged-models.json')

fail = 0


def sanj(name, got, want):
    global fail
    if got == want:
        print(f'✅ {name}')
        return
    fail += 1
    print(f'❌ {name}\n   گرفت: {got!r}\n   خواست: {want!r}')


def load():
    spec = importlib.util.spec_from_file_location('opencode_gateway', GATEWAY)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)  # main() فقط زیر if __name__ اجرا می‌شود
    return module


def main():
    g = load()

    # ۱) قالب — عددها همان‌قدر ریز که سرویس اعلام کرده، نه گردِ درشت.
    row = {'price_in': 0.15, 'price_out': 0.6, 'price_cache': 0.003,
           'context': 1000000, 'max_out': 384000, 'tools': True, 'modality': 'text->text'}
    sanj('خطِ کاملِ یک مدلِ اوپن‌کد', g.spec_line(row),
         'in $0.15/M · out $0.6/M · cache $0.003/M · ctx 1M · max 384K · tools · text->text')

    # ۲) قیمتِ خیلی ریز نباید به صفر گرد شود ($0.003 کش همین‌جا بود).
    sanj('قیمتِ ریز', g.spec_line({'price_in': 0.000001, 'price_out': 0.000002}),
         'in $0.000001/M · out $0.000002/M'.replace('$0.000001', '$0.000001'))

    # ۳) صفرِ صفر = رایگان، حتی اگر پرووایدر برچسبش را نگذاشته باشد.
    sanj('مدلِ رایگان', g.spec_line({'price_in': 0, 'price_out': 0, 'context': 1048576}), 'free · ctx 1.05M')

    # ۴) کانتکست و سقفِ خروجی با همان واحدِ دفترچه (K/M).
    sanj('واحدِ اندازه', [g._andaze(131072), g._andaze(384000), g._andaze(1000000), g._andaze(None)],
         ['131.1K', '384K', '1M', None])

    # ۵) ردیف‌های واقعی: نه جملهٔ فارسی، نه توضیحِ تبلیغاتی.
    with open(MERGED, encoding='utf8') as handle:
        rows = json.load(handle)
    bad = [r['id'] for r in rows
           if not r.get('description') or any('؀' <= ch <= 'ۿ' for ch in r['description'])]
    sanj('هیچ ردیفِ فارسی/خالی', bad, [])
    no_ctx = [r['id'] for r in rows if 'ctx ' not in (r.get('description') or '')]
    sanj('همهٔ ردیف‌ها کانتکست دارند', no_ctx[:3], [])
    junk = [r['id'] for r in rows if 'shutterstock' in (r.get('description') or '').lower()]
    sanj('توضیحِ تبلیغاتی نمانده', junk, [])

    print(f'\n{"قرمز" if fail else "سبز"} — {fail} ایراد')
    return 1 if fail else 0


if __name__ == '__main__':
    sys.exit(main())
