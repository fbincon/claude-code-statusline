"""Migration and identity contracts for the persisted composition model."""

import copy
import unittest
from dataclasses import replace
from claude_statusline.config import display, instances, formatting, advanced


class InstanceTests(unittest.TestCase):
    def test_legacy_identity_and_disabled_options_roundtrip(self):
        cfg = display.DEFAULT_CONFIG.with_updates(
            items=("model",),
            item_options={"tokens": formatting.ItemOptions(label="Saved")},
        )
        old = cfg.legacy_dict()
        old["schema_version"] = 7
        a, b = (
            display.validate_display_config(old),
            display.validate_display_config(copy.deepcopy(old)),
        )
        self.assertEqual(a, b)
        self.assertEqual(
            a.to_dict(), display.validate_display_config(a.to_dict()).to_dict()
        )
        saved = instances.find(a, "main", "tokens")
        self.assertFalse(saved.enabled)
        self.assertEqual(saved.options.label, "Saved")
        self.assertNotIn("items", a.to_dict())

    def test_copy_edit_toggle_and_remove_are_independent(self):
        cfg = display.DEFAULT_CONFIG.with_updates(items=("model",))
        cfg, identifier = instances.edit(cfg, "main", "copy", "model")
        self.assertNotEqual(identifier, "model")
        cfg, _ = instances.edit(
            cfg, "main", "set", identifier, option="label", value="Second"
        )
        self.assertIsNone(instances.find(cfg, "main", "model").options.label)
        cfg, _ = instances.edit(cfg, "main", "disable", identifier)
        self.assertFalse(instances.find(cfg, "main", identifier).enabled)
        self.assertEqual(display.validate_display_config(cfg.to_dict()), cfg)
        with self.assertRaisesRegex(ValueError, "Multiple instances"):
            instances.legacy_id(cfg, "main", "model")
        cfg, _ = instances.edit(cfg, "main", "remove", identifier)
        self.assertIsNone(instances.find(cfg, "main", identifier))

    def test_identity_and_literal_validation(self):
        cfg = display.DEFAULT_CONFIG.to_dict()
        cfg["instances"].append(copy.deepcopy(cfg["instances"][0]))
        with self.assertRaises(display.DisplayConfigError):
            display.validate_display_config(cfg)
        for value in ("line\nnext", "\x1b[31m", "x" * 257):
            with self.assertRaises(display.DisplayConfigError):
                instances.edit(
                    display.DEFAULT_CONFIG, "main", "add", type_id="text", text=value
                )
        cfg, identifier = instances.edit(
            display.DEFAULT_CONFIG,
            "main",
            "add",
            type_id="text",
            text="$HOME ${model} 中文 👩🏽‍💻",
        )
        self.assertEqual(
            instances.find(cfg, "main", identifier).text, "$HOME ${model} 中文 👩🏽‍💻"
        )

    def test_spacers_and_type_exclusions(self):
        with self.assertRaises(display.DisplayConfigError):
            instances.edit(display.DEFAULT_CONFIG, "main", "add", type_id="spacer")
        cfg = advanced.edit_layout(display.DEFAULT_CONFIG, "explicit")
        cfg, spacer = instances.edit(cfg, "main", "add", type_id="spacer")
        with self.assertRaises(display.DisplayConfigError):
            instances.edit(cfg, "main", "copy", spacer)
        sub = display.SubagentDisplayConfig(items=("status-elapsed",))
        cfg = replace(display.DEFAULT_CONFIG, subagents=sub)
        with self.assertRaises(display.DisplayConfigError):
            instances.edit(cfg, "subagent", "add", type_id="status")

    def test_disabling_keeps_explicit_row_and_identity(self):
        cfg = display.DisplayConfig(
            items=("model", "git"),
            layout=formatting.Layout("explicit", (("model",), ("git",))),
        )
        cfg, _ = instances.edit(cfg, "main", "disable", "model")
        self.assertEqual(cfg.layout.rows, (("model",), ("git",)))
        cfg, _ = instances.edit(cfg, "main", "enable", "model")
        self.assertEqual(cfg.items, ("model", "git"))

    def test_insertions_grow_the_current_row_and_copy_ids_survive_roundtrip(self):
        cfg = display.DisplayConfig(
            items=("model", "context-used"),
            layout=formatting.Layout("explicit", (("model",), ("context-used",))),
        )
        cfg, identifier = instances.edit(
            cfg, "main", "add", type_id="spacer", after="model"
        )
        self.assertEqual(cfg.layout.rows, (("model", identifier), ("context-used",)))
        cfg, copy_id = instances.edit(cfg, "main", "copy", "context-used")
        self.assertEqual(cfg.layout.rows[1], ("context-used", copy_id))
        self.assertEqual(display.validate_display_config(cfg.to_dict()), cfg)
        for version in (8.0, True, 9):
            with self.assertRaises(display.DisplayConfigError):
                display.validate_display_config(
                    {**cfg.to_dict(), "schema_version": version}
                )
