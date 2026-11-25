import test from 'node:test'
import assert from 'node:assert/strict'
import help from '../tool-help.cjs'
import { collectAvailable, tikRows } from '../index.js'

test('every built-in shown by the current DSH has a Persian purpose',()=>{
 const names=['create_worktree','list_mcp_resource_templates','list_mcp_resources','load_workspace_dependencies','mcp__hafeze__gashtan_dar_hafeze','mcp__computer_use__computer','model_hunter','propose_action','read_mcp_resource','session_peers','session_reception','session_send','team_task_create','team_task_get','team_task_list','team_task_update','working_directory','bash','read','job_list','web_search']
 for(const name of names){const r=help.resolveHelp('abzar_dsh',name);assert.doesNotMatch(r.usage,/هنوز/);assert.match(r.usage,/[\u0600-\u06ff]/)}
})
test('scope inventory includes disabled known tools without changing permission',async()=>{
 const agent={id:'help-test'}
 const tools={definitions(scope){assert.equal(scope,agent);return [{name:'read',description:'Read file'}]},view(scope){assert.equal(scope,agent);return {knownNames:new Set(['read','bash'])}},get(name){assert.equal(name,'bash');return {name,description:'Run shell commands'}}}
 const available=await collectAvailable({get(name){if(name==='tools')return tools;if(name==='agents')return {get:()=>agent}}},'help-test')
 assert.deepEqual(available.abzar_dsh,['bash','read'])
 const got=tikRows({available,policy:{list:{abzar_dsh:{bash:false}},az:'chat'}})
 const rows=got.rows.find(r=>r.kind==='abzar_dsh').items
 assert.equal(rows.find(r=>r.name==='bash').on,false)
 assert.equal(rows.find(r=>r.name==='read').usage,'محتوای فایل متنی را با شمارهٔ خط می‌خواند')
})
test('imported name uses original definition and names its source',()=>{
 const r=help.resolveHelp('mcp','claude_Read',{canonicalName:'Read',source:'claude',status:'session-required',reason:'نیاز به چتِ مبدأ'})
 assert.match(r.usage,/محتوای یک فایل را می‌خواند/);assert.match(r.usage,/نیاز به چت/);assert.equal(r.origin,'Claude Code')
 const unknown=help.resolveHelp('eskil','future_skill',{description:'The actual vendor description'})
 assert.match(unknown.usage,/توضیحِ فارسی هنوز آماده نیست/);assert.match(unknown.usage,/actual vendor description/)
 assert.doesNotMatch(help.resolveHelp('afzune','@local/dsh-rtl').usage,/هنوز/)
})

test('imported inventory is isolated by exact folder and chat, including stale seen names',async()=>{
 const fs=await import('node:fs'),os=await import('node:os'),path=await import('node:path')
 const box=fs.mkdtempSync(path.join(os.tmpdir(),'help-scope-'));const cwd=fs.realpathSync(box)
 const sidA='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',sidB='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
 try{
  const file=path.join(box,'.dsh/dsh-rtl/bridge-inventory.json');fs.mkdirSync(path.dirname(file),{recursive:true})
  const inventory=[{name:'claude_Read',canonicalName:'Read',source:'claude',scope:{cwd,sessionId:sidA}},{name:'dsh_job_list',canonicalName:'job_list',source:'deepseek',scope:{cwd,sessionId:sidA}}]
  fs.writeFileSync(file,JSON.stringify(inventory))
  assert.equal(help.bridgeRows(box,cwd,'session-'+sidA).length,2)
  assert.equal(help.bridgeRows(box,cwd,sidB).length,0)
  assert.equal(help.bridgeRows(box,'/',sidA).length,0)
  assert.equal(help.bridgeRows(box,cwd,'').length,0)
  const tools={definitions(){return [{name:'read'},{name:'claude_Read'}]},view(){return {knownNames:new Set(['read','claude_Read','dsh_job_list'])}},get(){return {}}}
  const ctx={get(name){if(name==='tools')return tools;if(name==='agents')return {get:()=>({session:{header:{cwd}}})}}}
  const a=await collectAvailable(ctx,sidA,cwd,box)
  assert.equal(a.mcp.includes('claude_Read'),true)
  assert.equal(a.abzar_dsh.includes('claude_Read'),false,'import appears once in MCP group')
  // Cache was populated with the imported name; removing its scope must hide it even for A.
  fs.writeFileSync(file,JSON.stringify(inventory.map(r=>({...r,scope:{cwd,sessionId:sidB}}))))
  const after=await collectAvailable(ctx,sidA,cwd,box)
  assert.equal(after.mcp.includes('claude_Read'),false)
  assert.equal(after.abzar_dsh.some(help.importedName),false)
  const b=await collectAvailable(ctx,sidB,cwd,box)
  assert.equal(b.mcp.includes('claude_Read'),true)
  const {execFileSync}=await import('node:child_process')
  const py=`import importlib.util,json,sys
sp=importlib.util.spec_from_file_location('tik',sys.argv[1]);t=importlib.util.module_from_spec(sp);sp.loader.exec_module(t)
t.anbar=lambda:{'sarasari':{},'poshe':{},'chat':{}}
t.ghalam_ha=lambda cwd:({'abzar':{'Read','dsh_job_list'},'mcp':{'dsh_job_list'},'afzune':set(),'eskil':set()}, {})
print(json.dumps(t.fehrest(sys.argv[2],sys.argv[3])))`
  const pyFile=new URL('../../abzar/tik_ha.py',import.meta.url).pathname
  const pythonRows=sid=>JSON.parse(execFileSync('python3',['-c',py,pyFile,cwd,sid],{env:{...process.env,HOME:box},encoding:'utf8'})).ghalam
  assert.equal(pythonRows(sidA).mcp.length,0,'Python excludes a stale dide/tick imported name from another chat')
  assert.equal(pythonRows(sidB).mcp[0].n,'dsh_job_list')
  assert.deepEqual(pythonRows(sidB).abzar.map(r=>r.n),['Read'],'Python prevents duplicate imported rows in builtins')

  const stale={home:box,cwd,scopeSessionId:sidA,ghalam:{mcp:[{n:'dsh_job_list',on:true}],abzar:[{n:'Read',on:true},{n:'dsh_job_list',on:true}]}}
  assert.equal(help.enrichClaude(stale).ghalam.mcp.length,0)
  stale.scopeSessionId=sidB;stale.ghalam.mcp=[{n:'dsh_job_list',on:false}]
  assert.equal(help.enrichClaude(stale).ghalam.mcp[0].on,false,'valid imported checkbox is preserved')
 }finally{fs.rmSync(box,{recursive:true,force:true})}
})

