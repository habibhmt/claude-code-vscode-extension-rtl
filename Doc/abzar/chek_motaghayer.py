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


def main():
    sh_masir = os.path.join(m.RISHE, 'Doc', 'shenasname_matn.toml')
    sh = tomllib.load(open(sh_masir, 'rb'))
    pish = open(os.path.join(m.RISHE, 'Doc', 'esm_pishnahadi.md'), encoding='utf-8').read()
    items = m.peyda_kardan()
    esm_ha = {}
    for a in items:
        esm_ha.setdefault(a['esm'], []).append(a)
    bad = []
    for esm, ja in esm_ha.items():
        b = sh.get(esm)
        if not b:
            bad.append(f'بی شناسنامه: {esm} ({ja[0]["file"]}:{ja[0]["khat"]})'); continue
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
    for esm in sh:
        if esm not in esm_ha:
            bad.append(f'شناسنامهٔ کهنه: {esm} در کد نیست')
    if open(j.MASIR_JADVAL, encoding='utf-8').read() != j.sakht():
        bad.append('جدولِ متغیرها کهنه است: python3 Doc/abzar/jadval_motaghayer.py')
    if not os.path.exists(j.MASIR_SAKHTE) or open(j.MASIR_SAKHTE, encoding='utf-8').read() != j.sakht_shenasname_sakhte():
        bad.append('شناسنامهٔ ساخته (با عددِ امروز) کهنه است: python3 Doc/abzar/jadval_motaghayer.py')
    for x in bad:
        print('❌', x)
    print(f'متغیر: {len(esm_ha)} · شناسنامه: {len(sh)} · جمع: {len(bad)} ❌')
    sys.exit(1 if bad else 0)


if __name__ == '__main__':
    main()
