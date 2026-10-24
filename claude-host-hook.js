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

// Hooks in the chat. The panel never asked the CLI for hook events and has no view for
// them, so what a hook injected stayed invisible (Habib, 24 Oct: «میخوام تو خود اکستنشن
// کلود کد … این هوک ها هم همین طور باشه هم یه خطی بیان … و هم اگر فوکوس آن شد اینا
// کامل بیاید»). fix-rtl-claude.sh turns --include-hook-events on and passes every message
// the host forwards to the page through this: a hook_response with output becomes an
// "informational" line, which the page already draws in the chat (like «Remote Control is
// active»). The buttons script folds it to one line and opens it on a click or in focus view.
(function () {
  var mah_shamsi = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
  function adad_farsi(s) { return String(s).replace(/\d/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'[d]; }); }
  function tarikh_shamsi(gy, gm, gd) {
    var g = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
    var gy2 = gm > 2 ? gy + 1 : gy;
    var days = 355666 + 365 * gy + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400) + gd + g[gm - 1];
    var jy = -1595 + 33 * Math.floor(days / 12053); days %= 12053;
    jy += 4 * Math.floor(days / 1461); days %= 1461;
    if (days > 365) { jy += Math.floor((days - 1) / 365); days = (days - 1) % 365; }
    var jm = days < 186 ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
    var jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30);
    return [jy, jm, jd];
  }
  // Tehran is +03:30 all year
  function zaman_shamsi(t) {
    var d = new Date(t + 3.5 * 3600e3);
    var j = tarikh_shamsi(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
    var hh = ('0' + d.getUTCHours()).slice(-2), mm = ('0' + d.getUTCMinutes()).slice(-2);
    return adad_farsi(j[2] + ' ' + mah_shamsi[j[1] - 1] + ' ' + j[0] + ' ' + hh + ':' + mm);
  }
  // a long path keeps only its file name (and :line): /Users/…/doc/achar/11.md:40 ⇒ 11.md:40
  function kutah_kardan_masir(t) { return t.replace(/(?:~|\/Users)\/[^\s:'"`)\]]*\/([^\/\s:'"`)\]]+(?::\d+)?)/g, '$1'); }
  // What a person can read of a hook's output, or null when there is nothing to show
  // (Habib, 24 Oct 22:03: «اصلا قابل خوندن نیست … اینا مثلا معلوم نیست چین … اگر که همینن نیان خیلی شلوغ میکنن»):
  //  · empty, «{}», or only a clock stamp like «[22:00 +0330 -- habib]»: nothing
  //  · JSON from a hook (systemMessage / additionalContext): unpacked, real line breaks, short paths.
  //    The panel already prints a systemMessage itself («… says: …»), so then this line carries
  //    only the injected context, never the message twice.
  function khana_baraye_habib(text) {
    var t = String(text || '').trim();
    if (!t || t === '{}' || /^\[\d{1,2}:\d{2}( [+-]\d{4})?( -- [^\]]+)?\]$/.test(t)) return null;
    if (t.charAt(0) === '{') {
      var o; try { o = JSON.parse(t); } catch (e) { o = null; }
      if (o && typeof o === 'object') {
        var h = o.hookSpecificOutput || {};
        var ctx = typeof h.additionalContext === 'string' ? h.additionalContext.trim() : '';
        var sys = typeof o.systemMessage === 'string' ? o.systemMessage.trim() : '';
        if (ctx) return { head: sys ? 'متنِ تزریقی' : ctx.split('\n')[0], body: kutah_kardan_masir(ctx), dupe: !!sys };
        return null;
      }
    }
    var first = t.split('\n')[0];
    return { head: kutah_kardan_masir(first), body: kutah_kardan_masir(t), dupe: false };
  }
  globalThis.__crtl_hook_khana = khana_baraye_habib;
  // one hook line: the first line is what the folded view shows (mark, time, name, a short head)
  function sakht_khat_hook(name, r, t, uuid, sid) {
    return { type: 'system', subtype: 'informational', level: 'notice', session_id: sid, uuid: uuid,
      content: '🪝 ' + zaman_shamsi(t) + ' · ' + name + ' · ' + r.head + '\n' + r.body };
  }
  globalThis.__crtl_khat_hook = function (m, now) {
    try {
      if (!m || m.type !== 'system' || m.subtype !== 'hook_response') return m;
      var r = khana_baraye_habib(m.output || m.stdout);
      if (!r) return m;
      return sakht_khat_hook(m.hook_name || m.hook_event || 'hook', r, now || Date.now(), m.uuid, m.session_id);
    } catch (e) { return m; }
  };
  // After a reload the page rebuilds the chat from the transcript, which keeps each hook's output
  // as an attachment, but never draws them: the 🪝 lines were gone (Habib, 25 Oct: «من چند بار
  // چند بار ریلود میکنم چند چت رو بعد اینو بکشه»). Each one is put back right after the last
  // message that came before it. Anything wrong leaves the chat as it was.
  var gorooh_hook = { hook_success: 1, hook_additional_context: 1, hook_system_message: 1 };
  function masir_transcript(sid) {
    var fs = require('fs'), path = require('path'), os = require('os');
    var root = path.join(process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude'), 'projects');
    var dirs = fs.readdirSync(root);
    for (var i = 0; i < dirs.length; i++) {
      var f = path.join(root, dirs[i], sid + '.jsonl');
      if (fs.existsSync(f)) return f;
    }
    return null;
  }
  // the transcript's hook lines only: read in 8 MB pieces and searched as bytes, never parsed whole
  // (a long chat is hundreds of MB; /usr/bin/grep took 0.6 s on 81 MB, this ~0.1 s)
  var neshane_hook = Buffer.from('"attachment":{"type":"hook_');
  function khat_ha_ye_hook_dar_file(f) {
    var fs = require('fs'), fd = fs.openSync(f, 'r'), out = [], rest = Buffer.alloc(0), piece = Buffer.alloc(8 * 1024 * 1024), n;
    try {
      while ((n = fs.readSync(fd, piece, 0, piece.length, null)) > 0) {
        var buf = Buffer.concat([rest, piece.subarray(0, n)]);
        var end = buf.lastIndexOf(10);
        if (end < 0) { rest = buf; continue; }
        var whole = buf.subarray(0, end + 1);
        rest = Buffer.from(buf.subarray(end + 1));
        for (var i = whole.indexOf(neshane_hook); i >= 0; i = whole.indexOf(neshane_hook, i + 1)) {
          var a = whole.lastIndexOf(10, i) + 1, b = whole.indexOf(10, i);
          out.push(whole.toString('utf8', a, b));
          i = b;
        }
      }
      if (rest.length && rest.indexOf(neshane_hook) >= 0) out.push(rest.toString('utf8'));
    } finally { fs.closeSync(fd); }
    return out;
  }
  globalThis.__crtl_hook_tarikhche = function (messages, sid) {
    try {
      if (!Array.isArray(messages) || !messages.length || !/^[0-9a-f-]{36}$/.test(String(sid))) return messages;
      var f = masir_transcript(String(sid));
      if (!f) return messages;
      var first = Date.parse(messages[0].timestamp) || 0;
      var lines = [];
      khat_ha_ye_hook_dar_file(f).forEach(function (l) {
        var o; try { o = JSON.parse(l); } catch (e) { return; }
        var a = o.attachment;
        if (!a || !gorooh_hook[a.type] || o.isSidechain) return;
        var t = Date.parse(o.timestamp);
        if (!t || t < first) return;
        var body = Array.isArray(a.content) ? a.content.join('\n') : String(a.content == null ? '' : a.content);
        var r = khana_baraye_habib(body);
        if (!r) return;
        // a hook's message (systemMessage) is a line of its own: the live panel prints it apart too
        if (a.type === 'hook_system_message') r = { head: r.head, body: r.body };
        if (a.type === 'hook_additional_context') r = { head: 'متنِ تزریقی', body: r.body };
        lines.push({ t: t, m: sakht_khat_hook(a.hookName || a.hookEvent || 'hook', r, t, o.uuid || ('crtl-hook-' + t), String(sid)) });
      });
      if (!lines.length) return messages;
      var out = [], j = 0;
      for (var i = 0; i < messages.length; i++) {
        var mt = Date.parse(messages[i].timestamp) || 0;
        while (j < lines.length && lines[j].t < mt) out.push(lines[j++].m);
        out.push(messages[i]);
      }
      while (j < lines.length) out.push(lines[j++].m);
      return out;
    } catch (e) { return messages; }
  };
  globalThis.__crtl_tarikh_shamsi = tarikh_shamsi;
})();
/* === /CLAUDE-RTL-HOST-HOOK === */
