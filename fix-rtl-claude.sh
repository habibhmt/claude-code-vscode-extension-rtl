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

# Scratch space for the CSS handed to python. A private directory keeps the
# predictable /tmp path out of everyone else's reach.
TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/crtl.XXXXXX")"
trap 'rm -rf "$TMP_DIR"' EXIT

# Only one run at a time. The launchd agent watches the extensions folder, so
# this script's own writes wake it up and a second copy starts patching the
# same files mid-write — which showed up as random self-test failures and
# rolled-back IDEs. mkdir is atomic, so it makes a usable lock.
LOCK_DIR="${TMPDIR:-/tmp}/crtl-patch.lock"
if ! mkdir "$LOCK_DIR" 2>/dev/null; then
    # A lock left behind by a killed run would block every future one, so an
    # old one is taken over rather than trusted.
    if [ -n "$(find "$LOCK_DIR" -maxdepth 0 -mmin +5 2>/dev/null)" ]; then
        rmdir "$LOCK_DIR" 2>/dev/null || true
        mkdir "$LOCK_DIR" 2>/dev/null || exit 0
    else
        exit 0   # another run is already doing exactly this work
    fi
fi
trap 'rmdir "$LOCK_DIR" 2>/dev/null; rm -rf "$TMP_DIR"' EXIT

# python3 does the extension.js rewrite. Without it the patch still applies —
# index.css plus the buttons appended to index.js — so warn instead of dying.
if command -v python3 >/dev/null 2>&1; then HAVE_PYTHON=true; else HAVE_PYTHON=false; fi

# ============================================================
#  تنظیمات اندازه — این عددها را خودت عوض کن و اسکریپت را دوباره اجرا کن
# ============================================================
# Settings written by the panel's "sav" button override the defaults below.
SIZES_FILE="${SIZES_FILE:-$HOME/.claude-rtl-sizes.json}"

CHAT_FONT_SIZE="${CHAT_FONT_SIZE:-15px}"     # اندازه متن اصلی گفتگو
CHAT_LINE_HEIGHT="${CHAT_LINE_HEIGHT:-1.6}"  # فاصله خطوط متن گفتگو
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
IMPORT_SETTINGS=false
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
        --import-clipboard|--import-settings)
            IMPORT_SETTINGS=true
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
            echo "  --import-clipboard  Take the JSON on the clipboard (the panel's 'sav' button"
            echo "                 puts it there), store it as the shared settings file and"
            echo "                 re-patch every IDE, so profiles travel between them"
            echo "  --kill-zombies Also reap runaway claude native-binary processes"
            echo "  --reload       Reload the frontmost IDE window when done (default on a terminal run)"
            echo "  --no-reload    Never reload the IDE window"
            echo "  --help, -h     Show this help message"
            echo ""
            echo "Panel defaults are read from \$SIZES_FILE (default ~/.claude-rtl-sizes.json)."
            echo "Press 'sav' in the panel to copy the current settings in that shape;"
            echo "keep the file in your dotfiles and symlink it to share it across machines."
            echo "Editing that file is enough to trigger a re-patch on the next run."
            exit 0
            ;;
    esac
done

# Bring the clipboard JSON in as the shared settings file. The panel runs in a
# sandboxed webview and cannot write to disk, so this is the hand-off: press
# 'sav' there, run this here, and every IDE picks the profiles up on its next
# patch — which the launchd agent triggers by itself.
if [ "$IMPORT_SETTINGS" = true ]; then
    if command -v pbpaste >/dev/null 2>&1; then clip="$(pbpaste)"
    elif command -v wl-paste >/dev/null 2>&1; then clip="$(wl-paste)"
    elif command -v xclip >/dev/null 2>&1; then clip="$(xclip -o -selection clipboard)"
    else
        echo -e "${RED}No clipboard tool found (pbpaste / wl-paste / xclip).${NC}" >&2
        exit 1
    fi
    if ! printf '%s' "$clip" | python3 -c 'import json,sys; json.load(sys.stdin)' 2>/dev/null; then
        echo -e "${RED}The clipboard does not hold valid JSON.${NC}" >&2
        echo "Press 'sav' in the panel first, then run this again." >&2
        exit 1
    fi
    printf '%s' "$clip" > "$SIZES_FILE"
    echo -e "${GREEN}Saved the clipboard settings to $SIZES_FILE${NC}"
    FORCE=true
fi

# INVARIANT — the composer is two stacked layers: .messageInput_ holds the real
# text but paints it transparent (color:#0000), and .mentionMirror_ is an
# absolutely positioned overlay that paints what you actually see. Anything set
# on one MUST be set identically on the other — font, size, line-height,
# padding, direction, bidi — or the text you see and the text you select drift
# apart and selections land in the wrong place. Simplest safe rule: do not
# style the composer subtree at all.

