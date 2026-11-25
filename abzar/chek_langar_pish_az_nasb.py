#!/usr/bin/env python3
"""پیش از نصب: پچِ RTL را روی نسخهٔ تازه، بی‌نصب، خشک می‌زند.

چرا (حبیب ۲۵ نوامبر ۲۰۲۶ ۲۰:۱۵ و ۲۱:۰۱): هر بار نسخهٔ تازهٔ افزونه می‌آید،
مینیفای‌کر نام‌ها را عوض می‌کند و لنگرِ یکی از چهار پچ می‌شکند. تا امروز این
فقط *بعد از* نصب فهمیده می‌شد و آن هم به شکلِ نصفه: بخشی از پچ می‌نشست و
یک `[WARN]` در لاگ می‌ماند (۲۵ نوامبر: `patch_deepseek_models.py` با
«model schema anchor changed» می‌مرد و فهرستِ مدلِ اوپن‌روتر از مدل‌پیکر
می‌رفت). این ابزار همان vsixِ رسمی را در پوشهٔ موقت باز می‌کند، همان کدِ
تولیدی را رویش می‌زند و اگر هر نشانگری کم آمد، قرمز می‌دهد — بی‌آنکه چیزی
نصب شود.

مهم: هیچ منطقِ پچی اینجا تکرار نشده. بلوک‌های پایتون از خودِ
`fix-rtl-claude.sh` برداشته و اجرا می‌شوند و دو اسکریپتِ پچ هم import
می‌شوند، تا آزمون و تولید هرگز از هم جدا نیفتند.

    python3 abzar/chek_langar_pish_az_nasb.py --vsix /path/to/cc.vsix
    python3 abzar/chek_langar_pish_az_nasb.py            # آخرین نسخهٔ رسمی را خودش می‌گیرد
    python3 abzar/chek_langar_pish_az_nasb.py --version 2.1.332 --keep

کدِ خروج: ۰ = همهٔ لنگرها نشست · ۱ = یکی شکست · ۲ = نتوانست vsix را بگیرد.
"""
import argparse
import importlib.util
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import urllib.request
import zipfile
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
FIX_SH = REPO / 'fix-rtl-claude.sh'
PATCH_SELECTOR = REPO / 'abzar/darvaze/scripts/patch_deepseek_models.py'
PATCH_GROUPS = REPO / 'abzar/darvaze/scripts/patch_model_groups.py'

# نشانگرهایی که بعد از پچ باید در باندل باشند. عدد، دقیقاً همان چیزی است که
# پچِ سالم تولید می‌کند؛ «>۰» فقط وجود را می‌سنجد.
EXT_MARKERS = {
    'crtl-panel': ('>0', 'دکمه‌ها و پنل'),
    '__crtl_khat_hook': ('>=1', 'خطِ هوک‌ها در چت'),
    '__crtl_hook_tarikhche': ('>=1', 'هوک‌ها بعد از ریلود'),
    '__crtl_baz_shodan': ('>=1', 'تبِ «تنظیمات کلود» — اجرا'),
    '__crtl_kanal_taze': ('>=1', 'کانالِ تازه'),
    '__crtl_menu_chat': ('>=1', 'منوی مدل/افورت فقط برای همین چت'),
    '__crtlHistoryLaunch': ('>=1', 'تاریخچهٔ چت‌ها'),
    'project216-deepseek-models': ('>=1', 'فهرستِ مدلِ اوپن‌روتر'),
}
IDX_MARKERS = {
    'crtl-ans-preview': ('>=1', 'جدولِ گزینه‌ها بعد از جواب'),
    '__crtl_sessions': ('>=1', 'برچسب‌های تنظیمات'),
    '"ccgh"+': ('>=1', 'سرآیندِ پرووایدر در مدل‌پیکر'),
    '"ccgf"+': ('>=1', 'سرآیندِ خانوادهٔ مدل'),
}


def ok(rule, value):
    m = re.fullmatch(r'(>=|==|>)(\d+)', rule)
    if not m:
        raise ValueError('bad rule ' + rule)
    op, n = m.group(1), int(m.group(2))
    return {'>': value > n, '>=': value >= n, '==': value == n}[op]


