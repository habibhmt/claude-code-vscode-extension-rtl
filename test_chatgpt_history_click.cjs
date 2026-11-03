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
  await start(source);await openClock();await page.locator('[data-history-choice]').click();await verifyChosen();
  // Closing without choosing must also stay on the existing chat, not go home.
  await start(source);await openClock();
  await page.locator('[data-close-history]').click();
  await page.waitForTimeout(850);
  assert.equal(await page.locator('h1').innerText(),'/local/original');
  // Native IDs work even when Codex translates the placeholder.
  await start(source,'/local/original',true);await openClock();await page.waitForTimeout(850);
  assert.equal(await page.locator('h1').innerText(),'/local/original');
  await page.locator('[data-history-choice]').click();await verifyChosen();
  // A fresh composer has no native header; retain its home/menu fallback.
  await start(source,'/extension/panel/new');await openClock();
  await page.locator('[data-history-choice]').click();await verifyChosen();
  // If a home row is chosen during the second timer, do not reopen the menu.
  await start(source,'/extension/panel/new');await page.locator('[data-crtl-sar-history]').click();
  await page.locator('[data-home-choice]').click();await verifyChosen();
  if(!process.env.SKIP_SABOTAGE){
   const broken=source.replace('if (sawMenu || menuBaz() || currentPath() !== requestedPath) return;', 'if (menuBaz()) return;');
   assert.notEqual(broken,source,'Sabotage anchor disappeared');
   // the break shows only if its timer beats the check, so a busy machine gets more tries
   let caught=false;
   for(let i=0;i<4&&!caught;i++){
    await start(broken);await openClock();await page.locator('[data-history-choice]').click();
    await verifyChosen().catch(e=>{assert.match(e.message,/History fallback must not undo/);caught=true;});
   }
   assert.ok(caught,'Sabotage was not detected');
  }
  console.log(JSON.stringify({fastSelectionStaysOpen:true,closingMenuKeepsChat:true,localizedMenu:true,newComposerFallback:true,noLateReopen:true,sabotageDetected:!process.env.SKIP_SABOTAGE}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
