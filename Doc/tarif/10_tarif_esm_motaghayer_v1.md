# تعریف ۱۰ — اسمِ متغیر، با واژه‌های حبیب (esm motaghayer) — v1 (حبیب، ۲۵ اکت ۲۰۲۶ ۰۱:۰۳)

| | |
|---|---|
| **حرفِ حبیب** | «طبق اون تعریف دهه گل داره ۹۱ مینیمال ۲ باشه … باید این نامگذاریات کل نامگذاری که تا الان کردی رو هم در بیار اینو باید با من باشه با واژگان من حرف بزنی با واژگان من متغیر درست کنی اسم و فایل درست کنی، همه اینارو باید چک بکنی که کار اشتباهی نکرده باشی» · در پنجرهٔ سؤال: «بله» (روشِ ۹۱) · «بله» (خطِ قدیمیِ دفتر دست نخورد، جدولِ قدیم ⇐ تازه، خبر به ۲۰۵) · «نه تعریف ده باید همه جا تعریف ده باشه و مربوط به اسم گذاری اگه تعویف دیگه ای الان تعریف ۱۰ هست شمارشو عوض کن» |
| **منبعِ قانون** | `~/1-MY-WORK/91th-minimal-2/doc/tarif/10_tarif_esm_motaghayer_v1.md` (بندهای ۰ تا ۱۰) · کپی در منشی: `0th-day-secreter-director-from-all-sources/doc/tarif/10_ghanoon_esm_az_91th-minimal-2.md` |
| **آدرسِ کد** | جدولِ قدیم ⇐ تازه: `esm_ghadim` در `mods/hads/hooks/register.js` و همان در `mods/hads/esm_ghadim.json` (برای چتِ ۲۰۵) · تنظیم‌ها: `esm_ghadim_tanzim` در `claude-ui-buttons.js` · آزمون‌ها: `mods/hads/test_hads.mjs` (`esmGhadimJson`، `noOldNames`، `esmRule`، `oldWords`، `oldHist`) و `test_claude_hooks_in_chat.cjs` (`esmUi`) |
| **پیشینه** | تعریفِ قبلیِ شمارهٔ ۱۰ (`دو جمله و پرسش`) از ۲۵ اکت شمارهٔ ۱۲ است. |

1. **چیست:** اسمِ هر چیزی که من در این پروژه می‌سازم (ثابت، کلیدِ دفتر، کلمهٔ فایلِ چت، کلیدِ تنظیم، اسمِ CSS، اسمِ سراسری) از **واژهٔ حبیب** است، با حروفِ لاتین:
   - از کلی به جزئی: `do_jomle_fasele_ms`، نه `GAP`.
   - حد با `had_`: `had_fork_kontekst_token`.
   - واحد آخرِ اسم: `_ms`، `_token`، `_harf`، `_radif`، `_px`، `_darsad`، `_usd`.
   - کامل و بی‌چسباندن: نه `'-' + k`؛ جدولِ صریح، تا هر اسم با `grep` پیدا شود.
   - تغییرِ اسم یعنی همه‌جا: کد، آزمون، تعریف، واژه‌نامه.
   - خطِ قدیمیِ دفتر و فایلِ قدیمی دست نمی‌خورد؛ هنگامِ خواندن با `esm_ghadim` به اسمِ تازه برمی‌گردد.
   - اسمِ تازه فقط با «بله»ی حبیب. فهرستِ واژه ⇐ اسم در `00_vazhe_name.md`، بخشِ `اسم در کد`.
2. **کی/کجا:** از ۲۵ اکت ۲۰۲۶، همهٔ پروژهٔ ۱۳۶.
3. **عمداً نیست (استثنا، با دلیل):**
   - واژه‌های عمومی که همه‌جا یک معنی دارند: `t`، `iso`، `sid`، `kind`، `text`، `label`، و `usage` (اسمِ خودِ API).
   - دستورهای `/hads on|off|now|ask` و دکمه‌های `h-on`/`h-off`: واژهٔ خودِ حبیب.
   - شناسهٔ جعبه‌های صفحه (`hads-x`، `hads-tick-…`): متغیر نیستند؛ قاعدهٔ ۹۱ بندِ ۸ هم همین را می‌گوید.
   - اسم‌های قدیمیِ پیش از من در `claude-ui-buttons.js` (`chat`، `btn`، `KEY`، …).
