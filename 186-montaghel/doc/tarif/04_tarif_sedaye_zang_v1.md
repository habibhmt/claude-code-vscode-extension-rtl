# تعریف ۰۴ — صدای زنگ با اپِ قیمت فرق دارد (sedaye_zang) — v1 (حبیب ۱۷ اکت ۰۱:۰۵ «بله، بساز»؛ ۰۲:۴۷ «بله، فرق دارد»)

| | |
|---|---|
| **آدرسِ چت** | `~/.claude/projects/-Users-habib-1-MY-WORK-186-claude-subscription-usage/b6509555-….jsonl` · ۱۷ اکت ۰۱:۰۵، ۰۲:۴۷ |
| **آدرسِ کد** | `tools/notify/make-sounds-app.py` · `swift/build.sh` (کپیِ ClaudeCache و ClaudeAdvisor در اپ) · `App.swift:468`، `App.swift:548` · کامیتِ `b0fb4c9` |

| واژهٔ حبیب | اسمی که ما گذاشتیم |
|---|---|
| «فرق دارد» | Glass / Hero (صداهای اپِ قیمت) |

1. **کار:** سه صدای مخصوصِ این اپ: «جواب آماده شد» (ClaudeReply)، زنگِ کش (ClaudeCache)، مشاور (ClaudeAdvisor). هیچ‌کدام Glass یا Hero نیست، چون آن‌ها آلارمِ اپِ قیمت‌اند و حبیب آن‌ها را با هم قاطی می‌کرد.
   ▪ باطل می‌شود اگر: حبیب بگوید «این صدا مثلِ اپِ قیمت است» ⇐ `grep -n 'Glass\|Hero' swift/Sources/*.swift` (باید خالی باشد) و گوش دادن، دستی
2. **چک:** `bash swift/tests/sounds.sh` ⇒ ALL PASS (در کد Glass و Hero نیست؛ سه صدا در اپ هست و در کد به کار رفته). خرابکاریِ عمدی ۲۲ اکت: `"Glass"` در کپیِ Sources ⇒ قرمز. **خودکار نمی‌شود:** شنیدنِ اینکه صدا با اپِ قیمت فرق دارد ⇒ دستی.

**وضع:** کار می‌کند.
