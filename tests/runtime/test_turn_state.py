#!/usr/bin/env python3
"""Regression tests for prompt-indexed Claude turn lifecycle state."""

from claude_statusline.runtime.turns import model as turn_model
from claude_statusline.runtime.turns import reducer as turn_reducer
from claude_statusline.runtime.turns import store as turn_store

import json
import os
import tempfile
import threading
import unittest
from unittest import mock


BOOT = "test-boot"


def clocks(wall_ns, boot_ns=None, boot_id=BOOT):
    return wall_ns, wall_ns if boot_ns is None else boot_ns, boot_id


class TurnStateTestCase(unittest.TestCase):
    def setUp(self):
        self.tempdir = tempfile.TemporaryDirectory(prefix="turn-state-test-")
        self.runtime = self.tempdir.name
        self.patchers = [
            mock.patch.object(turn_store, "RUNTIME_ROOT", self.runtime),
            mock.patch.object(
                turn_store, "TURN_DIR", os.path.join(self.runtime, "turns")
            ),
        ]
        for patcher in self.patchers:
            patcher.start()

    def tearDown(self):
        for patcher in reversed(self.patchers):
            patcher.stop()
        self.tempdir.cleanup()

    def event(self, sid, prompt_id, name, wall_ns, **extra):
        payload = {
            "session_id": sid,
            "prompt_id": prompt_id,
            "hook_event_name": name,
        }
        payload.update(extra)
        with mock.patch.object(turn_store, "now_clocks", return_value=clocks(wall_ns)):
            result = turn_reducer.handle_event(payload)
            state = turn_store.load_turn_state(sid, prompt_id)
            if (
                name == "Stop"
                and state
                and not state.get("active_agents")
                and not (
                    state.get("prompt_aliases") and state.get("pending_agent_reports")
                )
                and state.get("status") in ("running", "completed")
            ):
                result = turn_reducer.confirm_completion(
                    sid, prompt_id, wall_ns=wall_ns
                )
            return result


