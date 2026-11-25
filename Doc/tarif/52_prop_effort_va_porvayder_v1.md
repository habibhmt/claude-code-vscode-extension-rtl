# پروپوزال ۵۲ — افورتِ مدل و برچسبِ پرووایدر در منوی VS Code

> **وضعیت (۲۶ نوامبر ۲۰۲۶ ۰۱:۱۰): اجرا شد — گزینهٔ «الف».** حبیب: «الف، فقط ۱۶۰ ردیفِ مدرک‌دار». نگاشتِ `abzar/darvaze/claude-api/model-caps-picker.json` (۱۶۰ از ۴۱۱) · `gatewayChoices()` افورت را فقط روی ردیف‌های مدرک‌دار می‌گذارد · `family` = برچسبِ خانواده (سرتیترِ یکتا) · پچِ رندر v2. جزئیات و خرابکاری‌ها: `Doc/tarif/19_open_tasks.md` ردیف ۱۲۲.

منبع: حبیب، ۲۵ نوامبر ۲۰۲۶ ۲۱:۱۳ (دو پیام، عیناً):
> «از وقتی که این پچ زده شده اون حالتی هست که توش میتونی افورت مدل رو تعیین کنی دیگه نیستش»
> «مگه این از دروازه نمیاد ؟ چرا برچسب پرووایدر توش معلوم نیست ؟ کار اصولی میخوام پروپوزال اجراییت رو بده که این دروازه را با ام سی پی سرچ حافظه دربیار چه کارهایی روش شده تا بتونیم ادامه همون رو بریم»

و از حافظهٔ همین پوشه (چکیدهٔ ۲۴ نوامبر ۰۰:۳۷–۰۰:۵۳):
> «منوی effort/ultracode که بعد از افزودن opencode از `claude-ui-buttons.js` رفته بود اصلاح» — یعنی این بارِ دوم است که افورت قربانیِ یک تغییرِ دروازه می‌شود؛ دفعهٔ اول در ترمینال، این بار در منوی VS Code.

---

## ۱ · جوابِ کوتاه به دو سؤالِ حبیب

| سؤال | جواب | مدرک |
|---|---|---|
| «مگه این از دروازه نمیاد؟» | **نه — و حق با حبیب است: این باگِ پچ است.** در کلود کدِ دست‌نخورده، تواناییِ افورت از فیلدهای همان ردیفِ منو می‌آید (`supportsEffort`، `supportedEffortLevels`، …) و ردیف‌های منو هم از کاتالوگِ خودمان می‌آمدند که **همهٔ این شش فیلد را داشت**. پچِ ۲۱:۱۳ منبعِ فهرست را به دروازه برد، و `gatewayChoices()` فقط `value/displayName/description/group/family/familyLabel` ساخت ⇒ شش فیلدِ توانایی از ردیف‌ها افتاد. دروازه هیچ‌وقت این‌ها را نداشت و لازم هم نیست داشته باشد. | `python3` روی `claude-api/deepseek-models.json`: ۵۷ ردیف، **۵۷ از ۵۷** با `supportsEffort:true` و پنج فیلدِ دیگر · `node -e modelChoices()` امروز: ۴۱۰ ردیف، **۰** با `supportsEffort` · `webview/index.js`: منو فقط `currentModelInfo.value?.supportsEffort` را می‌خواند |
| «چرا برچسبِ پرووایدر معلوم نیست؟» | دو چیز با هم: (الف) پیشوندِ قدیمیِ «— OpenRouter API Key» در ردیف‌های دروازه گذاشته نمی‌شود؛ (ب) بدتر، سرتیترِ گروه و سرتیترِ خانواده هر دو یک متن‌اند (`'OpenCode Go'`) ⇒ منو **دو بار** «OpenCode Go» می‌نویسد، همان‌طور که در عکسِ حبیب هست. | `vscode_model_catalog.cjs:140` و `:142` هر دو `'OpenCode Go'`/`'OpenRouter'` · `patch_model_groups.py:43-48` دو سرتیتر جدا می‌کشد · `webview/index.js`: `__ccg1` برای `group`، `__ccg2` برای `familyLabel` |

---

## ۲ · آنچه امروز با فرمان سنجیده شد (نه حدس)

