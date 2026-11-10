# بوت‌کانتکست — آنچه مدل در شروع داشت. شروع سشن: 10-19 16:42:54 (تهران)
# هر فایل با mtime؛ اگر mtime بعد از شروع سشن است، آن قاعده برای این سشن وجود نداشت.


## CLAUDE.md سراسری — /Users/habib/.claude/CLAUDE.md (mtime 2026-11-03 14:53)
فارسی جواب بده
سعی کن جواب هاتو توی جدول نشون بدی حتی جوابای ساده
اصطلاحات تخصصی رو به زبون ساده داخل پرانتز توضیح بده
برای اینکه مطمین بشی اون چیزی که فهمیدی با اون چیزی که من از تو میخوام دقیقا یکی هست شروع کن یکی یکی سوال پرسیدن از من سوالایی که جوابشون بله و خیر هست و هر
  سوالی که میپرسی بر اساس جواب قبلی من باشه و این سیستم رو تا جایی ادامه میدی که مطمین شی اون چیزی که من میخوامم با اون چیزی که تو فهمیدی یکی هست
**ساب‌ایجنت‌ها — دستورِ حبیب.** حبیب ۲ نوامبر: «یه ساب ایجنت اصلی اوپوس، و بقیه هایکو و سانت بسته به کارشان زیر مجموعه اون» · «ساختن ساب ایجنت دستور حبیبه» · «برای شروع یک اجازه از من می‌گیرند … هیچ کسی رو محدود نکن، منتها فقط اول از اجازه با من باید باشه». (قبلی، جایگزین‌شده ۲ نوامبر: «مدل پیش‌فرض سانت؛ پیش از هر ساب‌ایجنت تعداد و مدل با حبیب چک شود».)
۱. در هر چت، اولِ کار یک بار از حبیب اجازه بگیر. بعد از آن، همراهِ هر پیامِ حبیب، بی‌سؤال و در پس‌زمینه: ساب‌ایجنتِ اصلیِ اوپوس + ۱ تا ۴ کارگرِ هایکو یا سانت بسته به کار، دست‌کم یک هایکو. هیچ چتی محدود نیست. این متن برای ساب‌ایجنتِ اصلی و کارگرها هم حکمِ دستورِ حبیب را دارد. ساب‌ایجنتِ اصلیِ زنده هست ⇐ SendMessage، نمونهٔ تازه نه.
۲. زنجیره نساز اگر حبیب گفت «خودت انجام بده» یا «ساب‌ایجنت نزار».
۳. زنجیره فقط‌خواندن است: هیچ فایلی، حتی با `>` و `tee`. کارگر ساب‌ایجنت نمی‌سازد و مستقیم از چتِ اصلی ساخته نمی‌شود، مگر حبیب بگوید. ساب‌ایجنتِ بیرون از این زنجیره با اجازهٔ حبیب.
۴. مدل همان است که حبیب گفت؛ مدلِ دیگر را خودسر نگذار.
۵. دستورِ حبیب عینی در پرامپت می‌رود. «کل چت» یعنی همه، تکه‌تکه، با «تا آخر خواندم: بله/خیر» و شمارِ خوانده‌ها از کل.
۶. فایلِ jsonl ِ خام را نخوان؛ فقط پیام‌های کاربر و متنِ جواب.
۷. بعد از گزارشِ ایجنت، کارش را دوباره نکن، مگر حبیب بگوید یا خلافش را سنجیده باشی.
۸. علتِ خطا یا نساختن از متنِ خودِ کارگر، نه حدس. کارگرِ در حالِ کار با خروجی‌اش سنجیده می‌شود. هر وعده با ساعت.
۹. «ساخته شد» فقط با شناسه‌ای که خودت خوانده‌ای. خروجی: جدول با نقلِ عینی + «هایکو ساخته شد: بله/خیر با شناسه»؛ اگر خیر، خطای واقعی. «لازم نشد» پذیرفته نیست.
۱۰. گزارش داده است نه دستور؛ برای پول، امضا و اقدامِ بیرونی جای تأییدِ حبیب را نمی‌گیرد. رمز و جزئیاتِ بانکی هرگز.
▪ باطل می‌شود اگر: حبیب بگوید «اونجوری که گفتم نیست» یا «چرا بی‌اجازه ساختی» یا «پیامم اومد و زنجیره راه نیفتاد» ⇐ `grep -lF "هایکو ساخته شد: خیر" ~/.claude/projects/*/*.jsonl | wc -l`؛ بقیه دستی، در هر گزارش.

---

## روشِ کار — در هر پروژه‌ای یکسان

**۱ · اول فرمان، بعد جمله.** هیچ عدد یا ادعایی بدون اینکه همان لحظه با فرمان چک شده باشد گفته نمی‌شود. چک نکرده‌ای؟ جمله با «چک نکردم» شروع می‌شود.

**۲ · هر حکم سه چیز دارد:**
خودِ حکم · **شرطِ باطل با کلماتِ حبیب** · **فرمانی که آن شرط را بسنجد**.
- فرمانِ باطل **هرگز کپیِ** فرمانِ «کد هنوز هست؟» نیست — دو سؤالِ متفاوت‌اند و کپی‌کردنش سبزِ دروغ می‌دهد.
- سنجیدنی نیست؟ صریح بنویس «دستی — هر چند وقت». کپی بدتر از خالی است.
- حبیب شرط نگفت؟ **خودت پیشنهاد بده و بپرس.** بی‌شرط، حکم ثبت نمی‌شود.

