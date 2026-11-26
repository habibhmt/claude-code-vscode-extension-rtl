#!/usr/bin/env python3
"""سنجشِ «کِی فورک، کِی Bash» — نسخهٔ ۳ (معیارِ اصلاح‌شده).

سه نشانه:
  A · هزینهٔ کانتکست به‌ازای هر نوبتِ دستیار = (نویسهٔ OUT + نویسهٔ IN ابزارها) ÷ نوبت‌های واقعی
  B · نسبتِ جست‌وجو = Bashهای جست‌وجویی ÷ تعدادِ فراخوانیِ فورک
  C · Bashهای مجاز (تست/گیت/اجرا) — فقط شمرده می‌شود، سقف ندارد

    python3 Doc/abzar/andaze_codemode.py                      # آخرین سشنِ همین پروژه
    python3 Doc/abzar/andaze_codemode.py <path.jsonl>         # یک سشنِ مشخص
    python3 Doc/abzar/andaze_codemode.py --hade-a 1320 --hade-b 0.20

▪ باطل می‌شود اگر: حبیب بگوید «این عدد از کجا آمد» ⇐ همین فرمان و خطِ «فایل: …».
▪ باطل می‌شود اگر: حبیب بگوید «این عددها چیزی را نمی‌سنجند» ⇐ python3 Doc/abzar/test_andaze_codemode.py
"""
import glob
import json
import os
import re
import sys
from collections import Counter

# ── دسته‌بندیِ Bash ────────────────────────────────────────────────
SEARCH = {
    'grep', 'rg', 'egrep', 'fgrep', 'ack', 'ag', 'find', 'fd', 'ls', 'tree',
    'cat', 'head', 'tail', 'awk', 'sed', 'wc', 'jq', 'file', 'stat', 'du',
    'od', 'xxd', 'sort', 'uniq', 'cut', 'tr',
}
ALLOW = {
    './test_all.sh', 'test_all.sh', 'bash', 'sh', 'zsh', 'git', 'npm', 'npx',
    'launchctl', 'curl', 'security', 'defaults', 'open', 'cmp', 'diff',
    'python3', 'python', 'node', 'osascript', 'pbcopy', 'chmod', 'mkdir',
    'cp', 'mv', 'rm', 'ln', 'plutil', 'codesign', 'kill', 'ps', 'lsof',
}

PREFIX_RE = [
    re.compile(r'cd\s+[^\s;&|]+[^\S\n]*(?:&&|;)[^\S\n]*'),
    re.compile(r'[A-Za-z_]\w*=[^\s;&|]*[^\S\n]+'),
]


def strip_prefix(cmd: str) -> str:
    c = cmd.strip()
    changed = True
    while changed and c:
        changed = False
        for rx in PREFIX_RE:
            m = rx.match(c)
            if m:
                c = c[m.end():]
                changed = True
    return c


def first_token(cmd: str) -> str:
    head = re.split(r'[|;&]', strip_prefix(cmd))[0]
    m = re.match(r'\S+', head)
    return m.group(0) if m else ''


def classify(cmd: str) -> str:
    """search · allow · other — فقط شروعِ دستور ملاک است، نه واژه‌های وسطِ آن."""
    fw = first_token(cmd)
    base = os.path.basename(fw)
    if fw in ('python3', 'python', 'node') and re.search(r'\s-(c|e)\b', cmd):
        return 'search'          # اجرای کدِ درون‌خطی همان کارِ فورک است
    if fw in SEARCH or base in SEARCH:
        return 'search'
    if fw in ALLOW or base in ALLOW:
        return 'allow'
    return 'other'


# ── اندازه‌گیری ───────────────────────────────────────────────────
def measure(path: str) -> dict:
    tool_name = {}
    out_chars, in_chars = Counter(), Counter()
    calls = Counter()
    bash_cmds = []
    asst_msgs = set()
    asst_records = 0

    for line in open(path, encoding='utf-8', errors='replace'):
        try:
            rec = json.loads(line)
        except Exception:
            continue
        msg = rec.get('message') or {}
        if msg.get('role') == 'assistant' or rec.get('type') == 'assistant':
            asst_records += 1
            if msg.get('id'):
                asst_msgs.add(msg['id'])
        content = msg.get('content')
        if not isinstance(content, list):
            continue
        for block in content:
            if not isinstance(block, dict):
                continue
            if block.get('type') == 'tool_use':
                name = block.get('name') or '?'
                if block.get('id') not in tool_name:      # هر فراخوانی یک بار، با شناسه
                    calls[name] += 1
                tool_name[block.get('id')] = name
                payload = block.get('input') or {}
                in_chars[name] += len(json.dumps(payload, ensure_ascii=False))
                if name == 'Bash':
                    bash_cmds.append((str(payload.get('command') or ''), payload.get('description') or ''))
            elif block.get('type') == 'tool_result':
                name = tool_name.get(block.get('tool_use_id'), '?')
                body = block.get('content')
                if isinstance(body, list):
                    text = ''.join(b.get('text', '') for b in body if isinstance(b, dict))
                else:
                    text = str(body)
                out_chars[name] += len(text)

    kinds = Counter(classify(c) for c, _ in bash_cmds)
    fork_calls = sum(v for k, v in calls.items() if 'fork_code_mode' in k or k == 'mcp__code__code')
    turns = len(asst_msgs) or asst_records or 1
    total_calls = sum(calls.values())
    out_total = sum(out_chars.values())
    in_total = sum(in_chars.values())
    return {
        'path': path,
        'calls': calls,
        'out': out_chars,
        'inp': in_chars,
        'total_calls': total_calls,
        'out_total': out_total,
        'in_total': in_total,
        'bash_total': len(bash_cmds),
        'bash_kinds': kinds,
        'fork_calls': fork_calls,
        'turns': turns,
    }


