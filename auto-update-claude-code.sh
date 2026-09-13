#!/bin/bash
# Keep the Claude Code extension current in every installed IDE, then re-apply
# the RTL patch. Driven by com.habib.claude-code-autoupdate.plist, which runs
# this at login and every few hours.
#
#   ./auto-update-claude-code.sh            check, install what is behind, patch
#   ./auto-update-claude-code.sh --dry-run  report only, change nothing
#   ./auto-update-claude-code.sh --force    re-install even when already current
#
# Two traps this script exists to avoid, both hit by hand before:
#   * /usr/local/bin/code on this machine is Cursor's CLI, not VSCode's, so
#     every IDE is addressed by its full path inside the .app bundle.
#   * Devin's own marketplace serves a years-old build and "upgrading" through
#     it silently downgrades, so IDEs that cannot be trusted to resolve the
#     extension themselves are fed the official .vsix from Open VSX instead.

set -e

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="$REPO_DIR/autoupdate.log"
LOG_MAX_BYTES=524288
DRY_RUN=false
FORCE=false

for arg in "$@"; do
    case $arg in
        --dry-run) DRY_RUN=true ;;
        --force)   FORCE=true ;;
        --help|-h)
            echo "Usage: ./auto-update-claude-code.sh [--dry-run] [--force]"
            exit 0 ;;
    esac
done

# Keep the log from growing without bound; truncate in place so launchd's open
# handle keeps working.
if [ -f "$LOG_FILE" ] && [ "$(wc -c < "$LOG_FILE" | tr -d ' ')" -gt "$LOG_MAX_BYTES" ]; then
    : > "$LOG_FILE"
fi

say() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

# One run at a time. The patch script has its own lock; this one guards the
# download-and-install stretch, which is much longer.
LOCK_DIR="${TMPDIR:-/tmp}/crtl-autoupdate.lock"
if ! mkdir "$LOCK_DIR" 2>/dev/null; then
    if [ -n "$(find "$LOCK_DIR" -maxdepth 0 -mmin +30 2>/dev/null)" ]; then
        rmdir "$LOCK_DIR" 2>/dev/null || true
        mkdir "$LOCK_DIR" 2>/dev/null || exit 0
    else
        exit 0
    fi
fi
TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/crtl-au.XXXXXX")"
trap 'rmdir "$LOCK_DIR" 2>/dev/null; rm -rf "$TMP_DIR"' EXIT

# ---------------------------------------------------------------- IDE table
# name | extensions dir | CLI that can resolve the extension itself ("" = vsix)
IDES="
VSCode|$HOME/.vscode|/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code
VSCode Insiders|$HOME/.vscode-insiders|/Applications/Visual Studio Code - Insiders.app/Contents/Resources/app/bin/code-insiders
Cursor|$HOME/.cursor|/Applications/Cursor.app/Contents/Resources/app/bin/cursor
Windsurf|$HOME/.windsurf|
Windsurf Next|$HOME/.windsurf-next|
Devin|$HOME/.devin|
"

cli_for() {   # the binary used for a vsix install, even when the CLI cannot resolve by id
    case "$1" in
        "VSCode")          echo "/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code" ;;
        "VSCode Insiders") echo "/Applications/Visual Studio Code - Insiders.app/Contents/Resources/app/bin/code-insiders" ;;
        "Cursor")          echo "/Applications/Cursor.app/Contents/Resources/app/bin/cursor" ;;
        "Windsurf")        echo "$HOME/.codeium/windsurf/bin/windsurf" ;;
        "Windsurf Next")   echo "/Applications/Windsurf - Next.app/Contents/Resources/app/bin/windsurf-next" ;;
        "Devin")           echo "/Applications/Devin.app/Contents/Resources/app/bin/devin-desktop" ;;
    esac
}

# Highest installed version in an extensions dir, empty when none.
installed_version() {
    local dir="$1" v best=""
    for d in "$dir"/extensions/anthropic.claude-code-*; do
        [ -d "$d" ] || continue
        v="${d##*claude-code-}"
        v="${v%%-*}"
        if [ -z "$best" ] || [ "$(printf '%s\n%s\n' "$best" "$v" | sort -V | tail -1)" = "$v" ]; then
            best="$v"
        fi
    done
    echo "$best"
}

