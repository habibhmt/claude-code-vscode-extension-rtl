/** Local, session-bound tool bridge. No model calls, global MCP config or credentials. */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import net from 'node:net'
import readline from 'node:readline'
import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
const READ_CLAUDE = new Set(['Read','Glob','Grep'])
const READ_DSH = new Set(['job_list','read','glob','grep','working_directory','list_subagent_models'])
const IMPORTED = /^(?:claude_|dsh_|mcp__claude_yeki__|mcp__dsh_yeki__)/
import policy from './tools-policy.cjs'
export const {canonicalName,aliasesFor,allowedByTicks,captureTickSnapshot,resolveTickState,updateDraftTickSnapshot,effectiveTickList}=policy
const normalizeSession=id=>String(id).replace(/^session-([0-9a-f-]{36})$/i,'$1').toLowerCase()
const within = (root, target) => target === root || target.startsWith(root + path.sep)
const DSH_BLOCK_REASONS={get_goal:'خواندن هدف در این نسخه فقط داخل driver فعال همان عامل مجاز است؛ پلِ بیرون نوبت آن هویت را ندارد',schedule_list:'سرویس زمان‌بندی list را برای کل مخزن می‌خواند و پارامتر مالک چت ندارد؛ محدودکردن به این چت احراز نشده است',schedule_view:'خواندن زمان‌بندی با شناسه، مالکیت همین چت را از مسیر پل تضمین نمی‌کند',job_output:'خواندن خروجی، cursor مدل را مصرف می‌کند؛ این پل فقط خواندن بدون تغییر را پذیرفته است',job_kill:'توقف کار اثر اجرایی دارد و در این اتصال فقط خواندن مجاز است',list_agents:'فهرست درخت عامل‌ها ممکن است از مالکیت همین چت گسترده‌تر باشد؛ تطبیق محدوده احراز نشده است',session_search:'جست‌وجوی چت‌های دیگر از محدودهٔ همین چت گسترده‌تر است',session_event_search:'دسترسی به چت مقصد جداگانه باید احراز شود؛ این پل فقط مالکیت چت بسته‌شده به اتصال را دارد',session_peers:'فهرست چت‌های دیگر از محدودهٔ اتصال همین چت گسترده‌تر است',web_search:'جست‌وجوی خارجی در کارِ فقط محلی مجاز نشده است',web_fetch:'تماس خارجی در کارِ فقط محلی مجاز نشده است',bash:'اجرای فرمان در پلِ فقط خواندنی باز نشده است',write:'نوشتن فایل در پلِ فقط خواندنی باز نشده است',edit:'ویرایش فایل در پلِ فقط خواندنی باز نشده است',apply_patch:'تغییر فایل در پلِ فقط خواندنی باز نشده است'}
const CLAUDE_BLOCK_REASONS={
 Bash:'اجرای فرمان به محیط امن و اجازهٔ بومی Claude نیاز دارد؛ اتصال آن را حمل نمی‌کند',
 Write:'نوشتن فایل بدون تأیید و سیاست بومی Claude از پل باز نشده است',
 Edit:'ویرایش فایل بدون تأیید و سیاست بومی Claude از پل باز نشده است',
 NotebookEdit:'ویرایش دفترچه به تأیید و سیاست بومی Claude نیاز دارد',
 WebFetch:'تماس شبکه در محدودهٔ اتصال فقط محلی مجاز نشده است',
 WebSearch:'جست‌وجوی اینترنتی در محدودهٔ اتصال فقط محلی مجاز نشده است',
 Agent:'مدیریت عامل به اجرای بومی و چت اصلی Claude وابسته است',
 Workflow:'گردش کار به عامل‌ها و چت اصلی Claude وابسته است',
 SendMessage:'فرستادن پیام به شناسه و اجازهٔ بومی عامل مقصد نیاز دارد',
 ListAgents:'فهرست عامل‌های فرایند MCP مستقل همان عامل‌های چت اصلی نیست',
 TaskStop:'توقف کار به شناسه و مالکیت کار در چت اصلی وابسته است',
 EnterWorktree:'ساخت محیط Git به مالکیت و اجازهٔ چت اصلی وابسته است',
 ExitWorktree:'بستن محیط Git به مالکیت و اجازهٔ چت اصلی وابسته است',
 CronCreate:'زمان‌بندی به مالکیت و اجازهٔ چت اصلی Claude وابسته است',
 CronDelete:'حذف زمان‌بندی به مالکیت و اجازهٔ چت اصلی Claude وابسته است',
 CronList:'فهرست زمان‌بندی فرایند MCP مستقل همان زمان‌بندی چت اصلی نیست',
 ScheduleWakeup:'بیدارکردن عامل به زمان‌بندی و هویت چت اصلی وابسته است',
 Monitor:'نظارت به عمر فرایند و مالکیت چت اصلی Claude وابسته است',
 Skill:'اجرای اسکیل ممکن است ابزار دیگری اجرا کند؛ سیاست بومی منتقل نشده است',
 ReportFindings:'ثبت یافته به مقصد و زمینهٔ بومی Claude وابسته است',
 ToolSearch:'کشف ابزارهای فرایند مستقل نمایندهٔ ابزارها و اجازهٔ چت اصلی نیست',
}
export function buildInventory({claudeTools=[],deepseekTools=[]}={}) {
  return [['claude',claudeTools],['deepseek',deepseekTools]].flatMap(([source,tools])=>tools.filter(t=>!IMPORTED.test(t.name)).map(t=>{
    const safe=(source==='claude'?READ_CLAUDE:READ_DSH).has(t.name)
    return {name:`${source==='claude'?'claude':'dsh'}_${t.name}`,source,canonicalName:t.name,description:t.description||'',inputSchema:t.inputSchema||{type:'object',properties:Object.fromEntries(Object.entries(t.parameters||{}).map(([k,v])=>[k,Object.fromEntries(Object.entries(v).filter(([p])=>p!=='required'))])),required:Object.entries(t.parameters||{}).filter(([,v])=>v.required).map(([k])=>k)},status:safe?'session-required':'blocked',reason:safe?'نیاز به چت و پوشهٔ تطبیق‌یافته؛ تیک و اجازه هنگام اجرا دوباره سنجیده می‌شود':(source==='claude'?CLAUDE_BLOCK_REASONS[t.name]:DSH_BLOCK_REASONS[t.name])||'اجازه یا محیط بومی این ابزار از اتصال محلی منتقل نشده است',requiresSession:true,requiresConsent:!safe}
  }))
}
export const inventoryFile = (home=os.homedir()) => path.join(home,'.dsh','dsh-rtl','bridge-inventory.json')
export function readBridgeInventory(home) {try{return JSON.parse(fs.readFileSync(inventoryFile(home),'utf8'))}catch{return []}}
export function saveBridgeInventory(rows,home,{scope,ownerId,remove=false}={}) {const file=inventoryFile(home);fs.mkdirSync(path.dirname(file),{recursive:true});let out=rows
 if(scope){const sid=normalizeSession(scope.sessionId);out=readBridgeInventory(home).filter(r=>r.scope&&(r.scope.sessionId!==sid||r.scope.cwd!==scope.cwd||(remove&&r.ownerId!==ownerId)));if(!remove)out.push(...rows.map(r=>({...r,scope:{cwd:scope.cwd,sessionId:sid},ownerId})))}
 const tmp=file+'.'+randomBytes(8).toString('hex')+'.tmp';fs.writeFileSync(tmp,JSON.stringify(out,null,2)+'\n',{mode:0o600});fs.renameSync(tmp,file)
}


