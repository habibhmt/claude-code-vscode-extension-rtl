#!/usr/bin/env python3
# Test for esm_ghadim_be_taze.py on a made-up home: every old name becomes the new one, nothing is
# lost, a second run changes nothing. Prints one JSON line; exits 1 on a mismatch.
import json, os, sys, tempfile, importlib.util
here = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('be_taze', os.environ.get('BE_TAZE_PY') or os.path.join(here, 'esm_ghadim_be_taze.py'))
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
table = os.path.join(here, 'esm_ghadim.json')
home = tempfile.mkdtemp()
log, on = os.path.join(home, '.claude', 'hads-log'), os.path.join(home, '.claude', 'hads-on')
os.makedirs(log); os.makedirs(on)
J = lambda o: json.dumps(o, ensure_ascii=False)
open(os.path.join(log, 'A.events.jsonl'), 'w').write('\n'.join([
    J({'t': 1, 'iso': 'x', 'sid': 'A', 'kind': 'now', 'text': 'دو جمله'}),
    J({'t': 2, 'iso': 'x', 'sid': 'A', 'kind': 'turn_summary', 'asked': 'کار کن', 'text': 'شد', 'done': ['a'], 'not_done': ['b'], 'from': 1, 'tools': 2, 'via': 'fork', 'tokens': 9}),
    J({'t': 3, 'iso': 'x', 'sid': 'A', 'kind': 'ask', 'q': 'چی؟', 'a': 'این', 'via': 'fork'}),
    J({'t': 4, 'iso': 'x', 'sid': 'A', 'kind': 'guess_sent', 'guess': 'g', 'sent': 's', 'edited': False}),
    J({'t': 5, 'iso': 'x', 'sid': 'A', 'kind': 'do_jomle', 'text': 'تازه'}),
    '{"broken',
]) + '\n')
open(os.path.join(log, 'A.usage.jsonl'), 'w').write(J({'t': 1, 'part': 'end', 'via': 'fork', 'usage': {}}) + '\n' + J({'t': 2, 'bakhsh': 'hads', 'rah': 'sonnet', 'usage': {}}) + '\n')
open(os.path.join(log, 'A.now.jsonl'), 'w').write(J({'t': 1, 'text': 'قدیم'}) + '\n')
open(os.path.join(log, 'B.now.jsonl'), 'w').write(J({'t': 1, 'text': 'قدیم'}) + '\n')
open(os.path.join(log, 'B.do_jomle_ghablia.jsonl'), 'w').write(J({'t': 1, 'text': 'قدیم'}) + '\n' + J({'t': 2, 'text': 'تازه'}) + '\n')
open(os.path.join(on, 'A'), 'w').write('on -guess -hooks min +midfork')
open(os.path.join(on, 'B'), 'w').write('off')
out = {'aval': m.main(home, table, None)}
ev = [l for l in open(os.path.join(log, 'A.events.jsonl')).read().split('\n') if l]
rows = [json.loads(l) for l in ev if not l.startswith('{"broken')]
out['kinds'] = [r['kind'] for r in rows]
out['summary'] = sorted(rows[1].keys())
out['broken_kept'] = ev[-1] == '{"broken'
out['usage'] = [json.loads(l) for l in open(os.path.join(log, 'A.usage.jsonl')) if l.strip()]
out['usage'] = [[u['bakhsh'], u['rah'], 'part' in u or 'via' in u] for u in out['usage']]
out['ghablia'] = sorted(f for f in os.listdir(log) if 'now' in f or 'ghablia' in f)
out['ghablia_B'] = len(open(os.path.join(log, 'B.do_jomle_ghablia.jsonl')).read().split('\n')) - 1
out['file_chat'] = [open(os.path.join(on, 'A')).read(), open(os.path.join(on, 'B')).read()]
before = {f: open(os.path.join(log, f)).read() for f in os.listdir(log)}
out['dovom'] = m.main(home, table, None)
out['dovom_bi_taghir'] = before == {f: open(os.path.join(log, f)).read() for f in os.listdir(log)}
want = {
    'kinds': ['do_jomle', 'jambandi_nobat', 'porsesh', 'hads_ferestade', 'do_jomle'],
    'summary': ['anjam_nashod', 'anjam_shod', 'iso', 'khaste_habib', 'kind', 'kontekst_token', 'rah', 'sid', 't', 'tedad_abzar', 'tedad_do_jomle', 'text'],
    'broken_kept': True,
    'usage': [['akhar_javab', 'fork', False], ['hads', 'sonnet', False]],
    'ghablia': ['A.do_jomle_ghablia.jsonl', 'B.do_jomle_ghablia.jsonl'],
    'ghablia_B': 2,
    'file_chat': ['on -hads -hook yek_khat +do_jomle_fork', 'off'],
    'dovom_bi_taghir': True,
}
bad = {k: out[k] for k in want if out[k] != want[k]}
print(json.dumps({**out, 'bad': bad}, ensure_ascii=False))
sys.exit(1 if bad else 0)
