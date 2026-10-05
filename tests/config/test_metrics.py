import json
from pathlib import Path
import tempfile
import unittest

from claude_statusline.config import display, editor_fields, metrics


class MetricsConfigTests(unittest.TestCase):
    def test_v3_read_preserves_source_and_formats_until_actual_save(self):
        data = display.DEFAULT_CONFIG.to_dict()
        data.pop("metrics")
        data["schema_version"] = 3
        data["formatting"]["number_format"] = "grouped"
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            path = display.config_path(root)
            raw = json.dumps(data).encode()
            path.write_bytes(raw)
            config = display.load_display_config(root)
            self.assertEqual(config.schema_version, 4)
            self.assertEqual(config.metrics.branch_diff_base_ref, None)
            self.assertEqual(config.formatting.number_format, "grouped")
            self.assertEqual(path.read_bytes(), raw)

    def test_base_field_and_complete_roundtrip_agree(self):
        config = editor_fields.set_value(
            display.DEFAULT_CONFIG, "metrics.branch_diff_base_ref", "refs/heads/main"
        )
        self.assertEqual(config.metrics, metrics.Metrics("refs/heads/main"))
        self.assertEqual(display.validate_display_config(config.to_dict()), config)
        self.assertIsNone(
            editor_fields.set_value(
                config, "metrics.branch_diff_base_ref", "inherit"
            ).metrics.branch_diff_base_ref
        )
        for value in ("", "--upload-pack=bad", "bad\nref", "a b", "\ud800", 1):
            with (
                self.subTest(value=value),
                self.assertRaises(display.DisplayConfigError),
            ):
                display.DEFAULT_CONFIG.with_updates(metrics=metrics.Metrics(value))
