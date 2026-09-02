#!/usr/bin/env python3
"""Regression tests for safe configuration installation and removal."""

import json
import os
from pathlib import Path
import stat
import tempfile
import unittest
from unittest import mock

from claude_statusline import installer


class InstallerTestCase(unittest.TestCase):
    def setUp(self):
        self.tempdir = tempfile.TemporaryDirectory(prefix="statusline-installer-test-")
        self.root = Path(self.tempdir.name)
        self.config = self.root / "claude"
        self.executable = self.root / "bin" / "claude-statusline"
        self.executable.parent.mkdir()
        self.executable.write_text("#!/bin/sh\nexit 0\n", encoding="utf-8")
        self.executable.chmod(0o755)

    def tearDown(self):
        self.tempdir.cleanup()

    @property
    def settings_path(self):
        return self.config / "settings.json"

    def write_settings(self, value, mode=0o600):
        self.config.mkdir(parents=True, exist_ok=True)
        self.settings_path.write_text(
            json.dumps(value, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        self.settings_path.chmod(mode)

    def read_settings(self):
        return json.loads(self.settings_path.read_text(encoding="utf-8"))

    def cli_hook_count(self, settings, event):
        return sum(
            installer._is_cli_command(command, "hook", self.executable)
            for command in installer._hook_commands(settings, event)
        )


class InstallTests(InstallerTestCase):
    def test_empty_config_is_created_with_private_permissions_and_backup(self):
        result = installer.install_configuration(self.config, self.executable)
        self.assertTrue(result.changed)
        self.assertTrue((result.backup_dir / "settings.json.absent").is_file())
        settings = self.read_settings()
        self.assertEqual(settings["statusLine"], {
            "type": "command",
            "command": installer.command_for(self.executable, "render"),
            "refreshInterval": 1,
        })
        for event in installer.HOOK_EVENTS:
            self.assertEqual(self.cli_hook_count(settings, event), 1)
        self.assertEqual(stat.S_IMODE(self.settings_path.stat().st_mode), 0o600)
        self.assertEqual(
            stat.S_IMODE((self.config / "statusline_runtime").stat().st_mode),
            0o700,
        )

    def test_legacy_configuration_is_replaced_and_unrelated_values_survive(self):
        legacy_render = f'"/usr/bin/python3" "{self.config / "statusline.py"}"'
        legacy_hook = f'"/usr/bin/python3" "{self.config / "turn_state.py"}"'
        other_action = {"type": "command", "command": "other-tool", "timeout": 8}
        original = {
            "theme": "dark",
            "enabledPlugins": {"example@market": True},
            "statusLine": {
                "type": "command", "command": legacy_render,
                "refreshInterval": 1,
            },
            "hooks": {
                "SessionStart": [{"matcher": "x", "hooks": [other_action, {
                    "type": "command", "command": legacy_hook, "timeout": 5,
                }]}],
                "PostToolUse": [{"hooks": [other_action]}],
            },
        }
        self.write_settings(original)
        installer.install_configuration(self.config, self.executable)
        settings = self.read_settings()
        self.assertEqual(settings["theme"], "dark")
        self.assertEqual(settings["enabledPlugins"], original["enabledPlugins"])
        self.assertEqual(
            installer._hook_commands(settings, "PostToolUse"), ["other-tool"]
        )
        self.assertIn("other-tool", installer._hook_commands(settings, "SessionStart"))
        self.assertNotIn(legacy_hook, installer._hook_commands(settings, "SessionStart"))
        for event in installer.HOOK_EVENTS:
            self.assertEqual(self.cli_hook_count(settings, event), 1)

    def test_unrelated_statusline_is_refused_without_force(self):
        original = {
            "statusLine": {"type": "command", "command": "my-own-status"},
            "theme": "dark",
        }
        self.write_settings(original)
        before = self.settings_path.read_bytes()
        with self.assertRaises(installer.ConfigurationError):
            installer.install_configuration(self.config, self.executable)
        self.assertEqual(self.settings_path.read_bytes(), before)
        self.assertFalse((self.config / "backups" / "statusline").exists())

    def test_force_replaces_unrelated_statusline(self):
        self.write_settings({
            "statusLine": {"type": "command", "command": "my-own-status"},
        })
        installer.install_configuration(
            self.config, self.executable, force=True
        )
        self.assertEqual(
            self.read_settings()["statusLine"]["command"],
            installer.command_for(self.executable, "render"),
        )

    def test_install_is_idempotent_and_does_not_duplicate_hooks(self):
        first = installer.install_configuration(self.config, self.executable)
        backup_count = len(list(first.backup_dir.parent.glob("cli-install-*")))
        second = installer.install_configuration(self.config, self.executable)
        self.assertFalse(second.changed)
        self.assertIsNone(second.backup_dir)
        self.assertEqual(
            len(list(first.backup_dir.parent.glob("cli-install-*"))),
            backup_count,
        )
        settings = self.read_settings()
        for event in installer.HOOK_EVENTS:
            self.assertEqual(self.cli_hook_count(settings, event), 1)

    def test_dry_run_reports_change_without_creating_files(self):
        result = installer.install_configuration(
            self.config, self.executable, dry_run=True
        )
        self.assertTrue(result.changed)
        self.assertFalse(self.config.exists())

    def test_invalid_json_is_rejected_without_rewrite(self):
        self.config.mkdir()
        self.settings_path.write_text("{broken", encoding="utf-8")
        before = self.settings_path.read_bytes()
        with self.assertRaises(installer.ConfigurationError):
            installer.install_configuration(self.config, self.executable)
        self.assertEqual(self.settings_path.read_bytes(), before)

    def test_atomic_write_removes_temp_files_and_fixes_mode(self):
        self.write_settings({"theme": "dark"}, mode=0o644)
        installer.install_configuration(self.config, self.executable)
        self.assertEqual(stat.S_IMODE(self.settings_path.stat().st_mode), 0o600)
        self.assertEqual(
            list(self.config.glob(".settings.claude-statusline-*.tmp")), []
        )


class UninstallTests(InstallerTestCase):
    def test_uninstall_removes_only_owned_entries_and_preserves_state(self):
        self.write_settings({
            "theme": "dark",
            "hooks": {
                "SessionStart": [{"hooks": [{
                    "type": "command", "command": "other-tool",
                }]}],
            },
        })
        installer.install_configuration(self.config, self.executable)
        state = self.config / "statusline_state.json"
        state.write_text('{"sessions":{}}\n', encoding="utf-8")
        result = installer.uninstall_configuration(self.config, self.executable)
        self.assertTrue(result.changed)
        settings = self.read_settings()
        self.assertNotIn("statusLine", settings)
        self.assertEqual(settings["theme"], "dark")
        self.assertIn("other-tool", installer._hook_commands(settings, "SessionStart"))
        for event in installer.HOOK_EVENTS:
            self.assertFalse(any(
                installer._is_cli_command(command, "hook", self.executable)
                for command in installer._hook_commands(settings, event)
            ))
        self.assertTrue(state.is_file())
        self.assertTrue((result.backup_dir / "settings.json.before").is_file())

    def test_uninstall_does_not_remove_unrelated_statusline(self):
        original = {
            "statusLine": {"type": "command", "command": "my-own-status"},
        }
        self.write_settings(original)
        result = installer.uninstall_configuration(self.config, self.executable)
        self.assertFalse(result.changed)
        self.assertEqual(self.read_settings(), original)


class ResolutionAndDoctorTests(InstallerTestCase):
    def test_config_dir_precedence(self):
        explicit = self.root / "explicit"
        environment = self.root / "environment"
        with mock.patch.dict(os.environ, {"CLAUDE_CONFIG_DIR": str(environment)}):
            self.assertEqual(installer.resolve_config_dir(), environment)
            self.assertEqual(installer.resolve_config_dir(explicit), explicit)

    def test_doctor_accepts_one_complete_configuration(self):
        installer.install_configuration(self.config, self.executable)
        diagnostics = installer.collect_diagnostics(self.config, self.executable)
        errors = [item.message for item in diagnostics if item.level == "ERROR"]
        self.assertEqual(errors, [])
        for event in installer.HOOK_EVENTS:
            self.assertTrue(any(
                item.level == "OK" and item.message.startswith(event)
                for item in diagnostics
            ))


if __name__ == "__main__":
    unittest.main(verbosity=2)