class LifecycleTransitionTests(TurnStateTestCase):
    def test_normal_prompt_duplicate_submit_and_stop(self):
        self.event("s", "A", "UserPromptSubmit", 1_000_000_000)
        self.event("s", "A", "UserPromptSubmit", 2_000_000_000)
        running = turn_store.load_turn_state("s", "A")
        self.assertEqual(running["started_wall_ns"], 1_000_000_000)
        self.assertEqual(running["status"], "running")

        self.event("s", "A", "Stop", 11_000_000_000)
        completed = turn_store.load_turn_state("s", "A")
        self.assertEqual(completed["status"], "completed")
        self.assertEqual(completed["end_source"], "native_turn_end")
        self.assertEqual(completed["ended_wall_ns"], 11_000_000_000)

    def test_stop_without_submit_isolated_from_newer_current_turn(self):
        self.event("s", "A", "UserPromptSubmit", 1_000_000_000)
        self.event("s", "B", "Stop", 10_000_000_000)
        self.assertEqual(turn_store.load_turn_state("s", "B")["status"], "completed")
        self.assertIsNone(turn_store.load_turn_state("s", "B")["started_wall_ns"])

        turn_reducer.reconcile_transcript_events(
            "s",
            [
                {
                    "kind": "prompt",
                    "prompt_id": "C",
                    "wall_ns": 20_000_000_000,
                }
            ],
        )
        self.event("s", "A", "Stop", 30_000_000_000)
        store = turn_store.load_turn_store("s")
        self.assertEqual(store["current_prompt_id"], "C")
        self.assertEqual(turn_store.load_turn_state("s", "C")["status"], "running")

    def test_queue_interrupt_then_new_prompt_targets_by_chronology(self):
        self.event("s", "A", "UserPromptSubmit", 1_000_000_000)
        turn_reducer.reconcile_transcript_events(
            "s",
            [
                {"kind": "prompt", "prompt_id": "A", "wall_ns": 1_000_000_000},
                {"kind": "interrupt", "prompt_id": "B", "wall_ns": 9_972_000_000},
                {"kind": "prompt", "prompt_id": "B", "wall_ns": 10_000_000_000},
            ],
        )
        self.assertEqual(turn_store.load_turn_state("s", "A")["status"], "interrupted")
        self.assertEqual(
            turn_store.load_turn_state("s", "A")["ended_wall_ns"], 9_972_000_000
        )
        self.assertEqual(turn_store.load_turn_state("s", "B")["status"], "running")
        self.assertEqual(turn_store.load_turn_store("s")["current_prompt_id"], "B")

    def test_stop_failure_outranks_lower_priority_transcript_completion(self):
        self.event("s", "A", "UserPromptSubmit", 1_000_000_000)
        self.event("s", "A", "StopFailure", 5_000_000_000, error="rate_limit")
        turn_reducer.reconcile_transcript_events(
            "s",
            [
                {
                    "kind": "turn_duration",
                    "wall_ns": 6_000_000_000,
                    "duration_ms": 5000,
                }
            ],
        )
        record = turn_store.load_turn_state("s", "A")
        self.assertEqual(record["status"], "failed")
        self.assertEqual(record["end_source"], "hook_stop_failure")
        self.assertEqual(record["error"], "rate_limit")

    def test_idle_fallback_completes_after_assistant_and_withdraws_without_one(self):
        turn_reducer.reconcile_transcript_events(
            "complete",
            [
                {"kind": "prompt", "prompt_id": "A", "wall_ns": 1_000_000_000},
                {"kind": "assistant", "wall_ns": 4_000_000_000},
            ],
        )
        turn_reducer.reconcile_idle_state("complete", "A", 5_000_000_000)
        self.assertEqual(
            turn_store.load_turn_state("complete", "A")["status"], "completed"
        )
        self.assertEqual(
            turn_store.load_turn_state("complete", "A")["end_source"], "registry_idle"
        )

        turn_reducer.reconcile_transcript_events(
            "withdraw",
            [
                {
                    "kind": "prompt",
                    "prompt_id": "B",
                    "wall_ns": 10_000_000_000,
                }
            ],
        )
        turn_reducer.reconcile_idle_state("withdraw", "B", 11_000_000_000)
        self.assertEqual(
            turn_store.load_turn_state("withdraw", "B")["status"], "withdrawn"
        )

    def test_local_command_does_not_end_the_real_running_turn(self):
        turn_reducer.reconcile_transcript_events(
            "s",
            [
                {"kind": "prompt", "prompt_id": "A", "wall_ns": 1_000_000_000},
                {"kind": "local_command", "prompt_id": "L", "wall_ns": 2_000_000_000},
            ],
        )
        self.assertEqual(turn_store.load_turn_state("s", "A")["status"], "running")
        self.assertEqual(turn_store.load_turn_state("s", "L")["status"], "ignored")
        self.assertEqual(turn_store.load_turn_store("s")["current_prompt_id"], "A")

    def test_resume_marks_only_current_running_turn_unknown(self):
        self.event("s", "A", "UserPromptSubmit", 1_000_000_000)
        self.event(
            "s",
            "A",
            "SessionStart",
            5_000_000_000,
            source="resume",
            transcript_path="/does/not/exist",
        )
        record = turn_store.load_turn_state("s", "A")
        self.assertEqual(record["status"], "unknown")
        self.assertEqual(record["end_source"], "session_start")


