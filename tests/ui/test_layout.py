"""Grouped windows and real drawing stay usable at terminal boundaries."""

import curses
import unittest
from unittest import mock

from claude_statusline.config import editor_fields
from claude_statusline.rendering import layout as render_layout
from claude_statusline.ui import drawing, forms, keys, layout
from tests.ui.test_interactive_config import effective
from claude_statusline.ui.editor import EditorState


def select(state, key):
    forms.select(
        state, next(i for i, row in enumerate(forms.rows(state)) if row["key"] == key)
    )


class Screen:
    """Fail on an out-of-bounds write instead of swallowing curses errors."""

    def __init__(self, width, height):
        self.width, self.height = width, height
        self.erase()

    def getmaxyx(self):
        return self.height, self.width

    def erase(self):
        self.cells = [[" " for _ in range(self.width)] for _ in range(self.height)]
        self.calls = []

    def refresh(self):
        pass

    def addstr(self, y, x, text, attr=0):
        size = render_layout._display_width(text)
        assert 0 <= y < self.height and 0 <= x < self.width
        assert x + size <= self.width, (y, x, text)
        assert y != self.height - 1 or x + size < self.width
        self.calls.append((y, x, text, attr))
        for unit in render_layout._styled_units(text):
            if unit.width:
                self.cells[y][x] = unit.text
                for continuation in range(1, unit.width):
                    self.cells[y][x + continuation] = ""
                x += unit.width

    @property
    def text(self):
        return "\n".join("".join(row) for row in self.cells)


class Mapper:
    def __init__(self, colors=0):
        self.colors = colors
        self.preview_attr = 0

    def foreground(self, color):
        return 0

    def style(self, sgr):
        return curses.A_BOLD if drawing._ansi_style(sgr, self.colors)[0] else 0

    preview_style = style


class GroupWindowTests(unittest.TestCase):
    def test_all_selections_fit_with_group_headings_and_sticky_context(self):
        rows = [{"group": group} for group in ("A", "A", "B", "C", "C", "C")]
        for height in range(1, 12):
            for selected in range(len(rows)):
                for scroll in range(len(rows) + 2):
                    with self.subTest(height=height, selected=selected, scroll=scroll):
                        window = layout.form_window(rows, selected, scroll, height)
                        self.assertLessEqual(len(window.lines), height)
                        self.assertIn(selected, [line.index for line in window.lines])
                        self.assertEqual(
                            [
                                line.index
                                for line in window.lines
                                if line.index is not None
                            ],
                            list(range(window.start, window.end)),
                        )
                        if height > 1:
                            self.assertIsNone(window.lines[0].index)
                            self.assertEqual(
                                window.lines[0].group, rows[window.start]["group"]
                            )
                            for i, line in enumerate(window.lines):
                                if line.index is None:
                                    self.assertIsNotNone(window.lines[i + 1].index)
                                    self.assertEqual(
                                        line.group, window.lines[i + 1].group
                                    )

    def test_empty_and_invalid_selection_are_bounded(self):
        self.assertEqual(layout.form_window([], 100, 100, 1).lines, ())
        row = [{"group": "A"}]
        self.assertEqual(layout.form_window(row, -20, 100, 0).lines[0].index, 0)

    def test_settings_layout_and_detail_groups_are_contiguous(self):
        state = EditorState.from_effective(
            effective(items=("model", "git", "context-used"))
        )
        state.page = "settings"
        rows = forms.rows(state)
        self.assertEqual(
            list(dict.fromkeys(row["group"] for row in rows)),
            list(forms.SETTINGS_GROUPS),
        )
        self.assertEqual(
            [row["key"] for row in rows[:5]],
            ["colors", "palette", "directory-style", "separator-style", "scope-labels"],
        )
        state.page = "layout"
        rows = forms.rows(state)
        self.assertEqual(
            [row["key"] for row in rows[:3]],
            ["layout-mode", "break:git", "break:context-used"],
        )
        self.assertEqual(
            [row["key"] for row in rows[3:]],
            [
                "fit:" + item + ":" + option
                for item in state.display.items
                for option in ("priority", "max_width")
            ],
        )
        state.form_item = ("main", "model")
        rows = forms.rows(state)
        self.assertEqual(
            [row["key"] for row in rows[-2:]], ["item:priority", "item:max_width"]
        )
        for group in dict.fromkeys(row["group"] for row in rows):
            indexes = [i for i, row in enumerate(rows) if row["group"] == group]
            self.assertEqual(indexes, list(range(min(indexes), max(indexes) + 1)))

    def test_navigation_only_selects_fields_across_groups_and_resize(self):
        state = EditorState.from_effective(effective())
        state.page = "settings"
        for _ in forms.rows(state):
            keys.handle_key(state, curses.KEY_DOWN, 6)
            window = layout.form_window(
                forms.rows(state), forms.index(state), state.settings_scroll, 6
            )
            self.assertIn(forms.index(state), [line.index for line in window.lines])
        self.assertEqual(forms.current(state)["key"], "ui-language")
        keys.handle_key(state, curses.KEY_HOME, 6)
        keys.handle_key(state, curses.KEY_NPAGE, 6)
        self.assertEqual(forms.current(state)["key"], "field:statusline_language")
        keys.handle_key(state, curses.KEY_PPAGE, 6)
        self.assertEqual(forms.current(state)["key"], "colors")
        select(state, "padding")
        keys.handle_key(state, "3", 6)
        original = state.numeric_edit
        state.ensure_visible(2)
        self.assertIs(state.numeric_edit, original)
        self.assertEqual(forms.current(state)["key"], "padding")
        keys.handle_key(state, "\x1b", 2)
        self.assertEqual(state.host.padding, state.baseline.host.padding)
        select(state, "field:metrics.branch_diff_base_ref")
        keys.handle_key(state, "\n", 6)
        state.form_input["buffer"] = "分支é"
        state.ensure_visible(2)
        self.assertEqual(state.form_input["buffer"], "分支é")
        keys.handle_key(state, "\x07", 2)
        self.assertIsNone(state.form_input)


