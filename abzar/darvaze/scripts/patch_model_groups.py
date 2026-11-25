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

# آرایهٔ ناوبریِ کلیدهای جهت‌دار: x=ye(()=>[...m.map((Z)=>Z.value),...],[m,y,k,R])
# اگر این آرایه با فهرستِ دیده‌شده یکی نباشد، کلیدِ جهت‌دار ردیفِ دیگری را انتخاب
# می‌کند؛ پس همان مرتب‌سازی روی آن هم می‌نشیند و `__ccgVer` به وابستگی‌ها اضافه
# می‌شود تا پس از هر سنجاق، حافظهٔ useMemo باطل شود.
NAV_VALUES = re.compile(r'\.\.\.(\w+)\.map\(\((\w+)\)=>\2\.value\),')
NAV_DEPS = re.compile(r'\],\[([\w$]+(?:,[\w$]+)*)\]\)')

# let vscode=acquireVsCodeApi(); — نامِ متغیر در هر بیلد عوض می‌شود.
API = re.compile(r'([\w$]+)\s*=\s*(?:window\.)?acquireVsCodeApi\(\)')


# جست‌وجو: یک ورودی بالای فهرست که ردیف‌ها را با style.display پنهان می‌کند. عمداً
# بی‌state است — باندلِ مینیفای‌شده هوک‌هایش را به نامِ کوتاه صدا می‌زند و تزریقِ
# useState شکننده است؛ پنهان‌کردنِ DOM از هر رندرِ دوباره هم جانِ سالم به در می‌برد،
# چون این استایل را React نمی‌نویسد. حبیب ۲۶ نوامبر ۰۰:۵۶: «برای مدل‌ها یه سرچ هم بگذار».
#
# همان عنصر، ستارهٔ سنجاق را هم می‌سازد: `ref` یک بار پس از mount اجرا می‌شود و
# ستاره‌ها را داخلِ خودِ ردیف‌ها می‌گذارد — بدونِ دست‌زدن به ساختارِ React، پس
# ناوبریِ کلیدهای جهت‌دار و لیستِ React دست‌نخورده می‌ماند. MutationObserver اگر
# رندری ستاره را پاک کند دوباره سرِ جایش می‌گذارد.
# حبیب ۲۶ نوامبر ۰۱:۲۹: «ستاره‌ای که توپر بشه بره بالا … یه چیزِ قشنگ کدل مک او اس».
SEARCH = r'''__EL__("input",{key:"ccgq",type:"search",dir:"auto",className:"ccg-search",
placeholder:"جست‌وجوی مدل…",spellCheck:!1,autoComplete:"off",
onKeyDown:(e)=>{if(e.key!=="Escape")e.stopPropagation();},
ref:(node)=>{if(!node||node.__ccgStar)return;node.__ccgStar=!0;
const box=node.parentElement;if(!box)return;
const sync=()=>{for(const row of box.querySelectorAll('[role="option"]')){
const hit=/(\d+)$/.exec(row.id||"");if(!hit)continue;
const id=globalThis.__ccgIds&&globalThis.__ccgIds[+hit[1]];if(!id)continue;
if(row.querySelector(".ccg-star"))continue;
const on=!!(globalThis.__ccgPinned&&globalThis.__ccgPinned[id]);
const s=document.createElement("span");
s.className="ccg-star"+(on?" is-pinned":"");
s.textContent=on?"★":"☆";
s.title="سنجاق: بالای فهرست";
s.addEventListener("click",(ev)=>{ev.preventDefault();ev.stopPropagation();
const pin=!s.classList.contains("is-pinned");
s.classList.toggle("is-pinned",pin);s.textContent=pin?"★":"☆";
const p=globalThis.__ccgPinned||(globalThis.__ccgPinned={}),u=globalThis.__ccgUnpinned||(globalThis.__ccgUnpinned={});
if(pin){const v=Object.keys(p).map((k)=>p[k]).filter((n)=>typeof n==="number"&&n<1e9);
p[id]=(v.length?Math.min.apply(null,v):0)-1;delete u[id];}
else{delete p[id];u[id]=1;}
globalThis.__ccgVer=(globalThis.__ccgVer||0)+1;
try{__API__&&__API__.postMessage({type:"ccg-pin",id:id,pinned:pin})}catch(e){}
try{row.dispatchEvent(new MouseEvent("mousemove",{bubbles:true}))}catch(e){}});
row.appendChild(s);}};
sync();
new MutationObserver(sync).observe(box,{childList:!0,subtree:!0});},
onInput:(e)=>{const q=e.target.value.trim().toLowerCase(),
box=e.target.parentElement,
nodes=box?Array.prototype.slice.call(box.children):[];
nodes.forEach((k)=>{if(k===e.target)return;
if(k.getAttribute&&k.getAttribute("role")==="option"){
const hit=!q||(k.textContent||"").toLowerCase().indexOf(q)>=0;
k.style.display=hit?"":"none";}
else{k.style.display=q?"none":"";}});}},void 0)'''


