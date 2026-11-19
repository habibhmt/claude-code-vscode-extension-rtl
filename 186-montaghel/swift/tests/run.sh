#!/bin/bash
# Build and run the percentage tests. Pass a source dir to test a copy.
set -e
SRC="${1:-$(dirname "$0")/../Sources}"
OUT="$(mktemp -d)/t"
if ! swiftc -o "$OUT" "$SRC/OpenRouter.swift" "$SRC/Transcript.swift" "$SRC/Rules.swift" "$SRC/Alarms.swift" "$(dirname "$0")/advisor/main.swift" 2>"$OUT.err"; then
    cat "$OUT.err" >&2
    exit 1
fi
grep -v warning "$OUT.err" >&2 || true
"$OUT"
