// Browser test: Habib's own long message opens in full when the mouse rests on it (Habib 27 Oct 16:03: «وقتی به پیام
// خودم هستم چند ثانیه نگه میدارم، باید پیامش کامل باز بشه مثل قبل»). The DOM is the 2.1.311 one: the app's own
// expandable box caps the text with an inline max-height and a «Show more» button, and the message pinned on
// top (stickyHeader) is capped at 40vh — the case in Habib's screenshot.
const {chromium}=require('playwright');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const script=fs.readFileSync(process.env.BUTTONS_JS||__dirname+'/claude-ui-buttons.js','utf8');
const khat=Array.from({length:60},(_,i)=>'خطِ '+(i+1)).join('\n');
const page=`<!doctype html><html dir="rtl"><head><meta charset="utf-8"><style>
.userMessage_07S1Yg{white-space:pre-wrap;display:block;border:1px solid #888;padding:4px 6px;overflow-x:hidden;overflow-y:hidden}
.content_xGDvVg{white-space:pre-wrap;overflow-x:hidden;overflow-y:hidden}.collapsed_xGDvVg{position:relative}
.truncationGradient_xGDvVg{position:absolute;height:50px;bottom:0;left:0;right:0}
.message_07S1Yg.stickyHeader_07S1Yg .userMessage_07S1Yg{cursor:pointer;overflow-y:auto;max-height:40vh}</style></head>
<body style="margin:0;font:13px/18px sans-serif;width:600px"><div class="messagesContainer_x">
<div class="message_07S1Yg stickyHeader_07S1Yg userMessageContainer_07S1Yg"><div id="u" class="userMessage_07S1Yg"><div class="expandableContainer_xGDvVg">
<div class="contentWrapper_xGDvVg"><div class="content_xGDvVg collapsed_xGDvVg" style="max-height:250px"><div>${khat}</div><div class="truncationGradient_xGDvVg"></div></div>
<div class="visuallyHidden_x"><button type="button" class="expandButton_xGDvVg">Show more</button></div></div></div></div></div>
<div style="height:600px"></div></div><div aria-label="Message input" contenteditable="true"></div></body></html>`;
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 const out={};
 try{
  const p=await (await browser.newContext({viewport:{width:800,height:1000}})).newPage();
  await p.route('http://t.local/',r=>r.fulfill({contentType:'text/html',body:page}));
  await p.goto('http://t.local/');
  await p.addScriptTag({content:script});
  await p.waitForSelector('#crtl-panel',{state:'attached',timeout:20000});
  await p.waitForTimeout(900);
  const h=()=>p.evaluate(()=>Math.round(document.getElementById('u').getBoundingClientRect().height));
  out.basteh=await h();
  await p.mouse.move(300,40);await p.waitForTimeout(1200);
  out.baz=await h();
  await p.hover('[aria-label="Message input"]',{force:true});await p.waitForTimeout(300);
  out.dobareBasteh=await h();
  console.log(JSON.stringify(out));
  assert.ok(out.basteh<300,'closed it is short');
  assert.ok(out.baz>=60*18,'under the mouse all 60 lines show: '+out.baz);
  assert.ok(out.dobareBasteh<300,'leaving closes it again');
 }finally{await browser.close()}
})().catch(e=>{console.error(e.message);process.exit(1)});
