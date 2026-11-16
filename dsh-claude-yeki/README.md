# @local/dsh-claude-yeki

یکی‌شدنِ تنظیماتِ Claude Code و DeepSeek Harness (حبیب، ۱۶ نوامبر ۲۰۲۶). جزئیات: `docs/DETAIL.md`.

- `cordis.patch.yml`: ردیفِ همگام‌سازِ MCP + سه پریستِ کپی‌شده (بلوکِ بینِ دو خطِ نشانه را فقط `../abzar/dsh_preset_claude_md.cjs --write` می‌سازد).
- `index.js`: سرورهای MCP ِ سراسریِ `~/.claude.json` ⇐ `ctx.mcpManager.register`.
- آزمون: `node --test test/*.mjs`.
