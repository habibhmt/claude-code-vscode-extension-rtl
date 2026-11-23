#!/usr/bin/env python3
"""آزمونِ مدل و هزینهٔ رممبر (تعریف ۳۰، بندِ ۳ و ۴).

مدل: از محیطِ همان چت (`ANTHROPIC_MODEL`) یا `REMEMBER_MODEL`؛ نیست ⇒ هیچ `--model`ی
فرستاده نمی‌شود (نه برگشت به haiku).
هزینه: از `list_cost`ِ ردیفِ دروازه با امضای توکن؛ پیدا نشد ⇒ None («—»).

اجرا: python3 Doc/abzar/test_remember_model_cost.py
خرابکاری: کلیدِ تطبیق را عوض کن یا مدلِ پیش‌فرضِ haiku را برگردان ⇒ باید قرمز بدهد.
"""
import json
import os
import pathlib
import sys
import tempfile

PLUGIN = pathlib.Path.home() / '.claude/plugins-local/remember-habib'
sys.path.insert(0, str(PLUGIN))

TMP = tempfile.mkdtemp()
GATE = pathlib.Path(TMP) / 'usage.jsonl'
GATE.write_text('\n'.join(json.dumps(r) for r in [
    {'input': 5726, 'cache_read': 8192, 'output': 163, 'list_cost': 0.00098},
    {'input': 1000, 'cache_read': 0, 'output': 50, 'list_cost': 0.00021},
    {'input': 1000, 'cache_read': 0, 'output': 50, 'list_cost': 0.00019},
]) + '\n')
os.environ['REMEMBER_MASIR_FILE_MASRAF'] = str(GATE)

from pipeline import haiku  # noqa: E402  (بعد از ست‌کردنِ مسیرِ فایلِ ساختگی)


def main():
    bad = 0

    def check(name, got, want):
        nonlocal bad
        ok = got == want
        bad += not ok
        print(f"{'PASS' if ok else 'FAIL'} {name}: {got!r} (انتظار {want!r})")

    saved = {k: os.environ.get(k) for k in ('REMEMBER_MODEL', 'ANTHROPIC_MODEL')}

    def env(**kw):
        for k in ('REMEMBER_MODEL', 'ANTHROPIC_MODEL'):
            os.environ.pop(k, None)
        os.environ.update({k: v for k, v in kw.items() if v is not None})

    env(REMEMBER_MODEL='model-x', ANTHROPIC_MODEL='model-chat')
    check('۳ REMEMBER_MODEL مقدم', haiku.model_ha_ye_chat(), 'model-x')
    env(ANTHROPIC_MODEL='deepseek-v4.1-flash')
    check('۳ مدلِ چت', haiku.model_ha_ye_chat(), 'deepseek-v4.1-flash')
    env()
    check('۳ بدونِ محیط ⇒ None', haiku.model_ha_ye_chat(), None)
    check('۳ بی‌مدل ⇒ `--model` در فرمان نیست',
          '--model' in haiku._build_cmd(None, True), False)

    check('۴ امضای دقیق', haiku.kharj_az_row_darvaze(5726, 163, 8192), 0.00098)
    check('۴ دو ردیفِ هم‌امضا جمع می‌شوند', haiku.kharj_az_row_darvaze(1000, 50, 0), 0.0004)
    check('۴ امضای ناشناس ⇒ None', haiku.kharj_az_row_darvaze(1, 1, 1), None)
    old = haiku.masir_file_masraf
    haiku.masir_file_masraf = str(pathlib.Path(TMP) / 'nabashad.jsonl')
    check('۴ فایل نبود ⇒ None', haiku.kharj_az_row_darvaze(5726, 163, 8192), None)
    haiku.masir_file_masraf = old

    usage = haiku._extract_tokens({'usage': {'input_tokens': 5726,
                                             'output_tokens': 163,
                                             'cache_read_input_tokens': 8192}})
    check('۴ هزینهٔ TokenUsage = دروازه', usage.cost_usd, 0.00098)
    check('۴ نمایش با —', str(haiku._extract_tokens({'usage': {'input_tokens': 7}})),
          '7+0cache->0out (—)')

    for k, v in saved.items():
        if v is None:
            os.environ.pop(k, None)
        else:
            os.environ[k] = v
    print('جمع:', 'سبز' if not bad else f'{bad} قرمز')
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main())
