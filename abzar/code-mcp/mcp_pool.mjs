// ---------------------------------------------------------------- پل به سرورهای MCP
//
// چرا: «فورکِ کد مود» اول فقط شل و فایل و جست‌وجو داشت؛ ابزارهای دیگرِ سشن از داخلِ
// اسکریپت صدا زده نمی‌شدند. حبیب ۲۶ نوامبر ۲۰۲۶: «پل بزن».
//
// این فایل همان پل است: از داخلِ اسکریپت، ابزارِ هر سرورِ MCP ِ ثبت‌شده (hafeze،
// computer_use، exa، brave-search و هر چه بعداً اضافه شود) صدا زده می‌شود — بدونِ
// هیچ پکیجی، فقط با استانداردِ stdio ِ MCP (JSON-RPC روی خط).
//
// آنچه این پل **نمی‌کند**: ابزارهای درونیِ خودِ Claude Code (Workflow، SendMessage،
// WebFetch و مانندش) این‌جا نیستند، چون آن‌ها فقط داخلِ خودِ برنامه اجرا می‌شوند، نه
// در یک سرورِ MCP ِ جدا. برای آن‌ها `claude_tool()` هست (پایین) که هزینهٔ مدل دارد.

import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const CALL_LIMIT_MS = 60000; // سقفِ هر فراخوانی؛ سرورِ کند کشته می‌شود
const CLIENT = { name: "fork_code_mode", version: "1.2.0" };

// -------------------------------------------------- خواندنِ فهرستِ سرورها

async function readJsonSafe(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return null;
  }
}

/**
 * سرورهای ثبت‌شده: سراسری (`~/.claude.json`) + پروژه‌ای (`.mcp.json` ِ همین پوشه).
 * پروژه‌ای بر سراسری می‌چربد، مثلِ خودِ Claude Code.
 * @param {string} [cwd]
 * @returns {Promise<Record<string, {command: string, args: string[], env?: object, type?: string, url?: string}>>}
 */
export async function listServers(cwd = process.cwd()) {
  const out = {};
  const global = await readJsonSafe(join(homedir(), ".claude.json"));
  Object.assign(out, global?.mcpServers || {});
  const local = await readJsonSafe(join(cwd, ".mcp.json"));
  Object.assign(out, local?.mcpServers || {});
  return out;
}

// -------------------------------------------------- یک اتصالِ زنده

class Connection {
  constructor(name, launcher) {
    this.name = name;
    this.launcher = launcher;
    this.child = null;
    this.nextId = 1;
    this.waiting = new Map();
    this.buffer = "";
    this.dead = null;
  }

  async start() {
    if (this.child) return;
    const { command, args = [], env = {} } = this.launcher;
    if (!command) throw new Error(`سرورِ «${this.name}» آدرسِ اجرا ندارد (شاید HTTP است، نه stdio)`);
    this.child = spawn(command, args, {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, ...env },
    });
    this.child.stdout.setEncoding("utf8");
    this.child.stdout.on("data", (chunk) => this.onData(chunk));
    this.child.stderr.on("data", () => {}); // صدای سرور را نمی‌خواهیم
    this.child.on("exit", (code) => {
      this.dead = new Error(`سرورِ «${this.name}» بست (exit ${code})`);
      for (const [, w] of this.waiting) w.reject(this.dead);
      this.waiting.clear();
      this.child = null;
    });
    await this.request("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: CLIENT,
    });
    this.notify("notifications/initialized", {});
  }

  onData(chunk) {
    this.buffer += chunk;
    let idx;
    while ((idx = this.buffer.indexOf("\n")) !== -1) {
      const line = this.buffer.slice(0, idx).trim();
      this.buffer = this.buffer.slice(idx + 1);
      if (!line) continue;
      let msg;
      try {
        msg = JSON.parse(line);
      } catch {
        continue;
      }
      const w = this.waiting.get(msg.id);
      if (!w) continue;
      this.waiting.delete(msg.id);
      if (msg.error) w.reject(new Error(`${this.name}: ${msg.error.message || JSON.stringify(msg.error)}`));
      else w.resolve(msg.result);
    }
  }

  send(obj) {
    if (!this.child) throw this.dead || new Error(`سرورِ «${this.name}» در دسترس نیست`);
    this.child.stdin.write(JSON.stringify(obj) + "\n");
  }

  notify(method, params) {
    try {
      this.send({ jsonrpc: "2.0", method, params });
    } catch {
      /* سرورِ مرده؛ فراخوانیِ بعدی خطا می‌دهد */
    }
  }

  request(method, params, limitMs = CALL_LIMIT_MS) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiting.delete(id);
        reject(new Error(`${this.name}: «${method}» بعد از ${limitMs}ms جواب نداد`));
      }, limitMs);
      timer.unref?.();
      this.waiting.set(id, {
        resolve: (v) => {
          clearTimeout(timer);
          resolve(v);
        },
        reject: (e) => {
          clearTimeout(timer);
          reject(e);
        },
      });
      this.send({ jsonrpc: "2.0", id, method, params });
    });
  }

  async listTools() {
    const r = await this.request("tools/list", {});
    return (r?.tools || []).map((t) => ({ name: t.name, description: t.description || "", inputSchema: t.inputSchema }));
  }

  async callTool(tool, args = {}, limitMs = CALL_LIMIT_MS) {
    const r = await this.request("tools/call", { name: tool, arguments: args }, limitMs);
    return flatten(r);
  }

  stop() {
    try {
      this.child?.kill("SIGTERM");
    } catch {
      /* بی‌اهمیت */
    }
    this.child = null;
  }
}

