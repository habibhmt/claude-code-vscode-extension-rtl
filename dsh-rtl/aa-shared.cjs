// Shared Aa preferences. Existing native stores remain fallbacks; only explicit
// edits enter this store. Both adapters use this module, including the CLI.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const KEYS = ['lines','tableScroll','accent','textColor','lh','opacity','counter','quoteMenu','aaTaze','btnSize','buttons','commands','extras','profiles'];
const object = x => x && typeof x === 'object' && !Array.isArray(x) ? x : {};
function cleanPref(k,v) {
 const ranges={lines:[0,12],lh:[11,24],opacity:[10,100],btnSize:[8,20]};
 if(k==='lh'&&v===0)return 16;
 if(ranges[k]){if(typeof v!=='number'||!Number.isFinite(v))throw Error('عدد نامعتبر');return Math.max(ranges[k][0],Math.min(ranges[k][1],Math.round(v)));}
 if(['tableScroll','counter','quoteMenu','aaTaze','buttons'].includes(k)){if(typeof v!=='boolean')throw Error('تیک نامعتبر');return v;}
 if(['accent','textColor'].includes(k)){if(typeof v!=='string'||(v!==''&&!/^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(v)))throw Error('رنگ نامعتبر');return v;}
 if(k==='commands'){if(v===null)return null;if(!Array.isArray(v)||v.length>200)throw Error('فهرست نامعتبر');return v.filter(c=>c&&typeof c.label==='string'&&typeof c.text==='string'&&c.text.trim()).map(c=>({label:c.label.slice(0,24),text:c.text.slice(0,20000),send:c.send===true}));}
 if(k==='extras'){if(!Array.isArray(v)||v.length>200)throw Error('متن ویژه نامعتبر');return v.filter(c=>c&&typeof c.text==='string').map(c=>({text:c.text.slice(0,20000),on:c.on!==false,pos:c.pos==='start'?'start':'end',btn:c.btn===true}));}
 if(k==='profiles'){if(!v||typeof v!=='object'||Array.isArray(v)||JSON.stringify(v).length>200000)throw Error('پروفایل نامعتبر');return v;}
 return v;
}
function file(home) { return process.env.CRTL_AA_SHARED || path.join(home || os.homedir(), '.claude', 'aa_shared.json'); }
function read(home) { try { return object(JSON.parse(fs.readFileSync(file(home),'utf8'))); } catch(e) { if(e.code === 'ENOENT') return {}; throw e; } }
// The same conversation has a "session-" prefix in Desktop only.
function chatKey(sid) {
 const value=String(sid || '');
 const uuid=value.match(/^(?:session-)?([0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})$/i);
 return uuid ? uuid[1].toLowerCase() : value;
}
function layers(store, area, cwd, sid) {
 const a=object(store[area]), folders=object(a.poshe); let best='';
 for(const p of Object.keys(folders)) if((cwd===p || cwd.startsWith(p.replace(/\/$/,'')+'/')) && p.length>best.length) best=p;
 return {global:object(a.sarasari),project:object(folders[best]),chat:object(object(a.chat)[chatKey(sid)] || object(a.chat)[sid])};
}
function view(home, area, cwd='', sid='') { const s=read(home), l=layers(s,area,cwd,sid); return {layers:l, values:Object.assign({},l.global,l.project,l.chat),revision:s.revision||0}; }
function save(home,area,scope,cwd,sid,patch,unset=[]) {
 sid=chatKey(sid);
 if(!['prefs','ticks'].includes(area)||!['sarasari','poshe','chat'].includes(scope)) throw Error('سطح نامعتبر');
 if(scope==='poshe' && (!path.isAbsolute(cwd)||cwd.includes('\0'))) throw Error('پوشه معلوم نیست');
 if(scope==='chat' && (!/^[\w.-]{1,200}$/.test(sid) || ['__proto__','constructor','prototype'].includes(sid))) throw Error('شناسه چت معلوم نیست');
 const f=file(home); fs.mkdirSync(path.dirname(f),{recursive:true}); const lock=f+'.lock'; const end=Date.now()+3000;
 while(true){try{fs.mkdirSync(lock);break;}catch(e){if(e.code!=='EEXIST'||Date.now()>end)throw e;Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,10);}}
 try {
  const s=read(home), a=s[area]=object(s[area]); a.sarasari=object(a.sarasari);a.poshe=object(a.poshe);a.chat=object(a.chat);
  const target=scope==='sarasari'?a.sarasari:scope==='poshe'?(a.poshe[cwd]=object(a.poshe[cwd])):(a.chat[sid]=object(a.chat[sid]));
  for(const [k,v] of Object.entries(object(patch))){if(['__proto__','constructor','prototype'].includes(k))throw Error('کلید نامعتبر');if(area==='prefs'&&!KEYS.includes(k))continue;target[k]=area==='ticks'?Object.assign({},object(target[k]),object(v)):cleanPref(k,v);}
  for(const k of unset) delete target[k];
  s.revision=(Number(s.revision)||0)+1;if(area==='ticks')s.ticksUpdatedAt=Date.now();const tmp=f+'.'+process.pid+'.tmp';fs.writeFileSync(tmp,JSON.stringify(s,null,2)+'\n',{mode:0o600});fs.renameSync(tmp,f);
  return view(home,area,cwd,sid);
 } finally {fs.rmdirSync(lock);}
}
function tickOverlay(home,base,nativeKind) {
 const shared=read(home), a=object(shared.ticks); const out=JSON.parse(JSON.stringify(base));
 if(shared.ticksUpdatedAt && shared.ticksUpdatedAt>Number(out.kooch||0)){out.beforeSnapshots ||= JSON.parse(JSON.stringify(base));out.kooch=shared.ticksUpdatedAt;}
 function merge(l,r){const v=Object.assign({},object(l));for(const k of ['mcp','afzune','eskil',...(nativeKind?[nativeKind]:[])])v[k]=Object.assign({},object(v[k]),object(object(r)[k]));return v;}
 out.sarasari=merge(out.sarasari,a.sarasari);for(const level of ['poshe','chat']){out[level]=object(out[level]);for(const [k,v]of Object.entries(object(a[level]))){out[level][k]=merge(out[level][k],v);if(level==='chat' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(k))out.chat['session-'+k]=merge(out.chat['session-'+k],v);}}
 return out;
}
function saveTicks(home,scope,cwd,sid,changes){
 const help=require('./tool-help.cjs');
 const related=new Set((changes||[]).filter(c=>c.kind==='mcp'&&help.importedName(c.name)).flatMap(c=>help.aliasesFor(c.name)));
 const l={};for(const c of changes||[])if((['mcp','afzune','eskil'].includes(c.kind)||(['abzar','abzar_dsh'].includes(c.kind)&&related.has(c.name)))&&typeof c.name==='string'&&typeof c.on==='boolean'){l[c.kind] ||= {};l[c.kind][c.name]=c.on;}
 if(!Object.keys(l).length)return;
 // Merge individual names under the same transaction: no category is replaced.
 return save(home,'ticks',scope,cwd,sid,l);
}
module.exports={KEYS,file,read,view,save,tickOverlay,saveTicks};
if(require.main===module){try{const m=JSON.parse(fs.readFileSync(0,'utf8'));let r=m.action==='ticks-save'?saveTicks(m.home,m.scope,m.cwd||'',m.sid||'',m.changes):m.action==='ticks-load'?tickOverlay(m.home,m.base||{},m.nativeKind):m.action==='ticks-alias-expand'?require('./tool-help.cjs').expandAliasChanges(m.changes||[],require('./tool-help.cjs').effectiveAliasPolicy({home:m.home,cwd:m.cwd,sessionId:m.sid,scope:m.scope,baseList:m.baseList,nativeFile:m.nativeFile})):m.action==='save'?save(m.home,'prefs',m.scope,m.cwd||'',m.sid||'',m.patch,m.unset):view(m.home,'prefs',m.cwd||'',m.sid||'');process.stdout.write(JSON.stringify(r||{ok:true}));}catch(e){process.stderr.write(String(e.message));process.exitCode=1;}}
