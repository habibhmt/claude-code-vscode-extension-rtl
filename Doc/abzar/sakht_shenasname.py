#!/usr/bin/env python3
"""Writes Doc/shenasname_matn.toml once (stage 1 of the standard, 27 Oct): one block per variable the code holds.
yani/tarif/ba by hand below; chera = Habib's quote from the comment above the variable; tayid = from git: a name in the
code before the rename of 25 Oct 06:07 (تعریفِ ۱۰، «بمونن») is approved, a later one is a proposal until Habib says yes.
Numbers never here: ⟦name⟧ stands for the value, which lives only in the code (the rule «عدد فقط در یک جا»)."""
import os, re, subprocess, sys
sys.path.insert(0, os.path.dirname(__file__))
import motaghayer_ha as m

OZV = {'mods/hads/hooks/register.js': 'hads', 'claude-ui-buttons.js': 'safhe', 'claude-host-hook.js': 'mizban'}
# name: (yani, tarif, related)
Y = {
 'model_do_jomle_va_hads': ('کجا: مودِ حدس · چیه: مدلی که «دو جمله» و حدسِ پشتیبان (وقتی fork نمی‌شود) با آن ساخته می‌شود · مثال: ⟦model_do_jomle_va_hads⟧', '12', ['had_fork_context_token']),
 'hads_har_chand_javab': ('کجا: آخرِ هر جواب · چیه: حدس و نکرده و خودکار و کرون هر چند جواب یک بار ساخته شوند · مثال: هر ⟦hads_har_chand_javab⟧ جواب یک fork', '01', ['tedad_javab_har_chat']),
 'tedad_javab_har_chat': ('چند جواب در هر چت دیده شده، از بالا آمدنِ همین پروسه؛ برای «هر چند جواب یک بار»', '01', ['hads_har_chand_javab']),
 'prompt_system_hads': ('دستورِ Sonnet برای حدس وقتی fork نمی‌شود: ۱ یا ۲ پیامِ بعدیِ حبیب، با لحنِ خودش', '01', ['model_do_jomle_va_hads']),
 'hads_akhar': ('آخرین حدس‌هایی که کادر نشان می‌دهد', '01', ['hads_baraye_chat']),
 'nakarde_akhar': ('آخرین «نکرده»‌ها (خواسته‌های حبیب که هنوز انجام نشده)، برای کادر', '14', ['nakarde_ba_sanad_akhar']),
 'nakarde_ba_sanad_akhar': ('«نکرده»‌هایی که سندشان (فایل یا commit) نشان داد انجام شده؛ در یک خطِ کوچک شمرده می‌شوند', '14', ['nakarde_akhar', 'had_kamtarin_harf_sanad']),
 'nakarde_ba_sanad_baz': ('خطِ «با سند کنار رفت» باز است یا بسته', '14', ['nakarde_ba_sanad_akhar']),
 'khodkar_akhar': ('آخرین «خودکار»ها: کاری که ایجنت خودش با ابزارش می‌تواند بکند به‌جای پرسیدن از حبیب', '15', ['khodkar_ferestade_har_chat']),
 'cron_akhar': ('آخرین «کرون‌جاب»‌ها: کارهای تکراری که حبیب گفت و به اجرای خودکار سرِ وقت می‌خورند', '15', []),
 'hads_dar_kar': ('یک ساختِ حدس در راه است؛ دومی هم‌زمان شروع نمی‌شود', '01', []),
 'hads_baraye_chat': ('حدس‌ها مالِ کدام چت‌اند؛ بعد از /clear (چتِ تازه) نشان داده نمی‌شوند', '01', ['hads_akhar']),
 'do_jomle_fasele_ms': ('کجا: وسطِ کار، بعد از هر ابزار · چیه: کمترین فاصلهٔ دو «دو جمله» · مثال: هر ⟦do_jomle_fasele_ms⟧ میلی‌ثانیه حداکثر یکی', '12', ['model_do_jomle_va_hads']),
 'had_fork_context_token': ('کجا: آخرِ جواب · چیه: اگر چت از این بزرگ‌تر باشد fork گران است و Sonnet روی پیام‌های آخر کار می‌کند · مثال: بیش از ⟦had_fork_context_token⟧ توکن', '01', ['model_do_jomle_va_hads']),
 'cache_sard_ms': ('کجا: «پرسش» · چیه: بیکاریِ بیش از این یعنی کشِ چت احتمالاً سرد شده و «پرسش» اول هشدار می‌دهد (کشِ یک‌ساعته)', '12', ['cache_sard_5m_ms', 'cache_sard_bad_az_ms']),
 'cache_sard_5m_ms': ('همان، وقتی کشِ چت پنج‌دقیقه‌ای است', '12', ['cache_sard_ms']),
 'cache_sard_bad_az_ms': ('کدام یک از دو بالایی الان به کار می‌رود (بسته به کشِ چت)', '12', ['cache_sard_ms', 'cache_sard_5m_ms']),
 'prompt_system_do_jomle': ('دستورِ Sonnet برای «دو جمله»: دو جملهٔ ساده که ایجنت الان چه می‌کند و منتظرِ چیست، با واژه‌نامهٔ حبیب', '12', []),
 'do_jomle_akhar': ('آخرین «دو جمله» و چتش', '12', []),
 'do_jomle_dar_kar': ('یک «دو جمله» در راه است', '12', ['do_jomle_dobare']),
 'do_jomle_dobare': ('وقتی یکی در راه بود، یکی دیگر خواسته شد؛ بعدش ساخته می‌شود', '12', ['do_jomle_dar_kar']),
 'zaman_do_jomle_akhar': ('ساعتِ آخرین «دو جمله»، برای فاصلهٔ ⟦do_jomle_fasele_ms⟧', '12', ['do_jomle_fasele_ms']),
 'zaman_akhar_javab': ('ساعتِ آخرین پایانِ جواب؛ پایانِ جواب بر «دو جمله»ٔ وسطِ کار که دیرتر رسید می‌چربد', '12', []),
 'akhar_javab_dar_kar': ('کارِ آخرِ جواب در راه است', '01', ['akhar_javab_dobare']),
 'akhar_javab_dobare': ('جوابی وسطِ کارِ قبلی تمام شد؛ بعدش انجام می‌شود، گم نمی‌شود', '01', ['akhar_javab_dar_kar']),
 'zaman_akharin_kar': ('آخرین باری که خودِ چت با مدل حرف زد؛ سنِ کش', '12', ['cache_sard_ms']),
 'cache_sard_shod': ('Claude Code خودش بعد از resume گفت کش رفته', '12', ['cache_sard_ms']),
 'porsesh_montazer': ('«پرسش»ی که پیش از آماده بودنِ fork آمد؛ آخرِ جوابِ بعدی خودش پرسیده می‌شود', '12', ['matn_porsesh_montazer']),
 'javab_porsesh': ('جوابِ آخرین «پرسش» (fork با کشِ گرم)؛ هرگز به چت نمی‌رود', '12', ['matn_porsesh']),
 'matn_porsesh': ('متنی که حبیب در جعبهٔ «پرسش» نوشته', '12', ['javab_porsesh']),
 'prompt_ha': ('پرومپت‌های ذخیره‌شدهٔ «پرسش» (همهٔ چت‌ها یکی، در فایل)', '18', ['prompt_entekhab_har_chat', 'had_harf_dokme_prompt']),
 'prompt_entekhab_har_chat': ('کدام پرومپت در هر چت روشن است', '18', ['prompt_ha']),
 'prompt_virayesh': ('پرومپتی که الان با ✎ در حالِ ویرایش است', '18', ['prompt_ha']),
 'system_reminder_regex': ('الگوی بخش‌های system-reminder که از متنِ پیام‌ها کنار گذاشته می‌شوند', '14', []),
 'matn_bi_harfe_habib': ('وقتی نوبت با پیامِ خودِ حبیب شروع نشده (کار، چتِ دیگر، Continue)، به‌جای «خواستهٔ حبیب» این می‌آید', '14', []),
 'prompt_fork_do_jomle': ('تکهٔ دستورِ fork برای «دو جمله»؛ فقط بخش‌های روشن خواسته می‌شوند', '12', []),
 'prompt_fork_hads': ('تکهٔ دستورِ fork برای حدس', '01', []),
 'abzar_ha_ye_claude_code': ('فهرستِ کاملِ ابزارهای ایجنت در Claude Code، برای «خودکار» (از سندِ رسمی)', '15', ['prompt_fork_khodkar']),
 'prompt_fork_khodkar': ('تکهٔ دستورِ fork برای «خودکار»', '15', ['abzar_ha_ye_claude_code']),
 'prompt_fork_cron': ('تکهٔ دستورِ fork برای «کرون‌جاب»', '15', ['ghaede_cron']),
 'ghaede_cron': ('قاعده‌های «کرون‌جاب» در دستورِ fork', '15', ['prompt_fork_cron']),
 'had_kamtarin_harf_sanad': ('کجا: سندِ «نکرده» · چیه: متنِ سند کوتاه‌تر از این چک حساب نمی‌شود · مثال: کمتر از ⟦had_kamtarin_harf_sanad⟧ حرف', '14', ['nakarde_ba_sanad_akhar']),
 'nakarde_anjam_har_chat': ('«نکرده»‌هایی که حبیب در هر چت خودش «✓ انجام شد» زد', '14', []),
 'gheymat_cache_neveshtan_usd': ('دلار برای هر میلیون توکنِ نوشتنِ کش (پنج‌دقیقه‌ای و یک‌ساعته)، برای هشدارِ «پرسش» با کشِ سرد', '12', ['gheymat_tamas_usd']),
 'had_ghablia_tedad': ('کجا: «قبلی‌ها» · چیه: چند «دو جمله»ٔ قبلی نگه داشته و نشان داده شود · مثال: ⟦had_ghablia_tedad⟧ تای آخر', '12', []),
 'do_jomle_akhar_dar_daftar': ('آخرین «دو جمله» که در دفتر نوشته شد، برای هر چت (یک پروسه چند چت می‌تواند داشته باشد)', '12', []),
 'hads_zade_shode': ('حدس‌هایی که در کادرِ نوشتن گذاشته شدند، تا با Enter معلوم شود کدام رفت', '01', []),
 'do_jomle_ha_ye_nobat': ('همهٔ «دو جمله»‌های نوبتِ در جریان، برای جمع‌بندیِ آخرِ جواب', '12', ['had_kamtarin_do_jomle_jambandi']),
 'mah_miladi': ('اسمِ کوتاهِ ماه‌های میلادی، مثلِ تاریخ‌نویسیِ حبیب («۲۴ اکت ۱۸:۵۷»)', '12', ['mah_shamsi']),
 'mah_shamsi': ('اسمِ ماه‌های شمسی برای تاریخِ خطِ هوک‌ها (در مود و در وصلهٔ میزبان، دو جا)', '11', ['mah_miladi']),
 'had_do_jomle_harf': ('کجا: «دو جمله» · چیه: بیشترین حرف · مثال: بلندتر از ⟦had_do_jomle_harf⟧ حرف با … کوتاه می‌شود', '12', []),
 'gheymat_tamas_usd': ('کجا: جدولِ «تماس‌ها» · چیه: دلار برای هر میلیون توکن: ورودی، خروجی، نوشتنِ کش، خواندنِ کش؛ برای Sonnet و fork (Opus) · از جدولِ ۲۰۳ (ertebat_claude.py)', '19', ['had_tamas_riz']),
 'had_tamas_riz': ('کجا: حالتِ بزرگِ جدولِ «تماس‌ها» · چیه: چند تماسِ آخر ریز به ریز · مثال: ⟦had_tamas_riz⟧ تای آخر', '19', ['gheymat_tamas_usd']),
 'neshane_amar': ('نشانهٔ اولِ خطِ پنهانی که دادهٔ جدولِ «تماس‌ها» را به صفحه می‌برد', '19', ['NESHANE_AMAR']),
 'amar_cache': ('دادهٔ جدولِ «تماس‌ها» که چند ثانیه نگه داشته می‌شود تا هر رسمِ کادر فایل را دوباره نخواند', '19', ['neshane_amar']),
 'had_kamtarin_do_jomle_jambandi': ('کجا: آخرِ جواب · چیه: با کمتر از این «دو جمله» در نوبت جمع‌بندی ساخته نمی‌شود · مثال: ⟦had_kamtarin_do_jomle_jambandi⟧', '12', ['do_jomle_ha_ye_nobat']),
 'abzar_ha_ye_nobat': ('ابزارهایی که در نوبتِ در جریان صدا زده شدند', '12', []),
 'khaste_habib_nobat': ('پیامِ خودِ حبیب که نوبت را شروع کرد', '14', []),
 'khodkar_ferestade_har_chat': ('«خودکار»ها و «نکرده»‌هایی که به چت فرستاده شدند، با شمارِ هر کار', '15', ['had_ferestadan_kar']),
 'baraye_ferestadan_har_chat': ('«خودکار»هایی که در صفِ فرستادن به چت‌اند', '15', ['khodkar_ferestade_har_chat']),
 'had_ferestadan_kar': ('کجا: «خودکار» · چیه: یک کار چند بار به چت برود؛ بارِ آخر با درخواستِ کمک از حبیب، بعدش دیگر نه · مثال: ⟦had_ferestadan_kar⟧ بار', '15', ['matn_bar_sevom']),
 'matn_bar_sevom': ('متنی که بارِ آخرِ فرستادنِ یک کار اضافه می‌شود: «اول به زبانِ ساده به حبیب توضیح بده و کمک بخواه»', '15', ['had_ferestadan_kar']),
 'matn_porsesh_montazer': ('پیامِ کادر وقتی «پرسش» باید تا جوابِ بعدی صبر کند', '12', ['porsesh_montazer']),
 'matn_dalil_bi_javab': ('دلیلِ ساده‌ای که کادر وقتی fork جواب نداد نشان می‌دهد', '12', []),
 'had_harf_dokme_prompt': ('کجا: دکمه‌های پرومپتِ «پرسش» · چیه: بیشترین حرفِ روی دکمه · مثال: بلندتر از ⟦had_harf_dokme_prompt⟧ حرف با …', '18', ['prompt_ha']),
 'bakhsh_ha': ('بخش‌های کادرِ حدس و اسمِ فارسیِ هر کدام (تیک‌ها)', '16', ['esm_bakhsh', 'kalame_khamush']),
 'esm_bakhsh': ('همان، به شکلِ جدولِ اسم ⇐ واژه', '16', ['bakhsh_ha']),
 'dayere_ha': ('دایره‌های سرچِ حافظه: همین چت، همین پروژه، همهٔ پروژه‌ها', '17', ['esm_dayere', 'dayere_har_chat']),
 'esm_dayere': ('اسمِ فارسیِ هر دایره', '17', ['dayere_ha']),
 'dayere_har_chat': ('دایرهٔ سرچِ حافظه برای هر چت', '17', ['dayere_ha']),
 'akharin_zakhire': ('آخرین وضعی که برای هر چت در فایل نوشته شد (حدس‌ها، نکرده‌ها …)، برای برگرداندن بعد از ریلود', '16', ['akharin_bargashte']),
 'akharin_bargashte': ('چت‌هایی که وضعشان بعد از ریلود یک بار برگردانده شد', '16', ['akharin_zakhire']),
 'kalame_khamush': ('کلمهٔ هر بخشِ خاموش در فایلِ چت (مثلِ -hads)؛ کامل نوشته شده تا با grep پیدا شود', '10', ['bakhsh_ha', 'kalame_tanzim']),
 'kalame_tanzim': ('کلمه‌های دیگرِ فایلِ چت: حالتِ کادر و تنظیم‌ها', '13', ['kalame_khamush']),
 'ghablia_baz': ('«قبلی‌ها» باز است', '12', ['had_ghablia_tedad']),
 'had_hook_transcript_khat': ('کجا: «هوک‌ها» · چیه: چند خطِ آخرِ فایلِ چت برای پیدا کردنِ هوک‌ها خوانده شود · مثال: ⟦had_hook_transcript_khat⟧ خط', '11', ['had_hook_transcript_byte']),
 'had_hook_transcript_byte': ('همان، به بایت: بیش از این از تهِ فایل خوانده نمی‌شود', '11', ['had_hook_transcript_khat']),
 'hook_transcript_grep': ('الگوی خط‌های هوک در فایلِ چت', '11', []),
 'had_hook_kuchak_harf': ('کجا: «هوک‌ها» · چیه: بیشترین حرفِ هر خطِ کوچک · مثال: ⟦had_hook_kuchak_harf⟧ حرف', '11', ['had_hook_kuchak_radif']),
 'masir_transcript': ('مسیرِ فایلِ چتِ همین چت', '11', []),
 'hook_ha': ('هوک‌هایی که برای کادر خوانده شد، و چتش', '11', []),
 'zaman_khandan_hook': ('ساعتِ آخرین خواندنِ هوک‌ها', '11', []),
 'had_hook_kuchak_radif': ('کجا: «هوک‌ها» · چیه: چند هوکِ آخر در حالتِ کوچک · مثال: ⟦had_hook_kuchak_radif⟧ ردیف', '11', ['had_hook_bozorg_radif']),
 'had_hook_bozorg_radif': ('همان در حالتِ بزرگ', '11', ['had_hook_bozorg_harf']),
 'had_hook_bozorg_harf': ('بیشترین حرفِ هر هوک در حالتِ بزرگ', '11', ['had_hook_bozorg_radif']),
 'ERRORS': ('خطاهای خودِ اسکریپتِ صفحه، برای دکمهٔ «تست» ِ پنل', '04', []),
 'SESSION': ('چتِ این برگه: شناسه، اسم، تیتر (بعد از /clear یا resume عوض می‌شود)', '02', []),
 'DEFAULT_COMMANDS': ('دکمه‌های پیش‌فرضِ نوارِ بالا', '02', ['DEF']),
 'KEY': ('کلیدِ localStorage ِ تنظیم‌های پنل', '04', ['DEF']),
 'DEF': ('تنظیم‌های پیش‌فرضِ پنل (اندازه‌ها، رنگ، روشن/خاموش‌ها)', '04', ['LIMITS', 'PRESETS', 'KEY']),
 'LIMITS': ('کمترین و بیشترینِ هر اندازه در پنل', '04', ['DEF']),
 'PRESETS': ('حالت‌های آمادهٔ اندازه‌ها', '04', ['DEF']),
 'esm_ghadim_tanzim': ('اسمِ قدیمِ دو تنظیم ⇐ اسمِ تازه؛ مقدارِ ذخیره‌شده با اسمِ قدیم خوانده می‌شود', '10', ['DEF']),
 'CSS': ('همهٔ قاعده‌های ظاهرِ پنل که به صفحه تزریق می‌شوند', '04', []),
 'HOVER_DELAY': ('کجا: پیام‌های جمع‌شده · چیه: موس چند میلی‌ثانیه روی پیام بماند تا باز شود · مثال: ⟦HOVER_DELAY⟧', '04', []),
 'GLOSS_DELAY': ('کجا: اسم‌های واژه‌نامه در چت · چیه: موس چند میلی‌ثانیه بماند تا کارتِ معنی بیاید · مثال: ⟦GLOSS_DELAY⟧', '06', []),
 'counterTimer': ('زمان‌سنجِ شمارندهٔ «نویسه»؛ فقط وقتی شمارنده روشن است', '04', ['usageCache', 'usageTick']),
 'usageCache': ('آخرین متنِ مصرفِ کانتکست که کنارِ «نویسه» می‌آید', '04', ['counterTimer']),
 'usageTick': ('شمارِ معکوس تا گشتنِ دوبارهٔ متنِ مصرف (گران است، هر چند ثانیه یک بار)', '04', ['counterTimer']),
 'FILE_NAME': ('اسمِ فایلِ تنظیم‌هایی که پنل ذخیره و بار می‌کند', '04', ['DEF']),
 'DRAG_PX': ('کجا: دکمه‌های نوارِ بالا · چیه: کمتر از این حرکت کلیک است، بیشتر کشیدن · مثال: ⟦DRAG_PX⟧ پیکسل', '02', []),
 'topWatch': ('نگهبانِ نوارِ بالا که بعد از عوض شدنِ چت دوباره می‌سازدش', '02', []),
 'draftCommands': ('متنِ ذخیره‌نشدهٔ ویرایشگرِ JSON ِ دکمه‌ها', '02', ['DEFAULT_COMMANDS']),
 'draftProfileName': ('اسمِ پروفایلی که تایپ شده و هنوز ذخیره نشده', '04', []),
 'NESHANE_AMAR': ('همان neshane_amar ِ مود، در صفحه: خطِ پنهانِ دادهٔ جدولِ «تماس‌ها» را پیدا می‌کند', '19', ['neshane_amar']),
 'KELID_JA_AMAR': ('کلیدِ localStorage که جای جدولِ «تماس‌ها» را نگه می‌دارد', '19', ['ja_kuchak_amar']),
 'sotun_amar': ('ستون‌های جدولِ «تماس‌ها» و اسمِ فارسیِ هر کدام', '19', ['radif_amar']),
 'radif_amar': ('ردیف‌های جدولِ «تماس‌ها»: ۱ ساعت، ۲۴ ساعت، کل', '19', ['sotun_amar']),
 'amar_matn_akhar': ('آخرین دادهٔ کشیده‌شده؛ بی‌تغییر دوباره کشیده نمی‌شود', '19', []),
 'amar_bozorg': ('جدولِ «تماس‌ها» در حالتِ بزرگ است', '19', ['ja_kuchak_amar']),
 'ja_kuchak_amar': ('جای جدولِ کوچک پیش از بزرگ شدن، تا × یا کلیکِ بیرون آن را همان‌جا برگرداند', '19', ['amar_bozorg', 'KELID_JA_AMAR']),
 'amar_dar_rah': ('یک رسمِ دوبارهٔ جدول در فریمِ بعد در راه است (دو تا پشتِ هم نه)', '19', []),
 'tries': ('چند بار صفحه برای سوار شدنِ پنل گشته شد', '04', ['timer']),
 'timer': ('زمان‌سنجِ همان گشتن', '04', ['tries']),
 'gorooh_hook': ('نوع‌های پیامِ هوک که بعد از ریلود از فایلِ چت دوباره به صفحه داده می‌شوند', '11', ['neshane_hook']),
 'neshane_hook': ('بایت‌های نشانِ خطِ هوک در فایلِ چت؛ فایل تکه‌تکه گشته می‌شود، نه یک‌جا', '11', ['gorooh_hook']),
}
KHAT_TAYID = '2026-10-25T06:07'
TAYID_GHADIM = 'حبیب ۲۵ اکت (تعریفِ ۱۰، اسم‌ها) «بله» · ثابت‌های صفحه: «اکی»، ۲۵ اکت ۰۶:۰۷ «بمونن»'


