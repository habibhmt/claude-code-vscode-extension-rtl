// Real browser events and React Router; no access to user chats or host services.
const {chromium}=require('playwright');
const {build}=require('esbuild');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const source=fs.readFileSync(__dirname+'/chatgpt-tabs.js','utf8');
const css=fs.readFileSync(__dirname+'/chatgpt-rtl.css','utf8');

(async()=>{
 const bundle=await build({stdin:{contents:`
 import React from 'react'; import {createRoot} from 'react-dom/client';
 import {createMemoryRouter,RouterProvider,useLocation,useNavigate} from 'react-router-dom';
 function App(){
  const {pathname}=useLocation(),navigate=useNavigate();
  const [open,setOpen]=React.useState(false);
  React.useEffect(()=>{
   if(pathname==='/extension/panel/new')return;
   const show=()=>setOpen(true);
   window.addEventListener('open-recent-tasks-menu',show);
   return()=>window.removeEventListener('open-recent-tasks-menu',show);
  },[pathname]);
  const select=()=>{setOpen(false);navigate('/local/chosen');};
  return React.createElement('main',null,
   React.createElement('h1',null,pathname),
   open&&React.createElement('section',{id:'native-history'},
    React.createElement('input',{id:'recent-tasks-search',placeholder:window.localized?'جستجوی گفتگوها':'Search recent chats'}),
    React.createElement('button',{'data-history-choice':true,onClick:select},'Selected chat'),
    React.createElement('button',{'data-close-history':true,onClick:()=>setOpen(false)},'Close history')),
   pathname==='/'&&React.createElement('button',{'data-home-choice':true,onClick:select},'Home chat'));
 }
 window.testRouter=createMemoryRouter([{path:'*',element:React.createElement(App)}],{initialEntries:[window.startPath]});
 window.__codexRoot=createRoot(document.getElementById('root'));
 window.__codexRoot.render(React.createElement(RouterProvider,{router:window.testRouter}));
 `,resolveDir:__dirname},bundle:true,write:false,format:'iife',platform:'browser'});
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:800,height:600}});
  await page.route('https://history.test/**',r=>r.fulfill({contentType:'text/html',body:'<html><body><div id="root"></div></body></html>'}));
  async function start(payload,path='/local/original',localized=false){
   await page.goto('https://history.test/');
   await page.evaluate(({path,localized})=>{sessionStorage.clear();window.startPath=path;window.localized=localized;},{path,localized});
   await page.addScriptTag({content:bundle.outputFiles[0].text});
   await page.addStyleTag({content:css});
   await page.addScriptTag({content:payload});
   await page.waitForFunction(()=>document.querySelector('#crtl-tabs [aria-selected=true]'));
  }
  async function openClock(){
   await page.locator('[data-crtl-sar-history]').click();
   await page.waitForSelector('#native-history');
  }
  async function verifyChosen(){
   // Wait past BOTH fallback timers, not just the first successful navigation.
   await page.waitForTimeout(850);
   assert.equal(await page.locator('h1').innerText(),'/local/chosen','History fallback must not undo a selected chat');
   assert.equal(await page.locator('#native-history').count(),0,'History must not reopen over the chosen chat');
  }
  const stateSource=fs.readFileSync(__dirname+'/chatgpt-panel-state.js','utf8');
  const bridge=`var crtlFolderPath=p=>p.replace(/\\/+$/,'');
    var crtlInitPanelApi=()=>{},crtlInitPanelRoots=()=>{};
    var crtlReadPanelRoots=async()=>({roots:window.roots});
    var crtlPanelApi={getState:()=>JSON.parse(localStorage.getItem('native-state')||'{}'),setState:s=>localStorage.setItem('native-state',JSON.stringify(s))};`+stateSource;
  async function boot(payload=source,roots=['/project136'],explicit=null){
   await page.goto('https://history.test/');
   await page.evaluate(({roots,explicit})=>{
    window.startPath=explicit||'/';window.roots=roots;
    if(explicit){const m=document.createElement('meta');m.name='initial-route';m.content=explicit;document.head.append(m);}
   },{roots,explicit});
   await page.addScriptTag({content:bridge});
   await page.addScriptTag({content:bundle.outputFiles[0].text});
   await page.addScriptTag({content:payload});
   await page.waitForTimeout(750);
  }
  await boot();
  await page.evaluate(()=>{crtlPanelApi.setState({...crtlPanelApi.getState(),nativeKey:'preserved'});testRouter.navigate('/local/imported-claude?hostId=local');});
  await page.waitForTimeout(100);
  await boot();
  const route=()=>page.evaluate(()=>testRouter.state.location.pathname+testRouter.state.location.search);
  assert.equal(await route(),'/local/imported-claude?hostId=local','Reload must restore the exact selected chat');
  assert.equal(await page.evaluate(()=>crtlPanelApi.getState().nativeKey),'preserved');
  await boot(source,['/different']);assert.equal(await route(),'/','Other workspace must not restore a foreign chat');
  await page.evaluate(()=>testRouter.navigate('/local/second-project'));
  await boot(source,['/different'],'/extension/panel/new');
  assert.equal(await route(),'/extension/panel/new','Explicit new panel must win');
  await page.evaluate(()=>testRouter.navigate('/'));
  await boot(source,['/different']);assert.equal(await route(),'/','Intentional home must stay home');
  await page.evaluate(()=>testRouter.navigate('/local/chosen'));
  const broken=source.replace('navigate(savedPath).then(updateTitle);','sync(router.state);');
  assert.notEqual(source,broken);
  await boot(broken,['/different']);
  await assert.rejects(async()=>assert.equal(await route(),'/local/chosen','Reload must restore the exact selected chat'),/Reload must restore/);
  console.log(JSON.stringify({reloadRestoresExactChat:true,nativeStatePreserved:true,workspaceIsolation:true,explicitNewWins:true,intentionalHome:true,sabotageDetected:true}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
