/* In-panel tabs over Codex's existing router. No messages are sent, threads
   deleted, or editor contents copied. Native draft/thread stores own the data. */
(function () {
  'use strict';
  if (window.__crtlTabs) return;
  window.__crtlTabs = true;
  var storageKey = 'chatgpt-rtl-panel-tabs-v1';
  var tabs = [], active = null, router = null, bar, list, notice, busy = false;
  var previousPath = null, unsubscribe = null, pickingHistory = false;
  var panelState = null;

  function threadPath(path) {
    return typeof path === 'string' && (path === '/' || path === '/extension/panel/new' || /^\/(local|remote)\/(?!client-new-thread:)[^/?#]+(?:\?[^#]*)?$/.test(path));
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
  // Outside the tab row, which the one-row look hides (Habib, 1 Nov); an error nobody sees is a silent break.
  // Lasting messages sit side by side, so clearing one never loses another (a tabs breakage has no second report).
  var sayTimer = 0, lasting = [];
  function say(text, stay) {
    clearTimeout(sayTimer);
    if (stay && lasting.indexOf(text) < 0) lasting.push(text);
    if (lasting.length) text = lasting.join(' · ');
    else if (text) sayTimer = setTimeout(function () { notice.textContent = ''; }, 8000);
    notice.textContent = text;
  }
  function unsay(text) {
    var at = lasting.indexOf(text);
    if (at < 0) return;
    lasting.splice(at, 1);
    notice.textContent = lasting.join(' · ');
  }
  var FOLDER_MSG = 'پوشه خوانده نشد';
  function folderNotice() {
    if (window.__crtlFolderUnread === true) say(FOLDER_MSG, true);
    else unsay(FOLDER_MSG);
  }
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
    if (panelState && threadPath(path)) {
      try { panelState.write(path); } catch (_) {}
    }
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
    notice = document.createElement('span'); notice.id = 'crtl-payam'; notice.setAttribute('role', 'status'); notice.setAttribute('aria-live', 'polite'); notice.dir = 'rtl';
    var history = button('گفتگوی قدیمی', 'افزودن گفتگوی قدیمی از تاریخچه به همین پنل', function () {
      pickingHistory = true;
      window.dispatchEvent(new CustomEvent('open-recent-tasks-menu'));
      say('گفتگوی موردنظر را از تاریخچه انتخاب کن.');
    });
    history.dataset.crtlHistory = '';
    document.addEventListener('click', historySelection, true);
    window.addEventListener('crtl-folder-read', folderNotice);
    folderNotice();  // the filter may have reported before this script ran
    bar.append(list, add, history); document.body.append(bar, notice);
    // Claude-style head icons beside aA (Habib, 31 Oct: «مثل همون کلود کد باشه»): ⊕ new chat, 🕘 earlier chats.
    var sar = document.createElement('div'); sar.id = 'crtl-sar';
    function icon(svg, label, action) {
      var b = document.createElement('button'); b.type = 'button'; b.title = label; b.setAttribute('aria-label', label);
      b.innerHTML = svg; b.addEventListener('click', action); return b;
    }
    var SVG = 'width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"';
    var nowe = icon('<svg ' + SVG + '><circle cx="8" cy="8" r="6.3"/><path d="M8 5v6M5 8h6"/></svg>', 'گفتگوی تازه', function () { add.click(); });
    nowe.dataset.crtlSarNew = '';
    var saat = icon('<svg ' + SVG + '><circle cx="8" cy="8" r="6.3"/><path d="M8 4.6V8l2.3 1.5"/></svg>', 'گفتگوهای قبلی', function () {
      // Codex's own history menu lives in a thread's header; on a fresh chat there is none,
      // so fall back to Codex's home page, which lists the earlier chats.
      // Once the menu appeared, its later disappearance means it was dismissed
      // or a chat was selected. Never mistake that for a missing native header.
      var requestedPath = currentPath(), sawMenu = false;
      function menuBaz() { return !!document.querySelector('#recent-tasks-search,input[placeholder*="recent" i]'); }
      var menuObserver = new MutationObserver(function () {
        if (menuBaz()) { sawMenu = true; menuObserver.disconnect(); }
      });
      menuObserver.observe(document.body, {childList:true,subtree:true});
      window.dispatchEvent(new CustomEvent('open-recent-tasks-menu'));
      setTimeout(function () {
        menuObserver.disconnect();
        if (sawMenu || menuBaz() || currentPath() !== requestedPath) return;
        navigate('/').then(function (opened) {
          if (!opened) return;
          setTimeout(function () {
            if (currentPath() === '/') window.dispatchEvent(new CustomEvent('open-recent-tasks-menu'));
          }, 400);
        });
      }, 300);
    });
    saat.dataset.crtlSarHistory = '';
    sar.append(nowe, saat); document.body.appendChild(sar);
    // the chat's name at the right end of the head row, like Claude
    var headTimer = setInterval(function () {
      var row = document.getElementById('crtl-top-jaygozin'); if (!row) return;
      var t = document.getElementById('crtl-onvan');
      if (!t || t.parentNode !== row) { t = document.createElement('span'); t.id = 'crtl-onvan'; row.appendChild(t); }
      var tab = tabs.find(function (x) { return x.path === active; });
      var name = (tab && tab.label) || 'Untitled';
      if (/^گفتگو \d+$/.test(name) || /^(ChatGPT|Codex)$/i.test(name)) name = 'Untitled';
      if (t.textContent !== name) t.textContent = name;
      // the grey strip peeking above the composer (Habib, 1 Nov screenshot): any painted box that starts
      // just above the visible composer and is wider than it gets a see-through background, inline
      // (Codex's layered !important beats a stylesheet); sizes are never touched
      var best = null, area = 0;
      document.querySelectorAll('[data-composer-surface-variant]').forEach(function (el) {
        var b = el.getBoundingClientRect(); if (b.width * b.height > area) { area = b.width * b.height; best = b; }
      });
      if (best && best.height > 30) {
        var x = best.left - 8, y = best.top - 6;
        for (var el = document.elementFromPoint(Math.max(1, x), Math.max(1, y)); el && el !== document.body; el = el.parentElement) {
          var b = el.getBoundingClientRect(), bg = getComputedStyle(el).backgroundColor;
          if (b.width > best.width + 10 && b.top >= best.top - 40 && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent')
            el.style.setProperty('background-color', 'transparent', 'important');
        }
      }
    }, 700);
    document.documentElement.classList.add('crtl-has-tabs');
    render();
    var titleObserver = new MutationObserver(updateTitle);
    var title = document.head.querySelector('title');
    if (title) titleObserver.observe(title, {childList:true,characterData:true,subtree:true});
    var attempts = 0;
    var timer = setInterval(function () {
      router = findRouter(); attempts++;
      if (router) {
        clearInterval(timer); say('');
        var startupPath = currentPath();
        unsubscribe = router.subscribe(sync);
        sync(router.state);
        // Explicit editor routes always win. Only the default home entrypoint
        // resumes this panel's saved chat, after its workspace has been checked.
        var explicitRoute = document.querySelector('meta[name="initial-route"]')?.content ||
          new URL(window.location.href).searchParams.get('initialRoute');
        var stateBridge = window.__crtlPanelState;
        if (stateBridge) stateBridge.read().then(function (savedPath) {
          panelState = stateBridge;
          if (!explicitRoute && startupPath === '/' && currentPath() === startupPath &&
              threadPath(savedPath) && savedPath !== '/') {
            navigate(savedPath).then(updateTitle);
          } else { sync(router.state); updateTitle(); }
        }).catch(function () { updateTitle(); });
        else updateTitle();
      } else if (attempts >= 120) {
        clearInterval(timer); say('اتصال تب‌ها برقرار نشد؛ این نسخه نیاز به بررسی دارد.', true);
      }
    }, 500);
    window.addEventListener('pagehide', function () { clearInterval(timer); clearInterval(headTimer); window.removeEventListener('crtl-folder-read', folderNotice); document.removeEventListener('click', historySelection, true); titleObserver.disconnect(); if (unsubscribe) unsubscribe(); }, {once: true});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, {once: true});
  else mount();
})();
