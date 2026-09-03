"""Tests for the opt-in display items added in 0.3.0."""

import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from claude_statusline import config_commands as cc
from claude_statusline import display_config as dc
from claude_statusline import statusline as sl

NEW_ITEM_IDS = (
    "project-name",
    "hostname",
    "context-used",
    "version",
    "session",
    "cost",
    "prompt-cache",
    "fast-mode",
    "agent",
    "vim-mode",
    "thinking",
    "pr",
    "worktree",
    "repo",
)


def plain(text):
    return sl.ANSI_SGR_RE.sub("", text)


def configured_text(data, config, width=500):
    segments, separator, reset = sl._configured_segments(data, config)
    rows = sl._layout_segments(segments, width, separator=separator, reset=reset)
    return "\n".join(plain(row) for row in rows)


class NewItemCatalogTests(unittest.TestCase):
    def test_default_items_are_exactly_the_legacy_ten(self):
        self.assertEqual(
            dc.DEFAULT_ITEMS,
            (
                "model-with-effort",
                "current-dir",
                "git",
                "context-remaining",
                "context-window-size",
                "five-hour-limit",
                "weekly-limit",
                "spend-limit",
                "tokens",
                "prompt-timer",
            ),
        )
        self.assertEqual(dc.LEGACY_DEFAULT_ITEMS, dc.DEFAULT_ITEMS)
        self.assertLess(set(dc.DEFAULT_ITEMS), set(dc.ITEM_CATALOG))

    def test_catalog_order_keeps_same_group_items_adjacent(self):
        self.assertEqual(
            list(dc.ITEM_CATALOG),
            [
                "model-with-effort",
                "fast-mode",
                "thinking",
                "current-dir",
                "project-name",
                "hostname",
                "git",
                "pr",
                "repo",
                "worktree",
                "context-remaining",
                "context-used",
                "context-window-size",
                "five-hour-limit",
                "weekly-limit",
                "spend-limit",
                "tokens",
                "prompt-cache",
                "prompt-timer",
                "version",
                "session",
                "cost",
                "agent",
                "vim-mode",
            ],
        )

    def test_subagent_catalog_and_defaults_are_unchanged(self):
        self.assertEqual(
            list(dc.SUBAGENT_ITEM_CATALOG),
            [
                "status",
                "name",
                "model-with-effort",
                "context-used",
                "elapsed",
                "task",
                "tokens",
                "current-dir",
            ],
        )
        self.assertEqual(
            dc.DEFAULT_SUBAGENT_ITEMS,
            (
                "status",
                "name",
                "model-with-effort",
                "context-used",
                "elapsed",
                "task",
            ),
        )


