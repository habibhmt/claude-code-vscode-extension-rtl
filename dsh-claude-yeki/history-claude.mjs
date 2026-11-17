/** Append-only DSH → Claude transcript projection. Never call a model. */
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';

import { randomUUID } from 'node:crypto';
const readCache = new Map(); // unchanged files need no repeat disk scan

export async function nativeSessionState(claudeHome, sid) {
  const directory=path.join(claudeHome || path.join(os.homedir(),'.claude'),'sessions');
  let names;try{names=await fs.readdir(directory);}catch(e){if(e.code==='ENOENT')return {active:false,idle:false};throw e;}
  let idle=false;
  for(const name of names.filter(n=>n.endsWith('.json'))){
    let row;try{row=JSON.parse(await fs.readFile(path.join(directory,name),'utf8'));}catch{continue;}
    if(row.sessionId!==sid || !Number.isSafeInteger(row.pid))continue;
    let alive=true;try{process.kill(row.pid,0);}catch(e){if(e.code==='ESRCH')alive=false;}
    if(!alive)continue;
    if(row.status!=='idle')return{active:true,idle:false,pid:row.pid};idle=true;
  }
  return{active:false,idle};
}
async function acquireLock(file){
  const token=randomUUID();
  for(let attempt=0;attempt<2;attempt++){
    try{const handle=await fs.open(file,'wx',0o600);await handle.writeFile(JSON.stringify({pid:process.pid,token,createdAt:Date.now()}));return{handle,token};}
    catch(e){if(e.code!=='EEXIST')throw e;
      let raw,owner;try{raw=await fs.readFile(file,'utf8');owner=JSON.parse(raw);}catch{throw new Error('Unverifiable bridge lock; refusing takeover');}
      if(!Number.isSafeInteger(owner.pid)||!owner.token)throw new Error('Invalid bridge lock owner');
      try{process.kill(owner.pid,0);throw new Error('Bridge writer lock is live');}catch(error){if(error.code!=='ESRCH')throw error;}
      // Compare before removal: never remove a replaced/live lock.
      if(await fs.readFile(file,'utf8')!==raw)throw new Error('Bridge lock changed');await fs.unlink(file);
    }
  }
  throw new Error('Bridge lock unavailable');
}

