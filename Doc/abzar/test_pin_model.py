#!/usr/bin/env python3
"""آزمونِ ستارهٔ سنجاقِ منوی مدل — دو سرِ زنجیره.

حبیب ۲۶ نوامبر ۲۰۲۶ ۰۱:۲۹: «نه، ستاره که توپر بشه بره بالا، یه چیزِ قشنگ کدل مک او اس».

۱) سمتِ افزونه: پیامِ `ccg-pin` نباید به صفِ پیام‌های چت برسد و باید فایلِ
   سنجاق‌ها را بنویسد (سنجاق/بی‌سنجاق، بی‌تکرار). با یک کلاسِ ساختگی و
   همان کدِ پچ‌شده در node اجرا می‌شود، روی فایلِ موقت.
۲) سمتِ داده: بلوکِ «★ سنجاق‌شده» اولِ فهرست می‌آید، از هر پرووایدری
   (`vscode_model_catalog.cjs`).

اجرا: python3 Doc/abzar/test_pin_model.py     (کدِ خروج: ۰ سبز · ۱ قرمز)
"""
import importlib.util
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PATCH = ROOT / 'abzar' / 'darvaze' / 'scripts' / 'patch_model_pins.py'
CATALOG = ROOT / 'abzar' / 'darvaze' / 'scripts' / 'vscode_model_catalog.cjs'
MERGED = ROOT / 'abzar' / 'darvaze' / '.runtime' / 'opencode-go' / 'merged-models.json'

fail = 0


def sanj(name, got, want):
    global fail
    if got == want:
        print(f'✅ {name}')
        return
    fail += 1
    print(f'❌ {name}\n   گرفت: {got!r}\n   خواست: {want!r}')


