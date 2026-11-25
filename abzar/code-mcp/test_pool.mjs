// آزمونِ پلِ MCP — ۲۶ نوامبر ۲۰۲۶.
// اجرا: node abzar/code-mcp/test_pool.mjs
//
// چه چیزی سنجیده می‌شود:
//  ۱) فهرستِ سرورها از `~/.claude.json` خوانده می‌شود
//  ۲) از داخلِ اسکریپت، ابزارِ یک سرورِ دیگر صدا زده می‌شود (خودِ همین سرور، برای بی‌عارضه بودن)
//  ۳) خرابکاری: سرورِ ناموجود و ابزارِ ناموجود باید خطای تمیز بدهند، نه کرش

import { spawn } from "node:child_process";
import { strict as assert } from "node:assert";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { listServers } from "./mcp_pool.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const SERVER = join(HERE, "server.mjs");
let pass = 0;
const ok = (name) => {
  pass += 1;
  console.log(`  ✅ ${name}`);
};

// ---------------------------------------------- موکلِ سادهٔ stdio

function client() {
  const child = spawn(process.execPath, [SERVER], { stdio: ["pipe", "pipe", "inherit"] });
  let buf = "";
  let id = 0;
  const waiting = new Map();
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (c) => {
    buf += c;
    let i;
    while ((i = buf.indexOf("\n")) !== -1) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line) continue;
      const msg = JSON.parse(line);
      const w = waiting.get(msg.id);
      if (w) {
        waiting.delete(msg.id);
        msg.error ? w.reject(new Error(msg.error.message)) : w.resolve(msg.result);
      }
    }
  });
  const req = (method, params) =>
    new Promise((resolve, reject) => {
      const my = ++id;
      waiting.set(my, { resolve, reject });
      child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: my, method, params }) + "\n");
    });
  return { child, req };
}

const text = (r) => (r?.content || []).map((c) => c.text || "").join("\n");

// ---------------------------------------------- آزمون‌ها

const servers = await listServers(HERE);
assert.ok(servers.fork_code_mode, "سرورِ خودمان باید در فهرست باشد");
ok(`فهرستِ سرورها خوانده شد (${Object.keys(servers).length} سرور: ${Object.keys(servers).join(", ")})`);

const c = client();
await c.req("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "1" } });
const tools = await c.req("tools/list", {});
assert.equal(tools.tools.length, 1);
assert.equal(tools.tools[0].name, "code");
ok("ابزارِ `code` هست");

// ۱ · پل زنده: از داخلِ اسکریپت، خودِ همین سرور را صدا می‌زنیم (بی‌عارضه، فقط جمعِ ساده)
const bridged = text(await c.req("tools/call", { name: "code", arguments: { code: `await mcp_pal('fork_code_mode', 'code', { code: '1+1' })` } }));
assert.ok(bridged.includes("2"), "جوابِ پل باید ۲ باشد؛ آمد: " + bridged.slice(0, 200));
ok("پل: `mcp_pal` ابزارِ یک سرورِ دیگر را صدا زد و جواب آورد");

// ۲ · فهرستِ ابزارهای یک سرور از داخلِ اسکریپت
const listed = text(await c.req("tools/call", { name: "code", arguments: { code: `(await mcp_tools('fork_code_mode')).map(t => t.name)` } }));
assert.ok(listed.includes("code"), "mcp_tools باید نامِ code را بدهد");
ok("پل: `mcp_tools` فهرستِ ابزارها را داد");

// ۳ · خرابکاریِ اول: سرورِ ناموجود
const noServer = text(await c.req("tools/call", { name: "code", arguments: { code: `await mcp_pal('inja_nist', 'x')` } }));
assert.ok(noServer.includes("ثبت نشده"), "باید خطای «ثبت نشده» بدهد؛ آمد: " + noServer.slice(0, 160));
ok("خرابکاری ۱: سرورِ ناموجود ⇒ خطای تمیز (نه کرش)");

// ۴ · خرابکاریِ دوم: ابزارِ ناموجود در سرورِ موجود
const noTool = text(await c.req("tools/call", { name: "code", arguments: { code: `await mcp_pal('fork_code_mode', 'inja_nist')` } }));
assert.ok(noTool.includes("ابزاری به نام"), "باید خطای «ابزاری به نام» بدهد؛ آمد: " + noTool.slice(0, 160));
ok("خرابکاری ۲: ابزارِ ناموجود ⇒ خطای تمیز");

c.child.kill("SIGTERM");
console.log(`\n${pass} آزمون سبز`);
