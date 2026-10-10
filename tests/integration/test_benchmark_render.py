"""Benchmark setup isolation and meaningful cache workloads."""

import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from tools.benchmark_render import measure
from tools.benchmarking.render import fixtures


class BenchmarkTests(unittest.TestCase):
    def test_setup_and_cleanup_are_outside_the_timed_region(self):
        events = []

        def clock():
            events.append("clock")
            return len(events) * 1_000_000

        with patch("tools.benchmark_render.time.perf_counter_ns", side_effect=clock):
            result = measure(
                lambda: events.append("action"),
                5,
                prepare=lambda: events.append("prepare"),
                cleanup=lambda: events.append("cleanup"),
            )
        self.assertEqual(events, ["prepare", "clock", "action", "clock", "cleanup"] * 5)
        self.assertEqual(result["raw_ms"], [2.0] * 5)
        self.assertEqual(result["p95_ms"], 2.0)

    def test_fixture_contains_nested_agents_and_a_real_committed_repository(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            history, project = fixtures(root, 3, 2, 4)
            self.assertEqual(len(history.read_text(encoding="utf-8").splitlines()), 3)
            self.assertEqual(len(list((root / "history").rglob("agent-*.jsonl"))), 2)
            self.assertTrue((root / "history/subagents/nested/agent-1.jsonl").exists())
            self.assertTrue((project / ".git/HEAD").is_file())
