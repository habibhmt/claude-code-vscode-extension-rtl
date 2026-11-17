#!/usr/bin/env node
/** Claude Code starts this local MCP transport with an exact per-session binding path. */
import fs from 'node:fs'
import readline from 'node:readline'
import { randomUUID } from 'node:crypto'
import { socketRequest } from './tools-bridge.mjs'
const file=process.argv[2]
if(!file)throw Error('explicit session binding file required')
const expectedSession=process.argv[3], expectedCwd=process.argv[4]
const normalized=id=>String(id).replace(/^session-([0-9a-f-]{36})$/i,'$1').toLowerCase()
function checkedJson(file){const st=fs.statSync(file);if(!st.isFile()||(st.mode&0o077)!==0||st.uid!==process.getuid())throw Error('unsafe session binding permissions');return JSON.parse(fs.readFileSync(file,'utf8'))}
function bindingNow(){
 const pointer=checkedJson(file)
 const binding=pointer.bindingFile?checkedJson(pointer.bindingFile):pointer
 if(pointer.bindingFile&&(!expectedSession||!expectedCwd))throw Error('expected session and project required for pointer')
 if(expectedSession&&normalized(binding.sessionId)!==normalized(expectedSession))throw Error('session mismatch')
 if(expectedCwd&&fs.realpathSync(binding.cwd)!==fs.realpathSync(expectedCwd))throw Error('project mismatch')
 if(pointer.bindingFile&&(normalized(pointer.sessionId)!==normalized(binding.sessionId)||fs.realpathSync(pointer.cwd)!==fs.realpathSync(binding.cwd)))throw Error('pointer binding mismatch')
 return binding
}
let ready=false;const seen=new Set();const processId=randomUUID()
for await(const line of readline.createInterface({input:process.stdin})) {
  let m
  try {
    m=JSON.parse(line);if(m.id===undefined)continue
    let result
    if(m.method==='initialize'){ready=true;result={protocolVersion:'2024-11-05',capabilities:{tools:{}},serverInfo:{name:'dsh-session-tools',version:'1.0'}}}
    else if(!ready)throw Error('initialize required')
    else if(m.method==='tools/list'){const r=await socketRequest(bindingNow(),'tools/list',{},randomUUID());result={tools:r.tools.filter(t=>t.source==='deepseek'&&t.status!=='blocked').map(t=>({name:t.name,description:t.description,inputSchema:t.inputSchema}))}}
    else if(m.method==='tools/call'){const name=m.params?.name;if(seen.has(String(m.id)))throw Error('duplicate request; not executed again');seen.add(String(m.id));if(!/^dsh_/.test(name))throw Error('unknown imported tool');result=await socketRequest(bindingNow(),'tools/call',{id:processId+':'+String(m.id),source:'deepseek',name:name.slice(4),arguments:m.params.arguments||{}},randomUUID())}
    else if(m.method==='ping')result={}
    else throw Error('unsupported MCP method')
    process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:m.id,result})+'\n')
  }catch(e){if(m?.id!==undefined)process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:m.id,error:{code:-32000,message:e.message}})+'\n')}
}
