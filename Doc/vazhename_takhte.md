# واژه‌نامهٔ تابلو — آدرسِ هر متغیر در کد

حبیب ۲۳ نوامبر ۲۰۲۶ ۱۵:۴۸: «اگه راه اصولیش اینه انجام بدید» — آدرس‌ها از `jaye` ِ شناسنامه به این فایل آمدند، **بدونِ دست‌زدن به کد** (الگوی ۹۱).

| | |
|---|---|
| **آدرسِ تعریف** | `136th-day-fix-rtl-claude · Doc/vazhename_takhte.md` |
| **آدرسِ کد** | خواننده: `build-glossary.py` (تابعِ `locations`) ⇒ فیلدِ `loc` در همان JSON که کارتِ هاور می‌خواند |
| **آدرسِ داده** | منبع: `Doc/shenasname_motaghayerha.toml` (فیلدِ `jaye`) |

**قالب:** هر خطی که `☑` دارد خوانده می‌شود؛ بعد از `☑` اسمِ متغیر و بعد آدرس‌ها داخلِ بک‌تیک، با `؛` جدا. مسیرها **نسبت به ریشهٔ پروژه**‌اند و کارت خودش ریشه را جلویشان می‌گذارد.

**چرا این فایل جداست:** `jaye` در شناسنامه هم می‌ماند (منبعِ ساخت)، ولی کارت آن را نمی‌خواند؛ این فایل شکلِ استانداردِ ۹۱ را دارد. **دستی عوض نکن** — با `python3 Doc/abzar/jadval_motaghayer.py` ساخته می‌شود.

**مسیرها:** فایل‌های داخلِ مخزن نسبت به ریشه‌اند؛ فایل‌های بیرونِ مخزن (اپِ ۱۸۶) **مطلق** نوشته می‌شوند، چون کارت مسیرِ مطلق را خودش می‌شناسد (کامیتِ `49a2385`).