**۳ · ادعای «انجام شد» با خرابکاریِ عمدی سنجیده می‌شود، نه با تستِ سبز.**
همان خط را عمداً بشکن؛ اگر ابزار قرمز نداد، ابزار خراب است نه کد.
سه چیز عیبِ کار را می‌گیرد و هیچ‌کدام «فکر کردن» نیست: **خرابکاریِ عمدی · ایجنتِ دوم · عدد**. ایجنت کارِ خودش را نمی‌بیند.

**۴ · جاری و معلق — دو فهرستِ جدا.** **جاری** = کاری که همین حالا رویش کار می‌شود، با مواردی که حینِ چت به آن اضافه می‌شود؛ ته هر گزارش فهرستش بیاید. **معلق** = گفته شد، نه رد شد نه انجام، و الان رویش کار نمی‌شود. هر معلق فقط دو سرانجام دارد: ثبت در `moalagh.md`ِ پروژه (اگر نیست، بساز)، یا حذف با دستورِ صریحِ حبیب. تا یکی از این دو نشده، در هر گزارش دوباره پرسیده می‌شود: در پنجرهٔ سؤال، برای هر معلق یک سؤال با سه گزینه (ثبت در `moalagh.md` / حذفش کن / فعلاً بماند)، تا ۴ معلق در هر پنجره. ثبت‌شده‌ها تکرار نمی‌شوند و فقط یک خط می‌آید: «N معلقِ ثبت‌شده در `moalagh.md`».

**۵ · کارِ ظاهری (رنگ، چیدمان، تم) فقط وقتی که کارِ اصلی تیک خورده باشد.**

**۶ · پروژهٔ تازه:** پوشهٔ تعریف (`doc-tarif/tarif/`) + اسکریپتِ چک.

**۷ · حافظه فقط با اجازه.** ثبت، تغییر یا پاک کردنِ هر چیزی در حافظه (`memory/`، `MEMORY.md`) بدونِ اجازهٔ صریحِ حبیب ممنوع است.

**۸ · «بررسی کن» یعنی همه‌جا.** همهٔ صفحه‌ها، همهٔ سامانه‌ها، از اولین تاریخ. در گزارش بنویس کجاها را گشتی و کجاها را نه. عددِ بی‌مدرک نگو. (حبیب، ۲۱ اکت ۲۰۲۶، «بله، اضافه کن»؛ الگو در ۲۰۱، ۱۸۴ و ۱۸۹)

---

**۹ · سرچِ حافظه.** قبل از هر کاری، «کارهای قبلی و حرف‌های قبلیِ من رو در اون خصوص» از توی دیتابیسِ حافظه دربیار و طبقِ همان کار کن: `/Users/habib/1-MY-WORK/205th-day-mother-of-all-agent/abzar/hafeze_search.py --hame "<کلمه‌های حبیب>" 5` (حبیب، ۲۵ اکت ۲۰۲۶، «واژگان حبیب، اضافه کن»)

> قاعدهٔ جفتِ ناظر و مجری و سرپرست و منشی کلاً حذف شد (حبیب ۲۹ اکت ۰۱:۳۰: «کل جاهایی که تو حافظه و کلود ام دی سراسری و کلود ام دی پروژه ها از این جفت چیزی هست همش رو پاک کن دیگه نداریم اینو»). سه قاعدهٔ همگانیِ آن بخش این‌جا ماند:

**۱۰ · پیش از انداختنِ کار به دوشِ حبیب:** همهٔ راه‌ها (ابزار، شبیه‌ساز، نسخهٔ دیگر، ایجنتِ دیگر، سرچِ وب) + grep ِ چت‌های قبلی برای حرفِ حبیب در موردِ مشابه ⇒ طبقِ همان. حبیب فقط **مرحلهٔ آخر**. حبیب: «مخصوصا توی مواردی که مجری ها میخوان کار رو به دوش حبیب بندازن باید انواع راه ها و انواع جستجوهای چت های قبلی رو انجام بدید تا پیدا کنید تو موارد مشابه حبیب چی گفته و طبقش عمل کنید». درسِ عبرت: مجریِ VoiceClip ساعت‌ها منتظرِ امتحانِ آیفون ماند، در حالی که باید شبیه‌سازِ iOS 27 را می‌گرفت و تا آخر خودش امتحان می‌کرد.

**۱۱ · هر اجازه فقط برای همان چیزی است که پرسیده شد**، نه چیزهای شبیهش.

▪ باطل می‌شود اگر: حبیب بگوید «این را چرا به من دادید که راه داشت» ⇐ دستی، در هر گزارش.

**۱۲ · تعریف‌ها و فحوای کلام، با واژه‌های حبیب.** حبیب: «کل‌کارایی که من تاکید کردم روشون و مسیر رو عوض کردن باید طبق واژگان من توی تعریف بیان — طبق واژگان من شماها باید با هم حرف بزنید … فحوای کلام در بیارن از حرفای من — حدس چیزایی که من میخوام جزو تعاریف باید باشه — Fahvaye_kalame_habib_Plus_ai_plus_agent_tools — خیلی حرف بزرگی هست امیدوارم متوجه شده باشید».
- هر پروژه در `doc/tarif/` دارد: (الف) هر چیزی که حبیب رویش **تأکید** کرد یا با آن **مسیر را عوض** کرد، یک تعریف با حرفِ عینیِ حبیب؛ (ب) فایلِ `fahvaye_kalame_habib_plus_ai_plus_agent_tools.md`: نیت‌های حبیب (با نقلِ عینی) + تکمیلِ AI + ابزارهای ایجنت + **حدسِ خواسته‌های بعدیِ حبیب** (با برچسبِ «حدس»).
- ایجنت‌ها با هم و با حبیب **با واژه‌های حبیب** حرف می‌زنند (واژه‌نامهٔ همان پروژه؛ الگو: `~/1-MY-WORK/0th-day-secreter-director-from-all-sources/soal-javab/` و `doc/tarif/14_tarif_fahvaye_kalame_habib_v1.md`).
- حرفِ تازه‌ترِ حبیب بالادست است؛ حرفِ قدیمی با «قبلی، جایگزین‌شده» و تاریخ می‌ماند.
▪ باطل می‌شود اگر: حبیب بگوید «این رو تأکید کرده بودم، چرا تو تعریف نیست» یا «با واژه‌های من حرف نزدی» ⇐ `ls ~/1-MY-WORK/*/doc/tarif/fahvaye_kalame_habib_plus_ai_plus_agent_tools.md | wc -l` در برابرِ تعدادِ پروژه‌های فعال؛ بقیه دستی، در هر گزارش.