class NewItemRenderingTests(unittest.TestCase):
    def render_items(self, data, *items):
        config = dc.DEFAULT_CONFIG.with_updates(items=tuple(items))
        return configured_text(data, config)

    def test_all_new_items_hidden_without_payload_fields(self):
        with mock.patch.object(sl.socket, "gethostname", return_value=""):
            self.assertEqual(self.render_items({}, *NEW_ITEM_IDS), "")

    def test_context_used_rounding(self):
        for value, expected in (
            (27, "Context 27% used"),
            (27.4, "Context 27% used"),
            (27.6, "Context 28% used"),
            (0, "Context 0% used"),
            (100, "Context 100% used"),
        ):
            with self.subTest(value=value):
                self.assertEqual(
                    self.render_items(
                        {"context_window": {"used_percentage": value}},
                        "context-used",
                    ),
                    expected,
                )

    def test_context_used_rejects_invalid_values(self):
        invalid = (
            None,
            True,
            False,
            "27",
            float("nan"),
            float("inf"),
            float("-inf"),
            -0.1,
            100.1,
            10**1000,
        )
        for value in invalid:
            with self.subTest(value=value):
                self.assertEqual(
                    self.render_items(
                        {"context_window": {"used_percentage": value}},
                        "context-used",
                    ),
                    "",
                )

    def test_context_items_coexist_in_configured_order(self):
        data = {
            "context_window": {
                "remaining_percentage": 73,
                "used_percentage": 27,
                "context_window_size": 200_000,
            }
        }
        self.assertEqual(
            self.render_items(
                data,
                "context-remaining",
                "context-used",
                "context-window-size",
            ),
            "Context 73% left · Context 27% used · 200K window",
        )

    def test_project_name_uses_posix_basename(self):
        for value, expected in (
            ("/code/repo", "Project repo"),
            ("/code/repo/", "Project repo"),
            ("/code/项目", "Project 项目"),
        ):
            with self.subTest(value=value):
                self.assertEqual(
                    self.render_items(
                        {"workspace": {"project_dir": value}}, "project-name"
                    ),
                    expected,
                )

    def test_project_name_rejects_invalid_values_without_fallback(self):
        for value in (None, 7, "", "/", "///"):
            data = {
                "workspace": {
                    "current_dir": "/fallback/current",
                    "project_dir": value,
                    "repo": {"owner": "fallback", "name": "repo"},
                }
            }
            with self.subTest(value=value):
                self.assertEqual(self.render_items(data, "project-name"), "")

    def test_project_name_sanitizes_payload_without_filesystem_access(self):
        data = {"workspace": {"project_dir": "/code/\033[31mproject\nname"}}
        with (
            mock.patch.object(Path, "exists", side_effect=AssertionError),
            mock.patch.object(Path, "is_dir", side_effect=AssertionError),
            mock.patch.object(Path, "stat", side_effect=AssertionError),
        ):
            rendered = self.render_items(data, "project-name")
        self.assertEqual(rendered, "Project [31mproject name")
        self.assertNotIn("\033", rendered)
        self.assertNotIn("\n", rendered)

    def test_hostname_renders_sanitizes_and_handles_failures(self):
        for value, expected in (
            ("devbox", "Host devbox"),
            ("", ""),
            ("dev\nbox\033[31m", "Host dev box [31m"),
            (None, ""),
        ):
            with (
                self.subTest(value=value),
                mock.patch.object(sl.socket, "gethostname", return_value=value),
            ):
                rendered = self.render_items({}, "hostname")
                self.assertEqual(rendered, expected)
                self.assertNotIn("\033", rendered)
                self.assertNotIn("\n", rendered)
        with mock.patch.object(
            sl.socket, "gethostname", side_effect=OSError("unavailable")
        ):
            self.assertEqual(self.render_items({}, "hostname"), "")

    def test_hostname_is_not_loaded_when_unselected(self):
        with mock.patch.object(sl.socket, "gethostname") as gethostname:
            self.assertEqual(
                self.render_items(
                    {"model": {"id": "test-model"}}, "model-with-effort"
                ),
                "test-model",
            )
        gethostname.assert_not_called()

    def test_location_items_coalesce_when_adjacent(self):
        data = {
            "workspace": {
                "current_dir": "/code/repo/src",
                "project_dir": "/code/repo",
            }
        }
        with mock.patch.object(sl.socket, "gethostname", return_value="devbox"):
            self.assertEqual(
                self.render_items(
                    data, "current-dir", "project-name", "hostname"
                ),
                "/code/repo/src · Project repo · Host devbox",
            )

    def test_version_item(self):
        self.assertEqual(
            self.render_items({"version": "2.1.258"}, "version"), "v2.1.258"
        )
        self.assertEqual(self.render_items({"version": ""}, "version"), "")
        self.assertEqual(self.render_items({"version": 7}, "version"), "")

    def test_session_prefers_name_then_id_prefix(self):
        data = {"session_id": "abcdefghijkl", "session_name": "Refactor"}
        self.assertEqual(self.render_items(data, "session"), "Session Refactor")
        self.assertEqual(
            self.render_items({"session_id": "abcdefghijkl"}, "session"),
            "Session abcdefgh",
        )
        self.assertEqual(
            self.render_items({"session_id": "abc"}, "session"), "Session abc"
        )
        self.assertEqual(
            self.render_items(
                {"session_id": "abcdefgh", "session_name": ""}, "session"
            ),
            "Session abcdefgh",
        )
        self.assertEqual(self.render_items({"session_id": ""}, "session"), "")

    def test_cost_item_full(self):
        data = {
            "cost": {
                "total_cost_usd": 0.12,
                "total_duration_ms": 750000,
                "total_lines_added": 156,
                "total_lines_removed": 23,
            }
        }
        self.assertEqual(
            self.render_items(data, "cost"), "Total $0.12 · 12m 30s · +156/-23"
        )

    def test_cost_item_omits_zero_parts(self):
        data = {
            "cost": {
                "total_cost_usd": 0,
                "total_duration_ms": 0,
                "total_lines_added": 0,
                "total_lines_removed": 0,
            }
        }
        self.assertEqual(self.render_items(data, "cost"), "Total $0.00")
        self.assertEqual(
            self.render_items({"cost": {"total_cost_usd": True}}, "cost"), ""
        )
        self.assertEqual(
            self.render_items({"cost": {"total_cost_usd": "nope"}}, "cost"), ""
        )
        self.assertEqual(self.render_items({}, "cost"), "")

    def test_prompt_cache_item(self):
        data = {"prompt_cache": {"hit_ratio": 0.91, "cache_write_tokens": 352000}}
        self.assertEqual(
            self.render_items(data, "prompt-cache"), "cache 91% · 352K w"
        )
        self.assertEqual(
            self.render_items(
                {"prompt_cache": {"hit_ratio": 1.5, "cache_write_tokens": 352000}},
                "prompt-cache",
            ),
            "352K w",
        )
        self.assertEqual(
            self.render_items(
                {"prompt_cache": {"hit_ratio": 0.91, "cache_write_tokens": 0}},
                "prompt-cache",
            ),
            "cache 91%",
        )
        self.assertEqual(self.render_items({}, "prompt-cache"), "")

    def test_fast_mode_item(self):
        self.assertEqual(self.render_items({"fast_mode": True}, "fast-mode"), "fast")
        self.assertEqual(self.render_items({"fast_mode": False}, "fast-mode"), "")
        self.assertEqual(self.render_items({}, "fast-mode"), "")

    def test_agent_item(self):
        self.assertEqual(
            self.render_items({"agent": {"name": "orchestrator"}}, "agent"),
            "Agent orchestrator",
        )
        self.assertEqual(self.render_items({"agent": {"name": ""}}, "agent"), "")
        self.assertEqual(self.render_items({}, "agent"), "")

    def test_vim_mode_item(self):
        self.assertEqual(
            self.render_items({"vim": {"mode": "NORMAL"}}, "vim-mode"), "vim NORMAL"
        )
        self.assertEqual(self.render_items({"vim": {"mode": ""}}, "vim-mode"), "")
        self.assertEqual(self.render_items({}, "vim-mode"), "")

    def test_thinking_item(self):
        self.assertEqual(
            self.render_items({"thinking": {"enabled": True}}, "thinking"),
            "thinking",
        )
        self.assertEqual(
            self.render_items({"thinking": {"enabled": False}}, "thinking"), ""
        )
        self.assertEqual(self.render_items({}, "thinking"), "")

    def test_pr_item(self):
        data = {
            "pr": {
                "number": 1234,
                "url": "https://github.com/acme/widget/pull/1234",
                "review_state": "approved",
            }
        }
        self.assertEqual(self.render_items(data, "pr"), "PR #1234 · approved")
        data["pr"]["kind"] = "mr"
        self.assertEqual(self.render_items(data, "pr"), "MR !1234 · approved")
        self.assertEqual(self.render_items({"pr": {"number": 7}}, "pr"), "PR #7")
        self.assertEqual(self.render_items({"pr": {"number": True}}, "pr"), "")
        self.assertEqual(self.render_items({"pr": {"number": ""}}, "pr"), "")
        self.assertEqual(self.render_items({}, "pr"), "")

    def test_worktree_item(self):
        self.assertEqual(
            self.render_items({"worktree": {"name": "feat-x"}}, "worktree"),
            "Worktree feat-x",
        )
        self.assertEqual(self.render_items({"worktree": {"name": ""}}, "worktree"), "")
        self.assertEqual(self.render_items({}, "worktree"), "")

    def test_repo_item(self):
        data = {
            "workspace": {
                "repo": {"host": "github.com", "owner": "acme", "name": "widget"}
            }
        }
        self.assertEqual(self.render_items(data, "repo"), "Repo acme/widget")
        self.assertEqual(
            self.render_items({"workspace": {"repo": {"owner": "acme"}}}, "repo"), ""
        )
        self.assertEqual(self.render_items({}, "repo"), "")

    def test_new_groups_coalesce_adjacent_items(self):
        data = {
            "model": {"id": "test-model"},
            "effort": {"level": "max"},
            "fast_mode": True,
            "thinking": {"enabled": True},
            "prompt_cache": {"hit_ratio": 0.91, "cache_write_tokens": 352000},
            "pr": {"number": 1234, "review_state": "approved"},
            "workspace": {
                "current_dir": "/code/repo",
                "repo": {"owner": "acme", "name": "widget"},
            },
        }
        config = dc.DEFAULT_CONFIG.with_updates(
            items=(
                "model-with-effort",
                "fast-mode",
                "thinking",
                "git",
                "pr",
                "repo",
                "tokens",
                "prompt-cache",
            )
        )
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
        ):
            rendered = configured_text(data, config)
        self.assertEqual(
            rendered,
            "test-model max · fast · thinking | "
            "Git main · PR #1234 · approved · Repo acme/widget | "
            "hit 10 · miss 20 · out 5 · cache 91% · 352K w",
        )

    def test_new_groups_do_not_cross_ungrouped_items(self):
        data = {
            "version": "2.1.258",
            "session_id": "abcdefgh",
            "session_name": "Refactor",
            "model": {"id": "test-model"},
        }
        self.assertEqual(
            self.render_items(data, "version", "model-with-effort", "session"),
            "v2.1.258 | test-model | Session Refactor",
        )

    def test_new_items_do_not_load_expensive_sources(self):
        config = dc.DEFAULT_CONFIG.with_updates(items=("cost",))
        with (
            mock.patch.object(sl, "git_status") as git_status,
            mock.patch.object(sl, "session_token_totals") as token_totals,
        ):
            self.assertEqual(
                configured_text({"cost": {"total_cost_usd": 1.0}}, config),
                "Total $1.00",
            )
        git_status.assert_not_called()
        token_totals.assert_not_called()


