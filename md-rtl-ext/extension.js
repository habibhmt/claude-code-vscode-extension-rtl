// <ide-scheme>://habib.markdown-rtl/open?file=/abs/x.md&text=adad_shellik[&line=12]
// Opens the file rendered (Markdown preview) and scrolled to the first line
// holding `text` (or to `line`). The chat panel's glossary card sends this
// link; the preview has no API to scroll it, so the source editor is put on
// that line first and the preview is opened from it, which starts it there.
const vscode = require('vscode');

async function open(file, text, line) {
  const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(file));
  let ln = line > 0 ? line - 1 : 0;
  if (!(line > 0) && text) {
    const i = doc.getText().indexOf(text);
    if (i >= 0) ln = doc.positionAt(i).line;
  }
  const ed = await vscode.window.showTextDocument(doc, { preview: false });
  const pos = new vscode.Position(ln, 0);
  ed.selection = new vscode.Selection(pos, pos);
  ed.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.AtTop);
  if (!/\.md$/i.test(file)) return;
  await vscode.commands.executeCommand('markdown.showPreview', doc.uri);
}

exports.activate = function (ctx) {
  ctx.subscriptions.push(vscode.window.registerUriHandler({
    handleUri(uri) {
      if (uri.path !== '/open') return;
      const q = new URLSearchParams(uri.query);
      const file = q.get('file');
      if (!file) return;
      open(file, q.get('text') || '', parseInt(q.get('line') || '0', 10))
        .catch(e => vscode.window.showErrorMessage('markdown-rtl: ' + e.message));
    }
  }));
};
exports.deactivate = function () {};
