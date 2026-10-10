"""Shared search semantics, ephemeral categories and rendered match evidence."""

import curses
import json
from pathlib import Path
import unittest

from claude_statusline.config import catalog, formatting
from claude_statusline.ui import catalog_view, drawing, keys, search
from claude_statusline.ui.editor import EditorState
from tests.ui.test_interactive_config import effective
from tests.ui.test_layout import Screen, Mapper
from tools.generate_editor_fixtures import generated, OUTPUT

CASES = json.loads((Path(__file__).resolve().parents[1] / "fixtures/editor-search.json").read_text(encoding="utf-8"))


class SearchTests(unittest.TestCase):
    def test_shared_codepoint_matches_and_stable_tiers(self):
        for case in CASES["text_matches"]:
            with self.subTest(case=case):
                match = search.match_text(case["text"], case["query"])
                self.assertEqual(match.rank if match else None, case["rank"])
                self.assertEqual(list(match.positions) if match else [], case["positions"])
        case = CASES["ranking"]
        ranked = sorted(case["items"], key=lambda pair: search.best_match([("name", pair[1])], case["query"]).rank)
        self.assertEqual([pair[0] for pair in ranked], case["expected"])
        self.assertEqual(OUTPUT.read_text(encoding="utf-8"), generated())

    def test_categories_cover_both_scopes_without_changing_defaults(self):
        self.assertEqual(len(search.categories("main")), 11)
        self.assertEqual(search.categories("subagent"), ["all", "task", "model", "context", "location"])
        self.assertEqual(catalog.BY_SCOPE["main"]["branch-diff"].group, "repository")
        self.assertEqual(catalog.BY_SCOPE["subagent"]["tokens"].group, "context")

    def test_queries_and_categories_are_ephemeral_and_block_all_reorders(self):
        state = EditorState.from_effective(effective())
        before = state.display.to_dict()
        order = list(state.item_order)
        state.search = "model"
        state.choose_category("model")
        self.assertEqual(state.visible_items()[0], "model-with-effort")
        state.selected_item = "model"
        self.assertFalse(state.move_selected_item(1))
        self.assertFalse(state.modified)
        state.toggle_selected_item()
        self.assertEqual(state.final_items(), tuple(i for i in order if i in state.enabled))
        state.clear_search()
        self.assertEqual(state.notice, "")
        self.assertFalse(state.move_selected_item(1))
        state.choose_category("all")
        self.assertEqual(state.visible_items(), order)
        self.assertEqual(state.baseline.display.to_dict(), before)

    def test_category_keyboard_accept_cancel_and_empty_selection(self):
        state = EditorState.from_effective(effective())
        keys.handle_key(state, "\x06", 5)
        keys.handle_key(state, curses.KEY_DOWN, 5)
        keys.handle_key(state, "\x1b", 5)
        self.assertEqual(state.category, "all")
        keys.handle_key(state, "\x06", 5)
        keys.handle_key(state, curses.KEY_DOWN, 5)
        keys.handle_key(state, "\n", 5)
        self.assertEqual(state.category, "model")
        self.assertFalse(state.modified)
        state.append_search("zzzzzz")
        self.assertEqual(state.visible_items(), [])
        self.assertIsNone(state.selected_item)
        self.assertFalse(state.toggle_selected_item())

    def test_actual_bilingual_fields_and_custom_label_are_searchable(self):
        state = EditorState.from_effective(effective())
        for query in ("model-with-effort", "mwe", "推理", "仓库", "Repository"):
            state.search = query
            self.assertTrue(state.visible_items(), query)
        state.display = state.display.with_updates(item_options={"model": formatting.ItemOptions(label="私有🦊引擎")})
        state.search = "私有🦊"
        self.assertEqual(state.visible_items(), ["model"])
        self.assertEqual(state.matches("main")["model"].field, "custom_label")
        self.assertEqual(state.matches("main")["model"].positions, (0, 1, 2))

    def test_explicit_search_accepts_spaces_without_toggling_or_saving(self):
        state = EditorState.from_effective(effective())
        original = (state.search, state.selected_item)
        for key in "/Model with effort":
            self.assertIsNone(keys.handle_key(state, key, 5))
        self.assertEqual(state.search, "Model with effort")
        self.assertFalse(state.modified)
        keys.handle_key(state, "\x07", 5)
        self.assertEqual((state.search, state.selected_item), original)
        for key in "/Model with effort\n":
            self.assertIsNone(keys.handle_key(state, key, 5))
        self.assertEqual(state.selected_item, "model-with-effort")
        self.assertIsNone(state.search_input)
        self.assertFalse(state.modified)

    def test_search_refocuses_better_matches_but_navigation_keeps_weaker_matches(self):
        state = EditorState.from_effective(effective())
        state.append_search("git")
        self.assertEqual(state.selected_item, "git")
        state.navigate_end()
        selected = state.selected_item
        self.assertNotEqual(selected, "git")
        state.ensure_visible(4)
        self.assertEqual(state.selected_item, selected)
        self.assertEqual("".join(text for text, _ in search.segments("🦊中文é", [1, 3, 4])), "🦊中文é")
        snippet = search.snippet(search.match_text("a very long preamble needle", "needle"))
        self.assertEqual("".join(snippet.text[p] for p in snippet.positions), "needle")

    def test_category_and_highlight_draw_within_small_and_resized_terminals(self):
        for language in ("en", "zh-CN"):
            for width, height in ((64, 18), (80, 24), (120, 30), (80, 48)):
                state = EditorState.from_effective(effective(), language=language)
                state.search = "mwe"
                screen = Screen(width, height)
                drawing._draw_screen(screen, state, Mapper())
                self.assertIn("Ctrl+F", screen.text)
                self.assertNotIn("catalog.", screen.text)
                state.category_selection = "requests"
                drawing._draw_screen(screen, state, Mapper())
                self.assertNotIn("catalog.", screen.text)

    def test_alternate_language_highlights_only_the_actual_source_characters(self):
        state = EditorState.from_effective(effective(), language="zh-CN")
        state.search = "mwe"
        screen = Screen(120, 18)
        match = state.matches("main")["model-with-effort"]
        catalog_view.draw_item(screen, state, "main", "model-with-effort", match, 2, 0, 120, True, True)
        highlighted = "".join(text for _, _, text, attr in screen.calls if attr & curses.A_BOLD)
        self.assertEqual(highlighted, "mwe")
        self.assertIn("model-with-effort", screen.text)
