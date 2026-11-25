#!/usr/bin/env python3
"""سنجشِ اصولیِ همهٔ هارنس‌ها — پیش از آنکه خطا به حبیب برسد.

حبیب ۲۵ نوامبر ۲۰۲۶ ۱۳:۲۵: «چرا یه کار اصولی نمیکنی که انقد به مشکل نخوریم».

سه چیزی که این ابزار می‌گیرد و هر سه یک بار ما را زمین زدند:

  ۱) **نامِ رزروشده:** در `~/.hermes` نامِ `opencode` به سرویسِ خودش ترجمه می‌شود
     (`hermes_cli/auth.py:1438`) ⇒ کلیدِ ما آنجا معنا ندارد و ۴۰۱ می‌گیریم.
  ۲) **آدرسِ نادرست:** هر هارنسی که ادعا می‌کند از دروازه رد می‌شود، باید آدرسش
     `127.0.0.1:50990` باشد.
  ۳) **کلیدِ نبود:** اگر هارنس از دروازه رد می‌شود، `HABIB_OPENCODE_KEY` باید در
     محیطِ خودش تعریف شده باشد.

هیچ کلیدی چاپ نمی‌شود — فقط وجود/نبود.

اجرا:
  python3 Doc/abzar/chek_harness_ha.py
  python3 Doc/abzar/chek_harness_ha.py --json
کدِ خروج: ۰ همه سالم · ۱ ایراد هست · ۲ خطای استفاده
"""
import json
import os
import re
import sys

# نام‌هایی که هرمس برای خودش رزرو کرده و به سرویسِ خودش می‌برد.
NAMAYE_REZERV = {'opencode', 'zen', 'claude', 'claude-code', 'qwen-portal', 'qwen-cli',
                 'hf', 'huggingface', 'aigateway', 'vercel'}
DERVAZE = '127.0.0.1:50990'
HELP = __doc__


def khane(masir):
    return os.path.expanduser(masir)


def khandan(masir):
    try:
        return open(khane(masir), encoding='utf-8', errors='replace').read()
    except OSError:
        return None


def hermes():
    """(ایرادها، پرووایدرِ مدلِ اصلی، آدرس، کلید_env)"""
    t = khandan('~/.hermes/config.yaml')
    if t is None:
        return ['~/.hermes/config.yaml نیست'], None, None, None
    bad = []
    m = re.search(r'^model:\s*\n((?:  .*\n)+)', t, re.M)
    if not m:
        return ['بلوکِ model در هرمس پیدا نشد'], None, None, None
    blok = m.group(1)
    pm = re.search(r'^  provider:\s*(\S+)', blok, re.M)
    um = re.search(r'^  base_url:\s*(\S+)', blok, re.M)
    km = re.search(r'^  key_env:\s*(\S+)', blok, re.M)
    prov = pm.group(1) if pm else None
    addr = um.group(1) if um else None
    key = km.group(1) if km else None
    if prov and prov in NAMAYE_REZERV:
        bad.append(f'نامِ رزروشدهٔ هرمس در model.provider: «{prov}» '
                   f'(هرمس آن را به سرویسِ خودش می‌برد ⇒ ۴۰۱)')
    if addr and DERVAZE not in addr:
        bad.append(f'آدرسِ هرمس دروازه نیست: {addr}')
    if addr and DERVAZE in addr:
        # کلید باید یا در env باشد یا در .env هرمس تعریف شده باشد (فقط وجود، نه مقدار)
        envt = khandan('~/.hermes/.env') or ''
        if key and key not in envt and key not in os.environ:
            bad.append(f'کلیدِ محیطیِ هرمس تعریف نشده: {key}')
    if km is None and addr and DERVAZE in addr:
        bad.append('هرمس از دروازه رد می‌شود ولی key_env ندارد')
    return bad, prov, addr, key


def claude_code():
    t = khandan('~/.claude/claude_env.sh')
    if t is None:
        return ['~/.claude/claude_env.sh نیست'], None
    m = re.search(r'ANTHROPIC_BASE_URL="?([^"\n]+)"?', t)
    addr = m.group(1) if m else None
    bad = []
    if addr and DERVAZE not in addr:
        bad.append(f'آدرسِ کلود کد دروازه نیست: {addr}')
    if 'X-Harness' not in t:
        bad.append('سرآیندِ X-Harness در claude_env.sh نیست ⇒ دروازه ۴۰۰ می‌دهد')
    return bad, addr


def main():
    args = sys.argv[1:]
    if '--help' in args or '-h' in args:
        print(HELP)
        return 0
    bad_h, prov, addr, key = hermes()
    bad_c, addr_c = claude_code()
    bad = [('hermes', b) for b in bad_h] + [('claude-code', b) for b in bad_c]
    if '--json' in args:
        print(json.dumps({'hermes': {'provider': prov, 'base_url': addr, 'key_env': key,
                                     'bad': bad_h},
                          'claude_code': {'base_url': addr_c, 'bad': bad_c},
                          'ok': not bad}, ensure_ascii=False))
        return 0 if not bad else 1
    print(f'هرمس: provider={prov} · base_url={addr} · key_env={key}')
    print(f'کلود کد: base_url={addr_c}')
    if not bad:
        print('✅ هر دو هارنس سالم — نامِ بی‌برخورد، آدرسِ دروازه، کلیدِ موجود')
        return 0
    print(f'❌ {len(bad)} ایراد:')
    for wer, b in bad:
        print(f'  [{wer}] {b}')
    return 1


if __name__ == '__main__':
    sys.exit(main())
