#!/usr/bin/env python3
"""The model a chat has in the Claude Code extension, for the same chat opened in a terminal.

Habib, 16 Nov 2026: «الان مدل تو ویژن هست ولی توی ترمینال نمیتونی ویژن باشی درستش کن که ترمینال هم
مثل کلود اکستنشن بتونه مدلای اینجا رو بگیره» — and confirmed: «وقتی یک چت را در ترمینال باز می‌کنی،
همان مدلی را بگیرد که در افزونه برای همان چت انتخاب کرده‌ای».

The extension keeps every choice in ~/.claude/crtl_tanzimat.json (claude-host-hook.js):
{sarasari:{k:{v,t}}, poshe:{cwd:{k:{v,t}}}, chat:{sid:{k:{v,t}}}}. The chat's own model wins, then the
folder's. The global one is not used: in the extension it is an alias ("opus") that its env maps to the
default model, which the terminal already has as its default.

Usage: terminal_model.py <cwd> [claude args...]   → prints the model, or nothing.
"""
import json
import os
import re
import sys
from pathlib import Path

HOME = Path.home() / ".claude"
SID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")


def anbar():
    p = Path(os.environ.get("CRTL_TANZIMAT") or HOME / "crtl_tanzimat.json")
    try:
        d = json.loads(p.read_text())
        return d if isinstance(d, dict) else {}
    except (OSError, ValueError):
        return {}


def poshe_projects(cwd):
    # Claude Code names a project folder by the cwd with every non-alphanumeric character as "-"
    return HOME / "projects" / re.sub(r"[^A-Za-z0-9]", "-", cwd)


def sid_az_args(args, cwd):
    """The chat this command opens: --resume/-r <id>, or --continue/-c (the newest chat of this folder)."""
    for i, a in enumerate(args):
        if a in ("--resume", "-r") and i + 1 < len(args) and SID.match(args[i + 1]):
            return args[i + 1]
        if a.startswith("--resume=") and SID.match(a.split("=", 1)[1]):
            return a.split("=", 1)[1]
    if any(a in ("--continue", "-c") for a in args):
        try:
            files = sorted(poshe_projects(cwd).glob("*.jsonl"), key=lambda f: f.stat().st_mtime)
        except OSError:
            files = []
        for f in reversed(files):
            if SID.match(f.stem):
                return f.stem
    return None


def model_baraye(cwd, args):
    a = anbar()

    def v(o):
        r = (o or {}).get("model") if isinstance(o, dict) else None
        x = r.get("v") if isinstance(r, dict) else None
        return x if isinstance(x, str) and x and not re.search(r"\s", x) else None

    sid = sid_az_args(args, cwd)
    if sid:
        m = v((a.get("chat") or {}).get(sid))
        if m:
            return m
    return v((a.get("poshe") or {}).get(cwd))


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(0)
    print(model_baraye(sys.argv[1], sys.argv[2:]) or "")
