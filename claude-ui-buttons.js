/* === CLAUDE-RTL-UI-BUTTONS (injected by fix-rtl-claude.sh) ===
 * A rectangle of quick-command buttons pinned beside the message input.
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
  var COMMANDS = [
    { label: "reme",  text: "/remember:remember", side: "right", send: false },
    { label: "comp",  text: "/compact",           side: "right", send: false },
    { label: "use",   text: "/usage",             side: "right", send: false },
    { label: "art",   text: "\u0627\u06cc\u0646 \u0631\u0648 \u0622\u0631\u062a\u06cc\u0641\u06a9\u062a \u06a9\u0646", side: "right", send: false },
    { label: "focus", menu: "Focus view",         side: "right" },
    { label: "rew",   menu: "Rewind",             side: "right" },
    { label: "rev",   text: "/code-review",       side: "left",  send: false },
    { label: "clr",   text: "/clear",             side: "left",  send: false },
    { label: "btw",   text: "/btw ",              side: "left",  send: false },
    { label: "rc",    text: "/remote-control",    side: "left",  send: false },
    { label: "task",  text: "/tasks",             side: "left",  send: false }
    // \u2190 \u0647\u0631 \u0686\u0642\u062f\u0631 \u062e\u0648\u0627\u0633\u062a\u06cc \u062e\u0637 \u062c\u062f\u06cc\u062f \u0627\u0636\u0627\u0641\u0647 \u06a9\u0646
  ];


  var CSS = [
    '.crtl-bar{position:fixed;bottom:2px;z-index:2147483000;display:flex;flex-direction:column;gap:3px;direction:ltr}',
    '.crtl-bar[data-side="right"]{right:4px;align-items:flex-end}',
    '.crtl-bar[data-side="left"]{left:4px;align-items:flex-start}',
    '.crtl-btn{font:10px/1.3 system-ui,sans-serif;padding:1px 5px;border-radius:4px;',
    'border:1px solid rgba(127,127,127,.35);background:rgba(127,127,127,.14);',
    'color:inherit;cursor:pointer;white-space:nowrap;opacity:.65;direction:ltr}',
    '.crtl-btn:hover{opacity:1;background:rgba(127,127,127,.3)}'
  ].join('');

  function input() {
    return document.querySelector('[aria-label="Message input"]')
        || document.querySelector('textarea')
        || document.querySelector('[contenteditable="true"]');
  }

  function type(el, text) {
    el.focus();
    if (el.isContentEditable) {
      document.execCommand('insertText', false, text);
      return;
    }
    var proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement : HTMLInputElement;
    var setter = Object.getOwnPropertyDescriptor(proto.prototype, 'value').set;
    setter.call(el, (el.value ? el.value + ' ' : '') + text);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function send(el) {
    ['keydown', 'keypress', 'keyup'].forEach(function (t) {
      el.dispatchEvent(new KeyboardEvent(t, {
        key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true
      }));
    });
  }

  // Set the composer content outright (used to open/close the "/" menu).
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
        if (t === label || t === label + '\u2026' || t.indexOf(label) === 0) { n.click(); return true; }
      }
      return false;
    }
    if (hit()) return;
    var el = input();
    if (!el) return;
    var before = el.isContentEditable ? el.textContent : el.value;   // remember what the user had
    setValue(el, '/');                                               // open the slash menu
    setTimeout(function () {
      hit();
      setTimeout(function () { setValue(el, before || ''); }, 120);  // always wipe the stray "/"
    }, 350);
  }

  function build() {
    if (document.querySelector('.crtl-bar')) return;
    if (!input()) return;

    var style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    ['left', 'right'].forEach(function (side) {
      var items = COMMANDS.filter(function (c) { return (c.side || 'right') === side; });
      if (!items.length) return;
      var bar = document.createElement('div');
      bar.className = 'crtl-bar';
      bar.dataset.side = side;
      items.forEach(function (c) {
        var b = document.createElement('button');
        b.className = 'crtl-btn';
        b.type = 'button';
        b.textContent = c.label;
        b.title = c.text;
        b.addEventListener('click', function (e) {
          e.preventDefault();
          if (c.menu) { clickMenu(c.menu); return; }
          var el = input();
          if (!el) return;
          type(el, c.text);
          if (c.send) setTimeout(function () { send(el); }, 60);
        });
        bar.appendChild(b);
      });
      document.body.appendChild(bar);
    });
  }

  var tries = 0;
  var timer = setInterval(function () {
    build();
    if (document.querySelector('.crtl-bar') || ++tries > 60) clearInterval(timer);
  }, 500);
  document.addEventListener('DOMContentLoaded', build);
})();