def replacement(m):
    (shown, rows, model, index, el, row, row_id, unavailable, current, active,
     item_ref, hover, pick, check) = m.groups()
    css = replacement.css
    search = SEARCH.replace('__EL__', el).replace('__API__', replacement.api)
    return (
        # فهرست پیش از رندر با `__ccgSort` مرتب می‌شود: ردیف‌های سنجاق‌شده، از هر
        # پرووایدری، اول می‌آیند. مرتب‌سازی سمتِ webview است چون فهرستی که افزونه
        # می‌فرستد یک‌بار در شروعِ پنجره ساخته می‌شود و سنجاقِ تازه در آن نمی‌نشیند
        # (۲۶ نوامبر ۰۲:۰۰: فایل نوشته می‌شد ولی منو عوض نمی‌شد). همین تابع در
        # آرایهٔ ناوبریِ کلیدهای جهت‌دار هم استفاده می‌شود تا ناوبری از چشم جدا نشود.
        f'children:[{search},'
        f'(void(globalThis.__ccgSort||(globalThis.__ccgSort=(__r)=>{{'
        f'const __p=globalThis.__ccgPinned||(globalThis.__ccgPinned={{}}),'
        f'__u=globalThis.__ccgUnpinned||(globalThis.__ccgUnpinned={{}});'
        f'__r.forEach((__m,__i)=>{{if(__m.pinned&&!__u[__m.value]&&__p[__m.value]===undefined)__p[__m.value]=__i}});'
        f'const __k=(__v)=>__p[__v]===undefined?1e9:__p[__v];'
        f'return __r.map((__m,__i)=>[__k(__m.value),__i,__m]).sort((__a,__b)=>__a[0]-__b[0]||__a[1]-__b[1]).map((__t)=>__t[2])}})),null),'
        # بدونِ IIFE: نتیجهٔ مرتب‌سازی روی globalThis می‌نشیند و همان‌جا `.map` می‌شود؛
        # یک لایهٔ کمانِ کمتر یعنی شمارشِ بستن‌ها ساده‌تر و پچ شکننده‌تر نمی‌شود.
        f'{shown}&&(globalThis.__ccgR=globalThis.__ccgSort?globalThis.__ccgSort({rows}):{rows}).map(({model},{index})=>{{'
        # ستارهٔ سنجاق شناسه و وضعیتِ هر ردیف را از همین‌جا می‌گیرد؛ ردیفِ React
        # هیچ prop ناشناسی را به DOM نمی‌رساند، پس نقشه در globalThis می‌نشیند.
        f'(globalThis.__ccgIds||(globalThis.__ccgIds={{}}))[{index}]={model}.value;'
        f'const __ccg1={model}.group&&({index}===0||{model}.group!==globalThis.__ccgR[{index}-1].group),'
        f'__ccg2={model}.familyLabel&&({index}===0||{model}.group!==globalThis.__ccgR[{index}-1].group'
        f'||{model}.familyLabel!==globalThis.__ccgR[{index}-1].familyLabel);'
        f'return['
        f'__ccg1?{el}("div",{{className:{css}.sectionHeader,style:{{paddingTop:{index}?8:2,fontWeight:600,opacity:.8}},'
        f'children:{model}.group}},"ccgh"+{index}):null,'
        f'__ccg2?{el}("div",{{className:{css}.sectionHeader,'
        f'style:{{paddingInlineStart:18,fontSize:".86em",opacity:.55}},children:{model}.familyLabel}},"ccgf"+{index}):null,'
        f'{el}({row},{{model:{model},id:{row_id}({index}),isUnavailable:{unavailable}.has({model}.value),'
        f'isActive:{model}.value==={current},isCurrent:{active}==={model}.value,activeItemRef:{item_ref},'
        f'onHover:()=>{hover}({model}.value),onPick:()=>{pick}({model}),check:{check}}},{model}.value)'
        # closers: u(...) · return array · map body · map call
        + ']})'
        # children became an array ([search, ...rows]) so the bracket that opened
        # it must close before the props object — ۲۶ نوامبر ۲۰۲۶ همین یک `]` کم
        # بود و باندل در VS Code با «Unexpected token '}'» بالا نمی‌آمد.
        f']'
    )