class DrawingTests(unittest.TestCase):
    def test_shortcut_keys_and_labels_have_independent_styles_on_every_page(self):
        for page in ("items", "subagents", "settings", "layout", "detail"):
            for colors in (0, 8, 16, 256):
                state = EditorState.from_effective(effective())
                if page == "detail":
                    state.form_item = ("main", state.selected_item)
                else:
                    state.page = page
                screen = Screen(64, 20)
                drawing._draw_screen(screen, state, Mapper(colors))
                calls = [c for c in screen.calls if c[0] >= 18]
                key_calls = [c for c in calls if c[3] & curses.A_BOLD]
                self.assertTrue(key_calls)
                self.assertTrue(all(not c[3] & curses.A_REVERSE for c in calls))
                self.assertTrue(
                    all(not c[3] & (curses.A_COLOR | curses.A_DIM) for c in calls)
                )
                self.assertTrue(all(c[2].strip() == c[2] for c in key_calls))
                self.assertTrue(
                    any(c[2] == " save" and not c[3] & curses.A_BOLD for c in calls)
                )
                self.assertTrue(any("Ctrl+S" in c[2] for c in key_calls))
                self.assertTrue(any(c[2] in ("Tab", "↑↓") for c in key_calls))

    def test_shortcut_groups_clip_at_cell_boundaries_without_partial_bindings(self):
        from claude_statusline.ui.shortcuts import Hint

        screen = Screen(16, 5)
        drawing._draw_shortcuts(
            screen,
            4,
            [Hint("Ctrl+G", "cancel editing", "cancel"), Hint("Esc", "restore")],
            16,
            Mapper(),
        )
        self.assertIn("Ctrl+G cancel", screen.text)
        self.assertNotIn("Esc", screen.text)
        self.assertEqual(
            [c[2] for c in screen.calls if c[3] & curses.A_BOLD], ["Ctrl+G"]
        )
        from claude_statusline.ui.shortcuts import segments

        for width in range(1, 25):
            result = segments([Hint("Enter", "保存中文 é", "保存")], width)
            self.assertLessEqual(
                sum(render_layout._display_width(text) for text, _ in result), width
            )
            self.assertTrue(not result or result[0] == ("Enter", True))

    def test_portable_file_action_keys_use_the_same_styles_as_footer_keys(self):
        state = EditorState.from_effective(effective())
        state.page = "settings"
        select(state, "export-file")
        screen = Screen(120, 30)
        drawing._draw_screen(screen, state, Mapper())
        geometry = layout.dimensions(120, 30)
        self.assertTrue(
            any(
                text == "Enter"
                and attr & curses.A_BOLD
                and geometry.content.inner_y < y < geometry.preview.y
                for y, _, text, attr in screen.calls
            )
        )

    def test_all_pages_at_boundaries_without_overlaps_or_out_of_bounds_writes(self):
        for width, height in (
            (32, 12),
            (64, 18),
            (64, 19),
            (64, 20),
            (80, 24),
            (120, 30),
            (80, 48),
        ):
            for page in ("items", "subagents", "settings", "layout", "detail"):
                for colors in (0, 8, 16, 256):
                    with self.subTest(size=(width, height), page=page, colors=colors):
                        state = EditorState.from_effective(effective())
                        if page == "detail":
                            state.form_item = ("main", state.selected_item)
                        else:
                            state.page = page
                        screen = Screen(width, height)
                        viewport = drawing._draw_screen(screen, state, Mapper(colors))
                        if (
                            width < drawing.ui_models.MIN_TERMINAL_WIDTH
                            or height < drawing.ui_models.MIN_TERMINAL_HEIGHT
                        ):
                            self.assertEqual(viewport, 1)
                            self.assertIn("Terminal too small", screen.text)
                            self.assertTrue(
                                all(
                                    not call[3] & (curses.A_COLOR | curses.A_DIM)
                                    for call in screen.calls
                                )
                            )
                            continue
                        geometry = layout.dimensions(width, height)
                        self.assertEqual(viewport, geometry.list_height)
                        self.assertEqual(
                            geometry.preview.y + geometry.preview.height, height - 2
                        )
                        self.assertGreaterEqual(geometry.preview.inner_height, 2)
                        self.assertIn("Preview (sample data)", screen.text)
                        self.assertIn("Ctrl+S", screen.text)
                        self.assertIn(
                            "OPTION"
                            if page in ("settings", "layout", "detail")
                            else "DESCRIPTION",
                            screen.text,
                        )
                        selected = [
                            call
                            for call in screen.calls
                            if call[3] & curses.A_REVERSE
                            and geometry.content.inner_y < call[0] < geometry.preview.y
                        ]
                        self.assertEqual(len({call[0] for call in selected}), 1)
                        if height >= 20:
                            self.assertIn("┌", screen.text)
                            self.assertIn("│", screen.text)
                        else:
                            self.assertNotIn("│", screen.text)

    def test_preview_uses_the_panel_width_and_retains_sample_styles(self):
        state = EditorState.from_effective(effective())
        screen = Screen(80, 24)
        with mock.patch.object(
            drawing.rendering_preview,
            "render_preview_rows",
            return_value=["\x1b[1m中文 é\x1b[0m"],
        ) as preview:
            drawing._draw_screen(screen, state, Mapper())
        panel = layout.dimensions(80, 24).preview
        preview.assert_called_once_with(
            state.display, panel.inner_width, state.host.padding
        )
        self.assertTrue(
            any(
                y == panel.inner_y and attr & curses.A_BOLD
                for y, _, _, attr in screen.calls
            )
        )
        self.assertIn("中文 é", screen.text)

    def test_long_cjk_values_clipping_empty_search_and_small_window(self):
        state = EditorState.from_effective(effective())
        state.form_item = ("main", state.selected_item)
        state.display = editor_fields.set_value(
            state.display, "label", "中文 é" * 40, *state.form_item
        )
        screen = Screen(64, 18)
        drawing._draw_screen(screen, state, Mapper())
        self.assertIn("中文 é", screen.text)
        state.form_item = None
        state.search = "no-such-item"
        drawing._draw_screen(screen, state, Mapper())
        self.assertIn("No matching items", screen.text)
        self.assertIn("Items 0-0/0", screen.text)
        screen = Screen(40, 10)
        self.assertEqual(drawing._draw_screen(screen, state, Mapper()), 1)
        self.assertIn("Terminal too small", screen.text)
        self.assertEqual(state.search, "no-such-item")

    def test_detail_input_and_invalid_legacy_number_show_contextual_controls(self):
        state = EditorState.from_effective(effective())
        state.page = "settings"
        select(state, "padding")
        keys.handle_key(state, "9", 6)
        keys.handle_key(state, "9", 6)
        screen = Screen(64, 18)
        drawing._draw_screen(screen, state, Mapper())
        self.assertIn("Padding must be from 0 through 32", screen.text)
        self.assertIn("Enter accept", screen.text)
        self.assertIn("[99_]", screen.text)
        self.assertEqual(state.host.padding, 9)
