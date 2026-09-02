#!/usr/bin/env python3
"""Regression tests for optional Claude Code rate-limit statusline data."""

import json
import math
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

from claude_statusline import statusline as sl


def plain(text):
    return sl.ANSI_SGR_RE.sub("", text) if text is not None else None


class RateLimitSegmentTests(unittest.TestCase):
    def test_all_windows_render_in_fixed_order_as_remaining_percentages(self):
        rendered = sl._rate_limit_segment({
            "rate_limits": {
                "five_hour": {"used_percentage": 23},
                "seven_day": {"used_percentage": 41},
                "spend_limit": {"used_percentage": 63},
            },
        })
        self.assertEqual(
            plain(rendered),
            "5h 77% left · weekly 59% left · spend 37% left",
        )

    def test_windows_are_independently_optional(self):
        five_and_weekly = sl._rate_limit_segment({
            "rate_limits": {
                "five_hour": {"used_percentage": 23},
                "seven_day": {"used_percentage": 41},
            },
        })
        weekly_only = sl._rate_limit_segment({
            "rate_limits": {
                "seven_day": {"used_percentage": 41},
            },
        })
        self.assertEqual(plain(five_and_weekly), "5h 77% left · weekly 59% left")
        self.assertEqual(plain(weekly_only), "weekly 59% left")

    def test_absent_or_malformed_containers_hide_the_segment(self):
        payloads = (
            {},
            {"rate_limits": None},
            {"rate_limits": []},
            {"rate_limits": "invalid"},
            {"rate_limits": {"five_hour": None}},
            {"rate_limits": {"five_hour": []}},
            {"rate_limits": {"five_hour": {}}},
        )
        for payload in payloads:
            with self.subTest(payload=payload):
                self.assertIsNone(sl._rate_limit_segment(payload))

    def test_invalid_values_are_skipped(self):
        invalid = (None, True, False, "23", -1, math.nan, math.inf, -math.inf)
        for value in invalid:
            with self.subTest(value=value):
                self.assertIsNone(sl._rate_limit_segment({
                    "rate_limits": {
                        "five_hour": {"used_percentage": value},
                    },
                }))

    def test_rounding_and_remaining_bounds(self):
        cases = (
            (0, "5h 100% left"),
            (23.4, "5h 77% left"),
            (99.6, "5h 0% left"),
            (100, "5h 0% left"),
            (150, "5h 0% left"),
            (10 ** 400, "5h 0% left"),
        )
        for used, expected in cases:
            with self.subTest(used=used):
                rendered = sl._rate_limit_segment({
                    "rate_limits": {
                        "five_hour": {"used_percentage": used},
                    },
                })
                self.assertEqual(plain(rendered), expected)


class RateLimitIntegrationTests(unittest.TestCase):
    def setUp(self):
        self.tempdir = tempfile.TemporaryDirectory(prefix="statusline-limits-test-")
        self.root = Path(self.tempdir.name)
        self.transcript = self.root / "session.jsonl"
        record = {
            "type": "cost-state",
            "modelUsage": {
                "test-model": {
                    "cacheReadInputTokens": 10,
                    "inputTokens": 20,
                    "cacheCreationInputTokens": 5,
                    "outputTokens": 5,
                },
            },
        }
        self.transcript.write_text(json.dumps(record) + "\n", encoding="utf-8")

    def tearDown(self):
        self.tempdir.cleanup()

    def render(self, columns, session_id):
        payload = {
            "model": {"id": "test-model"},
            "session_id": session_id,
            "transcript_path": str(self.transcript),
            "context_window": {
                "remaining_percentage": 88,
                "context_window_size": 1_000_000,
            },
            "rate_limits": {
                "five_hour": {"used_percentage": 23},
                "seven_day": {"used_percentage": 41},
                "spend_limit": {"used_percentage": 63},
            },
        }
        env = os.environ.copy()
        env["CLAUDE_STATUSLINE_RUNTIME_DIR"] = str(self.root / "runtime")
        env["COLUMNS"] = str(columns)
        return subprocess.run(
            [sys.executable, "-m", "claude_statusline", "render"],
            input=json.dumps(payload),
            check=True,
            capture_output=True,
            text=True,
            encoding="utf-8",
            env=env,
        ).stdout.strip()

    def test_wide_output_places_limits_between_context_and_tokens(self):
        rendered = plain(self.render(1000, "wide-session"))
        self.assertEqual(rendered.split(" | "), [
            "test-model",
            "Context 88% left · 1M window",
            "5h 77% left · weekly 59% left · spend 37% left",
            "hit 10 · miss 25 · out 5",
        ])

    def test_narrow_output_wraps_without_orphan_separators(self):
        rendered = self.render(34, "narrow-session")
        rows = rendered.splitlines()
        self.assertGreater(len(rows), 1)
        for row in rows:
            visible = plain(row)
            self.assertLessEqual(sl._display_width(row), 32, visible)
            self.assertFalse(visible.startswith(" | "), visible)
            self.assertFalse(visible.endswith(" | "), visible)
            self.assertNotEqual(visible.strip(), "|")
        joined = "\n".join(plain(row) for row in rows)
        self.assertIn("Context 88% left", joined)
        self.assertIn("weekly 59% left", joined)
        self.assertIn("hit 10 · miss 25 · out 5", joined)


if __name__ == "__main__":
    unittest.main(verbosity=2)
