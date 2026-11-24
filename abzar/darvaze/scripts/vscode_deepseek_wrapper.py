#!/usr/bin/env python3
"""VS Code's claudeProcessWrapper contract: native binary, then CLI arguments."""
import json
import os
from pathlib import Path
import sys

from openrouter_attribution import apply_project_attribution

from claude_deepseek import ROOT, SETTINGS, RUNTIME, MODEL, PilotError, validate_settings, check_remote_key


MODEL_CATALOG = ROOT / "claude-api/deepseek-models.json"


def selected_model(args, default_model=MODEL, *, picker_accounts=False):
    catalog = json.loads(MODEL_CATALOG.read_text())
    if not isinstance(catalog, list) or not catalog or any(
            not isinstance(m, dict) or not isinstance(m.get("value"), str)
            or not m["value"].startswith(("deepseek/", "claude-")) or ":" in m["value"] for m in catalog):
        raise PilotError("فهرست مدل DeepSeek معتبر نیست.")
    allowed = {m["value"] for m in catalog}
    paired = {m["value"]: m["openRouterModel"] for m in catalog if m.get("openRouterModel")}
    allowed.update(paired.values())
    allowed.update("anthropic-api/" + native for native in paired)
    requested = None
    for i, arg in enumerate(args):
        if arg == "--model" and i + 1 < len(args):
            requested = args[i + 1]
        elif arg.startswith("--model="):
            requested = arg.split("=", 1)[1]
    if requested in allowed:
        if picker_accounts and requested in paired:
            # An old, unqualified model setting must not opt into Console billing.
            return paired[requested]
        return requested
    if requested and requested.startswith(("deepseek/", "anthropic/", "anthropic-api/")):
        raise PilotError("مدل انتخاب‌شده در فهرست نیست.")
    if default_model not in allowed:
        raise PilotError("مدل پیش‌فرض در فهرست تأییدشده نیست.")
    return default_model


def is_readonly_helper(args):
    # Exact helper shapes used by the installed extension, allowing its root
    # setting-sources prefix. Do not classify a prompt containing these words.
    rest = list(args)
    if rest[:1] == ["--setting-sources"] and len(rest) >= 2:
        rest = rest[2:]
    elif rest and rest[0].startswith("--setting-sources="):
        rest = rest[1:]
    return rest in (["workspace-trust", "--json"], ["auth", "status", "--json"])


ANTHROPIC_SMALL = "claude-haiku-5-5"


def anthropic_env(model, key):
    """Anthropic models go straight to api.anthropic.com with Habib's Anthropic key."""
    if not key or not key.startswith("sk-ant-") or any(c.isspace() for c in key):
        raise PilotError("کلید Anthropic آماده نیست.")
    env = {k: v for k, v in os.environ.items()
           if k not in ("ANTHROPIC_BASE_URL", "ANTHROPIC_AUTH_TOKEN", "ANTHROPIC_CUSTOM_HEADERS")}
    for name in ("ANTHROPIC_MODEL", "ANTHROPIC_DEFAULT_OPUS_MODEL", "ANTHROPIC_DEFAULT_SONNET_MODEL"):
        env[name] = model
    env["ANTHROPIC_DEFAULT_HAIKU_MODEL"] = ANTHROPIC_SMALL
    env["ANTHROPIC_SMALL_FAST_MODEL"] = ANTHROPIC_SMALL
    env.pop("CLAUDE_CODE_SUBAGENT_MODEL", None)
    env["ANTHROPIC_API_KEY"] = key
    env["CLAUDE_CONFIG_DIR"] = str(Path.home() / ".claude")
    # With entrypoint claude-vscode the CLI ignores ANTHROPIC_API_KEY and asks for /login.
    env.pop("CLAUDE_CODE_ENTRYPOINT", None)
    return env