export const BRIDGE = 'dsh-claude-history-v1';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function claudeSessionId(id) {
  const sid = String(id || '').replace(/^session-/, '');
  if (!UUID.test(sid)) throw new Error('Invalid session UUID');
  return sid.toLowerCase();
}
export function claudeProjectDirectory(cwd, claudeHome = path.join(os.homedir(), '.claude')) {
  if (!path.isAbsolute(cwd || '')) throw new Error('cwd must be absolute');
  return path.join(claudeHome, 'projects', path.resolve(cwd).replace(/[^A-Za-z0-9]/g, '-'));
}
function uuid(key) {
  const h = createHash('sha256').update(key).digest('hex');
  return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;
}
function textBlocks(content) {
  if (typeof content === 'string') return content ? [{type:'text', text:content}] : [];
  return (Array.isArray(content) ? content : []).filter(b => b?.type === 'text' && typeof b.text === 'string').map(b => ({type:'text',text:b.text}));
}
function inputOf(a) {
  if (typeof a === 'string') { try { return JSON.parse(a); } catch { return {raw:a}; } }
  return a && typeof a === 'object' && !Array.isArray(a) ? {...a} : {};
}
const NAMES = {bash:'Bash',read:'Read',write:'Write',edit:'Edit',grep:'Grep',glob:'Glob'};
function toolBlock(b) {
  const input = inputOf(b.arguments ?? b.input);
  if (input.path && !input.file_path && ['read','write','edit'].includes(b.name)) { input.file_path=input.path; delete input.path; }
  return {type:'tool_use',id:String(b.id || b.callId),name:NAMES[b.name] || b.name,input};
}
function fromClaude(event) {
  const d=event.data || {}, m=d.message || d;
  if ([d.id,m.id,d.callId,m.toolCallId].some(x=>String(x || '').startsWith('claude-history:'))) return true;
  return [event.origin,d.origin,m.origin,d.source?.kind,m.source?.kind].some(x => x==='claude' || x==='claude-history' || x==='native-claude');
}
/** Pure projection; source seq, rather than text, provides stable idempotence. */
export function projectDsh({sessionId,cwd,events,origin='dsh',parentUuid=null,knownCalls=[]}) {
  const sid=claudeSessionId(sessionId), rows=[], calls=new Set(knownCalls);
  let parent=parentUuid;
  if (origin==='claude' || origin==='claude-history') return [];
  for (const event of events || []) {
    if (fromClaude(event)) continue;
    const d=event.data || {}, m=d.message || d;
    let role, content=[], key=String(event.seq ?? createHash('sha256').update(JSON.stringify(event)).digest('hex'));
    if (event.type==='user/message') {
      if (d.source?.kind && d.source.kind!=='user') continue;
      role='user'; content=textBlocks(m.content);
    } else if (event.type==='assistant/message') {
      role='assistant';
      for (const b of Array.isArray(m.content)?m.content:[]) {
        if (b?.type==='text' && typeof b.text==='string') content.push({type:'text',text:b.text});
        else if (b?.type==='tool-call' && (b.id || b.callId) && b.name && !calls.has(b.id || b.callId)) { calls.add(b.id || b.callId); content.push(toolBlock(b)); }
      }
    } else if (event.type==='tool/call') {
      if (!d.callId || !d.name || calls.has(d.callId)) continue;
      calls.add(d.callId); role='assistant'; content=[toolBlock(d)];
    } else if (event.type==='tool/result') {
      const id=m.toolCallId || m.source?.callId || d.callId;
      if (!id || !calls.has(id)) continue;
      role='user'; content=[{type:'tool_result',tool_use_id:id,content:textBlocks(m.content),is_error:!!m.isError}];
    } else continue;
    if (!content.length) continue;
    const id=uuid(`${BRIDGE}:${sid}:${event.type}:${key}`);
    const stamp=new Date(event.time ?? 0);
    const row={type:role,uuid:id,parentUuid:parent,isSidechain:false,userType:'external',cwd:path.resolve(cwd),sessionId:sid,timestamp:Number.isNaN(stamp.valueOf())?new Date(0).toISOString():stamp.toISOString(),version:'2.1.325',dshBridge:{kind:BRIDGE},dshSource:{sessionId:String(sessionId),seq:event.seq ?? null,eventType:event.type},message:{role,content}};
    if(role==='assistant') row.message={id:`msg_${id.replaceAll('-','')}`,type:'message',model:m.source?.model || 'dsh-import',role,content,stop_reason:content.some(b=>b.type==='tool_use')?'tool_use':'end_turn',stop_sequence:null};
    rows.push(row);parent=id;
  }
  return rows;
}
/**
 * events must be a complete ordered snapshot. Caller must stop publishing while
 * native Claude owns this session. Native rows make the next publish fail closed.
 * A bridge lock serializes bridge writers only; it does NOT lock native Claude.
 */
