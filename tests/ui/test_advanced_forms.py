"""Advanced editor fields, cancellation and layout stay in complete drafts."""

from dataclasses import replace
from pathlib import Path
import unittest

from claude_statusline.config import display, editor_fields, models, presets
from claude_statusline.ui import editor, forms, keys


class AdvancedFormsTests(unittest.TestCase):
    def test_field_parser_refuses_coercions_and_fractional_numbers(self):
        boolean = next(
            spec for spec in editor_fields.GLOBAL if spec["kind"] == "boolean"
        )
        integer = next(spec for spec in editor_fields.ITEM if spec["key"] == "priority")
        for value in (1, 0, "true", None):
            with self.assertRaises(display.DisplayConfigError):
                editor_fields.parse_value(boolean, value)
        for value in (True, 1.5, "1.5", "1_0", "", "-1"):
            with self.assertRaises(display.DisplayConfigError):
                editor_fields.parse_value(integer, value)

    def state(self):
        config = display.DEFAULT_CONFIG.with_updates(items=("model", "context-used"))
        return editor.EditorState.from_effective(
            models.EffectiveConfig(
                config,
                models.HostConfig(),
                True,
                Path("/example/claude-statusline.json"),
            )
        )

    def test_global_descriptors_parse_choices_and_thresholds_without_saving(self):
        state = self.state()
        for spec in editor_fields.GLOBAL:
            if spec["kind"] == "choice":
                state.display = editor_fields.set_value(
                    state.display, spec["key"], spec["choices"][-1]
                )
                self.assertEqual(
                    editor_fields.value(state.display, spec["key"]), spec["choices"][-1]
                )
        self.assertTrue(state.modified)
        self.assertEqual(state.baseline.display.formatting.model_name, "original")

    def test_item_text_cancel_and_numeric_validation(self):
        state = self.state()
        keys.handle_key(state, "\x05", 8)
        self.assertEqual(state.form_item, ("main", "model"))
        keys.handle_key(state, "\n", 8)
        keys.handle_key(state, "\x15", 8)
        for char in "Engine 中文":
            keys.handle_key(state, char, 8)
        keys.handle_key(state, "\x07", 8)
        self.assertFalse(state.display.item_options)
        keys.handle_key(state, "\n", 8)
        keys.handle_key(state, "\x15", 8)
        for char in "Engine":
            keys.handle_key(state, char, 8)
        keys.handle_key(state, "\n", 8)
        self.assertEqual(state.display.item_options["model"].label, "Engine")
        state.form_index = 2
        keys.handle_key(state, "\n", 8)
        state.form_input["buffer"] = "101"
        keys.handle_key(state, "\n", 8)
        self.assertIsNotNone(state.form_input)
        self.assertIn("100", state.notice)
        state.form_input["buffer"] = "100"
        keys.handle_key(state, "\n", 8)
        self.assertEqual(state.display.item_options["model"].priority, 100)

    def test_layout_boundaries_and_navigation_remain_valid(self):
        state = self.state()
        state.page = "layout"
        keys.handle_key(state, "\n", 8)
        self.assertEqual(state.display.layout.mode, "explicit")
        row_index = next(
            i
            for i, row in enumerate(forms.rows(state))
            if row["key"] == "break:context-used"
        )
        state.form_index = row_index
        keys.handle_key(state, " ", 8)
        self.assertEqual(state.display.layout.rows, (("model",), ("context-used",)))
        self.assertEqual(keys.handle_key(state, "\x13", 8), "save")
        state.ensure_visible(2)
        self.assertGreater(state.form_scroll, 0)

    def test_transfer_input_is_deferred_and_replaces_only_draft(self):
        state = self.state()
        state.page = "settings"
        state.setting_index = next(
            i for i, row in enumerate(forms.rows(state)) if row["key"] == "import-file"
        )
        keys.handle_key(state, "\n", 8)
        state.form_input["buffer"] = "folder 中文/import.json"
        self.assertEqual(keys.handle_key(state, "\n", 8), "transfer")
        self.assertEqual(state.pending_action, "import")
        baseline = state.baseline
        value = presets.apply(state.display, "multi-agent")
        forms.replace_draft(
            state,
            {
                "display": value.to_dict(),
                "host": replace(state.host, padding=7).to_dict(),
            },
        )
        self.assertIs(state.baseline, baseline)
        self.assertEqual(state.display, value)
        self.assertEqual(state.final_items(), value.items)
        self.assertEqual(state.host.padding, 7)
        self.assertEqual(state.display.subagents.row_limit, 6)