/** MCP stdio uses newline-delimited JSON-RPC; IDs are transport-owned, never replayed. */
export class StdioMcpClient {
  constructor({command,args=[],cwd,home,timeoutMs=15000}) {
    this.nextId=0;this.pending=new Map();this.timeoutMs=timeoutMs
    // An isolated HOME avoids global hooks, MCP servers, credentials and telemetry settings.
    this.child=spawn(command,args,{cwd,env:{PATH:process.env.PATH||'/usr/bin:/bin',HOME:home,USER:process.env.USER||'',CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC:'1',DISABLE_TELEMETRY:'1'},stdio:['pipe','pipe','ignore']})
    this.lines=readline.createInterface({input:this.child.stdout})
    this.lines.on('line',line=>{let m;try{m=JSON.parse(line)}catch{return}const p=this.pending.get(m.id);if(!p)return;this.pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(Error(m.error.message)):p.resolve(m.result)})
    const fail=()=>{for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(Error('MCP connection closed'))}this.pending.clear()}
    this.child.on('error',fail);this.child.on('exit',fail);this.child.stdin.on('error',fail)
  }
  request(method,params={}) {const id=++this.nextId;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.pending.delete(id);reject(Error(`MCP timeout: ${method}; execution is not retried`))},this.timeoutMs);this.pending.set(id,{resolve,reject,timer});this.child.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method,params})+'\n')})}
  async initialize(){await this.request('initialize',{protocolVersion:'2024-11-05',capabilities:{},clientInfo:{name:'local-session-tools-bridge',version:'1.0'}});this.child.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})+'\n');return this}
  async list(){return (await this.request('tools/list')).tools||[]}
  call(name,args){return this.request('tools/call',{name,arguments:args})}
  close(){this.child.stdin.end();this.child.kill();this.lines.close()}
}
export async function discoverClaudeTools(options){const client=await new StdioMcpClient({...options,args:['mcp','serve']}).initialize();try{return await client.list()}finally{client.close()}}