export async function publishDsh({sessionId,cwd,title,events,claudeHome,origin='dsh',activeNative=false,link=null,incremental=false}) {
  if(activeNative) throw new Error('Native Claude session is active; publish deferred');
  const sid=claudeSessionId(sessionId),dir=claudeProjectDirectory(cwd,claudeHome),file=path.join(dir,`${sid}.jsonl`);
  if(link && (activeNative!==false || claudeSessionId(link.sessionId)!==sid || path.resolve(link.file)!==file || !Object.hasOwn(link,'expectedTailUuid')))throw new Error('Invalid explicit native session link');
  if(origin==='claude'||origin==='claude-history')return{file,added:0,sessionId:sid};
  await fs.mkdir(dir,{recursive:true,mode:0o700});
  if((await nativeSessionState(claudeHome,sid)).active)throw new Error('Native writer is busy; publish deferred');
  const lock=await acquireLock(`${file}.dsh-bridge.lock`);
  try {
    let before='',cached;try{
      const lst=await fs.lstat(file);if(lst.isSymbolicLink())throw new Error('Symlink transcript refused');
      const st=await fs.stat(file),old=readCache.get(file);
      if(old && old.size===st.size && old.mtimeMs===st.mtimeMs && old.ctimeMs===st.ctimeMs && old.ino===st.ino){before=old.text;cached=old.rows;}
      else before=await fs.readFile(file,'utf8');
    }catch(e){if(e.code!=='ENOENT')throw e;}
    if(before && !before.endsWith('\n'))throw new Error('Partial transcript line; publish deferred');
    const prior=cached || before.split('\n').filter(Boolean).map(l=>JSON.parse(l));
    const messages=prior.filter(r=>r.type==='user'||r.type==='assistant'),tail=messages.at(-1)?.uuid??null;
    const native=prior.length && prior[0].dshBridge?.kind!==BRIDGE || messages.some(r=>r.dshBridge?.kind!==BRIDGE);
    if(native && !link)throw new Error('Native-owned transcript: explicit link required');
    if(link && (tail!==link.expectedTailUuid || !prior.length || prior.some(r=>r.sessionId && r.sessionId!==sid)))throw new Error('Native link tail/session mismatch');
    const knownCalls=incremental||native?messages.flatMap(r=>(Array.isArray(r.message?.content)?r.message.content:[]).filter(b=>b.type==='tool_use').map(b=>b.id)):[];
    const rows=projectDsh({sessionId,cwd,events,origin,parentUuid:incremental||native?tail:null,knownCalls});
    const seen=new Set(messages.map(r=>r.uuid));
    if(!incremental&&!native){
      const previous=messages.map(r=>r.uuid),expected=rows.slice(0,previous.length).map(r=>r.uuid);
      if(previous.some((id,i)=>id!==expected[i]))throw new Error('Source history changed: refusing divergent append');
    }
    const fresh=rows.filter(r=>!seen.has(r.uuid));
    // Replayed incremental batches may contain existing rows: re-chain only new rows.
    let parent=tail;for(const row of fresh){row.parentUuid=parent;parent=row.uuid;}
    const head=prior.length?[]:[{type:'dsh-bridge',sessionId:sid,dshBridge:{kind:BRIDGE}},...(title?[{type:'custom-title',sessionId:sid,customTitle:String(title),dshBridge:{kind:BRIDGE}}]:[])];
    if(!fresh.length)return{file,added:0,sessionId:sid,tailUuid:tail};
    if((await nativeSessionState(claudeHome,sid)).active)throw new Error('Native writer became busy; publish deferred');
    const handle=await fs.open(file,before?'a':'wx',0o600);
    try {
      const stat=await handle.stat();if(stat.size!==Buffer.byteLength(before))throw new Error('Transcript changed during publish');
      const appended=[...head,...fresh].map(r=>JSON.stringify(r)).join('\n')+'\n';
      await handle.writeFile(appended);await handle.sync();
      const after=await handle.stat();readCache.set(file,{size:after.size,mtimeMs:after.mtimeMs,ctimeMs:after.ctimeMs,ino:after.ino,text:before+appended,rows:[...prior,...head,...fresh]});
    } finally {await handle.close();}
    return{file,added:fresh.length,sessionId:sid,tailUuid:parent};
  } finally {await lock.handle.close();try{const owner=JSON.parse(await fs.readFile(`${file}.dsh-bridge.lock`,'utf8'));if(owner.token===lock.token)await fs.unlink(`${file}.dsh-bridge.lock`);}catch(e){if(e.code!=='ENOENT')throw e;}}
}
