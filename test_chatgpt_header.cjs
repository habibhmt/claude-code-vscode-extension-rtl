const {chromium}=require('playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
const css=fs.readFileSync(__dirname+'/chatgpt-rtl.css','utf8');
(async()=>{
 const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 try{
 const page=await browser.newPage({viewport:{width:900,height:700}});
 async function measure(payload){
 await page.setContent(`<html class="crtl-has-tabs"><style>body{margin:0}.draggable{padding:12px}.header-row{height:32px;display:flex;justify-content:space-between}.bottom{--thread-composer-bottom-inset:24px;padding-bottom:var(--thread-composer-bottom-inset)}button{width:30px;height:26px}</style><body><nav id="crtl-tabs"><button role="tab">A</button></nav><div id="root"><div class="draggable"><div class="header-row"><div style="view-transition-name:header-title">Duplicate title</div><div id="actions"><button onclick="window.clicked=true">⚙</button></div></div></div><div class="bottom pb-(--thread-composer-bottom-inset)"><div data-composer-surface-variant="default"><textarea></textarea><button>Send</button></div></div><div id="unrelated">Other title</div></div></body></html>`);
 await page.addStyleTag({content:payload});
 return page.evaluate(()=>({header:document.querySelector('.draggable').getBoundingClientRect().height,title:getComputedStyle(document.querySelector('[style*="header-title"]')).display,actions:document.querySelector('#actions').getBoundingClientRect().toJSON(),tabs:document.querySelector('#crtl-tabs').getBoundingClientRect().toJSON(),bottom:getComputedStyle(document.querySelector('.bottom')).paddingBottom,other:getComputedStyle(document.querySelector('#unrelated')).display}));
 }
 const good=await measure(css);assert.equal(good.header,0);assert.equal(good.title,'none');assert.equal(good.actions.y,good.tabs.y);assert.ok(good.actions.x>=good.tabs.right);assert.equal(good.bottom,'2px');assert.notEqual(good.other,'none');
 await page.locator('#actions button').click();assert.equal(await page.evaluate(()=>window.clicked),true);
 const bad=await measure(css.replace('height:0!important;min-height:0!important;padding:0!important;overflow:visible!important;', 'height:60px!important;min-height:0!important;padding:0!important;overflow:visible!important;').replace('padding-bottom:2px!important;', 'padding-bottom:40px!important;'));
 assert.throws(()=>assert.equal(bad.header,0));assert.throws(()=>assert.equal(bad.bottom,'2px'));
 const palettes=[];
 for(const hostColor of ['#101112','#282828']) {
  await page.setContent(`<html><body class="vscode-dark" style="--vscode-editor-background:${hostColor};--app-color-background-surface:${hostColor}"><div id="root"><div style="transform:translateY(100px);contain:layout"><div data-composer-surface-variant="default"><button data-composer-navigation-target="run-location">Local</button></div></div></div></body></html>`);
  await page.addStyleTag({content:css});
  palettes.push(await page.evaluate(()=>({background:getComputedStyle(document.body).backgroundColor,composer:getComputedStyle(document.querySelector('[data-composer-surface-variant]')).backgroundColor,locationTop:document.querySelector('button').getBoundingClientRect().top})));
 }
 assert.deepEqual(palettes[0],palettes[1]);assert.equal(palettes[1].locationTop,2);
 console.log(JSON.stringify({samePanelPalette:true,runLocationTop:palettes[1].locationTop,headerHeight:good.header,bottomInset:good.bottom,nativeButtonWorks:true,noOverlap:true,brokenHeaderDetected:true,brokenBottomDetected:true}));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
