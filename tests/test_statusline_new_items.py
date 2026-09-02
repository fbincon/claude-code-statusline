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
                "git",
                "pr",
                "repo",
                "worktree",
                "context-remaining",
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


class NewItemRenderingTests(unittest.TestCase):
    def render_items(self, data, *items):
        config = dc.DEFAULT_CONFIG.with_updates(items=tuple(items))
        return configured_text(data, config)

    def test_all_new_items_hidden_without_payload_fields(self):
        self.assertEqual(self.render_items({}, *NEW_ITEM_IDS), "")

    def test_version_item(self):
        self.assertEqual(
            self.render_items({"version": "2.1.258"}, "version"), "v2.1.258"
        )
        self.assertEqual(self.render_items({"version": ""}, "version"), "")
        self.assertEqual(self.render_items({"version": 7}, "version"), "")

    def test_session_prefers_name_then_id_prefix(self):
        data = {"session_id": "abcdefghijkl", "session_name": "Refactor"}
        self.assertEqual(self.render_items(data, "session"), "session Refactor")
        self.assertEqual(
            self.render_items({"session_id": "abcdefghijkl"}, "session"),
            "session abcdefgh",
        )
        self.assertEqual(
            self.render_items({"session_id": "abc"}, "session"), "session abc"
        )
        self.assertEqual(
            self.render_items(
                {"session_id": "abcdefgh", "session_name": ""}, "session"
            ),
            "session abcdefgh",
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
            self.render_items(data, "cost"), "$0.12 · 12m 30s · +156/-23"
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
        self.assertEqual(self.render_items(data, "cost"), "$0.00")
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
            "agent orchestrator",
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
            "worktree feat-x",
        )
        self.assertEqual(self.render_items({"worktree": {"name": ""}}, "worktree"), "")
        self.assertEqual(self.render_items({}, "worktree"), "")

    def test_repo_item(self):
        data = {
            "workspace": {
                "repo": {"host": "github.com", "owner": "acme", "name": "widget"}
            }
        }
        self.assertEqual(self.render_items(data, "repo"), "repo acme/widget")
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
            "git main · PR #1234 · approved · repo acme/widget | "
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
            "v2.1.258 | test-model | session Refactor",
        )

    def test_new_items_do_not_load_expensive_sources(self):
        config = dc.DEFAULT_CONFIG.with_updates(items=("cost",))
        with (
            mock.patch.object(sl, "git_status") as git_status,
            mock.patch.object(sl, "session_token_totals") as token_totals,
        ):
            self.assertEqual(
                configured_text({"cost": {"total_cost_usd": 1.0}}, config),
                "$1.00",
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
            "v2.1.258 | session abc12345 | $0.12 · 12m 30s · +156/-23",
        )


if __name__ == "__main__":
    unittest.main(verbosity=2)