# RTL CSS without font
RTL_CSS_BASE='html,body{direction:rtl;text-align:right}
p:not([class*="diff"]):not([class*="Diff"]):not([class*="code"]):not([class*="Code"]),span:not([class*="diff"]):not([class*="Diff"]):not([class*="code"]):not([class*="Code"]):not([class*="messageInputContainer_"] *),div:not([class*="diff"]):not([class*="Diff"]):not([class*="code"]):not([class*="Code"]):not([class*="monaco"]):not([class*="messageInputContainer_"]):not([class*="messageInputContainer_"] *),li,ul,ol,input,textarea{direction:rtl;text-align:right;unicode-bidi:isolate}
table,thead,tbody,tr,td,th{direction:rtl!important;text-align:right!important;unicode-bidi:isolate!important}
td *,th *{unicode-bidi:normal!important}
pre,code,[class*="diff"],[class*="Diff"],[class*="code"],[class*="Code"],[class*="monaco"],[class*="editor"]{direction:ltr!important;text-align:left!important;unicode-bidi:isolate}
[class*="messageInput_"],[class*="mentionMirror_"]{unicode-bidi:plaintext!important}
'

# RTL CSS with Vazirmatn font
RTL_CSS_WITH_FONT='*{font-family:"Vazirmatn","SF Mono",Monaco,"Courier New",monospace!important}
[class*="messageInputContainer_"],[class*="messageInputContainer_"] *{font-family:var(--vscode-chat-font-family)!important}
html,body{direction:rtl;text-align:right}
p:not([class*="diff"]):not([class*="Diff"]):not([class*="code"]):not([class*="Code"]),span:not([class*="diff"]):not([class*="Diff"]):not([class*="code"]):not([class*="Code"]):not([class*="messageInputContainer_"] *),div:not([class*="diff"]):not([class*="Diff"]):not([class*="code"]):not([class*="Code"]):not([class*="monaco"]):not([class*="messageInputContainer_"]):not([class*="messageInputContainer_"] *),li,ul,ol,input,textarea{direction:rtl;text-align:right;unicode-bidi:isolate}
table,thead,tbody,tr,td,th{direction:rtl!important;text-align:right!important;unicode-bidi:isolate!important}
td *,th *{unicode-bidi:normal!important}
pre,code,[class*="diff"],[class*="Diff"],[class*="code"],[class*="Code"],[class*="monaco"],[class*="editor"]{direction:ltr!important;text-align:left!important;unicode-bidi:isolate}
[class*="messageInput_"],[class*="mentionMirror_"]{unicode-bidi:plaintext!important}
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
[class*="attachedFilesContainer"] [class*="chip"],[class*="attachedFilesContainer"] [class*="Chip"],[class*="attachedFilesContainer"] [class*="pill"],[class*="attachedFilesContainer"] [class*="Pill"],[class*="header_"] [class*="chip"],[class*="header_"] [class*="Chip"]{font-size:9px!important;padding:0 4px!important;line-height:1.2!important;max-height:16px!important}
[class*="attachedFilesContainer"] img,[class*="attachedFilesContainer"] [class*="thumb"],[class*="attachedFilesContainer"] [class*="preview"] img{max-height:12px!important;max-width:12px!important}
'

# Text sizing: big conversation text, small chrome (all values from the settings block above)
if [ "$USER_MSG_LINES" = "0" ]; then
    USER_MSG_CLAMP=''
else
    # The text lives in .content_* inside .expandableContainer_*, and the app
    # sets that element's max-height inline, so the clamp has to land there and
    # beat the inline value. Clamping the outer .userMessage_ only counts one
    # block child, which is why "1 line" still rendered the app's own 2 lines.
    USER_MSG_CLAMP="[class*=\"userMessage_\"]{overflow:hidden!important}
