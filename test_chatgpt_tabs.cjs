// Browser regression test using a real React root and React Router, isolated
// from the user's apps. No model calls or host messages are made.
const {chromium}=require('playwright');
const {build}=require('esbuild');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const source=fs.readFileSync(__dirname+'/chatgpt-tabs.js','utf8');
const memoryMode=process.env.TABS_ROUTER==='memory';
const css=fs.readFileSync(__dirname+'/chatgpt-rtl.css','utf8');
(async()=>{
 const bundle=await build({stdin:{contents:`
  import React from 'react';import {createRoot} from 'react-dom/client';
  import {createMemoryRouter,RouterProvider,MemoryRouter,useLocation,useNavigate} from 'react-router-dom';
  const drafts=new Map();
  function Row(props){return React.createElement('div',{role:'button','aria-label':props.ariaLabel,onClick:props.onClick},React.createElement('span',null,props.ariaLabel),React.createElement('button',{'aria-label':'Archive old chat',onClick:e=>{e.stopPropagation();window.archiveClicks++}},'Archive'));}
  function OldConversation(props){return React.createElement(Row,{ariaLabel:'گفتگوی قدیمی آزمایشی',onClick:()=>{window.hostOpens++}});}
  function History(){const [open,setOpen]=React.useState(false);React.useEffect(()=>{const show=()=>setOpen(true),close=e=>{if(e.key==='Escape')setOpen(false)};window.addEventListener('open-recent-tasks-menu',show);document.addEventListener('keydown',close);return()=>{window.removeEventListener('open-recent-tasks-menu',show);document.removeEventListener('keydown',close)}},[]);return open?React.createElement(OldConversation,{conversationId:'old-conversation',hostId:'remote host'}):null;}
  window.hostOpens=0;window.archiveClicks=0;
  function Chat(){const location=useLocation();const pathname=location.pathname+location.search;const navigate=useNavigate();if (${memoryMode}) window.testRouter={state:{location},navigate};const [text,setText]=React.useState(drafts.get(pathname)||'');
   React.useEffect(()=>setText(drafts.get(pathname)||''),[pathname]);
   return React.createElement('main',null,React.createElement(History),React.createElement('h1',null,pathname),React.createElement('textarea',{value:text,onChange:e=>{drafts.set(pathname,e.target.value);setText(e.target.value)}}));}
  const router=createMemoryRouter([{path:'*',element:React.createElement(Chat)}],{initialEntries:['/local/existing-thread']});
  window.testRouter=router;window.__codexRoot=createRoot(document.getElementById('root'));
  window.__codexRoot.render(${memoryMode ? "React.createElement(MemoryRouter,{initialEntries:['/local/existing-thread']},React.createElement(Chat))" : "React.createElement(RouterProvider,{router})"});
 `,resolveDir:process.env.NODE_PATH.split(':')[0]},bundle:true,write:false,format:'iife',platform:'browser'});
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:700,height:600}});
  page.on('pageerror',error=>console.error('Fixture page error:',error.message));
  await page.route('https://crtl.test/**',route=>route.fulfill({contentType:'text/html',body:'<html><body><div id="root"></div></body></html>'}));
  async function start(payload,expectTabs=true){await page.goto('https://crtl.test/');await page.evaluate(()=>sessionStorage.clear());await page.addScriptTag({content:bundle.outputFiles[0].text});await page.addStyleTag({content:css});await page.addScriptTag({content:payload});await page.waitForSelector(expectTabs?'[role="tab"]':'#crtl-tabs');}
  async function settled(){await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await page.waitForFunction(()=>document.querySelector('h1').textContent===window.testRouter.state.location.pathname+window.testRouter.state.location.search && document.querySelector('#crtl-tabs [aria-selected=true]')?.dataset.crtlTab===document.querySelector('h1').textContent);}
  await start(source);
  const tabs=page.locator('#crtl-tabs [role="tab"]'),add=page.locator('[data-crtl-new-tab]');
  await page.locator('textarea').fill('پیش‌نویس اول');await add.click();
  await page.waitForFunction(()=>document.querySelectorAll('#crtl-tabs [role="tab"]').length===2);
  await settled();
  const second=await page.locator('h1').innerText();assert.equal(second,'/extension/panel/new');
  assert.equal(await page.locator('textarea').inputValue(),'');await page.locator('textarea').fill('پیش‌نویس دوم');
  await tabs.nth(0).click();await settled();assert.equal(await page.locator('h1').innerText(),'/local/existing-thread');assert.equal(await page.locator('textarea').inputValue(),'پیش‌نویس اول');
  await tabs.nth(1).click();await settled();assert.equal(await page.locator('textarea').inputValue(),'پیش‌نویس دوم');
  // Repeated + focuses the one native unsent composer without losing its draft.
  await add.click();await settled();assert.equal(await tabs.count(),2);
  assert.equal(await page.locator('textarea').inputValue(),'پیش‌نویس دوم');
  // Sending creates an actual thread and replaces the draft tab.
  await page.evaluate(()=>window.testRouter.navigate('/local/saved-thread',{replace:true}));await settled();
  assert.equal(await tabs.count(),2);assert.equal(await tabs.nth(1).getAttribute('data-crtl-tab'),'/local/saved-thread');
  await add.click();await settled();assert.equal(await tabs.count(),3);
  await page.locator('.crtl-tab-item').nth(2).locator('button').last().click();await settled();
  assert.equal(await tabs.count(),2);assert.equal(await page.locator('h1').innerText(),'/local/saved-thread');
  // A closed tab's thread/draft is still accessible through native navigation.
  await page.locator('.crtl-tab-item').nth(1).locator('button').last().click();await settled();
  await page.evaluate(path=>window.testRouter.navigate(path),second);await settled();
  assert.equal(await page.locator('textarea').inputValue(),'پیش‌نویس دوم');
  // History selection must add a tab here, not invoke the host's editor opener.
  const countBeforeHistory=await tabs.count();
  await page.locator('[data-crtl-history]').click();
  await page.getByRole('button',{name:'Archive old chat',exact:true}).click();
  assert.equal(await page.evaluate(()=>window.archiveClicks),1);
  assert.equal(await tabs.count(),countBeforeHistory);
  await page.getByRole('button',{name:'گفتگوی قدیمی آزمایشی',exact:true}).click();await settled();
  assert.equal(await page.locator('h1').innerText(),'/local/old-conversation?hostId=remote%20host');
  assert.equal(await tabs.count(),countBeforeHistory+1);
  assert.equal(await page.evaluate(()=>window.hostOpens),0);
  await tabs.nth(0).click();await settled();assert.equal(await page.locator('textarea').inputValue(),'پیش‌نویس اول');
  await tabs.last().click();await settled();assert.equal(await page.locator('h1').innerText(),'/local/old-conversation?hostId=remote%20host');
  await page.locator('.crtl-tab-item').last().locator('button').last().click();await settled();
  // Query parameters identify a host in some native routes and must survive switching.
  await page.evaluate(()=>window.testRouter.navigate('/local/query-thread?host=test'));
  await settled();await page.waitForFunction(()=>document.querySelectorAll('#crtl-tabs [role=tab]').length===3);
  await tabs.nth(0).click();await settled();await tabs.nth(2).click();await settled();
  assert.equal(await page.locator('h1').innerText(),'/local/query-thread?host=test');
  await page.locator('.crtl-tab-item').nth(2).locator('button').last().click();await settled();
  // A rejected navigation must not remove the active tab.
  if (!memoryMode) {
  await page.evaluate(()=>{window.originalNavigate=window.testRouter.navigate;window.testRouter.navigate=()=>Promise.reject(new Error('blocked'));});
  await page.locator('.crtl-tab-item').nth(1).locator('button').last().click();assert.equal(await tabs.count(),2);
  await page.evaluate(()=>{window.testRouter.navigate=window.originalNavigate;});
  }
  if (memoryMode) {
   await page.evaluate(()=>window.testRouter.navigate('/settings/general'));
   await page.waitForFunction(()=>document.querySelector('h1').textContent==='/settings/general');
   await tabs.nth(0).click();
   assert.equal(await page.locator('h1').innerText(),'/settings/general');
   await page.evaluate(()=>window.testRouter.navigate('/local/existing-thread'));await settled();
  }
  const box=await page.locator('#crtl-tabs').boundingBox();assert.ok(box.height<=32);
  // Deliberately misroute every tab switch; the same content assertion must fail.
  const broken=source.replace('await router.navigate(path);',"await router.navigate('/local/wrong-thread');");assert.notEqual(broken,source);
  await start(broken);await add.click();
  await page.waitForFunction(()=>document.querySelector('h1').textContent==='/local/wrong-thread');
  const badRoute=await page.locator('h1').innerText();
  assert.throws(()=>assert.equal(badRoute,'/extension/panel/new'));
  if (memoryMode) {
   const disconnected=source.replace('return memoryRouter(nav);','return null;').replace('attempts >= 120','attempts >= 2');
   assert.notEqual(disconnected,source);await start(disconnected,false);
   await page.waitForFunction(()=>document.querySelector('#crtl-tabs [role=status]').textContent.includes('اتصال تب‌ها برقرار نشد'));
   assert.equal(await tabs.count(),0);assert.equal(await add.isDisabled(),true);
  }
  const noHistory=source.replace("document.addEventListener('click', historySelection, true);", '// disabled history connection');
  assert.notEqual(noHistory,source);await start(noHistory);await page.locator('[data-crtl-history]').click();
  await page.getByRole('button',{name:'گفتگوی قدیمی آزمایشی',exact:true}).click();
  assert.equal(await page.evaluate(()=>window.hostOpens),1);
  const awaitHistoryCount=await tabs.count();assert.throws(()=>assert.equal(awaitHistoryCount,2));
  console.log(JSON.stringify({router:memoryMode?'MemoryRouter (Windsurf)':'data router (VS Code)',historyAddsTabWithoutHostPanel:true,brokenHistoryDetected:true,independentRoutes:true,draftsPreserved:true,closeKeepsConversation:true,rejectedNavigationKeepsTab:memoryMode?'not applicable':true,tabHeight:box.height,brokenRoutingDetected:true,missingMemoryConnectionDetected:memoryMode}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
