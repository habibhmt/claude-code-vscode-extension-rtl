#!/usr/bin/env node
// Code Mode خودمان — سرورِ MCP با یک ابزار به نامِ `code`.
//
// چرا: Code Mode اصلیِ Claude Code فقط با API مستقیمِ Anthropic و حسابِ مجاز روشن می‌شود
// (دروازه‌اش در باینری است؛ سند و متنِ کاملِ .d.ts در Doc/codemode-ramzgoshayi.md).
// این سرور همان قرارداد را پیاده می‌کند ولی با هر مدلی — DeepSeek روی OpenRouter هم.
//
// قرارداد از فایلِ دامنه‌ایِ خودِ باینری گرفته شده: `core.bash.async.d.ts` (آفست 352963714).
// نسخهٔ متنِ آن در Doc/codemode-core.bash.d.ts.txt است. (18 نوامبر 2026)

import { spawn } from "node:child_process";
import { readFile, writeFile, readdir, stat, access } from "node:fs/promises";
import { resolve, join } from "node:path";
import { constants as FS } from "node:fs";

const SERVER = { name: "code-mode-lite", version: "1.1.0" };
const MAX_RESULT = 30000; // سقفِ نمایشیِ خودمان (سقفِ اصلی در باینری متغیر است)
const SCRIPT_LIMIT_MS = 600000; // مثلِ خودِ Code Mode
const CMD_LIMIT_MS = 600000;
const CMD_MAX_MS = 7200000;

// ---------------------------------------------------------------- شل

