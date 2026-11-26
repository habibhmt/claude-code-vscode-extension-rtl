# رمزگشاییِ Code Mode — چه هست، پروپتش چیست، چرا Anthropic می‌خواهد

> استخراج‌شده از باینریِ `~/.local/share/claude/versions/2.1.327` (نسخهٔ 2.1.327) با خواندنِ مستقیمِ رشته‌ها.
> هر بخش برچسب دارد: **[اندازه‌گیری‌شده]** = عیناً از باینری خوانده شد · **[استنباط]** = از روی کد حدس زده شد.
> تاریخ: ۱۸ نوامبر ۲۰۲۶

---

## ۱ · Code Mode در یک جمله

Code Mode یک ابزارِ **جدید** نیست؛ یک **حالتِ نمایش** روی همان ابزارهای موجود است. به‌جای اینکه مدل یکی‌یکی `Bash` و `Read` و `Edit` صدا بزند، **یک قطعه کدِ JavaScript** می‌نویسد و همان کد، ابزارها را صدا می‌زند. مزیتش سرعت است نه قدرت: چند کار موازی در یک نوبت.

## ۲ · هویتِ واقعیِ ابزار **[اندازه‌گیری‌شده]**

```js
var Ho="REPL", YY="Eval", P7t="Code";
function Fa(o){return o===Ho||o===YY}
function ahe(o){return ae()&&Fa(o)?P7t:o}
```

| چیز | مقدارِ عینی |
|---|---|
| نامِ داخلی | `REPL`، و نامِ قدیمی‌تر `Eval` |
| نامِ نمایشی به مدل | `Code` |
| ورودی | `{ code: string }` — رشتهٔ خامِ JavaScript، بدونِ heredoc و بدونِ quoteِ شل |
| نگاشت در قواعدِ اجازه | `["REPL","code"]، ["Eval","code"]` — یعنی فیلدِ حساس `code` است |

## ۳ · پروپتِ ابزار — نقلِ عینی از باینری **[اندازه‌گیری‌شده]**

این‌ها تکه‌های متنی‌اند که باینری به مدل می‌دهد. جای عدد‌ها در باینری متغیر است (در زمانِ اجرا پر می‌شود):

**هستهٔ کار:**

> «Your one tool is `REPL`; there are no other tools. Everything you do — shell commands, file reads and edits, code search, web fetches, MCP calls — happens as JavaScript inside a `REPL` call, through the globals below.»

> «Everything you do to investigate — shell commands, file reads, code search — happens as JavaScript inside a `REPL` call, through the globals below; the other tools in your list are also callable from a script, by name.»

**مثالِ خودش:**

> «One script can look in several places at once and then act on what it found, for example:»
> ```js
> const [defs, uses] = await Promise.all([
>   $`rg -l "function retryPolicy" src`.text(),
>   $`rg -lF "retryPolicy(" src test`.text(),
> ]);
> const target = defs.trim().split('\n')[0];                 // the file that defines it
> if (!target) throw new Error('nothing defines retryPolicy: not editing');
> await edit(target, 'maxAttempts: 3', 'maxAttempts: 5');
> ({edited: target, callers: uses.trim().split('\n').filter(f => f !== target), test: $`npm test -- retryPolicy`.nothrow()})
> ```

**قراردادِ خروجی:**

> «A call's result is a `<repl-output>` element: `<log>` lines, then the `<result>` (or `<error>`).»

> «How output arrives: a script that finishes within about «N» s comes back as the `REPL` call's own result, a `<repl-output eval="N">` element holding `<log>` lines and the `<result>` (or `<error>`). One still running by then returns `(dispatched #N)` instead, runs on, and no longer holds up the scripts after it: its output arrives as an `<event kind="repl-eval">` element … A receipt means the script is running, so issuing it again would run it twice. Scripts start in call order.»

**فشرده‌سازیِ خروجی:**

> «Each part of what a script returns (each key of a returned object, what it logged) is shown cut to about «N» characters, head and tail kept, with a marker where the middle went.»

> «In a call's own result … `&`, `<` and `>` are shown to you as `&amp;`, `&lt;` and `&gt;`. That's only how output is shown: your files and values aren't changed…»

