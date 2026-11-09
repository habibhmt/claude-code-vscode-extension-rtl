/* تبِ «تنظیمات Codex» — سمتِ میزبان (تعریف ۲۵). داخلِ out/extension.jsِ افزونهٔ Codex چسبانده می‌شود.
 * حبیب، ۹ نوامبر: «توی کدکس تنظیمات کدکس بیاد و توی کلود کد تنظیمات کلود کد که قاطی نشه».
 * سه سطح، فقط یکی تیک می‌خورد:
 *   سراسری ⇐ ~/.codex/config.toml (با درِ رسمی: config/value/write) و همان کلید از پروژه‌ها و چت‌های ثبت‌شده برداشته می‌شود
 *   پروژه  ⇐ <پوشه>/.codex/config.toml و همان کلید از چت‌های ثبت‌شدهٔ همین پوشه برداشته می‌شود
 *   چت     ⇐ انبارِ ~/.codex/crtl_tanzimat.json؛ هنگامِ turn/start همان چت پر می‌شود. فقط ۷ کلید (CHAT_KEYS)
 *            چون turn/start فقط همین‌ها را می‌پذیرد (TurnStartParams، codex-cli 0.164). */
(function () {
  'use strict';
  var fs = require('fs'), path = require('path'), os = require('os');
  var module = { exports: {} };
  /*__HOST__*/
  var H = module.exports;
  var SCHEMA = /*__SCHEMA__*/null;
  var HOME = process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
  var STORE = path.join(HOME, 'crtl_tanzimat.json');
  var LOG = path.join(HOME, 'crtl_tanzimat.log');
  // config key ⇐ field of turn/start, and how its value becomes that field
  var CHAT_KEYS = {
    model: ['model', function (v) { return v; }],
    model_reasoning_effort: ['effort', function (v) { return v; }],
    approval_policy: ['approvalPolicy', function (v) { return v; }],
    sandbox_mode: ['sandboxPolicy', function (v) {
      return v === 'read-only' ? { type: 'readOnly' } : v === 'danger-full-access' ? { type: 'dangerFullAccess' } : { type: 'workspaceWrite' };
    }],
    service_tier: ['serviceTier', function (v) { return v; }],
    model_reasoning_summary: ['summary', function (v) { return v; }],
    personality: ['personality', function (v) { return v; }]
  };
  var byKey = {};
  (SCHEMA.rows || []).forEach(function (r) { byKey[r.k] = r; });

  function log(s) { try { fs.appendFileSync(LOG, new Date().toISOString() + ' ' + s + '\n'); } catch (_) {} }
  function readStore() {
    try { var j = JSON.parse(fs.readFileSync(STORE, 'utf8')); if (j && typeof j === 'object' && j.chat) return j; } catch (_) {}
    return { chat: {} };
  }
  function writeStore(j) {
    fs.mkdirSync(HOME, { recursive: true });
    var tmp = STORE + '.tmp' + process.pid;
    fs.writeFileSync(tmp, JSON.stringify(j, null, 1));
    fs.renameSync(tmp, STORE);
  }
  function codexBin() {
    var bin = path.join(__dirname, '..', 'bin');
    var dirs = fs.readdirSync(bin);
    for (var i = 0; i < dirs.length; i++) {
      var p = path.join(bin, dirs[i], process.platform === 'win32' ? 'codex.exe' : 'codex');
      if (fs.existsSync(p)) return p;
    }
    throw new Error('codex در پوشهٔ bin پیدا نشد');
  }
  function cwdNow() {
    var f = require('vscode').workspace.workspaceFolders;
    return f && f.length ? f[0].uri.fsPath : null;
  }
  // the box always holds text: turn it into what the schema says the key is; '' = remove from this level
  function parse(k, t) {
    var r = byKey[k] || { no: 'json' };
    if (t === undefined || t === null || String(t).trim() === '') return { hazf: true };
    t = String(t).trim();
    if (r.no === 'onoff') { if (t !== 'true' && t !== 'false') throw new Error('فقط روشن یا خاموش'); return { v: t === 'true' }; }
    if (r.no === 'adad') {
      var n = Number(t.replace(/[۰-۹]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d); }).replace(/[,،٬\s]/g, ''));
      if (!isFinite(n) || Math.floor(n) !== n) throw new Error('یک عددِ درست بنویس'); return { v: n };
    }
    if (r.no === 'json') { try { return { v: JSON.parse(t) }; } catch (e) { throw new Error('JSONِ درست نیست: ' + e.message); } }
    if (r.no === 'choice' && r.enum && r.enum.indexOf(t) === -1) throw new Error('یکی از این‌ها: ' + r.enum.join('، '));
    return { v: t };
  }
  function layer(cfg, type) {
    var l = (cfg.layers || []).filter(function (x) { return x.name && x.name.type === type; });
    return l.length ? l[l.length - 1] : null;
  }

  async function list(msg) {
    var cwd = cwdNow(), codex = codexBin();
    var res = await H.rpc(codex, [['config/read', { cwd: cwd, includeLayers: true }], ['model/list', {}, true]]);
    var cfg = res[0], models = (res[1] && res[1].data) || [];
    var user = layer(cfg, 'user'), proj = layer(cfg, 'project');
    var store = readStore(), mine = (store.chat[msg.sid] || {}).v || {};
    var chatSath = {};
    Object.keys(mine).forEach(function (k) { chatSath[k] = { v: mine[k] }; });
    var eff = Object.assign({}, cfg.config || {});
    Object.keys(mine).forEach(function (k) { eff[k] = mine[k]; });
    var def = models.filter(function (m) { return m.isDefault; })[0] || {};
    var model = eff.model || def.model || def.id;
    var cur = models.filter(function (m) { return m.model === model || m.id === model; })[0] || def;
    if (eff.model_reasoning_effort == null && cur.defaultReasoningEffort) eff.model_reasoning_effort = cur.defaultReasoningEffort;
    var sources = [{ source: 'userSettings', settings: (user && user.config) || {} }];
    if (proj) sources.push({ source: 'projectSettings', settings: proj.config || {} });
    if (msg.sid) sources.push({ source: 'flagSettings', settings: mine });
    return {
      rows: SCHEMA.rows.map(function (r) { return Object.assign({ chatNa: !CHAT_KEYS[r.k] }, r); }),
      karbar: (user && user.config) || {}, mahalli: (proj && proj.config) || {},
      sath: { chat: chatSath },
      models: models.filter(function (m) { return !m.hidden; }).map(function (m) { return { value: m.model || m.id, name: m.displayName || m.model }; }),
      efforts: (cur.supportedReasoningEfforts || []).map(function (e) { return e.reasoningEffort || e; }),
      alan: { applied: { model: model, effort: eff.model_reasoning_effort }, effective: eff, sources: sources },
      cwd: cwd, sid: msg.sid || '', poshe: proj ? path.dirname(proj.name.dotCodexFolder || proj.name.file || '') : (cwd ? path.join(cwd, '.codex') : '')
    };
  }

  async function sabt(msg) {
    var k = msg.key, sath = msg.sath, cwd = cwdNow(), codex = codexBin();
    if (!byKey[k]) throw new Error('تنظیمِ ناشناخته: ' + k);
    var p = parse(k, msg.value), v = p.hazf ? null : p.v;
    var nam = p.hazf ? 'خالی (برداشته شد)' : JSON.stringify(v);
    var store = readStore(), pak = 0;
    if (sath === 'chat') {
      if (!CHAT_KEYS[k]) throw new Error('Codex این تنظیم را برای یک چت نمی‌پذیرد؛ فقط سراسری یا پروژه');
      if (!msg.sid) throw new Error('این چت هنوز شروع نشده؛ اول یک پیام بفرست');
      var c = store.chat[msg.sid] || (store.chat[msg.sid] = { cwd: cwd, v: {} });
      if (p.hazf) delete c.v[k]; else c.v[k] = v;
      c.t = Date.now();
      writeStore(store);
      log('chat ' + msg.sid + ' ' + k + '=' + nam);
      return { ok: true, matn: 'ثبت شد برای همین چت: ' + k + ' = ' + nam + '. از پیامِ بعدیِ همین چت اثر می‌کند.' };
    }
    var file = null, w;
    if (sath === 'poshe') {
      if (!cwd) throw new Error('پوشه‌ای باز نیست');
      file = path.join(cwd, '.codex', 'config.toml');
      w = (await H.writeFile(codex, file, [{ keyPath: k, value: v }]))[0] || {};
      // Codex reads a project file only in a folder it trusts; say so instead of a save that silently does nothing
      var bad = await H.rpc(codex, [['config/read', { cwd: cwd, includeLayers: true }]]);
      if (!layer(bad[0] || {}, 'project')) w.naMotabar = true;
    } else if (sath === 'sarasari') {
      w = (await H.rpc(codex, [['config/value/write', { keyPath: k, value: v, mergeStrategy: 'replace', filePath: null, expectedVersion: null }]]))[0] || {};
      // «حتی چتی که مقدار خودش را داشت»: the newer, wider save takes the key back from this folder's project file
      var pf = cwd && path.join(cwd, '.codex', 'config.toml');
      if (pf && fs.existsSync(pf) && /\S/.test(fs.readFileSync(pf, 'utf8'))) await H.writeFile(codex, pf, [{ keyPath: k, value: null }]);
    } else throw new Error('سطحِ ناشناخته');
    Object.keys(store.chat).forEach(function (id) {
      var c = store.chat[id];
      if (c.v && Object.prototype.hasOwnProperty.call(c.v, k) && (sath === 'sarasari' || c.cwd === cwd)) { delete c.v[k]; pak++; }
    });
    if (pak) writeStore(store);
    log(sath + ' ' + (w.filePath || file || 'user') + ' ' + k + '=' + nam + ' status=' + w.status + (pak ? ' chats-cleared=' + pak : ''));
    var matn = 'ثبت شد ' + (sath === 'sarasari' ? 'سراسری' : 'برای پروژه') + ': ' + k + ' = ' + nam + ' در ' + (w.filePath || file);
    if (w.status === 'okOverridden') matn += '. ولی یک لایهٔ دیگر (مثلاً پروژه یا سازمان) رویش نشسته و همان برنده است';
    if (w.naMotabar) matn += '. ولی Codex به این پوشه اعتماد ندارد (trust) و فایلِ پروژه‌اش را نمی‌خواند؛ تا اعتماد ندهی اثری ندارد';
    if (pak) matn += '. از ' + pak + ' چت هم برداشته شد';
    matn += '. چت‌های تازه همین را می‌گیرند؛ چتِ باز ممکن است تا ریلود مقدارِ قبلی را نگه دارد.';
    return { ok: true, matn: matn };
  }

  // the chat's own value goes into each turn/start of that chat; nothing else is touched
  function turn(method, params) {
    if (method !== 'turn/start' || !params || !params.threadId) return params;
    var c = readStore().chat[params.threadId];
    if (!c || !c.v) return params;
    var out = Object.assign({}, params);
    Object.keys(c.v).forEach(function (k) {
      var m = CHAT_KEYS[k];
      if (m) out[m[0]] = m[1](c.v[k]);
    });
    return out;
  }

  globalThis.__crtlCodexTanzimat = {
    // true = the message was ours; replies go straight to that webview, never through Codex's chunked channel
    handle: function (host, webview, r) {
      if (!r || (r.type !== 'crtl-tanzimat-list' && r.type !== 'crtl-tanzimat-sabt')) return false;
      var job = r.type === 'crtl-tanzimat-list' ? list(r) : sabt(r);
      job.then(function (d) {
        webview.postMessage(Object.assign({ type: r.type, reqId: r.reqId }, d));
      }, function (e) {
        var m = String(e && e.message || e);
        log('khata ' + r.type + ' ' + m);
        webview.postMessage(r.type === 'crtl-tanzimat-list' ? { type: r.type, reqId: r.reqId, khata: m } : { type: r.type, reqId: r.reqId, ok: false, matn: m });
      });
      return true;
    },
    turn: turn,
    _test: { parse: parse, list: list, sabt: sabt, readStore: readStore, setCwd: function (f) { cwdNow = f; }, setBin: function (f) { codexBin = f; } }
  };
})();
