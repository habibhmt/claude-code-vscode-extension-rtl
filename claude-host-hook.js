/* === CLAUDE-RTL-HOST-HOOK === */
// Runs in the extension host, ahead of the bundle. The chat page can't read
// ~/.claude, so the aA panel asks here for its session's short name (the one
// other sessions message it by — it changes on every CLI restart) and title.
// The page sends its own sessionId; the lookup is an exact match, never a
// guess by folder, because two chats often share one folder.
(function () {
  try {
    var fs = require('fs'), path = require('path'), os = require('os'), crypto = require('crypto');
    var HOME = path.join(os.homedir(), '.claude');

    // This chat's row in ~/.claude/sessions. Read fresh every time: the remote
    // id is only trusted while it is in the file right now — a stale one would
    // put a confident, wrong address on the clipboard.
    function sessionRecord(sid) {
      var dir = path.join(HOME, 'sessions');
      var files = [];
      try { files = fs.readdirSync(dir); } catch (e) { return {}; }
      for (var i = 0; i < files.length; i++) {
        if (!/\.json$/.test(files[i])) continue;
        try {
          var d = JSON.parse(fs.readFileSync(path.join(dir, files[i]), 'utf8'));
          if (d.sessionId === sid) return d;
        } catch (e) {}
      }
      return {};
    }

    // The [ref] ListAgents prints: first 6 hex of sha256("<kind>:<id>"), as in
    // Claude Code 2.1.280. On this machine a chat is "session:<socket>"; from
    // another device, over Remote Control, it is "bridge-session:<bridge id>".
    function ref(kind, id) {
      return crypto.createHash('sha256').update(kind + ':' + id).digest('hex').slice(0, 6);
    }

    // Everything the "copy all" button puts on the clipboard. The first line
    // is a ready command for the agent on the other side.
    function card(sid, rec, title) {
      var name = rec.name || '', sock = rec.messagingSocketPath || '', bridge = rec.bridgeSessionId || '';
      var local = name && sock ? name + ' [' + ref('session', sock) + ']' : '';
      var remoteRef = bridge ? ref('bridge-session', bridge) : '';
      var lines = [];
      if (remoteRef && title) {
        lines.push('برای پیام به این چت از هر دستگاه: SendMessage to: "' + title + ' [' + remoteRef + ']"');
        lines.push('اگر پیدا نشد: در ListAgents ردیفی که [' + remoteRef + '] دارد همین چت است (این کد با بستن و باز کردن چت عوض نمی‌شود)');
      } else if (remoteRef) {
        // no custom title: the other device shows a name we can't know, so
        // hand over only the code instead of a made-up name that never matches
        lines.push('این چت اسم ندارد — از هر دستگاه: در ListAgents ردیفی که [' + remoteRef + '] دارد را پیدا کن و با همان «اسم [' + remoteRef + ']» SendMessage بزن');
      } else {
        lines.push('Remote Control خاموش است — از دستگاه دیگر پیدا نمی‌شود' +
          (local ? '؛ فقط از همین دستگاه: SendMessage to: "' + local + '"' : ''));
      }
      lines.push('چت: ' + (title || 'نامشخص'));
      if (local) lines.push('از همین دستگاه: ' + local + '  (بعد از ری‌استارت عوض می‌شود)');
      if (bridge) lines.push('شناسهٔ Remote Control: ' + bridge);
      lines.push('کد سشن: ' + sid);
      lines.push('دستگاه: ' + os.hostname() + (rec.cwd ? ' · پوشه: ' + rec.cwd : ''));
      return { text: lines.join('\n'), remote: remoteRef ? (title ? title + ' ' : '') + '[' + remoteRef + ']' : '' };
    }

    if (process.env.CRTL_HOST_TEST) { global.__crtlHost = { ref: ref, card: card, sessionRecord: sessionRecord }; return; }
    var vscode = require('vscode');

    // A rename is a whole line {"type":"custom-title",...}; the last one wins.
    // Only such lines count — the words can also sit inside chat text.
    function titlesIn(text) {
      var out = '', lines = text.split('\n');
      for (var i = 0; i < lines.length; i++) {
        if (lines[i].indexOf('"type":"custom-title"') === -1) continue;
        try { var t = JSON.parse(lines[i]).customTitle; if (t) out = t; } catch (e) {}
      }
      return out;
    }

    function chatFile(sid) {
      var dir = path.join(HOME, 'projects'), dirs = [];
      try { dirs = fs.readdirSync(dir); } catch (e) { return ''; }
      for (var i = 0; i < dirs.length; i++) {
        var f = path.join(dir, dirs[i], sid + '.jsonl');
        if (fs.existsSync(f)) return f;
      }
      return '';
    }

    // chat files reach hundreds of MB. The tail is read at once (fast, and it
    // nearly always holds the title); when it doesn't, the whole file is
    // streamed in the background so the host never blocks, and the answer is
    // cached by sid + size so the next open costs nothing.
    var TAIL = 262144, CACHE = {};
    function tailTitle(file, size) {
      var fd = fs.openSync(file, 'r');
      try {
        var len = Math.min(TAIL, size), buf = Buffer.alloc(len);
        fs.readSync(fd, buf, 0, len, size - len);
        return titlesIn(buf.toString('utf8'));
      } finally { fs.closeSync(fd); }
    }
    function fullTitle(file, done) {
      var last = '', rest = '';
      var st = fs.createReadStream(file, { encoding: 'utf8', highWaterMark: 1 << 20 });
      st.on('data', function (chunk) {
        var text = rest + chunk, cut = text.lastIndexOf('\n');
        rest = text.slice(cut + 1);
        var t = titlesIn(text.slice(0, cut + 1));
        if (t) last = t;
      });
      st.on('end', function () { var t = titlesIn(rest); done(t || last); });
      st.on('error', function () { done(last); });
    }
    // calls back once with an immediate answer; pending=true means a second,
    // final answer follows when the background read finishes
    function title(sid, cb) {
      var f = chatFile(sid);
      if (!f) return cb('', false);
      var size;
      try { size = fs.statSync(f).size; } catch (e) { return cb('', false); }
      var key = sid + ':' + size;
      if (key in CACHE) return cb(CACHE[key], false);
      var t = '';
      try { t = tailTitle(f, size); } catch (e) {}
      if (t) { CACHE[key] = t; return cb(t, false); }
      cb('', true);
      fullTitle(f, function (full) { CACHE[key] = full; cb(full, false); });
    }

    function wire(webview) {
      if (!webview || webview.__crtlHost) return;
      webview.__crtlHost = true;
      webview.onDidReceiveMessage(function (m) {
        if (!m || m.type !== 'crtl-session-info') return;
        var sid = String(m.sid || '');
        var ok = /^[0-9a-f-]{36}$/.test(sid);
        if (!ok) return webview.postMessage({ type: 'crtl-session-info', sid: sid, name: '', title: '', remote: '', card: '' });
        var rec = sessionRecord(sid);
        title(sid, function (t, pending) {
          var c = card(sid, rec, t);
          webview.postMessage({ type: 'crtl-session-info', sid: sid, name: rec.name || '', title: t, pending: pending, remote: c.remote, card: c.text });
        });
      });
    }

    var w = vscode.window;
    var origReg = w.registerWebviewViewProvider;
    w.registerWebviewViewProvider = function (id, provider, opts) {
      if (provider && typeof provider.resolveWebviewView === 'function') {
        var orig = provider.resolveWebviewView;
        provider.resolveWebviewView = function (view) {
          try { wire(view.webview); } catch (e) {}
          return orig.apply(this, arguments);
        };
      }
      return origReg.call(this, id, provider, opts);
    };
    // a chat tab that was open before a reload comes back through the
    // serializer, not createWebviewPanel — without this it never got an answer
    var origSer = w.registerWebviewPanelSerializer;
    w.registerWebviewPanelSerializer = function (type, ser) {
      if (ser && typeof ser.deserializeWebviewPanel === 'function') {
        var orig = ser.deserializeWebviewPanel;
        ser.deserializeWebviewPanel = function (panel) {
          try { wire(panel.webview); } catch (e) {}
          return orig.apply(this, arguments);
        };
      }
      return origSer.call(this, type, ser);
    };
    var origPanel = w.createWebviewPanel;
    w.createWebviewPanel = function () {
      var p = origPanel.apply(this, arguments);
      try { wire(p.webview); } catch (e) {}
      return p;
    };
  } catch (e) {}
})();
/* === /CLAUDE-RTL-HOST-HOOK === */