4. **باطل می‌شود اگر:**
   - در کد اسمِ قدیمی، اسمِ بزرگ‌حرفِ صادرشده، یا اسمِ چسبانده بیاید.
   - دفتر یا فایلِ چت با اسمِ قدیمی نوشته شود.
   - فایلِ قدیمی دیگر خوانده نشود.
   - جدولِ JSON با جدولِ کد فرق کند.
   - حبیب بگوید `با واژه‌های من نیست`.
5. **چک:**
   - `NO_CHROME=1 bash Doc/tarif/chek.sh` ⇒ `✅ ۱۰ اسمِ متغیر`.
   - `node test_claude_hooks_in_chat.cjs` ⇒ `"esmUi":{"table":true,"old":[],"host":true}`.
   - دستی، هر اسمِ تازه: آیا از واژهٔ حبیب است و در `00_vazhe_name.md` آمده؟

## جدولِ قدیم ⇐ تازه (۲۵ اکت)

| جنس | قدیم ⇐ تازه |
|---|---|
| ثابت‌های `register.js` | `MODEL` ⇐ `model_do_jomle_va_hads`<br>`GUESS_EVERY` ⇐ `hads_har_chand_javab`<br>`GAP` ⇐ `do_jomle_fasele_ms`<br>`MAX_FORK` ⇐ `had_fork_kontekst_token`<br>`COLD` ⇐ `kash_sard_ms`<br>`COLD_5M` ⇐ `kash_sard_5m_ms`<br>`HIST` ⇐ `had_ghablia_tedad`<br>`MAX_NOW` ⇐ `had_do_jomle_harf`<br>`SUMMARY_MIN` ⇐ `had_kamtarin_do_jomle_jambandi`<br>`TAIL` ⇐ `had_hook_transcript_khat`<br>`TAIL_BYTES` ⇐ `had_hook_transcript_byte`<br>`PICK` ⇐ `hook_transcript_grep`<br>`HOOK_SMALL` ⇐ `had_hook_kuchak_harf`<br>`HOOK_ROWS` ⇐ `had_hook_kuchak_radif`<br>`HOOK_BIG` ⇐ `had_hook_bozorg_harf`<br>`HOOK_BIG_ROWS` ⇐ `had_hook_bozorg_radif`<br>`PARTS` ⇐ `bakhsh_ha`<br>`SYSTEM` ⇐ `prompt_system_hads`<br>`NOW_SYSTEM` ⇐ `prompt_system_do_jomle`<br>`NOW_ASK` ⇐ `prompt_fork_do_jomle`<br>`GUESS_ASK` ⇐ `prompt_fork_hads`<br>`SUMMARY_ASK` ⇐ `prompt_jambandi_nobat`<br>`WRITE` ⇐ `gheymat_kash_neveshtan_usd`<br>`MONTHS` ⇐ `mah_miladi`<br>`JMONTHS` ⇐ `mah_shamsi`<br>`STRIP` ⇐ `system_reminder_regex`<br>`WAIT` ⇐ `matn_porsesh_montazer`<br>`WHY` ⇐ `matn_dalil_bi_javab` |
| کلمه‌های فایلِ چت (`~/.claude/hads-on/<id>`) | `-guess` ⇐ `-hads`<br>`-now` ⇐ `-do_jomle`<br>`-ask` ⇐ `-porsesh`<br>`-hooks` ⇐ `-hook`<br>`+midfork` ⇐ `+do_jomle_fork`<br>`min` ⇐ `yek_khat`<br>`dot` ⇐ `tak_dokme`<br>`hookbig` ⇐ `hook_bozorg` |
| نوعِ خطِ دفتر (`events.jsonl`) | `now` ⇐ `do_jomle`<br>`guess` ⇐ `hads`<br>`guess_click` ⇐ `hads_zadan`<br>`guess_sent` ⇐ `hads_ferestade`<br>`ask` ⇐ `porsesh`<br>`ask_wait` ⇐ `porsesh_montazer`<br>`turn_summary` ⇐ `jambandi_nobat` |
| خانهٔ خطِ دفتر | `items` ⇐ `hads_ha`<br>`guess` ⇐ `hads_matn`<br>`sent` ⇐ `matn_ferestade`<br>`edited` ⇐ `virayesh_shod`<br>`q` ⇐ `porsesh_matn`<br>`a` ⇐ `javab_matn`<br>`asked` ⇐ `khaste_habib`<br>`done` ⇐ `anjam_shod`<br>`not_done` ⇐ `anjam_nashod`<br>`from` ⇐ `tedad_do_jomle`<br>`tools` ⇐ `tedad_abzar`<br>`via` ⇐ `rah`<br>`tokens` ⇐ `kontekst_token` |
| خطِ خرج (`usage.jsonl`) | `part` ⇐ `bakhsh`<br>`via` ⇐ `rah`<br>بخش‌ها: `now` ⇐ `do_jomle`، `guess` ⇐ `hads`، `ask` ⇐ `porsesh`، `summary` ⇐ `jambandi_nobat` |
| فایلِ «قبلی‌ها» | `<id>.now.jsonl` ⇐ `<id>.do_jomle_ghablia.jsonl` (فایلِ قدیم هنوز خوانده می‌شود) |
| کلیدِ store | `lastGuessUsage` ⇐ `kharj_akhar_hads_sonnet`<br>`lastNowUsage` ⇐ `kharj_akhar_do_jomle`<br>`lastTurnUsage` ⇐ `kharj_akhar_hads_fork`<br>`lastAskUsage` ⇐ `kharj_akhar_porsesh` |
| JSON ِ جوابِ مدل | `now` ⇐ `do_jomle`<br>`guesses` ⇐ `hads`<br>`done` ⇐ `anjam_shod`<br>`not_done` ⇐ `anjam_nashod` |
| حالت‌ها | `open` ⇐ `baz`<br>`min` ⇐ `yek_khat`<br>`dot` ⇐ `tak_dokme` |
| تنظیم‌های پنلِ aA | `hook` ⇐ `hook_font_px`<br>`hadsAlpha` ⇐ `hads_pori_darsad`<br>مقدارِ ذخیره‌شده با اسمِ قدیم خوانده می‌شود |
| CSS | `--crtl-hook-size` ⇐ `--crtl-hook-font-px`<br>`--crtl-hads-alpha` ⇐ `--crtl-hads-pori-darsad`<br>`--crtl-hads-blur` ⇐ `--crtl-hads-tari-px`<br>`crtl-hads-dot` ⇐ `crtl-hads-tak-dokme`<br>`crtl-hads-top` ⇐ `crtl-hads-radif-bala`<br>`crtl-hook-open` ⇐ `crtl-hook-baz`<br>`crtl-tick-on` ⇐ `crtl-tik-roshan`<br>`crtl-tick-off` ⇐ `crtl-tik-khamush`<br>`crtl-insert` ⇐ `crtl-gozashtan-dar-kadr` |
| اسمِ سراسری در `extension.js` | `__crtlHookLine` ⇐ `__crtl_khat_hook`<br>`__crtlHookReadable` ⇐ `__crtl_hook_khana`<br>`__crtlJalali` ⇐ `__crtl_tarikh_shamsi` |
| فایلِ تعریف | `10_tarif_do_jomle_va_bepors_v1.md` ⇐ `12_tarif_do_jomle_va_porsesh_v1.md` |

## مانده (معلق، با «بله»ی حبیب)

اسمِ تابع‌ها و متغیرهای درونی (`guesses`، `madeFor`، `turnNows`، `tellNow`، `summarize`، `guessFork`، `whenFa`، …) هنوز انگلیسی است. فهرستش را حبیب باید ببیند.
