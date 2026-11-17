/** Optional installer transform for Claude Code 2.1.325. Does not install itself. */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
export const HISTORY_WEBVIEW_MARKER='/* dsh shared history and effort v2 */';
export function patchHistoryWebview(source) {
  const legacy=patchHistoryBase(source);
  if(legacy.includes('/* dsh effort off v1 */'))return legacy;
  const menu='D=Q.supportedEffortLevels??["low","medium","high"]';
  if(legacy.includes('async setEffortLevel(e){') && !legacy.includes(menu))throw Error('Claude effort menu changed');
  return legacy.replace(menu,menu+",D=e.__dshDesiredEffort!==undefined && String(Q.value).includes('deepseek-v4.1-flash-1017')?[...new Set(['off',...D])]:D")
    .replace('FAn={default:', 'FAn={off:"Off",default:')
    .replace('if((applied.effort??null)!==desired){', `/* dsh effort off v1 */
      if((desired==='off' || this.__dshEffortConfirmed==='off') && this.__dshOffRestart!==desired){
        this.__dshOffRestart=desired;
        try{await this.restartClaude();}catch(error){this.__dshOffRestart=undefined;throw error;}
        return;
      }
      if(desired!=='off')this.__dshOffRestart=undefined;
      if((applied.effort??null)!==(desired==='off'?null:desired)){`);
}
function patchHistoryBase(source) {
  if(source.includes(HISTORY_WEBVIEW_MARKER))return source;
  if(source.includes('g.__dshHistoryRefreshV1={sessions:')){
    source=source.replace(/loadFromServer\(e\)\{\s*;\(\(\)=>\{const g=globalThis;[\s\S]*?\}\)\(\);if\(this.loadingPromise\)/,'loadFromServer(e){if(this.loadingPromise)');
    source=source.replace(/(async send\(e,t,n,i,o\)\{)if\(this\.__dshHistoryNeedsResume[^]*?if\(this\.__dshHistoryRestart\)await this\.__dshHistoryRestart;/,'$1');
  }
  const anchor='loadFromServer(e){if(this.loadingPromise)return this.loadingPromise;';
  if(source.split(anchor).length!==2 || !source.includes('loadFromMessages(e,t=!0){') || !source.includes('if(t)this.launchClaude()}'))throw new Error('Claude webview history anchors changed; no patch applied');
  const register=`
;${HISTORY_WEBVIEW_MARKER}(()=>{const g=globalThis;
 if(!g.__dshHistoryRefreshV1){
   g.__dshHistoryRefreshV1={sessions:new Map(),results:new Map(),pending:new Set()};
   g.__dshHistoryRefreshV1.refresh=async function(sid){
     const views=this.sessions.get(sid);if(!views)return {ok:false,reason:'not-open'};
     const results=[];
     for(const view of views){
       if(view.sessionId.value!==sid)continue;
       // A transcript reload must never compete with a live native channel.
       if(view.turnRunningOrQueued || view.sendsInFlight || view.isLoading.value){results.push({ok:false,reason:'native-channel-open'});continue;}
       const connection=await view.getConnection();
       const snapshot=await connection.getSession(sid,'dsh_history_refresh');
       if(view.sessionId.value!==sid || view.turnRunningOrQueued || view.sendsInFlight || view.isLoading.value){results.push({ok:false,reason:'state-changed'});continue;}
       view.loadFromMessages(snapshot.messages,false);
       if(view.hasOpenChannel())view.__dshHistoryNeedsResume=true;
       view.updateSessionDiffs(snapshot.sessionDiffs);
       results.push({ok:true,messages:snapshot.messages.length});this.pending.delete(sid);
     }
     const result={sessionId:sid,views:results};this.results.set(sid,result);return result;
   };
   if(typeof window!=='undefined')window.addEventListener('message',event=>{
     const data=event.data;
     if(data?.type==='dsh-history-effort') {
       for(const v of g.__dshHistoryRefreshV1.sessions.get(data.sessionId)||[]) {
         if(v.sessionId.value!==data.sessionId)continue;
         if(v.__dshDesiredEffort!==data.effort)v.__dshRetriedEffort=undefined;
         v.__dshDesiredEffort=data.effort;
         v.__dshCheckEffort?.().catch(()=>{});
       }
     }
     if(data?.type==='dsh-history-changed' && typeof data.sessionId==='string')
       (g.__dshHistoryRefreshV1.pending.add(data.sessionId),g.__dshHistoryRefreshV1.refresh(data.sessionId)).catch(error=>g.__dshHistoryRefreshV1.results.set(data.sessionId,{ok:false,reason:String(error)}));
   });
 }
 const sid=this.sessionId.value;if(sid){let views=g.__dshHistoryRefreshV1.sessions.get(sid);if(!views)g.__dshHistoryRefreshV1.sessions.set(sid,views=new Set());views.add(this);
  const sendHost=message=>{const api=window.acquireVsCodeApi?.__crtl?window.acquireVsCodeApi():g.__dshHistoryApi;if(api)api.postMessage(message);};
  this.__dshPickEffort=(level)=>sendHost({type:'dsh-history-pick-effort',sessionId:this.sessionId.value,effort:level});
  this.__dshCheckEffort=async ()=>{
    const desired=this.__dshDesiredEffort, channel=this.claudeChannelId;
    if(desired===undefined || !channel || this.turnRunningOrQueued || this.sendsInFlight || this.isLoading.value)return;
    if(this.__dshEffortConfirmed===desired && this.__dshEffortChannel===channel)return;
    if(this.__dshChecking)return this.__dshChecking;
    this.__dshChecking=(async()=>{
      const connection=await this.getConnection(), applied=await connection.getAppliedSettings(channel);
      if(!applied || this.claudeChannelId!==channel || this.__dshDesiredEffort!==desired)return;
      if((applied.effort??null)!==desired){
        if(!this.turnRunningOrQueued && !this.sendsInFlight && this.__dshRetriedEffort!==desired){
          this.__dshRetriedEffort=desired;await this.restartClaude();
        }
        return;
      }
      this.__dshEffortConfirmed=desired;this.__dshEffortChannel=channel;
      this.effortAuto.value=desired===null;
      if(desired!==null)this.effortLevel.value=desired;
    })().finally(()=>{this.__dshChecking=undefined;});
    return this.__dshChecking;
  };
  const register=()=>{try{sendHost({type:'dsh-history-register',sessionId:this.sessionId.value,effort:this.__dshDesiredEffort});if(this.__dshDesiredEffort!==undefined)this.__dshCheckEffort().catch(()=>{});}catch{}};register();
  if(!this.__dshHistoryTimer && typeof setInterval==='function')this.__dshHistoryTimer=setInterval(()=>{register();if(g.__dshHistoryRefreshV1.pending.has(this.sessionId.value))g.__dshHistoryRefreshV1.refresh(this.sessionId.value).catch(()=>{});},1000);
 }
})();`;
  const sendAnchor='async send(e,t,n,i,o){';
  if(source.split(sendAnchor).length!==2)throw new Error('Claude send anchor changed');
  if(source.includes('async setEffortLevel(e){')){
    const choose='async setEffortLevel(e){';
    const pill='let F=PNt(Q?.supportsEffort===!0,R,j),';
    if(source.split(pill).length!==2)throw new Error('Claude effort display anchor changed');
    source=source.replace(choose,choose+"if(this.__dshDesiredEffort!==undefined&&this.__dshPickEffort){this.__dshPickEffort(e);return;}").replace(pill,"let F=e.effortAuto.value&&e.__dshEffortConfirmed===null?'Default':PNt(Q?.supportsEffort===!0,R,j),");
    source=source.replace('if(Q?.supportsEffort)R=e.effortLevel.value,',"if(Q?.supportsEffort)R=e.effortAuto.value&&e.__dshEffortConfirmed===null?'default':e.effortLevel.value,").replace('FAn={low:"Low"','FAn={default:"Default",low:"Low"');
  }
  source=source.replace(sendAnchor,sendAnchor+`if(this.__dshHistoryNeedsResume && !this.turnRunningOrQueued && !this.sendsInFlight){this.__dshHistoryRestart??=(async()=>{await this.restartClaude();this.__dshHistoryNeedsResume=false;})().finally(()=>{this.__dshHistoryRestart=undefined;});}if(this.__dshHistoryRestart)await this.__dshHistoryRestart;if(this.__dshDesiredEffort!==undefined && !this.turnRunningOrQueued){await this.__dshCheckEffort();if(this.__dshEffortConfirmed!==this.__dshDesiredEffort || this.__dshEffortChannel!==this.claudeChannelId){throw new Error('میزان فکر این چت هنوز در Claude Code بارگذاری نشده است.');}}`);
  return source.replace(anchor,'loadFromServer(e){'+register+'if(this.loadingPromise)return this.loadingPromise;');
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const file=process.argv[2];
  const source=fs.readFileSync(file,'utf8'), patched=patchHistoryWebview(source);
  if(patched!==source) {
    const tmp=file+'.history-'+process.pid+'.tmp';
    try {fs.writeFileSync(tmp,patched,{flag:'wx',mode:fs.statSync(file).mode});fs.renameSync(tmp,file);}
    finally {fs.rmSync(tmp,{force:true});}
  }
}
