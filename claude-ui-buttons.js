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
  window.addEventListener('message', function (e) {
    var d = e.data;
    if (!d) return;
    if (d.type === 'crtl-session-info') {
      if (d.sid === SESSION.sid) { SESSION.name = d.name || ''; SESSION.title = d.title || ''; SESSION.remote = d.remote || ''; SESSION.card = d.card || ''; SESSION.pending = !!d.pending; paintSession(); }
      return;
    }
    var m = d.type === 'from-extension' && d.message;
    var io = m && m.type === 'io_message' && m.message;
    var sid = io && (io.session_id || io.sessionId);
    if (typeof sid === 'string' && /^[0-9a-f-]{36}$/.test(sid)) SESSION.sid = sid;
  });
  // Right after a reload no CLI message has arrived yet, but the app keeps
  // its own sessionID in the tab's vscode state — read it, never write it.
  // vsApi exists only once the app has called acquireVsCodeApi; calling it
  // here first would change the app's start-up order.
  function sidFromState() {
    try {
      var st = vsApi && vsApi.getState ? vsApi.getState() : null;
      var sid = st && st.sessionID;
      return typeof sid === 'string' && /^[0-9a-f-]{36}$/.test(sid) ? sid : '';
    } catch (e) { return ''; }
  }
  function askSession() {
    if (!SESSION.sid) SESSION.sid = sidFromState();
    SESSION.name = ''; SESSION.title = ''; SESSION.remote = ''; SESSION.card = ''; SESSION.pending = true;
    paintSession();
    var api = window.acquireVsCodeApi && window.acquireVsCodeApi.__crtl ? window.acquireVsCodeApi() : null;
    if (api && SESSION.sid) api.postMessage({ type: 'crtl-session-info', sid: SESSION.sid });
  }
  function paintSession() {
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
  function guard(name, fn) {
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
    { label: "rc",    text: "/remote-control",    side: "left",  send: false }
  ];

  /* ---------------- settings ---------------- */
  var KEY = 'crtl-sizes';
  var DEF = {
    chat: 15, code: 12, chrome: 10, btn: 10,
    lines: 1,          // 0 = show user messages in full
    side: 'both',      // both | left | right
    hidden: false,
    collapse: true,    // dim/shrink Thinking and tool-call blocks
    tableScroll: true,
    pos: {},           // { left: {x,y}, right: {x,y} } drag offsets
    commands: null,    // null = use DEFAULT_COMMANDS
    accent: '',        // '' = inherit the theme's own colours
    textColor: '',     // '' = the theme's own conversation text colour
    lh: 16,            // conversation line height, in tenths (16 = 1.6)
    opacity: 65,       // resting opacity of the buttons, in percent
    profiles: {},      // { name: settings snapshot }
    counter: true,     // show the composer character counter
    quoteMenu: true,   // right-click a selection to quote it into the composer
    extraText: '',     // custom text glued on by "copy with extra text"
    extraPos: 'end',   // start | end — where that text goes
    extraOnCopyBtn: false // also glue it on with the copy button under each reply
  };
  var LIMITS = { chat: [9, 22], code: [8, 18], chrome: [7, 20], btn: [7, 20], lh: [11, 24] };
  var PRESETS = {
    compact: { chat: 12, code: 10, chrome: 9,  btn: 9,  lines: 1, lh: 14 },
    normal:  { chat: 15, code: 12, chrome: 10, btn: 10, lines: 1, lh: 16 },
    large:   { chat: 19, code: 15, chrome: 12, btn: 12, lines: 2, lh: 17 }
  };

  // The script can seed defaults by defining window.__CRTL_DEFAULTS before this runs.
  if (window.__CRTL_DEFAULTS) { try { Object.assign(DEF, window.__CRTL_DEFAULTS); } catch (e) {} }

  // Object.assign is shallow, so a settings object built straight from DEF
  // would share DEF's own `pos` and `profiles` objects — dragging a column or
  // saving a profile then wrote into the defaults themselves, and "rst" handed
  // those same polluted objects back. Everything nested gets its own copy.
  function fresh() {
    var d = Object.assign({}, DEF);
    try { d = JSON.parse(JSON.stringify(d)); } catch (e) { d.pos = {}; d.profiles = {}; }
    if (!d.pos || typeof d.pos !== 'object') d.pos = {};
    if (!d.profiles || typeof d.profiles !== 'object') d.profiles = {};
    return d;
  }

  function load() {
    var s;
    try { s = Object.assign(fresh(), JSON.parse(localStorage.getItem(KEY) || '{}')); }
    catch (e) { s = fresh(); }
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
    return s;
  }
  function sharedProfileNames() {
    return (DEF.profiles && typeof DEF.profiles === 'object') ? Object.keys(DEF.profiles) : [];
  }
  function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} }
  function commands(s) {
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

  function applyCss(s) {
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
      ':root{--crtl-btn-size:' + s.btn + 'px;--crtl-btn-opacity:' + (s.opacity / 100) + '}',
      accent ? '.crtl-btn{border-color:' + accent + '!important;color:' + accent + '!important}' : '',
      accent ? '.crtl-panel{border-color:' + accent + '!important}' : '',
      // the conversation ink follows the theme unless a colour is picked; code
      // keeps its own highlighting, so it is left out on purpose
      ink ? msg + ',' + msg + ' p,' + msg + ' li,' + msg + ' span,' + msg + ' strong,' + msg + ' b,' +
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
      out.push('[class*="userMessage_"]:not(.crtl-expanded){overflow:hidden!important}');
      out.push(inner + '{display:-webkit-box!important;-webkit-line-clamp:' + s.lines +
        '!important;-webkit-box-orient:vertical!important;overflow:hidden!important;max-height:none!important}');
      out.push('[class*="userMessage_"]:not(.crtl-expanded) [class*="truncationGradient"]{display:none!important}');
      out.push('[class*="userMessage_"]:not(.crtl-expanded).crtl-hovered [class*="content_"]' +
        '{-webkit-line-clamp:unset!important;display:block!important;max-height:none!important}');
    } else {
      out.push('[class*="userMessage_"] [class*="content_"]{display:block!important;' +
        '-webkit-line-clamp:unset!important;max-height:none!important}');
    }

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
  function input() {
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
  function caretToEnd(el) {
    var sel = window.getSelection();
    if (!sel) return;
    var r = document.createRange();
    r.selectNodeContents(el);
    r.collapse(false);
    sel.removeAllRanges();
    sel.addRange(r);
  }

  function insertLines(text) {
    var parts = String(text).replace(/\r\n?/g, '\n').split('\n');
    parts.forEach(function (run, i) {
      if (i > 0) document.execCommand('insertLineBreak');
      if (run) document.execCommand('insertText', false, run);
    });
  }

  function type(el, text) {
    el.focus();
    if (el.isContentEditable) { caretToEnd(el); insertLines(text); return; }
    var proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement : HTMLInputElement;
    Object.getOwnPropertyDescriptor(proto.prototype, 'value').set
      .call(el, (el.value ? el.value + ' ' : '') + text);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function send(el) {
    ['keydown', 'keypress', 'keyup'].forEach(function (t) {
      el.dispatchEvent(new KeyboardEvent(t, {
        key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true
      }));
    });
  }

  function setValue(el, v) {
    el.focus();
    if (el.isContentEditable) {
      document.execCommand('selectAll', false, null);
      if (v) insertLines(v);
      else document.execCommand('delete', false, null);
      return;
    }
    var proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement : HTMLInputElement;
    Object.getOwnPropertyDescriptor(proto.prototype, 'value').set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }

  // Open the actions menu ("/") and click an item by its label, then clean up.
  function clickMenu(label) {
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
    var el = input();
    if (!el) return;
    function read() { return (el.isContentEditable ? el.textContent : el.value) || ''; }
    var before = read();
    setValue(el, '/');
    setTimeout(function () {
      hit();
      setTimeout(function () {
        // Only clean up our own "/" — a menu item such as "Add selection"
        // writes into the composer itself, and restoring `before` on top of
        // that threw the item's own text away.
        var now = read();
        if (now === '/' || now === '') setValue(el, before);
      }, 120);
    }, 350);
  }

  /* ---------------- small DOM helpers ---------------- */
  function btn(label, title, onClick, cls) {
    var b = document.createElement('button');
    b.className = 'crtl-btn' + (cls ? ' ' + cls : '');
    b.type = 'button';
    b.textContent = label;
    b.title = title;
    b.addEventListener('click', function (e) { e.preventDefault(); onClick(e); });
    return b;
  }

  function row(labelText, control) {
    var r = document.createElement('div');
    r.className = 'crtl-row';
    var l = document.createElement('label');
    l.textContent = labelText;
    r.appendChild(l);
    r.appendChild(control);
    return r;
  }

  // a slider and a number box that stay in sync and share one commit path
  function sizeRow(labelText, field, s, onChange) {
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
      v = Math.min(hi, Math.max(lo, parseInt(v, 10) || DEF[field]));
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
  function wireHoverIntent() {
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
  function wireExpand() {
    if (document.__crtlExpandWired) return;
    document.__crtlExpandWired = true;
    document.addEventListener('click', function (e) {
      var s = load();
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
  function wireBlocks() {
    if (document.__crtlBlocksWired) return;
    document.__crtlBlocksWired = true;
    document.addEventListener('click', function (e) {
      if (!load().collapse) return;
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
  function findBar() {
    var old = document.getElementById('crtl-find');
    if (old) { old.remove(); clearMarks(); return; }
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
      clearMarks();
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
      if (e.key === 'Escape' || e.key === 'Esc') { e.preventDefault(); closeFind(); return; }
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
    close.addEventListener('click', closeFind);
    box.appendChild(inp);
    box.appendChild(info);
    box.appendChild(close);
    document.body.appendChild(box);
    inp.focus();
  }

  // Escape has to reach this from anywhere: the app swallows keys inside the
  // composer, so the listener sits on the document in the capture phase.
  function closePanel() {
    var p = document.getElementById('crtl-panel');
    if (!p || !p.classList.contains('crtl-open')) return false;
    p.classList.remove('crtl-open');
    syncPanelRoom(p);
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
  function wireGlossary() {
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
    function row(k, v, cls) { return v ? '<div class="r"><span class="k">' + k + ':</span> <span class="' + (cls || '') + '">' + v + '</span></div>' : ''; }
    function render(name) {
      return G[name].map(function (e) {
        var h = '<div class="h">' + esc(name) + '  <span class="k">(' + esc(e.p) + ')</span></div>';
        h += row('یعنی', esc(e.yani));
        if (e.val) h += row('مقدار فعلی در برگه', '<span dir="ltr">' + esc(e.val.v) + '</span>');
        h += row('نویسنده', esc(e.ozv));
        if (e.kh && e.kh.length) h += row('خواننده‌ها', esc(e.kh.join('، ')));
        h += row('چرا', esc(e.chera));
        h += row('تأیید', esc(e.tayid), /پیشنهاد/.test(e.tayid || '') ? 'pend' : '');
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

  function wirePanelDismiss() {
    if (document.__crtlDismissWired) return;
    document.__crtlDismissWired = true;
    document.addEventListener('mousedown', function (e) {
      var p = document.getElementById('crtl-panel');
      if (!p || !p.classList.contains('crtl-open')) return;
      if (p.contains(e.target)) return;
      // the gear column carries the aA toggle; let it do its own toggling
      if (e.target.closest && e.target.closest('.crtl-bar')) return;
      closePanel();
    }, true);
  }

  function closeFind() {
    var box = document.getElementById('crtl-find');
    if (!box) return false;
    box.remove();
    clearMarks();
    return true;
  }
  function wireFindEscape() {
    if (document.__crtlFindEscWired) return;
    document.__crtlFindEscWired = true;
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape' && e.key !== 'Esc') return;
      if (closeFind() || closePanel()) { e.preventDefault(); e.stopPropagation(); }
    }, true);
  }
  function clearMarks() {
    var m = document.querySelectorAll('.crtl-hit');
    for (var i = 0; i < m.length; i++) m[i].classList.remove('crtl-hit');
  }

  // the text from the aA panel, glued before or after — a blank line between
  function withExtra(text) {
    var s = load(), extra = String(s.extraText || '').trim();
    if (!extra) return text;
    return s.extraPos === 'start' ? extra + '\n\n' + text : text + '\n\n' + extra;
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
      if (hit && typeof t === 'string' && load().extraOnCopyBtn) t = withExtra(t);
      return orig(t);
    };
    wrapped.__crtl = true;
    try { cb.writeText = wrapped; } catch (e) {}
  })();

  /* ---------------- copy the conversation ---------------- */
  function copyConversation() {
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
    copyText(md, function () { panelNote(msg); },
             function () { panelNote('کلیپ‌بورد اجازه نداد'); });
    return msg;
  }

  /* ---------------- quote a selection into the composer ---------------- */
  function quoteInto(text, asQuote) {
    var el = input();
    if (!el) return;
    var body = asQuote ? text.split('\n').map(function (l) { return '> ' + l; }).join('\n') : text;
    var cur = el.isContentEditable ? el.textContent : el.value;
    // start the quote on its own line when the composer already has something
    type(el, (cur && !/\n$/.test(cur) ? '\n' : '') + body + '\n\n');
  }

  function ctxMenu() {
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

  function wireQuoteMenu() {
    if (document.__crtlCtxWired) return;
    document.__crtlCtxWired = true;

    document.addEventListener('contextmenu', function (e) {
      if (!load().quoteMenu) return;
      var sel = window.getSelection();
      var text = sel ? sel.toString().trim() : '';
      if (!text) return;

      // only for text picked out of the conversation, never the composer
      var root = document.querySelector('[class*="messagesContainer_"]');
      var node = sel.anchorNode;
      var inside = false;
      while (node) {
        if (node === root) { inside = true; break; }
        node = node.parentNode;
      }
      if (!inside) return;

      e.preventDefault();
      var m = ctxMenu();
      m.textContent = '';
      var short = text.length > 30 ? text.slice(0, 30) + '…' : text;

      [
        ['⧉ کپی با الصاق متن ویژه', function () { copyText(withExtra(text)); }],
        ['↩︎ نقل‌قول در چت', function () { quoteInto(text, true); }],
        ['✎ بدون علامت نقل‌قول', function () { quoteInto(text, false); }],
        ['⧉ کپی', function () { copyText(text); }],
        ['🔍 جست‌وجوی همین متن', function () {
          var box = document.getElementById('crtl-find');
          if (!box) findBar();
          var inp = document.querySelector('#crtl-find input');
          if (inp) { inp.value = text.slice(0, 60); inp.dispatchEvent(new Event('input')); }
        }],
        ['؟ بپرس دربارهٔ «' + short + '»', function () {
          quoteInto(text, true);
          var el = input();
          if (el) type(el, 'دربارهٔ این بخش توضیح بده: ');
        }]
      ].forEach(function (row) {
        var b = document.createElement('button');
        b.type = 'button';
        b.textContent = row[0];
        b.addEventListener('click', function (ev) {
          ev.preventDefault();
          m.style.display = 'none';
          row[1]();
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
      quoteInto(text, true);
    });
  }

  /* ---------------- composer counter ---------------- */
  // The counter used to poll once a second forever — even switched off — and
  // each tick swept the whole document. Now the timer only exists while the
  // counter is on, and the expensive usage scan runs once every ten ticks.
  var counterTimer = null, usageCache = '', usageTick = 0;

  function counterTick() {
    var tag = document.getElementById('crtl-count');
    if (!tag) return;
    var el = input();
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

  function syncCounter(s) {
    if (s.counter && !counterTimer) {
      usageTick = 0;
      counterTimer = setInterval(counterTick, 1000);
      counterTick();
    } else if (!s.counter && counterTimer) {
      clearInterval(counterTimer);
      counterTimer = null;
      var tag = document.getElementById('crtl-count');
      if (tag) tag.textContent = '';
    }
  }

  /* ---------------- dragging the button columns ---------------- */
  function applyPos(bar, s) {
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

  function makeDraggable(bar, grip) {
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
        var s = load();
        s.pos[bar.dataset.side] = { x: ev.clientX - dx, y: ev.clientY - dy };
        save(s);
      }
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', up);
    });
  }


  /* ---------------- self-diagnosis ---------------- */
  // "It stopped working" is unactionable from here, so the panel can report
  // exactly which anchor the patch failed to find, plus any captured error.
  function diagnose() {
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
      'composer found     : ' + (input() ? 'yes (' + (input().tagName || '?') + ')' : 'NO'),
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
    return lines.concat(mirrorParity(), clampReport()).join('\n');
  }

  // How many lines a collapsed user message actually ends up showing.
  function clampReport() {
    var m = document.querySelector('[class*="userMessage_"]');
    if (!m) return ['', 'user message      : none on screen'];
    var c = m.querySelector('[class*="content_"]') || m;
    var cs = getComputedStyle(c);
    var lh = parseFloat(cs.lineHeight) || 0;
    var shown = lh ? Math.round(c.clientHeight / lh * 10) / 10 : '?';
    return ['', 'user message clamp:',
      '  setting        ' + load().lines + ' line(s)',
      '  target found   ' + (c === m ? 'content_ MISSING (fell back to userMessage_)' : 'content_'),
      '  line-clamp     ' + (cs.webkitLineClamp || cs.getPropertyValue('-webkit-line-clamp') || 'none'),
      '  rendered lines ' + shown];
  }

  // The composer paints its text transparent and shows an absolutely positioned
  // mirror instead, so the two layers must agree on every metric. Any row that
  // says MISMATCH is a caret landing in the wrong place.
  function mirrorParity() {
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
  function copyText(txt, onOK, onFail) {
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
  function exportable() {
    var cur = load();
    return { chat: cur.chat, code: cur.code, chrome: cur.chrome, btn: cur.btn,
             lines: cur.lines, side: cur.side, collapse: cur.collapse,
             tableScroll: cur.tableScroll, accent: cur.accent,
             textColor: cur.textColor, lh: cur.lh,
             opacity: cur.opacity, counter: cur.counter, quoteMenu: cur.quoteMenu,
             extraText: cur.extraText, extraPos: cur.extraPos, extraOnCopyBtn: cur.extraOnCopyBtn,
             profiles: cur.profiles, commands: cur.commands };
  }

  function panelNote(msg) {
    var n = document.querySelector('#crtl-panel .crtl-note');
    if (n) n.textContent = msg;
  }

  var FILE_NAME = 'claude-rtl-settings.json';

  // The webview CSP is `default-src 'none'`, so writing a file from here is
  // impossible — no blob download, no save picker. The clipboard is the one
  // channel that always works, so copy-here / paste-there is the main route.
  function copySettings() {
    var txt = JSON.stringify(exportable(), null, 2);
    var ta = document.getElementById('crtl-io');
    // the text lands in the visible box first, so a blocked clipboard still
    // leaves something the user can select and copy by hand
    if (ta) { ta.value = txt; }
    copyText(txt,
      function () { panelNote('کپی شد ✓ — در IDE دیگر داخل همین کادر پیست کن'); },
      function () {
        if (ta) { ta.focus(); ta.select(); }
        panelNote('کلیپ‌بورد اجازه نداد — متن در کادر انتخاب شد، Cmd+C بزن');
      });
  }

  function loadFromFile() {
    var inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = '.json,application/json';
    inp.style.cssText = 'position:fixed;left:-9999px;width:1px;height:1px';
    inp.addEventListener('change', function () {
      var f = inp.files && inp.files[0];
      inp.remove();
      if (!f) return;
      var r = new FileReader();
      r.onload = function () { applyImported(String(r.result), f.name); };
      r.onerror = function () { panelNote('فایل خوانده نشد'); };
      r.readAsText(f);
    });
    document.body.appendChild(inp);
    inp.click();
  }

  function applyImported(txt, fileName) {
    var incoming;
    try { incoming = JSON.parse(txt); }
    catch (e) { panelNote('این فایل JSON معتبر نیست'); return; }
    if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
      panelNote('ساختار فایل درست نیست'); return;
    }
    var cur = load();
    var mergedProfiles = Object.assign({}, cur.profiles, incoming.profiles || {});
    var merged = Object.assign(cur, incoming);
    merged.profiles = mergedProfiles;
    save(merged);
    draftCommands = null;
    applyCss(load());
    rerender();
    panelNote('«' + (fileName || FILE_NAME) + '» خوانده شد ✓ — ' +
              Object.keys(mergedProfiles).length + ' پروفایل');
  }

  /* ---------------- rendering ---------------- */
  function sideOf(cmd, s) {
    if (s.side === 'left' || s.side === 'right') return s.side;
    return cmd.side || 'right';
  }

  function renderBars(s) {
    var old = document.querySelectorAll('.crtl-bar');
    for (var i = 0; i < old.length; i++) old[i].remove();

    ['left', 'right'].forEach(function (side) {
      var items = commands(s).filter(function (c) { return sideOf(c, s) === side; });
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
        bar.appendChild(btn(c.label, c.text || c.menu || '', function () {
          if (c.menu) { clickMenu(c.menu); return; }
          var el = input();
          if (!el) return;
          type(el, c.text);
          if (c.send) setTimeout(function () { send(el); }, 60);
        }));
      });

      document.body.appendChild(bar);
      applyPos(bar, s);
      makeDraggable(bar, grip);
    });
  }

  var draftCommands = null;      // unsaved text sitting in the JSON editor
  var draftProfileName = '';     // profile name typed but not saved yet

  function renderPanel(s) {
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
      var cur = load();
      cur[field] = value;
      save(cur);
      applyCss(cur);
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
      panel.appendChild(row(f[0], val));
    });
    var cpRow = document.createElement('div');
    cpRow.className = 'crtl-actions';
    var cpAll = btn('کپی همه', 'همهٔ مشخصات این چت را یک‌جا کپی کن — برای پیام دادن از دستگاه دیگر', function () {
      var v = SESSION.card;
      if (!v) { cpAll.textContent = 'هنوز آماده نیست'; setTimeout(function () { cpAll.textContent = 'کپی همه'; }, 1200); return; }
      copyText(v, function () { cpAll.textContent = '✓ کپی شد'; setTimeout(function () { cpAll.textContent = 'کپی همه'; }, 1200); },
        function () { cpAll.textContent = '✗'; setTimeout(function () { cpAll.textContent = 'کپی همه'; }, 1200); });
    });
    cpRow.appendChild(cpAll);
    panel.appendChild(cpRow);
    panel.appendChild(document.createElement('div')).className = 'crtl-sep';

    // presets
    var presetRow = document.createElement('div');
    presetRow.className = 'crtl-actions';
    [['فشرده', 'compact'], ['معمولی', 'normal'], ['درشت', 'large']].forEach(function (p) {
      presetRow.appendChild(btn(p[0], 'پیش‌تنظیم ' + p[0], function () {
        var cur = Object.assign(load(), PRESETS[p[1]]);
        save(cur); applyCss(cur); rerender();
      }));
    });
    panel.appendChild(row('پیش‌تنظیم', presetRow));
    panel.appendChild(document.createElement('div')).className = 'crtl-sep';

    // sizes
    panel.appendChild(sizeRow('متن گفتگو', 'chat', s, set));
    panel.appendChild(sizeRow('کد و جدول', 'code', s, set));
    panel.appendChild(sizeRow('حواشی', 'chrome', s, set));
    panel.appendChild(sizeRow('دکمه‌ها', 'btn', s, set));

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
    panel.appendChild(row('فاصلهٔ خطوط', lhWrap));

    var opa = document.createElement('input');
    opa.type = 'range'; opa.min = 20; opa.max = 100; opa.value = s.opacity;
    opa.addEventListener('input', function () { set('opacity', parseInt(opa.value, 10)); });
    panel.appendChild(row('شفافیت', opa));

    var color = document.createElement('input');
    color.type = 'color';
    color.value = s.accent || '#888888';
    color.style.cssText = 'width:44px;height:20px;padding:0;border:0;background:none';
    color.addEventListener('change', function () { set('accent', color.value); rerender(); });
    var colorWrap = document.createElement('div');
    colorWrap.className = 'crtl-actions';
    colorWrap.appendChild(color);
    colorWrap.appendChild(btn('بی‌رنگ', 'برگشت به رنگ خود تم', function () {
      var cur = load(); cur.accent = ''; save(cur); applyCss(cur); rerender();
    }));
    panel.appendChild(row('رنگ دکمه‌ها', colorWrap));

    var ink = document.createElement('input');
    ink.type = 'color';
    ink.value = s.textColor || '#dddddd';
    ink.style.cssText = 'width:44px;height:20px;padding:0;border:0;background:none';
    ink.addEventListener('change', function () { set('textColor', ink.value); rerender(); });
    var inkWrap = document.createElement('div');
    inkWrap.className = 'crtl-actions';
    inkWrap.appendChild(ink);
    inkWrap.appendChild(btn('بی‌رنگ', 'برگشت به رنگ متن خود تم', function () {
      var cur = load(); cur.textColor = ''; save(cur); applyCss(cur); rerender();
    }));
    panel.appendChild(row('رنگ متن', inkWrap));
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
    panel.appendChild(row('پیام خودت', lineSel));

    // button placement
    var sideSel = document.createElement('select');
    [['هر دو طرف', 'both'], ['همه چپ', 'left'], ['همه راست', 'right']].forEach(function (o) {
      var opt = document.createElement('option');
      opt.textContent = o[0]; opt.value = o[1];
      if (s.side === o[1]) opt.selected = true;
      sideSel.appendChild(opt);
    });
    sideSel.addEventListener('change', function () {
      var cur = load(); cur.side = sideSel.value; cur.pos = {}; save(cur); rerender();
    });
    panel.appendChild(row('جای دکمه‌ها', sideSel));

    // toggles
    var toggles = document.createElement('div');
    toggles.className = 'crtl-actions';
    toggles.appendChild(btn(s.collapse ? 'جمع: روشن' : 'جمع: خاموش',
      'کوچک‌کردن بخش‌های Thinking و tool call', function () {
        var cur = load(); cur.collapse = !cur.collapse; save(cur); applyCss(cur); rerender();
      }));
    toggles.appendChild(btn(s.tableScroll ? 'جدول: اسکرول' : 'جدول: آزاد',
      'اسکرول افقی برای جدول و کد پهن', function () {
        var cur = load(); cur.tableScroll = !cur.tableScroll; save(cur); applyCss(cur); rerender();
      }));
    toggles.appendChild(btn(s.hidden ? 'دکمه‌ها: مخفی' : 'دکمه‌ها: پیدا',
      'مخفی/نمایش ستون دکمه‌ها — میانبر: Ctrl+Alt+B', function () {
        var cur = load(); cur.hidden = !cur.hidden; save(cur); applyCss(cur); rerender();
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
    var fromFile = sharedProfileNames();
    names.forEach(function (n) {
      var o = document.createElement('option');
      o.textContent = n + (fromFile.indexOf(n) !== -1 ? '  ⇩' : '');
      o.value = n;
      profSel.appendChild(o);
    });
    profSel.addEventListener('change', function () {
      if (!profSel.value) return;
      var cur = load();
      var snap = cur.profiles[profSel.value] || {};
      save(Object.assign(cur, snap));
      applyCss(load()); rerender();
    });
    panel.appendChild(row('پروفایل', profSel));

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
      var cur = load();
      var name = (profName.value || '').trim() ||
                 ('پروفایل ' + (Object.keys(cur.profiles).length + 1));
      cur.profiles[name] = {
        chat: cur.chat, code: cur.code, chrome: cur.chrome, btn: cur.btn,
        lines: cur.lines, side: cur.side, collapse: cur.collapse,
        tableScroll: cur.tableScroll, accent: cur.accent, opacity: cur.opacity,
        textColor: cur.textColor, lh: cur.lh
      };
      save(cur);
      draftProfileName = '';
      rerender();
      var n = document.querySelector('#crtl-panel .crtl-note');
      if (n) n.textContent = 'پروفایل «' + name + '» ذخیره شد ✓';
    }
    profName.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); saveProfile(); }
    });

    profRow.appendChild(profName);
    profRow.appendChild(btn('ذخیره', 'تنظیمات فعلی را با همین نام نگه دار (Enter هم کار می‌کند)', saveProfile));
    profRow.appendChild(btn('حذف', 'پاک‌کردن پروفایل انتخاب‌شده', function () {
      if (!profSel.value) return;
      var cur = load();
      delete cur.profiles[profSel.value];
      save(cur); rerender();
    }));
    panel.appendChild(profRow);
    panel.appendChild(document.createElement('div')).className = 'crtl-sep';

    // conversation tools
    var tools = document.createElement('div');
    tools.className = 'crtl-actions';
    tools.appendChild(btn('جست‌وجو', 'جست‌وجو در گفتگو — Ctrl+Alt+F', findBar));
    tools.appendChild(btn('کپی گفتگو', 'کپی کل گفتگو به مارک‌داون', function () {
      note.textContent = copyConversation();
    }));
    tools.appendChild(btn('sel', 'کدی که در ادیتور (فایل باز، نه چت) انتخاب کرده‌ای را به گفتگو اضافه می‌کند — همان Add selection در منوی /', function () {
      clickMenu('Add selection');
    }));
    tools.appendChild(btn(s.quoteMenu ? 'راست‌کلیک: روشن' : 'راست‌کلیک: خاموش',
      'منوی نقل‌قول روی متن انتخاب‌شده — میانبر: Ctrl+Alt+Q', function () {
        var cur = load(); cur.quoteMenu = !cur.quoteMenu; save(cur); rerender();
      }));
    tools.appendChild(btn(s.counter ? 'شمارنده: روشن' : 'شمارنده: خاموش',
      'شمارندهٔ نویسه و مصرف کانتکست', function () {
        var cur = load(); cur.counter = !cur.counter; save(cur); rerender();
      }));
    panel.appendChild(tools);

    // custom text for "copy with extra text" in the right-click menu
    var extra = document.createElement('textarea');
    extra.rows = 2;
    extra.dir = 'auto';
    extra.placeholder = 'متن ویژه — با «کپی با الصاق متن ویژه» در راست‌کلیک به متن کپی‌شده می‌چسبد';
    extra.value = s.extraText || '';
    extra.style.cssText = 'flex:1;min-width:0;resize:vertical;background:rgba(127,127,127,.15);' +
      'border:1px solid rgba(127,127,127,.35);border-radius:4px;color:inherit;padding:2px 4px;font:inherit';
    extra.addEventListener('input', function () { var cur = load(); cur.extraText = extra.value; save(cur); });
    var extraWrap = document.createElement('div');
    extraWrap.className = 'crtl-actions';
    extraWrap.style.cssText = 'flex:1;min-width:0;gap:6px';
    extraWrap.appendChild(extra);
    var posBtn = btn(s.extraPos === 'start' ? 'اول متن' : 'آخر متن', 'جای متن ویژه: اول یا آخر متن کپی‌شده', function () {
      var cur = load(); cur.extraPos = cur.extraPos === 'start' ? 'end' : 'start'; save(cur); rerender();
    });
    posBtn.style.flex = 'none';
    extraWrap.appendChild(posBtn);
    var onBtn = btn(s.extraOnCopyBtn ? '☑ دکمهٔ کپی' : '☐ دکمهٔ کپی',
      'دکمهٔ کپی زیر هر جواب هم متن ویژه را بچسباند یا نه', function () {
        var cur = load(); cur.extraOnCopyBtn = !cur.extraOnCopyBtn; save(cur); rerender();
      });
    onBtn.style.flex = 'none';
    extraWrap.appendChild(onBtn);
    panel.appendChild(row('متن ویژه', extraWrap));
    panel.appendChild(document.createElement('div')).className = 'crtl-sep';

    // command list editor. Every toggle in this panel rebuilds it from scratch,
    // so an unsaved edit is parked in draftCommands and put back on the way in.
    note.textContent = 'لیست دکمه‌ها به صورت JSON:';
    var noteFields = document.createElement('div');
    noteFields.className = 'crtl-note';
    noteFields.style.cssText = 'direction:ltr;text-align:left';
    noteFields.textContent = 'label, text | menu, side, send';
    panel.appendChild(note);
    panel.appendChild(noteFields);
    var ta = document.createElement('textarea');
    ta.value = draftCommands !== null ? draftCommands : JSON.stringify(commands(s), null, 1);
    ta.addEventListener('input', function () { draftCommands = ta.value; });
    panel.appendChild(ta);

    var acts = document.createElement('div');
    acts.className = 'crtl-actions';
    acts.appendChild(btn('ذخیرهٔ لیست', 'اعمال لیست دکمه‌ها', function () {
      try {
        var parsed = JSON.parse(ta.value);
        if (!Array.isArray(parsed)) throw new Error('not an array');
        var cur = load(); cur.commands = parsed; save(cur);
        draftCommands = null;
        rerender();
        var n = document.querySelector('#crtl-panel .crtl-note');
        if (n) n.textContent = 'ذخیره شد ✓';
      } catch (err) {
        note.textContent = 'JSON نامعتبر: ' + err.message;
      }
    }));
    acts.appendChild(btn('لیست پیش‌فرض', 'برگشت لیست دکمه‌ها به حالت اولیه', function () {
      var cur = load(); cur.commands = null; save(cur);
      draftCommands = null;
      rerender();
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
      setTimeout(function () { if (ioBox.value.trim()) applyImported(ioBox.value, 'پیست'); }, 0);
    });
    panel.appendChild(ioBox);

    var fileRow = document.createElement('div');
    fileRow.className = 'crtl-actions';
    fileRow.appendChild(btn('کپی تنظیمات', 'همهٔ تنظیمات و پروفایل‌ها را کپی کن', copySettings));
    fileRow.appendChild(btn('اعمال', 'آنچه در کادر بالا پیست کرده‌ای را اعمال کن', function () {
      if (!ioBox.value.trim()) { panelNote('کادر خالی است'); return; }
      applyImported(ioBox.value, 'پیست');
    }));
    fileRow.appendChild(btn('از فایل', 'به‌جای پیست، یک فایل تنظیمات را باز کن', loadFromFile));
    panel.appendChild(fileRow);

    var acts2 = document.createElement('div');
    acts2.className = 'crtl-actions';
    acts2.appendChild(btn('تست', 'گزارش تشخیص — چه چیزی پیدا شد و چه خطایی رخ داده', function () {
      var report = diagnose();
      copyText(report);
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
    acts2.appendChild(btn('rst', 'برگشت همه‌چیز به پیش‌فرض — شامل جای دکمه‌ها و پروفایل‌ها', function () {
      draftCommands = null;
      save(fresh());
      applyCss(load());
      rerender();
    }));
    panel.appendChild(acts2);

    document.body.appendChild(panel);
    return panel;
  }

  function renderToggle(s) {
    var old = document.querySelector('.crtl-gear');
    if (old) old.remove();
    var wrap = document.createElement('div');
    wrap.className = 'crtl-bar crtl-gear';
    wrap.dataset.side = s.side === 'left' ? 'right' : 'left';
    wrap.style.zIndex = '2147483003';
    var count = document.createElement('div');
    count.id = 'crtl-count';
    wrap.appendChild(count);
    wrap.appendChild(btn('aA', 'تنظیمات اندازه و دکمه‌ها', function () {
      var p = document.getElementById('crtl-panel');
      if (!p) return;
      p.classList.toggle('crtl-open');
      if (p.classList.contains('crtl-open')) askSession(); else paintSession();
      syncPanelRoom(p);
    }));
    document.body.appendChild(wrap);
  }

  // The open panel is position:fixed, so the conversation has to be told to
  // step aside; otherwise the panel simply sits on top of the text.
  function syncPanelRoom(panel) {
    var open = !!(panel && panel.classList.contains('crtl-open'));
    var side = open ? (panel.dataset.side === 'left' ? 'left' : 'right') : '';
    var root = document.documentElement;
    root.classList.toggle('crtl-panel-right', side === 'right');
    root.classList.toggle('crtl-panel-left', side === 'left');
  }

  function rerender() {
    var s = load();
    applyCss(s);
    renderBars(s);
    renderPanel(s);
    renderToggle(s);
    syncCounter(s);   // renderToggle rebuilds #crtl-count, so this runs last
    syncPanelRoom(document.getElementById('crtl-panel'));
  }

  function build() {
    if (document.getElementById('crtl-panel')) return;
    if (!input()) return;
    var style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    wireExpand();
    wireHoverIntent();
    wireBlocks();
    wireQuoteMenu();
    wireFindEscape();
    guard('glossary', wireGlossary)();
    wirePanelDismiss();
    rerender();

    // Ctrl+Alt+B hides or shows the button columns
    document.addEventListener('keydown', function (e) {
      if (e.ctrlKey && e.altKey && (e.key === 'b' || e.key === 'B')) {
        var cur = load(); cur.hidden = !cur.hidden; save(cur); applyCss(cur); rerender();
      }
      if (e.ctrlKey && e.altKey && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault();
        findBar();
      }
    });
  }

  var tries = 0;
  var timer = setInterval(function () {
    build();
    if (document.getElementById('crtl-panel') || ++tries > 60) clearInterval(timer);
  }, 500);
  document.addEventListener('DOMContentLoaded', build);
})();