**خطاها:**

> «$ throws on a non-zero exit, as Bun.$ does; use `(await $\`cmd\`.nothrow()).exitCode` to inspect it instead.»

> «REPL: unawaited Promise coerced to string. A result used inline needs 'await' — e.g. `const c = await file(f).text(); await write(f, c + s)`. Only the top-level keys of a returned object are awaited for you.»

> «Syntax error, so nothing ran» · «Nothing ran: import and require aren't available here» · «Nothing ran: this syntax isn't supported here»

**ابزارهای MCP:**

> «MCP tools: connected servers are «…». Find a tool with `searchTools`, then call it with the input its match shows.»

**زمان:**

> «Timeouts cap at 600000 ms…» · «A script is stopped 600000 ms after it starts, counting the time spent waiting on permission prompts…»

## ۴ · جهانی‌های داخلِ اسکریپت (تولیدکنندهٔ قرارداد) **[اندازه‌گیری‌شده]**

باینری برای هر سشن یک بلوکِ TypeScript می‌سازد و به مدل می‌دهد:

```
// The globals of a REPL script, as TypeScript declarations.
// The session's tools are not listed here: searchTools finds them.
```

| جهانی | کار |
|---|---|
| `$\`cmd\`` | اجرای شل، مثلِ `Bun.$`. متدها: `.text()` · `.stdout` · `.stderr` · `.exitCode` · `.nothrow()` |
| `tools` | همهٔ ابزارهای سشن با نام: `{ [name: string]: (input) => Promise<unknown> } & { list(): string[] }` |
| `describeTool(name)` | توضیحِ کاملِ ابزار + schemaِ ورودی |
| `searchTools` | پیدا کردنِ ابزاری که در فهرستِ مدل نیست (مثلاً MCP) |
| `edit`، `read`، `write`، … | هر ابزارِ سشن، **هم به‌صورت تابعِ مستقل** |

> «Every tool of this session by name, with its usual input (each is a bare global too); a built-in resolves `{error}` on failure; an MCP tool throws (`e.message` carries the tool error, `e.detail` the parsed body when it was JSON).»

## ۵ · چرا Anthropic لازم است — دروازه‌ها **[اندازه‌گیری‌شده]**

این فهرستِ کاملِ دلیل‌هایی است که باینری برای رد کردنِ Code Mode دارد، عیناً. شش کدِ داخلی که در باینری هست:
`api_key_auth` · `no_profile_scope` · `not_in_rollout` · `managed_disabled` · `not_subscription_auth` · `bad_value` / `no_bash` / `own_settings` / `unsaved`.
جفت‌کردنِ کد به متن در جدول زیر **از روی معنی** انجام شده، نه از روی ترتیبِ بایت‌ها (ترتیبشان یکی نیست).

| متنِ دلیل | کدِ داخلی |
|---|---|
| «set the environment variable … must be 1 to turn it on» | — |
| «Kit has to be turned on in ~/.claude/settings.json (in its env block) or with --settings, because managed settings or ~/.claude.json also set …» | `own_settings` |
| «your organization's settings don't allow it» | `managed_disabled` |
| «Claude Code couldn't read your organization's settings or policy (starting Claude Code again may help)» | — |
| «Claude Code checked your organization's policy with a different credential than the one it now uses» | — |
| «it isn't offered yet to organizations under HIPAA or zero data retention» | — |
| «OpenTelemetry is on … and … doesn't yet send it an event for each tool call» | — |
| «it needs Claude Code's native build» | — |
| «this version of Claude Code didn't pass a check that only … needs» | — |
| «for now it needs Git for Windows (Bash) on Windows» | — |
| «for now it only works in the interactive terminal» | — |
| «for now it doesn't work in background jobs, in teammates' panes or with Remote Control» | — |
| «Claude Code skipped the start-up steps that check for it (CI or IS_DEMO)» | — |
| «this launch's tool options (--restricted, --tools, --disallowedTools or a deny rule) leave it out» | `no_bash` |
| «for now it doesn't work with an API key helper, ANTHROPIC_AUTH_TOKEN or custom auth headers» | `api_key_auth` |
| **«for now it only works directly with the Anthropic API (not through a cloud provider such as Bedrock, a gateway or another address in ANTHROPIC_BASE_URL)»** | `not_subscription_auth` |
| «for now it only works with Opus 5.5, Sonnet 5.5 and later models» | — |
| «it needs settings that Claude Code downloads from Anthropic…» | `no_profile_scope` |
| «it isn't open to your account in this version of Claude Code, or Claude Code couldn't check whether it is» | `not_in_rollout` |
| «you chose not to turn it on» | — |
| «Claude Code couldn't save your answer in ~/.claude.json» | `unsaved` |