def latest_version():
    with urllib.request.urlopen('https://open-vsx.org/api/anthropic/claude-code', timeout=30) as r:
        return json.load(r)['version']


def fetch(version, dest):
    arch = {'arm64': 'darwin-arm64', 'x86_64': 'darwin-x64'}.get(os.uname().machine, 'darwin-arm64')
    url = (f'https://open-vsx.org/api/Anthropic/claude-code/{arch}/{version}'
           f'/file/Anthropic.claude-code-{version}@{arch}.vsix')
    try:
        with urllib.request.urlopen(url, timeout=600) as r, open(dest, 'wb') as f:
            shutil.copyfileobj(r, f)
    except Exception as e:                      # noqa: BLE001 — هر خطای شبکه یک معنا دارد
        print(f'vsix نیامد ({url}): {e}', file=sys.stderr)
        return False
    return Path(dest).stat().st_size > 0


def load_module(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def heredoc_blocks():
    """دو بلوکِ پایتونِ داخلِ fix-rtl-claude.sh، به همان ترتیبی که اجرا می‌شوند."""
    text = FIX_SH.read_text(encoding='utf-8')
    blocks = re.findall(r"python3[^\n]*<<'PYEOF'[^\n]*\n(.*?)\n[ \t]*PYEOF", text, re.S)
    if len(blocks) != 2:
        raise SystemExit(f'در fix-rtl-claude.sh دو بلوک انتظار می‌رفت، {len(blocks)} پیدا شد')
    return blocks


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--version', default='')
    ap.add_argument('--vsix', default='')
    ap.add_argument('--keep', action='store_true', help='پوشهٔ موقت را پاک نکن')
    args = ap.parse_args()

    for need in (FIX_SH, PATCH_SELECTOR, PATCH_GROUPS):
        if not need.exists():
            raise SystemExit('نیست: ' + str(need))

    version = args.version or ('' if args.vsix else latest_version())
    work = Path(tempfile.mkdtemp(prefix='crtl-langar-'))
    try:
        vsix = Path(args.vsix) if args.vsix else work / 'cc.vsix'
        if not args.vsix and not fetch(version, vsix):
            return 2
        with zipfile.ZipFile(vsix) as z:
            names = z.namelist()
            root = 'extension/' if any(n == 'extension/extension.js' for n in names) else ''
            if not root:
                raise SystemExit('vsix ساختارِ extension/ را ندارد')
            z.extractall(work / 'x')
        src = work / 'x' / root
        ext_js = work / 'ed' / 'extension.js'
        idx_dir = work / 'ed' / 'webview'
        idx_dir.mkdir(parents=True)
        shutil.copy(src / 'extension.js', ext_js)
        shutil.copy(src / 'webview' / 'index.js', idx_dir / 'index.js')
        shutil.copy(src / 'webview' / 'index.css', idx_dir / 'index.css')
        shutil.copy(ext_js, str(ext_js) + '.backup')
        shutil.copy(idx_dir / 'index.js', idx_dir / 'index.js.backup')

        rows = []           # (پچ, نتیجه, جزئیات)
        blocks = heredoc_blocks()

        # ۱ · extension.js — همان بلوکی که fix-rtl-claude.sh اجرا می‌کند
        css_tmp = work / 'crtl.css'
        css_tmp.write_text('', encoding='utf-8')
        os.environ.update({
            'CRTL_CSS_FILE': str(css_tmp),
            'CRTL_EXT_JS': str(ext_js),
            'CRTL_BUTTONS_JS': str(REPO / 'claude-ui-buttons.js'),
            'CRTL_HOST_HOOK_JS': str(REPO / 'claude-host-hook.js'),
            'CRTL_SIZES_FILE': str(REPO / 'sizes.example.json'),
            'CRTL_DOKME_FILE': str(REPO / 'dokme_ha.json'),
            'CRTL_TANZIMAT_FA_FILE': str(REPO / 'claude-tanzimat-fa.json'),
            'CRTL_TANZIMAT_TOZIH_FILE': str(REPO / 'claude-tanzimat-tozih.json'),
        })
        try:
            exec(compile(blocks[0], 'fix-rtl-claude.sh:block1', 'exec'), {'__name__': '__main__'})
            rows.append(('RTL/دکمه‌ها/هوک/تنظیمات — extension.js', 'OK', ''))
        except Exception as e:                  # noqa: BLE001
            rows.append(('RTL/دکمه‌ها/هوک/تنظیمات — extension.js', 'شکست', f'{type(e).__name__}: {e}'))

        # ۲ · webview/index.js
        old_argv = sys.argv
        sys.argv = ['chek', str(idx_dir / 'index.js')]
        try:
            exec(compile(blocks[1], 'fix-rtl-claude.sh:block2', 'exec'), {'__name__': '__main__'})
            rows.append(('webview/index.js — پنجرهٔ سؤال و تنظیمات', 'OK', ''))
        except Exception as e:                  # noqa: BLE001
            rows.append(('webview/index.js — پنجرهٔ سؤال و تنظیمات', 'شکست', f'{type(e).__name__}: {e}'))
        finally:
            sys.argv = old_argv

        # ۳ · سرآیندِ پرووایدر/خانواده (همان main() تولیدی، با مسیرِ webview)
        try:
            groups = load_module(PATCH_GROUPS, 'patch_model_groups')
            groups.main.__globals__['sys'].argv = ['patch_model_groups', str(idx_dir / 'index.js')]
            groups.main()
            rows.append(('سرآیندِ مدل‌پیکر (patch_model_groups)', 'OK', ''))
        except Exception as e:                  # noqa: BLE001
            rows.append(('سرآیندِ مدل‌پیکر (patch_model_groups)', 'شکست', f'{type(e).__name__}: {e}'))

        # ۴ · فهرستِ مدلِ اوپن‌روتر (روی extension.jsِ پچ‌شده، مثلِ تولید)
        try:
            sel = load_module(PATCH_SELECTOR, 'patch_deepseek_models')
            text = ext_js.read_text(encoding='utf-8')
            patched = sel.patch_text(text)
            ext_js.write_text(patched, encoding='utf-8')
            rows.append(('فهرستِ مدلِ اوپن‌روتر (patch_deepseek_models)', 'OK', ''))
        except Exception as e:                  # noqa: BLE001
            rows.append(('فهرستِ مدلِ اوپن‌روتر (patch_deepseek_models)', 'شکست', f'{type(e).__name__}: {e}'))

        # ۵ · نشانگرها
        for label, path, markers in (
            ('extension.js', ext_js, EXT_MARKERS),
            ('webview/index.js', idx_dir / 'index.js', IDX_MARKERS),
        ):
            body = path.read_text(encoding='utf-8')
            for mark, (rule, what) in markers.items():
                n = body.count(mark)
                rows.append((f'{label} · {what} ({mark})', 'OK' if ok(rule, n) else 'شکست',
                             f'انتظار {rule} · دیده {n}'))

        # ۶ · فایلِ خراب کلِ پنل را می‌خواباند
        node = shutil.which('node')
        for path in (ext_js, idx_dir / 'index.js'):
            if not node:
                rows.append((f'node --check {path.name}', 'رد شد', 'node نیست'))
                continue
            r = subprocess.run([node, '--check', str(path)], capture_output=True, text=True)
            rows.append((f'node --check {path.name}', 'OK' if r.returncode == 0 else 'شکست',
                         (r.stderr.strip().splitlines() or [''])[-1]))

        bad = [r for r in rows if r[1] != 'OK']
        print(f'# نسخهٔ {version or "(vsixِ داده‌شده)"} — پیش از نصب، بی‌هیچ تغییری روی سیستم\n')
        print('| سنجش | نتیجه | جزئیات |')
        print('|---|---|---|')
        for name, res, detail in rows:
            detail = detail.replace('|', '\\|')[:160]
            print(f'| {name} | {res} | {detail} |')
        print()
        if bad:
            print(f'⛔ {len(bad)} سنجش شکست — نصب نکن؛ اول لنگر را تعمیر کن.')
            return 1
        print(f'✅ همهٔ {len(rows)} سنجش سبز — این نسخه با پچ‌های فعلی می‌نشیند.')
        return 0
    finally:
        if args.keep:
            print('پوشهٔ موقت:', work)
        else:
            shutil.rmtree(work, ignore_errors=True)


if __name__ == '__main__':
    sys.exit(main())
