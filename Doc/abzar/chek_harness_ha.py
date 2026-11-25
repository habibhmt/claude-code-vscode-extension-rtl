#!/usr/bin/env python3
"""سنجشِ اصولیِ همهٔ اپ‌ها و هارنس‌ها — پیش از آنکه خطا به حبیب برسد.

حبیب ۲۵ نوامبر ۲۰۲۶ ۱۳:۲۵ «چرا یه کار اصولی نمیکنی» · ۱۳:۲۸ «کار اصولی برای همه
پرووایدر ها همه اپ ها» + نام‌بردنِ خودش: دیپ‌سیک هارنس · هرمس دسکتاپ · هرمس وب ·
اوپن کد دسکتاپ · اوپن کد اکستنشنِ VS Code.

برای **هر** اپ دو چیز سنجیده می‌شود — چون دو جور خطا داریم:

  الف) اپی که **از دروازهٔ ما رد می‌شود**: نامِ پرووایدرش رزروشده نباشد، آدرسش
       `50990` باشد، و سرآیندِ `X-Harness` بفرستد.
  ب) اپی که از دروازه رد **نمی‌شود**: این عیب نیست، ولی باید **صریح معلوم** باشد
       که پولش کجا می‌رود — نه اینکه بی‌خبر از جای دیگری هزینه کند.

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

NAMAYE_REZERV = {'opencode', 'zen', 'claude', 'claude-code', 'qwen-portal', 'qwen-cli',
                 'hf', 'huggingface', 'aigateway', 'vercel'}
PORTE_DARVAZE = '50990'
HELP = __doc__


def khane(m):
    return os.path.expanduser(m)


def khandan(m):
    try:
        return open(khane(m), encoding='utf-8', errors='replace').read()
    except OSError:
        return None


def yaftan(t, *pat):
    for p in pat:
        mm = re.search(p, t, re.M)
        if mm:
            return mm.group(1)
    return None


# ── الف) اپ‌هایی که از دروازه رد می‌شوند ──────────────────────────────────────

def hermes_cli():
    t = khandan('~/.hermes/config.yaml')
    if t is None:
        return ['~/.hermes/config.yaml نیست'], {}
    bad = []
    m = re.search(r'^model:\s*\n((?:  .*\n)+)', t, re.M)
    if not m:
        return ['بلوکِ model پیدا نشد'], {}
    blok = m.group(1)
    prov = yaftan(blok, r'^  provider:\s*(\S+)')
    addr = yaftan(blok, r'^  base_url:\s*(\S+)')
    key = yaftan(blok, r'^  key_env:\s*(\S+)')
    if prov in NAMAYE_REZERV:
        bad.append(f'نامِ رزروشده در model.provider: «{prov}» ⇒ هرمس به سرویسِ خودش می‌برد (۴۰۱)')
    if addr and PORTE_DARVAZE not in addr:
        bad.append(f'آدرس دروازه نیست: {addr}')
    if addr and PORTE_DARVAZE in addr:
        envt = khandan('~/.hermes/.env') or ''
        if not key:
            bad.append('از دروازه رد می‌شود ولی key_env ندارد')
        elif key not in envt and key not in os.environ:
            bad.append(f'کلیدِ محیطی تعریف نشده: {key}')
    return bad, {'provider': prov, 'base_url': addr}


def hermes_desktop():
    """اپِ دسکتاپ و وب همان `~/.hermes/config.yaml` را می‌خوانند."""
    bad, info = hermes_cli()
    if not os.path.exists(khane('/Applications/Hermes.app')):
        return ['Hermes.app نصب نیست'], info
    return [b for b in bad], {**info, 'manba': 'همان config.yaml'}


def hermes_web():
    import urllib.request
    try:
        with urllib.request.urlopen('http://127.0.0.1:7711/', timeout=5) as r:
            code = r.status
    except Exception:
        code = 0
    return ([] if code == 200 else [f'داشبورد ۷۷۱۱ جواب نمی‌دهد (کد {code})']), {'http': code}


def claude_code():
    t = khandan('~/.claude/claude_env.sh')
    if t is None:
        return ['~/.claude/claude_env.sh نیست'], {}
    addr = yaftan(t, r'ANTHROPIC_BASE_URL="?([^"\n]+)"?')
    bad = []
    if addr and PORTE_DARVAZE not in addr:
        bad.append(f'آدرس دروازه نیست: {addr}')
    if 'X-Harness' not in t:
        bad.append('سرآیندِ X-Harness نیست ⇒ دروازه ۴۰۰ می‌دهد')
    return bad, {'base_url': addr}


def claude_extension():
    """اکستنشنِ VS Code همان محیط را از `claude_env.sh` می‌گیرد."""
    bad, info = claude_code()
    d = khane('~/.vscode/extensions')
    dirs = [x for x in os.listdir(d) if x.startswith('anthropic.claude-code')] if os.path.isdir(d) else []
    if not dirs:
        return ['اکستنشنِ کلود کد در VS Code نصب نیست'], info
    return bad, {**info, 'afzune': dirs[0]}


# ── ب) اپ‌هایی که از دروازه رد نمی‌شوند (باید مسیرِ پول صریح باشد) ────────────

def opencode_cli():
    t = khandan('~/.local/bin/opencode')
    if t is None:
        return ['~/.local/bin/opencode نیست'], {}
    if 'OPENROUTER_API_KEY' in t:
        return [], {'masir_pool': 'openrouter'}
    if 'opencode.ai' in t:
        return [], {'masir_pool': 'opencode.ai'}
    return ['مسیرِ پولش معلوم نیست (نه OpenRouter نه opencode.ai)'], {}


def opencode_desktop():
    if not os.path.exists(khane('/Applications/OpenCode.app')):
        return ['OpenCode.app نصب نیست'], {}
    c = khane('~/.config/opencode')
    if not os.path.isdir(c):
        return ['~/.config/opencode نیست'], {}
    if any(PORTE_DARVAZE in (khandan(os.path.join(c, f)) or '')
           for f in os.listdir(c) if os.path.isfile(os.path.join(c, f))):
        return [], {'masir_pool': 'دروازهٔ ما'}
    return [], {'masir_pool': 'مستقیم (از دروازهٔ ما رد نمی‌شود — معلوم و صریح)'}


def opencode_extension():
    d = khane('~/.vscode/extensions')
    dirs = [x for x in os.listdir(d) if x.startswith('sst-dev.opencode')] if os.path.isdir(d) else []
    if not dirs:
        return ['اکستنشنِ اوپن کد در VS Code نصب نیست'], {}
    return [], {'afzune': dirs[0], 'masir_pool': 'با CLIِ اوپن کد یکی است'}


def codex():
    t = khandan('~/.codex/config.toml')
    if t is None:
        return ['~/.codex/config.toml نیست'], {}
    model = yaftan(t, r'^model\s*=\s*"([^"]+)"')
    return ([] if model else ['مدل تعیین نشده']), {'model': model}


def dsh():
    bad, info = [], {}
    cred = khandan('~/.dsh/.credentials.yaml')
    if cred is None:
        bad.append('~/.dsh/.credentials.yaml نیست')
    else:
        info['credentials'] = 'deepseek-account-platform' if 'deepseek-account-platform' in cred else '—'
        if info['credentials'] == '—':
            bad.append('حسابِ پیش‌فرضِ دیپ‌سیک پیدا نشد')
    env = khandan('~/.dsh/.env') or ''
    info['openrouter'] = 'OPENROUTER_API_KEY' in env
    if not info['openrouter']:
        bad.append('کلیدِ جانشینِ OpenRouter تعریف نشده')
    return bad, {**info, 'masir_pool': 'حسابِ دیپ‌سیک (از دروازهٔ ما رد نمی‌شود)'}


def dsh_fork():
    p = khane('/Applications/DeepSeek Harness (fork).app')
    if not os.path.exists(p):
        return ['DeepSeek Harness (fork).app نصب نیست'], {}
    return [], {'manba': 'همان ~/.dsh'}


def ori():
    t = khandan('~/.ori/config.json')
    if t is None:
        return ['~/.ori/config.json نیست'], {}
    mode = yaftan(t, r'"loginMode"\s*:\s*"([^"]+)"')
    return ([] if mode else ['loginMode ندارد']), {'loginMode': mode}


def cursor():
    t = khandan('~/.cursor/cli-config.json')
    if t is None:
        return ['~/.cursor/cli-config.json نیست'], {}
    model = yaftan(t, r'"modelId"\s*:\s*"([^"]+)"')
    return ([] if model else ['modelId ندارد']), {'modelId': model}


HARNESS_HA = [
    ('کلود کد CLI', claude_code),
    ('کلود کد اکستنشن', claude_extension),
    ('هرمس CLI', hermes_cli),
    ('هرمس دسکتاپ', hermes_desktop),
    ('هرمس وب', hermes_web),
    ('اوپن کد CLI', opencode_cli),
    ('اوپن کد دسکتاپ', opencode_desktop),
    ('اوپن کد اکستنشن', opencode_extension),
    ('دیپ‌سیک هارنس', dsh),
    ('دیپ‌سیک فورک', dsh_fork),
    ('codex', codex),
    ('ori', ori),
    ('cursor', cursor),
]


def main():
    args = sys.argv[1:]
    if '--help' in args or '-h' in args:
        print(HELP)
        return 0
    natije, kol = {}, 0
    for nom, tabe in HARNESS_HA:
        bad, info = tabe()
        natije[nom] = {'bad': bad, **info}
        kol += len(bad)
    if '--json' in args:
        print(json.dumps({'harness': natije, 'bad': kol}, ensure_ascii=False, indent=1))
        return 0 if not kol else 1
    for nom, _ in HARNESS_HA:
        d = dict(natije[nom])
        bad = d.pop('bad', [])
        vasf = ' · '.join(f'{k}={v}' for k, v in d.items()) or '—'
        print(('❌ ' if bad else '✅ ') + f'{nom:20s} {vasf}')
        for b in bad:
            print('       ' + b)
    print(f'\nجمعِ ایرادها: {kol}' + ('' if kol else ' — همهٔ اپ‌ها و هارنس‌ها سالم'))
    return 0 if not kol else 1


if __name__ == '__main__':
    sys.exit(main())
