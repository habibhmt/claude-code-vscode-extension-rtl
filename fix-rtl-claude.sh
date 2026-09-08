#!/bin/bash
# RTL Fix for Claude Code Extension
# Supports: VSCode, VSCode Insiders, Cursor, Windsurf, Windsurf Next, Devin
# Works on: macOS and Linux

set -e

# Log rotation: keep autofix.log under 1MB, keep one previous copy
LOG_FILE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/autofix.log"
LOG_MAX_BYTES=1048576
if [ -f "$LOG_FILE" ]; then
    log_size=$(wc -c < "$LOG_FILE" | tr -d ' ')
    if [ "$log_size" -gt "$LOG_MAX_BYTES" ]; then
        cp "$LOG_FILE" "$LOG_FILE.1"
        : > "$LOG_FILE"   # truncate in place so launchd's open handle keeps working
    fi
fi

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUTTONS_JS="$REPO_DIR/claude-ui-buttons.js"

# ============================================================
#  تنظیمات اندازه — این عددها را خودت عوض کن و اسکریپت را دوباره اجرا کن
# ============================================================
# Settings written by the panel's "sav" button override the defaults below.
SIZES_FILE="${SIZES_FILE:-$HOME/.claude-rtl-sizes.json}"

CHAT_FONT_SIZE="${CHAT_FONT_SIZE:-15px}"     # اندازه متن اصلی گفتگو
CHAT_LINE_HEIGHT="${CHAT_LINE_HEIGHT:-1.8}"  # فاصله خطوط متن گفتگو
CODE_FONT_SIZE="${CODE_FONT_SIZE:-12px}"     # اندازه متن کد و جدول
USER_MSG_LINES="${USER_MSG_LINES:-1}"        # پیام خودت چند خط دیده شود (0 = بدون محدودیت)
SIDE_BTN_FONT="${SIDE_BTN_FONT:-9px}"        # اندازه دکمه‌های کناری
CHROME_FONT_SIZE="${CHROME_FONT_SIZE:-10px}" # اندازه حواشی: هدر، نوار پایین، برچسب‌ها

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Parse arguments
WITH_FONT=false
REVERT=false
KILL_ZOMBIES=false
FORCE=false
# Reload the IDE window only on an interactive run; the launchd agent must not
# yank the window out from under whatever is running.
if [ -t 1 ]; then RELOAD=true; else RELOAD=false; fi
for arg in "$@"; do
    case $arg in
        --with-font)
            WITH_FONT=true
            shift
            ;;
        --revert)
            REVERT=true
            shift
            ;;
        --kill-zombies)
            KILL_ZOMBIES=true
            shift
            ;;
        --force)
            FORCE=true
            shift
            ;;
        --reload)
            RELOAD=true
            shift
            ;;
        --no-reload)
            RELOAD=false
            shift
            ;;
        --help|-h)
            echo "Usage: ./fix-rtl-claude.sh [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --with-font    Include Vazirmatn font (for Persian/Arabic)"
            echo "  --revert       Restore every patched file from its .backup and exit"
            echo "  --force        Re-patch even when the stamp says nothing changed"
            echo "  --kill-zombies Also reap runaway claude native-binary processes"
            echo ""
            echo "Panel defaults are read from \$SIZES_FILE (default ~/.claude-rtl-sizes.json)."
            echo "Press 'sav' in the panel to copy the current settings in that shape;"
            echo "keep the file in your dotfiles and symlink it to share it across machines."
            echo "  --reload       Reload the IDE window when done (default on a terminal run)"
            echo "  --no-reload    Never reload the IDE window"
            echo "  --help, -h     Show this help message"
            exit 0
            ;;
    esac
done

# RTL CSS without font
RTL_CSS_BASE='html,body{direction:rtl;text-align:right}
p:not([class*="diff"]):not([class*="Diff"]):not([class*="code"]):not([class*="Code"]),span:not([class*="diff"]):not([class*="Diff"]):not([class*="code"]):not([class*="Code"]),div:not([class*="diff"]):not([class*="Diff"]):not([class*="code"]):not([class*="Code"]):not([class*="monaco"]),li,ul,ol,input,textarea,[contenteditable],[contenteditable="true"]{direction:rtl;text-align:right;unicode-bidi:isolate}
table,thead,tbody,tr,td,th{direction:rtl!important;text-align:right!important;unicode-bidi:isolate!important}
td *,th *{unicode-bidi:normal!important}
pre,code,[class*="diff"],[class*="Diff"],[class*="code"],[class*="Code"],[class*="monaco"],[class*="editor"]{direction:ltr!important;text-align:left!important;unicode-bidi:isolate}
'

