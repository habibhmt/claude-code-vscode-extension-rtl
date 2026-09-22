#!/usr/bin/env python3
"""Build the variable glossary the chat panel shows on hover.

Reads ~/.claude-rtl-glossary.json:
  {"projects": [{"name": "91th-minimal-2",
                 "shenasname": "/abs/doc/shenasname_motaghayerha.toml",
                 "vazhename": "/abs/doc/vazhename_takhte.md",     (optional)
                 "barge": "/abs/barge/barge.toml",                (optional)
                 "tarif_dir": "/abs/doc/tarif"}]}                 (optional)

Prints one JSON object {variable: [entry, ...]} to stdout. Every
[header] in a shenasname file is a variable; nothing else is guessed.
"""
import json, os, re, sys
try:
    import tomllib
except ImportError:  # launchd runs the system python 3.9, which has no tomllib
    tomllib = None

CONF = os.environ.get('CRTL_GLOSSARY_CONF', os.path.expanduser('~/.claude-rtl-glossary.json'))


def load_toml(path):
    if tomllib:
        return tomllib.load(open(path, 'rb'))
    # enough TOML for shenasname: [name] headers, key = "string" or ["list"]
    out, cur = {}, None
    for line in open(path, encoding='utf-8'):
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        h = re.match(r'\[([^\]]+)\]$', line)
        if h:
            cur = out.setdefault(h.group(1).strip().strip('"'), {})
            continue
        m = re.match(r'([A-Za-z0-9_]+)\s*=\s*(.*)$', line)
        if m and cur is not None:
            try:
                cur[m.group(1)] = json.loads(m.group(2))
            except ValueError:
                cur[m.group(1)] = m.group(2).strip('"')
    return out


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
    glossary = {}
    if not os.path.exists(CONF):
        print('{}')
        return
    for p in json.load(open(CONF, encoding='utf-8')).get('projects', []):
        try:
            cards = load_toml(p['shenasname'])
        except Exception as e:
            print('[glossary] skip %s: %s' % (p.get('shenasname'), e), file=sys.stderr)
            continue
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
