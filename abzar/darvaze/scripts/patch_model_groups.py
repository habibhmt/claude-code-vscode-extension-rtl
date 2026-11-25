#!/usr/bin/env python3
"""Draw provider and family headers inside the model picker.

The picker is one flat listbox, so the only way to keep providers apart is to
render a header row before the first model of each group. The model objects
already carry `group` and `familyLabel` (see vscode_model_catalog.cjs); this
patch only teaches the renderer to draw them, and does nothing when those
fields are absent.

Every minified name is captured from the file instead of hardcoded, so a new
extension build either matches or fails loudly. A failed match leaves the file
byte-identical and exits 1 — the installer reports it instead of shipping a
picker that silently lost its headers.
"""
import re
import subprocess
import sys
import tempfile
from pathlib import Path

MARK = '/* project216-model-groups v3 */'

# children:z&&h.map((te,pe)=>m(YFn,{model:te,id:AFt(pe),...},te.value))
# children:z&&h.map((te,pe)=>m(YFn,{model:te,id:AFt(pe),...},te.value))
# نامِ تابعِ ساختِ عنصر (`m` در ۲٫۱٫۳۲۸، `u` در ۲٫۱٫۳۳۲) جزءِ لنگر نیست: مینیفایِر
# هر بیلد عوضش می‌کند و ۲۵ نوامبر ۲۰۲۶ لنگر با `m`ِ ثابت روی ۲٫۱٫۳۳۲ نخورد.
MAP = re.compile(
    r'children:(\w+)&&(\w+)\.map\(\((\w+),(\w+)\)=>([\w$]+)\((\w+),\{model:\3,id:(\w+)\(\4\),'
    r'isUnavailable:(\w+)\.has\(\3\.value\),isActive:\3\.value===(\w+),isCurrent:(\w+)===\3\.value,'
    r'activeItemRef:(\w+),onHover:\(\)=>(\w+)\(\3\.value\),onPick:\(\)=>(\w+)\(\3\),check:(\w+)\},\3\.value\)\)'
)

# m("div",{className:kl.sectionHeader,id:LFt,children:"Select a model"})
SECTION = re.compile(r'className:(\w+)\.sectionHeader,id:\w+,children:"Select a model"')


# جست‌وجو: یک ورودی بالای فهرست که ردیف‌ها را با style.display پنهان می‌کند. عمداً
# بی‌state است — باندلِ مینیفای‌شده هوک‌هایش را به نامِ کوتاه صدا می‌زند و تزریقِ
# useState شکننده است؛ پنهان‌کردنِ DOM از هر رندرِ دوباره هم جانِ سالم به در می‌برد،
# چون این استایل را React نمی‌نویسد. حبیب ۲۶ نوامبر ۰۰:۵۶: «برای مدل‌ها یه سرچ هم بگذار».
SEARCH = (
    '{el}("input",{{key:"ccgq",type:"search",dir:"auto",className:"ccg-search",'
    'placeholder:"جست‌وجوی مدل…",spellCheck:!1,autoComplete:"off",'
    'onKeyDown:(e)=>{{if(e.key!=="Escape")e.stopPropagation();}},'
    'onInput:(e)=>{{const q=e.target.value.trim().toLowerCase(),'
    'box=e.target.parentElement,'
    'nodes=box?Array.prototype.slice.call(box.children):[];'
    'nodes.forEach((k)=>{{if(k===e.target)return;'
    'if(k.getAttribute&&k.getAttribute("role")==="option"){{'
    'const hit=!q||(k.textContent||"").toLowerCase().indexOf(q)>=0;'
    'k.style.display=hit?"":"none";}}'
    'else{{k.style.display=q?"none":"";}}}});}}}},void 0)'
)


