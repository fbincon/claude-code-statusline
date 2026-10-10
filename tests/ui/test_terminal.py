"""Curses backing cells, VT frame ordering and safe whole-cluster fallback."""

import curses
import io
import unittest
from unittest import mock

from claude_statusline.ui.terminal import GraphemeScreen, attribute_sgr
from claude_statusline.ui import theme, text_input
from claude_statusline.rendering import spans
from tests.ui.test_theme import colors


class Backing:
    def __init__(self):
        self.calls = []
        self.rows, self.columns = 4, 20

    def getmaxyx(self):
        return self.rows, self.columns

    def addstr(self, *args):
        self.calls.append(args)

    def erase(self):
        self.calls.clear()

    def clearok(self, value):
        self.calls.append(("clear", value))

    def touchwin(self):
        self.calls.append("touch")

    def refresh(self):
        self.calls.append("refresh")


class TerminalTests(unittest.TestCase):
    def test_vt_paints_complete_runs_in_order_after_blank_backing_refresh(self):
        raw, output = Backing(), io.StringIO()
        screen = GraphemeScreen(raw, output, vt=True)
        screen.addstr(0, 0, "👩🏽‍💻", curses.A_BOLD)
        screen.addstr(0, 2, " X", 0)
        self.assertEqual(
            raw.calls[:2],
            [(0, 0, "  ", curses.A_BOLD), (0, 2, " X".replace("X", " "), 0)],
        )
        screen.refresh()
        value = output.getvalue()
        self.assertIn("\x1b[1;1H\x1b[0;1m👩🏽‍💻", value)
        self.assertIn("\x1b[1;3H\x1b[0m X", value)
        self.assertTrue(value.endswith("\x1b[0m\x1b8"))
        screen.erase()
        output.seek(0)
        output.truncate()
        screen.addstr(0, 0, "short")
        screen.refresh()
        self.assertNotIn("👩", output.getvalue())
        self.assertEqual(raw.calls[-3:], [("clear", True), "touch", "refresh"])

    def test_unsupported_backend_replaces_a_whole_cluster_at_the_same_width(self):
        raw = Backing()
        screen = GraphemeScreen(raw, io.StringIO())
        screen.addstr(0, 1, "A👨‍👩‍👧‍👦B é")
        self.assertEqual(raw.calls[-1][2], "A? B ?")
        self.assertTrue(screen.fallback_used)
        screen.addstr(3, 18, "👩🏽‍💻")
        self.assertEqual(len(raw.calls), 1)  # Bottom-right cell cannot fit the cluster.

    def test_resize_clips_pending_runs_again_and_restores_style(self):
        raw, output = Backing(), io.StringIO()
        screen = GraphemeScreen(raw, output, vt=True)
        screen.addstr(0, 0, "A👩🏽‍💻B")
        raw.columns = 2
        screen.refresh()
        self.assertIn("\x1b[0mA\x1b[0m", output.getvalue())
        self.assertNotIn("👩", output.getvalue())

    def test_color_pairs_preserve_both_channels_and_selective_defaults(self):
        with colors() as initialize:
            mapper = theme._ColorMapper()
            mapper.preview_style("\x1b[31;44m")
            mapper.preview_style("\x1b[31;44m\x1b[39m")
            mapper.preview_style("\x1b[31;44m\x1b[49m")
            self.assertEqual(
                initialize.call_args_list,
                [mock.call(1, 1, 4), mock.call(2, -1, 4), mock.call(3, 1, -1)],
            )
        with colors(defaults=False) as initialize:
            mapper = theme._ColorMapper()
            mapper.preview_style("\x1b[31;44m")
            initialize.assert_called_once_with(1, 1, 4)
        with (
            mock.patch.object(curses, "pair_number", return_value=2),
            mock.patch.object(curses, "pair_content", return_value=(200, 201)),
        ):
            self.assertEqual(
                attribute_sgr(curses.A_BOLD), "\x1b[0;1;38;5;200;48;5;201m"
            )

    def test_span_merging_retains_background_boundaries_and_resets(self):
        result = spans.row_spans("\x1b[31;44mA\x1b[49mB\x1b[39mC")
        self.assertEqual(
            [span["background"] for span in result],
            [{"kind": "ansi", "value": 4}, None, None],
        )
        self.assertEqual([span["text"] for span in result], ["A", "B", "C"])

    def test_text_input_accepts_joiners_and_removes_complete_clusters(self):
        value = "A👩🏽‍💻"
        self.assertTrue(all(text_input.printable(ch) for ch in value))
        self.assertEqual(text_input.backspace(value), "A")
        self.assertEqual(text_input.backspace("é"), "")
        for value in ("\x1b", "\n", "\u202e", "\ud800"):
            self.assertFalse(text_input.printable(value))

    def test_background_mapping_for_monochrome_basic_bright_and_256_color(self):
        for count in (0, 8, 16, 256):
            with self.subTest(colors=count), colors(count) as initialize:
                mapper = theme._ColorMapper()
                attr = mapper.preview_style("\x1b[91;104m")
                if count == 0:
                    self.assertEqual(attr, 0)
                    initialize.assert_not_called()
                else:
                    initialize.assert_called_once_with(
                        1, 1 if count == 8 else 9, 4 if count == 8 else 12
                    )
                    self.assertEqual(bool(attr & curses.A_BOLD), count == 8)

    @unittest.skipIf(__import__("os").name == "nt", "POSIX terminfo capability probe")
    def test_non_ansi_cursor_capabilities_do_not_enable_vt_painting(self):
        from claude_statusline.ui.terminal import _enable_vt

        output = mock.Mock()
        output.isatty.return_value = True
        for cursor, expected in (
            (b"\x1b[%i%p1%d;%p2%dH", True),
            (b"\x1bY%p1%c%p2%c", False),
            (None, False),
        ):
            with mock.patch.object(
                curses,
                "tigetstr",
                side_effect=lambda name: cursor if name == "cup" else b"\x1b[m",
            ):
                supported, restore = _enable_vt(output)
                self.assertEqual(supported, expected)
                restore()

    def test_plain_text_never_becomes_terminal_control_instructions(self):
        raw, output = Backing(), io.StringIO()
        screen = GraphemeScreen(raw, output, vt=True)
        screen.addstr(0, 0, "A\x1b[2J\x9bZ")
        screen.refresh()
        self.assertIn("A [2J Z", output.getvalue())
        self.assertNotIn("\x1b[2J", output.getvalue())
        self.assertNotIn("\x9b", output.getvalue())