[class*=\"userMessage_\"] [class*=\"content_\"]{display:-webkit-box!important;-webkit-line-clamp:${USER_MSG_LINES}!important;-webkit-box-orient:vertical!important;overflow:hidden!important;max-height:none!important}
[class*=\"userMessage_\"] [class*=\"truncationGradient\"]{display:none!important}
[class*=\"userMessage_\"]:hover [class*=\"content_\"]{-webkit-line-clamp:unset!important;display:block!important;max-height:none!important}"
fi

# The button size is handed over as a CSS variable, not an !important rule:
# the panel's own slider writes that same variable, and an !important
# font-size here silently outranked it, so the slider did nothing.
UI_SIZE_CSS="[class*=\"messagesContainer_\"]{font-size:${CHAT_FONT_SIZE}!important;line-height:${CHAT_LINE_HEIGHT}!important}
[class*=\"messagesContainer_\"] p,[class*=\"messagesContainer_\"] li,[class*=\"messagesContainer_\"] [class*=\"markdown\"]{font-size:${CHAT_FONT_SIZE}!important;line-height:${CHAT_LINE_HEIGHT}!important}
[class*=\"messagesContainer_\"] pre,[class*=\"messagesContainer_\"] code,[class*=\"messagesContainer_\"] table{font-size:${CODE_FONT_SIZE}!important;line-height:1.5!important}
# Headings and their margins are em-based upstream, so a bigger chat font blew
# the gaps up with it — especially around bold headings. Cap and tighten them.
[class*=\"messagesContainer_\"] h1,[class*=\"messagesContainer_\"] h2,[class*=\"messagesContainer_\"] h3,[class*=\"messagesContainer_\"] h4,[class*=\"messagesContainer_\"] h5{font-size:calc(${CHAT_FONT_SIZE} + 2px)!important;line-height:1.35!important;margin:0.55em 0 0.25em!important;padding:0!important}
[class*=\"messagesContainer_\"] p,[class*=\"messagesContainer_\"] ul,[class*=\"messagesContainer_\"] ol{margin:0.3em 0!important}
[class*=\"messagesContainer_\"] li{margin:0.1em 0!important}
[class*=\"messagesContainer_\"] li>p{margin:0!important}
[class*=\"messagesContainer_\"] hr,[class*=\"messagesContainer_\"] blockquote,[class*=\"messagesContainer_\"] pre,[class*=\"messagesContainer_\"] table{margin:0.4em 0!important}
${USER_MSG_CLAMP}
[class*=\"headerTitle\"],[class*=\"header_\"],[class*=\"footer\"],[class*=\"Footer\"],[class*=\"statusBar\"],[class*=\"toolbar\"],[class*=\"Toolbar\"],[class*=\"badge\"],[class*=\"Badge\"],[class*=\"label_\"],[class*=\"meta\"]{font-size:${CHROME_FONT_SIZE}!important}
:root{--crtl-btn-size:${SIDE_BTN_FONT}}
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

# sha1 of stdin, whichever tool this machine happens to ship.
hash_stdin() {
    if command -v shasum >/dev/null 2>&1; then shasum
    elif command -v sha1sum >/dev/null 2>&1; then sha1sum
    elif command -v openssl >/dev/null 2>&1; then openssl dgst -sha1 | sed 's/^.*= //'
    else cksum
    fi | cut -d" " -f1
}

# One value that changes whenever the produced output would change. The seed
# file is part of it: editing ~/.claude-rtl-sizes.json must not be skipped as
# "nothing changed" the way it was before.
stamp="$(printf '%s%s%s%s%s' "$RTL_CSS" "$UI_COMPACT_CSS" "$UI_SIZE_CSS" \
    "$(cat "$BUTTONS_JS" 2>/dev/null)" "$(cat "$SIZES_FILE" 2>/dev/null)" | hash_stdin)"

# The buttons live inline in extension.js; older runs also appended them to
# index.js, so accept either as proof that a webview folder is patched.
is_patched() {
    grep -q 'crtl-panel' "$(dirname "$1")/extension.js" 2>/dev/null && return 0
    grep -q 'CLAUDE-RTL-UI-BUTTONS' "$1/index.js" 2>/dev/null && return 0
    return 1
}

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
               is_patched "$ext_dir"; then
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
            inlined=false
            if [ -f "$ext_js" ] && [ "$HAVE_PYTHON" = true ]; then
                if [ ! -f "$ext_js.backup" ]; then
                    cp "$ext_js" "$ext_js.backup"
                fi
                css_tmp="$TMP_DIR/crtl-css.$$"
                printf '%s\n%s\n' "$RTL_CSS" "$UI_COMPACT_CSS" > "$css_tmp"
                echo "$UI_SIZE_CSS" >> "$css_tmp"
                # `|| py_ok=false` keeps `set -e` from killing the run mid-patch:
                # a python failure must fall through to the rollback below.
                py_ok=true
                CRTL_CSS_FILE="$css_tmp" CRTL_EXT_JS="$ext_js" CRTL_BUTTONS_JS="$BUTTONS_JS" CRTL_SIZES_FILE="$SIZES_FILE" python3 - <<'PYEOF' || py_ok=false
import os, re
css = open(os.environ['CRTL_CSS_FILE'], encoding='utf-8').read()
path = os.environ['CRTL_EXT_JS']
src = open(path + '.backup', encoding='utf-8').read()

def esc(t):
    # the HTML lives in a JS template literal, so backslashes, backticks and ${ must be escaped
    return t.replace('\\', '\\\\').replace('`', '\\`').replace('${', '\\${')

def esc_js(t):
    # inside <script>…</script> the browser's HTML parser looks for "</script"
    # before the JS parser sees anything, so that sequence must never appear
    return esc(t).replace('</', '<\\/')

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
        # only the seed is escaped that hard — it is the one part that comes
        # from a file the script does not control, and "</" outside a string
        # would be legal JS in the bundle itself
        block += '<script nonce="${' + n.group(1) + '}">' + esc_js(seed) + esc(js) + '</script>'
    open(path, 'w', encoding='utf-8').write(src.replace(anchor, block, 1))
PYEOF
                rm -f "$css_tmp"
                if [ "$py_ok" = true ] && grep -q 'CLAUDE-RTL-UI-BUTTONS' "$ext_js" 2>/dev/null; then
                    inlined=true
                else
                    # A failed rewrite leaves the previous run's copy in place;
                    # combined with the index.js fallback that would load the
                    # buttons twice, so put the pristine file back first.
                    cp "$ext_js.backup" "$ext_js"
                fi
            fi

            # The buttons only need to load once. When extension.js carries them
            # inline, index.js stays clean — appending them there too made the
            # whole script run twice in the same webview.
            if [ -f "$ext_dir/index.js" ] && [ -f "$BUTTONS_JS" ]; then
                if [ ! -f "$ext_dir/index.js.backup" ]; then
                    cp "$ext_dir/index.js" "$ext_dir/index.js.backup"
                fi
                if [ "$inlined" = true ]; then
                    cp "$ext_dir/index.js.backup" "$ext_dir/index.js"
                else
                    { cat "$ext_dir/index.js.backup"; echo ""; echo ";"; cat "$BUTTONS_JS"; } > "$ext_dir/index.js"
                fi
            fi

            # Self-test: a broken injection would take the whole panel down,
            # so refuse to leave a file that no longer parses.
            ok=true
            if command -v node >/dev/null 2>&1; then
                node --check "$ext_dir/index.js" >/dev/null 2>&1 || ok=false
                node --check "$(dirname "$ext_dir")/extension.js" >/dev/null 2>&1 || ok=false
            fi
            is_patched "$ext_dir" || ok=false
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
if [ "$HAVE_PYTHON" != true ]; then
    echo -e "${YELLOW}[WARN]${NC} python3 not found — extension.js was left alone."
    echo "        The buttons fall back to index.js, which the webview caches;"
    echo "        install python3 for the cache-proof injection."
fi
if [ $patched -eq 0 ]; then
    echo -e "${RED}No Claude Code extensions found.${NC}"
    echo "Make sure Claude Code extension is installed in your IDE."
    exit 1
else
    echo -e "${GREEN}Patched $patched IDE(s) successfully.${NC}"
    echo ""
    echo "Restart your IDE to apply changes."

    # Drift check: an IDE update installs a fresh extension folder, which
    # silently drops the patch until the next run. Every supported IDE is
    # checked — warning only about VSCode left Windsurf and Cursor silent.
    for d in "$HOME"/.vscode/extensions/anthropic.claude-code-*/webview \
             "$HOME"/.vscode-insiders/extensions/anthropic.claude-code-*/webview \
             "$HOME"/.cursor/extensions/anthropic.claude-code-*/webview \
             "$HOME"/.windsurf/extensions/anthropic.claude-code-*/webview \
             "$HOME"/.windsurf-next/extensions/anthropic.claude-code-*/webview \
             "$HOME"/.devin/extensions/anthropic.claude-code-*/webview; do
        [ -d "$d" ] || continue
        if ! is_patched "$d"; then
            echo -e "${YELLOW}[WARN]${NC} unpatched extension version: $(basename "$(dirname "$d")")"
        fi
    done

    if [ "$KILL_ZOMBIES" = true ]; then
        "$REPO_DIR/kill-claude-zombies.sh" --yes
    fi

    if [ "$RELOAD" = true ]; then
        # Reload whichever supported IDE is in front, not always "Code".
        front="$(osascript -e 'tell application "System Events" to name of first process whose frontmost is true' 2>/dev/null || true)"
        case "$front" in
            Code|"Code - Insiders"|Cursor|Windsurf|"Windsurf Next"|Devin|Electron) ;;
            *) front="" ;;
        esac
        if [ -z "$front" ]; then
            echo -e "${YELLOW}No supported IDE in the foreground — press Cmd+R in the IDE yourself.${NC}"
        elif osascript -e "tell application \"System Events\" to tell process \"$front\" to keystroke \"r\" using command down" 2>/dev/null; then
            echo "Reloaded the $front window."
        else
            echo -e "${YELLOW}Could not auto-reload $front (needs Accessibility permission). Press Cmd+R.${NC}"
        fi
    fi
fi
