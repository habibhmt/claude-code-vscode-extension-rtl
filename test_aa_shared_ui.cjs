// Two actual Aa clients in hidden browser pages; real adapters and scratch store.
const fs=require('fs'),os=require('os'),path=require('path'),assert=require('assert/strict'),{Readable}=require('stream');
const {chromium}=require('playwright');
const home=fs.mkdtempSync(path.join(os.homedir(),'aa-ui-test-')),cwd=path.join(home,'work');fs.mkdirSync(cwd);
process.env.CRTL_AA_SHARED=path.join(home,'aa.json');process.env.CRTL_HOST_TEST='1';process.env.CRTL_AA_MODULE=process.env.AA_MODULE||path.join(__dirname,'dsh-rtl/aa-shared.cjs');
const shared=require(process.env.CRTL_AA_MODULE);os.homedir=()=>home;
require(process.env.HOST_JS||'./claude-host-hook.js');const H=global.__crtlHost;
(async()=>{let browser;try{
 const {apply}=await import('./dsh-rtl/index.js');const routes=new Map();apply({get(){},inject(deps,cb){if(deps.includes('webServer'))cb({effect:fn=>fn(),webServer:{register:r=>{routes.set(r.path,r.handler);return()=>{}}}})},logger:{info(){},warn(){}}});
 shared.save(home,'prefs','poshe',cwd,'',{aaTaze:false});
 browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 const context=await browser.newContext();context.setDefaultTimeout(8000);const cc=await context.newPage(),ds=await context.newPage();
 await cc.route('http://cc.local/',r=>r.fulfill({contentType:'text/html',body:'<div id="app"></div>'}));
 await cc.exposeFunction('__host',m=>{if(m.type==='crtl-aa-read'||m.type==='crtl-aa-save')return {type:'crtl-aa-state',ok:true,...H.aaPrefs(m,cwd)};return null;});
 await cc.goto('http://cc.local/');await cc.evaluate(cwd=>{window.acquireVsCodeApi=()=>({postMessage:m=>window.__host(m).then(r=>{if(r)window.postMessage(r,'*')}),getState:()=>({}),setState(){}});window.__crtl_sessions=new Set([{claudeChannelId:'cc-channel',cwd:{value:cwd},sessionId:{value:'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'},holdsNoConversation:()=>false}]);},cwd);
 await cc.addScriptTag({content:fs.readFileSync(process.env.BUTTONS_JS||'claude-ui-buttons.js','utf8')});await cc.evaluate(()=>window.acquireVsCodeApi());
 // In VS Code the shared settings may arrive before the first message box is mounted.
 await cc.evaluate(async()=>{
   const data=await window.__host({type:'crtl-aa-read'});
   window.dispatchEvent(new MessageEvent('message',{data}));
   document.querySelector('#app').innerHTML='<div class="chatContainer_y"><div class="messagesContainer_x">قدیمی</div><div class="inputContainer_y"><div class="messageInputContainer_x"><div aria-label="Message input" contenteditable="true"></div></div></div></div>';
 });
 await cc.waitForSelector('#crtl-panel',{state:'attached'});await cc.waitForFunction(()=>document.querySelector('#crtl-panel').textContent.includes('Aa در چت تازه: خاموش'));
 assert.equal(await cc.locator('#crtl-panel').evaluate(p=>getComputedStyle(p).position),'fixed','early settings must still install the panel stylesheet');
 assert.equal(await cc.locator('.crtl-gear').evaluate(p=>getComputedStyle(p).position),'fixed','Aa button must not enter the chat layout');
 await ds.exposeFunction('__request',async(url,init)=>{const u=new URL(url,'http://ds.local');const fn=routes.get(u.pathname);if(!fn)return {ok:true,global:{},project:{},chat:{},rows:[]};const req=Readable.from(init&&init.body?[Buffer.from(init.body)]:[]);Object.assign(req,{method:init?.method||'GET',url:u.pathname+u.search,headers:{host:'127.0.0.1','content-type':'application/json'},socket:{remoteAddress:'127.0.0.1'}});let out;await fn(req,{setHeader(){},end(s){out=JSON.parse(s)}});return out;});
 await ds.route('http://ds.local/**',r=>r.fulfill({contentType:'text/html',body:'<div id="root"></div>'}));await ds.goto('http://ds.local/session/dsh-chat');
 await ds.addScriptTag({path:path.join(path.dirname(require.resolve('react/package.json')),'umd/react.development.js')});await ds.addScriptTag({path:path.join(path.dirname(require.resolve('react-dom/package.json')),'umd/react-dom.development.js')});
 await ds.evaluate(cwd=>{window.fetch=async(url,init)=>({ok:true,status:200,json:()=>window.__request(String(url),init)});window.__regs=[];window.__ModuleLoader__={load:def=>{window.__plugin=def.factory(name=>name==='react'?window.React:name==='react-dom'?window.ReactDOM:null)}};window.__ctx={get:name=>name==='sessions'?{list:{getSnapshot:()=>({ids:['dsh-chat'],byId:{'dsh-chat':{cwd}}})}}:undefined,effect:fn=>fn(),slots:{inject:(_,fn)=>fn(),register:(meta,comp)=>{window.__regs.push({meta,comp});return()=>{}}}};},cwd);
 await ds.addScriptTag({content:fs.readFileSync(process.env.DSH_UI||'dsh-rtl/client.js','utf8')});await ds.evaluate(()=>{window.__plugin.apply(window.__ctx);const dock=window.__regs.find(r=>r.meta.name==='conversation.input.dock');window.ReactDOM.createRoot(document.getElementById('root')).render(window.React.createElement(dock.comp,{sessionId:'dsh-chat',inputActions:{},useInput:sel=>sel({draft:'old'})}));});
 await ds.waitForSelector('.dsh-plus-aa');await ds.locator('.dsh-plus-aa').click();
 await ds.locator('.dsh-plus-line').filter({hasText:'در چتِ تازه، تبِ «ابزارها» خودش باز شود'}).locator('input').evaluate(el=>el.id='aa-test-toggle');const selector='#aa-test-toggle';await ds.waitForSelector(selector);await ds.waitForFunction(sel=>!document.querySelector(sel).checked,selector);assert.equal(await ds.locator(selector).isChecked(),false);
 await ds.locator(selector).check();await cc.waitForFunction(()=>document.querySelector('#crtl-panel').textContent.includes('Aa در چت تازه: روشن'));
 await cc.evaluate(()=>{document.querySelector('#crtl-panel').classList.add('crtl-open');});await cc.getByRole('button',{name:'Aa در چت تازه: روشن',exact:true}).click();
 await ds.waitForFunction(sel=>!document.querySelector(sel).checked,selector);assert.equal(shared.view(home,'prefs',cwd).values.aaTaze,false);
 console.log('aa UI: DSH→Claude→DSH aaTaze, folder scope, open tabs: PASS');
 }finally{if(browser)await browser.close();fs.rmSync(home,{recursive:true,force:true});}})().catch(e=>{console.error(e);process.exitCode=1;});
