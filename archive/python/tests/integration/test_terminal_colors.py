"""Capture rendering and acceptance share foreground/background resolution."""

import unittest

from tools.terminal_colors import cell_colors, contrast
from tools.external_tui_acceptance import TERMINAL_THEMES, XTERM_PALETTE, verify_colors
from claude_statusline.ui import layout


class TerminalColorTests(unittest.TestCase):
    def capture(self):
        cells = [
            [
                {
                    "fg": "default",
                    "bg": "default",
                    "reverse": False,
                    "bold": False,
                    "data": " ",
                }
                for _ in range(64)
            ]
            for _ in range(18)
        ]
        cells[0][0].update(data="T", bold=True)
        cells[5][2].update(data="S", reverse=True)
        cells[-2][0].update(data="S", bold=True)
        cells[-2][2].update(data="s")
        return cells

    def test_external_default_color_chrome_is_readable_in_both_fixtures(self):
        for foreground, background in TERMINAL_THEMES.values():
            verify_colors(self.capture(), 64, 18, foreground, background)

    def test_external_capture_rejects_fixed_white_chrome_and_artificial_preview_background(
        self,
    ):
        cells = self.capture()
        cells[0][0]["fg"] = "brightwhite"
        with self.assertRaisesRegex(AssertionError, "Fixed chrome"):
            verify_colors(cells, 64, 18, *TERMINAL_THEMES["light"])
        cells = self.capture()
        cells[layout.dimensions(64, 18).preview.inner_y][1]["bg"] = "1c1c1c"
        with self.assertRaisesRegex(AssertionError, "Artificial preview background"):
            verify_colors(cells, 64, 18, *TERMINAL_THEMES["light"])

    def test_preview_preserves_low_contrast_samples_instead_of_changing_their_colors(
        self,
    ):
        cells = self.capture()
        cells[layout.dimensions(64, 18).preview.inner_y][1].update(
            data="P", fg="brightwhite"
        )
        self.assertEqual(verify_colors(cells, 64, 18, *TERMINAL_THEMES["light"]), 1)

    def test_capture_rejects_unreadable_defaults_and_resolves_recorded_ansi_palette(
        self,
    ):
        with self.assertRaisesRegex(AssertionError, "Unreadable chrome"):
            verify_colors(self.capture(), 64, 18, "#ffffff", "#ffffff")
        cell = {"fg": "white", "bg": "black", "reverse": True}
        self.assertEqual(
            cell_colors(cell, palette=XTERM_PALETTE), ("#000000", "#c0c0c0")
        )
        self.assertEqual(
            cell_colors(cell, palette={"white": "ffffff", "black": "17191e"}),
            ("#17191e", "#ffffff"),
        )

    def test_default_roles_are_distinct_and_reverse_after_resolution(self):
        cell = {"fg": "default", "bg": "default", "reverse": False}
        self.assertEqual(cell_colors(cell), ("#dedee7", "#17191e"))
        cell["reverse"] = True
        self.assertEqual(cell_colors(cell), ("#17191e", "#dedee7"))

    def test_explicit_light_and_sample_cells_keep_their_original_colors(self):
        cell = {"fg": "000000", "bg": "ffffff", "reverse": False}
        self.assertEqual(cell_colors(cell), ("#000000", "#ffffff"))
        self.assertEqual(contrast(*cell_colors(cell)), 21)
        cell.update(fg="8ed3d3", bg="17191e")
        self.assertEqual(cell_colors(cell), ("#8ed3d3", "#17191e"))
        self.assertGreater(contrast(*cell_colors(cell)), 4.5)

    def test_white_on_light_is_rejected_but_ansi_names_remain_renderable(self):
        self.assertLess(contrast("#ffffff", "#eeeeee"), 1.2)
        self.assertEqual(
            cell_colors({"fg": "white", "bg": "17191e", "reverse": False}),
            ("#dedee7", "#17191e"),
        )
