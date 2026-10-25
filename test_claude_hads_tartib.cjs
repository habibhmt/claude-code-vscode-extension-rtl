// Browser test for dragging the «حدس» ticks (claude-ui-buttons.js), on a stand-in for the panel's
// band drawn with React itself, as the panel draws it: buttons with data-press-key, and the mod's
// hidden field as a controlled <input> in a <form>. A drag must send the new order through that
// field and must not toggle the tick; a plain click must still toggle it. The band's text is selectable,
// as in the panel, so a press on a tick must never start a selection or a native drag (Habib, 25 Oct 19:08:
// «اکثرا نمیشه جابجاش کرد»). And the box must not jump when «دو جمله» changes («نپره»).
const {chromium}=require('playwright');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const SRC=process.env.BUTTONS_JS||__dirname+'/claude-ui-buttons.js';
const script=fs.readFileSync(SRC,'utf8');
const nm=__dirname+'/node_modules/';
const KEYS=['hads','nakarde','khodkar','cron','do_jomle','porsesh','hook'];
const NAMES={hads:'حدس',nakarde:'نکرده‌ها',khodkar:'خودکار',cron:'کرون‌جاب',do_jomle:'دو جمله',porsesh:'پرسش',hook:'هوک‌ها'};
const page=`<!doctype html><html dir="rtl"><body style="margin:0;font:13px sans-serif"><div style="height:200px"></div>
<div class="abovePrompt_x"><div id="root"></div></div>
<div aria-label="Message input" contenteditable="true" style="min-height:40px;border:1px solid #888"></div></body></html>`;
const band=`(function(){var e=React.createElement;window.__presses=[];window.__inputs=[];var LONG='ایجنت الان دارد فایلِ بزرگی را می‌خواند و بعدش آزمون‌ها را اجرا می‌کند. منتظرِ این است که آزمون تمام شود و نتیجه را به حبیب بگوید، و این جمله عمداً بلند است تا چند خط بشود.';
function Field(){var s=React.useState(window.__order.join(' '));return e('form',{className:'field_HKVJBw',onSubmit:function(v){v.preventDefault()}},
 e('input',{className:'input_HKVJBw','data-press-key':'hads-tartib',value:s[0],onChange:function(v){s[1](v.target.value);window.__inputs.push(v.target.value)}}))}
function T(t){return e('span',{className:'text_HKVJBw'},t)}
function Band(){var n=React.useState('یک. دو.'),x=React.useState(3),m=React.useState(false);window.__setNow=n[1];window.__setRows=x[1];window.__setSum=m[1];
 return e('div',{className:'card_x'},e('div',{'data-engine-mark':''},'From the hads plugin'),
 e('div',{className:'band_mLbNFw',style:{overflow:'auto',maxHeight:'220px',width:'420px',userSelect:'text'}},e('div',{className:'box_HKVJBw',style:{display:'flex',flexDirection:'column'}},
  e('div',{className:'box_HKVJBw',style:{display:'flex'}},e('button',{type:'button',className:'button_HKVJBw','data-press-key':'hads-min'},'▾'),e('button',{type:'button',className:'button_HKVJBw','data-press-key':'hads-x'},'×')),
  e('div',{key:'dj',className:'box_HKVJBw',style:{display:'flex',flexDirection:'column'}},e('div',{className:'box_HKVJBw',style:{display:'flex',gap:'4px'}},T(m[0]?'جمع‌بندی:':'دو جمله:'),e('span',{id:'now',className:'text_HKVJBw'},n[0])),
   m[0]&&T('✓ کارِ یک · کارِ دو · کارِ سه · کارِ چهار · کارِ پنج · کارِ شش · کارِ هفت · کارِ هشت · کارِ نه · کارِ ده'),m[0]&&T('✗ کارِ یازده · کارِ دوازده · کارِ سیزده · کارِ چهارده · کارِ پانزده · کارِ شانزده')),
  e('div',{key:'hd',id:'hadsPart',className:'box_HKVJBw',style:{display:'flex',flexDirection:'column'}},Array.from({length:x[0]},function(_,i){return e('div',{key:i,className:'box_HKVJBw'},T(i?'      ':'حدس:'),T('حدسِ شمارهٔ '+i))})),
  e('div',{className:'box_HKVJBw',style:{display:'flex',flexWrap:'wrap',gap:'4px'}},
   window.__order.map(function(k){return e('button',{key:k,type:'button',className:'button_HKVJBw','data-press-key':'hads-tick-'+k,style:{padding:'2px 10px'},onClick:function(){window.__presses.push(k)}},'✓ '+window.__names[k])}),
   e(Field)))))}
window.__LONG=LONG;
ReactDOM.createRoot(document.getElementById('root')).render(e(Band));})()`;
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 const out={};
 try{
  const p=await (await browser.newContext({viewport:{width:900,height:500}})).newPage();
  await p.route('http://t.local/',r=>r.fulfill({contentType:'text/html',body:page}));
  await p.goto('http://t.local/');
  await p.addScriptTag({path:nm+'react/umd/react.production.min.js'});
  await p.addScriptTag({path:nm+'react-dom/umd/react-dom.production.min.js'});
  await p.evaluate(([k,n])=>{window.__order=k;window.__names=n},[KEYS,NAMES]);
  await p.addScriptTag({content:band});
  await p.waitForSelector('[data-press-key="hads-tick-cron"]');
  await p.addScriptTag({content:script});
  await p.waitForSelector('#crtl-panel',{state:'attached',timeout:5000});
  await p.evaluate(()=>window.__crtl_neshan_hook_va_hads());
  const box=k=>p.locator('[data-press-key="hads-tick-'+k+'"]').boundingBox();
  // the field is never seen
  out.fieldHidden=await p.evaluate(()=>getComputedStyle(document.querySelector('input[data-press-key="hads-tartib"]').closest('form')).display);
  assert.equal(out.fieldHidden,'none');
  // a plain click still toggles the tick, and sends no order
  await p.locator('[data-press-key="hads-tick-nakarde"]').click();
  out.click=await p.evaluate(()=>({presses:window.__presses.slice(),inputs:window.__inputs.length}));
  assert.deepEqual(out.click,{presses:['nakarde'],inputs:0});
  // a press on a tick never starts a text selection or a native drag
  out.pressPrevented=await p.evaluate(()=>{const b=document.querySelector('[data-press-key="hads-tick-cron"]');const ev=new MouseEvent('mousedown',{bubbles:true,cancelable:true,button:0});b.dispatchEvent(ev);document.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));return ev.defaultPrevented});
  assert.equal(out.pressPrevented,true);
  // drag «دو جمله» onto the right half of «حدس» (right-to-left: before it) ⇒ دو جمله first
  const drag=async(from,to,half)=>{const a=await box(from),b=await box(to);
   await p.mouse.move(a.x+a.width/2,a.y+a.height/2);await p.mouse.down();
   await p.mouse.move(a.x+a.width/2-20,a.y+a.height/2,{steps:4});
   await p.mouse.move(half==='right'?b.x+b.width*0.8:b.x+b.width*0.2,b.y+b.height/2,{steps:6});await p.mouse.up();
   await p.waitForTimeout(50)};
  await drag('do_jomle','hads','right');
  out.dragFirst=await p.evaluate(()=>({sent:window.__inputs[window.__inputs.length-1],presses:window.__presses.length}));
  assert.deepEqual(out.dragFirst,{sent:'do_jomle hads nakarde khodkar cron porsesh hook',presses:1});
  // even with the band's text selected, as after copying a line, a drag still moves the tick
  await p.evaluate(()=>window.getSelection().selectAllChildren(document.querySelector('[class*="band_"]')));
  // the left half of a tick is after it
  await drag('hads','cron','left');
  out.dragAfter=await p.evaluate(()=>window.__inputs[window.__inputs.length-1]);
  assert.equal(out.dragAfter,'nakarde khodkar cron hads do_jomle porsesh hook');
  // a drag that ends on the tick it started from moves nothing and does not toggle it
  const w=await box('khodkar'); const n0=await p.evaluate(()=>[window.__presses.length,window.__inputs.length]);
  await p.mouse.move(w.x+w.width*0.3,w.y+w.height/2);await p.mouse.down();await p.mouse.move(w.x+w.width*0.7,w.y+w.height/2,{steps:4});await p.mouse.up();await p.waitForTimeout(50);
  out.dragSelf=await p.evaluate(n=>[window.__presses.length-n[0],window.__inputs.length-n[1]],n0);
  assert.deepEqual(out.dragSelf,[0,0]);
  // a click right after a drag is the tick's own again
  await p.waitForTimeout(20);
  await p.locator('[data-press-key="hads-tick-hook"]').click();
  out.clickAfter=await p.evaluate(()=>window.__presses.slice());
  assert.deepEqual(out.clickAfter,['nakarde','hook']);
  // «نپره»: a long «دو جمله», then a short one ⇒ the rows below stay where they were, the band keeps its height
  const yHads=()=>p.evaluate(()=>[document.getElementById('hadsPart').getBoundingClientRect().top,document.querySelector('[class*="band_"]').getBoundingClientRect().height]);
  await p.evaluate(()=>window.__setNow(window.__LONG));await p.waitForTimeout(60);const lng=await yHads();
  await p.evaluate(()=>window.__setNow('کوتاه. تمام.'));await p.waitForTimeout(60);const krt=await yHads();
  out.noJump={rowsStay:Math.abs(lng[0]-krt[0])<1,bandStays:Math.abs(lng[1]-krt[1])<1,grew:lng[1]>0};
  assert.deepEqual(out.noJump,{rowsStay:true,bandStays:true,grew:true});
  // scrolled a little up from the end, a shorter «دو جمله» leaves the rows in sight where they were (the box once
  // let go of its height to measure it, and the browser pulled the scroll up)
  await p.evaluate(()=>window.__setRows(14));await p.evaluate(()=>window.__setNow(window.__LONG));await p.waitForTimeout(60);
  await p.evaluate(()=>{const b=document.querySelector('[class*="band_"]');b.scrollTop=b.scrollHeight-b.clientHeight-12;b.dispatchEvent(new Event('scroll'))});await p.waitForTimeout(30);
  const y0=await yHads();await p.evaluate(()=>window.__setNow('کوتاه.'));await p.waitForTimeout(60);const y1=await yHads();
  out.noClamp=Math.abs(y0[0]-y1[0])<1;assert.equal(out.noClamp,true);
  await p.evaluate(()=>{window.__setRows(3);window.__setNow('کوتاه. تمام.')});await p.waitForTimeout(60);
  // «جای خالی»: the turn's end puts the tall «جمع‌بندی» there; the next turn's first short «دو جمله» takes only its own
  // height (Habib, 26 Oct 01:57: «یه جای خالی بزرگ زیر دو جمله ای به وجود اومده»)
  const fitDj=()=>p.evaluate(()=>{const s=document.getElementById('now'),part=s.parentElement.parentElement;let h=0;for(const c of part.children)h+=c.getBoundingClientRect().height;return part.getBoundingClientRect().height-h});
  await p.evaluate(()=>{window.__setSum(true);window.__setNow(window.__LONG)});await p.waitForTimeout(60);
  await p.evaluate(()=>{window.__setSum(false);window.__setNow('کوتاه.')});await p.waitForTimeout(60);
  out.noGap=await fitDj()<2;assert.equal(out.noGap,true);
  // and within the turn, a shorter line still keeps the rows below in place
  await p.evaluate(()=>window.__setNow(window.__LONG));await p.waitForTimeout(60);const t0=await yHads();
  await p.evaluate(()=>window.__setNow('کوتاه.'));await p.waitForTimeout(60);const t1=await yHads();
  out.turnStays=Math.abs(t0[0]-t1[0])<1;assert.equal(out.turnStays,true);
  // a press on a button inside lets the box fit again
  await p.locator('[data-press-key="hads-tick-porsesh"]').click();await p.waitForTimeout(60);const fit=await yHads();
  out.fitAfterPress=fit[0]<krt[0]-1;assert.equal(out.fitAfterPress,true);
  // scrolled to the end, the band stays at the end when rows are added
  await p.evaluate(()=>window.__setRows(14));await p.waitForTimeout(60);
  await p.evaluate(()=>{const b=document.querySelector('[class*="band_"]');b.scrollTop=b.scrollHeight;b.dispatchEvent(new Event('scroll'))});await p.waitForTimeout(30);
  await p.evaluate(()=>window.__setRows(16));await p.waitForTimeout(60);
  out.staysAtEnd=await p.evaluate(()=>{const b=document.querySelector('[class*="band_"]');return b.scrollHeight-b.scrollTop-b.clientHeight<6});
  assert.equal(out.staysAtEnd,true);
 }finally{await browser.close()}
 console.log(JSON.stringify(out));
})().catch(e=>{console.error(e);process.exit(1)});
