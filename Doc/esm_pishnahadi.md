# اسم‌های پیشنهادی — «اسمِ قدیم ⇐ تازه»، **هنوز اجرا نشده** (مرحلهٔ ۱ ِ استانداردِ ۹۱)

حبیب (۲۷ اکت ۰۰:۰۰، از راهِ ۲۰۳): «اول اسناد و تعاریف کامل بره بعد که تعاریف شناسنامه ها و اینها انجام شد بعد تغییرات با اجازه من» · پنجرهٔ سؤالِ ۱۳۶: «بله، شروع کن» (فقط سند).
این فهرست را `Doc/abzar/chek_motaghayer.py` می‌سنجد: هر اسمی که قاعده را می‌شکند یا درست شود یا این‌جا باشد. تغییر در کد = مرحلهٔ ۲، با پنجرهٔ سؤالِ تازه.

## ۱ · اسم بیرون از تعریفِ ۱۰ ِ ۹۱ (`~/1-MY-WORK/91th-minimal-2/doc/tarif/10_tarif_esm_motaghayer_v1.md`)
قاعده‌ها: «لحظه = `ts`، مدت = `_s`» و «`zaman` برای این معنی نمی‌آید» (تعریفِ ۱۰، جدولِ پایه) · «حد سه شکل دارد: `had_tedad_…` · `had_faseleh_…_s` · `had_entezar_…_s`؛ صبرِ ثابت (نه حد) بی `had_`» · واحد آخرِ اسم.
(درست‌شده ۲۷ اکت ۰۲:۵۰ بعد از پیامِ ۲۰۳ از حبیب ۰۲:۴۴ «چرا به ایجنت جدید ها نمیگی که اسم فایل ها و متغیر ها و بقیه موارد طبق تعریف ۱۰ مینیمال ۲ باید باشه ؟»؛ پیشنهادِ قبلیِ ۱–۴ `zaman_…_ms` بود و با «لحظه = `ts`» نمی‌خواند.)
| # | اسمِ امروز | پیشنهاد | چرا (مثال) | فایل |
|---|---|---|---|---|
| ۱ | `zaman_do_jomle_akhar` | `do_jomle_akhar_ts` | لحظه است: `$.clock.now()` (میلی‌ثانیه از ۱۹۷۰) | register.js |
| ۲ | `zaman_akhar_javab` | `akhar_javab_ts` | همان | register.js |
| ۳ | `zaman_akharin_kar` | `akharin_kar_ts` | همان | register.js |
| ۴ | `zaman_khandan_hook` | `khandan_hook_ts` | همان | register.js |
| ۵ | `had_kamtarin_harf_sanad` | `had_kamtarin_sanad_harf` | واحد (حرف) آخر: سند کمتر از ۸ حرف ⇒ نیست | register.js |
| ۶ | `had_harf_dokme_prompt` | `had_dokme_prompt_harf` | همان | register.js |
| ۷ | `had_tamas_riz` | `had_tedad_tamas_riz` | حدِ شمار ⇒ `had_tedad_` (۳۰۰ تماسِ آخر در حالتِ بزرگ) | register.js |
| ۸ | `had_kamtarin_do_jomle_jambandi` | `had_tedad_kamtarin_do_jomle_jambandi` | همان | register.js |
| ۹ | `had_ferestadan_kar` | `had_tedad_ferestadan_kar` | همان: یک کار حداکثر ۳ بار فرستاده شود | register.js |
| ۱۰ | `had_ghablia_tedad` | `had_tedad_ghablia` | همان | register.js |
| ۱۱ | `HOVER_DELAY` | `entezar_baz_shodan_payam_ms` | صبرِ ثابت، نه حد ⇒ بی `had_`؛ ثابت‌های صفحه ۲۵ اکت «بمونن» گرفتند، پس فقط اگر حبیب بخواهد | claude-ui-buttons.js |
| ۱۲ | `GLOSS_DELAY` | `entezar_kart_vazhe_ms` | همان | claude-ui-buttons.js |
| ۱۳ | `tries` (و عددِ ۶۰ کنارش) | `tedad_gashtan_panel` و `had_tedad_gashtan_panel` | شمار + حدِ شمار؛ همان «بمونن» | claude-ui-buttons.js |

## ۲ · یک اسم در دو فایل (قاعدهٔ ۷: «یک حقیقت، یک جا»)
| # | اسم | کجاها | پیشنهاد |
|---|---|---|---|
| ۱۴ | `mah_shamsi` | `mods/hads/hooks/register.js` و `claude-host-hook.js` | دو برنامهٔ جدا‌اند (مود در پروسهٔ Claude، وصله در VS Code) و یکی نمی‌تواند از دیگری بخواند ⇐ پیشنهاد: «عمداً» با یک آزمون که دو فهرست یکی بمانند، یا یک فایلِ JSON که هر دو بخوانند |
| ۱۵ | `neshane_amar` / `NESHANE_AMAR` | مود و صفحه | همان دلیل؛ آزمونِ `test_claude_amar.cjs` با همان نشانه می‌سنجد |

## ۳ · اسم‌های تازه بی «بله» (آمده بعد از ۲۵ اکت ۰۶:۰۷)
۳۵ اسم در `Doc/shenasname_matn.toml` با `tayid = "پیشنهاد — تأییدنشده"` (و در `Doc/jadval_motaghayerha.md` با «؟»). فهرستشان برای «بله» ِ حبیب در پنجرهٔ سؤالِ مرحلهٔ ۲ می‌آید.

## ۴ · اسمِ فایل و پوشه (تعریفِ ۱۰ اسمِ فایل را هم می‌گیرد؛ الگو: `azmayesh_do_kif.py` ⇐ `azmayesh_do_wallet.py`)
| # | امروز | پیشنهاد | چرا | خطر |
|---|---|---|---|---|
| ۱۶ | `Doc/` | `doc/` | استانداردِ ۹۱ `doc/tarif/` است | مسیرِ `Doc/` در `chek.sh`، اسکریپت‌های `Doc/abzar/`، تعریف‌ها و هوکِ remember آمده ⇐ همه‌جا با هم |
| ۱۷ | `moalagh.md` | `doc/moalagh.md` | CLAUDE.md ِ حبیب `moalagh.md` می‌گوید | همان |
| ۱۸ | فایل‌های انگلیسیِ ریشه (`fix-rtl-claude.sh`، `claude-ui-buttons.js`، …) | **بماند** (پیشنهادِ من) | اسمشان کارشان را می‌گوید و انگلیسی با اسپلِ درست است؛ `com.habib.fix-rtl-claude.plist`، نصب‌کننده‌ها و README به آن‌ها اشاره می‌کنند | عوض کردن ⇐ LaunchAgent باید دوباره نصب شود |
