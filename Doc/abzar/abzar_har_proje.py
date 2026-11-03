#!/usr/bin/env python3
"""Last N days (default 30): per project, how many times each tool and skill was called, subagents included, so we can see what a
project needs (Habib, 3 Nov 2026: «کدوم یکی از این کامندها اصلاً باید تو اون پروژه بیاد یا نه»). Reads only; writes Doc/masraf_abzar_har_proje.md."""
import datetime as D, glob, json, os, re, sys
from collections import Counter, defaultdict
H = os.path.expanduser('~/.claude/projects/')
RUZ = int(sys.argv[1]) if len(sys.argv) > 1 else 30
AZ = (D.datetime.now(D.timezone.utc) - D.timedelta(days=RUZ)).isoformat()[:19]
ABZAR, SKILL, CHAT = defaultdict(Counter), defaultdict(Counter), defaultdict(set)
def proje(p):
    p = p.split('-MY-WORK-')[-1]
    return re.sub(r'-[0-9a-f]{7,8}(-.*)?$', '', p)
for f in glob.glob(H + '**/*.jsonl', recursive=True):
    if os.path.getmtime(f) < (D.datetime.now() - D.timedelta(days=RUZ)).timestamp(): continue
    p = proje(os.path.relpath(f, H).split('/')[0]); ids = set()
    for l in open(f, errors='ignore'):
        if '"tool_use"' not in l: continue
        try: r = json.loads(l)
        except ValueError: continue
        if r.get('type') != 'assistant' or r.get('timestamp', '')[:19] < AZ: continue
        for b in r['message'].get('content') or []:
            if isinstance(b, dict) and b.get('type') == 'tool_use' and b.get('id') not in ids:
                ids.add(b['id']); n = b.get('name', '')
                if n.startswith('mcp__'): n = 'mcp:' + n.split('__')[1]
                ABZAR[p][n] += 1; CHAT[p].add(os.path.basename(f))
                if n == 'Skill': SKILL[p][str((b.get('input') or {}).get('skill'))] += 1
pr = sorted(ABZAR, key=lambda x: -sum(ABZAR[x].values()))
o = [f'# مصرفِ ابزار و اسکیل در هر پروژه\n\n{RUZ} روزِ آخر، با ساب‌ایجنت‌ها. ساخته‌شده با `python3 Doc/abzar/abzar_har_proje.py`.\n']
for p in pr:
    o += [f'\n## {p}\n\nفایلِ چت: {len(CHAT[p])} · تماسِ ابزار: {sum(ABZAR[p].values()):,}\n\n| ابزار | بار |\n|---|---|'] + [f'| {k} | {v:,} |' for k, v in ABZAR[p].most_common()]
    if SKILL[p]: o += ['\n| اسکیل | بار |\n|---|---|'] + [f'| {k} | {v:,} |' for k, v in SKILL[p].most_common()]
open(os.path.join(os.path.dirname(__file__), '..', 'masraf_abzar_har_proje.md'), 'w').write('\n'.join(o) + '\n')
hame = Counter(); chand = Counter()
for p in pr:
    for k, v in ABZAR[p].items(): hame[k] += v; chand[k] += 1
print('projects', len(pr))
for k, v in hame.most_common(): print(k, v, chand[k])
print('---')
for p in pr: print(p[:34], len(CHAT[p]), sum(ABZAR[p].values()), ' '.join(f'{k}:{v}' for k, v in ABZAR[p].most_common() if k.startswith('mcp:') or k in ('Agent','Workflow','CronCreate','WebSearch','WebFetch','Monitor'))[:150])