# RTL CSS with Vazirmatn font
RTL_CSS_WITH_FONT='*{font-family:"Vazirmatn","SF Mono",Monaco,"Courier New",monospace!important}
html,body{direction:rtl;text-align:right}
p:not([class*="diff"]):not([class*="Diff"]):not([class*="code"]):not([class*="Code"]),span:not([class*="diff"]):not([class*="Diff"]):not([class*="code"]):not([class*="Code"]),div:not([class*="diff"]):not([class*="Diff"]):not([class*="code"]):not([class*="Code"]):not([class*="monaco"]),li,ul,ol,input,textarea,[contenteditable],[contenteditable="true"]{direction:rtl;text-align:right;unicode-bidi:isolate}
table,thead,tbody,tr,td,th{direction:rtl!important;text-align:right!important;unicode-bidi:isolate!important}
td *,th *{unicode-bidi:normal!important}
pre,code,[class*="diff"],[class*="Diff"],[class*="code"],[class*="Code"],[class*="monaco"],[class*="editor"]{direction:ltr!important;text-align:left!important;unicode-bidi:isolate}
'

# Choose CSS based on font flag
if [ "$WITH_FONT" = true ]; then
    RTL_CSS="$RTL_CSS_WITH_FONT"
    echo -e "${YELLOW}Using Vazirmatn font${NC}"
else
    RTL_CSS="$RTL_CSS_BASE"
fi

# UI compaction: thinner top header + thinner composer/attachment row
UI_COMPACT_CSS='[class*="header_"],[class*="titlebar"],[class*="TitleBar"]{min-height:24px!important;height:auto!important;padding-top:0!important;padding-bottom:0!important}
[class*="headerIcon"]{height:20px!important;width:18px!important;margin-left:4px!important}
[class*="headerIcon"] svg,[class*="headerIcon"] img{width:13px!important;height:13px!important}
[class*="headerTitle"]{font-size:11px!important;line-height:1.2!important}
[class*="attachment"],[class*="Attachment"],[class*="chip"],[class*="Chip"],[class*="pill"],[class*="Pill"]{font-size:9px!important;padding:0 4px!important;line-height:1.2!important;max-height:16px!important}
[class*="attachment"] img,[class*="Attachment"] img,[class*="thumb"],[class*="Thumb"],[class*="preview"] img{max-height:12px!important;max-width:12px!important}
'

# Text sizing: big conversation text, small chrome (all values from the settings block above)
if [ "$USER_MSG_LINES" = "0" ]; then
    USER_MSG_CLAMP=''
else
    USER_MSG_CLAMP="[class*=\"userMessage_\"]{display:-webkit-box!important;-webkit-line-clamp:${USER_MSG_LINES}!important;-webkit-box-orient:vertical!important;overflow:hidden!important}
