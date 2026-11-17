import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';
import {patchHistoryWebview} from '../history-webview.mjs';
const source=`class View{async send(e,t,n,i,o){return 'sent'}loadFromServer(e){if(this.loadingPromise)return this.loadingPromise;return 1}loadFromMessages(e,t=!0){this.messages=e;if(t)this.launchClaude()} } globalThis.View=View;`;
async function run(transform){const context={Map,Set,window:{addEventListener(){}}};vm.createContext(context);vm.runInContext(transform(source),context);const v=new context.View();let launches=0;v.launchClaude=()=>{launches++};v.sessionId={value:'sid'};v.isLoading={value:false};v.hasOpenChannel=()=>false;v.getConnection=async()=>({getSession:async()=>({messages:['سلام'],sessionDiffs:[]})});v.updateSessionDiffs=()=>{};v.loadFromServer();await context.__dshHistoryRefreshV1.refresh('sid');return{v,launches,context};}
test('refresh hydrates open view through real method without spawning, blocks active channels',async()=>{
 const {v,launches,context}=await run(patchHistoryWebview);assert.equal(launches,0);assert.equal(v.messages[0],'سلام');v.turnRunningOrQueued=true;const result=await context.__dshHistoryRefreshV1.refresh('sid');assert.equal(result.views[0].reason,'native-channel-open');
});
test('intentional broken no-spawn flag is observable',async()=>{const {launches}=await run(s=>patchHistoryWebview(s).replace('view.loadFromMessages(snapshot.messages,false)','view.loadFromMessages(snapshot.messages,true)'));assert.equal(launches,1);});
test('anchor drift rejected rather than silent incomplete install',()=>assert.throws(()=>patchHistoryWebview('changed version'),/anchors/));
