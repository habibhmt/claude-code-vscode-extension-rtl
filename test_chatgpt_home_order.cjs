const fs=require('node:fs'),assert=require('node:assert/strict'),vm=require('node:vm');
const path=process.argv[2];
const source=fs.readFileSync(path,'utf8');
function rowsFromNativeHome(code,rows){
 const home=code.slice(code.indexOf('function At('));
 const start=home.indexOf('let u;if('),end=home.indexOf('let d=u,',start);
 assert.ok(start>=0&&end>start,'Native home selection contract changed');
 return vm.runInNewContext(home.slice(start,end)+'u',{
  n:rows,t:[],s:{},Ft:e=>e.unread,Nt:e=>e.key,
  Lt:{default:(xs,key)=>xs.filter((e,i)=>xs.findIndex(x=>key(x)===key(e))===i)}
 });
}
const rows=Array.from({length:12},(_,i)=>({key:String(i),updatedAt:100-i,unread:i>8}));
function verify(code){assert.deepEqual(Array.from(rowsFromNativeHome(code,rows),e=>e.key),rows.map(e=>e.key),'Home must match the clock list without old unread priority or omitted chats');}
verify(source);
const broken=source.replace('u=n,t[8]=s','u=(0,Lt.default)([...r,...n],Nt).slice(0,Math.max(3,r.length)),t[8]=s');
assert.notEqual(broken,source);assert.throws(()=>verify(broken),/Home must match/);
console.log(JSON.stringify({nativeHomeSameOrderAndRows:true,oldUnreadSabotageDetected:true}));
