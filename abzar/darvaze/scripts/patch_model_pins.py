#!/usr/bin/env python3
"""ستارهٔ سنجاقِ منوی مدل: پیامِ webview را به فایلِ سنجاق‌ها وصل می‌کند.

حبیب ۲۶ نوامبر ۲۰۲۶ ۰۱:۲۹: «یه ستاره که توپر بشه بره بالا یه چیز قشنگ کدل مک او اس».
ستاره در سمتِ webview ساخته می‌شود (`patch_model_groups.py`) و با
`postMessage({type:"ccg-pin",id,pinned})` خبر می‌دهد. CSPِ webview هیچ `connect-src`
ندارد، پس webview نمی‌تواند مستقیم به دروازه یا فایل دست بزند؛ تنها راهِ مجاز همان
پیام به افزونه است. این پچ یک شاخهٔ کوچک پیش از صفِ پیام‌ها می‌گذارد که همان پیام را
به `claude-api/model-pins.json` می‌نویسد (نوشتنِ اتمیک: tmp + rename).

`vscode_model_catalog.cjs` همین فایل را می‌خواند و ردیف‌های سنجاق‌شده را در بلوکِ
«★ سنجاق‌شده» بالای همه می‌گذارد. لنگر یک رشتهٔ یکتاست؛ اگر بیلدِ تازه عوضش کند،
پچ صدا‌دار شکست می‌خورد و فایل دست‌نخورده می‌ماند.
"""
import json
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
# `CCG_PINS` فقط برای آزمون است: همان مسیری که `vscode_model_catalog.cjs` هم
# با آن جایگزین می‌کند، تا آزمون به فایلِ واقعیِ سنجاق‌ها دست نزند.
PINS = Path(os.environ.get('CCG_PINS') or ROOT / 'abzar' / 'darvaze' / 'claude-api' / 'model-pins.json')
MARK = '/* project216-model-pins */'

# fromClient(e){this.fromClientStream.enqueue(e)}
ANCHOR = re.compile(r'fromClient\((\w+)\)\{this\.fromClientStream\.enqueue\(\1\)\}')


def handler(ident):
    pins = json.dumps(str(PINS))
    return (
        f'{MARK}fromClient({ident}){{'
        f'if({ident}&&{ident}.type==="ccg-pin"&&typeof {ident}.id==="string"){{'
        f'try{{const __ccf=require("fs"),__ccp={pins};'
        f'let __ccd=[];try{{__ccd=JSON.parse(__ccf.readFileSync(__ccp,"utf8"))}}catch(__cce){{}}'
        f'const __ccl=Array.isArray(__ccd)?__ccd:Array.isArray(__ccd.pins)?__ccd.pins:[];'
        f'const __ccs=new Set(__ccl.filter(x=>typeof x==="string"&&x));'
        f'__ccs.delete({ident}.id);'
        f'if({ident}.pinned)__ccs.add({ident}.id);'
        f'const __cct=__ccp+"."+process.pid+".tmp";'
        f'__ccf.writeFileSync(__cct,JSON.stringify({{pins:[...__ccs]}},null,2));'
        f'__ccf.renameSync(__cct,__ccp)}}catch(__cce){{}}'
        f'return}}this.fromClientStream.enqueue({ident})}}'
    )


def patch_text(text):
    if MARK in text:
        return text, 'already patched'
    hits = list(ANCHOR.finditer(text))
    if len(hits) != 1:
        raise ValueError(f'webview message dispatcher changed (matched {len(hits)})')
    ident = hits[0].group(1)
    patched = text[:hits[0].start()] + handler(ident) + text[hits[0].end():]
    # نشانه و شاخهٔ سنجاق هر کدام یک‌بار؛ خودِ رشتهٔ "ccg-pin" ممکن است در جاهای
    # دیگرِ فایل هم باشد، پس شمرده نمی‌شود.
    if (patched.count(MARK) != 1
            or patched.count('typeof ' + ident + '.id==="string"') != 1
            or 'fromClientStream.enqueue(' + ident + ')' not in patched):
        raise ValueError('pin handler damaged')
    return patched, 'patched'


def main():
    if len(sys.argv) != 2:
        raise SystemExit('usage: patch_model_pins.py <extension.js>')
    target = Path(sys.argv[1]).expanduser().resolve()
    if target.name != 'extension.js':
        raise ValueError('not a Claude extension bundle')
    result, state = patch_text(target.read_bytes().decode())
    if state == 'already patched':
        print('already patched:', target.parent.name)
        return
    # extension.js یک ماژولِ CommonJS است؛ همان `node --check` کافی است.
    with tempfile.NamedTemporaryFile('w', dir=target.parent, suffix='.js', delete=False,
                                     encoding='utf-8') as tmp:
        tmp.write(result)
    try:
        check = subprocess.run(['/usr/bin/env', 'node', '--check', tmp.name],
                               capture_output=True, text=True)
        if check.returncode != 0:
            raise ValueError('patched extension.js does not parse:\n' + (check.stderr or '').strip()[:600])
    finally:
        Path(tmp.name).unlink(missing_ok=True)
    target.write_text(result, encoding='utf-8')
    print('patched model pins:', target.parent.name)


if __name__ == '__main__':
    main()
