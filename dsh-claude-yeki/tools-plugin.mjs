/** Host lifecycle for the scoped bridge. Loaded alongside existing global MCP mirror. */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { StdioMcpClient,SessionToolBridge,deepseekAgentAdapter,buildInventory,saveBridgeInventory,serveSessionBridge,captureTickSnapshot } from './tools-bridge.mjs'
const safeId = value => /^[\w.-]{1,200}$/.test(value) && !['.','..','__proto__','constructor','prototype'].includes(value)
const normalizedId=id=>String(id).replace(/^session-([0-9a-f-]{36})$/i,'$1').toLowerCase()
export function findClaudeBinary(){const base=path.join(os.homedir(),'.vscode','extensions');try{return fs.readdirSync(base).filter(n=>/^anthropic\.claude-code-/.test(n)).sort().reverse().map(n=>path.join(base,n,'resources','native-binary','claude')).find(p=>fs.existsSync(p))}catch{return undefined}}
export function bridgeInScope(config,home,cwd,id){
 let entries=config.projects
 if(!Object.hasOwn(config,'projects')){try{entries=JSON.parse(fs.readFileSync(path.join(home,'.claude','dsh-history','workspaces.json'),'utf8'))}catch{return false}}
 if(!Array.isArray(entries))return false
 return entries.some(e=>{const item=typeof e==='string'?{path:e}:e;try{return fs.realpathSync(item.path)===fs.realpathSync(cwd)&&(!Array.isArray(item.sessions)||item.sessions.map(normalizedId).includes(normalizedId(id)))}catch{return false}})
}
export function mountToolBridge(ctx,config={}) {
 const home=config.home||os.homedir(),command=config.claudeCommand||findClaudeBinary()
 if(!command){ctx.logger?.warn?.('claude-yeki tools: installed Claude binary not found');return}
 const owners=new Map(),tasks=new Set();let stopped=false
 const diagnosticFile=path.join(home,'.dsh','dsh-rtl','tool-bridge-status.json'),diagnostics=new Map()
 function diagnostic(item,stage,extra={}){try{diagnostics.set(item?.agent?.id||'host',{stage,...extra});const tmp=diagnosticFile+'.'+process.pid+'.tmp';fs.mkdirSync(path.dirname(tmp),{recursive:true});fs.writeFileSync(tmp,JSON.stringify({pid:process.pid,time:Date.now(),states:[...diagnostics.values()]})+'\n',{mode:0o600});fs.renameSync(tmp,diagnosticFile)}catch{}}
 diagnostic(null,'mounted',{liveAgents:ctx.agents.list().length})
 const bindings=path.join(home,'.dsh','dsh-rtl','tool-bindings');fs.mkdirSync(bindings,{recursive:true,mode:0o700})
 async function cleanup(item){
  if(item.cleanup)return item.cleanup
  item.closed=true
  item.cleanup=(async()=>{
   for(const fiber of item.registrations)await fiber.dispose()
   item.client?.close();await item.server?.close()
   if(item.temp)fs.rmSync(item.temp,{recursive:true,force:true})
   if(item.pointer){let current;try{current=JSON.parse(fs.readFileSync(item.pointer,'utf8'))}catch{}if(current?.ownerId===item.ownerId)fs.rmSync(item.pointer,{force:true})}
   if(item.scope)saveBridgeInventory([],home,{scope:item.scope,ownerId:item.ownerId,remove:true})
  })();return item.cleanup
 }
 function active(item){return !stopped&&!item.closed&&owners.get(item.agent.id)===item&&ctx.agents.get(item.agent.id)===item.agent}
 async function attach(item){
  const agent=item.agent
  try{
   diagnostic(item,'resolving-directory')
   const cwd=await ctx.workingDirectory.ensure(agent,new AbortController().signal)
   const ownerLive=active(item),scopeMatched=bridgeInScope(config,home,cwd,agent.id)
   diagnostic(item,'directory-resolved',{ownerLive,scopeMatched})
   if(!ownerLive||!scopeMatched)return
   item.scope={cwd:fs.realpathSync(cwd),sessionId:normalizedId(agent.id)}
   item.temp=fs.mkdtempSync(path.join(os.tmpdir(),'claude-tools-home-'));fs.chmodSync(item.temp,0o700)
   item.client=new StdioMcpClient({command,args:['mcp','serve'],cwd,home:item.temp})
   diagnostic(item,'initializing-claude');await item.client.initialize();if(!active(item))return
   diagnostic(item,'listing-claude');const claudeTools=await item.client.list();if(!active(item))return
   diagnostic(item,'claude-discovered',{tools:claudeTools.length})
   const inventory=buildInventory({claudeTools,deepseekTools:ctx.tools.schemas(agent)})
   const frozenPolicy=captureTickSnapshot({home,cwd:item.scope.cwd,sessionId:agent.id,createdAt:agent.session?.header?.createdAt||0})
   const bridge=new SessionToolBridge({sessionId:agent.id,cwd,home,claude:item.client,deepseek:deepseekAgentAdapter(agent,ctx.tools,{cwd:item.scope.cwd,workingDirectory:ctx.workingDirectory}),frozenPolicy});bridge.inventory=inventory
   item.server=await serveSessionBridge(bridge);if(!active(item))return
   const registration=agent.ctx.plugin({inject:['tools'],apply(scoped){
    for(const t of claudeTools){const row=inventory.find(r=>r.source==='claude'&&r.canonicalName===t.name);if(!row||row.status==='blocked')continue
     const parameters={};for(const [key,value]of Object.entries(t.inputSchema?.properties||{}))parameters[key]={...value,...(t.inputSchema.required?.includes(key)?{required:true}:{})}
     scoped.tools.register({name:row.name,description:t.description,parameters,output:{schema:{type:'object',additionalProperties:true},render:(_a,v)=>v.content||[{type:'text',text:JSON.stringify(v)}]},execute:(args,exec)=>{if(exec.agent!==agent)throw Error('owning agent mismatch');return bridge.call({id:exec.callId,sessionId:agent.id,source:'claude',name:t.name,arguments:args})}}, {when:({agent:caller})=>caller===agent&&bridge.policy({home,cwd:bridge.cwd,sessionId:agent.id,name:t.name,source:'claude',frozenPolicy})})
    }
   }})
   diagnostic(item,'registering-aliases');item.registrations.push(registration);await registration;if(!active(item))return
   const pointer=path.join(bindings,normalizedId(agent.id)+'.json'),tmp=pointer+'.'+item.ownerId+'.tmp'
   fs.writeFileSync(tmp,JSON.stringify({sessionId:agent.id,cwd:bridge.cwd,bindingFile:item.server.bindingFile,stdio:fileURLToPath(new URL('./tools-stdio.mjs',import.meta.url)),ownerId:item.ownerId}),{mode:0o600})
   fs.renameSync(tmp,pointer);item.pointer=pointer
   saveBridgeInventory(inventory,home,{scope:item.scope,ownerId:item.ownerId});item.ready=true;diagnostic(item,'ready',{tools:inventory.length})
  }catch(e){diagnostic(item,'failed',{reason:String(e?.code||e?.name||'Error'),hint:/^(cannot get property|MCP |tools\.|service |unknown service)/.test(e?.message||'')?e.message.slice(0,180):undefined});ctx.logger?.warn?.(`claude-yeki tools: binding unavailable: ${e.message}`)}finally{if(!item.ready||!active(item)){if(owners.get(agent.id)===item)owners.delete(agent.id);await cleanup(item)}}
 }
 function begin(agent){if(stopped||!safeId(agent?.id)||owners.has(agent.id))return;const item={agent,ownerId:randomUUID(),registrations:[],closed:false,ready:false};owners.set(agent.id,item);const task=attach(item);tasks.add(task);task.finally(()=>tasks.delete(task)).catch(()=>{})}
 function detach(agent){const item=owners.get(agent.id);if(!item||item.agent!==agent)return;owners.delete(agent.id);item.closed=true;item.client?.close();if(item.ready){const task=cleanup(item);tasks.add(task);task.finally(()=>tasks.delete(task)).catch(()=>{})}}
 ctx.on('agent/created',({agent})=>begin(agent),{global:true})
 ctx.on('agent/disposed',({agent})=>detach(agent),{global:true})
 for(const agent of ctx.agents?.list?.()||[])begin(agent)
 ctx.effect(()=>async()=>{stopped=true;for(const item of owners.values()){item.closed=true;item.client?.close()}await Promise.allSettled([...tasks]);await Promise.allSettled([...owners.values()].map(cleanup));owners.clear()},'session tools bridge')
 return {pending:()=>tasks.size,ready:()=>[...owners.values()].filter(i=>i.ready&&!i.closed).map(i=>i.agent.id)}
}
