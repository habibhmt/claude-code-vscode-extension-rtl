#!/usr/bin/env python3
"""Check the installed Claude Code extension against the marketplace.

Auto-update is deliberately off: a new build can change the minified anchors
our RTL/model-picker patches rely on. This only reports; it never installs.
"""
import glob
import json
import os
import re
import urllib.request
from pathlib import Path

EXT = "anthropic.claude-code"
URL = "https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery"


def version_key(value):
    return tuple(int(x) for x in re.findall(r"\d+", value)[:4])


def installed():
    dirs = glob.glob(os.path.expanduser("~/.vscode/extensions/anthropic.claude-code-*"))
    versions = []
    for path in dirs:
        m = re.search(r"anthropic\.claude-code-([0-9.]+)", path)
        if m:
            versions.append((version_key(m.group(1)), m.group(1), path))
    return max(versions) if versions else None


def latest():
    body = json.dumps({
        "filters": [{"criteria": [{"filterType": 7, "value": EXT}]}],
        "flags": 914,
    }).encode()
    req = urllib.request.Request(URL, data=body, headers={
        "Accept": "application/json;api-version=7.2-preview.1",
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0",
    })
    with urllib.request.urlopen(req, timeout=30) as response:
        data = json.load(response)
    return data["results"][0]["extensions"][0]["versions"][0]["version"]


def main():
    current = installed()
    if current is None:
        print("installed: none")
        return 1
    _, current_version, path = current
    print("installed:", current_version)
    print("path:", path)
    try:
        newest = latest()
    except Exception as error:
        print("marketplace: unavailable:", error)
        return 1
    print("marketplace:", newest)
    if version_key(newest) <= version_key(current_version):
        print("up_to_date: yes")
        return 0
    print("up_to_date: no")
    print("")
    print("Manual update checklist:")
    print("1. Update Claude Code from the Extensions view (auto-update is off).")
    print("2. Run: ./fix-rtl-claude.sh --with-font --no-reload")
    print("3. Run: npm test")
    print("4. If the model picker headers or RTL anchors fail, stop and inspect.")
    print("5. Reload the VS Code window.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
