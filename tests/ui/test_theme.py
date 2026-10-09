"""Readable terminal chrome, isolated previews and bounded color allocation."""

import curses
from contextlib import contextmanager
import unittest
from unittest import mock

from claude_statusline import interactive_config
from claude_statusline.ui import drawing, layout, theme
from claude_statusline.ui.editor import EditorState
from tests.ui.test_interactive_config import effective
from tests.ui.test_layout import Screen


@contextmanager
def colors(count=256, pairs=256, defaults=True, failure=None):
    with (
        mock.patch.object(curses, "has_colors", return_value=count > 0),
        mock.patch.object(curses, "start_color"),
        mock.patch.object(
            curses,
            "use_default_colors",
            side_effect=None if defaults else curses.error(),
        ),
        mock.patch.object(curses, "COLORS", count, create=True),
        mock.patch.object(curses, "COLOR_PAIRS", pairs, create=True),
        mock.patch.object(curses, "init_pair", side_effect=failure) as initialize,
        mock.patch.object(
            curses,
            "color_pair",
            side_effect=lambda n: n * (curses.A_COLOR & -curses.A_COLOR),
        ),
    ):
        yield initialize


class ThemeTests(unittest.TestCase):
    def test_preview_caption_follows_palette_draft_and_color_disable(self):
        state = EditorState.from_effective(effective())
        baseline = state.baseline.display
        with colors():
            mapper = theme._ColorMapper()
            for palette, use_colors, caption in (
                ("default", True, "Palette: default"),
                ("ansi", True, "Palette: ansi"),
                ("ansi", False, "Colors: off"),
            ):
                state.display = state.display.with_updates(
                    palette=palette, use_colors=use_colors
                )
                screen = Screen(120, 30)
                drawing._draw_screen(screen, state, mapper)
                self.assertIn("Preview (sample data) · " + caption, screen.text)
            self.assertEqual(state.baseline.display, baseline)

    def test_compatibility_exports_share_the_new_implementation(self):
        for name in (
            "_ColorMapper",
            "_ansi_style",
            "_XTERM_RGB",
            "nearest_terminal_color",
        ):
            self.assertIs(getattr(drawing, name), getattr(theme, name))
            self.assertIs(getattr(interactive_config, name), getattr(theme, name))

    def test_preview_uses_terminal_defaults_without_reserved_background_pairs(self):
        with colors() as initialize:
            mapper = theme._ColorMapper()
            initialize.assert_not_called()
            preview = mapper.preview_style("\x1b[31m")
            self.assertEqual(preview, mapper.foreground(1))
            initialize.assert_called_once_with(1, 1, -1)
            self.assertEqual(mapper.preview_style(""), 0)
            self.assertEqual(mapper.preview_style("\x1b[0m"), 0)

    def test_basic_and_monochrome_capabilities(self):
        for count in (0, 8, 16, 256):
            with self.subTest(count=count), colors(count) as initialize:
                mapper = theme._ColorMapper()
                initialize.assert_not_called()
                self.assertEqual(mapper.preview_attr, 0)
                self.assertEqual(mapper.preview_style("\x1b[1m"), curses.A_BOLD)
                mapper.preview_style("\x1b[31m")
                if count:
                    initialize.assert_called_once_with(1, 1, -1)
                else:
                    initialize.assert_not_called()

    def test_preview_preserves_quantized_rgb_and_ansi_sample_foregrounds(self):
        for count in (8, 16, 256):
            with self.subTest(count=count), colors(count) as initialize:
                mapper = theme._ColorMapper()
                for sgr, expected in (
                    (
                        "\x1b[1;38;2;246;226;183m",
                        theme.nearest_terminal_color(246, 226, 183, count),
                    ),
                    ("\x1b[1;32m", 2),
                ):
                    attr = mapper.preview_style(sgr)
                    self.assertTrue(attr & curses.A_BOLD)
                    self.assertIn(
                        mock.call(
                            (attr & curses.A_COLOR)
                            // (curses.A_COLOR & -curses.A_COLOR),
                            expected,
                            -1,
                        ),
                        initialize.call_args_list,
                    )

    def test_default_color_failure_preserves_default_text_instead_of_painting_black(
        self,
    ):
        with colors(defaults=False) as initialize:
            mapper = theme._ColorMapper()
            self.assertFalse(mapper.default_colors)
            self.assertEqual(mapper.preview_style("\x1b[1;31m"), curses.A_BOLD)
            self.assertEqual(mapper.foreground(1), 0)
            initialize.assert_not_called()

    def test_failed_sample_pair_is_cached_and_falls_back_to_default_text(self):
        with colors(failure=curses.error()) as initialize:
            mapper = theme._ColorMapper()
            for _ in range(3):
                self.assertEqual(mapper.preview_style("\x1b[1;31m"), curses.A_BOLD)
            initialize.assert_called_once_with(1, 1, -1)

    def test_start_color_failure_is_monochrome(self):
        with (
            colors() as initialize,
            mock.patch.object(curses, "start_color", side_effect=curses.error()),
        ):
            mapper = theme._ColorMapper()
            self.assertEqual(mapper.colors, 0)
            self.assertEqual(mapper.preview_style("\x1b[31m"), 0)
            initialize.assert_not_called()

    def test_pair_exhaustion_falls_back_to_default_text(self):
        with colors(pairs=1) as initialize:
            mapper = theme._ColorMapper()
            self.assertEqual(mapper.preview_style("\x1b[31m"), 0)
            initialize.assert_not_called()
        with colors(pairs=2) as initialize:
            mapper = theme._ColorMapper()
            self.assertTrue(mapper.preview_style("\x1b[31m"))
            self.assertEqual(mapper.preview_style("\x1b[32m"), 0)
            initialize.assert_called_once_with(1, 1, -1)

    def test_color_pair_attributes_never_exceed_python_pair_limit(self):
        with colors(pairs=65536) as initialize:
            mapper = theme._ColorMapper()
            for color in range(256):
                mapper.foreground(color)
            self.assertEqual(initialize.call_count, 255)
            self.assertEqual(
                max(call.args[0] for call in initialize.call_args_list), 255
            )

    def test_chrome_is_default_color_on_all_pages_and_selected_actions(self):
        with colors():
            mapper = theme._ColorMapper()
            for page in ("items", "subagents", "settings", "layout", "detail"):
                with self.subTest(page=page):
                    state = EditorState.from_effective(effective())
                    state.page = "items" if page == "detail" else page
                    if page == "detail":
                        state.form_item = ("main", state.selected_item)
                    screen = Screen(120, 30)
                    drawing._draw_screen(screen, state, mapper)
                    panel = layout.dimensions(120, 30).preview
                    for y, x, text, attr in screen.calls:
                        if not panel.inner_y <= y < panel.inner_y + panel.inner_height:
                            self.assertFalse(
                                attr & (curses.A_COLOR | curses.A_DIM),
                                (page, text, attr),
                            )
                    keys = [
                        call
                        for call in screen.calls
                        if call[0] >= 28 and call[3] & curses.A_BOLD
                    ]
                    self.assertTrue(keys)
                    self.assertTrue(
                        any(call[3] & curses.A_REVERSE for call in screen.calls)
                    )

    def test_preview_fills_empty_rows_trailing_spaces_resets_and_overflow(self):
        for rows in (
            [],
            [""],
            ["plain"],
            ["\x1b[31mcolored\x1b[0m plain"],
            ["one", "two", "three", "four"],
        ):
            with self.subTest(rows=rows), colors() as initialize:
                mapper = theme._ColorMapper()
                state = EditorState.from_effective(effective())
                screen = Screen(80, 24)
                with mock.patch.object(
                    drawing.rendering_preview, "render_preview_rows", return_value=rows
                ):
                    drawing._draw_preview(screen, state, 10, 3, 20, mapper, 2)
                # Base fill covers all cells before text, including trailing spaces.
                self.assertEqual(
                    screen.calls[:3],
                    [(y, 2, " " * 20, mapper.preview_attr) for y in (10, 11, 12)],
                )
                self.assertTrue(
                    all(call.args[2] == -1 for call in initialize.call_args_list)
                )
                if len(rows) > 3:
                    self.assertIn("… 2 more lines", screen.text)
                if rows and " plain" in rows[0]:
                    self.assertEqual(screen.calls[-1][3], mapper.preview_attr)


if __name__ == "__main__":
    unittest.main()
