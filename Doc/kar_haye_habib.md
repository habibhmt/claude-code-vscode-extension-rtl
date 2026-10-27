# کارهای حبیب که به Claude Code بسته‌اند — ورودیِ داوریِ `khabar_noskhe.sh`

هر نسخهٔ تازه با این فهرست سنجیده می‌شود: کدام تغییر به کدام کار می‌خورد. فهرست را هر کس کارِ تازه‌ای به Claude Code بست، این‌جا اضافه کند.

| پوشه | کار | چه چیزِ Claude Code را به کار می‌برد | جای کد |
|---|---|---|---|
| 136 | پچِ RTL ِ افزونهٔ VS Code (فارسی راست‌به‌چپ، فونت، دکمه‌ها، کادرِ «حدس»، جدولِ «تماس‌ها»، نشان دادنِ پرسش و جوابِ AskUserQuestion بیرون از fold) | فایل‌های `webview/index.js` و `extension.js` ِ افزونه، شکلِ پیام‌ها، کلاس‌های CSS (`collapseButton_`، `abovePrompt_`)، تابعِ fold | `fix-rtl-claude.sh`، `claude-ui-buttons.js`، `claude-host-hook.js` |
| 136 | مودِ «حدس» (پیشنهادِ کارِ بعد، نکرده‌ها، خودکار، کرون، دو جمله) | Mod API: `ui.render` (AbovePrompt)، `$.model.fork`، `$.prompt.submit`، `$.clock`، `$.fs`، `turn.step`، هوک‌ها | `mods/hads/hooks/register.js` |
| 136 | آپدیتِ خودکارِ افزونه در VS Code، Cursor، Windsurf، Devin و CLI | `--install-extension`، vsix ِ Open VSX، `autoUpdates` | `auto-update-claude-code.sh` |
| 136 | پلاگینِ remember-habib (handoff و حافظه در شروع/ادامهٔ چت) | هوکِ `SessionStart` (`source`: startup/resume/compact)، `additionalContext`، اسکیل | `~/.claude/plugins-local/remember-habib/` |
| 203 | پیام بینِ چت‌ها، پیام‌رسانِ خودکار، کامپیوتر یوز با اجازه، نگهبانِ چت‌ها | `SendMessage`/`ListAgents` (cross-session)، `claude -p`، Remote Control، `~/.claude/sessions/*.json`، `CLAUDE_CODE_CHILD_SESSION` | `~/1-MY-WORK/203th-day-imac-cpu-tracker/doc/abzar/` |
| 205 | حافظهٔ همهٔ چت‌ها (سرچ در jsonl ِ چت‌ها) | شکلِ فایل‌های `~/.claude/projects/*/*.jsonl` | `~/1-MY-WORK/205th-day-mother-of-all-agent/abzar/` |
| همه | قاعده‌ها و حافظه | `CLAUDE.md`، `MEMORY.md`، auto-memory، compact | `~/.claude/CLAUDE.md` |
| همه | ساب‌ایجنت با Sonnet، پنجرهٔ سؤال (AskUserQuestion)، تایمرِ کش | Agent، مدل‌ها، prompt cache | — |
| همه | ویس (دیکته) و زبانِ فارسی | voice mode، زبان‌ها | — |
| همه | کار با کروم (CDP) و کامپیوتر یوز | Claude in Chrome، computer use | `~/.claude/skills/chrome-cdp/` |