replacement.css = 'kl'
replacement.api = None


def patch_nav(text):
    navs = list(NAV_VALUES.finditer(text))
    if len(navs) != 1:
        raise ValueError(f'model picker nav array changed (matched {len(navs)})')
    nav = navs[0]
    deps = NAV_DEPS.search(text, nav.end())
    if deps is None or deps.start() - nav.end() > 240:
        raise ValueError('model picker nav deps changed')
    # وابستگی‌ها اول عوض می‌شوند (جایشان بعد از لنگر است) تا اندیس‌ها جابه‌جا نشوند.
    text = (text[:deps.start()] + '],[' + deps.group(1) + ',globalThis.__ccgVer])'
            + text[deps.end():])
    nav = NAV_VALUES.search(text)
    rows, ident = nav.group(1), nav.group(2)
    return (text[:nav.start()]
            + f'...(globalThis.__ccgSort?globalThis.__ccgSort({rows}):{rows}).map(({ident})=>{ident}.value),'
            + text[nav.end():])


def patch_text(text):
    # Only the current mark counts: an older patch draws the family header right
    # after a provider change without redrawing it, and must be replaced.
    if MARK in text:
        return text, 'already patched'
    section = SECTION.search(text)
    if section is None:
        raise ValueError('model picker section header not found')
    replacement.css = section.group(1)
    # `acquireVsCodeApi()` فقط یک‌بار در bootstrapِ پنل صدا زده می‌شود و نتیجه‌اش
    # در یک متغیرِ محلیِ همان تابع می‌نشیند؛ رندرِ منوی مدل در دامنهٔ دیگری است و
    # به آن دسترسی ندارد (باگِ ۲۶ نوامبر ۰۱:۵۰: کلیک کار می‌کرد، پیام بی‌صدا
    # ReferenceError می‌شد و هیچ سنجاقی نوشته نمی‌شد). پس همان‌جا که ساخته می‌شود
    # در `globalThis.__ccgApi` هم گذاشته می‌شود.
    api = API.search(text)
    if api is None:
        raise ValueError('vscode api handle not found')
    replacement.api = 'globalThis.__ccgApi'
    pinned_api = f'{api.group(1)}=(globalThis.__ccgApi=acquireVsCodeApi())'
    text = text[:api.start()] + pinned_api + text[api.end():]
    hits = list(MAP.finditer(text))
    if len(hits) != 1:
        raise ValueError(f'model picker render anchor changed (matched {len(hits)})')
    patched = text[:hits[0].start()] + replacement(hits[0]) + text[hits[0].end():]
    patched = patch_nav(patched)
    if patched.count('"ccgh"+') != 1 or patched.count('"ccgf"+') != 1:
        raise ValueError('model group overlay damaged')
    if patched.count('"ccg-search"') != 1:
        raise ValueError('model search box damaged')
    if patched.count('ccg-star') != 2:  # className + querySelector in the star builder
        raise ValueError('model pin star damaged')
    if patched.count('globalThis.__ccgApi=') != 1:
        raise ValueError('vscode api handle is not reachable from the picker')
    if '__EL__' in patched or '__API__' in patched or '{el}' in patched:
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
