#!/usr/bin/env python3
"""نویسندهٔ سشن — گفتگوی هرمس را به شکلِ سشنِ کلود کد می‌نویسد.

حبیب ۲۵ نوامبر ۲۰۲۶ ۰۶:۰۰: «هر صحبتی که توی هرمس میکنم بتونم توی کلود کد
بازش کنم و ادامه اش بدم».

مدرکِ امکان (ناظر-۱۳۶، ۲۵ نوامبر): سشنِ ساختگی با **ساختارِ کاملِ رکورد** و
محتوای تازه، با `claude -p --resume <uuid>` باز شد و مدل متنِ پیام را نقل کرد.
رکوردِ ناقص (بی `sessionId`/بی `message`) با «No conversation found» رد شد.

پس قالب **از یک سشنِ واقعی** گرفته می‌شود (`TEMPLATE_SESHN`)، نه از حافظه.

منبع: `~/.hermes/state.db` جدولِ `messages(session_id, role, content, timestamp)`
مقصد:  `~/.claude/projects/<نامِ پوشه با - >/<sessionId>.jsonl`

اجرا:
  python3 Doc/abzar/sesh_nevis.py --fehrest                 # سشن‌های هرمس با تعداد
  python3 Doc/abzar/sesh_nevis.py --session <id> --cwd <پوشه>
  python3 Doc/abzar/sesh_nevis.py --session <id> --cwd <پوشه> --besaz   # بنویس
کدِ خروج: ۰ موفق · ۱ خطا · ۲ استفادهٔ غلط
"""
import argparse
import glob
import json
import os
import sqlite3
import sys
import time
import uuid

RISHE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DB_HERMES = os.path.expanduser('~/.hermes/state.db')
PROJECTS = os.path.expanduser('~/.claude/projects')
VERSION = '2.1.327'
HELP = __doc__


def ghalb():
    """قالبِ رکورد از یک سشنِ واقعیِ کلود — همهٔ فیلدها، نه از حافظه."""
    fs = sorted(glob.glob(os.path.join(PROJECTS, '*', '*.jsonl')), key=os.path.getmtime, reverse=True)
    for f in fs:
        out = {}
        try:
            for line in open(f, encoding='utf-8', errors='replace'):
                try:
                    d = json.loads(line)
                except ValueError:
                    continue
                if d.get('type') in ('user', 'assistant') and d['type'] not in out:
                    out[d['type']] = d
        except OSError:
            continue
        if len(out) == 2:
            return out
    return None


def fehrest():
    if not os.path.exists(DB_HERMES):
        print('❌ پایگاهِ هرمس نیست:', DB_HERMES)
        return None
    c = sqlite3.connect(f'file:{DB_HERMES}?mode=ro', uri=True)
    return c.execute('SELECT session_id, COUNT(*), MIN(timestamp), MAX(timestamp) '
                     'FROM messages GROUP BY session_id ORDER BY MAX(timestamp) DESC').fetchall()


def peygham_ha(c, session):
    return c.execute('SELECT role, content, timestamp FROM messages WHERE session_id=? '
                     'AND content IS NOT NULL AND content != "" ORDER BY timestamp', (session,)).fetchall()


def masir_khoroji(cwd, session_id):
    papke = os.path.abspath(cwd).replace('/', '-')
    return os.path.join(PROJECTS, papke, f'{session_id}.jsonl')


def shenasname_sesh(c, session):
    """عنوان و پوشهٔ خودِ سشن از هرمس — نه حدس.

    چرا: فهرستِ سشن‌های کلود کد عنوان را از رکوردِ `type: "summary"` می‌خواند، نه از
    اولین پیام. سشنِ بی‌summary با متنِ اولین پیام نشان داده می‌شود؛ پس نامی که حبیب
    در هرمس گذاشته (`sessions.title`) باید عیناً همان‌جا نوشته شود.
    """
    try:
        r = c.execute('SELECT title, cwd FROM sessions WHERE id=?', (session,)).fetchone()
    except sqlite3.Error:
        return None, None
    return (r[0], r[1]) if r else (None, None)


