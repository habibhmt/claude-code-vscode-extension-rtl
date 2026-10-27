// Browser test: a picked text colour (textColor) greys the conversation but not the code. On 27 Oct the
// MacBook window showed every code token in rgb(194,194,194): the ink rule's «span» also caught monaco's
// `<span class="mtkN">` inside <pre>, and its !important beat the token colours.
const {chromium}=require('playwright');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const script=fs.readFileSync(process.env.BUTTONS_JS||__dirname+'/claude-ui-buttons.js','utf8');
const page=`<!doctype html><html dir="rtl"><head><meta charset="utf-8"><style>.mtk5{color:rgb(86,156,214)}</style></head>
<body style="margin:0;width:600px"><div class="messagesContainer_x"><p><span id="fa">متنِ فارسی</span></p>
<pre><code><span><span id="k" class="mtk5">const</span></span></code></pre></div>
<div aria-label="Message input" contenteditable="true"></div></body></html>`;
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 try{
  const p=await (await browser.newContext()).newPage();
  await p.route('http://t.local/',r=>r.fulfill({contentType:'text/html',body:page}));
  await p.addInitScript(()=>localStorage.setItem('crtl-sizes',JSON.stringify({textColor:'#c2c2c2'})));
  await p.goto('http://t.local/');
  await p.addScriptTag({content:script});
  await p.waitForSelector('#crtl-size-style',{state:'attached',timeout:20000});
  await p.waitForTimeout(500);
  const o=await p.evaluate(()=>({fa:getComputedStyle(document.getElementById('fa')).color,k:getComputedStyle(document.getElementById('k')).color}));
  console.log(JSON.stringify(o));
  assert.equal(o.fa,'rgb(194, 194, 194)','the picked colour reaches the text (else the test lost the ink rule)');
  assert.equal(o.k,'rgb(86, 156, 214)','the code token keeps its own colour');
  console.log('ok: رنگِ متن به کد نمی‌رسد');
 }finally{await browser.close()}
})().catch(e=>{console.error(e.message);process.exit(1);});
