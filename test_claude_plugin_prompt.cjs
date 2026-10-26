// Browser test: a message that is not Habib's (another session's, or a plugin's own prompt: «Prompt from the hads
// plugin», the «خودکار» the mod sends) has the panel's peer-message look: no box, grey, italic; one line, and under
// the mouse all of it. Habib's own keep their box (26 Oct 05:31: «مثل پیامای خودم نباشه قبلا پیامای سشن های دیگه
// یه فرمتی داشت که که خوب بود … همین خودکار رو هم مثل فرمت همون بکنش»).
const {chromium}=require('playwright');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const script=fs.readFileSync(process.env.BUTTONS_JS||__dirname+'/claude-ui-buttons.js','utf8');
const msg=(label,first)=>`<div class="message_x userMessageContainer_x">${label?'<div class="promptLabel_mLbNFw">Prompt from the hads plugin</div>':''}
<div class="userMessage_x" style="max-height:40px;overflow-y:auto;border:1px solid rgb(200, 0, 0);font-style:normal"><div class="expandableContainer_x"><div class="content_x">${first}<br>خودکار: یک<br>۱. دو<br>۲. سه</div></div></div></div>`;
const page=`<!doctype html><html dir="rtl"><body style="margin:0;font:13px/18px sans-serif;width:600px">
<div class="messagesContainer_x"><div id="p">${msg(true,'The hads plugin sent a message:')}</div><div id="s">${msg(false,'Another Claude session sent a message:')}</div><div id="pin" class="stickyHeader_x"><div class="userMessage_x" style="border:1px solid rgb(200, 0, 0);font-style:normal"><div class="content_x">The hads plugin sent a message:<br>خودکار</div></div></div><div id="u">${msg(false,'پیامِ خودِ حبیب')}</div>
<div id="says" class="metaMessage_x">UserPromptSubmit says: حافظه: 3 سابقه</div><div id="hk" class="metaMessage_x">\u2063۴ آبان · UserPromptSubmit · متنِ تزریقی</div></div>
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
  await p.waitForTimeout(900);
  const look=(id)=>p.evaluate((id)=>{const b=document.querySelector('#'+id+' [class*="userMessage_"]'),cs=getComputedStyle(b);return [cs.fontStyle,cs.borderTopColor==='rgba(0, 0, 0, 0)'?'bi-kadr':'kadr',document.querySelector('#'+id+' [class*="content_"]').getBoundingClientRect().height<30?'yek-khat':'bishtar']},id);
  const pinned=(await look('pin')).slice(0,2);assert.deepEqual(pinned,['italic','bi-kadr']);
  out.plugin=await look('p'); out.session=await look('s'); out.own=await look('u');
  assert.deepEqual(out,{plugin:['italic','bi-kadr','yek-khat'],session:['italic','bi-kadr','yek-khat'],own:['normal','kadr','yek-khat']});
  // under the mouse, all of it: the app's own cap (40vh, here 40px) lets go
  const bubble=(id)=>p.evaluate((id)=>Math.round(document.querySelector('#'+id+' [class*="userMessage_"]').getBoundingClientRect().height),id);
  await p.hover('#p [class*="content_"]');await p.waitForTimeout(900);
  out.hovered=await bubble('p')>=4*18;
  assert.equal(out.hovered,true);
  // the panel's own «UserPromptSubmit says: …» is not on the screen; the hook line is (26 Oct 05:46: «این هم دیگه نیاد روی صفحه»)
  out.says=await p.evaluate(()=>[getComputedStyle(document.getElementById('says')).display,getComputedStyle(document.getElementById('hk')).display]);
  assert.deepEqual(out.says,['none','block']);
 }finally{await browser.close()}
 console.log(JSON.stringify(out));
})().catch(e=>{console.error(e);process.exit(1)});
