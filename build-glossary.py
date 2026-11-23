#!/usr/bin/env python3
"""Build the variable glossary the chat panel shows on hover.

Two modes (22 Nov 2026):
  · no argument — every project listed in ~/.claude-rtl-glossary.json (the patch):
      {"projects": [{"name": "91th-minimal-2",
                     "shenasname": "/abs/doc/shenasname_motaghayerha.toml",
                     "vazhename": "/abs/doc/vazhename_takhte.md",     (optional)
                     "barge": "/abs/barge/barge.toml",                (optional)
                     "tarif_dir": "/abs/doc/tarif"}]}                 (optional)
  · `--cwd DIR` — only that folder's own shenasname (the chat panel asks the host
    hook for the cards of the folder its chat belongs to). A folder without a
    shenasname prints `{}` and exits 0: most windows are that case, so it must
    not be an error.

Prints one JSON object {variable: [entry, ...]} to stdout. Every
[header] in a shenasname file is a variable; nothing else is guessed.

No lenient fallback parser: under launchd PATH `python3` is 3.9 and has no
tomllib, and a hand-rolled reader silently produced half-read files (184's
unescaped quotes, 22 Nov). The caller picks the interpreter with
abzar/py_tomllib.sh; here we only ever say so loudly.
"""
import json, os, re, sys
try:
    import tomllib
except ImportError:
    print('build-glossary: پایتونِ ۳٫۱۱+ با tomllib لازم است؛ abzar/py_tomllib.sh را صدا بزن',
          file=sys.stderr)
    sys.exit(3)

CONF = os.environ.get('CRTL_GLOSSARY_CONF', os.path.expanduser('~/.claude-rtl-glossary.json'))


def load_toml(path):
    return tomllib.load(open(path, 'rb'))


def project_from_cwd(d):
    """قراردادِ هر پروژه: doc/shenasname_motaghayerha.toml + دو فایلِ اختیاری + doc/tarif.
    شناسنامه نبود ⇒ None (بی‌شناسنامه، نه خطا)."""
    d = os.path.abspath(d)
    sn = os.path.join(d, 'doc', 'shenasname_motaghayerha.toml')
    if not os.path.isfile(sn):
        return None
    e = {'name': os.path.basename(d.rstrip('/')), 'root': d, 'shenasname': sn}
    for k, rel in (('vazhename', 'doc/vazhename_takhte.md'), ('barge', 'barge/barge.toml')):
        p = os.path.join(d, rel)
        if os.path.isfile(p):
            e[k] = p
    t = os.path.join(d, 'doc', 'tarif')
    if os.path.isdir(t):
        e['tarif_dir'] = t
    return e


def locations(path):
    # last column of the vazhename tables: "☑ name: `f.py:1,2`؛ `g.py:3` · name2: ..."
    out = {}
    if not path or not os.path.exists(path):
        return out
    for line in open(path, encoding='utf-8'):
        if '☑' not in line:
            continue
        cell = line.split('☑', 1)[1].rsplit('|', 1)[0]
        for part in cell.split(' · '):
            m = re.match(r'\s*([A-Za-z0-9_]+)\s*:(.*)', part)
            if m:
                out[m.group(1)] = re.findall(r'`([^`]+)`', m.group(2))
    return out


def barge_values(path):
    # raw line scan so the comment beside each key survives
    out = {}
    if not path or not os.path.exists(path):
        return out
    section = ''
    for line in open(path, encoding='utf-8'):
        s = re.match(r'\s*\[([^\]]+)\]', line)
        if s:
            section = s.group(1)
            continue
        m = re.match(r'([A-Za-z0-9_]+)\s*=\s*(.*)$', line.rstrip('\n'))
        if not m:
            continue
        val, _, note = m.group(2).partition(' #')
        out[m.group(1)] = {'v': val.strip(), 'note': note.strip(), 'sec': section}
    return out


def tarif_files(d):
    out = {}
    if d and os.path.isdir(d):
        for f in sorted(os.listdir(d)):
            m = re.match(r'(\d+)_', f)
            if m:
                out.setdefault(m.group(1).zfill(2), f)
    return out


def main():
    args = sys.argv[1:]
    cwd = None
    if '--cwd' in args:
        i = args.index('--cwd')
        cwd = args[i + 1] if i + 1 < len(args) else ''
        if not cwd or not os.path.isdir(cwd):
            print('build-glossary: --cwd پوشهٔ معتبر نیست: %r' % cwd, file=sys.stderr)
            sys.exit(4)
    glossary = {}
    if cwd:
        p = project_from_cwd(cwd)
        if p is None:          # پنجرهٔ پروژهٔ بی‌شناسنامه: موفق و خالی، نه خطا
            print('{}')
            return
        projects = [p]
    else:
        if not os.path.exists(CONF):
            print('{}')
            return
        projects = json.load(open(CONF, encoding='utf-8')).get('projects', [])
    for p in projects:
        try:
            cards = load_toml(p['shenasname'])
        except Exception as e:
            # نه skipِ بی‌صدا: اسمِ فایل و شمارهٔ خط، و کدِ خروجِ غیرِ صفر
            print('[glossary] %s: %s' % (p.get('shenasname'), e), file=sys.stderr)
            sys.exit(2)
        locs = locations(p.get('vazhename'))
        vals = barge_values(p.get('barge'))
        tf = tarif_files(p.get('tarif_dir'))
        root = p.get('root') or os.path.dirname(os.path.dirname(p['shenasname']))
        name = p.get('name') or os.path.basename(root)
        tdir = p.get('tarif_dir') or ''
        for var, c in cards.items():
            if not isinstance(c, dict):
                continue
            nums = [n.strip().zfill(2) for n in str(c.get('tarif', '')).split(',') if n.strip()]
            e = {
                'p': name,
                'root': root,
                'yani': c.get('yani', ''),
                'chera': c.get('chera', ''),
                'noe': c.get('noe', ''),
                'ozv': c.get('ozv', ''),
                'kh': c.get('khanandeha', []),
                'ba': c.get('ba_motaghayerha', []),
                'tayid': c.get('tayid', ''),
                'tarif': [os.path.join(tdir, tf[n]) if n in tf else n for n in nums],
                'loc': locs.get(var, []),
            }
            if var in vals:
                e['val'] = vals[var]
            glossary.setdefault(var, []).append(e)
    json.dump(glossary, sys.stdout, ensure_ascii=False, separators=(',', ':'))


if __name__ == '__main__':
    main()
