/* In-panel tabs over Codex's existing router. No messages are sent, threads
   deleted, or editor contents copied. Native draft/thread stores own the data. */
(function () {
  'use strict';
  if (window.__crtlTabs) return;
  window.__crtlTabs = true;
  var storageKey = 'chatgpt-rtl-panel-tabs-v1';
  var tabs = [], active = null, router = null, bar, list, notice, busy = false;
  var previousPath = null, unsubscribe = null, pickingHistory = false;

  function threadPath(path) {
    return typeof path === 'string' && (path === '/' || path === '/extension/panel/new' || /^\/(local|remote)\/[^/?#]+(?:\?[^#]*)?$/.test(path));
  }
  function readSaved() {
    try {
      var saved = JSON.parse(sessionStorage.getItem(storageKey));
      if (!Array.isArray(saved)) return;
      saved.slice(0, 100).forEach(function (tab) {
        if (tab && threadPath(tab.path) && typeof tab.label === 'string' &&
            !tabs.some(function (t) { return t.path === tab.path; })) {
          tabs.push({path: tab.path, label: tab.label.slice(0, 100)});
        }
      });
    } catch (_) {}
  }
  function save() {
    try { sessionStorage.setItem(storageKey, JSON.stringify(tabs)); } catch (_) {}
  }
  function say(text) { notice.textContent = text; }
  function updateTitle() {
    var title = document.title.trim();
    if (!title || /^(ChatGPT|Codex)$/i.test(title) || currentPath() !== active) return;
    var tab = tabs.find(function (t) { return t.path === active; });
    if (tab && tab.label !== title) { tab.label = title.slice(0, 100); save(); render(); }
  }

  // The installed builds expose their React root as __codexRoot. Locate only
  // the outer RouterProvider's router prop; never edit React's private state.
  // If an update changes this contract, leave the application untouched.
  function memoryRouter(navigator) {
    // MemoryRouter owns its one history listener. Do not replace that listener.
    // Read history state and observe changes without modifying native internals.
    return {
      get state() { return {location: navigator.location, historyAction: navigator.action}; },
      navigate: async function (path) {
        // Leaving settings can require Codex's unsaved-settings confirmation.
        // Preserve that guard while allowing the native loading/home entrypoints.
        if (/^\/settings(?:\/|$)/.test(navigator.location.pathname)) throw Error('Return to a conversation first');
        navigator.push(path);
      },
      subscribe: function (callback) {
        var previous = navigator.location;
        var timer = setInterval(function () {
          if (previous !== navigator.location) { previous = navigator.location; callback({location: previous, historyAction: navigator.action}); }
        }, 100);
        return function () { clearInterval(timer); };
      }
    };
  }
  function locationPath(location) { return location.pathname + (location.search || ''); }
  function findRouter() {
    var root = window.__codexRoot && window.__codexRoot._internalRoot;
    var queue = root && root.current ? [root.current] : [];
    for (var i = 0; i < queue.length && i < 3000; i++) {
      var fiber = queue[i], props = fiber.memoizedProps || {}, value = props.router;
      if (value && typeof value.navigate === 'function' &&
          typeof value.subscribe === 'function' && value.state && value.state.location) return value;
      var nav = props.navigator;
      if (props.location && nav && nav.location && typeof nav.push === 'function' &&
          typeof nav.replace === 'function' && typeof nav.go === 'function' && typeof nav.listen === 'function') {
        return memoryRouter(nav);
      }
      if (fiber.child) queue.push(fiber.child);
      if (fiber.sibling) queue.push(fiber.sibling);
    }
    return null;
  }
  function currentPath() { return router && locationPath(router.state.location); }
  function sync(state) {
    var path = locationPath(state.location);
    if (threadPath(path)) {
      var tab = tabs.find(function (t) { return t.path === path; });
      if (!tab && state.historyAction === 'REPLACE' && previousPath &&
          (previousPath === '/extension/panel/new' || previousPath.indexOf('/local/client-new-thread:') === 0) &&
          path.indexOf('/local/client-new-thread:') !== 0) {
        tab = tabs.find(function (t) { return t.path === previousPath; });
        if (tab) tab.path = path;
      }
      if (!tab) tabs.push({path: path, label: 'گفتگو ' + (tabs.length + 1)});
      active = path;
    } else active = null;
    previousPath = path;
    save(); render();
  }
  async function navigate(path) {
    if (!router || busy) return false;
    busy = true; say(''); render();
    try {
      await router.navigate(path);
      if (currentPath() !== path) {
        say('جابه‌جایی انجام نشد؛ ابتدا پیام داخل گفتگو را بررسی کن.');
        return false;
      }
      sync(router.state);
      return true;
    } catch (_) {
      say('بازکردن گفتگو انجام نشد. دوباره تلاش کن.');
      return false;
    } finally { busy = false; render(); }
  }
  async function closeTab(tab) {
    var index = tabs.indexOf(tab);
    if (index < 0 || busy) return;
    if (active === tab.path) {
      var next = tabs[index + 1] || tabs[index - 1];
      if (!await navigate(next ? next.path : '/')) return;
    }
    tabs = tabs.filter(function (t) { return t !== tab; });
    save(); render();
  }
  function button(text, label, action) {
    var b = document.createElement('button');
    b.type = 'button'; b.textContent = text; b.title = label;
    b.setAttribute('aria-label', label); b.disabled = busy;
    b.addEventListener('click', action); return b;
  }
  function render() {
    if (!list) return;
    var focused = document.activeElement;
    var focusPath = focused && focused.dataset.crtlTab;
    list.replaceChildren();
    tabs.forEach(function (tab) {
      var item = document.createElement('div'); item.className = 'crtl-tab-item';
      var b = button(tab.label, tab.label, function () { navigate(tab.path); });
      b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', String(tab.path === active));
      b.dataset.crtlTab = tab.path; b.dir = 'auto';
      b.addEventListener('dblclick', function () {
        var label = window.prompt('نام این تب:', tab.label);
        if (label && label.trim()) { tab.label = label.trim().slice(0, 100); save(); render(); }
      });
      item.append(b, button('×', 'بستن تب «' + tab.label + '»؛ گفتگو حذف نمی‌شود', function () { closeTab(tab); }));
      list.appendChild(item);
      if (focusPath === tab.path) b.focus({preventScroll: true});
    });
    bar.querySelector('[data-crtl-new-tab]').disabled = !router || busy;
  }
  function historySelection(event) {
    if (!pickingHistory || !router || busy || event.button > 0 || event.metaKey || event.ctrlKey) return;
    var target = event.target instanceof Element ? event.target : null;
    if (!target || target.closest('#crtl-tabs')) return;
    // Native local-history rows expose the title/action in a row component and
    // conversationId in its owning component. Read identity only; never call
    // the native row navigation, which may open a separate editor panel.
    var node = target, fiber = null;
    while (node && !fiber) {
      var key = Object.keys(node).find(function (k) { return k.indexOf('__reactFiber$') === 0; });
      if (key) fiber = node[key];
      node = node.parentElement;
    }
    var row = null, identity = null;
    for (var depth = 0; fiber && depth < 40; depth++, fiber = fiber.return) {
      var props = fiber.memoizedProps || {};
      if (typeof props.ariaLabel === 'string' && typeof props.onClick === 'function') row = props;
      if (row && typeof props.conversationId === 'string') { identity = props; break; }
    }
    if (!row || !identity || !identity.conversationId || /[/?#]/.test(identity.conversationId)) return;
    var action = target.closest('button,[role="button"],a,[role="menuitem"]');
    // Archive, rename and other nested actions must retain their native behavior.
    if (!action || action.getAttribute('aria-label') !== row.ariaLabel) return;
    event.preventDefault(); event.stopImmediatePropagation();
    pickingHistory = false;
    var path = '/local/' + encodeURIComponent(identity.conversationId);
    if (identity.hostId && identity.hostId !== 'local') path += '?hostId=' + encodeURIComponent(identity.hostId);
    document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape',code:'Escape',bubbles:true}));
    navigate(path).then(function (opened) {
      if (!opened) return;
      var tab = tabs.find(function (t) { return t.path === path; });
      if (tab) { tab.label = row.ariaLabel.slice(0,100); save(); render(); }
    });
  }
  function mount() {
    readSaved();
    bar = document.createElement('nav'); bar.id = 'crtl-tabs'; bar.setAttribute('aria-label', 'تب‌های گفتگو');
    list = document.createElement('div'); list.className = 'crtl-tab-list'; list.setAttribute('role', 'tablist');
    list.setAttribute('aria-label', 'گفتگوهای باز');
    var add = button('+', 'چت جدید در همین پنل', function () {
      // Use Codex's real composer entrypoint. Synthetic client thread IDs are
      // pending worktree routes and cannot send until the host creates a thread.
      // There is one native unsent draft; after sending it gets its own thread tab.
      navigate('/extension/panel/new');
    });
    add.dataset.crtlNewTab = '';
    notice = document.createElement('span'); notice.setAttribute('role', 'status'); notice.dir = 'rtl';
    var history = button('گفتگوی قدیمی', 'افزودن گفتگوی قدیمی از تاریخچه به همین پنل', function () {
      pickingHistory = true;
      window.dispatchEvent(new CustomEvent('open-recent-tasks-menu'));
      say('گفتگوی موردنظر را از تاریخچه انتخاب کن.');
    });
    history.dataset.crtlHistory = '';
    document.addEventListener('click', historySelection, true);
    bar.append(list, add, history, notice); document.body.appendChild(bar);
    document.documentElement.classList.add('crtl-has-tabs');
    say('در انتظار آماده‌شدن گفتگو…'); render();
    var titleObserver = new MutationObserver(updateTitle);
    var title = document.head.querySelector('title');
    if (title) titleObserver.observe(title, {childList:true,characterData:true,subtree:true});
    var attempts = 0;
    var timer = setInterval(function () {
      router = findRouter(); attempts++;
      if (router) {
        clearInterval(timer); say(''); unsubscribe = router.subscribe(sync); sync(router.state); updateTitle();
      } else if (attempts >= 120) {
        clearInterval(timer); say('اتصال تب‌ها برقرار نشد؛ این نسخه نیاز به بررسی دارد.');
      }
    }, 500);
    window.addEventListener('pagehide', function () { clearInterval(timer); document.removeEventListener('click', historySelection, true); titleObserver.disconnect(); if (unsubscribe) unsubscribe(); }, {once: true});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, {once: true});
  else mount();
})();
