"""Tests for the official Claude Code subagentStatusLine renderer."""

import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from claude_statusline import display_config as dc
from claude_statusline import subagent_statusline as ss
from claude_statusline.render_utils import ANSI_SGR_RE, display_width


NOW_MS = 1_788_400_078_000


def plain_config(**updates):
    return dc.DEFAULT_CONFIG.with_updates(use_colors=False, **updates)


def sample_task(**updates):
    task = {
        "id": "task-1",
        "name": "Explore",
        "type": "local_agent",
        "status": "running",
        "description": "searching auth flow",
        "label": "searching auth flow",
        "startTime": 1_788_400_000_000,
        "model": "claude-sonnet-5",
        "effort": "high",
        "contextWindowSize": 200_000,
        "tokenCount": 84_000,
        "cwd": "/project",
    }
    task.update(updates)
    return task


class RendererTests(unittest.TestCase):
    def test_default_exact_output_and_task_order(self):
        data = {
            "columns": 100,
            "tasks": [sample_task(), sample_task(id="task-2", name="Review")],
        }
        self.assertEqual(
            ss.render_payload(data, plain_config(), now_ms=NOW_MS),
            [
                {
                    "id": "task-1",
                    "content": (
                        "⏱ 1m 18s · Explore · sonnet-5/high · "
                        "Context 58% left · searching auth flow"
                    ),
                },
                {
                    "id": "task-2",
                    "content": (
                        "⏱ 1m 18s · Review · sonnet-5/high · "
                        "Context 58% left · searching auth flow"
                    ),
                },
            ],
        )

    def test_all_statuses_and_unknown(self):
        statuses = {
            "pending": "…",
            "running": "⏱",
            "completed": "✓",
            "failed": "✗",
            "killed": "■",
            "paused": "⏳",
            "waiting": "⏳",
            "new-state": "?",
        }
        config = plain_config(
            subagents=dc.SubagentDisplayConfig(items=("status",))
        )
        for status, marker in statuses.items():
            with self.subTest(status=status):
                task = sample_task(status=status)
                self.assertEqual(
                    ss.render_payload(
                        {"tasks": [task]}, config, now_ms=NOW_MS
                    )[0]["content"],
                    marker,
                )

    def test_status_elapsed_combined_and_icon_only_fallback(self):
        config = plain_config(
            subagents=dc.SubagentDisplayConfig(items=("status-elapsed",))
        )
        self.assertEqual(
            ss.render_task(sample_task(), config, now_ms=NOW_MS),
            "⏱ 1m 18s",
        )
        self.assertEqual(
            ss.render_task(sample_task(startTime=None), config, now_ms=NOW_MS),
            "⏱",
        )
        self.assertEqual(
            ss.render_task(sample_task(startTime="yesterday"), config, now_ms=NOW_MS),
            "⏱",
        )
        self.assertEqual(
            ss.render_task(
                sample_task(startTime=NOW_MS + 1000), config, now_ms=NOW_MS
            ),
            "⏱ 0m 00s",
        )

    def test_status_elapsed_icons_for_each_status(self):
        statuses = {
            "pending": "…",
            "running": "⏱",
            "completed": "✓",
            "failed": "✗",
            "killed": "■",
            "paused": "⏳",
            "waiting": "⏳",
            "new-state": "?",
        }
        config = plain_config(
            subagents=dc.SubagentDisplayConfig(items=("status-elapsed",))
        )
        for status, marker in statuses.items():
            with self.subTest(status=status):
                self.assertEqual(
                    ss.render_task(
                        sample_task(status=status), config, now_ms=NOW_MS
                    ),
                    f"{marker} 1m 18s",
                )

    def test_status_elapsed_colors_match_status_and_elapsed(self):
        config = dc.DEFAULT_CONFIG.with_updates(
            subagents=dc.SubagentDisplayConfig(items=("status-elapsed",))
        )
        self.assertEqual(
            ss.render_task(sample_task(), config, now_ms=NOW_MS),
            "\033[1;38;2;142;211;211m⏱ 1m 18s\033[0m",
        )
        ansi = config.with_updates(palette="ansi")
        self.assertEqual(
            ss.render_task(sample_task(), ansi, now_ms=NOW_MS),
            "\033[1;36m⏱ 1m 18s\033[0m",
        )

    def test_model_effort_context_elapsed_tokens_and_directory(self):
        config = plain_config(
            directory_style="basename",
            subagents=dc.SubagentDisplayConfig(
                items=(
                    "model-with-effort",
                    "context-used",
                    "elapsed",
                    "tokens",
                    "current-dir",
                )
            ),
        )
        task = sample_task(effort=7, startTime=NOW_MS + 1000)
        self.assertEqual(
            ss.render_task(task, config, columns=100, now_ms=NOW_MS),
            "sonnet-5/7 · Context 42% used · 0m 00s · 84K tokens · project",
        )
        task["effort"] = None
        self.assertTrue(
            ss.render_task(task, config, columns=100, now_ms=NOW_MS).startswith(
                "sonnet-5 ·"
            )
        )

    def test_context_remaining_rounding_and_format(self):
        config = plain_config(
            subagents=dc.SubagentDisplayConfig(items=("context-remaining",))
        )
        for token_count, window, expected in (
            (84_000, 200_000, "Context 58% left"),
            (18_500, 200_000, "Context 91% left"),
            (83_000, 200_000, "Context 58% left"),   # 41.5 -> used 42 -> left 58
            (0, 200_000, "Context 100% left"),
            (200_000, 200_000, "Context 0% left"),
        ):
            with self.subTest(token_count=token_count, window=window):
                task = sample_task(tokenCount=token_count, contextWindowSize=window)
                self.assertEqual(
                    ss.render_task(task, config, now_ms=NOW_MS), expected
                )

    def test_context_remaining_clamps_at_zero_over_window(self):
        config = plain_config(
            subagents=dc.SubagentDisplayConfig(items=("context-remaining",))
        )
        task = sample_task(tokenCount=400_000, contextWindowSize=200_000)
        self.assertEqual(
            ss.render_task(task, config, now_ms=NOW_MS), "Context 0% left"
        )

    def test_context_remaining_missing_fields_omitted(self):
        config = plain_config(
            subagents=dc.SubagentDisplayConfig(items=("context-remaining",))
        )
        self.assertEqual(
            ss.render_task(
                sample_task(contextWindowSize=None), config, now_ms=NOW_MS
            ),
            "",
        )
        self.assertEqual(
            ss.render_task(sample_task(tokenCount=None), config, now_ms=NOW_MS),
            "",
        )

    def test_context_remaining_invalid_values_omitted(self):
        config = plain_config(
            subagents=dc.SubagentDisplayConfig(items=("context-remaining",))
        )
        for token_count, window in (
            (-1, 200_000),
            ("84", 200_000),
            (True, 200_000),
            (float("nan"), 200_000),
            (float("inf"), 200_000),
            (10**1000, 200_000),
            (84_000, 0),
            (84_000, "200000"),
            (84_000, False),
            (None, 200_000),
            (84_000, None),
        ):
            with self.subTest(token_count=token_count, window=window):
                task = sample_task(tokenCount=token_count, contextWindowSize=window)
                self.assertEqual(
                    ss.render_task(task, config, now_ms=NOW_MS), ""
                )

    def test_context_used_renders_full_label(self):
        config = plain_config(
            subagents=dc.SubagentDisplayConfig(items=("context-used",))
        )
        self.assertEqual(
            ss.render_task(sample_task(), config, now_ms=NOW_MS),
            "Context 42% used",
        )

    def test_context_remaining_default_and_preview(self):
        content = ss.render_task(sample_task(), plain_config(), now_ms=NOW_MS)
        self.assertIn("Context 58% left", content)
        rows = ss.preview_rows(plain_config(), 100)
        self.assertIn("Context 58% left", rows[0])
        self.assertIn("Context 91% left", rows[1])

    def test_invalid_optional_fields_are_omitted(self):
        task = sample_task(
            model={"broken": True},
            effort=float("nan"),
            tokenCount=-1,
            contextWindowSize=0,
            startTime="yesterday",
            cwd=["not", "a", "path"],
        )
        config = plain_config(
            subagents=dc.SubagentDisplayConfig(
                items=tuple(
                    item for item in dc.SUBAGENT_ITEM_CATALOG
                    if item not in ("status", "elapsed")
                )
            )
        )
        self.assertEqual(
            ss.render_task(task, config, columns=100, now_ms=NOW_MS),
            "⏱ · Explore · searching auth flow",
        )

    def test_name_type_and_task_fallbacks(self):
        config = plain_config(
            subagents=dc.SubagentDisplayConfig(items=("name", "task"))
        )
        self.assertEqual(
            ss.render_task(
                sample_task(name=None, label=None, description="Local Agent"),
                config,
                now_ms=NOW_MS,
            ),
            "Local Agent",
        )
        self.assertEqual(
            ss.render_task(
                sample_task(name=None, type=None, label=None, description=None),
                config,
                now_ms=NOW_MS,
            ),
            "Agent",
        )

    def test_duplicate_and_invalid_ids_are_skipped(self):
        tasks = [
            sample_task(id="a"),
            sample_task(id="a", name="duplicate"),
            sample_task(id=""),
            sample_task(id=7),
            {"id": "b", "status": "completed"},
            "broken",
        ]
        result = ss.render_payload(
            {"columns": "bad", "tasks": tasks}, plain_config(), now_ms=NOW_MS
        )
        self.assertEqual([item["id"] for item in result], ["a", "b"])

    def test_empty_items_or_disabled_rows_emit_empty_content_per_id(self):
        for subagents in (
            dc.SubagentDisplayConfig(items=()),
            dc.SubagentDisplayConfig(enabled=False),
        ):
            with self.subTest(subagents=subagents):
                result = ss.render_payload(
                    {"tasks": [sample_task()]},
                    plain_config(subagents=subagents),
                    now_ms=NOW_MS,
                )
                self.assertEqual(result, [{"id": "task-1", "content": ""}])

    def test_preview_is_deterministic_running_and_completed_data(self):
        rows = ss.preview_rows(plain_config(), 100)
        self.assertEqual(len(rows), 2)
        self.assertTrue(rows[0].startswith("⏱ 1m 18s"))
        self.assertTrue(rows[1].startswith("✓ 0m 42s"))
        self.assertEqual(rows, ss.preview_rows(plain_config(), 100))


