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

    /* ---------------- the «تنظیمات کلود» tab ---------------- */
    // Habib, 5 Nov 02:34: «توی تب تنظیمات کلود رو بتونم تعیین کنم هر چی تنظیم ک ه هست به صورت سراسری پروژه چت».
    // The store ~/.claude/crtl_tanzimat.json holds every save: {sarasari:{k:{v,t}}, poshe:{cwd:{k:{v,t}}}, chat:{sid:{k:{v,t}}}}.
    // The newest save among the three levels wins for a chat (Habib's «خیر»: a chat's own value is not immune; چت ۱۸۹ low
    // دارد، سراسری max ثبت می‌کنی ⇐ ۱۸۹ هم max). doc/abzar/panjere_chat.py in repo 203 reads the same format.
    // The levels the app's own files can hold are written there too, so a terminal chat sees them.
    var SID_RE = /^[0-9a-f-]{36}$/;
    var FASELE_COMPACT = 33000;            // the engine compacts 33K before its window (measured: 300K ⇒ 267000, 1M ⇒ 967000)
    var EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'];
    var CHROME_KELID = 'claudeInChromeDefaultEnabled';   // the app's own switch for its Chrome extension: not in settings.json but in .claude.json, written only by the app
    var BALA = { effortLevel: 1, model: 1, remoteControlAtStartup: 1, ultracode: 1, autoCompactWindow: 1, claudeInChromeDefaultEnabled: 1 };
    // these run a program on every launch: they don't belong in a form (the table Habib approved: they do not appear)
    var MAMNU = { apiKeyHelper: 1, proxyAuthHelper: 1, awsCredentialExport: 1, awsAuthRefresh: 1, gcpAuthRefresh: 1, processWrapper: 1, otelHeadersHelper: 1, $schema: 1 };
    function shey(o) { return o && typeof o === 'object' && !Array.isArray(o) ? o : {}; }
    function anbarMasir() { return process.env.CRTL_TANZIMAT || path.join(HOME, 'crtl_tanzimat.json'); }
    function userMasir() { return path.join(process.env.CLAUDE_CONFIG_DIR || HOME, 'settings.json'); }
    function mahalliMasir(cwd) { return path.join(cwd, '.claude', 'settings.local.json'); }
    function claudeJsonMasir() { return path.join(process.env.CLAUDE_CONFIG_DIR || path.dirname(HOME), '.claude.json'); }
    function jsonKhan(p) { try { return shey(JSON.parse(fs.readFileSync(p, 'utf8'))); } catch (e) { return {}; } }
    function atomi(p, matn) {
      var tmp = p + '.' + process.pid + '.' + Date.now() + '.tmp';
      fs.writeFileSync(tmp, matn);
      fs.renameSync(tmp, p);
    }
    function anbarKhan() {
      var a = jsonKhan(anbarMasir());
      a.sarasari = shey(a.sarasari); a.poshe = shey(a.poshe); a.chat = shey(a.chat);
      return a;
    }
    function anbarNevis(a) { atomi(anbarMasir(), JSON.stringify(a, null, 1) + '\n'); }
    // The old effort row's file comes along once, then steps aside.
    function vaghtEffortGhadimi() {
      var f = path.join(HOME, 'effort_chat.json'), d;
      try { d = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return; }
      try {
        var a = anbarKhan(), t = fs.statSync(f).mtimeMs;
        Object.keys(shey(d)).forEach(function (sid) {
          if (!SID_RE.test(sid) || EFFORTS.indexOf(d[sid]) === -1) return;
          var c = a.chat[sid] = shey(a.chat[sid]);
          if (!c.effortLevel) c.effortLevel = { v: d[sid], t: t };
        });
        anbarNevis(a);
        fs.renameSync(f, f + '.crtl-amad');
      } catch (e) {}
    }
    function ast(r) { return r && typeof r === 'object' && Object.prototype.hasOwnProperty.call(r, 'v'); }
    function barande(a, sid, cwd, k) {
      var best = null;
      [['sarasari', a.sarasari[k]], ['poshe', cwd && shey(a.poshe[cwd])[k]], ['chat', sid && shey(a.chat[sid])[k]]].forEach(function (r) {
        if (!ast(r[1])) return;
        var t = Number(r[1].t) || 0;
        if (!best || t >= best.t) best = { v: r[1].v, t: t, sath: r[0] };
      });
      return best;
    }
    function kelidha(a, sid, cwd) {
      var s = {};
      [a.sarasari, cwd && a.poshe[cwd], sid && a.chat[sid]].forEach(function (o) { Object.keys(shey(o)).forEach(function (k) { s[k] = 1; }); });
      return Object.keys(s);
    }
    // What the flag layer of one chat should hold: the winners, except that an object or a list from a file level stays in
    // the file alone (the engine merges lists and hooks across layers, so a copy on the flag layer would run a hook twice).
    function parchamha(a, sid, cwd) {
      var out = {};
      kelidha(a, sid, cwd).forEach(function (k) {
        var w = barande(a, sid, cwd, k);
        if (!w || k === 'remoteControlAtStartup' || k === CHROME_KELID) return;
        if (w.sath !== 'chat' && w.v && typeof w.v === 'object') return;
        out[k] = w.v;
      });
      return out;
    }
    // called at every launch by the patch in extension.js (fix-rtl-claude.sh)
    // effort goes as --effort: a file refuses max, and so does --settings (measured 5 Nov: flag max ⇒ the per-model value)
    globalThis.__crtl_baz_shodan = function (resume, cwd) {
      try {
        var a = anbarKhan(), p = parchamha(a, SID_RE.test(String(resume || '')) ? resume : '', cwd ? path.resolve(cwd) : ''), out = {};
        if (EFFORTS.indexOf(p.effortLevel) !== -1) out.effort = p.effortLevel;
        delete p.effortLevel;
        if (typeof p.model === 'string' && p.model) out.model = p.model;
        delete p.model;
        // a new chat restarted by the «ابزارها» tab: its own ticks go by name to claude_abzar_kam.sh, which takes the name out
        try { var kt = tikBarayeLaunch(resume, cwd); if (kt) p[TIK_NESHANE] = kt; } catch (e) {}
        if (Object.keys(p).length) out.settings = p;
        return out;
      } catch (e) { return null; }
    };

    function hameSaheb(f) {
      SAHEB.forEach(function (o) {
        try { o.channels.forEach(function (ch, id) { f(o, id, ch); }); } catch (e) {}
      });
    }
    var SAHEB = new Set(), SAFHE = new Set();   // the bundle's chat managers; the chat pages of this window
    function ferestBeSafhe(m) {
      SAFHE.forEach(function (w) {
        try { var r = w.postMessage(m); if (r && r.then) r.then(null, function () {}); } catch (e) { SAFHE.delete(w); }
      });
    }
    function logKhat(matn) {
      try {
        var f = path.join(HOME, 'crtl_tanzimat.log');
        try { if (fs.statSync(f).size > 262144) fs.truncateSync(f, 0); } catch (e) {}
        fs.appendFileSync(f, new Date().toISOString() + ' pid=' + process.pid + ' ' + matn + '\n');
      } catch (e) {}
    }
    function barayeLog(k, v) { return BALA[k] ? k + '=' + JSON.stringify(v) : k; }
    function kanalBaraye(sid, id) {
      var yaft = null;
      hameSaheb(function (o, i, ch) {
        if (yaft) return;
        if ((id && i === id) || (sid && ch.sessionId === sid)) yaft = { owner: o, id: i, ch: ch };
      });
      return yaft;
    }
    function zamandar(p, ms) {
      return Promise.race([p, new Promise(function (ok) { setTimeout(function () { ok(undefined); }, ms); })]).catch(function () { return undefined; });
    }
    var REMOTE_ON_SABR = 4000;
    function remoteVaziat(ch) { return ch.remoteControlState && ch.remoteControlState.status; }
    function remoteBezan(o, id, ch, on) {
      var st = remoteVaziat(ch);
      if (on ? (st !== 'disconnected' && st !== 'error') : st === 'disconnected') return Promise.resolve(false);
      return Promise.resolve(o.toggleRemoteControl(id, on)).then(function () { return true; });
    }
    // One chat's browser (Habib, 5 Nov: «فقط تنظیمات چت بذار»). The same two doors the app's own setting uses, so no extra turn is spent;
    // only a chat connected by hand with @browser needs the loud door, which tells the model the tools are gone.
    function chromeBezan(o, id, ch, on) {
      var st = ch.chromeMcpState && ch.chromeMcpState.status;
      if (on) {
        if (typeof o.ensureChromeMcpEnabled !== 'function' || st === 'connected' || st === 'connecting') return Promise.resolve(false);
        return Promise.resolve(o.ensureChromeMcpEnabled(id, { bySetting: { flips: o.chromeSettingFlipCount } })).then(function () { return true; });
      }
      if (typeof o.disableChromeMcp !== 'function' || st === 'disconnected') return Promise.resolve(false);
      return Promise.resolve(o.disableChromeMcp(id, ch.chromeToolsAutoAllowed ? undefined : { quiet: true })).then(function () { return true; });
    }
    // The global level goes through the app's own save: it runs `claude edit-chrome-settings` and tells the open chats of every tab.
    function chromeSarasari(yaft, on) {
      if (!yaft || typeof yaft.owner.setChromeSetting !== 'function') return Promise.resolve('برای ثبت سراسری یک چت باز در همین پنجره لازم است');
      return zamandar(Promise.resolve(yaft.owner.setChromeSetting(yaft.id, on)), 12000).then(function (r) {
        if (!r) return 'جوابی از کلود نیامد؛ ثبت معلوم نیست';
        if (r.error) return String(r.error);
        return r.dialog && r.dialog.enabled_by_default !== on ? 'نوشته شد ولی کلود هنوز مقدار قبلی را می‌گوید؛ دوباره تب را باز کن' : '';
      });
    }
    // Push what changed for one chat. The engine loses ultracode when effort changes, unless effort goes with it (measured),
    // and takes a model's own effort when the model changes: so model first, then effort again.
    function pushChat(o, id, ch, a, taghir) {
      var sid = ch.sessionId || '', cwd = ch.cwd || '';
      var now = parchamha(a, sid, cwd), old = shey(ch.__crtlZende), keys = {}, kar = [];
      Object.keys(now).concat(Object.keys(old)).forEach(function (k) { keys[k] = 1; });
      ch.__crtlZende = now;
      var f = {}, hast = false;
      Object.keys(keys).forEach(function (k) {
        if (JSON.stringify(now[k]) === JSON.stringify(old[k])) return;
        taghir[k] = (taghir[k] || 0) + 1;
        if (k === 'autoCompactWindow') return;   // the running engine ignores it (measured): after a reload
        f[k] = Object.prototype.hasOwnProperty.call(now, k) ? now[k] : null;
        hast = true;
      });
      var wRemote = barande(a, sid, cwd, 'remoteControlAtStartup');
      var rNow = wRemote ? JSON.stringify(wRemote.v) : '', rOld = typeof ch.__crtlRemote === 'string' ? ch.__crtlRemote : '';
      ch.__crtlRemote = rNow;
      if (rNow !== rOld) {
        taghir.remoteControlAtStartup = (taghir.remoteControlAtStartup || 0) + 1;
        if (wRemote) kar.push(function () { return remoteBezan(o, id, ch, wRemote.v === true); });
      }
      var wChrome = barande(a, sid, cwd, CHROME_KELID);
      var cNow = wChrome ? JSON.stringify(wChrome.v) : '', cOld = typeof ch.__crtlChrome === 'string' ? ch.__crtlChrome : '';
      ch.__crtlChrome = cNow;
      if (cNow !== cOld) {
        taghir[CHROME_KELID] = (taghir[CHROME_KELID] || 0) + 1;
        if (wChrome) kar.push(function () { return chromeBezan(o, id, ch, wChrome.v === true); });
      }
      if (hast) {
        var q = ch.query;
        kar.push(function () {
          var moded = 'model' in f ? { model: f.model } : null, rest = {};
          Object.keys(f).forEach(function (k) { if (k !== 'model') rest[k] = f[k]; });
          if (moded && !('effortLevel' in rest) && Object.prototype.hasOwnProperty.call(now, 'effortLevel')) rest.effortLevel = now.effortLevel;
          return (moded ? Promise.resolve(q.applyFlagSettings(moded)) : Promise.resolve()).then(function () {
            if (!('effortLevel' in rest) || 'ultracode' in rest) return undefined;
            return Promise.resolve(q.getSettings()).then(function (g) {
              if (g && g.applied && g.applied.ultracodeRequested) rest.ultracode = true;
            });
          }).then(function () {
            if (Object.keys(rest).length) return q.applyFlagSettings(rest);
          });
        });
      }
      if (!kar.length) return Promise.resolve();
      return kar.reduce(function (p, fn) { return p.then(fn); }, Promise.resolve()).then(function () {
        logKhat('push ' + (sid || id) + ' ' + Object.keys(f).map(function (k) { return barayeLog(k, f[k]); }).join(' ') + (rNow !== rOld ? ' remote=' + rNow : '') + (cNow !== cOld ? ' browser=' + cNow : '') + ' ok');
        ferestBeSafhe({ type: 'crtl-tanzimat-taze', channelId: id });
      }, function (e) {
        var pk = String(e && e.message || e);
        logKhat('push ' + (sid || id) + ' ' + Object.keys(f).join(' ') + ' error ' + pk);
        taghir.__khata = pk;
        taghir.__khataTedad = (taghir.__khataTedad || 0) + 1;
        ferestBeSafhe({ type: 'crtl-tanzimat-taze', channelId: id });
      });
    }
    // Returns how many chats of this window each key changed on.
    function pushHame() {
      var a = anbarKhan(), taghir = {}, kar = [];
      hameSaheb(function (o, id, ch) { try { kar.push(pushChat(o, id, ch, a, taghir)); } catch (e) { logKhat('push ' + id + ' error ' + (e && e.message || e)); } });
      return Promise.all(kar).then(function () { return taghir; }, function () { return taghir; });
    }
    var chashm = false;
    function chashmBeAnbar() {
      if (chashm) return;
      chashm = true;
      // other windows save too; their chats follow within a second
      fs.watchFile(anbarMasir(), { interval: 1000, persistent: false }, function () { pushHame(); });
    }
    // called by the patch in extension.js when a chat's channel is born
    globalThis.__crtl_kanal_taze = function (o, id, ch) {
      try {
        SAHEB.add(o);
        globalThis.__crtlHistoryWatchChannel?.(o, id, ch);
        var a = anbarKhan(), sid = ch.sessionId || '', cwd = ch.cwd || '';
        if (TIK_AKHAR && Date.now() < TIK_AKHAR.ta && !SID_RE.test(String(sid))) {
          ch.__crtlTik = TIK_AKHAR.kelid;
          TIK_AKHAR = null;
          tikBeSid(o, id, ch, ch.__crtlTik);
        }
        ch.__crtlZende = parchamha(a, sid, cwd);
        var w = barande(a, sid, cwd, 'remoteControlAtStartup');
        ch.__crtlRemote = w ? JSON.stringify(w.v) : '';
        if (w) {
          // the engine turns it on by itself a moment later, unless a toggle has already decided; so off goes first, and
          // on waits and only knocks if it stayed off (Habib, 4 Nov: «محکمش کن که ریموت کنترلش همیشه روشن باشه»)
          setTimeout(function () {
            try {
              if (o.channels.get(id) !== ch) return;
              if (w.v === false) { var p = o.toggleRemoteControl(id, false); if (p && p.then) p.then(null, function () {}); }
              else remoteBezan(o, id, ch, true).then(null, function () {});
            } catch (e) {}
          }, w.v === false ? 0 : REMOTE_ON_SABR);
        }
        var wc = barande(a, sid, cwd, CHROME_KELID);
        ch.__crtlChrome = wc ? JSON.stringify(wc.v) : '';
        if (wc) {
          // the app connects by its own switch some moments after the chat is born, so the chat's word is said twice
          [REMOTE_ON_SABR, REMOTE_ON_SABR * 4].forEach(function (ms) {
            setTimeout(function () {
              try { if (o.channels.get(id) === ch) chromeBezan(o, id, ch, wc.v === true).then(null, function () {}); } catch (e) {}
            }, ms);
          });
        }
        chashmBeAnbar();
      } catch (e) {}
    };
    // Claude's own effort and model menu changes this chat only (Habib's «بله»: the file holds one value for every chat, and
    // a click in one chat must not move the others). It's a chat-level save, so it also survives a reload.
    var MENU_KELID = { effortLevel: 1, model: 1, ultracode: 1 };
    function menuSabt(sid, cwd, k, v) {
      var a = anbarKhan();
      if (v === null || v === undefined) {
        var c0 = shey(a.chat[sid]);
        if (!ast(c0[k])) return;
        delete c0[k];
        a.chat[sid] = c0;
      } else {
        var w = barande(a, sid, cwd, k);
        if (w && JSON.stringify(w.v) === JSON.stringify(v)) return;
        var c = a.chat[sid] = shey(a.chat[sid]);
        c[k] = { v: v, t: Date.now() };
      }
      anbarNevis(a);
    }
    globalThis.__crtl_menu_chat = function (o, id, t) {
      var keys = t && typeof t === 'object' ? Object.keys(t) : [];
      if (!keys.length || !keys.every(function (k) { return MENU_KELID[k]; }) || !('effortLevel' in t || 'model' in t)) return false;
      try {
        SAHEB.add(o);
        var ch = o.channels.get(id);
        if (!ch) return true;
        function sabt(sid) {
          ['effortLevel', 'model'].forEach(function (k) { if (k in t) menuSabt(sid, ch.cwd || '', k, t[k]); });
          ch.__crtlZende = parchamha(anbarKhan(), sid, ch.cwd || '');
        }
        if (SID_RE.test(String(ch.sessionId || ''))) { sabt(ch.sessionId); return true; }
        // a new chat has no id until its first message: the click waits for it
        var n = 0, tick = setInterval(function () {
          try {
            if (SID_RE.test(String(ch.sessionId || ''))) { clearInterval(tick); sabt(ch.sessionId); }
            else if (++n > 1800 || o.channels.get(id) !== ch) clearInterval(tick);
          } catch (e) { clearInterval(tick); }
        }, 2000);
        if (tick.unref) tick.unref();
      } catch (e) {}
      return true;
    };

    /* the rows of the tab, from the app's own schema */
    var RADIF = null;
    function shemaMasir() {
      return process.env.CRTL_SCHEMA || path.join(typeof __dirname === 'string' ? __dirname : '', 'claude-code-settings.schema.json');
    }
    function shemaKhan() { return JSON.parse(fs.readFileSync(shemaMasir(), 'utf8')).properties || {}; }
    // A default the app itself states in a setting's description, so an update changes it here too. Same patterns as Doc/abzar/chek_pishfarz.py.
    var PISH_RE = [/\(defaults?:?\s+(?:to\s+)?["']?([\w\-]+(?:\.\d+)?)/, /\bDefaults? to ["'`]?([\w\-]+(?:\.\d+)?)/, /\bDefault:\s*([\w\-]+(?:\.\d+)?)/,
      /["']([\w\-]+(?:\.\d+)?)["'] \((?:the )?default\b/, /\b(\d+) \(the default\)/, /\bWhen absent or (true|false)\b/, /\bUnset defaults to (on|off)\b/, /\bDefault (on|off)\b/];
    function pishAzShema(desc) {
      for (var i = 0; i < PISH_RE.length; i++) {
        var m = PISH_RE[i].exec(String(desc || ''));
        if (!m) continue;
        var x = m[1];
        // "Default: the system time zone" is prose, not a value — keep looking.
        if (/^(the|a|an)$/i.test(x)) continue;
        if (x === 'true' || x === 'on') return true;
        if (x === 'false' || x === 'off') return false;
        return /^\d+(\.\d+)?$/.test(x) ? Number(x) : x;
      }
      return undefined;
    }
    function noeRadif(p) {
      if (p.type === 'boolean') return { no: 'onoff' };
      if (p.type === 'string' && p.enum) return { no: 'choice', enum: p.enum };
      if (p.type === 'number' || p.type === 'integer') return { no: 'number', min: p.minimum, max: p.maximum };
      if (p.type === 'string') return { no: 'text' };
      if (p.anyOf && p.anyOf.every(function (x) { return x.type === 'string'; })) {
        var pish = [];
        p.anyOf.forEach(function (x) { if (x.enum) pish = pish.concat(x.enum); });
        return { no: 'text', pish: pish };
      }
      return { no: 'json' };
    }
    function radifha() {
      if (RADIF) return RADIF;
      var s = shemaKhan();
      RADIF = Object.keys(s).filter(function (k) { return !MAMNU[k]; }).map(function (k) {
        var r = noeRadif(s[k]);
        r.k = k;
        r.desc = String(s[k].description || '').slice(0, 300);
        r.pz = pishAzShema(s[k].description); // from the whole text: some state it past the cut
        return r;
      });
      RADIF.push({ no: 'onoff', k: CHROME_KELID, desc: 'Claude in Chrome: connect the Chrome extension to every session (the app\'s "Enabled by default").' });
      return RADIF;
    }
    // The features the app's schema uses, and no more (checked 5 Nov: no $ref, oneOf or allOf).
    function sanjesh(s, v) {
      if (s === true || s === undefined) return true;
      if (s === false) return false;
      if (s.anyOf && !s.anyOf.some(function (x) { return sanjesh(x, v); })) return false;
      if (s.not && sanjesh(s.not, v)) return false;
      if ('const' in s && JSON.stringify(s.const) !== JSON.stringify(v)) return false;
      if (s.enum && !s.enum.some(function (e) { return JSON.stringify(e) === JSON.stringify(v); })) return false;
      if (s.type) {
        var ok = [].concat(s.type).some(function (t) {
          if (t === 'integer') return Number.isInteger(v);
          if (t === 'array') return Array.isArray(v);
          if (t === 'null') return v === null;
          if (t === 'object') return !!v && typeof v === 'object' && !Array.isArray(v);
          return typeof v === t;
        });
        if (!ok) return false;
      }
      if (typeof v === 'number') {
        if (typeof s.minimum === 'number' && v < s.minimum) return false;
        if (typeof s.maximum === 'number' && v > s.maximum) return false;
        if (typeof s.exclusiveMinimum === 'number' && v <= s.exclusiveMinimum) return false;
      }
      if (typeof v === 'string') {
        if (typeof s.minLength === 'number' && v.length < s.minLength) return false;
        if (typeof s.maxLength === 'number' && v.length > s.maxLength) return false;
        if (s.pattern) { try { if (!new RegExp(s.pattern).test(v)) return false; } catch (e) {} }
      }
      if (Array.isArray(v)) {
        if (typeof s.minItems === 'number' && v.length < s.minItems) return false;
        if (s.items !== undefined && !v.every(function (x) { return sanjesh(s.items, x); })) return false;
      } else if (v && typeof v === 'object') {
        if (s.required && !s.required.every(function (r) { return Object.prototype.hasOwnProperty.call(v, r); })) return false;
        var pr = s.properties || {};
        var bad = Object.keys(v).some(function (k) {
          if (s.propertyNames && !sanjesh(s.propertyNames, k)) return true;
          if (Object.prototype.hasOwnProperty.call(pr, k)) return !sanjesh(pr[k], v[k]);
          return s.additionalProperties !== undefined && !sanjesh(s.additionalProperties, v[k]);
        });
        if (bad) return false;
      }
      return true;
    }
    function adadLatin(t) {
      return String(t).replace(/[۰-۹]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d); }).replace(/[٠-٩]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(d); }).replace(/[,،٬\s]/g, '');
    }
    function hezar(n) { return adadFa(Math.round(n / 1000)) + ' هزار'; }
    function adadFa(n) { return String(n).replace(/\d/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'[d]; }); }
    // Turns what the page typed into the value to save. {hazf:true} = an empty box: this level lets go of the setting.
    function khamBeMaghdar(k, kham) {
      var t = kham === null || kham === undefined ? '' : String(kham).trim();
      if (!t) return { hazf: true };
      if (k === CHROME_KELID) return t === 'true' ? { v: true } : t === 'false' ? { v: false } : { khata: 'فقط روشن یا خاموش' };
      if (k === 'effortLevel') return EFFORTS.indexOf(t) !== -1 ? { v: t } : { khata: 'افورت فقط low، medium، high، xhigh یا max' };
      if (k === 'model') return /\s/.test(t) ? { khata: 'اسم مدل فاصله ندارد' } : { v: t };
      if (k === 'autoCompactWindow') {
        var ad = Number(adadLatin(t));
        if (!Number.isFinite(ad)) return { khata: 'فقط عدد؛ مثلاً 300000' };
        if (ad > 0 && ad < 2000) ad *= 1000;   // «300» means 300 thousand; the smallest real value is 67 thousand
        ad = Math.round(ad);
        if (ad < 100000 - FASELE_COMPACT) return { khata: 'کمتر از ۶۷ هزار را کلود قبول نمی‌کند' };
        var w = ad + FASELE_COMPACT;
        if (w > 1000000) return { v: 1000000, sagf: true };
        return { v: w };
      }
      var r = radifha().filter(function (x) { return x.k === k; })[0], s = shemaKhan()[k], v;
      if (r.no === 'onoff') {
        if (t !== 'true' && t !== 'false') return { khata: 'فقط روشن یا خاموش' };
        v = t === 'true';
      } else if (r.no === 'number') {
        v = Number(adadLatin(t));
        if (!Number.isFinite(v)) return { khata: 'فقط عدد' };
      } else if (r.no === 'json') {
        try { v = JSON.parse(t); }
        catch (e) {
          if (!sanjesh(s, t)) return { khata: 'متن JSON درست نیست' };
          v = t;
        }
      } else v = t;
      if (!sanjesh(s, v)) return { khata: 'این مقدار با قالب این تنظیم نمی‌خورد' };
      return { v: v };
    }
    // Files: a broken one is never overwritten; the file as it was stays beside it as .crtl-bak.
    function nevisFile(p, fn) {
      var d = {}, kham = null;
      try { kham = fs.readFileSync(p, 'utf8'); } catch (e) {}
      if (kham !== null && kham.trim()) d = shey(JSON.parse(kham));
      if (kham !== null) fs.writeFileSync(p + '.crtl-bak', kham);
      fn(d);
      fs.mkdirSync(path.dirname(p), { recursive: true });
      atomi(p, JSON.stringify(d, null, 2) + '\n');
    }
    // max lives only on the launch and in the running engine: a file with max falls back to medium (measured)
    function barayeFile(k, v) { return k === 'effortLevel' && v === 'max' ? 'xhigh' : v; }
    function nevisSarasari(k, v, hazf, modelAlan) {
      nevisFile(userMasir(), function (d) {
        var ms = d.modelSettings = shey(d.modelSettings);
        if (k === 'effortLevel') {
          // the engine reads effort by model and ignores a top-level one (measured 5 Nov)
          var names = Object.keys(ms);
          if (modelAlan && names.indexOf(modelAlan) === -1) names.push(modelAlan);
          names.forEach(function (n) {
            var e = ms[n] = shey(ms[n]);
            if (hazf) delete e.effortLevel; else e.effortLevel = barayeFile(k, v);
          });
          return;
        }
        if (k === 'autoCompactWindow') {
          // a per-model number beats the top-level one in the same file (measured): otherwise 300K stays 1M on Opus 5.5
          Object.keys(ms).forEach(function (n) { var e = shey(ms[n]); delete e.autoCompactWindow; ms[n] = e; });
        }
        if (hazf) delete d[k]; else d[k] = v;
      });
    }
    function nevisPoshe(cwd, k, v, hazf) {
      if (hazf && !fs.existsSync(mahalliMasir(cwd))) return;   // a folder that's gone is not brought back
      nevisFile(mahalliMasir(cwd), function (d) { if (hazf) delete d[k]; else d[k] = barayeFile(k, v); });
    }
    // Save one setting at one level. Returns {ok, matn}.
    function sabtTanzim(m) {
      var sath = m.sath, k = String(m.key || ''), sid = SID_RE.test(String(m.sid || '')) ? m.sid : '';
      if (['sarasari', 'poshe', 'chat'].indexOf(sath) === -1) return Promise.resolve({ ok: false, matn: 'اول یکی از سه تیک را بزن' });
      if (MAMNU[k] || !radifha().some(function (r) { return r.k === k; })) return Promise.resolve({ ok: false, matn: 'این تنظیم از اینجا نوشته نمی‌شود' });
      var yaft = kanalBaraye(sid, m.channel), ch = yaft && yaft.ch;
      var cwd = ch && ch.cwd || sessionRecord(sid).cwd || (typeof m.cwd === 'string' ? m.cwd : '');
      if (sath === 'chat' && !sid) return Promise.resolve({ ok: false, matn: 'کد این چت هنوز معلوم نیست؛ اول یک پیام بفرست' });
      if (sath === 'poshe' && !cwd) return Promise.resolve({ ok: false, matn: 'پوشهٔ این چت معلوم نیست' });
      if (cwd) cwd = path.resolve(cwd);
      var p = khamBeMaghdar(k, m.value);
      if (p.khata) return Promise.resolve({ ok: false, matn: p.khata });
      var hazf = !!p.hazf, v = p.v, a = anbarKhan();
      var darSath = sath === 'sarasari' ? a.sarasari[k] : sath === 'poshe' ? shey(a.poshe[cwd])[k] : shey(a.chat[sid])[k];
      var darFile = sath === 'sarasari' ? (function () {
        var d = jsonKhan(userMasir());
        return Object.prototype.hasOwnProperty.call(d, k) || ((k === 'effortLevel' || k === 'autoCompactWindow') && Object.keys(shey(d.modelSettings)).some(function (n) { return shey(d.modelSettings[n])[k] !== undefined; }));
      })() : sath === 'poshe' ? Object.prototype.hasOwnProperty.call(jsonKhan(mahalliMasir(cwd)), k) : false;
      if (hazf && !ast(darSath) && !darFile) return Promise.resolve({ ok: false, matn: 'این سطح مقداری نداشت؛ اگر می‌خواهی ثبت کنی مقدار را بنویس' });
      var modelGet = ch && k === 'effortLevel' && sath === 'sarasari'
        ? zamandar(Promise.resolve(ch.query.getSettings()), 2000).then(function (g) { return g && g.applied && g.applied.model; })
        : Promise.resolve('');
      var chromeGet = k === CHROME_KELID && sath === 'sarasari' && !hazf ? chromeSarasari(yaft, v) : Promise.resolve('');
      return chromeGet.then(function (kh) {
        if (kh) return { ok: false, matn: kh };
        return modelGet;
      }).then(function (modelAlan) {
        if (modelAlan && modelAlan.ok === false) return modelAlan;
        try {
          if (sath === 'sarasari' && k !== CHROME_KELID) nevisSarasari(k, v, hazf, modelAlan);
          if (sath === 'poshe' && k !== CHROME_KELID) nevisPoshe(cwd, k, v, hazf);
        } catch (e) {
          return { ok: false, matn: 'فایل نوشته نشد: ' + (e && e.message || e) };
        }
        a = anbarKhan();
        var t = Date.now();
        if (sath === 'sarasari') {
          if (hazf) delete a.sarasari[k]; else a.sarasari[k] = { v: v, t: t };
          // nothing older stays behind: a project's value in a file would still beat the global one in a terminal
          if (!hazf) {
            Object.keys(a.poshe).forEach(function (pp) {
              if (!ast(shey(a.poshe[pp])[k])) return;
              delete a.poshe[pp][k];
              if (k !== CHROME_KELID) try { nevisPoshe(pp, k, null, true); } catch (e) {}
            });
            Object.keys(a.chat).forEach(function (s) { if (ast(shey(a.chat[s])[k])) delete a.chat[s][k]; });
          }
        } else if (sath === 'poshe') {
          var e0 = a.poshe[cwd] = shey(a.poshe[cwd]);
          if (hazf) delete e0[k]; else e0[k] = { v: v, t: t };
        } else {
          var e1 = a.chat[sid] = shey(a.chat[sid]);
          if (hazf) delete e1[k]; else e1[k] = { v: v, t: t };
        }
        try { anbarNevis(a); } catch (e) { return { ok: false, matn: 'ثبت نشد: ' + (e && e.message || e) }; }
        logKhat('sabt ' + sath + ' ' + (hazf ? k + ' (hazf)' : barayeLog(k, v)) + (sath === 'poshe' ? ' ' + cwd : sath === 'chat' ? ' ' + sid : ''));
        chashmBeAnbar();
        return zamandar(pushHame(), 5000).then(function (taghir) {
          var tg = shey(taghir), mt = matnSabt(k, v, hazf, tg[k] || 0, sath, p.sagf);
          if (tg.__khata) mt += '؛ ولی روی ' + adadFa(tg.__khataTedad) + ' چت ننشست: ' + tg.__khata;
          return { ok: true, matn: mt };
        });
      });
    }
    var ESM_SATH = { sarasari: 'سراسری', poshe: 'پروژه', chat: 'چت' };
    function matnSabt(k, v, hazf, n, sath, sagf) {
      if (k === CHROME_KELID) {
        if (hazf) return 'از سطح ' + ESM_SATH[sath] + ' پاک شد؛ برای اطمینان ریلود کن';
        if (sath === 'sarasari') return v ? 'ثبت شد؛ چت‌های باز این پنجره و هر چت تازه به مرورگر وصل می‌شوند' : 'ثبت شد؛ چت‌های باز این پنجره قطع می‌شوند و چت تازه خودکار وصل نمی‌شود';
        return 'ثبت شد؛ ' + (n ? 'همین الان روی ' + adadFa(n) + ' چت این پنجره' : 'در این پنجره چتی عوض نشد؛ یا چتی باز نیست یا همین مقدار را داشتند');
      }
      if (k === 'autoCompactWindow') {
        if (hazf) return 'از سطح ' + ESM_SATH[sath] + ' پاک شد؛ بعد از ریلود اعمال می‌شود';
        var noghte = v - FASELE_COMPACT;
        return 'ثبت شد؛ کامپکت سر ' + hezar(noghte) + ' و رممبر سر ' + hezar(noghte - 20000) + '؛ بعد از ریلود اعمال می‌شود' +
          (sagf ? ' (بالاتر از ۹۶۷ هزار را کلود قبول نمی‌کند)' : '');
      }
      var chand = n ? 'همین الان روی ' + adadFa(n) + ' چت این پنجره' + (sath === 'chat' ? '' : ' و چت‌های پنجره‌های دیگر')
        : 'در این پنجره چتی عوض نشد؛ یا چتی باز نیست یا همین مقدار را داشتند';
      if (hazf) return 'از سطح ' + ESM_SATH[sath] + ' پاک شد؛ برای اطمینان ریلود کن';
      if (k === 'ultracode') return 'ثبت شد؛ ' + chand + '؛ ایجنت و ورک‌فلو بعد از ریلود ' + (v ? 'باز' : 'بسته') + ' می‌شوند';
      if (k === 'effortLevel' || k === 'model' || k === 'remoteControlAtStartup') {
        return 'ثبت شد؛ ' + chand + (k === 'effortLevel' && v === 'max' && sath !== 'chat' ? ' (در فایل xhigh می‌ماند، چون max در فایل نمی‌ماند)' : '');
      }
      return 'ثبت شد؛ برای اطمینان ریلود کن';
    }
    // Everything the tab shows. The chat's numbers come from the engine itself, so «الان» is what is really in force.
    function fehrestTanzim(m) {
      var sid = SID_RE.test(String(m.sid || '')) ? m.sid : '';
      var yaft = kanalBaraye(sid, m.channel), ch = yaft && yaft.ch;
      var cwd = ch && ch.cwd || sessionRecord(sid).cwd || (typeof m.cwd === 'string' ? m.cwd : '');
      if (cwd) cwd = path.resolve(cwd);
      var a = anbarKhan(), bar = {};
      radifha().forEach(function (r) { var w = barande(a, sid, cwd, r.k); if (w) bar[r.k] = w; });
      var out = { type: 'crtl-tanzimat-list', reqId: m.reqId, sid: sid, cwd: cwd, rows: radifha(), barande: bar,
        sath: { sarasari: a.sarasari, poshe: shey(a.poshe[cwd]), chat: shey(a.chat[sid]) },
        karbar: jsonKhan(userMasir()), mahalli: cwd ? jsonKhan(mahalliMasir(cwd)) : {}, alan: null, models: [],
        chrome: { on: jsonKhan(claudeJsonMasir())[CHROME_KELID], vasl: ch && ch.chromeMcpState ? ch.chromeMcpState.status : '' }, jahani: {} };
      // the engine also reads some settings from ~/.claude.json; a value there is not «پیش‌فرض کلود»
      var kj = jsonKhan(claudeJsonMasir());
      radifha().forEach(function (r) { if (r.k !== 'env' && r.k !== CHROME_KELID && kj[r.k] !== undefined) out.jahani[r.k] = kj[r.k]; });
      out.pishZende = {};
      radifha().forEach(function (r) { if (r.pz !== undefined) out.pishZende[r.k] = r.pz; });
      out.noskhe = jsonKhan(path.join(path.dirname(shemaMasir()), 'package.json')).version || '';
      out.pishSanjide = jsonKhan(path.join(HOME, 'crtl_pish_sanjide.json')).noskhe || '';
      if (!ch) return Promise.resolve(out);
      var q = ch.query;
      return Promise.all([
        zamandar(Promise.resolve().then(function () { return q.getSettings(); }), 3000),
        zamandar(Promise.resolve().then(function () { return q.getContextUsage(); }), 3000),
        zamandar(Promise.resolve().then(function () { return q.supportedModels(); }), 3000)
      ]).then(function (r) {
        var g = shey(r[0]), c = shey(r[1]);
        out.alan = { applied: shey(g.applied), effective: shey(g.effective), sources: Array.isArray(g.sources) ? g.sources : [],
          thr: c.autoCompactThreshold, remote: remoteVaziat(ch) };
        out.models = Array.isArray(r[2]) ? r[2].map(function (x) { return { value: x.value, name: x.displayName }; }) : [];
        return out;
      });
    }

    /* ---------------- the «ابزارها» tab (Habib, 16 Nov 2026) ---------------- */
    // «توی Aa ... برای ام سی پی و پلاگین و اسکیل و ابزارهای خود اپ»; three levels «این چت-این پوشه -سراسری»; only a new
    // chat changes. The list and its rules live in abzar/tik_ha.py (one list for VS Code, terminal, WezTerm and DSH);
    // here: ask it, and carry a new chat's own ticks to its launch. The launch itself goes through
    // ~/.claude/claude_abzar_kam.sh, which calls the same file with the chat's name taken out of --settings.
    var TIK_PY = process.env.CRTL_TIK_PY || '/Users/habib/1-MY-WORK/136th-day-fix-rtl-claude/abzar/tik_ha.py';
    var TIK_NESHANE = '__crtl_tik_chat';
    var TIK_BADI = null;    // {kelid, cwd, ta}: the page restarts its new chat; the next fresh launch in cwd is that chat
    var TIK_AKHAR = null;   // {kelid, ta}: the launch that just took a chat's ticks, for its channel when it is born
    function tikPy(args, voroodi) {
      return new Promise(function (ok, rad) {
        var cp = require('child_process');
        var p = cp.execFile('python3', [TIK_PY].concat(args), { timeout: 8000, maxBuffer: 4 << 20 }, function (e, out, stderr) {
          if (e) {
            var reason = String(stderr || '').trim().split(/\r?\n/).pop();
            return rad(new Error(reason ? reason.slice(0, 220) : 'اجرای ابزار تیک‌ها ناموفق بود'));
          }
          try { ok(JSON.parse(out)); } catch (x) { rad(x); }
        });
        if (voroodi !== undefined) { p.stdin.write(JSON.stringify(voroodi)); }
        p.stdin.end();
      });
    }
    function tikCwd(m) {
      var yaft = kanalBaraye(SID_RE.test(String(m.sid || '')) ? m.sid : '', m.channel), ch = yaft && yaft.ch;
      var c = (typeof m.cwd === 'string' && m.cwd) || (ch && ch.cwd) || sessionRecord(String(m.sid || '')).cwd || poshePishfarzTik();
      return c ? path.resolve(c) : '';
    }
    function poshePishfarzTik() {
      try { var f = require('vscode').workspace.workspaceFolders; return f && f[0] ? f[0].uri.fsPath : ''; } catch (e) { return ''; }
    }
    function tikKelid(m) {
      var k = String(m.kelid || '');
      return SID_RE.test(k) || /^kanal-[a-z0-9]{6,20}$/.test(k) ? k : '';
    }
    function tikFehrest(m) {
      var cwd = tikCwd(m), kelid = tikKelid(m);
      return tikPy(['fehrest', cwd].concat(kelid ? ['--chat', kelid] : []).concat(m.sid ? ['--scope-chat', String(m.sid)] : []).concat(m.sath ? ['--view-scope', m.sath] : [])).then(function (r) {
        try {
          var help = require(path.join(path.dirname(TIK_PY), '..', 'dsh-rtl', 'tool-help.cjs'));
          r.scopeSessionId = String(m.sid || kelid || '');
          r = help.enrichClaude(r);
        } catch (e) { /* list remains available if help metadata is missing */ }
        return Object.assign({ type: 'crtl-tik-list', reqId: m.reqId, kelid: kelid }, r);
      });
    }
    function tikSabt(m) {
      var cwd = tikCwd(m), kelid = tikKelid(m);
      return tikPy(['sabt'], { sath: m.sath, cwd: cwd, chat: kelid, taghir: Array.isArray(m.taghir) ? m.taghir : [] }).then(function (r) {
        logKhat('tik ' + m.sath + ' ' + (r.ok ? 'ok' : 'na') + ' ' + (m.taghir || []).map(function (t) { return t.kind + ':' + t.name + '=' + t.on; }).join(' ') + ' ' + cwd + (kelid ? ' ' + kelid : ''));
        return r;
      });
    }
    // the page is about to restart its new chat (no message yet): the next fresh launch in that folder takes its ticks
    function tikBadi(m) {
      var cwd = tikCwd(m), kelid = tikKelid(m);
      TIK_BADI = cwd ? { kelid: kelid, cwd: cwd, ta: Date.now() + 15000 } : null;
      return { ok: !!cwd };
    }
    function tikBarayeLaunch(resume, cwd) {
      var b = TIK_BADI;
      if (!b || resume || Date.now() > b.ta || path.resolve(cwd || '') !== b.cwd) return '';
      TIK_BADI = null;
      if (b.kelid) TIK_AKHAR = { kelid: b.kelid, ta: Date.now() + 20000 };
      return b.kelid;
    }
    // a new chat's own ticks belong to its id from its first message, so a reload or `claude --resume <id>` keeps them
    function tikBeSid(o, id, ch, kelid) {
      var n = 0, tick = setInterval(function () {
        try {
          var sid = String(ch.sessionId || '');
          if (SID_RE.test(sid)) {
            clearInterval(tick);
            tikPy(['chat-be-sid', kelid, sid]).then(function (r) { logKhat('tik chat ' + kelid + ' => ' + sid + ' ' + (r.ok ? 'ok' : 'na')); }, function () {});
          } else if (++n > 1800 || o.channels.get(id) !== ch) clearInterval(tick);
        } catch (e) { clearInterval(tick); }
      }, 2000);
      if (tick.unref) tick.unref();
    }
    // what the engine offers, from each chat's first message: a tool ticked off still shows in the list
    var TIK_DIDE_TA = 0;
    globalThis.__crtl_tik_dide = function (m) {
      try {
        if (!m || m.type !== 'system' || m.subtype !== 'init' || Date.now() < TIK_DIDE_TA) return;
        TIK_DIDE_TA = Date.now() + 60000;
        var f = process.env.TIK_HA_DIDE || path.join(HOME, 'tik_ha_dide.json'), d = jsonKhan(f), taze = false;
        function afzoodan(k, list) {
          var s = Array.isArray(d[k]) ? d[k] : [];
          list.forEach(function (x) { if (typeof x === 'string' && x && s.indexOf(x) === -1) { s.push(x); taze = true; } });
          d[k] = s;
        }
        afzoodan('abzar', (m.tools || []).filter(function (t) { return typeof t === 'string' && t.indexOf('mcp__') !== 0; }));
        afzoodan('mcp', (m.mcp_servers || []).map(function (x) { return x && x.name; }));
        afzoodan('afzune', (m.plugins || []).map(function (x) { return x && x.source; }));
        afzoodan('eskil', m.skills || []);
        if (taze) atomi(f, JSON.stringify(d, null, 1) + '\n');
      } catch (e) {}
    };

    if (process.env.CRTL_HOST_TEST) { global.__crtlHost = { aaPrefs: aaPrefs, tikFehrest: tikFehrest, tikSabt: tikSabt, tikBadi: tikBadi, tikBarayeLaunch: tikBarayeLaunch, pishAzShema: pishAzShema, ref: ref, card: card, sessionRecord: sessionRecord, vaghtEffortGhadimi: vaghtEffortGhadimi, anbarKhan: anbarKhan, barande: barande, parchamha: parchamha, radifha: radifha, sanjesh: sanjesh, khamBeMaghdar: khamBeMaghdar, sabtTanzim: sabtTanzim, fehrestTanzim: fehrestTanzim, pushHame: pushHame, SAHEB: SAHEB, SAFHE: SAFHE, tanzimRemoteSabr: function (ms) { REMOTE_ON_SABR = ms; } }; return; }
    try { vaghtEffortGhadimi(); } catch (e) {}
    var vscode = require('vscode');
    function poshePishfarz() {
      try { var f = vscode.workspace.workspaceFolders; return f && f[0] ? f[0].uri.fsPath : ''; } catch (e) { return ''; }
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

    function aaPrefs(m, cwd) {
      var helper = require(process.env.CRTL_AA_MODULE || '/Users/habib/1-MY-WORK/136th-day-fix-rtl-claude/dsh-rtl/aa-shared.cjs');
      if (!path.isAbsolute(cwd || '')) throw Error('پوشه معلوم نیست');
      return m.type === 'crtl-aa-save' ? helper.save(os.homedir(), 'prefs', m.scope, cwd, m.sid || '', m.patch, m.unset || []) : helper.view(os.homedir(), 'prefs', cwd, m.sid || '');
    }
    function wire(webview) {
      if (!webview || webview.__crtlHost) return;
      webview.__crtlHost = true;
      SAFHE.add(webview);
      webview.onDidReceiveMessage(function (m) {
        if (m && (m.type === 'crtl-aa-read' || m.type === 'crtl-aa-save')) {
          try { webview.postMessage(Object.assign({type:'crtl-aa-state', ok:true}, aaPrefs(m,poshePishfarz()))); }
          catch(e) { webview.postMessage({type:'crtl-aa-state',ok:false,error:String(e.message)}); }
          return;
        }

        if (m && (m.type === 'crtl-tik-list' || m.type === 'crtl-tik-sabt' || m.type === 'crtl-tik-badi')) {
          var kar = m.type === 'crtl-tik-list' ? tikFehrest(m) : m.type === 'crtl-tik-sabt' ? tikSabt(m) : Promise.resolve(tikBadi(m));
          kar.then(function (r) {
            webview.postMessage(Object.assign({}, r, { type: m.type, reqId: m.reqId }));
          }, function (e) {
            webview.postMessage({ type: m.type, reqId: m.reqId, ok: false, khata: String(e && e.message || e) });
          });
          return;
        }
        if (m && m.type === 'crtl-tanzimat-list') {
          Promise.resolve().then(function () { return fehrestTanzim(Object.assign({}, m, { cwd: poshePishfarz() })); }).then(function (r) { webview.postMessage(r); }, function (e) {
            webview.postMessage({ type: 'crtl-tanzimat-list', reqId: m.reqId, khata: String(e && e.message || e) });
          });
          return;
        }
        if (m && m.type === 'crtl-tanzimat-sabt') {
          Promise.resolve().then(function () { return sabtTanzim(Object.assign({}, m, { cwd: poshePishfarz() })); }).then(function (r) {
            webview.postMessage({ type: 'crtl-tanzimat-sabt', reqId: m.reqId, ok: r.ok, matn: r.matn });
          }, function (e) {
            webview.postMessage({ type: 'crtl-tanzimat-sabt', reqId: m.reqId, ok: false, matn: String(e && e.message || e) });
          });
          return;
        }
        if (m && m.type === 'crtl-navar') {
          // «نوارِ اطلاعات»: this chat's numbers from its transcript (the navar block at the end of this file)
          try { if (globalThis.__crtl_navar) globalThis.__crtl_navar.javab(String(m.sid || ''), m.kelid, function (r) { webview.postMessage(r); }); } catch (e) {}
          return;
        }
        if (m && m.type === 'crtl-tarjome') {
          // the «ترجمه» of the hads mod: the page can't read ~/.claude. Sent only when the file changed.
          if (!/^[0-9a-f-]{36}$/.test(String(m.sid || ''))) return;
          try {
            var ft = path.join(HOME, 'hads-log', m.sid + '.tarjome.jsonl'), mt = fs.statSync(ft).mtimeMs;
            if (mt !== m.mt) webview.postMessage({ type: 'crtl-tarjome', sid: m.sid, mt: mt, text: fs.readFileSync(ft, 'utf8') });
          } catch (e) {}
          return;
        }
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
        if (ctx) return sys ? { head: 'متنِ تزریقی', body: kutah_kardan_masir(ctx) } : { head: kutah_kardan_masir(ctx.split('\n')[0]), body: kutah_kardan_masir(ctx.split('\n').slice(1).join('\n').trim()) };
        return null;
      }
    }
    // the first line is the head; the body is only what follows, so an opened line does not say it twice
    // (Habib, 26 Oct 05:47, a PostToolUse line shown twice: «این داستانش چیه از کجا اومده ؟»)
    var first = t.split('\n')[0];
    return { head: kutah_kardan_masir(first), body: kutah_kardan_masir(t.split('\n').slice(1).join('\n').trim()) };
  }
  globalThis.__crtl_hook_khana = khana_baraye_habib;
  // no emoji in a hook line (Habib, 26 Oct 05:36: «این ایموجی های مزخرف رو کامل بردار - کامل بدون ایموجی»):
  // neither ours nor the hook's own (🧠 …)
  function bi_emoji(t) { return String(t).replace(/(?:\p{Extended_Pictographic}|[\u{1F1E6}-\u{1F1FF}])[\uFE0F\u200D]*/gu, '').replace(/[ \t]{2,}/g, ' ').replace(/^ +| +$/gm, ''); }
  globalThis.__crtl_bi_emoji = bi_emoji;
  // one hook line: the first line is what the folded view shows (time, name, a short head). It starts with an
  // invisible mark (U+2063), not a 🪝, so the page script still finds it
  function sakht_khat_hook(name, r, t, uuid, sid) {
    return { type: 'system', subtype: 'informational', level: 'notice', session_id: sid, uuid: uuid,
      content: '\u2063' + zaman_shamsi(t) + ' · ' + name + ' · ' + bi_emoji(r.head) + (r.body ? '\n' + bi_emoji(r.body) : '') };
  }
  globalThis.__crtl_khat_hook = function (m, now) {
    try {
      if (m && m.subtype === 'init' && globalThis.__crtl_tik_dide) globalThis.__crtl_tik_dide(m);   // the «ابزارها» list
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
      // the same hook's injected text, written within 10 s of its message
      var matn_ha = [];
      khat_ha_ye_hook_dar_file(f).forEach(function (l) {
        var o; try { o = JSON.parse(l); } catch (e) { return; }
        if (o.attachment && o.attachment.type === 'hook_additional_context') matn_ha.push({ t: Date.parse(o.timestamp) || 0, n: o.attachment.hookName || o.attachment.hookEvent });
      });
      function ham_ba_matn(o, a) {
        var t = Date.parse(o.timestamp) || 0, n = a.hookName || a.hookEvent;
        return matn_ha.some(function (x) { return x.n === n && Math.abs(x.t - t) <= 10000; });
      }
      khat_ha_ye_hook_dar_file(f).forEach(function (l) {
        var o; try { o = JSON.parse(l); } catch (e) { return; }
        var a = o.attachment;
        if (!a || !gorooh_hook[a.type] || o.isSidechain) return;
        var t = Date.parse(o.timestamp);
        if (!t || t < first) return;
        var body = Array.isArray(a.content) ? a.content.join('\n') : String(a.content == null ? '' : a.content);
        var r = khana_baraye_habib(body);
        if (!r) return;
        // a hook's message (systemMessage) next to the text it injected: only the injected text shows (Habib,
        // 26 Oct 05:36: «فقط اون دومی رو نشون بده که متن کامل ایمپورت ها هست بیاد اولی نیاد»)
        if (a.type === 'hook_system_message' && ham_ba_matn(o, a)) return;
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

// «نوارِ اطلاعات»: this chat's dollars, tokens, messages and context, for the small table left of the prompt box
// (Habib, 16 Nov 2026, with a picture of the DeepSeek app: «یه کاری کن مثل دیپ سیک که این اطلاعات رو نشون میده
// توی کلود کد هم بیاد» · «غیر از مدل و افورت که هستن بقیه بیاد سمت چپ پنل نوشتن» · «همه اعدادش صفره … مثل جدول
// فلوت حدس»). Read from the chat's own transcript, not from the panel: the panel zeroes its numbers after every
// message and after a reload, and its dollar figure prices every non-Claude model as Opus (measured 16 Nov:
// costBasis "unknown", 6108 DeepSeek tokens ⇒ $0.0308 instead of about $0.001). Dollars here are tokens × the
// OpenRouter price of the provider the chat's preset pins (a preset may fall back, so the page shows «≈»).
(function () {
  try {
    var fs = require('fs'), path = require('path'), os = require('os');
    function khane() { return process.env.CRTL_NAVAR_HOME || path.join(os.homedir(), '.claude'); }
    var HALAT = {};          // sid → what was read of its transcript so far
    var GHEYMAT = {};        // model base → { t, endpoints:[{provider, tag, ctx, p:{in,out,cr,cw}}] } or { t, khata }
    var GHEYMAT_NOSKHE = 0;  // goes up when a price arrives, so the page's numbers are redone
    var MOHLAT_GHEYMAT = 6 * 3600e3;

    function file_chat(sid) {
      var dir = path.join(khane(), 'projects'), dirs = [];
      try { dirs = fs.readdirSync(dir); } catch (e) { return ''; }
      for (var i = 0; i < dirs.length; i++) {
        var f = path.join(dir, dirs[i], sid + '.jsonl');
        if (fs.existsSync(f)) return f;
      }
      return '';
    }
    function halat_taze(file) { return { file: file, offset: 0, rest: '', calls: {}, tartib: [], payam: 0, cwd: '' }; }
    // a person's message: typed text, not a tool's answer, not a command's echo, not a note the app adds
    function payam_e_adam(o) {
      if (o.type !== 'user' || o.isMeta || o.isSidechain || o.isCompactSummary) return false;
      var c = o.message && o.message.content;
      var t = typeof c === 'string' ? c : Array.isArray(c) && !c.some(function (x) { return x && x.type === 'tool_result'; })
        ? c.filter(function (x) { return x && x.type === 'text'; }).map(function (x) { return x.text || ''; }).join('') : '';
      t = String(t || '').trim();
      return !!t && !/^<(command-|local-command|task-notification|system-reminder)/.test(t) && t.indexOf('The hads plugin sent a message') !== 0;
    }
    function khat(h, line) {
      if (!line) return;
      var o; try { o = JSON.parse(line); } catch (e) { return; }
      if (o.cwd && !h.cwd) h.cwd = o.cwd;
      if (payam_e_adam(o)) { h.payam++; return; }
      if (o.type !== 'assistant' || !o.message || !o.message.usage) return;
      var m = o.message, model = String(m.model || '');
      if (!model || model === '<synthetic>') return;
      // one call is written as several lines (one per content block) with the same id and usage: the last wins
      var id = m.id || o.uuid;
      if (!h.calls[id]) h.tartib.push(id);
      h.calls[id] = { model: model, u: m.usage, t: Date.parse(o.timestamp) || 0, sidechain: !!o.isSidechain };
    }
    function khandan(h, matn) {
      var text = h.rest + matn, cut = text.lastIndexOf('\n');
      h.rest = text.slice(cut + 1);
      var lines = text.slice(0, cut + 1).split('\n');
      for (var i = 0; i < lines.length; i++) khat(h, lines[i]);
    }
    // only the new bytes are read; a whole chat file (hundreds of MB) streams once, in the background
    function be_ruz(sid, cb) {
      var h = HALAT[sid];
      var f = h && fs.existsSync(h.file) ? h.file : file_chat(sid);
      if (!f) return cb(null);
      if (!h || h.file !== f) h = HALAT[sid] = halat_taze(f);
      var size; try { size = fs.statSync(f).size; } catch (e) { return cb(null); }
      if (size < h.offset) h = HALAT[sid] = halat_taze(f); // rewritten
      if (size === h.offset) return cb(h, size);
      if (h.dar_hal) { h.montazer = (h.montazer || []).concat(cb); return; }
      h.dar_hal = true;
      var st = fs.createReadStream(f, { start: h.offset, end: size - 1, encoding: 'utf8', highWaterMark: 1 << 20 });
      st.on('data', function (chunk) { khandan(h, chunk); });
      function tamam() {
        h.offset = size; h.dar_hal = false;
        var m = h.montazer || []; h.montazer = null;
        cb(h, size); m.forEach(function (fn) { fn(h, size); });
      }
      st.on('end', tamam);
      st.on('error', function () { h.dar_hal = false; cb(null); });
    }

    /* ---- prices ---- */
    function anbar_tanzim() { try { return JSON.parse(fs.readFileSync(process.env.CRTL_TANZIMAT || path.join(khane(), 'crtl_tanzimat.json'), 'utf8')) || {}; } catch (e) { return {}; } }
    function model_e_chat(sid, cwd) {
      var a = anbar_tanzim();
      function v(o) { var r = o && o.model; return r && typeof r.v === 'string' ? r.v : ''; }
      return v((a.chat || {})[sid]) || v((a.poshe || {})[cwd]) || '';
    }
    // the OpenRouter name of a model as Claude Code writes it: claude-opus-5-5 ⇒ anthropic/claude-opus-5.5
    function esm_openrouter(model) {
      var m = String(model).split('@')[0];
      if (/^claude-/.test(m)) return 'anthropic/' + m.replace(/-(\d+)-(\d+)$/, '-$1.$2');
      return m;
    }
    // «mh-deepseek-v4-flash-vision-exp-deepinfra» is the model hunter's preset for one provider: the part after
    // the model's own name. Other presets (cheap-deepseek) sort by price: the cheapest endpoint.
    function ersal_konande(model_ba_preset, base) {
      var p = String(model_ba_preset).split('@preset/')[1] || '';
      var slug = 'mh-' + String(base).split('/').pop().replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '-';
      return p.indexOf(slug) === 0 ? p.slice(slug.length) : '';
    }
    function adad(x) { var n = Number(x); return Number.isFinite(n) ? n : null; }
    function gheymat_baraye(base, model_chat) {
      var g = GHEYMAT[base];
      if (!g || !g.endpoints || !g.endpoints.length) return null;
      var es = g.endpoints, e = null;
      if (/^anthropic\//.test(base)) e = es.filter(function (x) { return /^anthropic/i.test(x.tag || x.provider); })[0];
      var pr = model_chat && String(model_chat).split('@')[0] === base ? ersal_konande(model_chat, base) : '';
      if (!e && pr) {
        // the provider's plain endpoint (deepinfra/fp8), not its flex or priority one: what the preset asks for
        e = es.filter(function (x) { return String(x.tag || '').split('/')[0] === pr; })
          .sort(function (a, b) { return String(a.tag).split('/').length - String(b.tag).split('/').length || a.p['in'] - b.p['in']; })[0];
      }
      if (!e) e = es.slice().sort(function (a, b) { return a.p['in'] - b.p['in']; })[0];
      return e;
    }
    function gereftan_gheymat_pishfarz(base, done) {
      var https = require('https');
      var url = 'https://openrouter.ai/api/v1/models/' + base + '/endpoints';
      var req = https.get(url, { timeout: 15000 }, function (res) {
        var body = '';
        res.setEncoding('utf8');
        res.on('data', function (c) { body += c; });
        res.on('end', function () {
          try {
            var d = JSON.parse(body).data;
            done(null, (d.endpoints || []).map(function (x) {
              var p = x.pricing || {};
              return { provider: x.provider_name, tag: x.tag || '', ctx: adad(x.context_length),
                p: { 'in': adad(p.prompt), out: adad(p.completion), cr: adad(p.input_cache_read), cw: adad(p.input_cache_write) } };
            }).filter(function (x) { return x.p['in'] !== null && x.p.out !== null; }));
          } catch (e) { done(e); }
        });
      });
      req.on('timeout', function () { req.destroy(new Error('timeout')); });
      req.on('error', function (e) { done(e); });
    }
    var API = {
      gereftan_gheymat: gereftan_gheymat_pishfarz,
      // tests put a price straight in
      gheymat_bezar: function (base, endpoints) { GHEYMAT[base] = { t: Date.now(), endpoints: endpoints }; GHEYMAT_NOSKHE++; },
    };
    function bekhah_gheymat(base) {
      var g = GHEYMAT[base], now = Date.now();
      if (g && (g.dar_rah || now - g.t < (g.khata ? 600e3 : MOHLAT_GHEYMAT))) return;
      GHEYMAT[base] = Object.assign({}, g || {}, { dar_rah: true, t: g ? g.t : 0 });
      API.gereftan_gheymat(base, function (err, endpoints) {
        if (err || !endpoints || !endpoints.length) GHEYMAT[base] = Object.assign({}, g || {}, { t: Date.now(), khata: String(err && err.message || 'no price'), dar_rah: false });
        else GHEYMAT[base] = { t: Date.now(), endpoints: endpoints };
        GHEYMAT_NOSKHE++;
      });
    }

    // the numbers for one chat
    function hesab(h, sid) {
      var model_chat = model_e_chat(sid, h.cwd);
      var jam = { 'in': 0, out: 0, cr: 0, cw: 0 }, usd = 0, bi_gheymat = 0, models = {}, akhar = null;
      h.tartib.forEach(function (id) {
        var c = h.calls[id], u = c.u || {};
        var t = { 'in': u.input_tokens || 0, out: u.output_tokens || 0, cr: u.cache_read_input_tokens || 0, cw: u.cache_creation_input_tokens || 0 };
        Object.keys(jam).forEach(function (k) { jam[k] += t[k]; });
        var base = esm_openrouter(c.model);
        bekhah_gheymat(base);
        var e = gheymat_baraye(base, model_chat);
        var m = models[c.model] || (models[c.model] = { model: c.model, tamas: 0, usd: 0, bi_gheymat: 0, ersal: '', gheymat: null });
        m.tamas++;
        if (e) {
          var d = t['in'] * e.p['in'] + t.out * e.p.out + t.cr * (e.p.cr !== null ? e.p.cr : e.p['in']) + t.cw * (e.p.cw !== null ? e.p.cw : e.p['in']);
          usd += d; m.usd += d; m.ersal = e.provider + (e.tag ? ' (' + e.tag + ')' : '');
          m.gheymat = { 'in': e.p['in'] * 1e6, out: e.p.out * 1e6, cr: e.p.cr !== null ? e.p.cr * 1e6 : null };
          m.ctx = e.ctx;
        } else { bi_gheymat++; m.bi_gheymat++; }
        if (!c.sidechain) akhar = { t: t, model: c.model, ctx: e ? e.ctx : null };
      });
      var ctx = akhar ? { used: akhar.t['in'] + akhar.t.cr + akhar.t.cw + akhar.t.out, max: akhar.ctx } : null;
      return {
        payam: h.payam, tamas: h.tartib.length,
        tokens: jam, tokens_kol: jam['in'] + jam.out + jam.cr + jam.cw,
        usd: usd, bi_gheymat: bi_gheymat, models: Object.keys(models).map(function (k) { return models[k]; }),
        ctx: ctx, model_chat: model_chat,
      };
    }
    // the page sends the last key it has; only a changed answer goes back
    API.javab = function (sid, kelid_safhe, send) {
      if (!/^[0-9a-f-]{36}$/.test(String(sid || ''))) return;
      be_ruz(sid, function (h, size) {
        if (!h) return send({ type: 'crtl-navar', sid: sid, kelid: 'none', d: null });
        var d = hesab(h, sid);
        var kelid = size + ':' + GHEYMAT_NOSKHE + ':' + d.model_chat + ':' + d.bi_gheymat;
        if (kelid === kelid_safhe) return;
        send({ type: 'crtl-navar', sid: sid, kelid: kelid, d: d });
      });
    };
    API.hesab_file = function (sid, cb) { be_ruz(sid, function (h) { cb(h ? hesab(h, sid) : null); }); };
    API.payam_e_adam = payam_e_adam;
    API.ersal_konande = ersal_konande;
    API.esm_openrouter = esm_openrouter;
    API.pak = function () { HALAT = {}; GHEYMAT = {}; GHEYMAT_NOSKHE = 0; };
    globalThis.__crtl_navar = API;
  } catch (e) {}
})();
/* === /CLAUDE-RTL-HOST-HOOK === */

/* === DSH-CLAUDE-HISTORY-HOST-V1 === */
// Independent of Aa: observe only the transcript registered by this webview.
try {
  if (!process.env.CRTL_HOST_TEST) {
    var historyHost = require('/Users/habib/1-MY-WORK/136th-day-fix-rtl-claude/dsh-claude-yeki/history-host.cjs');
    globalThis.__crtlHistoryLaunch = historyHost.launch;
    globalThis.__crtlHistoryWatchChannel = historyHost.watchToolChannel;
    historyHost.install(require('vscode'));
  }
} catch (error) { console.warn('DSH history host unavailable:', String(error.message)); }
/* === /DSH-CLAUDE-HISTORY-HOST-V1 === */
