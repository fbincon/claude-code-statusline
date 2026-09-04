#!/usr/bin/env python3
"""Regression tests for adaptive multi-line statusline layout."""

import unittest

from claude_statusline import statusline as sl


def plain(text):
    return sl.ANSI_SGR_RE.sub("", text)


class DisplayWidthTests(unittest.TestCase):
    def test_ansi_unicode_and_combining_width(self):
        rendered = f"{sl.C_MODEL}A中文e\u0301{sl.C_RESET}"
        self.assertEqual(sl._display_width(rendered), 6)
        self.assertEqual(plain(rendered), "A中文e\u0301")

    def test_terminal_columns_and_fallbacks(self):
        self.assertEqual(sl._terminal_content_width({"COLUMNS": "42"}), 40)
        self.assertEqual(sl._terminal_content_width({"COLUMNS": "1"}), 2)
        for value in (None, "", "nope", "0", "-5"):
            env = {} if value is None else {"COLUMNS": value}
            with self.subTest(value=value):
                self.assertEqual(sl._terminal_content_width(env), 118)


class SegmentSplittingTests(unittest.TestCase):
    def assertRowsFit(self, rows, width):
        for row in rows:
            self.assertLessEqual(sl._display_width(row), width, plain(row))

    def test_colored_split_preserves_text_and_restarts_style(self):
        rendered = f"{sl.C_DIR}abcdefghij{sl.C_RESET}"
        chunks = sl._split_ansi_text(rendered, 4)
        self.assertEqual("".join(plain(chunk) for chunk in chunks), "abcdefghij")
        self.assertEqual([sl._display_width(chunk) for chunk in chunks], [4, 4, 2])
        for chunk in chunks:
            self.assertTrue(chunk.startswith(sl.C_DIR))
            self.assertTrue(chunk.endswith(sl.C_RESET))

    def test_long_absolute_path_prefers_slashes_without_data_loss(self):
        path = "/home/fbincon/projects/a-very-long-directory/source/package"
        segment = sl._LayoutSegment(
            f"{sl.C_DIR}{path}{sl.C_RESET}",
            prefer_slash_breaks=True,
        )
        rows = sl._layout_segments([segment], 14)
        self.assertGreater(len(rows), 1)
        self.assertRowsFit(rows, 14)
        self.assertEqual("".join(plain(row) for row in rows), path)
        self.assertNotIn("…", "".join(plain(row) for row in rows))

    def test_windows_drive_and_unc_paths_prefer_both_separator_styles(self):
        for path in (
            r"C:\Users\测试 用户\projects\very-long-component\src\package",
            r"\\server\share\团队 目录\very-long-component\src\package",
            r"C:/Users/测试 用户/projects/very-long-component/src/package",
        ):
            with self.subTest(path=path):
                segment = sl._LayoutSegment(
                    f"{sl.C_DIR}{path}{sl.C_RESET}",
                    prefer_slash_breaks=True,
                )
                rows = sl._layout_segments([segment], 18)
                self.assertGreater(len(rows), 1)
                self.assertRowsFit(rows, 18)
                self.assertEqual("".join(plain(row) for row in rows), path)
                self.assertTrue(any(
                    plain(row).startswith(("/", "\\")) for row in rows[1:]
                ))

    def test_single_long_component_and_unicode_are_hard_split(self):
        value = "/" + "长目录" * 5 + "x" * 17
        segment = sl._LayoutSegment(
            f"{sl.C_DIR}{value}{sl.C_RESET}",
            prefer_slash_breaks=True,
        )
        rows = sl._layout_segments([segment], 8)
        self.assertRowsFit(rows, 8)
        self.assertEqual("".join(plain(row) for row in rows), value)

    def test_other_oversized_fields_are_split_without_truncation(self):
        branch = "feature/" + "x" * 31
        rows = sl._layout_segments([
            sl._LayoutSegment(f"{sl.C_BRANCH}{branch}{sl.C_RESET}"),
        ], 9)
        self.assertRowsFit(rows, 9)
        self.assertEqual("".join(plain(row) for row in rows), branch)


class AdaptiveLayoutTests(unittest.TestCase):
    def assertRowsFit(self, rows, width):
        for row in rows:
            self.assertLessEqual(sl._display_width(row), width, plain(row))

    def segments(self):
        return [
            sl._LayoutSegment(f"{sl.C_MODEL}model{sl.C_RESET}"),
            sl._LayoutSegment(f"{sl.C_DIR}/repo{sl.C_RESET}", True),
            sl._LayoutSegment(f"{sl.C_BRANCH}main{sl.C_RESET}"),
        ]

    def test_wide_layout_preserves_single_line_contract(self):
        rows = sl._layout_segments(self.segments(), 80)
        self.assertEqual(len(rows), 1)
        self.assertEqual(plain(rows[0]), "model | /repo | main")

    def test_exact_fit_and_one_cell_over_wrap_at_segment_boundary(self):
        segments = [sl._LayoutSegment("A"), sl._LayoutSegment("BB")]
        self.assertEqual([plain(row) for row in sl._layout_segments(segments, 6)], [
            "A | BB",
        ])
        self.assertEqual([plain(row) for row in sl._layout_segments(segments, 5)], [
            "A", "BB",
        ])

    def test_narrow_layout_preserves_order_and_clean_separators(self):
        rows = sl._layout_segments(self.segments(), 9)
        self.assertRowsFit(rows, 9)
        self.assertEqual([plain(row) for row in rows], ["model", "/repo", "main"])
        for row in map(plain, rows):
            self.assertFalse(row.startswith(" | "))
            self.assertFalse(row.endswith(" | "))

    def test_no_hard_row_limit_or_field_loss(self):
        segments = [sl._LayoutSegment(f"s{index:02d}") for index in range(12)]
        rows = sl._layout_segments(segments, 3)
        self.assertEqual(len(rows), len(segments))
        self.assertEqual([plain(row) for row in rows], [
            f"s{index:02d}" for index in range(12)
        ])

    def test_tiny_width_makes_progress_and_keeps_all_content(self):
        value = "ab中cd"
        rows = sl._layout_segments([sl._LayoutSegment(value)], 2)
        self.assertRowsFit(rows, 2)
        self.assertEqual("".join(plain(row) for row in rows), value)


if __name__ == "__main__":
    unittest.main(verbosity=2)
