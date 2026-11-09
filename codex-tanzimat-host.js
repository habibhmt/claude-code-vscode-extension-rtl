#!/usr/bin/env node
/* تبِ «تنظیمات Codex» (تعریف ۲۵): خواندن و نوشتنِ تنظیم‌ها فقط با درِ رسمیِ خودِ Codex
 * (app-server: config/read و config/value/write)، نه با ویرایشِ دستیِ TOML.
 * ورودی: یک JSON روی stdin  {codex, op:"read"|"write", cwd, keyPath, value, filePath}
 * خروجی: یک JSON روی stdout  {ok, result|error}
 * کار با «چت» این‌جا نیست: آن در انبارِ ~/.codex/crtl_tanzimat.json است و میزبان
 * هنگامِ turn/start همان چت را با آن پر می‌کند. */
'use strict';
const { spawn } = require('child_process');

function rpc(codex, calls, timeoutMs, env) {
  return new Promise((resolve, reject) => {
    const p = spawn(codex, ['app-server'], { stdio: ['pipe', 'pipe', 'pipe'], env: env ? Object.assign({}, process.env, env) : process.env });
    let buf = '', id = 0, waiting = new Map(), done = false;
    const finish = (err, val) => {
      if (done) return; done = true; clearTimeout(t);
      try { p.kill(); } catch (_) {}
      err ? reject(err) : resolve(val);
    };
    const t = setTimeout(() => finish(new Error('codex app-server جواب نداد')), timeoutMs || 20000);
    p.on('error', e => finish(e));
    p.on('exit', c => finish(new Error('codex app-server بسته شد: ' + c)));
    p.stdout.on('data', d => {
      buf += d;
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i); buf = buf.slice(i + 1);
        let m; try { m = JSON.parse(line); } catch (_) { continue; }
        if (m.id != null && waiting.has(m.id)) { const w = waiting.get(m.id); waiting.delete(m.id); w(m); }
      }
    });
    const send = (method, params) => new Promise(res => {
      const myId = ++id; waiting.set(myId, res);
      p.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: myId, method, params }) + '\n');
    });
    (async () => {
      const init = await send('initialize', { clientInfo: { name: 'crtl-tanzimat', version: '1' } });
      if (init.error) throw new Error(init.error.message || 'initialize');
      p.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'initialized' }) + '\n');
      const out = [];
      for (const [m, prm, ekhtiari] of calls) {
        const r = await send(m, prm);
        if (r.error && !ekhtiari) throw new Error(m + ': ' + (r.error.message || JSON.stringify(r.error)));
        out.push(r.error ? null : r.result);
      }
      return out;
    })().then(v => finish(null, v), e => finish(e));
  });
}

async function run(req) {
  const read = ['config/read', { cwd: req.cwd || null, includeLayers: true }];
  if (req.op === 'read') return (await rpc(req.codex, [read]))[0];
  if (req.op === 'write') {
    const w = { keyPath: req.keyPath, value: req.value === undefined ? null : req.value,
      mergeStrategy: 'replace', filePath: req.filePath || null, expectedVersion: null };
    const [res, after] = await rpc(req.codex, [['config/value/write', w], read]);
    return { write: res, after };
  }
  throw new Error('op ناشناخته: ' + req.op);
}

// Codex lets config/value/write touch only the user config ("Only writes to the user config are allowed",
// codex-cli 0.164). A project file is written by the same official writer: a throwaway CODEX_HOME whose
// config.toml is a copy of it, then copied back. Same formatting, comments kept, no TOML code of ours.
async function writeFile(codex, file, edits) {
  const fs = require('fs'), os = require('os'), path = require('path');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'crtl-codex-'));
  try {
    if (fs.existsSync(file)) fs.copyFileSync(file, path.join(tmp, 'config.toml'));
    const res = await rpc(codex, edits.map(e => ['config/value/write', Object.assign({ mergeStrategy: 'replace', filePath: null, expectedVersion: null }, e)]), 20000, { CODEX_HOME: tmp });
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const out = path.join(tmp, 'config.toml');
    if (fs.existsSync(out)) { fs.copyFileSync(out, file + '.crtl-tmp'); fs.renameSync(file + '.crtl-tmp', file); }
    return res.map(r => Object.assign({}, r, { filePath: file }));
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}

module.exports = { run, rpc, writeFile };

if (require.main === module) {
  let s = '';
  process.stdin.on('data', d => s += d).on('end', () => {
    run(JSON.parse(s)).then(
      r => process.stdout.write(JSON.stringify({ ok: true, result: r })),
      e => process.stdout.write(JSON.stringify({ ok: false, error: String(e && e.message || e) })));
  });
}
