import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {randomUUID} from 'node:crypto'
import {sharedHistory} from '../history-sync.mjs'
import {nativeChoice,syncChoice} from '../history-model.mjs'
import {claudeProjectDirectory} from '../history-claude.mjs'
import {fromClaude} from '../history-dsh.mjs'

test('a Claude ToolSearch result keeps every tool name in Desktop history without another call', () => {
  const sessionId = 'session-' + randomUUID(), toolId = 'lookup'
  const transcript = { branch: [
    { type:'assistant', uuid:'a', message:{content:[{type:'tool_use', id:toolId, name:'ToolSearch', input:{query:'read'}}]} },
    { type:'user', uuid:'u', message:{content:[{type:'tool_result', tool_use_id:toolId, content:[
      {type:'tool_reference', tool_name:'mcp__dsh_yeki__dsh_read'},
      {type:'text', text:'یک نتیجهٔ دیگر'},
      {type:'tool_reference', tool_name:'Read'},
    ]}]} },
  ] }
  const events = fromClaude(transcript, { sessionId })
  const results = events.filter(event => event.type === 'tool/result')
  assert.equal(events.filter(event => event.type === 'tool/call').length, 1)
  assert.equal(events.filter(event => event.type === 'user/message').length, 0)
  assert.equal(results.length, 1)
  assert.deepEqual(results[0].data.message.content, ['mcp__dsh_yeki__dsh_read', 'یک نتیجهٔ دیگر', 'Read'].map(text => ({type:'text',text})))
  assert.deepEqual(fromClaude(transcript, { sessionId, prior:events }), [])
  const older = structuredClone(events)
  const old = older.find(event => event.type === 'tool/result')
  old.data.message.content = [{type:'text', text:'یک نتیجهٔ دیگر'}]
  const repair = fromClaude(transcript, { sessionId, prior:older })
  assert.deepEqual(repair.map(event => event.type), ['turn/start', 'tool/result', 'turn/end'])
  assert.equal(repair[1].data.message.id, old.data.message.id)
  assert.deepEqual(repair[1].surfaceOp, {op:'replace', startSeq:old.seq, endSeq:old.seq})
  assert.deepEqual(repair[1].data.message.content, results[0].data.message.content)
  assert.deepEqual(fromClaude(transcript, { sessionId, prior:[...older,...repair] }), [])
  old.data.message.content = [{type:'text', text:'a locally edited result'}]
  assert.deepEqual(fromClaude(transcript, { sessionId, prior:older }), [])
})

test('model, pinned provider, and effort follow the conversation in either direction, including Default', async t=>{
  const home=await fs.mkdtemp(path.join(os.tmpdir(),'shared-model-'))
  t.after(()=>fs.rm(home,{recursive:true,force:true}))
  const id=randomUUID(), cwd=home, model='deepseek/flash@preset/deepinfra'
  const state={}, routes=[]
  let current={provider:'openrouter',model}
  async function run(origin='dsh'){
    const native=await nativeChoice(home,id,cwd)
    await syncChoice({state,id,origin,native,dsh:current,applyDsh:async choice=>{current=choice;routes.push(choice);return true}})
  }
  await run()
  assert.deepEqual((await nativeChoice(home,id,cwd)).doc.chat[id].effortLevel.v,null)
  current={...current,reasoningEffort:'low'}
  await run();assert.equal((await nativeChoice(home,id,cwd)).effort,'low')
  let native=await nativeChoice(home,id,cwd)
  native.doc.chat[id].effortLevel={v:'high',t:native.effortTime+10}
  await fs.writeFile(native.file,JSON.stringify(native.doc));await run()
  assert.deepEqual(routes,[{provider:'openrouter',model,reasoningEffort:'high'}])
  await run();assert.equal(routes.length,1)
  current={provider:'openrouter',model};await run();assert.equal((await nativeChoice(home,id,cwd)).effort,null)
  const id2=randomUUID(),n2=await nativeChoice(home,id2,cwd)
  n2.doc.chat[id2]={model:{v:model,t:50},effortLevel:{v:'low',t:50}}
  await fs.writeFile(n2.file,JSON.stringify(n2.doc))
  let restored
  await syncChoice({state:{},id:id2,origin:'claude',native:await nativeChoice(home,id2,cwd),dsh:current,applyDsh:async s=>{restored=s;return true}})
  assert.deepEqual(restored,{provider:'openrouter',model,reasoningEffort:'low'})
})

