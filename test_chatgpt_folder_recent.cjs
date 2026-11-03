// Execute the installed webview's actual listRecentThreads method. A project's
// older chats must survive when more than one native page belongs to other roots.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const assert=require('node:assert/strict');
const assets=process.argv[2];
const sources=fs.readdirSync(assets).filter(n=>/^src-.*\.js$/.test(n)).map(n=>fs.readFileSync(path.join(assets,n),'utf8'));
const source=sources.find(s=>s.includes('async listRecentThreads({originators:e,cursor:t,limit:n,background:r=!1})'));
assert.ok(source,'Recent-history implementation missing');
const start=source.indexOf('async listRecentThreads('),end=source.indexOf('async hydrateThreads(',start);
assert.ok(end>start,'Recent-history boundary changed');
const method=source.slice(start,end);
const rows=[...Array.from({length:75},(_,i)=>({id:'other-'+i,cwd:'/work/other'})),
 ...Array.from({length:29},(_,i)=>({id:'own-'+i,cwd:'/work/here'})),{id:'prefix',cwd:'/work/here-more'}];
let roots=['/work/here'],params,rootReads=0;
async function run(code,hostId='local'){
 const obj=vm.runInNewContext('({'+code+'})',{
  crtlInitRoots(){},async crtlReadWorkspaceRoots(options){assert.equal(options.hostId,'local');rootReads++;return{roots}},
  _e:['vscode'],td:()=>true
 });
 obj.recentConversationSortKey='created_at';
 obj.params={hostId,requestClient:{getCompatibleThreadSortKey:k=>k,async sendRequest(method,p,options){
  assert.equal(method,'thread/list');assert.equal(options.source,'recent_threads');params=p;
  const selected=rows.filter(r=>p.cwd==null||p.cwd.includes(r.cwd));
  const offset=Number(p.cursor??0),data=selected.slice(offset,offset+p.limit);
  return{data,nextCursor:offset+data.length<selected.length?String(offset+data.length):null};
 }}};
 return obj.listRecentThreads({originators:['vscode'],cursor:null,limit:50});
}
(async()=>{
 const expected=rows.filter(r=>r.cwd==='/work/here').map(r=>r.id);
 assert.deepEqual((await run(method)).data.map(r=>r.id),expected);
 assert.equal(params.limit,50);assert.equal(params.archived,false);assert.equal(params.useStateDbOnly,true);
 roots=['/work/here','/work/here-more'];assert.equal((await run(method)).data.length,30);
 roots=['/work/empty'];assert.equal((await run(method)).data.length,0);
 roots=[];assert.equal((await run(method)).data.length,50);
 const before=rootReads;assert.equal((await run(method,'remote')).data.length,50);assert.equal(rootReads,before);
 roots=['/work/here'];
 const broken=method.replace('cwd:crtlRoots?.length?crtlRoots:void 0,','');assert.notEqual(method,broken);
 const missing=(await run(broken)).data.filter(r=>r.cwd==='/work/here').map(r=>r.id);
 assert.throws(()=>assert.deepEqual(missing,expected));assert.deepEqual(missing,[]);
 console.log(JSON.stringify({actualWebviewRecentRequest:true,olderOwnChatsBeforeLimit:true,multiRoot:true,remoteUnchanged:true,missingOldChatsSabotageCaught:true}));
})().catch(e=>{console.error(e);process.exitCode=1});
