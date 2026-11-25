#!/usr/bin/env python3
"""آزمونِ «همهٔ پرووایدرها یک دروازه» — `providers.toml` تنها منبعِ خط‌ها.

حبیب ۲۵ نوامبر ۲۰۲۶ ۱۹:۴۹: «چرا دروازه توش همه پرووایدر ها نیستند؟ دروازه اوپن کد
جدا، دروازه اوپن روتر جدا، دروازه کلود کد ای پی ای جدا و همینطوری هر چی بعدا اضافه شد».

چیزهایی که سنجیده می‌شود:
  ۱) رجیستری می‌خواند و هر بلوک `noe` دارد (بی `noe` یعنی خطِ ناشناخته).
  ۲) هر سه خطِ امروز مقصد و سرآیندِ درست می‌سازند.
  ۳) پیشوندِ `anthropic/` به خطِ anthropic می‌رود و پیشوند از شناسه کنده می‌شود.
  ۴) شناسه‌های برهنهٔ `claude-*` **جابه‌جا نمی‌شوند** — ترافیکِ زنده از کاتالوگِ
     اوپن کد جواب می‌گیرد؛ اگر به خطِ anthropic می‌رفتند، همه ۴۰۱ می‌شدند
     (`claude-fable-5-2` · ۱٬۸۲۰ ردیف تا ۲۰۲۶-۱۱-۲۵T08:08:40Z).
  ۵) پرووایدرِ ناشناخته ⇒ خطای صدادار، نه سقوطِ بی‌صدا به خطِ دیگر.
  ۶) `providers.toml` خراب/نبود ⇒ دروازه از کار نمی‌افتد و به رفتارِ قبلی می‌افتد.
  ۷) بازنویسیِ مسیر فقط جایی که `masir` گفته.

اجرا: python3 Doc/abzar/test_darvaze_pishfarz.py
کدِ خروج: ۰ همه سبز · ۱ قرمز
"""
import os
import sys
import tempfile

RISHE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(RISHE, 'abzar', 'darvaze', 'scripts'))

import opencode_gateway as g  # noqa: E402

NATIJE = []


def sanj(nom, shart):
    NATIJE.append((nom, bool(shart)))


def main():
    # ۱) رجیستری
    sanj('providers.toml پیدا می‌شود', g.PISHFARZ_FILE.exists())
    blok_ha = g.pishfarz_ha()
    sanj('سه خطِ امروز اعلام شده', {'opencode', 'openrouter', 'anthropic'} <= set(blok_ha))
    sanj('هر بلوک noe دارد', blok_ha and all((b.get('noe') or '').strip() for b in blok_ha.values()))

    # ۲) هر خط مقصد و سرآیند می‌سازد
    for pv, entezar in (('opencode', 'opencode.ai'),
                        ('openrouter', '127.0.0.1'),
                        ('anthropic', 'api.anthropic.com')):
        target, headers = g.langar(pv, {'anthropic-version': '2023-06-01'})
        sanj(f'خطِ {pv} مقصد دارد', target and entezar in target)
        sanj(f'خطِ {pv} سرآیند دارد', isinstance(headers, dict) and bool(headers))
    sanj('خطِ anthropic با x-api-key می‌رود (نه Bearer)',
         'x-api-key' in g.langar('anthropic', {})[1])

    # ۳) پیشوند
    pv, sent, _ = g.route('anthropic/claude-opus-5-5')
    sanj('anthropic/ به خطِ anthropic می‌رود', pv == 'anthropic')
    sanj('پیشوند از شناسه کنده می‌شود', sent == 'claude-opus-5-5')
    sanj('پیشوندِ ناشناخته کنده نمی‌شود',
         g.route('anthropicx/foo')[1] == 'anthropicx/foo')

    # ۴) شناسه‌های برهنهٔ claude دست‌نخورده (رگرسیونِ ترافیکِ زنده)
    for nom in ('claude-fable-5-2', 'claude-opus-5-5'):
        pv = g.route(nom)[0]
        sanj(f'«{nom}» به خطِ anthropic نمی‌رود', pv != 'anthropic')

    # ۵) پرووایدرِ ناشناخته ⇒ صدادار
    asl = dict(blok_ha)
    asl_tabe = g.pishfarz_ha
    try:
        g.pishfarz_ha = lambda: {**asl, 'nadarim': {'noe': 'opencode'}}
        target, dalil = g.langar('nadarim', {})
        sanj('پرووایدرِ بی‌base خطا می‌دهد', target is None)
        sanj('دلیلِ خطا نامش را دارد', 'nadarim' in str(dalil))
        g.pishfarz_ha = lambda: {**asl, 'ajib': {'noe': 'khoshgel', 'base': 'https://x.y'}}
        target, dalil = g.langar('ajib', {})
        sanj('noe ناشناخته خطا می‌دهد', target is None and 'noe' in str(dalil))
    finally:
        g.pishfarz_ha = asl_tabe

    # ۶) فایلِ خراب/نبود ⇒ سقوط نکردن
    fil = g.PISHFARZ_FILE
    with tempfile.NamedTemporaryFile('w', suffix='.toml', delete=False) as f:
        f.write('[shekaste\nnoe = ')
        kharab = f.name
    try:
        g.PISHFARZ_FILE = type(fil)(kharab)
        sanj('فایلِ خراب ⇒ تهی، بی استثنا', g.pishfarz_ha() == {})
        sanj('فایلِ خراب ⇒ route به رفتارِ قبلی می‌افتد',
             g.route('deepseek-v4.1-flash')[0] == 'opencode')
        g.PISHFARZ_FILE = type(fil)('/tmp/hich-ja-nist-' + '0' * 8 + '.toml')
        sanj('فایلِ نبود ⇒ تهی', g.pishfarz_ha() == {})
    finally:
        g.PISHFARZ_FILE = fil

    # ۷) بازنویسیِ مسیر
    sanj('مسیرِ اوپن کد به anthropic/v1 می‌رود',
         g.masir_baznevisi('opencode', '/v1/messages') == '/anthropic/v1/messages')
    sanj('مسیرِ anthropic دست‌نخورده', g.masir_baznevisi('anthropic', '/v1/messages') == '/v1/messages')
    sanj('مسیرِ پروکسی دست‌نخورده', g.masir_baznevisi('openrouter', '/v1/messages') == '/v1/messages')

    # گزارش
    bad = [n for n, ok in NATIJE if not ok]
    for nom, ok in NATIJE:
        print(('✅ ' if ok else '❌ ') + nom)
    print(f'\nجمع: {len(NATIJE)} · سبز: {len(NATIJE) - len(bad)} · قرمز: {len(bad)}')
    return 0 if not bad else 1


if __name__ == '__main__':
    sys.exit(main())
