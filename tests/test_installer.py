#!/usr/bin/env python3
"""Regression tests for safe configuration installation and removal."""

import json
import os
from pathlib import Path, PurePosixPath
import stat
import tempfile
import unittest
from unittest import mock

from claude_statusline import display_config as dc
from claude_statusline import feature_config as fc
from claude_statusline import installer


class InstallerTestCase(unittest.TestCase):
    def setUp(self):
        self.tempdir = tempfile.TemporaryDirectory(prefix="statusline-installer-test-")
        self.root = Path(self.tempdir.name)
        self.config = self.root / "claude"
        executable_name = "claude-statusline.exe" if os.name == "nt" else "claude-statusline"
        self.executable = self.root / "bin" / executable_name
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

    def experimental_hook_count(self, settings):
        return installer._slash_hook_count(
            settings,
            self.executable,
            installer.EXPERIMENTAL_SLASH_COMMAND_NAME,
        )


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
        if os.name == "posix":
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
        if os.name == "posix":
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


class ExperimentalInstallTests(InstallerTestCase):
    def test_default_install_leaves_experimental_entry_disabled(self):
        installer.install_configuration(
            self.config, self.executable, claude_version=(2, 1, 258)
        )
        self.assertFalse(fc.feature_path(self.config).exists())
        experimental_skill, experimental_owner = installer.experimental_skill_paths(
            self.config
        )
        self.assertFalse(experimental_skill.exists())
        self.assertFalse(experimental_owner.exists())
        self.assertEqual(self.experimental_hook_count(self.read_settings()), 0)

    def test_enable_creates_feature_skill_owner_and_600_second_hook(self):
        result = installer.install_configuration(
            self.config,
            self.executable,
            experimental_slash_tui=True,
            claude_version=(2, 1, 258),
        )
        feature_path = fc.feature_path(self.config)
        self.assertEqual(feature_path.read_bytes(), fc.enabled_bytes())
        if os.name == "posix":
            self.assertEqual(stat.S_IMODE(feature_path.stat().st_mode), 0o600)
        skill, owner = installer.experimental_skill_paths(self.config)
        self.assertEqual(skill.read_bytes(), installer.render_experimental_skill())
        self.assertTrue(installer._is_owned_skill_marker(owner.read_bytes()))
        actions = installer._slash_hook_actions(
            self.read_settings(),
            self.executable,
            installer.EXPERIMENTAL_SLASH_COMMAND_NAME,
        )
        self.assertEqual(len(actions), 1)
        self.assertEqual(actions[0]["timeout"], 600)
        metadata = json.loads(
            (result.backup_dir / "metadata.json").read_text(encoding="utf-8")
        )
        self.assertEqual(len(metadata["artifacts"]), 6)

    def test_reinstall_preserves_enabled_preference_and_is_idempotent(self):
        first = installer.install_configuration(
            self.config,
            self.executable,
            experimental_slash_tui=True,
            claude_version=(2, 1, 258),
        )
        backup_count = len(list(first.backup_dir.parent.glob("cli-install-*")))
        second = installer.install_configuration(
            self.config, self.executable, claude_version=(2, 1, 258)
        )
        self.assertFalse(second.changed)
        self.assertEqual(
            len(list(first.backup_dir.parent.glob("cli-install-*"))),
            backup_count,
        )
        self.assertEqual(self.experimental_hook_count(self.read_settings()), 1)

    @unittest.skipUnless(os.name == "posix", "POSIX mode repair")
    def test_plain_reinstall_repairs_feature_permissions(self):
        installer.install_configuration(
            self.config,
            self.executable,
            experimental_slash_tui=True,
            claude_version=(2, 1, 258),
        )
        feature_path = fc.feature_path(self.config)
        feature_path.chmod(0o644)
        result = installer.install_configuration(
            self.config, self.executable, claude_version=(2, 1, 258)
        )
        self.assertTrue(result.changed)
        self.assertEqual(result.changed_paths, (feature_path,))
        self.assertEqual(stat.S_IMODE(feature_path.stat().st_mode), 0o600)

    def test_explicit_disable_removes_preference_and_only_owned_active_artifacts(self):
        installer.install_configuration(
            self.config,
            self.executable,
            experimental_slash_tui=True,
            claude_version=(2, 1, 258),
        )
        installer.install_configuration(
            self.config,
            self.executable,
            experimental_slash_tui=False,
            claude_version=(2, 1, 258),
        )
        self.assertFalse(fc.feature_path(self.config).exists())
        skill, owner = installer.experimental_skill_paths(self.config)
        self.assertFalse(skill.exists())
        self.assertFalse(owner.exists())
        self.assertEqual(self.experimental_hook_count(self.read_settings()), 0)
        stable_skill, stable_owner = installer.skill_paths(self.config)
        self.assertTrue(stable_skill.exists())
        self.assertTrue(stable_owner.exists())

    def test_explicit_enable_rejects_old_or_unknown_version_without_writes(self):
        for version in ((2, 1, 257), None):
            with self.subTest(version=version):
                with self.assertRaises(installer.ConfigurationError):
                    installer.install_configuration(
                        self.config,
                        self.executable,
                        experimental_slash_tui=True,
                        claude_version=version,
                    )
                self.assertFalse(self.config.exists())

    def test_enabled_preference_suspends_on_downgrade_and_restores_on_upgrade(self):
        installer.install_configuration(
            self.config,
            self.executable,
            experimental_slash_tui=True,
            claude_version=(2, 1, 258),
        )
        preference_before = fc.feature_path(self.config).read_bytes()
        installer.install_configuration(
            self.config, self.executable, claude_version=(2, 1, 257)
        )
        self.assertEqual(fc.feature_path(self.config).read_bytes(), preference_before)
        skill, owner = installer.experimental_skill_paths(self.config)
        self.assertFalse(skill.exists())
        self.assertFalse(owner.exists())
        self.assertEqual(self.experimental_hook_count(self.read_settings()), 0)
        diagnostics = installer.collect_diagnostics(
            self.config, self.executable, claude_version=(2, 1, 257)
        )
        self.assertFalse(any(item.level == "ERROR" for item in diagnostics))
        self.assertTrue(any(
            item.level == "WARN" and "suspended" in item.message
            for item in diagnostics
        ))

        installer.install_configuration(
            self.config, self.executable, claude_version=(2, 1, 258)
        )
        self.assertTrue(skill.exists())
        self.assertTrue(owner.exists())
        self.assertEqual(self.experimental_hook_count(self.read_settings()), 1)

    def test_corrupt_preference_requires_explicit_repair_or_removal(self):
        self.config.mkdir()
        feature_path = fc.feature_path(self.config)
        feature_path.write_bytes(b"{broken\n")
        with self.assertRaises(installer.ConfigurationError):
            installer.install_configuration(
                self.config, self.executable, claude_version=(2, 1, 258)
            )
        self.assertEqual(feature_path.read_bytes(), b"{broken\n")
        self.assertFalse((self.config / "backups").exists())

        repaired = installer.install_configuration(
            self.config,
            self.executable,
            experimental_slash_tui=True,
            claude_version=(2, 1, 258),
        )
        self.assertEqual(feature_path.read_bytes(), fc.enabled_bytes())
        self.assertEqual(
            (repaired.backup_dir / f"{fc.FEATURE_FILENAME}.before").read_bytes(),
            b"{broken\n",
        )

        installer.uninstall_configuration(self.config, self.executable)
        feature_path.write_bytes(b"bad")
        removed = installer.install_configuration(
            self.config,
            self.executable,
            experimental_slash_tui=False,
            claude_version=(2, 1, 258),
        )
        self.assertFalse(feature_path.exists())
        self.assertEqual(
            (removed.backup_dir / f"{fc.FEATURE_FILENAME}.before").read_bytes(),
            b"bad",
        )

    def test_unrelated_experimental_skill_ownership_rules_and_force(self):
        skill, owner = installer.experimental_skill_paths(self.config)
        skill.parent.mkdir(parents=True)
        skill.write_text("unrelated\n", encoding="utf-8")

        installer.install_configuration(
            self.config, self.executable, claude_version=(2, 1, 258)
        )
        self.assertEqual(skill.read_text(encoding="utf-8"), "unrelated\n")
        self.assertFalse(owner.exists())
        with self.assertRaises(installer.ConfigurationError):
            installer.install_configuration(
                self.config,
                self.executable,
                experimental_slash_tui=True,
                claude_version=(2, 1, 258),
            )
        self.assertFalse(fc.feature_path(self.config).exists())

        disabled = installer.install_configuration(
            self.config,
            self.executable,
            experimental_slash_tui=False,
            claude_version=(2, 1, 258),
        )
        self.assertFalse(disabled.changed)
        installer.uninstall_configuration(self.config, self.executable)
        self.assertEqual(skill.read_text(encoding="utf-8"), "unrelated\n")

        forced = installer.install_configuration(
            self.config,
            self.executable,
            force=True,
            experimental_slash_tui=True,
            claude_version=(2, 1, 258),
        )
        self.assertEqual(skill.read_bytes(), installer.render_experimental_skill())
        self.assertTrue(owner.exists())
        self.assertEqual(
            (
                forced.backup_dir
                / "experimental-skill"
                / "SKILL.md.before"
            ).read_text(encoding="utf-8"),
            "unrelated\n",
        )

    def test_disable_write_failure_rolls_back_every_changed_artifact(self):
        installer.install_configuration(
            self.config,
            self.executable,
            experimental_slash_tui=True,
            claude_version=(2, 1, 258),
        )
        paths = [
            self.settings_path,
            fc.feature_path(self.config),
            *installer.skill_paths(self.config),
            *installer.experimental_skill_paths(self.config),
        ]
        before = {path: path.read_bytes() for path in paths}
        experimental_skill, _owner = installer.experimental_skill_paths(self.config)
        real_write = installer._write_optional_bytes

        def fail_late(path, value):
            if path == experimental_skill and value is None:
                raise OSError("simulated experimental skill failure")
            return real_write(path, value)

        with (
            mock.patch.object(
                installer, "_write_optional_bytes", side_effect=fail_late
            ),
            self.assertRaises(installer.ConfigurationError),
        ):
            installer.install_configuration(
                self.config,
                self.executable,
                experimental_slash_tui=False,
                claude_version=(2, 1, 258),
            )
        self.assertEqual({path: path.read_bytes() for path in paths}, before)

    def test_explicit_enable_dry_run_creates_nothing(self):
        result = installer.install_configuration(
            self.config,
            self.executable,
            dry_run=True,
            experimental_slash_tui=True,
            claude_version=(2, 1, 258),
        )
        self.assertTrue(result.changed)
        self.assertFalse(self.config.exists())

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