def replacement(m):
    (shown, rows, model, index, el, row, row_id, unavailable, current, active,
     item_ref, hover, pick, check) = m.groups()
    css = replacement.css
    search = SEARCH.format(el=el)
    return (
        f'children:[{search},{shown}&&{rows}.map(({model},{index})=>{{'
        f'const __ccg1={model}.group&&({index}===0||{model}.group!=={rows}[{index}-1].group),'
        f'__ccg2={model}.familyLabel&&({index}===0||{model}.group!=={rows}[{index}-1].group'
        f'||{model}.familyLabel!=={rows}[{index}-1].familyLabel);'
        f'return['
        f'__ccg1?{el}("div",{{className:{css}.sectionHeader,style:{{paddingTop:{index}?8:2,fontWeight:600,opacity:.8}},'
        f'children:{model}.group}},"ccgh"+{index}):null,'
        f'__ccg2?{el}("div",{{className:{css}.sectionHeader,'
        f'style:{{paddingInlineStart:18,fontSize:".86em",opacity:.55}},children:{model}.familyLabel}},"ccgf"+{index}):null,'
        f'{el}({row},{{model:{model},id:{row_id}({index}),isUnavailable:{unavailable}.has({model}.value),'
        f'isActive:{model}.value==={current},isCurrent:{active}==={model}.value,activeItemRef:{item_ref},'
        f'onHover:()=>{hover}({model}.value),onPick:()=>{pick}({model}),check:{check}}},{model}.value)]}})'
        # children became an array ([search, ...rows]) so the bracket that opened
        # it must close before the props object — ۲۶ نوامبر ۲۰۲۶ همین یک `]` کم
        # بود و باندل در VS Code با «Unexpected token '}'» بالا نمی‌آمد.
        f']'
    )


replacement.css = 'kl'


def patch_text(text):
    # Only the current mark counts: an older patch draws the family header right
    # after a provider change without redrawing it, and must be replaced.
    if MARK in text:
        return text, 'already patched'
    section = SECTION.search(text)
    if section is None:
        raise ValueError('model picker section header not found')
    replacement.css = section.group(1)
    hits = list(MAP.finditer(text))
    if len(hits) != 1:
        raise ValueError(f'model picker render anchor changed (matched {len(hits)})')
    patched = text[:hits[0].start()] + replacement(hits[0]) + text[hits[0].end():]
    if patched.count('"ccgh"+') != 1 or patched.count('"ccgf"+') != 1:
        raise ValueError('model group overlay damaged')
    if patched.count('"ccg-search"') != 1:
        raise ValueError('model search box damaged')
    if '{el}' in patched:
        raise ValueError('search box placeholder left unsubstituted')
    return MARK + '\n' + patched, 'patched'


def main():
    if len(sys.argv) != 2:
        raise SystemExit('usage: patch_model_groups.py <webview/index.js>')
    target = Path(sys.argv[1]).expanduser().resolve()
    if target.name != 'index.js' or target.parent.name != 'webview':
        raise ValueError('not a Claude webview bundle')
    before = target.read_bytes()
    result, state = patch_text(before.decode())
    if state == 'already patched':
        print('already patched:', target.parent.parent.name)
        return
    node = subprocess.run(['/usr/bin/env', 'node', '--version'], capture_output=True, text=True)
    if node.returncode != 0:
        raise FileNotFoundError('node not found')
    # `node --check` روی فایلِ `.js` آن را CommonJS می‌خواند و خطای دستورِ ماژول را
    # نمی‌بیند؛ مرورگر باندل را ماژول بار می‌کند. ۲۶ نوامبر ۲۰۲۶ همین تفاوت باعث
    # شد پچِ خراب تأیید شود و پنل در VS Code بالا نیاید ⇒ آزمونِ ماژول هم اجباری است.
    suffixes = ['.js']
    if 'import.meta' in result or re.search(r'(?m)^\s*(import|export)[\s{*]', result):
        suffixes.append('.mjs')
    for suffix in suffixes:
        with tempfile.NamedTemporaryFile('w', dir=target.parent, suffix=suffix, delete=False,
                                         encoding='utf-8') as tmp:
            tmp.write(result)
        try:
            patch = subprocess.run(['/usr/bin/env', 'node', '--check', tmp.name],
                                   capture_output=True, text=True)
            if patch.returncode != 0:
                raise ValueError('patched bundle does not parse as ' + suffix + ':\n'
                                 + (patch.stderr or '').strip()[:800])
        finally:
            Path(tmp.name).unlink(missing_ok=True)
    target.write_bytes(result.encode())
    print('patched model groups:', target.parent.parent.name)


if __name__ == '__main__':
    main()