| # | ادعا | فرمانِ سنجش | نتیجهٔ عینی |
|---|---|---|---|
| ۱ | منوی VS Code افورت را از فیلدِ همان ردیف می‌خواند، نه از سرور | `grep -c supportsEffort ~/.vscode/extensions/anthropic.claude-code-2.1.332/webview/index.js` | ۵ بار؛ از جمله `currentModelSupportsEffort=…this.currentModelInfo.value?.supportsEffort??!1` و `if(O?.supportsEffort){…supportedEffortLevels??["low","medium","high"]}` |
| ۲ | ردیف‌های دروازه این فیلد را ندارند ⇒ اسلایدر نمی‌آید | `sed -n '129,150p' abzar/darvaze/scripts/vscode_model_catalog.cjs` | `gatewayChoices()` فقط `value/displayName/description/group/family/familyLabel` می‌سازد |
| ۳ | ریشهٔ حذف، پچِ ۲۱:۱۳ است (منبعِ فهرست از کاتالوگ به دروازه رفت) | `sed -n '120,133p'` همان فایل | `gatewayChoices()` اول صدا زده می‌شود و اگر `merged-models.json` باشد، مسیرِ کاتالوگِ قدیمی (که `— OpenRouter API Key` و `group` می‌ساخت) دیگر اجرا نمی‌شود |
| ۴ | سرتیترِ دوتایی از خودِ پچِ ماست | `git grep -n "__ccg1" abzar/darvaze/scripts/patch_model_groups.py` | خطِ ۴۳–۴۸: برای `group` یک `div` و برای `familyLabel` یک `div` دیگر |
| ۵ | «افورت واقعاً به بالادست می‌رسد» | پروکسیِ موقتِ ثبتِ بدنه روی `50993` + دو تماسِ واقعی `claude -p --effort high` | بدنهٔ هر دو: `"output_config":{"effort":"high"}` · `"thinking":{"type":"adaptive","display":"omitted"}` · پاسخ ۲۰۰؛ ردیفِ `usage.jsonl` هم ثبت شد |
| ۶ | فرستادنِ افورت به envِ خاصی گره نخورده | همان آزمون، یک بار با `CLAUDE_CODE_MODEL_CAPABILITIES="effort"` و یک بار بی آن | **هر دو** `has_effort:true` ⇒ برای مسیرِ `--effort`، سدّ اصلی UI است نه درخواست |
| ۷ | اگر بالادست افورت را نپذیرد، کلاینت می‌شکند؟ | خواندنِ رشتهٔ خطا در باینریِ ۲٫۱٫۳۳۲ | ۴۰۰ با پیامِ `output_config.effort` ⇒ تلاشِ دوباره **بدون افورت** و قفل‌شدنِ آن مدل در همان پروسه (`tengu_effort_unsupported_retry`) ⇒ افتادنِ نرم، نه خطا |
| ۸ | گزینه‌های ممکنِ افورت در کلیِنت | همان باینری | `["low","medium","high","xhigh","max"]`؛ پیش‌فرضِ نمایش `["low","medium","high"]` |
| ۹ | عددِ وضعیتِ فعلیِ منو | `node -e "…modelChoices()…"` | **۴۱۰ ردیف · ۴۱۰ ردیف `group===familyLabel` · ۰ ردیف `supportsEffort`** ⇒ سرتیترِ دوتایی برای همه، اسلایدر برای هیچ‌کس |
| ۱۰ | **کاتالوگِ قبلی این فیلدها را داشت** (نقدِ حبیب: «اکستنشن دیفالت این را دارد؛ اشکالِ پچ است») | `python3 -c "import json;rows=json.load(open('abzar/darvaze/claude-api/deepseek-models.json'));print(len(rows), sum(1 for r in rows if r.get('supportsEffort')))"` | **۵۷ ۵۷** — هر ۵۷ ردیف `supportsEffort:true` و `supportedEffortLevels:["low","medium","high","max"]` و `supportsAdaptiveThinking`/`supportsThinkingOff`/`supportsAutoMode`/`supportsFastMode`. مسیرِ قدیمی با `...row` همین‌ها را به منو می‌داد |
| ۱۱ | تفاوتِ ردیفِ قدیمی و ردیفِ دروازه، تنهاتر از افورت است | `node -e` روی همان دو مسیر | قدیمی: `{"value":"deepseek/…@preset/…","displayName":"… · DeepInfra ⭐ — OpenRouter API Key","supportsEffort":true,…}` · دروازه: `{"value":"deepseek-v4.1-flash","displayName":"DeepSeek V4.1 Flash 1017","group":"OpenCode Go","familyLabel":"OpenCode Go"}` |