test('an open Desktop session and a native Claude transcript can continue each other without replay',async t=>{
  const home=await fs.mkdtemp(path.join(os.tmpdir(),'shared-conversation-'))
  t.after(()=>fs.rm(home,{recursive:true,force:true}))
  const id=randomUUID(),sid='session-'+id,cwd=home, file=path.join(claudeProjectDirectory(cwd,home),id+'.jsonl')
  const events=[], workspace={path:cwd,sessionIds:[sid],attachSession(){throw Error('already attached')}}
  const live={header:{cwd},get seq(){return events.length},snapshotEvents:(from=0)=>events.slice(from),
    append(tuples){for(const [type,data,opts] of tuples)events.push({type,data,time:Date.now(),seq:events.length,...opts})}}
  const ctx={get(){},workspaceRegistry:{list:()=>[workspace]},sessions:{get:()=>live},agents:{get(){}},sessionPersistence:{async stat(){return {header:{cwd},revision:'live'}},async flush(){}}}
  const sync=sharedHistory(ctx,{claudeHome:home,dshHome:home,workspaces:[{path:cwd}]})
  const append=(type,data)=>events.push({seq:events.length,time:Date.now(),type,data})
  append('user/message',{id:'local-original',source:{kind:'user'},content:[{type:'text',text:'از دیپ‌سیک'}]})
  await sync.tick();assert.deepEqual([...sync.errors],[])
  const first=await fs.readFile(file,'utf8'), previous=JSON.parse(first.trim().split('\n').at(-1)).uuid
  const messageId=randomUUID(), toolId='read-one', assistantId=randomUUID(), resultId=randomUUID()
  const row=(type,uuid,parentUuid,content)=>JSON.stringify({type,uuid,parentUuid,cwd,sessionId:id,timestamp:new Date().toISOString(),message:{role:type,content}})
  await fs.appendFile(file,[row('user',messageId,previous,'از وی‌اس‌کد'),row('assistant',assistantId,messageId,[{type:'tool_use',id:toolId,name:'Read',input:{file_path:'demo.txt'}}]),row('user',resultId,assistantId,[{type:'tool_result',tool_use_id:toolId,content:'نتیجهٔ ذخیره‌شده'}]),row('assistant',randomUUID(),resultId,'تمام')].join('\n')+'\n')
  await sync.tick();assert.deepEqual([...sync.errors],[])
  assert.equal(events.filter(e=>e.type==='user/message').length,2)
  assert.equal(events.filter(e=>e.type==='tool/call').length,1)
  assert.equal(events.filter(e=>e.type==='tool/result')[0].data.message.content[0].text,'نتیجهٔ ذخیره‌شده')
  const imported=events.length
  append('user/message',{id:'next',source:{kind:'user'},content:[{type:'text',text:'ادامه در دیپ‌سیک'}]})
  await sync.tick();await sync.tick();assert.deepEqual([...sync.errors],[])
  assert.equal(events.length,imported+1)
  const all=await fs.readFile(file,'utf8')
  assert(all.startsWith(first))
  assert.equal(all.split('ادامه در دیپ‌سیک').length-1,1)
  assert.equal(all.split('نتیجهٔ ذخیره‌شده').length-1,1)
})

for (const recorded of [false, true]) test(
  'first message from Claude uses ' + (recorded ? 'its recorded route and effort before the machine defaults' : 'native defaults for an empty Desktop draft'),
  async t=>{
  const home=await fs.mkdtemp(path.join(os.tmpdir(),'shared-first-message-'))
  t.after(()=>fs.rm(home,{recursive:true,force:true}))
  const id=randomUUID(), sid='session-'+id, model='deepseek/flash@preset/deepinfra'
  const events=[{seq:0,time:1,type:'model/selection',data:{provider:'openrouter',model}}]
  let selected={provider:'openrouter',model}
  const agent={status:'idle',model:{current:()=>selected,select:value=>{selected=value}}}
  const live={header:{cwd:home},get seq(){return events.length},snapshotEvents:(n=0)=>events.slice(n),
    append(rows){for(const [type,data,opts] of rows)events.push({seq:events.length,time:Date.now(),type,data,...opts})}}
  const workspace={path:home,sessionIds:[sid]}
  const sync=sharedHistory({get(){},agents:{get:()=>agent},sessions:{get:()=>live},
    sessionPersistence:{stat:async()=>({header:live.header,eventCount:live.seq}),flush:async()=>{}},
    workspaceRegistry:{list:()=>[workspace]}},{claudeHome:home,dshHome:home,workspaces:[{path:home}]})
  await sync.tick()
  assert.equal((await nativeChoice(home,id,home)).explicitEffort,false,'opening an empty draft must not overwrite native defaults')
  const settings={model,modelSettings:{[model]:{effortLevel:'low'}}}
  await fs.writeFile(path.join(home,'settings.json'),JSON.stringify(settings))
  const dir=claudeProjectDirectory(home,home);await fs.mkdir(dir,{recursive:true})
  const row={type:'user',uuid:randomUUID(),parentUuid:null,sessionId:id,cwd:home,message:{role:'user',content:'اولین پیام از Claude Code'}}
  const pinned='deepseek/other@preset/selected'
  const reply={type:'assistant',uuid:randomUUID(),parentUuid:row.uuid,sessionId:id,cwd:home,requestedModel:pinned,effort:null,perTurnEffort:null,
    message:{role:'assistant',model:'deepseek/other',content:[{type:'text',text:'پاسخ'}]}}
  await fs.writeFile(path.join(dir,id+'.jsonl'),(recorded?[row,reply]:[row]).map(r=>JSON.stringify(r)).join('\n')+'\n')
  await sync.tick()
  assert.deepEqual([...sync.errors],[])
  assert.equal(selected.model,recorded?pinned:model)
  assert.equal(selected.reasoningEffort,recorded?undefined:'low')
  if (recorded) assert.equal((await nativeChoice(home,id,home)).effort,null)
  assert.equal(JSON.parse(await fs.readFile(path.join(home,'dsh-history','links',id+'.json'),'utf8')).firstMessageSource,'claude')
})