| متغیر | یعنی | فایل:خط |
|---|---|---|
| `model_do_jomle_va_hads` | کجا: مودِ حدس · چیه: مدلی که «دو جمله» و حدسِ پشتیبان (وقتی fork نمی‌شود) با آن ساخته می‌شود · مثال: sonnet | ☑ model_do_jomle_va_hads: `mods/hads/hooks/register.js:7` |
| `hads_har_chand_javab` | کجا: آخرِ هر جواب · چیه: حدس و روند و نکرده و خودکار و کرون هر چند جواب یک بار ساخته شوند · مثال: هر 3 جواب یک fork | ☑ hads_har_chand_javab: `mods/hads/hooks/register.js:9` |
| `tedad_javab_har_chat` | چند جواب در هر چت دیده شده، از بالا آمدنِ همین پروسه؛ برای «هر چند جواب یک بار» | ☑ tedad_javab_har_chat: `mods/hads/hooks/register.js:11` |
| `hads_akhar` | آخرین حدس‌هایی که کادر نشان می‌دهد | ☑ hads_akhar: `mods/hads/hooks/register.js:14` |
| `nakarde_akhar` | آخرین «نکرده»‌ها (خواسته‌های حبیب که هنوز انجام نشده)، برای کادر | ☑ nakarde_akhar: `mods/hads/hooks/register.js:26` |
| `nakarde_ba_sanad_akhar` | «نکرده»‌هایی که سندشان (فایل یا commit) نشان داد انجام شده؛ در یک خطِ کوچک شمرده می‌شوند | ☑ nakarde_ba_sanad_akhar: `mods/hads/hooks/register.js:29` |
| `nakarde_ba_sanad_baz` | خطِ «با سند کنار رفت» باز است یا بسته | ☑ nakarde_ba_sanad_baz: `mods/hads/hooks/register.js:30` |
| `khodkar_akhar` | آخرین «خودکار»ها: کاری که ایجنت خودش با ابزارش می‌تواند بکند به‌جای پرسیدن از حبیب | ☑ khodkar_akhar: `mods/hads/hooks/register.js:34` |
| `cron_akhar` | آخرین «کرون‌جاب»‌ها: کارهای تکراری که حبیب گفت و به اجرای خودکار سرِ وقت می‌خورند | ☑ cron_akhar: `mods/hads/hooks/register.js:35` |
| `hads_baraye_chat` | حدس‌ها مالِ کدام چت‌اند؛ بعد از /clear (چتِ تازه) نشان داده نمی‌شوند | ☑ hads_baraye_chat: `mods/hads/hooks/register.js:37` |
| `do_jomle_fasele_ms` | کجا: وسطِ کار، بعد از هر ابزار · چیه: کمترین فاصلهٔ دو «دو جمله» · مثال: هر 60000 میلی‌ثانیه حداکثر یکی | ☑ do_jomle_fasele_ms: `mods/hads/hooks/register.js:41` |
| `had_fork_context_token` | کجا: آخرِ جواب · چیه: اگر چت از این بزرگ‌تر باشد fork گران است و Sonnet روی پیام‌های آخر کار می‌کند · مثال: بیش از 400000 توکن | ☑ had_fork_context_token: `mods/hads/hooks/register.js:43` |
| `cache_sard_ms` | کجا: «پرسش» · چیه: بیکاریِ بیش از این یعنی کشِ چت احتمالاً سرد شده و «پرسش» اول هشدار می‌دهد (کشِ یک‌ساعته) | ☑ cache_sard_ms: `mods/hads/hooks/register.js:45` |
| `cache_sard_5m_ms` | همان، وقتی کشِ چت پنج‌دقیقه‌ای است | ☑ cache_sard_5m_ms: `mods/hads/hooks/register.js:46` |
| `cache_sard_bad_az_ms` | کدام یک از دو بالایی الان به کار می‌رود (بسته به کشِ چت) | ☑ cache_sard_bad_az_ms: `mods/hads/hooks/register.js:47` |
| `prompt_system_do_jomle` | دستورِ Sonnet برای «دو جمله»: دو جملهٔ ساده که ایجنت الان چه می‌کند و منتظرِ چیست، با واژه‌نامهٔ حبیب | ☑ prompt_system_do_jomle: `mods/hads/hooks/register.js:48` |
| `do_jomle_akhar` | آخرین «دو جمله» و چتش | ☑ do_jomle_akhar: `mods/hads/hooks/register.js:53` |
| `do_jomle_dar_kar` | یک «دو جمله» در راه است | ☑ do_jomle_dar_kar: `mods/hads/hooks/register.js:54` |
| `do_jomle_dobare` | وقتی یکی در راه بود، یکی دیگر خواسته شد؛ بعدش ساخته می‌شود | ☑ do_jomle_dobare: `mods/hads/hooks/register.js:55` |
| `zaman_do_jomle_akhar` | ساعتِ آخرین «دو جمله»، برای فاصلهٔ 60000 | ☑ zaman_do_jomle_akhar: `mods/hads/hooks/register.js:56` |
| `zaman_akhar_javab` | ساعتِ آخرین پایانِ جواب؛ پایانِ جواب بر «دو جمله»ٔ وسطِ کار که دیرتر رسید می‌چربد | ☑ zaman_akhar_javab: `mods/hads/hooks/register.js:58` |
| `akhar_javab_dar_kar` | کارِ آخرِ جواب در راه است | ☑ akhar_javab_dar_kar: `mods/hads/hooks/register.js:59` |
| `akhar_javab_dobare` | جوابی وسطِ کارِ قبلی تمام شد؛ بعدش انجام می‌شود، گم نمی‌شود | ☑ akhar_javab_dobare: `mods/hads/hooks/register.js:61` |
| `zaman_akharin_kar` | آخرین باری که خودِ چت با مدل حرف زد؛ سنِ کش | ☑ zaman_akharin_kar: `mods/hads/hooks/register.js:63` |
| `cache_sard_shod` | Claude Code خودش بعد از resume گفت کش رفته | ☑ cache_sard_shod: `mods/hads/hooks/register.js:65` |
| `porsesh_montazer` | «پرسش»ی که پیش از آماده بودنِ fork آمد؛ آخرِ جوابِ بعدی خودش پرسیده می‌شود | ☑ porsesh_montazer: `mods/hads/hooks/register.js:68` |
| `javab_porsesh` | جوابِ آخرین «پرسش» (fork با کشِ گرم)؛ هرگز به چت نمی‌رود | ☑ javab_porsesh: `mods/hads/hooks/register.js:70` |
| `matn_porsesh` | متنی که حبیب در جعبهٔ «پرسش» نوشته | ☑ matn_porsesh: `mods/hads/hooks/register.js:71` |
| `prompt_ha` | پرومپت‌های ذخیره‌شدهٔ «پرسش» (همهٔ چت‌ها یکی، در فایل) | ☑ prompt_ha: `mods/hads/hooks/register.js:76` |
| `prompt_entekhab_har_chat` | کدام پرومپت در هر چت روشن است | ☑ prompt_entekhab_har_chat: `mods/hads/hooks/register.js:77` |
| `prompt_virayesh` | پرومپتی که الان با ✎ در حالِ ویرایش است | ☑ prompt_virayesh: `mods/hads/hooks/register.js:78` |
| `system_reminder_regex` | الگوی بخش‌های system-reminder که از متنِ پیام‌ها کنار گذاشته می‌شوند | ☑ system_reminder_regex: `mods/hads/hooks/register.js:93` |
| `matn_bi_harfe_habib` | وقتی نوبت با پیامِ خودِ حبیب شروع نشده (کار، چتِ دیگر، Continue)، به‌جای «خواستهٔ حبیب» این می‌آید | ☑ matn_bi_harfe_habib: `mods/hads/hooks/register.js:98` |
| `prompt_fork_do_jomle` | تکهٔ دستورِ fork برای «دو جمله»؛ فقط بخش‌های روشن خواسته می‌شوند | ☑ prompt_fork_do_jomle: `mods/hads/hooks/register.js:133` |
| `prompt_fork_hads` | تکهٔ دستورِ fork برای حدس | ☑ prompt_fork_hads: `mods/hads/hooks/register.js:134` |
| `abzar_ha_ye_claude_code` | فهرستِ کاملِ ابزارهای ایجنت در Claude Code، برای «خودکار» (از سندِ رسمی) | ☑ abzar_ha_ye_claude_code: `mods/hads/hooks/register.js:165` |
| `prompt_fork_khodkar` | تکهٔ دستورِ fork برای «خودکار» | ☑ prompt_fork_khodkar: `mods/hads/hooks/register.js:200` |
| `prompt_fork_cron` | تکهٔ دستورِ fork برای «کرون‌جاب» | ☑ prompt_fork_cron: `mods/hads/hooks/register.js:236` |
| `ghaede_cron` | قاعده‌های «کرون‌جاب» در دستورِ fork | ☑ ghaede_cron: `mods/hads/hooks/register.js:237` |
| `had_kamtarin_harf_sanad` | کجا: سندِ «نکرده» · چیه: متنِ سند کوتاه‌تر از این چک حساب نمی‌شود · مثال: کمتر از 8 حرف | ☑ had_kamtarin_harf_sanad: `mods/hads/hooks/register.js:262` |
| `nakarde_anjam_har_chat` | «نکرده»‌هایی که حبیب در هر چت خودش «✓ انجام شد» زد | ☑ nakarde_anjam_har_chat: `mods/hads/hooks/register.js:423` |
| `gheymat_cache_neveshtan_usd` | دلار برای هر میلیون توکنِ نوشتنِ کش (پنج‌دقیقه‌ای و یک‌ساعته)، برای هشدارِ «پرسش» با کشِ سرد | ☑ gheymat_cache_neveshtan_usd: `mods/hads/hooks/register.js:465` |
| `had_ghablia_tedad` | کجا: «قبلی‌ها» · چیه: چند «دو جمله»ٔ قبلی نگه داشته و نشان داده شود · مثال: 50 تای آخر | ☑ had_ghablia_tedad: `mods/hads/hooks/register.js:474` |
| `do_jomle_akhar_dar_daftar` | آخرین «دو جمله» که در دفتر نوشته شد، برای هر چت (یک پروسه چند چت می‌تواند داشته باشد) | ☑ do_jomle_akhar_dar_daftar: `mods/hads/hooks/register.js:506` |
| `hads_zade_shode` | حدس‌هایی که در کادرِ نوشتن گذاشته شدند، تا با Enter معلوم شود کدام رفت | ☑ hads_zade_shode: `mods/hads/hooks/register.js:508` |
| `do_jomle_ha_ye_nobat` | همهٔ «دو جمله»‌های نوبتِ در جریان، برای جمع‌بندیِ آخرِ جواب | ☑ do_jomle_ha_ye_nobat: `mods/hads/hooks/register.js:511` |
| `mah_miladi` | اسمِ کوتاهِ ماه‌های میلادی، مثلِ تاریخ‌نویسیِ حبیب («۲۴ اکت ۱۸:۵۷») | ☑ mah_miladi: `mods/hads/hooks/register.js:523` |
| `mah_shamsi` | اسمِ ماه‌های شمسی برای تاریخِ خطِ هوک‌ها (در مود و در وصلهٔ میزبان، دو جا) | ☑ mah_shamsi: `mods/hads/hooks/register.js:535`؛ `claude-host-hook.js:1011` |
| `had_do_jomle_harf` | کجا: «دو جمله» · چیه: بیشترین حرف · مثال: بلندتر از 300 حرف با … کوتاه می‌شود | ☑ had_do_jomle_harf: `mods/hads/hooks/register.js:555` |
| `had_tamas_riz` | کجا: حالتِ بزرگِ جدولِ «تماس‌ها» · چیه: چند تماسِ آخر ریز به ریز · مثال: 300 تای آخر | ☑ had_tamas_riz: `mods/hads/hooks/register.js:590` |
| `neshane_amar` | نشانهٔ اولِ خطِ پنهانی که دادهٔ جدولِ «تماس‌ها» را به صفحه می‌برد | ☑ neshane_amar: `mods/hads/hooks/register.js:591` |
| `amar_cache` | دادهٔ جدولِ «تماس‌ها» که چند ثانیه نگه داشته می‌شود تا هر رسمِ کادر فایل را دوباره نخواند | ☑ amar_cache: `mods/hads/hooks/register.js:592` |
| `had_kamtarin_do_jomle_jambandi` | کجا: آخرِ جواب · چیه: با کمتر از این «دو جمله» در نوبت جمع‌بندی ساخته نمی‌شود · مثال: 1 | ☑ had_kamtarin_do_jomle_jambandi: `mods/hads/hooks/register.js:822` |
| `abzar_ha_ye_nobat` | ابزارهایی که در نوبتِ در جریان صدا زده شدند | ☑ abzar_ha_ye_nobat: `mods/hads/hooks/register.js:824` |
| `khaste_habib_nobat` | پیامِ خودِ حبیب که نوبت را شروع کرد | ☑ khaste_habib_nobat: `mods/hads/hooks/register.js:826` |
| `khodkar_ferestade_har_chat` | «خودکار»ها و «نکرده»‌هایی که به چت فرستاده شدند، با شمارِ هر کار | ☑ khodkar_ferestade_har_chat: `mods/hads/hooks/register.js:1133` |
| `baraye_ferestadan_har_chat` | «خودکار»هایی که در صفِ فرستادن به چت‌اند | ☑ baraye_ferestadan_har_chat: `mods/hads/hooks/register.js:1134` |
| `had_ferestadan_kar` | کجا: «خودکار» · چیه: یک کار چند بار به چت برود؛ بارِ آخر با درخواستِ کمک از حبیب، بعدش دیگر نه · مثال: 3 بار | ☑ had_ferestadan_kar: `mods/hads/hooks/register.js:1151` |
| `matn_bar_sevom` | متنی که بارِ آخرِ فرستادنِ یک کار اضافه می‌شود: «اول به زبانِ ساده به حبیب توضیح بده و کمک بخواه» | ☑ matn_bar_sevom: `mods/hads/hooks/register.js:1152` |
| `matn_porsesh_montazer` | پیامِ کادر وقتی «پرسش» باید تا جوابِ بعدی صبر کند | ☑ matn_porsesh_montazer: `mods/hads/hooks/register.js:1326` |
| `matn_dalil_bi_javab` | دلیلِ ساده‌ای که کادر وقتی fork جواب نداد نشان می‌دهد | ☑ matn_dalil_bi_javab: `mods/hads/hooks/register.js:1327` |
| `had_harf_dokme_prompt` | کجا: دکمه‌های پرومپتِ «پرسش» · چیه: بیشترین حرفِ روی دکمه · مثال: بلندتر از 18 حرف با … | ☑ had_harf_dokme_prompt: `mods/hads/hooks/register.js:1345` |
| `bakhsh_ha` | بخش‌های کادرِ حدس و اسمِ فارسیِ هر کدام (تیک‌ها) | ☑ bakhsh_ha: `mods/hads/hooks/register.js:1436` |
| `esm_bakhsh` | همان، به شکلِ جدولِ اسم ⇐ واژه | ☑ esm_bakhsh: `mods/hads/hooks/register.js:1439` |
| `dayere_ha` | دایره‌های سرچِ حافظه: همین چت، همین پروژه، همهٔ پروژه‌ها | ☑ dayere_ha: `mods/hads/hooks/register.js:1444` |
| `esm_dayere` | اسمِ فارسیِ هر دایره | ☑ esm_dayere: `mods/hads/hooks/register.js:1445` |
| `dayere_har_chat` | دایرهٔ سرچِ حافظه برای هر چت | ☑ dayere_har_chat: `mods/hads/hooks/register.js:1448` |
| `akharin_zakhire` | آخرین وضعی که برای هر چت در فایل نوشته شد (حدس‌ها، نکرده‌ها …)، برای برگرداندن بعد از ریلود | ☑ akharin_zakhire: `mods/hads/hooks/register.js:1487` |
| `akharin_bargashte` | چت‌هایی که وضعشان بعد از ریلود یک بار برگردانده شد | ☑ akharin_bargashte: `mods/hads/hooks/register.js:1494` |
| `kalame_khamush` | کلمهٔ هر بخشِ خاموش در فایلِ چت (مثلِ -hads)؛ کامل نوشته شده تا با grep پیدا شود | ☑ kalame_khamush: `mods/hads/hooks/register.js:1538` |
| `kalame_tanzim` | کلمه‌های دیگرِ فایلِ چت: حالتِ کادر و تنظیم‌ها | ☑ kalame_tanzim: `mods/hads/hooks/register.js:1539` |
| `ghablia_baz` | «قبلی‌ها» باز است | ☑ ghablia_baz: `mods/hads/hooks/register.js:1571` |
| `had_hook_transcript_khat` | کجا: «هوک‌ها» · چیه: چند خطِ آخرِ فایلِ چت برای پیدا کردنِ هوک‌ها خوانده شود · مثال: 400 خط | ☑ had_hook_transcript_khat: `mods/hads/hooks/register.js:1579` |
| `had_hook_transcript_byte` | همان، به بایت: بیش از این از تهِ فایل خوانده نمی‌شود | ☑ had_hook_transcript_byte: `mods/hads/hooks/register.js:1580` |
| `hook_transcript_grep` | الگوی خط‌های هوک در فایلِ چت | ☑ hook_transcript_grep: `mods/hads/hooks/register.js:1581` |
| `had_hook_kuchak_harf` | کجا: «هوک‌ها» · چیه: بیشترین حرفِ هر خطِ کوچک · مثال: 100 حرف | ☑ had_hook_kuchak_harf: `mods/hads/hooks/register.js:1583` |
| `masir_transcript` | مسیرِ فایلِ چتِ همین چت | ☑ masir_transcript: `mods/hads/hooks/register.js:1584` |
| `hook_ha` | هوک‌هایی که برای کادر خوانده شد، و چتش | ☑ hook_ha: `mods/hads/hooks/register.js:1585` |
| `zaman_khandan_hook` | ساعتِ آخرین خواندنِ هوک‌ها | ☑ zaman_khandan_hook: `mods/hads/hooks/register.js:1586` |
| `had_hook_kuchak_radif` | کجا: «هوک‌ها» · چیه: چند هوکِ آخر در حالتِ کوچک · مثال: 6 ردیف | ☑ had_hook_kuchak_radif: `mods/hads/hooks/register.js:1623` |
| `had_hook_bozorg_radif` | همان در حالتِ بزرگ | ☑ had_hook_bozorg_radif: `mods/hads/hooks/register.js:1624` |
| `had_hook_bozorg_harf` | بیشترین حرفِ هر هوک در حالتِ بزرگ | ☑ had_hook_bozorg_harf: `mods/hads/hooks/register.js:1625` |
| `ERRORS` | خطاهای خودِ اسکریپتِ صفحه، برای دکمهٔ «تست» ِ پنل | ☑ ERRORS: `claude-ui-buttons.js:22` |
| `SESSION` | چتِ این برگه: شناسه، اسم، تیتر (بعد از /clear یا resume عوض می‌شود) | ☑ SESSION: `claude-ui-buttons.js:37`؛ `abzar/216-migration/scripts/opencode_gateway.py:38` |
| `DEFAULT_COMMANDS` | دکمه‌های پیش‌فرضِ نوارِ بالا | ☑ DEFAULT_COMMANDS: `claude-ui-buttons.js:145` |
| `KEY` | کلیدِ localStorage ِ تنظیم‌های پنل | ☑ KEY: `claude-ui-buttons.js:206`؛ `abzar/216-migration/scripts/opencode_gateway.py:96`؛ `abzar/216-migration/scripts/opencode_picker.py:29` |
| `DEF` | تنظیم‌های پیش‌فرضِ پنل (اندازه‌ها، رنگ، روشن/خاموش‌ها) | ☑ DEF: `claude-ui-buttons.js:207` |
| `LIMITS` | کمترین و بیشترینِ هر اندازه در پنل | ☑ LIMITS: `claude-ui-buttons.js:234` |
| `PRESETS` | حالت‌های آمادهٔ اندازه‌ها | ☑ PRESETS: `claude-ui-buttons.js:235` |
| `esm_ghadim_tanzim` | اسمِ قدیمِ دو تنظیم ⇐ اسمِ تازه؛ مقدارِ ذخیره‌شده با اسمِ قدیم خوانده می‌شود | ☑ esm_ghadim_tanzim: `claude-ui-buttons.js:257` |
| `CSS` | همهٔ قاعده‌های ظاهرِ پنل که به صفحه تزریق می‌شوند | ☑ CSS: `claude-ui-buttons.js:335` |
| `HOVER_DELAY` | کجا: پیام‌های جمع‌شده · چیه: موس چند میلی‌ثانیه روی پیام بماند تا باز شود · مثال: 700 | ☑ HOVER_DELAY: `claude-ui-buttons.js:806` |
| `GLOSS_DELAY` | کجا: اسم‌های واژه‌نامه در چت · چیه: موس چند میلی‌ثانیه بماند تا کارتِ معنی بیاید · مثال: 600 | ☑ GLOSS_DELAY: `claude-ui-buttons.js:1007` |
| `counterTimer` | زمان‌سنجِ شمارندهٔ «نویسه»؛ فقط وقتی شمارنده روشن است | ☑ counterTimer: `claude-ui-buttons.js:1421` |
| `usageCache` | آخرین متنِ مصرفِ کانتکست که کنارِ «نویسه» می‌آید | ☑ usageCache: `claude-ui-buttons.js:1421` |
| `usageTick` | شمارِ معکوس تا گشتنِ دوبارهٔ متنِ مصرف (گران است، هر چند ثانیه یک بار) | ☑ usageTick: `claude-ui-buttons.js:1421` |
| `FILE_NAME` | اسمِ فایلِ تنظیم‌هایی که پنل ذخیره و بار می‌کند | ☑ FILE_NAME: `claude-ui-buttons.js:1608` |
| `DRAG_PX` | کجا: دکمه‌های نوارِ بالا · چیه: کمتر از این حرکت کلیک است، بیشتر کشیدن · مثال: 5 پیکسل | ☑ DRAG_PX: `claude-ui-buttons.js:1774` |
| `topWatch` | نگهبانِ نوارِ بالا که بعد از عوض شدنِ چت دوباره می‌سازدش | ☑ topWatch: `claude-ui-buttons.js:1861` |
| `draftCommands` | متنِ ذخیره‌نشدهٔ ویرایشگرِ JSON ِ دکمه‌ها | ☑ draftCommands: `claude-ui-buttons.js:1914` |
| `draftProfileName` | اسمِ پروفایلی که تایپ شده و هنوز ذخیره نشده | ☑ draftProfileName: `claude-ui-buttons.js:1915` |
| `NESHANE_AMAR` | همان neshane_amar ِ مود، در صفحه: خطِ پنهانِ دادهٔ جدولِ «تماس‌ها» را پیدا می‌کند | ☑ NESHANE_AMAR: `claude-ui-buttons.js:3719` |
| `KELID_JA_AMAR` | کلیدِ localStorage که جای جدولِ «تماس‌ها» را نگه می‌دارد | ☑ KELID_JA_AMAR: `claude-ui-buttons.js:3719` |
| `sotun_amar` | ستون‌های جدولِ «تماس‌ها» و اسمِ فارسیِ هر کدام | ☑ sotun_amar: `claude-ui-buttons.js:3720` |
| `radif_amar` | ردیف‌های جدولِ «تماس‌ها»: ۱ ساعت، ۲۴ ساعت، کل | ☑ radif_amar: `claude-ui-buttons.js:3722` |
| `amar_matn_akhar` | آخرین دادهٔ کشیده‌شده؛ بی‌تغییر دوباره کشیده نمی‌شود | ☑ amar_matn_akhar: `claude-ui-buttons.js:3723` |
| `amar_bozorg` | جدولِ «تماس‌ها» در حالتِ بزرگ است | ☑ amar_bozorg: `claude-ui-buttons.js:3723` |
| `ja_kuchak_amar` | جای جدولِ کوچک پیش از بزرگ شدن، تا × یا کلیکِ بیرون آن را همان‌جا برگرداند | ☑ ja_kuchak_amar: `claude-ui-buttons.js:3723` |
| `amar_dar_rah` | یک رسمِ دوبارهٔ جدول در فریمِ بعد در راه است (دو تا پشتِ هم نه) | ☑ amar_dar_rah: `claude-ui-buttons.js:3838` |
| `timer` | زمان‌سنجِ همان گشتن | ☑ timer: `claude-ui-buttons.js:4115` |
| `gorooh_hook` | نوع‌های پیامِ هوک که بعد از ریلود از فایلِ چت دوباره به صفحه داده می‌شوند | ☑ gorooh_hook: `claude-host-hook.js:1081` |
| `neshane_hook` | بایت‌های نشانِ خطِ هوک در فایلِ چت؛ فایل تکه‌تکه گشته می‌شود، نه یک‌جا | ☑ neshane_hook: `claude-host-hook.js:1094` |
| `had_tedad_kamtarin_zaban_harf` | کجا: آخرِ جواب، بخشِ «زبان» · چیه: جوابِ کوتاه‌تر از این تعداد حرف (فارسی + لاتین، بی کد و لینک) سنجیده نمی‌شود · مثال: 40 | ☑ had_tedad_kamtarin_zaban_harf: `mods/hads/hooks/register.js:677` |
| `matn_yadavari_zaban` | متنی که «زبان» بعد از جوابِ انگلیسی به چت می‌فرستد تا مدل فارسی حرف بزند | ☑ matn_yadavari_zaban: `mods/hads/hooks/register.js:678` |
| `zaban_yadavari_shod` | برای هر چت: آیا همین الان یادآوریِ زبان فرستاده شد؛ اگر بله، جوابِ بعدی دوباره یادآوری نمی‌گیرد (حلقه نشود) | ☑ zaban_yadavari_shod: `mods/hads/hooks/register.js:764` |
| `matn_se_daste` | تکهٔ پرامپتِ «خودکار»: هر «منتظرِ شما / خودت وارد شو / کد را بفرست» ِ ایجنت در سه دسته سنجیده می‌شود: (الف) خودش، (ب) راه از ۲۰۳، (ج) فقط کارِ حبیب | ☑ matn_se_daste: `mods/hads/hooks/register.js:220` |
| `prompt_az_hads` | سرِ هر پرومپتِ ترجمه: این پیام از مود است نه از حبیب، و ابزاری صدا نزن | ☑ prompt_az_hads: `mods/hads/hooks/register.js:694` |
| `ghaede_tarjome` | قاعدهٔ ترجمهٔ جواب: قالب‌بندی و کد و فرمان دست‌نخورده، چیزی کم یا زیاد نشود | ☑ ghaede_tarjome: `mods/hads/hooks/register.js:696` |
| `had_tedad_tarjome_radif` | چند ترجمهٔ آخر در فایلِ tarjome.jsonl هر چت می‌ماند: 200 | ☑ had_tedad_tarjome_radif: `mods/hads/hooks/register.js:704` |
| `tarjome_kadr_dar_kar` | دکمهٔ «ترجمه به انگلیسی» در راه است؛ زدنِ دوباره کاری نمی‌کند | ☑ tarjome_kadr_dar_kar: `mods/hads/hooks/register.js:736` |
| `tarjome_ha` | ترجمه‌های همین چت، به کلیدِ اولِ متنِ جواب | ☑ tarjome_ha: `claude-ui-buttons.js:3850` |
| `tarjome_mt` | زمانِ آخرین نسخهٔ فایلِ ترجمه که رسید؛ میزبان فقط اگر عوض شده بفرستد | ☑ tarjome_mt: `claude-ui-buttons.js:3850` |
| `tarjome_sid` | ترجمه‌ها مالِ کدام چت‌اند؛ چت که عوض شد از نو گرفته می‌شوند | ☑ tarjome_sid: `claude-ui-buttons.js:3850` |
| `ravand_akhar` | روندهایی که الان در کادر نشان داده می‌شوند؛ هر کدام با حرف‌های عینیِ حبیب | ☑ ravand_akhar: `mods/hads/hooks/register.js:17` |
| `ravand_zade_shode` | متنِ روندهایی که دکمهٔ ⤵ آن‌ها زده شد؛ این متن‌ها حرفِ حبیب حساب نمی‌شوند تا روند خودش را تقویت نکند | ☑ ravand_zade_shode: `mods/hads/hooks/register.js:19` |
| `prompt_fork_ravand` | قالبی که فورک برای کلیدِ ravand باید برگرداند | ☑ prompt_fork_ravand: `mods/hads/hooks/register.js:238` |
| `payam_dastgah` | پیام‌هایی که از طرفِ کاربر می‌آیند ولی حرفِ حبیب نیستند (پلاگین، task-notification، ادامهٔ خودکار)؛ شاهدِ روند نمی‌شوند | ☑ payam_dastgah: `mods/hads/hooks/register.js:303` |
| `had_tedad_ravand_zade_radif` | کجا: «روند» · چیه: چند متنِ دکمهٔ زده‌شده برای هر چت نگه داشته شود تا شاهد نشود · مثال: 50 | ☑ had_tedad_ravand_zade_radif: `mods/hads/hooks/register.js:20` |
| `shekast_fork_har_chat` | برای هر چت: چند فورکِ پشتِ هم چیزِ به‌دردبخوری نداد | ☑ shekast_fork_har_chat: `mods/hads/hooks/register.js:22` |
| `had_tedad_shekast_fork_bar` | کجا: آخرِ جواب · چیه: بعد از این تعداد فورکِ بی‌نتیجهٔ پشتِ هم، فورکِ بعدی تا نوبتِ عادی‌اش صبر می‌کند · مثال: 2 | ☑ had_tedad_shekast_fork_bar: `mods/hads/hooks/register.js:23` |
| `payam_transcript_grep` | کجا: «روند» · چیه: دو شکلِ خطی که در فایلِ چت پیامِ تایپ‌شدهٔ حبیب است (پیامِ عادی و پیامی که وسطِ کار فرستاده) | ☑ payam_transcript_grep: `mods/hads/hooks/register.js:355` |
| `had_tedad_payam_transcript_khat` | کجا: «روند» · چیه: از فایلِ چت فقط این تعداد از آخرین پیام‌های حبیب خوانده می‌شود · مثال: 3000 | ☑ had_tedad_payam_transcript_khat: `mods/hads/hooks/register.js:356` |
| `had_tedad_hads_ghabli_khat` | چند حدسِ آخر به کپیِ چت داده می‌شود تا تکرارشان نکند: 12 | ☑ had_tedad_hads_ghabli_khat: `mods/hads/hooks/register.js:139` |
| `had_hads_ghabli_harf` | سقفِ حرفِ هر حدسِ قبلی که به کپیِ چت داده می‌شود: 200 | ☑ had_hads_ghabli_harf: `mods/hads/hooks/register.js:140` |
| `hads_ghabli_har_chat` | حدس‌های قبلیِ هر چت در حافظهٔ برنامه؛ با ریلود خالی می‌شود | ☑ hads_ghabli_har_chat: `mods/hads/hooks/register.js:141` |
| `had_tedad_payam_zakhire_khat` | سقفِ تعدادِ حرف‌های حبیب که برای هر چت نگه داشته می‌شود: 3000 | ☑ had_tedad_payam_zakhire_khat: `mods/hads/hooks/register.js:315` |
| `had_payam_zakhire_harf` | سقفِ جمعِ حرفِ پیام‌های نگه‌داشته‌شده، زیرِ محدودیتِ فایل: 1500000 | ☑ had_payam_zakhire_harf: `mods/hads/hooks/register.js:316` |
| `payam_zakhire_har_chat` | حرف‌های نگه‌داشته‌شدهٔ حبیب برای هر چت، در حافظهٔ برنامه | ☑ payam_zakhire_har_chat: `mods/hads/hooks/register.js:323` |
| `saf_payam_har_chat` | نوشتن‌های پشتِ سرِ همِ فایلِ حرف‌های حبیب برای هر چت، تا روی هم نیفتند | ☑ saf_payam_har_chat: `mods/hads/hooks/register.js:324` |
| `had_kelid_ravand_kamtarin_harf` | نقلِ کوتاه‌تر از 20 حرف به‌تنهایی روندِ تازه را نمی‌بندد؛ این مرز را ایجنت انتخاب کرده و از داده نیامده | ☑ had_kelid_ravand_kamtarin_harf: `mods/hads/hooks/register.js:1164` |
| `matn_vazhe_nasanjide` | کجا: پرامپتِ «خودکار» · چیه: کلمه‌هایی مثلِ «نسنجیدم» و «حدسم» را در جوابِ ایجنت می‌گردد و با نگاه به معنی، برای آنچه باز است خودکار می‌سازد | ☑ matn_vazhe_nasanjide: `mods/hads/hooks/register.js:216` |
| `TZ` | کجا: تبِ تنظیمات کلود · چیه: وضعیتِ تب بیرون از پنل، تا با ساختنِ دوبارهٔ پنل گم نشود: کدام تب باز است، آخرین جوابِ میزبان، ردیف‌ها | ☑ TZ: `claude-ui-buttons.js:39` |
| `SOAL_SABR_MS` | کجا: پنجرهٔ سؤال · چیه: کلیک روی متنِ یک جواب این‌قدر صبر می‌کند تا اگر کلیکِ دوم آمد، جواب زده نشود و فقط کلمه انتخاب شود · مثال: 250 میلی‌ثانیه | ☑ SOAL_SABR_MS: `claude-ui-buttons.js:1723` |
| `TZ_BALA` | کجا: تبِ تنظیمات کلود · چیه: شش تنظیمی که بالای تب می‌آیند: افورت، مدل، ریموت کنترل، اولتراکد، اتوکامپکت | ☑ TZ_BALA: `claude-ui-buttons.js:2423` |
| `TZ_NOSKHE_PISH` | کجا: تبِ تنظیمات کلود · چیه: نسخه‌ای که پیش‌فرض‌های فهرست روی آن سنجیده شد، وقتی مهرِ ~/.claude/crtl_pish_sanjide.json هنوز نیست · مثال: روشن (پیش‌فرض نسخهٔ 2.1.318) | ☑ TZ_NOSKHE_PISH: `claude-ui-buttons.js:2967` |
| `TZ_CHROME` | کجا: تبِ تنظیمات کلود · چیه: کلیدِ افزونهٔ کروم (همان نوارِ Browser connected)؛ در settings.json نیست و در ~/.claude.json است، پس در تب جدا خوانده و با خودِ اپ نوشته می‌شود · مثال: سراسری خاموش و همین چت روشن | ☑ TZ_CHROME: `claude-ui-buttons.js:2422` |
| `TZ_SATH` | کجا: هر ردیفِ تب · چیه: سه تیک به ترتیب: سراسری، پروژه، چت | ☑ TZ_SATH: `claude-ui-buttons.js:2424` |
| `TZ_ESM_SATH` | کجا: نوشتهٔ «الان» زیرِ هر ردیف · چیه: اسمِ فارسیِ هر سطح | ☑ TZ_ESM_SATH: `claude-ui-buttons.js:2425` |
| `TZ_ESM_MANBA` | کجا: نوشتهٔ «الان» زیرِ هر ردیف · چیه: وقتی مقدار از انبار نیست، اسمِ فارسیِ لایه‌ای که خودِ کلود گزارش می‌کند | ☑ TZ_ESM_MANBA: `claude-ui-buttons.js:2426` |
| `TZ_FASELE_TOKEN` | کجا: ردیفِ اتوکامپکت · چیه: کلود این‌قدر زودتر از پنجره‌اش کامپکت می‌کند، پس عددی که حبیب می‌نویسد با این جمع می‌شود · مثال: ⟦TZ_FASELE_TOKEN⟧ توکن؛ سنجیده روی 2.1.318 | ☑ TZ_FASELE_TOKEN: `claude-ui-buttons.js:2427` |
| `TZ_REMEMBER_TOKEN` | کجا: راهنمای زیرِ ردیفِ اتوکامپکت · چیه: رممبر این‌قدر پیش از کامپکت می‌آید · مثال: ⟦TZ_REMEMBER_TOKEN⟧ توکن | ☑ TZ_REMEMBER_TOKEN: `claude-ui-buttons.js:2428` |
| `UPSTREAM` | کجا: دروازه · چیه: آدرسِ پایهٔ اوپن‌کد که پیام‌ها به آن می‌رود · مثال: پیامِ کلود کد به https://opencode.ai/inference/go می‌رسد | ☑ UPSTREAM: `abzar/216-migration/scripts/opencode_gateway.py:30` |
| `PREFIX` | کجا: دروازه · چیه: پیشوندِ دورهٔ اولِ شناسهٔ مدل‌ها؛ دروازه پیش از فرستادن برشش می‌دهد · مثال: claude-oc-deepseek-v4.1-flash ⇒ deepseek-v4.1-flash | ☑ PREFIX: `abzar/216-migration/scripts/opencode_gateway.py:31` |
| `SERVICE` | کجا: دروازه و رَپر · چیه: نامِ سرویس در Keychain که کلیدِ اوپن‌کد زیرِ آن است · مقدار هرگز خوانده یا نوشته نمی‌شود | ☑ SERVICE: `abzar/216-migration/scripts/opencode_gateway.py:32`؛ `abzar/216-migration/scripts/vscode_opencode_wrapper.py:30` |
| `ACCOUNT` | کجا: دروازه و رَپر · چیه: حسابِ همان سرویس در Keychain (کدام هارنس) · مثال: windsurf | ☑ ACCOUNT: `abzar/216-migration/scripts/opencode_gateway.py:33`؛ `abzar/216-migration/scripts/vscode_opencode_wrapper.py:31` |
| `PORT` | کجا: دروازه، رَپر و پیکر · چیه: پورتِ محلیِ دروازه که هر سه یکی است · مثال: 127.0.0.1:⟦PORT⟧ | ☑ PORT: `abzar/216-migration/scripts/opencode_gateway.py:34`؛ `abzar/216-migration/scripts/vscode_opencode_wrapper.py:36`؛ `abzar/216-migration/scripts/opencode_picker.py:27` |
| `RUNTIME` | کجا: دروازه · چیه: پوشهٔ دادهٔ دروازه (فایلِ مصرف، سقف، وضعیت، کشِ مدل‌ها) · مثال: ⟦RUNTIME⟧/usage.jsonl | ☑ RUNTIME: `abzar/216-migration/scripts/opencode_gateway.py:35` |
| `USAGE` | کجا: دروازه · چیه: فایلِ مصرف؛ هر درخواست یک ردیف با provider و مدل و هزینه و زمان‌ها · مثال: ⟦USAGE⟧ | ☑ USAGE: `abzar/216-migration/scripts/opencode_gateway.py:36` |
| `CAPS` | کجا: دروازه · چیه: فایلِ سقفِ ماهانهٔ هر مدل که از کنسولِ اوپن‌کد خوانده می‌شود · مثال: ⟦CAPS⟧ | ☑ CAPS: `abzar/216-migration/scripts/opencode_gateway.py:37` |
| `DROP` | کجا: دروازه · چیه: هدرهایی که پیش از فرستادن به اوپن‌کد حذف می‌شوند (کلیدِ آنتروپیک و همانندها) · مثال: x-api-key همیشه می‌افتد | ☑ DROP: `abzar/216-migration/scripts/opencode_gateway.py:39` |
| `TRACE_STATE` | کجا: دروازه · چیه: فایلِ وضعیتِ پروکسیِ اوپن‌روتر که توکنِ محلی از آن خوانده می‌شود · مثال: ⟦TRACE_STATE⟧ | ☑ TRACE_STATE: `abzar/216-migration/scripts/opencode_gateway.py:47` |
| `OPENROUTER_CATALOGUE` | کجا: دروازه · چیه: کاتالوگِ شناسه‌های اوپن‌روتر که برای تشخیصِ مسیر و فهرستِ منو استفاده می‌شود · مثال: ⟦OPENROUTER_CATALOGUE⟧ | ☑ OPENROUTER_CATALOGUE: `abzar/216-migration/scripts/opencode_gateway.py:48` |
| `OPENCODE_CACHE` | کجا: دروازه · چیه: کشِ شناسه‌های خودِ اوپن‌کد تا فهرستِ منو با قطعیِ سرویس خالی نشود · مثال: ⟦OPENCODE_CACHE⟧ | ☑ OPENCODE_CACHE: `abzar/216-migration/scripts/opencode_gateway.py:49` |
| `MERGED_CACHE` | کجا: دروازه · چیه: فهرستِ ادغام‌شدهٔ هر دو سرویس که منوی مدلِ افزونه از آن خوانده می‌شود · مثال: ⟦MERGED_CACHE⟧ | ☑ MERGED_CACHE: `abzar/216-migration/scripts/opencode_gateway.py:50` |
| `STATUS` | کجا: دروازه · چیه: فایلِ وضعیتِ قرمز؛ خطای سرویس در آن نوشته و با اولین پاسخِ سالمِ همان سرویس پاک می‌شود · مثال: ⟦STATUS⟧ | ☑ STATUS: `abzar/216-migration/scripts/opencode_gateway.py:51` |
| `MESSAGE_TIMEOUT` | کجا: دروازه · چیه: سقفِ ثانیه‌ایِ استریم پس از رسیدنِ بایتِ اول · مثال: ⟦MESSAGE_TIMEOUT⟧ ثانیه | ☑ MESSAGE_TIMEOUT: `abzar/216-migration/scripts/opencode_gateway.py:58` |
| `FIRST_BYTE_TIMEOUT` | کجا: دروازه · چیه: سقفِ ثانیه‌ایِ انتظارِ بایتِ اول برای پیام‌ها؛ پس از آن استریم سقفِ بلند را می‌گیرد · مثال: ⟦FIRST_BYTE_TIMEOUT⟧ ثانیه | ☑ FIRST_BYTE_TIMEOUT: `abzar/216-migration/scripts/opencode_gateway.py:64` |
| `RETRY_PAUSE` | کجا: دروازه · چیه: مکثِ ثانیه‌ای پیش از تلاشِ مجددِ خطای انتقال · مثال: ⟦RETRY_PAUSE⟧ ثانیه | ☑ RETRY_PAUSE: `abzar/216-migration/scripts/opencode_gateway.py:65` |
| `ALARM_STATUSES` | کجا: دروازه · چیه: کدهای HTTP که وضعیتِ قرمز می‌نویسند · مثال: ۵۰۲ و ۵۰۴ هر دو در آن هستند | ☑ ALARM_STATUSES: `abzar/216-migration/scripts/opencode_gateway.py:66` |
| `OPENROUTER_URL` | کجا: دروازه · چیه: آدرسی که کاتالوگِ اوپن‌روتر از آن خوانده می‌شود · مثال: ⟦OPENROUTER_URL⟧ | ☑ OPENROUTER_URL: `abzar/216-migration/scripts/opencode_gateway.py:67` |
| `CATALOGUE_TTL` | کجا: دروازه · چیه: عمرِ کشِ کاتالوگ پیش از خواندنِ دوباره · مثال: یک ساعت | ☑ CATALOGUE_TTL: `abzar/216-migration/scripts/opencode_gateway.py:68` |
| `HUNTER_PATTERN` | کجا: دروازه · چیه: الگوی مصرفِ کالیبرهٔ شکارچیِ مدل: توکنِ کش، ورودی و خروجیِ هر درخواست · مثال: (کش، ورودی، خروجی) | ☑ HUNTER_PATTERN: `abzar/216-migration/scripts/opencode_gateway.py:71` |
| `OR_HEADERS` | کجا: دروازه · چیه: هدرهایی که فقط در مسیرِ اوپن‌روتر معنا دارند و بقیه حذف می‌شوند · مثال: anthropic-beta | ☑ OR_HEADERS: `abzar/216-migration/scripts/opencode_gateway.py:73` |
| `AUTH_HEADERS` | کجا: دروازه · چیه: هدرِ احرازِ مسیرِ اوپن‌کد که کلید را از Keychain می‌گذارد · مثال: Bearer additionalModelOptionsCache | ☑ AUTH_HEADERS: `abzar/216-migration/scripts/opencode_gateway.py:97` |
| `OPENER` | کجا: دروازه · چیه: بازکنندهٔ HTTP با پروکسیِ خالی؛ بدونِ آن، پروکسیِ سیستم مسیر را عوض می‌کند · مثال: ⟦OPENER⟧ | ☑ OPENER: `abzar/216-migration/scripts/opencode_gateway.py:100` |
| `LOCK` | کجا: دروازه · چیه: قفلِ نوشتنِ فایلِ مصرف تا دو رشته هم‌زمان یک ردیف را خراب نکنند · مثال: ⟦LOCK⟧ | ☑ LOCK: `abzar/216-migration/scripts/opencode_gateway.py:101` |
| `KNOWN_LOCK` | کجا: دروازه · چیه: قفلِ کشِ فهرستِ مدل‌ها · مثال: ⟦KNOWN_LOCK⟧ | ☑ KNOWN_LOCK: `abzar/216-migration/scripts/opencode_gateway.py:206` |
| `KNOWN` | کجا: دروازه · چیه: کشِ شناسه‌های اوپن‌کد با لحظهٔ خواندن؛ یک دقیقه معتبر است · مثال: {ids، at} | ☑ KNOWN: `abzar/216-migration/scripts/opencode_gateway.py:207` |
| `GATEWAY` | کجا: رَپر · چیه: مسیرِ فایلِ دروازه که رَپر در نبودش بالا می‌آورد · مثال: ⟦GATEWAY⟧ | ☑ GATEWAY: `abzar/216-migration/scripts/vscode_opencode_wrapper.py:35` |
| `BASE` | کجا: رَپر و پیکر · چیه: آدرسِ محلیِ دروازه که به کلود کد داده می‌شود · مثال: ⟦BASE⟧ | ☑ BASE: `abzar/216-migration/scripts/vscode_opencode_wrapper.py:37`؛ `abzar/216-migration/scripts/opencode_picker.py:28` |
| `MODEL` | کجا: رَپر · چیه: مدلِ پیش‌فرض و مدلِ همهٔ نام‌های مستعار (opus/sonnet/haiku) · مثال: deepseek-v4.1-flash | ☑ MODEL: `abzar/216-migration/scripts/vscode_opencode_wrapper.py:38` |
| `PREVIOUS` | کجا: رَپر · چیه: رَپرِ بعدیِ زنجیره (سیاستِ ابزارها) که اجرا به آن سپرده می‌شود · مثال: ⟦PREVIOUS⟧ | ☑ PREVIOUS: `abzar/216-migration/scripts/vscode_opencode_wrapper.py:39` |
| `SUBCOMMANDS` | کجا: رَپر · چیه: زیرفرمان‌هایی که باید دست‌نخورده رد شوند (auth، mcp، workspace-trust …) · مثال: ⟦SUBCOMMANDS⟧ | ☑ SUBCOMMANDS: `abzar/216-migration/scripts/vscode_opencode_wrapper.py:164` |
| `BARE_FLAGS` | کجا: رَپر · چیه: پرچم‌های تنهای پرسشی که کلاینت را نباید دست بزنیم · مثال: --version و --help | ☑ BARE_FLAGS: `abzar/216-migration/scripts/vscode_opencode_wrapper.py:171` |
| `VALUE_FLAGS` | کجا: رَپر · چیه: پرچم‌هایی که یک مقدار می‌گیرند تا مقدارشان به‌جای زیرفرمان خوانده نشود · مثال: --setting-sources user | ☑ VALUE_FLAGS: `abzar/216-migration/scripts/vscode_opencode_wrapper.py:174` |
| `OUT` | کجا: فایلِ مصرف و کپس · چیه: فایلی که اپ‌ها می‌خوانند (خلاصهٔ مصرف و سقف) · مثال: ⟦OUT⟧ | ☑ OUT: `abzar/216-migration/scripts/opencode_usage.py:25`؛ `abzar/216-migration/scripts/opencode_caps.py:19` |
| `MIN_LINE` | کجا: فایلِ مصرف · چیه: فایلِ کنارِ خروجی که آخرین خطِ خوانده‌شده را نگه می‌دارد تا هر بار کلِ لاگ خوانده نشود · مثال: ⟦MIN_LINE⟧ | ☑ MIN_LINE: `abzar/216-migration/scripts/opencode_usage.py:26` |
| `ANSWERED` | کجا: پیکر · چیه: کلیدی در تنظیماتِ کلاینت که «پاسخِ فهرستِ مدل داده شد» را نگه می‌دارد · مثال: additionalModelOptionsAnsweredAt | ☑ ANSWERED: `abzar/216-migration/scripts/opencode_picker.py:30` |
| `BIG` | کجا: پیکر · چیه: کلیدهای سنگینِ فایلِ تنظیمات که هنگامِ نوشتن کنار گذاشته می‌شوند · مثال: projects و oauthAccount | ☑ BIG: `abzar/216-migration/scripts/opencode_picker.py:31` |
| `ROOT` | کجا: پیکر · چیه: ریشهٔ پوشهٔ ابزار (یک پله بالاتر از scripts) · مثال: ⟦ROOT⟧/claude-api | ☑ ROOT: `abzar/216-migration/scripts/opencode_picker.py:32` |
| `LOG` | کجا: پیکر · چیه: فایلِ لاگِ منوی مدل؛ «حذف شد» و «نگاشت شد» در آن می‌آید · مثال: ⟦LOG⟧ | ☑ LOG: `abzar/216-migration/scripts/opencode_picker.py:33` |
| `URL` | کجا: کپس · چیه: صفحهٔ کنسولِ اوپن‌کد که سقفِ هر مدل از آن خوانده می‌شود · مثال: https://opencode.ai/console/go | ☑ URL: `abzar/216-migration/scripts/opencode_caps.py:18` |
| `UA` | کجا: کپس · چیه: معرفِ کلاینت هنگامِ خواندنِ کنسول · مثال: ⟦UA⟧ | ☑ UA: `abzar/216-migration/scripts/opencode_caps.py:20` |
| `ROW` | کجا: کپس · چیه: الگوی regex برای برداشتنِ شناسهٔ مدل از هر ردیفِ جدولِ کنسول · مثال: data-model | ☑ ROW: `abzar/216-migration/scripts/opencode_caps.py:21` |
| `VAL` | کجا: کپس · چیه: الگوی regex برای برداشتنِ مقدارِ سقف از همان ردیف · مثال: data-plan | ☑ VAL: `abzar/216-migration/scripts/opencode_caps.py:22` |
| `path` | کجا: اپِ ۱۸۶ · چیه: فایلِ خلاصهٔ مصرف که اپ هر دقیقه می‌خواند · مثال: ⟦path⟧ | ☑ path: `/Users/habib/1-MY-WORK/186-claude-subscription-usage/swift/Sources/OpenCode.swift:8` |
| `names` | کجا: اپِ ۱۸۶ · چیه: نامِ نمایشیِ مدل‌ها؛ نبود ⇒ خودِ شناسه نشان داده می‌شود · مثال: deepseek-v4.1-flash ⇒ DeepSeek V4.1 Flash | ☑ names: `/Users/habib/1-MY-WORK/186-claude-subscription-usage/swift/Sources/OpenCode.swift:11` |
| `statusPath` | کجا: اپِ ۱۸۶ · چیه: فایلِ وضعیتِ قرمزِ دروازه؛ بود ⇒ ضربدرِ قرمز در نوار و یک اعلان · مثال: ⟦statusPath⟧ | ☑ statusPath: `/Users/habib/1-MY-WORK/186-claude-subscription-usage/swift/Sources/OpenCode.swift:173` |
| `kBundleID` | کجا: اپِ ۱۸۶ · چیه: شناسهٔ باندلِ اپ؛ برای بستنِ نسخه‌های قبلیِ همان اپ هنگامِ بالا آمدن · مثال: ⟦kBundleID⟧ | ☑ kBundleID: `/Users/habib/1-MY-WORK/186-claude-subscription-usage/swift/Sources/App.swift:4` |
| `alarms` | کجا: اپِ ۱۸۶ · چیه: موتورِ هشدارهای اپ (Alarms.swift) که هر چند ثانیه تیک می‌خورد · مثال: ⟦alarms⟧ | ☑ alarms: `/Users/habib/1-MY-WORK/186-claude-subscription-usage/swift/Sources/App.swift:12` |
| `GLOSS` | کجا: کارتِ هاورِ نامِ متغیر در چت · چیه: خانهٔ دادهٔ کارت‌های همین پوشه و وضعیتِ نصبش (داده، الگوی جست‌وجو، برجسته‌سازی، پوشه، پاسخ‌گرفته) · مثال: ⟦GLOSS⟧.got یعنی داده رسیده | ☑ GLOSS: `claude-ui-buttons.js:1008` |
| `GLOSS_DELAY_T` | کجا: کارتِ هاور · چیه: مهلتِ میلی‌ثانیه‌ایِ جوابِ هوک؛ بعد از آن به‌جای سکوتِ بی‌پایان، خطای دیدنی نشان داده می‌شود · مثال: 3000 میلی‌ثانیه | ☑ GLOSS_DELAY_T: `claude-ui-buttons.js:1047` |
| `USAGE_LOG` | کجا: فایلِ مصرف · چیه: مسیرِ usage.jsonl که هزینهٔ چت و فولدر از آن خوانده می‌شود · مثال: ⟦USAGE_LOG⟧ | ☑ USAGE_LOG: `abzar/216-migration/scripts/opencode_usage.py:30` |
| `SESSIONS_DIR` | کجا: فایلِ مصرف · چیه: پوشهٔ سشن‌های زنده که نام و مسیرِ هر چت از آن می‌آید · مثال: ~/.claude/sessions | ☑ SESSIONS_DIR: `abzar/216-migration/scripts/opencode_usage.py:31` |
| `PROJECTS_DIR` | کجا: فایلِ مصرف · چیه: پوشهٔ رونوشت‌ها؛ نامِ پوشه مسیرِ پروژه را می‌دهد، بدونِ خواندنِ محتوا · مثال: ~/.claude/projects | ☑ PROJECTS_DIR: `abzar/216-migration/scripts/opencode_usage.py:32` |
| `UNKNOWN_CHAT` | کجا: فایلِ مصرف · چیه: برچسبِ گروهِ ردیف‌های بی‌شناسه در chat_cost · مثال: نامعلوم (پیش از ثبت) | ☑ UNKNOWN_CHAT: `abzar/216-migration/scripts/opencode_usage.py:33` |
| `UNKNOWN_FOLDER` | کجا: فایلِ مصرف · چیه: برچسبِ گروهِ چت‌هایی که مسیرشان پیدا نشد · مثال: نامعلوم (بی‌مسیر) | ☑ UNKNOWN_FOLDER: `abzar/216-migration/scripts/opencode_usage.py:34` |
| `panelController` | کجا: اپِ ۱۸۶ · چیه: کنترلرِ پنجرهٔ شیشه‌ایِ دو‌تبی؛ با کلیک روی نوار باز/بسته می‌شود · مثال: ⟦panelController⟧ | ☑ panelController: `/Users/habib/1-MY-WORK/186-claude-subscription-usage/swift/Sources/App.swift:20` |
| `TITLE_MAX` | کجا: فایلِ مصرف · چیه: بیشترین طولِ عنوانِ چت که از اولین پیامِ آدم کوتاه می‌شود · مثال: 42 | ☑ TITLE_MAX: `abzar/216-migration/scripts/opencode_usage.py:74` |
| `HADS_LOG` | کجا: فایلِ مصرف · چیه: پوشهٔ لاگِ کارِ کمکیِ افزونهٔ حدس؛ توکنِ هر چت از آن خوانده می‌شود · مثال: ~/.claude/hads-log | ☑ HADS_LOG: `abzar/216-migration/scripts/opencode_usage.py:119` |
