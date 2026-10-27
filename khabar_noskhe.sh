#!/bin/bash
# What changed in Claude Code between two versions, from Anthropic's own CHANGELOG, and which of
# it touches Habib's work (Habib 27 Oct 13:55: «هر موقع که ورژن جدید از اکستنشن کلود کد … ببینی
# چه تغییراتی انجام شده … کار من کدوماش میاد … گزارشش را بدی»; window: «بله، اول گزارش بعد با
# اجازه» — this only reports, it never changes code; standard agreed with 203, 27 Oct 14:05).
#
#   ./khabar_noskhe.sh bresh <old> <new>   print only the entries newer than <old> up to <new>
#   ./khabar_noskhe.sh bidar               run by com.habib.khabar-noskhe when a new extension folder
#                                          appears: report every version newer than the done-file
#
# bresh exits 2 when either version is not a heading in the CHANGELOG and 3 when the CHANGELOG
# cannot be fetched, so a typo or a moved file is an error and never an empty "nothing changed".

set -e
export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8   # launchd has no LANG; osascript would garble Persian

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CHANGELOG_URL="${KHABAR_CHANGELOG_URL:-https://raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md}"
EXT_DIR="${KHABAR_EXT_DIR:-$HOME/.vscode/extensions}"
DONE_FILE="${KHABAR_DONE_FILE:-$REPO_DIR/khabar_noskhe.done}"
GOZARESH_DIR="${KHABAR_GOZARESH_DIR:-$REPO_DIR/Doc/khabar_noskhe}"
LOG_FILE="${KHABAR_LOG_FILE:-$REPO_DIR/khabar_noskhe.log}"
ABZAR_203=/Users/habib/1-MY-WORK/203th-day-imac-cpu-tracker/doc/abzar
had_entezar_claude_s=300
had_kharj_claude_usd=0.5

bresh() {
    local ghadim="$1" taze="$2" matn
    matn="$(curl -fsS --max-time 30 "$CHANGELOG_URL")" || { echo "khabar_noskhe: CHANGELOG نرسید ($CHANGELOG_URL)" >&2; return 3; }
    for v in "$taze" "$ghadim"; do
        grep -qxF "## $v" <<<"$matn" || { echo "khabar_noskhe: «## ${v}» در CHANGELOG نیست" >&2; return 2; }
    done
    awk -v taze="## $taze" -v ghadim="## $ghadim" '
        $0 == taze   { dar = 1 }
        $0 == ghadim { exit }
        dar          { print }
    ' <<<"$matn"
}

say() { echo "[$(date '+%F %T')] $*" >> "$LOG_FILE"; }

notif() {  # notif <title> <text>
    [ -n "$KHABAR_KHOSHK" ] && { say "خشک (نوتیف): $1 — $2"; return 0; }
    osascript -e "display notification \"${2//\"/\'}\" with title \"${1//\"/\'}\" sound name \"KhabarNoskhe\"" 2>/dev/null || true
}

khata() { say "❌ $*"; notif "خبرِ نسخهٔ کلود کد: خطا" "$*"; exit 1; }

