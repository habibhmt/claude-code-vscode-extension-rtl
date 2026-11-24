#!/usr/bin/env python3
"""prepare/check are offline; open needs the user's later API key."""
import argparse
import getpass
import json
import os
from pathlib import Path
import subprocess
import sys

from claude_deepseek import ROOT, RUNTIME, WORKSPACE, SETTINGS, PilotError, validate_settings, child_env, check_remote_key

CODE = Path("/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code")
USER_DATA = ROOT / ".runtime/vscode-deepseek"
USER_SETTINGS = USER_DATA / "User/settings.json"
WORKSPACE_FILE = ROOT / "claude-api/deepseek.code-workspace"
WRAPPER = ROOT / "scripts/vscode_deepseek_wrapper.py"
EXTENSIONS = Path.home() / ".vscode/extensions"


def expected_settings():
    return {"claudeCode.claudeProcessWrapper": str(WRAPPER),
            "claudeCode.environmentVariables": [{"name": "CLAUDE_CONFIG_DIR", "value": str(Path.home() / ".claude")}],
            "claudeCode.allowDangerouslySkipPermissions": True,
            "extensions.autoUpdate": False, "extensions.autoCheckUpdates": False,
            "update.mode": "none", "telemetry.telemetryLevel": "off"}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=["prepare", "check", "open"], nargs="?", default="check")
    args = parser.parse_args()
    try:
        settings = validate_settings(json.loads(SETTINGS.read_text()))
        if not CODE.is_file() or not WRAPPER.is_file():
            raise PilotError("VS Code یا راه‌انداز پیدا نشد.")
        installed = list(EXTENSIONS.glob("anthropic.claude-code-*/package.json"))
        if not installed:
            raise PilotError("افزونهٔ Claude Code پیدا نشد.")
        if args.mode == "prepare":
            USER_SETTINGS.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
            content = json.dumps(expected_settings(), ensure_ascii=False, indent=2) + "\n"
            if USER_SETTINGS.exists() and USER_SETTINGS.read_text() != content:
                raise PilotError("تنظیم آزمایشی قبلاً تغییر کرده؛ بازنویسی خودکار انجام نشد.")
            USER_SETTINGS.write_text(content)
            WRAPPER.chmod(0o700)
        actual = json.loads(USER_SETTINGS.read_text())
        expected = expected_settings()
        if any(actual.get(k) != v for k, v in expected.items() if k != "extensions.autoUpdate") or actual.get("extensions.autoUpdate") not in (False, "off"):
            raise PilotError("تنظیم پنجرهٔ آزمایشی با طرح برابر نیست.")
        if not os.access(WRAPPER, os.X_OK):
            raise PilotError("راه‌انداز اجازهٔ اجرا ندارد.")
        workspace = json.loads(WORKSPACE_FILE.read_text())
        if workspace.get("folders") != [{"path": "workspace"}]:
            raise PilotError("پوشهٔ آزمایشی تغییر کرده است.")
        if args.mode != "open":
            print("VS Code pilot prepared; existing extension reused; key and live UI connection NOT tested.")
            return 0
        # Normal VS Code profile is now the only launch target. Credentials
        # are loaded by its adapter from Keychain; no separate user-data-dir.
        result = subprocess.run([str(CODE), "--reuse-window", str(Path.cwd())])
        return result.returncode
    except (OSError, ValueError, PilotError) as error:
        print(str(error) if isinstance(error, PilotError) else "آماده‌سازی VS Code ناموفق بود.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
