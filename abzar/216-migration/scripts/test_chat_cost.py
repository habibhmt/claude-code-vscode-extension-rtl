#!/usr/bin/env python3
"""آزمونِ هزینهٔ هر چت و هر فولدر — با لاگِ ساختگیِ کوچک (شرطِ ناظر-۱۳۶، ۲۳ نوامبر ۱۶:۰۶).

سه آزمونِ قبولی:
  الف) شمارشِ ردیف و دلارِ گروه‌ها = کل، دقیقاً
  ب) چتِ ناشناس در گروهِ «نامعلوم»، نه در چتی تصادفی
  ج) ردیفِ تکراریِ عمدی ⇒ آزمون قرمز می‌شود (وگرنه آزمون کور است)

اجرا: python3 test_chat_cost.py
"""
import importlib.util
import json
from pathlib import Path
import tempfile
import time

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('usage_under_test', HERE / 'opencode_usage.py')
u = importlib.util.module_from_spec(spec)
spec.loader.exec_module(u)

MONTH = time.strftime('%Y-%m', time.gmtime())
TMP = Path(tempfile.mkdtemp(prefix='chat-cost-'))
(TMP / 'sessions').mkdir()
(TMP / 'projects' / '-tmp-proje-a').mkdir(parents=True)
(TMP / 'projects' / '-tmp-proje-b').mkdir(parents=True)


def row(session_id, cost, model='deepseek-v4.1-flash', month=MONTH, status=200):
    return {'time_utc': month + '-23T10:00:00Z', 'provider': 'opencode', 'status': status,
            'model': model, 'session_id': session_id, 'list_cost': cost,
            'work_type': 'messages'}


def write(rows, path=None):
    path = path or (TMP / 'usage.jsonl')
    path.write_text('\n'.join(json.dumps(r) for r in rows) + '\n')
    return path


def wire(log):
    u.USAGE_LOG = log
    u.SESSIONS_DIR = TMP / 'sessions'
    u.PROJECTS_DIR = TMP / 'projects'


# چتِ «a» در پوشهٔ پروژهٔ a؛ چتِ «b» در پوشهٔ b؛ یک ردیفِ بی‌شناسه؛ یک ردیفِ ماهِ دیگر؛
# یک ردیفِ بی‌مدل؛ یک count_tokens (پول ندارد ولی ردیف است).
(TMP / 'projects' / '-tmp-proje-a' / 'aaaa.jsonl').write_text('{}\n')
(TMP / 'projects' / '-tmp-proje-b' / 'bbbb.jsonl').write_text('{}\n')
u._folder_map = lambda: {'-tmp-proje-a': '/tmp/proje-a', '-tmp-proje-b': '/tmp/proje-b'}

rows = [
    row('aaaa', 0.10), row('aaaa', 0.05),
    row('bbbb', 0.20),
    row(None, 0.30),
    row('aaaa', 0.99, month='2026-10'),          # ماهِ دیگر ⇒ نمی‌آید
    row('aaaa', 0.50, model=None),               # بی‌مدل ⇒ نمی‌آید
    row('aaaa', None, model='deepseek-v4.1-flash'),  # count_tokens: ردیف هست، پول ندارد
]
wire(write(rows))
got = u.chat_costs()
bad = 0

# الف — جمع‌ها
# جمعِ اعشاری با == مقایسه نمی‌شود (۰٫۱+۰٫۰۵ = ۰٫۱۵۰۰۰۰۰۰۰۰۰۰۰۰۰۰۲) ⇒ تا ۶ رقم.
ok = (got['total'] == 0.65 and got['requests'] == 5
      and round(sum(s['cost'] for s in got['sessions']) + got['unknown']['cost'], 6) == got['total']
      and sum(s['requests'] for s in got['sessions']) + got['unknown']['requests'] == got['requests'])
print(f"الف) کل {got['total']} · ردیف {got['requests']} · چت {len(got['sessions'])} "
      f"{'✅' if ok else '❌'}")
bad += not ok

# ب — چتِ ناشناس
unknown_ok = (got['unknown']['cost'] == 0.30 and got['unknown']['requests'] == 1
              and all(s['session_id'] for s in got['sessions']))
folder_ok = sorted(f['label'] for f in got['folders']) == ['/tmp/proje-a', '/tmp/proje-b']
print(f"ب) نامعلوم {got['unknown']['cost']} · پوشه‌ها {[f['label'] for f in got['folders']]} "
      f"{'✅' if unknown_ok and folder_ok else '❌'}")
bad += not (unknown_ok and folder_ok)

# ج — خرابکاریِ عمدی: همان ردیف دو بار ⇒ جمع باید عوض شود و آزمونِ الف قرمز شود
dup = rows + [row('aaaa', 0.05)]
wire(write(dup))
again = u.chat_costs()
caught = again['total'] != got['total'] or again['requests'] != got['requests']
print(f"ج) ردیفِ تکراری ⇒ کل {again['total']} (بود {got['total']}) · ردیف {again['requests']} "
      f"{'✅ قرمز شد' if caught else '❌ کور بود'}")
bad += not caught

print('جمع: ' + ('سبز' if not bad else f'{bad} ❌'))
raise SystemExit(1 if bad else 0)
