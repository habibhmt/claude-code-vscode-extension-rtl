import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {randomUUID}from'node:crypto';
import {fileURLToPath}from'node:url';const root=path.dirname(fileURLToPath(new URL('../tools-bridge.mjs',import.meta.url)));
const {StdioMcpClient,SessionToolBridge,buildInventory,saveBridgeInventory,deepseekAgentAdapter,serveSessionBridge}=await import(root+'/tools-bridge.mjs');
const base=process.env.DSH_RUNTIME; if(!base)throw Error('DSH_RUNTIME must be absolute @deepseek-ai package directory ending in /');
const {Context,Service}=await import(base+'cordis/lib/index.js');
const Tools=(await import(base+'dsh-tools/lib/index.js')).default;
const Native=await import(base+'dsh-tool-executor-native/lib/index.js');
const Jobs=(await import(base+'dsh-jobs-local/lib/index.js')).default;
const JobsTools=await import(base+'dsh-tool-jobs/lib/index.js');
const {createScope}=await import(base+'dsh-scope/lib/index.js');
const ctx=new Context();
class Prompt extends Service {constructor(c){super(c,'systemPrompt')}tools(){}section(){}getSectionOrder(){return 1}}
const owners=new Map();class Agents extends Service {constructor(c){super(c,'agents')}get(id){return owners.get(id)}list(){return [...owners.values()]}};await ctx.plugin(Agents);await ctx.plugin(Prompt);await ctx.plugin(Tools);await ctx.plugin(Native);await ctx.plugin(Jobs);await ctx.plugin(JobsTools,{completionDelivery:'quiet'});
const nonce='bridge-'+randomUUID(),dir=fs.mkdtempSync(path.join(os.tmpdir(),'tools-live-')),home=path.join(dir,'home');fs.mkdirSync(home);fs.writeFileSync(path.join(dir,'fresh.txt'),nonce+'\n');
 class Working extends Service {constructor(c){super(c,'workingDirectory')}async ensure(){return dir}}
 await ctx.plugin(Working);await ctx.plugin(await import(base+'dsh-tool-working-directory/lib/index.js'));
const FsLocal=(await import(base+'dsh-fs-local/lib/index.js')).default;const FsTools=await import(base+'dsh-tool-fs/lib/index.js');await ctx.plugin(FsLocal);await ctx.plugin(FsTools,{read:true,readImage:false,write:false,edit:false,applyPatch:false});
const Subprocess=(await import(base+'dsh-subprocess-local/lib/index.js')).default;const Search=await import(base+'dsh-tool-fs-search/lib/index.js');await ctx.plugin(Subprocess);await ctx.plugin(Search,{sampleOverCapGlobResults:false});
const agent={id:'test-'+randomUUID(),status:'idle',inbox:{remove(){}},inject(){},followup(){}};let injected;await ctx.plugin({inject:['tools','jobs'],apply(c){injected=c}});agent.ctx=createScope(injected,agent).ctx;agent.session={append(){}};owners.set(agent.id,agent);
const command=process.env.CLAUDE_BINARY;if(!command)throw Error('CLAUDE_BINARY required');
const client=await new StdioMcpClient({command,args:['mcp','serve'],cwd:dir,home}).initialize();
console.log('claude initialized');const tools=await client.list();console.log('claude tools',tools.map(t=>t.name));
const bridge=new SessionToolBridge({sessionId:agent.id,cwd:dir,home,claude:client,deepseek:deepseekAgentAdapter(agent)});
try{
 const read=await bridge.call({id:randomUUID(),sessionId:agent.id,source:'claude',name:'Read',arguments:{file_path:'fresh.txt'}});assert.ok(JSON.stringify(read).includes(nonce));console.log('Read nonce returned',true);
 const jobId=injected.jobs.start({kind:'bridgecheck',label:nonce,owner:agent.id,run(){return {cancel(){},done:Promise.resolve({status:'completed',result:nonce})}}});
 const list=await bridge.call({id:randomUUID(),sessionId:agent.id,source:'deepseek',name:'job_list',arguments:{}});assert.ok(JSON.stringify(list).includes(nonce));console.log('job_list nonce',true,'id',jobId);
 const inventory0=buildInventory({claudeTools:tools,deepseekTools:agent.ctx.tools.schemas(agent)});bridge.inventory=inventory0;const socket=await serveSessionBridge(bridge);const reverse=await new StdioMcpClient({command:process.execPath,args:[root+'/tools-stdio.mjs',socket.bindingFile],cwd:dir,home}).initialize();try{const r=await reverse.call('dsh_job_list',{});assert.ok(JSON.stringify(r).includes(nonce));console.log('reverse MCP job nonce',true);for(const [name,args]of [['dsh_read',{file_path:'fresh.txt'}],['dsh_glob',{pattern:'*.txt'}],['dsh_grep',{pattern:nonce}],['dsh_working_directory',{}]]){const result=await reverse.call(name,args);assert.equal(result.isError,false,JSON.stringify(result));assert.ok(JSON.stringify(result).includes(name==='dsh_glob'?'fresh.txt':name==='dsh_working_directory'?dir:nonce));console.log('reverse MCP',name,true)}}finally{reverse.close();await socket.close()}
 const inventory=buildInventory({claudeTools:tools,deepseekTools:agent.ctx.tools.schemas(agent)});fs.writeFileSync(path.join(dir,'inventory.json'),JSON.stringify(inventory,null,2));fs.writeFileSync(path.join(dir,'proof.json'),JSON.stringify({nonce,jobId,counts:bridge.counts,claudeTools:tools.map(t=>t.name),read:true,reverseJob:true},null,2));if(process.env.BRIDGE_WRITE_INVENTORY==='1')saveBridgeInventory(inventory);console.log('scratch',dir,'counts',bridge.counts)
 class McpManager extends Service {constructor(c){super(c,'mcpManager')}register(){return ()=>{}}};await ctx.plugin(McpManager);
await ctx.plugin(await import(root+'/index.js'),{file:path.join(home,'empty-global-mcp.json'),tools:{home,claudeCommand:command,projects:[dir]}});
 const pointerFile=path.join(home,'.dsh','dsh-rtl','tool-bindings',agent.id+'.json');
 for(let i=0;i<100&&!fs.existsSync(pointerFile);i++)await new Promise(r=>setTimeout(r,100));
 assert.ok(fs.existsSync(pointerFile),'host creates session binding');
 for(let i=0;i<30&&!agent.ctx.tools.get('claude_Read',agent);i++)await new Promise(r=>setTimeout(r,100));
 const admission=await agent.ctx.tools.resolve({agent,modelSelection:{provider:'fixture',model:'fixture'},signal:new AbortController().signal});
 const hostRead=await agent.ctx.tools.execute({agent,toolSet:admission,signal:new AbortController().signal,calls:[{type:'tool-call',id:randomUUID(),name:'claude_Read',arguments:JSON.stringify({file_path:'fresh.txt'})}]});
 assert.ok(JSON.stringify(hostRead).includes(nonce),'actual DSH imported tool executor returns Claude Read nonce');
 const bound=await new StdioMcpClient({command:process.execPath,args:[root+'/tools-stdio.mjs',pointerFile,agent.id,dir],cwd:dir,home}).initialize();
 try{const listed=await bound.list();assert.ok(listed.some(t=>t.name==='dsh_job_list'));const r=await bound.call('dsh_job_list',{});assert.ok(JSON.stringify(r).includes(nonce));console.log('host lifecycle imported Read + pointer-bound reverse MCP',true)}finally{bound.close()}
}finally{client.close();await ctx.fiber.dispose()}

