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
  // numbered history, ‹ › walk it (Habib, 8 Nov 20:04)
  const ta=await p.evaluate(()=>{window.__crtl_shenavar_thinking((()=>{const c=document.createElement('div');c.innerHTML='<div><span class="text_x">به چه فکر کرد:</span><span class="text_x">فکرِ تازه</span></div>';document.body.appendChild(c);return c})());
   const L=document.getElementById('crtl-fekr-shenavar'),sh=()=>L.querySelector('.crtl-fekr-shomare').textContent,w=()=>L.querySelector('.crtl-fekr-matn').textContent.trim();
   const o=[sh(),w()];L.querySelectorAll('.crtl-fekr-dokme')[0].click();o.push(sh(),w());L.querySelectorAll('.crtl-fekr-dokme')[1].click();o.push(sh());return o});
  assert.deepEqual(ta,['2/2','فکرِ تازه','1/2','فکرِ یک کلمه دو کارِ سه قدمِ چهار','2/2']);
  // each chat its own list (Habib, 8 Nov 20:56): chat B starts empty, A's list stays A's
  const jodā=await p.evaluate(()=>{const keys=()=>Object.keys(localStorage).filter(k=>k.startsWith('crtl-fekr-tarikhche'));
   window.__crtl_set_sid('A');const c=document.createElement('div');c.innerHTML='<div><span class="text_x">به چه فکر کرد:</span><span class="text_x">فکرِ آ</span></div>';document.body.appendChild(c);window.__crtl_shenavar_thinking(c);
   window.__crtl_set_sid('B');c.querySelectorAll('span')[1].textContent='فکرِ ب';window.__crtl_shenavar_thinking(c);
   const L=document.getElementById('crtl-fekr-shenavar');return [L.querySelector('.crtl-fekr-shomare').textContent,JSON.parse(localStorage.getItem('crtl-fekr-tarikhche:A')).length,JSON.parse(localStorage.getItem('crtl-fekr-tarikhche:B')).length,keys().includes('crtl-fekr-tarikhche')]});
  assert.deepEqual(jodā,['1/1',1,1,false],'jodā '+jodā);
  // right-click on its words: the chat's own menu (quote, copy, search …)
  await p.evaluate(()=>{const r=document.createRange();r.selectNodeContents(document.querySelector('#crtl-fekr-shenavar .crtl-fekr-matn'));getSelection().removeAllRanges();getSelection().addRange(r)});
  await p.click('#crtl-fekr-shenavar .crtl-fekr-kalame',{button:'right'});
  const menu=await p.evaluate(()=>{const m=document.getElementById('crtl-ctx');return m&&getComputedStyle(m).display!=='none'?[...m.querySelectorAll('button')].map(b=>b.textContent):[]});
  assert.ok(menu.some(t=>t.includes('نقل‌قول در چت'))&&menu.some(t=>t.includes('بدون علامت')),'menu '+menu);
  // right-click inside the «حدس» card: the same menu
  await p.evaluate(()=>{document.getElementById('crtl-ctx').style.display='none';const c=document.createElement('div');c.className='crtl-hads';c.id='hc';c.innerHTML='<span>حدسِ یک</span>';document.body.appendChild(c);const r=document.createRange();r.selectNodeContents(c.firstChild);getSelection().removeAllRanges();getSelection().addRange(r)});
  await p.evaluate(()=>document.querySelector('#hc span').dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:20,clientY:20})));
  const menu2=await p.evaluate(()=>{const m=document.getElementById('crtl-ctx');return getComputedStyle(m).display!=='none'?[...m.querySelectorAll('button')].map(b=>b.textContent):[]});
  assert.ok(menu2.some(t=>t.includes('نقل‌قول در چت')),'hads menu '+menu2);
  // the mod's hidden line: the chosen parts, in order, each with its title; an empty list ⇒ no floater (Habib, 8 Nov 21:18)
  const sh=await p.evaluate(()=>{const N='\u2063SHENAVAR';const c=document.createElement('div');document.body.appendChild(c);
   const put=o=>{c.innerHTML='<span class="text_x">'+N+JSON.stringify(o)+'</span>';window.__crtl_shenavar_thinking(c)};
   put({list:['cron','hads'],parts:[{k:'cron',esm:'کرون‌جاب',lines:['هر شب ⇐ ۲۳:۰۰']},{k:'hads',esm:'حدس',lines:['آزمون بزن']}]});
   const L=document.getElementById('crtl-fekr-shenavar');const o=[[...L.querySelectorAll('.crtl-fekr-onvan')].map(x=>x.textContent),L.querySelector('.crtl-fekr-matn').textContent.replace(/\s+/g,' ').trim(),getComputedStyle(c.firstChild).display];
   put({list:[],parts:[]});o.push(!!document.getElementById('crtl-fekr-shenavar'));c.remove();return o});
  assert.deepEqual(sh,[['کرون‌جاب','حدس'],'کرون‌جابهر شب ⇐ ۲۳:۰۰ حدسآزمون بزن','none',false],'sh '+JSON.stringify(sh));
  // v2.56.1: the data rides in the «تماس‌ها» line, which old pages already hide
  const am=await p.evaluate(()=>{const c=document.createElement('div');document.body.appendChild(c);
   c.innerHTML='<span class="text_x">\u2063AMAR'+JSON.stringify({shenavar:{list:['hads'],parts:[{k:'hads',esm:'حدس',lines:['از تماس‌ها']}]}})+'</span>';window.__crtl_shenavar_thinking(c);
   const L=document.getElementById('crtl-fekr-shenavar');const o=L&&L.querySelector('.crtl-fekr-matn').textContent.replace(/\s+/g,' ').trim();c.remove();return o});
  assert.equal(am,'حدساز تماس‌ها');
  console.log('PASS',JSON.stringify(r));
 }finally{await b.close()}
})().catch(e=>{console.error('FAIL',e.message);process.exit(1)});
