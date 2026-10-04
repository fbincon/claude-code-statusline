"""Tests for the direct /statusline-config UserPromptExpansion hook."""

from claude_statusline.config import display as config_display
from claude_statusline.config import features as config_features
from claude_statusline.integration import capabilities as integration_capabilities
from claude_statusline.integration import launcher as integration_launcher
from claude_statusline.integration import models as integration_models
from claude_statusline.integration import ownership as integration_ownership
from claude_statusline.integration import slash_hook as integration_slash_hook

import json
import tempfile
import unittest
from pathlib import Path
from unittest import mock


def payload(arguments="", command_name="statusline-config"):
    return {
        "hook_event_name": "UserPromptExpansion",
        "expansion_type": "slash_command",
        "command_name": command_name,
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
                integration_ownership,
                "resolve_config_dir",
                return_value=self.config_dir,
            ),
            mock.patch.object(
                integration_ownership,
                "resolve_cli_executable",
                return_value=self.executable,
            ),
        ):
            return integration_slash_hook.handle_payload(value)

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
            config_display.load_display_config(self.config_dir).items, ("git", "tokens")
        )

        result = json.loads(
            self.handle(payload("subagents set-items status name tokens"))
        )
        self.assertEqual(result["decision"], "block")
        self.assertEqual(
            config_display.load_display_config(self.config_dir).subagents.items,
            ("status", "name", "tokens"),
        )

        result = json.loads(self.handle(payload("set scope-labels always")))
        self.assertEqual(result["decision"], "block")
        self.assertEqual(
            config_display.load_display_config(self.config_dir).scope_labels, "always"
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
        self.assertFalse(config_display.config_path(self.config_dir).exists())

    def test_non_string_arguments_are_rejected(self):
        result = json.loads(self.handle(payload(["show"])))
        self.assertEqual(result["decision"], "block")
        self.assertIn("invalid arguments", result["reason"])


class ExperimentalSlashHookTests(unittest.TestCase):
    def setUp(self):
        self.tempdir = tempfile.TemporaryDirectory(prefix="statusline-slash-test-")
        self.config_dir = Path(self.tempdir.name) / "claude"
        self.executable = Path(self.tempdir.name) / "bin" / "claude-statusline"

    def tearDown(self):
        self.tempdir.cleanup()

    def handle(self, value):
        with (
            mock.patch.object(
                integration_ownership,
                "resolve_config_dir",
                return_value=self.config_dir,
            ),
            mock.patch.object(
                integration_ownership,
                "resolve_cli_executable",
                return_value=self.executable,
            ),
        ):
            return integration_slash_hook.handle_payload(value)

    def experimental_payload(self, arguments=""):
        return payload(arguments, "statusline-configure")

    def enabled_handle(self, result, arguments=""):
        config_features.write_enabled(self.config_dir)
        with (
            mock.patch.object(
                integration_ownership,
                "resolve_config_dir",
                return_value=self.config_dir,
            ),
            mock.patch.object(
                integration_ownership,
                "resolve_cli_executable",
                return_value=self.executable,
            ),
            mock.patch.object(
                integration_capabilities,
                "detect_claude_version",
                return_value=(2, 1, 259),
            ),
            mock.patch.object(
                integration_launcher, "launch", return_value=result
            ) as launch,
        ):
            response = integration_slash_hook.handle_payload(
                self.experimental_payload(arguments)
            )
        return json.loads(response), launch

    def test_empty_arguments_launch_and_every_outcome_blocks_model(self):
        cases = {
            "updated": "Status line configuration updated. Backup: /backup",
            "already-current": "Status line configuration already current.",
            "cancelled": "Status line configuration unchanged.",
            "interrupted": "interrupted; no changes were saved",
            "timed-out": "timed out; no changes were saved",
            "error": "Interactive status line configuration failed: popup failed",
        }
        for outcome, expected in cases.items():
            with self.subTest(outcome=outcome):
                result = integration_models.TuiResult(
                    1,
                    outcome,
                    0 if outcome != "error" else 1,
                    cases[outcome],
                )
                response, launch = self.enabled_handle(result)
                self.assertEqual(response["decision"], "block")
                self.assertIn(expected, response["reason"])
                launch.assert_called_once_with(self.config_dir, self.executable, None)

    def test_stable_default_launches_without_a_preference_file(self):
        with (
            mock.patch.object(integration_capabilities, "detect_claude_version", return_value=(2, 1, 288)),
            mock.patch.object(integration_launcher, "launch", return_value=integration_models.TuiResult(1, "cancelled", 0, "unchanged")) as launch,
        ):
            result = json.loads(self.handle(self.experimental_payload()))
        self.assertEqual(result["decision"], "block")
        launch.assert_called_once_with(self.config_dir, self.executable, None)
        self.assertFalse(config_features.feature_path(self.config_dir).exists())

    def test_help_and_unsupported_arguments_never_launch(self):
        for arguments in ("help", "-h", "--help", "extra", ["bad"]):
            with (
                self.subTest(arguments=arguments),
                mock.patch.object(integration_launcher, "launch") as launch,
            ):
                result = json.loads(self.handle(self.experimental_payload(arguments)))
                self.assertEqual(result["decision"], "block")
                self.assertIn(
                    "Usage:" if isinstance(arguments, str) else "invalid",
                    result["reason"],
                )
                launch.assert_not_called()

    def test_disabled_corrupt_and_suspended_preferences_do_not_launch(self):
        self.config_dir.mkdir(parents=True)
        config_features.feature_path(self.config_dir).write_bytes(config_features.preference_bytes(False))
        with mock.patch.object(integration_launcher, "launch") as launch:
            disabled = json.loads(self.handle(self.experimental_payload()))
            self.assertIn("disabled", disabled["reason"])
            launch.assert_not_called()

        config_features.feature_path(self.config_dir).write_text(
            "broken", encoding="utf-8"
        )
        with mock.patch.object(integration_launcher, "launch") as launch:
            corrupt = json.loads(self.handle(self.experimental_payload()))
            self.assertIn("repair", corrupt["reason"])
            launch.assert_not_called()

        config_features.feature_path(self.config_dir).write_bytes(
            config_features.enabled_bytes()
        )
        with (
            mock.patch.object(
                integration_ownership,
                "resolve_config_dir",
                return_value=self.config_dir,
            ),
            mock.patch.object(
                integration_capabilities,
                "detect_claude_version",
                return_value=(2, 1, 257),
            ),
            mock.patch.object(integration_launcher, "launch") as launch,
        ):
            suspended = json.loads(
                integration_slash_hook.handle_payload(self.experimental_payload())
            )
        self.assertIn("suspended", suspended["reason"])
        launch.assert_not_called()

    def test_unavailable_launcher_returns_documented_fallback(self):
        result = integration_models.TuiResult(
            1, "error", 1, integration_models.UNAVAILABLE_MESSAGE
        )
        response, _launch = self.enabled_handle(result)
        self.assertEqual(response["reason"], integration_models.UNAVAILABLE_MESSAGE)


if __name__ == "__main__":
    unittest.main(verbosity=2)
