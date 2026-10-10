"""Benchmark setup isolation and meaningful cache workloads."""

import tempfile
import unittest
import os
import sys
from pathlib import Path
from unittest.mock import patch

from tools.benchmark_render import measure
from tools.benchmarking.render import fixtures


class BenchmarkTests(unittest.TestCase):
    def test_comparison_runs_one_case_from_each_source_before_advancing(self):
        from tools.benchmark_compare import run_pair

        program = """
from pathlib import Path
import sys
from tools.benchmark_render import measure
for case in range(3):
    def record():
        with Path(sys.argv[2]).open('a', encoding='utf-8') as output:
            output.write(sys.argv[1] + str(case) + '\\n')
    measure(record, 1)
"""
        for order in (("baseline", "candidate"), ("candidate", "baseline")):
            with self.subTest(order=order), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                audit = root / "order.txt"
                commands = {
                    side: [sys.executable, "-c", program, side, str(audit)]
                    for side in order
                }
                logs = {side: root / (side + ".log") for side in order}
                self.assertEqual(run_pair(commands, order, logs, os.environ), 3)
                self.assertEqual(
                    audit.read_text().splitlines(),
                    [side + str(case) for case in range(3) for side in order],
                )

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

    def test_immutable_source_verification_rejects_modified_runtime(self):
        from tools.benchmarking.source import identity
        import hashlib

        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            package = root / "src/claude_statusline"
            package.mkdir(parents=True)
            code = b"value = 1\n"
            file = package / "__init__.py"
            file.write_bytes(code)
            blob = hashlib.sha1(b"blob 10\0" + code).hexdigest()
            tree = f"100644 blob {blob}\tsrc/claude_statusline/__init__.py\0".encode()
            with patch(
                "tools.benchmarking.source.subprocess.check_output", return_value=tree
            ):
                self.assertEqual(len(identity(root, "a" * 40)), 64)
                file.write_bytes(b"value = 2\n")
                with self.assertRaisesRegex(ValueError, "does not match"):
                    identity(root, "a" * 40)

    def test_comparison_flags_consistent_changes_beyond_baseline_round_noise(self):
        from tools.benchmark_compare import summarize

        reports = []
        for round_, (before, after) in enumerate(((10, 15), (12, 16), (11, 17))):
            for side, value in (("baseline", before), ("candidate", after)):
                reports.append(
                    {
                        "round": round_,
                        "mode": "warm",
                        "side": side,
                        "report": {
                            "metrics": {"case": {"p50_ms": value, "p95_ms": value + 5}}
                        },
                    }
                )
        self.assertTrue(summarize(reports)["warm"]["case"]["review_regression"])
        reports[-1]["report"]["metrics"]["case"] = {"p50_ms": 9, "p95_ms": 14}
        self.assertFalse(summarize(reports)["warm"]["case"]["review_regression"])
