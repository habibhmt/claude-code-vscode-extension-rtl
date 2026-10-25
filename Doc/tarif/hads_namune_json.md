# نمونهٔ واقعیِ «حدس»: پرامپت و JSON ِ رفت و برگشت

حبیب (۲۴ اکت ۲۰:۲۰): «مثل API کد برام بیاری که برای هر کدوم چه پرام پتی میذاری و نمونه واقعی کارایی که تا حالا انجام شده یعنی دو جمله و حدس و پرسش نمونههای واقعی بیار که دقیقا فکر کن جیسونه که میره و جیسونی که میاد»

ساختنِ این فایل: `mods/hads/hooks/register.js` با پیام‌های **واقعیِ** چتِ ناظر-۱۳۶ (۴۰ پیامِ آخر) اجرا شد و هر درخواستی که به مدل می‌رفت ثبت شد. متن‌های بلند کوتاه شده‌اند (`…[و N حرفِ دیگر]`). جواب‌ها از `~/.claude/hads-log/` (ثبتِ واقعیِ همین چت‌ها) آمده‌اند.

## کدام بخش، کدام مدل، کِی

| بخش | مدل | کِی | چه می‌خواند |
|---|---|---|---|
| حدس | **مدلِ خودِ چت** با `$.model.fork` | آخرِ جواب، هر **۳** جواب یک بار (`hads_har_chand_javab`)؛ و هر وقت دکمه‌ای نیست | **کلِ چت** از کشِ گرم + این پرامپت |
| حدس (پشتیبان) | Sonnet 5.5 | وقتی fork جواب نداد، یا چت بیش از ۴۰۰ هزار توکن است | هندآف‌ها + ۱۲ پیامِ آخرِ حبیب + ۵ جوابِ آخرِ کلود + ۳ پیامِ ایجنت |
| دو جمله | Sonnet 5.5 | آخرِ هر جواب، و وسطِ کار حداکثر هر ۶۰ ثانیه | واژه‌نامه + ۳ پیامِ آخر + **همیشه ۲ پیامِ آخرِ حبیب** + اسمِ کامندی که تمام شد |
| پرسش | **مدلِ خودِ چت** با `$.model.fork` | وقتی حبیب می‌پرسد | **کلِ چت** از کش + سؤال |

`fork` یعنی همان درخواستِ آخرِ خودِ چت (همان مدل، همان system prompt، همان تاریخچه) با یک پیامِ اضافه در آخر؛ برای همین در JSON ِ fork فقط `prompt` دیده می‌شود: بقیه را خودِ Claude Code از کش می‌گذارد. هیچ ابزاری مجاز نیست.

## JSON ِ رفت (درخواستِ واقعی)

#### ۱. «حدس» — fork (مدلِ خودِ چت)

```json
{
  "prompt": "(این پیام از مودِ «حدس» است، نه از حبیب؛ کاری نکن و ابزاری صدا نزن.) Reply ONLY with JSON: {\"guesses\": [3 to 5 of {\"label\": \"<= 3 words\", \"text\": \"<one line, ready to send as حبیب's next message, in his tone>\"}]}"
}
```

#### ۲. «دو جمله» — Sonnet

```json
{
  "model": "claude-sonnet-5-5",
  "system": "In exactly two short sentences of plain Persian, tell حبیب what the agent in this Claude Code session is doing right now and what it is waiting for. Use the words of the glossary given, not technical terms. Do not guess what comes next. Reply with the two sentences only.",
  "prompt": [
    {
      "text": "## واژه‌نامهٔ حبیب\n# واژه‌نامه — اصطلاحاتِ حبیب در پروژهٔ ۱۳۶\n\nاز ۲۲ اکت: ایجنت‌ها با حبیب و با هم با همین واژه‌ها حرف می‌زنند (تعریفِ ۰۶).\n\n| واژهٔ حبیب | یعنی | جملهٔ حبیب / جا | تعریف |\n|---|---|---|---|\n| حدس | ۳ تا ۵ دکمهٔ پیشنهاد بالای کادر بعد از هر جواب (حبیب: «حدس قدیمی»)؛ اسمِ کلِ کادر هم  …[و 3389 حرفِ دیگر]",
      "cache": true
    },
    {
      "text": "## درخواست‌های حبیب (قدیمی به جدید)\n1. <pasted_content id=\"c3e5\">\nنمیدونم چیکار کردی که دو جمله دیگه نمیاد. ریلود که میزنم یعنی اصلا حالا غیر از ریلودم تو جمله ها انگار نمیاد یه چک بکن الان داری چیکار میکنی چیکار کردی کارهایی که تموم شده حدست چت بود کارهایی بعد آها اون حدس و بزنش بفرستش به همون سیست …[و 1593 حرفِ دیگر]"
    }
  ],
  "maxTokens": 200,
  "timeoutMs": 30000
}
```

