/* === CLAUDE-RTL-UI-BUTTONS (injected by fix-rtl-claude.sh) ===
 * Quick-command buttons pinned beside the message input, plus a settings
 * panel that tunes font sizes, collapses noisy blocks, moves or hides the
 * button columns, and lets the command list be edited in place.
 *
 * Everything is stored under localStorage["crtl-sizes"]. The shell script can
 * seed different defaults from ~/.claude-rtl-sizes.json — the "sav" button in
 * the panel copies the current settings in exactly that shape.
 *
 *  ┌──────────────────────────────────────────────┐
 *  │  ADD YOUR OWN BUTTONS IN THE LIST BELOW      │
 *  │  { label: "shown on button",                 │
 *  │    text:  "what gets typed into the chat",   │
 *  │    side:  "left" | "right",                  │
 *  │    send:  true  -> press Enter automatically }│
 *  └──────────────────────────────────────────────┘
 */
(function () {
  // Anything this script throws is captured here so the panel's "تست" button
  // can show it — a silent exception is what "it just stopped working" looks
  // like from the outside.
  var ERRORS = [];
  window.__crtlLoaded = (window.__crtlLoaded || 0) + 1;

  // acquireVsCodeApi() may be called only once per webview, and the app calls
  // it. This inline script runs before the app's module, so wrap it and keep
  // the handle: the glossary card uses it to ask the IDE to open a file.
  if (typeof window.acquireVsCodeApi === 'function' && !window.acquireVsCodeApi.__crtl) {
    var origAcquire = window.acquireVsCodeApi, vsApi = null;
    window.acquireVsCodeApi = function () { return vsApi || (vsApi = origAcquire()); };
    window.acquireVsCodeApi.__crtl = true;
  }
  /* ---------------- this chat's session name ---------------- */
  // The CLI's own messages carry session_id; the latest one seen is this tab's
  // session (it changes after /clear or a resume, hence "latest"). The host
  // hook (claude-host-hook.js) turns it into the short name and the title.
  var SESSION = { sid: '', name: '', title: '', remote: '', card: '', pending: false };
  // the «تنظیمات کلود» tab; outside the panel so its state survives a rebuild of the panel
  var TZ = { tab: 'font', data: null, req: 0, lastList: 0, waiting: {}, rows: null, taze: 0 };
  window.addEventListener('message', function (e) {
    var d = e.data;
    if (!d) return;
    if (d.type === 'crtl-tarjome') {
      if (d.sid === SESSION.sid && window.__crtl_tarjome_resid) window.__crtl_tarjome_resid(d);
      return;
    }
    if (d.type === 'crtl-tanzimat-list') { if (d.reqId === TZ.lastList) tz_resid(d); return; }
    if (d.type === 'crtl-tanzimat-sabt') {
      var tzCb = TZ.waiting[d.reqId];
      if (tzCb) { delete TZ.waiting[d.reqId]; tzCb(d); }
      return;
    }
    if (d.type === 'crtl-tanzimat-taze') { tz_taze_shod(d.channelId); return; }
    if (d.type === 'crtl-session-info') {
      if (d.sid === SESSION.sid) { SESSION.name = d.name || ''; SESSION.title = d.title || ''; SESSION.remote = d.remote || ''; SESSION.card = d.card || ''; SESSION.pending = !!d.pending; neshan_shenase_chat(); }
      return;
    }
    var m = d.type === 'from-extension' && d.message;
    var io = m && m.type === 'io_message' && m.message;
    // the channel the chat's own requests go on: the host finds this chat's engine by it
    if (m && m.type === 'io_message' && m.channelId) SESSION.channel = m.channelId;
    var sid = io && (io.session_id || io.sessionId);
    if (typeof sid === 'string' && /^[0-9a-f-]{36}$/.test(sid)) SESSION.sid = sid;
  });
  // Right after a reload no CLI message has arrived yet, but the app keeps
  // its own sessionID in the tab's vscode state — read it, never write it.
  // vsApi exists only once the app has called acquireVsCodeApi; calling it
  // here first would change the app's start-up order.
  function khandan_shenase_chat_az_state() {
    try {
      var st = vsApi && vsApi.getState ? vsApi.getState() : null;
      var sid = st && st.sessionID;
      return typeof sid === 'string' && /^[0-9a-f-]{36}$/.test(sid) ? sid : '';
    } catch (e) { return ''; }
  }
  function porsidan_shenase_chat() {
    if (!SESSION.sid) SESSION.sid = khandan_shenase_chat_az_state();
    SESSION.name = ''; SESSION.title = ''; SESSION.remote = ''; SESSION.card = ''; SESSION.pending = true;
    neshan_shenase_chat();
    var api = window.acquireVsCodeApi && window.acquireVsCodeApi.__crtl ? window.acquireVsCodeApi() : null;
    if (api && SESSION.sid) api.postMessage({ type: 'crtl-session-info', sid: SESSION.sid });
  }
  function neshan_shenase_chat() {
    [['crtl-sess-title', SESSION.title], ['crtl-sess-remote', SESSION.remote], ['crtl-sess-name', SESSION.name], ['crtl-sess-id', SESSION.sid]].forEach(function (f) {
      var el = document.getElementById(f[0]);
      if (!el) return;
      el.textContent = f[1] || (SESSION.sid && SESSION.pending ? 'در حال خواندن…' :
        f[0] === 'crtl-sess-remote' && SESSION.card ? 'Remote Control خاموش است' : 'نامشخص');
      el.dataset.v = f[1] || '';
      el.title = f[1] || '';
    });
  }

  window.addEventListener('error', function (e) {
    ERRORS.push((e.message || 'error') + ' @ ' + (e.filename || '?') + ':' + (e.lineno || '?'));
    if (ERRORS.length > 6) ERRORS.shift();
  });
  function negahban_khata(name, fn) {
    return function () {
      try { return fn.apply(this, arguments); }
      catch (err) { ERRORS.push(name + ': ' + (err && err.message ? err.message : err)); throw err; }
    };
  }

  var DEFAULT_COMMANDS = [
    { label: "reme",  text: "/remember:remember", side: "right", send: false },
    { label: "comp",  text: "/compact",           side: "right", send: false },
    { label: "use",   text: "/usage",             side: "right", send: false },
    { label: "cont",  text: "/context",           side: "right", send: false },
    { label: "focus", menu: "Focus view",         side: "right" },
    { label: "rew",   menu: "Rewind",             side: "right" },
    { label: "art",   text: "این رو آرتیفکت کن", side: "left",  send: false },
    { label: "rev",   text: "/code-review",       side: "left",  send: false },
    { label: "clr",   text: "/clear",             side: "left",  send: false },
    { label: "btw",   text: "/btw ",              side: "left",  send: false },
    { label: "rc",    text: "/remote-control",    side: "left",  send: false },
    { label: "fast",  text: "/fast",              side: "left",  send: false },
    // side "top" = the header row between the chat name and its icons. A
    // click drops the text on its own line in the composer, never sends.
    { label: "ناظر",   text: "کارایی که میکنی باید با هماهنگی ناظر باشه ها", side: "top", send: false },
    { label: "اسک",    text: "سوالاتو گزارش هات رو با اسک یوزر کوسشن بگو", side: "top", send: false },
    { label: "داستان", text: "الان از اول بگو داستان اصلی چی بود چیکارا کردین و کل داستان رفت و برگشت ها رو به زبون ساده بگو و توی جدول", side: "top", send: false },
    { label: "اعتماد", text: "به هیچ عنوان به حرف مجری اعتماد نکن و همه مواردی که میگه رو خودت توی ترمینال و توی کد چک بخون تا مطمئنش", side: "top", send: false },
    { label: "قانون",  text: "تو کلود ام دی سراسری رو خوندی ؟ طبق قوانینش و مخصوصا قسمت ناظر مجری عمل کن", side: "top", send: false },
    { label: "ایجنت",  text: "--------------------------------\nاین متن نظر یه ایجنت دیگه در مورد کار تو هست ، چک کن ببین درست میگه یا نه چون مسیولیت کار با تو هست نه اون ،اون فقط نظرشو گفت ؟ تو هم فعلا نظرتو بگو فقط ، به زبون ساده همه حرفات باید به زبان ساده با متغیر های من با مثال عددی قیمتی باشه توی جدول تا بفهمم من بگو تا بهت بگم ....", side: "top", send: false },
    { label: "فایده",  text: "به چه دردی میخوره دقیقا و کجا میاد و مفهومش چیه به زبون ساده", side: "top", send: false },
    { label: "سؤال",   text: "برای اینکه مطمین بشی اون چیزی که فهمیدی با اون چیزی که من از تو میخوام دقیقا یکی هست شروع کن یکی یکی سوال پرسیدن از من سوالایی که جوابشون بله و خیر هست و هر\n  سوالی که میپرسی بر اساس جواب قبلی من باشه و این سیستم رو تا جایی ادامه میدی که مطمین شی اون چیزی که من میخوامم با اون چیزی که تو فهمیدی یکی هست", side: "top", send: false },
    { label: "ساده",   text: "نمیفهمم اینو به زبون ساده بگو", side: "top", send: false },
    { label: "واژه",   text: "این واژگان مال من نیست با واژه گان من با من حرف بزن", side: "top", send: false },
    { label: "جدول",   text: "توی جدول با مثال عددی ساده توضیح بده همه چی رو \nاصطلاحات تخصصی توضیح به زبان ساده داخل پرانتز\nدرصدهای قیمتی عدد $ هم نوشته شود", side: "top", send: false },
    { label: "حدس",    text: "مثل اون قابلیتی هست که llm ها دارن حدس میزنه با توجه به درخواست های تا الانم چیا ممکنه بخوام اونارو لیست کن", side: "top", send: false },
    // turn the «حدس» mod on and off (mods/hads)
    { label: "h-on",   text: "/hads on",  side: "top", send: true },
    { label: "h-off",  text: "/hads off", side: "top", send: true }
  ];

  /* ---------------- settings ---------------- */
  var KEY = 'crtl-sizes';
  var DEF = {
    chat: 15, code: 12, chrome: 10, btn: 10,
    hook_font_px: 13,  // the 🪝 hook lines in the chat (Habib: «کمی خیلی ریزن یه کمی درشتتر بشن»)
    fekr_pori_darsad: 75, // how solid the thinking floater is, % (Habib, 8 Nov 18:03: «شفافیتش کم کن … قابل تعیین بکن»)
    hads_pori_darsad: 80, // how solid the «حدس» card is, % (Habib: «میتونی براش ترانسپرنسی هم بزاری»)
    lines: 1,          // 0 = show user messages in full
    side: 'both',      // both | left | right
    hidden: false,
    collapse: true,    // dim/shrink Thinking and tool-call blocks
    tableScroll: true,
    pos: {},           // { left: {x,y}, right: {x,y} } drag offsets
    commands: null,    // null = use DEFAULT_COMMANDS
    seeded: [],        // top labels already merged into a saved list once
    accent: '',        // '' = inherit the theme's own colours
    textColor: '',     // '' = the theme's own conversation text colour
    lh: 16,            // conversation line height, in tenths (16 = 1.6)
    opacity: 65,       // resting opacity of the buttons, in percent
    profiles: {},      // { name: settings snapshot }
    counter: true,     // show the composer character counter
    quoteMenu: true,   // right-click a selection to quote it into the composer
    // ready texts glued on by "copy with extra text": [{ text, on, pos, btn }]
    // on = ticked · pos = 'start' | 'end' · btn = also on the copy button
    // under a reply. List order decides who goes first.
    extras: [],
    extraText: '', extraPos: 'end', extraOnCopyBtn: false  // v2.6.x single text, migrated into extras by khandan_tanzim()
  };
  var LIMITS = { chat: [9, 22], code: [8, 18], chrome: [7, 20], btn: [7, 20], hook_font_px: [9, 20], hads_pori_darsad: [0, 100], fekr_pori_darsad: [0, 100], lh: [11, 24] };
  var PRESETS = {
    compact: { chat: 12, code: 10, chrome: 9,  btn: 9,  hook_font_px: 11, lines: 1, lh: 14 },
    normal:  { chat: 15, code: 12, chrome: 10, btn: 10, hook_font_px: 13, lines: 1, lh: 16 },
    large:   { chat: 19, code: 15, chrome: 12, btn: 12, hook_font_px: 15, lines: 2, lh: 17 }
  };

  // The script can seed defaults by defining window.__CRTL_DEFAULTS before this runs.
  if (window.__CRTL_DEFAULTS) { try { Object.assign(DEF, window.__CRTL_DEFAULTS); } catch (e) {} }

  // Object.assign is shallow, so a settings object built straight from DEF
  // would share DEF's own `pos` and `profiles` objects — dragging a column or
  // saving a profile then wrote into the defaults themselves, and "rst" handed
  // those same polluted objects back. Everything nested gets its own copy.
  function tanzim_pishfarz() {
    var d = Object.assign({}, DEF);
    try { d = JSON.parse(JSON.stringify(d)); } catch (e) { d.pos = {}; d.profiles = {}; }
    if (!d.pos || typeof d.pos !== 'object') d.pos = {};
    if (!d.profiles || typeof d.profiles !== 'object') d.profiles = {};
    return d;
  }

  // names before 25 Oct 2026 (تعریفِ ۱۰ ِ پروژه): a value saved under the old name is read as the new one
  var esm_ghadim_tanzim = { hook: 'hook_font_px', hadsAlpha: 'hads_pori_darsad' };
  function khandan_tanzim() {
    var s;
    try {
      var raw = JSON.parse(localStorage.getItem(KEY) || '{}');
      Object.keys(esm_ghadim_tanzim).forEach(function (ghadim) {
        if (ghadim in raw) { if (!(esm_ghadim_tanzim[ghadim] in raw)) raw[esm_ghadim_tanzim[ghadim]] = raw[ghadim]; delete raw[ghadim]; }
      });
      s = Object.assign(tanzim_pishfarz(), raw);
    }
    catch (e) { s = tanzim_pishfarz(); }
    Object.keys(LIMITS).forEach(function (k) {
      var lo = LIMITS[k][0], hi = LIMITS[k][1];
      if (typeof s[k] !== 'number' || isNaN(s[k])) s[k] = DEF[k];
      s[k] = Math.min(hi, Math.max(lo, s[k]));
    });
    if (!s.pos || typeof s.pos !== 'object') s.pos = {};
    if (!s.profiles || typeof s.profiles !== 'object') s.profiles = {};
    // Profiles seeded from ~/.claude-rtl-sizes.json are the shared base layer,
    // so a profile saved in one IDE shows up in every other one after the next
    // patch run. A local profile with the same name still wins.
    var shared = (DEF.profiles && typeof DEF.profiles === 'object') ? DEF.profiles : {};
    s.profiles = Object.assign({}, shared, s.profiles);
    if (!Array.isArray(s.extras)) s.extras = [];
    // the old single text (also from an older settings file pasted into
    // «اعمال») becomes one ticked row, unless that text is already listed
    var old = String(s.extraText || '').trim();
    if (old) {
      if (!s.extras.some(function (x) { return x && String(x.text || '').trim() === old; }))
        s.extras.push({ text: old, on: true, pos: s.extraPos === 'start' ? 'start' : 'end', btn: !!s.extraOnCopyBtn });
      s.extraText = '';
    }
    gozashtan_dokme_pishfarz_bala(s);
    return s;
  }
  // A list saved before the top row existed never reads DEFAULT_COMMANDS
  // again, so each default top button is appended to it once. `seeded`
  // remembers every label handed over, so one the user deleted stays gone.
  function gozashtan_dokme_pishfarz_bala(s) {
    var seeded = Array.isArray(s.seeded) ? s.seeded.slice() : [];
    var saved = Array.isArray(s.commands) && s.commands.length;
    DEFAULT_COMMANDS.forEach(function (c) {
      if (c.side !== 'top' || seeded.indexOf(c.label) >= 0) return;
      if (saved && !s.commands.some(function (x) { return x && x.label === c.label; }))
        s.commands.push(JSON.parse(JSON.stringify(c)));
      seeded.push(c.label);
    });
    s.seeded = seeded;
    // The list in dokme_ha.json (from the iMac) replaces the saved one when
    // its `nosakhe` is new, so every machine shows the same buttons after a patch.
    var dk = window.__CRTL_DOKME;
    if (dk && Array.isArray(dk.commands) && s.dokme_nosakhe !== dk.nosakhe) {
      s.commands = JSON.parse(JSON.stringify(dk.commands));
      s.seeded = seeded.concat(dk.commands.map(function (c) { return c.label; }));
      s.dokme_nosakhe = dk.nosakhe;
    }
  }
  function esm_profile_moshtarak() {
    return (DEF.profiles && typeof DEF.profiles === 'object') ? Object.keys(DEF.profiles) : [];
  }
  function zakhire_tanzim(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} }
  function dokme_ha(s) {
    if (Array.isArray(s.commands) && s.commands.length) return s.commands;
    return DEFAULT_COMMANDS;
  }

  /* ---------------- injected stylesheet ---------------- */
  var CSS = [
    '.crtl-bar{position:fixed;bottom:2px;z-index:2147483000;display:flex;flex-direction:column;gap:3px;direction:ltr;max-height:70vh;overflow-y:auto;scrollbar-width:none}',
    '.crtl-bar::-webkit-scrollbar{display:none}',
    '.crtl-bar[data-side="right"]{right:4px;align-items:flex-end}',
    '.crtl-bar[data-side="left"]{left:4px;align-items:flex-start}',
    '.crtl-btn{font:var(--crtl-btn-size,10px)/1.3 system-ui,sans-serif;padding:1px 5px;border-radius:4px;',
    'border:1px solid rgba(127,127,127,.35);background:rgba(127,127,127,.14);',
    'color:inherit;cursor:pointer;white-space:nowrap;opacity:var(--crtl-btn-opacity,.65);direction:ltr}',
    '.crtl-btn:hover{opacity:1;background:rgba(127,127,127,.3)}',
    '.crtl-grip{cursor:grab;opacity:.35;letter-spacing:2px}',
    /* message clock: no line of its own; small and faint on the first line of the message, left side */
    '[class*="message_"]:has(>[data-message-stamp]){--message-padding-top:8px !important}',
    '[data-message-stamp]{position:absolute !important;top:calc(var(--message-padding-top,8px) + 2px) !important;left:4px !important;right:auto !important;',
    'padding:0 !important;z-index:2;opacity:.55;font-size:10px;background:var(--vscode-sideBar-background,var(--vscode-editor-background));pointer-events:auto}',
    /* answers have the timeline dot at 9-16px on the left: start after it */
    '[class*="timelineMessage_"]>[data-message-stamp]{left:30px !important}',
    '[data-message-stamp]:not([class*="inPadding_"]){top:calc(var(--message-padding-top,8px) + 6px) !important;left:10px !important}',
    /* hooks in the chat (host hook turns each hook's output into a meta line starting with 🪝):
       folded to one line; a click, or focus view, shows what the hook injected in full */
    /* the plugin panels above the prompt (the «حدس» box): the app root is user-select:none and the
       panel's band never turns it back on, so its text could not be selected (Habib, 24 Oct 22:13:
       «هنوزم این چارچوب حدس متنش قابل انتخاب و کپی پیست نیست»); buttons and inputs stay as they are */
    '[class*="abovePrompt_"] [class*="band_"],[class*="abovePrompt_"] [class*="row_"],[class*="abovePrompt_"] [class*="paneBody_"],[class*="abovePrompt_"] span[class*="text_"]{-webkit-user-select:text!important;user-select:text!important}',
    '[class*="abovePrompt_"] span[class*="text_"]{cursor:text}',
    /* the «حدس» box, macOS style (Habib, 24 Oct 22:37: «رو طراحیش کار بکن … با طراحی مک او اس»):
       a rounded translucent card, SF text, soft shadow; pill buttons; the ticks as a blue/grey
       segmented look; the ask field with the macOS focus ring. Scoped to .crtl-hads (the page
       script tags the box whose header says «hads plugin»), so other plugins keep their look. */
    '.crtl-hads{position:relative;margin:4px 8px 6px!important;border-radius:12px!important;overflow:hidden;background:color-mix(in srgb,var(--vscode-editorWidget-background,#2c2c2e) var(--crtl-hads-pori-darsad,80%),transparent)!important;border:.5px solid rgba(128,128,128,.28)!important;box-shadow:0 8px 24px rgba(0,0,0,.28),0 1px 2px rgba(0,0,0,.2)!important;-webkit-backdrop-filter:blur(var(--crtl-hads-tari-px,16px));backdrop-filter:blur(var(--crtl-hads-tari-px,16px));font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text",Vazirmatn,system-ui,sans-serif}',
    /* compact (24 Oct 22:52: «جمع و جور ترش بکن … ارتفاعش کمتر بشه … فرام ده حدس پلاگین رو با اون دو تا دکمه … تو یک خط»):
       the header line holds ▾ ◂ × too, rows and buttons are tighter */
    '.crtl-hads [data-engine-mark]{background:transparent!important;font-size:10px!important;letter-spacing:.02em;opacity:.5;padding:4px 12px 0!important;min-height:20px;line-height:20px;position:static!important}',
    /* the band is contain:paint — a containing block of its own — so the absolute top row was placed
       against the band (over «پرسش») and clipped; the card must be its box (24 Oct 23:22) */
    '.crtl-hads [class*="band_"],.crtl-hads [class*="row_"]{background:transparent!important;border:none!important;padding:2px 10px 6px!important;margin:0!important}',
    '.crtl-hads [class*="box_"]{row-gap:2px}',
    // «thinking» floats: no box, no background, words only; clicks pass through to the chat
    '#crtl-fekr-shenavar{position:fixed;right:14px;width:38%;min-width:140px;min-height:40px;max-height:80vh;z-index:50;resize:both;overflow:auto;box-sizing:border-box;padding:4px 10px 6px;border-radius:10px;border:.5px solid rgba(128,128,128,.28);box-shadow:0 6px 20px rgba(0,0,0,.3);background:color-mix(in srgb,var(--vscode-editorWidget-background,#2c2c2e) var(--crtl-fekr-pori-darsad,75%),transparent);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);font-family:-apple-system,BlinkMacSystemFont,Vazirmatn,system-ui,sans-serif;font-size:10.5px;line-height:1.5;color:var(--vscode-descriptionForeground,#aaa);text-shadow:0 1px 3px rgba(0,0,0,.55)}',
    '.crtl-hads.crtl-hads-tak-dokme .crtl-fekr-radif{display:none!important}',
    '#crtl-fekr-shenavar .crtl-fekr-dastgire{cursor:move;user-select:none;text-align:center;opacity:.5;font-size:10px;line-height:12px;margin:-2px 0 2px}',
    '#crtl-fekr-shenavar .crtl-fekr-dokme{cursor:pointer;padding:0 6px;font-size:13px}#crtl-fekr-shenavar .crtl-fekr-dokme:hover{opacity:1;color:var(--vscode-foreground,#fff)}#crtl-fekr-shenavar .crtl-fekr-shomare{font-variant-numeric:tabular-nums}',
    '#crtl-fekr-shenavar .crtl-fekr-kalame{opacity:0;display:inline-block;white-space:pre;animation:crtl-fekr-biya .5s ease-out forwards}',
    '@keyframes crtl-fekr-biya{from{opacity:0;transform:translateY(4px);filter:blur(3px)}to{opacity:.85;transform:none;filter:none}}',
    '.crtl-hads span[class*="text_"]{line-height:1.45}',
    '.crtl-hads button[class*="button"]{border-radius:6px!important;border:.5px solid rgba(128,128,128,.32)!important;background:rgba(128,128,128,.16)!important;color:inherit!important;padding:0 8px!important;font-size:11px!important;line-height:1.5!important;box-shadow:0 .5px 0 rgba(0,0,0,.25);transition:background .15s,opacity .15s}',
    '.crtl-hads button[class*="button"]:hover{background:rgba(128,128,128,.28)!important}',
    '.crtl-hads button.crtl-tik-roshan{background:#0a84ff!important;color:#fff!important;border-color:transparent!important}',
    '.crtl-hads button.crtl-tik-khamush{opacity:.55}',
    '.crtl-hads .crtl-hads-radif-bala{position:sticky!important;top:0;z-index:3;display:flex;direction:ltr;justify-content:flex-start;gap:4px;padding:0!important;margin:0!important;background:transparent;pointer-events:none}',
    '.crtl-hads .crtl-hads-radif-bala button{pointer-events:auto}',
    // the header «From the hads plugin» leaves the flow and sits on the top row's line (right side),
    // so ▾ ◂ × and it share one line while the band keeps its own scroll
    // on the left, right after ▾ ×: on the right it sat on top of «جمع‌بندی:» (25 Oct 02:29, پنلِ ۲۰۵)
    '.crtl-hads:has(.crtl-hads-radif-bala) [data-engine-mark]{position:absolute!important;top:7px;left:76px;right:auto!important;z-index:2;margin:0!important;pointer-events:none;white-space:nowrap}',
    /* the third state: just one small button, on the left (24 Oct 22:52: «فقط سمت چپ … یک دکمه») */
    '.crtl-hads.crtl-hads-tak-dokme{width:max-content!important;margin:2px auto 4px 8px!important;border-radius:8px!important;box-shadow:0 2px 8px rgba(0,0,0,.25)!important}',
    '.crtl-hads.crtl-hads-tak-dokme [data-engine-mark]{display:none!important}',
    '.crtl-hads.crtl-hads-tak-dokme [class*="band_"],.crtl-hads.crtl-hads-tak-dokme [class*="row_"]{padding:3px!important}',
    '.crtl-hads button.crtl-gozashtan-dar-kadr{border-radius:50%!important;padding:0 6px!important;min-width:0}',
    '.crtl-hads input[class*="input_"]{border-radius:7px!important;border:.5px solid rgba(128,128,128,.42)!important;background:rgba(0,0,0,.16)!important;padding:0 8px!important;height:22px;min-width:14em;outline:none!important;transition:box-shadow .15s}',
    '.crtl-hads input[class*="input_"]:focus{border-color:#0a84ff!important;box-shadow:0 0 0 3px rgba(10,132,255,.4)!important}',
    /* the ticks are dragged to reorder the parts; the field the new order goes through is never seen */
    '.crtl-hads button[data-press-key^="hads-tick-"]{cursor:grab;-webkit-user-select:none!important;user-select:none!important;-webkit-user-drag:none}',
    '.crtl-hads button.crtl-dragging{position:relative;z-index:5;pointer-events:none;opacity:.85;box-shadow:0 4px 12px rgba(0,0,0,.35)!important;cursor:grabbing}',
    /* where the dragged tick will land: a blue bar on that side of the tick under the pointer */
    '.crtl-hads button.crtl-jaye-ghabl{box-shadow:inset -3px 0 0 #0a84ff!important}',
    '.crtl-hads button.crtl-jaye-baad{box-shadow:inset 3px 0 0 #0a84ff!important}',
    '.crtl-hads form:has(input[data-press-key="hads-tartib"]){display:none!important}',
    /* like a message from another session (26 Oct 05:36: «اینم فرمتش مثل همون دو تا بشه»): grey, italic */
    '[class*="metaMessage_"].crtl-hook-says{display:none!important}',
    '[class*="metaMessage_"].crtl-hook{font-style:italic;color:var(--app-secondary-foreground);cursor:pointer;opacity:.8;padding:3px 8px}',
    /* the chat-size rules below set every p/[class*=markdown] in the chat with !important, so the
       hook size must reach the line and everything in it with !important too (Habib: «با عوض کردنش هیچ چیز عوض نمیشه») */
    '[class*="messagesContainer_"] [class*="metaMessage_"].crtl-hook,[class*="messagesContainer_"] [class*="metaMessage_"].crtl-hook *{font-size:var(--crtl-hook-font-px,13px)!important;line-height:1.45!important}',
    /* folded like «Thought for Ns»: one line whatever the focus view, opened only by a click
       (Habib, 24 Oct 22:55: «میخواستم که جمع باشه … اگه روش بزنیم همون هوکه باز بشه») */
    '[class*="metaMessage_"].crtl-hook:not(.crtl-hook-baz){max-height:1.9em!important;overflow:hidden!important}',
    '[class*="metaMessage_"].crtl-hook:not(.crtl-hook-baz),[class*="metaMessage_"].crtl-hook:not(.crtl-hook-baz) *{white-space:nowrap!important;overflow:hidden;text-overflow:ellipsis}',
    '[class*="metaMessage_"].crtl-hook::before{content:"▸ ";opacity:.6}',
    '[class*="metaMessage_"].crtl-hook.crtl-hook-baz::before{content:"▾ "}',
    /* the header row: one line, scrolls sideways, never pushes the chat name or icons out */
    '[class*="headerSpacer_"].crtl-top-host{min-width:0;overflow:hidden;display:flex;align-items:center}',
    '.crtl-bar.crtl-top{position:static;flex-direction:row;align-items:center;max-height:none;min-width:0;flex:1;',
    'overflow-x:auto;overflow-y:hidden;direction:rtl;margin:0 4px}',
    '.crtl-top .crtl-btn{direction:rtl;flex-shrink:0}',
    '#crtl-top-jaygozin{position:fixed;top:0;left:0;right:0;z-index:20;display:flex;padding:4px 8px;background:var(--vscode-editor-background)}',
    '.crtl-top .crtl-btn.crtl-dragging{opacity:1;outline:1px dashed currentColor}',
    '.crtl-grip:active{cursor:grabbing}',
    /* the settings panel keeps its own lane, offset from the button columns */
    '.crtl-panel{position:fixed;bottom:2px;z-index:2147483002;display:none;flex-direction:column;gap:4px;',
    'direction:rtl;text-align:right;background:var(--app-input-background,rgba(30,30,30,.97));',
    'border:1px solid rgba(127,127,127,.4);border-radius:6px;padding:8px;width:230px;',
    'max-height:80vh;overflow-y:auto;font:11px/1.5 system-ui,sans-serif;box-shadow:0 4px 18px rgba(0,0,0,.45)}',
    '.crtl-panel[data-side="right"]{right:52px}',
    '.crtl-panel[data-side="left"]{left:52px}',
    '.crtl-panel.crtl-open{display:flex}',
    /* an open panel shrinks the conversation instead of sitting on top of it */
    /* the panel is fixed to one physical edge, so the room has to be made on
       that same edge — and for the composer too, or the chat narrows while the
       input stays full width and the gap reads as a broken layout. Padding on
       the composer *container* shifts the input and its mirror together, so the
       two layers stay aligned. */
    'html.crtl-panel-right [class*="messagesContainer_"],html.crtl-panel-right [class*="messageInputContainer_"]{padding-right:244px!important}',
    'html.crtl-panel-left [class*="messagesContainer_"],html.crtl-panel-left [class*="messageInputContainer_"]{padding-left:244px!important}',
    /* the question window fills the chat's width and gets taller; the bottom box's 680px limit stays for typing.
       The count table sits on that corner, so it hides while a question is open
       (Habib, 4 Nov 20:10: «پنجره سوال ... عرض صفحه رو کامل پر بکنه که ... بزرگتر باشه») */
    '[class*="inputContainer_"]:has([class*="questionsContainer_"]){max-width:none!important;left:8px!important;right:8px!important;margin:0!important}',
    '[class*="permissionsContainer_"]:has([class*="questionsContainer_"]){max-width:none!important}',
    '[class*="permissionRequestContainer_"]:has([class*="questionsContainer_"]){max-height:85vh!important}',
    '[class*="questionsContainer_"]{max-height:60vh!important}',
    '[class*="withPreview_"]>[class*="previewPane_"]{max-height:60vh!important}',
    'html:has([class*="questionsContainer_"]) #crtl-amar{display:none!important}',
    /* the question window's words can be selected and copied; the app makes everything unselectable
       (Habib, 5 Nov 02:34: «سوال و قسمت های جواب و جدول اون سوال باز شده قابل انتحاب و کپی کردن باششه متنشون») */
    '[class*="questionsContainer_"],[class*="questionsContainer_"] *,[class*="previewPane_"],[class*="previewPane_"] *{-webkit-user-select:text!important;user-select:text!important}',
    '[class*="questionsContainer_"] [class*="optionLabel_"],[class*="questionsContainer_"] [class*="optionDescription_"]{cursor:text}',
    '[class*="questionsContainer_"] [tabindex="-1"]{outline:none}',
    /* the two tabs of the aA panel */
    '.crtl-tabs{display:flex;gap:4px;flex-shrink:0;position:sticky;top:-8px;z-index:2;margin:-8px -8px 4px;padding:8px 8px 4px;background:var(--app-input-background,rgba(30,30,30,.97))}',
    '.crtl-tabs button{flex:1;padding:2px 6px;background:rgba(127,127,127,.12);border:1px solid rgba(127,127,127,.3);border-radius:4px;color:inherit;font:inherit;cursor:pointer}',
    '.crtl-tabs button[aria-selected="true"]{background:var(--vscode-button-background,#0a84ff);color:var(--vscode-button-foreground,#fff);border-color:transparent}',
    '.crtl-panel.crtl-panel-pahn{width:min(520px,calc(100vw - 70px));box-sizing:border-box}',
    '@media(min-width:900px){html.crtl-tab-claude.crtl-panel-right [class*="messagesContainer_"]{padding-right:530px!important}',
    'html.crtl-tab-claude.crtl-panel-left [class*="messagesContainer_"]{padding-left:530px!important}',
    /* the typing box is a centered 680px box: padding inside it would squeeze the typing area to nothing, so the box itself steps aside */
    'html.crtl-tab-claude [class*="messageInputContainer_"]{padding-left:0!important;padding-right:0!important}',
    'html.crtl-tab-claude.crtl-panel-left [class*="chatContainer_"]>[class*="inputContainer_"]{margin-left:580px!important;margin-right:8px!important}',
    'html.crtl-tab-claude.crtl-panel-right [class*="chatContainer_"]>[class*="inputContainer_"]{margin-right:580px!important;margin-left:8px!important}}',
    '#crtl-page-claude{flex-direction:column;gap:4px;min-width:0}',
    '.crtl-tz-head-baz{cursor:pointer}' +
    '.crtl-tz-head-baz .crtl-tz-fa::after{content:" ؟";opacity:.55}' +
    '.crtl-tz-tozih{font-size:.92em;line-height:1.7;padding:6px 8px;margin:4px 0;background:rgba(127,127,127,.14);border-radius:6px;user-select:text;overflow-wrap:anywhere}' +
    '.crtl-tz-search{width:100%;box-sizing:border-box;background:rgba(127,127,127,.15);border:1px solid rgba(127,127,127,.35);border-radius:4px;color:inherit;padding:3px 6px;font:inherit}',
    '.crtl-tz-row{display:flex;flex-direction:column;gap:2px;padding:5px 0;border-bottom:1px solid rgba(127,127,127,.2);min-width:0;flex-shrink:0}',
    '.crtl-tz-head{display:flex;gap:6px;justify-content:space-between;align-items:baseline;min-width:0}',
    '.crtl-tz-fa{flex:1;min-width:0}',
    '.crtl-tz-en{flex:none;max-width:45%;direction:ltr;opacity:.5;font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.crtl-tz-note{opacity:.9;font-size:11px;line-height:1.6;min-height:1.4em;overflow-wrap:anywhere}',
    '.crtl-tz-line{display:flex;flex-wrap:wrap;align-items:center;gap:6px;min-width:0}',
    '.crtl-tz-ticks{display:flex;gap:6px;flex:none}',
    '.crtl-tz-ticks label{display:flex;align-items:center;gap:2px;cursor:pointer;white-space:nowrap}',
    '.crtl-tz-ticks input{margin:0}',
    '.crtl-tz-kontrol{flex:1;min-width:110px;box-sizing:border-box;background:rgba(127,127,127,.15);border:1px solid rgba(127,127,127,.35);border-radius:4px;color:inherit;padding:1px 4px;font:inherit}',
    '.crtl-panel textarea.crtl-tz-kontrol{flex:1 1 100%;width:100%;height:64px;font:10px/1.4 monospace}',
    '.crtl-tz-sabt{flex:none}',
    '.crtl-tz-sabt:disabled{opacity:.4;cursor:default}',
    '.crtl-tz-hint{opacity:.75;font-size:10px}',
    '.crtl-tz-popup{position:fixed;inset:0;z-index:5;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.4)}',
    '.crtl-tz-box{max-width:min(420px,calc(100vw - 40px));display:flex;flex-direction:column;gap:10px;padding:14px 16px;border-radius:8px;border:1px solid rgba(127,127,127,.5);background:var(--app-input-background,rgba(30,30,30,.98));font:12px/1.7 system-ui,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.6)}',
    '.crtl-tz-box .crtl-actions{justify-content:flex-start}',
    '.crtl-row{display:flex;align-items:center;gap:6px;justify-content:space-between;flex-shrink:0}',
    '.crtl-row label{flex:0 0 auto;opacity:.75}',
    '.crtl-row input[type=range]{flex:1;min-width:0;direction:ltr}',
    '.crtl-row input[type=number]{width:44px;direction:ltr;text-align:center;',
    'background:rgba(127,127,127,.15);border:1px solid rgba(127,127,127,.35);border-radius:4px;color:inherit}',
    '.crtl-row select{flex:1;background:rgba(127,127,127,.15);border:1px solid rgba(127,127,127,.35);',
    'border-radius:4px;color:inherit;padding:1px 3px}',
    '.crtl-sep{height:1px;background:rgba(127,127,127,.25);margin:3px 0}',
    '.crtl-panel textarea{width:100%;height:110px;flex-shrink:0;box-sizing:border-box;direction:ltr;text-align:left;font:10px/1.4 monospace;',
    'background:rgba(127,127,127,.12);border:1px solid rgba(127,127,127,.35);border-radius:4px;color:inherit}',
    '.crtl-note{opacity:.55;font-size:10px}',
    '.crtl-actions{display:flex;gap:4px;flex-wrap:wrap;flex-shrink:0}',
    '.crtl-hit{background:rgba(255,200,0,.35)!important;border-radius:2px}',
    '#crtl-count{opacity:.5;font-size:10px;padding:0 4px;white-space:nowrap;direction:rtl}',
    '#crtl-ctx{position:fixed;z-index:2147483004;display:none;flex-direction:column;min-width:150px;',
    'background:var(--app-input-background,rgba(30,30,30,.98));border:1px solid rgba(127,127,127,.4);',
    'border-radius:6px;padding:3px;direction:rtl;text-align:right;font:11px/1.6 system-ui,sans-serif;',
    'box-shadow:0 6px 22px rgba(0,0,0,.5)}',
    '#crtl-ctx button{background:none;border:0;color:inherit;text-align:right;padding:4px 8px;',
    'border-radius:4px;cursor:pointer;font:inherit;white-space:nowrap}',
    '#crtl-ctx button:hover{background:rgba(127,127,127,.28)}'
  ].join('');

  function emal_andaze_va_rang(s) {
    var el = document.getElementById('crtl-size-style');
    if (!el) {
      el = document.createElement('style');
      el.id = 'crtl-size-style';
      document.head.appendChild(el);
    }
    // accent lands inside a stylesheet, so only a plain hex colour goes
    // through: anything else could close the rule and append its own
    function hex(v) { return /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(v || '') ? v : ''; }
    var accent = hex(s.accent);
    var ink = hex(s.textColor);
    var lh = (s.lh / 10).toFixed(2);
    var msg = '[class*="messagesContainer_"]';
    var out = [
      ':root{--crtl-btn-size:' + s.btn + 'px;--crtl-btn-opacity:' + (s.opacity / 100) + ';--crtl-hook-font-px:' + (s.hook_font_px || 13) + 'px;--crtl-hads-pori-darsad:' + (s.hads_pori_darsad == null ? 80 : s.hads_pori_darsad) + '%;--crtl-fekr-pori-darsad:' + (s.fekr_pori_darsad == null ? 75 : s.fekr_pori_darsad) + '%;--crtl-hads-tari-px:' + Math.round((s.hads_pori_darsad == null ? 80 : s.hads_pori_darsad) / 5) + 'px}',
      accent ? '.crtl-btn{border-color:' + accent + '!important;color:' + accent + '!important}' : '',
      accent ? '.crtl-panel{border-color:' + accent + '!important}' : '',
      // the conversation ink follows the theme unless a colour is picked; code
      // keeps its own highlighting, so it is left out on purpose
      ink ? msg + ',' + msg + ' p,' + msg + ' li,' + msg + ' span:not(pre span),' + msg + ' strong,' + msg + ' b,' +
            msg + ' h1,' + msg + ' h2,' + msg + ' h3,' + msg + ' h4,' + msg + ' td,' + msg + ' th' +
            '{color:' + ink + '!important}' : '',
      msg + '{font-size:' + s.chat + 'px!important;line-height:' + lh + '!important}',
      msg + ' p,' + msg + ' li,' + msg + ' [class*="markdown"]{font-size:' + s.chat + 'px!important;line-height:' + lh + '!important}',
      msg + ' pre,' + msg + ' code,' + msg + ' table{font-size:' + s.code + 'px!important;line-height:1.5!important}',
      // Headings and their margins are em-based upstream, so raising the chat
      // size blew the gaps up with it. Cap them and tighten the rhythm.
      msg + ' h1,' + msg + ' h2,' + msg + ' h3,' + msg + ' h4,' + msg + ' h5{' +
        'font-size:' + (s.chat + 2) + 'px!important;line-height:1.35!important;' +
        'margin:0.55em 0 0.25em!important;padding:0!important}',
      msg + ' p,' + msg + ' ul,' + msg + ' ol{margin:0.3em 0!important}',
      msg + ' li{margin:0.1em 0!important}',
      msg + ' li>p{margin:0!important}',
      msg + ' hr{margin:0.5em 0!important}',
      msg + ' blockquote{margin:0.4em 0!important}',
      msg + ' pre{margin:0.4em 0!important}',
      msg + ' table{margin:0.4em 0!important}',
      '[class*="headerTitle"],[class*="footer"],[class*="Footer"],[class*="statusBar"],[class*="toolbar"],[class*="Toolbar"],[class*="badge"],[class*="Badge"]{font-size:' + s.chrome + 'px!important}'
    ];

    // user messages: clamp to N lines, expanded by hover or by click
    // The visible text sits in .content_* inside .expandableContainer_*, and the
    // app gives that element an inline max-height. Clamping the outer
    // .userMessage_ only counted one block child, so "1 line" still showed the
    // app's own two — the clamp has to land on .content_ and beat the inline
    // max-height, which !important does.
    var inner = '[class*="userMessage_"]:not(.crtl-expanded) [class*="content_"]';
    if (s.lines > 0) {
      // only sideways: the app's own up-down scroll stays (the pinned message on top has
      // max-height:40vh and scrolls; hook lines under a message are not clamped, so a hidden
      // overflow cut them with no way to reach the rest — 25 Oct 00:09)
      out.push('[class*="userMessage_"]:not(.crtl-expanded){overflow-x:hidden!important}');
      out.push(inner + '{display:-webkit-box!important;-webkit-line-clamp:' + s.lines +
        '!important;-webkit-box-orient:vertical!important;overflow:hidden!important;max-height:none!important}');
      out.push('[class*="userMessage_"]:not(.crtl-expanded) [class*="truncationGradient"]{display:none!important}');
      out.push('[class*="userMessage_"]:not(.crtl-expanded).crtl-hovered [class*="content_"]' +
        '{-webkit-line-clamp:unset!important;display:block!important;max-height:none!important}');
    } else {
      out.push('[class*="userMessage_"] [class*="content_"]{display:block!important;' +
        '-webkit-line-clamp:unset!important;max-height:none!important}');
    }

    // a message from another session or from a plugin (the «خودکار» of the hads mod) keeps a look of its own, the
    // panel's peer-message row: no box, grey, italic; one line, all of it under the mouse (Habib, 26 Oct 05:31:
    // «اگه فرمت خاص تر داشته باشه بهتره مثل پیامای خودم نباشه قبلا پیامای سشن های دیگه یه فرمتی داشت که که خوب
    // بود … برش گردون به همون حالت قبل و همین خودکار رو هم مثل فرمت همون بکنش»). Marked by neshan_hook_va_hads
    out.push('[class*="userMessage_"].crtl-payam-digar{border-color:transparent!important;background:transparent!important;' +
      'color:var(--app-secondary-foreground)!important;opacity:.8;font-style:italic!important;padding:8px!important}');
    // the app's «Show less» button is not shown: the message opens under the mouse and closes when it leaves (26 Oct 18:30)
    out.push('[class*="collapseButton_"]{display:none!important}');
    out.push('[class*="userMessage_"].crtl-payam-digar.crtl-hovered{opacity:1;max-height:none!important;overflow-y:visible!important}');
    // Habib's own too: the message pinned on top keeps the app's 40vh cap, which cut it under the mouse (27 Oct 16:03:
    // «وقتی به پیام خودم هستم چند ثانیه نگه میدارم، باید پیامش کامل باز بشه مثل قبل»)
    out.push('[class*="userMessage_"].crtl-hovered{max-height:none!important;overflow-y:visible!important}');
    // the hads mod's message, closed: one line, the paragraphs run on, ▸ in front; open (a click): all of it, ▾
    var hb = '[class*="userMessage_"].crtl-payam-hads:not(.crtl-hads-baz)';
    out.push(hb + '{max-height:2.2em!important;overflow:hidden!important;cursor:pointer}');
    out.push(hb + ' [class*="content_"]{display:block!important;-webkit-line-clamp:unset!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;max-height:1.6em!important}');
    out.push(hb + ' [class*="content_"] *{display:inline!important;white-space:nowrap!important}');
    out.push(hb + ' [class*="content_"] br{display:none!important}');
    out.push(hb + ' [class*="content_"] p::after,' + hb + ' [class*="content_"] li::after{content:" "}');
    out.push('[class*="userMessage_"].crtl-payam-hads [class*="content_"]::before{content:"▸ ";opacity:.6}');
    out.push('[class*="userMessage_"].crtl-payam-hads.crtl-hads-baz{max-height:none!important;overflow-y:visible!important;cursor:pointer}');
    out.push('[class*="userMessage_"].crtl-payam-hads.crtl-hads-baz [class*="content_"]{display:block!important;-webkit-line-clamp:unset!important;max-height:none!important}');
    out.push('[class*="userMessage_"].crtl-payam-hads.crtl-hads-baz [class*="content_"]::before{content:"▾ "}');

    // wide content scrolls inside its own box instead of stretching the page
    if (s.tableScroll) {
      out.push('[class*="messagesContainer_"] table{display:block!important;max-width:100%!important;overflow-x:auto!important;white-space:nowrap!important}');
      out.push('[class*="messagesContainer_"] pre{max-width:100%!important;overflow-x:auto!important}');
      out.push('[class*="messagesContainer_"] pre code{white-space:pre!important}');
    }

    // Thinking / tool-call chatter shrinks out of the way until hovered
    if (s.collapse) {
      // actually fold the block down to a couple of lines; hover or the
      // per-block toggle opens it again
      var noisy = '[class*="thinking"],[class*="Thinking"],[class*="toolCall"],[class*="ToolCall"]';
      out.push(noisy.split(',').map(function (x) { return x + ':not(.crtl-open-block)'; }).join(',') +
        '{max-height:' + (s.chrome * 2.6).toFixed(0) + 'px!important;overflow:hidden!important;opacity:.45!important;' +
        'font-size:' + Math.max(8, s.chrome - 1) + 'px!important;cursor:zoom-in}');
      out.push(noisy.split(',').map(function (x) { return x + ':not(.crtl-open-block):hover'; }).join(',') +
        '{max-height:none!important;opacity:1!important}');
      out.push('.crtl-open-block{max-height:none!important;opacity:1!important}');
    }

    if (s.hidden) out.push('.crtl-bar{display:none!important}');

    el.textContent = out.join('\n');
  }

  /* ---------------- composer helpers ---------------- */
  function kadr_tayp() {
    return document.querySelector('[aria-label="Message input"]')
        || document.querySelector('textarea')
        || document.querySelector('[contenteditable="true"]');
  }

  // The composer is a contenteditable that treats a newline as its own editing
  // operation: its keydown handler runs execCommand("insertLineBreak") for
  // Shift+Enter. A "\n" smuggled inside one insertText call is not a line
  // break to it, so a quote followed by typing ended up glued onto the quote's
  // last line. Text goes in the same way the app puts it in: caret at the end,
  // plain runs through insertText, every newline through insertLineBreak.
  function bordan_cursor_be_akhar(el) {
    var sel = window.getSelection();
    if (!sel) return;
    var r = document.createRange();
    r.selectNodeContents(el);
    r.collapse(false);
    sel.removeAllRanges();
    sel.addRange(r);
  }

  function gozashtan_khat_ha_dar_kadr(text) {
    var parts = String(text).replace(/\r\n?/g, '\n').split('\n');
    parts.forEach(function (run, i) {
      if (i > 0) document.execCommand('insertLineBreak');
      if (run) document.execCommand('insertText', false, run);
    });
  }

  function neveshtan_dar_kadr(el, text) {
    el.focus();
    if (el.isContentEditable) { bordan_cursor_be_akhar(el); gozashtan_khat_ha_dar_kadr(text); return; }
    var proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement : HTMLInputElement;
    Object.getOwnPropertyDescriptor(proto.prototype, 'value').set
      .call(el, (el.value ? el.value + ' ' : '') + text);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }

  // Top-row texts are whole sentences: each one starts on its own line
  // instead of being glued to whatever is already in the composer.
  function gozashtan_khat_dar_kadr(el, text) {
    el.focus();
    if (el.isContentEditable) {
      bordan_cursor_be_akhar(el);
      if ((el.textContent || '').trim()) document.execCommand('insertLineBreak');
      gozashtan_khat_ha_dar_kadr(text);
      return;
    }
    var proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement : HTMLInputElement;
    Object.getOwnPropertyDescriptor(proto.prototype, 'value').set
      .call(el, (el.value.trim() ? el.value + '\n' : '') + text);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function zadan_kelid(el, key, code) {
    ['keydown', 'keypress', 'keyup'].forEach(function (t) {
      el.dispatchEvent(new KeyboardEvent(t, {
        key: key, code: key, keyCode: code, which: code, bubbles: true, cancelable: true
      }));
    });
  }
  // A slash command first takes Tab, so the command menu puts the word in
  // (Habib 30 Oct: «قبل از اینتر یه دکمه تب هم بزنی که کلمه بشینه»), then Enter.
  function ferestadan_payam(el, slash) {
    if (!slash) { zadan_kelid(el, 'Enter', 13); return; }
    zadan_kelid(el, 'Tab', 9);
    setTimeout(function () { zadan_kelid(el, 'Enter', 13); }, 80);
  }

  function jaygozini_matn_kadr(el, v) {
    el.focus();
    if (el.isContentEditable) {
      document.execCommand('selectAll', false, null);
      if (v) gozashtan_khat_ha_dar_kadr(v);
      else document.execCommand('delete', false, null);
      return;
    }
    var proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement : HTMLInputElement;
    Object.getOwnPropertyDescriptor(proto.prototype, 'value').set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }

  // Open the actions menu ("/") and click an item by its label, then clean up.
  function click_menu(label) {
    function hit() {
      var nodes = document.querySelectorAll('[role="option"],[role="menuitem"],button,li,div');
      for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        if (n.children.length > 2) continue;
        var t = (n.textContent || '').trim();
        if (t === label || t === label + '…' || t.indexOf(label) === 0) { n.click(); return true; }
      }
      return false;
    }
    if (hit()) return;
    var el = kadr_tayp();
    if (!el) return;
    function read() { return (el.isContentEditable ? el.textContent : el.value) || ''; }
    var before = read();
    jaygozini_matn_kadr(el, '/');
    setTimeout(function () {
      hit();
      setTimeout(function () {
        // Only clean up our own "/" — a menu item such as "Add selection"
        // writes into the composer itself, and restoring `before` on top of
        // that threw the item's own text away.
        var now = read();
        if (now === '/' || now === '') jaygozini_matn_kadr(el, before);
      }, 120);
    }, 350);
  }

  /* ---------------- small DOM helpers ---------------- */
  function sakht_dokme(label, title, onClick, cls) {
    var b = document.createElement('button');
    b.className = 'crtl-btn' + (cls ? ' ' + cls : '');
    b.type = 'button';
    b.textContent = label;
    b.title = title;
    b.addEventListener('click', function (e) { e.preventDefault(); onClick(e); });
    return b;
  }

  function sakht_radif(labelText, control) {
    var r = document.createElement('div');
    r.className = 'crtl-row';
    var l = document.createElement('label');
    l.textContent = labelText;
    r.appendChild(l);
    r.appendChild(control);
    return r;
  }

  // a slider and a number box that stay in sync and share one commit path
  function radif_andaze(labelText, field, s, onChange) {
    var lo = LIMITS[field][0], hi = LIMITS[field][1];
    var wrap = document.createElement('div');
    wrap.className = 'crtl-row';
    var l = document.createElement('label');
    l.textContent = labelText;
    var range = document.createElement('input');
    range.type = 'range'; range.min = lo; range.max = hi; range.value = s[field];
    var num = document.createElement('input');
    num.type = 'number'; num.min = lo; num.max = hi; num.value = s[field];
    function commit(v) {
      // 0 is a real value (the «حدس» card fully see-through), not «empty»: only a non-number falls back
      var n = parseInt(v, 10);
      v = Math.min(hi, Math.max(lo, isNaN(n) ? DEF[field] : n));
      range.value = v; num.value = v;
      onChange(field, v);
    }
    range.addEventListener('input', function () { commit(range.value); });
    num.addEventListener('change', function () { commit(num.value); });
    wrap.appendChild(l); wrap.appendChild(range); wrap.appendChild(num);
    return wrap;
  }

  /* ---------------- hover-intent on user messages ---------------- */
  // A plain :hover opened a collapsed message the instant the pointer crossed
  // it on the way somewhere else. The message now opens only after the pointer
  // has rested on it for HOVER_DELAY ms, and closes as soon as it leaves.
  var HOVER_DELAY = 700;
  function baz_shodan_ba_hover() {
    if (document.__crtlHoverWired) return;
    document.__crtlHoverWired = true;
    var timer = null, pending = null;
    function msgOf(node) {
      while (node && node !== document.body) {
        if (typeof node.className === 'string' && node.className.indexOf('userMessage_') !== -1) return node;
        node = node.parentNode;
      }
      return null;
    }
    document.addEventListener('mouseover', function (e) {
      var m = msgOf(e.target);
      if (m === pending) return;
      clearTimeout(timer);
      if (pending && pending !== m) pending.classList.remove('crtl-hovered');
      pending = m;
      if (m) timer = setTimeout(function () { m.classList.add('crtl-hovered'); }, HOVER_DELAY);
    }, true);
  }

  /* ---------------- click-to-expand on user messages ---------------- */
  function baz_kardan_payam() {
    if (document.__crtlExpandWired) return;
    document.__crtlExpandWired = true;
    document.addEventListener('click', function (e) {
      var s = khandan_tanzim();
      if (!s.lines) return;
      // A click meant for a link, a button or a text selection must reach the
      // app untouched — swallowing it stole the first click on anything
      // interactive inside your own message.
      if (e.target.closest && e.target.closest('a,button,input,textarea,select,[role="button"],[contenteditable="true"]')) return;
      var sel = window.getSelection();
      if (sel && String(sel).length) return;
      var node = e.target;
      while (node && node !== document.body) {
        if (node.className && typeof node.className === 'string' &&
            node.className.indexOf('userMessage_') !== -1) {
          // the hads mod's message has its own click (▸ / ▾, neshan_hook_va_hads)
          if (node.classList.contains('crtl-payam-hads')) return;
          if (!node.classList.contains('crtl-expanded')) {
            // first click only opens the message; the app's own click handler
            // still works on the second click
            node.classList.add('crtl-expanded');
            e.stopPropagation();
            e.preventDefault();
          } else {
            node.classList.remove('crtl-expanded');
          }
          return;
        }
        node = node.parentNode;
      }
    }, true);
  }

  // Clicking a folded Thinking/tool-call block pins it open.
  function jam_kardan_fekr_va_abzar() {
    if (document.__crtlBlocksWired) return;
    document.__crtlBlocksWired = true;
    document.addEventListener('click', function (e) {
      if (!khandan_tanzim().collapse) return;
      var n = e.target;
      while (n && n !== document.body) {
        var c = typeof n.className === 'string' ? n.className : '';
        if (/thinking|Thinking|toolCall|ToolCall/.test(c)) {
          n.classList.toggle('crtl-open-block');
          return;
        }
        n = n.parentNode;
      }
    }, false);
  }

  /* ---------------- find in conversation ---------------- */
  function navar_jostojo() {
    var old = document.getElementById('crtl-find');
    if (old) { old.remove(); pak_kardan_neshane(); return; }
    var box = document.createElement('div');
    box.id = 'crtl-find';
    box.className = 'crtl-panel crtl-open';
    box.style.cssText = 'width:220px;top:8px;bottom:auto;left:50%;transform:translateX(-50%);right:auto';
    var inp = document.createElement('input');
    inp.type = 'text';
    inp.placeholder = 'جست‌وجو در گفتگو…';
    inp.style.cssText = 'width:100%;direction:rtl;background:rgba(127,127,127,.15);' +
      'border:1px solid rgba(127,127,127,.35);border-radius:4px;color:inherit;padding:2px 4px';
    var info = document.createElement('div');
    info.className = 'crtl-note';
    var idx = 0, hits = [];
    function run() {
      pak_kardan_neshane();
      hits = [];
      idx = 0;
      var q = inp.value.trim();
      if (!q) { info.textContent = ''; return; }
      var root = document.querySelector('[class*="messagesContainer_"]');
      if (!root) return;
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
      var node;
      while ((node = walker.nextNode())) {
        if (node.nodeValue.toLowerCase().indexOf(q.toLowerCase()) !== -1 && node.parentNode) hits.push(node.parentNode);
      }
      hits.forEach(function (h) { h.classList.add('crtl-hit'); });
      info.textContent = hits.length ? hits.length + ' مورد — Enter برای بعدی' : 'چیزی پیدا نشد';
      if (hits.length) hits[0].scrollIntoView({ block: 'center' });
    }
    inp.addEventListener('input', run);
    inp.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' || e.key === 'Esc') { e.preventDefault(); bastan_jostojo(); return; }
      if (e.key !== 'Enter' || !hits.length) return;
      e.preventDefault();
      idx = (idx + 1) % hits.length;
      hits[idx].scrollIntoView({ block: 'center' });
      info.textContent = (idx + 1) + '/' + hits.length;
    });
    var close = document.createElement('button');
    close.type = 'button';
    close.textContent = '✕ بستن (Esc)';
    close.className = 'crtl-btn';
    close.addEventListener('click', bastan_jostojo);
    box.appendChild(inp);
    box.appendChild(info);
    box.appendChild(close);
    document.body.appendChild(box);
    inp.focus();
  }

  // Escape has to reach this from anywhere: the app swallows keys inside the
  // composer, so the listener sits on the document in the capture phase.
  function bastan_panel() {
    var p = document.getElementById('crtl-panel');
    if (!p || !p.classList.contains('crtl-open')) return false;
    p.classList.remove('crtl-open');
    ja_baz_kardan_baraye_panel(p);
    return true;
  }

  // Escape closes the find bar first, then the settings panel — the panel used
  // to have no way out except the aA button, which is easy to lose.
  /* ---------------- variable glossary on hover ---------------- */
  // window.__CRTL_GLOSSARY is baked in by fix-rtl-claude.sh from each
  // project's shenasname file ({name: [card, ...]}). Known names in the chat
  // get a dotted underline; resting on one for GLOSS_DELAY ms opens its card.
  // A new card shows up after the patch re-runs and the window reloads.
  var GLOSS_DELAY = 600;
  function vazhe_name_ru_kalame() {
    var G = window.__CRTL_GLOSSARY;
    if (!G || document.__crtlGlossWired) return;
    document.__crtlGlossWired = true;
    var names = Object.keys(G);
    if (!names.length) return;
    // `_` counts as part of a word so post_buy_gate never lights up inside post_buy_gate_1_s
    var RE = new RegExp('(^|[^A-Za-z0-9_])(' + names.sort(function (a, b) { return b.length - a.length; }).join('|') + ')(?![A-Za-z0-9_])', 'g');
    var WORD = /[A-Za-z0-9_]/;
    var SKIP = 'pre,textarea,input,script,style,#crtl-gloss,#crtl-panel,[class*="messageInputContainer_"],[contenteditable="true"]';

    // INVARIANT — never add, remove or replace a node inside the chat. The
    // messages are React's; rewriting a text node to wrap a match in a <span>
    // made React lose track of its own children and the whole panel died with
    // "Failed to execute 'insertBefore' on 'Node'". The underline is painted
    // with the Highlight API, which takes ranges and leaves the DOM alone.
    // window.CSS, not CSS: this file already has its own `CSS` (the panel's
    // stylesheet string), which silently shadowed the browser's namespace
    var HLS = window.CSS && window.CSS.highlights;
    var HL = HLS ? new Highlight() : null;
    var HL_PEND = HLS ? new Highlight() : null;
    if (HL) { HLS.set('crtl-var', HL); HLS.set('crtl-var-pending', HL_PEND); }

    function pending(name) {
      return G[name].every(function (e) { return /پیشنهاد/.test(e.tayid || ''); });
    }
    function scan() {
      queued = false;
      if (!HL) return;
      HL.clear(); HL_PEND.clear();
      document.querySelectorAll('[class*="messagesContainer_"]').forEach(function (root) {
        var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null), n;
        while ((n = w.nextNode())) {
          if (!n.nodeValue || n.nodeValue.length < 3) continue;
          var p = n.parentElement;
          if (!p || (p.closest && p.closest(SKIP))) continue;
          var m; RE.lastIndex = 0;
          while ((m = RE.exec(n.nodeValue))) {
            var at = m.index + m[1].length;
            var r = document.createRange();
            r.setStart(n, at); r.setEnd(n, at + m[2].length);
            (pending(m[2]) ? HL_PEND : HL).add(r);
          }
        }
      });
    }
    var queued = false;
    new MutationObserver(function () {
      if (!queued) { queued = true; setTimeout(scan, 400); }
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
    scan();

    // which variable, if any, sits under the pointer — read from the caret
    // position, so no marker element has to exist in the page
    function varAt(x, y) {
      var pos = document.caretRangeFromPoint ? document.caretRangeFromPoint(x, y) : null;
      if (!pos || pos.startContainer.nodeType !== 3) return null;
      var t = pos.startContainer, s = t.nodeValue || '', i = pos.startOffset;
      var p = t.parentElement;
      if (!p || !p.closest('[class*="messagesContainer_"]') || p.closest(SKIP)) return null;
      var a = i, b = i;
      while (a > 0 && WORD.test(s.charAt(a - 1))) a--;
      while (b < s.length && WORD.test(s.charAt(b))) b++;
      var word = s.slice(a, b);
      if (!G[word]) return null;
      var r = document.createRange();
      r.setStart(t, a); r.setEnd(t, b);
      return { name: word, rect: r.getBoundingClientRect() };
    }

    var st = document.createElement('style');
    st.textContent =
      '::highlight(crtl-var){text-decoration:underline dotted 1px;text-underline-offset:3px;text-decoration-color:var(--vscode-textLink-foreground,#4aa3ff)}' +
      '::highlight(crtl-var-pending){text-decoration:underline dotted 1px;text-underline-offset:3px;text-decoration-color:#e8a33d}' +
      '#crtl-gloss{position:fixed;z-index:99999;max-width:460px;max-height:60vh;overflow:auto;direction:rtl;text-align:right;' +
      'background:var(--vscode-editorHoverWidget-background,#252526);color:var(--vscode-editorHoverWidget-foreground,#ddd);' +
      'border:1px solid var(--vscode-editorHoverWidget-border,#555);border-radius:6px;padding:8px 10px;font-size:12px;line-height:1.6;box-shadow:0 4px 16px rgba(0,0,0,.4)}' +
      '#crtl-gloss .h{font-weight:bold;direction:ltr;text-align:left;font-family:monospace}' +
      '#crtl-gloss .r{margin-top:4px}#crtl-gloss .k{opacity:.6}' +
      '#crtl-gloss .l{direction:ltr;text-align:left;font-family:monospace;font-size:11px;opacity:.85}' +
      '#crtl-gloss a{color:var(--vscode-textLink-foreground,#4aa3ff);text-decoration:none;cursor:pointer}#crtl-gloss a:hover{text-decoration:underline}#crtl-gloss .pend{color:#e8a33d}#crtl-gloss hr{border:0;border-top:1px solid rgba(127,127,127,.3);margin:6px 0}';
    document.head.appendChild(st);

    var box = null, timer = null, hideT = null, cur = null;
    function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
    function sakht_radif(k, v, cls) { return v ? '<div class="r"><span class="k">' + k + ':</span> <span class="' + (cls || '') + '">' + v + '</span></div>' : ''; }
    function render(name) {
      return G[name].map(function (e) {
        var h = '<div class="h">' + esc(name) + '  <span class="k">(' + esc(e.p) + ')</span></div>';
        h += sakht_radif('یعنی', esc(e.yani));
        if (e.val) h += sakht_radif('مقدار فعلی در برگه', '<span dir="ltr">' + esc(e.val.v) + '</span>');
        h += sakht_radif('نویسنده', esc(e.ozv));
        if (e.kh && e.kh.length) h += sakht_radif('خواننده‌ها', esc(e.kh.join('، ')));
        h += sakht_radif('چرا', esc(e.chera));
        h += sakht_radif('تأیید', esc(e.tayid), /پیشنهاد/.test(e.tayid || '') ? 'pend' : '');
        // "maghz/maghz.py:61,124" ⇒ a link that opens the file at line 61
        if (e.loc && e.loc.length) h += '<div class="r"><span class="k">فایل:خط</span>' + e.loc.map(function (l) {
          var m = /^(.*?):(\d+)/.exec(l), f = m ? m[1] : l;
          return '<div class="l"><a href="#" data-f="' + esc(e.root + '/' + f) + '"' + (m ? ' data-line="' + m[2] + '"' : '') + '>' + esc(l) + '</a></div>';
        }).join('') + '</div>';
        // a definition file opens at the first place that names this variable
        if (e.tarif && e.tarif.length) h += '<div class="r"><span class="k">تعریف کامل</span>' + e.tarif.map(function (t) {
          return t.charAt(0) === '/'
            ? '<div class="l"><a href="#" data-f="' + esc(t) + '" data-s="' + esc(name) + '">' + esc(t.split('/').pop()) + '</a></div>'
            : '<div class="l">' + esc(t) + '</div>';
        }).join('') + '</div>';
        return h;
      }).join('<hr>');
    }
    function show(hit) {
      if (!box) {
        box = document.createElement('div');
        box.id = 'crtl-gloss';
        box.addEventListener('mouseenter', function () { clearTimeout(hideT); });
        box.addEventListener('mouseleave', hide);
        box.addEventListener('click', function (ev) {
          var a = ev.target.closest && ev.target.closest('a[data-f]');
          if (!a) return;
          ev.preventDefault();
          var api = window.acquireVsCodeApi && window.acquireVsCodeApi.__crtl ? window.acquireVsCodeApi() : null;
          if (!api) { ERRORS.push('glossary: no IDE handle to open ' + a.dataset.f); return; }
          var req;
          if (/\.md$/i.test(a.dataset.f) && window.__CRTL_URL_SCHEME) {
            // a definition opens rendered, at the line naming this variable —
            // md-rtl-ext's URI handler does that; open_file only shows the source
            req = { type: 'open_url', url: window.__CRTL_URL_SCHEME + '://habib.markdown-rtl/open?file=' +
              encodeURIComponent(a.dataset.f) + '&text=' + encodeURIComponent(a.dataset.s || '') +
              (a.dataset.line ? '&line=' + a.dataset.line : '') };
          } else {
            var loc = a.dataset.line ? { startLine: +a.dataset.line } : (a.dataset.s ? { searchText: a.dataset.s } : undefined);
            // the same request the chat's own file links send
            req = { type: 'open_file', filePath: a.dataset.f, location: loc };
          }
          api.postMessage({ type: 'request', channelId: '', requestId: 'crtl-' + Date.now(), request: req });
        });
        document.body.appendChild(box);
      }
      box.innerHTML = render(hit.name);
      box.style.display = 'block';
      var r = hit.rect, bw = box.offsetWidth, bh = box.offsetHeight;
      var top = r.bottom + 4;
      if (top + bh > window.innerHeight - 4) top = Math.max(4, r.top - bh - 4);
      box.style.top = top + 'px';
      box.style.left = Math.max(4, Math.min(r.left, window.innerWidth - bw - 4)) + 'px';
    }
    function hide() {
      clearTimeout(hideT);
      hideT = setTimeout(function () { if (box) box.style.display = 'none'; cur = null; }, 200);
    }
    // the pointer is tracked instead of a hover on a marker element, because
    // there is no marker element any more
    document.addEventListener('mousemove', function (e) {
      if (e.target.closest && e.target.closest('#crtl-gloss')) { clearTimeout(timer); return; }
      var hit = varAt(e.clientX, e.clientY);
      var name = hit && hit.name;
      if (name === cur) return;
      clearTimeout(timer);
      cur = name;
      if (hit) {
        timer = setTimeout(function () { clearTimeout(hideT); show(hit); }, GLOSS_DELAY);
      } else if (box && box.style.display === 'block') {
        hide();
      }
    }, true);
  }

  function bastan_panel_ba_click_birun() {
    if (document.__crtlDismissWired) return;
    document.__crtlDismissWired = true;
    document.addEventListener('mousedown', function (e) {
      var p = document.getElementById('crtl-panel');
      if (!p || !p.classList.contains('crtl-open')) return;
      if (p.contains(e.target)) return;
      // the gear column carries the aA toggle; let it do its own toggling
      if (e.target.closest && e.target.closest('.crtl-bar')) return;
      bastan_panel();
    }, true);
  }

  function bastan_jostojo() {
    var box = document.getElementById('crtl-find');
    if (!box) return false;
    box.remove();
    pak_kardan_neshane();
    return true;
  }
  function bastan_jostojo_ba_esc() {
    if (document.__crtlFindEscWired) return;
    document.__crtlFindEscWired = true;
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape' && e.key !== 'Esc') return;
      var popup = document.querySelector('#crtl-panel .crtl-tz-popup');
      if (popup) { popup.remove(); e.preventDefault(); e.stopPropagation(); return; }
      if (bastan_jostojo() || bastan_panel()) { e.preventDefault(); e.stopPropagation(); }
    }, true);
  }
  function pak_kardan_neshane() {
    var m = document.querySelectorAll('.crtl-hit');
    for (var i = 0; i < m.length; i++) m[i].classList.remove('crtl-hit');
  }

  // the text from the aA panel, glued before or after — a blank line between
  // from = 'menu' (right-click: every ticked text) or 'btn' (the copy button
  // under a reply: only ticked texts that also have their 📋 on)
  function ba_matn_vizhe(text, from) {
    var list = (khandan_tanzim().extras || []).filter(function (x) {
      return x && x.on && String(x.text || '').trim() && (from !== 'btn' || x.btn);
    });
    var pick = function (start) {
      return list.filter(function (x) { return (x.pos === 'start') === start; })
                 .map(function (x) { return String(x.text).trim(); });
    };
    return pick(true).concat([text], pick(false)).join('\n\n');
  }

  // The copy button under a reply is the app's own: a click, then
  // navigator.clipboard.writeText a moment later. A click inside
  // [data-message-actions] arms a short window; only a write inside that
  // window gets the extra text, so code-block copies and Cmd+C stay untouched.
  (function () {
    var armedUntil = 0;
    document.addEventListener('click', function (e) {
      var b = e.target && e.target.closest && e.target.closest('[data-message-actions] button[aria-label^="Copy response"]');
      if (b) armedUntil = Date.now() + 1000;
    }, true);
    var cb = navigator.clipboard;
    if (!cb || !cb.writeText || cb.writeText.__crtl) return;
    var orig = cb.writeText.bind(cb);
    var wrapped = function (t) {
      var hit = Date.now() < armedUntil;
      armedUntil = 0;
      if (hit && typeof t === 'string') t = ba_matn_vizhe(t, 'btn');
      return orig(t);
    };
    wrapped.__crtl = true;
    try { cb.writeText = wrapped; } catch (e) {}
  })();

  /* ---------------- copy the conversation ---------------- */
  function copy_hame() {
    var root = document.querySelector('[class*="messagesContainer_"]');
    if (!root) return 'گفتگویی پیدا نشد';
    var parts = [];
    root.querySelectorAll('[class*="message_"],[class*="userMessage_"]').forEach(function (n) {
      var t = (n.innerText || '').trim();
      if (!t) return;
      var mine = typeof n.className === 'string' && n.className.indexOf('userMessage_') !== -1;
      parts.push((mine ? '## من\n\n' : '## کلود\n\n') + t);
    });
    var md = parts.join('\n\n---\n\n');
    var msg = parts.length + ' پیام کپی شد';
    copy_matn(md, function () { neveshtan_yaddasht_panel(msg); },
             function () { neveshtan_yaddasht_panel('کلیپ‌بورد اجازه نداد'); });
    return msg;
  }

  /* ---------------- quote a selection into the composer ---------------- */
  function naghl_dar_kadr(text, asQuote) {
    var el = kadr_tayp();
    if (!el) return;
    var body = asQuote ? text.split('\n').map(function (l) { return '> ' + l; }).join('\n') : text;
    var cur = el.isContentEditable ? el.textContent : el.value;
    // start the quote on its own line when the composer already has something
    neveshtan_dar_kadr(el, (cur && !/\n$/.test(cur) ? '\n' : '') + body + '\n\n');
  }

  function menu_rast_click() {
    var m = document.getElementById('crtl-ctx');
    if (m) return m;
    m = document.createElement('div');
    m.id = 'crtl-ctx';
    document.body.appendChild(m);
    document.addEventListener('mousedown', function (e) {
      if (!m.contains(e.target)) m.style.display = 'none';
    }, true);
    document.addEventListener('scroll', function () { m.style.display = 'none'; }, true);
    return m;
  }

  function menu_naghl() {
    if (document.__crtlCtxWired) return;
    document.__crtlCtxWired = true;

    document.addEventListener('contextmenu', function (e) {
      if (!khandan_tanzim().quoteMenu) return;
      var sel = window.getSelection();
      var text = sel ? sel.toString().trim() : '';
      if (!text) return;

      // only for text picked out of the conversation, never the composer
      var root = document.querySelector('[class*="messagesContainer_"]');
      var node = sel.anchorNode;
      var inside = false;
      while (node) {
        // the «حدس» card's text too (Habib, 8 Nov 20:07: «توی پنجرهٔ حدس هم بشه این کلیک راست رو کرد»)
      if (node === root || node.id === 'crtl-fekr-shenavar' || (node.classList && node.classList.contains('crtl-hads'))) { inside = true; break; }
        node = node.parentNode;
      }
      if (!inside) return;

      e.preventDefault();
      var m = menu_rast_click();
      m.textContent = '';
      var short = text.length > 30 ? text.slice(0, 30) + '…' : text;

      [
        ['⧉ کپی با الصاق متن ویژه', function () { copy_matn(ba_matn_vizhe(text, 'menu')); }],
        ['↩︎ نقل‌قول در چت', function () { naghl_dar_kadr(text, true); }],
        ['✎ بدون علامت نقل‌قول', function () { naghl_dar_kadr(text, false); }],
        ['⧉ کپی', function () { copy_matn(text); }],
        ['🔍 جست‌وجوی همین متن', function () {
          var box = document.getElementById('crtl-find');
          if (!box) navar_jostojo();
          var inp = document.querySelector('#crtl-find input');
          if (inp) { inp.value = text.slice(0, 60); inp.dispatchEvent(new Event('input')); }
        }],
        ['؟ بپرس دربارهٔ «' + short + '»', function () {
          naghl_dar_kadr(text, true);
          var el = kadr_tayp();
          if (el) neveshtan_dar_kadr(el, 'دربارهٔ این بخش توضیح بده: ');
        }]
      ].forEach(function (sakht_radif) {
        var b = document.createElement('button');
        b.type = 'button';
        b.textContent = sakht_radif[0];
        b.addEventListener('click', function (ev) {
          ev.preventDefault();
          m.style.display = 'none';
          sakht_radif[1]();
        });
        m.appendChild(b);
      });

      m.style.display = 'flex';
      m.style.left = '0px';
      m.style.top = '0px';
      var r = m.getBoundingClientRect();
      var x = Math.min(e.clientX, window.innerWidth - r.width - 6);
      var y = Math.min(e.clientY, window.innerHeight - r.height - 6);
      m.style.left = Math.max(4, x) + 'px';
      m.style.top = Math.max(4, y) + 'px';
    }, true);

    // Ctrl+Alt+Q quotes the current selection without the menu
    document.addEventListener('keydown', function (e) {
      if (!(e.ctrlKey && e.altKey && (e.key === 'q' || e.key === 'Q'))) return;
      var sel = window.getSelection();
      var text = sel ? sel.toString().trim() : '';
      if (!text) return;
      e.preventDefault();
      naghl_dar_kadr(text, true);
    });
  }

  /* ---------------- composer counter ---------------- */
  // The counter used to poll once a second forever — even switched off — and
  // each tick swept the whole document. Now the timer only exists while the
  // counter is on, and the expensive usage scan runs once every ten ticks.
  var counterTimer = null, usageCache = '', usageTick = 0;

  function shomarande_nevise_tik() {
    var tag = document.getElementById('crtl-count');
    if (!tag) return;
    var el = kadr_tayp();
    var txt = el ? (el.isContentEditable ? el.textContent : el.value) || '' : '';
    if (usageTick-- <= 0) {
      usageTick = 10;
      usageCache = '';
      // mirror whatever usage line the app itself renders, when there is one
      var nodes = document.querySelectorAll('[class*="usage"],[class*="Usage"],[class*="context"]');
      for (var i = 0; i < nodes.length; i++) {
        var t = (nodes[i].innerText || '').trim();
        if (/%/.test(t) && t.length < 40) { usageCache = t.split('\n')[0]; break; }
      }
    }
    tag.textContent = txt.length + ' نویسه' + (usageCache ? ' · ' + usageCache : '');
  }

  function shomarande_nevise(s) {
    if (s.counter && !counterTimer) {
      usageTick = 0;
      counterTimer = setInterval(shomarande_nevise_tik, 1000);
      shomarande_nevise_tik();
    } else if (!s.counter && counterTimer) {
      clearInterval(counterTimer);
      counterTimer = null;
      var tag = document.getElementById('crtl-count');
      if (tag) tag.textContent = '';
    }
  }

  /* ---------------- dragging the button columns ---------------- */
  function emal_ja_dokme(bar, s) {
    var p = s.pos[bar.dataset.side];
    if (p && typeof p.y === 'number') {
      bar.style.bottom = 'auto';
      bar.style.top = p.y + 'px';
    }
    if (p && typeof p.x === 'number') {
      bar.style.left = p.x + 'px';
      bar.style.right = 'auto';
    }
  }

  function keshidani_kardan(bar, grip) {
    grip.addEventListener('mousedown', function (e) {
      e.preventDefault();
      var rect = bar.getBoundingClientRect();
      var dx = e.clientX - rect.left, dy = e.clientY - rect.top;
      function move(ev) {
        bar.style.left = (ev.clientX - dx) + 'px';
        bar.style.top = (ev.clientY - dy) + 'px';
        bar.style.right = 'auto';
        bar.style.bottom = 'auto';
      }
      function up(ev) {
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', up);
        var s = khandan_tanzim();
        s.pos[bar.dataset.side] = { x: ev.clientX - dx, y: ev.clientY - dy };
        zakhire_tanzim(s);
      }
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', up);
    });
  }


  /* ---------------- self-diagnosis ---------------- */
  // "It stopped working" is unactionable from here, so the panel can report
  // exactly which anchor the patch failed to find, plus any captured error.
  function tashkhis_khata() {
    function n(sel) { try { return document.querySelectorAll(sel).length; } catch (e) { return 'ERR'; } }
    var st = document.getElementById('crtl-size-style');
    var lsOK = 'yes';
    try { localStorage.setItem('crtl-probe', '1'); localStorage.removeItem('crtl-probe'); }
    catch (e) { lsOK = 'NO (' + (e && e.name) + ')'; }
    var lines = [
      'messagesContainer_ : ' + n('[class*="messagesContainer_"]'),
      'userMessage_       : ' + n('[class*="userMessage_"]'),
      'message_           : ' + n('[class*="message_"]'),
      'thinking/toolCall  : ' + n('[class*="thinking"],[class*="Thinking"],[class*="toolCall"],[class*="ToolCall"]'),
      'messageInput_      : ' + n('[class*="messageInput_"]'),
      'composer found     : ' + (kadr_tayp() ? 'yes (' + (kadr_tayp().tagName || '?') + ')' : 'NO'),
      'button bars        : ' + n('.crtl-bar:not(.crtl-gear)'),
      'settings panels    : ' + n('#crtl-panel') + ' (class .crtl-panel: ' + n('.crtl-panel') + ')',
      'size <style>       : ' + (st ? st.textContent.length + ' chars' : 'MISSING'),
      'localStorage       : ' + lsOK,
      'script copies      : ' + (window.__crtlLoaded || 1),
      'file read (import) : ' + (typeof FileReader === 'function' ? 'yes' : 'NO'),
      'copy (execCommand) : ' + (document.queryCommandSupported &&
                                 document.queryCommandSupported('copy') ? 'yes' : 'NO'),
      'copy (async API)   : ' + (navigator.clipboard && navigator.clipboard.writeText ? 'present' : 'absent'),
      'errors             : ' + (ERRORS.length ? ERRORS.join(' | ') : 'none')
    ];
    return lines.concat(barabari_kadr_va_ayne(), gozaresh_khat_payam_jam()).join('\n');
  }

  // How many lines a collapsed user message actually ends up showing.
  function gozaresh_khat_payam_jam() {
    var m = document.querySelector('[class*="userMessage_"]');
    if (!m) return ['', 'user message      : none on screen'];
    var c = m.querySelector('[class*="content_"]') || m;
    var cs = getComputedStyle(c);
    var lh = parseFloat(cs.lineHeight) || 0;
    var shown = lh ? Math.round(c.clientHeight / lh * 10) / 10 : '?';
    return ['', 'user message clamp:',
      '  setting        ' + khandan_tanzim().lines + ' line(s)',
      '  target found   ' + (c === m ? 'content_ MISSING (fell back to userMessage_)' : 'content_'),
      '  line-clamp     ' + (cs.webkitLineClamp || cs.getPropertyValue('-webkit-line-clamp') || 'none'),
      '  rendered lines ' + shown];
  }

  // The composer paints its text transparent and shows an absolutely positioned
  // mirror instead, so the two layers must agree on every metric. Any row that
  // says MISMATCH is a caret landing in the wrong place.
  function barabari_kadr_va_ayne() {
    var inp = document.querySelector('[class*="messageInput_"]');
    var mir = document.querySelector('[class*="mentionMirror_"]');
    if (!inp || !mir) return ['', 'input vs mirror   : ' + (inp ? 'mirror MISSING' : 'input MISSING')];
    var a = getComputedStyle(inp), b = getComputedStyle(mir);
    var props = ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing',
                 'padding', 'direction', 'unicodeBidi', 'whiteSpace', 'wordBreak'];
    var out = ['', 'input vs mirror:'];
    props.forEach(function (k) {
      var x = a[k] || '', y = b[k] || '';
      var same = x === y;
      out.push('  ' + (k + '            ').slice(0, 14) +
               (x.length > 26 ? x.slice(0, 26) + '…' : x) + ' | ' +
               (y.length > 26 ? y.slice(0, 26) + '…' : y) + '   ' + (same ? 'ok' : 'MISMATCH'));
    });
    return out;
  }


  // navigator.clipboard.writeText returns a Promise, so a try/catch around it
  // never sees a rejection — which is how "کپی شد ✓" kept appearing while
  // nothing was copied. In a webview iframe the async API is usually blocked by
  // permissions policy anyway; the old execCommand path still works because it
  // runs synchronously inside the click gesture. Both are tried, and failure is
  // reported honestly.
  function copy_matn(txt, onOK, onFail) {
    var tmp = document.createElement('textarea');
    tmp.value = txt;
    tmp.setAttribute('readonly', '');
    tmp.style.cssText = 'position:fixed;top:0;left:-9999px;opacity:0';
    document.body.appendChild(tmp);
    var active = document.activeElement;
    tmp.select();
    tmp.setSelectionRange(0, txt.length);
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    tmp.remove();
    if (active && active.focus) { try { active.focus(); } catch (e) {} }
    if (ok) { if (onOK) onOK(); return; }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(
        function () { if (onOK) onOK(); },
        function () { if (onFail) onFail(); }
      );
      return;
    }
    if (onFail) onFail();
  }

  /* ---------------- settings as a portable file ---------------- */
  // The webview cannot write to disk on its own, but it can hand the browser a
  // file to save and read one the user picks — which is all that is needed to
  // carry a profile from one IDE to another.
  function tanzim_baraye_copy() {
    var cur = khandan_tanzim();
    return { chat: cur.chat, code: cur.code, chrome: cur.chrome, btn: cur.btn,
             lines: cur.lines, side: cur.side, collapse: cur.collapse,
             tableScroll: cur.tableScroll, accent: cur.accent,
             textColor: cur.textColor, lh: cur.lh,
             opacity: cur.opacity, counter: cur.counter, quoteMenu: cur.quoteMenu,
             extras: cur.extras,
             profiles: cur.profiles, commands: cur.commands };
  }

  function neveshtan_yaddasht_panel(msg) {
    var n = document.querySelector('#crtl-panel .crtl-note');
    if (n) n.textContent = msg;
  }

  var FILE_NAME = 'claude-rtl-settings.json';

  // The webview CSP is `default-src 'none'`, so writing a file from here is
  // impossible — no blob download, no save picker. The clipboard is the one
  // channel that always works, so copy-here / paste-there is the main route.
  function copy_tanzim() {
    var txt = JSON.stringify(tanzim_baraye_copy(), null, 2);
    var ta = document.getElementById('crtl-io');
    // the text lands in the visible box first, so a blocked clipboard still
    // leaves something the user can select and copy by hand
    if (ta) { ta.value = txt; }
    copy_matn(txt,
      function () { neveshtan_yaddasht_panel('کپی شد ✓ — در IDE دیگر داخل همین کادر پیست کن'); },
      function () {
        if (ta) { ta.focus(); ta.select(); }
        neveshtan_yaddasht_panel('کلیپ‌بورد اجازه نداد — متن در کادر انتخاب شد، Cmd+C بزن');
      });
  }

  function khandan_tanzim_az_file() {
    var inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = '.json,application/json';
    inp.style.cssText = 'position:fixed;left:-9999px;width:1px;height:1px';
    inp.addEventListener('change', function () {
      var f = inp.files && inp.files[0];
      inp.remove();
      if (!f) return;
      var r = new FileReader();
      r.onload = function () { emal_tanzim_vared_shode(String(r.result), f.name); };
      r.onerror = function () { neveshtan_yaddasht_panel('فایل خوانده نشد'); };
      r.readAsText(f);
    });
    document.body.appendChild(inp);
    inp.click();
  }

  function emal_tanzim_vared_shode(txt, fileName) {
    var incoming;
    try { incoming = JSON.parse(txt); }
    catch (e) { neveshtan_yaddasht_panel('این فایل JSON معتبر نیست'); return; }
    if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
      neveshtan_yaddasht_panel('ساختار فایل درست نیست'); return;
    }
    var cur = khandan_tanzim();
    var mergedProfiles = Object.assign({}, cur.profiles, incoming.profiles || {});
    var merged = Object.assign(cur, incoming);
    merged.profiles = mergedProfiles;
    zakhire_tanzim(merged);
    draftCommands = null;
    emal_andaze_va_rang(khandan_tanzim());
    sakht_dobare();
    neveshtan_yaddasht_panel('«' + (fileName || FILE_NAME) + '» خوانده شد ✓ — ' +
              Object.keys(mergedProfiles).length + ' پروفایل');
  }

  /* ---------------- rendering ---------------- */
  function samt_dokme(cmd, s) {
    if (cmd.side === 'top') return 'top';
    if (s.side === 'left' || s.side === 'right') return s.side;
    return cmd.side || 'right';
  }

  // The empty stretch of the header between the chat name and its icons.
  // Found by shape, not by hashed class, and null when a new Claude build
  // moves it — the caller then falls back to the left column.
  // The chat header's spacer is preferred; a header without the chat name (some chats
  // opened by a ?session= link) still takes the row.
  function ja_navar_bala() {
    var sp = document.querySelectorAll('[class*="headerSpacer_"]');
    var any = null;
    for (var i = 0; i < sp.length; i++) {
      var head = sp[i].closest('[class*="header_"]');
      if (!head) continue;
      if (head.querySelector('[class*="titleText_"]')) return sp[i];
      // not the "Auto mode is enabled" banner, which is a header_ with its own spacer
      if (!any && !head.querySelector('[class*="headerTitle_"]')) any = sp[i];
    }
    return any;
  }

  // With a question window open, a top button's text goes into that question's Other box: the box exists only
  // once Other is ticked, so Other is ticked first (Habib, 5 Nov 02:34: «وقتی که صفحه سوال باز میشه اون دکمه های بالا
  // رو میزنم توی قسمت other نمیاد متنشون یه کاری کن که متنشون بیاد»). What he already wrote there stays, the text comes after it.
  function bordan_be_other(c, line) {
    var box = document.querySelector('[class*="questionsContainer_"]');
    if (!box) return false;
    // a folded window is display:none: the text would land in a box nobody sees. The active tab unfolds it (the app's own click).
    if (/questionsContainerFolded_/.test(box.className)) {
      var tab = document.querySelector('[class*="navTabActive_"]');
      if (tab) tab.click();
    }
    var ops = box.querySelectorAll('[class*="optionsContainer_"] [role="radio"],[class*="optionsContainer_"] [role="checkbox"]');
    var other = ops[ops.length - 1];
    if (!other) return false;
    function bezan(el) {
      if (line) gozashtan_khat_dar_kadr(el, c.text || ''); else neveshtan_dar_kadr(el, c.text);
    }
    var ready = other.querySelector('[contenteditable]');
    if (ready) { bezan(ready); return true; }
    if (other.getAttribute('aria-checked') !== 'true') other.click();
    var t0 = Date.now();
    (function sabr() {
      var el = other.isConnected && other.querySelector('[contenteditable]');
      if (el) return bezan(el);
      if (Date.now() - t0 < 1000) setTimeout(sabr, 30);
    })();
    return true;
  }

  // Selecting an answer's words doesn't pick that answer; a plain click still does (Habib's «بله»). The app acts on every
  // click inside an option, so a click after a drag is stopped, and one on the words waits a moment for a possible second
  // click (a double click selects a word). The circle answers at once.
  var SOAL_SABR_MS = 250;
  function entekhab_matn_soal() {
    if (document.__crtlSoalSel) return;
    document.__crtlSoalSel = true;
    var pain = null, montazer = null;
    function dakhel_option(t) {
      return t && t.closest ? t.closest('[class*="questionsContainer_"] [role="radio"],[class*="questionsContainer_"] [role="checkbox"]') : null;
    }
    document.addEventListener('mousedown', function (e) {
      pain = { x: e.clientX, y: e.clientY };
      // A press on the question's words would focus the window itself, whose focus handler moves focus on to a button at
      // once, and the browser then drops the press: no selection. So the words take the focus themselves.
      var t = e.target;
      if (t && t.closest && t.closest('[class*="questionsContainer_"]') && !dakhel_option(t) && !t.closest('button,[contenteditable]') && !t.hasAttribute('tabindex')) {
        t.setAttribute('tabindex', '-1');
      }
    }, true);
    document.addEventListener('click', function (e) {
      if (!e.isTrusted) return;           // the delayed click below, and the top buttons' own click on Other
      var op = dakhel_option(e.target);
      if (!op) return;
      if (e.target.closest('[contenteditable]') || e.target.closest('[class*="optionCheckbox_"]')) return;
      var keshid = pain && Math.abs(e.clientX - pain.x) + Math.abs(e.clientY - pain.y) > 4;
      var sel = window.getSelection();
      var entekhab = sel && !sel.isCollapsed && String(sel).trim();
      e.stopPropagation();
      e.preventDefault();
      if (montazer) { clearTimeout(montazer); montazer = null; }
      if (keshid || entekhab || e.detail > 1) return;
      montazer = setTimeout(function () {
        montazer = null;
        var s2 = window.getSelection();
        if (s2 && !s2.isCollapsed && String(s2).trim()) return;
        if (op.isConnected) op.click();
      }, SOAL_SABR_MS);
    }, true);
  }

  function ejraye_dokme(c, line) {
    if (c.menu) { click_menu(c.menu); return; }
    if (bordan_be_other(c, line)) return;
    var el = kadr_tayp();
    if (!el) return;
    // a draft already in the box is never sent along with the button's text
    var khali = !(el.isContentEditable ? el.textContent : el.value || '').trim();
    if (line) gozashtan_khat_dar_kadr(el, c.text || ''); else neveshtan_dar_kadr(el, c.text);
    if (c.send && khali) setTimeout(function () { ferestadan_payam(el, /^\//.test(c.text || '')); }, 60);
  }

  // Drag a top button onto another to move it there. Under 5px of travel
  // it is a plain click; past that the click that follows is swallowed.
  var DRAG_PX = 5;
  function keshidan_navar_bala(b, bar) {
    b.addEventListener('mousedown', function (e) {
      if (e.button !== 0) return;
      var x0 = e.clientX, y0 = e.clientY, moved = false;
      function move(ev) {
        if (!moved && Math.abs(ev.clientX - x0) + Math.abs(ev.clientY - y0) > DRAG_PX) {
          moved = true; b.classList.add('crtl-dragging');
        }
      }
      function up(ev) {
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', up);
        b.classList.remove('crtl-dragging');
        if (!moved) return;
        b.dataset.dragged = '1';
        setTimeout(function () { delete b.dataset.dragged; }, 0);
        var tgt = document.elementFromPoint(ev.clientX, ev.clientY);
        tgt = tgt && tgt.closest ? tgt.closest('.crtl-top .crtl-btn') : null;
        if (!tgt || tgt === b) return;
        var r = tgt.getBoundingClientRect();
        // the row runs right-to-left: dropping on a button's right half puts it before that button
        var before = ev.clientX > r.left + r.width / 2;
        var cur = khandan_tanzim();
        var list = dokme_ha(cur).slice();
        var from = +b.dataset.i, to = +tgt.dataset.i;
        var item = list.splice(from, 1)[0];
        if (from < to) to--;
        list.splice(before ? to : to + 1, 0, item);
        cur.commands = list; zakhire_tanzim(cur);
        draftCommands = null;
        sakht_dobare();
      }
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', up);
    });
  }

  function sakht_navar_bala(s) {
    var old = document.querySelectorAll('.crtl-top');
    for (var i = 0; i < old.length; i++) {
      if (old[i].parentNode) old[i].parentNode.classList.remove('crtl-top-host');
      old[i].remove();
    }
    var all = dokme_ha(s);
    var host = ja_navar_bala() || jaygozin_navar_bala();
    if (!host || !all.some(function (c) { return samt_dokme(c, s) === 'top'; })) return !!host;
    var bar = document.createElement('div');
    bar.className = 'crtl-bar crtl-top';
    bar.dataset.side = 'top';
    all.forEach(function (c, idx) {
      if (samt_dokme(c, s) !== 'top') return;
      var b = sakht_dokme(c.label, c.text || c.menu || '', function () {
        if (b.dataset.dragged) return;
        ejraye_dokme(c, true);
      });
      b.dataset.i = idx;
      keshidan_navar_bala(b, bar);
      bar.appendChild(b);
    });
    bar.addEventListener('wheel', function (e) {
      if (!e.deltaY || bar.scrollWidth <= bar.clientWidth) return;
      bar.scrollLeft -= e.deltaY; e.preventDefault();
    }, { passive: false });
    host.classList.add('crtl-top-host');
    host.appendChild(bar);
    return true;
  }

  // A chat with no header row (a fresh one from the Session Manager's «New session», Habib 27 Oct
  // 22:46: «تو یه اکستنشن داری باید روی همه اینها کار بکنه»): the row gets its own strip at the top
  // of the panel, and moves into the header once one shows
  function jaygozin_navar_bala() {
    var j = document.getElementById('crtl-top-jaygozin');
    if (!j) {
      j = document.createElement('div');
      j.id = 'crtl-top-jaygozin';
      document.body.appendChild(j);
    }
    return j;
  }
  function bardashtan_jaygozin() {
    var j = document.getElementById('crtl-top-jaygozin');
    if (j) j.remove();
  }

  // React rebuilds the header on a session switch, taking the row with it.
  var topWatch = null;
  function payesh_navar_bala() {
    if (topWatch) return;
    topWatch = setInterval(function () {
      var s = khandan_tanzim();
      if (!dokme_ha(s).some(function (c) { return samt_dokme(c, s) === 'top'; })) return;
      var bar = document.querySelector('.crtl-top');
      var host = ja_navar_bala();
      if (bar && host && host.contains(bar)) return;
      // no header: the row stays in its own strip (never the vertical columns)
      if (!host) { if (!bar) sakht_navar_bala(s); return; }
      if (bar && bar.closest('#crtl-top-jaygozin')) { bardashtan_jaygozin(); sakht_navar_bala(s); return; }
      if (!document.querySelector('[data-top]')) { bardashtan_jaygozin(); sakht_navar_bala(s); return; }
      sakht_dobare();
    }, 1500);
  }

  function sakht_dokme_kenar(s) {
    var old = document.querySelectorAll('.crtl-bar:not(.crtl-top)');
    for (var i = 0; i < old.length; i++) old[i].remove();
    sakht_navar_bala(s);
    payesh_navar_bala();

    ['left', 'right'].forEach(function (side) {
      var items = dokme_ha(s).filter(function (c) {
        var at = samt_dokme(c, s);
        // "top" buttons live only in the header row; without a header they wait (payesh_navar_bala)
        return at === side;
      });
      if (!items.length) return;
      var bar = document.createElement('div');
      bar.className = 'crtl-bar';
      bar.dataset.side = side;

      var grip = document.createElement('div');
      grip.className = 'crtl-btn crtl-grip';
      grip.textContent = '⋮⋮';
      grip.title = 'برای جابه‌جایی بکش';
      bar.appendChild(grip);

      items.forEach(function (c) {
        var top = c.side === 'top';
        var b = sakht_dokme(c.label, c.text || c.menu || '', function () { ejraye_dokme(c, top); });
        if (top) b.dataset.top = '1';
        bar.appendChild(b);
      });

      document.body.appendChild(bar);
      emal_ja_dokme(bar, s);
      keshidani_kardan(bar, grip);
    });
  }

  var draftCommands = null;      // unsaved text sitting in the JSON editor
  var draftProfileName = '';     // profile name typed but not saved yet

  function sakht_panel_aa(s) {
    var old = document.getElementById('crtl-panel');
    var wasOpen = old && old.classList.contains('crtl-open');
    if (old) old.remove();

    var panel = document.createElement('div');
    panel.className = 'crtl-panel' + (wasOpen ? ' crtl-open' : '');
    // the find bar borrows the .crtl-panel look, so the settings panel is
    // addressed by id — a class lookup could hand back the wrong element
    panel.id = 'crtl-panel';
    panel.dataset.side = s.side === 'left' ? 'right' : 'left';

    var note = document.createElement('div');
    note.className = 'crtl-note';

    function set(field, value) {
      var cur = khandan_tanzim();
      cur[field] = value;
      zakhire_tanzim(cur);
      emal_andaze_va_rang(cur);
    }

    // this chat's names — re-read every time the panel opens. One button
    // copies them all, with a ready SendMessage line on top: the short name
    // and session id mean nothing on another device, only the remote row does.
    [['اسم چت', 'crtl-sess-title', 'title'], ['از دستگاه دیگر', 'crtl-sess-remote', 'remote'], ['اسم کوچک', 'crtl-sess-name', 'name'], ['کد سشن', 'crtl-sess-id', 'sid']].forEach(function (f) {
      var val = document.createElement('span');
      val.id = f[1];
      val.dataset.v = SESSION[f[2]] || '';
      val.textContent = SESSION[f[2]] || 'نامشخص';
      val.title = SESSION[f[2]] || '';
      val.className = 'crtl-note';
      // one line, as much as fits; the copy-all button gives the full values
      val.style.cssText = 'flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;user-select:text' +
        (f[2] === 'title' || f[2] === 'remote' ? '' : ';direction:ltr');
      if (f[2] === 'title' || f[2] === 'remote') val.dir = 'auto';
      panel.appendChild(sakht_radif(f[0], val));
    });
    var cpRow = document.createElement('div');
    cpRow.className = 'crtl-actions';
    var cpAll = sakht_dokme('کپی همه', 'همهٔ مشخصات این چت را یک‌جا کپی کن — برای پیام دادن از دستگاه دیگر', function () {
      var v = SESSION.card;
      if (!v) { cpAll.textContent = 'هنوز آماده نیست'; setTimeout(function () { cpAll.textContent = 'کپی همه'; }, 1200); return; }
      copy_matn(v, function () { cpAll.textContent = '✓ کپی شد'; setTimeout(function () { cpAll.textContent = 'کپی همه'; }, 1200); },
        function () { cpAll.textContent = '✗'; setTimeout(function () { cpAll.textContent = 'کپی همه'; }, 1200); });
    });
    cpRow.appendChild(cpAll);
    panel.appendChild(cpRow);
    panel.appendChild(document.createElement('div')).className = 'crtl-sep';

    // presets
    var presetRow = document.createElement('div');
    presetRow.className = 'crtl-actions';
    [['فشرده', 'compact'], ['معمولی', 'normal'], ['درشت', 'large']].forEach(function (p) {
      presetRow.appendChild(sakht_dokme(p[0], 'پیش‌تنظیم ' + p[0], function () {
        var cur = Object.assign(khandan_tanzim(), PRESETS[p[1]]);
        zakhire_tanzim(cur); emal_andaze_va_rang(cur); sakht_dobare();
      }));
    });
    panel.appendChild(sakht_radif('پیش‌تنظیم', presetRow));
    panel.appendChild(document.createElement('div')).className = 'crtl-sep';

    // sizes
    panel.appendChild(radif_andaze('متن گفتگو', 'chat', s, set));
    panel.appendChild(radif_andaze('کد و جدول', 'code', s, set));
    panel.appendChild(radif_andaze('حواشی', 'chrome', s, set));
    panel.appendChild(radif_andaze('دکمه‌ها', 'btn', s, set));
    panel.appendChild(radif_andaze('هوک‌ها', 'hook_font_px', s, set));
    panel.appendChild(radif_andaze('پُری کادرِ حدس ٪', 'hads_pori_darsad', s, set));
    panel.appendChild(radif_andaze('پُری شناورِ thinking ٪', 'fekr_pori_darsad', s, set));

    var lhRange = document.createElement('input');
    lhRange.type = 'range';
    lhRange.min = LIMITS.lh[0]; lhRange.max = LIMITS.lh[1]; lhRange.step = 1;
    lhRange.value = s.lh;
    var lhNum = document.createElement('span');
    lhNum.className = 'crtl-note';
    lhNum.style.cssText = 'min-width:26px;text-align:center;direction:ltr';
    lhNum.textContent = (s.lh / 10).toFixed(1);
    lhRange.addEventListener('input', function () {
      var v = parseInt(lhRange.value, 10);
      lhNum.textContent = (v / 10).toFixed(1);
      set('lh', v);
    });
    var lhWrap = document.createElement('div');
    lhWrap.className = 'crtl-row';
    lhWrap.style.cssText = 'flex:1;gap:6px';
    lhWrap.appendChild(lhRange); lhWrap.appendChild(lhNum);
    panel.appendChild(sakht_radif('فاصلهٔ خطوط', lhWrap));

    var opa = document.createElement('input');
    opa.type = 'range'; opa.min = 20; opa.max = 100; opa.value = s.opacity;
    opa.addEventListener('input', function () { set('opacity', parseInt(opa.value, 10)); });
    panel.appendChild(sakht_radif('شفافیت', opa));

    var color = document.createElement('input');
    color.type = 'color';
    color.value = s.accent || '#888888';
    color.style.cssText = 'width:44px;height:20px;padding:0;border:0;background:none';
    color.addEventListener('change', function () { set('accent', color.value); sakht_dobare(); });
    var colorWrap = document.createElement('div');
    colorWrap.className = 'crtl-actions';
    colorWrap.appendChild(color);
    colorWrap.appendChild(sakht_dokme('بی‌رنگ', 'برگشت به رنگ خود تم', function () {
      var cur = khandan_tanzim(); cur.accent = ''; zakhire_tanzim(cur); emal_andaze_va_rang(cur); sakht_dobare();
    }));
    panel.appendChild(sakht_radif('رنگ دکمه‌ها', colorWrap));

    var ink = document.createElement('input');
    ink.type = 'color';
    ink.value = s.textColor || '#dddddd';
    ink.style.cssText = 'width:44px;height:20px;padding:0;border:0;background:none';
    ink.addEventListener('change', function () { set('textColor', ink.value); sakht_dobare(); });
    var inkWrap = document.createElement('div');
    inkWrap.className = 'crtl-actions';
    inkWrap.appendChild(ink);
    inkWrap.appendChild(sakht_dokme('بی‌رنگ', 'برگشت به رنگ متن خود تم', function () {
      var cur = khandan_tanzim(); cur.textColor = ''; zakhire_tanzim(cur); emal_andaze_va_rang(cur); sakht_dobare();
    }));
    panel.appendChild(sakht_radif('رنگ متن', inkWrap));
    panel.appendChild(document.createElement('div')).className = 'crtl-sep';

    // user-message line count
    var lineSel = document.createElement('select');
    [['۱ خط', 1], ['۲ خط', 2], ['۳ خط', 3], ['کامل', 0]].forEach(function (o) {
      var opt = document.createElement('option');
      opt.textContent = o[0]; opt.value = o[1];
      if (s.lines === o[1]) opt.selected = true;
      lineSel.appendChild(opt);
    });
    lineSel.addEventListener('change', function () { set('lines', parseInt(lineSel.value, 10)); });
    panel.appendChild(sakht_radif('پیام خودت', lineSel));

    // button placement
    var sideSel = document.createElement('select');
    [['هر دو طرف', 'both'], ['همه چپ', 'left'], ['همه راست', 'right']].forEach(function (o) {
      var opt = document.createElement('option');
      opt.textContent = o[0]; opt.value = o[1];
      if (s.side === o[1]) opt.selected = true;
      sideSel.appendChild(opt);
    });
    sideSel.addEventListener('change', function () {
      var cur = khandan_tanzim(); cur.side = sideSel.value; cur.pos = {}; zakhire_tanzim(cur); sakht_dobare();
    });
    panel.appendChild(sakht_radif('جای دکمه‌ها', sideSel));

    // toggles
    var toggles = document.createElement('div');
    toggles.className = 'crtl-actions';
    toggles.appendChild(sakht_dokme(s.collapse ? 'جمع: روشن' : 'جمع: خاموش',
      'کوچک‌کردن بخش‌های Thinking و tool call', function () {
        var cur = khandan_tanzim(); cur.collapse = !cur.collapse; zakhire_tanzim(cur); emal_andaze_va_rang(cur); sakht_dobare();
      }));
    toggles.appendChild(sakht_dokme(s.tableScroll ? 'جدول: اسکرول' : 'جدول: آزاد',
      'اسکرول افقی برای جدول و کد پهن', function () {
        var cur = khandan_tanzim(); cur.tableScroll = !cur.tableScroll; zakhire_tanzim(cur); emal_andaze_va_rang(cur); sakht_dobare();
      }));
    toggles.appendChild(sakht_dokme(s.hidden ? 'دکمه‌ها: مخفی' : 'دکمه‌ها: پیدا',
      'مخفی/نمایش ستون دکمه‌ها — میانبر: Ctrl+Alt+B', function () {
        var cur = khandan_tanzim(); cur.hidden = !cur.hidden; zakhire_tanzim(cur); emal_andaze_va_rang(cur); sakht_dobare();
      }));
    panel.appendChild(toggles);
    panel.appendChild(document.createElement('div')).className = 'crtl-sep';

    // profiles
    var profRow = document.createElement('div');
    profRow.className = 'crtl-actions';
    var profSel = document.createElement('select');
    var names = Object.keys(s.profiles || {});
    var ph = document.createElement('option');
    ph.textContent = names.length ? '— انتخاب —' : '— خالی —';
    ph.value = '';
    profSel.appendChild(ph);
    var fromFile = esm_profile_moshtarak();
    names.forEach(function (n) {
      var o = document.createElement('option');
      o.textContent = n + (fromFile.indexOf(n) !== -1 ? '  ⇩' : '');
      o.value = n;
      profSel.appendChild(o);
    });
    profSel.addEventListener('change', function () {
      if (!profSel.value) return;
      var cur = khandan_tanzim();
      var snap = cur.profiles[profSel.value] || {};
      zakhire_tanzim(Object.assign(cur, snap));
      emal_andaze_va_rang(khandan_tanzim()); sakht_dobare();
    });
    panel.appendChild(sakht_radif('پروفایل', profSel));

    // Electron never implemented window.prompt — it returns undefined, so the
    // old `if (!name) return;` bailed out every single time and saving a
    // profile silently did nothing. The name is typed right here instead.
    var profName = document.createElement('input');
    profName.type = 'text';
    profName.placeholder = 'نام پروفایل…';
    profName.value = draftProfileName;
    profName.style.cssText = 'flex:1;min-width:70px;direction:rtl;text-align:right;' +
      'background:rgba(127,127,127,.15);border:1px solid rgba(127,127,127,.35);' +
      'border-radius:4px;color:inherit;padding:1px 4px;font:inherit';
    profName.addEventListener('input', function () { draftProfileName = profName.value; });

    function saveProfile() {
      var cur = khandan_tanzim();
      var name = (profName.value || '').trim() ||
                 ('پروفایل ' + (Object.keys(cur.profiles).length + 1));
      cur.profiles[name] = {
        chat: cur.chat, code: cur.code, chrome: cur.chrome, btn: cur.btn,
        lines: cur.lines, side: cur.side, collapse: cur.collapse,
        tableScroll: cur.tableScroll, accent: cur.accent, opacity: cur.opacity,
        textColor: cur.textColor, lh: cur.lh
      };
      zakhire_tanzim(cur);
      draftProfileName = '';
      sakht_dobare();
      var n = document.querySelector('#crtl-panel .crtl-note');
      if (n) n.textContent = 'پروفایل «' + name + '» ذخیره شد ✓';
    }
    profName.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); saveProfile(); }
    });

    profRow.appendChild(profName);
    profRow.appendChild(sakht_dokme('ذخیره', 'تنظیمات فعلی را با همین نام نگه دار (Enter هم کار می‌کند)', saveProfile));
    profRow.appendChild(sakht_dokme('حذف', 'پاک‌کردن پروفایل انتخاب‌شده', function () {
      if (!profSel.value) return;
      var cur = khandan_tanzim();
      delete cur.profiles[profSel.value];
      zakhire_tanzim(cur); sakht_dobare();
    }));
    panel.appendChild(profRow);
    panel.appendChild(document.createElement('div')).className = 'crtl-sep';

    // conversation tools
    var tools = document.createElement('div');
    tools.className = 'crtl-actions';
    tools.appendChild(sakht_dokme('جست‌وجو', 'جست‌وجو در گفتگو — Ctrl+Alt+F', navar_jostojo));
    tools.appendChild(sakht_dokme('کپی گفتگو', 'کپی کل گفتگو به مارک‌داون', function () {
      note.textContent = copy_hame();
    }));
    tools.appendChild(sakht_dokme('sel', 'کدی که در ادیتور (فایل باز، نه چت) انتخاب کرده‌ای را به گفتگو اضافه می‌کند — همان Add selection در منوی /', function () {
      click_menu('Add selection');
    }));
    tools.appendChild(sakht_dokme(s.quoteMenu ? 'راست‌کلیک: روشن' : 'راست‌کلیک: خاموش',
      'منوی نقل‌قول روی متن انتخاب‌شده — میانبر: Ctrl+Alt+Q', function () {
        var cur = khandan_tanzim(); cur.quoteMenu = !cur.quoteMenu; zakhire_tanzim(cur); sakht_dobare();
      }));
    tools.appendChild(sakht_dokme(s.counter ? 'شمارنده: روشن' : 'شمارنده: خاموش',
      'شمارندهٔ نویسه و مصرف کانتکست', function () {
        var cur = khandan_tanzim(); cur.counter = !cur.counter; zakhire_tanzim(cur); sakht_dobare();
      }));
    panel.appendChild(tools);

    // ready texts for "copy with extra text". Only this box is rebuilt on a
    // change — rebuilding the whole panel while typing would steal the caret.
    var exHead = document.createElement('div');
    exHead.className = 'crtl-note';
    exHead.textContent = 'متن‌های ویژه — تیک بزن کدام‌ها بچسبند (بالاتری جلوتر)';
    panel.appendChild(exHead);
    var exBox = document.createElement('div');
    exBox.id = 'crtl-extras';
    exBox.style.cssText = 'display:flex;flex-direction:column;gap:2px;min-width:0';
    panel.appendChild(exBox);
    var exEdit = null;   // null | row index | 'new'
    function exSave(list) { var cur = khandan_tanzim(); cur.extras = list; zakhire_tanzim(cur); }
    function exMini(label, title, on) {
      var b = sakht_dokme(label, title, on);
      b.style.cssText = 'flex:none;padding:0 3px;min-width:0;font-size:.85em;line-height:1.5';
      return b;
    }
    function paintExtras() {
      var list = khandan_tanzim().extras;
      exBox.textContent = '';
      list.forEach(function (x, k) {
        if (exEdit === k) return exBox.appendChild(exEditor(x.text, k));
        var r = document.createElement('div');
        r.style.cssText = 'display:flex;align-items:center;gap:2px;min-width:0;white-space:nowrap';
        var cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = !!x.on;
        cb.title = 'این متن بچسبد؟';
        cb.style.cssText = 'flex:none;margin:0 2px';
        cb.addEventListener('change', function () { list[k].on = cb.checked; exSave(list); });
        var t = document.createElement('span');
        t.textContent = String(x.text).replace(/\s+/g, ' ');
        t.title = x.text;
        t.dir = 'auto';
        t.style.cssText = 'flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
        r.appendChild(cb);
        r.appendChild(t);
        r.appendChild(exMini(x.pos === 'start' ? 'اول' : 'آخر', 'اول یا آخر متن کپی‌شده', function () {
          list[k].pos = x.pos === 'start' ? 'end' : 'start'; exSave(list); paintExtras();
        }));
        var cp = exMini('📋', 'دکمهٔ کپی زیر هر جواب هم این متن را بچسباند — ' + (x.btn ? 'روشن' : 'خاموش'), function () {
          list[k].btn = !x.btn; exSave(list); paintExtras();
        });
        if (!x.btn) cp.style.opacity = '.35';
        r.appendChild(cp);
        r.appendChild(exMini('↑', 'بالاتر', function () {
          if (k === 0) return;
          var m = list.splice(k, 1)[0]; list.splice(k - 1, 0, m); exSave(list); paintExtras();
        }));
        r.appendChild(exMini('↓', 'پایین‌تر', function () {
          if (k === list.length - 1) return;
          var m = list.splice(k, 1)[0]; list.splice(k + 1, 0, m); exSave(list); paintExtras();
        }));
        r.appendChild(exMini('✎', 'ویرایش', function () { exEdit = k; paintExtras(); }));
        // two clicks to delete: confirm() is blocked inside the webview
        var del = exMini('✕', 'حذف — دو بار بزن', function () {
          if (del.dataset.arm) { list.splice(k, 1); exSave(list); paintExtras(); return; }
          del.dataset.arm = '1'; del.textContent = 'پاک؟';
          setTimeout(function () { if (del.isConnected) { delete del.dataset.arm; del.textContent = '✕'; } }, 3000);
        });
        r.appendChild(del);
        exBox.appendChild(r);
      });
      if (exEdit === 'new') exBox.appendChild(exEditor('', 'new'));
      else {
        var add = exMini('+ افزودن', 'یک متن ویژهٔ تازه', function () { exEdit = 'new'; paintExtras(); });
        add.style.alignSelf = 'flex-start';
        exBox.appendChild(add);
      }
    }
    function exEditor(value, k) {
      var w = document.createElement('div');
      w.style.cssText = 'display:flex;flex-direction:column;gap:2px;min-width:0';
      var ta = document.createElement('textarea');
      ta.rows = 3;
      ta.dir = 'auto';
      ta.value = value;
      ta.placeholder = 'متن ویژه — می‌تواند چندخطی باشد';
      ta.style.cssText = 'width:100%;box-sizing:border-box;resize:vertical;background:rgba(127,127,127,.15);' +
        'border:1px solid rgba(127,127,127,.35);border-radius:4px;color:inherit;padding:2px 4px;font:inherit';
      var bar = document.createElement('div');
      bar.style.cssText = 'display:flex;gap:4px';
      bar.appendChild(exMini('ذخیره', 'ذخیره', function () {
        var v = ta.value.trim();
        if (!v) { ta.focus(); return; }
        var list = khandan_tanzim().extras;
        if (k === 'new') list.push({ text: v, on: true, pos: 'end', btn: false });
        else list[k].text = v;
        exSave(list); exEdit = null; paintExtras();
      }));
      bar.appendChild(exMini('لغو', 'لغو', function () { exEdit = null; paintExtras(); }));
      w.appendChild(ta);
      w.appendChild(bar);
      setTimeout(function () { ta.focus(); }, 0);
      return w;
    }
    paintExtras();
    panel.appendChild(document.createElement('div')).className = 'crtl-sep';

    // command list editor. Every toggle in this panel rebuilds it from scratch,
    // so an unsaved edit is parked in draftCommands and put back on the way in.
    // One row per button: word · text (or, for a menu button, the menu's
    // name — it keeps opening that menu) · where it sits · delete.
    note.textContent = 'دکمه‌ها (کلمه · متن · جا · ⏎ خودش بفرستد):';
    panel.appendChild(note);
    if (draftCommands === null) draftCommands = JSON.parse(JSON.stringify(dokme_ha(s)));
    var list = document.createElement('div');
    list.id = 'crtl-cmds';
    draftCommands.forEach(function (c, i) {
      var r = document.createElement('div');
      r.className = 'crtl-cmd-row';
      r.style.cssText = 'display:flex;gap:3px;align-items:flex-start;margin-bottom:3px';
      var word = document.createElement('input');
      word.className = 'crtl-cmd-label';
      word.value = c.label || '';
      word.placeholder = 'کلمه';
      word.style.cssText = 'width:52px;flex-shrink:0';
      word.addEventListener('input', function () { c.label = word.value; });
      var body = document.createElement('textarea');
      body.className = 'crtl-cmd-text';
      body.rows = 1;
      body.style.cssText = 'flex:1;min-width:0;min-height:20px;resize:vertical';
      if (c.menu !== undefined) {
        body.value = c.menu; body.placeholder = 'اسمِ منو'; body.title = 'دکمهٔ منو: این منو را باز می‌کند';
        body.addEventListener('input', function () { c.menu = body.value; });
      } else {
        body.value = c.text || ''; body.placeholder = 'متن';
        body.addEventListener('input', function () { c.text = body.value; });
      }
      var where = document.createElement('select');
      where.className = 'crtl-cmd-side';
      [['top', 'بالا'], ['left', 'چپ'], ['right', 'راست']].forEach(function (o) {
        var op = document.createElement('option');
        op.value = o[0]; op.textContent = o[1];
        where.appendChild(op);
      });
      where.value = c.side === 'top' || c.side === 'left' ? c.side : 'right';
      where.addEventListener('change', function () { c.side = where.value; });
      r.appendChild(word); r.appendChild(body); r.appendChild(where);
      // ticked: the button sends by itself; unticked: it only puts its text in the box (Habib 30 Oct)
      if (c.menu === undefined) {
        var ferest = document.createElement('label');
        ferest.title = 'تیک: خودش می‌فرستد · بی تیک: فقط متن را در کادر می‌گذارد';
        ferest.style.cssText = 'display:flex;align-items:center;gap:1px;flex-shrink:0;font-size:10px';
        var tik = document.createElement('input');
        tik.type = 'checkbox'; tik.className = 'crtl-cmd-send'; tik.checked = !!c.send;
        tik.addEventListener('change', function () { c.send = tik.checked; });
        ferest.appendChild(tik); ferest.appendChild(document.createTextNode('⏎'));
        r.appendChild(ferest);
      }
      r.appendChild(sakht_dokme('×', 'حذفِ این دکمه', function () {
        draftCommands.splice(i, 1); sakht_panel_aa(khandan_tanzim());
      }));
      list.appendChild(r);
    });
    panel.appendChild(list);

    var acts = document.createElement('div');
    acts.className = 'crtl-actions';
    acts.appendChild(sakht_dokme('+ دکمهٔ تازه', 'یک ردیفِ خالی اضافه کن', function () {
      draftCommands.push({ label: '', text: '', side: 'top', send: false });
      sakht_panel_aa(khandan_tanzim());
    }));
    acts.appendChild(sakht_dokme('ذخیرهٔ دکمه‌ها', 'اعمالِ این فهرست', function () {
      var cur = khandan_tanzim();
      cur.commands = draftCommands.filter(function (c) { return String(c.label || '').trim(); });
      zakhire_tanzim(cur);
      draftCommands = null;
      sakht_dobare();
      var n = document.querySelector('#crtl-panel .crtl-note');
      if (n) n.textContent = 'ذخیره شد ✓';
    }));
    acts.appendChild(sakht_dokme('لیست پیش‌فرض', 'برگشت لیست دکمه‌ها به حالت اولیه', function () {
      var cur = khandan_tanzim(); cur.commands = null; zakhire_tanzim(cur);
      draftCommands = null;
      sakht_dobare();
    }));
    panel.appendChild(acts);
    panel.appendChild(document.createElement('div')).className = 'crtl-sep';

    // export / reset
    // carrying the whole setup — profiles included — between IDEs
    var ioLabel = document.createElement('div');
    ioLabel.className = 'crtl-note';
    ioLabel.textContent = 'انتقال تنظیمات و پروفایل‌ها بین IDEها:';
    panel.appendChild(ioLabel);

    var ioBox = document.createElement('textarea');
    ioBox.id = 'crtl-io';
    ioBox.placeholder = 'اینجا پیست کن…';
    ioBox.style.height = '52px';
    // pasting is the whole point, so it applies itself without another click
    ioBox.addEventListener('paste', function () {
      setTimeout(function () { if (ioBox.value.trim()) emal_tanzim_vared_shode(ioBox.value, 'پیست'); }, 0);
    });
    panel.appendChild(ioBox);

    var fileRow = document.createElement('div');
    fileRow.className = 'crtl-actions';
    fileRow.appendChild(sakht_dokme('کپی تنظیمات', 'همهٔ تنظیمات و پروفایل‌ها را کپی کن', copy_tanzim));
    fileRow.appendChild(sakht_dokme('اعمال', 'آنچه در کادر بالا پیست کرده‌ای را اعمال کن', function () {
      if (!ioBox.value.trim()) { neveshtan_yaddasht_panel('کادر خالی است'); return; }
      emal_tanzim_vared_shode(ioBox.value, 'پیست');
    }));
    fileRow.appendChild(sakht_dokme('از فایل', 'به‌جای پیست، یک فایل تنظیمات را باز کن', khandan_tanzim_az_file));
    panel.appendChild(fileRow);

    var acts2 = document.createElement('div');
    acts2.className = 'crtl-actions';
    acts2.appendChild(sakht_dokme('تست', 'گزارش تشخیص — چه چیزی پیدا شد و چه خطایی رخ داده', function () {
      var report = tashkhis_khata();
      copy_matn(report);
      var box = document.getElementById('crtl-diag');
      if (!box) {
        box = document.createElement('pre');
        box.id = 'crtl-diag';
        box.style.cssText = 'direction:ltr;text-align:left;font:10px/1.4 monospace;white-space:pre;' +
          'overflow:auto;max-height:200px;flex-shrink:0;margin:4px 0 0;padding:4px;' +
          'background:rgba(127,127,127,.12);border:1px solid rgba(127,127,127,.35);border-radius:4px';
        panel.appendChild(box);
      }
      box.textContent = report;
      note.textContent = 'گزارش در کلیپ‌بورد کپی شد';
    }));
    acts2.appendChild(sakht_dokme('rst', 'برگشت همه‌چیز به پیش‌فرض — شامل جای دکمه‌ها و پروفایل‌ها', function () {
      draftCommands = null;
      zakhire_tanzim(tanzim_pishfarz());
      emal_andaze_va_rang(khandan_tanzim());
      sakht_dobare();
    }));
    panel.appendChild(acts2);

    sakht_tab_ha(panel);
    document.body.appendChild(panel);
    return panel;
  }

  /* ---------------- the «تنظیمات کلود» tab ---------------- */
  // Habib, 5 Nov 02:34: «کلا یه تب جدا برای این تنظیمات بزار که از این ثفحه جدا باشه و توی تب تنظیمات کلود رو بتونم
  // تعیین کنم هر چی تنظیم ک ه هست به صورت سراسری پروژه چت ضمن اینکه برای سراسری یه پاپ اپ بیاد که مطمینی میخوای
  // یرایری باشه و اگه اکی دادم اونوقت بزاره بزنم». Every row: three ticks of which one lands, a value, ثبت, a popup.
  // The rows come from the host (the app's own schema); the Persian line of each from claude-tanzimat-fa.json.
  var TZ_CHROME = 'claudeInChromeDefaultEnabled';
  var TZ_BALA = ['effortLevel', 'model', 'remoteControlAtStartup', 'ultracode', 'autoCompactWindow', TZ_CHROME];
  var TZ_SATH = [['sarasari', 'سراسری'], ['poshe', 'پروژه'], ['chat', 'چت']];
  var TZ_ESM_SATH = { sarasari: 'سراسری', poshe: 'پروژه', chat: 'چت' };
  var TZ_ESM_MANBA = { userSettings: 'سراسری', projectSettings: 'پروژه', localSettings: 'پروژه', flagSettings: 'همین چت', policySettings: 'سازمان' };
  var TZ_FASELE_TOKEN = 33000;      // the engine compacts 33 thousand before its window
  var TZ_REMEMBER_TOKEN = 20000;    // remember comes 20 thousand before the compaction

  function api_safhe() {
    return window.acquireVsCodeApi && window.acquireVsCodeApi.__crtl ? window.acquireVsCodeApi() : null;
  }
  function tz_adad_fa(n) { return String(n).replace(/\d/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'[d]; }); }
  function tz_hezar(n) { return tz_adad_fa(Math.round(n / 1000)) + ' هزار'; }
  function tz_adad_latin(t) {
    return String(t).replace(/[۰-۹]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d); }).replace(/[,،٬\s]/g, '');
  }

  function sakht_tab_ha(panel) {
    var fontPage = document.createElement('div');
    fontPage.id = 'crtl-page-font';
    fontPage.style.cssText = 'display:flex;flex-direction:column;gap:4px;min-width:0';
    while (panel.firstChild) fontPage.appendChild(panel.firstChild);
    var claudePage = document.createElement('div');
    claudePage.id = 'crtl-page-claude';
    var strip = document.createElement('div');
    strip.className = 'crtl-tabs';
    strip.setAttribute('role', 'tablist');
    var dokme = {};
    [['font', 'فونت'], ['claude', 'تنظیمات کلود']].forEach(function (f) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = f[1];
      b.setAttribute('role', 'tab');
      b.dataset.tab = f[0];
      b.addEventListener('click', function () { TZ.tab = f[0]; neshan(); });
      dokme[f[0]] = b;
      strip.appendChild(b);
    });
    function neshan() {
      var ro = TZ.tab === 'claude';
      fontPage.style.display = ro ? 'none' : 'flex';
      claudePage.style.display = ro ? 'flex' : 'none';
      dokme.font.setAttribute('aria-selected', ro ? 'false' : 'true');
      dokme.claude.setAttribute('aria-selected', ro ? 'true' : 'false');
      panel.classList.toggle('crtl-panel-pahn', ro);
      document.documentElement.classList.toggle('crtl-tab-claude', ro);
      if (ro) tz_porsidan();
    }
    panel.appendChild(strip);
    panel.appendChild(fontPage);
    panel.appendChild(claudePage);
    TZ.rows = null;
    tz_sakht_safhe(claudePage);
    neshan();
  }

  function tz_sakht_safhe(page) {
    var q = document.createElement('input');
    q.type = 'text';
    q.className = 'crtl-tz-search';
    q.placeholder = 'جست‌وجو در تنظیم‌ها…';
    q.addEventListener('input', function () {
      var t = q.value.trim().toLowerCase();
      page.querySelectorAll('.crtl-tz-row').forEach(function (r) {
        r.style.display = !t || r.dataset.jost.indexOf(t) !== -1 ? '' : 'none';
      });
    });
    page.appendChild(q);
    var list = document.createElement('div');
    list.id = 'crtl-tz-list';
    list.style.cssText = 'display:flex;flex-direction:column;min-width:0';
    list.textContent = 'در حال خواندن تنظیم‌ها…';
    page.appendChild(list);
  }

  function tz_porsidan() {
    var api = api_safhe();
    if (!api) return;
    if (!SESSION.sid) SESSION.sid = khandan_shenase_chat_az_state();
    TZ.lastList = ++TZ.req;
    api.postMessage({ type: 'crtl-tanzimat-list', reqId: TZ.lastList, sid: SESSION.sid, channel: SESSION.channel || '' });
  }

  // A save changed the running engine from the host: the extension's own effort, model and ultracode labels read it again.
  function tz_taze_shod(channelId) {
    var ss = window.__crtl_sessions;
    if (ss) ss.forEach(function (s) {
      try {
        if (channelId && s.claudeChannelId && s.claudeChannelId !== channelId) return;
        if (s.rereadAppliedSettings) s.rereadAppliedSettings();
      } catch (e) {}
    });
    var p = document.getElementById('crtl-panel');
    if (TZ.tab !== 'claude' || !p || !p.classList.contains('crtl-open')) return;
    clearTimeout(TZ.taze);
    TZ.taze = setTimeout(tz_porsidan, 300);
  }

  function tz_resid(d) {
    var list = document.getElementById('crtl-tz-list');
    if (!list) return;
    if (d.khata) { if (!TZ.rows) list.textContent = 'خوانده نشد: ' + d.khata; return; }
    TZ.data = d;
    if (!TZ.rows) {
      TZ.rows = {};
      list.textContent = '';
      var by = {};
      (d.rows || []).forEach(function (r) { by[r.k] = r; });
      var hame = TZ_BALA.filter(function (k) { return by[k]; }).concat((d.rows || []).map(function (r) { return r.k; }).filter(function (k) { return TZ_BALA.indexOf(k) === -1; }));
      hame.forEach(function (k, i) {
        if (i === TZ_BALA.length) {
          var h = document.createElement('div');
          h.className = 'crtl-note';
          h.style.cssText = 'margin-top:6px';
          h.textContent = 'همهٔ تنظیم‌های دیگر';
          list.appendChild(h);
        }
        var row = tz_sakht_radif(by[k]);
        TZ.rows[k] = row;
        list.appendChild(row.el);
      });
    }
    Object.keys(TZ.rows).forEach(function (k) { TZ.rows[k].neshan(); });
  }

  // the value this level holds now: what fills the box when its tick lands
  function tz_maghdar_sath(k, sath) {
    var d = TZ.data || {}, s = (d.sath || {})[sath] || {};
    if (k === TZ_CHROME && sath === 'sarasari') return (d.chrome || {}).on;
    if (s[k] && Object.prototype.hasOwnProperty.call(s[k], 'v')) return s[k].v;
    var f = sath === 'sarasari' ? d.karbar : sath === 'poshe' ? d.mahalli : null;
    if (!f) return undefined;
    if (sath === 'sarasari' && (k === 'effortLevel' || k === 'autoCompactWindow')) {
      var m = d.alan && d.alan.applied && d.alan.applied.model, per = (f.modelSettings || {})[m];
      if (per && per[k] !== undefined) return per[k];
    }
    return f[k];
  }

  function tz_neveshte(v) {
    if (v === undefined || v === null) return '—';
    if (v === true) return 'روشن';
    if (v === false) return 'خاموش';
    if (typeof v === 'object') { var j = JSON.stringify(v); return j.length > 70 ? j.slice(0, 70) + '…' : j; }
    return String(v);
  }

  // Habib, 5 Nov: «اون تنظیمات رو بخونه و تنظیم فعلی را نشان بده که چیه و مفهومش را هم نشان بده که چیه»
  function tz_dade(k) {
    var e = (window.__CRTL_TANZIMAT_TOZIH || {})[k];
    return e && typeof e === 'object' ? e : {};
  }
  function tz_nemayesh(k, v) {
    if (k === 'env' && v && typeof v === 'object') return Object.keys(v).join('، ') || '—'; // names only: values can be secret
    return tz_neveshte(v);
  }
  function tz_mani(k, v, nemayesh) {
    var e = tz_dade(k), s = '';
    if (e.gozine && Object.prototype.hasOwnProperty.call(e.gozine, String(v))) s = e.gozine[String(v)];
    else if (v === true && e.on) s = e.on;
    else if (v === false && e.off) s = e.off;
    else if (e.ba && e.ba !== '{v}') s = e.ba.replace('{v}', nemayesh === undefined ? tz_nemayesh(k, v) : nemayesh);
    return s ? '؛ یعنی ' + s : '';
  }
  // nothing set anywhere. The default the running app states wins, so an update moves it here too. A default known only from the
  // engine's code says which version it was checked on, and says so when this version isn't checked yet. Otherwise «خالی» and its meaning.
  var TZ_NOSKHE_PISH = '2.1.318';
  function tz_khali(k) {
    var e = tz_dade(k), d = TZ.data || {}, z = d.pishZende || {};
    if (!Object.prototype.hasOwnProperty.call(e, 'pish')) return 'خالی' + (e.khali ? '؛ یعنی ' + e.khali : '');
    if (Object.prototype.hasOwnProperty.call(z, k)) return tz_neveshte(z[k]) + ' (پیش‌فرض کلود)' + tz_mani(k, z[k]);
    var sanjide = d.pishSanjide || TZ_NOSKHE_PISH;
    return tz_neveshte(e.pish) + ' (پیش‌فرض نسخهٔ ' + sanjide + (d.noskhe && d.noskhe !== sanjide ? '؛ این نسخه سنجیده نشده' : '') + ')' + tz_mani(k, e.pish);
  }
  function tz_sar(k, v, az, nemayesh) {
    var x = nemayesh === undefined ? tz_nemayesh(k, v) : nemayesh;
    var pish = az === 'پیش‌فرض کلود';
    if (v && typeof v === 'object' && k !== 'env') return 'الان از ' + az;
    return 'الان: ' + x + (pish ? ' (پیش‌فرض کلود)' : ' از ' + az);
  }

  // «الان: X از Y؛ یعنی …», from the engine of this chat, so it says what is really in force
  function tz_matn_alan(k) {
    var d = TZ.data || {}, a = d.alan, w = (d.barande || {})[k];
    var az = w ? TZ_ESM_SATH[w.sath] : '';
    if (k === TZ_CHROME) {
      var c = d.chrome || {};
      var vasl = c.vasl === 'connected' ? 'این چت وصل است' : c.vasl === 'connecting' ? 'این چت در حال وصل شدن است' : c.vasl === 'error' ? 'این چت خطا دارد' : c.vasl ? 'این چت وصل نیست' : '';
      return 'الان: سراسری ' + (c.on === undefined ? 'معلوم نیست' : c.on ? 'روشن' : 'خاموش') + (vasl ? ' · ' + vasl : '') + (w ? ' · آخرین ثبت: ' + tz_neveshte(w.v) + ' از ' + az : '') + (c.on === undefined ? '' : tz_mani(k, !!c.on));
    }
    var jahani = d.jahani || {}, darJahani = Object.prototype.hasOwnProperty.call(jahani, k);
    if (!a) {
      if (w) return 'ثبت‌شده: ' + (k === 'autoCompactWindow' ? tz_hezar(w.v - TZ_FASELE_TOKEN) + tz_mani(k, w.v - TZ_FASELE_TOKEN, tz_hezar(w.v - TZ_FASELE_TOKEN)) : tz_nemayesh(k, w.v) + ' از ' + az + tz_mani(k, w.v));
      if (darJahani) return 'ثبت‌شده: ' + tz_nemayesh(k, jahani[k]) + ' از ‎~/.claude.json' + tz_mani(k, jahani[k]);
      return 'این چت هنوز شروع نشده · ' + tz_khali(k);
    }
    var v;
    if (k === 'effortLevel') v = a.applied.effort;
    else if (k === 'model') v = a.applied.model;
    else if (k === 'ultracode') v = !!(a.applied.ultracodeRequested || a.applied.ultracode);
    else if (k === 'remoteControlAtStartup') v = a.remote === 'connecting' ? 'در حال وصل' : a.remote === 'disconnected' || a.remote === 'error' ? false : a.remote ? true : undefined;
    else if (k === 'autoCompactWindow') v = a.thr;
    else v = (a.effective || {})[k];
    var azManba;
    if (!az) {
      for (var i = (a.sources || []).length - 1; i >= 0; i--) {
        var src = a.sources[i], st = src.settings || {};
        var darModel = (k === 'effortLevel' || k === 'autoCompactWindow') && st.modelSettings && a.applied.model && st.modelSettings[a.applied.model] && st.modelSettings[a.applied.model][k] !== undefined;
        if (Object.prototype.hasOwnProperty.call(st, k) || darModel) { az = TZ_ESM_MANBA[src.source] || src.source; azManba = darModel ? st.modelSettings[a.applied.model][k] : st[k]; break; }
      }
    }
    if (k === 'autoCompactWindow') {
      if (typeof v !== 'number') return 'الان: معلوم نیست';
      var matn = 'الان: کامپکت سر ' + tz_hezar(v) + (az ? ' از ' + az : ' (پیش‌فرض کلود)') + tz_mani(k, v, tz_hezar(v));
      if (w && w.v - TZ_FASELE_TOKEN !== v) matn += ' · ثبت‌شده: ' + tz_hezar(w.v - TZ_FASELE_TOKEN) + '؛ بعد از ریلود';
      return matn;
    }
    if (v !== undefined && v !== null) return tz_sar(k, v, az || 'پیش‌فرض کلود') + tz_mani(k, v);
    if (darJahani) return tz_sar(k, jahani[k], '‎~/.claude.json') + tz_mani(k, jahani[k]);
    // written somewhere, yet this chat's engine doesn't report it: say so, never claim it is in force
    var sabti = w ? w.v : azManba;
    if (az && sabti !== undefined) return 'ثبت‌شده: ' + tz_nemayesh(k, sabti) + ' از ' + az + ' · موتور این چت هنوز آن را نشان نمی‌دهد' + tz_mani(k, sabti);
    return 'الان: ' + tz_khali(k);
  }

  function tz_gozine_ha(sel, list) {
    var cur = sel.value;
    sel.textContent = '';
    list.forEach(function (o) {
      var op = document.createElement('option');
      op.value = o[0];
      op.textContent = o[1];
      sel.appendChild(op);
    });
    sel.value = cur;
    if (sel.value !== cur) sel.value = '';
  }

  // one value control: {el, get, set, taze}
  function tz_sakht_kontrol(r, dast) {
    var k = r.k, el;
    function select(list) {
      el = document.createElement('select');
      tz_gozine_ha(el, [['', '—']].concat(list));
      el.addEventListener('change', dast);
    }
    function matn(tag) {
      el = document.createElement(tag);
      if (tag === 'input') el.type = 'text';
      el.dir = 'ltr';
      el.spellcheck = false;
      el.addEventListener('input', dast);
    }
    var no = BALA_NO(k) || r.no;
    if (no === 'effort') select(['low', 'medium', 'high', 'xhigh', 'max'].map(function (x) { return [x, x]; }));
    else if (no === 'model') select([]);
    else if (no === 'onoff') select([['true', 'روشن'], ['false', 'خاموش']]);
    else if (no === 'choice') select((r.enum || []).map(function (x) { return [x, x]; }));
    else if (no === 'json') { matn('textarea'); el.placeholder = 'JSON'; }
    else {
      matn('input');
      if (k === 'autoCompactWindow') el.placeholder = 'مثلاً 300000';
      else if (r.pish && r.pish.length) el.placeholder = r.pish.join(' · ');
    }
    el.classList.add('crtl-tz-kontrol');
    return {
      el: el,
      get: function () { return el.value; },
      set: function (v) {
        if (v === undefined || v === null) { el.value = ''; return; }
        if (k === 'autoCompactWindow') { el.value = typeof v === 'number' ? String(v - TZ_FASELE_TOKEN) : ''; return; }
        if (no === 'model' && v && !Array.prototype.some.call(el.options, function (o) { return o.value === v; })) {
          var op = document.createElement('option');
          op.value = v; op.textContent = v;
          el.appendChild(op);
        }
        el.value = typeof v === 'object' ? JSON.stringify(v, null, 1) : String(v);
      },
      taze: function () {
        if (no !== 'model') return;
        var d = TZ.data || {}, seen = {}, list = [];
        function add(v, name) { if (v && v !== 'default' && !seen[v]) { seen[v] = 1; list.push([v, name || v]); } }
        (d.models || []).forEach(function (m) { add(m.value, m.name); });
        Object.keys((d.karbar || {}).modelSettings || {}).forEach(function (m) { add(m); });
        if (d.alan && d.alan.applied) add(d.alan.applied.model);
        tz_gozine_ha(el, [['', '—']].concat(list));
      }
    };
  }
  function BALA_NO(k) { return k === 'effortLevel' ? 'effort' : k === 'model' ? 'model' : ''; }

  function tz_sakht_radif(r) {
    var k = r.k, fa = (window.__CRTL_TANZIMAT_FA || {})[k] || r.desc || k;
    var tozih = tz_dade(k).sharh || '';
    var wrap = document.createElement('div');
    wrap.className = 'crtl-tz-row';
    wrap.dataset.k = k;
    wrap.dataset.jost = (k + ' ' + fa + ' ' + tozih).toLowerCase();
    var head = document.createElement('div');
    head.className = 'crtl-tz-head';
    var faEl = document.createElement('span');
    faEl.className = 'crtl-tz-fa';
    faEl.textContent = fa;
    var enEl = document.createElement('span');
    enEl.className = 'crtl-tz-en';
    enEl.textContent = k;
    enEl.title = r.desc || k;
    head.appendChild(faEl);
    head.appendChild(enEl);
    wrap.appendChild(head);
    var note = document.createElement('div');
    note.className = 'crtl-tz-note';
    wrap.appendChild(note);
    // Habib, 5 Nov: «برای … کل تنظیمات داخل پرانتز با مثال ساده توضیح براشون بذار»؛ جوابِ پنجره: شرح همیشه باز و با کلیک بسته شود
    if (tozih) {
      var tozihEl = document.createElement('div');
      tozihEl.className = 'crtl-tz-tozih';
      tozihEl.textContent = tozih;
      wrap.appendChild(tozihEl);
      head.classList.add('crtl-tz-head-baz');
      head.setAttribute('role', 'button');
      head.setAttribute('tabindex', '0');
      head.setAttribute('aria-expanded', 'true');
      head.title = 'برای بستن یا باز کردن توضیح کلیک کن';
      var bazBaste = function () {
        var baz = tozihEl.style.display === 'none';
        tozihEl.style.display = baz ? 'block' : 'none';
        head.setAttribute('aria-expanded', baz ? 'true' : 'false');
      };
      head.addEventListener('click', bazBaste);
      head.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); bazBaste(); }
      });
    }

    var tick = null, dirty = false, boxes = {};
    var hint = null;
    if (k === 'autoCompactWindow') {
      hint = document.createElement('div');
      hint.className = 'crtl-tz-hint';
    }
    function dast() {
      dirty = true;
      if (hint) {
        var n = Number(tz_adad_latin(kon.get()));
        if (n > 0 && n < 2000) n *= 1000;
        hint.textContent = n >= 67000 ? 'کامپکت سر ' + tz_hezar(Math.min(n, 967000)) + ' و رممبر سر ' + tz_hezar(Math.min(n, 967000) - TZ_REMEMBER_TOKEN) : '';
      }
    }
    var kon = tz_sakht_kontrol(r, dast);
    var sabt = document.createElement('button');
    sabt.type = 'button';
    sabt.className = 'crtl-btn crtl-tz-sabt';
    sabt.textContent = 'ثبت';
    sabt.disabled = true;
    function bezan_tick(s) {
      tick = s;
      Object.keys(boxes).forEach(function (x) { boxes[x].checked = x === s; });
      sabt.disabled = !s;
      if (s && !dirty) kon.set(tz_maghdar_sath(k, s));
    }
    var ticks = document.createElement('div');
    ticks.className = 'crtl-tz-ticks';
    TZ_SATH.forEach(function (f) {
      var lab = document.createElement('label');
      var box = document.createElement('input');
      box.type = 'checkbox';
      box.dataset.sath = f[0];
      boxes[f[0]] = box;
      box.addEventListener('change', function () {
        if (!box.checked) { bezan_tick(null); return; }
        if (f[0] !== 'sarasari') { bezan_tick(f[0]); return; }
        // «و اگه اکی دادم اونوقت بزاره بزنم»: no OK, no tick
        box.checked = false;
        tz_popup(k === TZ_CHROME ? 'مطمئنی می‌خواهی مرورگر سراسری باشد؟ با ثبت آن، همهٔ چت‌های این پنجره و هر چت تازه این مقدار را می‌گیرند، حتی چتی که مقدار خودش را داشت. کروم‌های شماره‌دار (CDP) دست نمی‌خورند.'
          : 'مطمئنی می‌خواهی «' + k + '» سراسری باشد؟ با ثبت آن، همهٔ چت‌ها با هر مدلی این مقدار را می‌گیرند، حتی چتی که مقدار خودش را داشت.',
          [['مطمئنم، سراسری', function () { bezan_tick('sarasari'); }], ['نه', null]]);
      });
      lab.appendChild(box);
      lab.appendChild(document.createTextNode(f[1]));
      ticks.appendChild(lab);
    });
    sabt.addEventListener('click', function () {
      var api = api_safhe();
      if (!api || !tick) return;
      if (!SESSION.sid) SESSION.sid = khandan_shenase_chat_az_state();
      var id = ++TZ.req;
      sabt.disabled = true;
      var timer = setTimeout(function () {
        if (!TZ.waiting[id]) return;
        delete TZ.waiting[id];
        sabt.disabled = !tick;
        tz_popup('جوابی نیامد؛ ثبت معلوم نیست. دوباره تب را باز کن و «الان» را ببین.', [['باشه', null]]);
      }, 15000);
      TZ.waiting[id] = function (res) {
        clearTimeout(timer);
        tz_popup((res.ok ? '✓ ' : '✗ ') + (res.matn || ''), [['باشه', null]]);
        if (res.ok) {
          dirty = false;
          kon.set(undefined);
          bezan_tick(null);
          if (hint) hint.textContent = '';
          tz_porsidan();
        } else sabt.disabled = !tick;
      };
      api.postMessage({ type: 'crtl-tanzimat-sabt', reqId: id, sath: tick, key: k, value: kon.get(), sid: SESSION.sid, channel: SESSION.channel || '' });
    });
    var line = document.createElement('div');
    line.className = 'crtl-tz-line';
    line.appendChild(ticks);
    line.appendChild(kon.el);
    line.appendChild(sabt);
    wrap.appendChild(line);
    if (hint) wrap.appendChild(hint);
    return {
      el: wrap,
      neshan: function () { kon.taze(); note.textContent = tz_matn_alan(k); }
    };
  }

  // inside the panel, so a click on it doesn't count as a click outside and close the panel; never confirm(): the webview blocks it
  function tz_popup(matn, dokmeha) {
    var panel = document.getElementById('crtl-panel');
    if (!panel) return;
    var old = panel.querySelector('.crtl-tz-popup');
    if (old) old.remove();
    var back = document.createElement('div');
    back.className = 'crtl-tz-popup';
    var box = document.createElement('div');
    box.className = 'crtl-tz-box';
    box.setAttribute('role', 'dialog');
    var t = document.createElement('div');
    t.textContent = matn;
    box.appendChild(t);
    var bar = document.createElement('div');
    bar.className = 'crtl-actions';
    dokmeha.forEach(function (d) {
      bar.appendChild(sakht_dokme(d[0], d[0], function () {
        back.remove();
        if (d[1]) d[1]();
      }));
    });
    box.appendChild(bar);
    back.appendChild(box);
    panel.appendChild(back);
  }

  function sakht_dokme_charkhdande(s) {
    var old = document.querySelector('.crtl-gear');
    if (old) old.remove();
    var wrap = document.createElement('div');
    wrap.className = 'crtl-bar crtl-gear';
    wrap.dataset.side = s.side === 'left' ? 'right' : 'left';
    wrap.style.zIndex = '2147483003';
    var count = document.createElement('div');
    count.id = 'crtl-count';
    wrap.appendChild(count);
    wrap.appendChild(sakht_dokme('aA', 'تنظیمات اندازه و دکمه‌ها', function () {
      var p = document.getElementById('crtl-panel');
      if (!p) return;
      p.classList.toggle('crtl-open');
      if (p.classList.contains('crtl-open')) { porsidan_shenase_chat(); if (TZ.tab === 'claude') tz_porsidan(); } else neshan_shenase_chat();
      ja_baz_kardan_baraye_panel(p);
    }));
    document.body.appendChild(wrap);
  }

  // The open panel is position:fixed, so the conversation has to be told to
  // step aside; otherwise the panel simply sits on top of the text.
  function ja_baz_kardan_baraye_panel(panel) {
    var open = !!(panel && panel.classList.contains('crtl-open'));
    var side = open ? (panel.dataset.side === 'left' ? 'left' : 'right') : '';
    var root = document.documentElement;
    root.classList.toggle('crtl-panel-right', side === 'right');
    root.classList.toggle('crtl-panel-left', side === 'left');
  }

  function sakht_dobare() {
    var s = khandan_tanzim();
    emal_andaze_va_rang(s);
    sakht_dokme_kenar(s);
    sakht_panel_aa(s);
    sakht_dokme_charkhdande(s);
    shomarande_nevise(s);   // sakht_dokme_charkhdande rebuilds #crtl-count, so this runs last
    ja_baz_kardan_baraye_panel(document.getElementById('crtl-panel'));
  }

  function sakht_hame() {
    if (document.getElementById('crtl-panel')) return;
    if (!kadr_tayp()) return;
    var style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    baz_kardan_payam();
    entekhab_matn_soal();
    baz_shodan_ba_hover();
    jam_kardan_fekr_va_abzar();
    menu_naghl();
    bastan_jostojo_ba_esc();
    negahban_khata('glossary', vazhe_name_ru_kalame)();
    bastan_panel_ba_click_birun();
    sakht_dobare();

    // Ctrl+Alt+B hides or shows the button columns
    document.addEventListener('keydown', function (e) {
      if (e.ctrlKey && e.altKey && (e.key === 'b' || e.key === 'B')) {
        var cur = khandan_tanzim(); cur.hidden = !cur.hidden; zakhire_tanzim(cur); emal_andaze_va_rang(cur); sakht_dobare();
      }
      if (e.ctrlKey && e.altKey && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault();
        navar_jostojo();
      }
    });
  }

  // «حدس»: drag a tick onto another to move its part there (Habib, 25 Oct 18:01: «این دکمه ها باید
  // قابلیت جابجایی داشته باشن و با جابجا شدن ردیفشون عوض بشه. یعنی اگه حدس اوله میشه ردیف یک»).
  // Under DRAG_PX it is the tick's own click; past it the click is swallowed and the new order goes
  // to the mod through its hidden field (hads-tartib), which saves it and lays the rows out again.
  function ferestadan_tartib_hads(card, keys) {
    var inp = card.querySelector('input[data-press-key="hads-tartib"]');
    if (!inp) return false;
    // the field is React's: set the value its own way, then the input event it listens to
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(inp, keys.join(' '));
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }
  function keshidan_tik_hads(b, card) {
    b.dataset.crtlKesh = '1';
    // on the button itself: it runs before the click reaches the panel's own handler
    b.addEventListener('click', function (e) {
      if (!b.dataset.dragged) return;
      e.stopPropagation(); e.preventDefault();
    }, true);
    b.addEventListener('mousedown', function (e) {
      if (e.button !== 0) return;
      // the panel's text is selectable: without this a press-and-move selects the label, or drags the
      // selection natively, and no mouseup ever comes (Habib, 25 Oct 19:08: «اکثرا نمیشه جابجاش کرد»)
      e.preventDefault();
      var x0 = e.clientX, y0 = e.clientY, moved = false, last = null;
      function zir(ev) {
        var t = document.elementFromPoint(ev.clientX, ev.clientY);
        t = t && t.closest ? t.closest('button[data-press-key^="hads-tick-"]') : null;
        return t && t !== b && card.contains(t) ? t : null;
      }
      function ghabl(t, ev) {
        var r = t.getBoundingClientRect();
        // the row's own direction: right-to-left, the right half of a tick is before it
        var rtl = getComputedStyle(t.parentElement || t).direction === 'rtl';
        return rtl ? ev.clientX > r.left + r.width / 2 : ev.clientX < r.left + r.width / 2;
      }
      function pak_jay() { if (last) last.classList.remove('crtl-jaye-ghabl', 'crtl-jaye-baad'); last = null; }
      function move(ev) {
        if (!moved && Math.abs(ev.clientX - x0) + Math.abs(ev.clientY - y0) > DRAG_PX) {
          moved = true; b.classList.add('crtl-dragging');
        }
        if (!moved) return;
        b.style.transform = 'translate(' + (ev.clientX - x0) + 'px,' + (ev.clientY - y0) + 'px)';
        var t = zir(ev);
        pak_jay();
        if (t) { last = t; t.classList.add(ghabl(t, ev) ? 'crtl-jaye-ghabl' : 'crtl-jaye-baad'); }
      }
      function up(ev) {
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', up);
        pak_jay();
        b.classList.remove('crtl-dragging');
        b.style.transform = '';
        if (!moved) return;
        b.dataset.dragged = '1';
        setTimeout(function () { delete b.dataset.dragged; }, 0);
        var tgt = zir(ev);
        if (!tgt) return;
        var ticks = card.querySelectorAll('button[data-press-key^="hads-tick-"]');
        var keys = [];
        for (var i = 0; i < ticks.length; i++) keys.push(ticks[i].getAttribute('data-press-key').slice(10));
        var from = b.getAttribute('data-press-key').slice(10), to = tgt.getAttribute('data-press-key').slice(10);
        var before = ghabl(tgt, ev);
        keys.splice(keys.indexOf(from), 1);
        keys.splice(keys.indexOf(to) + (before ? 0 : 1), 0, from);
        ferestadan_tartib_hads(card, keys);
      }
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', up);
    });
  }

  // «حدس» must not jump when «دو جمله» or a part changes (Habib, 25 Oct 19:08: «وقتی که یه خبر جدید میاد یا دو
  // جمله جدید میاد نپره»): within a turn the band and the «دو جمله» part never shrink back (their tallest height
  // is their least); a turn's end or start («جمع‌بندی:» ⇄ «دو جمله:»), a press on a button inside, a change of
  // state or a resized window lets them fit again, so a tall «جمع‌بندی» leaves no empty space under the next
  // short line (26 Oct 01:57: «یه جای خالی بزرگ زیر دو جمله ای به وجود اومده»). The height is read from the
  // children, never by letting go of it: let go, the browser pulled a scrolled band up. Scrolled to the end,
  // the band stays at the end.
  function ertefa_mohtava(el) {
    var cs = getComputedStyle(el), c = el.children, h = 0;
    if (c.length) h = c[c.length - 1].getBoundingClientRect().bottom - c[0].getBoundingClientRect().top;
    h += parseFloat(cs.paddingTop || 0) + parseFloat(cs.paddingBottom || 0);
    if (cs.boxSizing === 'border-box') h += parseFloat(cs.borderTopWidth || 0) + parseFloat(cs.borderBottomWidth || 0);
    var max = parseFloat(cs.maxHeight);
    return max >= 0 && max < h ? max : h;
  }
  function sabet_hads(card) {
    var band = card.querySelector('[class*="band_"]');
    if (!band) return;
    if (band.dataset.crtlSabet) { band.__crtl_negah && band.__crtl_negah(); return; }
    band.dataset.crtlSabet = '1';
    var payin = false, bishtarin = new WeakMap(), negah_dar_kar = false, barchasb = null;
    function rahakardan() { band.style.minHeight = ''; var o = band.querySelectorAll('.crtl-hads-sabet'); for (var i = 0; i < o.length; i++) { o[i].style.minHeight = ''; o[i].classList.remove('crtl-hads-sabet'); } bishtarin = new WeakMap(); }
    function negah_dar(el) {
      var h = ertefa_mohtava(el), m = bishtarin.get(el) || 0;
      if (h > m) { m = h; bishtarin.set(el, m); }
      el.style.minHeight = m + 'px'; el.classList.add('crtl-hads-sabet');
    }
    function do_jomle_bakhsh() {
      var ls = band.querySelectorAll('span[class*="text_"]');
      for (var i = 0; i < ls.length; i++) {
        var t = (ls[i].textContent || '').trim();
        if (t !== 'دو جمله:' && t !== 'جمع‌بندی:') continue;
        // the part's own box: the label's row, then the box that holds that row
        var row = ls[i].parentElement, part = row && row.parentElement;
        return { el: part && part !== band ? part : row, barchasb: t };
      }
      return null;
    }
    function negah() {
      if (negah_dar_kar) return;
      negah_dar_kar = true;
      try {
        if (card.classList.contains('crtl-hads-tak-dokme') || !card.querySelector('.crtl-hads-radif-bala')) { rahakardan(); barchasb = null; return; }
        var dj = do_jomle_bakhsh(), b = dj ? dj.barchasb : null;
        if (b !== barchasb) { rahakardan(); barchasb = b; }
        if (dj) negah_dar(dj.el);
        negah_dar(band);
        if (payin) band.scrollTop = band.scrollHeight;
      } finally { negah_dar_kar = false; }
    }
    band.__crtl_negah = negah;
    band.addEventListener('scroll', function () { payin = band.scrollHeight - band.scrollTop - band.clientHeight < 6; }, { passive: true });
    card.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('button')) { rahakardan(); setTimeout(negah, 0); } }, true);
    window.addEventListener('resize', function () { rahakardan(); negah(); });
    new MutationObserver(negah).observe(band, { childList: true, subtree: true, characterData: true });
    negah();
  }

  // hooks in the chat: tag the 🪝 meta lines, open/close them on a click (not when the click
  // ends a text selection), and mark focus view, where the panel folds the rest
  function neshan_hook_va_hads() {
    // messages that are not Habib's: another session's, or a plugin's own prompt (its «Prompt from …» label)
    var um = document.querySelectorAll('[class*="userMessage_"]');
    for (var u = 0; u < um.length; u++) {
      var ct = um[u].closest('[class*="userMessageContainer_"]');
      var digar = !!(ct && ct.querySelector('[class*="promptLabel_"]')) ||
        // the answer to an AskUserQuestion window comes as «Answering your earlier questions:» (Habib, 26 Oct 18:30: «بله همه این کارا رو بکن»)
        // by its first words too: in VS Code the label was not found beside the pinned copy (26 Oct 05:56, screenshot)
        /^\s*(?:Another Claude session sent a message|The [^\n]{1,60} plugin sent a message|Answering your earlier question)/.test((um[u].textContent || '').slice(0, 120));
      if (digar !== um[u].classList.contains('crtl-payam-digar')) um[u].classList.toggle('crtl-payam-digar', digar);
      // the hads mod's own message: one whole line with ▸, a click opens it and closes it, like a hook line
      // (Habib, 28 Oct 18:31: «لاگ حدس نمایشش توی صفحه مثل هندآف و اینها بشه یعنی روش باید کلیک بکنیم تا باز
      // بشه یه خط کامل ازش بیاد»)
      if (!um[u].classList.contains('crtl-payam-hads') && /^\s*The hads plugin sent a message/.test((um[u].textContent || '').slice(0, 80))) {
        um[u].classList.add('crtl-payam-hads');
        um[u].addEventListener('click', function () {
          var sel = window.getSelection && window.getSelection();
          if (sel && String(sel).length) return;
          this.classList.toggle('crtl-hads-baz');
        });
      }
    }
    var ms = document.querySelectorAll('[class*="metaMessage_"]:not(.crtl-hook)');
    for (var i = 0; i < ms.length; i++) {
      // the panel's own «UserPromptSubmit says: …» (a hook's systemMessage): not on the screen, the hook line
      // shows what the hook injected (Habib, 26 Oct 05:46: «این هم دیگه نیاد روی صفحه»)
      if (/^\s*[A-Za-z]+(?::[A-Za-z]+)? says: /.test((ms[i].textContent || '').slice(0, 60))) { ms[i].classList.add('crtl-hook-says'); continue; }
      // the 🪝 may come after an icon the panel draws in front: look at the first few characters
      var head = (ms[i].textContent || '').slice(0, 12);
      if (head.indexOf('\u2063') < 0 && head.indexOf('🪝') < 0) continue;
      ms[i].classList.add('crtl-hook');
      ms[i].addEventListener('click', function () {
        var sel = window.getSelection && window.getSelection();
        if (sel && String(sel).length) return;
        this.classList.toggle('crtl-hook-baz');
      });
    }
    document.documentElement.classList.toggle('crtl-focus-on', !!document.querySelector('[class*="focusFoldRow_"]'));
    // the «حدس» box: the panel's own header line says «From the hads plugin»; tag its card and
    // its tick buttons (✓ on, ✗ off) and the small ⤵ for the macOS look
    var marks = document.querySelectorAll('[class*="abovePrompt_"] [data-engine-mark]');
    for (var k = 0; k < marks.length; k++) {
      if (!/\bhads plugin\b/.test(marks[k].textContent || '')) continue;
      var card = marks[k].parentElement;
      if (!card) continue;
      card.classList.add('crtl-hads');
      var bs = card.querySelectorAll('button');
      sabet_hads(card);
      shenavar_thinking(card);
      // only the «حدس ▸» button left: the card shrinks to it
      card.classList.toggle('crtl-hads-tak-dokme', bs.length <= 2 && !!card.querySelector('button[data-press-key="hads-dot"]'));
      for (var b = 0; b < bs.length; b++) {
        var tx = (bs[b].textContent || '').trim();
        if (/^hads-tick-/.test(bs[b].getAttribute('data-press-key') || '') && !bs[b].dataset.crtlKesh) keshidan_tik_hads(bs[b], card);
        bs[b].classList.toggle('crtl-tik-roshan', tx.charAt(0) === '✓');
        bs[b].classList.toggle('crtl-tik-khamush', tx.charAt(0) === '✗');
        bs[b].classList.toggle('crtl-gozashtan-dar-kadr', tx === '⤵');
        // ×: its row sticks to the top of the box, so it never scrolls out of sight. Found by its key, hads-x:
        // since ▾ and the one-line state went (26 Oct 19:18) the open box's × is the only one
        if (bs[b].getAttribute('data-press-key') === 'hads-x' && bs[b].parentElement && bs[b].parentElement.querySelectorAll('button').length <= 3) bs[b].parentElement.classList.add('crtl-hads-radif-bala');
      }
    }
  }
  /* «thinking» floats: no window, only words over the chat, fading in one by one (Habib, 8 Nov 17:10: «مثل یه
     فلوت ویندو باشه که حتی ویندوش قابل دیدن نباشه فقط کلمه ها بیان»). The mod's three rows are found by their
     labels, hidden in the card, and their sentences drawn in a fixed, see-through, click-through layer. */
  var BARCHASB_THINKING = ['به چه فکر کرد:', 'چه کرد:', 'بعدش:'], thinking_akhar = '';
  function shenavar_thinking(card) {
    var ls = card.querySelectorAll('span[class*="text_"]'), jomle_ha = [];
    for (var i = 0; i < ls.length; i++) {
      if (BARCHASB_THINKING.indexOf((ls[i].textContent || '').trim()) < 0) continue;
      var row = ls[i].parentElement; if (!row) continue;
      row.classList.add('crtl-fekr-radif');
      var s = ls[i].nextElementSibling; if (s) jomle_ha.push((s.textContent || '').trim());
    }
    var lay = document.getElementById('crtl-fekr-shenavar');
    // the «حدس» box closed or its rows gone: the last words stay, above the prompt box (Habib, 8 Nov 17:25:
    // «فقط وقتی که پنجره حدس بازه … ببندیمش نمیاد»)
    if (!jomle_ha.length) { if (lay) ja_thinking(lay, null); return; }
    if (!lay) { lay = sakhtan_shenavar(); thinking_akhar = ''; }
    if (lay.dataset.sid !== shenase_fekr()) { lay.dataset.sid = shenase_fekr(); thinking_akhar = ''; }
    ja_thinking(lay, card);
    var matn = jomle_ha.join('\n');
    if (matn === thinking_akhar) return;
    thinking_akhar = matn;
    // every new thinking gets a number; ‹ › next to ⠿ walk back and forth (Habib, 8 Nov 20:04: «قبلی ها هم
    // شمارش داشته باشن … این طرف و اون طرف بتونه بره عقب و جلو»)
    var ta = tarikhche_fekr();
    if (ta[ta.length - 1] !== matn) { ta.push(matn); if (ta.length > HAD_TARIKHCHE_FEKR) ta.splice(0, ta.length - HAD_TARIKHCHE_FEKR); zakhire_tarikhche_fekr(ta); }
    neshan_fekr(lay, ta.length - 1, true);
  }
  // one list per chat: localStorage is shared by every chat tab, so one key mixed all chats' thinking
  // (Habib, 8 Nov 20:56: «فکر کردنای همهٔ چت‌ها رو پشت سر هم داره میاره … باید اینها جدا بشه»).
  // No chat id known yet ⇒ the list lives only in this page, never in a shared key.
  var KELID_TARIKHCHE_FEKR_PAYE = 'crtl-fekr-tarikhche', HAD_TARIKHCHE_FEKR = 100, tarikhche_bi_shenase = [];
  try { localStorage.removeItem(KELID_TARIKHCHE_FEKR_PAYE); } catch (e) {}
  function shenase_fekr() { return SESSION.sid || khandan_shenase_chat_az_state() || ''; }
  function tarikhche_fekr() {
    var sid = shenase_fekr(); if (!sid) return tarikhche_bi_shenase;
    try { var a = JSON.parse(localStorage.getItem(KELID_TARIKHCHE_FEKR_PAYE + ':' + sid) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; }
  }
  function zakhire_tarikhche_fekr(ta) {
    var sid = shenase_fekr(); if (!sid) { tarikhche_bi_shenase = ta; return; }
    try { localStorage.setItem(KELID_TARIKHCHE_FEKR_PAYE + ':' + sid, JSON.stringify(ta)); } catch (e) {}
  }
  function neshan_fekr(lay, i, ba_harekat) {
    var ta = tarikhche_fekr(); if (!ta.length) return;
    i = Math.max(0, Math.min(ta.length - 1, i)); lay.dataset.shomare = i;
    var sh = lay.querySelector('.crtl-fekr-shomare'); if (sh) sh.textContent = (i + 1) + '/' + ta.length;
    var jaye = lay.querySelector('.crtl-fekr-matn'); jaye.textContent = '';
    var jomle_ha = ta[i].split('\n'), n = 0;
    for (var j = 0; j < jomle_ha.length; j++) {
      var p = document.createElement('div'); p.className = 'crtl-fekr-jomle';
      var ws = jomle_ha[j].split(/\s+/);
      for (var w = 0; w < ws.length; w++) {
        var sp = document.createElement('span'); sp.className = 'crtl-fekr-kalame';
        sp.textContent = ws[w] + ' '; if (ba_harekat) sp.style.animationDelay = (n++ * 90) + 'ms'; else sp.style.animation = 'none', sp.style.opacity = '.85'; p.appendChild(sp);
      }
      jaye.appendChild(p);
    }
  }
  function ja_thinking(lay, card) {
    // the top corner of the chat, small, out of the answer's and the question window's way (Habib, 8 Nov 17:43:
    // «گوشهٔ بالای چت، کوچک»)
    // a place Habib picked (dragged by ⠿) wins
    if (lay.dataset.ja) return;
    var mc = document.querySelector('[class*="messagesContainer_"]');
    lay.style.top = Math.max(4, (mc ? mc.getBoundingClientRect().top : 0) + 6) + 'px';
  }
  // movable by its ⠿ handle and resizable by its corner, both kept in localStorage (Habib, 8 Nov 18:03:
  // «کوچیک بزرگ کردن بکن و قابل جابه‌جایی تو صفحه که هر جایی که به نظرم میاد همونجا بذارم»); the text stays selectable
  var KELID_JA_FEKR = 'crtl-fekr-ja';
  function sakhtan_shenavar() {
    var lay = document.createElement('div'); lay.id = 'crtl-fekr-shenavar'; lay.setAttribute('dir', 'rtl');
    var dg = document.createElement('div'); dg.className = 'crtl-fekr-dastgire'; dg.title = 'بکش تا جابه‌جا شود';
    function dokme_fekr(matn, onvan, gam) {
      var b = document.createElement('span'); b.className = 'crtl-fekr-dokme'; b.textContent = matn; b.title = onvan;
      b.addEventListener('mousedown', function (e) { e.stopPropagation(); e.preventDefault(); });
      b.addEventListener('click', function (e) { e.stopPropagation(); neshan_fekr(lay, (+lay.dataset.shomare || 0) + gam, false); });
      return b;
    }
    var sh = document.createElement('span'); sh.className = 'crtl-fekr-shomare';
    var gire = document.createElement('span'); gire.textContent = ' ⠿ ';
    // rtl: the right one goes back (older), the left one forward (newer)
    dg.appendChild(dokme_fekr('›', 'قبلی', -1)); dg.appendChild(sh); dg.appendChild(gire); dg.appendChild(dokme_fekr('‹', 'بعدی', 1));
    var jaye = document.createElement('div'); jaye.className = 'crtl-fekr-matn';
    lay.appendChild(dg); lay.appendChild(jaye); document.body.appendChild(lay);
    var ja = null; try { ja = JSON.parse(localStorage.getItem(KELID_JA_FEKR) || 'null'); } catch (e) {}
    if (ja) {
      if (ja.x != null) { lay.style.left = ja.x + 'px'; lay.style.top = ja.y + 'px'; lay.style.right = 'auto'; lay.dataset.ja = '1'; }
      if (ja.w) { lay.style.width = ja.w + 'px'; lay.style.height = ja.h + 'px'; }
    }
    function zakhire() {
      var r = lay.getBoundingClientRect(), o = {};
      if (lay.dataset.ja) { o.x = Math.round(r.left); o.y = Math.round(r.top); }
      if (lay.dataset.andaze) { o.w = Math.round(r.width); o.h = Math.round(r.height); }
      try { localStorage.setItem(KELID_JA_FEKR, JSON.stringify(o)); } catch (e) {}
    }
    dg.addEventListener('mousedown', function (e) {
      if (e.button !== 0) return; e.preventDefault();
      var r = lay.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top;
      function harekat(m) {
        lay.style.right = 'auto'; lay.dataset.ja = '1';
        lay.style.left = Math.max(0, Math.min(window.innerWidth - 40, m.clientX - dx)) + 'px';
        lay.style.top = Math.max(0, Math.min(window.innerHeight - 20, m.clientY - dy)) + 'px';
      }
      function vel() { document.removeEventListener('mousemove', harekat); document.removeEventListener('mouseup', vel); zakhire(); }
      document.addEventListener('mousemove', harekat); document.addEventListener('mouseup', vel);
    });
    // the corner (CSS resize) changes the size: kept when the mouse lets go on the box
    var andaze_ghabl = '';
    lay.addEventListener('mouseup', function () {
      var a = lay.offsetWidth + 'x' + lay.offsetHeight;
      if (andaze_ghabl && a !== andaze_ghabl) { lay.dataset.andaze = '1'; zakhire(); }
      andaze_ghabl = a;
    });
    lay.addEventListener('mousedown', function () { andaze_ghabl = lay.offsetWidth + 'x' + lay.offsetHeight; });
    if (ja && ja.w) lay.dataset.andaze = '1';
    return lay;
  }
  function thinking_bi_kadr() {
    var lay = document.getElementById('crtl-fekr-shenavar');
    if (lay && !document.querySelector('.crtl-hads .crtl-fekr-radif')) ja_thinking(lay, document.querySelector('.crtl-hads'));
  }
  window.__crtl_shenavar_thinking = shenavar_thinking;
  window.__crtl_set_sid = function (sid) { SESSION.sid = sid; };  // tests only
  setInterval(function () { neshan_hook_va_hads(); thinking_bi_kadr(); }, 700);
  window.__crtl_neshan_hook_va_hads = neshan_hook_va_hads;

  /* ---------------- «تماس‌ها»: how often «حدس» called a model ---------------- */
  // A small table left of the prompt box, movable: per part, the last hour, the last 24 h and all; a click opens
  // it big, every call with its tokens and dollars (Habib, 26 Oct 21:54: «سمت چپ که خالیه یه جدول کوچیک بذار …
  // قابل جابجایی … یک ساعت اخیر 24 ساعت اخیر کل … خودکار رو عمودی بنویس … اگر بزرگش بکنم … ریز بریز با مقدار
  // مقادیر کامل»). The data is one hidden line the hads mod renders in its box (neshane_amar, register.js).
  var NESHANE_AMAR = '⁣AMAR', KELID_JA_AMAR = 'crtl-amar-ja';
  var sotun_amar = [['do_jomle', 'دو جمله'], ['hads', 'حدس'], ['ravand', 'روند'], ['nakarde', 'نکرده'], ['khodkar', 'خودکار'], ['cron', 'کرون'],
    ['jambandi_nobat', 'جمع‌بندی'], ['porsesh', 'پرسش'], ['kol', 'کل']];
  var radif_amar = [['saat', '۱ ساعت'], ['ruz', '۲۴ ساعت'], ['hame', 'کل']];
  var amar_matn_akhar = '', amar_bozorg = false, ja_kuchak_amar = null;
  function fa(n) { return String(n).replace(/\d/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'[d]; }); }
  function dolar(n) { return '$' + (n >= 1 ? n.toFixed(2) : n.toFixed(3)); }
  // small: no row names, they take the most room (Habib, 26 Oct 23:12: «اون قسمت ستون اول رو حذف کن که جا بگیره
  // خودم میفهمم»); the rows stay in the same order, 1 h · 24 h · all, and big shows the names
  function jadval_kuchak(a, ba_esm) {
    var h = '<table class="crtl-amar-t"><tr>' + (ba_esm ? '<th></th>' : '');
    sotun_amar.forEach(function (c) { h += '<th><span class="crtl-amar-amudi">' + c[1] + '</span></th>'; });
    h += '</tr>';
    radif_amar.forEach(function (r) {
      h += '<tr>' + (ba_esm ? '<td class="crtl-amar-r">' + r[1] + '</td>' : '');
      sotun_amar.forEach(function (c) { var n = (a[r[0]] || {})[c[0]] || 0; h += '<td' + (n ? '' : ' class="crtl-amar-sefr"') + '>' + fa(n) + '</td>'; });
      h += '</tr>';
    });
    return h + '</table>';
  }
  function jadval_bozorg(a) {
    var esm = {}; sotun_amar.forEach(function (c) { esm[c[0]] = c[1]; });
    var h = '<div class="crtl-amar-sar"><b>تماس‌های «حدس» در همین چت</b><button class="crtl-amar-bastan" title="کوچک کن">×</button></div>' + jadval_kuchak(a, true);
    h += '<div class="crtl-amar-dolar">' + radif_amar.map(function (r) { return r[1] + ': <b>' + dolar((a[r[0]] || {}).usd || 0) + '</b>'; }).join(' · ') + '</div>';
    h += '<table class="crtl-amar-riz"><tr><th>ساعت</th><th>کارها</th><th>مدل</th><th>ورودی</th><th>خروجی</th><th>نوشتنِ کش</th><th>خواندنِ کش</th><th>دلار</th></tr>';
    (a.riz || []).forEach(function (x) {
      var d = new Date(x.t), t = d.toLocaleString('fa-IR', { timeZone: 'Asia/Tehran', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      h += '<tr><td>' + t + '</td><td>' + x.b.map(function (k) { return esm[k] || k; }).join('، ') + '</td><td>' + (x.rah === 'sonnet' ? 'Sonnet' : 'fork (Opus)') + '</td>' +
        [x['in'], x.out, x.cw, x.cr].map(function (n) { return '<td>' + fa(n.toLocaleString('en-US')) + '</td>'; }).join('') + '<td>' + dolar(x.usd) + '</td></tr>';
    });
    return h + '</table>';
  }
  // big remembers where the small one sat; × or a click anywhere else puts it back there, small (Habib, 26 Oct
  // 23:46: «دکمه ضربدر برش نمیگردونه سرجاش-- با کلیک جای دیگه تصویر باید مینیمایز بشه بره سر جای قبلیش»)
  function amar_bozorgi(bale) {
    var box = document.getElementById('crtl-amar');
    if (!box || bale === amar_bozorg) return;
    if (bale) ja_kuchak_amar = { left: box.style.left, top: box.style.top, bottom: box.style.bottom };
    else if (ja_kuchak_amar) { box.style.left = ja_kuchak_amar.left; box.style.top = ja_kuchak_amar.top; box.style.bottom = ja_kuchak_amar.bottom; }
    amar_bozorg = bale; amar_matn_akhar = ''; jadval_tamas();
  }
  document.addEventListener('pointerdown', function (e) {
    if (amar_bozorg && !(e.target.closest && e.target.closest('#crtl-amar'))) amar_bozorgi(false);
  }, true);
  function jadval_tamas() {
    var spans = document.querySelectorAll('[class*="abovePrompt_"] span'), dade = null;
    for (var i = 0; i < spans.length; i++) {
      var tx = spans[i].textContent || '';
      if (tx.indexOf(NESHANE_AMAR) !== 0) continue;
      spans[i].classList.add('crtl-amar-pinhan');
      dade = tx;
    }
    var box = document.getElementById('crtl-amar');
    if (!dade) { if (box) box.style.display = 'none'; return; }
    if (!box) {
      box = document.createElement('div');
      box.id = 'crtl-amar';
      try { var ja = JSON.parse(localStorage.getItem(KELID_JA_AMAR) || 'null'); if (ja) { box.style.left = ja.x + 'px'; box.style.top = ja.y + 'px'; box.style.bottom = 'auto'; } } catch (e) {}
      // a press that does not move opens or closes it; one that moves drags it, and the place is kept
      box.addEventListener('pointerdown', function (e) {
        if (e.button !== 0) return;
        // big: only its title row moves or closes it, so the rows can be read and selected
        if (amar_bozorg && !(e.target.closest && e.target.closest('.crtl-amar-sar'))) return;
        var r = box.getBoundingClientRect(), x0 = e.clientX, y0 = e.clientY, raft = false;
        function harekat(m) {
          if (!raft && Math.abs(m.clientX - x0) + Math.abs(m.clientY - y0) < 4) return;
          raft = true;
          box.style.left = Math.max(0, Math.min(window.innerWidth - 40, r.left + m.clientX - x0)) + 'px';
          box.style.top = Math.max(0, Math.min(window.innerHeight - 20, r.top + m.clientY - y0)) + 'px';
          box.style.bottom = 'auto';
        }
        function vel() {
          document.removeEventListener('pointermove', harekat); document.removeEventListener('pointerup', vel);
          if (raft) { try { localStorage.setItem(KELID_JA_AMAR, JSON.stringify({ x: parseInt(box.style.left, 10), y: parseInt(box.style.top, 10) })); } catch (e2) {} return; }
          amar_bozorgi(!amar_bozorg);
        }
        document.addEventListener('pointermove', harekat); document.addEventListener('pointerup', vel);
      });
      document.body.appendChild(box);
    }
    box.style.display = '';
    box.classList.toggle('crtl-amar-bozorg', amar_bozorg);
    if (dade === amar_matn_akhar) return;
    amar_matn_akhar = dade;
    var a; try { a = JSON.parse(dade.slice(NESHANE_AMAR.length)); } catch (e) { return; }
    box.innerHTML = amar_bozorg ? jadval_bozorg(a) : jadval_kuchak(a);
    // opened big near the bottom it ran past the window (26 Oct 23:40, seen in a screenshot): kept inside it
    var r = box.getBoundingClientRect();
    if (r.bottom > window.innerHeight - 4) { box.style.top = Math.max(4, window.innerHeight - r.height - 4) + 'px'; box.style.bottom = 'auto'; }
    if (r.right > window.innerWidth - 4) box.style.left = Math.max(4, window.innerWidth - r.width - 4) + 'px';
  }
  (function () {
    var st = document.createElement('style');
    st.id = 'crtl-amar-style';
    st.textContent = [
      '.crtl-amar-pinhan{display:none!important}',
      '#crtl-amar{position:fixed;left:8px;bottom:8px;z-index:2147483001;direction:rtl;font:9px/1.25 -apple-system,BlinkMacSystemFont,Vazirmatn,sans-serif;color:var(--vscode-foreground);' +
        'background:color-mix(in srgb,var(--vscode-editorWidget-background,#2c2c2e) 88%,transparent);border:.5px solid rgba(128,128,128,.32);border-radius:6px;padding:2px;' +
        'box-shadow:0 2px 8px rgba(0,0,0,.25);cursor:grab;user-select:none;-webkit-user-select:none;touch-action:none}',
      '#crtl-amar table{border-collapse:collapse}',
      // lines between the cells, and narrow, so it fits beside the prompt box (Habib, 26 Oct 23:14: «توی جدول خطهای افقی عمودی
      // جدول باشه -- و اینکه باریکتر کن جا بگیره اون کنار»)
      '#crtl-amar td,#crtl-amar th{padding:0 1px;min-width:13px;text-align:center;white-space:nowrap;border:.5px solid rgba(128,128,128,.4)}',
      '#crtl-amar .crtl-amar-amudi{writing-mode:vertical-rl;transform:rotate(180deg);display:inline-block;font-weight:400;opacity:.7;max-height:5em;padding:1px 0}',
      '#crtl-amar .crtl-amar-r{opacity:.7;text-align:right}',
      '#crtl-amar .crtl-amar-sefr{opacity:.35}',
      '#crtl-amar.crtl-amar-bozorg{max-width:min(720px,92vw);max-height:65vh;overflow:auto;font-size:11px;padding:6px 8px;cursor:default;user-select:text;-webkit-user-select:text;background:var(--vscode-editorWidget-background,#2c2c2e)}',
      '#crtl-amar .crtl-amar-sar{display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;cursor:grab}',
      '#crtl-amar .crtl-amar-bastan{background:none;border:none;color:inherit;font-size:14px;cursor:pointer}',
      '#crtl-amar .crtl-amar-dolar{margin:4px 0;opacity:.85}',
      '#crtl-amar .crtl-amar-riz th{position:sticky;top:-6px;background:var(--vscode-editorWidget-background,#2c2c2e);font-weight:600}',
      '#crtl-amar .crtl-amar-riz td{border-top:.5px solid rgba(128,128,128,.2)}'
    ].join('\n');
    (document.head || document.documentElement).appendChild(st);
  })();
  setInterval(jadval_tamas, 1000);
  // the hidden line is hidden the moment the box draws it, not up to a second later: it showed in the folded
  // box now and then (Habib, 26 Oct 23:12: «اون کلمات گاهی میاد تو کادر بسته حدس»)
  var amar_dar_rah = false;
  try {
    new MutationObserver(function () {
      if (amar_dar_rah) return;
      amar_dar_rah = true;
      requestAnimationFrame(function () { amar_dar_rah = false; jadval_tamas(); });
    }).observe(document.body || document.documentElement, { childList: true, subtree: true, characterData: true });
  } catch (e) {}
  window.__crtl_jadval_tamas = jadval_tamas;

  /* ---------------- «ترجمه»: the hads mod's Persian in place of an English answer ---------------- */
  // Only the view changes; the chat's file never does. The original stays one press away.
  var tarjome_ha = {}, tarjome_mt = 0, tarjome_sid = '';
  function kelid_tarjome(text) {
    return (String(text || '').match(/[A-Za-zء-يپچژکگی]/g) || []).slice(0, 60).join('');
  }
  function khat_matn_tarjome(parent, text) {
    String(text).split(/(`[^`]+`|\*\*[^*]+\*\*)/).forEach(function (run) {
      if (!run) return;
      var code = /^`[^`]+`$/.test(run), bold = /^\*\*[^*]+\*\*$/.test(run);
      if (!code && !bold) return parent.appendChild(document.createTextNode(run));
      var el = document.createElement(code ? 'code' : 'strong');
      el.textContent = code ? run.slice(1, -1) : run.slice(2, -2);
      parent.appendChild(el);
    });
  }
  // a small markdown drawing, by DOM nodes only: the text never becomes HTML
  function sakht_tarjome(text, out) {
    var lines = String(text).split('\n'), i = 0;
    function add(tag, t) { var el = document.createElement(tag); if (t !== undefined) khat_matn_tarjome(el, t); out.appendChild(el); return el; }
    while (i < lines.length) {
      var l = lines[i], m;
      if (/^```/.test(l)) {
        var code = []; i++;
        while (i < lines.length && !/^```/.test(lines[i])) code.push(lines[i++]);
        i++;
        var pre = add('pre'); pre.dir = 'ltr'; pre.textContent = code.join('\n');
      } else if (/^\s*\|.*\|\s*$/.test(l)) {
        var table = add('table');
        for (; i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i]); i++) {
          if (/^\s*\|[\s:|-]+\|\s*$/.test(lines[i])) continue;
          var tr = table.insertRow();
          lines[i].trim().slice(1, -1).split('|').forEach(function (c) { khat_matn_tarjome(tr.insertCell(), c.trim()); });
        }
      } else if ((m = l.match(/^(#{1,6})\s+(.*)/))) { add('h' + Math.min(m[1].length + 2, 6), m[2]); i++; }
      else if (/^\s*([-*]|\d+\.)\s+/.test(l)) {
        var ol = /^\s*\d/.test(l), list = add(ol ? 'ol' : 'ul');
        for (; i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i]); i++) {
          var li = document.createElement('li'); khat_matn_tarjome(li, lines[i].replace(/^\s*([-*]|\d+\.)\s+/, '')); list.appendChild(li);
        }
      } else { if (l.trim()) add('p', l); i++; }
    }
  }
  function neshan_tarjome() {
    var root = document.querySelector('[class*="messagesContainer_"]');
    if (!root) return;
    root.querySelectorAll('[class*="message_"]').forEach(function (n) {
      if (n.querySelector('[class*="message_"]') || n.closest('[class*="userMessage_"]') || n.querySelector(':scope > .crtl-tarjome-jabe')) return;
      var stamp = n.querySelector('[data-message-stamp]');
      var matn = n.textContent || '';
      if (stamp) matn = matn.replace(stamp.textContent || '', '');
      var t = tarjome_ha[kelid_tarjome(matn)];
      if (!t) return;
      var jabe = document.createElement('div'); jabe.className = 'crtl-tarjome-jabe'; jabe.dir = 'rtl';
      var btn = document.createElement('button'); btn.type = 'button'; btn.className = 'crtl-tarjome-dokme'; btn.textContent = 'اصلِ انگلیسی';
      btn.addEventListener('click', function () {
        var asl = n.classList.toggle('crtl-tarjome-asl');
        btn.textContent = asl ? 'ترجمهٔ فارسی' : 'اصلِ انگلیسی';
      });
      var matn_el = document.createElement('div'); matn_el.className = 'crtl-tarjome-matn';
      sakht_tarjome(t, matn_el);
      jabe.appendChild(btn); jabe.appendChild(matn_el); n.appendChild(jabe);
      n.classList.add('crtl-tarjome-shod');
    });
  }
  window.__crtl_tarjome_resid = function (d) {
    tarjome_mt = d.mt;
    String(d.text || '').split('\n').forEach(function (l) {
      try { var o = JSON.parse(l); if (o.kelid && o.text) tarjome_ha[o.kelid] = o.text; } catch (e) {}
    });
    neshan_tarjome();
  };
  (function () {
    var st = document.createElement('style');
    st.textContent = [
      '.crtl-tarjome-shod:not(.crtl-tarjome-asl)>*:not(.crtl-tarjome-jabe):not([data-message-stamp]){display:none!important}',
      '.crtl-tarjome-asl .crtl-tarjome-matn{display:none}',
      '.crtl-tarjome-dokme{font-size:10px;opacity:.6;background:none;border:.5px solid rgba(128,128,128,.4);border-radius:5px;color:inherit;cursor:pointer;padding:0 5px;margin-bottom:3px}',
      '.crtl-tarjome-matn table{border-collapse:collapse;margin:4px 0}',
      '.crtl-tarjome-matn td{border:.5px solid rgba(128,128,128,.4);padding:2px 6px}',
      '.crtl-tarjome-matn pre{overflow:auto;padding:6px;background:rgba(128,128,128,.12);border-radius:5px}'
    ].join('\n');
    (document.head || document.documentElement).appendChild(st);
  })();
  setInterval(function () {
    var api = window.acquireVsCodeApi && window.acquireVsCodeApi.__crtl ? window.acquireVsCodeApi() : null;
    if (!api || !SESSION.sid) return;
    if (SESSION.sid !== tarjome_sid) { tarjome_sid = SESSION.sid; tarjome_ha = {}; tarjome_mt = 0; }
    api.postMessage({ type: 'crtl-tarjome', sid: SESSION.sid, mt: tarjome_mt });
    neshan_tarjome();
  }, 3000);
  window.__crtl_kelid_tarjome = kelid_tarjome;

  // no give-up: a sign-in or onboarding screen can keep the composer away for minutes (Codex,
  // 31 Oct: the row never came after a login that took longer than the old 30 s limit)
  var timer = setInterval(function () {
    sakht_hame();
    if (document.getElementById('crtl-panel')) clearInterval(timer);
  }, 500);
  document.addEventListener('DOMContentLoaded', sakht_hame);
})();
