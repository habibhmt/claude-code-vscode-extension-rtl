> نسخهٔ تاریخیِ بازیابی‌شده از ۲ آبان ۱۴۰۵ (۲۴ اکتبر ۲۰۲۶)، نه راهنمای به‌روز. ادعاهای قیمت، سهمیه، مدل و قابلیت‌های این متن امروز تأیید نشده‌اند. برای حساب فعلی، گزارش اشتراک ۱۱ آبان را ببینید.
> بازیابی از Write خط ۸۲۲۵ و Editهای ۸۳۱۴، ۸۳۱۸، ۸۳۲۲ و ۸۳۸۳ چت e319bd94؛ فراخوانی‌های تکراری دوباره اعمال نشدند.

# قابلیت‌های Claude Code ⟷ معادلِ ChatGPT (اشتراکِ Pro ۱۰۰ دلاری) — ۲۴ اکت ۲۰۲۶

منبعِ «روی مک»: `/Applications/ChatGPT.app/Contents/Resources/codex-cli/bin/codex` (`codex-cli 0.163.0-alpha.11.1`)، `~/.codex/config.toml`، `~/.codex/sessions/`. به `auth.json` دست نزدم. هیچ فایلی عوض نشد.
منبعِ «سند»: learn.chatgpt.com (developers.openai.com/codex به آن redirect می‌شود) و help.openai.com.

