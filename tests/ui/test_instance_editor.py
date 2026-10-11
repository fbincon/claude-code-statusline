"""Instance keyboard edits and read-only add discovery in the external editor."""

import unittest
from copy import deepcopy
from claude_statusline.ui import keys, forms, drawing
from claude_statusline.ui.editor import EditorState
from claude_statusline.config import display, instances, formatting
from tests.ui.test_interactive_config import effective
from tests.ui.test_layout import Screen, Mapper


class InstanceEditorTests(unittest.TestCase):
    def test_add_picker_guidance_cancel_and_accept_preserve_drafts(self):
        state = EditorState.from_effective(effective())
        original = deepcopy(state.display.to_dict())
        state.search = "git"
        keys.handle_key(state, "\x01", 8)
        state.selected_item = "task-active-timer"
        keys.handle_key(state, "\x05", 8)
        self.assertEqual(state.guidance_scroll, 0)
        screen = Screen(80, 24)
        drawing._draw_screen(screen, state, Mapper())
        self.assertIn("Sources and requirements", screen.text)
        keys.handle_key(state, "\x07", 8)
        self.assertTrue(state.adding)
        self.assertIsNone(state.form_item)
        keys.handle_key(state, "\x07", 8)
        self.assertFalse(state.adding)
        self.assertEqual(state.search, "git")
        self.assertEqual(state.display.to_dict(), original)
        keys.handle_key(state, "\x01", 8)
        state.selected_item = "text"
        keys.handle_key(state, "\n", 8)
        identifier = state.selected_item
        self.assertFalse(state.adding)
        self.assertEqual(state.search, "")
        keys.handle_key(state, "\x05", 8)
        self.assertEqual(forms.current(state)["key"], "item:text")
        forms.set_value(state, forms.current(state), "${model} 中文")
        self.assertEqual(
            instances.find(state.display, "main", identifier).text, "${model} 中文"
        )

    def test_copy_remove_and_scope_identity_keep_the_baseline(self):
        state = EditorState.from_effective(effective())
        original = deepcopy(state.baseline.display.to_dict())
        state.selected_item = "git"
        keys.handle_key(state, "\x04", 8)
        duplicate = state.selected_item
        self.assertNotEqual(duplicate, "git")
        self.assertTrue(state.modified)
        keys.handle_key(state, " ", 8)
        self.assertFalse(instances.find(state.display, "main", duplicate).enabled)
        self.assertTrue(instances.find(state.display, "main", "git").enabled)
        keys.handle_key(state, "\x18", 8)
        self.assertIsNone(instances.find(state.display, "main", duplicate))
        self.assertEqual(state.baseline.display.to_dict(), original)

    def test_rejected_spacer_move_keeps_order_and_positions(self):
        first = instances.DisplayInstance("s1", "spacer")
        second = instances.DisplayInstance("s2", "spacer")
        nodes = (
            instances.DisplayInstance("model", "model"),
            first,
            instances.DisplayInstance("git", "git"),
            second,
        )
        cfg = display.DisplayConfig(
            instances=nodes,
            layout=formatting.Layout("explicit", (("model", "s1"), ("git", "s2"))),
        )
        state = EditorState.from_effective(effective())
        state.display = cfg
        state.refresh_instances()
        state.selected_item = "s1"
        original = cfg.to_dict()
        order = list(state.item_order)
        self.assertFalse(state.move_selected_item(1))
        self.assertEqual(state.item_order, order)
        self.assertEqual(state.display.to_dict(), original)
        # Move a spacer directly into a row already containing another is rejected.
        with self.assertRaises(display.DisplayConfigError):
            instances.edit(cfg, "main", "move", "s1", after="s2")
        self.assertEqual(cfg.to_dict(), original)
        self.assertEqual(order, ["model", "s1", "git", "s2"])
