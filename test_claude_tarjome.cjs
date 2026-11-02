// Browser test for «ترجمه» (claude-ui-buttons.js): the page gets the mod's file from the host and shows the
// Persian in place of the English answer; the original is one press away, Habib's messages and other answers
// stay, a translation never becomes HTML, and a redraw that drops it brings it back.
const {chromium}=require('playwright');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const SRC=process.env.BUTTONS_JS||__dirname+'/claude-ui-buttons.js';
const SID='12345678-1234-1234-1234-123456789012';
const page_html=`<!doctype html><html dir="rtl"><body><div class="messagesContainer_x">
<div class="userMessage_a" id="u">The patch is applied and every test passed here</div>
<div class="message_a" id="m"><span data-message-stamp>۰۵:۱۰</span><div class="root_a" id="asl"><ol><li>The <strong>patch</strong> is applied and every test passed here</li></ol></div></div>
<div class="message_a" id="o"><div id="digar">Another answer nobody translated at all</div></div>
</div><div aria-label="Message input" contenteditable="true"></div></body></html>`;
(async()=>{
  const b=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
  const p=await b.newPage();
  await p.setContent(page_html);
  await p.evaluate(()=>{window.acquireVsCodeApi=()=>({postMessage(m){(window.__sent=window.__sent||[]).push(m)},getState(){return{}},setState(){}})});
  await p.addScriptTag({content:fs.readFileSync(SRC,'utf8')});
  const key=await p.evaluate(()=>window.__crtl_kelid_tarjome('1. The **patch** is applied and every test passed here'));
  // must stay the same as kelid_tarjome in the mod: test_hads.mjs holds the same literal
  assert.equal(key,'Thepatchisappliedandeverytestpassedhere');
  const text='**ترجمه** `a.js`\n\n| یک | دو |\n|---|---|\n| سه | <img src=x onerror=window.__hack=1> |\n\n- بند';
  await p.evaluate(([SID,key,text])=>window.postMessage({type:'from-extension',message:{type:'io_message',message:{session_id:SID}}},'*'),[SID,key,text]);
  // the first pass after the chat's id arrives starts this chat's list afresh: the host answers it
  await p.waitForTimeout(3200);
  await p.evaluate(([SID,key,text])=>window.postMessage({type:'crtl-tarjome',sid:SID,mt:5,text:JSON.stringify({kelid:key,text})+'\n'},'*'),[SID,key,text]);
  await p.waitForTimeout(200);
  const vis=(s)=>p.evaluate((s)=>{const e=document.querySelector(s);return !!e&&getComputedStyle(e).display!=='none'&&e.getClientRects().length>0},s);
  const out={};
  out.shown=[await vis('#asl'),await vis('#m .crtl-tarjome-matn'),await vis('#m [data-message-stamp]')];
  out.parts=await p.evaluate(()=>{const m=document.querySelector('#m .crtl-tarjome-matn');return{strong:m.querySelector('strong')?.textContent,code:m.querySelector('code')?.textContent,cells:m.querySelectorAll('td').length,li:m.querySelectorAll('li').length,img:m.querySelectorAll('img').length,hack:window.__hack||0}});
  out.others=await p.evaluate(()=>[document.querySelectorAll('#u .crtl-tarjome-jabe').length,document.querySelectorAll('#o .crtl-tarjome-jabe').length]);
  await p.click('#m .crtl-tarjome-dokme');
  out.asl=[await vis('#asl'),await vis('#m .crtl-tarjome-matn')];
  await p.click('#m .crtl-tarjome-dokme');
  out.back=[await vis('#asl'),await vis('#m .crtl-tarjome-matn')];
  // a redraw drops the added box: the next pass (every 3 s) puts it back, once
  await p.evaluate(()=>document.querySelector('#m .crtl-tarjome-jabe').remove());
  await p.waitForTimeout(3300);
  out.redraw=await p.evaluate(()=>document.querySelectorAll('#m .crtl-tarjome-jabe').length);
  out.asked=await p.evaluate((SID)=>(window.__sent||[]).some(m=>m.type==='crtl-tarjome'&&m.sid===SID&&m.mt===5),SID);
  assert.deepEqual(out,{shown:[false,true,true],parts:{strong:'ترجمه',code:'a.js',cells:4,li:1,img:0,hack:0},others:[0,0],asl:[true,false],back:[false,true],redraw:1,asked:true});
  console.log(JSON.stringify(out));
  await b.close();
})().catch(e=>{console.error(e.message);process.exit(1)});