/** Identity comes from a bound local channel, never from model-provided tool arguments. */
export class SessionToolBridge {
  constructor({sessionId,cwd,home,claude,deepseek,policy=allowedByTicks,frozenPolicy}) {
    if(!/^[\w.-]{1,200}$/.test(sessionId)||['.','..'].includes(sessionId)||!path.isAbsolute(cwd))throw Error('session and absolute project required')
    this.frozenPolicy=frozenPolicy;this.sessionId=sessionId;this.cwd=fs.realpathSync(cwd);this.home=home;this.claude=claude;this.deepseek=deepseek;this.policy=policy;this.executions=new Map();this.counts={claude:0,deepseek:0}
  }
  visibleInventory(){return (this.inventory||[]).filter(t=>t.status!=='blocked'&&this.policy({home:this.home,cwd:this.cwd,sessionId:this.sessionId,name:t.canonicalName,source:t.source,frozenPolicy:this.frozenPolicy}))}
  async call({id,sessionId,source,name,arguments:args={}}) {
    if(sessionId!==this.sessionId)throw Error('session mismatch')
    if(typeof id!=='string'||!id||id.length>200)throw Error('request id required')
    if(IMPORTED.test(name))throw Error('imported tool cannot be exported again')
    if(source!=='claude'&&source!=='deepseek')throw Error('unknown source')
    const key=source+':'+id
    if(this.executions.has(key))throw Error('duplicate request; not executed again')
    this.executions.set(key,'admitted') // fail closed even if policy/transport later fails
    if(!this.policy({home:this.home,cwd:this.cwd,sessionId,name,source,frozenPolicy:this.frozenPolicy}))throw Error('tool denied by ticks')
    if(!(source==='claude'?READ_CLAUDE:READ_DSH).has(name))throw Error('native consent/context unavailable for this tool')
    if(!args||typeof args!=='object'||Array.isArray(args))throw Error('object arguments required')
    const arg=structuredClone(args)
    if(source==='deepseek'&&name==='working_directory'&&Object.keys(arg).length)throw Error('working_directory is read-only here; cd is not admitted')
    if(source==='deepseek'&&name==='list_subagent_models'&&Object.keys(arg).length)throw Error('provider/model lookup may contact a network; only local provider listing admitted')
    if(!['job_list','working_directory','list_subagent_models'].includes(name)){
      const isRead=name.toLowerCase()==='read',field=isRead?'file_path':'path'
      if(isRead&&!arg.file_path)throw Error('file_path required')
      const real=fs.realpathSync(path.resolve(this.cwd,arg[field]||this.cwd))
      if(!within(this.cwd,real))throw Error('path outside bound project')
      arg[field]=real
      if(!isRead)assertNoSymlinks(real)
    }
    if(source==='claude') {
      if(!this.claude)throw Error('Claude connection unavailable')
      this.counts.claude++;return this.claude.call(name,arg)
    }
    if(!this.deepseek)throw Error('DeepSeek agent context unavailable')
    this.counts.deepseek++;return this.deepseek(name,arg,id)
  }
}
function assertNoSymlinks(root){const st=fs.lstatSync(root);if(st.isSymbolicLink())throw Error('symlink traversal denied');if(st.isDirectory())for(const d of fs.readdirSync(root,{withFileTypes:true})){const p=path.join(root,d.name);if(d.isSymbolicLink())throw Error('symlink traversal denied');if(d.isDirectory())assertNoSymlinks(p)}}

