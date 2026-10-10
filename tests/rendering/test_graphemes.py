"""Independent Unicode conformance, cross-style boundaries and width budgets."""

import json
from pathlib import Path
import subprocess
import sys
import unittest

from claude_statusline.rendering import text, layout, formatters
from tools.generate_unicode import conformance

ROOT = Path(__file__).resolve().parents[2]


class GraphemeTests(unittest.TestCase):
    def test_every_official_unicode_18_boundary(self):
        for expected in conformance():
            with self.subTest(expected=expected):
                self.assertEqual(list(text.graphemes("".join(expected))), expected)

    def test_shared_widths_and_clipping_budgets(self):
        cases = json.loads(
            (ROOT / "tests/fixtures/graphemes.json").read_text(encoding="utf-8")
        )["cases"]
        for case in cases:
            value = case["text"]
            with self.subTest(text=value):
                self.assertEqual(list(text.graphemes(value)), case["clusters"])
                self.assertEqual(formatters.display_width(value), case["width"])
                self.assertEqual(layout._display_width(value), case["width"])
                for budget in range(case["width"] + 2):
                    output = text.clip(value, budget, "…")
                    self.assertLessEqual(text.display_width(output), budget)
                    content = (
                        output[:-1]
                        if output.endswith("…") and output != value
                        else output
                    )
                    self.assertEqual(
                        "".join(case["clusters"][: len(list(text.graphemes(content)))]),
                        content,
                    )

    def test_sgr_inside_a_cluster_uses_base_style_and_advances_later_state(self):
        value = "\x1b[31m👩\x1b[1;44m🏽\u200d💻X"
        units = layout._styled_units(value)
        self.assertEqual(
            [(u.text, u.width, u.style) for u in units],
            [("👩🏽\u200d💻", 2, "\x1b[31m"), ("X", 1, "\x1b[1;31;44m")],
        )
        rows = layout._split_ansi_text(value, 2)
        self.assertEqual(
            [layout.ANSI_SGR_RE.sub("", row) for row in rows], ["👩🏽\u200d💻", "X"]
        )
        self.assertTrue(all(row.endswith("\x1b[0m") for row in rows))

    def test_combining_mark_style_does_not_detach_it(self):
        units = layout._styled_units("\x1b[31me\x1b[32m\u0301X")
        self.assertEqual(
            [(u.text, u.style) for u in units], [("é", "\x1b[31m"), ("X", "\x1b[32m")]
        )
        self.assertEqual(layout.truncate_styled("👨‍👩‍👧‍👦X", 2), "…")
        self.assertEqual(
            formatters.truncate_text("\x1b[31m👩🏽‍💻X", 2, ellipsis=""),
            "\x1b[31m👩🏽‍💻\x1b[0m",
        )

    def test_ascii_path_does_not_load_unicode_tables_or_reference_package(self):
        source = "from claude_statusline.rendering.text import display_width; import sys; assert display_width('ASCII') == 5; assert not any(n.startswith('wcwidth') or n.startswith('claude_statusline.rendering._unicode_') for n in sys.modules)"
        subprocess.run([sys.executable, "-c", source], check=True)

    def test_long_combining_cluster_is_never_sliced(self):
        cluster = "e" + "\u0301" * 4096
        self.assertEqual(text.clip(cluster + "X", 1), cluster)
        self.assertEqual(text.display_width(cluster), 1)

    def test_complete_layout_normalizes_cross_style_clusters_and_oversized_units(self):
        value = "\x1b[31me\x1b[32m\u0301X"
        row = layout._layout_segments([value], 20)[0]
        self.assertIn("\x1b[31mé", row)
        self.assertNotIn("e\x1b", row)
        rows = layout._split_ansi_text("a🏽X", 2)
        self.assertTrue(all(layout._display_width(row) <= 2 for row in rows))
        self.assertEqual("".join(layout.ANSI_SGR_RE.sub("", r) for r in rows), "…X")
