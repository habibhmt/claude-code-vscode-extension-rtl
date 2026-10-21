# تعریف ۰۴ — پچِ RTL (patch rtl) — v1 (حبیب، از ۳۱ اوت ۲۰۲۶)

| | |
|---|---|
| **آدرسِ چت** | چت‌های پروژهٔ ۱۳۶ از هفتهٔ ۳۱ اوت (`.remember/archive.md`) · ۱۸ اکت: پچِ ChatGPT/Codex |
| **آدرسِ کد** | `fix-rtl-claude.sh` — قفل `:32`، `--with-font` `:110`، گزارشِ هر IDE `:472`، جمع `:511` · خودکار: `com.habib.fix-rtl-claude.plist:15` (WatchPaths روی پوشه‌های افزونه) · آپدیتِ کلود هر ۶ ساعت: `com.habib.claude-code-autoupdate.plist:19` · کدی که به پنل چسبانده می‌شود: `claude-ui-buttons.js` |

1. **چیست:** متنِ فارسی در پنلِ Claude راست‌به‌چپ و با فونتِ وزیرمتن؛ به ته `extension.js` افزونه `claude-ui-buttons.js` چسبانده می‌شود (دکمه‌ها، aA، ساعت، …). روی همهٔ IDEها: VS Code، Cursor، Windsurf، Windsurf Next، Devin.
2. **کی/کجا:** هر بار که افزونه آپدیت شد، launchd خودش با `--with-font` دوباره می‌زند. بعدش در IDE یک Reload Window لازم است.
3. **عمداً نیست:** آزمونِ دستی بدونِ `--with-font` (چیزی نیست که واقعاً روی سیستم می‌نشیند) · دست زدن به فایل‌های خودِ کاربر.
4. **باطل می‌شود اگر:** یک IDE با نسخهٔ تازه بی‌پچ بماند · launchd خاموش شود · دو اجرا هم‌زمان پچ کنند (قفل).
5. **چک:** `for f in ~/.*/extensions/anthropic.claude-code-*; do grep -c "crtl-panel" $f/extension.js; done` ⇒ همه `1` یا بیشتر، هیچ `0` · `launchctl list | grep com.habib.fix-rtl-claude` ⇒ یک خط · `npm test` ⇒ exit `0`.
