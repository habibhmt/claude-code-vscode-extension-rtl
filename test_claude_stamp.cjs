// The message clock (Claude's own, 2.1.306+) must not take a line of its own:
// it sits small on the first line of the message, left side, for both answers and prompts.
const {chromium}=require('playwright');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const script=fs.readFileSync(process.env.BUTTONS_JS||__dirname+'/claude-ui-buttons.js','utf8');
const css=`.message_07S1Yg{--message-padding-top:8px;display:flex;padding:var(--message-padding-top) 0 8px;position:relative;flex-direction:column;align-items:flex-start}
.timelineMessage_07S1Yg:has(>[data-message-stamp]){--message-padding-top:24px}
.timelineMessage_07S1Yg{padding-left:30px}
.timelineMessage_07S1Yg:before{content:"";position:absolute;left:9px;top:calc(var(--message-padding-top,8px) + 7px);width:7px;height:7px;border-radius:50%;background:#888}
.line_qaaThQ{display:flex;justify-content:flex-end;align-self:stretch;padding-bottom:2px}
.inPadding_qaaThQ{position:absolute;padding-bottom:0;top:6px;right:0}
.stamp_qaaThQ{white-space:nowrap;font-size:.85em;line-height:16px}
.bubble{border:1px solid #888;padding:8px;align-self:stretch;direction:rtl}`;
const html=`<!doctype html><html><head><style>${css}</style></head><body style="margin:0;font:13px sans-serif;width:600px">
<div class="message_07S1Yg" id="pm"><div class="line_qaaThQ" data-message-stamp=""><span><time id="ps" class="stamp_qaaThQ">PM 2:26</time></span></div><div class="bubble" id="pb">یعنی چی که از کود برداشته شده</div></div>
<div class="message_07S1Yg timelineMessage_07S1Yg" id="msg"><div class="line_qaaThQ inPadding_qaaThQ" data-message-stamp=""><span><time id="st" class="stamp_qaaThQ">PM 2:12</time></span></div><div id="tx" style="align-self:stretch;direction:rtl">هیچ کاری الان در جریان نیست</div></div>
<div aria-label="Message input" contenteditable="true"></div></body></html>`;
(async()=>{
 const b=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 try{
  const p=await b.newPage(); await p.setContent(html); await p.addScriptTag({content:script});
  await p.waitForSelector('#crtl-panel',{state:'attached',timeout:5000});
  const r=await p.evaluate(()=>{const g=id=>document.getElementById(id).getBoundingClientRect();const mid=x=>(x.top+x.bottom)/2;
   const st=g('st'),tx=g('tx'),m=g('msg'),ps=g('ps'),pb=g('pb'),pm=g('pm');
   return {answerSameLine:Math.abs(mid(st)-mid(tx))<=5,answerLeft:st.left<m.left+m.width/2,answerGap:Math.round(tx.top-m.top),answerClearsDot:st.left>=m.left+16+2,
    promptInBubble:ps.top>=pb.top&&ps.bottom<=pb.bottom,promptLeft:ps.left<pm.left+pm.width/2,promptGap:Math.round(pb.top-pm.top)}});
  console.log(JSON.stringify(r));
  assert.deepEqual(r,{...r,answerSameLine:true,answerLeft:true,answerClearsDot:true,promptInBubble:true,promptLeft:true});
  assert.ok(r.answerGap<=10,'answer gap '+r.answerGap); assert.ok(r.promptGap<=10,'prompt gap '+r.promptGap);
 } finally { await b.close(); }
})().catch(e=>{console.error(e.message);process.exit(1)});
