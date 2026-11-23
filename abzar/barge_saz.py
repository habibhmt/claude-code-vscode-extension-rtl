#!/usr/bin/env python3
"""barge/barge.toml را از خودِ کد می‌سازد — «مقدار فعلی در برگه» ی کارتِ هاور.

حبیب ۲۳ نوامبر ۲۰۲۶ (از راهِ ناظر): «به مجری خودت بگو بزنه». کارتِ هاور اگر کلیدی در
`barge/barge.toml` پیدا کند، خطِ «مقدار فعلی در برگه» را نشان می‌دهد (`build-glossary.py`).

قاعده‌ها:
  · فقط اسم‌هایی که در `doc/shenasname_motaghayerha.toml` کارت دارند.
  · مقدار فقط وقتی نوشته می‌شود که **یک** مقدارِ روشن در کد باشد: عدد، رشتهٔ ساده، true/false.
    عبارت، فراخوانیِ تابع و آرایه نوشته نمی‌شوند (حدس ممنوع).
  · فایلِ آزمون فقط وقتی که چیزِ دیگری نباشد؛ نامِ فایلِ `ozv` ِ همان کارت اولویت دارد.
  · رمز و توکن هرگز: اسم‌های حساس و مقدارهای بلندِ بی‌فاصله کنار گذاشته می‌شوند.
  · هر خط یادداشتِ ` # از <فایل>:<خط>` دارد تا معلوم باشد از کجا خوانده شده.

اجرا: python3 abzar/barge_saz.py [--khoshk]   (--khoshk = فقط گزارش، بی نوشتن)
"""
import collections
import os
import re
import sys
import tomllib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHENASNAME = os.path.join(ROOT, 'doc', 'shenasname_motaghayerha.toml')
KHORUJI = os.path.join(ROOT, 'barge', 'barge.toml')
SKIP_DIRS = {'.git', 'node_modules', '.claude', 'Doc', 'doc', '.ori', 'archive', '__pycache__', '.venv'}
# اسمِ حساس ⇒ کنار؛ ولی `had_fork_context_token` عددِ آستانه است، نه توکن ⇒ فقط اسم‌های صریح.
HASAS = re.compile(r'(secret|password|passwd|ramz|api[_-]?key|apikey|credential|access[_-]?token)', re.I)
DEF = re.compile(r'^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_]\w*)\s*=\s*(.+?);?\s*$')
LIT = re.compile(r"^(?:'([^'\\]*)'|\"([^\"\\]*)\"|(-?\d+(?:\.\d+)?)|(true|false))$")


def kandidaha():
    cards = tomllib.load(open(SHENASNAME, 'rb'))
    out = collections.defaultdict(list)
    for dp, dn, fn in os.walk(ROOT):
        dn[:] = [d for d in dn if d not in SKIP_DIRS]
        for f in fn:
            p = os.path.join(dp, f)
            if '/worktrees/' in p or not f.endswith(('.js', '.mjs', '.cjs', '.py')):
                continue
            rel = os.path.relpath(p, ROOT)
            testy = '/test' in rel or 'test_' in rel or rel.endswith('.test.mjs')
            try:
                lines = open(p, encoding='utf-8', errors='replace').read().splitlines()
            except Exception:
                continue
            for i, line in enumerate(lines, 1):
                if f.endswith('.py'):
                    line = line.split('#')[0]
                m = DEF.match(line)
                if not m or m.group(1) not in cards:
                    continue
                lm = LIT.match(m.group(2).strip())
                if not lm:
                    continue
                val = next(g for g in lm.groups() if g is not None)
                num = lm.group(3) is not None or lm.group(4) is not None
                ozv = (cards[m.group(1)].get('ozv') or '').strip()
                score = (2 if ozv and ozv in rel else 0) + (0 if testy else 1)
                out[m.group(1)].append((score, val, num, rel, i, testy, ozv))
    return cards, out


def entekhab(cards, cand):
    natije, rade, motenazeh = {}, [], []
    for n, vs in cand.items():
        if HASAS.search(n):
            rade.append((n, 'اسمِ حساس'))
            continue
        if all(v[5] for v in vs):          # فقط فایلِ آزمون ⇒ مقدارِ واقعی نیست
            rade.append((n, 'فقط در فایلِ آزمون'))
            continue
        best = max(v[0] for v in vs)
        top = [v for v in vs if v[0] == best]
        if len({v[1] for v in top}) != 1:
            motenazeh.append(n)
            continue
        v = top[0]
        if not v[2] and (len(v[1]) > 60 or re.search(r'[A-Za-z0-9_\-]{32,}', v[1])):
            rade.append((n, 'رشتهٔ بلند (متنِ دستور) — در کارت نمی‌آید'))
            continue
        natije[n] = v
    return natije, rade, motenazeh


def toml_str(s):
    return '"' + s.replace('\\', '\\\\').replace('"', '\\"') + '"'


def benevis(cards, natije):
    bakhsh = collections.defaultdict(list)
    for n, v in natije.items():
        bakhsh[v[6] or 'bi_ozv'].append((n, v))
    kh = ['# ساخته با abzar/barge_saz.py — «مقدار فعلی در برگه» ی کارتِ هاور؛ دستی عوض نکن',
          '# هر خط: NAME = مقدار   # از <فایل>:<خط> — مقدار از خودِ کد خوانده شده، نه از حافظه', '']
    for s in sorted(bakhsh):
        kh.append(f'[{s}]')
        for n, (_, val, num, rel, i, _, _) in sorted(bakhsh[s]):
            kh.append(f'{n} = {val if num else toml_str(val)}   # از {rel}:{i}')
        kh.append('')
    return '\n'.join(kh)


def main():
    cards, cand = kandidaha()
    natije, rade, motenazeh = entekhab(cards, cand)
    besh = len(cards) - len(natije)
    print(f'کارت: {len(cards)} · با مقدار: {len(natije)} · بی‌مقدار: {besh - len(rade)} · '
          f'کنارگذاشته: {len(rade)} · متناقض: {len(motenazeh)}')
    for n, d in rade[:10]:
        print(f'  کنار: {n} — {d}')
    if '--khoshk' in sys.argv:
        return
    os.makedirs(os.path.dirname(KHORUJI), exist_ok=True)
    open(KHORUJI, 'w', encoding='utf-8').write(benevis(cards, natije))
    print('نوشته شد:', os.path.relpath(KHORUJI, ROOT))


if __name__ == '__main__':
    main()
