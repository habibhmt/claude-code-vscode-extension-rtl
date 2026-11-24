#!/usr/bin/env python3
"""Every variable of the 136 code at file level, from the code itself (not by hand): the mod, the page script, the
host patch. Shared by jadval_motaghayer.py (the table) and chek_motaghayer.py (the check).
Standard of ۹۱ (۲۰۳'s copy: 203th-day-imac-cpu-tracker/doc/estandard-tarif-shenasname-motaghayer.md), Habib 27 Oct 00:00."""
import os, re

RISHE = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
# مسیر: هر فایلی که با «~» شروع شود از خانه باز می‌شود (اپِ ۱۸۶ بیرونِ این مخزن است).
FILE_HA = [
    # (file, pattern of a file-level declaration)
    ('mods/hads/hooks/register.js', re.compile(r'^(?:export )?(const|let) ([A-Za-z_$][\w$]*) = (.*)$')),
    ('claude-ui-buttons.js', re.compile(r'^  (var) ([A-Za-z_$][\w$]*) = (.*)$')),
    ('claude-host-hook.js', re.compile(r'^  (var) ([A-Za-z_$][\w$]*) = (.*)$')),
    # دروازه و رَپر و کاتالوگِ مصرف (ناظر-۱۳۶، ۲۳ نوامبر ۱۵:۱۰: «FILE_HA را گسترش بده»،
    # محدود به همین فایل‌های واقعی؛ الگو فقط ثابتِ ماژول را می‌گیرد، نه متغیرِ محلی).
    ('abzar/darvaze/scripts/opencode_gateway.py', re.compile(r'^([A-Z][A-Z0-9_]*) = (.*)$')),
    ('abzar/darvaze/scripts/vscode_opencode_wrapper.py', re.compile(r'^([A-Z][A-Z0-9_]*) = (.*)$')),
    ('abzar/darvaze/scripts/opencode_usage.py', re.compile(r'^([A-Z][A-Z0-9_]*) = (.*)$')),
    ('abzar/darvaze/scripts/opencode_picker.py', re.compile(r'^([A-Z][A-Z0-9_]*) = (.*)$')),
    ('abzar/darvaze/scripts/opencode_caps.py', re.compile(r'^([A-Z][A-Z0-9_]*) = (.*)$')),
    # ثابت‌های رممبر: افزونهٔ فعال از ~/.claude/plugins-local می‌خوانَد، نه از cache.
    ('~/.claude/plugins-local/remember-habib/pipeline/haiku.py', re.compile(r'^([a-zA-Z][A-Za-z0-9_]*) = (.*)$')),
    ('~/1-MY-WORK/203th-day-imac-cpu-tracker/doc/abzar/hook_remember_pish.py', re.compile(r'^([a-zA-Z][A-Za-z0-9_]*) = (.*)$')),
    # سوئیفت: فقط ثابتِ سطحِ فایل یا `static let` (تودرتوی ۴ فاصله)، نه `let` های محلی.
    ('apps/claude-usage/swift/Sources/OpenCode.swift',
     re.compile(r'^ {0,4}(?:static )?(let|var) ([A-Za-z_]\w*)(?:\s*:\s*[^=]+)? = (.*)$')),
    ('apps/claude-usage/swift/Sources/App.swift',
     re.compile(r'^ {0,4}(?:static )?(let|var) ([A-Za-z_]\w*)(?:\s*:\s*[^=]+)? = (.*)$')),
]


def masir(f):
    """مسیرِ کاملِ فایل؛ «~» از خانه باز می‌شود و بقیه از ریشهٔ پروژه."""
    return os.path.expanduser(f) if f.startswith('~') else os.path.join(RISHE, f)


TABE = re.compile(r'^(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>|^function\b|^async function\b'
                  r'|^def\s+([A-Za-z_]\w*)'
                  r'|^func\s+([A-Za-z_]\w*)'
                  r'|^\s{0,4}static func\s+([A-Za-z_]\w*)')
# a second name on the same line: «var a = '', b = false»
DOVOMI = re.compile(r',\s*([A-Za-z_$][\w$]*) = ')


