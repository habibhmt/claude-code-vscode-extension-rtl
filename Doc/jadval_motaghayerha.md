# جدولِ متغیرهای ۱۳۶ — ساخته با `python3 Doc/abzar/jadval_motaghayer.py`، دستی عوض نکن

معنی‌ها از `Doc/shenasname_matn.toml`؛ جا و تابع‌ها از خودِ کد. «تأیید»: ✓ = اسم «بله» ِ حبیب را دارد · ؟ = پیشنهاد، تأییدنشده.

| # | متغیر | نوع | معنی | فایل:خط | تابع‌ها | تعریف | در ارتباط با | تأیید |
|---|---|---|---|---|---|---|---|---|
| 1 | `model_do_jomle_va_hads` | sabet | کجا: مودِ حدس · چیه: مدلی که «دو جمله» و حدسِ پشتیبان (وقتی fork نمی‌شود) با آن ساخته می‌شود · مثال: ⟦model_do_jomle_va_hads⟧ | mods/hads/hooks/register.js:5 | begu_do_jomle, hads_ba_sonnet | 12 | `had_fork_context_token` | ✓ |
| 2 | `hads_har_chand_javab` | sabet | کجا: آخرِ هر جواب · چیه: حدس و نکرده و خودکار و کرون هر چند جواب یک بار ساخته شوند · مثال: هر ⟦hads_har_chand_javab⟧ جواب یک fork | mods/hads/hooks/register.js:7 | akhar_javab, chat_kuchak | 01 | `tedad_javab_har_chat` | ✓ |
| 3 | `tedad_javab_har_chat` | vaziat | چند جواب در هر چت دیده شده، از بالا آمدنِ همین پروسه؛ برای «هر چند جواب یک بار» | mods/hads/hooks/register.js:9 | akhar_javab | 01 | `hads_har_chand_javab` | ✓ |
| 4 | `prompt_system_hads` | sabet | دستورِ Sonnet برای حدس وقتی fork نمی‌شود: ۱ یا ۲ پیامِ بعدیِ حبیب، با لحنِ خودش | mods/hads/hooks/register.js:11 | hads_ba_sonnet | 01 | `model_do_jomle_va_hads` | ✓ |
| 5 | `hads_akhar` | vaziat | آخرین حدس‌هایی که کادر نشان می‌دهد | mods/hads/hooks/register.js:18 | akhar_javab, bargardandan_akharin, hads_ba_fork, hads_ba_sonnet, register, tasvir_akharin …+1 | 01 | `hads_baraye_chat` | ✓ |
| 6 | `nakarde_akhar` | vaziat | آخرین «نکرده»‌ها (خواسته‌های حبیب که هنوز انجام نشده)، برای کادر | mods/hads/hooks/register.js:21 | anjam_shod_zadan, bargardandan_akharin, hads_ba_fork, register, tasvir_akharin, tik_zadan | 14 | `nakarde_ba_sanad_akhar` | ✓ |
| 7 | `nakarde_ba_sanad_akhar` | vaziat | «نکرده»‌هایی که سندشان (فایل یا commit) نشان داد انجام شده؛ در یک خطِ کوچک شمرده می‌شوند | mods/hads/hooks/register.js:24 | bargardandan_akharin, hads_ba_fork, register, tasvir_akharin, tik_zadan | 14 | `nakarde_akhar`, `had_kamtarin_harf_sanad` | ؟ |
| 8 | `nakarde_ba_sanad_baz` | vaziat | خطِ «با سند کنار رفت» باز است یا بسته | mods/hads/hooks/register.js:25 | register | 14 | `nakarde_ba_sanad_akhar` | ؟ |
| 9 | `khodkar_akhar` | vaziat | آخرین «خودکار»ها: کاری که ایجنت خودش با ابزارش می‌تواند بکند به‌جای پرسیدن از حبیب | mods/hads/hooks/register.js:29 | bargardandan_akharin, hads_ba_fork, register, tasvir_akharin, tik_zadan | 15 | `khodkar_ferestade_har_chat` | ؟ |
| 10 | `cron_akhar` | vaziat | آخرین «کرون‌جاب»‌ها: کارهای تکراری که حبیب گفت و به اجرای خودکار سرِ وقت می‌خورند | mods/hads/hooks/register.js:30 | bargardandan_akharin, hads_ba_fork, register, tasvir_akharin, tik_zadan | 15 | — | ؟ |
| 11 | `hads_dar_kar` | vaziat | یک ساختِ حدس در راه است؛ دومی هم‌زمان شروع نمی‌شود | mods/hads/hooks/register.js:31 | hads_ba_sonnet | 01 | — | ✓ |
| 12 | `hads_baraye_chat` | vaziat | حدس‌ها مالِ کدام چت‌اند؛ بعد از /clear (چتِ تازه) نشان داده نمی‌شوند | mods/hads/hooks/register.js:33 | akhar_javab, bargardandan_akharin, hads_ba_fork, hads_ba_sonnet, register, tasvir_akharin | 01 | `hads_akhar` | ✓ |
| 13 | `do_jomle_fasele_ms` | sabet | کجا: وسطِ کار، بعد از هر ابزار · چیه: کمترین فاصلهٔ دو «دو جمله» · مثال: هر ⟦do_jomle_fasele_ms⟧ میلی‌ثانیه حداکثر یکی | mods/hads/hooks/register.js:37 | begu_do_jomle, vazhe_name | 12 | `model_do_jomle_va_hads` | ✓ |
| 14 | `had_fork_context_token` | sabet | کجا: آخرِ جواب · چیه: اگر چت از این بزرگ‌تر باشد fork گران است و Sonnet روی پیام‌های آخر کار می‌کند · مثال: بیش از ⟦had_fork_context_token⟧ توکن | mods/hads/hooks/register.js:39 | chat_kuchak, hads_ba_fork | 01 | `model_do_jomle_va_hads` | ✓ |
| 15 | `cache_sard_ms` | sabet | کجا: «پرسش» · چیه: بیکاریِ بیش از این یعنی کشِ چت احتمالاً سرد شده و «پرسش» اول هشدار می‌دهد (کشِ یک‌ساعته) | mods/hads/hooks/register.js:43 | register | 12 | `cache_sard_5m_ms`, `cache_sard_bad_az_ms` | ✓ |
| 16 | `cache_sard_5m_ms` | sabet | همان، وقتی کشِ چت پنج‌دقیقه‌ای است | mods/hads/hooks/register.js:44 | register | 12 | `cache_sard_ms` | ✓ |
| 17 | `cache_sard_bad_az_ms` | vaziat | کدام یک از دو بالایی الان به کار می‌رود (بسته به کشِ چت) | mods/hads/hooks/register.js:45 | porsesh_kon, register | 12 | `cache_sard_ms`, `cache_sard_5m_ms` | ✓ |
| 18 | `prompt_system_do_jomle` | sabet | دستورِ Sonnet برای «دو جمله»: دو جملهٔ ساده که ایجنت الان چه می‌کند و منتظرِ چیست، با واژه‌نامهٔ حبیب | mods/hads/hooks/register.js:46 | begu_do_jomle | 12 | — | ✓ |
| 19 | `do_jomle_akhar` | vaziat | آخرین «دو جمله» و چتش | mods/hads/hooks/register.js:51 | bargardandan_akharin, benevis_do_jomle, register, sabt_jambandi, tasvir_akharin, tik_zadan | 12 | — | ✓ |
| 20 | `do_jomle_dar_kar` | vaziat | یک «دو جمله» در راه است | mods/hads/hooks/register.js:52 | begu_do_jomle | 12 | `do_jomle_dobare` | ✓ |
| 21 | `do_jomle_dobare` | vaziat | وقتی یکی در راه بود، یکی دیگر خواسته شد؛ بعدش ساخته می‌شود | mods/hads/hooks/register.js:53 | begu_do_jomle | 12 | `do_jomle_dar_kar` | ✓ |
| 22 | `zaman_do_jomle_akhar` | vaziat | ساعتِ آخرین «دو جمله»، برای فاصلهٔ ⟦do_jomle_fasele_ms⟧ | mods/hads/hooks/register.js:54 | begu_do_jomle | 12 | `do_jomle_fasele_ms` | ✓ |
| 23 | `zaman_akhar_javab` | vaziat | ساعتِ آخرین پایانِ جواب؛ پایانِ جواب بر «دو جمله»ٔ وسطِ کار که دیرتر رسید می‌چربد | mods/hads/hooks/register.js:56 | akhar_javab, begu_do_jomle | 12 | — | ✓ |
| 24 | `akhar_javab_dar_kar` | vaziat | کارِ آخرِ جواب در راه است | mods/hads/hooks/register.js:57 | akhar_javab | 01 | `akhar_javab_dobare` | ✓ |
| 25 | `akhar_javab_dobare` | vaziat | جوابی وسطِ کارِ قبلی تمام شد؛ بعدش انجام می‌شود، گم نمی‌شود | mods/hads/hooks/register.js:59 | akhar_javab | 01 | `akhar_javab_dar_kar` | ✓ |
| 26 | `zaman_akharin_kar` | vaziat | آخرین باری که خودِ چت با مدل حرف زد؛ سنِ کش | mods/hads/hooks/register.js:61 | porsesh_kon, register | 12 | `cache_sard_ms` | ✓ |
| 27 | `cache_sard_shod` | vaziat | Claude Code خودش بعد از resume گفت کش رفته | mods/hads/hooks/register.js:63 | porsesh_kon, register | 12 | `cache_sard_ms` | ✓ |
| 28 | `porsesh_montazer` | vaziat | «پرسش»ی که پیش از آماده بودنِ fork آمد؛ آخرِ جوابِ بعدی خودش پرسیده می‌شود | mods/hads/hooks/register.js:66 | porsesh_kon, register, tik_zadan | 12 | `matn_porsesh_montazer` | ✓ |
| 29 | `javab_porsesh` | vaziat | جوابِ آخرین «پرسش» (fork با کشِ گرم)؛ هرگز به چت نمی‌رود | mods/hads/hooks/register.js:68 | bargardandan_akharin, porsesh_kon, register, tasvir_akharin, tik_zadan | 12 | `matn_porsesh` | ✓ |
| 30 | `matn_porsesh` | vaziat | متنی که حبیب در جعبهٔ «پرسش» نوشته | mods/hads/hooks/register.js:69 | porsesh_kon, register | 12 | `javab_porsesh` | ✓ |
| 31 | `prompt_ha` | vaziat | پرومپت‌های ذخیره‌شدهٔ «پرسش» (همهٔ چت‌ها یکی، در فایل) | mods/hads/hooks/register.js:74 | khandan_prompt_ha, register, zakhire_prompt_ha, zakhire_prompt_virayesh | 18 | `prompt_entekhab_har_chat`, `had_harf_dokme_prompt` | ؟ |
| 32 | `prompt_entekhab_har_chat` | vaziat | کدام پرومپت در هر چت روشن است | mods/hads/hooks/register.js:75 | prompt_entekhab_shode, register | 18 | `prompt_ha` | ؟ |
| 33 | `prompt_virayesh` | vaziat | پرومپتی که الان با ✎ در حالِ ویرایش است | mods/hads/hooks/register.js:76 | register, zakhire_prompt_virayesh | 18 | `prompt_ha` | ؟ |
| 34 | `system_reminder_regex` | sabet | الگوی بخش‌های system-reminder که از متنِ پیام‌ها کنار گذاشته می‌شوند | mods/hads/hooks/register.js:92 | cut, khandan_hads, payam_ha_ye_akhar | 14 | — | ✓ |
| 35 | `matn_bi_harfe_habib` | sabet | وقتی نوبت با پیامِ خودِ حبیب شروع نشده (کار، چتِ دیگر، Continue)، به‌جای «خواستهٔ حبیب» این می‌آید | mods/hads/hooks/register.js:97 | az_agent_digar, harf_habib | 14 | — | ✓ |
| 36 | `prompt_fork_do_jomle` | sabet | تکهٔ دستورِ fork برای «دو جمله»؛ فقط بخش‌های روشن خواسته می‌شوند | mods/hads/hooks/register.js:156 | hads_ba_sonnet, prompt_fork_bakhsh_ha | 12 | — | ✓ |
| 37 | `prompt_fork_hads` | sabet | تکهٔ دستورِ fork برای حدس | mods/hads/hooks/register.js:157 | hads_ba_sonnet, prompt_fork_bakhsh_ha | 01 | — | ✓ |
| 38 | `abzar_ha_ye_claude_code` | sabet | فهرستِ کاملِ ابزارهای ایجنت در Claude Code، برای «خودکار» (از سندِ رسمی) | mods/hads/hooks/register.js:181 | ghaede_khodkar, ghaede_nakarde | 15 | `prompt_fork_khodkar` | ؟ |
| 39 | `prompt_fork_khodkar` | sabet | تکهٔ دستورِ fork برای «خودکار» | mods/hads/hooks/register.js:216 | ghaede_nakarde, prompt_fork_bakhsh_ha | 15 | `abzar_ha_ye_claude_code` | ؟ |
| 40 | `prompt_fork_cron` | sabet | تکهٔ دستورِ fork برای «کرون‌جاب» | mods/hads/hooks/register.js:229 | ghaede_khodkar, prompt_fork_bakhsh_ha | 15 | `ghaede_cron` | ؟ |
| 41 | `ghaede_cron` | sabet | قاعده‌های «کرون‌جاب» در دستورِ fork | mods/hads/hooks/register.js:230 | ghaede_bakhsh_ha, ghaede_khodkar | 15 | `prompt_fork_cron` | ؟ |
| 42 | `had_kamtarin_harf_sanad` | sabet | کجا: سندِ «نکرده» · چیه: متنِ سند کوتاه‌تر از این چک حساب نمی‌شود · مثال: کمتر از ⟦had_kamtarin_harf_sanad⟧ حرف | mods/hads/hooks/register.js:245 | khandan_nakarde, khandan_sanad | 14 | `nakarde_ba_sanad_akhar` | ؟ |
| 43 | `nakarde_anjam_har_chat` | vaziat | «نکرده»‌هایی که حبیب در هر چت خودش «✓ انجام شد» زد | mods/hads/hooks/register.js:310 | khandan_nakarde_anjam, masir_nakarde_anjam | 14 | — | ✓ |
| 44 | `gheymat_cache_neveshtan_usd` | sabet | دلار برای هر میلیون توکنِ نوشتنِ کش (پنج‌دقیقه‌ای و یک‌ساعته)، برای هشدارِ «پرسش» با کشِ سرد | mods/hads/hooks/register.js:351 | khandan_javab_fork, kharj_cache_sard | 12 | `gheymat_tamas_usd` | ✓ |
| 45 | `had_ghablia_tedad` | sabet | کجا: «قبلی‌ها» · چیه: چند «دو جمله»ٔ قبلی نگه داشته و نشان داده شود · مثال: ⟦had_ghablia_tedad⟧ تای آخر | mods/hads/hooks/register.js:359 | benevis_do_jomle, kharj_cache_sard | 12 | — | ✓ |
| 46 | `do_jomle_akhar_dar_daftar` | vaziat | آخرین «دو جمله» که در دفتر نوشته شد، برای هر چت (یک پروسه چند چت می‌تواند داشته باشد) | mods/hads/hooks/register.js:391 | benevis_do_jomle, w | 12 | — | ✓ |
| 47 | `hads_zade_shode` | vaziat | حدس‌هایی که در کادرِ نوشتن گذاشته شدند، تا با Enter معلوم شود کدام رفت | mods/hads/hooks/register.js:393 | register, w | 01 | — | ✓ |
| 48 | `do_jomle_ha_ye_nobat` | vaziat | همهٔ «دو جمله»‌های نوبتِ در جریان، برای جمع‌بندیِ آخرِ جواب | mods/hads/hooks/register.js:396 | amade_jambandi, benevis_do_jomle, register, w | 12 | `had_kamtarin_do_jomle_jambandi` | ✓ |
| 49 | `mah_miladi` | sabet | اسمِ کوتاهِ ماه‌های میلادی، مثلِ تاریخ‌نویسیِ حبیب («۲۴ اکت ۱۸:۵۷») | mods/hads/hooks/register.js:408 | benevis_do_jomle, two | 12 | `mah_shamsi` | ✓ |
| 50 | `mah_shamsi` | sabet | اسمِ ماه‌های شمسی برای تاریخِ خطِ هوک‌ها (در مود و در وصلهٔ میزبان، دو جا) | mods/hads/hooks/register.js:420, claude-host-hook.js:185 | two, zaman_shamsi | 11 | `mah_miladi` | ✓ |
| 51 | `had_do_jomle_harf` | sabet | کجا: «دو جمله» · چیه: بیشترین حرف · مثال: بلندتر از ⟦had_do_jomle_harf⟧ حرف با … کوتاه می‌شود | mods/hads/hooks/register.js:440 | kutah_be_do_jomle, two, zaman_shamsi | 12 | — | ✓ |
| 52 | `gheymat_tamas_usd` | sabet | کجا: جدولِ «تماس‌ها» · چیه: دلار برای هر میلیون توکن: ورودی، خروجی، نوشتنِ کش، خواندنِ کش؛ برای Sonnet و fork (Opus) · از جدولِ ۲۰۳ (ertebat_claude.py) | mods/hads/hooks/register.js:462 | sefr, vazhe_name | 19 | `had_tamas_riz` | ؟ |
| 53 | `had_tamas_riz` | sabet | کجا: حالتِ بزرگِ جدولِ «تماس‌ها» · چیه: چند تماسِ آخر ریز به ریز · مثال: ⟦had_tamas_riz⟧ تای آخر | mods/hads/hooks/register.js:463 | sefr, vazhe_name | 19 | `gheymat_tamas_usd` | ؟ |
| 54 | `neshane_amar` | sabet | نشانهٔ اولِ خطِ پنهانی که دادهٔ جدولِ «تماس‌ها» را به صفحه می‌برد | mods/hads/hooks/register.js:464 | matn_amar, vazhe_name | 19 | `NESHANE_AMAR` | ؟ |
| 55 | `amar_cache` | vaziat | دادهٔ جدولِ «تماس‌ها» که چند ثانیه نگه داشته می‌شود تا هر رسمِ کادر فایل را دوباره نخواند | mods/hads/hooks/register.js:465 | benevis_kharj, matn_amar, vazhe_name | 19 | `neshane_amar` | ؟ |
| 56 | `had_tedad_kamtarin_zaban_harf` | sabet | کجا: آخرِ جواب، بخشِ «زبان» · چیه: جوابِ کوتاه‌تر از این تعداد حرف (فارسی + لاتین، بی کد و لینک) سنجیده نمی‌شود · مثال: ⟦had_tedad_kamtarin_zaban_harf⟧ | mods/hads/hooks/register.js:552 | begu_do_jomle, englisi_ast | 01 | `matn_yadavari_zaban` | ✓ |
| 57 | `matn_yadavari_zaban` | sabet | متنی که «زبان» بعد از جوابِ انگلیسی به چت می‌فرستد تا مدل فارسی حرف بزند | mods/hads/hooks/register.js:553 | begu_do_jomle, chek_zaban | 01 | `had_tedad_kamtarin_zaban_harf`, `zaban_yadavari_shod` | ✓ |
| 58 | `zaban_yadavari_shod` | vaziat | برای هر چت: آیا همین الان یادآوریِ زبان فرستاده شد؛ اگر بله، جوابِ بعدی دوباره یادآوری نمی‌گیرد (حلقه نشود) | mods/hads/hooks/register.js:559 | chek_zaban, englisi_ast | 01 | `matn_yadavari_zaban` | ✓ |
| 59 | `had_kamtarin_do_jomle_jambandi` | sabet | کجا: آخرِ جواب · چیه: با کمتر از این «دو جمله» در نوبت جمع‌بندی ساخته نمی‌شود · مثال: ⟦had_kamtarin_do_jomle_jambandi⟧ | mods/hads/hooks/register.js:614 | akhar_javab, amade_jambandi | 12 | `do_jomle_ha_ye_nobat` | ✓ |
| 60 | `abzar_ha_ye_nobat` | vaziat | ابزارهایی که در نوبتِ در جریان صدا زده شدند | mods/hads/hooks/register.js:616 | akhar_javab, amade_jambandi, register | 12 | — | ✓ |
| 61 | `khaste_habib_nobat` | vaziat | پیامِ خودِ حبیب که نوبت را شروع کرد | mods/hads/hooks/register.js:618 | akhar_javab, amade_jambandi, register | 14 | — | ✓ |
| 62 | `khodkar_ferestade_har_chat` | vaziat | «خودکار»ها و «نکرده»‌هایی که به چت فرستاده شدند، با شمارِ هر کار | mods/hads/hooks/register.js:695 | khandan_khodkar_ferestade, masir_khodkar_ferestade | 15 | `had_ferestadan_kar` | ؟ |
| 63 | `baraye_ferestadan_har_chat` | vaziat | «خودکار»هایی که در صفِ فرستادن به چت‌اند | mods/hads/hooks/register.js:696 | baraye_ferestadan, ferestadan_khodkar, masir_khodkar_ferestade | 15 | `khodkar_ferestade_har_chat` | ؟ |
| 64 | `had_ferestadan_kar` | sabet | کجا: «خودکار» · چیه: یک کار چند بار به چت برود؛ بارِ آخر با درخواستِ کمک از حبیب، بعدش دیگر نه · مثال: ⟦had_ferestadan_kar⟧ بار | mods/hads/hooks/register.js:713 | dar_list, ferestadan_khodkar, shomar | 15 | `matn_bar_sevom` | ؟ |
| 65 | `matn_bar_sevom` | sabet | متنی که بارِ آخرِ فرستادنِ یک کار اضافه می‌شود: «اول به زبانِ ساده به حبیب توضیح بده و کمک بخواه» | mods/hads/hooks/register.js:714 | dar_list, matn_ferestadan_khodkar | 15 | `had_ferestadan_kar` | ؟ |
| 66 | `matn_porsesh_montazer` | sabet | پیامِ کادر وقتی «پرسش» باید تا جوابِ بعدی صبر کند | mods/hads/hooks/register.js:809 | hads_ba_fork, porsesh_kon | 12 | `porsesh_montazer` | ✓ |
| 67 | `matn_dalil_bi_javab` | sabet | دلیلِ ساده‌ای که کادر وقتی fork جواب نداد نشان می‌دهد | mods/hads/hooks/register.js:810 | hads_ba_fork, porsesh_kon | 12 | — | ✓ |
| 68 | `had_harf_dokme_prompt` | sabet | کجا: دکمه‌های پرومپتِ «پرسش» · چیه: بیشترین حرفِ روی دکمه · مثال: بلندتر از ⟦had_harf_dokme_prompt⟧ حرف با … | mods/hads/hooks/register.js:828 | register, zakhire_prompt_ha | 18 | `prompt_ha` | ؟ |
| 69 | `bakhsh_ha` | sabet | بخش‌های کادرِ حدس و اسمِ فارسیِ هر کدام (تیک‌ها) | mods/hads/hooks/register.js:917 | bargardandan_akharin, khandan_file_chat, khandan_tartib, masir_file_chat, register | 16 | `esm_bakhsh`, `kalame_khamush` | ✓ |
| 70 | `esm_bakhsh` | sabet | همان، به شکلِ جدولِ اسم ⇐ واژه | mods/hads/hooks/register.js:920 | masir_file_chat, register | 16 | `bakhsh_ha` | ؟ |
| 71 | `dayere_ha` | sabet | دایره‌های سرچِ حافظه: همین چت، همین پروژه، همهٔ پروژه‌ها | mods/hads/hooks/register.js:925 | hafeze_dayere, masir_file_chat, register, taghir_dayere | 17 | `esm_dayere`, `dayere_har_chat` | ؟ |
| 72 | `esm_dayere` | sabet | اسمِ فارسیِ هر دایره | mods/hads/hooks/register.js:926 | masir_file_chat, register | 17 | `dayere_ha` | ؟ |
| 73 | `dayere_har_chat` | vaziat | دایرهٔ سرچِ حافظه برای هر چت | mods/hads/hooks/register.js:929 | khandan_dayere, masir_hafeze_dayere, register, taghir_dayere | 17 | `dayere_ha` | ؟ |
| 74 | `akharin_zakhire` | vaziat | آخرین وضعی که برای هر چت در فایل نوشته شد (حدس‌ها، نکرده‌ها …)، برای برگرداندن بعد از ریلود | mods/hads/hooks/register.js:968 | tasvir_akharin, zakhire_akharin | 16 | `akharin_bargashte` | ؟ |
| 75 | `akharin_bargashte` | vaziat | چت‌هایی که وضعشان بعد از ریلود یک بار برگردانده شد | mods/hads/hooks/register.js:975 | bargardandan_akharin, zakhire_akharin | 16 | `akharin_zakhire` | ؟ |
| 76 | `kalame_khamush` | sabet | کلمهٔ هر بخشِ خاموش در فایلِ چت (مثلِ -hads)؛ کامل نوشته شده تا با grep پیدا شود | mods/hads/hooks/register.js:1011 | kalame_ha_ye_file, khandan_file_chat, taghir_tartib | 10 | `bakhsh_ha`, `kalame_tanzim` | ✓ |
| 77 | `kalame_tanzim` | sabet | کلمه‌های دیگرِ فایلِ چت: حالتِ کادر و تنظیم‌ها | mods/hads/hooks/register.js:1012 | kalame_ha_ye_file, khandan_file_chat, taghir_tartib | 13 | `kalame_khamush` | ✓ |
| 78 | `ghablia_baz` | vaziat | «قبلی‌ها» باز است | mods/hads/hooks/register.js:1037 | jam_kardan, register | 12 | `had_ghablia_tedad` | ✓ |
| 79 | `had_hook_transcript_khat` | sabet | کجا: «هوک‌ها» · چیه: چند خطِ آخرِ فایلِ چت برای پیدا کردنِ هوک‌ها خوانده شود · مثال: ⟦had_hook_transcript_khat⟧ خط | mods/hads/hooks/register.js:1045 | jam_kardan, khandan_hook_az_transcript | 11 | `had_hook_transcript_byte` | ✓ |
| 80 | `had_hook_transcript_byte` | sabet | همان، به بایت: بیش از این از تهِ فایل خوانده نمی‌شود | mods/hads/hooks/register.js:1046 | jam_kardan, khandan_hook_az_transcript | 11 | `had_hook_transcript_khat` | ✓ |
| 81 | `hook_transcript_grep` | sabet | الگوی خط‌های هوک در فایلِ چت | mods/hads/hooks/register.js:1047 | jam_kardan, khandan_hook_az_transcript | 11 | — | ✓ |
| 82 | `had_hook_kuchak_harf` | sabet | کجا: «هوک‌ها» · چیه: بیشترین حرفِ هر خطِ کوچک · مثال: ⟦had_hook_kuchak_harf⟧ حرف | mods/hads/hooks/register.js:1049 | jam_kardan, register | 11 | `had_hook_kuchak_radif` | ✓ |
| 83 | `masir_transcript` | vaziat | مسیرِ فایلِ چتِ همین چت | mods/hads/hooks/register.js:1050 | jam_kardan, khandan_hook_az_transcript, register | 11 | — | ✓ |
| 84 | `hook_ha` | vaziat | هوک‌هایی که برای کادر خوانده شد، و چتش | mods/hads/hooks/register.js:1051 | jam_kardan, khandan_hook_az_transcript, register | 11 | — | ✓ |
| 85 | `zaman_khandan_hook` | vaziat | ساعتِ آخرین خواندنِ هوک‌ها | mods/hads/hooks/register.js:1052 | jam_kardan, khandan_hook_az_transcript, register | 11 | — | ✓ |
| 86 | `had_hook_kuchak_radif` | sabet | کجا: «هوک‌ها» · چیه: چند هوکِ آخر در حالتِ کوچک · مثال: ⟦had_hook_kuchak_radif⟧ ردیف | mods/hads/hooks/register.js:1089 | khandan_hook_ha, register | 11 | `had_hook_bozorg_radif` | ✓ |
| 87 | `had_hook_bozorg_radif` | sabet | همان در حالتِ بزرگ | mods/hads/hooks/register.js:1090 | khandan_hook_ha, register | 11 | `had_hook_bozorg_harf` | ✓ |
| 88 | `had_hook_bozorg_harf` | sabet | بیشترین حرفِ هر هوک در حالتِ بزرگ | mods/hads/hooks/register.js:1091 | khandan_hook_ha, register | 11 | `had_hook_bozorg_radif` | ✓ |
| 89 | `ERRORS` | sabet | خطاهای خودِ اسکریپتِ صفحه، برای دکمهٔ «تست» ِ پنل | claude-ui-buttons.js:22 | negahban_khata, neshan_shenase_chat, tashkhis_khata, vazhe_name_ru_kalame | 04 | — | ✓ |
| 90 | `SESSION` | sabet | چتِ این برگه: شناسه، اسم، تیتر (بعد از /clear یا resume عوض می‌شود) | claude-ui-buttons.js:37 | neshan_shenase_chat, porsidan_shenase_chat, sakht_panel_aa | 02 | — | ✓ |
| 91 | `DEFAULT_COMMANDS` | sabet | دکمه‌های پیش‌فرضِ نوارِ بالا | claude-ui-buttons.js:90 | dokme_ha, gozashtan_dokme_pishfarz_bala, khandan_tanzim, negahban_khata | 02 | `DEF` | ✓ |
| 92 | `KEY` | sabet | کلیدِ localStorage ِ تنظیم‌های پنل | claude-ui-buttons.js:123 | khandan_tanzim, negahban_khata, zakhire_tanzim | 04 | `DEF` | ✓ |
| 93 | `DEF` | sabet | تنظیم‌های پیش‌فرضِ پنل (اندازه‌ها، رنگ، روشن/خاموش‌ها) | claude-ui-buttons.js:124 | esm_profile_moshtarak, khandan_tanzim, negahban_khata, radif_andaze, tanzim_pishfarz | 04 | `LIMITS`, `PRESETS`, `KEY` | ✓ |
| 94 | `LIMITS` | sabet | کمترین و بیشترینِ هر اندازه در پنل | claude-ui-buttons.js:149 | khandan_tanzim, negahban_khata, radif_andaze, sakht_panel_aa | 04 | `DEF` | ✓ |
| 95 | `PRESETS` | sabet | حالت‌های آمادهٔ اندازه‌ها | claude-ui-buttons.js:150 | negahban_khata, sakht_panel_aa | 04 | `DEF` | ✓ |
| 96 | `esm_ghadim_tanzim` | sabet | اسمِ قدیمِ دو تنظیم ⇐ اسمِ تازه؛ مقدارِ ذخیره‌شده با اسمِ قدیم خوانده می‌شود | claude-ui-buttons.js:172 | khandan_tanzim, tanzim_pishfarz | 10 | `DEF` | ✓ |
| 97 | `CSS` | sabet | همهٔ قاعده‌های ظاهرِ پنل که به صفحه تزریق می‌شوند | claude-ui-buttons.js:231 | dokme_ha, sakht_hame, vazhe_name_ru_kalame | 04 | — | ✓ |
| 98 | `HOVER_DELAY` | sabet | کجا: پیام‌های جمع‌شده · چیه: موس چند میلی‌ثانیه روی پیام بماند تا باز شود · مثال: ⟦HOVER_DELAY⟧ | claude-ui-buttons.js:608 | baz_shodan_ba_hover, radif_andaze | 04 | — | ✓ |
| 99 | `GLOSS_DELAY` | sabet | کجا: اسم‌های واژه‌نامه در چت · چیه: موس چند میلی‌ثانیه بماند تا کارتِ معنی بیاید · مثال: ⟦GLOSS_DELAY⟧ | claude-ui-buttons.js:752 | bastan_panel, vazhe_name_ru_kalame | 06 | — | ✓ |
| 100 | `counterTimer` | vaziat | زمان‌سنجِ شمارندهٔ «نویسه»؛ فقط وقتی شمارنده روشن است | claude-ui-buttons.js:1108 | menu_naghl, shomarande_nevise | 04 | `usageCache`, `usageTick` | ✓ |
| 101 | `usageCache` | vaziat | آخرین متنِ مصرفِ کانتکست که کنارِ «نویسه» می‌آید | claude-ui-buttons.js:1108 | menu_naghl, shomarande_nevise_tik | 04 | `counterTimer` | ✓ |
| 102 | `usageTick` | vaziat | شمارِ معکوس تا گشتنِ دوبارهٔ متنِ مصرف (گران است، هر چند ثانیه یک بار) | claude-ui-buttons.js:1108 | menu_naghl, shomarande_nevise, shomarande_nevise_tik | 04 | `counterTimer` | ✓ |
| 103 | `FILE_NAME` | sabet | اسمِ فایلِ تنظیم‌هایی که پنل ذخیره و بار می‌کند | claude-ui-buttons.js:1295 | emal_tanzim_vared_shode, neveshtan_yaddasht_panel | 04 | `DEF` | ✓ |
| 104 | `DRAG_PX` | sabet | کجا: دکمه‌های نوارِ بالا · چیه: کمتر از این حرکت کلیک است، بیشتر کشیدن · مثال: ⟦DRAG_PX⟧ پیکسل | claude-ui-buttons.js:1386 | ejraye_dokme, keshidan_navar_bala, keshidan_tik_hads, sakht_hame | 02 | — | ✓ |
| 105 | `topWatch` | vaziat | نگهبانِ نوارِ بالا که بعد از عوض شدنِ چت دوباره می‌سازدش | claude-ui-buttons.js:1473 | bardashtan_jaygozin, payesh_navar_bala | 02 | — | ✓ |
| 106 | `draftCommands` | vaziat | متنِ ذخیره‌نشدهٔ ویرایشگرِ JSON ِ دکمه‌ها | claude-ui-buttons.js:1526 | emal_tanzim_vared_shode, keshidan_navar_bala, sakht_dokme_kenar, sakht_panel_aa | 02 | `DEFAULT_COMMANDS` | ✓ |
| 107 | `draftProfileName` | vaziat | اسمِ پروفایلی که تایپ شده و هنوز ذخیره نشده | claude-ui-buttons.js:1527 | sakht_dokme_kenar, sakht_panel_aa | 04 | — | ✓ |
| 108 | `NESHANE_AMAR` | sabet | همان neshane_amar ِ مود، در صفحه: خطِ پنهانِ دادهٔ جدولِ «تماس‌ها» را پیدا می‌کند | claude-ui-buttons.js:2263 | jadval_tamas, neshan_hook_va_hads | 19 | `neshane_amar` | ؟ |
| 109 | `KELID_JA_AMAR` | sabet | کلیدِ localStorage که جای جدولِ «تماس‌ها» را نگه می‌دارد | claude-ui-buttons.js:2263 | jadval_tamas, neshan_hook_va_hads | 19 | `ja_kuchak_amar` | ؟ |
| 110 | `sotun_amar` | sabet | ستون‌های جدولِ «تماس‌ها» و اسمِ فارسیِ هر کدام | claude-ui-buttons.js:2264 | jadval_bozorg, jadval_kuchak, neshan_hook_va_hads | 19 | `radif_amar` | ؟ |
| 111 | `radif_amar` | sabet | ردیف‌های جدولِ «تماس‌ها»: ۱ ساعت، ۲۴ ساعت، کل | claude-ui-buttons.js:2266 | jadval_bozorg, jadval_kuchak, neshan_hook_va_hads | 19 | `sotun_amar` | ؟ |
| 112 | `amar_matn_akhar` | vaziat | آخرین دادهٔ کشیده‌شده؛ بی‌تغییر دوباره کشیده نمی‌شود | claude-ui-buttons.js:2267 | amar_bozorgi, jadval_tamas, neshan_hook_va_hads | 19 | — | ؟ |
| 113 | `amar_bozorg` | vaziat | جدولِ «تماس‌ها» در حالتِ بزرگ است | claude-ui-buttons.js:2267 | amar_bozorgi, jadval_tamas, neshan_hook_va_hads | 19 | `ja_kuchak_amar` | ؟ |
| 114 | `ja_kuchak_amar` | vaziat | جای جدولِ کوچک پیش از بزرگ شدن، تا × یا کلیکِ بیرون آن را همان‌جا برگرداند | claude-ui-buttons.js:2267 | amar_bozorgi, neshan_hook_va_hads | 19 | `amar_bozorg`, `KELID_JA_AMAR` | ؟ |
| 115 | `amar_dar_rah` | vaziat | یک رسمِ دوبارهٔ جدول در فریمِ بعد در راه است (دو تا پشتِ هم نه) | claude-ui-buttons.js:2381 | jadval_tamas | 19 | — | ؟ |
| 116 | `tries` | sabet | چند بار صفحه برای سوار شدنِ پنل گشته شد | claude-ui-buttons.js:2391 | jadval_tamas | 04 | `timer` | ✓ |
| 117 | `timer` | vaziat | زمان‌سنجِ همان گشتن | claude-ui-buttons.js:2392 | baz_shodan_ba_hover, jadval_tamas, menu_naghl, vazhe_name_ru_kalame | 04 | `tries` | ✓ |
| 118 | `gorooh_hook` | sabet | نوع‌های پیامِ هوک که بعد از ریلود از فایلِ چت دوباره به صفحه داده می‌شوند | claude-host-hook.js:254 | khat_ha_ye_hook_dar_file, sakht_khat_hook | 11 | `neshane_hook` | ✓ |
| 119 | `neshane_hook` | sabet | بایت‌های نشانِ خطِ هوک در فایلِ چت؛ فایل تکه‌تکه گشته می‌شود، نه یک‌جا | claude-host-hook.js:267 | khat_ha_ye_hook_dar_file, masir_transcript | 11 | `gorooh_hook` | ✓ |