/** نتیجهٔ ابزارِ MCP به یک متنِ خوانا. */
function flatten(result) {
  const parts = (result?.content || []).map((c) => {
    if (c.type === "text") return c.text;
    if (c.type === "image") return `[تصویر ${c.mimeType || ""} ${c.data?.length || 0} بایت]`;
    return `[${c.type}]`;
  });
  const text = parts.join("\n");
  return result?.isError ? `(خطای ابزار) ${text}` : text;
}

// -------------------------------------------------- استخرِ اتصال‌ها

const pool = new Map();
let cleanupHooked = false;

function hookCleanup() {
  if (cleanupHooked) return;
  cleanupHooked = true;
  const stopAll = () => {
    for (const c of pool.values()) c.stop();
  };
  process.on("exit", stopAll);
  process.on("SIGINT", () => {
    stopAll();
    process.exit(130);
  });
}

async function connection(name, cwd) {
  if (pool.has(name)) return pool.get(name);
  const servers = await listServers(cwd);
  const launcher = servers[name];
  if (!launcher) {
    throw new Error(`سروری به نامِ «${name}» ثبت نشده. ثبت‌شده‌ها: ${Object.keys(servers).join(", ") || "(هیچ)"}`);
  }
  const conn = new Connection(name, launcher);
  pool.set(name, conn);
  hookCleanup();
  await conn.start();
  return conn;
}

/**
 * ابزارهای یک سرور.
 * @param {string} name نامِ سرور (مثلِ `hafeze`)
 * @param {{cwd?: string}} [opts]
 */
export async function mcpTools(name, opts = {}) {
  const conn = await connection(name, opts.cwd);
  return conn.listTools();
}

/**
 * صدا زدنِ ابزارِ یک سرور.
 * @param {string} server نامِ سرور
 * @param {string} tool نامِ ابزار
 * @param {object} [args]
 * @param {{cwd?: string, timeout?: number}} [opts]
 */
export async function mcpCall(server, tool, args = {}, opts = {}) {
  const conn = await connection(server, opts.cwd);
  const list = await conn.listTools();
  if (!list.some((t) => t.name === tool)) {
    throw new Error(`«${server}» ابزاری به نامِ «${tool}» ندارد. دارد: ${list.map((t) => t.name).join(", ")}`);
  }
  return conn.callTool(tool, args, opts.timeout || CALL_LIMIT_MS);
}

/** همهٔ اتصال‌ها را ببند (پایانِ اسکریپت خودش می‌بندد؛ برای آزمون لازم است). */
export function mcpStopAll() {
  for (const c of pool.values()) c.stop();
  pool.clear();
}
