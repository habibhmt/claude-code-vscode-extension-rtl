"""Offline tests and deliberate corruptions. No provider or model calls."""
import copy
import importlib.util
import io
import json
import os
from pathlib import Path
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("pilot", Path(__file__).with_name("claude_deepseek.py"))
pilot = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pilot)


class PilotTests(unittest.TestCase):
    def setUp(self):
        self.settings = json.loads(pilot.SETTINGS.read_text())
        self.budget = {"data": {"limit": 4, "limit_remaining": 3.8,
                                "limit_reset": None, "include_byok_in_limit": True}}

    def test_expected_config(self):
        pilot.validate_settings(self.settings)

    def test_sabotage_endpoint_and_model(self):
        for target, field, value in [(self.settings, "model", "claude-sonnet"),
                                     (self.settings["env"], "ANTHROPIC_BASE_URL", "https://wrong.invalid")]:
            old = target[field]
            target[field] = value
            with self.assertRaises(pilot.PilotError):
                pilot.validate_settings(self.settings)
            target[field] = old

    def test_sabotage_child_model(self):
        self.settings["env"]["CLAUDE_CODE_SUBAGENT_MODEL"] = "sonnet"
        with self.assertRaises(pilot.PilotError):
            pilot.validate_settings(self.settings)

    def test_reject_secret_in_settings(self):
        self.settings["env"]["ANTHROPIC_AUTH_TOKEN"] = "fixture-not-a-real-key"
        with self.assertRaises(pilot.PilotError):
            pilot.validate_settings(self.settings)

    def test_valid_capped_key(self):
        self.assertEqual(pilot.validate_budget(self.budget), 3.8)

    def test_sabotage_budget(self):
        for field, value in [("limit", None), ("limit", 5), ("limit", float("nan")),
                             ("limit", True), ("limit_remaining", 0), ("limit_remaining", 5),
                             ("limit_reset", "monthly"), ("include_byok_in_limit", False)]:
            bad = copy.deepcopy(self.budget)
            bad["data"][field] = value
            with self.subTest(field=field, value=value), self.assertRaises(pilot.PilotError):
                pilot.validate_budget(bad)

    def test_missing_reset_metadata_rejected(self):
        del self.budget["data"]["limit_reset"]
        with self.assertRaises(pilot.PilotError):
            pilot.validate_budget(self.budget)

    def test_invalid_budget_payload(self):
        for payload in (None, [], {}, {"data": None}, {"data": []}):
            with self.subTest(payload=payload), self.assertRaises(pilot.PilotError):
                pilot.validate_budget(payload)

    def test_child_has_no_inherited_login_or_plugins(self):
        with patch.dict(os.environ, {"ANTHROPIC_API_KEY": "old", "CLAUDE_CODE_OAUTH_TOKEN": "old",
                                     "CLAUDE_CODE_PLUGIN_DIRS": "old", "OPENROUTER_API_KEY": "fixture"}):
            env = pilot.child_env(self.settings, "fixture-token")
        self.assertEqual(env["ANTHROPIC_API_KEY"], "")
        self.assertEqual(env["ANTHROPIC_AUTH_TOKEN"], "fixture-token")
        self.assertNotIn("CLAUDE_CODE_OAUTH_TOKEN", env)
        self.assertNotIn("CLAUDE_CODE_PLUGIN_DIRS", env)
        self.assertNotIn("OPENROUTER_API_KEY", env)
        self.assertEqual(env["CLAUDE_CONFIG_DIR"], str(pilot.RUNTIME))

    def test_no_key_does_not_start_or_call_network(self):
        with patch.dict(os.environ, {}, clear=True), patch("sys.argv", ["pilot", "smoke"]), \
                patch("sys.stdin.isatty", return_value=False), patch.object(pilot.shutil, "which", return_value="/fake/claude"), \
                patch.object(pilot, "check_remote_key") as remote, patch.object(pilot.subprocess, "run") as run, \
                patch("sys.stderr", new_callable=io.StringIO):
            self.assertEqual(pilot.main(), 1)
            remote.assert_not_called()
            run.assert_not_called()

    def test_smoke_is_read_only_and_no_credentials_in_arguments(self):
        argv = pilot.command("/fake/claude", "smoke")
        self.assertEqual(argv[argv.index("--tools") + 1], "Read")
        self.assertEqual(argv[argv.index("--setting-sources") + 1], "")
        self.assertIn("--strict-mcp-config", argv)
        self.assertEqual(argv[argv.index("--disallowedTools") + 1], "Agent,Task")
        self.assertFalse(any("sk-or-" in arg for arg in argv))

    def test_redirect_cannot_receive_key(self):
        with self.assertRaises(pilot.PilotError):
            pilot.NoRedirect().redirect_request(None, None, 302, "", {}, "https://other.invalid")


if __name__ == "__main__":
    unittest.main()
