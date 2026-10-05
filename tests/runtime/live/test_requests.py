import os
from pathlib import Path
import tempfile
import unittest
from unittest import mock

from claude_statusline.runtime.live import model, snapshot, store
from tests.runtime.live.support import observation

USAGE = {
    "input_tokens": 10,
    "output_tokens": 20,
    "cache_read_input_tokens": 30,
    "cache_creation_input_tokens": 40,
}


class RequestTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        patch = mock.patch.dict(
            os.environ, {"CLAUDE_STATUSLINE_RUNTIME_DIR": str(self.root / "runtime")}
        )
        patch.start()
        self.addCleanup(patch.stop)
        self.seq = 0
        self.send("heartbeat", at=1000)
        self.send("prompt", at=1010, prompt="p")
        self.send("turn_start", at=1020, turn_id="t")

    def send(self, kind, at=2000, **kwargs):
        row = observation(kind, self.seq, at, **kwargs)
        self.seq += 1
        store.observe(self.root, model.validate_batch([row]))
        return row

    def request(
        self,
        request="r",
        turn="t",
        agent=None,
        start=1100,
        first=1300,
        end=2100,
        usage=USAGE,
        native=True,
    ):
        identity = {"turn_id": turn, "request_id": request, "agent": agent}
        self.send("request_start", at=start, **identity)
        if first is not None:
            self.send("request_first", at=first, **identity)
        return self.send(
            "request_end",
            at=end,
            payload={"native": native, "usage": usage, "status": "completed"},
            **identity,
        )

    def finish(self, turn="t", agent=None, usage=USAGE):
        self.send(
            "turn_end",
            turn_id=turn,
            agent=agent,
            at=2200,
            payload={"status": "completed"},
        )
        self.send(
            "turn_usage", turn_id=turn, agent=agent, at=2200, payload={"usage": usage}
        )

    def points(self, prompt="p", now=2300):
        return snapshot.resolve(
            store.load(self.root, "s"), self.root, "s", prompt, now_ms=now
        )

    def test_cache_inclusive_tokens_duplicate_ends_and_turn_usage_do_not_double_count(
        self,
    ):
        end = self.request()
        self.finish()
        store.observe(self.root, [end])
        points = self.points()
        self.assertEqual(points["ttft"]["value"], 0.2)
        self.assertEqual(points["output-rate"]["value"], 20)
        self.assertEqual(points["prompt-input-tokens"]["value"], 80)
        self.assertEqual(points["prompt-output-tokens"]["value"], 20)
        self.assertFalse(points["prompt-input-tokens"]["partial"])
        self.assertIsNone(points["prompt-cost"]["value"])
        self.assertEqual(self.points(now=50000)["prompt-input-tokens"]["value"], 80)

    def test_latest_main_request_replaces_timing_but_agents_add_to_task_usage(self):
        self.request()
        self.send("agent_start", agent="a", turn_id="t", at=1250)
        self.send("turn_start", agent="a", turn_id="child", at=1260)
        self.request("child-r", "child", "a", 1300, 1400, 2000)
        self.finish("child", "a")
        self.send("agent_end", agent="a", at=2200)
        self.request("r2", start=2100, first=2100, end=2200)
        totals = {key: value * 2 for key, value in USAGE.items()}
        self.finish(usage=totals)
        points = self.points()
        self.assertEqual(points["ttft"]["value"], 0)
        self.assertEqual(points["output-rate"]["value"], 200)
        self.assertEqual(points["prompt-input-tokens"]["value"], 240)
        self.assertEqual(points["prompt-output-tokens"]["value"], 60)
        self.assertFalse(points["prompt-output-tokens"]["partial"])

    def test_missing_usage_synthetic_stream_and_zero_are_distinct(self):
        zero = dict.fromkeys(model.USAGE_KEYS, 0)
        self.request(usage=zero)
        self.finish(usage=zero)
        self.assertEqual(self.points()["prompt-input-tokens"]["value"], 0)
        self.assertEqual(self.points()["output-rate"]["value"], 0)
        self.request("fake", start=2300, first=None, end=2400, usage=None, native=False)
        points = self.points(now=2500)
        self.assertIsNone(points["ttft"]["value"])
        self.assertIsNone(points["output-rate"]["value"])
        self.assertEqual(points["ttft"]["reason"], "synthetic_response")
        self.assertTrue(points["prompt-input-tokens"]["partial"])

    def test_queued_prompt_and_unowned_auxiliary_do_not_receive_current_usage_or_cost(
        self,
    ):
        self.request()
        self.send("prompt", prompt="queued")
        self.request("aux", "aux", "unknown-workflow")
        self.send(
            "request_cost",
            prompt="queued",
            request_id="server-wrong",
            source="otel",
            payload={"cost_usd": 3, "usage": USAGE},
        )
        self.assertEqual(self.points()["prompt-input-tokens"]["value"], 80)
        self.assertIsNone(self.points("queued")["prompt-input-tokens"]["value"])
        self.assertIsNone(self.points("queued")["prompt-cost"]["value"])

    def test_unbound_child_requests_reconcile_only_after_verified_spawn(self):
        self.send("turn_start", agent="a", turn_id="child")
        self.request("child-r", "child", "a")
        self.assertIsNone(self.points()["prompt-output-tokens"]["value"])
        self.send("agent_start", agent="a", turn_id="t", at=2100)
        self.assertEqual(self.points()["prompt-output-tokens"]["value"], 20)
        self.assertTrue(self.points()["prompt-output-tokens"]["partial"])

    def test_delayed_official_costs_deduplicate_and_unjoined_estimates_are_partial(
        self,
    ):
        self.request()
        self.finish()
        first = self.send(
            "request_cost",
            prompt="p",
            request_id="server-r",
            source="otel",
            payload={"cost_usd": 0, "usage": USAGE},
        )
        store.observe(self.root, [first])
        self.assertEqual(self.points()["prompt-cost"]["value"], 0)
        self.assertTrue(self.points()["prompt-cost"]["partial"])
        self.send(
            "request_cost",
            prompt="p",
            request_id="server-r2",
            source="otel",
            payload={"cost_usd": 0.0123, "usage": USAGE},
        )
        self.assertAlmostEqual(self.points()["prompt-cost"]["value"], 0.0123)
        self.send(
            "request_cost",
            prompt="p",
            request_id="server-r2",
            source="otel",
            payload={"cost_usd": 5, "usage": USAGE},
        )
        self.assertEqual(self.points()["prompt-cost"]["value"], 0)

    def test_clock_reversal_and_turn_reconciliation_mismatch_degrade(self):
        self.request(first=1000)
        self.finish(usage={**USAGE, "output_tokens": 999})
        points = self.points()
        self.assertIsNone(points["ttft"]["value"])
        self.assertIsNone(points["output-rate"]["value"])
        self.assertEqual(points["ttft"]["reason"], "abnormal_clock")
        self.assertEqual(points["prompt-output-tokens"]["value"], 20)
        self.assertTrue(points["prompt-output-tokens"]["partial"])

    def test_request_end_before_start_and_conflicting_duplicate_are_safe(self):
        self.send(
            "request_end",
            request_id="r",
            turn_id="t",
            at=2100,
            payload={"native": True, "usage": USAGE, "status": "completed"},
        )
        self.send("request_first", request_id="r", turn_id="t", at=1300)
        self.send("request_start", request_id="r", turn_id="t", at=1100)
        self.finish()
        self.assertEqual(self.points()["output-rate"]["value"], 20)
        self.send(
            "request_end",
            request_id="r",
            turn_id="t",
            at=2110,
            payload={
                "native": True,
                "usage": {**USAGE, "output_tokens": 999},
                "status": "completed",
            },
        )
        self.assertIsNone(self.points()["prompt-output-tokens"]["value"])
