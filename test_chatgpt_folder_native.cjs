// Execute the actual patched VS Code provider class in a sandbox with a fake
// app-server. Its listing must filter before applying the native page limit.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(process.argv[2],'utf8');
const start=source.indexOf('class{constructor(e){this.codexAppServer=e;let r={onResult:');
const end=source.indexOf(';function eWe(',start);
assert.ok(start>=0&&end>start,'Native Chat Sessions provider shape changed');
const provider=source.slice(start,end);
const rows=[...Array.from({length:70},(_,i)=>({id:'other-'+i,cwd:'/work/other'})),
 {id:'here-1',cwd:'/work/here'},{id:'here-2',cwd:'/work/here'},
 {id:'prefix',cwd:'/work/here-more'}];
let roots=['/work/here'],callback,lastParams;
const server={registerProvider(id,c){callback=c},sendRequest(provider,id,method,params){
 assert.equal(method,'thread/list');lastParams=params;
 const selected=rows.filter(row=>params.cwd==null||params.cwd.includes(row.cwd)).slice(0,params.limit);
 callback.onResult({id,result:{data:selected,nextCursor:null}});
}};
async function get(code){const context={YGe:'test',fv:()=>roots,rg:['vscode'],AP:'openai'};
 const Class=vm.runInNewContext('('+code+')',context);return new Class(server).requestThreadList(false);}
(async()=>{
 assert.deepEqual((await get(provider)).data.map(r=>r.id),['here-1','here-2']);
 assert.equal(lastParams.limit,50);assert.equal(lastParams.cursor,null);
 roots=['/work/here','/work/here-more'];
 assert.deepEqual((await get(provider)).data.map(r=>r.id),['here-1','here-2','prefix']);
 roots=['/work/empty'];assert.equal((await get(provider)).data.length,0);
 roots=[];assert.equal((await get(provider)).data.length,50);
 roots=['/work/here'];
 const broken=provider.replace('cwd:fv().length?fv():void 0,','');assert.notEqual(broken,provider);
 const bad=(await get(broken)).data.map(r=>r.id);
 assert.throws(()=>assert.deepEqual(bad,['here-1','here-2']));
 console.log(JSON.stringify({actualNativeProvider:true,filterBeforeLimit:true,currentFolderReadEachTime:true,
  multiRoot:true,emptyFolder:true,emptyWindowNativeBehavior:true,sabotageDetected:true}));
})().catch(e=>{console.error(e);process.exitCode=1});
