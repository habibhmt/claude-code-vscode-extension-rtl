#!/usr/bin/env python3
"""Every model call of a day and where it came from (Habib, 3 Nov 2026: «کل تقاضای اپ رو کلود کد رو در بیارید تماس‌های هوک‌ها،
تماس‌های چیزای دیگه»). Reads only: chat files (one call = one message id), ~/.claude/hads-log usage, remember logs.
Usage: tamas_log.py [YYYY-MM-DD] (local day; default today). Counts tokens only; no prices."""
import datetime as D, glob, json, os, re, sys
from collections import defaultdict
H = os.path.expanduser('~')
ROOZ = sys.argv[1] if len(sys.argv) > 1 else D.date.today().isoformat()
TZ = D.datetime.now().astimezone().tzinfo
start = D.datetime.fromisoformat(ROOZ).replace(tzinfo=TZ)
az, ta = start.timestamp(), (start + D.timedelta(days=1)).timestamp()
jam = defaultdict(lambda: [0, 0, 0, 0, 0])  # calls, new input, cache read, cache write, output


def afzudan(k, u):
    r = jam[k]; r[0] += 1; r[1] += u.get('input_tokens', 0); r[2] += u.get('cache_read_input_tokens', 0)
    r[3] += u.get('cache_creation_input_tokens', 0); r[4] += u.get('output_tokens', 0)


for f in glob.glob(H + '/.claude/projects/*/**/*.jsonl', recursive=True):
    try:
        if os.path.getmtime(f) < az: continue
        fd = open(f, errors='ignore')
    except OSError: continue
    last = {}  # streaming writes a message several times: the last row of an id has the final usage
    for l in fd:
        if '"usage"' not in l or '"assistant"' not in l: continue
        try: r = json.loads(l)
        except ValueError: continue
        if r.get('type') != 'assistant': continue
        try: t = D.datetime.fromisoformat(r['timestamp'].replace('Z', '+00:00')).timestamp()
        except (KeyError, ValueError): continue
        if not az <= t < ta: continue
        m = r.get('message', {}); u = m.get('usage')
        if not u or m.get('model') == '<synthetic>': continue
        no = 'ساب‌ایجنت' if '/subagents/' in f or r.get('isSidechain') else 'چت: ' + str(r.get('entrypoint') or 'نامعلوم')
        # a program's chat is named by its project, so each row shows who started it (remember runs with
        # --no-session-persistence, so its calls are not in these files and are not counted twice)
        if r.get('entrypoint') == 'sdk-cli': no += ' از ' + os.path.basename(os.path.dirname(f)).split('-MY-WORK-')[-1][:30]
        last[m.get('id') or r.get('uuid')] = (no + ' · ' + str(m.get('model')).replace('claude-', ''), u)
    for k, u in last.values(): afzudan(k, u)
for f in glob.glob(H + '/.claude/hads-log/*.usage.jsonl'):
    for l in open(f, errors='ignore'):
        try: r = json.loads(l)
        except ValueError: continue
        if az <= r.get('t', 0) / 1000 < ta and r.get('usage'): afzudan('پلاگینِ حدس · ' + str(r.get('rah')), r['usage'])
TOK = re.compile(r'\[(tokens|ndc)\] tokens: (\d+)\+(\d+)cache->(\d+)out')
for f in glob.glob(H + f'/1-MY-WORK/*/.remember/logs/memory-{ROOZ}.log'):
    for l in open(f, errors='ignore'):
        m = TOK.search(l)
        if m:
            a, c, o = map(int, m.groups()[1:])
            afzudan('remember: ' + ('خلاصه' if m[1] == 'tokens' else 'فشرده‌سازی') + (' (صفر)' if a + c + o == 0 else ''), {'input_tokens': a, 'cache_read_input_tokens': c, 'output_tokens': o})
print(f'| از کجا ({ROOZ}) | تماس | ورودیِ تازه | خواندن از کش | نوشتن در کش | خروجی |\n|---|---|---|---|---|---|')
for k, r in sorted(jam.items(), key=lambda x: -(x[1][1] + x[1][2] + x[1][3] + x[1][4])):
    print(f'| {k} | ' + ' | '.join(f'{x:,}' for x in r) + ' |')
