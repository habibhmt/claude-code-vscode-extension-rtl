# بازبینیِ اپِ DSH — گزارشِ app-audit (۱۵ نوامبر ۲۰۲۶، ۰۰:۵۱ تا ۰۱:۲۰)

عکس‌ها: `/tmp/app-audit/` · آزمون‌ها: `npm test` در `dsh-side-panel/` و `dsh-session-guard/`.
اپِ اصلی ساعتِ ۰۱:۰۷ (به دستِ lead) ری‌استارت شد ⇒ کدِ تازهٔ host ِ پنل همان موقع بالا آمد و زنده سنجیده شد. تغییرهای بعد از ۰۱:۰۷ (برچسبِ «ناقص»، رقمِ فارسی در برچسب‌ها) **یک Cmd+R و یک ری‌استارتِ دیگر** می‌خواهند.

## ۱) جدولِ مشکل‌ها

| # | مشکل (به زبانِ ساده) | مدرک | علت | وضع |
|---|---|---|---|---|
| 1 | پنل: «$» در جملهٔ فارسی آن سرِ عدد می‌پرید: «0.0151$» | `01-start.webp`، `02-model-picker.webp` (نوبتِ ۲ · 0.0151$) | قاعدهٔ W2 ِ یونیکد: عددِ بعد از حرفِ فارسی «عددِ عربی» می‌شود و «$» جدا می‌افتد | ✅ درست شد: `panel-fold.js:238` (جداسازِ LRI…PDI)؛ قبل/بعد در کروم: `04-bidi-before-after.png` |
| 2 | پنل: جمعِ مدلی که قیمتش هنوز نیامده «$0.00000» نشان می‌داد | `02-model-picker.webp` («deepseek-v4.1-flash-1017: ۱ بار · 0.00000$») | در جمعِ هر مدل، «در راه» صفر حساب می‌شد | ✅ `cost-log.js` (pending/unpriced برای هر مدل) + `client.js` تابعِ `modelMoney` ⇒ «قیمت در راه…» |
| 3 | پنل: بعد از ری‌استارت جمع چند ثانیه «$0.35 ⇒ $0.69 ⇒ $1.91» بالا می‌رود و گمراه می‌کند (گزارشِ lead) | پیامِ lead ۰۱:۰۹ | قیمت‌ها یکی‌یکی از OpenRouter می‌رسند؛ باگِ دوبرابرشمردن نبود | ✅ تا «در راه» هست، کنارِ عدد «▲ ناقص — هنوز بالا می‌رود» و در قرص «…» (`client.js`، آزمونِ `test/render.test.mjs`) — نیاز به Cmd+R |
| 4 | **عددِ خرج درست است؟** | چتِ «مجری-۱۳۶»: پنل $1.9121705 (۵۵۲ رفت‌وبرگشت) ↔ جمعِ مستقیمِ OpenRouter با اسکریپتِ جدا `/tmp/app-audit/crosscheck.py` = $1.912171 (۵۵۱ gen). چتِ «قسمتی که توی کلود ام»: $0.132477 ↔ $0.132477 | — | ✅ درست است (تا رقمِ ششم برابر) |
| 5 | پنل: جوابِ OpenRouter ِ بی‌شناسه (قطع/خطا) «غیرِ OpenRouter» نامیده می‌شد | «مجری-۱۳۶»: ۱ رفت‌وبرگشت `noId` | شرط فقط به `gen-` نگاه می‌کرد | ✅ `cost-log.js` (`noId`) + متنِ جدا در پنل |
| 6 | پنل: پیامِ همتا بدونِ write-scope، در «هر نوبت چه بود» با سرصفحهٔ انگلیسیِ `[session-message] Sent by…` نشان داده می‌شد | `cost-log.js:85` (regex فقط با declared-write-scopes جور بود) | regex ِ ناقص | ✅ `cost-log.js` تابعِ `firstText` + آزمون |
| 7 | **کندی:** هر ۳ تا ۵ ثانیه لاگِ چت (۲.۶ تا ۴.۴ مگابایت zstd) با `spawnSync` باز می‌شد ⇒ رشتهٔ اصلیِ host (که جریانِ همهٔ چت‌ها را می‌گرداند) ۹۰–۱۵۰ms قفل می‌شد | اندازه‌گیری: ۲.۶MB ⇒ باز کردن ۵۱ms + پارس ۳۶ms | `decompress` ِ همگام در مسیرِ HTTP | ✅ `cost-log.js`: `decompressAsync` (zstd در پروسهٔ جدا، بی‌قفل) + یکی‌کردنِ درخواست‌های هم‌زمانِ قرص و پنل + سقفِ ۱۲ چت در حافظه. زنده: پاسخِ session-cost ‏۱۵ms |
| 8 | صفِ قیمت هر بار کامل برعکس می‌شد (ترتیب یک‌درمیان) و شناسه‌ای که در حالِ پرسیدن بود دوباره در صف می‌رفت ⇒ درخواستِ تکراری به OpenRouter | آزمونِ تازه اول قرمز شد: `['gen-3','gen-5','gen-4','gen-3',…]` | `queue.reverse()` + نبودِ فهرستِ «در پرواز» | ✅ `cost-log.js` (`fresh` + `flying`) |
| 9 | **امنیت:** مسیرهای `/plugins/side-panel/*` بی‌احراز باز بودند؛ هر صفحهٔ وب می‌توانست با POST ِ ساده در `diag.log` بی‌سقف بنویسد، یا با DNS-rebinding خرجِ چت و تکهٔ پیام‌های حبیب را بخواند | `curl` بی‌کوکی ⇒ 200؛ README ِ dsh-host-webserver: «No server-wide authentication» | سرورِ وبِ DSH احرازِ سراسری ندارد؛ هر افزونه باید خودش سد بگذارد | ✅ `index.js`: `rejectReason` (Host باید loopback، رد ِ cross-site و Origin ِ بیگانه)، diag فقط `application/json` و سقفِ ۱MB، مسیرِ diag کنارِ خودِ فایل. زنده: Host بیگانه ⇒ 403، Origin بیگانه ⇒ 403، text/plain ⇒ 415، پنلِ خودِ اپ کار می‌کند (`05-main-after-restart.webp`) |
| 10 | قرصِ پایین «بی‌قیمت» می‌نوشت (در فارسی یعنی «گران‌بها» هم) | `01-start.webp` | واژه | ✅ «قیمت ندارد» (زنده در `05-main-after-restart.webp`) |
| 11 | برچسب‌های زردِ پنل رقمِ لاتین داشتند: «318 هزار توکن»، «21 رفت‌وبرگشت» | `05-main-after-restart.webp` | `Math.round` بی‌قالبِ فارسی در host | ✅ `cost-log.js` تابعِ `faInt` — نیاز به ری‌استارت |
| 12 | دستورِ آزمون `node --test dsh-side-panel/test/` در Node 22 خطا می‌دهد (پوشه را فایل می‌گیرد) | خروجی: `Cannot find module …/test` | Node 22 پوشه نمی‌پذیرد | ✅ `npm test` (= `node --test test/*.mjs`) در هر دو `package.json` |
| 13 | dsh-session-guard هیچ آزمونی نداشت | `ls dsh-session-guard` | — | ✅ `dsh-session-guard/test/protocol.test.mjs` (۶ آزمون) — کدش ایرادی نداشت |
| 14 | پیش از ری‌استارتِ ۰۱:۰۷، host ِ پنل کدِ کهنه (۲۳:۴۶) را اجرا می‌کرد ⇒ «پولِ الکی»، «غیرِ OpenRouter» و … اصلاً نمی‌آمد و برای چتِ Claude «قیمتِ ۹ تا در راه» ِ همیشگی | `01-start.webp`؛ پاسخِ host بی فیلدهای `waste/unpriceable/topBy` | host فقط با ری‌استارتِ کاملِ اپ تازه می‌شود | ✅ با ری‌استارتِ ۰۱:۰۷ حل شد (زنده سنجیده شد) |
| 15 | قرصِ پایین «7 turns 239 steps · 144 tok/s» روی صفحه «turns 239 steps · 144 tok/s 7»؛ نوارِ To-dos هم «completed · 1 in progress · 2 pending 2» | `01-start.webp`، `05-main-after-restart.webp` | جهتِ RTL روی متنِ تمام‌لاتین | ⏳ مالِ dsh-rtl — به rtl-ui پیام دادم |
| 16 | جدولِ مارک‌داون: ستونِ فقط-✅ چپ‌چین، سرستون راست‌چین | `01-start.webp`، `03-fork-start.webp` | خانهٔ بی‌حرف ⇒ dir=auto ⇒ ltr | ⏳ dsh-rtl — پیام داده شد |
| 17 | کارتِ سؤال: «(CLAUDE.md ریشه + 186-…» به‌هم‌ریخته | `02-model-picker.webp` | bidi ِ متنِ مخلوط | ⏳ dsh-rtl — پیام داده شد |
| 18 | عنوانِ تبِ پنلِ راست («ترجمهٔ مدل») از اول بریده می‌شود: «…مهٔ مدل» | AX: تب ۱۰۰px؛ `01-start.webp` بالا | text-overflow در RTL | ⏳ dsh-rtl — پیام داده شد (اسمِ تب را عوض نکردم؛ ناظر با همین اسم تأیید کرده بود: `archive/flowchart-136/dade.json:327`) |
| 19 | خطِ «Deep diving for …s» با متنِ دیگری روی هم افتاده | `05-main-after-restart.webp` | هسته یا چیدمانِ RTL | ⏳ به rtl-ui گفته شد |
| 20 | رشته‌های انگلیسیِ هسته: New Session، Type your answer، Submit، Skip، Waiting for your action، Compacted…، Show less، PTC mode | همهٔ عکس‌ها | هستهٔ DSH فارسی ندارد | 🔧 افزونه می‌تواند: `ctx.locale.addLanguage({id:'fa', fallback:'en'})` + `ctx.locale.register(ns,'fa',…)` (README ِ dsh-client-locale). به rtl-ui گفته شد؛ پوشهٔ من نیست |
| 21 | اپِ فورک وقتی بالا می‌آید، نوبتِ در حالِ اجرای سشن‌های اپِ اصلی را «Task stopped» می‌زند (پروفایلِ مشترک) | گزارشِ lead | دو اپ روی یک پوشهٔ سشن | ⚠️ هسته؛ راهِ افزونه‌ای ندارد. قاعده: فورک را ری‌استارت نکنید. فورک همچنین عنوان/محتوای کهنهٔ همان چت را نشان می‌داد (`03-fork-start.webp`: «رفع هزینه بالا…» در برابرِ «بازطراحی…» در اپِ اصلی) |
| 22 | یک `npm exec @deepseek-ai/dsh@0.2.2-rc.1 web` از ۲۲ ساعت پیش زنده است و پورتِ 3080 را گرفته (pid 73519/73962)؛ لاگِ `~/.dsh/logs` همان خطای EADDRINUSE ِ 3080 را دارد | `ps`، `lsof`، `~/.dsh/logs/startup-2026-11-13…log:15` | پروسهٔ جامانده | ⚠️ به تصمیمِ lead (نکشتم) |
| 23 | لاگِ کنسولِ مرورگر/host | Inspector روی 127.0.0.1:9230 فقط کانتکستِ Host داد (Client وصل نبود)؛ در ~۱۵ دقیقه هیچ console از host نیامد؛ `~/.dsh/logs` فقط لاگِ قدیمِ ۱۳ نوامبر | — | ℹ️ خطای تازه‌ای از افزونه‌های ما دیده نشد |

## ۲) چه چیزی عوض شد (فقط پوشه‌های خودم)

| فایل | تغییر |
|---|---|
| `dsh-side-panel/panel-fold.js` (و کپیِ خودکارش در `client.js` با `tools/sync-fold.mjs`) | `faMoney` با LRI…PDI |
| `dsh-side-panel/cost-log.js` | `decompressAsync` + `createLogCache` ِ ناهمگام با یکی‌کردنِ درخواست و سقفِ ۱۲؛ صفِ قیمت (`fresh`/`flying`)؛ `pending/unpriced` ِ هر مدل؛ `noId`؛ سرصفحهٔ پیامِ همتا؛ `faInt` |
| `dsh-side-panel/index.js` | `chatCost` ناهمگام؛ `rejectReason`/`refuse` روی هر سه مسیر؛ diag: فقط JSON، سقفِ ۱MB، مسیر کنارِ فایل |
| `dsh-side-panel/client.js` | `modelMoney`، متنِ `noId`، «ناقص» تا قیمت‌ها کامل شوند، «قیمت ندارد» |
| `dsh-side-panel/test/*` | آزمون‌های تازه: هم‌زمانی، رشتهٔ اصلیِ آزاد، صفِ قیمت، سرصفحهٔ همتا، noId، سدِ مسیرها، رندرِ jsdom (`render.test.mjs`) |
| `dsh-session-guard/test/protocol.test.mjs`، دو `package.json` | آزمونِ تازه + اسکریپتِ `npm test` |

## ۳) سنجش

| چه | نتیجه |
|---|---|
| `npm test` در dsh-side-panel (قبل) | `node --test …/test/` ⇒ خطا (۰/۱)؛ با glob ۴/۴ سبز |
| `npm test` در dsh-side-panel (بعد) | ۵/۵ فایل سبز (client، cost، fold، host، render) |
| `npm test` در dsh-session-guard | ۶/۶ سبز |
| خرابکاریِ عمدی (روی کپی در `/tmp/app-audit/sab-*`) | برگرداندنِ decompress ِ همگام ⇒ قرمز؛ برداشتنِ `flying` ⇒ قرمز؛ خراب‌کردنِ regex ِ همتا ⇒ قرمز؛ برداشتنِ «ناقص» ⇒ قرمز؛ برداشتنِ «در راه» ِ مدل ⇒ قرمز |
| زنده بعد از ری‌استارتِ ۰۱:۰۷ | پنل و قرص کار می‌کنند (`05-main-after-restart.webp`)؛ ۴ آزمونِ curl ِ سد (403/403/415/403)؛ جمعِ دو چت با OpenRouter برابر |

## ۴) چه مانده / چه لازم است

| کار | کی |
|---|---|
| یک Cmd+R روی پنجرهٔ اپ ⇒ «ناقص» و «…» دیده شود | هر وقت حبیب خواست |
| یک ری‌استارتِ اپِ اصلی ⇒ رقمِ فارسی در برچسب‌های زرد (ردیفِ ۱۱) | حبیب (اپِ فورک را ری‌استارت نکنید) |
| ردیف‌های ۱۵ تا ۲۰ | rtl-ui |
| ردیف‌های ۲۱ و ۲۲ | lead |
