"""Production observations, legacy snapshots and width/style invariants."""

from dataclasses import replace
import json
import unittest
from unittest import mock

from claude_statusline.config import display, formatting
from claude_statusline.rendering import items, layout, preview, spans, styles, subagents
from tests.support import REPOSITORY_ROOT


def plain(value):
    return layout.ANSI_SGR_RE.sub("", value)


class AppearanceRenderingTests(unittest.TestCase):
    def config(self, selected, **changes):
        return display.DEFAULT_CONFIG.with_updates(**{"items": tuple(selected), "scope_labels": "off", **changes})

    def render(self, data, config, width=120, state=items._RenderState):
        return "\n".join(items.configured_rows(data, config, width, state))

    @mock.patch.object(preview, "_sample_preview_data", wraps=preview._sample_preview_data)
    def test_legacy_preview_bytes_match_fixed_v111(self, sample):
        data = sample()
        data["workspace"] = {"current_dir": "/fixture/project/src", "project_dir": "/fixture/project"}
        sample.return_value = data
        fixture = json.loads((REPOSITORY_ROOT / "tests/fixtures/legacy-appearance.json").read_text())
        for case in fixture["cases"]:
            with self.subTest(case={k: v for k, v in case.items() if k not in ("main", "subagents")}):
                cfg = display.DEFAULT_CONFIG.with_updates(statusline_language=case["language"], palette=case["palette"], use_colors=case["colors"])
                if case["mode"] == "explicit":
                    cfg = cfg.with_updates(layout=formatting.Layout("explicit", (cfg.items[:3], cfg.items[3:])))
                self.assertEqual(preview.render_preview_rows(cfg, case["width"]), case["main"])
                self.assertEqual(subagents.preview_rows(cfg, case["width"]), case["subagents"])

    def test_git_hides_only_confirmed_clean_relevant_state(self):
        clean = {"kind": "ok", "branch": "main", "upstream": "origin/main", "upstream_gone": False,
                 "staged": 0, "unstaged": 0, "conflicts": 0, "untracked": 0, "ahead": 0, "behind": 0}
        for item in ("git", "git-changes"):
            cfg = self.config((item,), item_options={item: formatting.ItemOptions(visibility="git-dirty")})
            for patch, hidden in (({}, True), ({"staged": 1}, False), ({"unstaged": 1}, False),
                                  ({"conflicts": 1}, False), ({"untracked": 1}, False),
                                  ({"ahead": 1}, item != "git"), ({"behind": 1}, item != "git"),
                                  ({"upstream_gone": True}, item != "git"), ({"kind": "error"}, False)):
                with self.subTest(item=item, patch=patch), mock.patch.object(items._RenderState, "git_data", return_value={**clean, **patch}):
                    self.assertEqual(self.render({}, cfg) == "", hidden)

    def test_live_zero_and_empty_require_complete_observations(self):
        for item, zero, positive in (("active-agents", 0, 2), ("task-progress", {"completed": 0, "total": 0}, {"completed": 5, "total": 5})):
            cfg = self.config((item,), item_options={item: formatting.ItemOptions(visibility="nonzero")})
            for point, hidden in (
                ({"value": zero, "partial": False, "reason": None}, True),
                ({"value": positive, "partial": False, "reason": None}, False),
                ({"value": zero, "partial": True, "reason": "incomplete"}, False),
                ({"value": None, "partial": False, "reason": "stale"}, False),
                ({"value": None, "partial": False, "reason": "runtime_disabled"}, False),
            ):
                with self.subTest(item=item, point=point), mock.patch.object(items._RenderState, "live_data", return_value={item: point}):
                    self.assertEqual(self.render({}, cfg) == "", hidden)

    def test_visibility_uses_raw_used_percentage_in_both_languages(self):
        for language in ("en", "zh-CN"):
            for item in ("context-used", "context-remaining"):
                cfg = self.config((item,), statusline_language=language, item_options={item: formatting.ItemOptions(visibility="used-at-least")})
                for used, visible in ((0, False), (69.99, False), (70, True), (100, True), (101, True)):
                    data = {"context_window": {"used_percentage": used, "remaining_percentage": max(0, 100 - used)}}
                    self.assertEqual(bool(self.render(data, cfg)), visible and not (item == "context-used" and used > 100))
        cfg = self.config(("five-hour-limit",), item_options={"five-hour-limit": formatting.ItemOptions(visibility="used-at-least")})
        for allowance in ("remaining", "used"):
            cfg = cfg.with_updates(formatting=replace(cfg.formatting, allowance=allowance))
            with mock.patch.object(items.time, "time", return_value=100):
                self.assertEqual(self.render({"rate_limits": {"five_hour": {"used_percentage": 69.99, "resets_at": 200}}}, cfg), "")
                self.assertTrue(self.render({"rate_limits": {"five_hour": {"used_percentage": 70, "resets_at": 200}}}, cfg))
                self.assertEqual(self.render({"rate_limits": {"five_hour": {"used_percentage": 90, "resets_at": 99}}}, cfg), "")

    def test_background_survives_inner_resets_and_colors_off_has_no_sgr(self):
        cfg = self.config(("model-with-effort",), item_options={"model-with-effort": formatting.ItemOptions(label="引擎", foreground="#102030", background="#abcdef")})
        data = {"model": {"id": "test"}, "effort": {"level": "high"}}
        row = self.render(data, cfg)
        for span in spans.row_spans(row):
            self.assertEqual(span["foreground"], {"kind": "rgb", "value": "#102030"})
            self.assertEqual(span["background"], {"kind": "rgb", "value": "#abcdef"})
        self.assertEqual(self.render(data, cfg.with_updates(use_colors=False)), plain(row))
        ansi = spans.row_spans(self.render(data, cfg.with_updates(palette="ansi")))
        self.assertTrue(all(s[c]["kind"] == "ansi" and 0 <= s[c]["value"] < 16 for s in ansi for c in ("foreground", "background")))

    def test_risk_wins_foreground_and_preserves_background(self):
        cfg = self.config(("context-used",), item_options={"context-used": formatting.ItemOptions(foreground="#123456", background="#102030")},
                          formatting=formatting.Formatting(thresholds=formatting.Thresholds(True, 70, 90)))
        for used, fg in ((69, "#123456"), (70, "#f2b550"), (90, "#f28686")):
            rendered = spans.row_spans(self.render({"context_window": {"used_percentage": used}}, cfg))
            self.assertTrue(rendered)
            self.assertTrue(all(s["foreground"]["value"] == fg and s["background"]["value"] == "#102030" for s in rendered))

    def test_terminal_default_differs_from_inherit(self):
        cfg = self.config(("model",), theme="dark", separator_style="powerline",
                          item_options={"model": formatting.ItemOptions(foreground="default", background="default")})
        row = self.render({"model": {"id": "X"}}, cfg)
        self.assertTrue(all(s["foreground"] is None and s["background"] is None for s in spans.row_spans(row)))

    def test_hidden_middle_has_no_separator_or_background(self):
        cfg = self.config(("model", "context-used", "effort"), separator_style="powerline", powerline_glyph="powerline",
                          item_options={"context-used": formatting.ItemOptions(visibility="used-at-least", background="#aa0000")})
        data = {"model": {"id": "X"}, "effort": {"level": "high"}, "context_window": {"used_percentage": 5}}
        result = self.render(data, cfg)
        self.assertNotIn("5%", plain(result))
        self.assertFalse(any(s["background"] == {"kind": "rgb", "value": "#aa0000"} for s in spans.row_spans(result)))
        self.assertEqual(plain(result).count(">") + plain(result).count("\ue0b0"), 2)

    def test_powerline_widths_styles_graphemes_and_empty_rows(self):
        cluster = "👩🏽‍💻"
        for mode in ("auto", "explicit"):
            for theme in ("classic", "dark", "light", "terminal"):
                for glyph in ("ascii", "powerline"):
                    cfg = self.config(("model", "context-used"), theme=theme, separator_style="powerline", powerline_glyph=glyph,
                                      item_options={"model": formatting.ItemOptions(label="中文" + cluster)})
                    if mode == "explicit":
                        cfg = cfg.with_updates(layout=formatting.Layout("explicit", (cfg.items,)))
                    for columns in (2, 3, 4, 8, 15, 40, 120):
                        rows = items.configured_rows({"model": {"id": "a\u0301"}, "context_window": {"used_percentage": 80}}, cfg, columns)
                        for row in rows:
                            self.assertLessEqual(layout._display_width(row), columns)
                            self.assertTrue(row.endswith(styles.RESET))
                            if "👩" in row:
                                self.assertIn(cluster, plain(row))
        cfg = self.config(("context-used",), separator_style="powerline", scope_labels="always",
                          item_options={"context-used": formatting.ItemOptions(visibility="used-at-least")})
        self.assertEqual(self.render({"context_window": {"used_percentage": 0}}, cfg), "")

    def test_subagent_color_only_keeps_existing_fitting_and_threshold_uses_ratio(self):
        task = {"id": "a", "name": "Explore", "model": "claude-sonnet-5", "status": "running",
                "startTime": 0, "tokenCount": 13999, "contextWindowSize": 20000,
                "description": "checking a long description"}
        baseline = display.DEFAULT_CONFIG
        colored = baseline.with_updates(subagents=replace(baseline.subagents, item_options={"name": formatting.ItemOptions(background="#223344")}))
        for width in (1, 2, 8, 15, 30, 80):
            self.assertEqual(plain(subagents.render_task(task, baseline, columns=width, now_ms=1000)),
                             plain(subagents.render_task(task, colored, columns=width, now_ms=1000)))
        cfg = baseline.with_updates(separator_style="powerline",
                                    subagents=display.SubagentDisplayConfig(items=("context-used",), item_options={"context-used": formatting.ItemOptions(visibility="used-at-least")}))
        self.assertEqual(subagents.render_task(task, cfg), "")
        self.assertTrue(subagents.render_task({**task, "tokenCount": 14000}, cfg))
        for width in (1, 2, 3, 4, 15):
            self.assertLessEqual(layout._display_width(subagents.render_task({**task, "tokenCount": 14000}, cfg, columns=width)), width)
