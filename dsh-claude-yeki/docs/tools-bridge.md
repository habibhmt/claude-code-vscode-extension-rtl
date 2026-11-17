# اتصال محلی ابزارها، ۱۷ نوامبر ۲۰۲۶

| بخش | قرارداد و شاهد |
|---|---|
| ورود عادی | `index.js` پس از تزریق `tools/agents/workingDirectory`، `mountToolBridge` را بار می‌کند. محدودهٔ پیش‌فرض همان `~/.claude/dsh-history/workspaces.json` است؛ مسیر دقیق و در صورت وجود شناسه‌های چت باید تطبیق کنند. `tools.projects` صریح، حتی `[]`، بر آن اولویت دارد. |
| ابزارهای Claude | فهرست از `claude mcp serve` واقعی با HOME موقت و بدون credential یا MCP سراسری خوانده می‌شود. نسخهٔ بررسی‌شده ۲۲ ابزار داشت؛ تنها `Read` از میان آن‌ها خواندن فایل بدون وابستگی به driver اصلی را فراهم کرد. `Glob/Grep` در فهرست این نسخه نبودند. |
| ابزارهای DSH | از schemas واقعی عاملِ همان چت می‌آیند و با `tools.executable` و `tools.execute` بومی همان عامل اجرا می‌شوند. اجرای مستقیم تابع `definition.execute` وجود ندارد. `read/glob/grep/job_list` و گونهٔ فقط‌خواندنی `working_directory` بررسی اجرایی شدند. `list_subagent_models` فقط بدون آرگومان مجاز است؛ در سورس این شاخه فقط فهرست providerهای محلی را می‌خواند. lookup مدل که احتمال تماس خارجی دارد بسته است. |
| گزینه‌های دیگر | اجرای shell، تغییر فایل، تماس خارجی، پیام و زمان‌بندی در محدودهٔ این کار فقط محلی باز نشده‌اند. برای ابزارهای Claude وابستگی به driver/عامل/چت اصلی جدا توضیح داده می‌شود. `get_goal` در سورس DSH حتی برای خواندن، exact live caller داخل active driver را می‌خواهد؛ پل بیرون نوبت چنین هویتی نمی‌سازد. `schedule_list` پارامتر مالک چت ندارد، بنابراین آن را معادل فهرست همین چت نشان نمی‌دهیم. |
| تیک‌ها | snapshot مستقل ابزارهای پل در `~/.dsh/dsh-rtl/tool-policies/<sid>.json` ثبت می‌شود. پیش‌فرض پوشه از سراسری مستقل است؛ چت قدیمی از پیش‌فرض تازه تأثیر نمی‌گیرد. تیک صریح همان چت در هر درخواست دوباره خوانده می‌شود. `Read/read` و نام‌های واردشده و `mcp__dsh_yeki__dsh_…` راه دورزدن خاموشی نیستند. deny بومی Read در تنظیم‌های Claude محافظه‌کارانه کل Read پل را می‌بندد. |
| فهرست مدل | `when` ثبت ابزار واردشده، تیک را در admission بومی DSH هم اعمال می‌کند. فهرست MCP برگشت نیز فقط ابزارهای مجاز همین اتصال را برمی‌گرداند. موجودی پنل با `scope:{cwd,sessionId}` نگهداری می‌شود؛ موجودی چت دیگر نباید آمادهٔ این چت نشان داده شود. |
| اتصال Claude | pointer ثابت `~/.dsh/dsh-rtl/tool-bindings/<uuid>.json`، شامل `sessionId,cwd,bindingFile,stdio,ownerId` و مجوز 0600 است. hook محلی فقط برای sid/cwd مطابق آن را وصل می‌کند. فرمان stdio: `node tools-stdio.mjs <pointerFile> <expectedSessionId> <expectedCwd>`. نام ابزار نمونه در Claude: `mcp__dsh_yeki__dsh_job_list`. |
| اتصال خصوصی | فایل موقت `binding.json` مجوز 0600 و پوشهٔ 0700 دارد؛ شامل socket محلی و capability تصادفی است. token وارد موجودی پنل یا خروجی آزمون نمی‌شود. pointer در هر درخواست دوباره خوانده می‌شود، بنابراین عوض‌شدن مسیر موقت بعد از restart قابل تحمل است. |
| عمر اتصال | پس از هر await مالک و وضعیت dispose دوباره بررسی می‌شود. pointer فقط پس از آماده‌شدن MCP و ثبت aliasها به‌صورت atomic منتشر می‌شود. پاک‌سازی فقط pointer/inventory متعلق به `ownerId` خود را حذف می‌کند. اتصال ناتمام آماده حساب نمی‌شود. |
| یک بار اجرا | شناسهٔ درخواست پیش از اجرای مجاز ثبت می‌شود؛ تکرار، خطا یا timeout خودکار retry نمی‌شود. ابزار واردشده دوباره صادر نمی‌شود. هیچ دستور تاریخچه‌ای با راه‌اندازی پل اجرا نمی‌شود. تضمین dedup متعلق به عمر اتصال است؛ journal دائمی اجرای ابزار ساخته نشده است. |

## آزمون قابل تکرار

```sh
node --test dsh-claude-yeki/test/*.mjs
DSH_RUNTIME=/absolute/extracted/dsh/node_modules/@deepseek-ai/ CLAUDE_BINARY=/absolute/installed/claude node dsh-claude-yeki/scripts/live-tools-proof.mjs
```