def prepare(binary, args, key, anthropic_key=None, *, picker_accounts=False):
    native = Path(binary).resolve()
    extensions = (Path.home() / ".vscode/extensions").resolve()
    if not native.is_relative_to(extensions) or native.name != "claude" or not native.is_file():
        raise PilotError("باینری Claude افزونهٔ VS Code معتبر نیست.")
    if args in (["--version"], ["-v"], ["--help"], ["-h"]):
        return [str(native), *args], None
    if is_readonly_helper(args):
        env = os.environ.copy()
        env["CLAUDE_CONFIG_DIR"] = str(Path.home() / ".claude")
        # Helpers are local inspection: no model flags or remote key check.
        return [str(native), *args], env
    requested_model = selected_model(args, picker_accounts=picker_accounts)
    if not picker_accounts and requested_model.startswith(("claude-", "anthropic-api/")):
        requested_model = requested_model.removeprefix("anthropic-api/")
        replaced = {"--model", "--fallback-model"}
        cleaned, skip = [], False
        for arg in args:
            if skip:
                skip = False
                continue
            if arg in replaced:
                skip = True
            elif arg.split("=", 1)[0] not in replaced:
                cleaned.append(arg)
        cleaned += ["--model", requested_model]
        return [str(native), *cleaned], anthropic_env(requested_model, anthropic_key)
    if not picker_accounts and (not key or not key.startswith("sk-or-") or any(c.isspace() for c in key)):
        raise PilotError("کلید آزمایش آماده نیست. پنجرهٔ آزمایشی را بعداً از راه‌انداز همین پروژه باز کنید.")
    settings = validate_settings(json.loads(SETTINGS.read_text()))
    if not picker_accounts:
        check_remote_key(key)
    # Preserve the extension's tools, permissions, resume and settings arguments.
    # Only model selection belongs to this provider adapter.
    replaced = {"--model", "--fallback-model"}
    cleaned = []
    skip = False
    for arg in args:
        if skip:
            skip = False
            continue
        if arg in replaced:
            skip = True
        elif arg.split("=", 1)[0] not in replaced:
            cleaned.append(arg)
    model = selected_model(args, settings["model"], picker_accounts=picker_accounts)
    cleaned += ["--model", model]
    if not picker_accounts:
        cleaned += ["--fallback-model", model]
    env = os.environ.copy()
    env.update({k: v for k, v in settings["env"].items()
                if k.startswith("ANTHROPIC_")
                or k in ("CLAUDE_CODE_SUBAGENT_MODEL", "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC")})
    for name in ("ANTHROPIC_MODEL", "ANTHROPIC_DEFAULT_OPUS_MODEL", "ANTHROPIC_DEFAULT_SONNET_MODEL",
                 "ANTHROPIC_DEFAULT_HAIKU_MODEL", "ANTHROPIC_SMALL_FAST_MODEL", "CLAUDE_CODE_SUBAGENT_MODEL"):
        env[name] = model
    env["ANTHROPIC_AUTH_TOKEN"] = key
    env["CLAUDE_CONFIG_DIR"] = str(Path.home() / ".claude")
    env["CLAUDE_CODE_ENTRYPOINT"] = "claude-vscode"
    env = apply_project_attribution(env, Path.cwd())
    from live_request_trace import apply_trace, apply_account_gateway
    try:
        env = apply_account_gateway(env, Path.cwd()) if picker_accounts else apply_trace(env, Path.cwd())
    except RuntimeError as exc:
        raise PilotError("ثبت‌کنندهٔ محلی آماده نیست؛ اتصال متوقف شد.") from exc
    return [str(native), *cleaned], env


def main():
    try:
        if len(sys.argv) < 2:
            raise PilotError("این فایل را افزونهٔ VS Code باید با مسیر Claude اجرا کند.")
        argv, env = prepare(sys.argv[1], sys.argv[2:], os.environ.get("ANTHROPIC_AUTH_TOKEN", ""))
        if env is not None:
            os.execve(argv[0], argv, env)
        os.execv(argv[0], argv)
    except (PilotError, OSError, ValueError):
        print("Claude آزمایشی اجرا نشد؛ کلید یا تنظیم اتصال آماده نیست. راهنما: claude-api/README.md", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
