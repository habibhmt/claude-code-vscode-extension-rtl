/* The VS Code host side of a shared conversation. */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const SID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function privateJson(file) {
 const info = fs.lstatSync(file);
 if (!info.isFile() || info.uid !== process.getuid() || (info.mode & 0o077)) return null;
 return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function boundToolServer(bindingDir, sid, cwd) {
 if (!SID.test(sid || '') || !cwd || !path.isAbsolute(cwd)) return;
 try {
  const file = path.join(bindingDir, sid.toLowerCase() + '.json');
  const pointer = privateJson(file);
  const script = path.join(__dirname, 'tools-stdio.mjs');
  const project = fs.realpathSync(cwd);
  if (!pointer || pointer.stdio !== script || pointer.cwd !== project ||
      String(pointer.sessionId).replace(/^session-/, '').toLowerCase() !== sid.toLowerCase()) return;
  const binding = privateJson(pointer.bindingFile);
  if (!binding || binding.sessionId !== pointer.sessionId || binding.cwd !== project ||
      path.dirname(binding.socket) !== path.dirname(pointer.bindingFile)) return;
  const socket = fs.lstatSync(binding.socket);
  if (!socket.isSocket() || socket.uid !== process.getuid() || (socket.mode & 0o077)) return;
  // The macOS GUI environment can omit Homebrew from PATH; Electron itself is not the Node CLI.
  const runtimes = [process.versions.electron ? null : process.execPath, '/opt/homebrew/bin/node', '/usr/local/bin/node'];
  const node = runtimes.find(candidate => {
   if (!candidate) return false;
   try { fs.accessSync(candidate, fs.constants.X_OK); return true; } catch { return false; }
  });
  if (node) return { type: 'stdio', command: node, args: [script, file, sid, project] };
 } catch { /* No live connection for this conversation. Native Claude can still start. */ }
}
function sharedEffort(home,sid,cwd) {
 if(!SID.test(sid||'') || !cwd)return undefined;
 try{
  const directory=path.join(home,'dsh-history');
  const link=JSON.parse(fs.readFileSync(path.join(directory,'links',sid+'.json'),'utf8'));
  if(link.cwd!==cwd || !Object.hasOwn(link.choice||{},'effort'))return undefined;
  const rules=JSON.parse(fs.readFileSync(path.join(directory,'workspaces.json'),'utf8'));
  if(!rules.some(r=>r.path===cwd && (!r.sessions || r.sessions.some(x=>String(x).replace(/^session-/,'')===sid))))return undefined;
  const settings=JSON.parse(fs.readFileSync(process.env.CRTL_TANZIMAT||path.join(home,'crtl_tanzimat.json'),'utf8'));
  const current=settings.chat?.[sid]?.effortLevel;
  const value=current && Number(current.t)>=link.choice.nativeEffortTime ? current.v : link.choice.effort;
  return value===null || ['off','low','medium','high','xhigh','max'].includes(value) ? value : undefined;
 }catch{return undefined;}
}
function launch(sid,options,home=process.env.CLAUDE_CONFIG_DIR||path.join(os.homedir(),'.claude'),trusted=false,bindingDir=path.join(os.homedir(),'.dsh','dsh-rtl','tool-bindings')) {
 if (trusted && !options.mcpServers?.dsh_yeki) {
  const server = boundToolServer(bindingDir, sid, options.cwd);
  // The extension also keeps this channel-local map for later changes to its MCP servers.
  if (server) (options.mcpServers ||= {}).dsh_yeki = server;
 }
 const level=sharedEffort(home,sid,options.cwd);
 if(level===undefined)return;
 if(level===null || level==='off') {
  delete options.effort;
  options.env={...options.env,CLAUDE_CODE_EFFORT_LEVEL:'auto'};
  if(level==='off') {
   const body=JSON.parse(options.env.CLAUDE_CODE_EXTRA_BODY || process.env.CLAUDE_CODE_EXTRA_BODY || '{}');
   options.env.MAX_THINKING_TOKENS='0';
   options.env.CLAUDE_CODE_EXTRA_BODY=JSON.stringify({...body,thinking:{type:'disabled'}});
  }
 }else{
  options.effort=level;
  if(options.env)delete options.env.CLAUDE_CODE_EFFORT_LEVEL;
 }
}
// A new native chat learns its session ID after launch. A resumed chat can also
// be open before Desktop restores its tools. Attach either one when the matching
// local endpoint is ready, through the extension's own serialized MCP update.
function watchToolChannel(owner, id, channel, {
 home = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude'),
 bindingDir = path.join(os.homedir(), '.dsh', 'dsh-rtl', 'tool-bindings'),
 interval = 2000,
} = {}) {
 if (!channel?.cwd || !owner?.setChannelMcpServers || !owner.workspaceTrust?.postureFor) return;
 let project, rule;
 try {
  project = fs.realpathSync(channel.cwd);
  rule = JSON.parse(fs.readFileSync(path.join(home, 'dsh-history', 'workspaces.json'), 'utf8'))
   .find(item => { try { return fs.realpathSync(item.path) === project; } catch { return false; } });
 } catch { return; }
 if (!rule) return;
 const ourScript = path.join(__dirname, 'tools-stdio.mjs');
 const allowed = sid => SID.test(sid || '') && (!Array.isArray(rule.sessions) ||
  rule.sessions.some(value => String(value).replace(/^session-/, '').toLowerCase() === sid.toLowerCase()));
 let updating = false;
 const timer = setInterval(update, interval);
 timer.unref?.();
 async function update() {
  if (owner.channels.get(id) !== channel) { clearInterval(timer); return; }
  if (updating) return;
  const sid = channel.sessionId;
  const current = channel.mcpServers?.dsh_yeki;
  if (current && current.args?.[0] !== ourScript) return;
  const server = allowed(sid) ? boundToolServer(bindingDir, sid, project) : undefined;
  if (current?.args?.[1] === server?.args[1]) return;
  updating = true;
  try {
   if (current) {
    await owner.setChannelMcpServers(channel, previous => {
     if (previous.dsh_yeki !== current) return previous;
     const next = { ...previous };
     delete next.dsh_yeki;
     return next;
    });
    return;
   }
   const posture = await owner.workspaceTrust.postureFor(channel.cwd, { mayAsk: false });
   if (posture.kind !== 'trusted' || owner.channels.get(id) !== channel || channel.sessionId !== sid) return;
   await owner.setChannelMcpServers(channel, previous =>
    owner.channels.get(id) === channel && channel.sessionId === sid && !previous.dsh_yeki
     ? { ...previous, dsh_yeki: server } : previous);
  } catch { /* The next poll can attach after the two programs finish starting. */ }
  finally { updating = false; }
 }
 void update();
 return () => clearInterval(timer);
}
function lastMessageIsImported(file){
 const fd=fs.openSync(file,'r');try{const size=fs.fstatSync(fd).size;const length=Math.min(size,1024*1024);const bytes=Buffer.alloc(length);fs.readSync(fd,bytes,0,length,size-length);const lines=bytes.toString('utf8').split('\n');for(let i=lines.length-1;i>=0;i--){try{const row=JSON.parse(lines[i]);if(row.type==='user'||row.type==='assistant')return !!row.dshSource;}catch{}}return false;}finally{fs.closeSync(fd);}
}
function wireHistory(webview,{claudeHome=path.join(os.homedir(),'.claude'),folders=[],pollMs=750}={}){
 if(!webview||webview.__dshHistoryHost)return;webview.__dshHistoryHost=true;
 const watches=new Map();
 function stop(sid){const entry=watches.get(sid);if(entry){fs.unwatchFile(entry.file,entry.listener);watches.delete(sid);}}
 const subscription=webview.onDidReceiveMessage(async message=>{
  if(!['dsh-history-register','dsh-history-pick-effort'].includes(message?.type)||!SID.test(message.sessionId||''))return;
  const sid=message.sessionId.toLowerCase();
  const folder=folders.find(f=>sharedEffort(claudeHome,sid,f)!==undefined);
  if(folder) {
   if(message.type==='dsh-history-pick-effort'){
    if(!watches.has(sid))return;
    try{const {pickSharedEffort}=await import('./history-model.mjs');await pickSharedEffort(claudeHome,sid,folder,message.effort);}
    catch{return;}
   }
   const level=sharedEffort(claudeHome,sid,folder);
   if(level!==undefined && (message.effort!==level || message.type==='dsh-history-pick-effort'))
    await webview.postMessage({type:'dsh-history-effort',sessionId:sid,effort:level});
  }
  if(message.type!=='dsh-history-register')return;
  // One view's current session only; never watch the entire history tree.
  for(const old of watches.keys())if(old!==sid)stop(old);
  if(watches.has(sid))return;
  const candidates=folders.filter(folder=>path.isAbsolute(folder)).map(folder=>path.join(claudeHome,'projects',path.resolve(folder).replace(/[^A-Za-z0-9]/g,'-'),sid+'.jsonl'));
  const file=candidates.find(candidate=>{try{return fs.lstatSync(candidate).isFile()}catch{return false;}});
  if(!file)return;
  let last;try{const stat=fs.statSync(file);last=`${stat.ino}:${stat.size}:${stat.mtimeMs}`;}catch{return;}
  const listener=current=>{
   const stamp=`${current.ino}:${current.size}:${current.mtimeMs}`;if(stamp===last)return;last=stamp;
   let imported=false;try{imported=lastMessageIsImported(file);}catch{}
   if(current.size>0&&imported)Promise.resolve(webview.postMessage({type:'dsh-history-changed',sessionId:sid,stamp})).catch(()=>{});
  };
  watches.set(sid,{file,listener});fs.watchFile(file,{interval:pollMs,persistent:false},listener);
 });
 const dispose=()=>{for(const sid of watches.keys())stop(sid);subscription?.dispose?.();};
 webview.__dshHistoryCleanup=dispose;webview.onDidDispose?.(dispose);return{dispose,watches};
}
function install(vscode,options={}){
 if(vscode.window.__dshHistoryInstalled)return;vscode.window.__dshHistoryInstalled=true;
 const wire=webview=>wireHistory(webview,{...options,folders:options.folders||vscode.workspace.workspaceFolders?.map(f=>f.uri.fsPath)||[]});
 const window=vscode.window;
 const create=window.createWebviewPanel;window.createWebviewPanel=function(){const panel=create.apply(this,arguments);wire(panel.webview);panel.onDidDispose?.(()=>panel.webview.__dshHistoryCleanup?.());return panel;};
 const reg=window.registerWebviewViewProvider;window.registerWebviewViewProvider=function(id,provider,opts){if(provider?.resolveWebviewView){const resolve=provider.resolveWebviewView;provider.resolveWebviewView=function(view){const result=wire(view.webview);view.onDidDispose?.(()=>result?.dispose());return resolve.apply(this,arguments);};}return reg.call(this,id,provider,opts);};
 const ser=window.registerWebviewPanelSerializer;window.registerWebviewPanelSerializer=function(type,provider){if(provider?.deserializeWebviewPanel){const resolve=provider.deserializeWebviewPanel;provider.deserializeWebviewPanel=function(panel){const result=wire(panel.webview);panel.onDidDispose?.(()=>result?.dispose());return resolve.apply(this,arguments);};}return ser.call(this,type,provider);};
}
module.exports={wireHistory,install,launch,sharedEffort,boundToolServer,watchToolChannel};
