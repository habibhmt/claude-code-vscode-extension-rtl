#!/usr/bin/env python3
"""گزارشِ سرویس‌های خفته — کدام `com.habib.*` در launchd خاموش یا خراب است.

چرا: سرویسِ ناظر-مجری هفته‌ها در launchctl «disabled» بود و کسی نفهمید؛
همان سکوت، سه بار چتِ VS Code را هم بدونِ خبر شکست. حبیب ۰۶:۴۸: «بله».

اجرا:
  python3 Doc/abzar/chek_service_ha.py                 # از launchctl
  python3 Doc/abzar/chek_service_ha.py --from-dir DIR  # آزمونِ خشک: list.txt + disabled.txt
کدِ خروج: ۰ هیچ سرویسِ disabled نیست · ۱ دستِ‌کم یکی disabled است
"""
import os
import re
import subprocess
import sys

_RISHE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
gozaresh_service_khabide = 'Doc/service_ha.md'
# سرویس‌هایی که عمداً خاموش‌اند؛ فهرستِ مجاز کنارِ همین اسکریپت است.


def az_launchctl():
    lst = subprocess.run(['launchctl', 'list'], capture_output=True, text=True).stdout
    dis = subprocess.run(['launchctl', 'print-disabled', f'gui/{os.getuid()}'],
                         capture_output=True, text=True).stdout
    return lst, dis


def parse(lst, dis):
    rows = []
    for line in lst.splitlines()[1:]:
        parts = line.split('\t')
        if len(parts) < 3:
            continue
        pid, status, label = parts[0], parts[1], parts[2]
        if not label.startswith('com.habib'):
            continue
        rows.append({'label': label, 'pid': pid, 'exit': status})
    off = set(re.findall(r'"([^"]+)"\s*=>\s*disabled', dis))
    for r in rows:
        r['disabled'] = r['label'] in off
    known = {r['label'] for r in rows}
    for label in sorted(off - known):
        if label.startswith('com.habib'):
            rows.append({'label': label, 'pid': '-', 'exit': '-', 'disabled': True})
    return rows


def mojaz():
    p = os.path.join(_RISHE, 'Doc', 'abzar', 'service_ha_mojaz.txt')
    if not os.path.exists(p):
        return set()
    return {l.strip() for l in open(p, encoding='utf-8') if l.strip() and not l.startswith('#')}


def benevis(rows, mojaz_set):
    p = os.path.join(_RISHE, gozaresh_service_khabide)
    out = ['# سرویس‌های com.habib — وضعیتِ امروز', '',
           '| سرویس | PID | آخرین کدِ خروج | وضعیت |', '|---|---|---|---|']
    for r in sorted(rows, key=lambda x: x['label']):
        if r['disabled']:
            v = '⚪ disabled (مجاز)' if r['label'] in mojaz_set else '🔴 disabled'
        elif r.get('exit') not in ('0', '-'):
            v = '🟡 exit≠0'
        elif r['pid'] not in ('-', ''):
            v = '✅ در حالِ اجرا'
        else:
            v = '⚪ بی‌اجرا (طبقِ WatchPaths/زمان‌بندی)'
        out.append(f"| `{r['label']}` | {r['pid']} | {r.get('exit')} | {v} |")
    open(p, 'w', encoding='utf-8').write('\n'.join(out) + '\n')
    return p


def main():
    if '--help' in sys.argv or '-h' in sys.argv:
        print(__doc__)
        return 0
    if '--from-dir' in sys.argv:
        d = sys.argv[sys.argv.index('--from-dir') + 1]
        lst = open(os.path.join(d, 'list.txt'), encoding='utf-8').read() if os.path.exists(os.path.join(d, 'list.txt')) else ''
        dis = open(os.path.join(d, 'disabled.txt'), encoding='utf-8').read() if os.path.exists(os.path.join(d, 'disabled.txt')) else ''
    else:
        lst, dis = az_launchctl()
    rows = parse(lst, dis)
    mz = mojaz()
    off = [r['label'] for r in rows if r['disabled'] and r['label'] not in mz]
    bad = [r['label'] for r in rows if r.get('exit') not in ('0', '-')]
    p = benevis(rows, mz)
    alloff = [r['label'] for r in rows if r['disabled']]
    print(f'سرویس‌ها: {len(rows)} · disabled: {len(alloff)} (مجاز {len(alloff)-len(off)}) · تازه/غیرمجاز: {len(off)} · exit≠0: {len(bad)}')
    for l in off:
        print('  🔴 disabled:', l)
    for l in bad:
        print('  🟡 exit≠0:', l)
    print('گزارش:', os.path.relpath(p, _RISHE))
    return 1 if off else 0


if __name__ == '__main__':
    sys.exit(main())
