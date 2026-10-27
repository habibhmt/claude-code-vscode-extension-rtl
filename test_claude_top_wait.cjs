// DOM test (jsdom, no browser) for the header row of keyword buttons when the panel's
// header is missing (a chat opened by a ?session= link) or has no chat name: the "top"
// buttons must never fall to the vertical left column; they wait and land in the header
// once it shows. Needs jsdom: NODE_PATH=<dir with jsdom> node test_claude_top_wait.cjs
const {JSDOM}=require('jsdom');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const SRC=process.env.BUTTONS_JS||__dirname+'/claude-ui-buttons.js';
const script=fs.readFileSync(SRC,'utf8');
const HEAD_NAMED='<div class="header_aq" style="display:flex"><div class="titleGroup_aq"><button class="titleText_aq">تحلیل</button></div><div class="headerSpacer_aq"></div></div>';
const HEAD_NONAME='<div class="header_aq" style="display:flex"><div class="headerSpacer_aq"></div><button aria-label="New session">N</button></div>';
const sleep=(ms)=>new Promise((r)=>setTimeout(r,ms));
async function panel(head){
  const dom=new JSDOM(`<!doctype html><html dir="rtl"><body><div id="h">${head}</div><div style="height:300px"></div><div aria-label="Message input" contenteditable="true"></div></body></html>`,{runScripts:'outside-only',pretendToBeVisual:true});
  dom.window.eval(script);
  await sleep(300);
  const w=dom.window, d=w.document;
  const leftTop=()=>d.querySelectorAll('.crtl-bar[data-side="left"] [data-top]').length;
  const inHeader=()=>{const b=d.querySelector('.crtl-top');return b&&b.closest('[class*="header_"]')?b.querySelectorAll('.crtl-btn').length:0};
  return {w,d,leftTop,inHeader};
}
(async()=>{
  const out={};
  // a header with the chat name: the row sits in it (as before)
  let p=await panel(HEAD_NAMED);
  out.named={left:p.leftTop(),header:p.inHeader()>0}; p.w.close();
  assert.deepEqual(out.named,{left:0,header:true});
  // a header without the chat name: still the header, never the left column
  p=await panel(HEAD_NONAME);
  out.noName={left:p.leftTop(),header:p.inHeader()>0}; p.w.close();
  assert.deepEqual(out.noName,{left:0,header:true});
  // no chat header, only the "Auto mode" banner (a header_ with a spacer): not there either
  p=await panel('<div class="header_bn" style="display:flex"><span class="headerTitle_bn">Auto mode is enabled</span><div class="headerSpacer_bn"></div></div>');
  out.banner={left:p.leftTop(),inBanner:p.d.querySelectorAll('.header_bn .crtl-top').length}; p.w.close()
  assert.deepEqual(out.banner,{left:0,inBanner:0});
  // no header at all: nothing vertical; once the header comes the row moves in
  p=await panel('');
  out.noHeader=p.leftTop();
  assert.equal(out.noHeader,0);
  // …but the row is not lost: it has its own strip at the top (Habib 27 Oct 22:46 «باید روی همه اینها کار بکنه»)
  const strip=()=>p.d.querySelectorAll('#crtl-top-jaygozin .crtl-top .crtl-btn').length;
  out.strip=strip()>0;
  assert.equal(out.strip,true);
  // and it waits quietly: the panel is not torn down and rebuilt every tick meanwhile
  const first=p.d.getElementById('crtl-panel');
  await sleep(1800);
  out.quietWait=!!first&&p.d.getElementById('crtl-panel')===first&&p.leftTop()===0;
  assert.equal(out.quietWait,true);
  p.d.getElementById('h').innerHTML=HEAD_NAMED;
  await sleep(1800);
  out.later={left:p.leftTop(),header:p.inHeader()>0,strip:!!p.d.getElementById('crtl-top-jaygozin')}; p.w.close();
  assert.deepEqual(out.later,{left:0,header:true,strip:false});
  console.log(JSON.stringify(out));
  process.exit(0);
})().catch((e)=>{console.error(e);process.exit(1)});
