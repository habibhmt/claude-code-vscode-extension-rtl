// Browser test: 2.1.311 colours code blocks in replies (monaco tokens, `<span class="mtkN">` inside <pre><code>).
// Under the RTL patch a coloured block must stay left-to-right, tokens in source order, and keep its
// token colours (the font is the patch's one font everywhere, Vazirmatn first, as before 2.1.311) (Habib's window 27 Oct 14:23: «بله، بسنج»). Uses the patched index.css of the newest VS Code build.
const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const assert=require('node:assert/strict');
const ext=path.join(os.homedir(),'.vscode/extensions');
const webview=process.env.WEBVIEW_DIR||path.join(ext,fs.readdirSync(ext).filter(d=>/^anthropic\.claude-code-[\d.]+-darwin-arm64$/.test(d))
  .sort((a,b)=>a.localeCompare(b,undefined,{numeric:true})).pop(),'webview');
const css=fs.readFileSync(path.join(webview,'index.css'),'utf8');
const page=`<!doctype html><html dir="rtl"><head><meta charset="utf-8"><style>${css}</style>
<style>.mtk5{color:rgb(86,156,214)}.mtk6{color:rgb(206,145,120)}.mtk7{color:rgb(106,153,85)}</style></head>
<body style="margin:0;width:600px"><div class="messagesContainer_x"><div class="message_x"><p id="fa">این یک جملهٔ فارسی است.</p>
<div class="codeBlockWrapper_x"><pre><code id="c"><span><span id="k" class="mtk5">const</span><span class="mtk1"> x = </span><span id="s" class="mtk6">"سلام"</span><span class="mtk1">; </span><span id="m" class="mtk7">// توضیحِ فارسی</span></span><br/></code></pre></div>
</div></div></body></html>`;
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 try{
  const p=await (await browser.newContext()).newPage();
  await p.route('http://t.local/',r=>r.fulfill({contentType:'text/html',body:page}));
  await p.goto('http://t.local/');
  const o=await p.evaluate(()=>{const g=id=>getComputedStyle(document.getElementById(id));
   const c=document.getElementById('c').getBoundingClientRect(),k=document.getElementById('k').getBoundingClientRect();
   return {dir:g('c').direction,align:g('c').textAlign,codeFont:g('k').fontFamily,faFont:g('fa').fontFamily,
    kColor:g('k').color,sColor:g('s').color,mColor:g('m').color,keywordAtLeft:k.left-c.left<20};});
  console.log(JSON.stringify(o));
  assert.equal(o.dir,'ltr');
  assert.equal(o.align,'left');
  assert.ok(o.keywordAtLeft,'«const» must start at the left edge of the block');
  assert.ok(/Vazirmatn/i.test(o.faFont),'the Persian paragraph keeps Vazirmatn (else the test page lost the patch): '+o.faFont);
  assert.deepEqual([o.kColor,o.sColor,o.mColor],['rgb(86, 156, 214)','rgb(206, 145, 120)','rgb(106, 153, 85)']);
  console.log('ok: کدِ رنگی چپ‌به‌راست و با رنگ‌هایش');
 }finally{await browser.close();}
})().catch(e=>{console.error(e.message);process.exit(1);});