| # | قابلیتِ Claude Code (کجا پیدا شد) | معادلِ ChatGPT / Codex | روی مکِ حبیب | وضع |
|---|---|---|---|---|
| ۱ | ریستِ ۵ ساعته | «Pro plans currently have no five-hour limit» ([pricing](https://learn.chatgpt.com/docs/pricing)) | `rate_limits.secondary = null` ⇒ پنجرهٔ ۵ ساعته ندارد | نیست، و لازم هم نیست |
| ۲ | سقفِ هفتگی | هست: «Weekly limits may also apply» | `window_minutes 10080` (۷ روز) · **۹۶٪ مصرف‌شده** (۱۴:۳۳ امروز) · ریست: **شنبه ۳۱ اکت، ۰۳:۳۱** · `plan_type "prolite"` | هست |
| ۳ | سهمیهٔ جدای Fable (memory) | سند پیدا نکردم. فقط Ultrafast = ۸ برابر مصرف، و فقط برای Pro ۵۰۰ | فقط یک سقف: `limit_id "codex"` | سند پیدا نکردم |
| ۴ | دکمهٔ Reset for free (۲۷ سپت) | **ریستِ پولی** از Settings → Usage: ذخیره نمی‌شود، و ریستِ بعدی ۷ روز بعد از خرید است ([help](https://help.openai.com/en/articles/20001507-paid-weekly-work-and-codex-rate-limit-resets)؛ صفحه 403 داد و متن از خلاصهٔ سرچ است) | چک نکردم | نصفه (رایگان نیست) |
| ۵ | اعتبارِ Cloud (bonus، ۱۳۳ دلار) | Codex Cloud هست (`codex cloud exec`)؛ برای اعتبارِ جدا سند پیدا نکردم | `codex cloud` هست | سند پیدا نکردم |
| ۶ | extra usage / کردیتِ API (apiKeyHelper) | credits بعد از سقف ([pricing](https://learn.chatgpt.com/docs/pricing))، و `codex login --with-api-key` | `credits.balance "0"` | هست |
| ۷ | درصدِ مصرف از OAuth ِ Keychain + `api/oauth/usage` | **ساده‌تر:** درصد داخلِ خودِ فایلِ سشن روی دیسک (`rate_limits.used_percent`) | ۱۲ بار `used_percent` در باینری؛ در فایل‌ها هم هست | هست، ساده‌تر |
| ۸ | `/usage` و `/status` | `/status` («chat ID, context usage, and rate limits»)، `/usage`، داشبورد chatgpt.com/codex/settings/usage ([slash](https://learn.chatgpt.com/codex/reference/slash-commands)) | — | هست |
| ۹ | کشِ ۶۰ دقیقه (زنگِ کش) | کش هست. مدتش برای Codex: سند پیدا نکردم. سندِ API: ۳۰ دقیقه پیش‌فرض، با گزینهٔ ۱۲ ساعت ([caching](https://developers.openai.com/api/docs/guides/prompt-caching)) | یک سشن: ۱۹۳M از ۱۹۵M توکنِ ورودی از کش آمده | نصفه |
| ۱۰ | transcriptهای jsonl | `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl` با `token_count` | ۲۲۶ فایل | هست |
| ۱۱ | `/insights` | سند پیدا نکردم | — | سند پیدا نکردم |
| ۱۲ | مدل (`--model`) | `-m`، `/model` | ۹ مدل در `models_cache.json` (gpt-6-astra، gpt-6.1-sol، gpt-6-luna، …) | هست |
| ۱۳ | `/effort` | `/reasoning`، `model_reasoning_effort` (low تا ultra) | `"ultra"` | هست |
| ۱۴ | fastMode | `/fast`، ultrafast | `fast_mode`، `ultrafast_mode` = stable | هست |
| ۱۵ | hooks (Stop، SessionStart، Pre/PostToolUse) | ۱۲ رویداد، از جمله Stop، SessionStart و PreCompact ([hooks](https://learn.chatgpt.com/docs/hooks)) | `~/.codex/hooks.json`: SessionStart و PreToolUse ِ remember، **روشن** | هست |
| ۱۶ | statusline (`statusline.py`) | `tui.status_line` (فهرستِ آماده، `/statusline`)؛ اسکریپتِ دلخواه نه ([issue](https://github.com/openai/codex/issues/17827)) | `~/.codex/hooks/statusline.py` کپی شده، ولی در config وصل نیست | نصفه |
| ۱۷ | skills | `SKILL.md` در `~/.agents/skills` یا `.agents/skills`، صدا زدن با `$` ([customization](https://learn.chatgpt.com/docs/customization/overview)) | ۱۱ اسکیل در `~/.codex/skills` | هست |
| ۱۸ | subagent | `~/.codex/agents/*.toml`؛ default، worker و explorer؛ مدلِ ارزان برای هر کدام (gpt-6-luna) ([subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents)) | پوشهٔ `agents` نیست | هست |
| ۱۹ | پیام بینِ سشن‌ها (SendMessage، ListAgents) | `codex queue --thread --message` و `codex agents`؛ `agent_message_board` = under development | در چتِ ۱۸ اکت ِ `199th-day-claude-to-gpt` رفت‌وبرگشت آزموده نشد | نصفه |
| ۲۰ | `/loop` و CronCreate | scheduled task داخلِ چت (هر چند دقیقه) و Scheduled ([automations](https://learn.chatgpt.com/docs/automations?surface=app)) | ۱ automation: «بررسی روزانه حسابدار شخصی»؛ **از ۲۴ اوت اجرا نشده** (پایین را ببین) | هست |
| ۲۱ | `/schedule` (ابری) | scheduled task ِ وب، Team Tasks، و رویدادِ Gmail، Slack یا GitHub | — | هست |
| ۲۲ | Workflow | سند پیدا نکردم (`multi_agent` = stable) | — | سند پیدا نکردم |
| ۲۳ | Remote Control | `codex remote-control` + اپِ موبایلِ ChatGPT ([remote](https://developers.openai.com/codex/remote-connections)) | تنظیمِ `keepRemoteControlAwakeWhilePluggedIn = true` هست؛ **روشن بودنش چک نشد** (`ps`: app-server با `--listen stdio://` در حالِ اجراست، ولی نشانی از remote-control در فرمانش نیست)؛ زیرفرمان `[experimental]` است | هست (روی مک: چک نشد) |
| ۲۴ | `claude -p` و `--bare` | `codex exec` (`--json`، `-o`، `--ephemeral`، `--ignore-user-config`) | `codex exec --help` جواب داد | هست |
| ۲۵ | `--resume`، `--fork-session`، `--name` | `codex resume`، `codex fork`، `/rename` | `session_index.jsonl` با ۷۱ اسم | هست |
| ۲۶ | worktree | `--worktree`، `/worktree` | `worktrees` = stable | هست |
| ۲۷ | plugin و marketplace | `codex plugin marketplace add` | marketplaceهای **claude-plugins-official** و **habib-local** وصل‌اند؛ remember، hookify و ralph-loop روشن‌اند | هست |
| ۲۸ | MCP | `codex mcp add` | `node_repl` | هست |
| ۲۹ | CLAUDE.md و memory | `AGENTS.md`، و Memories در `~/.codex/memories/` ([memories](https://learn.chatgpt.com/docs/customization/memories)) | `~/.codex/AGENTS.md` (۱۱ KB)؛ `memories = true` | هست |
| ۳۰ | permissions، bypass، sandbox | `--sandbox`، `approval_policy`، `--yolo`، rules | `workspace-write`، `on-request` | هست |
| ۳۱ | AskUserQuestion و Plan mode | `/plan` هست؛ پنجرهٔ سؤالِ گزینه‌دار (`default_mode_request_user_input`) هنوز ساخته می‌شود | — | نصفه |
| ۳۲ | کارِ پس‌زمینه، Monitor، PushNotification | `notify`، `tui.notifications`، `sleep_tool` | `notify` ⇒ Computer Use (`turn-ended`) | نصفه |
| ۳۳ | `/compact`، `/btw`، `/rewind` | `/compact`، **`/side`** (= `/btw`)؛ rewind فقط با `/fork` (`undo` = removed) | — | نصفه |
| ۳۴ | `/code-review`، `/simplify`، `/security-review` | `codex review`، `/review`، auto-review؛ برای simplify و security سند پیدا نکردم | — | نصفه |
| ۳۵ | Artifact | فلگِ `artifact` = under development، خاموش | — | نصفه |
| ۳۶ | Claude in Chrome و computer use | `computer_use`، `browser_use`، افزونهٔ `@Chrome` | پلاگین‌های chrome و computer-use روشن‌اند | هست |
| ۳۷ | VS Code و Windsurf، اپِ دسکتاپ، Cowork | افزونهٔ Codex برای VS Code، اپِ ChatGPT، ChatGPT Work | سشن‌هایی با `source: vscode`؛ پلاگینِ `anthropic-skills@claude-cowork` | هست |
| ۳۸ | `language: persian` | برای زبانِ جواب سند پیدا نکردم | `localeOverride = "en-US"`، فونتِ vazirmatn؛ فارسی فقط از راهِ AGENTS.md | نصفه |
| ۳۹ | env varها و فلگ‌های نانوشته (`strings`) | **رسمی:** `codex features list` | ۱۷۶ فلگ: ۵۴ stable، ۷۲ under development، ۴۲ removed، ۴ experimental، ۴ deprecated | هست، بهتر |
| ۴۰ | `claude update` | `codex update` | — | هست |
| ۴۱ | تمدیدِ روزِ ۱۷ و ریفاند | ریفاند از اپل: دو بار رد شد، «Not eligible for a refund» (`.remember/recent.md`، ۲۰ اکت). روزِ تمدیدِ ChatGPT را چک نکردم | — | ریفاند: نه |
| ۴۲ | alwaysThinking | مدل‌های GPT-6 همیشه فکر می‌کنند؛ مقدارش با `model_reasoning_effort` تنظیم می‌شود | `ultra` | هست |
| ۴۳ | `bashEditDiffEnabled` | سند پیدا نکردم (`cwd_relative_turn_diffs` = under development) | — | سند پیدا نکردم |

**Automation (ردیفِ ۲۰): تنها automation دیگر هر شب اجرا نمی‌شود.**
`~/.codex/automations/automation/automation.toml`، «بررسی روزانه حسابدار شخصی»، `kind = "heartbeat"`:
- قاعدهٔ زمان: `RRULE:FREQ=YEARLY;…BYMONTH=1;BYMONTHDAY=1` (سالی یک بار، اولِ ژانویه).
- آخرین تغییرِ فایل: `updated_at` = ۲۴ اوت ۰۹:۱۱.
- اجراها: چتِ مقصد `rollout-2026-08-09T03-59-30-019fe3ec-….jsonl` ۲۵ `task_started` دارد. اجراهای نیمه‌شب (۲۰:۳۰ UTC) در ۹، ۱۰، ۱۱ و ۱۲ اوت بوده‌اند، بعد ۱۴ اوت، و **آخرینش ۲۴ اوت ۰۵:۰۶ UTC**. بعد از آن هیچ.
- تغییرِ قاعده ۳۴ دقیقه بعد از اجرای ۲۴ اوت بود، و از جای دیگری آمد، نه از خودِ اجرا. کننده‌اش معلوم نیست. مدرک:
  - اجرای ۲۴ اوت ساعتِ ۰۵:۰۶:۵۵ UTC شروع شد و ۰۵:۰۷:۱۶ تمام شد. فقط دو `exec_command` داشت و هیچ `automation_update` نداشت.
  - `updated_at` = ۲۴ اوت ۰۵:۴۱:۳۶ UTC.