def tozih_bala(lines, i):
    """the // lines right above line i, joined"""
    out = []
    j = i - 1
    while j >= 0 and lines[j].strip().startswith('//'):
        out.append(lines[j].strip()[2:].strip())
        j -= 1
    return ' '.join(reversed(out))


def noe_motaghayer(kind, meghdar, esm, matn):
    """vaziat (state: changes while it runs) or sabet (a constant): a let, a Map/Set, or a var assigned again later"""
    if kind == 'let' or re.match(r'new (Map|Set)\b', meghdar.strip()):
        return 'vaziat'
    dobare = re.findall(r'(?<![\w$.])' + re.escape(esm) + r'\s*(?:=(?![=>])|\+\+|--|\+=|-=)', matn)
    return 'vaziat' if len(dobare) > 1 else 'sabet'


def peyda_kardan():
    out = []
    for f, pat in FILE_HA:
        matn = open(masir(f), encoding='utf-8').read()
        lines = matn.split('\n')
        for i, l in enumerate(lines):
            m = pat.match(l)
            if not m:
                continue
            # الگوی پایتون فقط دو گروه دارد (اسم، مقدار) — نوعش همیشه ثابتِ ماژول است.
            groups = m.groups()
            kind, esm, meghdar = ('const', groups[0], groups[1]) if len(groups) == 2 else groups
            if TABE.match(meghdar.strip()):
                continue
            tz = tozih_bala(lines, i)
            out.append({'esm': esm, 'file': f, 'khat': i + 1, 'noe': noe_motaghayer(kind, meghdar, esm, matn), 'tozih': tz, 'meghdar': meghdar.strip()})
            if kind == 'var':
                for d in DOVOMI.findall(meghdar.split('//')[0]):
                    out.append({'esm': d, 'file': f, 'khat': i + 1, 'noe': noe_motaghayer(kind, '', d, matn), 'tozih': tz, 'meghdar': ''})
    return out


def tabe_ha_ye_file(f):
    """name and line span of each file-level function (for the 'functions' column)"""
    lines = open(masir(f), encoding='utf-8').read().split('\n')
    pat = re.compile(r'^(?:  )?(?:export )?(?:async )?function\*?\s+([A-Za-z_$][\w$]*)|^(?:  )?(?:export )?(?:const|var) ([A-Za-z_$][\w$]*) = (?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>')
    sar = [(i, (m.group(1) or m.group(2))) for i, l in enumerate(lines) for m in [pat.match(l)] if m]
    out = []
    for k, (i, esm) in enumerate(sar):
        j = sar[k + 1][0] if k + 1 < len(sar) else len(lines)
        out.append((esm, '\n'.join(lines[i:j])))
    return out

PY_TABE = re.compile(r'^(?:async\s+)?def\s+([A-Za-z_]\w*)\s*\(')
JS_TABE = re.compile(r'^(?:  )?(?:export )?(?:async )?function\*?\s+([A-Za-z_$][\w$]*)'
                     r'|^(?:  )?(?:export )?(?:const|var) ([A-Za-z_$][\w$]*) = (?:async\s*)?'
                     r'(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>')


def jaye_tabe(esm):
    """(file, line) of a function/method named esm in the scanned files; None if absent."""
    for f, _ in FILE_HA:
        try:
            lines = open(masir(f), encoding='utf-8').read().split('\n')
        except OSError:
            continue
        for i, l in enumerate(lines):
            m = PY_TABE.match(l) or JS_TABE.match(l)
            if m and (m.group(1) or (m.lastindex or 0) > 1 and m.group(2)) == esm:
                return f, i + 1
    return None


def dar_code(esm):
    """True when the literal name appears anywhere in the scanned files (settings keys etc.)."""
    for f, _ in FILE_HA:
        try:
            if esm in open(masir(f), encoding='utf-8').read():
                return True
        except OSError:
            continue
    return False


def jaye_name(esm):
    """(file, line) of the first literal occurrence of a name in the scanned files."""
    for f, _ in FILE_HA:
        try:
            lines = open(masir(f), encoding='utf-8').read().split('\n')
        except OSError:
            continue
        for i, l in enumerate(lines):
            if esm in l:
                return f, i + 1
    return None
