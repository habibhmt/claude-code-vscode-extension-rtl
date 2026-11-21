# دفتر کارهای باز — پروژهٔ ۱۳۶

> قبل از هر کار این فایل را بخوان؛ بعد از هر کار وضعیت/مدرک را همان‌جا به‌روز کن.
> وضعیت‌ها: انجام / نیمه / باز / معلق / در حال.

| # | کار | منبع | وضعیت | مدرک | قدم بعدی |
|---|---|---|---|---|---|
| ۱ | XSS اپ ۱۸۶ | moalagh ۱ | انجام | `esc()` در `186-montaghel/app/index.html`؛ `test_xss_186.cjs` در مخزن؛ PASS | — |
| ۲ | Thought با کلیک/فوکوس | چت | انجام | عکس نمایشگر ۲ (۲۱:۵۹): «Thought for 1s» با chevron؛ `claude-ui-buttons.js:600,839` | — |
| ۳ | پچ ChatGPT: فایل/آداپتور/`--revert` | پلان ۰ | نیمه | فایل برگشت؛ ۵ تست OK | نصب واقعی روی افزونهٔ نصب‌شده |
| ۴ | فیلتر پوشه/تب Codex روی `26.1111.21308` | moalagh ۲ | انجام | آداپتور `chatgpt-folder-patch.py` (شاخهٔ new)؛ `cwd` در هر دو `thread/list`؛ `test_chatgpt_folder_query_new.cjs` PASS؛ backup `out/extension.js.chatgpt-folder-backup` | بعد از آپدیت ChatGPT دوباره |
| ۵ | زنجیرهٔ تست و ۳۴ آزمون | پلان ۱ | انجام | `test_all.sh` ۳۴ خط `run "`؛ `Doc/tarif/test-all.log:162` = 33 passed, 1 skipped, 0 failed؛ XSS، نوسازی لیست تیک و Codex جدید هم بسته شد | — |
| ۶ | آزمون Swift | moalagh ۱۰ | انجام | `run.sh` به `OpenRouter.swift`؛ O1–O7؛ خطای کامپایل حالا exit 1؛ ALL PASS | — |
| ۷ | لاگ تماس/هزینه (`/v1`، SSE، پروکسی) | پلان ۲ | نیمه | `provider-attribution.jsonl`؛ پروکسی تازه؛ ۴۰۴ تازه صفر | آزمون مقایسهٔ هزینه با API با تلورانس و بازهٔ ته‌نشینی ۳۰۰ ثانیه (جمع پوشه‌ها با today اختلاف دارد: ۲٪ تا ۳۰٪ بسته به زمان) |
| ۸ | هزینهٔ پنل: روز تهران + ردیف کل | چت | انجام | truth: **$۶٫۸۵ / ۳٬۲۷۳** (۲۰:۰۸ تهران)؛ پنل سه ردیف دارد: $۸٫۲۵ / $۱٫۹۳ / $۹٫۵۰ (عکس ۲۱:۲۷) | — |
| ۹ | قفل رهاشدهٔ `aa-shared` | moalagh ۴ | انجام | PID + heartbeat + قفل کهنه؛ آزمون: قفل مرده آزاد شد، قفل زنده ۳ ثانیه صبر کرد | — |
| ۱۰ | تیک خاموش (`NaN`) | moalagh ۳ | انجام | `zaman()` در `index.js`/`tools-policy.cjs`/`aa-shared.cjs`؛ `kooch` عددی در `tik_ha.py:361`؛ آزمون ISO PASS | — |
| ۱۱ | هشدار زودهنگام ریست | moalagh ۵ | انجام | علامت بعد از ارسال؛ آزمون notif خراب: ۰ نشان، notif سالم: ۱ نشان | — |
| ۱۲ | موفقیت دروغین auto-update | moalagh ۶ | انجام | `autoUpdate=off` در VS Code هست، در Windsurf `false` هست، ولی Cursor در settings خودش کلید autoUpdate ندارد؛ دو label خاص در `launchctl` نیست؛ شمارش ۸۱ job از خروجیِ `launchctl list` با `grep -c com.habib` گرفته شود؛ چک: installed=marketplace=2.1.328 | — |
| ۱۳ | `fix-rtl`: VS Code اجباری/`--help`/`--revert` | moalagh ۷/۸ | انجام | `--help`/`--revert` قبل از md-preview/scroll؛ مدل‌سلکتور همهٔ IDEها؛ آزمون HOME جعلی: ۰ فایل | — |
| ۱۴ | تماس بی‌مورد توییت | moalagh ۹ | انجام | `dide` حتی با خطای یک کاربر ذخیره می‌شود؛ `node --check` OK | — |
| ۱۵ | ابزار وظیفه (Task tools) | پلان ۸ | نیمه | `CLAUDE_CODE_ENABLE_TASKS` و `ENABLE_TODO_TOOLS` در `extension.js` تأیید شد؛ init با ۰/۱ در ۱۳۶ هیچ Task/Todo نداد | آزمون init در چت تازه (فقط خواندن، بدون تغییر تنظیمات) |
| ۱۶ | «مثل اشتراک»: Fable/اجبار ساب‌ایجنت/لیست مدل/لاگ | پلان ۹ | نیمه | در مخزن فقط `CLAUDE_CODE_SUBAGENT_MODEL` در `abzar/216-migration/claude-api/settings.json:11` و `abzar/flash-agent.sh:15`؛ وضعیت Fable و اجبارِ ساب‌ایجنت با دادهٔ زندهٔ حساب سنجیده می‌شود | تصمیم حبیب |
| ۱۷ | OpenCode و Ori Eval | چت | انجام | Ori 0.17.1: `-p` → OK، Opus 5.5، $۰٫۰۴۵۲۸۱، ۳٫۲s؛ OpenCode `run` → OK، $۰٫۰۰۵۷۱۵۷۶۸ | Eval وب جدا (اختیاری) |
| ۱۸ | auth سراسری | چت/کارگر | انجام | wrapper به gateway برگشت؛ توکن از settings حذف؛ API key در wrapper pop؛ init CLI تازه سالم؛ عکس ۱۳۶ بی‌هشدار | — |
| ۱۹ | بازبینی اصولی auth | چت | انجام | ۸ ریسک پایین | اجرای طراحی |
| ۲۰ | قانون دیده‌شدن کارگر | پلان | معلق | منتظر «بنویس» | نوشتن در `~/.claude/CLAUDE.md` |
| ۲۱ | دفتر واحد کارهای باز | چت | انجام | همین فایل | به‌روزرسانی هر کار |
| ۲۲ | بایگانی ۲۰۳ و flowchart | چت | انجام | `~/.backups/flowchart210/136...`؛ ۰ هوک؛ `flowchart/` ریشه نیست | — |
| ۲۳ | عکس تب پرووایدرها | چت | انجام | `Doc/tarif/23_provider_tab.png` (رندر headless از UI واقعی؛ دادهٔ نمونه) | — |
| ۲۴ | پچ منوی مدل | چت | انجام | از `index.js.backup` پچ شد؛ اجرای دوباره `already patched`؛ VS Code 2.1.328 دارد | — |
| ۲۵ | معلق‌های `moalagh.md` | moalagh | معلق | m1,m2,m4,m5,m6,m7,m8,m9,m11 (m12–m22 بایگانی؛ m10 بسته: سقف برداشته شد) | تصمیم حبیب |
| ۲۶ | منتقل‌شده از ۱۸۶: فاکتور/کردیت ۲۰۰ دلاری/بک‌لاگ/Ultra | moalagh | نیمه: پول/Ultra بسته؛ بک‌لاگ ۱۸۶ باز | حبیب ۲۱ نوامبر: کردیت ۲۰۰ تمام؛ Ultra تمدید نمی‌شود؛ سقف OpenRouter برداشته شد | بک‌لاگ ۱۸۶ — ردیف‌های ۴ (چسبیدن به لبه) و ۶ (حالت خیلی جمع) انجام و آزموده شد؛ بقیه باز |
| ۲۷ | untracked/کامیت | پلان | انجام | کامیت‌های انجام‌شده: `bd07959`، `efb4713`، `c156027`، `196bb38`، `148f8fa`، `9a5c42f`. فایل‌های untrackedِ فعلی: `.ori/`، `Doc/reset_ha/2026-11-17.md`، `2026-11-18.md`، `2026-11-19.md`، `2026-11-20.md`، `Doc/tarif/transcript-8b4044e9-20261119.md`، `abzar/216-migration/claude-api/model-filter.json`؛ فایل‌های محافظت‌شده عمداً untracked می‌مانند | — |
| ۲۸ | واژگان حبیب | چت | انجام | با واژه‌های خودش | ادامه |
| ۲۹ | نوسازی لیست تیک و پاک‌شدن تغییر | آزمون | انجام | `TIK.last` در `claude-ui-buttons.js`؛ تغییر ذخیره‌نشده دیگر با پاسخ کهنه پاک نمی‌شود | — |
| ۳۰ | نمودار با متن: Pele + RTL | حبیب ۱۹ نوامبر ۲۲:۴۱ («ار تی الش خرابه») | انجام | `direction="rtl"` روی هر `<text>` در `abzar/mmd_be_svg.py`؛ فرمانِ سراسری `~/.local/bin/mmd2svg` (چهار آزمون: check، تبدیل از پوشهٔ دیگر، فایلِ نبود ⇐ `EXIT=2`، چهار `direction="rtl"` در خروجی)؛ اسکیلِ `~/.claude/skills/pele-mmd-svg/SKILL.md`؛ ۶ نمودار در `Doc/nemoodar/` بازسازی شد؛ حبیب ۱۹ نوامبر ۲۳:۰۵: «اکیه» ⇐ بسته | — |

