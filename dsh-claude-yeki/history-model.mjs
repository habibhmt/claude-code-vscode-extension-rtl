import fs from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

const levels = new Set(['off','low','medium','high','xhigh','max'])
const owns = (object,key) => Object.hasOwn(object || {},key)
async function readOptional(file) {
  try { return await fs.readFile(file,'utf8') } catch (error) { if(error.code !== 'ENOENT') throw error }
}

// Only a user's choice for this conversation counts as a subsequent edit.
// On first import from Claude, its actual folder/model defaults also matter.
export async function nativeChoice(home, id, cwd) {
  const file = process.env.CRTL_TANZIMAT || path.join(home,'crtl_tanzimat.json')
  const raw = await readOptional(file), doc = raw ? JSON.parse(raw) : {}
  const chat = doc.chat?.[id] || {}
  const recorded = chat.effortLevel
  const fileSettings = JSON.parse(await readOptional(path.join(home,'settings.json')) || '{}')
  const local = cwd ? JSON.parse(await readOptional(path.join(cwd,'.claude/settings.local.json')) || '{}') : {}
  const model = chat.model?.v || doc.poshe?.[cwd]?.model?.v || local.model || fileSettings.model
  const matched = [doc.sarasari?.effortLevel,doc.poshe?.[cwd]?.effortLevel,recorded]
    .filter(v=>owns(v,'v')).sort((a,b)=>Number(b.t)-Number(a.t))[0]
  const fallback = local.modelSettings?.[model]?.effortLevel ?? local.effortLevel ??
    fileSettings.modelSettings?.[model]?.effortLevel ?? fileSettings.effortLevel
  return {file,raw,doc,model,value:chat.model?.v || null,time:Number(chat.model?.t)||0,
    explicitEffort:owns(recorded,'v'), effort:owns(recorded,'v') ? recorded.v : (matched ? matched.v : fallback) ?? null,
    effortTime:Number(recorded?.t)||0}
}

async function setNative(saved, id, patch) {
  const doc = saved.doc
  doc.chat ||= {}
  const target=doc.chat[id] ||= {}
  const time=Date.now()
  for(const [key,value] of Object.entries(patch)) target[key]={v:value,t:time}
  const tmp=saved.file+'.'+randomUUID()+'.tmp'
  try {
    await fs.writeFile(tmp,JSON.stringify(doc,null,1)+'\n',{flag:'wx',mode:0o600})
    if(await readOptional(saved.file)!==saved.raw) throw Error('Claude settings changed during synchronization; retrying')
    await fs.rename(tmp,saved.file)
  } finally {await fs.rm(tmp,{force:true})}
  return time
}
export function routeFor(model) {
  if (typeof model!=='string' || !model || /\s/.test(model)) return null
  if (model.includes('/') && !model.startsWith('@')) return {provider:'openrouter',model}
  if (model.startsWith('claude-')) return {provider:'anthropic',model}
  return null
}
export async function pickSharedEffort(home,id,cwd,effort) {
  if(effort!==null && !levels.has(effort)) throw Error('Unsupported effort')
  for(let attempt=0;attempt<3;attempt++) {
    const saved=await nativeChoice(home,id,cwd)
    if(saved.explicitEffort && saved.effort===effort) return
    try { await setNative(saved,id,{effortLevel:effort});return } catch(e) { if(attempt===2 || !e.message.includes('during synchronization')) throw e }
  }
}
export async function syncChoice({state,id,native,dsh,origin,applyDsh}) {
  const prev=state.choice
  const local=dsh && ['openrouter','anthropic'].includes(dsh.provider) ? dsh.model : null
  const localEffort=dsh?.reasoningEffort ?? null
  const newNativeModel=prev ? native.time>prev.nativeTime && native.value!==prev.model : origin==='claude'
  const newNativeEffort=prev && owns(prev,'effort')
    ? native.effortTime>(prev.nativeEffortTime || 0) && native.effort!==prev.effort : origin==='claude'
  const model=(newNativeModel && (!prev || !local || local===prev.model) ? native.model : local) || local
  if(!model) return
  const effort=newNativeEffort && (!prev || !owns(prev,'effort') || localEffort===prev.effort) ? native.effort : localEffort
  if(effort!==null && !levels.has(effort)) throw Error('This Claude Code build cannot represent the selected effort: '+effort)
  if(model!==local || effort!==localEffort) {
    const route=routeFor(model)
    if(!route || !await applyDsh({...route,...(effort?{reasoningEffort:effort}:{})})) return
  }
  const patch={}
  if(native.value!==model) patch.model=model
  if(!native.explicitEffort || native.effort!==effort) patch.effortLevel=effort
  const time=Object.keys(patch).length ? await setNative(native,id,patch) : 0
  state.choice={model,effort,nativeTime:owns(patch,'model')?time:native.time,nativeEffortTime:owns(patch,'effortLevel')?time:native.effortTime}
}
