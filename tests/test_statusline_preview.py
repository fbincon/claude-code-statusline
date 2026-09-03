"""Tests for deterministic sample-data status line previews."""

import tempfile
import unittest
from pathlib import Path
from unittest import mock

from claude_statusline import display_config as dc
from claude_statusline import statusline as sl


def plain_rows(config, width=500, padding=0):
    return [
        sl.ANSI_SGR_RE.sub("", row)
        for row in sl.render_preview_rows(config, width, padding)
    ]


class PreviewContentTests(unittest.TestCase):
    def test_all_catalog_items_have_fixed_sample_values_in_draft_order(self):
        config = dc.DEFAULT_CONFIG.with_updates(
            items=tuple(dc.ITEM_CATALOG), use_colors=False
        )
        rendered = "\n".join(plain_rows(config, width=600))
        expected = (
            "Main/Session | claude-opus high · fast · thinking | "
            f"{Path.home()}/projects/claude-code-statusline/src · "
            "Project claude-code-statusline · Host devbox | "
            "Git feature/statusline-tui ↑1 ~2 ?1 · PR #42 · approved · "
            "Repo example/claude-code-statusline | Worktree statusline-tui | "
            "Context 73% left · Context 27% used · 200K window | "
            "5h 82% left · weekly 64% left · spend 91% left | "
            "hit 1.2M · miss 87.5K · out 22.4K · cache 91% · 352K w | "
            "✓ 1m 42s | v2.1.258 | Session demo-session | "
            "Total $0.12 · 12m 30s · +156/-23 | Agent reviewer | vim NORMAL"
        )
        self.assertEqual(rendered, expected)
        palette = sl.NO_COLOR_PALETTE
        state = sl._SampleRenderState(
            sl._sample_preview_data(), config, palette, " · "
        )
        self.assertEqual(
            sum(state.render(item) is not None for item in dc.ITEM_CATALOG), 24
        )

    def test_toggle_order_separator_directory_padding_and_width_change_preview(self):
        base = dc.DEFAULT_CONFIG.with_updates(
            items=("model-with-effort", "current-dir", "git"), use_colors=False
        )
        initial = plain_rows(base)
        toggled = plain_rows(base.with_updates(items=("git", "current-dir")))
        reordered = plain_rows(
            base.with_updates(items=("git", "current-dir", "model-with-effort"))
        )
        compact = plain_rows(base.with_updates(separator_style="compact"))
        home = plain_rows(base.with_updates(directory_style="home"))
        relative = plain_rows(base.with_updates(directory_style="project-relative"))
        basename = plain_rows(base.with_updates(directory_style="basename"))
        padded = plain_rows(base, padding=4)
        narrow = plain_rows(base, width=24)

        self.assertNotEqual(initial, toggled)
        self.assertTrue(reordered[0].startswith("Main/Session"))
        self.assertIn("Git feature/statusline-tui", "\n".join(reordered))
        self.assertIn(" · ", compact[0])
        self.assertIn("~/projects/claude-code-statusline/src", home[0])
        self.assertIn("src", relative[0])
        self.assertIn("src", basename[0])
        self.assertTrue(all(row.startswith("    ") for row in padded))
        self.assertGreater(len(narrow), len(initial))
        self.assertTrue(all(sl._display_width(row) <= 24 for row in narrow))

    def test_colors_palette_and_empty_items(self):
        colored = dc.DEFAULT_CONFIG.with_updates(items=("model-with-effort",))
        ansi = colored.with_updates(palette="ansi")
        plain = colored.with_updates(use_colors=False)
        default_row = sl.render_preview_rows(colored, 80)[0]
        ansi_row = sl.render_preview_rows(ansi, 80)[0]
        plain_row = sl.render_preview_rows(plain, 80)[0]
        self.assertIn("38;2", default_row)
        self.assertIn("\033[1;33m", ansi_row)
        self.assertNotRegex(plain_row, sl.ANSI_SGR_RE)
        self.assertEqual(
            sl.render_preview_rows(plain.with_updates(items=()), 80), []
        )

    def test_preview_never_calls_live_or_persistent_sources(self):
        config = dc.DEFAULT_CONFIG.with_updates(items=tuple(dc.ITEM_CATALOG))
        with tempfile.TemporaryDirectory(prefix="statusline-preview-") as directory:
            root = Path(directory)
            with (
                mock.patch.object(sl, "git_status") as git_status,
                mock.patch.object(sl, "session_token_totals") as token_totals,
                mock.patch.object(sl, "_timer_segment") as timer,
                mock.patch.object(sl, "_save_state") as save_state,
                mock.patch.object(sl, "_write_git_cache") as write_git_cache,
                mock.patch.object(sl.subprocess, "run") as subprocess_run,
                mock.patch.object(sl.socket, "gethostname") as gethostname,
            ):
                rows = sl.render_preview_rows(config, 80)
            self.assertTrue(rows)
            git_status.assert_not_called()
            token_totals.assert_not_called()
            timer.assert_not_called()
            save_state.assert_not_called()
            write_git_cache.assert_not_called()
            subprocess_run.assert_not_called()
            gethostname.assert_not_called()
            self.assertEqual(list(root.iterdir()), [])


if __name__ == "__main__":
    unittest.main(verbosity=2)
