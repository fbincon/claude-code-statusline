"""Migration, data-aware formatting and complete draft persistence regressions."""

import json
from dataclasses import replace
from pathlib import Path
import tempfile
import unittest

from claude_statusline.config import display, formatting
from claude_statusline.rendering import items, layout, metrics, preferences
from claude_statusline.ui import protocol


class FormattingTests(unittest.TestCase):
    def test_v2_normalizes_without_touching_file(self):
        legacy = {
            k: v
            for k, v in display.DEFAULT_CONFIG.to_dict().items()
            if k in display.V2_DISPLAY_KEYS
        }
        legacy["schema_version"] = 2
        legacy["subagents"] = {"enabled": False, "items": ["name"]}
        with tempfile.TemporaryDirectory() as folder:
            path = display.config_path(Path(folder))
            raw = json.dumps(legacy).encode()
            path.write_bytes(raw)
            loaded = display.load_display_config(Path(folder))
            self.assertEqual(loaded.schema_version, 3)
            self.assertEqual(loaded.formatting, formatting.Formatting())
            self.assertFalse(loaded.subagents.enabled)
            self.assertEqual(path.read_bytes(), raw)

    def test_invalid_advanced_options_are_rejected(self):
        for changes in ({"warning": True}, {"critical": 60}, {"enabled": 1}):
            value = display.DEFAULT_CONFIG.to_dict()
            value["formatting"]["thresholds"].update(changes)
            with self.assertRaises(display.DisplayConfigError):
                display.validate_display_config(value)
        for key, value in (
            ("label", "bad\x1b[0m"),
            ("priority", -1),
            ("max_width", True),
            ("formatting", {"model_name": "made-up"}),
        ):
            options = formatting.ItemOptions().to_dict()
            options[key] = value
            with self.assertRaises(ValueError):
                formatting.ItemOptions.parse(options)

    def test_known_model_versions_and_unknown_names(self):
        fmt = formatting.Formatting(model_name="short")
        self.assertEqual(
            preferences.model_name("claude-sonnet-4-5-20250929", fmt), "Sonnet 4.5"
        )
        self.assertEqual(
            preferences.model_name("custom-20260101", fmt), "custom-20260101"
        )
        self.assertEqual(
            preferences.model_name("claude-opus", formatting.Formatting()),
            "claude-opus",
        )

    def test_numbers_use_raw_integers_and_preserve_absence(self):
        for mode, expected in (
            ("compact", "1.2M"),
            ("full", "1200345"),
            ("grouped", "1,200,345"),
        ):
            fmt = formatting.Formatting(number_format=mode)
            self.assertEqual(preferences.number(1200345, fmt), expected)
            self.assertEqual(preferences.number(0, fmt), "0")
            self.assertIsNone(preferences.number(None, fmt))
            self.assertIsNone(preferences.number(True, fmt))

    def test_explicit_icons_replace_or_hide_legacy_glyphs(self):
        config = display.DEFAULT_CONFIG.with_updates(
            items=("fast-mode",), scope_labels="off"
        )
        for icon, expected in (("FAST", "FAST fast"), ("", "fast")):
            changed = config.with_updates(
                item_options={"fast-mode": formatting.ItemOptions(icon=icon)}
            )
            rendered = "".join(
                segment.text
                for segment in items._configured_segments({"fast_mode": True}, changed)[
                    0
                ]
            )
            self.assertEqual(layout.ANSI_SGR_RE.sub("", rendered), expected)

    def test_reset_absolute_format_has_fixed_clock_and_expiry(self):
        fmt = formatting.Formatting(reset_format="datetime", reset_timezone="UTC")
        self.assertEqual(
            preferences.reset_time(3600, 0, fmt, metrics.countdown),
            "1970-01-01 01:00 UTC",
        )
        self.assertIsNone(preferences.reset_time(3600, 3600, fmt, metrics.countdown))

    def test_remaining_allowance_uses_used_risk_and_scoped_overrides(self):
        fmt = formatting.Formatting(
            allowance="remaining", thresholds=formatting.Thresholds(True)
        )
        config = display.DEFAULT_CONFIG.with_updates(
            items=("five-hour-limit", "model"),
            scope_labels="off",
            formatting=fmt,
            item_options={
                "model": formatting.ItemOptions(
                    label="Engine", formatting={"model_name": "short"}
                )
            },
        )
        data = {
            "model": {"id": "claude-sonnet-4-5"},
            "rate_limits": {"five_hour": {"used_percentage": 95}},
        }
        segments, _, _ = items._configured_segments(data, config)
        text = "".join(s.text for s in segments)
        self.assertIn("5% left", text)
        self.assertIn("242;134;134", text)
        self.assertIn("Engine Sonnet 4.5", layout.ANSI_SGR_RE.sub("", text))
        plain = config.with_updates(
            use_colors=False, formatting=replace(fmt, allowance="used")
        )
        text = "".join(s.text for s in items._configured_segments(data, plain)[0])
        self.assertIn("95% used", text)
        self.assertNotIn("\x1b", text)

    def test_protocol_one_is_refused_before_reading_settings(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder) / "absent"
            response, code = protocol.handle(
                '{"protocol_version":1,"operation":"read","payload":{}}',
                root,
                Path("/tool"),
            )
            self.assertEqual(code, 2)
            self.assertEqual(response["error"]["code"], "unsupported_protocol")
            self.assertFalse(root.exists())
