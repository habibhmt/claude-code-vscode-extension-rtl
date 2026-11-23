#!/usr/bin/env python3
"""Doc/jadval_motaghayerha.md from the code and Doc/shenasname_matn.toml — never by hand (standard of ۹۱, part ۴).
Run after any change of a variable; chek_motaghayer.py says when the table is stale."""
import os, re, sys, tomllib
sys.path.insert(0, os.path.dirname(__file__))
import motaghayer_ha as m

MASIR_JADVAL = os.path.join(m.RISHE, 'Doc', 'jadval_motaghayerha.md')
# the made copy of the shenasname: ⟦name⟧ filled with today's value from the code, plus who reads it (standard, part ۳)
MASIR_SAKHTE = os.path.join(m.RISHE, 'Doc', 'shenasname_motaghayerha.toml')
MASIR_VAZHENAME = os.path.join(m.RISHE, 'Doc', 'vazhename_takhte.md')


def meghdar_emruz(meghdar):
    """a literal value as the code holds it now: a number (55 * 60000 ⇒ 3300000) or a short string; else ''"""
    v = meghdar.rstrip(';').strip()
    if re.fullmatch(r'[\d_.]+(?:\s*\*\s*[\d_.]+)*', v):
        return str(eval(v.replace('_', '')))
    if re.fullmatch(r"'[^'\\]{0,60}'", v):
        return v[1:-1]
    return ''


def sakht_shenasname_sakhte():
    sh = tomllib.load(open(os.path.join(m.RISHE, 'Doc', 'shenasname_matn.toml'), 'rb'))
    items = m.peyda_kardan()
    tabe = {f: m.tabe_ha_ye_file(f) for f, _ in m.FILE_HA}
    meghdar = {a['esm']: meghdar_emruz(a['meghdar']) for a in items}
    q = lambda s: '"' + str(s).replace('\\', '\\\\').replace('"', '\\"') + '"'
    out = ['# ساخته با python3 Doc/abzar/jadval_motaghayer.py از Doc/shenasname_matn.toml و کد — دستی عوض نکن', '']
    for esm, b in sh.items():
        ja = [a for a in items if a['esm'] == esm]
        yani = re.sub(r'⟦([\w$]+)⟧', lambda x: meghdar.get(x.group(1)) or x.group(0), b.get('yani', ''))
        kh = sorted({t for a in ja for t, body in tabe[a['file']] if re.search(r'(?<![\w$.])' + re.escape(esm) + r'(?![\w$])', body)})
        # کلیدهای کارتِ هاور (ناظر-تعاریف-۱۳۶، ۲۳ نوامبر ۱۵:۱۹؛ حبیب «اینا رو به اون
        # مجری-۱۳۶ بگید درس ت کنه»): منبعِ حقیقت همین فایلِ متن است، پس هر هفت کلید
        # به شناسنامهٔ ساخته هم می‌رود؛ قبلاً فقط yani/meghdar/khanandeha/jaye می‌رفت
        # و کارتِ ۱۳۶ دو خط بیشتر نشان نمی‌داد.
        ba = b.get('ba_motaghayerha') or []
        if isinstance(ba, str):
            ba = [ba]
        out += ['[' + esm + ']', 'yani = ' + q(yani), 'meghdar = ' + q(meghdar.get(esm, '')),
                'chera = ' + q(b.get('chera', '')), 'noe = ' + q(b.get('noe', '')),
                'ozv = ' + q(b.get('ozv', '')),
                'ba_motaghayerha = [' + ', '.join(q(x) for x in ba) + ']',
                'tarif = ' + q(b.get('tarif', '')), 'tayid = ' + q(b.get('tayid', '')),
                'khanandeha = [' + ', '.join(q(x) for x in kh) + ']',
                'jaye = [' + ', '.join(q(f"{a['file']}:{a['khat']}") for a in ja) + ']', '']
    return '\n'.join(out)