const OUTCOME_CMDS = /\b(grep|rg|egrep|fgrep|find|diff|test|\[|git diff|git grep)\b[\s\S]*$/;

class ShellError extends Error {
  constructor(out) {
    const detail = (out.stderr || out.stdout || "").trim().split("\n").slice(-3).join("\n");
    super(`exit ${out.exitCode}${detail ? `\n${detail}` : ""}`);
    this.name = "ShellError";
    this.stdout = out.stdout;
    this.stderr = out.stderr;
    this.exitCode = out.exitCode;
    this.running = out.running;
  }
}

function quoteValue(v) {
  if (Array.isArray(v)) return v.map(quoteValue).join(" ");
  if (v && typeof v === "object" && typeof v.raw === "string") return v.raw;
  return `'${String(v).replace(/'/g, `'\\''`)}'`;
}

function makeOutput(o) {
  return {
    ...o,
    text: () => o.stdout,
    lines: () => o.stdout.split("\n").filter((l) => l !== ""),
    json: () => JSON.parse(o.stdout),
  };
}

function runCommand({ command, cwd, env, timeout, nothrow }) {
  return new Promise((resolvePromise) => {
    const ms = Math.min(timeout ?? CMD_LIMIT_MS, CMD_MAX_MS);
    const child = spawn("/bin/bash", ["-c", command], {
      cwd: cwd ?? process.cwd(),
      env: env ? { ...process.env, ...env } : process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let truncated = false;
    let settled = false;
    const finish = (payload) => {
      if (settled) return;
      settled = true;
      resolvePromise(payload);
    };
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      finish(
        makeOutput({
          stdout,
          stderr,
          exitCode: null,
          output: stdout + (stderr ? `\n[stderr]\n${stderr}` : ""),
          truncated,
          whole: !truncated,
          running: { taskId: `cmd-${child.pid}`, outputPath: "(not streamed by code-mode-lite)" },
        }),
      );
    }, ms);
    timer.unref?.();

    child.stdout.on("data", (d) => {
      if (truncated) return;
      stdout += d.toString();
      if (stdout.length > 64 * 1024 * 1024) {
        stdout = stdout.slice(0, 64 * 1024 * 1024);
        truncated = true;
      }
    });
    child.stderr.on("data", (d) => {
      stderr += d.toString();
    });
    child.on("error", (e) =>
      finish(
        makeOutput({ stdout: "", stderr: String(e), exitCode: 1, output: String(e), truncated: false, whole: true, error: String(e) }),
      ),
    );
    child.on("close", (code) => {
      clearTimeout(timer);
      const merged = stdout + (stderr ? (stdout ? "\n" : "") + stderr : "");
      const out = makeOutput({
        stdout,
        stderr,
        exitCode: code,
        output: merged + (code ? `\n[exit ${code}]` : ""),
        truncated,
        whole: !truncated,
      });
      // exit 1 از grep/find/diff/test یعنی «پیدا نشد»، نه خطا — مثلِ خودِ Code Mode
      const isOutcome = code === 1 && OUTCOME_CMDS.test(command);
      if (code !== 0 && !nothrow && !isOutcome) resolvePromise(Promise.reject(new ShellError(out)));
      else resolvePromise(out);
    });
  });
}

function makeShellPromise(command, opts = {}) {
  const state = { command, ...opts };
  const derive = (patch) => makeShellPromise(command, { ...state, ...patch });
  const exec = () => runCommand(state);
  return {
    nothrow: () => derive({ nothrow: true }),
    throws: (on) => derive({ nothrow: !on }),
    quiet: () => derive({ quiet: true }),
    timeout: (ms) => derive({ timeout: ms }),
    cwd: (dir) => derive({ cwd: dir }),
    env: (vars) => derive({ env: { ...state.env, ...vars } }),
    text: async () => (await exec()).stdout,
    lines: async () => (await exec()).stdout.split("\n").filter((l) => l !== ""),
    json: async () => JSON.parse((await exec()).stdout),
    then: (ok, bad) => exec().then(ok, bad),
    catch: (bad) => exec().catch(bad),
    finally: (f) => exec().finally(f),
  };
}

function shell(first, ...rest) {
  if (typeof first === "string") {
    const timeout = typeof rest[0] === "number" ? rest[0] : undefined;
    return makeShellPromise(first, { timeout });
  }
  const command = first.reduce((out, s, i) => out + s + (i < rest.length ? quoteValue(rest[i]) : ""), "");
  return makeShellPromise(command, {});
}
shell.escape = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;
shell.ShellError = ShellError;

// ---------------------------------------------------------------- بقیهٔ جهانی‌ها

class ConsoleRing {
  constructor(limit = 200) {
    this.limit = limit;
    this.buf = [];
    this.droppedCount = 0;
  }
  push(...args) {
    const line = args
      .map((a) => (typeof a === "string" ? a : safeJson(a)))
      .join(" ");
    this.buf.push(line);
    if (this.buf.length > this.limit) {
      this.buf.shift();
      this.droppedCount++;
    }
    return line;
  }
  log(...a) { return this.push(...a); }
  info(...a) { return this.push(...a); }
  debug(...a) { return this.push(...a); }
  warn(...a) { return this.push(...a); }
  error(...a) { return this.push(...a); }
  tail(n = 20) { return this.buf.slice(-n).join("\n"); }
  buffer() { return this.buf.join("\n"); }
  dropped() { return this.droppedCount; }
}

function safeJson(v) {
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function makeFile(path) {
  const full = resolve(path);
  return {
    name: full,
    text: () => readFile(full, "utf8"),
    json: async () => JSON.parse(await readFile(full, "utf8")),
    lines: async () => (await readFile(full, "utf8")).split("\n").filter((l) => l !== ""),
    exists: async () => {
      try {
        await access(full, FS.F_OK);
        return true;
      } catch {
        return false;
      }
    },
    slice: async (offset = 0, limit = Infinity) => {
      const ls = (await readFile(full, "utf8")).split("\n");
      const from = offset > 0 ? offset - 1 : 0;
      return ls.slice(from, limit === Infinity ? undefined : from + limit).join("\n");
    },
  };
}

function makeEdit(helpers) {
  async function edit(path, oldOrEdits, next, opts = {}) {
    const full = resolve(path);
    const before = await readFile(full, "utf8");
    const pairs = Array.isArray(oldOrEdits) ? oldOrEdits : [[oldOrEdits, next]];
    const { all = false, soft = false } = opts;
    const fail = (error) => (soft ? { ok: false, replacements: 0, error } : Promise.reject(new Error(error)));

    // دسته‌ای: اول همهٔ لنگرها بررسی می‌شوند، بعد نوشتن
    let working = before;
    for (const [oldText, newText] of pairs) {
      const count = working.split(oldText).length - 1;
      if (count === 0) return fail(`"${String(oldText).slice(0, 60)}" not found in ${path}`);
      if (count > 1 && !all) return fail(`"${String(oldText).slice(0, 60)}" found ${count} times in ${path}`);
      working = all ? working.split(oldText).join(newText) : working.replace(oldText, () => newText);
    }
    await writeFile(full, working, "utf8");
    return { ok: true, replacements: working === before ? 0 : 1 };
  }
  return edit;
}

function preview(value, n = 200) {
  let s;
  if (value && typeof value === "object" && typeof value.output === "string") s = value.output;
  else s = value === null || value === undefined ? "" : String(value);
  if (s.length <= n) return s;
  return `${s.slice(0, n)}…[+${s.length - n} chars]`;
}

function buildGlobals() {
  const ring = new ConsoleRing();
  const logger = (...args) => ring.push(...args);
  const helpers = {
    $: shell,
    read: async (path) => readFile(resolve(path), "utf8"),
    write: async (path, content) => {
      const buf = Buffer.from(String(content), "utf8");
      await writeFile(resolve(path), buf);
      return buf.length;
    },
    edit: makeEdit(),
    file: makeFile,
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    preview,
    log: logger,
    console: ring,
    glob: async (pattern) => {
      const slash = pattern.lastIndexOf("/");
      const dirOnly = slash === -1 ? "." : pattern.slice(0, slash) || "/";
      const base = resolve(dirOnly);
      const leaf = pattern.split("/").pop();
      const re = new RegExp(
        "^" + leaf.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".") + "$",
      );
      const out = [];
      const walk = async (dir, depth) => {
        if (depth > 8 || out.length >= 500) return;
        let entries;
        try {
          entries = await readdir(dir, { withFileTypes: true });
        } catch {
          return;
        }
        for (const e of entries) {
          if (e.name.startsWith(".") || e.name === "node_modules") continue;
          const full = join(dir, e.name);
          if (e.isDirectory()) await walk(full, depth + 1);
          else if (re.test(e.name)) out.push(full);
        }
      };
      await walk(base, 0);
      return out;
    },
    grep: async (pattern, path = ".") => {
      const r = await runCommand({ command: `rg -n --no-heading ${quoteValue(pattern)} ${quoteValue(path)}`, nothrow: true });
      return r.stdout;
    },
    atob: (s) => Buffer.from(s, "base64").toString("binary"),
    btoa: (s) => Buffer.from(s, "binary").toString("base64"),
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    running: () => [],
  };
  return { helpers, ring };
}

// ---------------------------------------------------------------- اجرای اسکریپت

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

function withReturnOfLastExpression(code) {
  const lines = code.split("\n");
  let i = lines.length - 1;
  while (i >= 0 && lines[i].trim() === "") i--;
  if (i < 0) return code;
  const last = lines[i].trim();
  if (/^(const|let|var|if|for|while|do|switch|try|throw|return|import|export|class|function|async|\{|\/\/)/.test(last)) return code;
  if (/[;{}]$/.test(last) && !/^\(/.test(last)) return code;
  lines[i] = "return (" + last.replace(/;$/, "") + ");";
  return lines.join("\n");
}

async function runScript(code) {
  const { helpers, ring } = buildGlobals();
  const names = Object.keys(helpers);
  const values = names.map((n) => helpers[n]);
  const fn = new AsyncFunction(...names, `"use strict";\n${withReturnOfLastExpression(code)}`);
  const value = await fn(...values);

  const parts = [];
  const logged = ring.buffer();
  if (logged) parts.push("<log>", logged, "</log>");
  const rendered = value === undefined ? "(nothing returned)" : typeof value === "string" ? value : safeJson(value);
  parts.push("<result>", rendered, "</result>");

  let text = parts.join("\n");
  if (text.length > MAX_RESULT) {
    const head = text.slice(0, MAX_RESULT * 0.7);
    const tail = text.slice(-MAX_RESULT * 0.25);
    text = `${head}\n… [بریده شد: ${text.length - head.length - tail.length} کاراکتر] …\n${tail}`;
  }
  return text;
}

// ---------------------------------------------------------------- پروتکلِ MCP

function send(obj) {
  process.stdout.write(JSON.stringify(obj) + "\n");
}

const TOOL = {
  name: "code",
  description:
    "Run one JavaScript snippet that does several steps at once — shell commands, file reads and edits, search — " +
    "and return only what matters. Better than many separate calls when the output would be long and you need a summary.\n\n" +
    "Globals inside the snippet:\n" +
    "- `$` shell: `await $`cmd`.text()`, `.lines()`, `.json()`; chain `.nothrow()`, `.cwd(dir)`, `.env(vars)`, `.timeout(ms)`; " +
    "or `$(cmd, ms)`. A non-zero exit throws, except exit 1 from grep/rg/diff/find/test which is an outcome.\n" +
    "- `read(path)` · `write(path, data)` (returns bytes) · `edit(path, old, next, {all, soft})` or `edit(path, [[old,next],…])`\n" +
    "- `file(path)` → `.text()` `.lines()` `.json()` `.exists()` `.slice(offset, limit)`\n" +
    "- `glob(pattern)` · `grep(pattern, path)` · `sleep(ms)` · `preview(value, n)` · `log(...)` · `console.tail(n)` · `atob`/`btoa`\n\n" +
    "The last expression's value is returned; top-level `await` works; `import` does not.\n\n" +
    "Example:\n```js\nconst files = await glob('Doc/*.md');\nconst rows = await Promise.all(files.map(async f => ({ f, n: (await read(f)).split('\\n').length })));\nrows.sort((a, b) => b.n - a.n).slice(0, 5)\n```",
  inputSchema: {
    type: "object",
    properties: {
      code: { type: "string", description: "JavaScript source. The value of the last expression is returned." },
    },
    required: ["code"],
  },
};

let buffer = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  let idx;
  while ((idx = buffer.indexOf("\n")) !== -1) {
    const line = buffer.slice(0, idx).trim();
    buffer = buffer.slice(idx + 1);
    if (line) handle(line);
  }
});

async function handle(line) {
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    return;
  }
  const { id, method, params } = msg;

  if (method === "initialize") {
    send({
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: params?.protocolVersion ?? "2025-06-18",
        capabilities: { tools: {} },
        serverInfo: SERVER,
      },
    });
    return;
  }
  if (method === undefined || method.startsWith("notifications/")) return;

  if (method === "tools/list") {
    send({ jsonrpc: "2.0", id, result: { tools: [TOOL] } });
    return;
  }

  if (method === "tools/call") {
    if (params?.name !== "code") {
      send({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: `unknown tool: ${params?.name}` }], isError: true } });
      return;
    }
    const code = String(params?.arguments?.code ?? "");
    if (!code.trim()) {
      send({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: "empty code" }], isError: true } });
      return;
    }
    const started = Date.now();
    try {
      const text = await Promise.race([
        runScript(code),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`script stopped after ${SCRIPT_LIMIT_MS} ms`)), SCRIPT_LIMIT_MS).unref?.(),
        ),
      ]);
      send({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text }], isError: false, _meta: { ms: Date.now() - started } } });
    } catch (e) {
      const detail = e?.stack ?? String(e);
      send({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: `<error>\n${detail}\n</error>` }], isError: true } });
    }
    return;
  }

  if (id !== undefined) {
    send({ jsonrpc: "2.0", id, error: { code: -32601, message: `method not found: ${method}` } });
  }
}