bidar() {
    # keep the log small; truncate in place
    [ -f "$LOG_FILE" ] && [ "$(wc -c < "$LOG_FILE" | tr -d ' ')" -gt 524288 ] && : > "$LOG_FILE"
    local taze ghadim tekke gozaresh prompt javab C
    taze="$(ls -d "$EXT_DIR"/anthropic.claude-code-* 2>/dev/null | sed -E 's|.*/anthropic\.claude-code-([0-9.]+).*|\1|' | sort -V | tail -1)"
    [ -n "$taze" ] || { say "هیچ پوشهٔ افزونه‌ای در $EXT_DIR نیست"; return 0; }
    if [ ! -s "$DONE_FILE" ]; then
        # first run: remember today's version, report from the next one on
        echo "$taze" > "$DONE_FILE"; say "شروع: $taze ثبت شد"; return 0
    fi
    ghadim="$(tr -d ' \n' < "$DONE_FILE")"
    [ "$(printf '%s\n%s\n' "$ghadim" "$taze" | sort -V | tail -1)" = "$taze" ] && [ "$ghadim" != "$taze" ] || { say "تازه نیست: $taze (گزارش‌شده: $ghadim)"; return 0; }

    tekke="$(bresh "$ghadim" "$taze" 2>&1)" || khata "برشِ $ghadim ⇐ $taze نشد: $tekke"
    grep -q '^- ' <<<"$tekke" || khata "برشِ $ghadim ⇐ $taze خالی بود (CHANGELOG شکلش عوض شده؟)"
    mkdir -p "$GOZARESH_DIR"
    gozaresh="$GOZARESH_DIR/$taze.md"

    if [ -n "$KHABAR_KHOSHK" ]; then
        javab="(خشک: Sonnet زده نشد)"$'\n'"$tekke"
    else
        C="$(ls -d "$EXT_DIR"/anthropic.claude-code-*-darwin-arm64/resources/native-binary/claude 2>/dev/null | sort -V | tail -1)"
        [ -x "$C" ] || C="$(command -v claude)"
        [ -x "$C" ] || khata "claude پیدا نشد"
        prompt="تو گزارشگرِ نسخهٔ تازهٔ Claude Code برای حبیب هستی. فقط فارسیِ ساده، فقط جدول، اصطلاحِ فنی با توضیحِ ساده در پرانتز.
فهرستِ کارهای حبیب که به Claude Code بسته‌اند: $REPO_DIR/Doc/kar_haye_habib.md (بخوانش؛ برای اطمینان می‌توانی کدِ همان پوشه‌ها را با Read/Grep/Glob ببینی).
تغییراتِ نسخه‌های $ghadim ⇐ $taze از CHANGELOG ِ رسمی:
<changelog>
$tekke
</changelog>
خروجی (هیچ فایلی نساز و چیزی را عوض نکن؛ فقط متن بده):
۱. عنوان: «# نسخهٔ $taze (از $ghadim)».
۲. جدولِ «به کارِ حبیب می‌خورد»: | تغییر (ساده) | کدام پوشه/کار | چه کنیم (پیشنهاد، هنوز انجام نشده) | اعتبار: 📏 دیده‌شده در کد / 🧩 حدس |. فقط ردیف‌هایی که واقعاً به یکی از کارها می‌خورد؛ هیچ نبود ⇒ یک خط «هیچ‌کدام به کارهای فهرست نمی‌خورد».
۳. جدولِ «بقیهٔ تغییرهای مهم» (حداکثر ۸ ردیف): | تغییر (ساده) | مثالِ ساده |.
۴. یک خطِ آخر: «هیچ تغییری در کد داده نشد؛ هر پیشنهاد با «بله» ِ حبیب.»"
        javab="$(cd "$REPO_DIR" && env -u CLAUDE_CODE_CHILD_SESSION -u CLAUDE_CODE_SESSION_ID -u CLAUDECODE \
            perl -e 'alarm shift; exec @ARGV' "$had_entezar_claude_s" \
            "$C" -p --model sonnet --permission-mode dontAsk --strict-mcp-config --setting-sources "" \
            --allowedTools Read,Grep,Glob --max-budget-usd "$had_kharj_claude_usd" "$prompt" 2>&1)" \
            || khata "Sonnet جواب نداد یا سقفِ ${had_kharj_claude_usd} دلار پر شد ($ghadim ⇐ $taze): $(tail -c 300 <<<"$javab")"
        grep -q '|' <<<"$javab" || khata "جوابِ Sonnet جدول نداشت ($ghadim ⇐ $taze): $(head -c 300 <<<"$javab")"
    fi

    { echo "$javab"; echo; echo "---"; echo "## متنِ خامِ CHANGELOG"; echo; echo "$tekke"; } > "$gozaresh"
    echo "$taze" > "$DONE_FILE"
    say "✅ گزارش: $gozaresh"
    notif "کلود کد $taze آمد" "گزارشِ تغییرات و آنچه به کارِ تو می‌خورد: Doc/khabar_noskhe/$taze.md"
    if [ -z "$KHABAR_KHOSHK" ] && [ -x "$ABZAR_203/payam_be_203.sh" ]; then
        PAYAM_BE="مجری--۱۳۶" "$ABZAR_203/payam_be_203.sh" "خبرِ نسخهٔ تازهٔ کلود کد: $ghadim ⇐ $taze. گزارش (فقط پیشنهاد، چیزی عوض نشده): $gozaresh — آن را بخوان، ردیف‌های «به کارِ حبیب می‌خورد» را به زبانِ ساده به حبیب بگو و برای هر کدام «بله» بگیر." >> "$LOG_FILE" 2>&1 || true
    fi
}

case "$1" in
    bresh) [ $# -eq 3 ] || { echo "usage: $0 bresh <old> <new> | bidar" >&2; exit 64; }; bresh "$2" "$3" ;;
    bidar) bidar ;;
    *)     echo "usage: $0 bresh <old> <new> | bidar" >&2; exit 64 ;;
esac
