#!/bin/bash
# RTL + open-as-preview for the built-in Markdown preview, in every IDE.
#  1. installs md-rtl-ext (previewStyles + previewScripts, and a URI handler that
#     opens a file rendered at a given word/line for the chat glossary card) —
#     "markdown.styles" with an absolute path is refused by the preview webview
#  2. maps *.md to the preview editor so a file opens already rendered
# Called from fix-rtl-claude.sh; a run that changes nothing prints nothing.

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXT_SRC="$REPO_DIR/md-rtl-ext"
EXT_ID="habib.markdown-rtl"
command -v python3 >/dev/null 2>&1 || { echo "[WARN] md-preview: python3 not found"; exit 0; }

# The installed copy is compared by content, so editing the CSS re-installs.
SRC_HASH="$(cat "$EXT_SRC/package.json" "$EXT_SRC/markdown-rtl.css" "$EXT_SRC/markdown-rtl.js" "$EXT_SRC/extension.js" | shasum | cut -d' ' -f1)"

build_vsix() {
    local out="$1" stage
    stage="$(mktemp -d)"
    mkdir -p "$stage/extension"
    cp "$EXT_SRC/package.json" "$EXT_SRC/markdown-rtl.css" "$EXT_SRC/markdown-rtl.js" "$EXT_SRC/extension.js" "$stage/extension/"
    cat > "$stage/[Content_Types].xml" <<'XML'
<?xml version="1.0" encoding="utf-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension=".json" ContentType="application/json"/><Default Extension=".css" ContentType="text/css"/><Default Extension=".js" ContentType="application/javascript"/><Default Extension=".vsixmanifest" ContentType="text/xml"/></Types>
XML
    cat > "$stage/extension.vsixmanifest" <<'XML'
<?xml version="1.0" encoding="utf-8"?>
<PackageManifest Version="2.0.0" xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011">
  <Metadata><Identity Language="en-US" Id="markdown-rtl" Version="1.0.0" Publisher="habib"/><DisplayName>Markdown RTL (habib)</DisplayName><Description>RTL style for the built-in Markdown preview</Description><Categories>Other</Categories><Properties><Property Id="Microsoft.VisualStudio.Code.Engine" Value="^1.60.0"/></Properties></Metadata>
  <Installation><InstallationTarget Id="Microsoft.VisualStudio.Code"/></Installation>
  <Dependencies/>
  <Assets><Asset Type="Microsoft.VisualStudio.Code.Manifest" Path="extension/package.json" Addressable="true"/></Assets>
</PackageManifest>
XML
    (cd "$stage" && zip -qr "$out" "[Content_Types].xml" extension.vsixmanifest extension)
    rm -rf "$stage"
}

VSIX=""
# ide-name | extensions dir | CLI | settings dir name
IDES=(
  "VSCode|$HOME/.vscode/extensions|/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code|Code"
  "Cursor|$HOME/.cursor/extensions|/Applications/Cursor.app/Contents/Resources/app/bin/cursor|Cursor"
  "Windsurf|$HOME/.windsurf/extensions|$HOME/.codeium/windsurf/bin/windsurf|Windsurf"
  "Devin|$HOME/.devin/extensions|/Applications/Devin.app/Contents/Resources/app/bin/devin-desktop|Devin"
)

for row in "${IDES[@]}"; do
    IFS='|' read -r name extdir cli sdir <<< "$row"

    # --- 1. extension ---------------------------------------------------------
    if [ -x "$cli" ]; then
        installed="$(ls -d "$extdir/$EXT_ID"-* 2>/dev/null | head -1)"
        have=""
        # the installer rewrites package.json (adds __metadata), so only the
        # installed CSS is compared, against the repo package.json
        [ -n "$installed" ] && have="$(cat "$EXT_SRC/package.json" "$installed/markdown-rtl.css" "$installed/markdown-rtl.js" "$installed/extension.js" 2>/dev/null | shasum | cut -d' ' -f1)"
        if [ "$have" != "$SRC_HASH" ]; then
            if [ -z "$VSIX" ]; then
                VSIX="$(mktemp -d)/markdown-rtl.vsix"
                build_vsix "$VSIX"
            fi
            if "$cli" --install-extension "$VSIX" --force >/dev/null 2>&1; then
                echo "[md-preview] extension installed: $name"
            else
                echo "[WARN] md-preview: extension install failed: $name"
            fi
        fi
    fi

    # --- 2. settings ----------------------------------------------------------
    settings="$HOME/Library/Application Support/$sdir/User/settings.json"
    [ -f "$settings" ] || continue
    out="$(python3 - "$settings" <<'PY'
import json, sys
p = sys.argv[1]
try:
    d = json.load(open(p))
except Exception:
    print("not-json"); sys.exit()
before = json.dumps(d, sort_keys=True)
# drop the old absolute-path attempt; the preview refused to load it
if "markdown.styles" in d:
    d["markdown.styles"] = [s for s in d["markdown.styles"] if not s.endswith("markdown-rtl.css")]
    if not d["markdown.styles"]:
        del d["markdown.styles"]
assoc = d.get("workbench.editorAssociations", {})
for ext in ("*.md", "*.markdown", "*.mdown", "*.mkdn", "*.mkd"):
    assoc[ext] = "vscode.markdown.preview.editor"
d["workbench.editorAssociations"] = assoc
if json.dumps(d, sort_keys=True) != before:
    json.dump(d, open(p, "w"), indent=4, ensure_ascii=False)
    print("updated")
PY
)"
    case "$out" in
        updated)  echo "[md-preview] settings updated: $name" ;;
        not-json) echo "[WARN] md-preview: $name settings.json has comments — left alone" ;;
    esac
done
[ -n "$VSIX" ] && rm -rf "$(dirname "$VSIX")"

# --- 3. Markdown Preview Enhanced ---------------------------------------------
# MPE is kept alongside the built-in preview. Its user stylesheet is shared by
# every IDE, so one marked block in style.less covers all of them.
MPE_STYLE="$HOME/.local/state/crossnote/style.less"
if compgen -G "$HOME/.*/extensions/shd101wyy.markdown-preview-enhanced-*" >/dev/null; then
    mkdir -p "$(dirname "$MPE_STYLE")"; touch "$MPE_STYLE"
    BEGIN="$(head -1 "$REPO_DIR/mpe-rtl.less")"; END="$(tail -1 "$REPO_DIR/mpe-rtl.less")"
    current="$(awk -v b="$BEGIN" -v e="$END" '$0==b{f=1} f{print} $0==e{f=0}' "$MPE_STYLE")"
    if [ "$current" != "$(cat "$REPO_DIR/mpe-rtl.less")" ]; then
        tmp="$(mktemp)"
        awk -v b="$BEGIN" -v e="$END" '$0==b{f=1;next} $0==e{f=0;next} !f' "$MPE_STYLE" > "$tmp"
        cat "$REPO_DIR/mpe-rtl.less" >> "$tmp"
        mv "$tmp" "$MPE_STYLE"
        echo "[md-preview] MPE RTL style written"
    fi
fi
exit 0
