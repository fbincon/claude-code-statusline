"""Independent formatting, bounded composition and source reuse."""

import unittest
from unittest.mock import patch
from claude_statusline.config import display, instances, formatting, advanced
from claude_statusline.rendering import items, preview, layout, subagents


class ComponentTests(unittest.TestCase):
    def test_repeated_formats_share_one_git_snapshot(self):
        cfg = display.DisplayConfig(items=("git-branch",), scope_labels="off")
        cfg, second = instances.edit(cfg, "main", "copy", "git-branch")
        cfg, _ = instances.edit(
            cfg, "main", "set", second, option="label", value="Again"
        )
        with patch(
            "claude_statusline.runtime.git.git_status",
            return_value={"kind": "ok", "branch": "main"},
        ) as collect:
            rows = items.configured_rows(
                {"workspace": {"current_dir": "/tmp"}}, cfg, 120
            )
        self.assertEqual(collect.call_count, 1)
        plain = layout.ANSI_SGR_RE.sub("", " ".join(rows))
        self.assertIn("Again", plain)
        self.assertEqual(plain.count("main"), 2)

    def test_same_metric_has_independent_number_formats(self):
        cfg = display.DisplayConfig(
            items=("input-tokens",), scope_labels="off", use_colors=False
        )
        cfg, second = instances.edit(cfg, "main", "copy", "input-tokens")
        cfg, _ = instances.edit(
            cfg, "main", "set", "input-tokens", option="number-format", value="full"
        )
        cfg, _ = instances.edit(
            cfg, "main", "set", second, option="number-format", value="compact"
        )
        rows = items.configured_rows(
            preview._sample_preview_data(), cfg, 120, preview._SampleRenderState
        )
        self.assertIn("1287500", rows[0])
        self.assertIn("1.29M", rows[0])

    def test_spacer_fits_both_scopes_styles_and_widths(self):
        cfg = display.DisplayConfig(items=("model",), scope_labels="off")
        cfg = advanced.edit_layout(cfg, "explicit")
        cfg, _ = instances.edit(cfg, "main", "add", type_id="spacer")
        cfg, text = instances.edit(
            cfg, "main", "add", type_id="text", text="右侧 👩🏽‍💻"
        )
        for scope in ("main", "subagent"):
            if scope == "subagent":
                cfg = cfg.with_updates(
                    subagents=display.SubagentDisplayConfig(items=("status", "name"))
                )
                cfg, _ = instances.edit(cfg, scope, "add", type_id="spacer")
                cfg, _ = instances.edit(cfg, scope, "add", type_id="elapsed")
            for width in (2, 5, 40, 80, 120):
                for style in ("classic", "powerline"):
                    current = cfg.with_updates(separator_style=style)
                    rows = (
                        items.configured_rows(
                            preview._sample_preview_data(),
                            current,
                            width,
                            preview._SampleRenderState,
                        )
                        if scope == "main"
                        else subagents.preview_rows(current, width)
                    )
                    for row in rows:
                        self.assertLessEqual(layout._display_width(row), width)
                    if scope == "main" and width >= 40:
                        self.assertEqual(layout._display_width(rows[0]), width)
                        self.assertTrue(
                            layout.ANSI_SGR_RE.sub("", rows[0])
                            .rstrip(" >")
                            .endswith("右侧 👩🏽‍💻")
                        )

    def test_text_only_and_empty_spacer_rows(self):
        cfg = display.DisplayConfig(items=(), layout=formatting.Layout("explicit", ()))
        cfg, space = instances.edit(cfg, "main", "add", type_id="spacer")
        self.assertEqual(items.configured_rows({}, cfg, 80), [])
        cfg, text = instances.edit(
            cfg, "main", "add", type_id="text", text="literal ${name}"
        )
        rows = items.configured_rows({}, cfg, 80)
        self.assertTrue(layout.ANSI_SGR_RE.sub("", rows[0]).endswith("literal ${name}"))
        cfg, _ = instances.edit(cfg, "main", "remove", text)
        self.assertEqual(items.configured_rows({}, cfg, 80), [])

    def test_repeated_timers_collect_one_raw_task_snapshot(self):
        cfg = display.DisplayConfig(
            items=("task-timer",), scope_labels="off", use_colors=False
        )
        cfg, second = instances.edit(cfg, "main", "copy", "task-timer")
        cfg, _ = instances.edit(
            cfg, "main", "set", second, option="label", value="Again"
        )
        with (
            patch(
                "claude_statusline.runtime.usage.session_token_totals",
                return_value=("0", "0", "0", None, {}),
            ) as totals,
            patch(
                "claude_statusline.runtime.tasks.collect.collect",
                return_value={"status": "completed"},
            ) as collect,
            patch(
                "claude_statusline.rendering.timer._state_elapsed_seconds",
                return_value=1,
            ),
        ):
            text = " ".join(
                items.configured_rows({"session_id": "s", "prompt_id": "p"}, cfg, 120)
            )
        self.assertEqual(collect.call_count, 1)
        self.assertEqual(totals.call_count, 1)
        self.assertEqual(text.count("0m 01s"), 2)
        self.assertIn("Again", text)

    def test_repeated_branch_diff_collects_once_and_agents_stay_separate(self):
        cfg = display.DisplayConfig(
            items=("branch-diff",), scope_labels="off", use_colors=False
        )
        cfg, _ = instances.edit(cfg, "main", "copy", "branch-diff")
        with patch(
            "claude_statusline.runtime.branch_diff.collect",
            return_value={
                "value": {"files": 1, "added": 3, "removed": 0},
                "reason": None,
            },
        ) as collect:
            items.configured_rows({"workspace": {"current_dir": "/tmp"}}, cfg, 120)
        self.assertEqual(collect.call_count, 1)
        cfg = cfg.with_updates(
            subagents=display.SubagentDisplayConfig(items=("tokens",))
        )
        cfg, second = instances.edit(cfg, "subagent", "copy", "tokens")
        cfg, _ = instances.edit(
            cfg, "subagent", "set", "tokens", option="number-format", value="full"
        )
        cfg, _ = instances.edit(
            cfg, "subagent", "set", second, option="number-format", value="compact"
        )
        rows = subagents.render_payload(
            {
                "columns": 120,
                "tasks": [
                    {"id": "a", "tokenCount": 1000},
                    {"id": "b", "tokenCount": 2000},
                ],
            },
            cfg,
            now_ms=0,
        )
        self.assertEqual([r["id"] for r in rows], ["a", "b"])
        self.assertIn("1000", rows[0]["content"])
        self.assertIn("1K", rows[0]["content"])
        self.assertIn("2000", rows[1]["content"])
        self.assertNotIn("1000", rows[1]["content"])
