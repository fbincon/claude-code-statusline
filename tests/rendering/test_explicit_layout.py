"""Priority/width fitting, explicit boundaries and subagent suppression."""

from dataclasses import replace
import unittest

from claude_statusline.config import advanced, display
from claude_statusline.rendering import items, layout, preview, subagents


class ExplicitLayoutTests(unittest.TestCase):
    def config(self):
        config = display.DEFAULT_CONFIG.with_updates(
            items=("model", "session-name", "context-used"),
            use_colors=False,
            scope_labels="off",
        )
        return advanced.edit_layout(
            config, "explicit", [["model", "session-name"], ["context-used"]]
        )

    def test_priority_overrides_order_without_moving_rows(self):
        config = advanced.edit_item(
            self.config(), "main", "session-name", "priority", "100"
        )
        data = {
            "model": {"id": "abcdefghijklmnopqrstuvwxyz"},
            "session_name": "saved",
            "context_window": {"used_percentage": 90},
        }
        rows = items.configured_rows(data, config, 14)
        self.assertEqual(rows, ["Session saved", "Context 90% u…"])
        self.assertTrue(all(layout._display_width(row) <= 14 for row in rows))

    def test_equal_priority_drops_rightmost_and_clips_final_item(self):
        config = self.config()
        rows = items.configured_rows(
            {"model": {"id": "界" * 20}, "session_name": "saved"}, config, 8
        )
        self.assertEqual(rows, ["界界界…"])
        self.assertNotIn("saved", rows[0])

    def test_width_clipping_preserves_styles_and_combining_characters(self):
        text = "\x1b[31m" + "e\u0301" * 10 + "\x1b[0m"
        result = layout.truncate_styled(text, 4)
        self.assertEqual(layout.ANSI_SGR_RE.sub("", result), "e\u0301e\u0301e\u0301…")
        self.assertTrue(result.endswith("\x1b[0m"))

    def test_scope_decoration_does_not_hide_the_only_real_item(self):
        config = self.config().with_updates(items=("model",), scope_labels="always")
        self.assertEqual(
            items.configured_rows({"model": {"id": "Sonnet"}}, config, 6), ["Sonnet"]
        )
        self.assertEqual(
            items.configured_rows({"model": {"id": "Sonnet"}}, config, 40),
            ["Main/Session | Sonnet"],
        )

    def test_per_item_width_is_applied_before_fitting(self):
        config = advanced.edit_item(self.config(), "main", "model", "max-width", "5")
        rows = items.configured_rows(
            {"model": {"id": "long-model"}, "session_name": "x"}, config, 30
        )
        self.assertEqual(rows, ["long… | Session x"])

    def test_missing_rows_do_not_create_blank_lines_and_preview_is_bounded(self):
        self.assertEqual(items.configured_rows({}, self.config(), 80), [])
        for width in (2, 8, 32, 80, 120):
            rows = preview.render_preview_rows(self.config(), width)
            self.assertLessEqual(len(rows), 2)
            self.assertTrue(all(layout._display_width(row) <= width for row in rows))

    def test_order_and_enable_disable_keep_explicit_partition_valid(self):
        config = self.config().with_updates(
            items=("context-used", "model", "session-name")
        )
        self.assertEqual(
            config.layout.rows, (("context-used", "model"), ("session-name",))
        )
        config = config.with_updates(items=("context-used", "model"))
        self.assertEqual(tuple(i for r in config.layout.rows for i in r), config.items)
        config = config.with_updates(items=(*config.items, "tokens"))
        self.assertEqual(tuple(i for r in config.layout.rows for i in r), config.items)
        self.assertEqual(config.with_updates(items=()).layout.rows, ())

    def test_bad_partitions_are_refused(self):
        for rows in (
            [["model", "model"]],
            [["session-name", "model", "context-used"]],
            [[]],
        ):
            with self.assertRaises(display.DisplayConfigError):
                advanced.edit_layout(self.config(), "explicit", rows)

    def test_subagent_hidden_ids_are_emitted_and_host_order_is_retained(self):
        config = display.DEFAULT_CONFIG.with_updates(
            subagents=replace(
                display.DEFAULT_CONFIG.subagents, hide_completed=True, row_limit=1
            )
        )
        tasks = [
            {"id": "done", "status": "completed"},
            {"id": "first", "status": "failed"},
            {"id": "second", "status": "running"},
            {"id": "first", "status": "running"},
        ]
        rows = subagents.render_payload({"tasks": tasks}, config)
        self.assertEqual([r["id"] for r in rows], ["done", "first", "second"])
        self.assertEqual(rows[0]["content"], "")
        self.assertTrue(rows[1]["content"])
        self.assertEqual(rows[2]["content"], "")
        config = config.with_updates(
            subagents=replace(config.subagents, visibility="running", row_limit=None)
        )
        rows = subagents.render_payload({"tasks": tasks}, config)
        self.assertFalse(rows[1]["content"])
        self.assertTrue(rows[2]["content"])

    def test_task_text_and_zero_row_limit(self):
        config = display.DEFAULT_CONFIG.with_updates(
            use_colors=False,
            subagents=display.SubagentDisplayConfig(items=("task",), task_max_width=6),
        )
        task = {"id": "one", "description": "界" * 30, "status": "running"}
        self.assertLessEqual(
            layout._display_width(
                subagents.render_payload({"tasks": [task], "columns": 100}, config)[0][
                    "content"
                ]
            ),
            6,
        )
        config = config.with_updates(subagents=replace(config.subagents, row_limit=0))
        self.assertEqual(
            subagents.render_payload({"tasks": [task]}, config),
            [{"id": "one", "content": ""}],
        )