### نتیجهٔ مهم

دروازه **دو لایه** است و هر دو باید باز شوند:

1. **لایهٔ محلی** — همان کلیدِ `CLAUDE_CODE_EXPERIMENTAL_CODE_MODE=1` در `settings.json`. این را باز کردیم و آزمودیم: در ترمینال با مدلِ Claude روشن می‌شود.
2. **لایهٔ سرور** — `not_in_rollout`: «آیا این حساب مجاز است». این با تنظیمِ محلی باز نمی‌شود؛ برنامه از Anthropic می‌پرسد.

هیچ‌کدام از این‌ها «محافظتِ امنیتی» نیستند؛ فقط **شرطِ انتشار** است. خودِ کدِ اجرا هیچ چیزی از Anthropic لازم ندارد: یک فرزندِ Node/Bun است که اسکریپت را می‌دواند و ابزارها را از راهِ یک pipe صدا می‌زند. **[استنباط — از روی `ft()`/`mt()`/`bt()` در باینری]**

## ۶ · سه راه برای اینکه خودمان برانیم **[ارزیابی، نه نقل]**

| راه | چه می‌کند | ریسک | حکم |
|---|---|---|---|
| **الف· ماژ (mod) خودمان** | یک ابزارِ تازه به نامِ `js` یا `code` در `mods/` که اسکریپت را در Node می‌دواند و ابزارهای سشن را صدا می‌زند | صفر برای باینری؛ جدا از آپدیت‌ها می‌ماند | ✅ **تنها راهِ پایدار** |
| ب· پچ‌کردنِ باینری | برداشتنِ شرطِ `not_in_rollout` از فایلِ اجرایی | خیلی زیاد — امضای ad-hoc، `allow-jit` می‌رود و Bun می‌میرد | ❌ قبلاً هم همین را دیدیم؛ نزن |
| ج· تأییدِ کلیدِ API | `api_key_auth` را هم باید باز کرد، و پولِ جدا دارد | پول | ⏸ تصمیمِ حبیب |

راهِ «الف» را می‌شود ساخت چون همهٔ تکه‌های لازم را داریم: قراردادِ ورودی (`{code}`)، جهانی‌ها (`$`, `tools`, `describeTool`, `searchTools`)، و قالبِ خروجی (`<log>` + `<result>`).

## ۶.۵ · نسخهٔ خودمان ساخته شد — `abzar/code-mcp/server.mjs`

راهِ «الف» بالا ساخته و آزموده شد. یک سرورِ MCP بی‌وابستگی (فقط Node، بدونِ هیچ پکیج) با یک ابزار به نامِ `code`.