test('old MCP alias controls raw row and can be enabled or disabled within one chat and folder',async()=>{
 const fs=await import('node:fs'),os=await import('node:os'),path=await import('node:path')
 const {saveTik,tikFile}=await import('../index.js')
 const base=fs.mkdtempSync(path.join(os.homedir(),'alias-display-test-'));const home=path.join(base,'home'),cwd=path.join(base,'work'),other=path.join(base,'other')
 for(const dir of [home,cwd,other])fs.mkdirSync(dir,{recursive:true})
 const alias='mcp__claude_yeki__claude_Read',raw='claude_Read'
 const available={mcp:[raw],metadata:{mcp:{[raw]:{canonicalName:'Read',source:'claude'}}}}
 const row=(chat,dir=cwd)=>tikRows({home,sessionId:chat,cwd:dir,available}).rows.find(r=>r.kind==='mcp').items[0]
 try{
  assert.equal(saveTik({home,sath:'poshe',cwd,changes:[{kind:'mcp',name:alias,on:false},{kind:'mcp',name:'unrelated-server',on:false}]}).ok,true)
  const sharedApi=(await import('../aa-shared.cjs')).default
  sharedApi.save(home,'prefs','poshe',cwd,'',{aaTaze:false})
  const nativeFile=path.join(home,'.claude/tik_ha.json')
  fs.writeFileSync(nativeFile,JSON.stringify({kooch:1,poshe:{[cwd]:{abzar:{Read:false,Bash:false}}},chat:{},sarasari:{}}))
  assert.equal(row('a').on,false,'legacy alias turns the raw row off')
  const {allowedByTicks,captureTickSnapshot}=await import('../../dsh-claude-yeki/tools-bridge.mjs')
  const frozenPolicy=captureTickSnapshot({home,cwd,sessionId:'a'})
  const allowed=chat=>allowedByTicks({home,cwd,sessionId:chat,name:'Read',source:'claude',...(chat==='a'?{frozenPolicy}:{})})
  assert.equal(allowed('a'),false)
  assert.equal(saveTik({home,sath:'chat',cwd,chat:'a',changes:[{kind:'mcp',name:raw,on:true}]}).ok,true)
  assert.equal(row('a').on,true);assert.equal(allowed('a'),true,'actual frozen bridge policy accepts alias override in this chat');assert.equal(row('b').on,false,'another chat retains folder denial');assert.equal(allowed('b'),false)
  assert.equal(saveTik({home,sath:'chat',cwd,chat:'a',changes:[{kind:'mcp',name:raw,on:false}]}).ok,true)
  assert.equal(row('a').on,false)
  assert.equal(saveTik({home,sath:'poshe',cwd,changes:[{kind:'mcp',name:raw,on:true}]}).ok,true)
  assert.equal(row('b').on,true);assert.equal(allowed('b'),true);assert.equal(row('a').on,false,'explicit chat choice survives folder edit');assert.equal(allowed('a'),false)
  assert.equal(row('b',other).on,true,'other folder keeps its own default')
  const store=JSON.parse(fs.readFileSync(tikFile(home),'utf8'));assert.equal(store.poshe[cwd].mcp[alias],true)
  const shared=JSON.parse(fs.readFileSync(path.join(home,'.claude/aa_shared.json'),'utf8'));assert.equal(shared.ticks.poshe[cwd].mcp[alias],true)
  assert.equal(shared.prefs.poshe[cwd].aaTaze,false,'appearance/auto-open mode is unchanged')
  assert.equal(shared.ticks.poshe[cwd].mcp['unrelated-server'],false,'another server tick is unchanged')
  assert.equal(shared.ticks.poshe[cwd].abzar.Read,true,'cross-app native alias is overridden by name in this folder')
  assert.equal(shared.ticks.poshe[cwd].abzar.Bash,undefined,'unrelated native tool is untouched')
  assert.deepEqual(JSON.parse(fs.readFileSync(nativeFile,'utf8')).poshe[cwd].abzar,{Read:false,Bash:false},'foreign native store is preserved')
 }finally{fs.rmSync(base,{recursive:true,force:true})}
})

