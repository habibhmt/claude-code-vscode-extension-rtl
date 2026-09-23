#!/usr/bin/env python3
"""Turn off "scroll to bottom on send" in every IDE that runs Claude Code.

With it on, sending a message (and the ~2s glide that follows) drags the chat
to the bottom even while you are reading higher up. The extension has an
official switch for it since 2.1.276, but it lives in each IDE's own
settings.json, so a git pull alone never reached a second machine.

Rules:
  * no settings.json  -> leave it alone (that IDE is not installed / never opened)
  * key already there -> leave it alone, true or false — that is the user's choice
  * key missing       -> back up to settings.json.bak-scroll, add it as false
  * the text right before the closing } ends in a comment -> a comma there
    would land inside the comment, so warn and leave the file alone

CRTL_SETTINGS_ROOT overrides where the IDE folders are looked for (tests).
"""
import os
import re
import sys

KEY = "claudeCode.scrollToBottomOnSend"
APPS = ["Code", "Cursor", "Windsurf", "Devin"]
STRING = re.compile(r'"(?:\\.|[^"\\])*"')


def default_root():
    if sys.platform == "darwin":
        return os.path.expanduser("~/Library/Application Support")
    return os.environ.get("XDG_CONFIG_HOME") or os.path.expanduser("~/.config")


def ensure(path):
    """Return one of: 'added', 'present', 'comment', 'broken'."""
    with open(path, encoding="utf-8") as f:
        text = f.read()
    if re.search(r'"' + re.escape(KEY) + r'"\s*:', text):
        return "present"
    end = text.rfind("}")
    if end < 0:
        return "broken"
    head = text[:end].rstrip()
    last = STRING.sub('""', head.split("\n")[-1])
    if "//" in last or head.endswith("*/"):
        return "comment"
    sep = "" if head.endswith("{") or head.endswith(",") else ","
    new = head + sep + '\n    "' + KEY + '": false\n' + text[end:]
    with open(path + ".bak-scroll", "w", encoding="utf-8") as f:
        f.write(text)
    with open(path, "w", encoding="utf-8") as f:
        f.write(new)
    return "added"


def main():
    root = os.environ.get("CRTL_SETTINGS_ROOT") or default_root()
    for app in APPS:
        path = os.path.join(root, app, "User", "settings.json")
        if not os.path.isfile(path):
            continue
        result = ensure(path)
        if result == "added":
            print("[OK] %s: %s set to false" % (app, KEY))
        elif result == "comment":
            print("[WARN] %s: settings.json ends in a comment — add \"%s\": false by hand" % (app, KEY))
        elif result == "broken":
            print("[WARN] %s: settings.json has no closing } — left alone" % app)


if __name__ == "__main__":
    main()
