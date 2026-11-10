#!/bin/bash
# Build, sign and install ClaudeUsage.app — one command, end to end.
set -euo pipefail
cd "$(dirname "$0")"
APP="${1:-/Applications/ClaudeUsage.app}"
BUILD="$(mktemp -d)/ClaudeUsage.app"

mkdir -p "$BUILD/Contents/MacOS" "$BUILD/Contents/Resources"

swiftc -O -parse-as-library -o "$BUILD/Contents/MacOS/ClaudeUsage" \
  Sources/Usage.swift Sources/Transcript.swift Sources/Rules.swift Sources/Alarms.swift Sources/App.swift \
  -framework AppKit -framework UserNotifications \
  -target arm64-apple-macos14.0

cat > "$BUILD/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleExecutable</key><string>ClaudeUsage</string>
  <key>CFBundleIdentifier</key><string>com.habib.ClaudeUsage.v5</string>
  <key>CFBundleName</key><string>ClaudeUsage</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>2.0.0</string>
  <key>CFBundleVersion</key><string>2.0.0</string>
  <key>CFBundleIconFile</key><string>AppIcon</string>
  <key>LSUIElement</key><true/>
  <key>LSMinimumSystemVersion</key><string>14.0</string>
  <key>NSHighResolutionCapable</key><true/>
</dict></plist>
PLIST

[ -f ../menubar/AppIcon.icns ] && cp ../menubar/AppIcon.icns "$BUILD/Contents/Resources/AppIcon.icns"
# The two alarms' own sounds (tools/notify/), never the system ones.
[ -f ~/Library/Sounds/ClaudeReply.aiff ] || python3 ../tools/notify/make-sound.py
[ -f ~/Library/Sounds/ClaudeCache.aiff ] || python3 ../tools/notify/make-sounds-app.py
mkdir -p "$BUILD/Contents/Library/Sounds"
for s in ClaudeReply ClaudeCache; do
  cp ~/Library/Sounds/$s.aiff "$BUILD/Contents/Resources/"
  cp ~/Library/Sounds/$s.aiff "$BUILD/Contents/Library/Sounds/"
done

codesign --force --sign - --identifier com.habib.ClaudeUsage.v5 "$BUILD"

pkill -x ClaudeUsage 2>/dev/null || true
rm -rf "$APP"
cp -R "$BUILD" "$APP"
xattr -cr "$APP" 2>/dev/null || true
echo "installed → $APP"
open "$APP"
