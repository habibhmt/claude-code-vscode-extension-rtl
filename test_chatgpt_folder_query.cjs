// Runs the installed Codex React, scope and query-family implementation.
// Only the host's filesystem response is replaced. This catches using the
// simple-signal hook for a parameterized query, which the pure fixture missed.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const assert=require('node:assert/strict');
const ext=process.env.CODEX_TEST_EXTENSION||path.join(process.env.HOME,'.vscode/extensions/openai.chatgpt-26.1021.22027-darwin-arm64');
const assets=path.join(ext,'webview/assets');
const prepared=JSON.parse(execFileSync('python3',['-c',`
import importlib.util,json
from pathlib import Path
s=importlib.util.spec_from_file_location('p','chatgpt-folder-patch.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
root=Path(${JSON.stringify(assets)})
mf=root.parent/'.chatgpt-folder-filter.json'
originals={k:(root/v['backup']).read_bytes() for k,v in json.loads(mf.read_text())['files'].items()} if mf.exists() else {}
_,name,helper=m.prepare(root,originals,Path('chatgpt-folder-filter.js').read_text())
print(json.dumps({'helper':helper.decode()}))
`],{cwd:__dirname,encoding:'utf8'}));
const helper=prepared.helper.replace(/from "\.\/thread-context-inputs-[^"]+"/,'from "./fixture-inputs.js"');
const scopeName=fs.readdirSync(assets).find(n=>/^app-scope-[a-f0-9]+\.js$/.test(n));
const initialName=fs.readdirSync(assets).find(n=>/^app-initial-[a-f0-9]+\.js$/.test(n));
const hostSource=fs.readFileSync(path.join(ext,'out/extension.js'),'utf8');
const hostStart=hostSource.indexOf('X2=class extends CR{');
assert.ok(hostStart>=0,'Native workspace-root provider changed');
const hostClass=hostSource.slice(hostStart+3,hostSource.indexOf(';async function o7(',hostStart));
const fixture=`import * as scope from './${scopeName}';
 scope.r();scope.J();export const token=scope.st('FolderQueryIntegration');
 export const client=new scope.q({defaultOptions:{queries:{retry:false}}});
 class CR {constructor(readRoots){this.readRoots=readRoots} read(id,options){return this.readRoots(options,new AbortController().signal)}}
 async function o7(){return ['/work/project']} async function Lke(){throw Error('Unexpected canonicalization')}
 const Provider=${hostClass},host=new Provider({},'fixture');
 export const u=scope.b(token,options=>({queryKey:['fixture-roots',options],queryFn:()=>host.read('fixture',options),staleTime:Infinity}));
 export const s=()=>{};`;
function main(){return `import * as scope from './${scopeName}';import * as native from './${initialName}';
 import {token,client} from './fixture-inputs.js';
 import {crtlUseFolderRows} from './helper.js';
 const React=native.rS(),rows=[{id:'own',cwd:'/work/project',hostId:'local'},{id:'foreign',cwd:'/work/other',hostId:'local'}];
 window.changeRoots=roots=>client.setQueriesData({queryKey:['fixture-roots']},{roots});
 window.queryStatus=()=>client.getQueryCache().find({queryKey:['fixture-roots'],exact:false})?.state.status;
 function List(){const visible=crtlUseFolderRows(rows);return React.createElement('ul',null,visible.map(r=>React.createElement('li',{key:r.id},r.id)));}
 native.gm().createRoot(document.getElementById('root')).render(React.createElement(scope.p,{queryClient:client},React.createElement(scope.d,{scope:token},React.createElement(List))));`}
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 try{
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error(e.stack)});
  let current=helper;
  await page.route('**/*',route=>{
   const u=new URL(route.request().url());
   if(u.hostname!=='crtl-native.test')return route.abort();
   if(u.pathname==='/')return route.fulfill({contentType:'text/html',body:'<div id="root"></div><script type="module" src="/assets/main.js"></script>'});
   const name=path.basename(u.pathname);
   const virtual={'fixture-inputs.js':fixture,'helper.js':current,'main.js':main()};
   if(name in virtual)return route.fulfill({contentType:'text/javascript',body:virtual[name]});
   const file=path.join(assets,name);
   if(fs.existsSync(file))return route.fulfill({contentType:'text/javascript',body:fs.readFileSync(file)});
   return route.abort();
  });
  await page.goto('http://crtl-native.test');
  await page.waitForFunction(()=>document.querySelector('li')?.textContent==='own',null,{timeout:60000});
  assert.deepEqual(await page.locator('li').allTextContents(),['own']);
  await page.evaluate(()=>window.changeRoots(['/work/other']));
  await page.waitForFunction(()=>document.querySelector('li')?.textContent==='foreign');
  assert.deepEqual(errors,[]);
  current=helper.replace('c as crtlUseQuery','u as crtlUseQuery');assert.notEqual(current,helper);
  await page.reload();await page.waitForSelector('ul',{state:'attached'});
  await page.evaluate(()=>window.changeRoots(['/work/project']));
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const brokenIds=await page.locator('li').allTextContents();
  assert.throws(()=>assert.deepEqual(brokenIds,['own']));
  assert.deepEqual(brokenIds,[],'The previous wrong hook must reproduce the empty list');
  current=helper.replace(", {hostId: 'local'}",'');assert.notEqual(current,helper);
  await page.reload();await page.waitForSelector('ul',{state:'attached'});
  await page.waitForFunction(()=>window.queryStatus?.()==='error',null,{timeout:60000});
  const noOptionsIds=await page.locator('li').allTextContents();
  assert.throws(()=>assert.deepEqual(noOptionsIds,['own']));
  assert.ok(noOptionsIds.length>0,'A failed folder read must keep the native list, not show it empty');
  console.log(JSON.stringify({realCodexReact:true,realQueryFamily:true,realHostProvider:true,correctFolderVisible:true,folderChange:true,previousWrongHookReproduced:true,missingOptionsCaught:true}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
