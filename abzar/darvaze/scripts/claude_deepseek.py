#!/usr/bin/env python3
"""Prepare/launch a separate Claude Code -> OpenRouter pilot.

check is offline. smoke/start need an authenticated API key; Habib removed the cap requirement.
No key is stored, printed, placed in argv, or sent to a configurable host.
This is a pilot launcher, not proof of whole-workflow migration.
"""
import argparse
import getpass
import json
import math
import os
from pathlib import Path
import shutil
import subprocess
import sys
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
SETTINGS = ROOT / "claude-api/settings.json"
WORKSPACE = ROOT / "claude-api/workspace"
RUNTIME = ROOT / ".runtime/claude-deepseek"
MODEL = "deepseek/deepseek-v4.1-flash-1017"
PRICE_CAPPED_MODEL = MODEL + "@preset/cheap-deepseek"
BASE = "https://openrouter.ai/api"
MAX_KEY_LIMIT = 4.0  # Reserve $1 of the approved $5 for fees; no credit purchase here.
PROMPT = "فایل sample.txt را با ابزار Read بخوان. فقط جدول فارسی با شناسهٔ سفارش و جمع تعداد ضربدر قیمت بده. اگر خواندن شکست خورد، صریح بگو؛ عدد را حدس نزن."


class PilotError(Exception):
    pass


def validate_settings(settings):
    env = settings.get("env", {})
    configured_model = settings.get("model")
    if configured_model not in (MODEL, PRICE_CAPPED_MODEL) or env.get("ANTHROPIC_BASE_URL") != BASE:
        raise PilotError("مدل یا نشانی API با طرح آزمایش یکسان نیست.")
    if env.get("ANTHROPIC_API_KEY") != "" or "ANTHROPIC_AUTH_TOKEN" in env:
        raise PilotError("فایل تنظیم باید بدون کلید و بدون ورود حساب اصلی باشد.")
    for name in ("ANTHROPIC_MODEL", "ANTHROPIC_DEFAULT_OPUS_MODEL", "ANTHROPIC_DEFAULT_SONNET_MODEL",
                 "ANTHROPIC_DEFAULT_HAIKU_MODEL", "CLAUDE_CODE_SUBAGENT_MODEL"):
        if env.get(name) != configured_model:
            raise PilotError("یکی از مسیرهای مدل به DeepSeek تنظیم نشده است.")
    return settings


def finite_number(value):
    return type(value) in (int, float) and math.isfinite(value)


def validate_budget(payload):
    if not isinstance(payload, dict) or not isinstance(payload.get("data"), dict):
        raise PilotError("پاسخ بررسی سقف کلید قابل تشخیص نیست.")
    data = payload.get("data", {})
    limit, remaining = data.get("limit"), data.get("limit_remaining")
    if not finite_number(limit) or not 0 < limit <= MAX_KEY_LIMIT:
        raise PilotError("کلید آزمایش باید سقف کل مثبت و حداکثر ۴ دلار داشته باشد.")
    if "limit_reset" not in data or data["limit_reset"] is not None:
        raise PilotError("سقف کلید نباید روزانه/ماهانه تمدید شود.")
    if data.get("include_byok_in_limit") is not True:
        raise PilotError("سقف کلید باید مصرف BYOK را هم پوشش دهد.")
    if not finite_number(remaining) or not 0 < remaining <= limit:
        raise PilotError("اعتبار باقی‌ماندهٔ کلید نامعلوم یا تمام شده است.")
    return remaining


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise PilotError("تغییر نشانی بررسی کلید پذیرفته نشد.")


def check_remote_key(key):
    request = urllib.request.Request(BASE + "/v1/key", headers={"Authorization": "Bearer " + key})
    try:
        with urllib.request.build_opener(NoRedirect()).open(request, timeout=20) as response:
            payload = json.load(response)
        if not isinstance(payload, dict) or not isinstance(payload.get("data"), dict):
            raise PilotError("پاسخ بررسی کلید معتبر نیست.")
        return payload["data"]
    except (urllib.error.URLError, ValueError):
        # Do not print raw responses, request headers or credential-containing exceptions.
        raise PilotError("اعتبارسنجی کلید ناموفق بود؛ Claude اجرا نشد.") from None


def child_env(settings, key):
    env = {k: v for k, v in os.environ.items()
           if not k.startswith(("CLAUDE", "ANTHROPIC", "OPENROUTER", "REMEMBER"))}
    env.update(settings["env"])
    env["ANTHROPIC_AUTH_TOKEN"] = key
    env["CLAUDE_CONFIG_DIR"] = str(RUNTIME)
    return env


def command(binary, mode):
    argv = [binary, "--settings", str(SETTINGS), "--setting-sources", "",
            "--model", MODEL, "--fallback-model", MODEL,
            "--strict-mcp-config", "--mcp-config", '{"mcpServers":{}}',
            "--no-chrome", "--disallowedTools", "Agent,Task",
            "--append-system-prompt", "فارسی و در جدول جواب بده. بدون اجازهٔ حبیب دستیار فرزند نساز. این جلسه آزمایشی است."]
    if mode == "smoke":
        argv += ["--print", "--output-format", "json", "--tools", "Read",
                 "--allowedTools", "Read", "--permission-mode", "dontAsk",
                 "--max-budget-usd", "0.25", PROMPT]
    else:
        argv += ["--permission-mode", "manual", "--name", "آزمایش DeepSeek — پروژه ۲۱۶"]
    return argv


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=["check", "smoke", "start"], nargs="?", default="check")
    args = parser.parse_args()
    try:
        settings = validate_settings(json.loads(SETTINGS.read_text()))
        binary = shutil.which("claude")
        if not binary:
            raise PilotError("Claude Code در PATH پیدا نشد.")
        if not (WORKSPACE / "sample.txt").is_file():
            raise PilotError("فایل نمونهٔ آزمون وجود ندارد.")
        if args.mode == "check":
            version = subprocess.run([binary, "--version"], capture_output=True, text=True, check=True).stdout.strip()
            print(json.dumps({"status": "prepared_not_connected", "claude": version,
                              "model": MODEL, "base_url": BASE, "key_required_later": True,
                              "key_limit_enforced": False,
                              "global_settings_modified": False}, ensure_ascii=False, indent=2))
            return 0
        key = os.environ.get("OPENROUTER_API_KEY", "").strip()
        if not key:
            if not sys.stdin.isatty():
                raise PilotError("کلید آماده نیست؛ هیچ درخواست شبکه‌ای فرستاده نشد.")
            key = getpass.getpass("کلید OpenRouter؛ نمایش و ذخیره نمی‌شود: ").strip()
        if not key.startswith("sk-or-") or any(c.isspace() for c in key):
            raise PilotError("قالب کلید OpenRouter معتبر نیست؛ Claude اجرا نشد.")
        check_remote_key(key)
        RUNTIME.mkdir(parents=True, exist_ok=True, mode=0o700)
        # Habib explicitly removed the provider-key cap requirement at 19:28.
        # Keep the experiment narrow; no automatic retries.
        result = subprocess.run(command(binary, args.mode), cwd=WORKSPACE, env=child_env(settings, key))
        return result.returncode
    except (PilotError, OSError, ValueError, subprocess.SubprocessError) as error:
        if isinstance(error, PilotError):
            print(str(error), file=sys.stderr)
        else:
            print("آماده‌سازی ناموفق بود؛ تنظیم یا نسخهٔ برنامه را بررسی کنید.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
