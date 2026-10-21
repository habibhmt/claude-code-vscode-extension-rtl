// Browser test for the header row of keyword buttons (side "top") in
// claude-ui-buttons.js, on a stand-in for the Claude panel: header with the
// chat name, the empty spacer and three icons, plus the composer.
const {chromium}=require('playwright');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const SRC=process.env.BUTTONS_JS||__dirname+'/claude-ui-buttons.js';
const script=fs.readFileSync(SRC,'utf8');
const T1='کارایی که میکنی باید با هماهنگی ناظر باشه ها';
const T2='سوالاتو گزارش هات رو با اسک یوزر کوسشن بگو';
const OLD=[['reme','/remember:remember','right'],['comp','/compact','right'],['use','/usage','right'],['cont','/context','right'],
 ['art','این رو آرتیفکت کن','left'],['rev','/code-review','left'],['clr','/clear','left'],['btw','/btw ','left'],['rc','/remote-control','left'],['fast','/fast','left']]
 .map(([label,text,side])=>({label,text,side,send:false})).concat([{label:'focus',menu:'Focus view',side:'right'},{label:'rew',menu:'Rewind',side:'right'}]);
function page(spacer){return `<!doctype html><html dir="rtl"><body style="margin:0;font:13px sans-serif">
<div class="header_BrnsCQ" style="display:flex"><span class="headerTitle_BrnsCQ">Auto mode is enabled</span><div class="headerSpacer_BrnsCQ" style="flex:1"></div></div>
<div class="header_aqhumA" style="display:flex;gap:4px;padding:6px;align-items:center">
 <div class="titleGroup_aqhumA"><button class="titleText_aqhumA" style="white-space:nowrap">مجری-۱۳۶</button></div>
 ${spacer?'<div class="headerSpacer_aqhumA" style="flex:1"></div>':''}
 <button aria-label="Bookmarks" class="ic">B</button><button aria-label="Session history" class="ic">H</button><button aria-label="New session" class="ic">N</button>
</div>
<div style="height:300px"></div>
<div aria-label="Message input" contenteditable="true" style="min-height:40px;border:1px solid #888"></div>
</body></html>`}
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 const out={};
 try{
  const ctx=await browser.newContext({viewport:{width:900,height:600}});
  const p=await ctx.newPage();
  const open=async(o={})=>{
   await p.route('http://t.local/',r=>r.fulfill({contentType:'text/html',body:page(o.spacer!==false)}));
   await p.goto('http://t.local/');
   await p.evaluate(v=>{localStorage.clear();if(v)localStorage.setItem('crtl-sizes',v)},o.saved||null);
   await p.reload();
   await p.addScriptTag({content:script});
   await p.waitForSelector('#crtl-panel',{state:'attached',timeout:5000});
  };
  const composer=()=>p.evaluate(()=>document.querySelector('[aria-label="Message input"]').innerText.replace(/\n$/,''));
  const clear=()=>p.evaluate(()=>{document.querySelector('[aria-label="Message input"]').innerHTML=''});
  const topLabels=()=>p.$$eval('.crtl-top .crtl-btn',b=>b.map(x=>x.textContent));
  const clickTop=l=>p.evaluate(l=>[...document.querySelectorAll('.crtl-top .crtl-btn')].find(b=>b.textContent===l).click(),l);

  await open();
  // the row sits in the header spacer, 12 buttons
  out.inHeader=await p.evaluate(()=>!!document.querySelector('[class*="headerSpacer_"] > .crtl-top'));
  out.topCount=(await topLabels()).length; out.hads=(await topLabels()).slice(-2);
  assert.equal(out.inHeader,true); assert.equal(out.topCount,14); assert.deepEqual(out.hads,['h-on','h-off']);
  await clear(); await clickTop('h-on'); await clear(); await clickTop('h-off');
  out.hadsText=await composer(); await clear(); await clickTop('h-on'); out.hadsText=[await composer(),out.hadsText];
  assert.deepEqual(out.hadsText,['/hads on','/hads off']); await clear();
  // (الف) two clicks → two lines
  await clickTop('ناظر'); await clickTop('اسک');
  out.twoLines=await composer(); assert.equal(out.twoLines,T1+'\n'+T2);
  // (ب) multi-line text keeps its lines
  await clear(); await clickTop('ایجنت');
  out.agentLines=(await composer()).split('\n').length; assert.ok(out.agentLines>=2);
  // (ز) old button behaviour unchanged: "سلام" + comp stays on one line
  await clear();
  await p.evaluate(()=>{const e=document.querySelector('[aria-label="Message input"]');e.textContent='سلام'});
  await p.evaluate(()=>[...document.querySelectorAll('.crtl-bar:not(.crtl-top) .crtl-btn')].find(b=>b.textContent==='comp').click());
  out.compact=await composer(); assert.ok(!out.compact.includes('\n')&&out.compact.endsWith('/compact'),out.compact);
  // (هـ) old buttons still on their side columns
  out.oldLeft=await p.$$eval('.crtl-bar[data-side="left"] .crtl-btn',b=>b.map(x=>x.textContent));
  out.oldRight=await p.$$eval('.crtl-bar[data-side="right"] .crtl-btn',b=>b.map(x=>x.textContent));
  for(const l of ['art','rev','clr','btw','rc','fast']) assert.ok(out.oldLeft.includes(l),l);
  for(const l of ['reme','comp','use','cont','focus','rew']) assert.ok(out.oldRight.includes(l),l);
  // a real click with 2px of hand jitter is still a click, not a drag
  await clear();
  const jb=await p.locator('.crtl-top .crtl-btn',{hasText:'ساده'}).boundingBox();
  await p.mouse.move(jb.x+jb.width/2,jb.y+jb.height/2); await p.mouse.down();
  await p.mouse.move(jb.x+jb.width/2+2,jb.y+jb.height/2,{steps:2}); await p.mouse.up();
  out.jitterClick=await composer(); assert.equal(out.jitterClick,'نمیفهمم اینو به زبون ساده بگو');
  // (ج) drag «داستان» onto the right half of «اسک»: order changes, nothing typed
  await clear();
  const before=await topLabels();
  const src=await p.locator('.crtl-top .crtl-btn',{hasText:'داستان'}).boundingBox();
  const dst=await p.locator('.crtl-top .crtl-btn',{hasText:/^اسک$/}).boundingBox();
  await p.mouse.move(src.x+src.width/2,src.y+src.height/2); await p.mouse.down();
  await p.mouse.move(dst.x+dst.width*0.8,dst.y+dst.height/2,{steps:8}); await p.mouse.up();
  await p.waitForTimeout(100);
  const after=await topLabels();
  out.dragOrder=after.slice(0,4);
  assert.ok(after.indexOf('داستان')<after.indexOf('اسک'),JSON.stringify(after));
  assert.notDeepEqual(after,before);
  out.dragTyped=await composer(); assert.equal(out.dragTyped,'');
  // (د) the form: rename «ناظر», save, the header button follows
  await p.evaluate(()=>{const i=[...document.querySelectorAll('.crtl-cmd-label')].find(x=>x.value==='ناظر');i.value='ن۲';i.dispatchEvent(new Event('input'));
   [...document.querySelectorAll('#crtl-panel .crtl-btn')].find(b=>b.textContent==='ذخیرهٔ دکمه‌ها').click()});
  out.renamed=(await topLabels()).includes('ن۲'); assert.equal(out.renamed,true);
  // (ح) rew is still a menu button after a form save
  out.rewSaved=await p.evaluate(()=>JSON.parse(localStorage.getItem('crtl-sizes')).commands.find(c=>c.label==='rew'));
  assert.equal(out.rewSaved.menu,'Rewind'); assert.equal(out.rewSaved.text,undefined);
  out.formHasJson=await p.evaluate(()=>[...document.querySelectorAll('#crtl-panel textarea')].some(t=>t.value.trim().startsWith('[')));
  assert.equal(out.formHasJson,false);
  // (و) a list saved before this version still gets the 12, and a deleted one stays deleted
  await open({saved:JSON.stringify({commands:OLD})});
  out.seededCount=(await topLabels()).length; assert.equal(out.seededCount,14);
  await p.evaluate(()=>{const rows=[...document.querySelectorAll('.crtl-cmd-row')];const r=rows.find(x=>x.querySelector('.crtl-cmd-label').value==='حدس');
   [...r.querySelectorAll('.crtl-btn')].find(b=>b.textContent==='×').click()});
  await p.evaluate(()=>[...document.querySelectorAll('#crtl-panel .crtl-btn')].find(b=>b.textContent==='ذخیرهٔ دکمه‌ها').click());
  const saved=await p.evaluate(()=>localStorage.getItem('crtl-sizes'));
  await p.reload(); await p.addScriptTag({content:script}); await p.waitForSelector('#crtl-panel',{state:'attached'});
  out.afterDelete=(await topLabels()).length; assert.equal(out.afterDelete,13);
  assert.ok(saved.includes('"seeded"'));
  // (ط) narrow panel: chat name and the three icons stay visible
  await p.setViewportSize({width:350,height:600}); await p.waitForTimeout(100);
  out.narrow=await p.evaluate(()=>{const v=e=>{const r=e.getBoundingClientRect();return r.width>8&&r.left>=0&&r.right<=innerWidth+1};
   const t=document.querySelector('[class*="titleText_"]');
   return {title:v(t)&&t.getBoundingClientRect().width>=t.scrollWidth-1,icons:[...document.querySelectorAll('.ic')].every(v),scrolls:document.querySelector('.crtl-top').scrollWidth>document.querySelector('.crtl-top').clientWidth}});
  assert.deepEqual(out.narrow,{title:true,icons:true,scrolls:true});
  // the Auto mode banner has its own header spacer; the row must not land there
  out.notInBanner=await p.evaluate(()=>!!document.querySelector('.header_aqhumA .crtl-top')&&!document.querySelector('.header_BrnsCQ .crtl-top'));
  assert.equal(out.notInBanner,true);
  // React rebuilds the header (session switch): the row comes back by itself
  await p.evaluate(()=>{const h=document.querySelector('.header_aqhumA');const c=h.cloneNode(true);c.querySelectorAll('.crtl-top').forEach(x=>x.remove());h.replaceWith(c)});
  await p.waitForTimeout(2000);
  out.rebuilt=await p.$$eval('.header_aqhumA [class*="headerSpacer_"] .crtl-top .crtl-btn',b=>b.length);
  assert.equal(out.rebuilt,13);
  // header gone (new Claude build): the top buttons land in the left column, never vanish
  await p.setViewportSize({width:900,height:600});
  await open({spacer:false});
  out.fallback=await p.$$eval('.crtl-bar[data-side="left"] [data-top]',b=>b.length);
  assert.equal(out.fallback,14);
  console.log(JSON.stringify(out));
 } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exit(1)});
