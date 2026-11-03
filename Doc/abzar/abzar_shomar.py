#!/usr/bin/env python3
"""How often each tool was called and how big its input and result were, for one chat, this project, all projects, subagents
included (Habib, 3 Nov 2026: «کدوم یکی از این ابزارها … صدا زده شدند و چه اندازه‌اید»). Reads only. Size = characters of JSON."""
import glob, json, os, re, sys
from collections import defaultdict
H = os.path.expanduser('~/.claude/projects/')
PR = '-Users-habib-1-MY-WORK-136th-day-fix-rtl-claude'
CHAT = '1ab9bf32-ee8d-4ab4-bd88-194b19629292'
LIST = re.findall(r'^\| (\S+) \| [\d,]+ \|$', open(os.path.join(os.path.dirname(__file__), '..', 'matn_abzarha_claude_code.md')).read(), re.M)
S = {k: defaultdict(lambda: [0, 0, 0]) for k in ('chat', 'project', 'all')}
seen = {k: {} for k in S}
for f in glob.glob(H + '**/*.jsonl', recursive=True):
    sc = ['all']
    if f.startswith(H + PR + '/'):
        sc.append('project')
        if CHAT in f: sc.append('chat')
    for l in open(f, errors='ignore'):
        if '"tool_use"' not in l and '"tool_result"' not in l: continue
        try: r = json.loads(l)
        except ValueError: continue
        c = (r.get('message') or {}).get('content') if isinstance(r, dict) else None
        if not isinstance(c, list): continue
        for b in c:
            if not isinstance(b, dict): continue
            if b.get('type') == 'tool_use':
                for k in sc:
                    if b.get('id') not in seen[k]:
                        seen[k][b.get('id')] = b.get('name'); x = S[k][b.get('name')]; x[0] += 1; x[1] += len(json.dumps(b.get('input'), ensure_ascii=False))
            elif b.get('type') == 'tool_result':
                for k in sc:
                    n = seen[k].get(b.get('tool_use_id'))
                    if n: S[k][n][2] += len(json.dumps(b.get('content'), ensure_ascii=False))
print('| ابزار | چت: بار | چت: ورودی | چت: نتیجه | پروژه: بار | پروژه: ورودی | پروژه: نتیجه | همه: بار | همه: ورودی | همه: نتیجه |\n|---|---|---|---|---|---|---|---|---|---|')
names = sorted(set(LIST) | set(S['all']), key=lambda n: -sum(S['all'][n][1:]))
rest = [0] * 9
for n in names:
    v = [y for k in ('chat', 'project', 'all') for y in S[k][n]]
    if n in LIST or sum(v[7:]) > 10_000_000: print(f'| {n} | ' + ' | '.join(f'{x:,}' for x in v) + ' |')
    else: rest = [a + b for a, b in zip(rest, v)]
print('| بقیه | ' + ' | '.join(f'{x:,}' for x in rest) + ' |')