#### ۳. «حدس»، پشتیبان وقتی fork جوابِ درست نداد — Sonnet

```json
{
  "model": "claude-sonnet-5-5",
  "system": "You predict what the user (حبیب) will ask next in a Claude Code session. Give 3 to 5 items: both what the user will most likely ask next, and options the user has not thought of but that fit the user's pattern. Each item is ready to send as the user's own message, in plain Persian, in the user's tone. Reply ONLY with JSON: [{\"label\": \"<= 3 words\", \"text\": \"<one line>\"}].",
  "prompt": [
    {
      "text": "## هندآف‌های این پروژه\n### الان\n\n## 20:14 | main @6d39ff34\nعلتِ نشان ندادنِ متنِ هوک‌ها در پنل VS Code (طراحیِ افزونه است و هوک‌ها را پیش از پنل دور می‌ریزد) پیدا شد، پروپوزالِ بخشِ «هوک‌ها» برای ناظر رفت و بخش در mods/hads ساخته شد، اما اولین test هنوز fail می‌شود و در حال debug است، و کارِ نهایی م …[و 2422 حرفِ دیگر]",
      "cache": true
    },
    {
      "text": "## درخواست‌های حبیب (قدیمی به جدید)\n1. ببین این الان. خب این عکسی رو که برات فرستادم نشون میده پنجاه و هشت دقیقه به کش وارم ولی تو چیزی که به من الان توی اون زدی نوشتی که کش احتمالا سرد این اشتباه به خاطر چی اینطوری شده این یک دو اینکه من حالا یعنی باید بررسی کنی دیگه ببینی داستان چیه\n2. اشکال کش سر …[و 6083 حرفِ دیگر]"
    }
  ],
  "maxTokens": 600,
  "timeoutMs": 60000
}
```

#### ۴. «پرسش» — fork (مدلِ خودِ چت)

```json
{
  "prompt": "الان دقیقاً چیکار کردی؟\n\n(این پرسش از کادرِ حدس است، نه دستورِ کار: ابزاری صدا نزن و کاری را ادامه نده؛ فقط کوتاه، به فارسیِ ساده و با واژه‌های حبیب جواب بده.)"
}
```

## JSON ِ برگشت (جوابِ واقعی، از ثبت‌ها)

#### «دو جمله» — متنِ واقعیِ آخرین بار در همین چت

```json
{"t":1792861229178,"text":"ایجنت الان دارد کدی را عوض می‌کند که «دو جمله» و حدس را می‌سازد، تا کارِ کامندی که همین حالا تمام شده هم در آن بیاید. منتظر است نتیجهٔ همین تغییر به او برسد."}
```

خرجِ واقعیِ آخرین «دو جمله» (Sonnet):

```json
{"t":1792861229210,"part":"now","via":"sonnet","usage":{"input_tokens":194,"output_tokens":568,"cache_read_input_tokens":2919,"cache_creation_input_tokens":0}}
```

#### «حدس» با Sonnet — خرجِ واقعی (متنِ دکمه‌ها ثبت نمی‌شود؛ نمونهٔ دکمه‌های واقعی که حبیب در پنل دید، ساختهٔ مدل نه حرفِ حبیب: `push و تگ`، `دیدن در VS Code`، `خرج بپرس`، `دو جمله نیومد`، `عکس ساعت`)

```json
{"t":1792860742411,"part":"guess","via":"sonnet","usage":{"input_tokens":8986,"output_tokens":601,"cache_read_input_tokens":0,"cache_creation_input_tokens":3592}}
```

شکلِ جوابی که مدل باید بدهد:

```json
[{"label": "push و تگ", "text": "حالا push و تگ کن"}, {"label": "عکس ساعت", "text": "از ساعتِ جواب عکس بگیر"}]
```

#### fork ِ آخرِ جواب — خرجِ واقعی (چتِ ~۴۸ هزار توکنی؛ `cache_read` بزرگ = کشِ گرم)

