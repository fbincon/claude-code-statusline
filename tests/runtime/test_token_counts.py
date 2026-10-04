"""Raw integer snapshots preserve existing usage accounting and availability."""

import json
from pathlib import Path
import tempfile
import unittest
from unittest import mock

from claude_statusline.runtime import paths, usage
from tests.support import render_main_items as render


def assistant(mid, i=0, cc=0, cr=0, out=0):
    return {
        "type": "assistant",
        "message": {
            "id": mid,
            "usage": {
                "input_tokens": i,
                "cache_creation_input_tokens": cc,
                "cache_read_input_tokens": cr,
                "output_tokens": out,
            },
        },
    }


class RawTokenCountsTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="raw-tokens-")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.transcript = self.root / "session.jsonl"
        for key, value in (
            ("STATEFILE", self.root / "state.json"),
            ("STATE_LOCKFILE", self.root / "state.json.lock"),
        ):
            patcher = mock.patch.object(paths, key, str(value))
            patcher.start()
            self.addCleanup(patcher.stop)
        self.data = {"session_id": "fixture", "transcript_path": str(self.transcript)}

    def write(self, rows, path=None, mode="w"):
        target = self.transcript if path is None else path
        target.parent.mkdir(parents=True, exist_ok=True)
        with target.open(mode, encoding="utf-8") as stream:
            for row in rows:
                stream.write(json.dumps(row) + "\n")

    def counts(self):
        return usage.session_token_counts(usage.session_token_totals(self.data)[4])

    def test_input_is_summed_before_formatting_and_one_collection_is_shared(self):
        self.write([assistant("m", i=1059, cr=1059, out=19)])
        with mock.patch.object(
            usage, "session_token_totals", wraps=usage.session_token_totals
        ) as collect:
            self.assertEqual(
                render(self.data, "tokens", "input-tokens", "output-tokens"),
                "hit 1.1K · miss 1.1K · out 19 · in 2.1K · out 19",
            )
            collect.assert_called_once()
        snapshot = self.counts()
        self.assertEqual(
            (snapshot.hit, snapshot.miss, snapshot.input_tokens, snapshot.out),
            (1059, 1059, 2118, 19),
        )

    def test_agents_duplicates_resumes_and_incremental_output_keep_same_scope(self):
        self.write([assistant("main", i=1200, cc=300, cr=5000, out=250)])
        agent = self.root / "session" / "subagents" / "nested" / "agent-a.jsonl"
        self.write(
            [
                assistant("agent", i=100, cc=200, cr=300, out=0),
                assistant("agent", i=100, cc=200, cr=300, out=40),
            ],
            path=agent,
        )
        self.assertEqual((self.counts().input_tokens, self.counts().out), (7100, 290))
        self.write([assistant("main", i=1200, cc=300, cr=5000, out=250)], mode="a")
        self.assertEqual((self.counts().input_tokens, self.counts().out), (7100, 290))
        resumed = self.root / "resumed.jsonl"
        self.write([assistant("main", i=1200, cc=300, cr=5000, out=250)], path=resumed)
        self.data["transcript_path"] = str(resumed)
        self.assertEqual((self.counts().input_tokens, self.counts().out), (7100, 290))

    def test_authoritative_cost_snapshot_and_post_snapshot_delta_use_raw_integers(self):
        self.write(
            [
                assistant("before", i=5, out=1),
                {
                    "type": "cost-state",
                    "modelUsage": {
                        "model": {
                            "inputTokens": 10000,
                            "cacheCreationInputTokens": 20000,
                            "cacheReadInputTokens": 30000,
                            "outputTokens": 1000,
                        }
                    },
                },
                assistant("after", i=1, cc=2, cr=3, out=4),
            ]
        )
        self.assertEqual((self.counts().input_tokens, self.counts().out), (60006, 1004))
        self.assertEqual((self.counts().input_tokens, self.counts().out), (60006, 1004))

    def test_missing_empty_and_invalid_transcripts_are_unavailable_but_zero_is_observed(
        self,
    ):
        self.assertEqual(render(self.data, "input-tokens", "output-tokens"), "")
        self.write([])
        self.assertEqual(render(self.data, "input-tokens", "output-tokens"), "")
        self.write(
            [
                {
                    "type": "assistant",
                    "message": {
                        "id": "invalid",
                        "usage": {"input_tokens": True, "output_tokens": "8"},
                    },
                },
                {"type": "cost-state", "modelUsage": {"model": {}}},
            ]
        )
        self.assertEqual(render(self.data, "input-tokens", "output-tokens"), "")
        self.write([assistant("zero")], mode="a")
        self.assertEqual(
            render(self.data, "input-tokens", "output-tokens"), "in 0 · out 0"
        )

    def test_raw_snapshot_has_no_io_and_invalid_empty_state_has_no_counts(self):
        for entry in (None, {}, {"ids": {}, "base": {"i": 0}}, {"ids": {"bad": {}}}):
            self.assertIsNone(usage.session_token_counts(entry))
        with mock.patch.object(
            usage.runtime_cache,
            "_acquire_state_lock",
            side_effect=AssertionError("I/O"),
        ):
            snapshot = usage.session_token_counts(
                {"ids": {"m": {"i": 3, "o": 4, "cc": 5, "cr": 6}}}
            )
        self.assertEqual((snapshot.input_tokens, snapshot.out), (14, 4))

    def test_collected_raw_snapshot_reuses_aggregation_without_changing_persistence(
        self,
    ):
        self.write([assistant("m", i=3, cc=5, cr=6, out=4)])
        result = usage.session_token_totals(self.data)
        with mock.patch.object(
            usage,
            "_aggregate_visible",
            side_effect=AssertionError("repeat aggregation"),
        ):
            self.assertEqual(usage.session_token_counts(result[4]).input_tokens, 14)
        state = json.loads((self.root / "state.json").read_text(encoding="utf-8"))
        self.assertNotIn("_raw_token_counts", state["sessions"]["fixture"])

    def test_partial_usage_does_not_fabricate_the_missing_counter_as_zero(self):
        self.write(
            [
                {
                    "type": "assistant",
                    "message": {"id": "output-only", "usage": {"output_tokens": 9}},
                }
            ]
        )
        for _ in range(2):
            self.assertEqual(
                render(self.data, "input-tokens", "output-tokens"), "out 9"
            )

    def test_input_only_zero_does_not_imply_output_was_observed(self):
        self.write(
            [
                {
                    "type": "assistant",
                    "message": {"id": "input-only", "usage": {"input_tokens": 0}},
                }
            ]
        )
        for _ in range(2):
            self.assertEqual(render(self.data, "input-tokens", "output-tokens"), "in 0")

    def test_partial_cost_snapshot_keeps_counter_availability_separate(self):
        self.write(
            [{"type": "cost-state", "modelUsage": {"model": {"outputTokens": 0}}}]
        )
        for _ in range(2):
            self.assertEqual(
                render(self.data, "input-tokens", "output-tokens"), "out 0"
            )

    def test_invalid_input_does_not_become_an_observed_zero(self):
        for invalid in (None, True, -1, "8", float("nan"), float("inf"), []):
            with self.subTest(invalid=invalid):
                self.data["session_id"] = repr(invalid)
                self.write(
                    [
                        {
                            "type": "assistant",
                            "message": {
                                "id": "partial",
                                "usage": {"input_tokens": invalid, "output_tokens": 0},
                            },
                        }
                    ]
                )
                self.assertEqual(
                    render(self.data, "input-tokens", "output-tokens"), "out 0"
                )

    def test_later_zero_observation_fills_only_the_missing_counter(self):
        self.write(
            [
                {
                    "type": "assistant",
                    "message": {"id": "partial", "usage": {"output_tokens": 9}},
                }
            ]
        )
        self.assertEqual(render(self.data, "input-tokens", "output-tokens"), "out 9")
        self.write(
            [
                {
                    "type": "assistant",
                    "message": {
                        "id": "partial",
                        "usage": {"cache_read_input_tokens": 0},
                    },
                }
            ],
            mode="a",
        )
        self.assertEqual(
            render(self.data, "input-tokens", "output-tokens"), "in 0 · out 9"
        )

    def test_legacy_zero_observations_are_recovered_once_without_changing_totals(self):
        self.write(
            [
                {
                    "type": "assistant",
                    "message": {"id": "main", "usage": {"input_tokens": 0}},
                }
            ]
        )
        agent = self.root / "session" / "subagents" / "agent-a.jsonl"
        self.write(
            [
                {
                    "type": "assistant",
                    "message": {"id": "agent", "usage": {"output_tokens": 0}},
                }
            ],
            path=agent,
        )
        self.counts()
        state_path = self.root / "state.json"
        state = json.loads(state_path.read_text(encoding="utf-8"))
        entry = state["sessions"]["fixture"]
        entry.pop("token_observed")
        entry["usage_scan_version"] = 2
        state_path.write_text(json.dumps(state), encoding="utf-8")
        self.assertEqual(
            render(self.data, "input-tokens", "output-tokens"), "in 0 · out 0"
        )
        with mock.patch.object(
            usage.runtime_transcript,
            "_read_transcript_chunk",
            side_effect=AssertionError("repeat scan"),
        ):
            self.assertEqual(
                render(self.data, "input-tokens", "output-tokens"), "in 0 · out 0"
            )
        self.assertEqual(
            json.loads(state_path.read_text())["sessions"]["fixture"]["ids"],
            entry["ids"],
        )

    def test_observed_zero_survives_collapsing_ids_and_missing_transcripts(self):
        self.write(
            [
                {
                    "type": "assistant",
                    "message": {"id": mid, "usage": {"output_tokens": 0}},
                }
                for mid in ("a", "b")
            ]
        )
        with mock.patch.object(paths, "MAX_IDS_PER_SESSION", 1):
            self.assertEqual(
                render(self.data, "input-tokens", "output-tokens"), "out 0"
            )
        self.transcript.unlink()
        self.assertEqual(render(self.data, "input-tokens", "output-tokens"), "out 0")

    def test_partial_cost_snapshot_preserves_the_other_visible_counter(self):
        self.write(
            [
                {
                    "type": "assistant",
                    "message": {"id": "input", "usage": {"input_tokens": 5}},
                },
                {"type": "cost-state", "modelUsage": {"model": {"outputTokens": 9}}},
            ]
        )
        for _ in range(2):
            self.assertEqual(
                render(self.data, "input-tokens", "output-tokens"), "in 5 · out 9"
            )

    def test_partial_cost_snapshot_preserves_the_other_authoritative_counter(self):
        self.write(
            [{"type": "cost-state", "modelUsage": {"model": {"outputTokens": 9}}}]
        )
        self.assertEqual(render(self.data, "input-tokens", "output-tokens"), "out 9")
        self.write(
            [{"type": "cost-state", "modelUsage": {"model": {"inputTokens": 5}}}],
            mode="a",
        )
        for _ in range(2):
            self.assertEqual(
                render(self.data, "input-tokens", "output-tokens"), "in 5 · out 9"
            )

    def test_partial_snapshots_in_one_batch_keep_each_counters_live_delta(self):
        self.write(
            [
                {
                    "type": "cost-state",
                    "modelUsage": {"model": {"inputTokens": 10, "outputTokens": 20}},
                },
                assistant("between", i=2, out=3),
                {"type": "cost-state", "modelUsage": {"model": {"inputTokens": 12}}},
                assistant("after", i=1, out=4),
            ]
        )
        for _ in range(2):
            self.assertEqual((self.counts().input_tokens, self.counts().out), (13, 27))

    def test_partial_snapshots_attribute_subagent_deltas_per_counter(self):
        self.write(
            [
                {
                    "type": "cost-state",
                    "timestamp": "2026-10-04T10:00:01Z",
                    "modelUsage": {"model": {"outputTokens": 20}},
                },
                {
                    "type": "cost-state",
                    "timestamp": "2026-10-04T10:00:03Z",
                    "modelUsage": {"model": {"inputTokens": 10}},
                },
            ]
        )
        agent = self.root / "session" / "subagents" / "agent-a.jsonl"
        self.write(
            [
                dict(
                    assistant("between", i=2, out=3), timestamp="2026-10-04T10:00:02Z"
                ),
                dict(assistant("after", i=1, out=4), timestamp="2026-10-04T10:00:04Z"),
            ],
            path=agent,
        )
        for _ in range(2):
            self.assertEqual((self.counts().input_tokens, self.counts().out), (11, 27))


if __name__ == "__main__":
    unittest.main()
