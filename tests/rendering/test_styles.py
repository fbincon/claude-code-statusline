"""Incremental colors, selective resets and malformed color payload isolation."""

import unittest
from claude_statusline.config import formatting
from claude_statusline.rendering import styles, layout, preferences, spans


class StyleTests(unittest.TestCase):
    def test_decorations_preserve_body_styles_and_isolate_prefix(self):
        value = preferences.decorate(
            "\x1b[1;31;48;5;200m👩🏽‍💻\x1b[22;39mB",
            "current-dir",
            "main",
            formatting.Formatting(),
            formatting.ItemOptions(label="目录", icon="D"),
        )
        units = layout._styled_units(value)
        self.assertEqual("".join(unit.text for unit in units), "D 目录 👩🏽‍💻B")
        self.assertTrue(all(not unit.style for unit in units[:-2]))
        self.assertEqual(
            styles.parse(units[-2].style),
            styles.Style(True, ("ansi", 1), ("ansi", 200)),
        )
        self.assertEqual(
            styles.parse(units[-1].style), styles.Style(background=("ansi", 200))
        )
        self.assertEqual(styles.parse(value), styles.DEFAULT)

    def test_partial_changes_and_selective_resets(self):
        row = "\x1b[31;44mA\x1b[1mB\x1b[22mC\x1b[39mD\x1b[49mE\x1b[1;32mF\x1b[mG"
        states = [styles.parse(u.style) for u in layout._styled_units(row)]
        red, blue = ("ansi", 1), ("ansi", 4)
        self.assertEqual(
            states,
            [
                styles.Style(False, red, blue),
                styles.Style(True, red, blue),
                styles.Style(False, red, blue),
                styles.Style(False, None, blue),
                styles.DEFAULT,
                styles.Style(True, ("ansi", 2)),
                styles.DEFAULT,
            ],
        )
        self.assertEqual(
            spans.row_spans("\x1b[31mR\x1b[1mB")[-1]["foreground"],
            {"kind": "ansi", "value": 1},
        )

    def test_rgb_indexed_and_colon_notation(self):
        for sequence in (
            "\x1b[38;2;0;128;255;48;5;200m",
            "\x1b[38:2::0:128:255;48:5:200m",
            "\x1b[38:2:0:0:128:255;48:5:200m",
        ):
            state = styles.parse(sequence)
            self.assertEqual(
                state, styles.Style(False, ("rgb", "#0080ff"), ("ansi", 200))
            )
            self.assertEqual(styles.parse(state.sgr()), state)
        self.assertEqual(
            styles.parse("\x1b[97;107m"),
            styles.Style(False, ("ansi", 15), ("ansi", 15)),
        )

    def test_bad_color_groups_never_become_bold_reset_or_other_colors(self):
        initial = styles.Style(True, ("ansi", 3), ("ansi", 4))
        for sequence in (
            "\x1b[38;2;999;0;0m",
            "\x1b[38;2;1m",
            "\x1b[48;5;256m",
            "\x1b[38;7;0;31m",
            "\x1b[38:2:1:0:0:0m",
            "\x1b[38:2::1:2m",
        ):
            self.assertEqual(styles.advance(initial, sequence), initial, sequence)
        self.assertEqual(styles.advance(initial, "\x1b[3;4m"), initial)

    def test_row_wrap_restores_all_supported_state_and_resets_end(self):
        rows = layout._split_ansi_text("\x1b[1;38;5;200;48;2;1;2;3mabcdef", 3)
        for row in rows:
            self.assertTrue(row.startswith("\x1b[1;38;5;200;48;2;1;2;3m"))
            self.assertTrue(row.endswith(styles.RESET))
