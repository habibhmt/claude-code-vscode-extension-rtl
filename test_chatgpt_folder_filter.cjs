// Isolated React browser check. No user chats or app-server writes.
const {chromium}=require('playwright');
const {build}=require('esbuild');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const source=fs.readFileSync(__dirname+'/chatgpt-folder-filter.js','utf8');

async function bundle(payload) {
 const result=await build({stdin:{contents:`
 import React from 'react';import {createRoot} from 'react-dom/client';
 const Context=React.createContext(undefined);
 const crtlReact=()=>React,crtlInitInputs=()=>{},crtlWorkspaceRoots={};
 const crtlUseQuery=()=>({data:React.useContext(Context),isError:window.__err===true});
 ${payload}
 const nativeRows=Object.freeze([
  Object.freeze({conversationId:'other-newer',hostId:'local',cwd:'/work/other',title:'Other'}),
  Object.freeze({conversationId:'same',hostId:'local',cwd:'/work/project',title:'Title contains other'}),
  Object.freeze({conversationId:'prefix',hostId:'local',cwd:'/work/project-2',title:'project'}),
  Object.freeze({conversationId:'second',hostId:'local',cwd:'/work/second',title:'Second'}),
  Object.freeze({conversationId:'same-slash',hostId:'local',cwd:'/work/project/',title:'Same slash'}),
  Object.freeze({conversationId:'remote',hostId:'remote-host',cwd:'/work/project',title:'Remote same path'}),
  Object.freeze({conversationId:'missing',hostId:'local',title:'Missing cwd'})
 ]);
 const merged=Object.freeze([
  ...nativeRows.map(conversation=>({kind:'local',conversation,key:conversation.conversationId})),
  {kind:'remote',key:'cloud',task:{title:'cloud'}},
  {kind:'local',key:'pending-here',pendingWorktree:{hostId:'local',sourceWorkspaceRoot:'/work/project'}},
  {kind:'local',key:'pending-other',pendingWorktree:{hostId:'local',sourceWorkspaceRoot:'/work/other'}}
 ]);
 const nativeResult={data:nativeRows,refetch:()=>{},isLoading:false};
 // Same wrapper contracts installed into the native recent hook and merged view.
 function crtlNativeRecent(){return nativeResult;}
 function Y(){return crtlUseFolderResult(crtlNativeRecent());}
 function crtlNativeMerged(){return merged;}
 function _n(e,t,n){return crtlUseFolderRows(crtlNativeMerged(e,t,n),true);}
 window.nativeRows=nativeRows;window.mergedRows=merged;window.filter=crtlFilterFolderRows;
 function Lists(){const result=Y();const all=_n();const [query,setQuery]=React.useState('');
  return React.createElement('main',null,
   React.createElement('input',{value:query,onChange:e=>setQuery(e.target.value)}),
   React.createElement('ul',{id:'recent'},result.data.filter(r=>r.title.includes(query)).map(r=>React.createElement('li',{key:r.conversationId},r.conversationId))),
   React.createElement('ul',{id:'merged'},all.map(r=>React.createElement('li',{key:r.key},r.key))));}
 function App(){const [roots,setRoots]=React.useState(undefined);window.setRoots=setRoots;
  return React.createElement(Context.Provider,{value:roots===undefined?undefined:{roots}},React.createElement(Lists));}
 createRoot(document.getElementById('root')).render(React.createElement(App));
 `,resolveDir:__dirname},bundle:true,write:false,format:'iife',platform:'browser'});
 return result.outputFiles[0].text;
}

(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 try {
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  async function start(payload){await page.setContent('<div id="root"></div>');await page.addScriptTag({content:await bundle(payload)});await page.waitForSelector('main');}
  async function roots(paths){await page.evaluate(paths=>window.setRoots(paths),paths);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));}
  async function ids(selector='#recent'){return page.locator(selector+' li').allTextContents();}
  await start(source);
  assert.deepEqual(await ids(),[],'Loading must not flash all projects');
  await roots(['/work/project']);
  assert.deepEqual(await ids(),['same','same-slash']);
  assert.deepEqual(await ids('#merged'),['same','same-slash','pending-here']);
  // Native title search must not bring back an out-of-folder conversation.
  await page.locator('input').fill('other');assert.deepEqual(await ids(),['same']);
  await page.locator('input').fill('');
  await roots(['/work/other']);assert.deepEqual(await ids(),['other-newer']);
  await roots(['/work/project','/work/second']);assert.deepEqual(await ids(),['same','second','same-slash']);
  await roots(['/work/empty']);assert.deepEqual(await ids(),[]);
  // The same folder spelled differently stays; a sibling does not.
  const spell=await page.evaluate(()=>window.filter([{hostId:'local',cwd:'/private/tmp/x'},{hostId:'local',cwd:'/Work/\u0622ب'},{hostId:'local',cwd:'/tmp/x2'}].map((r,i)=>({...r,i})),['/tmp/x','/work/\u0627\u0653ب']).map(r=>r.i));
  assert.deepEqual(spell,[0,1]);
  // A failed folder read keeps the native list instead of an empty one.
  await page.evaluate(()=>{window.__err=true});await roots(['/work/empty']);assert.equal((await ids()).length,7);
  await page.evaluate(()=>{window.__err=false});await roots(['/work/project']);assert.deepEqual(await ids(),['same','same-slash']);
  // Empty windows keep native history, and every source record remains intact.
  await roots([]);assert.equal((await ids()).length,7);
  assert.equal(await page.evaluate(()=>window.nativeRows.length),7);
  assert.equal(await page.evaluate(()=>window.mergedRows.length),10);
  assert.equal(await page.evaluate(()=>window.filter(window.nativeRows,[] )===window.nativeRows),true);
  const edge=await page.evaluate(()=>window.filter([
    {cwd:'C:\\work\\project\\'},{cwd:'C:\\work\\project-2'},{cwd:'/work/Project'}
  ],['C:/work/project']).length);assert.equal(edge,1);
  const imported=await page.evaluate(()=>window.filter([
    {conversationId:'claude-here',cwd:'/work/project',hostId:'local',source:{custom:'claude'},threadSource:'import'},
    {conversationId:'claude-other',cwd:'/work/other',hostId:'local',source:{custom:'claude'},threadSource:'import'}
  ],['/work/project']).map(r=>r.conversationId));
  assert.deepEqual(imported,['claude-here']);
  // Sabotage the actual filter predicate; rerun the same visible-list assertion.
  const broken=source.replace('paths.has(crtlFolderPath(thread.cwd))','true');assert.notEqual(broken,source);
  await start(broken);await roots(['/work/project']);
  const leaked=await ids();assert.throws(()=>assert.deepEqual(leaked,['same','same-slash']));
  assert.ok(leaked.includes('other-newer'));
  // Reverse sabotage catches disappearing chats from the correct folder, too.
  const hidden=source.replace('paths.has(crtlFolderPath(thread.cwd))','false');
  await start(hidden);await roots(['/work/project']);
  const missing=await ids();assert.throws(()=>assert.deepEqual(missing,['same','same-slash']));
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({sameFolderOnly:true,folderSwitch:true,multiRoot:true,searchScoped:true,
   siblingPrefixExcluded:true,remoteHostExcluded:true,originalDataPreserved:true,importedClaudeByFolder:true,
   leakedChatSabotageDetected:true,missingChatSabotageDetected:true}));
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
