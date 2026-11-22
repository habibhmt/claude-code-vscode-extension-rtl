#!/bin/zsh
# فرستادنِ پیامِ ناظرِ خودکار به چتِ «مجری-۱۳۶» — به شکلِ «پیامِ چتِ دیگر» (cross-session)، نه به اسمِ حبیب.
# سه چیز سنجیده می‌شود، چون «مدل گفت OK» مدرک نیست (درسِ ۱۲ نوامبر: مدل «رسید» گفت و نرسیده بود):
#   ۱) خودِ ابزار SendMessage صدا زده شد؟  ۲) نتیجه‌اش success بود؟  ۳) متن در فایلِ گفتگوی مجری آمد؟
# مدل: فقط دیپ‌سیک فلش (قاعدهٔ حبیب ۱۵ نوامبر)؛ از راهِ دروازهٔ محلیِ ۱۳۶ روی 127.0.0.1:50990
# usage: nazer_be_mojri_136.sh "<متن>"   ⇐ «✅ فرستاده شد» یا «❌ …»
set -u
PAYAM=$1
BE=${PAYAM_BE:-مجری-۱۳۶}
MOJRI_JSONL=${MOJRI_JSONL:-$HOME/.claude/projects/-Users-habib-1-MY-WORK-136th-day-fix-rtl-claude/7aa0e8a2-0328-4915-9a7d-4a4713c88591.jsonl}
GATEWAY=${GATEWAY:-http://127.0.0.1:50990}
OC_MODEL=${OC_MODEL:-claude-oc-deepseek-v4.1-flash}
C=$(ls -d ~/.vscode/extensions/anthropic.claude-code-*-darwin-arm64/resources/native-binary/claude 2>/dev/null | sort -V | tail -1)
[ -x "$C" ] || C=$(ls -d ~/.windsurf/extensions/anthropic.claude-code-*/resources/native-binary/claude 2>/dev/null | sort -V | tail -1)
[ -x "$C" ] || C=$(command -v claude)
[ -x "$C" ] || { echo "❌ claude پیدا نشد"; exit 1; }
export PAYAM BE

# آدرسِ API: از راهِ دروازهٔ محلی (نه OpenRouter؛ کردیتش تمام است)
export ANTHROPIC_BASE_URL="$GATEWAY"
export ANTHROPIC_AUTH_TOKEN=local-gateway
export ANTHROPIC_MODEL="$OC_MODEL"
export ANTHROPIC_SMALL_FAST_MODEL="$OC_MODEL"
unset ANTHROPIC_API_KEY CLAUDE_CONFIG_DIR

# پورتِ دروازه زنده است؟
if ! curl -sS --max-time 5 "$GATEWAY/v1/models" >/dev/null 2>&1; then
  echo "❌ دروازهٔ $GATEWAY جواب نمی‌دهد"; exit 1
fi

out=$(cd /Users/habib/1-MY-WORK/136th-day-fix-rtl-claude && env -u CLAUDE_CODE_CHILD_SESSION perl -e 'alarm 220; exec @ARGV' "$C" -p \
  --no-session-persistence --output-format stream-json --verbose \
  --model "$OC_MODEL" --name "ناظر-۱۳۶-پیام‌رسان (خودکار)" \
  --allowedTools SendMessage --permission-mode bypassPermissions --setting-sources "" \
  "First call ToolSearch with query 'select:SendMessage' to load the SendMessage tool. Then call SendMessage exactly once with to=\"$BE\", summary=\"ناظرِ خودکارِ ۱۳۶\", and message equal to the exact text between <m> and </m>, unchanged: <m>$PAYAM</m>. If that name matches more than one session, call ListAgents and pick the interactive one on THIS machine and send to its exact \"name [ref]\". If NO session has exactly that name, send to nobody. Then reply only OK or ERR." < /dev/null 2>&1)
print -r -- "$out" > /tmp/nazer_be_mojri_136.last.jsonl

# ۱ و ۲) ابزار صدا زده شد و نتیجه‌اش success بود؟
natije=$(print -r -- "$out" | /usr/bin/python3 -c '
import sys, json
zad = False; ok = None; err = ""
def payda(o):
    global zad, ok, err
    if isinstance(o, dict):
        if o.get("type") == "tool_use" and "SendMessage" in str(o.get("name")):
            zad = True
        if "success" in o and isinstance(o.get("success"), bool):
            ok = o["success"]
        for v in o.values(): payda(v)
    elif isinstance(o, list):
        for v in o: payda(v)
for line in sys.stdin:
    line = line.strip()
    if not line.startswith("{"): continue
    try: payda(json.loads(line))
    except Exception: pass
print(("ZAD=%s OK=%s" % ("1" if zad else "0", ok)))
')
# ۳) متن در فایلِ گفتگوی مجری آمد؟ (۳۰ خطِ آخر)
khat=$(tail -30 "$MOJRI_JSONL" 2>/dev/null | /usr/bin/python3 -c '
import sys, json
iz = "".join(sys.argv[1:])
iz = iz[:60]
n = 0
for line in sys.stdin:
    if iz and iz in line: n += 1
print(n)
' "$(print -r -- "$PAYAM" | head -1 | cut -c1-40)")

# سومین شاهد (آمدنِ متن در فایلِ گفتگوی مجری) فقط اطلاع‌رسانی است: پیام تا وقتی چتِ او
# نوبتِ بعدی‌اش را نگیرد در فایل نوشته نمی‌شود. ملاکِ رسیدن: ابزار صدا زده شد + success + msg_id.
if [[ "$natije" == *"ZAD=1"* && "$natije" == *"OK=True"* ]]; then
  if [[ "$khat" != "0" ]]; then
    echo "✅ فرستاده شد و در فایل هم آمد ($natije · ردیف: $khat)"
  else
    echo "✅ فرستاده شد (در صندوقِ او؛ هنوز در فایلِ گفتگو نوشته نشده)"
  fi
  exit 0
fi
echo "❌ نرسید ($natije · در فایل: $khat ردیف)"
exit 1