| چیز | مقدار |
|---|---|
| منبعِ حقیقت | `abzar/code-mcp/server.mjs` (داخلِ مخزن؛ اینجا ویرایش می‌شود) |
| نسخهٔ اجراشده | `~/.claude/mcp/fork_code_mode/server.mjs` — **بیرونِ مخزن**، چون پوشهٔ ۱۳۶ روزشمار است و اگر عوض/رها شود، ابزار در همهٔ پروژه‌ها می‌مرد |
| نصب/به‌روزرسانی | `bash abzar/code-mcp/nasb.sh` · سنجشِ یکی‌بودنِ دو نسخه: `bash abzar/code-mcp/nasb.sh --check` (در `test_all.sh` هست) |
| نام | **`fork_code_mode`** (حبیب، ۲۶ نوامبر ۲۰۲۶: «اسمش رو بزار فورک کد مود کلاد») · ابزارِ درونش `code` |
| ثبت | **سراسری** در `~/.claude.json` (`mcpServers.fork_code_mode`)، پس در همهٔ پروژه‌ها هست |
| فراخوانی | `mcp__fork_code_mode__code` |
| اجرا | `/opt/homebrew/bin/node ~/.claude/mcp/fork_code_mode/server.mjs` |
| جهانی‌ها | `$` (زنجیره‌ای: `.nothrow` `.throws` `.cwd` `.env` `.timeout` · خواننده: `.text()` `.lines()` `.json()`) · `read` · `write` · `edit` (تکی و دسته‌ای) · `file()` · `glob` · `grep` · `sleep` · `preview` · `log` · `console` · `atob`/`btoa` |
| برگشت | آخرین عبارت، در `<result>`؛ خطاها در `<error>` |
| سقف | ۶۰۰٬۰۰۰ ms اجرا · زمان‌سنجیِ هر فرمان تا ۷٬۲۰۰٬۰۰۰ ms |
| منطقِ خطا | مثلِ خودش: `exit 1` از `grep`/`rg`/`diff`/`find`/`test` **throw نمی‌کند** |

**آزمونِ انجام‌شده:** خواندنِ دو فایل و جمعِ خطوط → `5`، برابر با `3 + 2` · `$\`wc -l < a.txt\`.text()` → `3` · `$\`printf 'p\nq\n'\`.lines()` → `2` · `(await $\`exit 7\`.nothrow()).exitCode` → `7` · `$\`grep -c zzz a.txt\`` (exit 1) → `1` بدونِ throw · `await $\`exit 4\`` → `ShellError:4` · `edit` تکی و دسته‌ای → `TWO` · `write` → `5` بایت · `preview` → `xxxxxxxxxx…[+290 chars]` · `glob('*.txt')` → سه فایل · `Promise.all` روی `file()` → `[{"f":"a.txt","n":3},{"f":"b.txt","n":2}]` · `throw` → `<error>`.

**پل به سرورهای دیگر (۲۶ نوامبر ۲۰۲۶، حبیب: «پل بزن»):** `abzar/code-mcp/mcp_pool.mjs` — از داخلِ اسکریپت، ابزارِ هر سرورِ MCP ِ ثبت‌شده صدا زده می‌شود. سه جهانیِ تازه: `mcp_list()` · `mcp_tools(server)` · `mcp_pal(server, tool, args)`.

| آزمون (‏`node abzar/code-mcp/test_pool.mjs`) | نتیجه |
|---|---|
| فهرستِ سرورها از `~/.claude.json` | ✅ ۵ سرور: `hafeze · computer_use · fork_code_mode · brave-search · exa` |
| `mcp_pal` به خودِ سرور (‏`1+1`) | ✅ جواب `2` |
| `mcp_tools('fork_code_mode')` | ✅ `code` |
| خرابکاری ۱: سرورِ ناموجود | ✅ خطای «ثبت نشده»، بدونِ کرش |
| خرابکاری ۲: ابزارِ ناموجود | ✅ خطای «ابزاری به نام»، بدونِ کرش |
| فراخوانیِ واقعیِ `hafeze.gashtan_dar_hafeze` | ✅ ۴۶۴ نویسه جوابِ واقعی از حافظه |

**فرقِ باقی‌مانده با اصلی:** ابزارهای *درونیِ خودِ Claude Code* (‏Workflow، SendMessage، WebFetch) از داخلِ اسکریپت صدا زده نمی‌شوند — آن‌ها فقط داخلِ خودِ برنامه اجرا می‌شوند، نه در یک سرورِ MCP ِ جدا. هر MCP ِ ثبت‌شده اما از این پل در دسترس است.

**آزمونِ نسخهٔ نصب‌شده (۲۶ نوامبر ۲۰۲۶، ۰۳:۴۰):**

