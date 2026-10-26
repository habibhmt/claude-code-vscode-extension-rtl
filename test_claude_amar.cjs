// Browser test: «تماس‌ها», the small movable table left of the prompt box, drawn from the hidden line the hads mod
// renders: per part (vertical headings), the last hour / 24 h / all; a click opens it big with every call and its
// dollars; a drag moves it and the place is kept (Habib, 26 Oct 21:54).
const {chromium}=require('playwright');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const script=fs.readFileSync(process.env.BUTTONS_JS||__dirname+'/claude-ui-buttons.js','utf8');
const sefr={do_jomle:0,hads:0,nakarde:0,khodkar:0,cron:0,jambandi_nobat:0,porsesh:0,kol:0,usd:0};
const dade={saat:{...sefr,hads:1,nakarde:1,khodkar:1,cron:1,kol:1,usd:0.026},ruz:{...sefr,hads:1,nakarde:1,khodkar:1,cron:1,do_jomle:1,kol:2,usd:0.029},hame:{...sefr,hads:2,nakarde:1,khodkar:1,cron:1,do_jomle:1,jambandi_nobat:1,kol:3,usd:0.029},
  riz:[{t:Date.now()-6e5,b:['hads','nakarde','khodkar','cron'],rah:'fork',in:1000,out:100,cw:0,cr:100000,usd:0.026},{t:Date.now()-18e6,b:['do_jomle'],rah:'sonnet',in:1000,out:100,cw:0,cr:0,usd:0.003}]};
const line='⁣AMAR'+JSON.stringify(dade);
const page=`<!doctype html><html dir="rtl"><head><meta charset="utf-8"></head><body style="margin:0;font:13px/18px sans-serif;width:900px;height:600px">
<div class="abovePrompt_x"><div class="surface_x"><div data-engine-mark>From the hads plugin</div><div class="box_x"><span class="text_x" id="raw">${line.replace(/</g,'&lt;')}</span><button data-press-key="hads-dot">حدس ▸</button></div></div></div>
<div aria-label="Message input" contenteditable="true"></div></body></html>`;
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 const out={};
 try{
  const p=await (await browser.newContext({viewport:{width:900,height:600}})).newPage();
  await p.route('http://t.local/',r=>r.fulfill({contentType:'text/html',body:page}));
  await p.goto('http://t.local/');
  await p.addScriptTag({content:script});
  await p.waitForSelector('#crtl-amar',{timeout:5000});
  out.small=await p.evaluate(()=>{const b=document.getElementById('crtl-amar'),rows=[...b.querySelectorAll('tr')];
    return {hidden:getComputedStyle(document.getElementById('raw')).display,rows:rows.length,cols:rows[0].children.length,
      vertical:getComputedStyle(b.querySelector('.crtl-amar-amudi')).writingMode,heads:[...b.querySelectorAll('.crtl-amar-amudi')].map(x=>x.textContent).join(' '),
      hour:[...rows[1].children].map(x=>x.textContent).join(' '),left:Math.round(b.getBoundingClientRect().left)<20,dollar:/\$/.test(b.textContent),lines:getComputedStyle(b.querySelector('td')).borderTopStyle,narrow:Math.round(b.getBoundingClientRect().width)<=150}});
  assert.deepEqual(out.small,{hidden:'none',rows:4,cols:8,vertical:'vertical-rl',heads:'دو جمله حدس نکرده خودکار کرون جمع‌بندی پرسش کل',hour:'۰ ۱ ۱ ۱ ۱ ۰ ۰ ۱',left:true,dollar:false,lines:'solid',narrow:true});
  // a new copy of the line (the box drew again) is hidden at once, not up to a second later
  out.fast=await p.evaluate(()=>new Promise(res=>{const o=document.getElementById('raw'),n=document.createElement('span');n.className='text_x';n.id='raw2';n.textContent=o.textContent;o.replaceWith(n);
    setTimeout(()=>res(getComputedStyle(n).display),120)}));
  assert.equal(out.fast,'none');
  // a click opens it big: every call, with its dollars
  const r0=await p.evaluate(()=>{const r=document.getElementById('crtl-amar').getBoundingClientRect();return [r.left+10,r.top+10]});
  await p.mouse.click(r0[0],r0[1]);await p.waitForTimeout(300);
  out.big=await p.evaluate(()=>{const b=document.getElementById('crtl-amar');return {cls:b.classList.contains('crtl-amar-bozorg'),calls:b.querySelectorAll('.crtl-amar-riz tr').length-1,usd:b.querySelector('.crtl-amar-dolar').textContent,first:b.querySelector('.crtl-amar-riz tr:nth-child(2)').textContent.includes('$0.026')}});
  assert.deepEqual(out.big,{cls:true,calls:2,usd:'۱ ساعت: $0.026 · ۲۴ ساعت: $0.029 · کل: $0.029',first:true});
  // × makes it small again; a drag moves it and the place is kept
  await p.click('.crtl-amar-bastan');await p.waitForTimeout(300);
  const r1=await p.evaluate(()=>{const r=document.getElementById('crtl-amar').getBoundingClientRect();return [r.left+10,r.top+10]});
  await p.mouse.move(r1[0],r1[1]);await p.mouse.down();await p.mouse.move(r1[0]+200,r1[1]-150,{steps:5});await p.mouse.up();await p.waitForTimeout(200);
  out.drag=await p.evaluate(()=>{const b=document.getElementById('crtl-amar'),j=JSON.parse(localStorage.getItem('crtl-amar-ja'));return {small:!b.classList.contains('crtl-amar-bozorg'),moved:Math.round(b.getBoundingClientRect().left)>150,kept:!!j&&j.x>150}});
  assert.deepEqual(out.drag,{small:true,moved:true,kept:true});
 }finally{await browser.close()}
 console.log(JSON.stringify(out));
})().catch(e=>{console.error(e);process.exit(1)});