class WidthAndSanitizationTests(unittest.TestCase):
    def test_every_path_is_single_line_and_within_columns(self):
        task = sample_task(
            name="探索器👩🏽‍💻e\u0301" * 5,
            label="第一行\n第二行\t\033[31m注入" * 8,
            cwd="/项目/" + "很长目录/" * 10,
        )
        config = dc.DEFAULT_CONFIG.with_updates(
            subagents=dc.SubagentDisplayConfig(
                items=tuple(
                    item for item in dc.SUBAGENT_ITEM_CATALOG
                    if item not in ("status", "elapsed")
                )
            )
        )
        for columns in (100, 50, 30, 20, 10, 5, 2, 1):
            with self.subTest(columns=columns):
                content = ss.render_payload(
                    {"columns": columns, "tasks": [task]},
                    config,
                    now_ms=NOW_MS,
                )[0]["content"]
                self.assertLessEqual(display_width(content), columns)
                self.assertNotIn("\n", content)
                self.assertNotIn("\r", content)
                self.assertNotIn("\t", content)
                self.assertNotIn("\033[31m", content)
                if ANSI_SGR_RE.search(content):
                    self.assertTrue(content.endswith("\033[0m"))

    def test_optional_drop_priority_and_core_fallback(self):
        task = sample_task(label="x" * 200)
        config = plain_config(
            subagents=dc.SubagentDisplayConfig(
                items=(
                    "status",
                    "name",
                    "current-dir",
                    "tokens",
                    "context-used",
                    "model-with-effort",
                    "elapsed",
                    "task",
                )
            )
        )
        content = ss.render_task(task, config, columns=30, now_ms=NOW_MS)
        self.assertIn("⏱ Explore", content)
        self.assertIn("1m 18s", content)
        self.assertNotIn("/project", content)
        self.assertEqual(
            ss.render_task(task, config, columns=1, now_ms=NOW_MS), "⏱"
        )

    def test_status_elapsed_core_item_survives_narrow_widths(self):
        task = sample_task(label="x" * 200)
        config = plain_config(
            subagents=dc.SubagentDisplayConfig(
                items=(
                    "status-elapsed",
                    "name",
                    "current-dir",
                    "tokens",
                    "context-used",
                    "model-with-effort",
                    "task",
                )
            )
        )
        content = ss.render_task(task, config, columns=12, now_ms=NOW_MS)
        self.assertIn("⏱ 1m 18s", content)
        self.assertLessEqual(display_width(content), 12)
        self.assertEqual(
            ss.render_task(task, config, columns=1, now_ms=NOW_MS), "⏱"
        )


