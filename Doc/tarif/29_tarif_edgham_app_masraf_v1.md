# تعریف ۲۹ — ادغامِ اپِ مصرف (۱۸۶) در مخزنِ ۱۳۶

حبیب، ۲۳ نوامبر ۲۰۲۶ ۱۹:۳۸ (عیناً): «دیگه مخزنی به اسم ۱۸۶ نباید باشه، کامل باید
ادغام بشه توی ۱۳۶».

| | |
|---|---|
| **آدرسِ تعریف** | `136th-day-fix-rtl-claude · Doc/tarif/29_tarif_edgham_app_masraf_v1.md` |
| **مبدأ** | `~/1-MY-WORK/186-claude-subscription-usage` — ۹۶ فایلِ ردیابی‌شده · ۳٬۰ مگابایت · هدِ `a595fe6` |
| **مقصد** | `136th-day-fix-rtl-claude/apps/claude-usage/` |
| **مرجعِ چیزهای داخلِ اپ** | تعریف **۲۸** (پنل، نوار، تب‌ها، فایلِ مصرف) — این سند فقطِ «کجا زندگی می‌کند» را می‌گوید |

## تعریف‌ها

| # | تعریف | شرطِ باطل (کلماتِ حبیب) | سنجش |
|---|---|---|---|
| ۱ | بعد از ادغام، **همهٔ** کد و سندِ اپِ مصرف داخلِ مخزنِ ۱۳۶ است، زیرِ `apps/claude-usage/` | «چرا هنوز دو تا مخزن است؟» | `ls apps/claude-usage/{swift,tools,doc}` |
| ۲ | **قبلی، جایگزین‌شده (۲۳ نوامبر ۲۰۲۶ ۱۹:۴۴):** «تاریخچهٔ گیتِ ۱۸۶ با `git subtree` می‌آید» — **رد شد** چون در این نسخهٔ گیت subtree تک‌کامیت می‌سازد و تاریخچه را نمی‌آورد (در کلونِ دورریختنی سنجیده شد: `git log --follow -- apps/…/App.swift` ⇒ ۰) | — | — |
| ۲ | ادغام با **کپیِ دقیقِ `git archive main`** انجام می‌شود و **هشِ مبدأ `a595fe6`** در پیامِ کامیت ثبت می‌شود؛ تاریخچهٔ کامل در پوشهٔ بازنشستهٔ ۱۸۶ و در گیت‌هابِ همان باقی می‌ماند | «تاریخچه‌اش کجاست؟» | `git log -1 --format=%B -- apps/claude-usage \| grep -q a595fe6` و `git -C ~/1-MY-WORK/186-claude-subscription-usage log -1 --format=%h` |
| ۳ | اپ همچنان **از مسیرِ تازه** ساخته و نصب می‌شود و نوار همان دو عدد را نشان می‌دهد | «اپ دیگر بالا نمی‌آید» | `cd apps/claude-usage/swift && ./build.sh` · `pgrep -x ClaudeUsage` · عکسِ نوار |
| ۴ | فایلِ مصرف و لانچ‌ایجنت **مسیرِ تازه** را صدا می‌زنند | «خودش کهنه را اجرا می‌کند» | `launchctl print gui/$(id -u)/com.habib.opencode-usage \| grep -i path` |
| ۵ | پوشهٔ ۱۸۶ **بازنشسته** می‌شود: `mv` به `~/.claude/backups/186-merged-<تاریخ>`، هرگز `rm` | «چیزی را پاک کردی که برنمی‌گردد» | `test -d ~/.claude/backups/186-merged-*` |
| ۶ | **حذفِ مخزنِ گیت‌هابِ ۱۸۶ ممنوع** تا حبیب جدا بگوید | «ریپوی گیت‌هاب را چرا حذف کردی؟» | `gh repo view habibhmt/186-claude-subscription-usage >/dev/null && echo هست` |

## چیزهایی که عمداً عوض نمی‌شوند

- شناسهٔ باندلِ اپ (`com.habib.ClaudeUsage.v5`) و کلیدهای `UserDefaults` — عوض‌کردنشان یعنی
  تیک‌ها و جای پنجره از دست می‌رود.
- برنامهٔ کارِ مصرف (`com.habib.opencode-usage`) و فایل‌های داده در
  `~/Library/Application Support/…` — فقط مسیرِ **اسکریپتی** که اجرا می‌کنند عوض می‌شود.

▪ باطل می‌شود اگر: حبیب بگوید «باز دو تا مخزن شد» یا «اپ از کار افتاد» یا «تاریخچه نیست»
⇐ `ls apps/claude-usage/swift/Sources/PanelView.swift` · `git -C ~/1-MY-WORK/136th-day-fix-rtl-claude log -1 --format=%B -- apps/claude-usage | grep -c a595fe6` (باید ۱) · `pgrep -x ClaudeUsage`
