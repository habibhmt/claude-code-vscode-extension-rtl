'use strict';
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PROJECTS = path.join(os.homedir(), '.claude', 'projects');

// ---- OAuth token from macOS Keychain -------------------------------------
function getToken() {
  return new Promise((resolve, reject) => {
    execFile('security', ['find-generic-password', '-s', 'Claude Code-credentials', '-w'],
      { maxBuffer: 1 << 20 }, (err, stdout) => {
        if (err) return reject(err);
        try { resolve(JSON.parse(stdout).claudeAiOauth.accessToken); }
        catch (e) { reject(e); }
      });
  });
}

// ---- account-wide limits -------------------------------------------------
async function fetchLimits() {
  const token = await getToken();
  const res = await fetch('https://api.anthropic.com/api/oauth/usage', {
    headers: { Authorization: `Bearer ${token}`, 'anthropic-beta': 'oauth-2025-04-20' },
  });
  if (!res.ok) throw new Error('usage ' + res.status);
  const j = await res.json();
  const rows = [];
  const pick = (kind, scopeName) => (j.limits || []).find(
    l => l.kind === kind && (!scopeName || l.scope?.model?.display_name === scopeName));

  const session = pick('session');
  const weekly = pick('weekly_all');
  const fable = pick('weekly_scoped', 'Fable');
  if (session) rows.push({ id: 'session', percent: session.percent, resets_at: session.resets_at });
  if (weekly) rows.push({ id: 'weekly', percent: weekly.percent, resets_at: weekly.resets_at });
  if (fable) rows.push({ id: 'fable', percent: fable.percent, resets_at: fable.resets_at });
  // any other scoped weekly bucket that is closer to its cap than the two above
  const others = (j.limits || []).filter(l =>
    !['session'].includes(l.kind) && l !== weekly && l !== fable);
  return { rows, others, raw: j, at: Date.now() };
}

// ---- per-session transcript scanning -------------------------------------
// Relative cost weights (per token, arbitrary common unit) used only to split
// the account-wide percentage between chats.
const MODEL_W = { opus: 5, fable: 5, sonnet: 1, haiku: 0.2 };
const KIND_W = { input: 1, cache_creation: 1.25, cache_read: 0.1, output: 5 };

function modelWeight(model = '') {
  const m = model.toLowerCase();
  for (const k of Object.keys(MODEL_W)) if (m.includes(k)) return MODEL_W[k];
  return 1;
}
function isFable(model = '') { return model.toLowerCase().includes('fable'); }

function contextWindow(model = '', tokens = 0) {
  if (model.includes('[1m]') || model.includes('-1m')) return 1_000_000;
  return tokens > 200_000 ? 1_000_000 : 200_000;
}

function shortFolder(cwd = '') {
  const m = cwd.match(/1-MY-WORK\/([^/]+)/);
  const base = m ? m[1] : path.basename(cwd);
  const num = base.match(/^(\d+)/);
  if (num) return num[1];
  return base.replace(/^\./, '').split('-').slice(0, 2).join('-');
}

function readTail(file, bytes) {
  const size = fs.statSync(file).size;
  const start = Math.max(0, size - bytes);
  const fd = fs.openSync(file, 'r');
  try {
    const buf = Buffer.alloc(size - start);
    fs.readSync(fd, buf, 0, buf.length, start);
    let s = buf.toString('utf8');
    if (start > 0) s = s.slice(s.indexOf('\n') + 1);
    return s;
  } finally { fs.closeSync(fd); }
}

const cache = new Map(); // file -> { mtimeMs, data }

function scanFile(file, now) {
  const st = fs.statSync(file);
  const hit = cache.get(file);
  if (hit && hit.mtimeMs === st.mtimeMs) return hit.data;

  const text = readTail(file, 3 << 20); // last 3 MB is plenty for 7 days
  const d = {
    mtimeMs: st.mtimeMs, cwd: '', title: '', model: '', ctxTokens: 0,
    w5: 0, w7: 0, f7: 0, lastActivity: st.mtimeMs,
    endTurn: null,   // uuid of the last finished turn — the "answer is ready" marker
  };
  const t5 = now - 5 * 3600e3, t7 = now - 7 * 86400e3;

  for (const line of text.split('\n')) {
    if (!line) continue;
    let e; try { e = JSON.parse(line); } catch { continue; }
    if (e.cwd) d.cwd = e.cwd;
    if (e.type === 'ai-title' && e.aiTitle) d.title = e.aiTitle;
    if (e.type !== 'assistant') continue;
    const msg = e.message || {};
    const u = msg.usage; if (!u) continue;
    const ts = Date.parse(e.timestamp || 0) || 0;
    if (msg.stop_reason === 'end_turn') d.endTurn = e.uuid || String(ts);
    const model = msg.model || '';
    d.model = model;
    const ctx = (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0);
    d.ctxTokens = ctx;
    const cost = modelWeight(model) * (
      KIND_W.input * (u.input_tokens || 0) +
      KIND_W.cache_creation * (u.cache_creation_input_tokens || 0) +
      KIND_W.cache_read * (u.cache_read_input_tokens || 0) +
      KIND_W.output * (u.output_tokens || 0));
    if (ts >= t7) { d.w7 += cost; if (isFable(model)) d.f7 += cost; }
    if (ts >= t5) d.w5 += cost;
  }
  cache.set(file, { mtimeMs: st.mtimeMs, data: d });
  return d;
}

function listSessions(limits, now = Date.now(), sort = 'recent') {
  const out = [];
  let dirs = [];
  try { dirs = fs.readdirSync(PROJECTS); } catch { return out; }
  for (const dir of dirs) {
    const full = path.join(PROJECTS, dir);
    let files = [];
    try { files = fs.readdirSync(full).filter(f => f.endsWith('.jsonl')); } catch { continue; }
    for (const f of files) {
      const file = path.join(full, f);
      let st; try { st = fs.statSync(file); } catch { continue; }
      if (now - st.mtimeMs > 7 * 86400e3) continue;
      let d; try { d = scanFile(file, now); } catch { continue; }
      if (!d.w7 && now - st.mtimeMs > 3600e3) continue;
      out.push({ ...d, id: f.replace('.jsonl', ''), file });
    }
  }
  const tot5 = out.reduce((a, s) => a + s.w5, 0) || 1;
  const tot7 = out.reduce((a, s) => a + s.w7, 0) || 1;
  const totF = out.reduce((a, s) => a + s.f7, 0) || 1;
  const pct = id => limits.rows.find(r => r.id === id)?.percent || 0;

  for (const s of out) {
    s.share = {
      session: (s.w5 / tot5) * pct('session'),
      weekly: (s.w7 / tot7) * pct('weekly'),
      fable: (s.f7 / totF) * pct('fable'),
    };
    s.folder = shortFolder(s.cwd || path.basename(path.dirname(s.file)));
    s.ctxPct = Math.min(100, (s.ctxTokens / contextWindow(s.model, s.ctxTokens)) * 100);
    s.live = now - s.mtimeMs < 3 * 60e3;
  }
  const keys = {
    recent: s => s.mtimeMs,
    heavy: s => s.share.session + s.share.weekly,   // biggest quota eater right now
    context: s => s.ctxPct,
  };
  const key = keys[sort] || keys.recent;
  out.sort((a, b) => key(b) - key(a));
  return out.slice(0, 40);
}

module.exports = { fetchLimits, listSessions, PROJECTS };
