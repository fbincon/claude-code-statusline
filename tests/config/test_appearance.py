"""Shared appearance validation, scoped forms and lossless legacy reads."""

from copy import deepcopy
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest import mock

from claude_statusline.config import appearance, display, formatting, editor_fields, service, models, transfer
from tests.support import REPOSITORY_ROOT


class AppearanceConfigTests(unittest.TestCase):
    def test_shared_validation_cases(self):
        cases = json.loads((REPOSITORY_ROOT / "tests/fixtures/appearance.json").read_text())
        for case in cases:
            with self.subTest(case=case):
                data = display.DEFAULT_CONFIG.to_dict()
                target = data if case["scope"] == "main" else data["subagents"]
                target["item_options"][case["item"]] = {**formatting.ItemOptions().to_dict(), **case["patch"]}
                if case["valid"]:
                    parsed = display.validate_display_config(data)
                    self.assertEqual(display.validate_display_config(parsed.to_dict()), parsed)
                else:
                    with self.assertRaises(display.DisplayConfigError):
                        display.validate_display_config(data)

    def test_scoped_fields_and_cli_edits_share_validation(self):
        from claude_statusline.config import advanced

        for scope, catalog in (("main", display.ITEM_CATALOG), ("subagent", display.SUBAGENT_ITEM_CATALOG)):
            for item in catalog:
                specs = {f["key"]: f for f in editor_fields.item_fields(scope, item)}
                rule = appearance.VISIBILITY_ITEMS[scope].get(item)
                self.assertEqual("visibility" in specs, rule is not None)
                self.assertEqual("visibility_threshold" in specs, rule == "used-at-least")
                for value in ("#AABBCC", "ansi:001", "default", "inherit"):
                    left = advanced.edit_item(display.DEFAULT_CONFIG, scope, item, "foreground", value)
                    right = editor_fields.set_value(display.DEFAULT_CONFIG, "foreground", value, scope, item)
                    self.assertEqual(left, right)

    def test_v6_read_migrate_backup_and_restore(self):
        original = display.DEFAULT_CONFIG.to_dict()
        original["schema_version"] = 6
        original.pop("theme")
        original.pop("powerline_glyph")
        old_option = {key: value for key, value in formatting.ItemOptions(label="我的模型").to_dict().items()
                      if key in formatting.LEGACY_ITEM_KEYS}
        original["item_options"]["model"] = old_option
        original["subagents"]["item_options"]["name"] = deepcopy(old_option)
        raw = (json.dumps(original, ensure_ascii=False) + "\n").encode()
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            path = display.config_path(root)
            path.write_bytes(raw)
            loaded = display.load_display_config(root)
            self.assertEqual(loaded.schema_version, 7)
            self.assertEqual(loaded.item_options["model"].visibility, "always")
            self.assertEqual(path.read_bytes(), raw)
            self.assertEqual(list(root.iterdir()), [path])
            result = service.set_option(root, Path(sys.executable), "theme", "light")
            self.assertEqual(result.effective.display.item_options["model"].label, "我的模型")
            self.assertEqual((result.backup_dir / "claude-statusline.json.before").read_bytes(), raw)
            display.restore_bytes(path, raw)
            self.assertEqual(path.read_bytes(), raw)
            # New fields cannot be smuggled under an older schema.
            original["item_options"]["model"]["foreground"] = "#ffffff"
            with self.assertRaises(display.DisplayConfigError):
                display.validate_display_config(original)

    def test_theme_preserves_overrides_and_failed_write_preserves_bytes(self):
        config = display.DEFAULT_CONFIG.with_updates(item_options={"model": formatting.ItemOptions(background="#abcdef")})
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            display.write_display_config(root, config)
            before = display.config_path(root).read_bytes()
            with mock.patch.object(display, "write_display_config", side_effect=display.DisplayConfigError("failed")):
                with self.assertRaises(models.ConfigCommandError):
                    service.set_option(root, Path(sys.executable), "theme", "dark")
            self.assertEqual(display.config_path(root).read_bytes(), before)
            result = service.set_option(root, Path(sys.executable), "theme", "light")
            self.assertEqual(result.effective.display.item_options, config.item_options)
            self.assertEqual(result.effective.display.layout, config.layout)
            draft = {"display": result.effective.display.to_dict(), "host": models.HostConfig().to_dict()}
            target = root / "portable.json"
            transfer.export_file(target, draft, root)
            self.assertEqual(transfer.import_file(target, draft), draft)

    def test_theme_and_glyph_are_strict(self):
        for key, values in (("theme", ("auto", "", None, [])), ("powerline_glyph", ("custom", "\x1b", 1))):
            for value in values:
                with self.subTest(key=key, value=value), self.assertRaises(display.DisplayConfigError):
                    display.DEFAULT_CONFIG.with_updates(**{key: value})
