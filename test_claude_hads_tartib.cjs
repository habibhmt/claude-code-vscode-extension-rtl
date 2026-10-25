// Browser test for dragging the «حدس» ticks (claude-ui-buttons.js), on a stand-in for the panel's
// band drawn with React itself, as the panel draws it: buttons with data-press-key, and the mod's
// hidden field as a controlled <input> in a <form>. A drag must send the new order through that
// field and must not toggle the tick; a plain click must still toggle it.
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
const band=`(function(){var e=React.createElement;window.__presses=[];window.__inputs=[];
function Field(){var s=React.useState(window.__order.join(' '));return e('form',{className:'field_HKVJBw',onSubmit:function(v){v.preventDefault()}},
 e('input',{className:'input_HKVJBw','data-press-key':'hads-tartib',value:s[0],onChange:function(v){s[1](v.target.value);window.__inputs.push(v.target.value)}}))}
function Band(){return e('div',{className:'card_x'},e('div',{'data-engine-mark':''},'From the hads plugin'),
 e('div',{className:'box_HKVJBw',style:{display:'flex',flexWrap:'wrap',gap:'4px'}},
  window.__order.map(function(k){return e('button',{key:k,type:'button',className:'button_HKVJBw','data-press-key':'hads-tick-'+k,style:{padding:'2px 10px'},onClick:function(){window.__presses.push(k)}},'✓ '+window.__names[k])}),
  e(Field)))}
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
  // drag «دو جمله» onto the right half of «حدس» (right-to-left: before it) ⇒ دو جمله first
  const drag=async(from,to,half)=>{const a=await box(from),b=await box(to);
   await p.mouse.move(a.x+a.width/2,a.y+a.height/2);await p.mouse.down();
   await p.mouse.move(a.x+a.width/2-20,a.y+a.height/2,{steps:4});
   await p.mouse.move(half==='right'?b.x+b.width*0.8:b.x+b.width*0.2,b.y+b.height/2,{steps:6});await p.mouse.up();
   await p.waitForTimeout(50)};
  await drag('do_jomle','hads','right');
  out.dragFirst=await p.evaluate(()=>({sent:window.__inputs[window.__inputs.length-1],presses:window.__presses.length}));
  assert.deepEqual(out.dragFirst,{sent:'do_jomle hads nakarde khodkar cron porsesh hook',presses:1});
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
 }finally{await browser.close()}
 console.log(JSON.stringify(out));
})().catch(e=>{console.error(e);process.exit(1)});
