"""Independent display metrics: scope, strict input, clocks and preview parity."""

import unittest
from unittest import mock

from claude_statusline.config import catalog, display
from claude_statusline.rendering import items, layout, preview, subagents
from claude_statusline.runtime import git, usage
from tests.support import render_main_items as render


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


BATCH_B = (
    "cache-state",
    "cache-expires",
    "cache-misses",
    "api-requests",
    "output-style",
    "session-name",
    "session-id",
    "session-id-short",
    "git-branch",
    "git-changes",
    "git-ahead-behind",
)


class CacheSessionGitTests(unittest.TestCase):
    def test_missing_fields_are_hidden_and_new_items_are_opt_in(self):
        self.assertEqual(render({}, *BATCH_B), "")
        for item in BATCH_B:
            self.assertIsNone(catalog.BY_SCOPE["main"][item].default_position)
        for item in (
            "prompt-cache",
            "cache-state",
            "cache-expires",
            "cache-misses",
            "api-requests",
        ):
            self.assertEqual(catalog.BY_SCOPE["main"][item].minimum_version, "2.1.251")

    def test_cache_warmth_cools_at_expiry_and_unknown_is_distinct(self):
        cache = {"warm": True, "caching_observed": True, "expires_at": NOW + 260}
        data = {"prompt_cache": cache}
        self.assertEqual(
            render(data, "cache-state", "cache-expires"),
            "Cache warm · Cache TTL 4m 20s",
        )
        for expires in (NOW, NOW - 1):
            cache["expires_at"] = expires
            self.assertEqual(render(data, "cache-state", "cache-expires"), "Cache cold")
        for expires in (None, True, "later", float("nan"), float("inf"), -1, 10**1000):
            cache["expires_at"] = expires
            self.assertEqual(render(data, "cache-state", "cache-expires"), "")
        cache.update(expires_at=NOW + 260, warm=False)
        self.assertEqual(render(data, "cache-state", "cache-expires"), "Cache cold")
        cache["caching_observed"] = False
        self.assertEqual(
            render(data, "cache-state", "cache-expires"), "Cache unobserved"
        )
        cache.clear()
        self.assertEqual(render(data, "cache-state", "cache-expires"), "")

    def test_cache_counts_are_official_main_counts_not_transcript_estimates(self):
        data = {
            "prompt_cache": {"misses": 0, "requests": 14, "expected_rebuilds": 8},
            "context_window": {"total_input_tokens": 999999},
        }
        with mock.patch.object(
            usage, "session_token_totals", side_effect=AssertionError("transcript")
        ):
            self.assertEqual(
                render(data, "cache-misses", "api-requests"),
                "Cache miss 0 · API requests 14",
            )
        for bad in (None, True, "2", -1, 1.5, float("nan"), float("inf"), 10**1000):
            data["prompt_cache"] = {"misses": bad, "requests": bad}
            self.assertEqual(render(data, "cache-misses", "api-requests"), "")

    def test_named_short_full_session_and_style_are_independent(self):
        data = {
            "session_name": "中文 Demo",
            "session_id": "abcdefgh-1234-5678",
            "output_style": {"name": "Explanatory"},
        }
        self.assertEqual(
            render(
                data,
                "session",
                "session-name",
                "session-id-short",
                "session-id",
                "output-style",
            ),
            "Session 中文 Demo | Session 中文 Demo | ID abcdefgh | ID abcdefgh-1234-5678 | Style Explanatory",
        )
        del data["session_name"]
        self.assertEqual(
            render(data, "session", "session-name", "session-id"),
            "Session abcdefgh | ID abcdefgh-1234-5678",
        )
        self.assertEqual(
            render(
                {"session_name": 42, "session_id": False, "output_style": {"name": []}},
                "session-name",
                "session-id",
                "output-style",
            ),
            "",
        )
        self.assertNotIn("\n", render({"session_name": "中文\nDemo"}, "session-name"))

    def test_git_components_and_compound_share_one_collection(self):
        result = {
            "kind": "ok",
            "branch": "main",
            "oid": "abc1234",
            "upstream": "origin/main",
            "upstream_gone": False,
            "ahead": 2,
            "behind": 3,
            "staged": 0,
            "unstaged": 2,
            "conflicts": 1,
            "untracked": 1,
        }
        data = {"cwd": "/fixture", "session_id": "test-session"}
        with mock.patch.object(git, "git_status", return_value=result) as collect:
            self.assertEqual(
                render(data, "git", "git-branch", "git-changes", "git-ahead-behind"),
                "Git main ↑2↓3~2!1?1 · Git main · Git ~2 !1 ?1 · Git ↑2 ↓3",
            )
            collect.assert_called_once_with("/fixture", "test-session")
        result.update(ahead=0, behind=0, unstaged=0, conflicts=0, untracked=0)
        with mock.patch.object(git, "git_status", return_value=result):
            self.assertEqual(
                render(data, "git-changes", "git-ahead-behind"), "Git clean · Git ↑0 ↓0"
            )
            result["upstream"] = None
            self.assertEqual(render(data, "git-ahead-behind"), "")
            result.update(upstream="origin/main", upstream_gone=True)
            self.assertEqual(render(data, "git-ahead-behind"), "Git [gone]")
            result["branch"] = "HEAD@abc1234"
            self.assertEqual(render(data, "git-branch"), "Git HEAD@abc1234")
        with mock.patch.object(git, "git_status", return_value={"kind": "not_repo"}):
            self.assertEqual(
                render(data, "git-branch", "git-changes", "git-ahead-behind"), ""
            )
        with mock.patch.object(git, "git_status", return_value={"kind": "error"}):
            self.assertEqual(render(data, "git-changes"), "Git!")

    def test_all_new_preview_values_are_fixed_without_collection(self):
        config = display.DEFAULT_CONFIG.with_updates(
            items=BATCH_B, scope_labels="off", use_colors=False
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
        text = "\n".join(rows)
        for value in (
            "Cache warm",
            "Cache TTL 4m 20s",
            "Cache miss 2",
            "API requests 14",
            "Style Default",
            "Session demo-session",
            "ID demo-session",
            "ID demo-ses",
            "Git feature/statusline-tui",
            "Git ~2 ?1",
            "Git ↑1 ↓0",
        ):
            self.assertIn(value, text)


class GatewayMetricTests(unittest.TestCase):
    def test_gateway_optional_amount_and_period_are_independent(self):
        selected = ("spend-limit", "spend-amount", "spend-period")
        window = {
            "used_percentage": 62.8,
            "resets_at": NOW + 500,
            "used_usd": 314.12,
            "limit_usd": 500,
            "period": "monthly",
        }
        data = {"rate_limits": {"spend_limit": window}}
        self.assertEqual(
            render(data, *selected),
            "spend 37% left · Spend $314.12 / $500.00 · Spend monthly",
        )
        del window["used_usd"]
        self.assertEqual(render(data, *selected), "spend 37% left · Spend monthly")
        del window["period"]
        self.assertEqual(render(data, *selected), "spend 37% left")
        window.update(used_usd=0, limit_usd=0, period="daily")
        self.assertEqual(
            render(data, "spend-amount", "spend-period"),
            "Spend $0.00 / $0.00 · Spend daily",
        )
        window["resets_at"] = NOW
        self.assertEqual(render(data, *selected), "")

    def test_gateway_invalid_values_are_not_derived_from_percentage(self):
        for bad in (None, True, "12", -1, float("nan"), float("inf"), 10**1000):
            window = {
                "used_percentage": 50,
                "used_usd": bad,
                "limit_usd": 500,
                "period": bad,
            }
            self.assertEqual(
                render(
                    {"rate_limits": {"spend_limit": window}},
                    "spend-amount",
                    "spend-period",
                ),
                "",
            )
        for item in ("spend-amount", "spend-period"):
            self.assertEqual(catalog.BY_SCOPE["main"][item].minimum_version, "2.1.284")
            self.assertIsNone(catalog.BY_SCOPE["main"][item].default_position)

    def test_preview_includes_gateway_and_raw_cumulative_counts(self):
        selected = ("spend-amount", "spend-period", "input-tokens", "output-tokens")
        config = display.DEFAULT_CONFIG.with_updates(
            items=selected, use_colors=False, scope_labels="off"
        )
        with mock.patch.object(
            usage, "session_token_totals", side_effect=AssertionError("live transcript")
        ):
            self.assertEqual(
                preview.render_preview_rows(config, 500),
                ["Spend $31.50 / $350.00 · Spend monthly | in 1.29M · out 22.4K"],
            )


if __name__ == "__main__":
    unittest.main()