**دو ادعای اثبات‌نشده که در گزارش جدا می‌شوند:**
- «با تغییرِ افورت، رفتارِ مدل عوض می‌شود» — نرسیدنِ فیلد اثبات شد، اثرگذاریش نه. آزمونش در بخشِ ۵.
- «اسلایدری که در UI می‌آید، انتخابش به درخواست می‌رسد» — برای ترمینال کدِ `ev()` جلویش را می‌گیرد؛ برای مسیرِ VS Code باید با پروکسی پس از پچ سنجیده شود.

---

## ۳ · پروپوزال — پس از نقدِ حبیب («این اشکالِ پچ است»)

**تصحیحِ مسیر:** پیشنهادِ اولیهٔ من (گزینهٔ ب: دروازه `efforts` بدهد) **زیادی بود**. تواناییِ افورت مالِ خودِ اکستنشن است و کاتالوگِ قبلی هم آن را داشت؛ پچ فقط آن را گم کرد. درست این است که **پچ همان شش فیلد را دوباره بگذارد**، نه اینکه دروازه صاحبِ مفهومِ تازه شود.

### گزینهٔ انتخابی: «پچ فیلدها را پس بدهد» (کمینه، با منبعِ دادهٔ موجود)

| گام | فایل | تغییر | چرا |
|---|---|---|---|
| ۱ | `claude-api/model-caps-picker.json` (تازه، یا بلوک در `providers.toml`) | نگاشتِ شناسه/خانواده ⇒ `{supportsEffort, supportedEffortLevels, supportsAdaptiveThinking, supportsFastMode, supportsAutoMode, supportsThinkingOff}`؛ **منبعِ سنجیده:** `claude-api/openrouter-catalog.json` (فیلدِ `reasoning`، ۱۶۳ ردیف از ۳۹۱) + کاتالوگِ قدیمی برای سه شناسهٔ مشترک (`claude-haiku-5-5`، `deepseek-v4-pro`، `deepseek-v4.1-flash`) | «عدد فقط در یک فایل»؛ کد مقدار نمی‌سازد · **پوششِ صادقانه: ۱۶۰ ردیف از ۴۱۰** (۱۵۷ OpenRouter + ۳ OpenCode)؛ بقیه بی‌اسلایدر |
| ۲ | `vscode_model_catalog.cjs::gatewayChoices()` (خطِ ۱۲۹–۱۴۳) | ردیف‌ها `...caps(...)` بگیرند؛ مدلِ بی‌داده ⇒ کلیدها نیایند (یعنی اسلایدر نیست، نه اسلایدرِ دروغین) | همان فیلدی که webview می‌خواند (`currentModelInfo.value?.supportsEffort`) |
| ۳ | همان تابع | `displayName = name + ' · OpenCode Go'` (یا `· OpenRouter`)؛ `familyLabel` = نامِ خانواده (`DeepSeek`, `Gemini`, …) نه نامِ گروه | برچسبِ پرووایدر + رفعِ سرتیترِ دوتایی؛ شکلِ ۱ که حبیب انتخاب کرد |
| ۴ | `abzar/darvaze/scripts/test_model_groups.cjs` | دو شرطِ تازه: هیچ ردیفی `group===familyLabel` نباشد؛ ردیف‌های گفتگوییِ opencode `supportsEffort` داشته باشند (مدلِ embedding نه) | آزمون، جلوی برگشتِ باگ را می‌گیرد |
| ۵ | `./fix-rtl-claude.sh --with-font` + Reload پنجره | پچِ زنده روی ۲٫۱٫۳۳۲ و ۳۳۲ِ Windsurf | بدونِ Reload دیده نمی‌شود (ردیفِ ۱۱۶ دفتر) |

**گزینه‌های رد‌شده:** الف) افورتِ یکسان برای همه (اسلایدرِ دروغین) · ج) env (اسلایدر نمی‌آورد) · ب) دادنِ `efforts` از دروازه — کارِ درست ولی **لازم نیست**؛ اگر بعداً هارنسِ دیگری خواست، به‌عنوانِ فازِ دوم روی همین نگاشت سوار می‌شود.

### برچسبِ پرووایدر — انتخابِ حبیب: شکلِ ۱

| شکل | نمونهٔ منو | وضعیت |
|---|---|---|
| ۱ (انتخابِ حبیب) | سرتیترِ درشت: `OpenCode Go` / `OpenRouter` · زیرسرتیتر: `DeepSeek` · ردیف: `DeepSeek V4.1 Flash 1017 · OpenCode Go` | **انتخاب شد** |
| ۲ | فقط ردیف، بی سرتیتر | رد شد |
| ۳ | همان دو سرتیترِ فعلی با متنِ متفاوت | رد شد |

