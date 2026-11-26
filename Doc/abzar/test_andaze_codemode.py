#!/usr/bin/env python3
"""آزمونِ ابزارِ سنجشِ «کِی فورک، کِی Bash» — با سشن‌های ساختگی.

هر آزمون یک فایلِ JSONLِ ساختگی می‌سازد، اسکریپت را با آستانه‌های معلوم اجرا می‌کند
و کدِ خروج را می‌سنجد. سبز شدنِ آزمون بدونِ خرابکاریِ عمدی حساب نیست؛ سه
خرابکاری در بخشِ ۴ همین فایل نوشته شده و باید قرمز بدهند.

    python3 Doc/abzar/test_andaze_codemode.py
"""
import json
import os
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
SCRIPT = os.path.join(HERE, 'andaze_codemode.py')


def rec_tool_use(i, name, payload):
    return json.dumps({
        'type': 'assistant',
        'message': {'id': f'm{i}', 'role': 'assistant',
                    'content': [{'type': 'tool_use', 'id': f't{i}', 'name': name, 'input': payload}]},
    }, ensure_ascii=False)


def rec_result(i, text):
    return json.dumps({
        'type': 'user',
        'message': {'role': 'user',
                    'content': [{'type': 'tool_result', 'tool_use_id': f't{i}', 'content': text}]},
    }, ensure_ascii=False)


def build(calls):
    """calls: فهرستِ (name, payload, out_text) — هر کدام یک نوبتِ دستیار."""
    lines = []
    for i, (name, payload, out) in enumerate(calls):
        lines.append(rec_tool_use(i, name, payload))
        lines.append(rec_result(i, out))
    return '\n'.join(lines) + '\n'


def run(jsonl, *args):
    fd, path = tempfile.mkstemp(suffix='.jsonl')
    with os.fdopen(fd, 'w', encoding='utf-8') as f:
        f.write(jsonl)
    try:
        p = subprocess.run([sys.executable, '-I', SCRIPT, path, *args],
                           capture_output=True, text=True)
        return p.returncode, p.stdout + p.stderr
    finally:
        os.remove(path)


FORK = 'mcp__fork_code_mode__code'
clean = [(FORK, {'code': 'x'}, 'y' * 45) for _ in range(21)]
clean += [('Bash', {'command': './test_all.sh', 'description': 't'}, 'z' * 2000)]

grep_heavy = [('Bash', {'command': 'grep -rn "x" .'}, 'a' * 100) for _ in range(10)]

fat_code = [
    ('Write', {'file_path': '/tmp/x.js', 'content': 'q' * 5000}, 'ok'),
    ('Bash', {'command': './test_all.sh'}, 'z' * 100),
]

tail_pipe = (
    [('Bash', {'command': './test_all.sh | tail -15'}, 'a' * 300) for _ in range(2)]
    + [('Bash', {'command': 'cd /Users/habib/x && git diff | head -40'}, 'b' * 200) for _ in range(2)]
    + [(FORK, {'code': 'x'}, 'y' * 45) for _ in range(4)]
)

zero_zero = [('Bash', {'command': './test_all.sh'}, 'a' * 100) for _ in range(3)]

pyc = (
    [('Bash', {'command': 'python3 -c "import os;print(1)"'}, 'a' * 20) for _ in range(2)]
    + [(FORK, {'code': 'x'}, 'y' * 45) for _ in range(2)]
)

CASES = [
    # (نام, سشن, پرچم‌ها, کدِ خروجِ انتظاری, نشانه‌ای که باید در خروجی باشد)
    ('۱ سشنِ تمیز: ۲۱ فورک + ۱ تست', clean, ('--hade-a', '1320', '--hade-b', '0.20'), 0, 'سبزِ B'),
    ('۲ ده grep خام بدون فورک', grep_heavy, ('--hade-b', '0.20'), 1, 'بی‌نهایت'),
    ('۳ کدِ چاقِ ۵۰۰۰ نویسه‌ای در ورودی', fat_code, ('--hade-a', '1320'), 1, 'قرمزِ A'),
    ('۴ پایپِ tail بعد از تست، جزوِ B نشود', tail_pipe, ('--hade-b', '0.20'), 0, 'سبزِ B'),
    ('۵ صفر تقسیم بر صفر کرش نکند', zero_zero, ('--hade-b', '0.20'), 0, '۰÷۰'),
    ('۶ python3 -c مثلِ فورک، جزوِ B', pyc, ('--hade-b', '0.20'), 1, 'قرمزِ B'),
]

fails = 0
for name, data, flags, want_rc, want_text in CASES:
    rc, out = run(build(data), *flags)
    ok = (rc == want_rc) and (want_text in out)
    print(f'{"سبز" if ok else "قرمز"} · {name}  (rc={rc}، انتظار={want_rc})')
    if not ok:
        fails += 1
        print('   ↳ خروجی:', out.strip().replace('\n', ' | ')[:400])

print()
if fails:
    print(f'{fails} آزمون قرمز.')
    sys.exit(1)
print(f'{len(CASES)} آزمون سبز.')
sys.exit(0)
