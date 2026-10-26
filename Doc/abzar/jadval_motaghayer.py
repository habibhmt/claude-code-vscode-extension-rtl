#!/usr/bin/env python3
"""Doc/jadval_motaghayerha.md from the code and Doc/shenasname_matn.toml — never by hand (standard of ۹۱, part ۴).
Run after any change of a variable; chek_motaghayer.py says when the table is stale."""
import os, re, sys, tomllib
sys.path.insert(0, os.path.dirname(__file__))
import motaghayer_ha as m

MASIR_JADVAL = os.path.join(m.RISHE, 'Doc', 'jadval_motaghayerha.md')
# the made copy of the shenasname: ⟦name⟧ filled with today's value from the code, plus who reads it (standard, part ۳)
MASIR_SAKHTE = os.path.join(m.RISHE, 'Doc', 'shenasname_motaghayerha.toml')


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
        out += ['[' + esm + ']', 'yani = ' + q(yani), 'meghdar = ' + q(meghdar.get(esm, '')), 'khanandeha = [' + ', '.join(q(x) for x in kh) + ']',
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


if __name__ == '__main__':
    open(MASIR_JADVAL, 'w', encoding='utf-8').write(sakht())
    open(MASIR_SAKHTE, 'w', encoding='utf-8').write(sakht_shenasname_sakhte())
    print('نوشته شد:', MASIR_JADVAL, MASIR_SAKHTE)