| آزمون | نتیجه |
|---|---|
| `bash abzar/code-mcp/nasb.sh --check` | ✅ `سبز: server.mjs یکی است` · `سبز: mcp_pool.mjs یکی است` |
| خرابکاریِ عمدی: یک خط به نسخهٔ نصب‌شده اضافه شد | ✅ قرمز شد (`دو نسخهٔ server.mjs یکی نیستند`)، با `bash abzar/code-mcp/nasb.sh` برگشت و باز سبز شد |
| اجرای سرور از مسیرِ نصب‌شده | ✅ `serverInfo {"name":"fork_code_mode","version":"1.2.0"}` و پل ۵ سرور را دید |
| `node abzar/code-mcp/test_pool.mjs` روی **۴** نود (۱۸.۱۷ · ۲۲.۲۳ · ۲۴.۲۲ · ۲۵.۹) | ✅ هر چهار: ۶ آزمون سبز |

**نودِ سرورِ کامپیوتر هم عوض شد (۲۶ نوامبر ۲۰۲۶):** مسیرش به `~/.nvm/versions/node/v22.23.2` گره خورده بود و روی این مک **دو** نسخهٔ nvm نصب است (۲۲ و ۲۴) ⇒ با نسخهٔ بعدی می‌مرد. حالا `/opt/homebrew/bin/node` (نسخهٔ ۲۵.۹). بکاپ: `~/.claude/backups/claude.json.bak-pish-az-nod-20261126-0336`.

| آزمونِ جابه‌جاییِ نود | نتیجه |
|---|---|
| `sharp` واقعاً عکس ساخت (نه فقط `require`) زیرِ نودِ ۲۲ و ۲۵ | ✅ ۹۵ بایت خروجی |
| `@nut-tree-fork/nut-js` زیرِ نودِ ۲۲ و ۲۵ | ✅ `keyboard` و `screen` هر دو |
| معماریِ ماژولِ نیتیو | ✅ `libnut.node` یونیورسال: `x86_64` + `arm64` |
| `claude mcp list` | ✅ `computer_use: /opt/homebrew/bin/node … ✔ Connected` · `fork_code_mode: /opt/homebrew/bin/node ~/.claude/mcp/fork_code_mode/server.mjs ✔ Connected` |

**وضعیت:** `claude mcp list` → هر پنج سرور `✔ Connected`.

## ۷ · دفترِ استخراج — چه پیدا شد و چه نشد

### ۷.۱ · اسمِ فایل‌های واقعیِ موتورِ REPL — **پیدا شد**

در جدولِ فایل‌های باندل (آفست `353264391`) این اسم‌ها هست. یعنی موتورِ Code Mode از این تکه‌ها ساخته می‌شود:

| فایل | نقش |
|---|---|
| `shell.prelude.js` | تعریفِ `$` و شکلِ نتیجه‌اش |
| `running.prelude.js` · `file.prelude.js` · `team.prelude.js` | سه پیش‌درآمدِ دیگر (اجرا · فایل · تیم) |
| `core.bash.sync.d.ts` · `core.bash.async.d.ts` | اعلان‌های شلِ bash، همگام و ناهمگام |
| `core.powershell.sync.d.ts` · `core.powershell.async.d.ts` | همان برای PowerShell |
| `team.sync.d.ts` · `team.async.d.ts` | اعلان‌های تیم |
| `kit-modules.js` · `tools-external.d.ts` | ماژول‌ها و ابزارهای بیرونی |

این با کدِ `js()` جور است که می‌گفت `HELPER_DTS.core[o][l]` با `o ∈ {bash, powershell}` و `l ∈ {sync, async}` — دقیقاً همان چهار فایل.

### ۷.۲ · متنِ داخلِ `.d.ts` — **پیدا شد** ✅

آفست‌ها در باینری، هر کدام یک قابِ zstdِ کامل:

| فایل | آفست | حجم |
|---|---|---|
| `core.bash.async.d.ts` (بزرگ‌ترین) | `352963714` | ۹٬۷۱۶ بایت |
| یکی از سه نسخهٔ دیگر bash | `352967193` | ۸٬۵۸۱ بایت |
| یکی دیگر | `352970281` | ۹٬۴۳۶ بایت |
| `core.powershell.*` | `352973635` | ۸٬۳۰۱ بایت |
| `tools-external.d.ts` (ورودیِ همهٔ ابزارها) | `353046967` | ۱۳۰٬۳۴۶ بایت |

