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
    commands: null     // null = use DEFAULT_COMMANDS
  };
  var LIMITS = { chat: [9, 22], code: [8, 18], chrome: [7, 20], btn: [7, 20] };
  var PRESETS = {
    compact: { chat: 12, code: 10, chrome: 9,  btn: 9,  lines: 1 },
    normal:  { chat: 15, code: 12, chrome: 10, btn: 10, lines: 1 },
    large:   { chat: 19, code: 15, chrome: 12, btn: 12, lines: 2 }
  };

  // The script can seed defaults by defining window.__CRTL_DEFAULTS before this runs.
  if (window.__CRTL_DEFAULTS) { try { Object.assign(DEF, window.__CRTL_DEFAULTS); } catch (e) {} }

  function load() {
    var s;
    try { s = Object.assign({}, DEF, JSON.parse(localStorage.getItem(KEY) || '{}')); }
    catch (e) { s = Object.assign({}, DEF); }
    Object.keys(LIMITS).forEach(function (k) {
      var lo = LIMITS[k][0], hi = LIMITS[k][1];
      if (typeof s[k] !== 'number' || isNaN(s[k])) s[k] = DEF[k];
      s[k] = Math.min(hi, Math.max(lo, s[k]));
    });
    if (!s.pos || typeof s.pos !== 'object') s.pos = {};
    return s;
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
    'color:inherit;cursor:pointer;white-space:nowrap;opacity:.65;direction:ltr}',
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
    '.crtl-row{display:flex;align-items:center;gap:6px;justify-content:space-between}',
    '.crtl-row label{flex:0 0 auto;opacity:.75}',
    '.crtl-row input[type=range]{flex:1;min-width:0;direction:ltr}',
    '.crtl-row input[type=number]{width:44px;direction:ltr;text-align:center;',
    'background:rgba(127,127,127,.15);border:1px solid rgba(127,127,127,.35);border-radius:4px;color:inherit}',
    '.crtl-row select{flex:1;background:rgba(127,127,127,.15);border:1px solid rgba(127,127,127,.35);',
    'border-radius:4px;color:inherit;padding:1px 3px}',
    '.crtl-sep{height:1px;background:rgba(127,127,127,.25);margin:3px 0}',
    '.crtl-panel textarea{width:100%;height:110px;direction:ltr;text-align:left;font:10px/1.4 monospace;',
    'background:rgba(127,127,127,.12);border:1px solid rgba(127,127,127,.35);border-radius:4px;color:inherit}',
    '.crtl-note{opacity:.55;font-size:10px}',
    '.crtl-actions{display:flex;gap:4px;flex-wrap:wrap}'
  ].join('');

  function applyCss(s) {
    var el = document.getElementById('crtl-size-style');
    if (!el) {
      el = document.createElement('style');
      el.id = 'crtl-size-style';
      document.head.appendChild(el);
    }
    var out = [
      ':root{--crtl-btn-size:' + s.btn + 'px}',
      '[class*="messagesContainer_"]{font-size:' + s.chat + 'px!important;line-height:1.8!important}',
      '[class*="messagesContainer_"] p,[class*="messagesContainer_"] li,[class*="messagesContainer_"] [class*="markdown"]{font-size:' + s.chat + 'px!important;line-height:1.8!important}',
      '[class*="messagesContainer_"] pre,[class*="messagesContainer_"] code,[class*="messagesContainer_"] table{font-size:' + s.code + 'px!important;line-height:1.5!important}',
      '[class*="headerTitle"],[class*="footer"],[class*="Footer"],[class*="statusBar"],[class*="toolbar"],[class*="Toolbar"],[class*="badge"],[class*="Badge"]{font-size:' + s.chrome + 'px!important}'
    ];

    // user messages: clamp to N lines, expanded by hover or by click
    if (s.lines > 0) {
      out.push('[class*="userMessage_"]:not(.crtl-expanded){display:-webkit-box!important;-webkit-line-clamp:' +
        s.lines + '!important;-webkit-box-orient:vertical!important;overflow:hidden!important}');
      out.push('[class*="userMessage_"]:not(.crtl-expanded):hover{-webkit-line-clamp:unset!important;display:block!important}');
    } else {
      out.push('[class*="userMessage_"]{display:block!important;-webkit-line-clamp:unset!important}');
    }

    // wide content scrolls inside its own box instead of stretching the page
    if (s.tableScroll) {
      out.push('[class*="messagesContainer_"] table{display:block!important;max-width:100%!important;overflow-x:auto!important;white-space:nowrap!important}');
      out.push('[class*="messagesContainer_"] pre{max-width:100%!important;overflow-x:auto!important}');
      out.push('[class*="messagesContainer_"] pre code{white-space:pre!important}');
    }

    // Thinking / tool-call chatter shrinks out of the way until hovered
    if (s.collapse) {
      out.push('[class*="thinking"],[class*="Thinking"],[class*="toolCall"],[class*="ToolCall"],[class*="collapsible"]{opacity:.45!important;font-size:' + Math.max(8, s.chrome - 1) + 'px!important}');
      out.push('[class*="thinking"]:hover,[class*="Thinking"]:hover,[class*="toolCall"]:hover,[class*="ToolCall"]:hover,[class*="collapsible"]:hover{opacity:1!important}');
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

  function type(el, text) {
    el.focus();
    if (el.isContentEditable) { document.execCommand('insertText', false, text); return; }
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
      if (v) document.execCommand('insertText', false, v);
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
    var before = el.isContentEditable ? el.textContent : el.value;
    setValue(el, '/');
    setTimeout(function () {
      hit();
      setTimeout(function () { setValue(el, before || ''); }, 120);
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

  /* ---------------- click-to-expand on user messages ---------------- */
  function wireExpand() {
    if (document.__crtlExpandWired) return;
    document.__crtlExpandWired = true;
    document.addEventListener('click', function (e) {
      var s = load();
      if (!s.lines) return;
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

  function renderPanel(s) {
    var old = document.querySelector('.crtl-panel');
    var wasOpen = old && old.classList.contains('crtl-open');
    if (old) old.remove();

    var panel = document.createElement('div');
    panel.className = 'crtl-panel' + (wasOpen ? ' crtl-open' : '');
    panel.dataset.side = s.side === 'left' ? 'right' : 'left';

    function set(field, value) {
      var cur = load();
      cur[field] = value;
      save(cur);
      applyCss(cur);
    }

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

    // command list editor
    var note = document.createElement('div');
    note.className = 'crtl-note';
    note.textContent = 'لیست دکمه‌ها (JSON) — label / text یا menu / side / send';
    panel.appendChild(note);
    var ta = document.createElement('textarea');
    ta.value = JSON.stringify(commands(s), null, 1);
    panel.appendChild(ta);

    var acts = document.createElement('div');
    acts.className = 'crtl-actions';
    acts.appendChild(btn('ذخیرهٔ لیست', 'اعمال لیست دکمه‌ها', function () {
      try {
        var parsed = JSON.parse(ta.value);
        if (!Array.isArray(parsed)) throw new Error('not an array');
        var cur = load(); cur.commands = parsed; save(cur); rerender();
        note.textContent = 'ذخیره شد ✓';
      } catch (err) {
        note.textContent = 'JSON نامعتبر: ' + err.message;
      }
    }));
    acts.appendChild(btn('لیست پیش‌فرض', 'برگشت لیست دکمه‌ها به حالت اولیه', function () {
      var cur = load(); cur.commands = null; save(cur); rerender();
    }));
    panel.appendChild(acts);
    panel.appendChild(document.createElement('div')).className = 'crtl-sep';

    // export / reset
    var acts2 = document.createElement('div');
    acts2.className = 'crtl-actions';
    acts2.appendChild(btn('sav', 'کپی تنظیمات برای ~/.claude-rtl-sizes.json', function () {
      var cur = load();
      var out = { chat: cur.chat, code: cur.code, chrome: cur.chrome, btn: cur.btn,
                  lines: cur.lines, side: cur.side, collapse: cur.collapse,
                  tableScroll: cur.tableScroll, commands: cur.commands };
      var txt = JSON.stringify(out, null, 2);
      if (navigator.clipboard) navigator.clipboard.writeText(txt);
      note.textContent = 'کپی شد — در ~/.claude-rtl-sizes.json بریز';
    }));
    acts2.appendChild(btn('rst', 'برگشت همه‌چیز به پیش‌فرض', function () {
      save(Object.assign({}, DEF)); rerender();
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
    wrap.appendChild(btn('aA', 'تنظیمات اندازه و دکمه‌ها', function () {
      var p = document.querySelector('.crtl-panel');
      if (p) p.classList.toggle('crtl-open');
    }));
    document.body.appendChild(wrap);
  }

  function rerender() {
    var s = load();
    applyCss(s);
    renderBars(s);
    renderPanel(s);
    renderToggle(s);
  }

  function build() {
    if (document.querySelector('.crtl-panel')) return;
    if (!input()) return;
    var style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    wireExpand();
    rerender();

    // Ctrl+Alt+B hides or shows the button columns
    document.addEventListener('keydown', function (e) {
      if (e.ctrlKey && e.altKey && (e.key === 'b' || e.key === 'B')) {
        var cur = load(); cur.hidden = !cur.hidden; save(cur); applyCss(cur); rerender();
      }
    });
  }

  var tries = 0;
  var timer = setInterval(function () {
    build();
    if (document.querySelector('.crtl-panel') || ++tries > 60) clearInterval(timer);
  }, 500);
  document.addEventListener('DOMContentLoaded', build);
})();
