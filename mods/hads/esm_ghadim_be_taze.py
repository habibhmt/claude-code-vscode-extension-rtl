#!/usr/bin/env python3
# Old names (before 25 Oct 2026) in the «حدس» files are written over with the new ones, so no trace of
# them is left (Habib, 25 Oct 02:58, via chat 205: «نمیشه اسمای قدیم رو جدید کرد تو دیتابیس که دیگه
# اثری ازش نباشه ؟»). The table is mods/hads/esm_ghadim.json, the same one the mod keeps.
#   ~/.claude/hads-log/<id>.events.jsonl  kind and fields
#   ~/.claude/hads-log/<id>.usage.jsonl   part ⇒ bakhsh (and its value), via ⇒ rah
#   ~/.claude/hads-log/<id>.now.jsonl     ⇒ <id>.do_jomle_ghablia.jsonl (the new one wins if both)
#   ~/.claude/hads-on/<id>                the words of the chat's file
# A copy of everything goes to the Trash first. Safe to run again: a new name is left as it is.
# The mod appends while this runs: a file that grew meanwhile is read again before it is replaced.
import json, os, shutil, sys, time

def jadval(path):
    return json.load(open(path, encoding='utf-8'))

def khat_daftar(o, t):
    if o.get('kind') in t['kind_daftar']:
        o['kind'] = t['kind_daftar'][o['kind']]
    return {t['khane_daftar'].get(k, k) if k not in ('t', 'iso', 'sid', 'kind', 'text') else k: v for k, v in o.items()}

def khat_kharj(o, t):
    o = {t['khane_kharj'].get(k, k): v for k, v in o.items()}
    if o.get('bakhsh') in t['bakhsh_kharj']:
        o['bakhsh'] = t['bakhsh_kharj'][o['bakhsh']]
    return o

def benevis_ba_jabejaei(path, sakht):
    # read, convert, and replace in one rename; if the mod appended meanwhile, start again
    for _ in range(20):
        size = os.path.getsize(path)
        with open(path, encoding='utf-8') as f:
            matn = f.read()
        taze = sakht(matn)
        tmp = path + '.taze'
        with open(tmp, 'w', encoding='utf-8') as f:
            f.write(taze)
        if os.path.getsize(path) == size:
            os.replace(tmp, path)
            return True
        os.remove(tmp)
        time.sleep(0.05)
    return False

def har_khat(fn, t):
    def sakht(matn):
        out = []
        for l in matn.split('\n'):
            if not l.strip():
                continue
            try:
                out.append(json.dumps(fn(json.loads(l), t), ensure_ascii=False))
            except ValueError:
                out.append(l)  # a broken line stays as it was
        return '\n'.join(out) + '\n' if out else ''
    return sakht

def main(home, table_path, sotl):
    t = jadval(table_path)
    log, on = os.path.join(home, '.claude', 'hads-log'), os.path.join(home, '.claude', 'hads-on')
    natije = {'daftar': 0, 'kharj': 0, 'ghablia': 0, 'file_chat': 0}
    if sotl:
        os.makedirs(sotl, exist_ok=True)
        for d in (log, on):
            if os.path.isdir(d):
                shutil.copytree(d, os.path.join(sotl, os.path.basename(d)), dirs_exist_ok=True)
    if os.path.isdir(log):
        for f in sorted(os.listdir(log)):
            p = os.path.join(log, f)
            if f.endswith('.events.jsonl'):
                natije['daftar'] += benevis_ba_jabejaei(p, har_khat(khat_daftar, t))
            elif f.endswith('.usage.jsonl'):
                natije['kharj'] += benevis_ba_jabejaei(p, har_khat(khat_kharj, t))
            elif f.endswith('.now.jsonl'):
                taze = p[:-len('.now.jsonl')] + '.do_jomle_ghablia.jsonl'
                # the mod copied the old lines into the new file the first time it wrote it
                if os.path.exists(taze):
                    os.remove(p)
                else:
                    os.replace(p, taze)
                natije['ghablia'] += 1
    if os.path.isdir(on):
        for f in sorted(os.listdir(on)):
            p = os.path.join(on, f)
            if not os.path.isfile(p):
                continue
            kalame = open(p, encoding='utf-8').read().split()
            taze = [t['kalame_file'].get(k, k) for k in kalame]
            if taze != kalame:
                with open(p + '.taze', 'w', encoding='utf-8') as fh:
                    fh.write(' '.join(taze))
                os.replace(p + '.taze', p)
                natije['file_chat'] += 1
    return natije

if __name__ == '__main__':
    here = os.path.dirname(os.path.abspath(__file__))
    home = os.environ.get('HADS_HOME') or os.path.expanduser('~')
    sotl = None if os.environ.get('HADS_BI_POSHTIBAN') else os.path.join(os.path.expanduser('~'), '.Trash', 'hads-esm-ghadim-' + time.strftime('%Y-%m-%d-%H%M%S'))
    print(json.dumps({'natije': main(home, os.path.join(here, 'esm_ghadim.json'), sotl), 'poshtiban': sotl}, ensure_ascii=False))
