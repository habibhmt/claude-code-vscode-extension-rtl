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
// ---------------- شناسنامهٔ هاور، به تفکیکِ پوشه (حبیب ۲۲ نوامبر ۲۰۲۶) ----------------
// هشت آزمونِ «هر پنجره فقط کارتِ پوشهٔ خودش» + دو فیلدِ تازه. اول آزمون‌های پایتون
// (بی مرورگر)، بعد دو صفحهٔ مرورگر: یکی بی دادهٔ پخته (تلهٔ بازگشتِ زودهنگام) و یکی
// با دادهٔ پختهٔ دو پروژه (حصارِ cwd).
const {spawnSync}=require('node:child_process');
const os=require('node:os'), P=require('node:path');
const REPO=__dirname;
function pyMfsr(){ const r=spawnSync(P.join(REPO,'abzar','py_tomllib.sh'),{encoding:'utf8',env:process.env}); if(r.status!==0) throw new Error('py_tomllib.sh: '+(r.stderr||'')); return r.stdout.trim(); }
function besaz(cwd){ const r=spawnSync(pyMfsr(),[P.join(REPO,'build-glossary.py'),'--cwd',cwd],{encoding:'utf8'}); return {code:r.status,out:r.stdout||'',err:r.stderr||''}; }
function proj(nam,toml){ const d=fs.mkdtempSync(P.join(os.tmpdir(),'crtl-gloss-'+nam+'-')); if(toml!==null){fs.mkdirSync(P.join(d,'doc'),{recursive:true}); fs.writeFileSync(P.join(d,'doc','shenasname_motaghayerha.toml'),toml);} return d; }
const TOML_A='[cow_buy_state]\nyani="خریدِ کوسواپ"\nchera="چون چرخه"\nnoe="khat_cow_pol_koja_raft"\nozv="charkhe/marhale.py"\nkhanandeha=["ledger"]\nba_motaghayerha=["cow_sell_state"]\ntarif="01"\ntayid="حبیب ۱۹ سپت «بله»"\n';
const TOML_B='[other_var]\nyani="مالِ پروژهٔ دیگر"\nchera="—"\nnoe="barge"\nozv="x.py"\nkhanandeha=[]\nba_motaghayerha=[]\ntarif=""\ntayid="—"\n';
const TOML_KHARAB='[bad]\nyani = "x "y" z"\n';

function azmayesh_python(){
 const A=proj('A',TOML_A), B=proj('B',TOML_B), N=proj('N',null), K=proj('K',TOML_KHARAB);
 const ra=besaz(A), rb=besaz(B), rn=besaz(N), rk=besaz(K);
 // (الف) کارت‌های هر پروژه فقط مالِ خودش
 const ca=JSON.parse(ra.out), cb=JSON.parse(rb.out);
 assert.ok(ca.cow_buy_state && !ca.other_var,'A باید کارتِ خودش را داشته باشد و کارتِ B را نه');
 assert.ok(cb.other_var && !cb.cow_buy_state,'B باید کارتِ خودش را داشته باشد و کارتِ A را نه');
 // (د) دو فیلدِ تازه
 const e=ca.cow_buy_state[0];
 assert.equal(e.noe,'khat_cow_pol_koja_raft','فیلدِ نوع');
 assert.deepEqual(e.ba,['cow_sell_state'],'فیلدِ هم‌خانواده');
 // (ب/ح) پوشهٔ بی‌شناسنامه: موفق و خالی، صفر خطا
 assert.equal(rn.code,0,'بی‌شناسنامه باید صفر باشد'); assert.equal(rn.out.trim(),'{}','بی‌شناسنامه باید {} بدهد'); assert.equal(rn.err,'','بی‌شناسنامه نباید خطا بدهد');
 // (ج) TOML خراب: خطای دیدنی با فایل و خط، صفر کارت
 assert.notEqual(rk.code,0,'TOML خراب باید کدِ غیرِ صفر بدهد');
 assert.ok(/shenasname_motaghayerha\.toml/.test(rk.err)&&/line \d+/.test(rk.err),'خطا باید فایل و شمارهٔ خط بدهد: '+rk.err);
 // (ط) پوشه‌ای که فقط TOML دارد (بی واژه‌نامه و بی برگه) هم کارت می‌دهد — همین A است
 // (ه) مفسر: زیرِ PATHِ تنگِ launchd هم tomllib دار باشد، و «هیچ‌کدام» خطای روشن بدهد
 const teng=spawnSync(P.join(REPO,'abzar','py_tomllib.sh'),{encoding:'utf8',env:{PATH:'/usr/bin:/bin'}});
 assert.equal(teng.status,0,'مفسر زیرِ PATHِ تنگ باید پیدا شود: '+(teng.stderr||''));
 assert.notEqual(teng.stdout.trim(),'/usr/bin/python3','۳٫۹ نباید انتخاب شود');
 const hich=spawnSync(P.join(REPO,'abzar','py_tomllib.sh'),{encoding:'utf8',env:{PATH:'/usr/bin:/bin',PY_TOMLLIB_CANDIDATES:'/usr/bin/python3'}});
 assert.equal(hich.status,1,'۳٫۹ تنها ⇒ باید خطا بدهد');
 assert.ok(/tomllib/.test(hich.stderr),'پیامِ خطا باید tomllib را بگوید');
 return {A,B};
}