def load_patch():
    spec = importlib.util.spec_from_file_location('patch_model_pins', PATCH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def reload_patch():
    # مسیرِ فایلِ سنجاق‌ها در زمانِ import خوانده می‌شود؛ آزمون به فایلِ موقت
    # سوئیچ می‌کند تا به فهرستِ واقعیِ حبیب دست نزند.
    spec = importlib.util.spec_from_file_location('patch_model_pins', PATCH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


# کلاسِ کمینه با همان لنگرِ افزونه: صفِ پیام‌ها + ان‌کیو.
SYNTHETIC = ('class A{constructor(){this.got=[];this.fromClientStream={enqueue:(m)=>{this.got.push(m)}}}'
             'fromClient(e){this.fromClientStream.enqueue(e)}}\n'
             'const a=new A();a.fromClient({type:"chat",text:"سلام"});'
             'a.fromClient({type:"ccg-pin",id:"deepseek-v4.1-flash",pinned:true});'
             'a.fromClient({type:"ccg-pin",id:"openai/gpt-5.2",pinned:true});'
             'a.fromClient({type:"ccg-pin",id:"deepseek-v4.1-flash",pinned:true});'
             'a.fromClient({type:"ccg-pin",id:"openai/gpt-5.2",pinned:false});'
             'console.log(JSON.stringify(a.got));\n')


def run_node(source, pins, cwd):
    script = Path(cwd) / 'harness.js'
    script.write_text(source, encoding='utf8')
    env = dict(os.environ, CCG_PINS=str(pins))
    done = subprocess.run(['/usr/bin/env', 'node', str(script)],
                          capture_output=True, text=True, env=env, cwd=cwd)
    return done


def main():
    global fail
    patch = load_patch()
    scratch = Path(tempfile.mkdtemp(prefix='ccg-pin-'))
    pins = scratch / 'pins.json'
    pins.write_text(json.dumps({'pins': []}), encoding='utf8')

    # ۱) پچ: نشانه یک‌بار، و کدِ ساخته‌شده پارس می‌شود.
    os.environ['CCG_PINS'] = str(pins)
    patch = reload_patch()
    patched, state = patch.patch_text(SYNTHETIC)
    sanj('پچ اعمال شد', state, 'patched')
    sanj('نشانه یک‌بار', patched.count(patch.MARK), 1)
    sanj('دستگیرهٔ پیام یک‌بار', patched.count('typeof e.id==="string"'), 1)

    # ۲) اجرای واقعی: پیامِ سنجاق به صفِ چت نمی‌رسد و فایل نوشته می‌شود.
    done = run_node(patched, pins, scratch)
    if done.returncode != 0:
        sanj('node اجرا شد', done.stderr.strip()[:400], '')
    else:
        sanj('پیام به صفِ چت نرسید', json.loads(done.stdout.strip()), [{'type': 'chat', 'text': 'سلام'}])
        sanj('فایلِ سنجاق‌ها', json.loads(pins.read_text(encoding='utf8')), {'pins': ['deepseek-v4.1-flash']})

    # ۳) بی‌سنجاق‌کردنِ همان چیزی که سنجاق شده بود.
    only_unpin = ('class A{constructor(){this.got=[];this.fromClientStream={enqueue:(m)=>{this.got.push(m)}}}'
                  'fromClient(e){this.fromClientStream.enqueue(e)}}\n'
                  'const a=new A();a.fromClient({type:"ccg-pin",id:"deepseek-v4.1-flash",pinned:false});\n')
    patched2, _ = patch.patch_text(only_unpin)
    run_node(patched2, pins, scratch)
    sanj('بی‌سنجاق شد', json.loads(pins.read_text(encoding='utf8')), {'pins': []})

    # ۴) فایلِ خراب نباید چیزی را بشکند: باز هم یک سنجاقِ تازه نوشته می‌شود.
    pins.write_text('not json', encoding='utf8')
    fresh_pin = ('class A{constructor(){this.got=[];this.fromClientStream={enqueue:(m)=>{this.got.push(m)}}}'
                 'fromClient(e){this.fromClientStream.enqueue(e)}}\n'
                 'const a=new A();a.fromClient({type:"ccg-pin",id:"beam-free",pinned:true});\n')
    patched3, _ = patch.patch_text(fresh_pin)
    run_node(patched3, pins, scratch)
    sanj('فایلِ خراب نجات یافت', json.loads(pins.read_text(encoding='utf8')), {'pins': ['beam-free']})

    # ۵) لنگرِ جاافتاده باید صدادار شکست بخورد، نه بی‌صدا.
    try:
        patch.patch_text('class B{fromClient(e){this.other(e)}}')
        sanj('لنگرِ ناموجود', 'بی‌صدا رد شد', 'ValueError')
    except ValueError:
        sanj('لنگرِ ناموجود', 'ValueError', 'ValueError')

    # ۶) سمتِ داده: بلوکِ سنجاق اولِ فهرست، از هر دو پرووایدر.
    rows = json.loads(MERGED.read_text(encoding='utf8'))
    opencode = next(r['id'] for r in rows if r.get('provider') == 'opencode')
    openrouter = next(r['id'] for r in rows if r.get('provider') == 'openrouter')
    pins.write_text(json.dumps({'pins': [openrouter, opencode]}), encoding='utf8')

    probe = Path(scratch) / 'probe.cjs'
    probe.write_text(
        'const { modelChoices } = require(' + json.dumps(str(CATALOG)) + ');\n'
        'const rows = modelChoices();\n'
        'console.log(JSON.stringify(rows.map(r => ({v: r.value, g: r.group, f: r.familyLabel, p: !!r.pinned}))));\n',
        encoding='utf8')
    env = dict(os.environ, CCG_PINS=str(pins))
    done = subprocess.run(['/usr/bin/env', 'node', str(probe)], capture_output=True, text=True, env=env)
    if done.returncode != 0:
        sanj('فهرست ساخته شد', done.stderr.strip()[:400], '')
    else:
        listed = json.loads(done.stdout)
        sanj('دو سنجاق اولِ فهرست', [r['v'] for r in listed[:2]], [opencode, openrouter])
        sanj('نشانهٔ سنجاق روی ردیف', [r['p'] for r in listed[:2]], [True, True])
        sanj('سرتیترِ بلوکِ سنجاق', [r['g'] for r in listed[:2]], ['★ سنجاق‌شده', '★ سنجاق‌شده'])
        # زیرسرتیتر = نامِ پرووایدر، تا معلوم باشد هر سنجاق از کجاست.
        sanj('زیرسرتیترِ پرووایدر', [r['f'] for r in listed[:2]], ['OpenCode Go', 'OpenRouter'])
        sanj('بدونِ تکرار', len(listed) == len({r['v'] for r in listed}), True)
        sanj('بقیهٔ فهرست سالم', len(listed), len(rows))

    # ۷) فایل نبود = هیچ سنجاقی، نه فهرستِ خالی.
    os.environ['CCG_PINS'] = str(scratch / 'missing.json')
    done = subprocess.run(['/usr/bin/env', 'node', str(probe)], capture_output=True, text=True,
                          env=dict(os.environ, CCG_PINS=str(scratch / 'missing.json')))
    sanj('بی‌فایلِ سنجاق', len(json.loads(done.stdout)), len(rows))
    sanj('هیچ بلوکِ سنجاقی', any(r['g'] == '★ سنجاق‌شده' for r in json.loads(done.stdout)), False)

    # ۸) همان کدی که واقعاً نصب شده — نه یک نمونهٔ ساختگی. اگر پچ روی افزونهٔ
    # نصب‌شده ننشسته باشد، ادعاهای بالا سبز می‌مانند و ستاره در VS Code بی‌اثر است
    # (همین اتفاق ۲۶ نوامبر ۰۱:۴۵ افتاد: پیام به افزونه نمی‌رسید).
    pins.write_text(json.dumps({'pins': []}), encoding='utf8')
    installed = sorted(Path.home().glob('.vscode/extensions/anthropic.claude-code-*/extension.js'))
    if not installed:
        sanj('افزونهٔ نصب‌شده', 'پیدا نشد', 'extension.js')
    else:
        bundle = installed[-1].read_text(encoding='utf8')
        sanj('نشانه روی افزونهٔ نصب‌شده', bundle.count(patch.MARK), 1)
        at = bundle.find(patch.MARK)
        start = bundle.index('fromClient(', at)
        depth, end = 0, None
        for i in range(start, len(bundle)):
            if bundle[i] == '{':
                depth += 1
            elif bundle[i] == '}':
                depth -= 1
                if depth == 0:
                    end = i + 1
                    break
        method = bundle[start:end]
        real = ('class X{constructor(){this.got=[];this.fromClientStream={enqueue:(m)=>{this.got.push(m)}}}'
                + method + '}\n'
                'const x=new X();x.fromClient({type:"ccg-pin",id:"openai/gpt-5.2",pinned:true});'
                'console.log(JSON.stringify(x.got));\n')
        # مسیرِ پخته‌شده در باندل مسیرِ *پیش‌فرض* است، نه مسیرِ آزمون؛
        # وگرنه آزمون فهرستِ واقعیِ حبیب را عوض می‌کند.
        baked = ROOT / 'abzar' / 'darvaze' / 'claude-api' / 'model-pins.json'
        if str(baked) not in real:
            sanj('مسیرِ سنجاق در باندل', 'پیدا نشد', str(baked))
        real = real.replace(str(baked), str(pins))
        done = run_node(real, pins, scratch)
        if done.returncode != 0:
            sanj('کدِ نصب‌شده اجرا شد', done.stderr.strip()[:300], '')
        else:
            sanj('پیام به صفِ چتِ نصب‌شده نرسید', json.loads(done.stdout.strip()), [])
            sanj('فایلِ سنجاق از کدِ نصب‌شده', json.loads(pins.read_text(encoding='utf8')),
                 {'pins': ['openai/gpt-5.2']})

    print(f'\n{"قرمز" if fail else "سبز"} — {fail} ایراد')
    return 1 if fail else 0


if __name__ == '__main__':
    sys.exit(main())
