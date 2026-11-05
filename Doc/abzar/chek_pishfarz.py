#!/usr/bin/env python3
"""Do the defaults the settings tab shows still hold on this Claude Code version?
Habib's window, 5 Nov: fix the side agent's point that the tab's defaults could go stale with no notice.
Each default is checked against the app's own schema text, or else against the engine's code.
All equal: writes ~/.claude/crtl_pish_sanjide.json, and the tab stops saying «این نسخه سنجیده نشده».
  python3 Doc/abzar/chek_pishfarz.py [--ext <extension folder>] [--bi-mohr]
"""
import glob, json, os, re, sys

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MOHR = os.path.join(os.environ.get('CLAUDE_CONFIG_DIR') or os.path.expanduser('~/.claude'), 'crtl_pish_sanjide.json')


def be_maghdar(x):
    if x in ('true', 'on'):
        return True
    if x in ('false', 'off'):
        return False
    try:
        return float(x) if '.' in x else int(x)
    except ValueError:
        return x


# the same patterns as pishAzShema in claude-host-hook.js
SHEMA_RE = [
    r'\(defaults?:?\s+(?:to\s+)?["\']?([\w\-]+(?:\.\d+)?)',
    r'\bDefaults? to ["\'`]?([\w\-]+(?:\.\d+)?)',
    r'\bDefault:\s*([\w\-]+(?:\.\d+)?)',
    r'["\']([\w\-]+(?:\.\d+)?)["\'] \((?:the )?default\b',
    r'\b(\d+) \(the default\)',
    r'\bWhen absent or (true|false)\b',
    r'\bUnset defaults to (on|off)\b',
    r'\bDefault (on|off)\b',
]


def pish_az_shema(desc):
    for p in SHEMA_RE:
        m = re.search(p, desc or '')
        if m:
            return be_maghdar(m.group(1))
    return None


def dar_motor(bin_bytes, k, v):
    """The engine's minified code spells a default in a few ways; each is a literal search."""
    if v is True:
        la = [k + '??!0', k + ':!0', k + '!==!1', k + '===!1', k + '!==void 0)return e.' + k + ';return!0', 'gi("' + k + '",!0)']
    elif v is False:
        la = [k + '??!1', k + ':!1', k + '===!0', k + ')===!0', 'gi("' + k + '",!1)']
    else:
        la = [k + ':"' + str(v) + '"', k + '??"' + str(v) + '"']
    return any(x.encode() in bin_bytes for x in la)


def main():
    a = sys.argv[1:]
    ext = a[a.index('--ext') + 1] if '--ext' in a else None
    if ext is None:
        ha = sorted(glob.glob(os.path.expanduser('~/.vscode/extensions/anthropic.claude-code-*-darwin-arm64')),
                    key=lambda p: [int(x) if x.isdigit() else 0 for x in re.split(r'[.-]', os.path.basename(p))])
        ext = ha[-1] if ha else ''
    sh = os.path.join(ext, 'claude-code-settings.schema.json')
    if not os.path.isfile(sh):
        print('## پیش‌فرض‌های تب تنظیمات\n\nسنجیده نشد: افزونه پیدا نشد.')
        return 0
    noskhe = json.load(open(os.path.join(ext, 'package.json'), encoding='utf-8')).get('version', '')
    props = json.load(open(sh, encoding='utf-8')).get('properties', {})
    data = json.load(open(os.environ.get('TOZIH_JSON') or os.path.join(REPO, 'claude-tanzimat-tozih.json'), encoding='utf-8'))
    with open(os.path.join(ext, 'resources/native-binary/claude'), 'rb') as f:
        motor = f.read()
    farq, az_shema, az_motor = [], 0, 0
    for k, e in data.items():
        if 'pish' not in e:
            continue
        z = pish_az_shema(props.get(k, {}).get('description'))
        if z is not None:
            az_shema += 1
            if z != e['pish']:
                farq.append((k, e['pish'], z, 'راهنمای برنامه'))
        elif dar_motor(motor, k, e['pish']):
            az_motor += 1
        else:
            farq.append((k, e['pish'], 'پیدا نشد', 'کد موتور'))
    print(f'## پیش‌فرض‌های تب تنظیمات (نسخهٔ {noskhe})\n')
    print(f'| سنجش | تعداد |\n|---|---|\n| برابر با راهنمای برنامه | {az_shema} |\n| برابر با کد موتور | {az_motor} |\n| فرق دارد یا پیدا نشد | {len(farq)} |\n')
    if farq:
        print('| تنظیم | عدد تب | عدد این نسخه | منبع |\n|---|---|---|---|')
        for k, v, z, m in farq:
            print(f'| `{k}` | {v} | {z} | {m} |')
    elif '--bi-mohr' not in a:
        with open(MOHR, 'w', encoding='utf-8') as f:
            json.dump({'noskhe': noskhe}, f)
    return 0


if __name__ == '__main__':
    sys.exit(main())