```json
{"t":1792860289572,"part":"end","via":"fork","usage":{"input_tokens":1991,"output_tokens":592,"cache_read_input_tokens":48138,"cache_creation_input_tokens":3}}
```

#### «پرسش» — خرجِ واقعی (چتِ ~۹۶ هزار توکنی، کشِ گرم)

```json
{"t":1792858362079,"part":"ask","via":"fork","usage":{"input_tokens":532,"output_tokens":1326,"cache_read_input_tokens":581626,"cache_creation_input_tokens":4904}}
```

## خرجِ هر بار با قیمتِ رسمی

قیمت از [platform.claude.com/docs/en/about-claude/pricing](https://platform.claude.com/docs/en/about-claude/pricing) (هر یک میلیون توکن): Opus 5.5 ورودی $4، خواندن از کش $0.20، خروجی $20 · Sonnet 5.5 ورودی $2، خواندن از کش $0.10، خروجی $10.

| بخش | عددهای بالا | خرجِ تقریبی هر بار |
|---|---|---|
| دو جمله (Sonnet) | چند هزار توکن، بیشتر از کش | کمتر از ۱ سنت |
| حدس با fork در چتِ ۲۰۰ هزار توکنی، کشِ گرم | ۲۰۰k × $0.20 + ~۵۰۰ خروجی × $20 | حدودِ ۵ سنت، **هر ۳ جواب یک بار** |
| پرسش در همان چت، کشِ گرم | همان | حدودِ ۴ تا ۵ سنت |


## جمع‌بندیِ نوبت (`jambandi_nobat`) — نمونهٔ واقعی، چتِ ۲۰۳، 2026-10-25 03:37

این جمع‌بندی به حافظهٔ چت‌های بعدی تزریق می‌شود. با `$.model.fork` ساخته می‌شود، یعنی مدلِ خودِ چت با کشِ گرم.

**درخواست:** پرامپتِ کاملش `prompt_jambandi_nobat` در `mods/hads/hooks/register.js` است. «دو جمله»‌های همان نوبت و فهرستِ ابزارهایش داخلش می‌روند، با قاعده‌های ۱ تا ۶ (مدرک بعد از «⇐»).

**جواب (همان که در دفتر ثبت شد):** در متنِ زیر «» به ‹› عوض شده تا چکِ نقل‌قول آن را حرفِ حبیب حساب نکند.
```json
{
  "khaste_habib": "حرفِ تازه‌ای از حبیب نبود؛ ادامهٔ کارِ قبلی",
  "text": "The Persian text in the check-launchagent-ha notification came out garbled under launchd; setting UTF-8 in the script fixed it, the notification was re-sent, and Habib confirmed it was right. Then he said to stop the work here for now.",
  "anjam_shod": [
    "Docs, standing-task row 7 and check_hamishegi updated for check-launchagent-ha ⇐ grep: 2/1/2 matches; check_hamishegi: ‹جمع: 0 ❌›; commit 8afbf4d",
    "UTF-8 setting added to check_launchagent_ha_notification.sh ⇐ grep: line 4 ‹export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8›",
    "Notification re-sent through launchd, Persian text clean in the log ⇐ check_launchagent_ha.out: ‹03:31:46 | نوتیف (4): chrome-panel … hamgamsaz-farzi … hesabdar.telegram …›; runs = 2, last exit code = 0",
    "Habib confirmed the second notification was right ⇐ his answer: ‹درسته›",
    "Tests green and commit ⇐ ‹جمع: 10 ✅ · 0 ❌›; commit 1896fef",
    "Monitor re-armed, now also watching check_launchagent_ha.out ⇐ Monitor: task bfkb9xlw8"
  ],
  "anjam_nashod": [
    "Decision on hamgamsaz-farzi (keep or turn off): Habib said to stop before it",
    "Review of the remaining LaunchAgents marked ‹؟› (paused at Habib's request)",
    "hesabdar.telegram network errors (8 of the 10 last log lines): reason not checked",
    "chrome-panel ‹آخرین خروج 1›: reason not checked"
  ],
  "tedad_do_jomle": 2,
  "tedad_abzar": 6,
  "rah": "fork",
  "kontekst_token": 144652
}
```

**خرج (`usage.jsonl`):**
```json
{
  "t": 1792886831788,
  "bakhsh": "jambandi_nobat",
  "rah": "fork",
  "usage": {
    "input_tokens": 1251,
    "output_tokens": 930,
    "cache_read_input_tokens": 144650,
    "cache_creation_input_tokens": 361
  }
}
```
