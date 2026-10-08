"""Capture rendering and acceptance share foreground/background resolution."""

import unittest

from tools.terminal_colors import cell_colors, contrast


class TerminalColorTests(unittest.TestCase):
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
        self.assertEqual(cell_colors({"fg": "white", "bg": "17191e", "reverse": False}), ("#dedee7", "#17191e"))