## ریسک‌های auth (از بازبینی اصولی)

| # | ریسک | درمان | وضعیت |
|---|---|---|---|
| ۱ | wrapper جای gateway را گرفت | `vscode_default_deepseek.py` برگشت؛ API key داخل همان wrapper حذف می‌شود | اصلاح شد |
| ۲ | کلید OpenRouter خام در settings | حذف شد؛ فقط Keychain/gateway | اصلاح شد |
| ۳ | مخفی‌کن UI ممکن است بی‌اثر باشد | needle به `(/logout)` اصلاح شد؛ ریشه باید یکی از دو credential باشد | اصلاح شد (ریشه سنجیده نشده) |
| ۴ | scope=machine | پروژه‌ها نمی‌توانند override کنند؛ تصمیم جدا | تصمیم حبیب |
| ۵ | Code Mode + `DISABLE_NONESSENTIAL_TRAFFIC` | فقط ترمینال/Anthropic؛ تصمیم جدا | تصمیم حبیب (Code Mode فقط Anthropic) |
| ۶ | دو CLI 2.1.327/2.1.328 | یکی‌سازی | باز — CLI 2.1.327 در برابر افزونهٔ 2.1.328 |
| ۷ | `claude_terminal.zsh` و acc2 | شرطی‌کردن `unset CLAUDE_CONFIG_DIR` | باز — شرطی‌کردن `unset CLAUDE_CONFIG_DIR` |
| ۸ | آزمون خرابکاری مستند نیست | لاگ تست اضافه شود | باز — آزمون منفی در زنجیرهٔ test_all.sh نیست |
