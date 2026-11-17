import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { SessionToolBridge, allowedByTicks, buildInventory, serveSessionBridge, socketRequest } from '../tools-bridge.mjs'
const make=()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'tools-unit-'));fs.writeFileSync(path.join(dir,'fresh.txt'),'fresh');return dir}
test('scope, alias denial, duplicate IDs, consent and loop guards fail closed',async()=>{
 const dir=make();let calls=0
 try{
 const b=new SessionToolBridge({sessionId:'one',cwd:dir,home:dir,claude:{call:async()=>{calls++;return {content:[]}}},deepseek:async()=>{calls++;return {content:[]}}})
 const call=(patch={})=>b.call({id:'a',sessionId:'one',source:'claude',name:'Read',arguments:{file_path:'fresh.txt'},...patch})
 await call();await assert.rejects(call(),/duplicate/);assert.equal(calls,1)
 await assert.rejects(call({id:'b',sessionId:'two'}),/session mismatch/)
 await assert.rejects(call({id:'c',name:'claude_Read'}),/exported again/)
 await assert.rejects(call({id:'d',name:'Bash'}),/consent/)
 await assert.rejects(call({id:'e',arguments:{file_path:'/etc/hosts'}}),/outside/)
 fs.mkdirSync(path.join(dir,'.claude'));fs.writeFileSync(path.join(dir,'.claude','aa_shared.json'),JSON.stringify({ticks:{sarasari:{mcp:{Read:false}}}}))
 await assert.rejects(call({id:'f'}),/denied/)
 assert.equal(allowedByTicks({home:dir,cwd:dir,sessionId:'one',name:'claude_Read',source:'claude'}),false)
 assert.equal(calls,1)
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
})
test('chat snapshot survives changed folder defaults and separates a second chat',()=>{
 const dir=make();try{fs.mkdirSync(path.join(dir,'.claude'));fs.writeFileSync(path.join(dir,'.claude','aa_shared.json'),JSON.stringify({ticks:{poshe:{[dir]:{mcp:{Read:false}}}}}));const snapshots=path.join(dir,'.dsh','dsh-rtl','tik-sessions');fs.mkdirSync(snapshots,{recursive:true});fs.writeFileSync(path.join(snapshots,'old.json'),JSON.stringify({list:{mcp:{Read:true}}}));assert.equal(allowedByTicks({home:dir,cwd:dir,sessionId:'old',name:'Read',source:'claude'}),true);assert.equal(allowedByTicks({home:dir,cwd:dir,sessionId:'new',name:'Read',source:'claude'}),false)}finally{fs.rmSync(dir,{recursive:true,force:true})}
})
test('private socket requires local capability and immutable binding',async()=>{
 const dir=make();const bridge=new SessionToolBridge({sessionId:'one',cwd:dir,home:dir,deepseek:async()=>({content:[{type:'text',text:'one'}]})});const server=await serveSessionBridge(bridge);const binding=JSON.parse(fs.readFileSync(server.bindingFile));try{assert.equal(fs.statSync(server.bindingFile).mode&0o777,0o600);await assert.rejects(socketRequest({...binding,token:'wrong'},'tools/call',{id:'1',source:'deepseek',name:'job_list'},'rpc1'),/capability/);const r=await socketRequest(binding,'tools/call',{id:'1',source:'deepseek',name:'job_list',sessionId:'two'},'rpc2');assert.equal(r.content[0].text,'one')}finally{await server.close();fs.rmSync(dir,{recursive:true,force:true})}
})
test('inventory filters imports and labels untransportable consent',()=>{const rows=buildInventory({claudeTools:[{name:'Read',description:'read'},{name:'Bash'},{name:'dsh_job_list'}]});assert.equal(rows.length,2);assert.equal(rows[0].status,'session-required');assert.equal(rows[1].status,'blocked')})
test('native built-in and actual double-prefixed MCP denials also hide tools/list',async()=>{
 const dir=make();try{
 const conf=path.join(dir,'.claude');fs.mkdirSync(conf)
 const b=new SessionToolBridge({sessionId:'one',cwd:dir,home:dir});b.inventory=buildInventory({deepseekTools:[{name:'job_list'}],claudeTools:[{name:'Read'}]})
 fs.writeFileSync(path.join(conf,'aa_shared.json'),JSON.stringify({ticks:{chat:{one:{mcp:{mcp__dsh_yeki__dsh_job_list:false}}}}}))
 assert.deepEqual(b.visibleInventory().map(t=>t.name),['claude_Read'])
 const second=new SessionToolBridge({sessionId:'two',cwd:dir,home:dir});second.inventory=b.inventory;assert.equal(second.visibleInventory().length,2)
 fs.writeFileSync(path.join(conf,'tik_ha.json'),JSON.stringify({chat:{one:{abzar:{Read:false}}}}))
 assert.equal(b.visibleInventory().length,0)
 fs.writeFileSync(path.join(conf,'settings.json'),JSON.stringify({permissions:{deny:['Read(./private/**)']}}))
 assert.equal(allowedByTicks({home:dir,cwd:dir,sessionId:'two',name:'Read',source:'claude'}),false)
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
})
test('folder snapshot is independent of global ticks, and native Claude defaults freeze with new chat',async()=>{
 const {captureTickSnapshot}=await import('../tools-bridge.mjs');const dir=make();try{
 const conf=path.join(dir,'.claude');fs.mkdirSync(conf);const file=path.join(conf,'tik_ha.json');fs.writeFileSync(file,JSON.stringify({kooch:1,sarasari:{abzar:{Read:false,Bash:false}},poshe:{[dir]:{abzar:{Read:true}}}}))
 assert.equal(allowedByTicks({home:dir,cwd:dir,sessionId:'one',name:'Bash',source:'claude'}),true)
 const frozen=captureTickSnapshot({home:dir,cwd:dir,sessionId:'old',createdAt:100})
 fs.writeFileSync(file,JSON.stringify({kooch:200,poshe:{[dir]:{abzar:{Read:false}}}}))
 assert.equal(allowedByTicks({home:dir,cwd:dir,sessionId:'old',name:'Read',source:'claude',frozenPolicy:frozen}),true)
 const snap=path.join(dir,'.dsh','dsh-rtl','tik-sessions');fs.mkdirSync(snap,{recursive:true});fs.writeFileSync(path.join(snap,'new.json'),JSON.stringify({list:{abzar_dsh:{read:true}}}))
 const fresh=captureTickSnapshot({home:dir,cwd:dir,sessionId:'new',createdAt:300})
 assert.equal(allowedByTicks({home:dir,cwd:dir,sessionId:'new',name:'Read',source:'claude',frozenPolicy:fresh}),false)
 assert.deepEqual(captureTickSnapshot({home:dir,cwd:dir,sessionId:'old',createdAt:300}),frozen)
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
})
test('inventory is isolated by exact chat and project and cleanup respects owner',async()=>{
 const {saveBridgeInventory,readBridgeInventory}=await import('../tools-bridge.mjs');const dir=make();try{
 const rows=buildInventory({claudeTools:[{name:'Read'}]});saveBridgeInventory(rows,dir,{scope:{cwd:dir,sessionId:'one'},ownerId:'first'});saveBridgeInventory(rows,dir,{scope:{cwd:dir,sessionId:'two'},ownerId:'second'});assert.equal(readBridgeInventory(dir).length,2)
 saveBridgeInventory(rows,dir,{scope:{cwd:dir,sessionId:'one'},ownerId:'replacement'});saveBridgeInventory([],dir,{scope:{cwd:dir,sessionId:'one'},ownerId:'first',remove:true});assert.equal(readBridgeInventory(dir).length,2)
 saveBridgeInventory([],dir,{scope:{cwd:dir,sessionId:'one'},ownerId:'replacement',remove:true});assert.deepEqual(readBridgeInventory(dir).map(r=>r.scope.sessionId),['two'])
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
})
test('pending attach is not ready and disposed owner cannot publish a binding',async()=>{
 const {mountToolBridge,bridgeInScope}=await import('../tools-plugin.mjs');const dir=make();let resolveCwd;const events=new Map(),effects=[];const agent={id:'one'};let owner=agent
 const ctx={agents:{list:()=>[agent],get:()=>owner},workingDirectory:{ensure:()=>new Promise(r=>resolveCwd=r)},on:(name,fn)=>events.set(name,fn),effect:fn=>effects.push(fn()),logger:{warn(){}}}
 try{assert.equal(bridgeInScope({projects:[]},dir,dir,'one'),false);assert.equal(bridgeInScope({projects:[{path:dir,sessions:['two']}]},dir,dir,'one'),false)
 const bridge=mountToolBridge(ctx,{home:dir,claudeCommand:'/bin/false',projects:[dir]});assert.deepEqual(bridge.ready(),[]);assert.equal(bridge.pending(),1);owner=undefined;events.get('agent/disposed')({agent});resolveCwd(dir);await new Promise(r=>setTimeout(r,10));assert.deepEqual(bridge.ready(),[]);assert.equal(fs.readdirSync(path.join(dir,'.dsh','dsh-rtl','tool-bindings')).length,0);await Promise.all(effects.map(f=>f()))
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
})
test('normal index injection returns a valid void effect rather than the bridge test handle',async()=>{
 const {apply}=await import('../index.js');const dir=make(),cleanups=[]
 const scoped={agents:{list:()=>[],get:()=>undefined},on(){},logger:{warn(){}},effect(fn){cleanups.push(fn())}}
 const ctx={inject(deps,callback){if(deps.includes('workingDirectory'))assert.equal(callback(scoped),undefined,'Cordis plugin body must discard bridge handle')},effect(fn){cleanups.push(fn())},mcpManager:{register(){throw Error('no global mirror entries expected')}}}
 try{apply(ctx,{file:path.join(dir,'no-global-mcp.json'),tools:{home:dir,claudeCommand:'/bin/false',projects:[]}});await Promise.all(cleanups.map(fn=>fn()))}finally{fs.rmSync(dir,{recursive:true,force:true})}
})
test('shared aliases and draft refresh use the same effective frozen policy as execution',async()=>{
 const {aliasesFor,resolveTickState,updateDraftTickSnapshot,captureTickSnapshot}=await import('../tools-bridge.mjs');const dir=make();try{
 const conf=path.join(dir,'.claude');fs.mkdirSync(conf);fs.writeFileSync(path.join(conf,'tik_ha.json'),JSON.stringify({kooch:1,poshe:{[dir]:{abzar:{Read:false}}}}))
 const frozen=captureTickSnapshot({home:dir,cwd:dir,sessionId:'draft',createdAt:100});assert.ok(aliasesFor('mcp__dsh_yeki__dsh_read').includes('Read'));assert.equal(resolveTickState({home:dir,cwd:dir,sessionId:'draft',name:'claude_Read',source:'claude',scope:'chat'}).on,false)
 assert.equal(updateDraftTickSnapshot({home:dir,cwd:dir,sessionId:'draft',changes:[{kind:'mcp',name:'claude_Read',on:true}]}).updated,true)
 assert.equal(allowedByTicks({home:dir,cwd:dir,sessionId:'draft',name:'Read',source:'claude',frozenPolicy:frozen}),true)
 assert.equal(resolveTickState({home:dir,cwd:dir,sessionId:'draft',name:'dsh_read',source:'deepseek',scope:'chat'}).on,true)
 assert.equal(resolveTickState({home:dir,cwd:dir,sessionId:'draft',name:'Read',source:'claude',scope:'poshe'}).on,false)
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
})
