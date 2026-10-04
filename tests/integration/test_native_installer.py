"""Native lifecycle transactions and ownership with an official-CLI simulator."""

from __future__ import annotations

import copy
import hashlib
import json
import os
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from claude_statusline.config import features, native as preference, storage
from claude_statusline.integration import (
    capabilities, installer, native, native_resources, resources,
)


class FakeHost:
    def __init__(self, config):
        self.config = config
        self.markets = []
        self.plugins = []
        self.calls = []
        self.inputs = {}
        self.refused = None

    def listing(self):
        settings = storage._read_settings(self.config / "settings.json")[0]
        for row in self.plugins:
            row["enabled"] = settings.get("enabledPlugins", {}).get(
                native.PLUGIN, False
            )
        return copy.deepcopy(self.markets), copy.deepcopy(self.plugins)

    def settings(self, key, value):
        settings = storage._read_settings(self.config / "settings.json")[0]
        settings[key] = value
        storage._write_optional_bytes(
            self.config / "settings.json", storage._json_bytes(settings)
        )

    def run(self, *args, values=None, json_result=False):
        self.calls.append((args, values))
        if args[0] == self.refused:
            raise native.PluginError("Managed policy denied " + args[0])
        if args[0] == "marketplace":
            if args[1] == "add":
                self.markets = [
                    {
                        "name": native.MARKETPLACE,
                        "source": "directory",
                        "path": str(self.config / native.DIRECTORY),
                    }
                ]
            elif args[1] == "remove":
                self.markets = []
        elif args[0] in {"install", "update"}:
            source = self.config / native.DIRECTORY / "plugins/statusline-native"
            version = json.loads((source / ".claude-plugin/plugin.json").read_text())[
                "version"
            ]
            target = (
                self.config
                / "plugins/cache"
                / native.MARKETPLACE
                / "statusline-native"
                / version
            )
            shutil.copytree(source, target, dirs_exist_ok=True)
            self.plugins = [
                {
                    "id": native.PLUGIN,
                    "scope": "user",
                    "version": version,
                    "installPath": str(target),
                    "enabled": True,
                }
            ]
            if args[0] == "install":
                self.settings("enabledPlugins", {native.PLUGIN: True})
                self.inputs = dict(
                    value.split("=", 1)
                    for index, value in enumerate(args)
                    if index and args[index - 1] == "--config"
                )
        elif args[0] == "configure":
            if values is not None:
                self.inputs.update(
                    {
                        key: str(value).lower() if isinstance(value, bool) else value
                        for key, value in values.items()
                    }
                )
            if json_result:
                return {"inputs": copy.deepcopy(self.inputs)}
        elif args[0] in {"disable", "enable"}:
            self.settings("enabledPlugins", {native.PLUGIN: args[0] == "enable"})
        elif args[0] == "uninstall":
            self.plugins = []
            self.settings("enabledPlugins", {})
        return None


class NativeInstallerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="native lifecycle ")
        self.config = Path(self.temp.name).resolve() / "config 中文 $` & with spaces"
        name = "claude-statusline.exe" if os.name == "nt" else "claude-statusline"
        self.backend = Path(self.temp.name).resolve() / "bin with spaces 中文" / name
        self.backend.parent.mkdir()
        self.backend.write_text("#!/bin/sh\nexit 0\n")
        self.backend.chmod(0o755)
        self.host = FakeHost(self.config)
        self.patch = mock.patch.object(native, "Host", return_value=self.host)
        self.patch.start()
        self.addCleanup(self.patch.stop)
        self.addCleanup(self.temp.cleanup)

    def install(self, **kwargs):
        return installer.install_configuration(
            self.config,
            self.backend,
            claude_version=kwargs.pop("claude_version", (2, 1, 288)),
            **kwargs,
        )

    def test_nested_runtime_modules_reach_staging_and_official_cache(self):
        self.install(native_editor=True)
        root = self.config / native.DIRECTORY / "plugins/statusline-native"
        cache = Path(self.host.plugins[0]["installPath"])
        files, _ = native_resources.bundled_files()
        for name in (
            "lib/editor/draft.ts", "lib/editor/navigation.ts",
            "ui/client/surface.ts", "ui/components/section.ts",
            "lib/client/messages.ts", "ui/client/draw.ts",
        ):
            self.assertEqual((root / name).read_bytes(), files[name])
            self.assertEqual((cache / name).read_bytes(), files[name])
        self.install(native_editor=False)
        self.assertFalse(root.exists())

    def test_both_entries_coexist_and_repeat_is_idempotent(self):
        self.install(experimental_slash_tui=True, native_editor=False)
        skill, owner = resources.experimental_skill_paths(self.config)
        self.assertTrue(skill.exists())
        result = self.install(native_editor=True)
        self.assertEqual(result.native_state, "installed")
        self.assertFalse(result.native_failed)
        self.assertTrue(skill.exists())
        self.assertTrue(owner.exists())
        self.assertEqual(self.host.inputs["backendExecutable"], str(self.backend))
        self.assertEqual(self.host.inputs["configDir"], str(self.config))
        self.assertTrue(preference.requested(self.config, None))
        self.assertFalse(self.install().changed)
        self.assertEqual(sum(call[0][0] == "install" for call in self.host.calls), 1)
        self.assertFalse(
            any(
                d.level == "ERROR"
                for d in native.diagnostics(self.config, self.backend, (2, 1, 288))
            )
        )
        self.assertTrue(
            any(
                "unverified" in d.message
                for d in native.diagnostics(self.config, self.backend, (2, 1, 288))
            )
        )

    def test_four_install_combinations_and_independent_disablement(self):
        for external in (False, True):
            for client in (False, True):
                with self.subTest(external=external, client=client):
                    config = self.config / f"case-{external}-{client}"
                    host = FakeHost(config)
                    with mock.patch.object(native, "Host", return_value=host):
                        result = installer.install_configuration(
                            config, self.backend, claude_version=(2, 1, 288),
                            experimental_slash_tui=external, native_editor=client,
                        )
                        self.assertFalse(result.native_failed)
                        skill = resources.experimental_skill_paths(config)[0]
                        self.assertEqual(skill.exists(), external)
                        self.assertEqual(bool(host.plugins), client)
                        settings = storage._read_settings(config / "settings.json")[0]
                        groups = settings["hooks"].get("UserPromptExpansion", [])
                        self.assertEqual(
                            sum(group.get("matcher") == "statusline-configure" for group in groups),
                            int(external),
                        )
                        self.assertFalse(installer.install_configuration(
                            config, self.backend, claude_version=(2, 1, 288)
                        ).changed)
                        installer.install_configuration(
                            config, self.backend, claude_version=(2, 1, 288),
                            experimental_slash_tui=False,
                        )
                        self.assertFalse(skill.exists())
                        self.assertEqual(bool(host.plugins), client)
                        installer.install_configuration(
                            config, self.backend, claude_version=(2, 1, 288),
                            experimental_slash_tui=True, native_editor=False,
                        )
                        self.assertTrue(skill.exists())
                        self.assertEqual(host.plugins, [])

    def test_default_and_explicit_enable_follow_each_host_threshold(self):
        for version in (
            None,
            (2, 1, 257),
            (2, 1, 258),
            (2, 1, 286),
            (2, 1, 287),
            (2, 1, 288),
        ):
            for explicit in (False, True):
                with self.subTest(version=version, explicit=explicit):
                    config = self.config / f"threshold-{version}-{explicit}"
                    host = FakeHost(config)
                    options = (
                        {"experimental_slash_tui": True, "native_editor": True}
                        if explicit
                        else {}
                    )
                    with mock.patch.object(native, "Host", return_value=host):
                        preview = installer.install_configuration(
                            config,
                            self.backend,
                            claude_version=version,
                            dry_run=True,
                            **options,
                        )
                        self.assertFalse(config.exists())
                        self.assertEqual(host.calls, [])
                        result = installer.install_configuration(
                            config, self.backend, claude_version=version, **options
                        )
                        external = version is not None and version >= (2, 1, 258)
                        client = version is not None and version >= (2, 1, 287)
                        self.assertFalse(result.native_failed)
                        self.assertEqual(
                            result.native_state, "installed" if client else "suspended"
                        )
                        self.assertEqual(
                            resources.experimental_skill_paths(config)[0].exists(),
                            external,
                        )
                        self.assertEqual(bool(host.plugins), client)
                        self.assertTrue(features.load_experimental_slash_tui(config))
                        self.assertTrue(preference.requested(config, None))
                        self.assertEqual(
                            preview.native_state, "requested" if client else "suspended"
                        )
                        self.assertFalse(
                            installer.install_configuration(
                                config, self.backend, claude_version=version
                            ).changed
                        )
                        self.assertFalse(
                            any(
                                row.level == "ERROR"
                                for row in native.diagnostics(
                                    config, self.backend, version
                                )
                            )
                        )
                        if not client:
                            self.assertEqual(host.calls, [])

    def test_downgrade_and_unknown_host_suspend_without_new_host_apis(self):
        self.install()
        self.host.settings("unrelated", {"keep": True})
        calls = list(self.host.calls)
        for version in ((2, 1, 286), (2, 1, 258), (2, 1, 257), None):
            with self.subTest(version=version):
                result = self.install(claude_version=version)
                self.assertFalse(result.native_failed)
                self.assertEqual(result.native_state, "suspended")
                self.assertEqual(self.host.calls, calls)
                self.assertTrue(native.owner(self.config)["suspended"])
                settings = storage._read_settings(self.config / "settings.json")[0]
                self.assertFalse(settings["enabledPlugins"][native.PLUGIN])
                self.assertEqual(settings["unrelated"], {"keep": True})
                self.assertEqual(
                    resources.experimental_skill_paths(self.config)[0].exists(),
                    version is not None and version >= (2, 1, 258),
                )
                self.assertFalse(self.install(claude_version=version).changed)
                self.assertFalse(
                    any(
                        row.level == "ERROR"
                        for row in native.diagnostics(
                            self.config, self.backend, version
                        )
                    )
                )
        self.assertEqual(self.install().native_state, "installed")
        self.assertFalse(native.owner(self.config)["suspended"])
        self.assertTrue(self.host.listing()[1][0]["enabled"])
        self.assertTrue(resources.experimental_skill_paths(self.config)[0].exists())

    def test_host_disable_survives_downgrade_and_upgrade(self):
        self.install()
        self.host.run("disable", native.PLUGIN)
        self.assertFalse(native.owner(self.config)["suspended"])
        self.assertFalse(self.install(claude_version=None).native_failed)
        self.assertFalse(native.owner(self.config)["suspended"])
        self.assertEqual(self.install().native_state, "plugin-disabled")
        self.assertFalse(self.host.listing()[1][0]["enabled"])

    def test_user_disabled_upgrade_refreshes_resources_and_binding(self):
        files, manifest = native_resources.bundled_files()
        for version, mod_version in (
            ("1.2.0", "1.2.0"),
            ("1.3.0a2", "1.3.0-alpha.2"),
            ("1.3.0", "1.3.0"),
        ):
            with self.subTest(version=version):
                config = self.config / version
                host = FakeHost(config)
                previous_files = dict(files)
                plugin = json.loads(previous_files[".claude-plugin/plugin.json"])
                plugin["version"] = mod_version
                previous_files[".claude-plugin/plugin.json"] = storage._json_bytes(
                    plugin
                )
                previous_files["hooks/register.ts"] += (
                    b"\n// Previous owned generation\n"
                )
                previous_manifest = native_resources.inventory(previous_files, version)
                with mock.patch.object(native, "Host", return_value=host):
                    with mock.patch.object(
                        native_resources,
                        "bundled_files",
                        return_value=(previous_files, previous_manifest),
                    ):
                        installer.install_configuration(
                            config, self.backend, claude_version=(2, 1, 288)
                        )
                    host.run("disable", native.PLUGIN)
                    result = installer.install_configuration(
                        config, self.backend, claude_version=(2, 1, 288)
                    )
                    self.assertEqual(result.native_state, "plugin-disabled")
                    self.assertFalse(result.native_failed)
                    self.assertTrue(result.changed)
                    self.assertFalse(host.listing()[1][0]["enabled"])
                    self.assertEqual(
                        native.owner(config)["backend_version"],
                        manifest["backend_version"],
                    )
                    self.assertEqual(
                        host.inputs["backendVersion"], manifest["backend_version"]
                    )
                    native._cache_owned(
                        config,
                        host.plugins[0],
                        native.owner(config),
                        require_current=True,
                    )
                    self.assertFalse(any(call[0][0] == "enable" for call in host.calls))
                    self.assertFalse(
                        any(
                            row.level == "ERROR"
                            for row in native.diagnostics(
                                config, self.backend, (2, 1, 288)
                            )
                        )
                    )
                    self.assertFalse(
                        installer.install_configuration(
                            config, self.backend, claude_version=(2, 1, 288)
                        ).changed
                    )

    def test_version_suspension_rolls_back_settings_if_owner_write_fails(self):
        self.install()
        settings_path = self.config / "settings.json"
        owner_path = self.config / native.DIRECTORY / native.OWNER_FILE
        before = {path: path.read_bytes() for path in (settings_path, owner_path)}
        original_write = storage._write_optional_bytes
        refused = False

        def fail_once(path, raw):
            nonlocal refused
            if path == owner_path and raw != before[path] and not refused:
                refused = True
                raise OSError("simulated owner write failure")
            return original_write(path, raw)

        with mock.patch.object(storage, "_write_optional_bytes", side_effect=fail_once):
            result = self.install(claude_version=(2, 1, 286))
        self.assertTrue(result.native_failed)
        self.assertEqual(result.native_state, "blocked")
        for path, raw in before.items():
            self.assertEqual(path.read_bytes(), raw)

    def test_reinstall_restores_external_resources_removed_by_old_native_migration(
        self,
    ):
        self.install(native_editor=True, experimental_slash_tui=True)
        skill, marker = resources.experimental_skill_paths(self.config)
        skill.unlink()
        marker.unlink()
        settings = storage._read_settings(self.config / "settings.json")[0]
        settings["hooks"]["UserPromptExpansion"] = [
            group
            for group in settings["hooks"]["UserPromptExpansion"]
            if group.get("matcher") != "statusline-configure"
        ]
        self.host.settings("hooks", settings["hooks"])
        self.host.inputs["primaryCommand"] = "true"
        result = self.install()
        self.assertFalse(result.native_failed)
        self.assertTrue(skill.exists())
        self.assertTrue(marker.exists())
        self.assertFalse(self.install().changed)
        self.assertFalse(
            any(
                row.level == "ERROR"
                for row in native.diagnostics(self.config, self.backend, (2, 1, 288))
            )
        )

    def test_foreign_external_skill_does_not_block_native_only_install(self):
        skill, _ = resources.experimental_skill_paths(self.config)
        skill.parent.mkdir(parents=True)
        skill.write_text("Foreign external command")
        result = self.install(native_editor=True, experimental_slash_tui=False)
        self.assertFalse(result.native_failed)
        self.assertEqual(skill.read_text(), "Foreign external command")

    def test_external_false_does_not_disable_stable_native_default(self):
        self.config.mkdir()
        (self.config / "claude-statusline-features.json").write_text(
            '{"schema_version": 1, "experimental_slash_tui": false}'
        )
        self.assertTrue(preference.requested(self.config, None, version="1.3.0"))

    def test_external_command_collision_is_checked_only_when_external_is_enabled(self):
        command = self.config / "commands/statusline-configure.md"
        command.parent.mkdir(parents=True)
        command.write_text("Foreign external command")
        self.assertFalse(self.install(native_editor=True, experimental_slash_tui=False).native_failed)
        before = (self.config / "settings.json").read_bytes()
        with self.assertRaisesRegex(installer.integration_models.ConfigurationError, "Foreign /statusline-configure"):
            self.install(experimental_slash_tui=True)
        self.assertEqual(command.read_text(), "Foreign external command")
        self.assertEqual((self.config / "settings.json").read_bytes(), before)

    def test_upgrade_prunes_old_empty_directories_and_disable_reenable_works(self):
        files, manifest = native_resources.bundled_files()
        old_files = dict(files, **{"ui/pages/obsolete.ts": b"// old owned UI\n"})
        with mock.patch.object(native_resources, "bundled_files", return_value=(old_files, manifest)):
            self.install(native_editor=True)
        old_directory = self.config / native.DIRECTORY / "plugins/statusline-native/ui/pages"
        self.assertTrue(old_directory.exists())
        self.assertFalse(self.install().native_failed)
        self.assertFalse(old_directory.exists())
        # Historical inventory also cleans a previously retained empty directory.
        old_directory.mkdir()
        self.install(native_editor=False)
        self.assertFalse((self.config / native.DIRECTORY).exists())
        self.assertFalse(self.install(native_editor=True).native_failed)

    def test_historical_directory_cleanup_preserves_unknown_files(self):
        files, manifest = native_resources.bundled_files()
        old_files = dict(files, **{"ui/pages/obsolete.ts": b"// old owned UI\n"})
        with mock.patch.object(native_resources, "bundled_files", return_value=(old_files, manifest)):
            self.install(native_editor=True)
        directory = self.config / native.DIRECTORY / "plugins/statusline-native/ui/pages"
        note = directory / "user-note.txt"
        note.write_text("Preserve this unknown file")
        self.install()
        self.assertFalse((directory / "obsolete.ts").exists())
        self.install(native_editor=False)
        self.assertEqual(note.read_text(), "Preserve this unknown file")

    def test_failure_keeps_compatibility_and_retry_reads_the_actual_inventory(self):
        self.host.refused = "install"
        result = self.install(native_editor=True, experimental_slash_tui=True)
        self.assertTrue(result.native_failed)
        self.assertTrue(resources.experimental_skill_paths(self.config)[0].exists())
        self.assertTrue(preference.requested(self.config, None))
        self.host.refused = None
        self.assertEqual(self.install().native_state, "installed")

    def test_explicit_plugin_disable_is_preserved_and_native_disable_restores_legacy(
        self,
    ):
        self.install(native_editor=True, experimental_slash_tui=True)
        self.host.run("disable", native.PLUGIN)
        result = self.install()
        self.assertEqual(result.native_state, "plugin-disabled")
        self.assertFalse(self.host.listing()[1][0]["enabled"])
        self.assertTrue(resources.experimental_skill_paths(self.config)[0].exists())
        self.assertFalse(any(call[0][0] == "enable" for call in self.host.calls))
        result = self.install(native_editor=False)
        self.assertEqual(result.native_state, "disabled")
        self.assertFalse((self.config / native.DIRECTORY).exists())
        self.assertFalse(preference.requested(self.config, None, version="1.2.0"))
        self.assertEqual(self.host.plugins, [])
        self.assertEqual(self.host.markets, [])

    def test_downgrade_suspends_then_upgrade_restores_tool_suspension(self):
        self.install(native_editor=True, experimental_slash_tui=True)
        result = self.install(claude_version=(2, 1, 258))
        self.assertEqual(result.native_state, "suspended")
        self.assertTrue(native.owner(self.config)["suspended"])
        self.assertFalse(self.host.listing()[1][0]["enabled"])
        self.assertTrue(preference.requested(self.config, None))
        self.assertTrue(resources.experimental_skill_paths(self.config)[0].exists())
        self.assertEqual(self.install().native_state, "installed")
        self.assertFalse(native.owner(self.config)["suspended"])
        self.assertTrue(self.host.listing()[1][0]["enabled"])

    def test_restricted_and_unsupported_fresh_hosts_preserve_preference(self):
        result = self.install(native_editor=True, claude_version=(2, 1, 200))
        self.assertEqual(result.native_state, "suspended")
        self.assertFalse(result.native_failed)
        self.assertTrue(preference.requested(self.config, None))
        self.assertEqual(self.host.calls, [])
        self.host.settings("disableAllHooks", True)
        self.assertEqual(self.install().native_state, "suspended")
        self.assertEqual(self.host.calls, [])

    def test_foreign_command_is_refused_before_writes_even_with_force(self):
        skill = self.config / "skills/statusline-configure-native/SKILL.md"
        skill.parent.mkdir(parents=True)
        skill.write_text("Foreign skill")
        with self.assertRaises(native.PluginError):
            self.install(native_editor=True, force=True)
        self.assertEqual(skill.read_text(), "Foreign skill")
        self.assertFalse((self.config / "settings.json").exists())
        self.assertEqual(self.host.calls, [])

    def test_foreign_marketplace_and_unowned_directory_are_not_adopted(self):
        self.host.markets = [
            {"name": native.MARKETPLACE, "source": "directory", "path": "/elsewhere"}
        ]
        result = self.install(native_editor=True)
        self.assertTrue(result.native_failed)
        self.assertFalse((self.config / native.DIRECTORY).exists())
        self.host.markets = []
        foreign = self.config / native.DIRECTORY
        foreign.mkdir()
        (foreign / "foreign.txt").write_text("keep")
        self.assertTrue(self.install().native_failed)
        self.assertEqual((foreign / "foreign.txt").read_text(), "keep")

    def test_cached_and_source_foreign_edits_block_update_and_uninstall(self):
        self.install(native_editor=True)
        cache = Path(self.host.plugins[0]["installPath"]) / "hooks/register.ts"
        cache.write_text("Foreign cache content")
        self.assertTrue(self.install().native_failed)
        result = installer.uninstall_configuration(self.config, self.backend)
        self.assertTrue(result.native_failed)
        self.assertEqual(cache.read_text(), "Foreign cache content")
        self.assertIn(
            "statusLine", storage._read_settings(self.config / "settings.json")[0]
        )
        source = self.config / native.DIRECTORY / "plugins/statusline-native/ui/client/draw.ts"
        source.write_text("Foreign source content")
        self.assertTrue(self.install().native_failed)
        self.assertEqual(source.read_text(), "Foreign source content")

    def test_same_version_resource_upgrade_uses_verified_official_reinstall(self):
        self.install(native_editor=True)
        root = self.config / native.DIRECTORY
        marker = native.owner(self.config)
        name = "plugins/statusline-native/hooks/register.ts"
        before = (root / name).read_bytes() + b"\n// Previous owned generation\n"
        (root / name).write_bytes(before)
        (Path(self.host.plugins[0]["installPath"]) / "hooks/register.ts").write_bytes(
            before
        )
        marker["files"][name] = hashlib.sha256(before).hexdigest()
        storage._write_optional_bytes(
            root / native.OWNER_FILE, storage._json_bytes(marker)
        )
        result = self.install()
        self.assertEqual(result.native_state, "installed")
        self.assertTrue(any(call[0][0] == "uninstall" for call in self.host.calls))
        native._cache_owned(
            self.config,
            self.host.plugins[0],
            native.owner(self.config),
            require_current=True,
        )

    def test_missing_owned_file_is_repaired_and_uninstall_retains_preferences(self):
        self.install(native_editor=True)
        (
            self.config / native.DIRECTORY / "plugins/statusline-native/ui/client/draw.ts"
        ).unlink()
        self.assertEqual(self.install().native_state, "installed")
        result = installer.uninstall_configuration(self.config, self.backend)
        self.assertFalse(result.native_failed)
        self.assertFalse((self.config / native.DIRECTORY).exists())
        self.assertTrue(preference.requested(self.config, None))
        self.assertNotIn(
            "statusLine", storage._read_settings(self.config / "settings.json")[0]
        )

    def test_dry_run_calls_no_official_commands_and_creates_no_files(self):
        result = self.install(native_editor=True, dry_run=True)
        self.assertTrue(result.changed)
        self.assertFalse(self.config.exists())
        self.assertEqual(self.host.calls, [])

    def test_preference_is_strict_and_preview_stable_defaults_preserve_false(self):
        self.assertFalse(preference.requested(self.config, None, version="1.2.0a1"))
        self.assertTrue(preference.requested(self.config, None, version="1.2.0"))
        self.config.mkdir()
        path = preference.preference_path(self.config)
        path.write_bytes(preference.preference_bytes(False))
        self.assertFalse(preference.requested(self.config, None, version="1.2.0"))
        for raw in (
            b"[]",
            b'{"schema_version":true,"native_editor":true}',
            b'{"schema_version":1,"native_editor":1}',
            b'{"schema_version":1,"native_editor":true,"native_editor":false}',
        ):
            with self.subTest(raw=raw), self.assertRaises(native.ConfigurationError):
                preference.parse(raw)

    def test_host_transport_uses_argv_and_does_not_retry_an_uncertain_write(self):
        # Exercise the real adapter rather than the lifecycle simulator.
        self.patch.stop()
        self.config.mkdir()
        with (
            mock.patch.object(
                capabilities, "claude_argv", return_value=["/host with spaces/claude"]
            ),
            mock.patch.object(
                subprocess, "run", side_effect=subprocess.TimeoutExpired("claude", 45)
            ) as run,
        ):
            host = native.Host(self.config)
            with self.assertRaises(native.PluginError):
                host.run(
                    "configure",
                    native.PLUGIN,
                    "--values-stdin",
                    values={"configDir": str(self.config)},
                )
            self.assertEqual(run.call_count, 1)
            self.assertEqual(
                run.call_args.args[0],
                [
                    "/host with spaces/claude",
                    "plugin",
                    "configure",
                    native.PLUGIN,
                    "--values-stdin",
                ],
            )
            self.assertEqual(
                json.loads(run.call_args.kwargs["input"])["configDir"], str(self.config)
            )

    def test_windows_batch_host_is_invoked_through_node_without_cmd_interpolation(self):
        host = Path(self.temp.name) / "npm/node_modules/.bin/claude.cmd"
        host.parent.mkdir(parents=True)
        host.write_text("shim")
        script = host.parent.parent / "@anthropic-ai/claude-code/cli.js"
        script.parent.mkdir(parents=True)
        script.write_text("cli")
        (script.parent / "package.json").write_text(
            json.dumps({"bin": {"claude": "cli.js"}})
        )
        with (
            mock.patch.object(
                capabilities.shutil,
                "which",
                side_effect=lambda name: (
                    str(host) if name == "claude" else "/node/node.exe"
                ),
            ),
            mock.patch.object(
                capabilities.platform_environment, "is_windows", return_value=True
            ),
        ):
            argv = capabilities.claude_argv()
        self.assertEqual(
            argv, [str(Path("/node/node.exe").resolve()), str(script.resolve())]
        )

    def test_windows_npm_native_binary_is_resolved_from_package_bin_metadata(self):
        host = Path(self.temp.name) / "native npm/node_modules/.bin/claude.cmd"
        host.parent.mkdir(parents=True)
        host.write_text("shim")
        package = host.parent.parent / "@anthropic-ai/claude-code"
        binary = package / "bin/claude.exe"
        binary.parent.mkdir(parents=True)
        binary.write_bytes(b"MZ")
        (package / "package.json").write_text(
            json.dumps({"bin": {"claude": "bin/claude.exe"}})
        )
        with (
            mock.patch.object(capabilities.shutil, "which", return_value=str(host)),
            mock.patch.object(
                capabilities.platform_environment, "is_windows", return_value=True
            ),
        ):
            self.assertEqual(capabilities.claude_argv(), [str(binary.resolve())])
            (package / "package.json").write_text(
                json.dumps({"bin": {"claude": "../outside.cmd"}})
            )
            with self.assertRaises(native.ConfigurationError):
                capabilities.claude_argv()

    def test_windows_stripped_console_name_resolves_its_adjacent_executable(self):
        from claude_statusline.integration import ownership

        binary = Path(self.temp.name) / "console with spaces" / "claude-statusline.exe"
        binary.parent.mkdir()
        binary.write_bytes(b"MZ")
        with mock.patch.object(
            ownership.platform_environment, "is_windows", return_value=True
        ):
            self.assertEqual(
                ownership.resolve_cli_executable(binary.with_suffix("")), binary
            )

    def test_invalid_owner_protocol_is_not_used_to_remove_resources(self):
        self.install(native_editor=True)
        root = self.config / native.DIRECTORY
        marker = native.owner(self.config)
        marker["protocol_version"] = True
        (root / native.OWNER_FILE).write_bytes(storage._json_bytes(marker))
        result = installer.uninstall_configuration(self.config, self.backend)
        self.assertTrue(result.native_failed)
        self.assertTrue(
            (root / "plugins/statusline-native/hooks/register.ts").is_file()
        )

    def test_release_default_activates_native_only_for_stable_versions(self):
        from claude_statusline._version import __version__

        result = self.install()
        stable = not any(stage in __version__ for stage in ("a", "b", "rc", "dev"))
        self.assertEqual(result.native_state, "installed" if stable else "disabled")
        self.assertEqual(bool(self.host.plugins), stable)
        self.assertFalse(preference.preference_path(self.config).exists())


if __name__ == "__main__":
    unittest.main()