[class*=\"userMessage_\"]:hover{-webkit-line-clamp:unset!important;display:block!important}"
fi

UI_SIZE_CSS="[class*=\"messagesContainer_\"]{font-size:${CHAT_FONT_SIZE}!important;line-height:${CHAT_LINE_HEIGHT}!important}
[class*=\"messagesContainer_\"] p,[class*=\"messagesContainer_\"] li,[class*=\"messagesContainer_\"] [class*=\"markdown\"]{font-size:${CHAT_FONT_SIZE}!important;line-height:${CHAT_LINE_HEIGHT}!important}
[class*=\"messagesContainer_\"] pre,[class*=\"messagesContainer_\"] code,[class*=\"messagesContainer_\"] table{font-size:${CODE_FONT_SIZE}!important;line-height:1.5!important}
${USER_MSG_CLAMP}
[class*=\"headerTitle\"],[class*=\"header_\"],[class*=\"footer\"],[class*=\"Footer\"],[class*=\"statusBar\"],[class*=\"toolbar\"],[class*=\"Toolbar\"],[class*=\"badge\"],[class*=\"Badge\"],[class*=\"label_\"],[class*=\"meta\"]{font-size:${CHROME_FONT_SIZE}!important}
.crtl-btn{font-size:${SIDE_BTN_FONT}!important}
"

# Revert mode: put every backup back and stop.
if [ "$REVERT" = true ]; then
    reverted=0
    for ext_dir in "$HOME"/.vscode/extensions/anthropic.claude-code-*/webview \
                   "$HOME"/.vscode-insiders/extensions/anthropic.claude-code-*/webview \
                   "$HOME"/.cursor/extensions/anthropic.claude-code-*/webview \
                   "$HOME"/.windsurf/extensions/anthropic.claude-code-*/webview \
                   "$HOME"/.windsurf-next/extensions/anthropic.claude-code-*/webview \
                   "$HOME"/.devin/extensions/anthropic.claude-code-*/webview; do
        [ -d "$ext_dir" ] || continue
        for f in "$ext_dir/index.css" "$ext_dir/index.js" "$(dirname "$ext_dir")/extension.js"; do
            if [ -f "$f.backup" ]; then
                cp "$f.backup" "$f"
                reverted=$((reverted + 1))
            fi
        done
        echo -e "${GREEN}[REVERT]${NC} $ext_dir"
    done
    echo -e "${GREEN}Restored $reverted file(s) from backup.${NC}"
    exit 0
fi

# Counter for patched IDEs
patched=0
skipped=0
# Buffered so a run that changed nothing stays out of the log.
OUT=""

# One value that changes whenever the produced output would change.
stamp="$(printf '%s%s%s%s' "$RTL_CSS" "$UI_COMPACT_CSS" "$UI_SIZE_CSS" "$(cat "$BUTTONS_JS" 2>/dev/null)" | shasum | cut -d" " -f1)"

# Function to patch an IDE
patch_ide() {
    local ide_name=$1
    local ext_pattern=$2

    for ext_dir in $ext_pattern; do
        if [ -f "$ext_dir/index.css" ]; then
            # Skip work that would produce byte-identical output. The launchd
            # agent fires on every extensions-folder touch, and re-patching each
            # time only grew autofix.log.
            if [ "$FORCE" != true ] && [ -f "$ext_dir/.crtl-stamp" ] && \
               [ "$(cat "$ext_dir/.crtl-stamp" 2>/dev/null)" = "$stamp" ] && \
               grep -q 'crtl-panel' "$(dirname "$ext_dir")/extension.js" 2>/dev/null; then
                skipped=$((skipped + 1))
                continue
            fi
            # Create backup if not exists
            if [ ! -f "$ext_dir/index.css.backup" ]; then
                cp "$ext_dir/index.css" "$ext_dir/index.css.backup"
            fi
            # Apply RTL CSS + UI compaction
            { echo "$RTL_CSS"; echo "$UI_COMPACT_CSS"; echo "$UI_SIZE_CSS"; cat "$ext_dir/index.css.backup"; } > "$ext_dir/index.css"

            # Inject the same CSS into extension.js's inline <style> as well.
            # The webview's index.css URL has no cache-buster, so VSCode serves a
            # stale copy after a plain window reload; the inline <style> is built
            # fresh on every webview creation and is therefore never cached.
            ext_js="$(dirname "$ext_dir")/extension.js"
            if [ -f "$ext_js" ]; then
                if [ ! -f "$ext_js.backup" ]; then
                    cp "$ext_js" "$ext_js.backup"
                fi
                printf '%s\n%s\n' "$RTL_CSS" "$UI_COMPACT_CSS" > /tmp/.crtl-css.$$
                echo "$UI_SIZE_CSS" >> /tmp/.crtl-css.$$
                CRTL_CSS_FILE=/tmp/.crtl-css.$$ CRTL_EXT_JS="$ext_js" CRTL_BUTTONS_JS="$BUTTONS_JS" CRTL_SIZES_FILE="$SIZES_FILE" python3 - <<'PYEOF'
import os, re
css = open(os.environ['CRTL_CSS_FILE'], encoding='utf-8').read()
path = os.environ['CRTL_EXT_JS']
src = open(path + '.backup', encoding='utf-8').read()

def esc(t):
    # the HTML lives in a JS template literal, so backslashes, backticks and ${ must be escaped
    return t.replace('\\', '\\\\').replace('`', '\\`').replace('${', '\\${')

m = re.search(r'<link href="\$\{\w+\}" rel="stylesheet">', src)
if m:
    anchor = m.group(0)
    block = anchor + '<style>' + esc(css) + '</style>'
    # the buttons script must be inline too: index.js is cached by the webview,
    # while this HTML is rebuilt on every panel creation. CSP needs the nonce.
    js_path = os.environ.get('CRTL_BUTTONS_JS')
    seed = ''
    sizes_file = os.environ.get('CRTL_SIZES_FILE', '')
    if sizes_file and os.path.exists(sizes_file):
        try:
            import json
            seed = 'window.__CRTL_DEFAULTS=' + json.dumps(json.load(open(sizes_file, encoding='utf-8'))) + ';'
        except Exception:
            seed = ''
    n = re.search(r"script-src 'nonce-\$\{(\w+)\}'", src)
    if js_path and os.path.exists(js_path) and n:
        js = open(js_path, encoding='utf-8').read()
        block += '<script nonce="${' + n.group(1) + '}">' + esc(seed + js) + '</script>'
    open(path, 'w', encoding='utf-8').write(src.replace(anchor, block, 1))
PYEOF
                rm -f /tmp/.crtl-css.$$
            fi

            # Inject the quick-command button bar into the webview bundle
            if [ -f "$ext_dir/index.js" ] && [ -f "$BUTTONS_JS" ]; then
                if [ ! -f "$ext_dir/index.js.backup" ]; then
                    cp "$ext_dir/index.js" "$ext_dir/index.js.backup"
                fi
                { cat "$ext_dir/index.js.backup"; echo ""; echo ";"; cat "$BUTTONS_JS"; } > "$ext_dir/index.js"
            fi

            # Self-test: a broken injection would take the whole panel down,
            # so refuse to leave a file that no longer parses.
            ok=true
            if command -v node >/dev/null 2>&1; then
                node --check "$ext_dir/index.js" >/dev/null 2>&1 || ok=false
                node --check "$(dirname "$ext_dir")/extension.js" >/dev/null 2>&1 || ok=false
            fi
            grep -q 'crtl-panel' "$(dirname "$ext_dir")/extension.js" 2>/dev/null || ok=false
            if [ "$ok" != true ]; then
                OUT="$OUT\n$(echo -e "${RED}[FAIL]${NC} self-test failed, rolling back: $ext_dir")"
                for f in "$ext_dir/index.css" "$ext_dir/index.js" "$(dirname "$ext_dir")/extension.js"; do
                    [ -f "$f.backup" ] && cp "$f.backup" "$f"
                done
                continue
            fi
            echo "$stamp" > "$ext_dir/.crtl-stamp"

            ver="$(basename "$(dirname "$ext_dir")")"
            OUT="$OUT\n$(echo -e "${GREEN}[OK]${NC} Patched $ide_name ${ver#anthropic.claude-code-}: $ext_dir")"
            patched=$((patched + 1))
        fi
    done
}

START_MSG="
=== RTL Fix for Claude Code Extension === [$(date '+%Y-%m-%d %H:%M:%S')]
"

# Patch all supported IDEs
# NOTE: patterns are quoted so the glob expands inside patch_ide's own loop;
# unquoted patterns get expanded by the shell at the call site, and any match
# beyond the first is silently dropped since the function only reads $1/$2.
patch_ide "VSCode" "$HOME/.vscode/extensions/anthropic.claude-code-*/webview"
patch_ide "VSCode Insiders" "$HOME/.vscode-insiders/extensions/anthropic.claude-code-*/webview"
patch_ide "Cursor" "$HOME/.cursor/extensions/anthropic.claude-code-*/webview"
patch_ide "Windsurf" "$HOME/.windsurf/extensions/anthropic.claude-code-*/webview"
patch_ide "Windsurf Next" "$HOME/.windsurf-next/extensions/anthropic.claude-code-*/webview"
patch_ide "Devin" "$HOME/.devin/extensions/anthropic.claude-code-*/webview"

if [ $patched -eq 0 ] && [ $skipped -gt 0 ]; then
    # everything already carries the current stamp; say nothing
    [ "$KILL_ZOMBIES" = true ] && "$REPO_DIR/kill-claude-zombies.sh" --yes
    exit 0
fi

echo "$START_MSG"
echo -e "$OUT"
if [ $patched -eq 0 ]; then
    echo -e "${RED}No Claude Code extensions found.${NC}"
    echo "Make sure Claude Code extension is installed in your IDE."
    exit 1
else
    echo -e "${GREEN}Patched $patched IDE(s) successfully.${NC}"
    echo ""
    echo "Restart your IDE to apply changes."

    # Drift check: an IDE update installs a fresh extension folder, which
    # silently drops the patch until the next run. Say so out loud.
    for d in "$HOME"/.vscode/extensions/anthropic.claude-code-*/webview; do
        [ -d "$d" ] || continue
        if ! grep -q 'crtl-panel' "$(dirname "$d")/extension.js" 2>/dev/null; then
            echo -e "${YELLOW}[WARN]${NC} unpatched extension version: $(basename "$(dirname "$d")")"
        fi
    done

    if [ "$KILL_ZOMBIES" = true ]; then
        "$REPO_DIR/kill-claude-zombies.sh" --yes
    fi

    if [ "$RELOAD" = true ]; then
        osascript -e 'tell application "System Events" to tell process "Code" to keystroke "r" using command down' 2>/dev/null \
            && echo "Reloaded the VSCode window." \
            || echo -e "${YELLOW}Could not auto-reload (needs Accessibility permission). Press Cmd+R.${NC}"
    fi
fi