const pageGloss=(text)=>`<!doctype html><html dir="rtl"><head><meta charset="utf-8"></head><body style="margin:0;font:16px/24px sans-serif;width:600px">
<div class="messagesContainer_x" style="padding:20px"><div id="wA" style="margin:10px 0">${text[0]}</div><div id="wB" style="margin:260px 0 10px">${text[1]}</div></div><div aria-label="Message input" contenteditable="true"></div></body></html>`;

async function safhe_gloss(browser, script, cards, baked){
 const ctx=await browser.newContext({viewport:{width:800,height:600}}); const p=await ctx.newPage();
 await p.route('http://g.local/',r=>r.fulfill({contentType:'text/html',body:pageGloss(['cow_buy_state','other_var'])}));
 if(baked) await p.addInitScript(`window.__CRTL_GLOSSARY=${JSON.stringify(baked)};`);
 await p.goto('http://g.local/');
 await p.addScriptTag({content:script});
 await p.waitForSelector('#crtl-panel',{state:'attached',timeout:20000});
 return {ctx,p};
}
async function hover(browser, script, cards, baked, cwd){
 const {ctx,p}=await safhe_gloss(browser,script,cards,baked);
 await p.waitForTimeout(1500);
 if(cwd) await p.evaluate(c=>window.__crtl_gloss_cwd(c),cwd);
 if(cards) await p.evaluate(c=>window.__crtl_gloss_set(c),cards);
 const box=await p.evaluate(()=>{const el=document.getElementById('wA');const r=document.createRange();r.selectNodeContents(el);const b=r.getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height};});
 await p.mouse.move(box.x+Math.max(4,box.width/2),box.y+box.height/2); await p.waitForTimeout(1000);
 const yes=await p.evaluate(()=>{const b=document.getElementById('crtl-gloss');return b&&b.style.display==='block'?b.innerText:'';});
 const boxB=await p.evaluate(()=>{const el=document.getElementById('wB');const r=document.createRange();r.selectNodeContents(el);const b=r.getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height};});
 await p.mouse.move(boxB.x+Math.max(4,boxB.width/2),boxB.y+boxB.height/2); await p.waitForTimeout(1000);
 const no=await p.evaluate(()=>{const b=document.getElementById('crtl-gloss');return b&&b.style.display==='block'?b.innerText:'';});
 await ctx.close();
 return {yes,no};
}

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
  const pr=azmayesh_python();
  out.glossA=(await hover(browser,script,JSON.parse(besaz(pr.A).out),null,null));
  assert.ok(/نوع/.test(out.glossA.yes)&&/هم‌خانواده/.test(out.glossA.yes),'کارت باید «نوع» و «هم‌خانواده» را نشان دهد: '+out.glossA.yes);
  assert.equal(out.glossA.no,'','اسمِ پروژهٔ دیگر نباید کارت بدهد');
  const cardA=(root)=>({root,p:'A',yani:'خرید',noe:'khat',ozv:'o',kh:['l'],ba:['b'],chera:'چ',tayid:'ت',tarif:[],loc:[]});
  out.glossHesar=(await hover(browser,script,null,{cow_buy_state:[cardA(pr.A)],other_var:[cardA(pr.B)]},pr.A));
  assert.ok(out.glossHesar.yes,'پشتیبانِ پخته برای همین پوشه باید کارت بدهد');
  assert.equal(out.glossHesar.no,'','کارتِ پوشهٔ دیگر نباید در این پنجره بیاید (حصارِ cwd)');
  console.log(JSON.stringify(out));
  assert.ok(out.basteh<300,'closed it is short');
  assert.ok(out.baz>=60*18,'under the mouse all 60 lines show: '+out.baz);
  assert.ok(out.dobareBasteh<300,'leaving closes it again');
 }finally{await browser.close()}
})().catch(e=>{console.error(e.message);process.exit(1)});
