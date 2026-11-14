#!/bin/zsh
# ساخت و نصبِ نسخهٔ فورکِ DeepSeek Harness از سورسِ خودمان.
# فورک: habibhmt/deepseek-harness  ·  کلون: ~/1-MY-WORK/dsh-fork
# چرا: کنترلِ کامل روی کد و آپدیت‌ها؛ این نسخه آپدیتِ خودکار ندارد.
#
#   ./abzar/dsh-fork.sh build     بیلدِ کاملِ مخزن (۱۰ مرحله)
#   ./abzar/dsh-fork.sh package   ساختِ DMG بدونِ امضای اپل
#   ./abzar/dsh-fork.sh install   نصب از DMG کنارِ نسخهٔ اصلی
#   ./abzar/dsh-fork.sh all       هر سه، پشتِ سرِ هم
#   ./abzar/dsh-fork.sh web [port]  نسخهٔ وب از سورس (بی امضا، در مرورگر)
#   ./abzar/dsh-fork.sh status    وضعیتِ نصب و نسخه‌ها
#
# نکته: اپِ فورک و اپِ اصلی نامِ یکسان دارند، پس هم‌زمان باز نمی‌شوند
# (قفلِ تک‌نمونه‌ای). برای استفاده از فورک، اول اپِ اصلی را ببند.

set -euo pipefail

REPO="$HOME/1-MY-WORK/dsh-fork"
NODE_BIN="$HOME/.nvm/versions/node/v24.22.3/bin"
APP_NAME="DeepSeek Harness (fork).app"
DEST="/Applications/$APP_NAME"
DMG_GLOB="$REPO/apps/desktop/.desktop-build/targets/mac-arm64/unsigned-artifacts/*.dmg"

export PATH="$NODE_BIN:$PATH"

say() { print -r -- "▸ $1" }

need_repo() {
  [[ -d "$REPO/.git" ]] || { print -r -- "❌ مخزن نیست: $REPO" >&2; exit 1 }
}

do_build() {
  need_repo
  say "بیلدِ کامل (سری، برای ۱۶ گیگ رم)"
  cd "$REPO"
  DSH_GATE_CONCURRENCY=1 pnpm run build
}

do_package() {
  need_repo
  say "ساختِ DMG بدونِ امضا"
  cd "$REPO"
  pnpm run package:desktop:mac:arm64:unsigned
}

do_install() {
  local dmg
  dmg=$(ls -t ${~DMG_GLOB} 2>/dev/null | head -1)
  [[ -n "$dmg" ]] || { print -r -- "❌ DMG پیدا نشد؛ اول package را بزن" >&2; exit 1 }
  say "نصب از $dmg"
  local mnt
  mnt=$(hdiutil attach "$dmg" -nobrowse -readonly | awk -F'\t' '/\/Volumes\//{print $NF}' | tail -1)
  [[ -n "$mnt" ]] || { print -r -- "❌ DMG باز نشد" >&2; exit 1 }
  rm -rf "$DEST"
  cp -R "$mnt/DeepSeek Harness.app" "$DEST"
  hdiutil detach "$mnt" >/dev/null
  say "نصب شد: $DEST"
  do_sign
}

# macOS 26 امضای ad-hoc را رد می‌کند (AMFI -423) و اپ بی‌صدا بسته می‌شود.
# راهِ آزموده‌شده (۱۴ نوامبر ۲۰۲۶): گواهیِ self-signed که در Keychain برای
# «Code Signing» موردِ اعتماد است — نه گواهیِ Apple Development (آن هم رد شد).
# ترتیب مهم است: اول کمکی‌ها و فریمورک‌ها، آخر خودِ اپ.
do_sign() {
  [[ -d "$DEST" ]] || { print -r -- "❌ نصب نشده" >&2; exit 1 }
  local id
  id=$(security find-identity -v -p codesigning 2>/dev/null \
        | awk '/Local Signing/ && !/REVOKED/ {print $2; exit}')
  if [[ -z "$id" ]]; then
    print -r -- "⚠️ گواهیِ self-signed موردِ اعتماد پیدا نشد؛ اپ با امضای ad-hoc می‌ماند و در macOS 26 باز نمی‌شود." >&2
    return 0
  fi
  local ent=/tmp/dsh-fork-entitlements.plist
  local hent=/tmp/dsh-fork-helper-entitlements.plist
  codesign -d --entitlements :- "$DEST" 2>/dev/null > "$ent"
  # کمکی‌ها هم به disable-library-validation نیاز دارند، وگرنه رندرر با
  # «different Team IDs» کرش می‌کند (۱۴ نوامبر ۲۰۲۶، آزمونِ واقعی).
  cat > "$hent" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>com.apple.security.cs.allow-jit</key><true/>
<key>com.apple.security.cs.allow-unsigned-executable-memory</key><true/>
<key>com.apple.security.cs.disable-library-validation</key><true/>
<key>com.apple.security.device.audio-input</key><true/>
</dict></plist>
PLIST
  say "امضا با: $id"
  local f
  for f in "$DEST/Contents/Frameworks/"*.app; do
    [[ -d "$f" ]] && codesign --force --sign "$id" --options runtime --entitlements "$hent" "$f"
  done
  for f in "$DEST/Contents/Frameworks/"*.framework; do
    [[ -d "$f" ]] && codesign --force --sign "$id" --options runtime "$f"
  done
  find "$DEST/Contents/Frameworks" -type f \( -name "*.dylib" -o -name "*.so" \) 2>/dev/null \
    | while read -r f; do codesign --force --sign "$id" --options runtime "$f" 2>/dev/null; done
  codesign --force --sign "$id" --options runtime --entitlements "$ent" "$DEST"
  codesign --verify --deep --strict "$DEST" && say "امضا سالم است"
}

do_web() {
  need_repo
  local port="${2:-3099}"
  say "بالا آوردنِ نسخهٔ وبِ فورک روی پورت $port (افزونهٔ راست‌به‌چپ در پروفایلِ web نصب است)"
  cd "$REPO"
  exec pnpm dsh web --no-open --port "$port"
}

do_status() {
  print -r -- "مخزن:      $REPO"
  [[ -d "$REPO/.git" ]] && print -r -- "کامیت:     $(cd "$REPO" && git log --oneline -1)"
  print -r -- "نسخه:      $(cd "$REPO" 2>/dev/null && python3 -c 'import json;print(json.load(open("package.json"))["version"])' 2>/dev/null)"
  if [[ -d "$DEST" ]]; then
    print -r -- "نصب‌شده:   $DEST"
    print -r -- "نسخهٔ اپ:  $(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$DEST/Contents/Info.plist" 2>/dev/null)"
    print -r -- "شناسه:     $(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$DEST/Contents/Info.plist" 2>/dev/null)"
  else
    print -r -- "نصب‌شده:   ❌ نیست"
  fi
  print -r -- "افزونهٔ RTL: $(grep -c 'dsh-rtl' "$HOME/.dsh/profiles/desktop/package.json" 2>/dev/null || print 0) ارجاع در پروفایل"
}

case "${1:-status}" in
  build)   do_build ;;
  package) do_package ;;
  install) do_install ;;
  all)     do_build; do_package; do_install ;;
  web)     do_web "$@" ;;
  status)  do_status ;;
  *) print -r -- "استفاده: $0 {build|package|install|all|web|status}" >&2; exit 2 ;;
esac