/** Delegate to the owning agent's executor, preserving restriction/approval/guard pipelines. */
export function deepseekAgentAdapter(agent,tools,{cwd,workingDirectory}={}) {
  return async(name,args,id)=>{
    if(!agent?.id||!agent.ctx)throw Error('owning DeepSeek agent required')
    const registry=tools||agent.ctx.tools
    if(cwd&&workingDirectory&&fs.realpathSync(await workingDirectory.ensure(agent,new AbortController().signal))!==cwd)throw Error('agent working directory changed; rebind required')
    if(IMPORTED.test(name))throw Error('bridge loop denied')
    if(!registry.executable(name,agent))throw Error('tool unavailable in this agent or requires step admission')
    const batch=await registry.execute({agent,signal:new AbortController().signal,calls:[{type:'tool-call',id:`bridge-${id}`,name,arguments:JSON.stringify(args)}]})
    const result=batch.results[0]?.result
    if(!result)throw Error('missing executor result')
    return {content:result.content,isError:result.isError===true}
  }
}

/** Private socket, capability and immutable binding: one instance per DeepSeek chat. */
export async function serveSessionBridge(bridge,{directory}={}) {
  const dir=directory||fs.mkdtempSync(path.join(os.tmpdir(),'dsh-tools-'));fs.mkdirSync(dir,{recursive:true,mode:0o700});fs.chmodSync(dir,0o700)
  const socket=path.join(dir,'tools.sock'),token=randomBytes(32).toString('hex')
  const server=net.createServer(connection=>{let size=0;const lines=readline.createInterface({input:connection});lines.on('line',async line=>{size+=line.length;if(size>1024*1024){connection.destroy();return}let m;try{m=JSON.parse(line);if(m.token!==token)throw Error('local capability denied');let result;if(m.method==='tools/list')result={tools:bridge.visibleInventory()};else if(m.method==='tools/call')result=await bridge.call({...m.params,sessionId:bridge.sessionId});else throw Error('unknown bridge method');connection.write(JSON.stringify({id:m.id,result})+'\n')}catch(e){connection.write(JSON.stringify({id:m?.id,error:{message:e.message}})+'\n')}})})
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(socket,resolve)});fs.chmodSync(socket,0o600)
  const bindingFile=path.join(dir,'binding.json');fs.writeFileSync(bindingFile,JSON.stringify({socket,token,sessionId:bridge.sessionId,cwd:bridge.cwd}),{mode:0o600})
  return {bindingFile,socket,close:()=>new Promise(resolve=>server.close(()=>{fs.rmSync(dir,{recursive:true,force:true});resolve()}))}
}
export function socketRequest(binding,method,params,id) {return new Promise((resolve,reject)=>{const client=net.createConnection(binding.socket);const timer=setTimeout(()=>{client.destroy();reject(Error('bound bridge timeout; no retry'))},15000);client.on('error',e=>{clearTimeout(timer);reject(e)});client.on('connect',()=>client.write(JSON.stringify({token:binding.token,id,method,params})+'\n'));const lines=readline.createInterface({input:client});lines.once('line',line=>{clearTimeout(timer);client.end();lines.close();const m=JSON.parse(line);m.error?reject(Error(m.error.message)):resolve(m.result)})})}