متنِ کاملِ bash در `Doc/codemode-core.bash.d.ts.txt` و متنِ ابزارها در `Doc/codemode-tools-external.d.ts.txt` ذخیره شد.

**روشی که جواب داد:** قاب‌ها به هم **نچسبیده‌اند**؛ اول همین را غلط فرض کرده بودم. با بریدنِ دقیقاً تا آفستِ قابِ بعدی (نه پنجرهٔ ثابتِ ۲۵۶ کیلوبایتی) هر قاب کامل باز شد.

#### کلِ API — از خودِ فایل

| جهانی | امضا |
|---|---|
| `$` | `$(strings, ...values)` و `$(cmd: string, timeoutMs?)` |
| زنجیرهٔ `$` | `.nothrow()` · `.throws(on)` · `.quiet()` · `.timeout(ms)` · `.cwd(dir)` · `.env(vars)` · `.text()` · `.lines()` · `.json()` · `.whole` |
| `ShellOutput` | `stdout` · `stderr` · `exitCode` · `text()` · `lines()` · `json()` · `output` · `truncated` · `whole` · `file?` · `bytes?` · `running?` · `error?` · `note?` |
| `edit` | `edit(path, old, next, {all, soft})` و شکلِ دسته‌ای: `edit(path, [[old,next],…])` |
| `write` | `write(path, content): Promise<number>` — تعدادِ بایت |
| `file` | `file(path)` → `.name` `.text()` `.json()` `.lines()` `.exists()` `.slice(offset, limit)` |
| `sleep` | `sleep(ms)` |
| `preview` | `preview(value, n = 200)` — بریده‌نمای خروجی |
| `log` | `log(...args)` — خطی که با نتیجه می‌آید |
| `running()` | اسکریپت‌های در جریان، با `abort()` روی هر کدام |
| `console` | `console.log/info/debug/warn/error` + `tail(n)` `buffer()` `dropped()` |
| `searchTools` | `searchTools(query, max?)` → فهرستِ ابزارها با نام و ورودی |
| `describeTool` | `describeTool(name)` → توضیح + `inputSchema` |

#### عددهایی که در همین فایل صریح‌اند

| مقدار | معنی |
|---|---|
| `600000` ms | انتظارِ پیش‌فرضِ هر فرمان |
| `7200000` ms | سقفِ timeoutِ یک فرمان (۲ ساعت) |
| `64 MiB` | سقفِ فایلِ سرریزِ خروجی |
| `exit 1` از `grep`/`rg`/`diff`/`test`/`git grep` | **throw نمی‌کند** — «پیدا نشد» حساب می‌شود |

### ۷.۳ · نقطهٔ spawn — **باطل شد؛ spawn ای در کار نیست** (ببین ۷.۷)

اول دنبالِ `spawn` گشتم و پیدا نکردم؛ بعد معلوم شد **دنبالِ چیزِ اشتباهی می‌گشتم**. موتور با `vm` ِ Node در همان پروسه اجرا می‌شود (مادهٔ ۷.۷)، پس فرزندی در کار نیست.

تنها `spawn`ی که پیدا شد مالِ ابزارِ *دیگری* است (`AppifactRepl`): `CO(...)` با `{cwd, env, stdio:["pipe","pipe","pipe"], extendEnv:!1}` — الگو، نه خودِ کد.

### ۷.۴ · عددهای دقیق — **پیدا شدند** ✅

اول گفتم «در باینری عدد نیستند»؛ غلط بود. عددها هستند، فقط به‌شکلِ عددی ذخیره شده‌اند نه رشته: سرچ برای `30,000` چیزی نداد ولی `R=30000` هست. جدول:

| مقدار | منبع |
|---|---|
| `600000` ms — سقفِ کلِ یک اسکریپت | رشتهٔ `Hd` |
| `600000` ms — سقفِ هر فرمان، بعدش می‌رود پس‌زمینه | رشتهٔ `Bd` |
| `64 MiB` — سقفِ فایلِ سرریزِ خروجیِ شل | `.d.ts` ِ مادهٔ ۷.۲ (پیدا شد) |
| `7200000` ms — بلندترین timeoutِ یک فرمان | همان فایل |
| `30000` کاراکتر — سقفِ نمایشِ خروجیِ برگشتی | **پیدا شد**: `var f7r="repl-tool-code.js", Svn=600000, R=30000;` در آفست `295794178`، و `function otr(){return R}`. عددِ اولم درست بود؛ «تصحیح»ِ بعدی‌ام غلط بود چون در باینری به‌شکلِ `30000` عددی ذخیره شده، نه رشتهٔ `30,000` |

