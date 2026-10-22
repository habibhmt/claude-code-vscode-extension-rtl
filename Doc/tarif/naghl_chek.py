#!/usr/bin/env python3
# Every «…» in the given tarif files must be Habib's own words: what he typed in this chat, his
# answers in question windows, soal-javab/kham/136-mojri.md or ~/.claude/CLAUDE.md. Agent messages
# (cross-session), tool output and summaries do not count. A «…» on a line saying "از راهِ" or
# "به نقلِ" may instead match a relayed agent message. Prints what is not found; exit = count.
import json, os, re, sys, glob
H = os.path.expanduser('~')
AGENT = re.compile(r'<cross-session-message|Another Claude session sent a message|<system-reminder|<task-notification')
ANSWER = re.compile(r'"=\"(.*?)\"(?=[.,] |\.$)', re.S)
habib, relay = [], []
for l in open(H + '/.claude/projects/-Users-habib-1-MY-WORK-136th-day-fix-rtl-claude/6d39ff34-b0b1-48ae-a27b-6dc2870b9578.jsonl'):
    try: o = json.loads(l)
    except Exception: continue
    a = o.get('attachment')
    if isinstance(a, dict) and a.get('type') == 'queued_command' and isinstance(a.get('prompt'), str):
        (relay if AGENT.search(a['prompt']) else habib).append(a['prompt']); continue
    if o.get('type') != 'user' or o.get('isCompactSummary'): continue
    c = o.get('message', {}).get('content')
    if o.get('isMeta'):
        relay.append(json.dumps(c, ensure_ascii=False) if not isinstance(c, str) else c); continue
    for b in ([{'type': 'text', 'text': c}] if isinstance(c, str) else c or []):
        if b.get('type') == 'text':
            t = b.get('text', '')
            (relay if AGENT.search(t) else habib).append(t)
        elif b.get('type') == 'tool_result' and isinstance(b.get('content'), str) and b['content'].startswith('Your questions have been answered'):
            habib += ANSWER.findall(b['content'])
for f in [H + '/1-MY-WORK/0th-day-secreter-director-from-all-sources/soal-javab/kham/136-mojri.md', H + '/.claude/CLAUDE.md']:
    try: habib.append(open(f).read())
    except Exception: pass
habib, relay = '\n'.join(habib), '\n'.join(relay)
here = os.path.dirname(os.path.abspath(__file__))
files = sys.argv[1:] or sorted(glob.glob(here + '/0[5-9]_*.md')) + [here + '/fahvaye_kalame_habib_plus_ai_plus_agent_tools.md']
miss = total = relayed = 0
for f in files:
    for line in open(f):
        for q in re.findall(r'«([^»]+)»', line):
            total += 1
            if q in habib: continue
            if q in relay and re.search('از راهِ|به نقلِ', line):
                relayed += 1; continue
            miss += 1; print('پیدا نشد:', os.path.basename(f), '«' + q + '»')
print(f'نقل: {total} · از راهِ ایجنت: {relayed} · پیدا نشد: {miss}')
sys.exit(miss)
