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
        var a = anbarKhan(), sid = ch.sessionId || '', cwd = ch.cwd || '';
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

    if (process.env.CRTL_HOST_TEST) { global.__crtlHost = { ref: ref, card: card, sessionRecord: sessionRecord, vaghtEffortGhadimi: vaghtEffortGhadimi, anbarKhan: anbarKhan, barande: barande, parchamha: parchamha, radifha: radifha, sanjesh: sanjesh, khamBeMaghdar: khamBeMaghdar, sabtTanzim: sabtTanzim, fehrestTanzim: fehrestTanzim, pushHame: pushHame, SAHEB: SAHEB, SAFHE: SAFHE, tanzimRemoteSabr: function (ms) { REMOTE_ON_SABR = ms; } }; return; }
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

    function wire(webview) {
      if (!webview || webview.__crtlHost) return;
      webview.__crtlHost = true;
      SAFHE.add(webview);
      webview.onDidReceiveMessage(function (m) {
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
/* === /CLAUDE-RTL-HOST-HOOK === */
