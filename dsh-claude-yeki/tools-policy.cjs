'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{randomBytes}=require('node:crypto');
const canonicalName = name => String(name).replace(/^mcp__(?:claude_yeki|dsh_yeki)__/, '').replace(/^(?:claude_|dsh_)/, '')
const readJson=file=>{try{return JSON.parse(fs.readFileSync(file,'utf8'))}catch(e){if(e.code==='ENOENT')return null;throw e}}
const normalizeSession=id=>String(id).replace(/^session-([0-9a-f-]{36})$/i,'$1').toLowerCase()
function mergeLists(...lists){const out={};for(const list of lists)for(const [kind,values]of Object.entries(list||{}))if(values&&typeof values==='object'&&!Array.isArray(values))out[kind]={...(out[kind]||{}),...values};return out}
function storeList(store,cwd,sid){let best='';for(const p of Object.keys(store?.poshe||{}))if((cwd===p||cwd.startsWith(p.replace(/\/$/,'')+'/'))&&p.length>best.length)best=p;const base=best?store.poshe[best]:store?.sarasari;return mergeLists(base,store?.chat?.[sid]||store?.chat?.['session-'+sid])}
function nativeSnapshot(home,sid){return readJson(path.join(home,'.dsh','dsh-rtl','tik-sessions',sid+'.json'))||readJson(path.join(home,'.dsh','dsh-rtl','tik-sessions','session-'+sid+'.json'))}
/** Capture inherited defaults once; later folder/global changes cannot move an old chat. */
function captureTickSnapshot({home=os.homedir(),cwd,sessionId,createdAt=Date.now()}){
 const sid=normalizeSession(sessionId),file=path.join(home,'.dsh','dsh-rtl','tool-policies',sid+'.json'),saved=readJson(file)
 if(saved){if(saved.cwd!==cwd)throw Error('stored tool policy project mismatch');return saved.list}
 const native=readJson(path.join(home,'.claude','tik_ha.json'))||{},shared=readJson(process.env.CRTL_AA_SHARED||path.join(home,'.claude','aa_shared.json'))||{}
 // Older stores cannot reconstruct an earlier inherited decision: use their recorded baseline.
 const historical=(store,changed)=>createdAt>=Number(changed||0)?store:(store.beforeSnapshots||{chat:store.chat})
 const nativeList=storeList(historical(native,native.kooch),cwd,sid),sharedList=storeList(historical(shared.ticks||{},shared.ticksUpdatedAt),cwd,sid)
 const list=mergeLists(nativeList,sharedList,nativeSnapshot(home,sid)?.list)
 fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});const tmp=file+'.'+randomBytes(8).toString('hex')+'.tmp';fs.writeFileSync(tmp,JSON.stringify({cwd,sessionId:sid,list}),{mode:0o600});fs.renameSync(tmp,file);return list
}
function effectiveTickList(options={}) {
 const home=options.home||os.homedir(),scope=options.scope||'chat',cwd=scope==='sarasari'?'':options.cwd||'',sid=scope==='chat'?normalizeSession(options.sessionId||''):''
 const shared=readJson(process.env.CRTL_AA_SHARED||path.join(home,'.claude','aa_shared.json'))?.ticks||{},native=readJson(path.join(home,'.claude','tik_ha.json'))||{},snapshot=sid?nativeSnapshot(home,sid):null
 let frozenPolicy=scope==='chat'?options.frozenPolicy:undefined
 const pinned=sid?readJson(path.join(home,'.dsh','dsh-rtl','tool-policies',sid+'.json')):null;if(pinned?.cwd===cwd)frozenPolicy=pinned.list
 return frozenPolicy?mergeLists(frozenPolicy,snapshot?.list,native.chat?.[sid]||native.chat?.['session-'+sid],shared.chat?.[sid]||shared.chat?.['session-'+sid]):mergeLists(storeList(native,cwd,sid),storeList(shared,cwd,sid),snapshot?.list)
}
function allowedByTicks({home=os.homedir(),cwd,sessionId,name,source,frozenPolicy,scope}) {
 const effective=effectiveTickList({home,cwd,sessionId,frozenPolicy,scope})
 const bare=canonicalName(name),aliases=aliasesFor(name)
 for(const kind of ['mcp','afzune','abzar_dsh','abzar']){const values=effective[kind]||{};if(aliases.some(k=>values[k]===false)||values[source==='claude'?'claude_yeki':'dsh_yeki']===false)return false}
 if(source==='claude')for(const f of [path.join(home,'.claude','settings.json'),...(cwd?[path.join(cwd,'.claude','settings.json'),path.join(cwd,'.claude','settings.local.json')]:[])]){const deny=readJson(f)?.permissions?.deny||[];if(deny.some(rule=>typeof rule==='string'&&(rule===bare||rule.startsWith(bare+'(')||rule==='*')))return false}
 return true
}
function aliasesFor(name){
 const bare=canonicalName(name),aliases=[bare,`claude_${bare}`,`dsh_${bare}`,`mcp__claude_yeki__${bare}`,`mcp__dsh_yeki__${bare}`,`mcp__claude_yeki__claude_${bare}`,`mcp__dsh_yeki__dsh_${bare}`]
 const family={Read:'read',read:'Read',Glob:'glob',glob:'Glob',Grep:'grep',grep:'Grep'}[bare]
 if(family)aliases.push(family,`claude_${family}`,`dsh_${family}`,`mcp__claude_yeki__claude_${family}`,`mcp__dsh_yeki__dsh_${family}`)
 return [...new Set(aliases)]
}
function resolveTickState(options={}){
 const home=options.home||os.homedir(),scope=options.scope||'chat',cwd=scope==='sarasari'?'':options.cwd||'',sessionId=scope==='chat'?options.sessionId||'':''
 let frozenPolicy=options.frozenPolicy
 if(scope==='chat'&&!frozenPolicy&&sessionId){const saved=readJson(path.join(home,'.dsh','dsh-rtl','tool-policies',normalizeSession(sessionId)+'.json'));if(saved?.cwd===cwd)frozenPolicy=saved.list}
 const allowed=allowedByTicks({...options,home,cwd,sessionId,frozenPolicy})
 return {on:allowed,allowed,canonicalName:canonicalName(options.name),aliases:aliasesFor(options.name),list:effectiveTickList({...options,home,cwd,sessionId,frozenPolicy}),scope,hasFrozenPolicy:!!frozenPolicy}
}
module.exports={canonicalName,aliasesFor,allowedByTicks,captureTickSnapshot,resolveTickState,effectiveTickList};
/** Host must first prove this is its untouched draft; never call for an old/running chat. */
function updateDraftTickSnapshot({home=os.homedir(),cwd,sessionId,changes=[]}){
 const sid=normalizeSession(sessionId),file=path.join(home,'.dsh','dsh-rtl','tool-policies',sid+'.json'),saved=readJson(file)
 if(!saved)return {updated:false,reason:'binding-not-created'}
 if(saved.cwd!==cwd)throw Error('draft tool policy project mismatch')
 const list=mergeLists(saved.list)
 for(const change of changes){if(typeof change?.name!=='string'||typeof change.on!=='boolean')continue;const names=aliasesFor(change.name)
  for(const kind of ['mcp','abzar','abzar_dsh','afzune'])for(const name of names)if(Object.hasOwn(list[kind]||{},name))list[kind][name]=change.on
  if(['mcp','abzar','abzar_dsh','afzune'].includes(change.kind)){list[change.kind]||={};list[change.kind][change.name]=change.on}
 }
 const tmp=file+'.'+randomBytes(8).toString('hex')+'.tmp';fs.writeFileSync(tmp,JSON.stringify({...saved,list}),{mode:0o600});fs.renameSync(tmp,file);return {updated:true}
}
module.exports.updateDraftTickSnapshot=updateDraftTickSnapshot;
