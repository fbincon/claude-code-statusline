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
    def test_compatibility_exports_share_the_new_implementation(self):
        for name in (
            "_ColorMapper",
            "_ansi_style",
            "_XTERM_RGB",
            "nearest_terminal_color",
        ):
            self.assertIs(getattr(drawing, name), getattr(theme, name))
            self.assertIs(getattr(interactive_config, name), getattr(theme, name))

    def test_preview_base_pair_is_reserved_before_sample_and_default_pairs(self):
        with colors() as initialize:
            mapper = theme._ColorMapper()
            self.assertEqual(initialize.call_args_list, [mock.call(1, 254, 234)])
            preview = mapper.preview_style("\x1b[31m")
            outside = mapper.foreground(1)
            self.assertNotEqual(preview, outside)
            self.assertEqual(
                initialize.call_args_list[-2:],
                [mock.call(2, 1, 234), mock.call(3, 1, -1)],
            )
            self.assertEqual(mapper.preview_style("\x1b[31m"), preview)
            self.assertEqual(initialize.call_count, 3)
            self.assertEqual(mapper.preview_style(""), mapper.preview_attr)
            self.assertEqual(mapper.preview_style("\x1b[0m"), mapper.preview_attr)

    def test_basic_and_monochrome_capabilities(self):
        for count, foreground in ((0, None), (8, 7), (16, 15), (256, 254)):
            with self.subTest(count=count), colors(count) as initialize:
                mapper = theme._ColorMapper()
                if count:
                    initialize.assert_called_once_with(
                        1, foreground, 234 if count == 256 else 0
                    )
                    self.assertTrue(mapper.preview_attr)
                else:
                    initialize.assert_not_called()
                    self.assertEqual(mapper.preview_attr, 0)
                self.assertEqual(
                    mapper.preview_style("\x1b[1m"), curses.A_BOLD | mapper.preview_attr
                )

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
                            (attr & curses.A_COLOR) // (curses.A_COLOR & -curses.A_COLOR),
                            expected,
                            234 if count == 256 else 0,
                        ),
                        initialize.call_args_list,
                    )

    def test_default_color_failure_does_not_prevent_explicit_preview_colors(self):
        with colors(defaults=False) as initialize:
            mapper = theme._ColorMapper()
            self.assertFalse(mapper.default_colors)
            self.assertTrue(mapper.preview_attr)
            mapper.foreground(1)
            self.assertEqual(initialize.call_args, mock.call(2, 1, curses.COLOR_BLACK))

    def test_failed_preview_base_disables_all_preview_foreground_colors(self):
        with colors(failure=curses.error()) as initialize:
            mapper = theme._ColorMapper()
            self.assertEqual(mapper.preview_attr, 0)
            self.assertEqual(mapper.preview_style("\x1b[1;31m"), curses.A_BOLD)
            self.assertEqual(mapper.preview_style("\x1b[32m"), 0)
            initialize.assert_called_once()

    def test_start_color_failure_is_monochrome(self):
        with (
            colors() as initialize,
            mock.patch.object(curses, "start_color", side_effect=curses.error()),
        ):
            mapper = theme._ColorMapper()
            self.assertEqual(mapper.colors, 0)
            self.assertEqual(mapper.preview_style("\x1b[31m"), 0)
            initialize.assert_not_called()

    def test_pair_exhaustion_and_sample_failure_keep_the_preview_base(self):
        for pairs in (1, 2):
            with self.subTest(pairs=pairs), colors(pairs=pairs) as initialize:
                mapper = theme._ColorMapper()
                self.assertEqual(mapper.preview_style("\x1b[31m"), mapper.preview_attr)
                self.assertEqual(initialize.call_count, pairs - 1)

        def fail_sample(pair, foreground, background):
            if pair > 1:
                raise curses.error()

        with colors(failure=fail_sample) as initialize:
            mapper = theme._ColorMapper()
            for _ in range(3):
                self.assertEqual(mapper.preview_style("\x1b[31m"), mapper.preview_attr)
            self.assertEqual(initialize.call_count, 2)

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
            with self.subTest(rows=rows), colors():
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
                    all(attr & curses.A_COLOR for _, _, _, attr in screen.calls)
                )
                if len(rows) > 3:
                    self.assertIn("… 2 more lines", screen.text)
                if rows and " plain" in rows[0]:
                    self.assertEqual(screen.calls[-1][3], mapper.preview_attr)


if __name__ == "__main__":
    unittest.main()
