# دفتر کارهای باز — پروژهٔ ۱۳۶

> قبل از هر کار این فایل را بخوان؛ بعد از هر کار وضعیت/مدرک را همان‌جا به‌روز کن.
> وضعیت‌ها: انجام / نیمه / باز / معلق / در حال.

| # | کار | منبع | وضعیت | مدرک | قدم بعدی |
|---|---|---|---|---|---|
| ۱ | XSS اپ ۱۸۶ | moalagh ۱ | انجام | `esc()` در `186-montaghel/app/index.html`؛ `test_xss_186.cjs` در مخزن؛ PASS | — |
| ۲ | Thought با کلیک/فوکوس | چت | انجام | عکس نمایشگر ۲ (۲۱:۵۹): «Thought for 1s» با chevron؛ `claude-ui-buttons.js:600,839` | — |
| ۳ | پچ ChatGPT: فایل/آداپتور/`--revert` | پلان ۰ | انجام | فایل برگشت؛ ۵ تست OK | نصب واقعی |
| ۴ | فیلتر پوشه/تب Codex روی `26.1111.21308` | moalagh ۲ | باز | `app-server-manager-hooks-*.js` نیست | آداپتور تازه |
| ۵ | زنجیرهٔ تست و ۹ آزمون | پلان ۱ | انجام | `test_all.sh`؛ ۳۲ سبز/۱ skip/۰ قرمز؛ XSS و نوسازی لیست تیک هم بسته شد | — |
| ۶ | آزمون Swift | moalagh ۱۰ | انجام | `run.sh` به `OpenRouter.swift`؛ O1–O7؛ خطای کامپایل حالا exit 1؛ ALL PASS | — |
| ۷ | لاگ تماس/هزینه (`/v1`، SSE، پروکسی) | پلان ۲ | انجام | `provider-attribution.jsonl`؛ پروکسی تازه؛ ۴۰۴ تازه صفر | مقایسه با API |
| ۸ | هزینهٔ پنل: روز تهران + ردیف کل | چت | انجام | truth: **$۶٫۸۵ / ۳٬۲۷۳** (۲۰:۰۸ تهران)؛ پنل سه ردیف دارد: $۸٫۲۵ / $۱٫۹۳ / $۹٫۵۰ (عکس ۲۱:۲۷) | — |
| ۹ | قفل رهاشدهٔ `aa-shared` | moalagh ۴ | انجام | PID + heartbeat + قفل کهنه؛ آزمون: قفل مرده آزاد شد، قفل زنده ۳ ثانیه صبر کرد | — |
| ۱۰ | تیک خاموش (`NaN`) | moalagh ۳ | انجام | `zaman()` در `index.js`/`tools-policy.cjs`/`aa-shared.cjs`؛ `kooch` عددی در `tik_ha.py:361`؛ آزمون ISO PASS | — |
| ۱۱ | هشدار زودهنگام ریست | moalagh ۵ | انجام | علامت بعد از ارسال؛ آزمون notif خراب: ۰ نشان، notif سالم: ۱ نشان | — |
| ۱۲ | موفقیت دروغین auto-update | moalagh ۶ | انجام | VS Code autoUpdate=false؛ plistهای auto-update و fix-rtl به `~/.backups/launchagents-disabled/` رفتند؛ `launchctl list` خالی؛ چک دستی ساخته شد | تست دستی |
| ۱۳ | `fix-rtl`: VS Code اجباری/`--help`/`--revert` | moalagh ۷/۸ | انجام | `--help`/`--revert` قبل از md-preview/scroll؛ مدل‌سلکتور همهٔ IDEها؛ آزمون HOME جعلی: ۰ فایل | — |
| ۱۴ | تماس بی‌مورد توییت | moalagh ۹ | انجام | `dide` حتی با خطای یک کاربر ذخیره می‌شود؛ `node --check` OK | — |
| ۱۵ | ابزار وظیفه (Task tools) | پلان ۸ | انجام | `CLAUDE_CODE_ENABLE_TASKS` و `ENABLE_TODO_TOOLS` در `extension.js` تأیید شد؛ init با ۰/۱ در ۱۳۶ هیچ Task/Todo نداد | — |
| ۱۶ | «مثل اشتراک»: Fable/اجبار ساب‌ایجنت/لیست مدل/لاگ | پلان ۹ | نیمه | Fable خالی؛ `SUBAGENT_MODEL` ست | تصمیم حبیب |
| ۱۷ | OpenCode و Ori Eval | چت | نیمه | `opencode` و `ori` نصب‌اند و `--version` جواب می‌دهد؛ اجرای واقعی Eval نشد | اجرای واقعی |
| ۱۸ | auth سراسری | چت/کارگر | نیمه | wrapper به gateway برگشت؛ توکن از settings حذف؛ API key در wrapper pop؛ init CLI با `/opt/homebrew/bin/claude` سالم | چت تازهٔ UI ۱۳۶/۲۱۲ |
| ۱۹ | بازبینی اصولی auth | چت | انجام | ۸ ریسک پایین | اجرای طراحی |
| ۲۰ | قانون دیده‌شدن کارگر | پلان | معلق | منتظر «بنویس» | نوشتن در `~/.claude/CLAUDE.md` |
| ۲۱ | دفتر واحد کارهای باز | چت | انجام | همین فایل | به‌روزرسانی هر کار |
| ۲۲ | بایگانی ۲۰۳ و flowchart | چت | انجام | `~/.backups/flowchart210/136...`؛ ۰ هوک؛ `flowchart/` ریشه نیست | — |
| ۲۳ | عکس تب پرووایدرها | چت | انجام | `Doc/tarif/23_provider_tab.png` (رندر headless از UI واقعی؛ دادهٔ نمونه) | — |
| ۲۴ | پچ منوی مدل | چت | نیمه | تشخیص already patched؛ پچ دوباره exit 0؛ VS Code 2.1.328 دارد | تست چشمی |
| ۲۵ | معلق‌های `moalagh.md` | moalagh | معلق | m1,m2,m7,m8,m9,m10,m11 | تصمیم حبیب |
| ۲۶ | منتقل‌شده از ۱۸۶: فاکتور/کردیت ۲۰۰ دلاری/بک‌لاگ/Ultra | moalagh | باز | کردیت مهلت ۲۰ نوامبر | چک فوری |
| ۲۷ | untracked/کامیت | پلان | انجام | commit `bd07959` + `efb4713`؛ سه فایل محافظت‌شده، `.ori/` و `model-filter.json` بیرون ماندند | کامیت سوم (XSS test) |
| ۲۸ | واژگان حبیب | چت | انجام | با واژه‌های خودش | ادامه |
| ۲۹ | نوسازی لیست تیک و پاک‌شدن تغییر | آزمون | انجام | `TIK.last` در `claude-ui-buttons.js`؛ تغییر ذخیره‌نشده دیگر با پاسخ کهنه پاک نمی‌شود | — |

## ریسک‌های auth (از بازبینی اصولی)

| # | ریسک | درمان |
|---|---|---|
| ۱ | wrapper جای gateway را گرفت | `vscode_default_deepseek.py` برگشت؛ API key داخل همان wrapper حذف می‌شود |
| ۲ | کلید OpenRouter خام در settings | حذف شد؛ فقط Keychain/gateway |
| ۳ | مخفی‌کن UI ممکن است بی‌اثر باشد | needle به `(/logout)` اصلاح شد؛ ریشه باید یکی از دو credential باشد |
| ۴ | scope=machine | پروژه‌ها نمی‌توانند override کنند؛ تصمیم جدا |
| ۵ | Code Mode + `DISABLE_NONESSENTIAL_TRAFFIC` | فقط ترمینال/Anthropic؛ تصمیم جدا |
| ۶ | دو CLI 2.1.327/2.1.328 | یکی‌سازی |
| ۷ | `claude_terminal.zsh` و acc2 | شرطی‌کردن `unset CLAUDE_CONFIG_DIR` |
| ۸ | آزمون خرابکاری مستند نیست | لاگ تست اضافه شود |