def besaz(session, cwd, ghalb_, c):
    rows = peygham_ha(c, session)
    if not rows:
        print('❌ پیامی برای این سشن نیست:', session)
        return 1
    title, cwd_db = shenasname_sesh(c, session)
    if cwd is None:
        cwd = cwd_db or os.getcwd()
    session_id = str(uuid.uuid4())
    p = masir_khoroji(cwd, session_id)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    parent = None
    pooshe = os.path.abspath(cwd)
    with open(p, 'w', encoding='utf-8') as f:
        for role, content, ts in rows:
            if role not in ('user', 'assistant'):
                continue
            q = dict(ghalb_[role])
            u = str(uuid.uuid4())
            q['uuid'] = u
            q['parentUuid'] = parent
            q['sessionId'] = session_id
            q['cwd'] = pooshe
            q['version'] = VERSION
            q['isSidechain'] = False
            q['userType'] = 'external'
            q['timestamp'] = time.strftime('%Y-%m-%dT%H:%M:%S.000Z', time.gmtime(ts))
            if role == 'user':
                q['message'] = {'role': 'user', 'content': content}
            else:
                q['message'] = {'id': 'msg_' + uuid.uuid4().hex[:20], 'type': 'message',
                                'role': 'assistant', 'container': None,
                                'model': 'deepseek-v4.1-flash',
                                'content': [{'type': 'text', 'text': content}],
                                'stop_reason': 'end_turn', 'stop_sequence': None,
                                'usage': {'input_tokens': 0, 'output_tokens': 0,
                                          'cache_creation_input_tokens': 0,
                                          'cache_read_input_tokens': 0}}
            f.write(json.dumps(q, ensure_ascii=False) + '\n')
            parent = u
        # عنوان: همان رکوردی که کلود کد برای نامِ سشن در فهرست می‌خواند. بی این،
        # سشن با متنِ اولین پیام نشان داده می‌شود و اسمی که حبیب در هرمس گذاشته گم است.
        if title:
            f.write(json.dumps({'type': 'summary', 'leafUuid': parent,
                                'summary': title}, ensure_ascii=False) + '\n')
    print('✅ نوشته شد:', p)
    print('   عنوان در فهرست:', title or '⚠️ سشن در هرمس عنوان ندارد — با متنِ اولین پیام نشان داده می‌شود')
    print('   بازکردن: claude -p --resume', session_id)
    return 0


def main():
    ap = argparse.ArgumentParser(add_help=False)
    ap.add_argument('--fehrest', action='store_true')
    ap.add_argument('--session')
    ap.add_argument('--cwd', default=None)
    ap.add_argument('--besaz', action='store_true')
    ap.add_argument('--help', '-h', action='store_true')
    a = ap.parse_args()
    if a.help:
        print(HELP)
        return 0
    c = None
    if a.fehrest:
        rows = fehrest()
        if rows is None:
            return 1
        for sid, n, t0, t1 in rows[:15]:
            print(f'{n:5d} پیام · {time.strftime("%Y-%m-%d %H:%M", time.gmtime(t1))} · {sid[:48]}')
        return 0
    if not a.session:
        print('❌ --session لازم است (فهرست: --fehrest)')
        return 2
    g = ghalb()
    if g is None:
        print('❌ هیچ سشنِ واقعیِ کلودی برای گرفتنِ قالب پیدا نشد')
        return 1
    c = sqlite3.connect(f'file:{DB_HERMES}?mode=ro', uri=True)
    if not a.besaz:
        title, cwd_db = shenasname_sesh(c, a.session)
        n = len(peygham_ha(c, a.session))
        cwd = a.cwd or cwd_db or os.getcwd()
        print(f'سشن: {a.session} · {n} پیام')
        print(f'   عنوان در فهرست: {title or "⚠️ ندارد — با متنِ اولین پیام نشان داده می‌شود"}')
        print(f'   پوشه: {cwd}  (منبع: {"--cwd" if a.cwd else "خودِ سشن در هرمس"})')
        print(f'   مقصد: {os.path.dirname(masir_khoroji(cwd, "<sessionId>"))}')
        print('برای نوشتن --besaz بده')
        return 0
    return besaz(a.session, a.cwd, g, c)


if __name__ == '__main__':
    sys.exit(main())