def avalin_zaman(esm):
    """the first commit that brought this name into the code"""
    try:
        o = subprocess.run(['git', '-C', m.RISHE, 'log', '-S', esm, '--reverse', '--format=%aI', '--', 'mods/hads/hooks/register.js', 'claude-ui-buttons.js', 'claude-host-hook.js'],
                           capture_output=True, text=True, timeout=60).stdout.split()
        return o[0][:16] if o else ''
    except Exception:
        return ''


def chera_az_tozih(tz):
    q = re.findall(r'«[^»]{3,}»', tz)
    sar = re.search(r'Habib,? (\d+ \w{3}(?: \d\d:\d\d)?)', tz) or re.search(r'(\d+ (?:Oct|Sep) \d\d:\d\d)', tz)
    if not q:
        return ''
    return ('حبیب ' + sar.group(1) + ' ' if sar else 'حبیب ') + ' · '.join(q[:2])


def toml_str(s):
    return '"' + s.replace('\\', '\\\\').replace('"', '\\"') + '"'


def main():
    items = m.peyda_kardan()
    jaha = {}
    for a in items:
        jaha.setdefault(a['esm'], []).append(a)
    out = ['# شناسنامهٔ متغیرهای ۱۳۶ — یک بلوک برای هر متغیر (استانداردِ ۹۱؛ حبیب ۲۷ اکت ۰۰:۰۰، پنجرهٔ سؤال «بله، شروع کن»).',
           '# عدد این‌جا نیست: ⟦اسم⟧ جای مقدار است، که فقط در کد است. جدولِ کامل: Doc/jadval_motaghayerha.md (ساخته با Doc/abzar/jadval_motaghayer.py).',
           '# tayid «پیشنهاد — تأییدنشده» یعنی اسم بعد از ۲۵ اکت ۰۶:۰۷ آمده و هنوز «بله» ِ حبیب را ندارد (فهرست: Doc/esm_pishnahadi.md).', '']
    for esm, ja in jaha.items():
        a = ja[0]
        yani, tarif, ba = Y.get(esm, ('', '', []))
        z = avalin_zaman(esm)
        tayid = TAYID_GHADIM if z and z < KHAT_TAYID else 'پیشنهاد — تأییدنشده' + (' (آمده ' + z.replace('T', ' ') + ')' if z else '')
        out += ['[' + esm + ']', 'yani = ' + toml_str(yani), 'chera = ' + toml_str(chera_az_tozih(' '.join(x['tozih'] for x in ja))),
                'ozv = ' + toml_str(OZV[a['file']]), 'noe = ' + toml_str(a['noe']),
                'ba_motaghayerha = [' + ', '.join(toml_str(b) for b in ba) + ']', 'tarif = ' + toml_str(tarif), 'tayid = ' + toml_str(tayid), '']
    open(os.path.join(m.RISHE, 'Doc', 'shenasname_matn.toml'), 'w', encoding='utf-8').write('\n'.join(out))
    print(len(jaha), 'بلوک')


if __name__ == '__main__':
    main()
