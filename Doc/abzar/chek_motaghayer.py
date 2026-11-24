#!/usr/bin/env python3
"""Checks the standard of ۹۱ on the 136 code (Habib 27 Oct 00:00): every variable has a shenasname block, no value is
copied into it (⟦name⟧ instead), the table is not stale, and a name breaking the rules (number without its unit, one
name in two files) is either fixed or listed in Doc/esm_pishnahadi.md for Habib. Prints «جمع: N ❌»; exit 1 when N > 0."""
import os, re, sys, tomllib
sys.path.insert(0, os.path.dirname(__file__))
import motaghayer_ha as m
import jadval_motaghayer as j

VAHED = ('_ts', '_ms', '_s', '_token', '_harf', '_radif', '_px', '_darsad', '_usd', '_byte', '_khat', '_tedad', '_javab', '_bar')
FA = str.maketrans('0123456789', '۰۱۲۳۴۵۶۷۸۹')
# چک دورقمی (ناظر-۱۳۶، ۲۳ نوامبر ۱۵:۲۲): بدهیِ قدیمیِ این سه فایل نباید قرمزِ کارِ
# تازهٔ ما را بپوشاند و برعکس. «بدهی» = بلوکی که پیش از امروز هم نبوده است.
LEGACY = {'mods/hads/hooks/register.js', 'claude-ui-buttons.js', 'claude-host-hook.js'}


def dadeh_fields():
    """کلیدهایی که واقعاً در داده هستند: ردیف‌های usage.jsonl + کلیدهای opencode-go.json (تودرتو)."""
    import json
    out = set()
    usage = os.path.join(m.RISHE, 'abzar/darvaze/.runtime/opencode-go/usage.jsonl')
    if os.path.exists(usage):
        # کلِ فایل، نه فقط چند ردیف: فیلدهای تشخیصی تازه‌اند و ردیف‌های قدیمی ندارندشان،
        # و `mapped_from` فقط در ردیف‌های نگاشت‌شده هست (سنجیده ۲۳ نوامبر ۱۷:۳۴).
        with open(usage, encoding='utf-8', errors='replace') as f:
            lines = f.readlines()
        for line in lines:
            try:
                row = json.loads(line)
            except ValueError:
                continue
            if isinstance(row, dict):
                out |= set(row)
    snap = os.path.expanduser('~/Library/Application Support/claude-usage-bar/opencode-go.json')
    if os.path.exists(snap):
        try:
            data = json.load(open(snap, encoding='utf-8'))
        except ValueError:
            data = {}
        def walk(node):
            if isinstance(node, dict):
                for k, v in node.items():
                    out.add(k)
                    walk(v)
            elif isinstance(node, list):
                for v in node[:3]:
                    walk(v)
        walk(data)
    return out


