#!/usr/bin/env python3
"""Every variable of the 136 code at file level, from the code itself (not by hand): the mod, the page script, the
host patch. Shared by jadval_motaghayer.py (the table) and chek_motaghayer.py (the check).
Standard of ۹۱ (۲۰۳'s copy: 203th-day-imac-cpu-tracker/doc/estandard-tarif-shenasname-motaghayer.md), Habib 27 Oct 00:00."""
import os, re

RISHE = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
FILE_HA = [
    # (file, pattern of a file-level declaration)
    ('mods/hads/hooks/register.js', re.compile(r'^(?:export )?(const|let) ([A-Za-z_$][\w$]*) = (.*)$')),
    ('claude-ui-buttons.js', re.compile(r'^  (var) ([A-Za-z_$][\w$]*) = (.*)$')),
    ('claude-host-hook.js', re.compile(r'^  (var) ([A-Za-z_$][\w$]*) = (.*)$')),
]
TABE = re.compile(r'^(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>|^function\b|^async function\b')
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
        matn = open(os.path.join(RISHE, f), encoding='utf-8').read()
        lines = matn.split('\n')
        for i, l in enumerate(lines):
            m = pat.match(l)
            if not m:
                continue
            kind, esm, meghdar = m.groups()
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
    lines = open(os.path.join(RISHE, f), encoding='utf-8').read().split('\n')
    pat = re.compile(r'^(?:  )?(?:export )?(?:async )?function\*?\s+([A-Za-z_$][\w$]*)|^(?:  )?(?:export )?(?:const|var) ([A-Za-z_$][\w$]*) = (?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>')
    sar = [(i, (m.group(1) or m.group(2))) for i, l in enumerate(lines) for m in [pat.match(l)] if m]
    out = []
    for k, (i, esm) in enumerate(sar):
        j = sar[k + 1][0] if k + 1 < len(sar) else len(lines)
        out.append((esm, '\n'.join(lines[i:j])))
    return out
