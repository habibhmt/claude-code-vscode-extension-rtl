"""Offline VS Code wrapper contract tests; no model calls."""
import json
import os
from pathlib import Path
import subprocess
import sys
import unittest
from unittest.mock import patch

import vscode_deepseek as vscode
import vscode_deepseek_wrapper as wrapper
from claude_deepseek import MODEL, PilotError

NATIVE = Path.home() / ".vscode/extensions/anthropic.claude-code-2.1.325-darwin-arm64/resources/native-binary/claude"


class WrapperTests(unittest.TestCase):
    def test_native_version_through_actual_wrapper_without_key(self):
        env = os.environ.copy()
        env.pop("ANTHROPIC_AUTH_TOKEN", None)
        run = subprocess.run([sys.executable, str(vscode.WRAPPER), str(NATIVE), "--version"],
                             env=env, capture_output=True, text=True, timeout=10)
        self.assertEqual(run.returncode, 0, run.stderr)
        self.assertIn("2.1.325", run.stdout)

    def test_missing_key_blocks_before_network_and_native_start(self):
        with patch.object(wrapper, "check_remote_key") as remote:
            with self.assertRaises(PilotError):
                wrapper.prepare(str(NATIVE), ["--print", "hello"], "")
            remote.assert_not_called()

    def test_local_helpers_preserve_arguments_without_network(self):
        for args in (["--setting-sources", "user", "workspace-trust", "--json"],
                     ["auth", "status", "--json"]):
            with self.subTest(args=args), patch.object(wrapper, "check_remote_key") as remote:
                argv, env = wrapper.prepare(str(NATIVE), args, "")
                self.assertEqual(argv, [str(NATIVE.resolve()), *args])
                self.assertEqual(env["CLAUDE_CONFIG_DIR"], str(Path.home() / ".claude"))
                remote.assert_not_called()

    def test_prompt_is_not_misclassified_as_helper(self):
        self.assertFalse(wrapper.is_readonly_helper(["--print", "workspace-trust", "--json"]))

    def test_actual_workspace_trust_through_wrapper(self):
        args = ["--setting-sources", "user", "workspace-trust", "--json"]
        argv, env = wrapper.prepare(str(NATIVE), args, "")
        result = subprocess.run(argv, env=env, cwd=vscode.WORKSPACE,
                                capture_output=True, text=True, timeout=15)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIsInstance(json.loads(result.stdout), dict)

    def test_bad_binary_rejected(self):
        with self.assertRaises(PilotError):
            wrapper.prepare("/bin/echo", ["--version"], "")

    def test_only_model_overrides_replaced(self):
        with patch.object(wrapper, "check_remote_key", return_value=4):
            args, env = wrapper.prepare(str(NATIVE), ["--print", "--input-format", "stream-json",
                "--output-format", "stream-json", "--model", "claude-opus", "--settings=/tmp/wrong.json",
                "--permission-mode", "bypassPermissions", "--dangerously-skip-permissions"], "sk-or-fixture")
        self.assertIn("stream-json", args)
        self.assertEqual(args[args.index("--model") + 1], json.loads(wrapper.SETTINGS.read_text())["model"])
        self.assertEqual(args[args.index("--permission-mode") + 1], "bypassPermissions")
        self.assertIn("--dangerously-skip-permissions", args)
        self.assertNotIn("claude-opus", args)
        self.assertIn("--settings=/tmp/wrong.json", args)
        self.assertNotIn("--strict-mcp-config", args)
        self.assertNotIn("--setting-sources", args)
        self.assertEqual(env["CLAUDE_CONFIG_DIR"], str(Path.home() / ".claude"))
        self.assertNotIn("sk-or-fixture", " ".join(args))
        self.assertEqual(env["CLAUDE_CODE_ENTRYPOINT"], "claude-vscode")

    def test_claude_model_goes_direct_to_anthropic(self):
        with patch.dict(os.environ, {"ANTHROPIC_BASE_URL": "https://openrouter.ai/api", "ANTHROPIC_AUTH_TOKEN": "sk-or-x"}):
            args, env = wrapper.prepare(str(NATIVE), ["--model", "claude-opus-5-5", "--fallback-model", "x", "--resume", "r"], "", "sk-ant-fixture")
        self.assertEqual(args[args.index("--model") + 1], "claude-opus-5-5")
        self.assertNotIn("--fallback-model", args)
        self.assertNotIn("ANTHROPIC_BASE_URL", env)
        self.assertNotIn("ANTHROPIC_AUTH_TOKEN", env)
        self.assertEqual(env["ANTHROPIC_API_KEY"], "sk-ant-fixture")
        self.assertNotIn("sk-ant-fixture", " ".join(args))
        with self.assertRaises(wrapper.PilotError):
            wrapper.prepare(str(NATIVE), ["--model", "claude-opus-5-5"], "", None)

    def test_explicit_deepseek_survives_and_fallback_matches(self):
        for model in json.loads(wrapper.MODEL_CATALOG.read_text()):
            value = model["value"]
            if not value.startswith("deepseek/"):
                continue
            with self.subTest(model=value), patch.object(wrapper, "check_remote_key"):
                args, env = wrapper.prepare(str(NATIVE), ["--model=" + value,
                    "--fallback-model", "claude-opus", "--resume", "fixture"], "sk-or-fixture")
                self.assertEqual(args[args.index("--model") + 1], value)
                self.assertEqual(args[args.index("--fallback-model") + 1], value)
                self.assertEqual(env["ANTHROPIC_MODEL"], value)
                self.assertEqual(env["CLAUDE_CODE_SUBAGENT_MODEL"], value)
                self.assertIn("--resume", args)

    def test_unknown_deepseek_fails_closed(self):
        with patch.object(wrapper, "check_remote_key"):
            with self.assertRaises(PilotError):
                wrapper.prepare(str(NATIVE), ["--model", "deepseek/made-up"], "sk-or-fixture")

    def test_over_budget_key_does_not_produce_launch(self):
        with patch.object(wrapper, "check_remote_key", side_effect=PilotError("fixture budget rejected")):
            with self.assertRaises(PilotError):
                wrapper.prepare(str(NATIVE), ["--print"], "sk-or-fixture")

    def test_profile_is_separate_and_secret_free(self):
        expected = vscode.expected_settings()
        actual = json.loads(vscode.USER_SETTINGS.read_text())
        for k, v in expected.items():
            if k != "extensions.autoUpdate":
                self.assertEqual(actual.get(k), v)
        self.assertNotIn("sk-or-", json.dumps(expected))
        self.assertTrue(vscode.USER_SETTINGS.is_relative_to(vscode.ROOT / ".runtime"))
        self.assertTrue(expected["claudeCode.allowDangerouslySkipPermissions"])


if __name__ == "__main__":
    unittest.main()
