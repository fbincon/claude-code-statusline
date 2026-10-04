"""Portable draft transfer and presets never save installation or host behavior."""

import json
from pathlib import Path
import tempfile
import unittest

from claude_statusline.config import display, formatting, models, presets, transfer
from claude_statusline.ui import protocol


class TransferTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="transfer 中文 quote' ")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.config = self.root / "absent config"
        self.draft = {
            "display": display.DEFAULT_CONFIG.to_dict(),
            "host": models.HostConfig(7, None, True).to_dict(),
        }

    def request(self, op, payload):
        return protocol.handle(
            json.dumps({"protocol_version": 2, "operation": op, "payload": payload}),
            self.config,
            Path("/tool"),
        )

    def test_all_presets_are_editable_and_preserve_unrelated_appearance(self):
        original = display.DEFAULT_CONFIG.with_updates(
            use_colors=False, palette="ansi", directory_style="home"
        )
        for name in presets.ROWS:
            value = presets.apply(original, name)
            self.assertEqual(display.validate_display_config(value.to_dict()), value)
            self.assertFalse(value.use_colors)
            self.assertEqual(value.directory_style, "home")
            self.assertEqual(value.formatting.model_name, "short")
            self.assertEqual(value.formatting.number_format, "compact")
            self.assertEqual(
                value.with_updates(separator_style="compact").items, value.items
            )
        multi = presets.apply(original, "multi-agent")
        self.assertTrue(multi.subagents.hide_completed)
        self.assertEqual(multi.subagents.row_limit, 6)
        self.assertEqual(multi.subagents.task_max_width, 48)
        result, status = self.request(
            "preset", {"draft": self.draft, "preset": "developer"}
        )
        self.assertEqual(status, 0, result)
        self.assertEqual(result["result"]["draft"]["host"], self.draft["host"])
        self.assertFalse(self.config.exists())

    def test_export_import_roundtrip_contains_only_draft(self):
        file = self.root / "portable 中文.json"
        value = presets.apply(display.DEFAULT_CONFIG, "monitoring")
        value = value.with_updates(
            item_options={"context-used": formatting.ItemOptions(label="Used")}
        )
        self.draft["display"] = value.to_dict()
        exported, code = self.request(
            "export", {"draft": self.draft, "path": str(file), "overwrite": False}
        )
        self.assertEqual(code, 0, exported)
        data = json.loads(file.read_bytes())
        self.assertEqual(set(data), {"format", "version", "draft"})
        self.assertEqual(set(data["draft"]), {"display", "host"})
        imported, code = self.request(
            "import", {"draft": self.draft, "path": str(file)}
        )
        self.assertEqual(code, 0, imported)
        self.assertEqual(imported["result"]["draft"], self.draft)
        self.assertFalse(self.config.exists())

    def test_existing_file_and_live_config_are_protected(self):
        file = self.root / "existing.json"
        file.write_text("old")
        result, status = self.request(
            "export", {"draft": self.draft, "path": str(file), "overwrite": False}
        )
        self.assertEqual(status, 2)
        self.assertEqual(file.read_text(), "old")
        for name in (
            "settings.json",
            display.CONFIG_FILENAME,
            "claude-statusline-native.json",
        ):
            result, status = self.request(
                "export",
                {
                    "draft": self.draft,
                    "path": str(self.config / name),
                    "overwrite": True,
                },
            )
            self.assertEqual(status, 2, result)
        self.assertFalse(self.config.exists())
        self.assertEqual(list(self.root.glob(".statusline-export-*")), [])

    def test_display_only_v1_v2_import_keeps_current_host(self):
        for version, keys in (
            (1, display.V1_DISPLAY_KEYS),
            (2, display.V2_DISPLAY_KEYS),
        ):
            legacy = {k: v for k, v in self.draft["display"].items() if k in keys}
            legacy["schema_version"] = version
            if version == 2:
                legacy["subagents"] = {"enabled": False, "items": ["name"]}
            file = self.root / "legacy.json"
            raw = json.dumps(legacy).encode()
            file.write_bytes(raw)
            imported = transfer.import_file(file, self.draft)
            self.assertEqual(imported["display"]["schema_version"], 3)
            self.assertEqual(imported["host"], self.draft["host"])
            self.assertEqual(file.read_bytes(), raw)

    def test_invalid_imports_are_rejected_without_configuration_writes(self):
        cases = [
            '{"version":1,"version":1}',
            '{"format":"claude-code-statusline","version":true,"draft":{}}',
            '{"format":"claude-code-statusline","version":2,"draft":{}}',
            '{"x":NaN}',
            "{bad",
            "[]",
        ]
        file = self.root / "bad.json"
        for raw in cases:
            file.write_text(raw)
            result, status = self.request(
                "import", {"draft": self.draft, "path": str(file)}
            )
            self.assertEqual(status, 2, result)
            self.assertFalse(self.config.exists())
        file.write_bytes(b" " * (transfer.MAX_BYTES + 1))
        self.assertRaises(
            display.DisplayConfigError, transfer.import_file, file, self.draft
        )