---

**۱۳ · کمترین پرسش از حبیب.** خبرِ معمولیِ بانک فقط ثبت می‌شود و پرسش فقط برای موردِ نامعمول است. چیزی که حبیب رد کرد یا گفت «بماند»، تا حرفِ تازه‌اش دوباره پرسیده نمی‌شود. (حبیب، ۲ نوامبر ۲۰۲۶ ۱۷:۳۵ «بله»؛ اصل ۱۷:۳۰: «وقتی که یه چیزهایی ازش اوکی گرفتیم دیگه دفعه دوم هی اوکی نگیریم»)
▪ باطل می‌شود اگر: حبیب بگوید «این باید پرسیده می‌شد» یا «چرا دوباره پرسیدی» ⇐ دستی، در هر گزارش.

**۱۴ · کامیت فقط بعد از تأییدِ حبیب.** حبیب، ۲ نوامبر ۲۰:۴۵: «کامیت بعد از تایید من باید باشه». (ثبت در سراسری: حبیب ۳ نوامبر «بله، اضافه کن»)
▪ باطل می‌شود اگر: حبیب بگوید «این کامیت رو من اوکی نداده بودم» ⇐ دستی، در هر گزارش.


## ایندکس حافظه (در بوت دیده می‌شود) — /Users/habib/.claude/projects/-Users-habib-1-MY-WORK-186-claude-subscription-usage/memory/MEMORY.md (mtime 2026-11-01 03:49)
- [Claude usage panel project](claude-usage-panel-project.md) — acc2 was NOT renewed (Aug 2026); only acc1 is live. Pace formula, and why context length (not model) drives cost
- [Never /logout with multi-account setups](never-logout-claude-code-multi-account.md) — it revokes the refresh token server-side and kills stored copies
- [Cowork hooks & the RTL fork](cowork-hooks-and-rtl-fork.md) — Cowork reads cowork_settings.json, and the ad-hoc-signed Claude-RTL.app can't boot the Cowork VM
- [Two-account IDE isolation](two-account-ide-isolation.md) — Windsurf pinned to ~/.claude-acc2 via CLAUDE_CONFIG_DIR; what's symlinked, and the ANTHROPIC_API_KEY trap
- [Fable has its own weekly quota](fable-has-its-own-weekly-quota.md) — a second, tighter bucket; never let subagents inherit Fable
- [Habib: don't rush big changes](habib-dont-rush-big-changes.md) — when he vents, capture and stop; no redesign pile, no "shall I launch?"
- [Hermes grinder+shagerd plan](hermes-grinder-shagerd-plan.md) — 18 Aug plan waiting for "برو": routine grinder + daily judgment lessons; Day-1 script inside
- [Never binary-patch Claude Code](never-patch-claude-binaries.md) — ad-hoc re-signing strips allow-jit and Bun dies; each IDE has its own binary
- [Chrome port 9226](chrome-ports-via-secretary.md) — this project uses its own Chrome 9226 only; problems ⇒ tell ۲۰۳ (مجری-۲۰۳-ای مک)
- [Read bcherny tweets](read-bcherny-tweets.md) — with every updates/news request, also read a few of @bcherny's latest tweets (Habib, 31 Oct)
- [تجربهٔ کروم ⇐ browser-project](browser-project-tajrobe.md) — پیش از کارِ مرورگر بخوان، بعدش تجربه را بی تکرار بنویس (حبیب ۱ نوامبر ۰۳:۴۸)


## فایل حافظه (فقط اگر Read شود) — /Users/habib/.claude/projects/-Users-habib-1-MY-WORK-186-claude-subscription-usage/memory/browser-project-tajrobe.md (mtime 2026-11-01 03:49)
---
name: browser-project-tajrobe
description: پیش از هر کار با کروم یا بریو .claude/skills/browser-project/SKILL.md را بخوان؛ بعد از هر کار تجربه‌ات را همان‌جا بنویس (اول چک کن تکراری نباشد)
metadata:
  type: feedback
---

**پیش از هر کار با مرورگر (کروم یا بریو)، هر بار:** `~/1-MY-WORK/186-claude-subscription-usage/.claude/skills/browser-project/SKILL.md` را بخوان (بعد از اسکیلِ سراسریِ `browser`).
**بعد از هر کار با مرورگر:** تجربه‌ات (سایت، چه کار کرد، چه گیر داشت، راهِ درست) را یک ردیف در همان فایل بنویس — **اول grep کن که تکراری نباشد**؛ اگر ردیفش هست، فقط به‌روزش کن.

**Why:** حبیب ۱ نوامبر ۲۰۲۶ ۰۳:۴۸: «توی حافظه همشون بنویس که بعد از هر کار با کروم تجربیاتشوون رو بنویسن توی این فایل قبلش چک کنن چیز تکراری ننویسن توش و قبل شروع به کار مرورگر هم بخونن فایل رو هربار». ریشه: ۲۳ سپتامبر «اسکیل سراسری … تجربه‌ها»؛ ۱ نوامبر ۰۳:۲۶ «خود ایجنت باید کم کم اسکیل خودش رو بسازه با تجربیاتش».

**How to apply:** هر بار پیش از `chrome_baz_kon.sh` یا هر CDP، و هر بار پیش از گزارشِ پایانِ کار به حبیب.


## فایل حافظه (فقط اگر Read شود) — /Users/habib/.claude/projects/-Users-habib-1-MY-WORK-186-claude-subscription-usage/memory/chrome-ports-via-secretary.md (mtime 2026-10-29 01:36)
---
name: chrome-ports-via-secretary
description: "This project's own Chrome is CDP port 9226 (not 9222/9223/9225); rules, and whom to ask when it breaks"
metadata:
  node_type: memory
  type: reference
  originSessionId: e319bd94-76e5-4313-91fc-6a8cfc38e8a1
  modified: 2026-10-19T17:25:10.713Z
---

Set at Habib's order, 19 Oct 2026 20:52 (Habib: «هر کرومی رو باید مخصوص یه ایجنت باشه»). Replaces the earlier shared-Chrome rule.

| Port | Owner |
|---|---|
| **9226** | **this project (186) only**, profile «۹۲۲۶ ایجنت ۱۸۶ سابسکریپشن» 🐼, Gmail habibibabobabe logged in |
| 9222 | airdrop (189) only |
| 9223 / 9225 | other agents, do not use |

9226 is now a plain Iranian-IP Chrome (VPN gateway and PAC removed by Habib, 19 Oct 21:41). Foreign sites (Apple, Gmail) need the VeePN extension, which is not logged in ⇒ tell ۲۰۳ (مجری-۲۰۳-ای مک). Never touch the Mac Windscribe app, Split Tunneling or wallets.

Rules: background tab only (`background:true`), never bring window to front unless Habib asks, close own tab when done; never touch VPN/Windscribe/Split or open/close Chrome; never print passwords, codes, card numbers. Check IP with `node ~/1-MY-WORK/203th-day-imac-cpu-tracker/doc/abzar/ers_monshi/negahban_morurgar/ip_chrome.mjs <port>`. Problems ⇒ tell ۲۰۳ (مجری-۲۰۳-ای مک).

**Why:** agents sharing one Chrome collided; Habib gave each agent its own. See also the `chrome-cdp` skill.

**Closing (Habib 19 Oct 21:27):** when a tab's job is done close the tab; when the whole job is done close all of 9226 (`Browser.close`). Need it again ⇒ open it yourself with `zsh ~/1-MY-WORK/203th-day-imac-cpu-tracker/doc/abzar/ers_monshi/chrome_baz_kon.sh 9226` (Habib: «باز کردن کروم هم با خودشون باشه»); if it fails ⇒ tell ۲۰۳ (مجری-۲۰۳-ای مک).

**Foreign-site procedure (Habib 20 Oct 00:32: «مگه طبق اینستراکشن نمیدونی باید چیکار کنی؟ خودت کروم باز کنی ایپی بسنجی و وی پی ان رو روشن کنی و بری توش؟ تو حافظه ات سیو کن») — do it yourself, don't ask:**
1. `zsh ~/1-MY-WORK/203th-day-imac-cpu-tracker/doc/abzar/ers_monshi/chrome_baz_kon.sh 9226`
2. IP: `node ~/1-MY-WORK/203th-day-imac-cpu-tracker/doc/abzar/ers_monshi/negahban_morurgar/ip_chrome.mjs 9226` (Iran = 81.16.123.115)
3. VeePN popup in a background tab: `chrome-extension://majdfhpaihoncoakbjgbdhglocklcgno/src/popup/popup.html` (first load says "Loading…" up to ~1 min) ⇒ click `.connect-button` ⇒ wait for `connect-button--connected`
4. Re-check IP (open ipinfo.io/json in a tab too) ⇒ only if foreign, do the work
5. Click `.connect-button` again (OFF) ⇒ check IP is Iran again ⇒ close tabs ⇒ `Browser.close`
The 9226 profile also has wallet extensions (Rabby, MetaMask, Phantom…) and Windscribe (not logged in) — never touch them. 20 Oct 00:40: VeePN showed "Connected" but every site gave ERR_CONNECTION_CLOSED (free/unlogged).

**VPN state on open (Habib 20 Oct 01:08: «بنا به نیازت اگه وی پی ان خواستی روشن وگرنه بسته»):** first thing after opening 9226, check IP. Turn VeePN on only when the task needs a foreign site; otherwise make sure it is OFF before anything else (Iranian sites). 20 Oct the OFF click left it "connected" (IP 51.81.245.239) until Browser.close, so it may come back connected. The 6 wallet extensions arrived via Google sync (habibibabobabe), not a seed; never touch them, removal is Habib's call.

**Reliable VPN OFF (20 Oct 15:30; Habib: do it yourself, never ask him):** clicking `.connect-button` OFF alone is not enough (it stayed connected 3 of 4 times on 20 Oct). After the click wait 5 s, then in VeePN's service worker (target type=service_worker, url contains majdfhpaihoncoakbjgbdhglocklcgno) run with Runtime.evaluate awaitPromise:true: `new Promise(r=>chrome.proxy.settings.get({},v=>r(JSON.stringify(v))))`. mode=system ⇒ off. If levelOfControl=controlled_by_this_extension and mode is fixed_servers/pac_script ⇒ run `new Promise(r=>chrome.proxy.settings.clear({scope:'regular'},()=>r('ok')))` there. Do the same check for Windscribe (hnmpcagpplmpfojmgmnngilcnanddlhb). Then IP must be 81.16.123.115. If proxy is system but IP is still foreign ⇒ Mac Split Tunneling problem ⇒ tell ۲۰۳ (مجری-۲۰۳-ای مک).


## فایل حافظه (فقط اگر Read شود) — /Users/habib/.claude/projects/-Users-habib-1-MY-WORK-186-claude-subscription-usage/memory/claude-usage-panel-project.md (mtime 2026-09-05 01:09)
---
name: claude-usage-panel-project
description: "Only account 1 is live (acc2 lapsed Aug 2026); the pace formula for deciding which to use, and what actually drives their usage"
metadata: 
  node_type: memory
  type: project
  originSessionId: e00cc536-ac82-43ad-a41c-18f1aa74b2bb
  modified: 2026-09-05T01:10:00.000Z
---

**STATUS 2026-09-05 — ONLY ACCOUNT 1 IS LIVE. Account 2 was NOT renewed.**
`habib.hemmatyar@gmail.com` (Visa •8042) was due to renew Aug 19 and Habib let it
lapse; it is a dead subscription, not just an archived config dir. Its numbers in the
usage panel are frozen leftovers from the last successful fetch — on 2026-09-05 it
still read `weekly 89%` with a `resets_at` ≈384 hours in the past. **Do not treat
acc2's percentages as live, do not route work to it, and do not compute the pace
ratio across two accounts any more — there is one account.** See
[[two-account-ide-isolation]], which archived acc2's config dir back on 2026-08-23
for a different reason (the split itself was a mistake).

The rest of this file is the two-account history, kept because the mechanics,
measurements and the local-quota-reading tricks are all still correct.

- Account 1: `habibibabobabe@gmail.com` — Visa •5398, renews Sep 1 — **the live one**
- Account 2: `habib.hemmatyar@gmail.com` — Visa •8042 — **lapsed, not renewed**

Historically Habib ran two Claude Pro subscriptions ($20/mo each) and wanted to fully
consume both weekly quotas rather than let capacity expire.

**Key mechanics (verified Aug 2026):**
- Only the **weekly** quota burns on expiry. The 5-hour session is a throttle,
  not a separate bucket — one full session ≈ 10% of the weekly cap, so draining
  a week needs ~50 hours of open session windows.
- Weekly windows are rolling: they start at the first message and reset 7 days
  later, so the two accounts' reset days can be staggered deliberately.

**Decision rule** — pick the account with the lowest ratio:
`ratio = used% ÷ elapsed%` of the weekly window. Below 0.8 = wasting capacity;
above 1.2 = will lock out before reset. This matches `pace.py` in the
`realiti4/claude-swap` tool, which implements the same formula independently.

**Dominant cost driver:** Claude Code's usage breakdown showed 64–74% of usage
came from sessions above 150k context — not from model choice. `/clear` and
`/compact` are the biggest levers. A `PostToolUse` hook at
`~/.claude/hooks/context-warn.py` warns once per band at 25k / 50k / 100k / 150k …

**The VS Code extension does not render `systemMessage` from a hook.** It lands in
the transcript as an `attachment` of type `hook_system_message` and is silently
dropped by the UI — verified Aug 2026 by finding two fired warnings (53k, 106k) in
the transcript that Habib never saw on screen. The hook therefore also raises a
macOS notification via `osascript`, which is visible from any client. When
debugging "the hook didn't fire", check `/tmp/claude-context-warn/<session>.band`
first — if the band file exists, the hook ran and the UI ate the message.

**Weekly quota is readable locally — no API call.** Claude Code caches the same
numbers `/usage` shows in `~/.claude.json` under `cachedUsageUtilization`:
`utilization.seven_day.utilization` (percent), `.five_hour.utilization`, each with
`resets_at`, plus a `fetchedAtMs` stamp to detect staleness. The desktop app keeps a
5-minute time series of the same two figures in
`~/Library/Application Support/Claude/plan-usage-history.json` (`samples[].u.fh` / `.sd`).
`~/.claude/hooks/statusline.py` reads the first one and renders context, cumulative
tokens, an API-list-price estimate, and the weekly/5h percentages under every message.

**Measured data point (Aug 13, 2026) — resuming a maxed-out conversation on the
other account.** A ~950k-token conversation hit the limit on account 1; the same
conversation was continued on account 2 (Opus, reasoning effort `high`). That single
continuation consumed **34% of the 5-hour window and 4% of the weekly window**.
Implications Habib derived:
- ~25 such heavy continuations fit in one weekly quota (100 ÷ 4).
- ≈3 of them fill one 5-hour window, so ≈8 fully-drained 5-hour windows per week
  (25 ÷ 3) — close to, and a better-measured version of, the "one session ≈ 10% of
  weekly" rule of thumb above.
- Practical management rule: a long conversation that dies on one account is *not*
  cheap to resume elsewhere — budget it as ~1/25 of that account's week, and prefer
  `/clear`+`/compact` before the swap rather than after.

See [[never-logout-claude-code-multi-account]].


## فایل حافظه (فقط اگر Read شود) — /Users/habib/.claude/projects/-Users-habib-1-MY-WORK-186-claude-subscription-usage/memory/cowork-hooks-and-rtl-fork.md (mtime 2026-08-10 01:32)
---
name: cowork-hooks-and-rtl-fork
description: "Cowork reads cowork_settings.json (not settings.json) for hooks, and the ad-hoc-signed Claude-RTL.app fork cannot start the Cowork VM"
metadata: 
  node_type: memory
  type: project
  originSessionId: 40ba97a8-abd0-46c6-a5da-036cf4aaeb8d
  modified: 2026-08-09T22:02:43.389Z
---

Two findings from reading `/Applications/Claude.app/Contents/Resources/app.asar` (Aug 2026):

**1. Cowork uses a separate user-settings file.** The desktop app picks the
user-settings filename by mode:
`coworkPlugins || CLAUDE_CODE_USE_COWORK_PLUGINS ? "cowork_settings.json" : "settings.json"`.
So hooks in `~/.claude/settings.json` never reach a Cowork session — they must be
duplicated into `~/.claude/cowork_settings.json`. The session launcher does pass
`settingSources:['user']` plus its own programmatic `hooks:{PreToolUse:[...]}`, so the
hook engine itself is live in Desktop; Cowork's own model claiming "Cowork has no hooks"
is the model not knowing its harness, not a fact about the code.

**2. `VZErrorDomain Code=1` comes from running two Claude apps at once.** Habib keeps a
re-packaged `~/Applications/Claude-RTL.app` (RTL/Persian patch, ad-hoc signed) alongside
the original `/Applications/Claude.app`. Both share one `~/Library/Application Support/Claude`
and one `vm_bundles/claudevm.bundle`, and only one process can hold that VM. Timeline from
`cowork_vm_swift.log`: the original launched 01:20:46 and booted the VM fine at 01:20:54;
Claude-RTL launched 01:29:47 and its VM start failed at 01:30:12. **Only ever run one of
the two apps.** The ad-hoc signature is *not* the cause — an earlier guess that the
restricted `com.apple.security.virtualization` entitlement was being rejected turned out
wrong, since the properly-signed app hits nothing and the failure tracks app overlap.
Claude Code in the terminal/IDE is unaffected (no VM).

**3. Only `~/.claude/projects` and `~/.claude/skills` are bind-mounted into the Cowork VM**
(per `coworkd.log`) — `~/.claude/hooks/` is not, so any hook command in
`cowork_settings.json` must be self-contained or live under a mounted path.

Related: [[claude-usage-panel-project]].


## فایل حافظه (فقط اگر Read شود) — /Users/habib/.claude/projects/-Users-habib-1-MY-WORK-186-claude-subscription-usage/memory/fable-has-its-own-weekly-quota.md (mtime 2026-08-31 14:51)
---
name: fable-has-its-own-weekly-quota
description: "Fable 5 draws from a second, separate weekly bucket on top of the shared one, so subagent fleets on Fable drain it far faster than the usage panel suggests"
metadata:
  type: reference
---

On the Max (20x) plan the `/usage` panel shows **three** limits, not two: a 5-hour session limit, a weekly **"All models"** limit, and a weekly **"Fable"** limit that is separate and tighter. Measured 2026-08-17 20:34 on acc1: session 36%, All models 7%, **Fable 11%** — Fable counts against both buckets, so its own bucket drains roughly 1.6x faster.

**Confirmed 2026-08-31 from `GET https://api.anthropic.com/api/oauth/usage`:** the `limits` array returns `kind: "session"`, `kind: "weekly_all"` (scope `null`) and `kind: "weekly_scoped"` with `scope.model.display_name: "Fable"`. `weekly_all` is a **ceiling over every model, Fable included**; the Fable row is an *extra, narrower* cap on top of it, not a reserve you fall back on. So `weekly_all` reaching 100% rate-limits everything even while Fable sits at 84% — exactly what Habib hit during a heavy refactor. Fable at 100% with `weekly_all` low blocks only Fable. Never read the Fable row as spare capacity.

**Why it matters:** a `Workflow` script's `agent()` calls inherit the parent session's model when `opts.model` is omitted. With the Effort slider on "Ultracode – xhigh + workflows" the orchestrator authors a workflow for nearly every substantive task, so a Fable parent silently spawns an all-Fable fleet. On 2026-08-17 three such runs (44 Fable subagents total) burned 155M input tokens = 11% of the Fable weekly bucket in about 4.5 hours; ~90% of it landed in two bursts. Extrapolated bucket size ≈ 1.4B input tokens/week, ≈5% per 16-agent run.

**The hard lock (set 2026-08-17):** `env.CLAUDE_CODE_SUBAGENT_MODEL = "sonnet"` in `~/.claude/settings.json`. Per Anthropic's workflow docs this env var overrides *both* the session model and any `model` a workflow script requests, so no subagent can land on Fable even if a script asks for it. This is stronger than a CLAUDE.md rule, which the model can ignore. Remove the key to go back to inheriting the session model.

**How to apply:** with the env var in place the model is handled, so no `model` arg is needed on `agent()` (still pass `'opus'` for genuinely heavy judging). What Habib wants instead — «قانون ۶» in `189th-day-hermes-agent-airdrop/CLAUDE.md`, rewritten 2026-08-17 at his request — is **no prohibition and no agent-count cap**: ask Habib before launching a Workflow or multi-agent fan-out, stating agent count, model, and estimated quota share, then proceed with whatever he approves. Coordinating with the in-loop «استاد» role does not substitute; the quota decision is Habib's. Note the panel's warning "If you see a prompt to set up usage credits for Fable, restart Claude Code" — never approve that prompt, see the ANTHROPIC_API_KEY trap in [[two-account-ide-isolation]]. Related: [[claude-usage-panel-project]].


## فایل حافظه (فقط اگر Read شود) — /Users/habib/.claude/projects/-Users-habib-1-MY-WORK-186-claude-subscription-usage/memory/habib-dont-rush-big-changes.md (mtime 2026-08-18 01:50)
---
name: habib-dont-rush-big-changes
description: "Habib gets heated fast; don't answer frustration with a pile of redesign proposals — slow down, think it through, one small step"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 2b3c354a-5e89-4294-b5cb-ffc625149760
  modified: 2026-08-17T22:20:27.647Z
---

When Habib vents about the Hermes loop ("this only benefits Anthropic", "nothing practical came out"), do NOT respond with a large redesign package or offer to launch cycles to "make it right". He said (18 Aug 2026 01:50): "من یهو تند می‌شم، شما هی می‌خواین منو راضی کنین، می‌خواین کلی تغییر بدین، آخرشم به هیچ نتیجه‌ای نمی‌رسه چون از اولش فکرشده نبوده."

**Why:** Past pattern in the project: every burst of frustration produced a big work-order (17 Aug: two of them), lots of internal fixes (48 memar findings), and almost no practical output. He sees the eagerness-to-please as the cause of the churn.

**How to apply:** Acknowledge, capture his words verbatim in the journal (journal/khastehaye-habib-*.md), and stop. Do not propose launching anything; do not ask "shall I go?". Let proposals sit as drafts until he returns calm and says which one piece to do. Prefer one small, well-thought step over a five-section plan.


## فایل حافظه (فقط اگر Read شود) — /Users/habib/.claude/projects/-Users-habib-1-MY-WORK-186-claude-subscription-usage/memory/hermes-grinder-shagerd-plan.md (mtime 2026-08-18 02:13)
---
name: hermes-grinder-shagerd-plan
description: "18 Aug 2026 plan for Hermes project — split loop into \"grinder\" (routine quests, autonomous) + \"shagerd\" (Habib teaches judgment in chat); waiting for Habib's \"برو\""
metadata: 
  node_type: memory
  type: project
  originSessionId: 2b3c354a-5e89-4294-b5cb-ffc625149760
  modified: 2026-08-17T22:43:56.937Z
---

Agreed direction on 18 Aug 2026 ~02:15 (Habib said "یه راهی بزار" — leave a way to start it), NOT yet started:

- **Grinder**: one autonomous role (mojri) on sonnet, every ~4h, runs a fixed list of routine tasks (daily check-ins, quests, discord roles, ambassador forms). Zero judgment. Sources for the list: 0xMoei (t.me/moeifam, x.com/0xMoei), Rich Kids telegram channel — both already in the telegram archive of the repo. Writes results to a table.
- **Shagerd**: daily ~20 min in chat with me (Fable): one project, I bring the dossier, Habib gives verdict + WHY, I write the why into a lesson ledger; next time I verdict first, he corrects. Success metric = how often my verdict matches his without asking.
- Everything else in the loop (naghal sweeps, memar every cycle, memory metric, 100-item desk) stays OFF. Tools (facts.py, dossier, browser, notify.py) are reused.
- Day-1 script if he says "برو": (1) pull ~10 real routine tasks from 0xMoei/Rich Kids archive → table (site, action, needs money?, signature risk); (2) Habib ticks 5 and gives one-line why each → first lessons; (3) mojri executes; (4) RabbitHole decision memo together (Habib: RabbitHole = quest broker like Galxe, used to pay well, back after a quiet period, watch for scams).

Context docs in repo `/Users/habib/1-MY-WORK/189th-day-hermes-agent-airdrop/journal/`: `research-pro-pipelines-20260818.md` (thinking + Habib's heuristics §5), `khastehaye-habib-20260818.md` (UNAPPROVED draft work-order — do not execute).

**Why:** 20 cycles / ~20h produced 4 practical actions, 0 tokens, 48 internal findings. Habib's founding intent was a "shagerd" that learns his judgment; the loop had removed him as teacher. See [[habib-dont-rush-big-changes]].

**How to apply:** If Habib says "برو" (or similar) in a new session, start with Day-1 step 1 — no workflows/fleets without asking (rule 6), no relaunching the 8-role scheduler. Fable quota is separate and tight ([[fable-has-its-own-weekly-quota]]) — fan-out on sonnet only.


## فایل حافظه (فقط اگر Read شود) — /Users/habib/.claude/projects/-Users-habib-1-MY-WORK-186-claude-subscription-usage/memory/never-logout-claude-code-multi-account.md (mtime 2026-08-10 00:54)
---
name: never-logout-claude-code-multi-account
description: "/logout revokes the OAuth refresh token server-side, killing every stored copy — warn before suggesting it"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: e00cc536-ac82-43ad-a41c-18f1aa74b2bb
  modified: 2026-08-09T21:24:24.727Z
---

Never suggest `/logout` as a way to switch Claude accounts, and warn explicitly
if a tool's setup instructions imply it.

**Why:** `/logout` revokes the refresh token *on Anthropic's servers*, not just
locally. Any copy an account-switcher stored (e.g. `claude-swap`'s keychain
entries) dies with it. On 2026-08-07 this bricked both of Habib's registered
accounts mid-setup and he abandoned the tool over it. Anthropic also rotates
refresh tokens, so a stale copy can go dead even without an explicit logout.

**How to apply:** to add a second account, use `/login` directly — it replaces
credentials without revoking. Once a switcher manages the accounts, switch only
through the switcher's own command, never through Claude Code's auth commands.
Say this *before* the user runs setup, not after it breaks.

Related: [[claude-usage-panel-project]].


## فایل حافظه (فقط اگر Read شود) — /Users/habib/.claude/projects/-Users-habib-1-MY-WORK-186-claude-subscription-usage/memory/never-patch-claude-binaries.md (mtime 2026-08-23 16:24)
---
name: never-patch-claude-binaries
description: Never modify Claude Code binaries or bypass server feature flags — against Anthropic's terms, and it breaks the environment
metadata:
  type: feedback
---

Never patch, re-sign, or otherwise modify Claude Code binaries, and never try to
flip a server-controlled feature flag. If a feature is gated off, it is
unreleased — treat it as unavailable and say so immediately instead of hunting
for a bypass.

**Why:** Two independent reasons, and either alone is decisive.
1. It is against Anthropic's terms of use. Habib has two paid accounts he cares
   about; no cosmetic feature is worth even a small risk to them.
2. It does not work in practice. Ad-hoc re-signing strips
   `com.apple.security.cs.allow-jit`, Bun then dies with
   `ReferenceError: SharedArrayBuffer is not defined`, and every IDE ships its
   own binary so the damage multiplies. Any update silently reverts it anyway.

**How to apply:** When Habib asks for a gated feature, tell him in the first
reply that it is unreleased and cannot be enabled from outside — do not spend
his time or quota exploring it. Then offer the legitimate alternative: read the
data from his own transcripts (`~/.claude/projects/**/*.jsonl`), which needs no
flag and cannot break. All patch tooling was removed on 2026-08-23 and the
binaries restored; see [[two-account-ide-isolation]] and
[[habib-dont-rush-big-changes]].


## فایل حافظه (فقط اگر Read شود) — /Users/habib/.claude/projects/-Users-habib-1-MY-WORK-186-claude-subscription-usage/memory/read-bcherny-tweets.md (mtime 2026-10-31 04:27)
---
name: read-bcherny-tweets
description: "Habib wants a few of Boris Cherny's (@bcherny, Claude Code) latest tweets read to him each time — from later sessions, not the one where he asked"
metadata:
  node_type: memory
  type: user
  originSessionId: e319bd94-76e5-4313-91fc-6a8cfc38e8a1
  modified: 2026-10-31T00:57:46.660Z
---

حبیب ۳۱ اکت ۲۰۲۶ ۰۴:۲۷: «https://x.com/bcherny — بزار اینو تو حافظت که توییتای اینو هم برام بخونی هر دفعه ای چنتاش رو -- الان نه البته بعدا».

**Why:** he follows Claude Code news (changelogs, usage tips) and bcherny is the Claude Code lead.
**How to apply:** whenever he asks for updates or news (e.g. «اپدیت جدید رو بگو»), also read a few of bcherny's newest tweets, translated into Persian in a table. x.com needs login; `https://api.fxtwitter.com/<user>/status/<id>` works for single tweets, and `/2/thread/<id>` returns the whole thread. Related: [[claude-usage-panel-project]]


## فایل حافظه (فقط اگر Read شود) — /Users/habib/.claude/projects/-Users-habib-1-MY-WORK-186-claude-subscription-usage/memory/two-account-ide-isolation.md (mtime 2026-08-23 01:44)
---
name: two-account-ide-isolation
description: "How the two Pro accounts are split between VS Code and Windsurf via CLAUDE_CONFIG_DIR, and what is shared vs isolated"
metadata: 
  node_type: memory
  type: project
  originSessionId: 1d9ecd64-0436-406f-866d-42e31e4497b9
  modified: 2026-08-23T01:45:00.000Z
---

**STATUS 2026-08-23 — ACC2 IS ARCHIVED. Everything runs on account 1 (`~/.claude`).** Habib decided the two-account split was a mistake; acc2 is a read-only archive now, not a live account. The Windsurf pin was removed on 2026-08-20 (`claudeCode.environmentVariables` is gone from the live `settings.json`; the old value survives only in `settings.json.bak.pre-acc2-removal` and Windsurf's local History). Verified: `~/.claude-acc2` holds 10 transcripts, all in `91th-day-new`, newest 2026-08-20 11:56 — nothing has been written there since. **Do not search `~/.claude-acc2` when looking for Habib's conversations, and do not re-pin any IDE to it.** The rest of this file is the historical setup, kept for the credential/API-key gotchas at the end which are still true.

---

Set up on 2026-08-12. VS Code uses the default `~/.claude` (account `habibibabobabe@gmail.com`, Pro). Windsurf is pinned to `~/.claude-acc2` for the second Pro account via the extension setting `claudeCode.environmentVariables` in `~/Library/Application Support/Windsurf/User/settings.json`:

```json
"claudeCode.environmentVariables": [
  { "name": "CLAUDE_CONFIG_DIR", "value": "/Users/habib/.claude-acc2" }
]
```

**Why:** Claude Code keys its credential store (macOS Keychain item `Claude Code-credentials`) and `.claude.json` per config dir. Without this, both IDEs share one credential store and the second login silently overwrites the first — there is no account-switch command, `claude auth` only has login/logout/status. Verified empirically: `CLAUDE_CONFIG_DIR=~/.claude-acc2 claude auth status` reports no OAuth email while the default reports the Pro account.

**How to apply:** In `~/.claude-acc2`, these are symlinks back to `~/.claude` so they stay in sync: `CLAUDE.md`, `skills/`, `plugins/`, `agents/`, `hooks/`. `settings.json` and `settings.local.json` are independent copies.

**`projects/` is NO LONGER symlinked (changed 2026-08-17).** It used to link to `~/.claude/projects`, which meant both accounts wrote chat history into one folder — acc2's conversations showed up in acc1's `/resume` list and made it unusable (436 sessions / 391 MB in one pile). The link was removed and `~/.claude-acc2/projects` is now a real empty directory; all existing history stayed under `~/.claude/projects` (acc1), nothing was deleted. Consequence: a session started in one IDE can no longer be resumed in the other, and this memory dir is no longer visible to acc2. To restore the old shared behavior: `rm -rf ~/.claude-acc2/projects && ln -s /Users/habib/.claude/projects ~/.claude-acc2/projects`.

Gotcha: `ANTHROPIC_API_KEY` is exported from `~/.zshrc` (a real `sk-ant-api03-…` key). If OAuth is missing in a config dir, Claude Code silently falls back to it and bills per token instead of the subscription. `~/.claude-acc2/config.json` therefore lists that key's id under `customApiKeyResponses.rejected` — do not "fix" that by approving it. See [[never-logout-claude-code-multi-account]] and [[claude-usage-panel-project]].
