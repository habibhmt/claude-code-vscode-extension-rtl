#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""ناظرِ خودکارِ مجری ۱۳۶ — هر پیامِ تازهٔ چتِ «مجری-۱۳۶» را می‌خواند و ایرادها را می‌گوید.

حبیب، ۱۶ نوامبر ۲۰۲۶ ۲۳:۵۴: «برو ترنسکریپت مکالمه مجری رو پیدا کن و چک کن ببین کارهایی که بهش گفتم رو درست
انجام داده یا نه و یه اسکریپت بنویس که هر چی پیام جدید براش میاد رو بخونی و ببینی و چک کنی داره درست کار
می‌کنه یا نه و بهش پیام بده برای مواردی که فک میکنی باید انجام بده رو بهش بگو درست کنه».

بدونِ تایمر: LaunchAgent با WatchPaths روی فایلِ گفتگو (قاعدهٔ ۲۶ اکت: «هر نگهبانیت که تایمر داره اصلا نباید باشه»).

usage:
  nazer_mojri.py            گزارشِ ایرادهای تازه + فرستادن به مجری (اگر ایرادِ تازه باشد)
  nazer_mojri.py --negar    فقط نشان بده، چیزی نفرست
  nazer_mojri.py --hame     همهٔ ایرادها از اول (بی‌توجه به دفعهٔ قبل)
