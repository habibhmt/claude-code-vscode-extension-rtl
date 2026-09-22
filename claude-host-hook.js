/* === CLAUDE-RTL-HOST-HOOK === */
// Runs in the extension host, ahead of the bundle. The chat page can't read
// ~/.claude, so the aA panel asks here for its session's short name (the one
// other sessions message it by — it changes on every CLI restart) and title.
// The page sends its own sessionId; the lookup is an exact match, never a
// guess by folder, because two chats often share one folder.
(function () {
  try {
    var vscode = require('vscode'), fs = require('fs'), path = require('path'), os = require('os');
    var HOME = path.join(os.homedir(), '.claude');

    function shortName(sid) {
      var dir = path.join(HOME, 'sessions');
      var files = [];
      try { files = fs.readdirSync(dir); } catch (e) { return ''; }
      for (var i = 0; i < files.length; i++) {
        if (!/\.json$/.test(files[i])) continue;
        try {
          var d = JSON.parse(fs.readFileSync(path.join(dir, files[i]), 'utf8'));
          if (d.sessionId === sid) return d.name || '';
        } catch (e) {}
      }
      return '';
    }

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
        if (!ok) return webview.postMessage({ type: 'crtl-session-info', sid: sid, name: '', title: '' });
        var name = shortName(sid);
        title(sid, function (t, pending) {
          webview.postMessage({ type: 'crtl-session-info', sid: sid, name: name, title: t, pending: pending });
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
