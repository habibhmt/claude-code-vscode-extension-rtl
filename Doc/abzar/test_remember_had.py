#!/usr/bin/env python3
"""آزمونِ آستانهٔ «حدس» (تعریف ۳۰، بندِ ۲) — روی کدِ واقعیِ ۲۰۳، بی نوشتن در آن پروژه.

سه چیز سنجیده می‌شود:
  ۱ خالی بودنِ انبار ⇒ آستانهٔ پیش‌فرض ۲۸۰٬۰۰۰ (نه سکوت)
  ۲ پنجرهٔ سراسری و پوشه‌ای ⇒ آستانه از همان پنجره: پنجره − ۳۳٬۰۰۰ − ۲۰٬۰۰۰
  ۳ پنجرهٔ کوچک ⇒ کفِ had_kamtarin_yad_avari_token، نه عددِ منفی

اجرا: python3 Doc/abzar/test_remember_had.py
خرابکاری: had_kamtarin_yad_avari_token را صفر کن یا «برنده» را عوض کن ⇒ باید قرمز بدهد.
"""
import importlib.util
import json
import os
import pathlib
import sys
import tempfile

BAZAR = pathlib.Path.home() / '1-MY-WORK/203th-day-imac-cpu-tracker/doc/abzar'
sys.path.insert(0, str(BAZAR))


def load_hook():
    spec = importlib.util.spec_from_file_location('hook', BAZAR / 'hook_remember_pish.py')
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def tanzimat(sarasari=None, poshe=None, chat=None):
    """انبارِ تنظیماتِ ساختگی در قالبِ خودِ crtl_tanzimat.json (v + t)."""
    d = {'sarasari': {}, 'poshe': {}, 'chat': {}}
    if sarasari:
        d['sarasari']['autoCompactWindow'] = {'v': sarasari, 't': 1}
    if poshe:
        for path, (v, t) in poshe.items():
            d['poshe'][path] = {'autoCompactWindow': {'v': v, 't': t}}
    return d


def had(mod, store, cwd='/tmp/x'):
    with tempfile.NamedTemporaryFile('w', suffix='.json', delete=False) as f:
        json.dump(store, f)
        path = f.name
    os.environ['CRTL_TANZIMAT'] = path
    os.environ.pop('RP_HAD', None)
    try:
        return mod.had_chat({'session_id': 'sid', 'cwd': cwd})
    finally:
        os.unlink(path)


def main():
    mod = load_hook()
    bad = 0

    def check(name, got, want):
        nonlocal bad
        ok = got == want
        bad += not ok
        print(f"{'PASS' if ok else 'FAIL'} {name}: {got} (انتظار {want})")

    check('۱ انبارِ خالی ⇒ پیش‌فرض', had(mod, tanzimat()), 280_000)
    check('۲ فقط سراسری ۵۰۰k', had(mod, tanzimat(sarasari=500_000)), 500_000 - 53_000)
    check('۲ سراسری ۲۳۳k', had(mod, tanzimat(sarasari=233_000)), 233_000 - 53_000)
    check('۲ پوشهٔ تازه‌تر برنده (۵۳۳k)', had(mod, tanzimat(
        sarasari=233_000,
        poshe={'/tmp/x': (533_000, 2)})), 533_000 - 53_000)
    check('۲ پوشهٔ کهنه‌تر می‌بازد', had(mod, tanzimat(
        sarasari=233_000,
        poshe={'/tmp/x': (533_000, 0)})), 233_000 - 53_000)
    check('۳ پنجرهٔ کوچک ⇒ کفِ ۳۰٬۰۰۰', had(mod, tanzimat(sarasari=40_000)), 30_000)
    print('جمع:', 'سبز' if not bad else f'{bad} قرمز')
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main())
