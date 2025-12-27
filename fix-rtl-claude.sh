#!/bin/bash
# Fix RTL for Claude Code extension in Windsurf & Windsurf Next
# Run this script after each Claude Code extension update

RTL_CSS='*{font-family:"Vazirmatn","SF Mono",Monaco,"Courier New",monospace!important}
p:not([class*="diff"]):not([class*="Diff"]):not([class*="code"]):not([class*="Code"]),span:not([class*="diff"]):not([class*="Diff"]):not([class*="code"]):not([class*="Code"]),li,ul,ol,input,textarea,[contenteditable],[contenteditable="true"]{direction:rtl;text-align:right;unicode-bidi:isolate}
pre,code,[class*="diff"],[class*="Diff"],[class*="code"],[class*="Code"],[class*="monaco"]{direction:ltr!important;text-align:left!important}
'

# Find and patch Windsurf
for ext_dir in ~/.windsurf/extensions/anthropic.claude-code-*/webview; do
    if [ -f "$ext_dir/index.css" ]; then
        # Backup if not exists
        [ ! -f "$ext_dir/index.css.backup" ] && cp "$ext_dir/index.css" "$ext_dir/index.css.backup"
        # Apply RTL CSS
        echo "$RTL_CSS" | cat - "$ext_dir/index.css.backup" > "$ext_dir/index.css"
        echo "✅ Patched: $ext_dir"
    fi
done

# Find and patch Windsurf Next
for ext_dir in ~/.windsurf-next/extensions/anthropic.claude-code-*/webview; do
    if [ -f "$ext_dir/index.css" ]; then
        # Backup if not exists
        [ ! -f "$ext_dir/index.css.backup" ] && cp "$ext_dir/index.css" "$ext_dir/index.css.backup"
        # Apply RTL CSS
        echo "$RTL_CSS" | cat - "$ext_dir/index.css.backup" > "$ext_dir/index.css"
        echo "✅ Patched: $ext_dir"
    fi
done

echo ""
echo "🔄 Restart Windsurf to apply changes!"
