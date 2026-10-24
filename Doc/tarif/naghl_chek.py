#!/usr/bin/env python3
# Every «…» in the given tarif files (default: all of Doc/tarif) must be Habib's own words: what he typed in this chat, his
# answers in question windows, soal-javab/kham/136-mojri.md or ~/.claude/CLAUDE.md. Agent messages
# (cross-session), tool output and summaries do not count. A «…» on a line saying "از راهِ" or
# "به نقلِ" may instead match a relayed agent message. Prints what is not found; exit = count.
import json, os, re, sys, glob
H = os.path.expanduser('~')
AGENT = re.compile(r'<cross-session-message|Another Claude session sent a message|<system-reminder|<task-notification')
ANSWER = re.compile(r'"=\"(.*?)\"(?=[.,] |\.$)', re.S)
habib, relay = [], []
P = H + '/.claude/projects/-Users-habib-1-MY-WORK-136th-day-fix-rtl-claude/'
# this chat (مجری) and its ناظر, who also heard Habib directly
for l in (x for f in ('6d39ff34-b0b1-48ae-a27b-6dc2870b9578', '1ab9bf32-ee8d-4ab4-bd88-194b19629292') for x in open(P + f + '.jsonl')):
    try: o = json.loads(l)
    except Exception: continue
    a = o.get('attachment')
    if isinstance(a, dict) and a.get('type') == 'queued_command':
        t = a.get('prompt')
        t = t if isinstance(t, str) else ' '.join(b.get('text', '') for b in t or [] if isinstance(b, dict))
        # Claude Code marks a mid-turn message Habib typed: trust that over the text, which may
        # quote an agent (a pasted handoff mentions «Another Claude session sent a message»)
        kind = (a.get('origin') or {}).get('kind')
        human = kind == 'human' or (kind is None and not AGENT.search(t))
        (habib if human else relay).append(t); continue
    if o.get('type') != 'user' or o.get('isCompactSummary'): continue
    c = o.get('message', {}).get('content')
    if o.get('isMeta'):
        relay.append(json.dumps(c, ensure_ascii=False) if not isinstance(c, str) else c); continue
    for b in ([{'type': 'text', 'text': c}] if isinstance(c, str) else c or []):
        if b.get('type') == 'text':
            t = b.get('text', '')
            (relay if AGENT.search(t) else habib).append(t)
        elif b.get('type') == 'tool_result' and isinstance(b.get('content'), str) and b['content'].startswith(('Your questions have been answered', 'The user answered:')):
            habib += ANSWER.findall(b['content'])
# kham: only the last column (Habib's answer), not the agent's question beside it
try: habib += [r.rstrip(' |\n').rsplit(' | ', 1)[-1] for r in open(H + '/1-MY-WORK/0th-day-secreter-director-from-all-sources/soal-javab/kham/136-mojri.md') if r.startswith('| 20')]
except Exception: pass
try: habib.append(open(H + '/.claude/CLAUDE.md').read())
except Exception: pass
sp = lambda t: re.sub(r'\s+', ' ', t)
habib, relay = sp('\n'.join(habib)), sp('\n'.join(relay))
# an elided quote «A … B» is checked part by part
has = lambda src, q: all(p.strip() in src for p in sp(q).split('…') if p.strip())
here = os.path.dirname(os.path.abspath(__file__))
files = sys.argv[1:] or sorted(glob.glob(here + '/*.md'))
miss = total = relayed = 0
for f in files:
    for line in open(f):
        for q in re.findall(r'«([^»]+)»', line):
            total += 1
            if has(habib, q): continue
            if has(relay, q) and re.search('از راهِ|به نقلِ', line):
                relayed += 1; continue
            miss += 1; print('پیدا نشد:', os.path.basename(f), '«' + q + '»')
print(f'نقل: {total} · از راهِ ایجنت: {relayed} · پیدا نشد: {miss}')
sys.exit(miss)