class SubagentInstallTests(InstallerTestCase):
    def test_supported_default_installs_exact_setting_and_hooks(self):
        installer.install_configuration(
            self.config, self.executable, claude_version=(2, 1, 205)
        )
        settings = self.read_settings()
        self.assertEqual(
            settings["subagentStatusLine"],
            {
                "type": "command",
                "command": installer.command_for(
                    self.executable, "render-subagents"
                ),
            },
        )
        self.assertNotIn("refreshInterval", settings["subagentStatusLine"])
        for event in installer.SUBAGENT_HOOK_EVENTS:
            self.assertEqual(self.cli_hook_count(settings, event), 1)

    def test_disabled_rows_keep_foreign_setting_but_install_lifecycle_hooks(self):
        self.write_settings({
            "subagentStatusLine": {
                "type": "command",
                "command": "third-party agents",
            }
        })
        dc.write_display_config(
            self.config,
            dc.DEFAULT_CONFIG.with_updates(
                subagents=dc.SubagentDisplayConfig(enabled=False)
            ),
        )
        installer.install_configuration(
            self.config, self.executable, claude_version=(2, 1, 205)
        )
        settings = self.read_settings()
        self.assertEqual(
            settings["subagentStatusLine"]["command"], "third-party agents"
        )
        for event in installer.SUBAGENT_HOOK_EVENTS:
            self.assertEqual(self.cli_hook_count(settings, event), 1)
        diagnostics = installer.collect_diagnostics(
            self.config, self.executable, claude_version=(2, 1, 205)
        )
        self.assertFalse(any(item.level == "ERROR" for item in diagnostics))
        self.assertTrue(any(
            "foreign setting preserved" in item.message for item in diagnostics
        ))

    def test_foreign_conflict_fails_before_backup_and_force_takes_ownership(self):
        original = {
            "theme": "dark",
            "subagentStatusLine": {
                "type": "command",
                "command": "third-party agents",
            },
        }
        self.write_settings(original)
        before = self.settings_path.read_bytes()
        with self.assertRaisesRegex(
            installer.ConfigurationError, "config set subagent-statusline off"
        ):
            installer.install_configuration(
                self.config, self.executable, claude_version=(2, 1, 205)
            )
        self.assertEqual(self.settings_path.read_bytes(), before)
        self.assertFalse((self.config / "backups").exists())

        result = installer.install_configuration(
            self.config,
            self.executable,
            force=True,
            claude_version=(2, 1, 205),
        )
        self.assertEqual(
            self.read_settings()["subagentStatusLine"]["command"],
            installer.command_for(self.executable, "render-subagents"),
        )
        self.assertEqual(
            (result.backup_dir / "settings.json.before").read_bytes(), before
        )

    def test_old_or_unknown_versions_suspend_and_upgrade_restores(self):
        for version in ((2, 1, 204), None):
            with self.subTest(version=version):
                with tempfile.TemporaryDirectory(prefix="subagent-old-") as root:
                    config = Path(root) / "claude"
                    executable = Path(root) / "claude-statusline"
                    executable.write_text("#!/bin/sh\n", encoding="utf-8")
                    executable.chmod(0o755)
                    installer.install_configuration(
                        config, executable, claude_version=version
                    )
                    settings = json.loads(
                        (config / "settings.json").read_text(encoding="utf-8")
                    )
                    self.assertIn("statusLine", settings)
                    self.assertNotIn("subagentStatusLine", settings)
                    for event in installer.SUBAGENT_HOOK_EVENTS:
                        self.assertEqual(
                            installer._hook_commands(settings, event), []
                        )

        installer.install_configuration(
            self.config, self.executable, claude_version=(2, 1, 205)
        )
        installer.install_configuration(
            self.config, self.executable, claude_version=(2, 1, 204)
        )
        settings = self.read_settings()
        self.assertNotIn("subagentStatusLine", settings)
        for event in installer.SUBAGENT_HOOK_EVENTS:
            self.assertEqual(self.cli_hook_count(settings, event), 0)
        installer.install_configuration(
            self.config, self.executable, claude_version=(2, 1, 205)
        )
        settings = self.read_settings()
        self.assertIn("subagentStatusLine", settings)
        for event in installer.SUBAGENT_HOOK_EVENTS:
            self.assertEqual(self.cli_hook_count(settings, event), 1)

    def test_uninstall_removes_owned_but_preserves_foreign(self):
        installer.install_configuration(
            self.config, self.executable, claude_version=(2, 1, 205)
        )
        installer.uninstall_configuration(self.config, self.executable)
        self.assertNotIn("subagentStatusLine", self.read_settings())

        self.write_settings({
            "subagentStatusLine": {
                "type": "command",
                "command": "third-party agents",
            }
        })
        result = installer.uninstall_configuration(self.config, self.executable)
        self.assertFalse(result.changed)
        self.assertEqual(
            self.read_settings()["subagentStatusLine"]["command"],
            "third-party agents",
        )

    def test_dry_run_idempotence_and_v1_display_read_only(self):
        self.config.mkdir(parents=True)
        legacy = {
            "schema_version": 1,
            "items": ["git"],
            "use_colors": True,
            "palette": "default",
            "directory_style": "full",
            "separator_style": "classic",
        }
        display_path = dc.config_path(self.config)
        raw = (json.dumps(legacy, separators=(",", ":")) + "\n").encode()
        display_path.write_bytes(raw)
        dry = installer.install_configuration(
            self.config,
            self.executable,
            dry_run=True,
            claude_version=(2, 1, 205),
        )
        self.assertTrue(dry.changed)
        self.assertEqual(display_path.read_bytes(), raw)
        first = installer.install_configuration(
            self.config, self.executable, claude_version=(2, 1, 205)
        )
        diagnostics = installer.collect_diagnostics(
            self.config, self.executable, claude_version=(2, 1, 205)
        )
        self.assertTrue(any(
            item.level == "WARN" and "schema v1" in item.message
            for item in diagnostics
        ))
        second = installer.install_configuration(
            self.config, self.executable, claude_version=(2, 1, 205)
        )
        self.assertTrue(first.changed)
        self.assertFalse(second.changed)
        self.assertEqual(display_path.read_bytes(), raw)


