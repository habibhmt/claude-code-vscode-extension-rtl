// Isolated rendering fixture. Never connects to the user's browser or VS Code.
// NODE_PATH=/tmp/chatgpt-rtl-qa/node_modules node test_chatgpt_layout.cjs
const {chromium}=require('playwright');
const fs=require('fs');
const assert=require('node:assert/strict');
const css=fs.readFileSync(__dirname+'/chatgpt-rtl.css','utf8');
const fixture=`<html><head><style>
body{margin:0;font:16px/24px sans-serif}button{font:inherit}main{width:600px}
[data-codex-composer-request-navigation]{direction:ltr;text-align:left}
.option{display:flex;gap:8px}.prompt{white-space:pre-wrap}
[data-composer-input-layout]{min-height:var(--composer-editor-min-height);height:auto}
[data-composer-input-layout]>*{min-height:var(--composer-editor-min-height)}
[contenteditable] p{margin:0}.footer{height:32px;display:flex}
</style></head><body><main>
<div data-codex-composer-request-navigation><span class="prompt whitespace-pre-wrap">آیا Codex را به فارسی می‌خواهی؟</span><button class="option" role="radio"><span id="number">1</span><span id="label">بله</span></button><input placeholder="Other response"><code>const answer = true;</code></div>
<div data-composer-surface-variant="default"><div class="_ComposerLayoutInput_fixture"><div data-composer-input-layout="multiline" style="--composer-editor-min-height:120px"><div contenteditable="true"><p><br></p></div></div></div><div class="footer"><button>Send</button><button>Permissions</button></div></div>
</main></body></html>`;
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 try{
  const page=await browser.newPage();
  async function measure(payload){
   await page.setContent(fixture);await page.addStyleTag({content:payload});
   return page.evaluate(()=>{const q=s=>document.querySelector(s),cs=s=>getComputedStyle(q(s));return {direction:cs('[data-codex-composer-request-navigation]').direction,prompt:cs('.prompt').unicodeBidi,numberRight:q('#number').getBoundingClientRect().x>q('#label').getBoundingClientRect().x,code:cs('code').direction,height:q('[data-composer-input-layout]').getBoundingClientRect().height,composer:q('[data-composer-surface-variant]').getBoundingClientRect().height}});
  }
  const good=await measure(css);
  function checkRtl(x){assert.equal(x.direction,'rtl');assert.equal(x.prompt,'isolate');assert.equal(x.numberRight,true);assert.equal(x.code,'ltr')}
  function checkHeight(x){assert.ok(x.height<=28,`input is ${x.height}px`);assert.ok(x.composer<=76,`composer is ${x.composer}px`)}
  checkRtl(good);checkHeight(good);
  // Break the actual declaration, not a separate unrelated implementation.
  const brokenRtl=css.replace('direction:rtl!important;text-align:right!important;unicode-bidi:isolate!important;', 'direction:ltr!important;text-align:left!important;unicode-bidi:isolate!important;');
  assert.notEqual(brokenRtl,css);
  // Separate the mutation checks from fixture rendering errors.
  const lastRtl=await measure(brokenRtl);assert.throws(()=>checkRtl(lastRtl));
  const brokenHeight=css.replace('--composer-editor-min-height:24px!important;', '--composer-editor-min-height:120px!important;').replace('min-height:24px!important;height:auto!important;max-height:min(25dvh,8lh)!important;', 'min-height:120px!important;height:auto!important;max-height:min(25dvh,8lh)!important;');
  assert.notEqual(brokenHeight,css);const badHeight=await measure(brokenHeight);assert.throws(()=>checkHeight(badHeight));
  await measure(css);await page.locator('[contenteditable]').fill('خط اول\nخط دوم\nخط سوم\nخط چهارم');
  const grown=await page.locator('[data-composer-input-layout]').evaluate(e=>e.getBoundingClientRect().height);
  assert.ok(grown>good.height,`long draft did not grow: ${grown}`);
  // Native ConversationGap and work-divider structures from both installed IDEs.
  const transcript=`<style>
   body{font:16px/24px sans-serif}.flex{display:flex}.flex-col{flex-direction:column}
   .items-start{align-items:flex-start}.gap-2{gap:8px}.border-t{border-top:1px solid}
   .h-9{height:36px}.text-size-chat{font-size:16px}.w-full{width:100%}
   [data-thread-user-message-navigation-content]{padding-bottom:32px}
   pre{font-size:14px;line-height:22px}td{padding:9px}button{font:inherit}
   </style><div class="thread-scroll-container"><div data-thread-user-message-navigation-content>
   <div data-user-message-bubble>پیام قبلی</div>
   <div id="gap" aria-hidden="true" class="w-full" style="height:var(--conversation-item-gap,16px)"></div>
   <div id="elapsed" class="flex flex-col items-start gap-2 text-size-chat text-secondary">
    <div><button aria-expanded="false" onclick="this.setAttribute('aria-expanded',this.getAttribute('aria-expanded')!=='true')"><span class="tabular-nums">Worked for 1m</span></button></div><div class="w-full border-t"></div>
   </div>
   <div aria-hidden="true" class="w-full" style="height:var(--conversation-item-gap,16px)"></div>
   <p>پاسخ Codex</p><div id="thinking" class="h-9 overflow-hidden" aria-hidden="false"><span class="h-9" role="status">Thinking</span></div>
   <pre>const answer = true;</pre><table><tr><td>محتوا</td></tr></table>
   </div></div><aside><div id="outside" style="height:var(--conversation-item-gap,16px)"></div></aside>`;
  async function measureSpacing(payload){
   await page.setContent(transcript);if(payload)await page.addStyleTag({content:payload});
   return page.evaluate(()=>{const q=s=>document.querySelector(s),h=s=>q(s).getBoundingClientRect().height;return {
    gap:h('#gap'),status:h('#elapsed'),font:parseFloat(getComputedStyle(q('#elapsed .tabular-nums')).fontSize),thinking:h('#thinking'),
    outside:h('#outside'),codeLine:getComputedStyle(q('pre')).lineHeight,cellPadding:getComputedStyle(q('td')).paddingTop,
    bottom:parseFloat(getComputedStyle(q('[data-thread-user-message-navigation-content]')).paddingBottom),time:q('#elapsed').innerText
   }});
  }
  const before=await measureSpacing(''),spacing=await measureSpacing(css);
  function checkSpacing(x){assert.equal(x.gap,6);assert.ok(x.status<before.status);assert.equal(x.font,12);assert.equal(x.thinking,22);assert.equal(x.bottom,8);assert.equal(x.outside,16);assert.equal(x.codeLine,before.codeLine);assert.equal(x.cellPadding,before.cellPadding);assert.match(x.time,/Worked for 1m/)}
  checkSpacing(spacing);
  await page.locator('#elapsed button').click();assert.equal(await page.locator('#elapsed button').getAttribute('aria-expanded'),'true');
  const brokenSpacing=css.replace('--conversation-item-gap:6px!important','--conversation-item-gap:60px!important');
  assert.notEqual(brokenSpacing,css);const badSpacing=await measureSpacing(brokenSpacing);assert.throws(()=>checkSpacing(badSpacing));
  console.log(JSON.stringify({good,brokenRtlDetected:true,brokenHeightDetected:true,longDraftHeight:grown,spacingBefore:before,spacingAfter:spacing,brokenSpacingDetected:true}));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
