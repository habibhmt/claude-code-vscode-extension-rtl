# جدولِ متغیرهای ۱۳۶ — ساخته با `python3 Doc/abzar/jadval_motaghayer.py`، دستی عوض نکن

معنی‌ها از `Doc/shenasname_matn.toml`؛ جا و تابع‌ها از خودِ کد. «تأیید»: ✓ = اسم «بله» ِ حبیب را دارد · ؟ = پیشنهاد، تأییدنشده.

| # | متغیر | نوع | معنی | فایل:خط | تابع‌ها | تعریف | در ارتباط با | تأیید |
|---|---|---|---|---|---|---|---|---|
| 1 | `model_do_jomle_va_hads` | sabet | کجا: مودِ حدس · چیه: مدلی که «دو جمله» و حدسِ پشتیبان (وقتی fork نمی‌شود) با آن ساخته می‌شود · مثال: ⟦model_do_jomle_va_hads⟧ | mods/hads/hooks/register.js:5 | begu_do_jomle | 12 | `had_fork_context_token` | ✓ |
| 2 | `hads_har_chand_javab` | sabet | کجا: آخرِ هر جواب · چیه: حدس و روند و نکرده و خودکار و کرون هر چند جواب یک بار ساخته شوند · مثال: هر ⟦hads_har_chand_javab⟧ جواب یک fork | mods/hads/hooks/register.js:7 | akhar_javab, chat_kuchak | 01 | `tedad_javab_har_chat` | ✓ |
| 3 | `tedad_javab_har_chat` | vaziat | چند جواب در هر چت دیده شده، از بالا آمدنِ همین پروسه؛ برای «هر چند جواب یک بار» | mods/hads/hooks/register.js:9 | akhar_javab | 01 | `hads_har_chand_javab` | ✓ |
| 4 | `hads_akhar` | vaziat | آخرین حدس‌هایی که کادر نشان می‌دهد | mods/hads/hooks/register.js:12 | akhar_javab, bargardandan_akharin, hads_ba_fork, register, tasvir_akharin, tik_zadan | 01 | `hads_baraye_chat` | ✓ |
| 5 | `ravand_akhar` | vaziat | روندهایی که الان در کادر نشان داده می‌شوند؛ هر کدام با حرف‌های عینیِ حبیب | mods/hads/hooks/register.js:15 | bargardandan_akharin, hads_ba_fork, register, tasvir_akharin, tik_zadan | 23 | `ravand_zade_shode` | ✓ |
| 6 | `ravand_zade_shode` | vaziat | متنِ روندهایی که دکمهٔ ⤵ آن‌ها زده شد؛ این متن‌ها حرفِ حبیب حساب نمی‌شوند تا روند خودش را تقویت نکند | mods/hads/hooks/register.js:17 | khandan_ravand_zade | 23 | `ravand_akhar` | ✓ |
| 7 | `had_tedad_ravand_zade_radif` | sabet | کجا: «روند» · چیه: چند متنِ دکمهٔ زده‌شده برای هر چت نگه داشته شود تا شاهد نشود · مثال: ⟦had_tedad_ravand_zade_radif⟧ | mods/hads/hooks/register.js:18 | zadan_ravand | 23 | `ravand_zade_shode` | ✓ |
| 8 | `shekast_fork_har_chat` | vaziat | برای هر چت: چند فورکِ پشتِ هم چیزِ به‌دردبخوری نداد | mods/hads/hooks/register.js:20 | akhar_javab, hads_ba_fork | 23 | `had_tedad_shekast_fork_bar` | ✓ |
| 9 | `had_tedad_shekast_fork_bar` | sabet | کجا: آخرِ جواب · چیه: بعد از این تعداد فورکِ بی‌نتیجهٔ پشتِ هم، فورکِ بعدی تا نوبتِ عادی‌اش صبر می‌کند · مثال: ⟦had_tedad_shekast_fork_bar⟧ | mods/hads/hooks/register.js:21 | akhar_javab | 23 | `shekast_fork_har_chat`, `hads_har_chand_javab` | ✓ |
| 10 | `nakarde_akhar` | vaziat | آخرین «نکرده»‌ها (خواسته‌های حبیب که هنوز انجام نشده)، برای کادر | mods/hads/hooks/register.js:24 | anjam_shod_zadan, bargardandan_akharin, hads_ba_fork, register, tasvir_akharin, tik_zadan | 14 | `nakarde_ba_sanad_akhar` | ✓ |
| 11 | `nakarde_ba_sanad_akhar` | vaziat | «نکرده»‌هایی که سندشان (فایل یا commit) نشان داد انجام شده؛ در یک خطِ کوچک شمرده می‌شوند | mods/hads/hooks/register.js:27 | bargardandan_akharin, hads_ba_fork, register, tasvir_akharin, tik_zadan | 14 | `nakarde_akhar`, `had_kamtarin_harf_sanad` | ؟ |
| 12 | `nakarde_ba_sanad_baz` | vaziat | خطِ «با سند کنار رفت» باز است یا بسته | mods/hads/hooks/register.js:28 | register | 14 | `nakarde_ba_sanad_akhar` | ؟ |
| 13 | `khodkar_akhar` | vaziat | آخرین «خودکار»ها: کاری که ایجنت خودش با ابزارش می‌تواند بکند به‌جای پرسیدن از حبیب | mods/hads/hooks/register.js:32 | bargardandan_akharin, hads_ba_fork, register, tasvir_akharin, tik_zadan | 15 | `khodkar_ferestade_har_chat` | ؟ |
| 14 | `cron_akhar` | vaziat | آخرین «کرون‌جاب»‌ها: کارهای تکراری که حبیب گفت و به اجرای خودکار سرِ وقت می‌خورند | mods/hads/hooks/register.js:33 | bargardandan_akharin, hads_ba_fork, register, tasvir_akharin, tik_zadan | 15 | — | ؟ |
| 15 | `hads_baraye_chat` | vaziat | حدس‌ها مالِ کدام چت‌اند؛ بعد از /clear (چتِ تازه) نشان داده نمی‌شوند | mods/hads/hooks/register.js:35 | akhar_javab, bargardandan_akharin, hads_ba_fork, register, tasvir_akharin | 01 | `hads_akhar` | ✓ |
| 16 | `do_jomle_fasele_ms` | sabet | کجا: وسطِ کار، بعد از هر ابزار · چیه: کمترین فاصلهٔ دو «دو جمله» · مثال: هر ⟦do_jomle_fasele_ms⟧ میلی‌ثانیه حداکثر یکی | mods/hads/hooks/register.js:39 | begu_do_jomle, vazhe_name | 12 | `model_do_jomle_va_hads` | ✓ |
| 17 | `had_fork_context_token` | sabet | کجا: آخرِ جواب · چیه: اگر چت از این بزرگ‌تر باشد fork گران است و Sonnet روی پیام‌های آخر کار می‌کند · مثال: بیش از ⟦had_fork_context_token⟧ توکن | mods/hads/hooks/register.js:41 | chat_kuchak | 01 | `model_do_jomle_va_hads` | ✓ |
| 18 | `cache_sard_ms` | sabet | کجا: «پرسش» · چیه: بیکاریِ بیش از این یعنی کشِ چت احتمالاً سرد شده و «پرسش» اول هشدار می‌دهد (کشِ یک‌ساعته) | mods/hads/hooks/register.js:45 | register | 12 | `cache_sard_5m_ms`, `cache_sard_bad_az_ms` | ✓ |
| 19 | `cache_sard_5m_ms` | sabet | همان، وقتی کشِ چت پنج‌دقیقه‌ای است | mods/hads/hooks/register.js:46 | register | 12 | `cache_sard_ms` | ✓ |
| 20 | `cache_sard_bad_az_ms` | vaziat | کدام یک از دو بالایی الان به کار می‌رود (بسته به کشِ چت) | mods/hads/hooks/register.js:47 | porsesh_kon, register | 12 | `cache_sard_ms`, `cache_sard_5m_ms` | ✓ |
| 21 | `prompt_system_do_jomle` | sabet | دستورِ Sonnet برای «دو جمله»: دو جملهٔ ساده که ایجنت الان چه می‌کند و منتظرِ چیست، با واژه‌نامهٔ حبیب | mods/hads/hooks/register.js:48 | begu_do_jomle | 12 | — | ✓ |
| 22 | `do_jomle_akhar` | vaziat | آخرین «دو جمله» و چتش | mods/hads/hooks/register.js:53 | bargardandan_akharin, benevis_do_jomle, register, sabt_jambandi, tasvir_akharin, tik_zadan | 12 | — | ✓ |
| 23 | `do_jomle_dar_kar` | vaziat | یک «دو جمله» در راه است | mods/hads/hooks/register.js:54 | begu_do_jomle | 12 | `do_jomle_dobare` | ✓ |
| 24 | `do_jomle_dobare` | vaziat | وقتی یکی در راه بود، یکی دیگر خواسته شد؛ بعدش ساخته می‌شود | mods/hads/hooks/register.js:55 | begu_do_jomle | 12 | `do_jomle_dar_kar` | ✓ |
| 25 | `zaman_do_jomle_akhar` | vaziat | ساعتِ آخرین «دو جمله»، برای فاصلهٔ ⟦do_jomle_fasele_ms⟧ | mods/hads/hooks/register.js:56 | begu_do_jomle | 12 | `do_jomle_fasele_ms` | ✓ |
| 26 | `zaman_akhar_javab` | vaziat | ساعتِ آخرین پایانِ جواب؛ پایانِ جواب بر «دو جمله»ٔ وسطِ کار که دیرتر رسید می‌چربد | mods/hads/hooks/register.js:58 | akhar_javab, begu_do_jomle | 12 | — | ✓ |
| 27 | `akhar_javab_dar_kar` | vaziat | کارِ آخرِ جواب در راه است | mods/hads/hooks/register.js:59 | akhar_javab | 01 | `akhar_javab_dobare` | ✓ |
| 28 | `akhar_javab_dobare` | vaziat | جوابی وسطِ کارِ قبلی تمام شد؛ بعدش انجام می‌شود، گم نمی‌شود | mods/hads/hooks/register.js:61 | akhar_javab | 01 | `akhar_javab_dar_kar` | ✓ |
| 29 | `zaman_akharin_kar` | vaziat | آخرین باری که خودِ چت با مدل حرف زد؛ سنِ کش | mods/hads/hooks/register.js:63 | porsesh_kon, register | 12 | `cache_sard_ms` | ✓ |
| 30 | `cache_sard_shod` | vaziat | Claude Code خودش بعد از resume گفت کش رفته | mods/hads/hooks/register.js:65 | porsesh_kon, register | 12 | `cache_sard_ms` | ✓ |
| 31 | `porsesh_montazer` | vaziat | «پرسش»ی که پیش از آماده بودنِ fork آمد؛ آخرِ جوابِ بعدی خودش پرسیده می‌شود | mods/hads/hooks/register.js:68 | porsesh_kon, register, tik_zadan | 12 | `matn_porsesh_montazer` | ✓ |
| 32 | `javab_porsesh` | vaziat | جوابِ آخرین «پرسش» (fork با کشِ گرم)؛ هرگز به چت نمی‌رود | mods/hads/hooks/register.js:70 | bargardandan_akharin, porsesh_kon, register, tasvir_akharin, tik_zadan | 12 | `matn_porsesh` | ✓ |
| 33 | `matn_porsesh` | vaziat | متنی که حبیب در جعبهٔ «پرسش» نوشته | mods/hads/hooks/register.js:71 | porsesh_kon, register | 12 | `javab_porsesh` | ✓ |
| 34 | `prompt_ha` | vaziat | پرومپت‌های ذخیره‌شدهٔ «پرسش» (همهٔ چت‌ها یکی، در فایل) | mods/hads/hooks/register.js:76 | khandan_prompt_ha, register, zakhire_prompt_ha, zakhire_prompt_virayesh | 18 | `prompt_entekhab_har_chat`, `had_harf_dokme_prompt` | ؟ |
| 35 | `prompt_entekhab_har_chat` | vaziat | کدام پرومپت در هر چت روشن است | mods/hads/hooks/register.js:77 | prompt_entekhab_shode, register | 18 | `prompt_ha` | ؟ |
| 36 | `prompt_virayesh` | vaziat | پرومپتی که الان با ✎ در حالِ ویرایش است | mods/hads/hooks/register.js:78 | register, zakhire_prompt_virayesh | 18 | `prompt_ha` | ؟ |
| 37 | `system_reminder_regex` | sabet | الگوی بخش‌های system-reminder که از متنِ پیام‌ها کنار گذاشته می‌شوند | mods/hads/hooks/register.js:93 | cut, khandan_hads, payam_ha_ye_akhar, payam_ha_ye_habib | 14 | — | ✓ |
| 38 | `matn_bi_harfe_habib` | sabet | وقتی نوبت با پیامِ خودِ حبیب شروع نشده (کار، چتِ دیگر، Continue)، به‌جای «خواستهٔ حبیب» این می‌آید | mods/hads/hooks/register.js:98 | az_agent_digar, harf_habib | 14 | — | ✓ |
| 39 | `prompt_fork_do_jomle` | sabet | تکهٔ دستورِ fork برای «دو جمله»؛ فقط بخش‌های روشن خواسته می‌شوند | mods/hads/hooks/register.js:122 | cut, prompt_fork_bakhsh_ha | 12 | — | ✓ |
| 40 | `prompt_fork_hads` | sabet | تکهٔ دستورِ fork برای حدس | mods/hads/hooks/register.js:123 | cut, prompt_fork_bakhsh_ha | 01 | — | ✓ |
| 41 | `abzar_ha_ye_claude_code` | sabet | فهرستِ کاملِ ابزارهای ایجنت در Claude Code، برای «خودکار» (از سندِ رسمی) | mods/hads/hooks/register.js:147 | ghaede_khodkar, ghaede_nakarde | 15 | `prompt_fork_khodkar` | ؟ |
| 42 | `prompt_fork_khodkar` | sabet | تکهٔ دستورِ fork برای «خودکار» | mods/hads/hooks/register.js:182 | ghaede_nakarde, prompt_fork_bakhsh_ha | 15 | `abzar_ha_ye_claude_code` | ؟ |
| 43 | `matn_se_daste` | sabet | تکهٔ پرامپتِ «خودکار»: هر «منتظرِ شما / خودت وارد شو / کد را بفرست» ِ ایجنت در سه دسته سنجیده می‌شود: (الف) خودش، (ب) راه از ۲۰۳، (ج) فقط کارِ حبیب | mods/hads/hooks/register.js:198 | ghaede_khodkar | 01 | — | ✓ |
| 44 | `prompt_fork_cron` | sabet | تکهٔ دستورِ fork برای «کرون‌جاب» | mods/hads/hooks/register.js:214 | ghaede_khodkar, prompt_fork_bakhsh_ha | 15 | `ghaede_cron` | ؟ |
| 45 | `ghaede_cron` | sabet | قاعده‌های «کرون‌جاب» در دستورِ fork | mods/hads/hooks/register.js:215 | ghaede_bakhsh_ha, ghaede_khodkar | 15 | `prompt_fork_cron` | ؟ |
| 46 | `prompt_fork_ravand` | sabet | قالبی که فورک برای کلیدِ ravand باید برگرداند | mods/hads/hooks/register.js:216 | ghaede_khodkar, prompt_fork_bakhsh_ha | 23 | `ravand_akhar` | ✓ |
| 47 | `had_kamtarin_harf_sanad` | sabet | کجا: سندِ «نکرده» · چیه: متنِ سند کوتاه‌تر از این چک حساب نمی‌شود · مثال: کمتر از ⟦had_kamtarin_harf_sanad⟧ حرف | mods/hads/hooks/register.js:240 | khandan_nakarde, khandan_sanad, ravand_ba_shahed | 14 | `nakarde_ba_sanad_akhar` | ؟ |
| 48 | `payam_dastgah` | sabet | پیام‌هایی که از طرفِ کاربر می‌آیند ولی حرفِ حبیب نیستند (پلاگین، task-notification، ادامهٔ خودکار)؛ شاهدِ روند نمی‌شوند | mods/hads/hooks/register.js:280 | payam_ha_ye_habib, yeksan_harf | 23 | `ravand_akhar` | ✓ |
| 49 | `nakarde_anjam_har_chat` | vaziat | «نکرده»‌هایی که حبیب در هر چت خودش «✓ انجام شد» زد | mods/hads/hooks/register.js:333 | khandan_nakarde_anjam, masir_nakarde_anjam | 14 | — | ✓ |
| 50 | `gheymat_cache_neveshtan_usd` | sabet | دلار برای هر میلیون توکنِ نوشتنِ کش (پنج‌دقیقه‌ای و یک‌ساعته)، برای هشدارِ «پرسش» با کشِ سرد | mods/hads/hooks/register.js:375 | khandan_javab_fork, kharj_cache_sard | 12 | `gheymat_tamas_usd` | ✓ |
| 51 | `had_ghablia_tedad` | sabet | کجا: «قبلی‌ها» · چیه: چند «دو جمله»ٔ قبلی نگه داشته و نشان داده شود · مثال: ⟦had_ghablia_tedad⟧ تای آخر | mods/hads/hooks/register.js:383 | benevis_do_jomle, kharj_cache_sard | 12 | — | ✓ |
| 52 | `do_jomle_akhar_dar_daftar` | vaziat | آخرین «دو جمله» که در دفتر نوشته شد، برای هر چت (یک پروسه چند چت می‌تواند داشته باشد) | mods/hads/hooks/register.js:415 | benevis_do_jomle, w | 12 | — | ✓ |
| 53 | `hads_zade_shode` | vaziat | حدس‌هایی که در کادرِ نوشتن گذاشته شدند، تا با Enter معلوم شود کدام رفت | mods/hads/hooks/register.js:417 | register, w | 01 | — | ✓ |
| 54 | `do_jomle_ha_ye_nobat` | vaziat | همهٔ «دو جمله»‌های نوبتِ در جریان، برای جمع‌بندیِ آخرِ جواب | mods/hads/hooks/register.js:420 | amade_jambandi, benevis_do_jomle, register, w | 12 | `had_kamtarin_do_jomle_jambandi` | ✓ |
| 55 | `mah_miladi` | sabet | اسمِ کوتاهِ ماه‌های میلادی، مثلِ تاریخ‌نویسیِ حبیب («۲۴ اکت ۱۸:۵۷») | mods/hads/hooks/register.js:432 | benevis_do_jomle, two | 12 | `mah_shamsi` | ✓ |
| 56 | `mah_shamsi` | sabet | اسمِ ماه‌های شمسی برای تاریخِ خطِ هوک‌ها (در مود و در وصلهٔ میزبان، دو جا) | mods/hads/hooks/register.js:444, claude-host-hook.js:194 | two, zaman_shamsi | 11 | `mah_miladi` | ✓ |
| 57 | `had_do_jomle_harf` | sabet | کجا: «دو جمله» · چیه: بیشترین حرف · مثال: بلندتر از ⟦had_do_jomle_harf⟧ حرف با … کوتاه می‌شود | mods/hads/hooks/register.js:464 | kutah_be_do_jomle, two, zaman_shamsi | 12 | — | ✓ |
| 58 | `gheymat_tamas_usd` | sabet | کجا: جدولِ «تماس‌ها» · چیه: دلار برای هر میلیون توکن: ورودی، خروجی، نوشتنِ کش، خواندنِ کش؛ برای Sonnet و fork (Opus) · از جدولِ ۲۰۳ (ertebat_claude.py) | mods/hads/hooks/register.js:486 | sefr, vazhe_name | 19 | `had_tamas_riz` | ؟ |
| 59 | `had_tamas_riz` | sabet | کجا: حالتِ بزرگِ جدولِ «تماس‌ها» · چیه: چند تماسِ آخر ریز به ریز · مثال: ⟦had_tamas_riz⟧ تای آخر | mods/hads/hooks/register.js:487 | sefr, vazhe_name | 19 | `gheymat_tamas_usd` | ؟ |
| 60 | `neshane_amar` | sabet | نشانهٔ اولِ خطِ پنهانی که دادهٔ جدولِ «تماس‌ها» را به صفحه می‌برد | mods/hads/hooks/register.js:488 | matn_amar, vazhe_name | 19 | `NESHANE_AMAR` | ؟ |
| 61 | `amar_cache` | vaziat | دادهٔ جدولِ «تماس‌ها» که چند ثانیه نگه داشته می‌شود تا هر رسمِ کادر فایل را دوباره نخواند | mods/hads/hooks/register.js:489 | benevis_kharj, matn_amar, vazhe_name | 19 | `neshane_amar` | ؟ |
| 62 | `had_tedad_kamtarin_zaban_harf` | sabet | کجا: آخرِ جواب، بخشِ «زبان» · چیه: جوابِ کوتاه‌تر از این تعداد حرف (فارسی + لاتین، بی کد و لینک) سنجیده نمی‌شود · مثال: ⟦had_tedad_kamtarin_zaban_harf⟧ | mods/hads/hooks/register.js:576 | begu_do_jomle, englisi_ast | 01 | `matn_yadavari_zaban` | ✓ |
| 63 | `matn_yadavari_zaban` | sabet | متنی که «زبان» بعد از جوابِ انگلیسی به چت می‌فرستد تا مدل فارسی حرف بزند | mods/hads/hooks/register.js:577 | begu_do_jomle, chek_zaban | 01 | `had_tedad_kamtarin_zaban_harf`, `zaban_yadavari_shod` | ✓ |
| 64 | `prompt_az_hads` | sabet | سرِ هر پرومپتِ ترجمه: این پیام از مود است نه از حبیب، و ابزاری صدا نزن | mods/hads/hooks/register.js:593 | englisi_ast, prompt_tarjome_kadr | 22 | — | ؟ |
| 65 | `ghaede_tarjome` | sabet | قاعدهٔ ترجمهٔ جواب: قالب‌بندی و کد و فرمان دست‌نخورده، چیزی کم یا زیاد نشود | mods/hads/hooks/register.js:595 | englisi_ast | 22 | — | ؟ |
| 66 | `prompt_tarjome_ezafe` | sabet | تکه‌ای که به فورکِ مشترک اضافه می‌شود تا کلیدِ tarjome را هم در همان JSON بدهد | mods/hads/hooks/register.js:596 | englisi_ast, hads_ba_fork, jambandi | 22 | — | ؟ |
| 67 | `prompt_tarjome_javab` | sabet | پرومپتِ فورکِ جدا برای ترجمهٔ آخرین جواب، وقتی فورکِ مشترکی نبود | mods/hads/hooks/register.js:597 | englisi_ast, tarjome_ba_fork_khodash | 22 | — | ؟ |
| 68 | `had_tedad_tarjome_radif` | sabet | چند ترجمهٔ آخر در فایلِ tarjome.jsonl هر چت می‌ماند: ⟦had_tedad_tarjome_radif⟧ | mods/hads/hooks/register.js:599 | prompt_tarjome_kadr, sabt_tarjome | 22 | — | ؟ |
| 69 | `tarjome_kadr_dar_kar` | motaghayer | دکمهٔ «ترجمه به انگلیسی» در راه است؛ زدنِ دوباره کاری نمی‌کند | mods/hads/hooks/register.js:639 | begu, khandan, register, tarjome_ba_fork_khodash | 22 | — | ؟ |
| 70 | `zaban_yadavari_shod` | vaziat | برای هر چت: آیا همین الان یادآوریِ زبان فرستاده شد؛ اگر بله، جوابِ بعدی دوباره یادآوری نمی‌گیرد (حلقه نشود) | mods/hads/hooks/register.js:666 | chek_zaban, khandan | 01 | `matn_yadavari_zaban` | ✓ |
| 71 | `had_kamtarin_do_jomle_jambandi` | sabet | کجا: آخرِ جواب · چیه: با کمتر از این «دو جمله» در نوبت جمع‌بندی ساخته نمی‌شود · مثال: ⟦had_kamtarin_do_jomle_jambandi⟧ | mods/hads/hooks/register.js:723 | akhar_javab, amade_jambandi | 12 | `do_jomle_ha_ye_nobat` | ✓ |
| 72 | `abzar_ha_ye_nobat` | vaziat | ابزارهایی که در نوبتِ در جریان صدا زده شدند | mods/hads/hooks/register.js:725 | akhar_javab, amade_jambandi, register | 12 | — | ✓ |
| 73 | `khaste_habib_nobat` | vaziat | پیامِ خودِ حبیب که نوبت را شروع کرد | mods/hads/hooks/register.js:727 | akhar_javab, amade_jambandi, register | 14 | — | ✓ |
| 74 | `khodkar_ferestade_har_chat` | vaziat | «خودکار»ها و «نکرده»‌هایی که به چت فرستاده شدند، با شمارِ هر کار | mods/hads/hooks/register.js:805 | khandan_khodkar_ferestade, masir_khodkar_ferestade | 15 | `had_ferestadan_kar` | ؟ |
| 75 | `baraye_ferestadan_har_chat` | vaziat | «خودکار»هایی که در صفِ فرستادن به چت‌اند | mods/hads/hooks/register.js:806 | baraye_ferestadan, ferestadan_khodkar, masir_khodkar_ferestade | 15 | `khodkar_ferestade_har_chat` | ؟ |
| 76 | `had_ferestadan_kar` | sabet | کجا: «خودکار» · چیه: یک کار چند بار به چت برود؛ بارِ آخر با درخواستِ کمک از حبیب، بعدش دیگر نه · مثال: ⟦had_ferestadan_kar⟧ بار | mods/hads/hooks/register.js:823 | dar_list, ferestadan_khodkar, shomar | 15 | `matn_bar_sevom` | ؟ |
| 77 | `matn_bar_sevom` | sabet | متنی که بارِ آخرِ فرستادنِ یک کار اضافه می‌شود: «اول به زبانِ ساده به حبیب توضیح بده و کمک بخواه» | mods/hads/hooks/register.js:824 | dar_list, matn_ferestadan_khodkar | 15 | `had_ferestadan_kar` | ؟ |
| 78 | `matn_porsesh_montazer` | sabet | پیامِ کادر وقتی «پرسش» باید تا جوابِ بعدی صبر کند | mods/hads/hooks/register.js:965 | hads_ba_fork, porsesh_kon | 12 | `porsesh_montazer` | ✓ |
| 79 | `matn_dalil_bi_javab` | sabet | دلیلِ ساده‌ای که کادر وقتی fork جواب نداد نشان می‌دهد | mods/hads/hooks/register.js:966 | hads_ba_fork, porsesh_kon | 12 | — | ✓ |
| 80 | `had_harf_dokme_prompt` | sabet | کجا: دکمه‌های پرومپتِ «پرسش» · چیه: بیشترین حرفِ روی دکمه · مثال: بلندتر از ⟦had_harf_dokme_prompt⟧ حرف با … | mods/hads/hooks/register.js:984 | register, zakhire_prompt_ha | 18 | `prompt_ha` | ؟ |
| 81 | `bakhsh_ha` | sabet | بخش‌های کادرِ حدس و اسمِ فارسیِ هر کدام (تیک‌ها) | mods/hads/hooks/register.js:1073 | bargardandan_akharin, khandan_file_chat, khandan_tartib, masir_file_chat, register | 16 | `esm_bakhsh`, `kalame_khamush` | ✓ |
| 82 | `esm_bakhsh` | sabet | همان، به شکلِ جدولِ اسم ⇐ واژه | mods/hads/hooks/register.js:1076 | masir_file_chat, register | 16 | `bakhsh_ha` | ؟ |
| 83 | `dayere_ha` | sabet | دایره‌های سرچِ حافظه: همین چت، همین پروژه، همهٔ پروژه‌ها | mods/hads/hooks/register.js:1081 | hafeze_dayere, masir_file_chat, register, taghir_dayere | 17 | `esm_dayere`, `dayere_har_chat` | ؟ |
| 84 | `esm_dayere` | sabet | اسمِ فارسیِ هر دایره | mods/hads/hooks/register.js:1082 | masir_file_chat, register | 17 | `dayere_ha` | ؟ |
| 85 | `dayere_har_chat` | vaziat | دایرهٔ سرچِ حافظه برای هر چت | mods/hads/hooks/register.js:1085 | khandan_dayere, masir_hafeze_dayere, register, taghir_dayere | 17 | `dayere_ha` | ؟ |
| 86 | `akharin_zakhire` | vaziat | آخرین وضعی که برای هر چت در فایل نوشته شد (حدس‌ها، نکرده‌ها …)، برای برگرداندن بعد از ریلود | mods/hads/hooks/register.js:1124 | tasvir_akharin, zakhire_akharin | 16 | `akharin_bargashte` | ؟ |
| 87 | `akharin_bargashte` | vaziat | چت‌هایی که وضعشان بعد از ریلود یک بار برگردانده شد | mods/hads/hooks/register.js:1131 | bargardandan_akharin, zakhire_akharin | 16 | `akharin_zakhire` | ؟ |
| 88 | `kalame_khamush` | sabet | کلمهٔ هر بخشِ خاموش در فایلِ چت (مثلِ -hads)؛ کامل نوشته شده تا با grep پیدا شود | mods/hads/hooks/register.js:1168 | kalame_ha_ye_file, khandan_file_chat, taghir_tartib | 10 | `bakhsh_ha`, `kalame_tanzim` | ✓ |
| 89 | `kalame_tanzim` | sabet | کلمه‌های دیگرِ فایلِ چت: حالتِ کادر و تنظیم‌ها | mods/hads/hooks/register.js:1169 | kalame_ha_ye_file, khandan_file_chat, taghir_tartib | 13 | `kalame_khamush` | ✓ |
| 90 | `ghablia_baz` | vaziat | «قبلی‌ها» باز است | mods/hads/hooks/register.js:1194 | jam_kardan, register | 12 | `had_ghablia_tedad` | ✓ |
| 91 | `had_hook_transcript_khat` | sabet | کجا: «هوک‌ها» · چیه: چند خطِ آخرِ فایلِ چت برای پیدا کردنِ هوک‌ها خوانده شود · مثال: ⟦had_hook_transcript_khat⟧ خط | mods/hads/hooks/register.js:1202 | jam_kardan, khandan_hook_az_transcript | 11 | `had_hook_transcript_byte` | ✓ |
| 92 | `had_hook_transcript_byte` | sabet | همان، به بایت: بیش از این از تهِ فایل خوانده نمی‌شود | mods/hads/hooks/register.js:1203 | jam_kardan, khandan_hook_az_transcript | 11 | `had_hook_transcript_khat` | ✓ |
| 93 | `hook_transcript_grep` | sabet | الگوی خط‌های هوک در فایلِ چت | mods/hads/hooks/register.js:1204 | jam_kardan, khandan_hook_az_transcript | 11 | — | ✓ |
| 94 | `had_hook_kuchak_harf` | sabet | کجا: «هوک‌ها» · چیه: بیشترین حرفِ هر خطِ کوچک · مثال: ⟦had_hook_kuchak_harf⟧ حرف | mods/hads/hooks/register.js:1206 | jam_kardan, register | 11 | `had_hook_kuchak_radif` | ✓ |
| 95 | `masir_transcript` | vaziat | مسیرِ فایلِ چتِ همین چت | mods/hads/hooks/register.js:1207 | jam_kardan, khandan_hook_az_transcript, register | 11 | — | ✓ |
| 96 | `hook_ha` | vaziat | هوک‌هایی که برای کادر خوانده شد، و چتش | mods/hads/hooks/register.js:1208 | jam_kardan, khandan_hook_az_transcript, register | 11 | — | ✓ |
| 97 | `zaman_khandan_hook` | vaziat | ساعتِ آخرین خواندنِ هوک‌ها | mods/hads/hooks/register.js:1209 | jam_kardan, khandan_hook_az_transcript, register | 11 | — | ✓ |
| 98 | `had_hook_kuchak_radif` | sabet | کجا: «هوک‌ها» · چیه: چند هوکِ آخر در حالتِ کوچک · مثال: ⟦had_hook_kuchak_radif⟧ ردیف | mods/hads/hooks/register.js:1246 | khandan_hook_ha, register | 11 | `had_hook_bozorg_radif` | ✓ |
| 99 | `had_hook_bozorg_radif` | sabet | همان در حالتِ بزرگ | mods/hads/hooks/register.js:1247 | khandan_hook_ha, register | 11 | `had_hook_bozorg_harf` | ✓ |
| 100 | `had_hook_bozorg_harf` | sabet | بیشترین حرفِ هر هوک در حالتِ بزرگ | mods/hads/hooks/register.js:1248 | khandan_hook_ha, register | 11 | `had_hook_bozorg_radif` | ✓ |
| 101 | `ERRORS` | sabet | خطاهای خودِ اسکریپتِ صفحه، برای دکمهٔ «تست» ِ پنل | claude-ui-buttons.js:22 | negahban_khata, neshan_shenase_chat, tashkhis_khata, vazhe_name_ru_kalame | 04 | — | ✓ |
| 102 | `SESSION` | sabet | چتِ این برگه: شناسه، اسم، تیتر (بعد از /clear یا resume عوض می‌شود) | claude-ui-buttons.js:37 | neshan_shenase_chat, neshan_tarjome, porsidan_shenase_chat, sakht_panel_aa | 02 | — | ✓ |
| 103 | `DEFAULT_COMMANDS` | sabet | دکمه‌های پیش‌فرضِ نوارِ بالا | claude-ui-buttons.js:94 | dokme_ha, gozashtan_dokme_pishfarz_bala, khandan_tanzim, negahban_khata | 02 | `DEF` | ✓ |
| 104 | `KEY` | sabet | کلیدِ localStorage ِ تنظیم‌های پنل | claude-ui-buttons.js:127 | khandan_tanzim, negahban_khata, zakhire_tanzim | 04 | `DEF` | ✓ |
| 105 | `DEF` | sabet | تنظیم‌های پیش‌فرضِ پنل (اندازه‌ها، رنگ، روشن/خاموش‌ها) | claude-ui-buttons.js:128 | esm_profile_moshtarak, khandan_tanzim, negahban_khata, radif_andaze, tanzim_pishfarz | 04 | `LIMITS`, `PRESETS`, `KEY` | ✓ |
| 106 | `LIMITS` | sabet | کمترین و بیشترینِ هر اندازه در پنل | claude-ui-buttons.js:153 | khandan_tanzim, negahban_khata, radif_andaze, sakht_panel_aa | 04 | `DEF` | ✓ |
| 107 | `PRESETS` | sabet | حالت‌های آمادهٔ اندازه‌ها | claude-ui-buttons.js:154 | negahban_khata, sakht_panel_aa | 04 | `DEF` | ✓ |
| 108 | `esm_ghadim_tanzim` | sabet | اسمِ قدیمِ دو تنظیم ⇐ اسمِ تازه؛ مقدارِ ذخیره‌شده با اسمِ قدیم خوانده می‌شود | claude-ui-buttons.js:176 | khandan_tanzim, tanzim_pishfarz | 10 | `DEF` | ✓ |
| 109 | `CSS` | sabet | همهٔ قاعده‌های ظاهرِ پنل که به صفحه تزریق می‌شوند | claude-ui-buttons.js:243 | dokme_ha, sakht_hame, vazhe_name_ru_kalame | 04 | — | ✓ |
| 110 | `HOVER_DELAY` | sabet | کجا: پیام‌های جمع‌شده · چیه: موس چند میلی‌ثانیه روی پیام بماند تا باز شود · مثال: ⟦HOVER_DELAY⟧ | claude-ui-buttons.js:638 | baz_shodan_ba_hover, radif_andaze | 04 | — | ✓ |
| 111 | `GLOSS_DELAY` | sabet | کجا: اسم‌های واژه‌نامه در چت · چیه: موس چند میلی‌ثانیه بماند تا کارتِ معنی بیاید · مثال: ⟦GLOSS_DELAY⟧ | claude-ui-buttons.js:784 | bastan_panel, vazhe_name_ru_kalame | 06 | — | ✓ |
| 112 | `counterTimer` | vaziat | زمان‌سنجِ شمارندهٔ «نویسه»؛ فقط وقتی شمارنده روشن است | claude-ui-buttons.js:1140 | menu_naghl, shomarande_nevise | 04 | `usageCache`, `usageTick` | ✓ |
| 113 | `usageCache` | vaziat | آخرین متنِ مصرفِ کانتکست که کنارِ «نویسه» می‌آید | claude-ui-buttons.js:1140 | menu_naghl, shomarande_nevise_tik | 04 | `counterTimer` | ✓ |
| 114 | `usageTick` | vaziat | شمارِ معکوس تا گشتنِ دوبارهٔ متنِ مصرف (گران است، هر چند ثانیه یک بار) | claude-ui-buttons.js:1140 | menu_naghl, shomarande_nevise, shomarande_nevise_tik | 04 | `counterTimer` | ✓ |
| 115 | `FILE_NAME` | sabet | اسمِ فایلِ تنظیم‌هایی که پنل ذخیره و بار می‌کند | claude-ui-buttons.js:1327 | emal_tanzim_vared_shode, neveshtan_yaddasht_panel | 04 | `DEF` | ✓ |
| 116 | `DRAG_PX` | sabet | کجا: دکمه‌های نوارِ بالا · چیه: کمتر از این حرکت کلیک است، بیشتر کشیدن · مثال: ⟦DRAG_PX⟧ پیکسل | claude-ui-buttons.js:1420 | ejraye_dokme, keshidan_navar_bala, keshidan_tik_hads, sakht_hame | 02 | — | ✓ |
| 117 | `topWatch` | vaziat | نگهبانِ نوارِ بالا که بعد از عوض شدنِ چت دوباره می‌سازدش | claude-ui-buttons.js:1507 | bardashtan_jaygozin, payesh_navar_bala | 02 | — | ✓ |
| 118 | `draftCommands` | vaziat | متنِ ذخیره‌نشدهٔ ویرایشگرِ JSON ِ دکمه‌ها | claude-ui-buttons.js:1560 | emal_tanzim_vared_shode, keshidan_navar_bala, sakht_dokme_kenar, sakht_panel_aa | 02 | `DEFAULT_COMMANDS` | ✓ |
| 119 | `draftProfileName` | vaziat | اسمِ پروفایلی که تایپ شده و هنوز ذخیره نشده | claude-ui-buttons.js:1561 | sakht_dokme_kenar, sakht_panel_aa | 04 | — | ✓ |
| 120 | `NESHANE_AMAR` | sabet | همان neshane_amar ِ مود، در صفحه: خطِ پنهانِ دادهٔ جدولِ «تماس‌ها» را پیدا می‌کند | claude-ui-buttons.js:2319 | jadval_tamas, neshan_hook_va_hads | 19 | `neshane_amar` | ؟ |
| 121 | `KELID_JA_AMAR` | sabet | کلیدِ localStorage که جای جدولِ «تماس‌ها» را نگه می‌دارد | claude-ui-buttons.js:2319 | jadval_tamas, neshan_hook_va_hads | 19 | `ja_kuchak_amar` | ؟ |
| 122 | `sotun_amar` | sabet | ستون‌های جدولِ «تماس‌ها» و اسمِ فارسیِ هر کدام | claude-ui-buttons.js:2320 | jadval_bozorg, jadval_kuchak, neshan_hook_va_hads | 19 | `radif_amar` | ؟ |
| 123 | `radif_amar` | sabet | ردیف‌های جدولِ «تماس‌ها»: ۱ ساعت، ۲۴ ساعت، کل | claude-ui-buttons.js:2322 | jadval_bozorg, jadval_kuchak, neshan_hook_va_hads | 19 | `sotun_amar` | ؟ |
| 124 | `amar_matn_akhar` | vaziat | آخرین دادهٔ کشیده‌شده؛ بی‌تغییر دوباره کشیده نمی‌شود | claude-ui-buttons.js:2323 | amar_bozorgi, jadval_tamas, neshan_hook_va_hads | 19 | — | ؟ |
| 125 | `amar_bozorg` | vaziat | جدولِ «تماس‌ها» در حالتِ بزرگ است | claude-ui-buttons.js:2323 | amar_bozorgi, jadval_tamas, neshan_hook_va_hads | 19 | `ja_kuchak_amar` | ؟ |
| 126 | `ja_kuchak_amar` | vaziat | جای جدولِ کوچک پیش از بزرگ شدن، تا × یا کلیکِ بیرون آن را همان‌جا برگرداند | claude-ui-buttons.js:2323 | amar_bozorgi, neshan_hook_va_hads | 19 | `amar_bozorg`, `KELID_JA_AMAR` | ؟ |
| 127 | `amar_dar_rah` | vaziat | یک رسمِ دوبارهٔ جدول در فریمِ بعد در راه است (دو تا پشتِ هم نه) | claude-ui-buttons.js:2437 | jadval_tamas | 19 | — | ؟ |
| 128 | `tarjome_ha` | motaghayer | ترجمه‌های همین چت، به کلیدِ اولِ متنِ جواب | claude-ui-buttons.js:2449 | jadval_tamas, neshan_tarjome | 22 | — | ؟ |
| 129 | `tarjome_mt` | motaghayer | زمانِ آخرین نسخهٔ فایلِ ترجمه که رسید؛ میزبان فقط اگر عوض شده بفرستد | claude-ui-buttons.js:2449 | jadval_tamas, neshan_tarjome | 22 | — | ؟ |
| 130 | `tarjome_sid` | motaghayer | ترجمه‌ها مالِ کدام چت‌اند؛ چت که عوض شد از نو گرفته می‌شوند | claude-ui-buttons.js:2449 | jadval_tamas, neshan_tarjome | 22 | — | ؟ |
| 131 | `timer` | vaziat | زمان‌سنجِ همان گشتن | claude-ui-buttons.js:2542 | baz_shodan_ba_hover, menu_naghl, neshan_tarjome, vazhe_name_ru_kalame | 04 | — | ✓ |
| 132 | `gorooh_hook` | sabet | نوع‌های پیامِ هوک که بعد از ریلود از فایلِ چت دوباره به صفحه داده می‌شوند | claude-host-hook.js:263 | khat_ha_ye_hook_dar_file, sakht_khat_hook | 11 | `neshane_hook` | ✓ |
| 133 | `neshane_hook` | sabet | بایت‌های نشانِ خطِ هوک در فایلِ چت؛ فایل تکه‌تکه گشته می‌شود، نه یک‌جا | claude-host-hook.js:276 | khat_ha_ye_hook_dar_file, masir_transcript | 11 | `gorooh_hook` | ✓ |
