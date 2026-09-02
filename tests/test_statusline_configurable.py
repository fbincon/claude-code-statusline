"""Tests for configurable status line items, ordering, and presentation."""

import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from claude_statusline import display_config as dc
from claude_statusline import statusline as sl


def plain(text):
    return sl.ANSI_SGR_RE.sub("", text)


def configured_text(data, config, width=500):
    segments, separator, reset = sl._configured_segments(data, config)
    rows = sl._layout_segments(segments, width, separator=separator, reset=reset)
    return "\n".join(plain(row) for row in rows)


class ConfiguredRenderingTests(unittest.TestCase):
    def base_data(self):
        return {
            "model": {"id": "test-model"},
            "effort": {"level": "high"},
            "session_id": "session-1",
            "prompt_id": "prompt-1",
            "workspace": {
                "current_dir": "/code/repo",
                "project_dir": "/code/repo",
            },
            "context_window": {
                "remaining_percentage": 75,
                "context_window_size": 1000,
            },
            "rate_limits": {
                "five_hour": {"used_percentage": 20},
                "seven_day": {"used_percentage": 40},
                "spend_limit": {"used_percentage": 60},
            },
        }

    def test_renderer_registry_covers_every_configurable_item(self):
        self.assertEqual(
            set(dc.ITEM_CATALOG), set(sl._ITEM_METHODS) | set(sl._RATE_LIMIT_ITEMS)
        )

    def test_default_order_and_adjacent_groups_preserve_legacy_layout(self):
        with (
            mock.patch.object(
                sl,
                "git_status",
                return_value={
                    "kind": "ok",
                    "branch": "main",
                    "upstream_gone": False,
                    "ahead": 0,
                    "behind": 0,
                    "staged": 0,
                    "unstaged": 0,
                    "conflicts": 0,
                    "untracked": 0,
                },
            ),
            mock.patch.object(
                sl,
                "session_token_totals",
                return_value=("10", "20", "5", 1.0, {}),
            ),
            mock.patch.object(sl, "_timer_segment", return_value="timer"),
        ):
            rendered = configured_text(self.base_data(), dc.DEFAULT_CONFIG)
        self.assertEqual(
            rendered,
            "test-model high | /code/repo | Git main | "
            "Context 75% left · 1K window | "
            "5h 80% left · weekly 60% left · spend 40% left | "
            "hit 10 · miss 20 · out 5 | timer",
        )

    def test_items_can_be_selected_and_reordered(self):
        config = dc.DEFAULT_CONFIG.with_updates(
            items=("weekly-limit", "model-with-effort", "context-window-size")
        )
        self.assertEqual(
            configured_text(self.base_data(), config),
            "weekly 60% left | test-model high | 1K window",
        )

    def test_compact_no_color_has_no_ansi_and_uses_dots(self):
        config = dc.DEFAULT_CONFIG.with_updates(
            items=("model-with-effort", "context-remaining", "context-window-size"),
            use_colors=False,
            separator_style="compact",
        )
        segments, separator, reset = sl._configured_segments(self.base_data(), config)
        rendered = "\n".join(
            sl._layout_segments(segments, 200, separator=separator, reset=reset)
        )
        self.assertNotRegex(rendered, sl.ANSI_SGR_RE)
        self.assertEqual(rendered, "test-model high · Context 75% left · 1K window")

    def test_ansi_palette_uses_standard_codes(self):
        config = dc.DEFAULT_CONFIG.with_updates(
            items=("model-with-effort",), palette="ansi"
        )
        segments, _separator, _reset = sl._configured_segments(self.base_data(), config)
        self.assertTrue(segments[0].text.startswith("\033[1;33m"))
        self.assertNotIn("38;2", segments[0].text)

    def test_unselected_expensive_sources_are_not_loaded(self):
        config = dc.DEFAULT_CONFIG.with_updates(items=("model-with-effort",))
        with (
            mock.patch.object(sl, "git_status") as git_status,
            mock.patch.object(sl, "session_token_totals") as token_totals,
        ):
            self.assertEqual(
                configured_text(self.base_data(), config), "test-model high"
            )
        git_status.assert_not_called()
        token_totals.assert_not_called()

    def test_timer_loads_totals_even_when_tokens_are_hidden(self):
        config = dc.DEFAULT_CONFIG.with_updates(items=("prompt-timer",))
        with (
            mock.patch.object(
                sl,
                "session_token_totals",
                return_value=("1", "2", "3", 4.0, {"entry": True}),
            ) as token_totals,
            mock.patch.object(sl, "_timer_segment", return_value="elapsed") as timer,
        ):
            self.assertEqual(configured_text(self.base_data(), config), "elapsed")
        token_totals.assert_called_once()
        timer.assert_called_once()

    def test_project_relative_directory(self):
        config = dc.DEFAULT_CONFIG.with_updates(
            items=("current-dir",), directory_style="project-relative"
        )
        data = self.base_data()
        data["workspace"]["current_dir"] = "/code/repo/src/pkg"
        self.assertEqual(configured_text(data, config), "src/pkg")


class ConfiguredSubprocessTests(unittest.TestCase):
    def run_render(self, config_content, payload):
        with tempfile.TemporaryDirectory(
            prefix="statusline-render-config-"
        ) as directory:
            root = Path(directory)
            if isinstance(config_content, dict):
                dc.config_path(root).write_text(
                    json.dumps(config_content) + "\n", encoding="utf-8"
                )
            elif isinstance(config_content, str):
                dc.config_path(root).write_text(config_content, encoding="utf-8")
            env = os.environ.copy()
            env["CLAUDE_CONFIG_DIR"] = str(root)
            env["CLAUDE_STATUSLINE_RUNTIME_DIR"] = str(root / "runtime")
            return subprocess.run(
                [sys.executable, "-m", "claude_statusline", "render"],
                input=json.dumps(payload),
                text=True,
                capture_output=True,
                encoding="utf-8",
                env=env,
                check=False,
            )

    def test_empty_items_emit_no_blank_line(self):
        config = dc.DEFAULT_CONFIG.with_updates(items=()).to_dict()
        result = self.run_render(config, {"model": {"id": "model"}})
        self.assertEqual(result.returncode, 0)
        self.assertEqual(result.stdout, "")

    def test_invalid_config_silently_falls_back_to_defaults(self):
        result = self.run_render("{broken", {"model": {"id": "model"}})
        self.assertEqual(result.returncode, 0)
        self.assertEqual(plain(result.stdout).strip(), "model")
        self.assertEqual(result.stderr, "")


if __name__ == "__main__":
    unittest.main(verbosity=2)