`live-tools-proof.mjs` مدل را صدا نمی‌زند. یک composition محلی با ماژول‌های واقعی DSH و agent/session fixture می‌سازد؛ Read را از executable واقعی Claude و ابزارهای برگشت را از MCP stdio/socket و native executor می‌سنجد. این شاهدِ پنجرهٔ واقعی برنامه نیست. در کپی استخراج‌شده، `rg` بسته‌بندی‌شده باید قابل اجرا باشد؛ فایل خود برنامه تغییر داده نشد.

شاهد اجرای آخر: `/var/folders/6p/h39k55cn35j_ct74_b49x3cc0000gn/T/tools-live-MXyMcQ/proof.json`. `Read` متن تصادفی تازه را برگرداند؛ `job_list` شناسه و برچسب کارِ واقعی owned را یافت؛ `read/glob/grep/working_directory` از MCP برگشت پاس شدند. ثبت alias در چرخهٔ عادی host و pointer برگشت نیز با native admission/executor سنجیده شد.

خرابکاری روی کپی جدا: حذف guard تکرار، جداسازی چت، تیک و جلوگیری حلقه هر کدام آزمون را رد کرد. قطع مسیر برگشت آزمون واقعی را رد کرد و Read جهت رفت همچنان قبول شد. گزارش: `/var/folders/6p/h39k55cn35j_ct74_b49x3cc0000gn/T/tools-mutation-ipj1vig5/report.json`.

ورودی کامل `deepseek-chat.txt` و تمام JSONLهای ZIP به‌عنوان داده مرور شدند. دو خط شکستهٔ JSON در `session.v4.jsonl` (۲۰۶۶ و ۲۰۶۷) قابل parse نبودند؛ دستورهای داخل این داده اجرا نشدند. فهرست تاریخی headerهای معتبر ۴۶ ابزار داشت و با موجودی فعلی یکی فرض نشده است.

## بازبینی مستقل پنل

در کپی جدا از کاتالوگ و با تابع واقعی ساخت ردیف هر دو پنل، ۲۲ ابزار Claude و ۴۶ ابزار واقعی headerهای ZIP آزمایش شدند. متن کاربرد در ستون وسط و منبع در ستون بعد قرار گرفت. حذف عمدی ترجمهٔ `job_list` آزمون معنایی را رد کرد. سه ترجمهٔ جاافتادهٔ اولیه (`plugin_manager/subagent_fork/exit_plan_mode`) به مسئول پنل گزارش شد؛ پس از اصلاح، بررسی مستقل تکرار شد و تعداد ناشناخته در این ۶۸ ردیف صفر شد. شاهد تازه: `/var/folders/6p/h39k55cn35j_ct74_b49x3cc0000gn/T/ui-crosscheck-HcOGp4/report.json`. شاهد اولیه: `/var/folders/6p/h39k55cn35j_ct74_b49x3cc0000gn/T/ui-crosscheck-hGLRqz/report.json`. این بررسی رندر تابع روی fixture است، نه تأیید چیدمان پنجره در عرض واقعی.

محدودیت تاریخی: اگر چت پیش از نصب پل ساخته شده و هیچ snapshot معتبر تاریخی Claude یا پل ندارد، پیش‌فرض inherited گذشته از تنظیم فعلی به‌طور قطعی قابل بازیابی نیست. ثبات snapshot پل از اولین attach به بعد سنجیده شده است؛ این کار ادعای بازسازیِ گذشتهٔ ناموجود ندارد.

خرابکاری نهایی پس از اصلاح چرخهٔ عمر و snapshot: duplicate/session/ticks/folder-isolation/premature-ready هر کدام دقیقاً آزمون مربوط را قرمز کردند: `/var/folders/6p/h39k55cn35j_ct74_b49x3cc0000gn/T/tools-final-mutation-m62bxx97/report.json`.

## ایراد مسیر عادی و اصلاح

در آزمون بعدیِ خودِ ورودی `ctx.plugin(index)`، اتصال بسته می‌شد: callback تزریقِ `index.js` مقدار `{pending,ready}` تابع mount را برمی‌گرداند. Cordis این مقدار را اثر افزونه تلقی می‌کند و طبق `fiber._execute` با `Invalid effect` scope را می‌بندد. callback اکنون مقدار را برنمی‌گرداند. آزمون واقعی پس از اصلاح، از خود index اجرا و واردشدن Read و MCP برگشت تأیید شد: `/var/folders/6p/h39k55cn35j_ct74_b49x3cc0000gn/T/tools-live-nT1oMM`.

آزمون regression مستقلی به مجموعه اضافه شد؛ برگرداندن همان خط خراب، دقیقاً آزمون normal index injection را رد می‌کند. حذف خواندن snapshot به‌روز draft نیز دقیقاً آزمون stale draft policy را رد کرد. گزارش: `/var/folders/6p/h39k55cn35j_ct74_b49x3cc0000gn/T/normal-entry-mutation-p17afzpj/report.json`.

فایل `tools-policy.cjs` قرارداد همگام و مشترک پنل و اجراست: `aliasesFor`، `effectiveTickList`، `resolveTickState` و `updateDraftTickSnapshot`. آخرین تابع را فقط host پس از اثبات draft بودن چت صدا می‌زند؛ چت قدیمی یا در حال اجرا نباید از تغییر پیش‌فرض پوشه snapshot تازه بگیرد. diagnostic مختصر و بدون متن چت/کلید در `~/.dsh/dsh-rtl/tool-bridge-status.json` مرحلهٔ راه‌اندازی و تعدادها را ثبت می‌کند.