def sakht():
    sh = tomllib.load(open(os.path.join(m.RISHE, 'Doc', 'shenasname_matn.toml'), 'rb'))
    items = m.peyda_kardan()
    tabe = {f: m.tabe_ha_ye_file(f) for f, _ in m.FILE_HA}
    jaha = {}
    for a in items:
        jaha.setdefault(a['esm'], []).append(a)
    rows = ['# جدولِ متغیرهای ۱۳۶ — ساخته با `python3 Doc/abzar/jadval_motaghayer.py`، دستی عوض نکن', '',
            'معنی‌ها از `Doc/shenasname_matn.toml`؛ جا و تابع‌ها از خودِ کد. «تأیید»: ✓ = اسم «بله» ِ حبیب را دارد · ؟ = پیشنهاد، تأییدنشده.', '',
            '| # | متغیر | نوع | معنی | فایل:خط | تابع‌ها | تعریف | در ارتباط با | تأیید |', '|---|---|---|---|---|---|---|---|---|']
    for n, (esm, ja) in enumerate(jaha.items(), 1):
        b = sh.get(esm, {})
        jaye = ', '.join(f"{a['file']}:{a['khat']}" for a in ja)
        tb = sorted({t for a in ja for t, body in tabe[a['file']] if re.search(r'(?<![\w$.])' + re.escape(esm) + r'(?![\w$])', body)})
        tbs = ', '.join(tb[:6]) + (f' …+{len(tb) - 6}' if len(tb) > 6 else '') or '—'
        ba = ', '.join(f'`{x}`' for x in b.get('ba_motaghayerha', [])) or '—'
        t = '؟' if b.get('tayid', '').startswith('پیشنهاد') else ('✓' if b else '—')
        rows.append(f"| {n} | `{esm}` | {b.get('noe', ja[0]['noe'])} | {b.get('yani', '—').replace('|', '¦')} | {jaye} | {tbs} | {b.get('tarif', '') or '—'} | {ba} | {t} |")
    return '\n'.join(rows) + '\n'


def sakht_vazhename():
    """Doc/vazhename_takhte.md — همان `jaye` به شکلِ استانداردِ ۹۱ (حبیب ۲۳ نوامبر ۱۵:۴۸:
    «اگه راه اصولیش اینه انجام بدید»). از همان کد ساخته می‌شود تا با `jaye` یکی بماند."""
    import tomllib
    cards = tomllib.load(open(MASIR_SAKHTE, 'rb'))
    rows = []
    skipped = []
    for esm, b in cards.items():
        jaye = [j for j in (b.get('jaye') or []) if not j.startswith('~/')]
        if not jaye:
            skipped.append(esm)
            continue
        rows.append('| `%s` | %s | ☑ %s: %s |' % (
            esm, str(b.get('yani', '')).replace('|', '¦'), esm,
            '؛ '.join('`%s`' % j for j in jaye)))
    head = ('# واژه‌نامهٔ تابلو — آدرسِ هر متغیر در کد\n\n'
            'حبیب ۲۳ نوامبر ۲۰۲۶ ۱۵:۴۸: «اگه راه اصولیش اینه انجام بدید» — آدرس‌ها از `jaye` ِ '
            'شناسنامه به این فایل آمدند، **بدونِ دست‌زدن به کد** (الگوی ۹۱).\n\n'
            '| | |\n|---|---|\n'
            '| **آدرسِ تعریف** | `136th-day-fix-rtl-claude · Doc/vazhename_takhte.md` |\n'
            '| **آدرسِ کد** | خواننده: `build-glossary.py` (تابعِ `locations`) ⇒ فیلدِ `loc` در '
            'همان JSON که کارتِ هاور می‌خواند |\n'
            '| **آدرسِ داده** | منبع: `Doc/shenasname_motaghayerha.toml` (فیلدِ `jaye`) |\n\n'
            '**قالب:** هر خطی که `☑` دارد خوانده می‌شود؛ بعد از `☑` اسمِ متغیر و بعد آدرس‌ها '
            'داخلِ بک‌تیک، با `؛` جدا. مسیرها **نسبت به ریشهٔ پروژه**‌اند و کارت خودش ریشه را '
            'جلویشان می‌گذارد.\n\n'
            '**چرا این فایل جداست:** `jaye` در شناسنامه هم می‌ماند (منبعِ ساخت)، ولی کارت آن را '
            'نمی‌خواند؛ این فایل شکلِ استانداردِ ۹۱ را دارد. **دستی عوض نکن** — با '
            '`python3 Doc/abzar/jadval_motaghayer.py` ساخته می‌شود.\n\n'
            '**%d متغیرِ اپِ ۱۸۶ این‌جا نیستند** (%s): فایلشان بیرونِ این مخزن است و کارت مسیر '
            'را با ریشهٔ پروژه جمع می‌کند ⇒ لینکِ شکسته می‌شد. کارت برایشان بی‌«فایل:خط» هم '
            'کامل است.\n\n'
            '| متغیر | یعنی | فایل:خط |\n|---|---|---|\n') % (len(skipped), ' · '.join('`%s`' % s for s in skipped))
    return head + '\n'.join(rows) + '\n'


if __name__ == '__main__':
    open(MASIR_JADVAL, 'w', encoding='utf-8').write(sakht())
    open(MASIR_SAKHTE, 'w', encoding='utf-8').write(sakht_shenasname_sakhte())
    open(MASIR_VAZHENAME, 'w', encoding='utf-8').write(sakht_vazhename())
    print('نوشته شد:', MASIR_JADVAL, MASIR_SAKHTE, MASIR_VAZHENAME)
