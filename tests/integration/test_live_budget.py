import json
from pathlib import Path
import tempfile
import unittest

from tools.live_metrics_acceptance import reserve, settle


class LiveBudgetTests(unittest.TestCase):
    def test_unknown_costs_and_concurrent_reservations_retain_shared_cap(self):
        with tempfile.TemporaryDirectory() as folder:
            ledger = Path(folder) / "budget.json"
            ledger.write_text(json.dumps({"authorized_total_usd": 10, "attempts": []}))
            a = reserve(ledger, "a", 6)
            b = reserve(ledger, "b", 4)
            with self.assertRaises(ValueError):
                reserve(ledger, "retry", 0.01)
            self.assertEqual(settle(ledger, a, None), 10)
            self.assertEqual(settle(ledger, b, 0), 6)
            reserve(ledger, "retry", 4)
            with self.assertRaises(ValueError):
                reserve(ledger, "extra", 0.01)

    def test_zero_and_known_costs_release_only_unused_reservations(self):
        with tempfile.TemporaryDirectory() as folder:
            ledger = Path(folder) / "budget.json"
            ledger.write_text(json.dumps({"authorized_total_usd": 10, "attempts": []}))
            a = reserve(ledger, "a", 2)
            self.assertEqual(settle(ledger, a, 0.125), 0.125)
            b = reserve(ledger, "b", 1)
            self.assertEqual(settle(ledger, b, float("nan")), 1.125)
            for value in (True, -1, float("inf"), 11):
                with self.subTest(value=value), self.assertRaises(ValueError):
                    reserve(ledger, "invalid", value)