### ۷.۶ · تصحیحِ مهم: زمینه **ماندگار** است، نه یک‌بارمصرف

متنِ خودِ باینری (آفست `323688998`):

> «The REPL is one persistent JavaScript context: variables and functions you define in one call are there in the next, so keep results in variables (`const out = await $\`…\`.text()`) instead of re-reading a file or re-running a command whose output you already hold. Those variables last between calls, but not across a restart, a resume, a fork or a wake…»

یعنی برخلافِ آنچه اول فکر می‌کردم، هر فراخوانی یک اسکریپتِ جدا نیست: **یک زمینهٔ JS زنده در تمامِ سشن**. این با ابزارِ `AppifactRepl` (که «scope lives for this one call only» بود) فرق دارد — دو ابزارِ متفاوت‌اند و من اول قاطی کردم.

### ۷.۷ · موتور: `vm` ِ Node، در همان پروسه — نه فرزندِ جدا

آفست `323702473`: `import * as Er from "vm"` درست کنارِ `running.prelude.js` و `file.prelude.js`. پس اسکریپت در یک context مجازیِ همان پروسه اجرا می‌شود، نه در یک فرزندِ Node. ادعای قبلیِ من در بخشِ ۶ («یک فرزندِ Node/Bun») **غلط بود**.

### ۷.۸ · ثابت‌های موتور (آفست `295794178`)

```js
var f7r="repl-tool-code.js", Svn=600000, R=30000;
```

| ثابت | مقدار | معنی |
|---|---|---|
| `f7r` | `"repl-tool-code.js"` | نامِ فایلِ موقتیِ اسکریپت |
| `Svn` | `600000` | سقفِ زمانِ یک اسکریپت |
| `R` (با `otr()`) | `30000` | سقفِ نمایشِ خروجی |
| `M` / `y` | `30000` | همان سقف در جای دیگر |
| `L` | `50000` | سقفِ دوم |
| `Lft` | `7200000` | بلندترین timeoutِ فرمان |

### ۷.۹ · پرامپتِ کاملِ حالت — **تکه‌تکه، نه یک بلوک**

در باینری یک رشتهٔ یک‌تکه نیست؛ از ده‌ها رشتهٔ کوچک سرِ هم می‌شود. آنچه در بخش ۳ نقل شد، همهٔ تکه‌های معنادار است.

---

**فرمانِ بازتولیدِ استخراج:**

```sh
B="$HOME/.local/share/claude/versions/2.1.327"

# ۱ · ثابت‌های موتور
python3 -c "d=open('$B','rb').read(); i=d.find(b'Svn=600000'); print(d[i-200:i+200].decode('utf-8','replace'))"

# ۲ · زمینهٔ ماندگار + متنِ پروپت
python3 -c "d=open('$B','rb').read(); i=d.find(b'shown cut to about'); print(d[i-1500:i+900].decode('utf-8','replace'))"

# ۳ · دامنه‌های TypeScript: هر قابِ zstd را تا آفستِ قابِ بعدی ببر، نه پنجرهٔ ثابت
python3 - <<'EOF'
import subprocess
B=__import__("os").path.expanduser("~/.local/share/claude/versions/2.1.327")
d=open(B,"rb").read(); m=b"\x28\xb5\x2f\xfd"
offs=[]; s=0
while (i:=d.find(m,s))>=0: offs.append(i); s=i+1
for n,o in enumerate(offs):
    e=offs[n+1] if n+1<len(offs) else len(d)
    open("/tmp/f.bin","wb").write(d[o:e])
    out=subprocess.run(["zstd","-dcq","/tmp/f.bin"],capture_output=True).stdout
    if b"declare function $" in out: print("d.ts at", o, len(out)); break
EOF
```
