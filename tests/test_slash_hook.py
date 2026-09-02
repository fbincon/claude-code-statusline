"""Tests for the direct /statusline-config UserPromptExpansion hook."""

import json
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from claude_statusline import display_config as dc
from claude_statusline import slash_hook


def payload(arguments=""):
    return {
        "hook_event_name": "UserPromptExpansion",
        "expansion_type": "slash_command",
        "command_name": "statusline-config",
        "command_args": arguments,
    }


class SlashHookTests(unittest.TestCase):
    def setUp(self):
        self.tempdir = tempfile.TemporaryDirectory(prefix="statusline-slash-test-")
        self.config_dir = Path(self.tempdir.name) / "claude"
        self.executable = Path(self.tempdir.name) / "bin" / "claude-statusline"

    def tearDown(self):
        self.tempdir.cleanup()

    def handle(self, value):
        with (
            mock.patch.object(
                slash_hook.installer,
                "resolve_config_dir",
                return_value=self.config_dir,
            ),
            mock.patch.object(
                slash_hook.installer,
                "resolve_cli_executable",
                return_value=self.executable,
            ),
        ):
            return slash_hook.handle_payload(value)

    def test_empty_arguments_pass_through_to_guided_skill(self):
        self.assertIsNone(self.handle(payload("   ")))

    def test_unrelated_events_and_commands_are_ignored(self):
        values = [
            {},
            {**payload("show"), "hook_event_name": "UserPromptSubmit"},
            {**payload("show"), "expansion_type": "mcp_prompt"},
            {**payload("show"), "command_name": "other"},
        ]
        for value in values:
            with self.subTest(value=value):
                self.assertIsNone(self.handle(value))

    def test_direct_arguments_update_locally_and_block_model_expansion(self):
        result = json.loads(self.handle(payload("set-items git tokens")))
        self.assertEqual(result["decision"], "block")
        self.assertIn("updated", result["reason"])
        self.assertEqual(
            dc.load_display_config(self.config_dir).items, ("git", "tokens")
        )

    def test_show_returns_configuration_in_block_reason(self):
        result = json.loads(self.handle(payload("show")))
        self.assertEqual(result["decision"], "block")
        self.assertIn("Items:", result["reason"])
        self.assertIn("Installed: no", result["reason"])

    def test_help_and_invalid_arguments_block_without_changes(self):
        help_result = json.loads(self.handle(payload("help")))
        self.assertIn("Usage:", help_result["reason"])

        invalid = json.loads(self.handle(payload("set-items clock")))
        self.assertEqual(invalid["decision"], "block")
        self.assertIn("was not changed", invalid["reason"])
        self.assertFalse(dc.config_path(self.config_dir).exists())

    def test_non_string_arguments_are_rejected(self):
        result = json.loads(self.handle(payload(["show"])))
        self.assertEqual(result["decision"], "block")
        self.assertIn("invalid arguments", result["reason"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
