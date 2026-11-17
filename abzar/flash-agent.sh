#!/bin/zsh
# ساب‌ایجنتِ فلش (فقط‌خواندنی) — یک claude -p جدا که از OpenRouter با deepseek-v4.1-flash-1017 می‌رود.
# چرا: سشنِ اصلی به api.anthropic.com وصل است و مدلِ فلش را نمی‌شناسد (خطای «issue with the selected model»).
# کاربرد: abzar/flash-agent.sh "دستور" [پوشهٔ کار]   ⇐ متنِ جواب روی stdout، هزینه و مدل روی stderr
set -euo pipefail
MODEL="deepseek/deepseek-v4.1-flash-1017"
PROMPT="${1:?دستور لازم است}"
CWD="${2:-$PWD}"
KEY=$(security find-generic-password -s habib-claude-code-openrouter -w)
RO='Read,Grep,Glob,Bash(ls:*),Bash(cat:*),Bash(head:*),Bash(tail:*),Bash(grep:*),Bash(rg:*),Bash(find:*),Bash(wc:*),Bash(ps:*),Bash(lsof:*),Bash(which:*),Bash(claude --version),Bash(sed -n:*),Bash(curl -s:*)'
cd "$CWD"
env -u ANTHROPIC_API_KEY \
  ANTHROPIC_BASE_URL=https://openrouter.ai/api \
  ANTHROPIC_AUTH_TOKEN="$KEY" \
  ANTHROPIC_MODEL="$MODEL" ANTHROPIC_SMALL_FAST_MODEL="$MODEL" CLAUDE_CODE_SUBAGENT_MODEL="$MODEL" \
  CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1 \
  claude -p --model "$MODEL" --output-format json \
    --allowedTools "$RO" --disallowedTools "Agent,Task,Write,Edit,NotebookEdit" \
    --permission-mode dontAsk --max-budget-usd "${FLASH_BUDGET:-0.30}" \
    --append-system-prompt "تو ساب‌ایجنتِ فقط‌خواندنیِ حبیب هستی: هیچ فایلی ننویس (حتی با > یا tee)، ساب‌ایجنت نساز، کلید و رمز چاپ نکن. فارسی و جدولی جواب بده." \
    "$PROMPT" 2>/dev/null \
| python3 -I -c 'import json,sys
d=json.load(sys.stdin); print(d.get("result",""))
mu=d.get("modelUsage") or {}
print("[flash] session=%s models=%s cost=$%s error=%s" % (d.get("session_id"), list(mu), d.get("total_cost_usd"), d.get("is_error")), file=sys.stderr)'
