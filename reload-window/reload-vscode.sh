#!/bin/zsh
# ریلودِ پنجره‌های VS Code / Devin / Windsurf بی‌جلو آمدن.
#   reload-vscode.sh all            ⇐ همه
#   reload-vscode.sh 136th-day      ⇐ پنجره‌ای که پوشه‌اش این تکه را دارد
#   reload-vscode.sh --install      ⇐ نصبِ افزونه در هر سه برنامه
set -e
HERE="${0:A:h}"
EXT="habib.reload-trigger-1.0.0"
if [[ "$1" == "--install" ]]; then
  for app in .vscode .devin .windsurf; do
    d="$HOME/$app/extensions"; [[ -d "$d" ]] || continue
    rm -rf "$d/$EXT"; cp -R "$HERE/$EXT" "$d/$EXT"
    python3 -I - "$d" "$EXT" <<'PY'
import json, sys, time
d, ext = sys.argv[1], sys.argv[2]
f = d + "/extensions.json"
j = json.load(open(f))
j = [e for e in j if e["identifier"]["id"] != "habib.reload-trigger"]
j.append({"identifier": {"id": "habib.reload-trigger"}, "version": "1.0.0",
  "location": {"$mid": 1, "path": f"{d}/{ext}", "scheme": "file"},
  "relativeLocation": ext,
  "metadata": {"installedTimestamp": int(time.time()*1000), "pinned": True, "source": "vsix"}})
json.dump(j, open(f, "w"))
PY
    echo "نصب شد: $d"
  done
  echo "یک بار هر پنجره را دستی Reload کن تا افزونه روشن شود."
  exit 0
fi
[[ -n "$1" ]] || { echo "بنویس: all یا تکه‌ای از اسمِ پوشه"; exit 1; }
mkdir -p "$HOME/.vscode-reload"
echo "$(python3 -c 'import time;print(int(time.time()*1000))') $*" > "$HOME/.vscode-reload/trigger"
echo "دستور رفت: $*"