class SubprocessTests(unittest.TestCase):
    def run_renderer(self, payload, config_bytes=None):
        with tempfile.TemporaryDirectory(prefix="subagent-render-") as directory:
            root = Path(directory)
            if config_bytes is not None:
                dc.config_path(root).write_bytes(config_bytes)
            env = os.environ.copy()
            env["CLAUDE_CONFIG_DIR"] = str(root)
            env["PYTHONPATH"] = str(Path(__file__).parents[1] / "src")
            return subprocess.run(
                [sys.executable, "-m", "claude_statusline", "render-subagents"],
                input=payload,
                text=True,
                capture_output=True,
                encoding="utf-8",
                env=env,
                check=False,
            )

    def test_ndjson_utf8_corrupt_config_fallback_and_invalid_input(self):
        payload = json.dumps(
            {"columns": 80, "tasks": [sample_task(id="中文-id")]},
            ensure_ascii=False,
        )
        result = self.run_renderer(payload, b"{broken")
        self.assertEqual(result.returncode, 0)
        self.assertEqual(result.stderr, "")
        lines = result.stdout.splitlines()
        self.assertEqual(len(lines), 1)
        parsed = json.loads(lines[0])
        self.assertEqual(parsed["id"], "中文-id")
        for invalid in ("{broken", "[]", '{"tasks":{}}'):
            with self.subTest(invalid=invalid):
                result = self.run_renderer(invalid)
                self.assertEqual(result.returncode, 0)
                self.assertEqual(result.stdout, "")

    def test_hot_path_does_not_import_heavy_or_stateful_modules(self):
        script = r'''
import io, json, sys
from claude_statusline import cli
sys.stdin = io.TextIOWrapper(io.BytesIO(b'{"tasks":[]}'), encoding="utf-8")
cli.main(["render-subagents"])
forbidden = [
    "curses", "claude_statusline.installer", "claude_statusline.slash_tui",
    "claude_statusline.statusline", "claude_statusline.turn_state",
]
print(json.dumps([name for name in forbidden if name in sys.modules]), file=sys.stderr)
'''
        env = os.environ.copy()
        env["PYTHONPATH"] = str(Path(__file__).parents[1] / "src")
        result = subprocess.run(
            [sys.executable, "-c", script],
            text=True,
            capture_output=True,
            encoding="utf-8",
            env=env,
            check=False,
        )
        self.assertEqual(result.returncode, 0)
        self.assertEqual(result.stdout, "")
        self.assertEqual(json.loads(result.stderr), [])


if __name__ == "__main__":
    unittest.main(verbosity=2)
