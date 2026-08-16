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

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Parse arguments
WITH_FONT=false
for arg in "$@"; do
    case $arg in
        --with-font)
            WITH_FONT=true
            shift
            ;;
        --help|-h)
            echo "Usage: ./fix-rtl-claude.sh [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --with-font    Include Vazirmatn font (for Persian/Arabic)"
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

# Counter for patched IDEs
patched=0

# Function to patch an IDE
patch_ide() {
    local ide_name=$1
    local ext_pattern=$2

    for ext_dir in $ext_pattern; do
        if [ -f "$ext_dir/index.css" ]; then
            # Create backup if not exists
            if [ ! -f "$ext_dir/index.css.backup" ]; then
                cp "$ext_dir/index.css" "$ext_dir/index.css.backup"
            fi
            # Apply RTL CSS
            echo "$RTL_CSS" | cat - "$ext_dir/index.css.backup" > "$ext_dir/index.css"
            echo -e "${GREEN}[OK]${NC} Patched $ide_name: $ext_dir"
            patched=$((patched + 1))
        fi
    done
}

echo ""
echo "=== RTL Fix for Claude Code Extension === [$(date '+%Y-%m-%d %H:%M:%S')]"
echo ""

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

echo ""
if [ $patched -eq 0 ]; then
    echo -e "${RED}No Claude Code extensions found.${NC}"
    echo "Make sure Claude Code extension is installed in your IDE."
    exit 1
else
    echo -e "${GREEN}Patched $patched IDE(s) successfully.${NC}"
    echo ""
    echo "Restart your IDE to apply changes."
fi
