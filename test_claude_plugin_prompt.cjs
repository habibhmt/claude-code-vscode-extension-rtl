// Browser test: a plugin's own prompt («Prompt from the hads plugin», the «خودکار» the mod sends) is shown
// whole, while the person's own messages keep their one-line clamp (Habib, 26 Oct 05:07: «چرا پیامای خودکار
// توی صفحه دیده نمیشن متنشون»).
const {chromium}=require('playwright');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const script=fs.readFileSync(process.env.BUTTONS_JS||__dirname+'/claude-ui-buttons.js','utf8');
const msg=(label)=>`<div class="message_x userMessageContainer_x">${label?'<div class="promptLabel_mLbNFw">Prompt from the hads plugin</div>':''}
<div class="userMessage_x" style="max-height:40px;overflow-y:auto"><div class="expandableContainer_x"><div class="content_x" style="max-height:44px">The hads plugin sent a message:<br>خودکار: یک<br>۱. دو<br>۲. سه</div></div></div></div>`;
const page=`<!doctype html><html dir="rtl"><body style="margin:0;font:13px/18px sans-serif;width:600px">
<div class="messagesContainer_x"><div id="p">${msg(true)}</div><div id="u">${msg(false)}</div></div>
<div aria-label="Message input" contenteditable="true"></div></body></html>`;
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 const out={};
 try{
  const p=await (await browser.newContext()).newPage();
  await p.route('http://t.local/',r=>r.fulfill({contentType:'text/html',body:page}));
  await p.goto('http://t.local/');
  await p.addScriptTag({content:script});
  await p.waitForSelector('#crtl-panel',{state:'attached',timeout:5000});
  await p.waitForTimeout(100);
  const h=(id)=>p.evaluate((id)=>document.querySelector('#'+id+' [class*="content_"]').getBoundingClientRect().height,id);
  out.plugin=await h('p'); out.own=await h('u');
  out.sameAsOwn=out.plugin===out.own&&out.own<2*18;
  assert.equal(out.sameAsOwn,true);
  // under the mouse the app's own cap (40vh, here 40px) lets go: the whole message is in sight
  const bubble=(id)=>p.evaluate((id)=>document.querySelector('#'+id+' [class*="userMessage_"]').getBoundingClientRect().height,id);
  out.capped=await bubble('p');
  await p.hover('#p [class*="content_"]');await p.waitForTimeout(900);
  out.hovered=await bubble('p');
  assert.deepEqual([out.capped<=41,out.hovered>=4*18],[true,true]);
 }finally{await browser.close()}
 console.log(JSON.stringify(out));
})().catch(e=>{console.error(e);process.exit(1)});
