// یک فایل را نگاه می‌کند (fs.watch = خبر از خودِ سیستم، بی‌چرخش و بی‌مصرفِ CPU).
// متنِ فایل: "<زمان> all" یا "<زمان> <تکه‌ای از اسمِ پوشه>".
const vscode = require('vscode');
const fs = require('fs');
const os = require('os');
const path = require('path');

const DIR = path.join(os.homedir(), '.vscode-reload');
const FILE = path.join(DIR, 'trigger');

function activate(context) {
  const shoroo = Date.now();
  try { fs.mkdirSync(DIR, { recursive: true }); } catch (_) {}
  let watcher;
  try { watcher = fs.watch(DIR, (_e, name) => { if (name === 'trigger') check(); }); }
  catch (_) { return; }
  context.subscriptions.push({ dispose: () => watcher.close() });
  // میانبُر: Cmd+Shift+P ⇐ «Reload All Windows» ⇐ همهٔ پنجره‌ها، خودِ این پنجره هم
  // vscode://habib.reload-trigger/open?session=<id> ⇐ چت در تبِ معمولی (با سابقه و رنگِ درست).
  // لینکِ خودِ کلود (anthropic.claude-code/open) آن را «تمام‌صفحه» باز می‌کند: بی دکمه‌های سابقه و تیره‌تر.
  context.subscriptions.push(vscode.window.registerUriHandler({ handleUri(uri) {
    if (uri.path !== "/open") return;
    const q = new URLSearchParams(uri.query);
    const sid = q.get("session") || undefined;
    if (sid && !/^[0-9a-f-]{36}$/i.test(sid)) return;
    vscode.commands.executeCommand("claude-vscode.editor.open", sid, q.get("prompt") || undefined, undefined, undefined, false, { programmatic: true });
  }}));
  context.subscriptions.push(vscode.commands.registerCommand("habibReload.all", () => {
    fs.writeFileSync(FILE, Date.now() + " all");
  }));

  function check() {
    let txt;
    try { txt = fs.readFileSync(FILE, 'utf8').trim(); } catch (_) { return; }
    const [zaman, ...rest] = txt.split(' ');
    if (!(Number(zaman) > shoroo)) return; // دستورِ کهنه: بعد از ریلود دوباره ریلود نشود
    const hadaf = rest.join(' ').trim();
    const esmha = (vscode.workspace.workspaceFolders || []).map(f => f.uri.fsPath);
    if (vscode.workspace.workspaceFile) esmha.push(vscode.workspace.workspaceFile.fsPath);
    const match = hadaf === 'all' || (hadaf && esmha.some(p => p.includes(hadaf)));
    if (match) {
      watcher.close();
      vscode.commands.executeCommand('workbench.action.reloadWindow');
    }
  }
}
function deactivate() {}
module.exports = { activate, deactivate };