def a_value(m: dict) -> float:
    return (m['out_total'] + m['in_total']) / m['turns']


def b_value(m: dict):
    """None یعنی هیچ فورک و هیچ جست‌وجویی نبوده (۰÷۰) — نه خطا، نه قرمز."""
    if m['fork_calls'] == 0:
        return None if m['bash_kinds']['search'] == 0 else float('inf')
    return m['bash_kinds']['search'] / m['fork_calls']


def latest_session():
    base = os.path.expanduser('~/.claude/projects')
    pats = glob.glob(os.path.join(base, '*136th-day-fix-rtl-claude', '*.jsonl'))
    return max(pats, key=os.path.getmtime) if pats else None


def parse_args(argv):
    opts = {'a': None, 'b': None, 'path': None}
    rest = argv[1:]
    i = 0
    while i < len(rest):
        arg = rest[i]
        if arg.startswith('--hade-a'):
            i += 1 if '=' not in arg else 0
            val = arg.split('=', 1)[1] if '=' in arg else rest[i]
            opts['a'] = float(val)
        elif arg.startswith('--hade-b'):
            i += 1 if '=' not in arg else 0
            val = arg.split('=', 1)[1] if '=' in arg else rest[i]
            opts['b'] = float(val)
        elif not arg.startswith('--'):
            opts['path'] = arg
        i += 1
    return opts


def main(argv):
    opts = parse_args(argv)
    path = opts['path'] or latest_session()
    if not path or not os.path.exists(path):
        print('سشن پیدا نشد.', file=sys.stderr)
        return 2

    m = measure(path)
    grand = m['out_total'] + m['in_total'] or 1

    print(f'فایل: {path}')
    print(f'{"ابزار":32s} {"فراخوانی":>9s} {"IN":>9s} {"OUT":>9s} {"جمع":>9s} {"سهم":>7s}')
    for tool in sorted(set(list(m['out']) + list(m['inp'])),
                       key=lambda t: -(m['out'].get(t, 0) + m['inp'].get(t, 0))):
        oc, ic = m['out'].get(tool, 0), m['inp'].get(tool, 0)
        print(f'{tool:32s} {m["calls"].get(tool, 0):9d} {ic:9d} {oc:9d} {ic + oc:9d} {100 * (ic + oc) / grand:6.1f}%')
    print(f'{"جمع":32s} {m["total_calls"]:9d} {m["in_total"]:9d} {m["out_total"]:9d} {grand:9d} {100:6.1f}%')
    print(f'\nنوبتِ واقعیِ دستیار: {m["turns"]} · فراخوانیِ Bash: {m["bash_total"]} · فورک: {m["fork_calls"]}')
    k = m['bash_kinds']
    print(f'Bash جست‌وجویی: {k["search"]} · مجاز: {k["allow"]} · بی‌دسته: {k["other"]}')

    a, b = a_value(m), b_value(m)
    print(f'\nA (نویسهٔ کلِ کانتکست ÷ نوبت): {a:,.0f}')
    if b is None:
        print('B: ۰÷۰ (هیچ فورکی نبوده) ⇒ نامعلوم، نه قرمز')
    else:
        print(f'B (جست‌وجویی ÷ فورک): {b:.2f}')

    red = False
    if opts['a'] is not None:
        if a > opts['a']:
            print(f'قرمزِ A: {a:,.0f} از سقفِ {opts["a"]:,.0f} بیشتر است.')
            red = True
        else:
            print(f'سبزِ A: {a:,.0f} زیرِ سقفِ {opts["a"]:,.0f}.')
    if opts['b'] is not None:
        if b is None:
            print('سبزِ B: سشن هیچ فورک و هیچ جست‌وجویی نداشت (۰÷۰).')
        elif b == float('inf'):
            print('قرمزِ B: جست‌وجوی خام بود ولی هیچ فورکی نبود (تقسیم بر صفر ⇒ بی‌نهایت).')
            red = True
        elif b > opts['b']:
            print(f'قرمزِ B: {b:.2f} از سقفِ {opts["b"]:.2f} بیشتر است.')
            red = True
        else:
            print(f'سبزِ B: {b:.2f} زیرِ سقفِ {opts["b"]:.2f}.')
    return 1 if red else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