"""
import json, os, re, subprocess, sys, time
from datetime import datetime, timedelta

HOME = os.path.expanduser('~')
REPO = os.environ.get('NAZER_REPO') or os.path.join(HOME, '1-MY-WORK/136th-day-fix-rtl-claude')
SESS_DIR = os.environ.get('NAZER_SESSDIR') or os.path.join(HOME, '.claude/sessions')
PROJ = (os.environ.get('NAZER_PROJ')
        or os.path.join(HOME, '.claude/projects/-Users-habib-1-MY-WORK-136th-day-fix-rtl-claude'))
NAME = os.environ.get('NAZER_NAME') or 'مجری-۱۳۶'
STATE = os.path.join(REPO, 'abzar/darvaze/.runtime/nazer_mojri_136_state.json')
SENDER = os.environ.get('NAZER_SENDER') or os.path.join(REPO, 'abzar/darvaze/scripts/nazer_be_mojri_136.sh')
FA = str.maketrans('0123456789', '۰۱۲۳۴۵۶۷۸۹')
fa = lambda x: str(x).translate(FA)

# ---------- یافتنِ فایلِ گفتگوی مجری ----------
def session_file():
    """نام ⇐ sessionId از ~/.claude/sessions؛ فایلِ jsonl از پوشهٔ پروژه.

    سه لایه، چون «چت پیدا نشد» یک بار هم نباید تکرار شود (شرطِ ناظر-۱۳۶، ۲۲ نوامبر):
      ۱) نامِ دقیق در ~/.claude/sessions/*.json (قاعدهٔ سراسری، بندِ ۱-ب)
      ۲) اگر نامِ دقیق نبود، همان چت با تغییرِ جزئیِ نام ولی همان پوشه
      ۳) اگر jsonl نبود، تازه‌ترین jsonl همان پوشه که نامش را دارد
    """
    # شناسه بر نام مقدم است (شرطِ ناظر-۱۳۶، ۲۰:۳۸): دو سشنِ هم‌نام داریم و
    # انتخاب بر پایهٔ نام تنها می‌تواند گفتگوی اشتباه را بخواند.
    wanted = os.environ.get('NAZER_SESSION_ID', '').strip()
    if wanted:
        p = os.path.join(PROJ, wanted + '.jsonl')
        if os.path.isfile(p):
            return p, ['با شناسهٔ صریح: %s' % wanted]
        return None, ['شناسهٔ صریح %s فایلِ گفتگو ندارد' % wanted]
    sabt = []
    if not os.path.isdir(SESS_DIR):
        return None, ['پوشهٔ %s نیست' % SESS_DIR]
    for f in sorted(os.listdir(SESS_DIR)):
        if not f.endswith('.json'):
            continue
        try:
            d = json.load(open(os.path.join(SESS_DIR, f), encoding='utf-8'))
        except (OSError, ValueError):
            continue
        sabt.append(d)

    def zende(d):
        pid = d.get('pid')
        return isinstance(pid, int) and pid > 0 and os.path.exists('/proc/%d' % pid) if os.path.isdir('/proc') \
            else (isinstance(pid, int) and pid > 0 and _alive(pid))

    # ۱) نامِ دقیق در همین پوشهٔ پروژه؛ اگر چند تا بود، زنده‌ترها اول، بعد تازه‌ترین فایل
    kandida = []
    for d in sabt:
        if d.get('name') != NAME or not d.get('sessionId'):
            continue
        p = os.path.join(PROJ, str(d['sessionId']) + '.jsonl')
        if not os.path.isfile(p):
            continue
        try:
            ham = os.path.isdir(PROJ) and os.path.samefile(os.path.expanduser(str(d.get('cwd') or '')), REPO)
        except OSError:
            ham = False
        kandida.append((0 if ham else 1, 0 if zende(d) else 1, -os.path.getmtime(p), p, d))
    if kandida:
        kandida.sort(key=lambda t: t[:4])
        _, _, _, p, d = kandida[0]
        yad = ['sessionId=%s pid=%s' % (d.get('sessionId'), d.get('pid'))]
        if len(kandida) > 1:
            yad.append('از %s سشنِ هم‌نام، زنده‌ترین و تازه‌ترین انتخاب شد' % fa(len(kandida)))
        return p, yad
    # ۲) نامِ نزدیک، ولی همان پوشهٔ پروژه
    for d in sabt:
        nom = str(d.get('name') or '')
        if ('مجری' in nom and '۱۳۶' in nom) or nom == NAME.replace('۱۳۶', '136'):
            if os.path.isdir(PROJ) and os.path.samefile(os.path.expanduser(str(d.get('cwd') or '')), REPO):
                p = os.path.join(PROJ, str(d.get('sessionId')) + '.jsonl')
                if os.path.isfile(p):
                    return p, ['با نامِ نزدیک پیدا شد: %s (sessionId=%s)' % (nom, d.get('sessionId'))]
    # ۳) تازه‌ترین گفتگوی همین پروژه که نامِ چت را در خود دارد
    nomha = [str(d.get('name')) for d in sabt if d.get('name')]
    if os.path.isdir(PROJ):
        kandida = [os.path.join(PROJ, f) for f in os.listdir(PROJ) if f.endswith('.jsonl')]
        kandida.sort(key=lambda x: os.path.getmtime(x), reverse=True)
        for p in kandida[:5]:
            try:
                if NAME in open(p, encoding='utf-8', errors='ignore').read(200000):
                    return p, ['از تازه‌ترین فایل‌ها پیدا شد: %s' % os.path.basename(p)]
            except OSError:
                continue
    return None, ['هیچ سشنی با نامِ «%s» نبود؛ نام‌های موجود: %s' % (NAME, '، '.join(nomha) or '—')]

def _alive(pid):
    try:
        os.kill(int(pid), 0)
        return True
    except (OSError, ValueError):
        return False


# ---------- خواندنِ گفتگو ----------
def bekhan(p):
    """[(زمان, نقش, متن, ابزارها)] — فقط پیامِ کاربر و متنِ جواب؛ jsonl ِ خام خوانده نمی‌شود (قاعدهٔ ۶)."""
    khat = []
    for line in open(p, encoding='utf-8', errors='ignore'):
        try:
            d = json.loads(line)
        except ValueError:
            continue
        t = d.get('type')
        if t not in ('user', 'assistant'):
            continue
        ts = d.get('timestamp', '')
        c = (d.get('message') or {}).get('content')
        matn, abzar = '', []
        if isinstance(c, str):
            matn = c
        elif isinstance(c, list):
            for b in c:
                if not isinstance(b, dict):
                    continue
                if b.get('type') == 'text':
                    matn += b.get('text', '')
                elif b.get('type') == 'tool_use':
                    abzar.append(str(b.get('name')))
        khat.append({'ts': ts, 'naqsh': t, 'matn': matn.strip(), 'abzar': abzar})
    return khat

def zaman(ts):
    try:
        return datetime.strptime(ts[:19], '%Y-%m-%dT%H:%M:%S')
    except ValueError:
        return None

# ---------- قاعده‌ها ----------
def dastur_ha(khat):
    """پیام‌های خودِ حبیب به مجری — بی هوک‌ها و بی نتیجهٔ ابزار."""
    out = []
    for i, k in enumerate(khat):
        if k['naqsh'] != 'user' or not k['matn']:
            continue
        m = k['matn']
        if m.strip().strip('؟?') == '' or m.startswith('[Image:'):
            continue
        if (m.startswith('<') or 'hads plugin' in m or 'local-command' in m
                or 'tool_result' in m or 'Another Claude session sent a message' in m
                or 'cross-session-message' in m or m.startswith('This session is being continued')
                or m.startswith('[Request interrupted') or 'Base directory for this skill' in m):
            continue
        out.append((i, k))
    return out

def bi_javab(khat, daghiqe=15):
    """دستورِ حبیب که تا ۱۵ دقیقه بعدش هیچ کار/جوابی از مجری نیامده."""
    bad = []
    dastur = dastur_ha(khat)
    for n, (i, k) in enumerate(dastur):
        z = zaman(k['ts'])
        if not z:
            continue
        payan = zaman(dastur[n + 1][1]['ts']) if n + 1 < len(dastur) else None
        javab = False
        for j in range(i + 1, len(khat)):
            kj = khat[j]
            if kj['naqsh'] != 'assistant':
                continue
            zj = zaman(kj['ts'])
            if not zj:
                continue
            if (zj - z).total_seconds() > daghiqe * 60:
                break
            if kj['abzar'] or kj['matn']:
                javab = True
                break
        if not javab and ((payan or datetime.now()) - z).total_seconds() > daghiqe * 60:
            bad.append({'noe': 'بی‌جواب', 'ts': k['ts'][11:16],
                        'nagh': k['matn'][:70].replace('\n', ' ')})
    return bad

SOAL = re.compile(r'چک کن|برو ببین|پیدا کن|بررسی کن|منشاش|از کجاست')
SARANJAM = re.compile(r'نتیجه|پیدا شد|نمی‌شود|نشد|تمام شد|علتش|علتِ|مدرک')
def bi_saranjam(khat, daghiqe=45):
    """دستورِ «چک کن/پیدا کن» که تا ۴۵ دقیقه بعدش هیچ نتیجه‌ای گفته نشده."""
    bad = []
    for i, k in enumerate(khat):
        if k['naqsh'] != 'user' or not k['matn'] or k['matn'].startswith('<'):
            continue
        if ('hads plugin' in k['matn'] or 'Another Claude session sent a message' in k['matn']
                or 'cross-session-message' in k['matn']
                or k['matn'].startswith('This session is being continued')):
            continue
        if not SOAL.search(k['matn']):
            continue
        z = zaman(k['ts'])
        if not z:
            continue
        nati = False
        for j in range(i + 1, len(khat)):
            kj = khat[j]
            if kj['naqsh'] != 'assistant':
                continue
            zj = zaman(kj['ts'])
            if not zj:
                continue
            if (zj - z).total_seconds() > daghiqe * 60:
                break
            if SARANJAM.search(kj['matn']):
                nati = True
                break
        if not nati:
            bad.append({'noe': 'بی‌سرانجام', 'ts': k['ts'][11:16],
                        'nagh': k['matn'][:70].replace('\n', ' ')})
    return bad


def engelisi(khat, akharin=80):
    """متنِ جوابِ مجری که انگلیسی است (قرارِ حبیب: جواب فارسی)."""
    bad = []
    for k in khat[-akharin:]:
        if k['naqsh'] != 'assistant' or len(k['matn']) < 60:
            continue
        horuf = [c for c in k['matn'] if c.isalpha()]
        if not horuf:
            continue
        latin = sum(1 for c in horuf if c.isascii())
        if latin / len(horuf) > 0.6:
            bad.append({'noe': 'انگلیسی', 'ts': k['ts'][11:16],
                        'nagh': k['matn'][:70].replace('\n', ' ')})
    return bad

EDA = re.compile(r'ساخته شد|درست شد|انجام شد|حل شد|سبز شد|نصب شد')
def eda_bi_madrak(khat, akharin=120, daghiqe=15):
    """ادعای «انجام شد» در حالی که ۱۵ دقیقه پیش از آن هیچ فرمانی زده نشده (گزارشِ بعد از فرمان، عیب نیست)."""
    bad = []
    for i, k in enumerate(khat):
        if i < len(khat) - akharin or k['naqsh'] == 'user':
            continue
        if not EDA.search(k['matn']) or k['abzar']:
            continue
        z = zaman(k['ts'])
        if not z:
            continue
        nazdik = False
        for j in range(max(0, i - 40), i):
            kj = khat[j]
            if kj['naqsh'] != 'assistant' or not kj['abzar']:
                continue
            zj = zaman(kj['ts'])
            if zj and abs((z - zj).total_seconds()) <= daghiqe * 60:
                nazdik = True
                break
        if not nazdik:
            bad.append({'noe': 'ادعای بی‌مدرک', 'ts': k['ts'][11:16],
                        'nagh': k['matn'][:70].replace('\n', ' ')})
    return bad

def gozaresh_bi_panjere(khat, akharin=60):
    """بیش از ۳ بلوکِ متنِ گزارش از آخرین پنجرهٔ سؤال — قاعدهٔ «سؤال و گزارش با AskUserQuestion».
    اگر حبیب بعدش گفته «قدم‌به‌قدم بگو»، گزارشِ متنی خودش خواستهٔ اوست و ایراد نیست."""
    ghadam = False
    for i, k in enumerate(khat):
        if k['naqsh'] == 'user' and 'قدم‌به‌قدم' in k['matn']:
            ghadam = True
            akh_ghadam = i
    akh = -1
    for i, k in enumerate(khat):
        if 'AskUserQuestion' in k['abzar']:
            akh = i
    if ghadam and akh < akh_ghadam:
        return []
    qism = [k for k in khat[akh + 1:] if k['naqsh'] == 'assistant' and k['matn']]
    if len(qism) >= 4 and sum(len(k['matn']) for k in qism) > 900:
        return [{'noe': 'گزارشِ متنی به‌جای پنجره', 'ts': qism[-1]['ts'][11:16],
                 'nagh': '%s بلوکِ متن، %s حرف — آخرین پنجرهٔ سؤال ساعتِ %s'
                         % (fa(len(qism)), fa(sum(len(k['matn']) for k in qism)),
                            fa(khat[akh]['ts'][11:16]) if akh >= 0 else '—')}]
    return []

def kharabi_panel():
    """هر گزارشِ خرابیِ تازه‌تر از آخرین ساختِ پنل = یک بار SIGKILL/کرش."""
    poshe = os.path.join(HOME, 'Library/Logs/DiagnosticReports')
    if not os.path.isdir(poshe):
        return []
    binar = os.path.join(HOME, 'Applications/ChromePanel.app/Contents/MacOS/ChromePanel')
    sakht = os.path.getmtime(binar) if os.path.isfile(binar) else 0
    taze = []
    for f in os.listdir(poshe):
        if not (f.startswith('ChromePanel-') and f.endswith('.ips')):
            continue
        m = os.path.getmtime(os.path.join(poshe, f))
        if m > sakht:
            taze.append((m, f))
    if not taze:
        return []
    taze.sort()
    return [{'noe': 'خرابیِ پنل بعد از ساخت',
             'ts': datetime.fromtimestamp(taze[-1][0]).strftime('%H:%M'),
             'nagh': '%s گزارشِ خرابی تازه‌تر از باینری — آخرین: %s'
                     % (fa(len(taze)), taze[-1][1][:40])}]

def tamiz_nashode(had=30):
    """فایل‌های تغییرکردهٔ کامیت‌نشده در پروژه."""
    try:
        r = subprocess.run(['git', '-C', REPO, 'status', '--porcelain'],
                           stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, timeout=20)
        n = len([l for l in r.stdout.decode('utf-8', 'ignore').splitlines() if l.strip()])
    except (OSError, subprocess.SubprocessError):
        return []
    if n >= had:
        return [{'noe': 'کارِ کامیت‌نشده', 'ts': datetime.now().strftime('%H:%M'),
                 'nagh': '%s فایلِ تغییرکرده/تازه در پروژه' % fa(n)}]
    return []

MASAYR = re.compile(r'(?:~|/|abzar|Doc|swift|Sources)[^\s،؛:()\[\]"\'`]{0,120}?\.(?:py|sh|swift|json|md|js|cjs|plist)')
COMMIT = re.compile(r'\b(?:commit|کامیت)\s*[:=]?\s*([0-9a-f]{7,40})\b')
def eda_bi_tasdig(khat, akharin=120):
    """هر «انجام شد» که نامِ فایل یا کامیت می‌آورد، خودش سنجیده می‌شود.

    شرطِ ناظر-۱۳۶ (۲۲ نوامبر): ادعا با فرمانِ بازبینی سنجیده شود، نه با خواندنِ
    متن. مسیرِ ناموجود یا کامیتِ ناموجود ⇒ ایراد، همان لحظه برای مجری.
    """
    bad = []
    for k in khat[-akharin:]:
        if k['naqsh'] != 'assistant' or not EDA.search(k['matn']):
            continue
        # مسیرِ نسبی به پوشهٔ همان لحظه بستگی دارد (`swift/build.sh` یعنی
        # ~/1-MY-WORK/186…/swift/build.sh)؛ پس در چند ریشه جست‌وجو می‌شود تا
        # ایرادِ دروغ ندهد و اسپم نکند (تجربهٔ ۱۹:۴۷).
        rise = [REPO, HOME] + sorted(
            os.path.join(os.path.join(HOME, '1-MY-WORK'), d)
            for d in (os.listdir(os.path.join(HOME, '1-MY-WORK'))
                      if os.path.isdir(os.path.join(HOME, '1-MY-WORK')) else []))
        for rah in set(MASAYR.findall(k['matn'])):
            p = os.path.expanduser(rah)
            if os.path.isabs(p):
                vojud = os.path.exists(p)
            else:
                vojud = any(os.path.exists(os.path.join(r, p)) for r in rise)
            if not vojud:
                bad.append({'noe': 'فایلِ ناموجود در ادعا', 'ts': k['ts'][11:16],
                            'nagh': '«%s» گفته شد ولی در هیچ‌کدام از ریشه‌های پروژه نیست' % rah[:60]})
        for sha in set(COMMIT.findall(k['matn'])):
            try:
                r = subprocess.run(['git', '-C', REPO, 'cat-file', '-e', sha + '^{commit}'],
                                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=15)
                if r.returncode != 0:
                    bad.append({'noe': 'کامیتِ ناموجود در ادعا', 'ts': k['ts'][11:16],
                                'nagh': 'کامیتِ %s در مخزن نیست' % sha})
            except (OSError, subprocess.SubprocessError):
                pass
    return bad

# ---------- اجرا ----------
def koll():
    p, yadasht = session_file()
    if not p:
        return None, [{'noe': 'گفتگو پیدا نشد', 'ts': '-', 'nagh': '؛ '.join(yadasht)[:200]}]
    for yad in yadasht:
        print('session: %s | %s' % (os.path.basename(p), yad))
    khat = bekhan(p)
    bad = (bi_javab(khat) + bi_saranjam(khat) + engelisi(khat) + eda_bi_madrak(khat)
           + eda_bi_tasdig(khat) + gozaresh_bi_panjere(khat) + tamiz_nashode())
    return p, bad

def matn_payam(bad):
    """پیامی که به مجری می‌رود — جدولِ ساده، فارسی."""
    satr = ['ناظرِ خودکار — این‌ها را در گفتگوی خودت پیدا کردم و مدرکش را دارم. هر کدام را جواب بده:',
            '', '| # | ایراد | ساعت | مدرک |', '|---|---|---|---|']
    for n, b in enumerate(bad, 1):
        satr.append('| %s | %s | %s | %s |' % (fa(n), b['noe'], fa(b['ts']), b['nagh'].replace('|', '/')[:90]))
    satr += ['',
             'قاعده‌ها (حبیب): گزارش و سؤال با AskUserQuestion · جواب فارسی · «انجام شد» فقط با فرمان و خروجی · '
             'بی‌وقفه بازسازیِ پنل ممنوع — اول ساخت در پوشهٔ موقت، بعد جابه‌جایی (وگرنه SIGKILL).',
             '', 'هر مورد را قبول یا رد کن، با فرمان.']
    return '\n'.join(satr)

def main():
    az = sys.argv[1:]
    negar = '--negar' in az
    hame = '--hame' in az
    p, bad = koll()
    if bad is None:
        print('گفتگو پیدا نشد')
        return 1
    # حذفِ تکراری‌ها با دفعهٔ قبل
    qabl = set()
    if not hame and os.path.isfile(STATE):
        try:
            qabl = set(json.load(open(STATE, encoding='utf-8')).get('did', []))
        except (OSError, ValueError):
            qabl = set()
    kalid = lambda b: b['noe'] + '|' + re.sub(r'\d+', '#', b['nagh'])
    taze = [b for b in bad if kalid(b) not in qabl]
    if not taze:
        # سکوت وقتی چیزی تازه نیست: هر ۱۵ دقیقه یک خط «ایرادِ تازه‌ای نیست»
        # خودش اسپم بود (شرطِ ناظر-۱۳۶، ۲۲ نوامبر ۲۰:۴۶). فقط با --negar می‌گوید.
        if negar:
            print('ایرادِ تازه‌ای نیست (%s ایراد بررسی شد، %s قبلاً گفته شد)'
                  % (fa(len(bad)), fa(len(qabl))))
        return 0
    print(matn_payam(taze))
    if negar:
        return 0
    payam = matn_payam(taze)
    if not os.path.isfile(SENDER):
        print('⚠️ فرستنده نیست: ' + SENDER)
        return 1
    r = subprocess.run(['/bin/zsh', SENDER, payam], stdout=subprocess.PIPE,
                       stderr=subprocess.STDOUT, timeout=240)
    out = r.stdout.decode('utf-8', 'ignore').strip()
    print(out[-300:])
    if '✅' in out:
        try:
            json.dump({'did': list((qabl or set()) | {kalid(b) for b in taze}),
                       'akharin': datetime.now().isoformat(timespec='seconds')},
                      open(STATE, 'w', encoding='utf-8'), ensure_ascii=False)
        except OSError:
            pass
    return 0 if '✅' in out else 1

if __name__ == '__main__':
    sys.exit(main())