class MigrationAndStorageTests(TurnStateTestCase):
    def test_schema_one_state_and_previous_running_migrate_losslessly(self):
        legacy = {
            "schema": 1,
            "session_id": "s",
            "prompt_id": "L",
            "status": "ignored",
            "started_wall_ns": 2_000_000_000,
            "started_boot_ns": None,
            "ended_wall_ns": 3_000_000_000,
            "ended_boot_ns": None,
            "boot_id": None,
            "end_reason": "local_command",
            "error": None,
            "updated_wall_ns": 3_000_000_000,
            "previous_running": {
                "prompt_id": "A",
                "status": "running",
                "started_wall_ns": 1_000_000_000,
                "started_boot_ns": None,
                "ended_wall_ns": None,
                "ended_boot_ns": None,
                "boot_id": None,
                "end_reason": None,
                "error": None,
                "updated_wall_ns": 1_000_000_000,
            },
        }
        turn_store._atomic_write("s", legacy)
        store = turn_store.load_turn_store("s")
        self.assertEqual({item["prompt_id"] for item in store["turns"]}, {"A", "L"})

        self.event("s", "A", "Stop", 4_000_000_000)
        with open(turn_store._state_path("s"), "r", encoding="utf-8") as stream:
            published = json.load(stream)
        self.assertEqual(published["schema"], 1)
        self.assertEqual(published["lifecycle"]["schema"], 4)
        self.assertEqual(published["prompt_id"], "A")
        self.assertEqual(published["status"], "completed")

    def test_corrupt_file_repairs_on_next_event(self):
        os.makedirs(turn_store.TURN_DIR, exist_ok=True)
        with open(turn_store._state_path("s"), "w", encoding="utf-8") as stream:
            stream.write("not json")
        self.event("s", "A", "UserPromptSubmit", 1_000_000_000)
        self.assertEqual(turn_store.load_turn_state("s", "A")["status"], "running")

    def test_newer_schema_one_mirror_is_merged_after_code_rollback(self):
        self.event("s", "A", "UserPromptSubmit", 1_000_000_000)
        self.event("s", "A", "Stop", 2_000_000_000)
        with open(turn_store._state_path("s"), "r", encoding="utf-8") as stream:
            rolled_back = json.load(stream)
        rolled_back.update(
            {
                "prompt_id": "B",
                "status": "running",
                "started_wall_ns": 3_000_000_000,
                "started_boot_ns": None,
                "ended_wall_ns": None,
                "ended_boot_ns": None,
                "boot_id": None,
                "end_reason": None,
                "error": None,
                "updated_wall_ns": 3_000_000_000,
            }
        )
        turn_store._atomic_write("s", rolled_back)

        store = turn_store.load_turn_store("s")
        self.assertEqual(store["current_prompt_id"], "B")
        self.assertEqual(turn_store.load_turn_state("s", "B")["status"], "running")
        self.assertEqual(turn_store.load_turn_state("s", "A")["status"], "completed")

    def test_ledger_is_bounded_and_concurrent_updates_publish_valid_json(self):
        barrier = threading.Barrier(4)

        def writer(offset):
            barrier.wait()
            for index in range(20):
                prompt_id = f"{offset}-{index}"
                wall = (offset * 100 + index + 1) * 1_000_000_000
                turn_reducer.reconcile_transcript_events(
                    "shared",
                    [
                        {"kind": "prompt", "prompt_id": prompt_id, "wall_ns": wall},
                        {
                            "kind": "turn_duration",
                            "wall_ns": wall + 100_000_000,
                            "duration_ms": 100,
                        },
                    ],
                )

        threads = [threading.Thread(target=writer, args=(index,)) for index in range(4)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join()

        store = turn_store.load_turn_store("shared")
        self.assertLessEqual(len(store["turns"]), turn_model.MAX_TURNS_PER_SESSION)
        with open(turn_store._state_path("shared"), "r", encoding="utf-8") as stream:
            self.assertIsInstance(json.load(stream), dict)

        self.event("other", "X", "UserPromptSubmit", 1_000_000_000)
        self.assertEqual(turn_store.load_turn_state("other", "X")["status"], "running")
        self.assertIsNone(turn_store.load_turn_state("other", "0-19"))


if __name__ == "__main__":
    unittest.main(verbosity=2)
