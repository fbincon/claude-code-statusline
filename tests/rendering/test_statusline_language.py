"""Production-language semantics, raw-data boundaries and terminal budgets."""

import unittest
from unittest import mock

from claude_statusline.config import catalog, display, formatting
from claude_statusline.i18n import statusline
from claude_statusline.rendering import formatters, items, metrics, preview, subagents, timer


class StatuslineLanguageTests(unittest.TestCase):
    def config(self, *selected, language="zh-CN", **updates):
        return display.DEFAULT_CONFIG.with_updates(
            items=selected, use_colors=False, scope_labels="off",
            statusline_language=language, **updates,
        )

    def sample(self, *selected, language="zh-CN", width=2000, **updates):
        return "\n".join(preview.render_preview_rows(self.config(*selected, language=language, **updates), width))

    def test_builtin_phrases_and_known_values_share_the_production_preview(self):
        text = self.sample("model-with-effort", "context-remaining", "weekly-limit", "cache-state",
                           "run-state", "permission-mode", "last-tool", "pr", "spend-period")
        for expected in ("claude-opus 高", "上下文 剩余 73%", "每周 剩余 64%", "缓存 热",
                         "状态 等待代理", "模式 规划*", "工具 Read 成功", "PR #42", "已批准", "支出 每月"):
            self.assertIn(expected, text)

    def test_english_phrases_retain_existing_bytes(self):
        cases = {
            "context-remaining": "Context 73% left",
            "context-used": "Context 27% used",
            "context-window-size": "200K window",
            "model-with-effort": "claude-opus high",
            "weekly-limit": "weekly 64% left",
            "weekly-reset": "weekly reset 6d 2h",
            "cache-state": "Cache warm",
            "cache-expires": "Cache TTL 4m 20s",
            "branch-diff": "Diff 3 files +42/-7",
            "task-active-timer": "Active 1m 30s",
            "last-tool": "Tool Read success",
            "run-state": "State waiting agents",
        }
        for item, expected in cases.items():
            with self.subTest(item=item):
                self.assertEqual(self.sample(item, language="en"), expected)

    def test_every_catalog_item_renders_without_translation_key_leaks(self):
        task = {"id": "agent", "name": "自定义 Name", "model": "claude-opus", "effort": "high",
                "status": "running", "startTime": 1000, "tokenCount": 10000,
                "contextWindowSize": 200000, "description": "用户描述", "cwd": "/自定义/project"}
        for language in ("en", "zh-CN"):
            for item in catalog.ITEMS:
                with self.subTest(language=language, scope=item.scope, item=item.id):
                    if item.scope == "main":
                        text = self.sample(item.id, language=language)
                    else:
                        config = self.config(language=language, subagents=display.SubagentDisplayConfig(items=(item.id,)))
                        text = subagents.render_task(task, config, columns=2000, now_ms=43000)
                    self.assertTrue(text)
                    self.assertNotIn("statusline.", text)

    def test_unknown_values_names_and_numbers_are_preserved(self):
        for domain in statusline.VALUES:
            self.assertEqual(statusline.value(domain, "custom-high/成功", "zh-CN"), "custom-high/成功")
            self.assertEqual(statusline.value(domain, 42, "zh-CN"), 42)
        config = self.config("model-with-effort", "pr", "output-style", "session-name")
        payload = {"model": {"id": "Context my-custom-model"}, "effort": {"level": "future-effort"},
                   "pr": {"number": 42, "review_state": "custom-review"}, "output_style": {"name": "Default"},
                   "session_name": "用户的 Session"}
        text = "\n".join(items.configured_rows(payload, config, 2000))
        for value in ("Context my-custom-model", "future-effort", "custom-review", "Default", "用户的 Session"):
            self.assertIn(value, text)

    def test_decoration_uses_owned_label_boundaries_in_both_languages(self):
        for language, value in (("en", "73% left"), ("zh-CN", "剩余 73%")):
            for labels in ("legacy", "short", "off"):
                config = self.config("context-remaining", language=language,
                                     formatting=formatting.Formatting(labels=labels),
                                     item_options={"context-remaining": formatting.ItemOptions(label="我的 标签")})
                self.assertEqual("\n".join(preview.render_preview_rows(config, 2000)), "我的 标签 " + value)
        for payload_name in ("Context actual model", "✓ original model"):
            config = self.config("model", formatting=formatting.Formatting(icons="ascii"),
                                 item_options={"model": formatting.ItemOptions(label="Engine", icon="")})
            self.assertEqual("\n".join(items.configured_rows({"model": {"id": payload_name}}, config, 2000)),
                             "Engine " + payload_name)

    def test_inherited_empty_and_short_labels_are_distinct(self):
        self.assertEqual(self.sample("context-remaining"), "上下文 剩余 73%")
        self.assertEqual(self.sample("context-remaining", item_options={"context-remaining": formatting.ItemOptions(label="")}), "剩余 73%")
        self.assertEqual(self.sample("context-remaining", formatting=formatting.Formatting(labels="short")), "剩余上下文 剩余 73%")
        self.assertEqual(self.sample("context-remaining", formatting=formatting.Formatting(labels="off")), "剩余 73%")

    def test_units_and_raw_arithmetic_do_not_change_with_language(self):
        for language in ("en", "zh-CN"):
            self.assertIn("1m 30s", self.sample("task-active-timer", language=language))
            self.assertIn("36.5 tok/s", self.sample("output-rate", language=language))
            self.assertIn("0.420s", self.sample("ttft", language=language))
            self.assertIn("$0.0123", self.sample("prompt-cost", language=language))
            self.assertIn("1.2M", self.sample("tokens", language=language))
        self.assertEqual(metrics.spend_metric({"period": "future"}, "spend-period", language="zh-CN"), None)

    def test_timer_language_does_not_change_lifecycle_or_symbols(self):
        for count, english in ((1, "1 agent"), (2, "2 agents")):
            state = {"status": "running", "phase": "waiting_subagents", "active_agents": {str(i): {} for i in range(count)}}
            with mock.patch.object(timer, "_state_elapsed_seconds", return_value=62):
                self.assertIn(english, timer._render_state_timer(state, None))
                self.assertIn(f"⏳ {count} 个代理 · 1m 02s", timer._render_state_timer(state, None, language="zh-CN"))
            self.assertEqual(state["status"], "running")

    def test_wide_text_fitting_colors_and_explicit_rows(self):
        for language in ("en", "zh-CN"):
            for colors in (False, True):
                for labels in ("legacy", "short", "off"):
                    config = self.config("model", "context-used", "weekly-limit", language=language,
                                         formatting=formatting.Formatting(labels=labels, icons="unicode", thresholds=formatting.Thresholds(True)),
                                         item_options={"model": formatting.ItemOptions(label="组合e\u0301中文", max_width=12)})
                    config = config.with_updates(use_colors=colors)
                    for width in (2, 12, 32, 64, 80):
                        for mode in ("auto", "explicit"):
                            row_config = config.with_updates(layout=formatting.Layout(mode, (("model", "context-used"), ("weekly-limit",)) if mode == "explicit" else ()))
                            for row in preview.render_preview_rows(row_config, width):
                                self.assertLessEqual(formatters.display_width(row), width)

    def test_normal_render_translation_does_not_load_ui_catalogues(self):
        with mock.patch("claude_statusline.i18n.translator.catalogue", side_effect=AssertionError("UI resources loaded")):
            self.assertIn("上下文", self.sample("context-remaining"))
            self.assertIn("Context", self.sample("context-remaining", language="en"))
            self.assertEqual(statusline.text("scope.main", "unknown"), "Main/Session")

    def test_subagent_known_effort_and_custom_task_survive_language_and_width(self):
        task = {"name": "User name", "description": "用户 e\u0301 描述", "model": "claude-opus", "effort": "high",
                "tokenCount": 10000, "contextWindowSize": 200000}
        config = self.config(subagents=display.SubagentDisplayConfig(items=("model-with-effort", "context-remaining", "task")))
        text = subagents.render_task(task, config, columns=2000)
        for expected in ("opus/高", "上下文 剩余 95%", "用户 e\u0301 描述"):
            self.assertIn(expected, text)
        for width in (2, 12, 32, 64):
            self.assertLessEqual(formatters.display_width(subagents.render_task(task, config, columns=width)), width)