زیرپرووایدرِ OpenRouter (DeepInfra و…) امروز در `openrouter-models.json` نیست؛ اگر حبیب بخواهد، از `/api/v1/models`ِ OpenRouter گرفته می‌شود — کارِ جدا.

---

## ۴ · آزمون و خرابکاریِ عمدی (پیش از «انجام شد»)

| آزمون | فرمان | سبز یعنی |
|---|---|---|
| ۱ | `node abzar/darvaze/scripts/test_model_groups.cjs` | هر ردیف `group` و `familyLabel` دارد و **متفاوت‌اند** |
| ۲ | `node --check` روی `vscode_model_catalog.cjs` + فراخوانیِ `modelChoices()` | ۴۱۰ ردیف؛ ردیف‌های گفتگوییِ opencode `supportsEffort` دارند؛ مدل‌های بی‌داده فیلد ندارند |
| ۳ | پروکسیِ موقت + اسلایدر را در UI از `low` به `high` ببر | بدنهٔ درخواست: `output_config.effort` از `low` به `high` عوض شود |
| ۴ | همان پروکسی، مدلی که در نگاشت نیست | `has_effort:false` و اسلایدر در منو نباشد |
| ۵ | خرابکاری: نگاشتِ یک مدل را از `model-caps-picker.json` بردار | اسلایدرِ همان مدل برود؛ آزمون ۲ قرمز بدهد |
| ۶ | خرابکاری: `familyLabel` را دوباره `'OpenCode Go'` کن | آزمون ۱ قرمز بدهد |

**▪ باطل می‌شود اگر:**

| شرطِ باطل با کلماتِ حبیب | فرمان |
|---|---|
| «باز اسلایدر نیست» | عکسِ منو + `grep -c "supportsEffort" ~/.vscode/extensions/anthropic.claude-code-2.1.332/webview/index.js` (باید ۵ بماند) و ردیفِ `supportsEffort` در `node -e "require('./abzar/darvaze/scripts/vscode_model_catalog.cjs').modelChoices()"` |
| «باز دو بار اسمِ پرووایدر نوشته» | `node -e "…modelChoices().filter(r=>r.group===r.familyLabel).length"` باید ۰ باشد |
| «افورت را که عوض کردم هیچ فرقی نکرد» | پروکسی: `output_config.effort` در بدنهٔ دو تماس پشتِ‌سرهم باید متفاوت باشد |
| «این عدد از کجا آمد» | `curl -s 127.0.0.1:50990/v1/models \| python3 -c "import json,sys;…"` و `tail -1 .runtime/opencode-go/usage.jsonl` |

---

## ۵ · چیزی که این پروپوزال عمداً سنجیده و حل نمی‌کند

۱. **اثرِ واقعیِ افورت روی DeepSeek**: بدنه فیلد را دارد و ۲۰۰ می‌گیرد؛ ولی «کمتر فکر می‌کند» اثبات نشده. آزمونِ بعدی: یک پرامپتِ ثابت با `--effort low` و `--effort xhigh`، مقایسهٔ `output_tokens` و `thinking_tokens` در `usage.jsonl` (۳ بار هر کدام).
۲. **زیرپرووایدرِ OpenRouter** (کدام شرکت مدل را سرو می‌کند): داده‌اش امروز در فهرست نیست.
۳. **پنجره‌های دیگر** (Windsurf): پچ یکی است، ولی Reload و عکسِ هر IDE جدا سنجیده می‌شود.

---

## ۶ · وضعیتِ فعلی و کارهای قبلی که به این وصل‌اند

| چه چیزی قبلاً شد | کجا |
|---|---|
| منوی ۴۱۰ ردیفی از دروازه | `vscode_model_catalog.cjs::gatewayChoices()` + کامنتِ `حبیب ۲۱:۱۳` |
| سرتیترِ گروه و خانواده | `patch_model_groups.py` + ردیفِ ۱۱۶ دفتر |
| افورتِ ترمینال (دفعهٔ اول) | `claude-ui-buttons.js:3045-3109` (پنلِ mod، نه منوی VS Code) |
| آپدیت ۲٫۱٫۳۳۲ و چهار لنگرِ شکسته | ردیف‌های ۱۱۶–۱۱۷ دفتر |
