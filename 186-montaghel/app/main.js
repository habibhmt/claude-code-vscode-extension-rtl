'use strict';
const { app, BrowserWindow, Tray, Menu, Notification, nativeImage, ipcMain, screen, globalShortcut } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const { fetchLimits, listSessions, PROJECTS } = require('./usage');

const STATE_FILE = path.join(app.getPath('userData'), 'state.json');
const SUPPORT = path.join(require('os').homedir(), 'Library/Application Support/claude-usage-bar');
const STATUS_FILE = path.join(SUPPORT, 'status.json');
const COMMAND_FILE = path.join(SUPPORT, 'command.json');
const HELPER = [
  path.join(process.resourcesPath || '', 'ClaudeUsageStatus.app/Contents/MacOS/ClaudeUsageStatus'),
  path.join(__dirname, '..', 'menubar', 'ClaudeUsageStatus.app/Contents/MacOS/ClaudeUsageStatus'),
].find(p => { try { return fs.existsSync(p); } catch { return false; } }) || '';
let helper = null, lastCmdAt = 0;
function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch { return {}; }
}
function saveState(patch) {
  state = { ...state, ...patch };
  try {
    fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch {}
}

const COLLAPSED = { width: 190, height: 118 };
const EXPANDED = { width: 400, height: 470 };

let win, tray, expanded = false;
let state = {};
const seenTurns = new Map();   // sessionId -> uuid of the last turn we announced
let lastError = null;
let limits = { rows: [] };
let refreshTimer = null, debounce = null;

function createWindow() {
  win = new BrowserWindow({
    ...COLLAPSED,
    show: false,
    frame: false,
    transparent: true,
    hasShadow: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    fullscreenable: false,
    vibrancy: 'hud',
    visualEffectState: 'active',
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.loadFile('index.html');
  win.on('blur', () => { if (expanded) setExpanded(false); });
  win.on('moved', () => {
    const b = win.getBounds();
    saveState({ x: b.x, y: b.y });   // size is fixed per mode, only the spot is ours to keep
  });
}

// Click-through: the panel stops swallowing clicks meant for whatever is behind it.
// Suspended while the chat list is open, otherwise the list would be unusable.
function applyClickThrough() {
  const on = !!state.clickThrough && !expanded;
  win.setIgnoreMouseEvents(on, { forward: true });
  win.webContents.send('click-through', on);
}

function setExpanded(v) {
  expanded = v;
  const size = v ? EXPANDED : COLLAPSED;
  const b = win.getBounds();
  win.setBounds({ x: b.x, y: b.y, ...size }, false);
  win.webContents.send('expanded', v);
  applyClickThrough();
  if (v) refresh();
}

function positionUnderTray() {
  const primary = screen.getPrimaryDisplay();
  const d = primary.workArea;
  const { width: w, height: h } = win.getBounds();
  const b = tray.getBounds();
  // tray.getBounds() is unreliable on macOS with an extended display: it has been
  // seen returning {x:0, y:<screen height>} — the menu bar is at the TOP, so any y
  // that is not up near the menu bar means the value is garbage. Fall back to the
  // top-right corner of the primary display, and clamp either way.
  const trayOk = b.width > 0 && b.y < d.y + 60;
  let x = trayOk ? b.x + b.width / 2 - w / 2 : d.x + d.width - w - 12;
  let y = trayOk ? b.y + b.height + 4 : d.y + 6;
  x = Math.min(Math.max(x, d.x + 8), d.x + d.width - w - 8);
  y = Math.min(Math.max(y, d.y + 4), d.y + d.height - h - 8);
  win.setPosition(Math.round(x), Math.round(y), false);
  diag('positioned', { trayOk, trayBounds: b, to: { x: Math.round(x), y: Math.round(y) } });
}

function restorePosition() {
  const pt = { x: state.x, y: state.y };
  const disp = screen.getAllDisplays().find(
    dd => pt.x >= dd.bounds.x && pt.x < dd.bounds.x + dd.bounds.width &&
          pt.y >= dd.bounds.y && pt.y < dd.bounds.y + dd.bounds.height);
  if (!disp) return positionUnderTray();   // saved spot is on a display that is gone
  const d = disp.workArea;
  const { width: w, height: h } = win.getBounds();
  const x = Math.min(Math.max(state.x, d.x), d.x + d.width - w);
  const y = Math.min(Math.max(state.y, d.y), d.y + d.height - h);
  win.setPosition(Math.round(x), Math.round(y), false);
}

function toggleWindow() {
  if (win.isVisible()) { win.hide(); saveState({ hidden: true }); return; }
  saveState({ hidden: false });
  if (Number.isFinite(state.x) && Number.isFinite(state.y)) restorePosition();  // eslint-disable-line
  else positionUnderTray();
  win.showInactive();
  win.setAlwaysOnTop(true, 'screen-saver');
  refresh();
}

async function refresh() {
  try { limits = await fetchLimits(); lastError = null; }
  catch (e) { lastError = { message: String(e.message || e), at: Date.now() }; }
  let sessions = [];
  try { sessions = listSessions(limits, Date.now(), state.sort || 'recent'); } catch (e) {}
  notifyFinished(sessions);
  const payload = {
    rows: limits.rows, sessions, at: Date.now(),
    sort: state.sort || 'recent',
    error: lastError, staleSince: lastError ? limits.at || null : null,
  };
  if (win && !win.isDestroyed()) win.webContents.send('data', payload);
  const sess = limits.rows.find(r => r.id === 'session');
  if (tray) tray.setTitle(sess ? ` ${sess.percent}%${lastError ? '·' : ''}` : ' –');
  // feed the native menu bar helper (Electron's own Tray never lands on the bar here)
  try {
    const worst = Math.max(...limits.rows.map(r => r.percent), 0);
    fs.mkdirSync(SUPPORT, { recursive: true });
    fs.writeFileSync(STATUS_FILE, JSON.stringify({
      title: sess ? ` ${sess.percent}%${lastError ? '·' : ''}` : ' –',
      critical: worst >= 90,
    }));
  } catch {}
}

// «جواب آماده شد» — fires when a session's last message flips to a finished turn.
// The first sighting of a session only seeds the map, so restarting the app is quiet.
function notifyFinished(sessions) {
  for (const s of sessions) {
    if (!s.endTurn) continue;
    const had = seenTurns.has(s.id);
    const prev = seenTurns.get(s.id);
    seenTurns.set(s.id, s.endTurn);
    if (!had || prev === s.endTurn) continue;
    if (state.notify === false) continue;
    const title = (s.title || 'بدون عنوان').split(/\s+/).slice(0, 5).join(' ');
    const tok = s.ctxTokens.toLocaleString('en-US');
    const hot = s.ctxTokens > 150_000;          // the line Habib wants to see coming
    new Notification({
      title: `${hot ? '🔴 ' : ''}فولدر ${s.folder} — جواب آماده`,
      subtitle: `${(s.model || '').replace('claude-', '')} · کانتکست ${tok} توکن${hot ? ' ⚠️' : ''}`,
      body: title,
      silent: false,
    }).on('click', () => { if (!win.isVisible()) toggleWindow(); }).show();
  }
}

function startHelper() {
  if (!fs.existsSync(HELPER)) return diag('helper', { found: false, HELPER });
  helper = spawn(HELPER, { stdio: 'ignore', detached: false });
  helper.on('exit', code => diag('helper exit', { code }));
  diag('helper', { found: true, pid: helper.pid });
}

// the helper cannot talk to us directly, so a click lands as a file write
function watchCommands() {
  try { fs.mkdirSync(SUPPORT, { recursive: true }); fs.writeFileSync(COMMAND_FILE, '{}'); } catch {}
  fs.watchFile(COMMAND_FILE, { interval: 300 }, () => {
    let c; try { c = JSON.parse(fs.readFileSync(COMMAND_FILE, 'utf8')); } catch { return; }
    if (!c.at || c.at === lastCmdAt) return;
    lastCmdAt = c.at;
    if (c.cmd === 'menu') showMenu();
    else toggleWindow();
  });
}

function watchProjects() {
  try {
    fs.watch(PROJECTS, { recursive: true }, () => {
      clearTimeout(debounce);
      debounce = setTimeout(refresh, 800); // fires on every prompt/answer written
    });
  } catch (e) {}
}

function diag(tag, obj) {
  const line = `[diag] ${new Date().toISOString()} ${tag} ${JSON.stringify(obj)}`;
  console.log(line);
  try { fs.appendFileSync('/tmp/claude-usage-diag.log', line + '\n'); } catch {}
}

// one copy only: a login item plus a manual launch must not fight over the tray
if (!app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', () => { if (win) { positionUnderTray(); win.showInactive(); } });

app.whenReady().then(() => {
  state = loadState();
  if (app.dock) app.dock.hide();
  const img = nativeImage.createFromPath(path.join(__dirname, 'trayTemplate.png'));
  img.setTemplateImage(true);
  diag('tray icon', { empty: img.isEmpty(), size: img.getSize() });
  tray = new Tray(img);
  tray.setToolTip('Claude usage');
  tray.on('click', toggleWindow);
  tray.on('right-click', showMenu);

  createWindow();
  win.webContents.once('did-finish-load', () => {
    win.webContents.send('opacity', state.opacity ?? 0.62);
    applyClickThrough();
  });
  refresh();
  // show on every launch unless the user hid it on purpose; the tray icon is not
  // a reliable way back in on this machine, so never start with nothing on screen
  if (!state.hidden) setTimeout(() => { if (!win.isVisible()) toggleWindow(); }, 400);

  // keyboard way in, independent of the menu bar entirely
  const ACCEL = 'Alt+Command+U';
  if (globalShortcut.register(ACCEL, toggleWindow)) diag('shortcut', { ACCEL, ok: true });
  else diag('shortcut', { ACCEL, ok: false });
  setTimeout(() => {
    diag('displays', screen.getAllDisplays().map(d => ({
      id: d.id, bounds: d.bounds, workArea: d.workArea, scale: d.scaleFactor,
      primary: d.id === screen.getPrimaryDisplay().id })));
    diag('tray bounds', tray.getBounds());
    diag('window', { visible: win.isVisible(), bounds: win.getBounds(),
      onTop: win.isAlwaysOnTop(), opacity: win.getOpacity() });
  }, 2000);
  refreshTimer = setInterval(refresh, 60_000); // API poll; file watcher covers chats
  watchProjects();
  watchCommands();
  startHelper();
});

function showMenu() {
  tray.popUpContextMenu(Menu.buildFromTemplate([
    {
      label: 'کلیک نفوذی', type: 'checkbox', checked: !!state.clickThrough,
      click: () => { saveState({ clickThrough: !state.clickThrough }); applyClickThrough(); },
    },
    {
      label: 'اعلان «جواب آماده»', type: 'checkbox', checked: state.notify !== false,
      click: () => saveState({ notify: state.notify === false }),
    },
    { type: 'separator' },
    { label: 'بازنشانی جای پنجره', click: () => { saveState({ x: null, y: null }); positionUnderTray(); } },
    { label: 'تازه‌سازی', click: refresh },
    { type: 'separator' },
    { label: 'خروج', click: () => app.quit() },
  ]));
}

ipcMain.on('toggle-expand', () => setExpanded(!expanded));
ipcMain.on('set-opacity', (_e, v) => {
  const o = Math.min(0.95, Math.max(0.2, Number(v) || 0.62));
  saveState({ opacity: o });
  win.webContents.send('opacity', o);
});
ipcMain.on('set-sort', (_e, v) => { saveState({ sort: v }); refresh(); });
ipcMain.on('quit', () => app.quit());
app.on('window-all-closed', () => {});
app.on('will-quit', () => { globalShortcut.unregisterAll(); if (helper) helper.kill(); });
