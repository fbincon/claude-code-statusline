"""Independent display metrics: scope, strict input, clocks and preview parity."""

import unittest
from unittest import mock

from claude_statusline.config import catalog, display
from claude_statusline.rendering import items, layout, preview, subagents
from claude_statusline.runtime import git, usage


BATCH_A = (
    "model",
    "effort",
    "context-tokens",
    "five-hour-reset",
    "weekly-reset",
    "session-cost",
    "session-duration",
    "api-duration",
    "lines-changed",
)
AGENT_ADDITIONS = ("model", "effort", "context-tokens", "context-window-size")
NOW = 2_000_000_000


def render(data, *selected):
    config = display.DEFAULT_CONFIG.with_updates(
        items=selected, use_colors=False, scope_labels="off"
    )
    with mock.patch.object(items.time, "time", return_value=NOW):
        segments, separator, reset = items._configured_segments(data, config)
    return "\n".join(
        layout._layout_segments(segments, 2000, separator=separator, reset=reset)
    )


class DisplayMetricsTests(unittest.TestCase):
    def test_additions_are_opt_in_and_accept_compounds(self):
        for item in BATCH_A:
            self.assertIsNone(catalog.BY_SCOPE["main"][item].default_position)
        for item in AGENT_ADDITIONS:
            self.assertIsNone(catalog.BY_SCOPE["subagent"][item].default_position)
        data = {"model": {"id": "claude-opus"}, "effort": {"level": "high"}}
        self.assertEqual(
            render(data, "model-with-effort", "model", "effort"),
            "claude-opus high · claude-opus · high",
        )
        self.assertEqual(render({}, *BATCH_A), "")

    def test_model_fallback_and_effort_independence(self):
        self.assertEqual(
            render({"model": {"id": 42, "display_name": "Opus"}}, "model"), "Opus"
        )
        self.assertEqual(render({"effort": {"level": "high"}}, "effort"), "high")
        self.assertEqual(render({"effort": {"level": True}}, "effort"), "")
        self.assertNotIn(
            "\x1b", render({"model": {"id": "中文\n\x1b[31mmodel"}}, "model")
        )
        self.assertNotIn("\n", render({"model": {"id": "中文\nmodel"}}, "model"))

    def test_context_uses_only_live_input_and_cache_components(self):
        context = {
            "context_window_size": 200000,
            "total_input_tokens": 1,
            "current_usage": {
                "input_tokens": 35000,
                "cache_creation_input_tokens": 12000,
                "cache_read_input_tokens": 7000,
                "output_tokens": 90000,
            },
        }
        self.assertEqual(
            render({"context_window": context}, "context-tokens"), "Context 54K / 200K"
        )
        context["current_usage"] = None
        self.assertEqual(render({"context_window": context}, "context-tokens"), "")
        del context["current_usage"]
        context["total_input_tokens"] = 0
        self.assertEqual(
            render({"context_window": context}, "context-tokens"), "Context 0 / 200K"
        )
        for invalid in (None, True, "5", -1, 1.2, float("inf"), 10**1000):
            context["total_input_tokens"] = invalid
            self.assertEqual(render({"context_window": context}, "context-tokens"), "")

    def test_reset_windows_expire_together_and_do_not_require_percentage(self):
        for field, allowance, reset, label in (
            ("five_hour", "five-hour-limit", "five-hour-reset", "5h"),
            ("seven_day", "weekly-limit", "weekly-reset", "weekly"),
        ):
            with self.subTest(field=field):
                window = {"used_percentage": 25, "resets_at": NOW + 7980}
                data = {"rate_limits": {field: window}}
                self.assertEqual(
                    render(data, allowance, reset),
                    f"{label} 75% left · {label} reset 2h 13m",
                )
                for expired in (
                    NOW,
                    NOW - 1,
                    None,
                    True,
                    "tomorrow",
                    float("nan"),
                    float("inf"),
                ):
                    window["resets_at"] = expired
                    self.assertEqual(render(data, allowance, reset), "")
                window["resets_at"] = NOW + 0.1
                self.assertEqual(render(data, reset), f"{label} reset 1s")
                del window["resets_at"]
                self.assertEqual(render(data, allowance, reset), f"{label} 75% left")
                window.clear()
                window["resets_at"] = NOW + 525600
                self.assertEqual(render(data, reset), f"{label} reset 6d 2h")

    def test_cost_components_are_independent_and_zero_is_observed(self):
        data = {
            "cost": {
                "total_cost_usd": 0.42,
                "total_duration_ms": 62000,
                "total_api_duration_ms": 12000,
                "total_lines_added": 128,
                "total_lines_removed": 32,
            }
        }
        selected = ("session-cost", "session-duration", "api-duration", "lines-changed")
        self.assertEqual(
            render(data, *selected),
            "Cost $0.42 · Session 1m 02s · API 0m 12s · +128/-32",
        )
        data["cost"] = {key: 0 for key in data["cost"]}
        self.assertEqual(
            render(data, *selected), "Cost $0.00 · Session 0m 00s · API 0m 00s · +0/-0"
        )
        for bad in (None, True, "1", -1, float("nan"), float("inf"), 10**1000):
            data["cost"] = {key: bad for key in data["cost"]}
            self.assertEqual(render(data, *selected), "")
        self.assertEqual(
            render({"cost": {"total_api_duration_ms": 12000}}, *selected), "API 0m 12s"
        )
        self.assertEqual(
            render({"cost": {"total_lines_added": 5}}, "lines-changed"), ""
        )

    def test_agent_fields_do_not_inherit_main_values(self):
        config = display.DEFAULT_CONFIG.with_updates(
            use_colors=False,
            subagents=display.SubagentDisplayConfig(items=AGENT_ADDITIONS),
        )
        task = {
            "model": "claude-sonnet-5",
            "effort": "high",
            "tokenCount": 84000,
            "contextWindowSize": 200000,
        }
        self.assertEqual(
            subagents.render_task(task, config, columns=200, now_ms=NOW * 1000),
            "sonnet-5 · high · Context 84K / 200K · 200K window",
        )
        del task["effort"]
        self.assertNotIn(
            "high", subagents.render_task(task, config, columns=200, now_ms=NOW * 1000)
        )
        task["effort"] = 16000
        self.assertIn(
            "16000", subagents.render_task(task, config, columns=200, now_ms=NOW * 1000)
        )
        self.assertEqual(
            catalog.BY_SCOPE["subagent"]["effort"].minimum_version, "2.1.214"
        )
        for width in (2, 12, 32, 80):
            text = subagents.render_task(task, config, columns=width, now_ms=NOW * 1000)
            self.assertLessEqual(layout._display_width(text), width)

    def test_preview_is_complete_and_uses_no_live_sources_or_clock(self):
        config = display.DEFAULT_CONFIG.with_updates(
            items=BATCH_A, scope_labels="off", use_colors=False
        )
        with (
            mock.patch.object(
                items.time, "time", side_effect=AssertionError("live clock")
            ),
            mock.patch.object(
                git, "git_status", side_effect=AssertionError("live Git")
            ),
            mock.patch.object(
                usage,
                "session_token_totals",
                side_effect=AssertionError("live transcript"),
            ),
        ):
            rows = preview.render_preview_rows(config, 1000)
        self.assertIn("5h reset 2h 13m", "\n".join(rows))
        self.assertIn("weekly reset 6d 2h", "\n".join(rows))
        self.assertIn("API 1m 15s", "\n".join(rows))


if __name__ == "__main__":
    unittest.main()
