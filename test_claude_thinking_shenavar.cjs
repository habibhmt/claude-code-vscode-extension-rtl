// «thinking» floats: the mod's three rows hide in the card and their words show in a see-through,
// click-through layer above the card, fading in one by one (Habib, 8 Nov 17:10).
const {chromium}=require('playwright');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const script=fs.readFileSync(process.env.BUTTONS_JS||__dirname+'/claude-ui-buttons.js','utf8');
const row=(l,t)=>`<div class="box_x" style="display:flex"><span class="text_x">${l}</span><span class="text_x">${t}</span></div>`;
const page=`<!doctype html><html dir="rtl"><body style="margin:0"><div class="messagesContainer_x" style="height:300px;margin-top:40px"></div>
<div class="abovePrompt_x"><div class="card_x" id="card"><div data-engine-mark>From the hads plugin</div><div class="band_x"><div class="box_x" id="part">
${row('دو جمله:','یک. دو.')}${row('به چه فکر کرد:','فکرِ یک کلمه دو')}${row('چه کرد:','کارِ سه')}${row('بعدش:','قدمِ چهار')}
</div></div></div></div><div aria-label="Message input" contenteditable="true"></div></body></html>`;
(async()=>{
 const b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 try{
  const p=await (await b.newContext({viewport:{width:900,height:500}})).newPage();
  await p.route('http://t.local/',r=>r.fulfill({contentType:'text/html; charset=utf-8',body:page}));
  p.on('pageerror',e=>console.log('PAGEERR',e.message));await p.goto('http://t.local/');
  await p.addScriptTag({content:script});await p.waitForTimeout(900);
  await p.waitForSelector('#crtl-panel',{state:'attached',timeout:5000});
  console.log(await p.evaluate(()=>{window.__crtl_neshan_hook_va_hads();return [document.querySelectorAll('.crtl-fekr-radif').length,[...document.querySelectorAll('#part span')].map(s=>s.textContent+'|'+s.className).join(' ; '),document.getElementById('card').className,typeof window.__crtl_shenavar_thinking,document.querySelectorAll('span[class*="text_"]').length]}));
  await p.waitForTimeout(1800);
  const r=await p.evaluate(()=>{const L=document.getElementById('crtl-fekr-shenavar');const cs=L&&getComputedStyle(L);
   const rows=[...document.querySelectorAll('.crtl-fekr-radif')];
   return {lay:!!L,pos:cs&&cs.position,pe:cs&&cs.pointerEvents,bg:cs&&cs.backgroundColor,resize:cs&&cs.resize,words:L?[...L.querySelectorAll('.crtl-fekr-kalame')].map(s=>s.textContent.trim()):[],
    hidden:rows.map(x=>getComputedStyle(x).display),op:rows.map(x=>getComputedStyle(x).opacity),wop:L&&getComputedStyle(L.querySelector('.crtl-fekr-kalame')).opacity,djShown:getComputedStyle(document.querySelector('#part').firstElementChild).display,
    above:L&&Math.abs(L.getBoundingClientRect().top-46)<2&&L.getBoundingClientRect().width<=900*0.38+1}});
  console.log(JSON.stringify(r));assert.equal(r.lay,true);assert.equal(r.pos,'fixed');assert.notEqual(r.bg,'rgba(0, 0, 0, 0)');assert.equal(r.resize,'both');
  assert.deepEqual(r.words,['فکرِ','یک','کلمه','دو','کارِ','سه','قدمِ','چهار']);
  assert.deepEqual(r.hidden,['flex','flex','flex']);assert.deepEqual(r.op,['1','1','1']);assert.deepEqual(r.wop,'0.85');assert.equal(r.djShown,'flex');assert.equal(r.above,true);
  // the box closed to its one button: the rows still come but are hidden in the card; the floater stays
  const baste1=await p.evaluate(()=>{document.getElementById('card').classList.add('crtl-hads-tak-dokme');return [...document.querySelectorAll('.crtl-fekr-radif')].map(x=>getComputedStyle(x).display).concat(!!document.getElementById('crtl-fekr-shenavar'))});
  assert.deepEqual(baste1,['none','none','none',true]);
  await p.evaluate(()=>document.getElementById('card').classList.remove('crtl-hads-tak-dokme'));
  // the rows go (box closed) ⇒ the last words stay
  await p.evaluate(()=>{document.querySelectorAll('.crtl-fekr-radif').forEach(x=>x.remove());window.__crtl_neshan_hook_va_hads()});
  const baste=await p.evaluate(()=>{const L=document.getElementById('crtl-fekr-shenavar');return L&&[...L.querySelectorAll('.crtl-fekr-kalame')].length});
  assert.equal(baste,8);
  // the whole card closed: the words sit above the prompt box
  await p.evaluate(()=>{document.getElementById('card').remove();window.__crtl_neshan_hook_va_hads()});await p.waitForTimeout(800);
  const ja=await p.evaluate(()=>{const L=document.getElementById('crtl-fekr-shenavar');return !!L&&Math.abs(L.getBoundingClientRect().top-46)<2});
  assert.equal(ja,true);
  // drag by ⠿ ⇒ moves, and the place is kept across a page reload
  const h=await p.locator('.crtl-fekr-dastgire').boundingBox();
  await p.mouse.move(h.x+h.width/2,h.y+h.height/2);await p.mouse.down();await p.mouse.move(200,150,{steps:5});await p.mouse.up();
  const after=await p.evaluate(()=>{const b=document.getElementById('crtl-fekr-shenavar').getBoundingClientRect();return [Math.round(b.top),localStorage.getItem('crtl-fekr-ja')]});
  assert.ok(Math.abs(after[0]-(150-(h.height/2)-0))<12,'moved '+after[0]);assert.ok(after[1]&&after[1].includes('"x"'),'saved '+after[1]);
  // the opacity setting reaches the box
  const pori=await p.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--crtl-fekr-pori-darsad').trim());
  assert.equal(pori,'75%');
  console.log('PASS',JSON.stringify(r));
 }finally{await b.close()}
})().catch(e=>{console.error('FAIL',e.message);process.exit(1)});
