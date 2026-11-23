# ادغام — از کجا آمده

| | |
|---|---|
| مبدأ | `~/1-MY-WORK/186-claude-subscription-usage` @ **a595fe6** (`feat(186): پنل فولدر ← چتِ به‌اسم ← شکستِ هزینه؛ انگلیسیِ کامل (ادامه دارد)`) |
| مقصد | `136th-day-fix-rtl-claude/apps/claude-usage/` |
| روش | `git -C …/186-claude-subscription-usage archive main \| tar -x -C apps/claude-usage` — کپیِ دقیقِ ۹۶ فایلِ ردیابی‌شده (۳٬۰ مگ) |
| چه‌وقت | ۲۳ نوامبر ۲۰۲۶، ۱۹:۴۴ |
| تعریف | `Doc/tarif/29_tarif_edgham_app_masraf_v1.md` |

**چرا نه `git subtree`:** در نسخهٔ گیتِ این مک، `git subtree add` یک کامیتِ تک‌تکه می‌سازد و
تاریخچهٔ هر فایل را نمی‌آورد (آزمون: `git log --follow -- apps/…/App.swift` ⇒ ۰). تاریخچهٔ کامل
در پوشهٔ بازنشستهٔ ۱۸۶ و در مخزنِ گیت‌هابِ همان می‌ماند؛ حذفِ آن با حرفِ جداگانهٔ حبیب است.

**چه چیزی به مسیر وابسته نیست:** `install-autostart.sh` به `/Applications/ClaudeUsage.app` اشاره
می‌کند و `com.habib.opencode-usage` به `abzar/216-migration/scripts/opencode_usage.py` (که در
مخزنِ ۱۳۶ است، نه این‌جا) — هیچ‌کدام مسیرِ مخزنِ ۱۸۶ را سخت نکرده‌اند.
