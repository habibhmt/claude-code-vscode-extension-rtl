#!/bin/bash
# Build and run the percentage tests. Pass a source dir to test a copy.
set -e
SRC="${1:-$(dirname "$0")/../Sources}"
OUT="$(mktemp -d)/t"
swiftc -o "$OUT" "$SRC/Usage.swift" "$SRC/Transcript.swift" "$SRC/Rules.swift" "$SRC/Alarms.swift" "$(dirname "$0")/advisor/main.swift" 2>&1 | grep -v warning || true
"$OUT"