class NewItemConfigCommandTests(unittest.TestCase):
    def setUp(self):
        self.tempdir = tempfile.TemporaryDirectory(prefix="statusline-new-item-")
        self.config_dir = Path(self.tempdir.name) / "claude"
        self.executable = Path(self.tempdir.name) / "bin" / "claude-statusline"
        self.executable.parent.mkdir()
        self.executable.write_text("#!/bin/sh\n", encoding="utf-8")

    def tearDown(self):
        self.tempdir.cleanup()

    def test_list_items_json_marks_new_items_default_disabled(self):
        args = cc.parse_slash_arguments("list-items --json")
        listed = json.loads(
            cc.execute_config_namespace(args, self.config_dir, self.executable)
        )
        by_id = {item["id"]: item for item in listed}
        self.assertEqual(set(by_id), set(dc.ITEM_CATALOG))
        for item_id in NEW_ITEM_IDS:
            self.assertFalse(by_id[item_id]["default_enabled"], item_id)
            self.assertFalse(by_id[item_id]["enabled"], item_id)
            self.assertIsNone(by_id[item_id]["position"], item_id)
        for item_id in dc.DEFAULT_ITEMS:
            self.assertTrue(by_id[item_id]["default_enabled"], item_id)

    def test_enable_new_item_roundtrip(self):
        result = cc.enable_items(self.config_dir, self.executable, ["cost"])
        self.assertTrue(result.changed)
        self.assertEqual(
            dc.load_display_config(self.config_dir).items,
            dc.DEFAULT_ITEMS + ("cost",),
        )
        again = cc.enable_items(self.config_dir, self.executable, ["cost"])
        self.assertFalse(again.changed)

    def test_new_main_items_support_set_enable_disable_and_order(self):
        cc.set_items(
            self.config_dir,
            self.executable,
            ["project-name", "hostname", "context-used"],
        )
        cc.disable_items(self.config_dir, self.executable, ["hostname"])
        self.assertEqual(
            dc.load_display_config(self.config_dir).items,
            ("project-name", "context-used"),
        )
        cc.enable_items(self.config_dir, self.executable, ["hostname"])
        cc.order_items(
            self.config_dir,
            self.executable,
            ["context-used", "hostname", "project-name"],
        )
        self.assertEqual(
            dc.load_display_config(self.config_dir).items,
            ("context-used", "hostname", "project-name"),
        )

    def test_order_rejects_new_item_not_enabled(self):
        cc.enable_items(self.config_dir, self.executable, ["cost"])
        with self.assertRaises(cc.ConfigCommandError):
            cc.order_items(
                self.config_dir,
                self.executable,
                list(dc.DEFAULT_ITEMS) + ["cost", "session"],
            )


class NewItemSubprocessTests(unittest.TestCase):
    def run_render(self, config_content, payload):
        with tempfile.TemporaryDirectory(
            prefix="statusline-new-item-subprocess-"
        ) as directory:
            root = Path(directory)
            dc.config_path(root).write_text(
                json.dumps(config_content) + "\n", encoding="utf-8"
            )
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

    def test_new_items_render_end_to_end(self):
        config = dc.DEFAULT_CONFIG.with_updates(
            items=("version", "session", "cost")
        ).to_dict()
        payload = {
            "version": "2.1.258",
            "session_id": "abc12345xyz",
            "cost": {
                "total_cost_usd": 0.12,
                "total_duration_ms": 750000,
                "total_lines_added": 156,
                "total_lines_removed": 23,
            },
        }
        result = self.run_render(config, payload)
        self.assertEqual(result.returncode, 0)
        self.assertEqual(result.stderr, "")
        self.assertEqual(
            plain(result.stdout).strip(),
            "v2.1.258 | Session abc12345 | Total $0.12 · 12m 30s · +156/-23",
        )


if __name__ == "__main__":
    unittest.main(verbosity=2)
