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
| ۱۴ | `CATALOGUE_TTL` | `catalogue_ttl_s` | مدت است و واحدش ثانیه؛ قاعدهٔ ۱۰ می‌گوید واحد در آخرِ اسم | opencode_gateway.py |
| ۱۵ | `GLOSS_DELAY_T` | `mohlat_javab_hook_ms` | مدت است و واحدش میلی‌ثانیه | claude-ui-buttons.js |

## ۲ · یک اسم در دو فایل (قاعدهٔ ۷: «یک حقیقت، یک جا»)
| # | اسم | کجاها | پیشنهاد |
|---|---|---|---|
| ۱۴ | `mah_shamsi` | `mods/hads/hooks/register.js` و `claude-host-hook.js` | دو برنامهٔ جدا‌اند (مود در پروسهٔ Claude، وصله در VS Code) و یکی نمی‌تواند از دیگری بخواند ⇐ پیشنهاد: «عمداً» با یک آزمون که دو فهرست یکی بمانند، یا یک فایلِ JSON که هر دو بخوانند |
| ۱۵ | `neshane_amar` / `NESHANE_AMAR` | مود و صفحه | همان دلیل؛ آزمونِ `test_claude_amar.cjs` با همان نشانه می‌سنجد |
| ۱۶ | `SESSION` | `claude-ui-buttons.js` و `opencode_gateway.py` | دو برنامهٔ جدا با دو معنیِ متفاوت (شناسهٔ سشنِ UI و شناسهٔ دروازه) ⇐ پیشنهاد: یکی از دو اسم عوض شود (`darvaze_session`) یا «عمداً» با یک خطِ توضیح در هر دو بلوک |
| ۱۷ | `KEY` | `claude-ui-buttons.js`، `opencode_gateway.py`، `opencode_picker.py` | کلیدِ Keychain در دروازه و کلیدِ پیکر با معنیِ نزدیک ولی جای متفاوت ⇐ پیشنهاد: `kelid_keychain` برای دروازه و `kelid_picker` برای پیکر |
| ۱۸ | `SERVICE` | `opencode_gateway.py`، `vscode_opencode_wrapper.py` | یک حقیقت (نامِ سرویسِ Keychain) در دو اسکریپتِ کوچک تکرار شده ⇐ پیشنهاد: یک ماژولِ مشترکِ `opencode_common.py` که هر دو از آن بخوانند |
| ۱۹ | `ACCOUNT` | `opencode_gateway.py`، `vscode_opencode_wrapper.py` | همان ⇐ همان ماژولِ مشترک |
| ۲۰ | `PORT` | `opencode_gateway.py`، `vscode_opencode_wrapper.py`، `opencode_picker.py` | همان: پورتِ دروازه در سه جا ⇐ همان ماژولِ مشترک |
| ۲۱ | `BASE` | `vscode_opencode_wrapper.py`، `opencode_picker.py` | آدرسِ محلی از همان `PORT` ساخته می‌شود ⇐ همان ماژولِ مشترک |
| ۲۲ | `OUT` | `opencode_usage.py`، `opencode_caps.py` | دو خروجیِ متفاوت با یک اسم (خلاصهٔ مصرف و سقف‌ها) ⇐ پیشنهاد: `out_masraf` و `out_saghf` |

## ۳ · اسم‌های تازه بی «بله» (آمده بعد از ۲۵ اکت ۰۶:۰۷)
۳۵ اسم در `Doc/shenasname_matn.toml` با `tayid = "پیشنهاد — تأییدنشده"` (و در `Doc/jadval_motaghayerha.md` با «؟»). فهرستشان برای «بله» ِ حبیب در پنجرهٔ سؤالِ مرحلهٔ ۲ می‌آید.

