#!/usr/bin/env python3
# Every «…» in the given tarif files must appear verbatim in a source: this chat's jsonl,
# soal-javab/kham/136-mojri.md or ~/.claude/CLAUDE.md. Prints the ones not found; exit = their count.
import json, os, re, sys, glob
H = os.path.expanduser('~')
src = []
def walk(x):
    if isinstance(x, str): src.append(x)
    elif isinstance(x, list): [walk(y) for y in x]
    elif isinstance(x, dict): [walk(y) for y in x.values()]
for l in open(H + '/.claude/projects/-Users-habib-1-MY-WORK-136th-day-fix-rtl-claude/6d39ff34-b0b1-48ae-a27b-6dc2870b9578.jsonl'):
    try: o = json.loads(l)
    except Exception: continue
    if o.get('type') == 'user': walk(o.get('message'))
for f in [H + '/1-MY-WORK/0th-day-secreter-director-from-all-sources/soal-javab/kham/136-mojri.md', H + '/.claude/CLAUDE.md']:
    try: src.append(open(f).read())
    except Exception: pass
text = '\n'.join(src)
files = sys.argv[1:] or sorted(glob.glob(os.path.join(os.path.dirname(os.path.abspath(__file__)), '0[5-9]_*.md'))) + [os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fahvaye_kalame_habib_plus_ai_plus_agent_tools.md')]
miss = total = 0
for f in files:
    for q in re.findall(r'«([^»]+)»', open(f).read()):
        total += 1
        if q not in text:
            miss += 1; print('پیدا نشد:', os.path.basename(f), '«' + q + '»')
print(f'نقل: {total} · پیدا نشد: {miss}')
sys.exit(miss)
