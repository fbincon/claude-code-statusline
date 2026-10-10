"""Display-language persistence, migration and transaction boundaries."""

import json
from pathlib import Path
from unittest import mock

from claude_statusline.config import commands, display, models, presets, service, transfer, ui_preferences
from claude_statusline.ui import contracts, protocol
from tests.config.test_config_commands import ConfigCommandTestCase


class StatuslineLanguageConfigTests(ConfigCommandTestCase):
    def test_old_schemas_read_as_english_without_rewriting(self):
        keys = {1: display.V1_DISPLAY_KEYS, 2: display.V2_DISPLAY_KEYS,
                3: display.V3_DISPLAY_KEYS, 4: display.V5_DISPLAY_KEYS, 5: display.V5_DISPLAY_KEYS}
        self.config_dir.mkdir()
        for version, selected in keys.items():
            value = {k: v for k, v in display.DEFAULT_CONFIG.to_dict().items() if k in selected}
            value["schema_version"] = version
            if version == 2:
                value["subagents"] = {"enabled": True, "items": ["name"]}
            raw = json.dumps(value).encode()
            path = display.config_path(self.config_dir)
            path.write_bytes(raw)
            loaded = display.load_display_config(self.config_dir)
            self.assertEqual(loaded.statusline_language, "en")
            self.assertEqual(loaded.schema_version, 7)
            self.assertEqual(path.read_bytes(), raw)
        result = service.set_option(self.config_dir, self.executable, "statusline-language", "zh-CN")
        self.assertTrue(result.changed)
        self.assertEqual(display.load_display_config(self.config_dir).statusline_language, "zh-CN")
        self.assertTrue(result.backup_dir)

    def test_v6_requires_supported_language_and_refuses_future_versions(self):
        for language in (None, [], {}, True, "zh", "auto", ""):
            with self.subTest(language=language), self.assertRaises(display.DisplayConfigError):
                display.validate_display_config({**display.DEFAULT_CONFIG.to_dict(), "statusline_language": language})
        value = display.DEFAULT_CONFIG.to_dict()
        value.pop("statusline_language")
        with self.assertRaises(display.DisplayConfigError):
            display.validate_display_config(value)
        with self.assertRaises(display.DisplayConfigError):
            display.validate_display_config({**display.DEFAULT_CONFIG.to_dict(), "schema_version": 8})

    def test_language_changes_revision_but_ui_language_does_not(self):
        before = service.read_effective_config(self.config_dir, self.executable).revision
        ui_preferences.set_language(self.config_dir, "zh-CN")
        self.assertEqual(service.read_effective_config(self.config_dir, self.executable).revision, before)
        service.set_option(self.config_dir, self.executable, "statusline-language", "zh-CN")
        self.assertNotEqual(service.read_effective_config(self.config_dir, self.executable).revision, before)
        ui_preferences.set_language(self.config_dir, "en")
        self.assertEqual(display.load_display_config(self.config_dir).statusline_language, "zh-CN")

    def test_apply_omission_preserves_language_and_explicit_value_changes_it(self):
        self.install_minimal_settings()
        service.set_option(self.config_dir, self.executable, "statusline-language", "zh-CN")
        args = dict(items=["model"], colors="off", palette="ansi", directory_style="basename",
                    separator_style="compact", padding=0, refresh_interval=1, hide_vim_mode_indicator="off")
        service.apply_configuration(self.config_dir, self.executable, **args)
        self.assertEqual(display.load_display_config(self.config_dir).statusline_language, "zh-CN")
        service.apply_configuration(self.config_dir, self.executable, **args, statusline_language="en")
        self.assertEqual(display.load_display_config(self.config_dir).statusline_language, "en")
        before = display.config_path(self.config_dir).read_bytes()
        with self.assertRaises(models.ConfigCommandError):
            service.apply_configuration(self.config_dir, self.executable, **args, statusline_language="auto")
        self.assertEqual(display.config_path(self.config_dir).read_bytes(), before)

    def test_failed_write_retains_prior_language_and_future_schema_is_not_overwritten(self):
        service.set_option(self.config_dir, self.executable, "statusline-language", "zh-CN")
        path = display.config_path(self.config_dir)
        before = path.read_bytes()
        with mock.patch.object(display, "write_display_config", side_effect=display.DisplayConfigError("refused")), self.assertRaises(models.ConfigCommandError):
            service.set_option(self.config_dir, self.executable, "statusline-language", "en")
        self.assertEqual(path.read_bytes(), before)
        future = json.dumps({**display.DEFAULT_CONFIG.to_dict(), "schema_version": 8}).encode()
        path.write_bytes(future)
        with self.assertRaises(models.ConfigCommandError):
            service.set_option(self.config_dir, self.executable, "statusline-language", "en")
        self.assertEqual(path.read_bytes(), future)

    def test_export_import_presets_and_reset_have_explicit_language_semantics(self):
        config = display.DEFAULT_CONFIG.with_updates(statusline_language="zh-CN")
        draft = {"display": config.to_dict(), "host": models.DEFAULT_HOST_CONFIG.to_dict()}
        path = Path(self.tempdir.name) / "portable.json"
        transfer.export_file(path, draft, self.config_dir)
        self.assertEqual(transfer.import_file(path, draft)["display"]["statusline_language"], "zh-CN")
        for name in presets.ROWS:
            self.assertEqual(presets.apply(config, name).statusline_language, "zh-CN")
        old = {k: v for k, v in config.to_dict().items() if k in display.V5_DISPLAY_KEYS}
        old["schema_version"] = 5
        path.write_text(json.dumps(old))
        self.assertEqual(transfer.import_file(path, draft)["display"]["statusline_language"], "en")
        ui_preferences.set_language(self.config_dir, "zh-CN")
        service.set_option(self.config_dir, self.executable, "statusline-language", "zh-CN")
        service.reset_configuration(self.config_dir, self.executable)
        self.assertEqual(display.load_display_config(self.config_dir).statusline_language, "en")
        self.assertEqual(ui_preferences.read(self.config_dir).ui_language, "zh-CN")

    def test_stale_editor_cannot_overwrite_language_changes(self):
        self.install_minimal_settings()
        baseline = protocol.read_result(service.read_effective_config(self.config_dir, self.executable))
        service.set_option(self.config_dir, self.executable, "statusline-language", "zh-CN")
        response, code = protocol.handle(json.dumps({"protocol_version": contracts.PROTOCOL_VERSION, "operation": "apply",
                                                    "payload": {"draft": baseline["draft"], "expected_revision": baseline["revision"]}}),
                                         self.config_dir, self.executable)
        self.assertEqual(code, 2)
        self.assertEqual(response["error"]["code"], "configuration_conflict")
        self.assertEqual(display.load_display_config(self.config_dir).statusline_language, "zh-CN")

    def test_cli_and_legacy_parser_share_language_option(self):
        args = commands.parse_slash_arguments("set statusline-language zh-CN")
        commands.execute_config_namespace(args, self.config_dir, self.executable, language="en")
        shown = commands.execute_config_namespace(commands.parse_slash_arguments("show --json"), self.config_dir, self.executable)
        self.assertEqual(json.loads(shown)["display"]["statusline_language"], "zh-CN")
        self.assertEqual(protocol.configuration_options()["statusline-language"]["choices"], ["en", "zh-CN"])
