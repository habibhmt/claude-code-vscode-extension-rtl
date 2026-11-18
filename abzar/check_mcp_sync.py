#!/usr/bin/env python3
"""چک می‌کند سرورهای MCP در هر دو فایلِ تنظیمِ کلود کد یکی باشند.

چرا: `~/.claude.json` و `~/.claude/.claude.json` دو فایلِ جدا بودند و هر MCPِ
تازه باید دو جا اضافه می‌شد؛ سشن‌های افزونه (که `CLAUDE_CONFIG_DIR` دارند) فایلِ
دوم را می‌خوانند و سرورِ تازه را نمی‌دیدند. مشکل ۱۶ نوامبر پیدا شد و دو روز
معلق ماند تا ۱۸ نوامبر. این اسکریپت جلوی تکرارش را می‌گیرد.

Exit: 0 = هم‌خوان (یا symlink) · 1 = ناهم‌خوان · 2 = فایل نیست
"""

from __future__ import annotations

import json
import os
import sys

A = os.path.expanduser("~/.claude.json")
B = os.path.expanduser("~/.claude/.claude.json")


def load(path: str) -> dict | None:
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return None
    except json.JSONDecodeError as e:
        print(f"✗ {path}: JSON خراب است — {e}", file=sys.stderr)
        return None


def main(argv: list[str]) -> int:
    quiet = "--quiet" in argv
    a_path = argv[argv.index("--a") + 1] if "--a" in argv else A
    b_path = argv[argv.index("--b") + 1] if "--b" in argv else B

    # اگر دومی به اولی لینک است، اصلاً دو فایل نیستیم.
    if os.path.islink(b_path):
        target = os.path.realpath(b_path)
        if target == os.path.realpath(a_path):
            if not quiet:
                print(f"✓ هم‌خوان — {b_path} لینکی به {a_path} است")
            return 0
        if not quiet:
            print(f"! {b_path} لینکی به {target} است، نه به {a_path}")
        return 1

    a = load(a_path)
    b = load(b_path)
    if a is None or b is None:
        missing = a_path if a is None else b_path
        print(f"✗ فایل نیست یا خوانده نشد: {missing}", file=sys.stderr)
        return 2

    sa = a.get("mcpServers") or {}
    sb = b.get("mcpServers") or {}

    only_a = sorted(set(sa) - set(sb))
    only_b = sorted(set(sb) - set(sa))
    differing = sorted(k for k in set(sa) & set(sb) if sa[k] != sb[k])

    keys_a, keys_b = len(a), len(b)
    other_gap = sorted(set(a) ^ set(b))

    if not (only_a or only_b or differing):
        if not quiet:
            extra = f" · {len(other_gap)} کلیدِ دیگر هم فقط در یکی هست" if other_gap else ""
            print(f"✓ هم‌خوان — {len(sa)} سرور در هر دو{extra}")
        return 0

    print("✗ ناهم‌خوان:")
    if only_a:
        print(f"  فقط در {a_path}: {', '.join(only_a)}")
    if only_b:
        print(f"  فقط در {b_path}: {', '.join(only_b)}")
    if differing:
        print(f"  تعریفشان فرق دارد: {', '.join(differing)}")
    print(f"  کلیدها: {keys_a} در برابرِ {keys_b}")
    if other_gap:
        print(f"  {len(other_gap)} کلیدِ غیرِ MCP هم فقط در یکی هست — مثلاً: {', '.join(other_gap[:6])}")
    print("\nراهِ حل: symlink کن —")
    print(f"  mv {b_path} {b_path}.bak && ln -s {a_path} {b_path}")
    return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