## ۴ · اسمِ فایل و پوشه (تعریفِ ۱۰ اسمِ فایل را هم می‌گیرد؛ الگو: `azmayesh_do_kif.py` ⇐ `azmayesh_do_wallet.py`)
| # | امروز | پیشنهاد | چرا | خطر |
|---|---|---|---|---|
| ۱۶ | `Doc/` | `doc/` | استانداردِ ۹۱ `doc/tarif/` است | مسیرِ `Doc/` در `chek.sh`، اسکریپت‌های `Doc/abzar/`، تعریف‌ها و هوکِ remember آمده ⇐ همه‌جا با هم |
| ۱۷ | `moalagh.md` | `doc/moalagh.md` | CLAUDE.md ِ حبیب `moalagh.md` می‌گوید | همان |
| ۱۸ | فایل‌های انگلیسیِ ریشه (`fix-rtl-claude.sh`، `claude-ui-buttons.js`، …) | **بماند** (پیشنهادِ من) | اسمشان کارشان را می‌گوید و انگلیسی با اسپلِ درست است؛ `com.habib.fix-rtl-claude.plist`، نصب‌کننده‌ها و README به آن‌ها اشاره می‌کنند | عوض کردن ⇐ LaunchAgent باید دوباره نصب شود |
| ۴۵ | `TITLE_MAX` | `had_tol_esm_chat_harf` | طولِ عنوانِ چت = حدِ حرف ⇒ واحد (حرف) آخر · تا تغییرِ نام، همین `TITLE_MAX` در کد می‌ماند | opencode_usage.py |
| ۵۱ | `DEFAULT_MAX_TURNS` | `had_nobe_klai` | سقفِ پیش‌فرضِ نوبت | — |
| ۵۲ | `MAX_ALLOWED_TURNS` | `had_nobe_klai_kol` | سقفِ مجازِ نوبت | — |
| ۵۳ | `LOG` | `masir_log_hook` | مسیرِ لاگِ هوک (هم‌نام در دو فایل) | — |

## ۵ · پرووایدر (تعریف ۳۵ نسخهٔ ۲ — حبیب ۲۴ نوامبر ۲۰۲۶ ۰۰:۱۷) — **ثبت نشده، منتظرِ «بله»**

محور عوض شد: «زنده» حذف شد (حبیب: «اینو نمی‌فهمم مفهومش چیه»). فقط **پیش‌فرض** و **جایگزین‌ها**.

| # | امروز | پیشنهاد | چرا | خطر |
|---|---|---|---|---|
| ۵۴ | `(مفهوم تازه)` | `provider_pishfarz_kol` | پرووایدرِ پیش‌فرضِ همهٔ هارنس‌ها = اوپن کد | — |
| ۵۵ | `(مفهوم تازه)` | `provider_jaygozin_harness_1` … `_7` | فهرستِ جایگزین‌های هر هارنس — **شماره‌دار** (حبیب ۲۴ نوامبر ۰۱:۰۴: «شماره دار باشه چون چنتا هستند»). شماره = ترتیبِ جدولِ تعریف ۳۵: ۱ claude-code · ۲ opencode · ۳ codex · ۴ dsh · ۵ ori · ۶ hermes · ۷ cursor-agent | — |

**نامِ بی‌شماره (`provider_jaygozin_harness`) ثبت نمی‌شود** — کنار گذاشته شد به دستورِ حبیب، چون هر هارنس فهرستِ جدا دارد.

## ۶ · پیشگیری از حادثهٔ تغییرِ نام (پروپوزال ۴۰) — **ثبت نشده، منتظرِ «بله»**

حبیب ۲۴ نوامبر ۲۰۲۶ ۰۶:۳۹ (از راهِ ناظر-۱۳۶): «توی تعریف‌ها و شناسنامه هم بیاد که برای جلوگیری از این اتفاقِ مجدد چه باید کرد».

| # | امروز | پیشنهاد | چرا | خطر |
|---|---|---|---|---|
| ۵۶ | `(مفهوم تازه)` | `masir_darvaze` | مسیرِ پوشهٔ دروازه | — |
| ۵۷ | `(مفهوم تازه)` | `label_service_gateway` | نامِ سرویسِ دروازه در launchd | — |
| ۵۸ | `(مفهوم تازه)` | `code_salamat_gateway` | کدِ ۲۰۰ روی `/v1/models` = سالم | — |
| ۵۹ | `(مفهوم تازه)` | `nam_kohne_ha` | فهرستِ نام‌های بازنشسته (`216-migration`، `186-montaghel`) | — |
| ۶۰ | `(مفهوم تازه)` | `ravesh_restart` | روشِ مجازِ ری‌استارت: `bootout` + `bootstrap` | — |
| ۶۱ | `(مفهوم تازه)` | `gozaresh_service_khabide` | فایلِ گزارشِ روزانهٔ سرویس‌های خفته | — |
