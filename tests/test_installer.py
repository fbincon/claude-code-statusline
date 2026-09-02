#!/usr/bin/env python3
"""Regression tests for safe configuration installation and removal."""

import json
import os
from pathlib import Path
import stat
import tempfile
import unittest
from unittest import mock

from claude_statusline import display_config as dc
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

    def slash_hook_count(self, settings):
        return installer._slash_hook_count(settings, self.executable)


class InstallTests(InstallerTestCase):
    def test_empty_config_is_created_with_private_permissions_and_backup(self):
        result = installer.install_configuration(
            self.config, self.executable, claude_version=(2, 1, 258)
        )
        self.assertTrue(result.changed)
        self.assertTrue((result.backup_dir / "settings.json.absent").is_file())
        metadata = json.loads(
            (result.backup_dir / "metadata.json").read_text(encoding="utf-8")
        )
        self.assertEqual(metadata["settings_path"], str(self.settings_path))
        self.assertEqual(len(metadata["artifacts"]), 3)
        settings = self.read_settings()
        self.assertEqual(settings["statusLine"], {
            "type": "command",
            "command": installer.command_for(self.executable, "render"),
            "refreshInterval": 1,
        })
        for event in installer.HOOK_EVENTS:
            self.assertEqual(self.cli_hook_count(settings, event), 1)
        self.assertEqual(self.slash_hook_count(settings), 1)
        skill_path, owner_path = installer.skill_paths(self.config)
        self.assertEqual(skill_path.read_bytes(), installer.render_skill(self.executable))
        self.assertTrue(installer._is_owned_skill_marker(owner_path.read_bytes()))
        self.assertEqual(stat.S_IMODE(skill_path.stat().st_mode), 0o600)
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
        installer.install_configuration(
            self.config, self.executable, claude_version=(2, 1, 258)
        )
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
        first = installer.install_configuration(
            self.config, self.executable, claude_version=(2, 1, 258)
        )
        backup_count = len(list(first.backup_dir.parent.glob("cli-install-*")))
        second = installer.install_configuration(
            self.config, self.executable, claude_version=(2, 1, 258)
        )
        self.assertFalse(second.changed)
        self.assertIsNone(second.backup_dir)
        self.assertEqual(
            len(list(first.backup_dir.parent.glob("cli-install-*"))),
            backup_count,
        )
        settings = self.read_settings()
        for event in installer.HOOK_EVENTS:
            self.assertEqual(self.cli_hook_count(settings, event), 1)
        self.assertEqual(self.slash_hook_count(settings), 1)

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
            list(self.config.glob(".*.claude-statusline-*.tmp")), []
        )

    def test_existing_owned_host_options_survive_reinstall(self):
        self.write_settings({
            "statusLine": {
                "type": "command",
                "command": installer.command_for(self.executable, "render"),
                "padding": 4,
                "hideVimModeIndicator": True,
            },
        })
        installer.install_configuration(
            self.config, self.executable, claude_version=(2, 1, 258)
        )
        status_line = self.read_settings()["statusLine"]
        self.assertEqual(status_line["padding"], 4)
        self.assertTrue(status_line["hideVimModeIndicator"])
        self.assertNotIn("refreshInterval", status_line)

    def test_old_claude_installs_skill_without_fast_hook(self):
        installer.install_configuration(
            self.config, self.executable, claude_version=(2, 1, 257)
        )
        settings = self.read_settings()
        self.assertEqual(self.slash_hook_count(settings), 0)
        skill_path, owner_path = installer.skill_paths(self.config)
        self.assertTrue(skill_path.is_file())
        self.assertTrue(owner_path.is_file())

        diagnostics = installer.collect_diagnostics(
            self.config,
            self.executable,
            claude_version=(2, 1, 257),
        )
        self.assertFalse(any(item.level == "ERROR" for item in diagnostics))
        self.assertTrue(any(
            item.level == "WARN" and "model fallback" in item.message
            for item in diagnostics
        ))

    def test_unrelated_skill_is_refused_unless_force_backs_it_up(self):
        skill_path, owner_path = installer.skill_paths(self.config)
        skill_path.parent.mkdir(parents=True)
        skill_path.write_text("unrelated\n", encoding="utf-8")
        with self.assertRaises(installer.ConfigurationError):
            installer.install_configuration(
                self.config,
                self.executable,
                claude_version=(2, 1, 258),
            )
        self.assertEqual(skill_path.read_text(encoding="utf-8"), "unrelated\n")
        self.assertFalse(owner_path.exists())

        result = installer.install_configuration(
            self.config,
            self.executable,
            force=True,
            claude_version=(2, 1, 258),
        )
        self.assertEqual(skill_path.read_bytes(), installer.render_skill(self.executable))
        self.assertEqual(
            (result.backup_dir / "skill" / "SKILL.md.before").read_text(
                encoding="utf-8"
            ),
            "unrelated\n",
        )

    def test_skill_write_failure_rolls_back_settings_and_skill(self):
        self.write_settings({"theme": "dark"})
        settings_before = self.settings_path.read_bytes()
        skill_path, owner_path = installer.skill_paths(self.config)
        real_write = installer._write_optional_bytes

        def fail_skill(path, value):
            if path == skill_path and value is not None:
                raise OSError("simulated skill write failure")
            return real_write(path, value)

        with mock.patch.object(
            installer, "_write_optional_bytes", side_effect=fail_skill
        ), self.assertRaises(installer.ConfigurationError):
            installer.install_configuration(
                self.config,
                self.executable,
                claude_version=(2, 1, 258),
            )
        self.assertEqual(self.settings_path.read_bytes(), settings_before)
        self.assertFalse(skill_path.exists())
        self.assertFalse(owner_path.exists())


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
        installer.install_configuration(
            self.config, self.executable, claude_version=(2, 1, 258)
        )
        state = self.config / "statusline_state.json"
        state.write_text('{"sessions":{}}\n', encoding="utf-8")
        display = dc.config_path(self.config)
        dc.write_display_config(
            self.config, dc.DEFAULT_CONFIG.with_updates(items=("git",))
        )
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
        self.assertEqual(self.slash_hook_count(settings), 0)
        self.assertTrue(state.is_file())
        self.assertTrue(display.is_file())
        skill_path, owner_path = installer.skill_paths(self.config)
        self.assertFalse(skill_path.exists())
        self.assertFalse(owner_path.exists())
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
        installer.install_configuration(
            self.config, self.executable, claude_version=(2, 1, 258)
        )
        diagnostics = installer.collect_diagnostics(
            self.config, self.executable, claude_version=(2, 1, 258)
        )
        errors = [item.message for item in diagnostics if item.level == "ERROR"]
        self.assertEqual(errors, [])
        for event in installer.HOOK_EVENTS:
            self.assertTrue(any(
                item.level == "OK" and item.message.startswith(event)
                for item in diagnostics
            ))
        self.assertTrue(any(
            item.level == "OK" and "local fast path" in item.message
            for item in diagnostics
        ))

    def test_version_detection_parses_claude_output(self):
        completed = mock.Mock(returncode=0, stdout="2.1.258 (Claude Code)\n")
        with (
            mock.patch.object(installer.shutil, "which", return_value="/bin/claude"),
            mock.patch.object(installer.subprocess, "run", return_value=completed),
        ):
            self.assertEqual(installer.detect_claude_version(), (2, 1, 258))

    def test_rendered_skill_has_no_placeholders_and_lists_every_item(self):
        rendered = installer.render_skill(self.executable).decode("utf-8")
        self.assertNotIn("__CLAUDE_STATUSLINE_", rendered)
        self.assertIn(str(self.executable), rendered)
        for item in dc.ITEM_CATALOG:
            self.assertIn(f"`{item}`", rendered)

    def test_doctor_reports_invalid_display_config_and_missing_skill(self):
        installer.install_configuration(
            self.config, self.executable, claude_version=(2, 1, 258)
        )
        dc.config_path(self.config).write_text("{broken", encoding="utf-8")
        skill_path, _owner_path = installer.skill_paths(self.config)
        skill_path.unlink()
        diagnostics = installer.collect_diagnostics(
            self.config, self.executable, claude_version=(2, 1, 258)
        )
        errors = [item.message for item in diagnostics if item.level == "ERROR"]
        self.assertTrue(any("invalid JSON" in message for message in errors))
        self.assertTrue(any("skill is missing" in message for message in errors))


if __name__ == "__main__":
    unittest.main(verbosity=2)