class UninstallTests(InstallerTestCase):
    def test_uninstall_removes_experimental_artifacts_but_keeps_preference(self):
        installer.install_configuration(
            self.config,
            self.executable,
            experimental_slash_tui=True,
            claude_version=(2, 1, 258),
        )
        preference_before = fc.feature_path(self.config).read_bytes()
        installer.uninstall_configuration(self.config, self.executable)
        self.assertEqual(fc.feature_path(self.config).read_bytes(), preference_before)
        skill, owner = installer.experimental_skill_paths(self.config)
        self.assertFalse(skill.exists())
        self.assertFalse(owner.exists())
        self.assertEqual(self.experimental_hook_count(self.read_settings()), 0)

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
        if os.name == "nt":
            self.assertTrue(any(
                "POSIX mode not applicable" in item.message
                for item in diagnostics
            ))
            self.assertTrue(any(
                "windows-curses backend" in item.message
                for item in diagnostics
            ))
            self.assertTrue(any(
                "Windows system new-console launcher" in item.message
                for item in diagnostics
            ))
            self.assertFalse(any(
                "tmux" in item.message or "GNOME" in item.message
                for item in diagnostics
            ))

    def test_version_detection_parses_claude_output(self):
        completed = mock.Mock(returncode=0, stdout="2.1.258 (Claude Code)\n")
        with (
            mock.patch.object(installer.shutil, "which", return_value="/bin/claude"),
            mock.patch.object(
                installer.subprocess, "run", return_value=completed
            ) as run,
        ):
            self.assertEqual(installer.detect_claude_version(), (2, 1, 258))
        self.assertEqual(
            run.call_args.kwargs["creationflags"],
            installer._platform.no_window_creation_flags(),
        )

    def test_cross_platform_command_formats_and_ownership(self):
        executable = Path(r"C:\Program Files\Status Line\claude-statusline.exe")
        with mock.patch.object(installer._platform, "is_windows", return_value=True):
            self.assertEqual(
                installer.command_for(executable, "render"),
                "claude-statusline.exe render",
            )
            skill = installer.render_skill(executable).decode("utf-8")
        self.assertIn('"Bash(claude-statusline.exe config *)"', skill)
        self.assertIn('"PowerShell(claude-statusline.exe config *)"', skill)

        linux_executable = PurePosixPath("/opt/status line/claude-statusline")
        with mock.patch.object(installer._platform, "is_windows", return_value=False):
            self.assertEqual(
                installer.command_for(linux_executable, "render"),
                '"/opt/status line/claude-statusline" render',
            )

        self.assertTrue(installer._is_cli_command(
            "claude-statusline render", "render", self.executable
        ))
        self.assertTrue(installer._is_cli_command(
            "CLAUDE-STATUSLINE.EXE render", "render", self.executable
        ))
        with mock.patch.object(
            installer.shutil, "which", return_value=str(self.executable)
        ):
            self.assertTrue(installer._is_cli_command(
                "statusline-alias render", "render", self.executable
            ))

    def test_rendered_skill_has_no_placeholders_and_lists_every_item(self):
        rendered = installer.render_skill(self.executable).decode("utf-8")
        self.assertNotIn("__CLAUDE_STATUSLINE_", rendered)
        if os.name == "nt":
            self.assertIn("Bash(claude-statusline.exe config *)", rendered)
            self.assertIn("PowerShell(claude-statusline.exe config *)", rendered)
        else:
            self.assertIn(str(self.executable), rendered)
        for item in dc.ITEM_CATALOG:
            self.assertIn(f"`{item}`", rendered)
        for item in dc.SUBAGENT_ITEM_CATALOG:
            self.assertIn(f"`{item}`", rendered)
        self.assertIn("--subagent-items", rendered)
        self.assertIn("--subagent-statusline", rendered)
        self.assertIn("--scope-labels", rendered)

        experimental = installer.render_experimental_skill().decode("utf-8")
        self.assertIn("name: statusline-configure", experimental)
        self.assertIn("disable-model-invocation: true", experimental)
        self.assertIn("  - Bash", experimental)
        self.assertIn("  - PowerShell", experimental)
        self.assertIn("Do not start curses", experimental)

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

    def test_doctor_reports_enabled_disabled_suspended_and_broken_states(self):
        installer.install_configuration(
            self.config,
            self.executable,
            claude_version=(2, 1, 258),
        )
        disabled = installer.collect_diagnostics(
            self.config, self.executable, claude_version=(2, 1, 258)
        )
        self.assertTrue(any(
            item.level == "OK" and "statusline-configure: disabled" in item.message
            for item in disabled
        ))

        installer.install_configuration(
            self.config,
            self.executable,
            experimental_slash_tui=True,
            claude_version=(2, 1, 258),
        )
        enabled = installer.collect_diagnostics(
            self.config, self.executable, claude_version=(2, 1, 258)
        )
        self.assertFalse(any(item.level == "ERROR" for item in enabled))
        self.assertTrue(any("exactly one (600s)" in item.message for item in enabled))

        settings = self.read_settings()
        for group in settings["hooks"][installer.SLASH_HOOK_EVENT]:
            if group.get("matcher") == installer.EXPERIMENTAL_SLASH_COMMAND_NAME:
                group["hooks"][0]["timeout"] = 5
        self.write_settings(settings)
        broken = installer.collect_diagnostics(
            self.config, self.executable, claude_version=(2, 1, 258)
        )
        self.assertTrue(any(
            item.level == "ERROR" and "expected one 600s hook" in item.message
            for item in broken
        ))

        installer.install_configuration(
            self.config, self.executable, claude_version=(2, 1, 258)
        )
        settings = self.read_settings()
        duplicate = next(
            group
            for group in settings["hooks"][installer.SLASH_HOOK_EVENT]
            if group.get("matcher") == installer.EXPERIMENTAL_SLASH_COMMAND_NAME
        )
        settings["hooks"][installer.SLASH_HOOK_EVENT].append(
            json.loads(json.dumps(duplicate))
        )
        self.write_settings(settings)
        duplicate_diagnostics = installer.collect_diagnostics(
            self.config, self.executable, claude_version=(2, 1, 258)
        )
        self.assertTrue(any(
            item.level == "ERROR" and "exactly one matcher" in item.message
            for item in duplicate_diagnostics
        ))

        installer.install_configuration(
            self.config, self.executable, claude_version=(2, 1, 257)
        )
        suspended = installer.collect_diagnostics(
            self.config, self.executable, claude_version=(2, 1, 257)
        )
        self.assertFalse(any(item.level == "ERROR" for item in suspended))
        self.assertTrue(any(
            item.level == "WARN" and "suspended" in item.message
            for item in suspended
        ))

    def test_doctor_rejects_non_private_or_corrupt_feature_file(self):
        installer.install_configuration(
            self.config,
            self.executable,
            experimental_slash_tui=True,
            claude_version=(2, 1, 258),
        )
        feature_path = fc.feature_path(self.config)
        feature_path.chmod(0o644)
        diagnostics = installer.collect_diagnostics(
            self.config, self.executable, claude_version=(2, 1, 258)
        )
        if os.name == "posix":
            self.assertTrue(any(
                item.level == "ERROR" and "permissions" in item.message
                for item in diagnostics
            ))
        else:
            self.assertFalse(any(
                item.level == "ERROR" and "permissions" in item.message
                for item in diagnostics
            ))
            self.assertTrue(any(
                "POSIX mode not applicable" in item.message for item in diagnostics
            ))
        feature_path.write_bytes(b"broken")
        diagnostics = installer.collect_diagnostics(
            self.config, self.executable, claude_version=(2, 1, 258)
        )
        self.assertTrue(any(
            item.level == "ERROR" and "invalid JSON" in item.message
            for item in diagnostics
        ))


if __name__ == "__main__":
    unittest.main(verbosity=2)