test('Claude Python panel maps legacy alias ticks for chat and folder without touching another chat',async()=>{
 const fs=await import('node:fs'),os=await import('node:os'),path=await import('node:path'),{execFileSync}=await import('node:child_process')
 const box=fs.mkdtempSync(path.join(os.tmpdir(),'python-alias-ticks-')),home=path.join(box,'home'),cwd=fs.realpathSync(box)
 const conf=path.join(home,'.claude'),store=path.join(conf,'tik_ha.json'),shared=path.join(conf,'aa_shared.json'),inventory=path.join(home,'.dsh/dsh-rtl/bridge-inventory.json')
 const sidA='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',sidB='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',alias='mcp__dsh_yeki__dsh_read',raw='dsh_read'
 const pyFile=new URL('../../abzar/tik_ha.py',import.meta.url).pathname
 try{
  fs.mkdirSync(conf,{recursive:true});fs.mkdirSync(path.dirname(inventory),{recursive:true})
  fs.writeFileSync(store,JSON.stringify({kooch:1,sarasari:{},poshe:{[cwd]:{mcp:{[alias]:false},abzar:{Read:false}}},chat:{}}))
  fs.writeFileSync(inventory,JSON.stringify([sidA,sidB].map(sessionId=>({name:raw,canonicalName:'read',source:'deepseek',scope:{cwd,sessionId}}))))
  const snapFile=path.join(home,'.dsh/dsh-rtl/tik-sessions',sidA+'.json');fs.mkdirSync(path.dirname(snapFile),{recursive:true});fs.writeFileSync(snapFile,JSON.stringify({list:{abzar_dsh:{read:false,bash:false}}}))
  const env={...process.env,HOME:home,TIK_HA:store,TIK_HA_DIDE:path.join(conf,'seen.json'),CRTL_AA_SHARED:shared,TIK_CLAUDE_JSON:path.join(home,'.claude.json')}
  const run=(args,input)=>JSON.parse(execFileSync('python3',[pyFile,...args],{env,input:input?JSON.stringify(input):'',encoding:'utf8'}))
  const row=sid=>run(['fehrest',cwd,'--chat',sid]).ghalam.mcp.find(r=>r.n===raw)
  const {allowedByTicks,captureTickSnapshot}=await import('../../dsh-claude-yeki/tools-bridge.mjs')
  const frozenPolicy=captureTickSnapshot({home,cwd,sessionId:sidA})
  const allowed=sid=>allowedByTicks({home,cwd,sessionId:sid,name:'read',source:'deepseek',...(sid===sidA?{frozenPolicy}:{})})
  assert.equal(row(sidA).on,false)
  assert.equal(run(['sabt'],{sath:'chat',cwd,chat:sidA,taghir:[{kind:'mcp',name:raw,on:true}]}).ok,true)
  assert.equal(row(sidA).on,true);assert.equal(allowed(sidA),true,'actual bridge sees native + imported alias overrides');assert.equal(row(sidB).on,false);assert.equal(allowed(sidB),false)
  assert.equal(run(['sabt'],{sath:'chat',cwd,chat:sidA,taghir:[{kind:'mcp',name:raw,on:false}]}).ok,true)
  assert.equal(row(sidA).on,false)
  assert.equal(run(['sabt'],{sath:'poshe',cwd,taghir:[{kind:'mcp',name:raw,on:true}]}).ok,true)
  assert.equal(row(sidB).on,true);assert.equal(row(sidA).on,false)
  const actual=JSON.parse(fs.readFileSync(store,'utf8'));assert.equal(actual.chat[sidA].mcp[alias],false);assert.equal(actual.poshe[cwd].mcp[alias],true);assert.equal(actual.poshe[cwd].abzar.Read,true)
  const common=JSON.parse(fs.readFileSync(shared,'utf8'));assert.equal(common.ticks.poshe[cwd].mcp[alias],true)
  assert.equal(common.ticks.chat[sidA].abzar_dsh.read,false,'related native DSH alias follows this chat choice')
  assert.equal(common.ticks.chat[sidA].abzar_dsh.bash,undefined,'unrelated DSH tool remains untouched')
  assert.deepEqual(JSON.parse(fs.readFileSync(snapFile,'utf8')).list.abzar_dsh,{read:false,bash:false},'foreign native snapshot is not replaced')
 }finally{fs.rmSync(box,{recursive:true,force:true})}
})
