#!/usr/bin/env python3
"""چشمِ نامِ بازنشسته — هشت جا را می‌گردد؛ اگر حتی یک ارجاع مانده باشد قرمز.

چرا: حادثهٔ ۲۴ نوامبر ۲۰۲۶ (rename 216-migration ⇒ darvaze) دروازه را کشت،
سشن را قطع کرد و چتِ VS Code را سه بار شکست، چون فهرستِ ارجاع‌ها دستی و ناقص بود.
حبیب ۰۶:۴۸: «بله، هر پنج بند + شش نام».

گشت بر پایهٔ **محتوا** است، نه پسوند: هر فایلِ متنی (بی بایتِ صفر) گشته می‌شود —
.md .py .sh .js .json .toml .plist .yaml .zsh `.txt` و هر پسوندِ دیگر؛ فایلِ دودویی نه.

اجرا:
  python3 Doc/abzar/chek_nam_kohne.py            # هر هشت جا
  python3 Doc/abzar/chek_nam_kohne.py --repo-only
نکتهٔ اندازه‌گیری: کدِ خروج را **بدونِ لوله** بخوان
  (python3 … | tail -2; echo $? ⇒ کدِ tail است، نه ابزار).
کدِ خروج: ۰ = هیچ ارجاعی نمانده · ۱ = ارجاع مانده · ۲ = خطای اجرا
"""
import json
import os
import plistlib
import re
import subprocess
import sys

_RISHE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
nam_kohne_ha = '216-migration 186-montaghel'
masir_darvaze = 'abzar/darvaze'
# سندهایی که ذکرِ نامِ قدیمی در آن‌ها **خودِ درس** است، نه ارجاعِ زنده.



def mojaz_snd():
    """سندهایی که ذکرِ نامِ قدیمی در آن‌ها خودِ درس است، نه ارجاعِ زنده."""
    return {
        'Doc/tarif/39_gozaresh_hadese_rename_v1.md',
        'Doc/tarif/40_prop_pishgiri_rename_v1.md',
        'Doc/tarif/41_tarif_chek_nam_kohne_v1.md',
        'Doc/tarif/42_tarif_restart_service_v1.md',
        'Doc/tarif/43_tarif_chek_service_ha_v1.md',
        'Doc/tarif/44_tarif_rename_ba_check_v1.md',
        'Doc/tarif/45_tarif_salamat_va_esmha_v1.md',
        'Doc/esm_pishnahadi.md',
        'Doc/abzar/chek_nam_kohne.py',
        # فایل‌هایی که **باید** نامِ قدیمی را داشته باشند: خودِ فهرستِ ارزش،
        # جدول/برگهٔ ساخته‌شده از آن، و فراخوانیِ آزمونِ دروازه.
        'barge/barge.toml',
        'Doc/shenasname_motaghayerha.toml',
        'Doc/jadval_motaghayerha.md',
        'Doc/vazhename_takhte.md',
        'test_all.sh',
    }


def _hit(lines, name, src):
    return [(src, i, l.strip()[:120]) for i, l in enumerate(lines, 1) if name in l]


def khane_repo():
    out = []
    try:
        tracked = subprocess.run(['git', '-C', _RISHE, 'ls-files'], capture_output=True, text=True, check=True).stdout.split()
        untracked = subprocess.run(['git', '-C', _RISHE, 'ls-files', '--others', '--exclude-standard'],
                                   capture_output=True, text=True).stdout.split()
        names = tracked + untracked
    except Exception as e:
        return [('<git ls-files>', 0, f'خطا: {e}')]
    for rel in names:
        if rel in mojaz_snd():
            continue
        p = os.path.join(_RISHE, rel)
        try:
            head = open(p, 'rb').read(8192)
        except OSError:
            continue
        if b'\0' in head:            # فایلِ دودویی، نه متن
            continue
        try:
            lines = open(p, encoding='utf-8', errors='replace').read().splitlines()
        except OSError:
            continue
        for n in nam_kohne_ha.split():
            out += _hit(lines, n, rel)
    return out


def khane_json(masir, label):
    p = os.path.expanduser(masir)
    if not os.path.exists(p):
        return []
    try:
        text = open(p, encoding='utf-8', errors='replace').read().splitlines()
    except OSError:
        return []
    out = []
    for n in nam_kohne_ha.split():
        out += _hit(text, n, label)
    return out


def khane_text(masir, label, only_exec=False):
    p = os.path.expanduser(masir)
    if not os.path.exists(p):
        return []
    out = []
    for i, l in enumerate(open(p, encoding='utf-8', errors='replace').read().splitlines(), 1):
        if only_exec and 'exec' not in l:
            continue
        for n in nam_kohne_ha.split():
            if n in l:
                out.append((label, i, l.strip()[:120]))
    return out


def khane_dirs(root, label):
    out = []
    root = os.path.expanduser(root)
    for dp, dn, fn in os.walk(root):
        dn[:] = [d for d in dn if d != '__pycache__']
        for f in fn:
            if f.endswith('.pyc'):
                continue
            p = os.path.join(dp, f)
            try:
                lines = open(p, encoding='utf-8', errors='replace').read().splitlines()
            except OSError:
                continue
            for n in nam_kohne_ha.split():
                out += _hit(lines, n, f'{label}:{os.path.relpath(p, root)}')
    return out


def khane_plist():
    out = []
    d = os.path.expanduser('~/Library/LaunchAgents')
    if not os.path.isdir(d):
        return out
    for f in sorted(os.listdir(d)):
        if not f.endswith('.plist'):
            continue
        p = os.path.join(d, f)
        try:
            data = plistlib.load(open(p, 'rb'))
        except Exception:
            continue
        text = json.dumps(data, ensure_ascii=False, default=str)
        for n in nam_kohne_ha.split():
            if n in text:
                out.append((f'LaunchAgents/{f}', 0, n))
    return out


def main():
    if '--help' in sys.argv or '-h' in sys.argv:
        print(__doc__)
        return 0
    repo_only = '--repo-only' in sys.argv
    hits = khane_repo()
    if not repo_only:
        hits += khane_json('~/Library/Application Support/Code/User/settings.json', 'Code/settings.json')
        hits += khane_json('~/Library/Application Support/Windsurf/User/settings.json', 'Windsurf/settings.json')
        hits += khane_json('~/.claude.json', '~/.claude.json')
        hits += khane_json('~/.claude/settings.json', '~/.claude/settings.json')
        hits += khane_dirs('~/.claude/plugins-local', 'plugins-local')
        hits += khane_plist()
        hits += khane_text('~/.zshrc', '~/.zshrc')
        for f in sorted(os.listdir(os.path.expanduser('~/.claude'))):
            if f.endswith('.sh'):
                hits += khane_text(f'~/.claude/{f}', f'~/.claude/{f}', only_exec=True)
    if hits:
        print(f'❌ {len(hits)} ارجاعِ نامِ قدیمی:')
        for src, i, line in hits[:60]:
            print(f'   {src}:{i}  {line}')
        print(f'جاهای گشته‌شده: {8 if not repo_only else 1} · نام‌ها: {", ".join(nam_kohne_ha.split())} · مسیرِ درست: {masir_darvaze}')
        return 1
    print(f'✅ {"یک" if repo_only else "هشت"} جا گشته شد — هیچ ارجاعی از {", ".join(nam_kohne_ha.split())} نمانده')
    return 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except Exception as e:                     # noqa: BLE001 — کدِ خروجِ روشن برای زنجیره
        print(f'❌ خطای اجرا: {e}')
        sys.exit(2)