def main():
    sh_masir = os.path.join(m.RISHE, 'Doc', 'shenasname_matn.toml')
    sh = tomllib.load(open(sh_masir, 'rb'))
    pish = open(os.path.join(m.RISHE, 'Doc', 'esm_pishnahadi.md'), encoding='utf-8').read()
    items = m.peyda_kardan()
    esm_ha = {}
    for a in items:
        esm_ha.setdefault(a['esm'], []).append(a)
    bad = []
    bad_legacy = []
    for esm, ja in esm_ha.items():
        b = sh.get(esm)
        if not b:
            line = f'بی شناسنامه: {esm} ({ja[0]["file"]}:{ja[0]["khat"]})'
            (bad_legacy if ja[0]['file'] in LEGACY else bad).append(line)
            continue
        for k in ('yani', 'tarif', 'tayid'):
            if not str(b.get(k, '')).strip():
                bad.append(f'شناسنامهٔ {esm}: «{k}» خالی است')
        meghdar = ja[0]['meghdar'].rstrip(';').strip()
        if re.fullmatch(r'[\d_.]+(?:\s*\*\s*[\d_.]+)*', meghdar):
            adad = str(eval(meghdar.replace('_', '')))
            if re.search(r'(?<![\d۰-۹])(' + re.escape(adad) + '|' + re.escape(adad.translate(FA)) + r')(?![\d۰-۹])', b.get('yani', '')):
                bad.append(f'عدد در شناسنامه: {esm} = {adad} (به‌جایش ⟦{esm}⟧)')
            # tarif 10 of 91: a moment is `ts` and the word `zaman` is not used; a count limit is `had_tedad_…`
            vahed_dorost = esm.lower().endswith(VAHED) and 'zaman' not in esm
            if esm.startswith('had_') and esm.endswith(('_tedad', '_bar')) and not esm.startswith('had_tedad_'):
                vahed_dorost = False
            if not vahed_dorost and f'`{esm}`' not in pish:
                bad.append(f'اسم بیرون از تعریفِ ۱۰ ِ ۹۱: {esm} (درستش کن یا در esm_pishnahadi.md بیاور)')
        if len({a['file'] for a in ja}) > 1 and f'`{esm}`' not in pish:
            bad.append(f'یک اسم در دو فایل: {esm} (قاعدهٔ ۷)')
    # فیلدهای داده (noe = "dadeh") در کد نیستند؛ با خودِ داده سنجیده می‌شوند، نه با اسکنر.
    dadeh = {esm for esm, b in sh.items() if str(b.get('noe', '')).strip() == 'dadeh'}
    # بلوکِ تابع (noe = "tabe"): در اسکنرِ متغیرها نیست، ولی وجودش در کد سنجیده می‌شود.
    tabe_ha = {esm for esm, b in sh.items() if str(b.get('noe', '')).strip() == 'tabe'}
    for esm in tabe_ha:
        if m.jaye_tabe(esm) is None:
            bad.append(f'تابع در کد نیست: {esm}')
    # کلیدِ تنظیم (noe = "vaziat"): اسم باید واقعاً در کدِ اسکن‌شده باشد.
    vaziat = {esm for esm, b in sh.items() if str(b.get('noe', '')).strip() == 'vaziat'}
    import os as _os
    for esm in vaziat:
        b = sh.get(esm) or {}
        jv = b.get('jaye')
        jv = jv if isinstance(jv, list) else ([jv] if jv else [])
        # یا در کدِ اسکن‌شده هست، یا خودِ بلوک مسیرِ واقعیِ روی دیسک را می‌دهد (فایل:خط یا مسیر).
        ok = m.dar_code(esm) or any(_os.path.expanduser(str(p).split(':')[0]) and
                                    _os.path.exists(_os.path.expanduser(str(p).split(':')[0])) for p in jv)
        if not ok:
            bad.append(f'کلید در کد و روی دیسک نیست: {esm}')
    for esm in sh:
        if esm not in esm_ha and esm not in dadeh and esm not in tabe_ha and esm not in vaziat:
            bad.append(f'شناسنامهٔ کهنه: {esm} در کد نیست')
    if dadeh:
        fields = dadeh_fields()
        for esm in sorted(dadeh):
            if esm not in fields:
                bad.append(f'فیلدِ داده در داده نیست: {esm} (نه در usage.jsonl نه در opencode-go.json)')
    if open(j.MASIR_JADVAL, encoding='utf-8').read() != j.sakht():
        bad.append('جدولِ متغیرها کهنه است: python3 Doc/abzar/jadval_motaghayer.py')
    if not os.path.exists(j.MASIR_SAKHTE) or open(j.MASIR_SAKHTE, encoding='utf-8').read() != j.sakht_shenasname_sakhte():
        bad.append('شناسنامهٔ ساخته (با عددِ امروز) کهنه است: python3 Doc/abzar/jadval_motaghayer.py')
    # واژه‌نامهٔ تابلو هم ساخته است؛ اگر از `jaye` عقب بماند، کارت آدرسِ کهنه نشان می‌دهد.
    if not os.path.exists(j.MASIR_VAZHENAME) or open(j.MASIR_VAZHENAME, encoding='utf-8').read() != j.sakht_vazhename():
        bad.append('واژه‌نامهٔ تابلو کهنه است: python3 Doc/abzar/jadval_motaghayer.py')
    for x in bad:
        print('❌', x)
    if bad_legacy:
        # بدهیِ قدیمی شمرده می‌شود و نمونه‌اش نشان داده می‌شود، ولی قرمزِ ما نیست.
        import collections
        cnt = collections.Counter(x.split('(')[1].split(':')[0] for x in bad_legacy)
        print('⚠️ بدهیِ قدیمی (پیش از ۲۳ نوامبر ۲۰۲۶، مالک: کارِ بعدی): ' + str(len(bad_legacy)) +
              ' بلوک — ' + ' · '.join(f'{k} {v}' for k, v in cnt.most_common()))
        for x in bad_legacy[:3]:
            print('   …', x)
    # صفر خطا باید سبز دیده شود، نه «۰ ❌» (ایرادِ سنجیده‌شده: آدم فکر می‌کرد قرمز است).
    alam = '✅' if not bad else '❌'
    print(f'متغیر: {len(esm_ha)} · شناسنامه: {len(sh)} · گمشده‌های ما: {len(bad)} · '
          f'گمشده‌های قدیمی: {len(bad_legacy)} · جمعِ ایرادهای ما: {len(bad)} {alam}')
    sys.exit(1 if bad else 0)


if __name__ == '__main__':
    main()