newer_than() {   # newer_than A B -> true when A is strictly newer than B
    [ "$1" != "$2" ] && [ "$(printf '%s\n%s\n' "$1" "$2" | sort -V | tail -1)" = "$1" ]
}

# ---------------------------------------------------------------- latest
LATEST="$(curl -fsS --max-time 30 https://open-vsx.org/api/anthropic/claude-code 2>/dev/null \
          | python3 -c 'import sys,json; print(json.load(sys.stdin).get("version",""))' 2>/dev/null || true)"

if ! printf '%s' "$LATEST" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+$'; then
    say "could not read the official version (offline?) — nothing done"
    exit 0
fi

VSIX=""
fetch_vsix() {
    [ -n "$VSIX" ] && return 0
    local arch url
    case "$(uname -m)" in
        arm64) arch="darwin-arm64" ;;
        x86_64) arch="darwin-x64" ;;
        *) arch="darwin-arm64" ;;
    esac
    url="https://open-vsx.org/api/Anthropic/claude-code/$arch/$LATEST/file/Anthropic.claude-code-$LATEST@$arch.vsix"
    if curl -fsSL --max-time 600 -o "$TMP_DIR/cc.vsix" "$url" && [ -s "$TMP_DIR/cc.vsix" ]; then
        VSIX="$TMP_DIR/cc.vsix"
        return 0
    fi
    say "could not download the vsix for $LATEST"
    return 1
}

# ---------------------------------------------------------------- work
updated=0
checked=0
behind_only=0

while IFS='|' read -r name dir by_id; do
    [ -z "$name" ] && continue
    [ -d "$dir/extensions" ] || continue
    # An uninstalled IDE can leave its extensions folder behind. Without this
    # the run would try, fail and report a failure on every single tick.
    bin="$(cli_for "$name")"
    if [ ! -x "$bin" ] && [ ! -x "$by_id" ]; then
        continue
    fi
    checked=$((checked + 1))
    have="$(installed_version "$dir")"
    if [ -n "$have" ] && [ "$FORCE" != true ] && ! newer_than "$LATEST" "$have"; then
        continue
    fi
    behind_only=$((behind_only + 1))
    say "$name: $have -> $LATEST"
    if [ "$DRY_RUN" = true ]; then
        continue
    fi

    ok=false
    if [ -n "$by_id" ] && [ -x "$by_id" ]; then
        if "$by_id" --install-extension anthropic.claude-code --force >/dev/null 2>&1; then
            ok=true
        fi
    fi
    if [ "$ok" != true ]; then
        bin="$(cli_for "$name")"
        if [ -x "$bin" ] && fetch_vsix; then
            "$bin" --install-extension "$VSIX" --force >/dev/null 2>&1 && ok=true
        fi
    fi

    # Trust the folder, not the installer's exit code: Devin's marketplace
    # reports success while installing an older build.
    now="$(installed_version "$dir")"
    if [ "$now" = "$LATEST" ]; then
        say "$name: now on $LATEST"
        updated=$((updated + 1))
    else
        say "$name: FAILED, still on ${now:-none}"
    fi
done <<< "$IDES"

if [ "$DRY_RUN" = true ]; then
    say "dry run: $behind_only of $checked IDE(s) behind $LATEST"
    exit 0
fi

if [ "$behind_only" -eq 0 ] && [ "$FORCE" != true ]; then
    # One quiet line so the log proves the agent is alive; without it a silent
    # run and a dead agent look exactly the same.
    say "all $checked IDE(s) already on $LATEST"
fi

if [ "$updated" -gt 0 ] || [ "$FORCE" = true ]; then
    say "re-applying the RTL patch"
    # --with-font matches what the patch agent uses, so both produce the same CSS
    "$REPO_DIR/fix-rtl-claude.sh" --with-font --no-reload 2>&1 | sed 's/^/    /'
    say "done: $updated IDE(s) updated to $LATEST"
fi
