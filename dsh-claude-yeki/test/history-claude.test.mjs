import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {publishDsh,projectDsh} from '../history-claude.mjs';
const sid='session-11111111-2222-4333-8444-555555555555';
const events=[
 {type:'user/message',seq:1,time:1700000000000,data:{id:'u',source:{kind:'user'},content:[{type:'text',text:'سلام، پرونده را بخوان'}]}},
 {type:'assistant/message',seq:2,time:1700000001000,data:{message:{content:[{type:'reasoning',text:'PRIVATE-THINKING'},{type:'text',text:'می‌خوانم'},{type:'tool-call',id:'call1',name:'read',arguments:'{"file_path":"/tmp/demo"}'}],source:{model:'deepseek/demo',replayState:{secret:'SECRET'}}}}},
 {type:'tool/call',seq:3,time:1700000001000,data:{callId:'call1',name:'read',arguments:'{"file_path":"/tmp/demo"}'}},
 {type:'tool/result',seq:4,time:1700000002000,data:{message:{toolCallId:'call1',content:[{type:'text',text:'متن پرونده'}]}}},
 {type:'assistant/message',seq:5,time:1700000003000,data:{message:{content:[{type:'text',text:'خواندم'}]}}}
];
test('native Claude projection: text, tool, result, privacy, idempotence and prefix continuation',async()=>{
 const temp=await fs.mkdtemp(path.join(os.tmpdir(),'claude-history-audit-'));try{
 const opts={sessionId:sid,cwd:path.join(temp,'پروژه'),claudeHome:path.join(temp,'claude'),events};
 const first=await publishDsh(opts),bytes=await fs.readFile(first.file,'utf8');assert.equal(first.added,4);
 assert.equal((await publishDsh(opts)).added,0);assert.equal(await fs.readFile(first.file,'utf8'),bytes);
 const rows=bytes.trim().split('\n').map(JSON.parse).filter(r=>r.uuid);
 assert.equal(rows[1].message.content.filter(b=>b.type==='tool_use').length,1);
 assert.equal(rows[2].message.content[0].tool_use_id,'call1');assert(!bytes.includes('PRIVATE-THINKING'));assert(!bytes.includes('SECRET'));
 assert.equal(rows[3].parentUuid,rows[2].uuid);
 const extra={type:'user/message',seq:6,time:1700000004000,data:{source:{kind:'user'},content:[{type:'text',text:'ادامه'}]}};
 const next=await publishDsh({...opts,events:[extra],incremental:true});assert.equal(next.added,1);
 assert.equal((await publishDsh({...opts,events:[extra],incremental:true})).added,0);
 await assert.rejects(publishDsh({...opts,activeNative:true}),/active/);
 assert.equal(projectDsh({...opts,events:[{...extra,data:{...extra.data,id:'claude-history:abc'}}]}).length,0);
 // Actual installed SDK reader: only local disk IO; no query() or model.
 process.env.CLAUDE_CONFIG_DIR=opts.claudeHome;
 const {getSessionMessages}=await import('/Users/habib/.dsh/profiles/desktop/node_modules/@anthropic-ai/claude-agent-sdk/sdk.mjs');
 const messages=await getSessionMessages(first.sessionId,{dir:opts.cwd});
 assert.equal(messages.length,5);assert.equal(messages[0].message.content[0].text,'سلام، پرونده را بخوان');
 assert.equal(messages[1].message.content[1].type,'tool_use');assert.equal(messages[2].message.content[0].type,'tool_result');
 }finally{await fs.rm(temp,{recursive:true,force:true});}
});
test('native collision rejected; explicit exact link + tail permits append and stale tail fails',async()=>{
 const temp=await fs.mkdtemp(path.join(os.tmpdir(),'claude-history-native-'));try{
 const opts={sessionId:sid,cwd:temp,claudeHome:path.join(temp,'claude'),events:[events[0]],incremental:true};
 const {claudeProjectDirectory,claudeSessionId}=await import('../history-claude.mjs');
 const file=path.join(claudeProjectDirectory(temp,opts.claudeHome),claudeSessionId(sid)+'.jsonl');await fs.mkdir(path.dirname(file),{recursive:true});
 const native={type:'user',uuid:'native-message',parentUuid:null,sessionId:claudeSessionId(sid),message:{role:'user',content:[{type:'text',text:'native'}]}};const original=JSON.stringify(native)+'\n';await fs.writeFile(file,original);
 await assert.rejects(publishDsh(opts),/explicit link/);assert.equal(await fs.readFile(file,'utf8'),original);
 const link={file,sessionId:sid,expectedTailUuid:'native-message'};
 const r=await publishDsh({...opts,link,activeNative:false});assert.equal(r.added,1);assert((await fs.readFile(file,'utf8')).startsWith(original));
 await assert.rejects(publishDsh({...opts,link}),/tail/);
 }finally{await fs.rm(temp,{recursive:true,force:true});}
});
