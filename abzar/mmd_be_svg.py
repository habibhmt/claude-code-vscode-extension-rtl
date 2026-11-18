#!/usr/bin/env python3
"""تبدیلِ فایلِ Mermaid (`.mmd`) به SVG با Pele.

استفاده:
    python3 abzar/mmd_be_svg.py نمودار.mmd            # می‌نویسد نمودار.svg
    python3 abzar/mmd_be_svg.py a.mmd b.mmd --png     # SVG + PNG برای دیدن
    python3 abzar/mmd_be_svg.py --check                # فقط بررسیِ نصب

Pele در `abzar/mmd-tool/node_modules` است تا وابستگی به ریشهٔ پروژه نریزد
(`node_modules/` در .gitignore است، پس در گیت نمی‌رود).

چرا Pele: همگام، بدونِ وابستگی، و متنِ فارسی را راست‌به‌چپ درست می‌کشد —
با سه نمودارِ آزمایشی چشمی سنجیده شد (۱۸ نوامبر ۲۰۲۶).
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
TOOL = os.path.join(HERE, "mmd-tool")
NODE = shutil.which("node") or "/opt/homebrew/bin/node"

NODE_SRC = r"""
const { render } = require('pele');
const fs = require('fs');
try {
  const text = fs.readFileSync(process.argv[1], 'utf8');
  const { svg } = render(text);
  fs.writeFileSync(process.argv[2], svg);
  process.stdout.write(String(svg.length));
} catch (e) {
  // فقط پیامِ خودِ Pele، نه ردِ پشتهٔ Node
  process.stderr.write('PELE_ERR:' + (e && e.message ? e.message : String(e)) + '\n');
  process.exit(1);
}
"""


def check() -> int:
    if not os.path.isfile(os.path.join(TOOL, "node_modules/pele/package.json")):
        print(f"✗ Pele در {TOOL} نصب نیست. اجرا کن:", file=sys.stderr)
        print(f"  cd {TOOL} && npm install pele", file=sys.stderr)
        return 2
    version = "?"
    try:
        import json

        with open(os.path.join(TOOL, "node_modules/pele/package.json"), encoding="utf-8") as f:
            version = json.load(f).get("version", "?")
    except Exception:
        pass
    print(f"✓ Pele {version} در {TOOL}")
    return 0


def convert(src: str, png: bool) -> int:
    if not os.path.isfile(src):
        print(f"✗ فایل نیست: {src}", file=sys.stderr)
        return 2
    dst = os.path.splitext(src)[0] + ".svg"
    try:
        out = subprocess.run(
            [NODE, "-e", NODE_SRC, os.path.abspath(src), os.path.abspath(dst)],
            cwd=TOOL,
            capture_output=True,
            text=True,
            timeout=60,
        )
    except subprocess.TimeoutExpired:
        print(f"✗ {src}: بیش از ۶۰ ثانیه — نمودار خیلی بزرگ است؟", file=sys.stderr)
        return 1
    if out.returncode != 0:
        detail = "بدونِ پیام"
        for line in (out.stderr or "").split("\n"):
            if line.startswith("PELE_ERR:"):
                detail = line[len("PELE_ERR:") :].strip()
                break
        print(f"✗ {src}: Pele رد کرد — {detail}", file=sys.stderr)
        return 1
    size = out.stdout.strip()
    print(f"✓ {os.path.basename(src)} → {os.path.basename(dst)} ({size} بایت)")

    if png:
        if not shutil.which("qlmanage"):
            print("  (qlmanage نیست، PNG ساخته نشد)", file=sys.stderr)
            return 0
        r = subprocess.run(
            ["qlmanage", "-t", "-s", "1400", "-o", os.path.dirname(os.path.abspath(dst)), os.path.abspath(dst)],
            capture_output=True,
            text=True,
        )
        made = os.path.abspath(dst) + ".png"
        if os.path.exists(made):
            print(f"  PNG: {made}")
        elif r.returncode != 0:
            print("  (PNG ساخته نشد)", file=sys.stderr)
    return 0


def main(argv: list[str]) -> int:
    if not argv or argv[0] in ("-h", "--help"):
        print(__doc__)
        return 0
    if argv[0] == "--check":
        return check()

    png = "--png" in argv
    files = [a for a in argv if not a.startswith("--")]
    if not files:
        print("✗ هیچ فایلی ندادی. `--help` را ببین.", file=sys.stderr)
        return 2

    rc = check()
    if rc != 0:
        return rc
    worst = 0
    for f in files:
        rc = convert(f, png)
        worst = max(worst, rc)
    return worst


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
