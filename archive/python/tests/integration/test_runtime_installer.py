"""The runtime collector has its own ownership, preference and host threshold."""

from pathlib import Path
import json
import tempfile
import unittest
from unittest import mock

from claude_statusline.config import runtime, storage
from claude_statusline.integration import installer, native
from claude_statusline.integration.mods import RUNTIME
from tests.integration.test_native_installer import FakeHost


class RuntimeInstallerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="runtime install ")
        self.addCleanup(self.temp.cleanup)
        self.config = Path(self.temp.name) / "config"
        self.backend = Path(self.temp.name) / "claude-statusline"
        self.backend.write_text("backend fixture")
        self.host = FakeHost(self.config, RUNTIME)
        self.patch = mock.patch.object(native, "Host", return_value=self.host)
        self.patch.start()
        self.addCleanup(self.patch.stop)

    def install(self, **options):
        return installer.install_configuration(
            self.config,
            self.backend,
            claude_version=options.pop("version", (2, 1, 289)),
            native_editor=False,
            **options,
        )

    def test_opt_in_is_independent_and_reinstall_retains_preference(self):
        self.assertFalse(self.install().native_failed)
        self.assertTrue(runtime.requested(self.config))
        self.assertFalse(runtime.load(self.config).live_metrics)
        result = self.install(live_metrics=True)
        self.assertFalse(result.native_failed, result.messages)
        self.assertEqual(result.native_state, "disabled")
        self.assertTrue(runtime.requested(self.config))
        self.assertEqual(self.host.plugins[0]["id"], RUNTIME.plugin)
        marker = native.owner(self.config, spec=RUNTIME)
        self.assertEqual(marker["protocol_version"], 2)
        self.assertFalse((self.config / native.DIRECTORY).exists())
        self.assertFalse(self.install().changed)
        self.assertFalse(self.install(live_metrics=False).native_failed)
        self.assertFalse((self.config / RUNTIME.name).exists())
        self.assertFalse(runtime.requested(self.config))

    def test_explicit_modes_override_the_legacy_all_off_switch_and_doctor_agrees(self):
        self.install(live_metrics=False, native_timing=True)
        self.assertEqual(runtime.load(self.config), runtime.Preferences(True, False))
        self.assertFalse(self.install().changed)
        diagnostics = native.diagnostics(
            self.config, self.backend, version=(2, 1, 289), spec=RUNTIME
        )
        self.assertFalse(any(row.level == "ERROR" for row in diagnostics), diagnostics)
        self.install(live_metrics=True, native_timing=False)
        self.assertEqual(runtime.load(self.config), runtime.Preferences(False, True))

    def test_install_migrates_old_preferences_only_in_a_backed_up_transaction(self):
        self.config.mkdir()
        path = runtime.preference_path(self.config)
        original = b'{"schema_version":1,"live_metrics":false}'
        path.write_bytes(original)
        self.install(dry_run=True)
        self.assertEqual(path.read_bytes(), original)
        result = self.install()
        self.assertEqual(json.loads(path.read_bytes())["schema_version"], 2)
        self.assertEqual(runtime.load(self.config), runtime.Preferences(False, False))
        self.assertEqual(
            (result.backup_dir / (runtime.FILENAME + ".before")).read_bytes(), original
        )
        self.assertFalse(self.install().changed)

    def test_dry_run_and_old_host_never_call_new_plugin_operations(self):
        self.install(live_metrics=True, dry_run=True)
        self.assertFalse(self.config.exists())
        self.assertEqual(self.host.calls, [])
        self.install(live_metrics=True, version=(2, 1, 288))
        self.assertTrue(runtime.requested(self.config))
        self.assertEqual(self.host.calls, [])
        self.assertFalse((self.config / RUNTIME.name).exists())
        self.install()
        calls = list(self.host.calls)
        self.install(version=(2, 1, 288))
        self.assertEqual(self.host.calls, calls)
        self.assertTrue(native.owner(self.config, spec=RUNTIME)["suspended"])
        self.install()
        self.assertFalse(native.owner(self.config, spec=RUNTIME)["suspended"])

    def test_foreign_runtime_directory_and_changed_resources_are_retained(self):
        root = self.config / RUNTIME.name
        root.mkdir(parents=True)
        foreign = root / "note.txt"
        foreign.write_text("foreign data")
        result = self.install(live_metrics=True)
        self.assertTrue(result.native_failed)
        self.assertEqual(foreign.read_text(), "foreign data")

    def test_user_plugin_disable_is_not_automatically_reenabled(self):
        self.install(live_metrics=True)
        settings = storage._read_settings(self.config / "settings.json")[0]
        settings["enabledPlugins"][RUNTIME.plugin] = False
        storage._write_optional_bytes(
            self.config / "settings.json", storage._json_bytes(settings)
        )
        self.install()
        self.assertFalse(self.host.plugins[0]["enabled"])
        self.assertFalse(native.owner(self.config, spec=RUNTIME)["suspended"])

    def test_uninstall_removes_only_owned_runtime_resources_and_retains_choice(self):
        self.install(live_metrics=True)
        result = installer.uninstall_configuration(self.config, self.backend)
        self.assertFalse(result.native_failed, result.messages)
        self.assertFalse((self.config / RUNTIME.name).exists())
        self.assertTrue(runtime.requested(self.config))
