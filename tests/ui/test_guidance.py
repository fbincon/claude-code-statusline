"""Complete static guidance, strict contracts and read-only navigation."""

import curses
import unittest
from unittest import mock

from claude_statusline.config import catalog, guidance as metadata
from claude_statusline.i18n import translate
from claude_statusline.rendering.layout import _display_width
from claude_statusline.ui import guidance, keys, drawing, forms
from claude_statusline.ui.editor import EditorState
from tests.ui.test_interactive_config import effective
from tests.ui.test_layout import Screen, Mapper, select


class GuidanceTests(unittest.TestCase):
    def test_all_items_have_scoped_translated_guidance_without_process_calls(self):
        with mock.patch("subprocess.run", side_effect=AssertionError("guidance cannot probe sources")):
            for item in catalog.ITEMS:
                guide = item.to_dict()["guidance"]
                self.assertTrue(set(guide["source_kinds"]) <= set(metadata.SOURCE_KINDS))
                self.assertIn(guide["measurement_scope"], metadata.SCOPES)
                self.assertTrue(set(guide["requirements"]) <= set(metadata.REQUIREMENTS))
                for language in ("en", "zh-CN"):
                    text = "\n".join(guidance.paragraphs(item.scope, item.id, language))
                    self.assertNotIn("guidance.", text)
                    self.assertIn(item.id, text)
                    self.assertIn(translate("guidance.static", language), text)
                    if item.minimum_version:
                        self.assertIn(item.minimum_version, text)
                    else:
                        self.assertIn(translate("guidance.version_unknown", language), text)

    def test_requirements_distinguish_collectors_and_metric_scopes(self):
        def guide(scope, item):
            return catalog.BY_SCOPE[scope][item].to_dict()["guidance"]
        self.assertIn("native_timing", guide("main", "task-active-timer")["requirements"])
        self.assertNotIn("live_metrics", guide("main", "task-active-timer")["requirements"])
        self.assertIn("live_metrics", guide("main", "ttft")["requirements"])
        self.assertIn("existing_telemetry", guide("main", "prompt-cost")["requirements"])
        self.assertIn("gateway_284", guide("main", "spend-amount")["requirements"])
        self.assertIn("git_base", guide("main", "branch-diff")["requirements"])
        self.assertEqual(guide("main", "tokens")["measurement_scope"], "all_sessions")
        self.assertEqual(guide("subagent", "tokens")["measurement_scope"], "subagent_context")
        self.assertIn("agent_effort_optional", guide("subagent", "model-with-effort")["requirements"])

    def test_guidance_scroll_cancel_and_resize_preserve_draft_and_selection(self):
        for language in ("en", "zh-CN"):
            state = EditorState.from_effective(effective(), language=language)
            state.selected_item = "prompt-cost"
            keys.handle_key(state, "\x05", 8)
            self.assertEqual(forms.current(state)["key"], "item:label")
            select(state, "item-guidance")
            keys.handle_key(state, "\n", 8)
            before = state.display.to_dict()
            for width, height in ((64, 18), (120, 30), (80, 48)):
                screen = Screen(width, height)
                drawing._draw_screen(screen, state, Mapper())
                self.assertIn(translate("guidance.title", language), screen.text)
                keys.handle_key(state, curses.KEY_END, 8)
                drawing._draw_screen(screen, state, Mapper())
                self.assertIn("claude-statusline doctor", screen.text)
                self.assertIsNone(keys.handle_key(state, "\x13", 8))
                keys.handle_key(state, curses.KEY_HOME, 8)
            keys.handle_key(state, "\x1b", 8)
            self.assertIsNone(state.guidance_scroll)
            self.assertEqual(state.form_item, ("main", "prompt-cost"))
            self.assertEqual(state.display.to_dict(), before)
            self.assertFalse(state.modified)

    def test_all_explanations_wrap_inside_terminal_cells(self):
        for language in ("en", "zh-CN"):
            for item in catalog.ITEMS:
                for width in (30, 60, 118):
                    lines = guidance.lines(item.scope, item.id, language, width)
                    self.assertTrue(all(_display_width(line) <= width for line in lines))
