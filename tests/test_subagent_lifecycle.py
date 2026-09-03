"""End-to-end prompt lifecycle tests for ordinary Claude subagents."""

import json
import os
import tempfile
import threading
import unittest
from unittest import mock

from claude_statusline import statusline as sl
from claude_statusline import turn_state as ts


class LifecycleTestCase(unittest.TestCase):
    def setUp(self):
        self.tempdir = tempfile.TemporaryDirectory(prefix="subagent-life-")
        self.runtime = self.tempdir.name
        self.patchers = [
            mock.patch.object(ts, "RUNTIME_ROOT", self.runtime),
            mock.patch.object(ts, "TURN_DIR", os.path.join(self.runtime, "turns")),
        ]
        for patcher in self.patchers:
            patcher.start()

    def tearDown(self):
        for patcher in reversed(self.patchers):
            patcher.stop()
        self.tempdir.cleanup()

    def event(self, name, wall_ns, prompt_id="p", **extra):
        payload = {
            "session_id": "s",
            "prompt_id": prompt_id,
            "hook_event_name": name,
        }
        payload.update(extra)
        with mock.patch.object(
            ts, "now_clocks", return_value=(wall_ns, wall_ns, "boot")
        ):
            ts.handle_event(payload)
        return ts.load_turn_state("s", prompt_id)


class AgentLedgerTests(LifecycleTestCase):
    def test_duplicate_parallel_and_out_of_order_agent_hooks(self):
        self.event("UserPromptSubmit", 1)
        self.event("SubagentStart", 2, agent_id="a", agent_type="Explore")
        self.event("SubagentStart", 9, agent_id="a", agent_type="Changed")
        state = self.event(
            "SubagentStart", 3, agent_id="b", agent_type="Reviewer"
        )
        self.assertEqual(state["active_agents"]["a"]["started_wall_ns"], 2)
        self.assertEqual(state["active_agents"]["a"]["agent_type"], "Explore")
        self.assertTrue(state["had_subagents"])

        state = self.event("Stop", 4)
        self.assertEqual(state["phase"], "waiting_subagents")
        self.assertEqual(set(state["active_agents"]), {"a", "b"})
        self.event("SubagentStop", 5, agent_id="missing")
        self.event("SubagentStop", 6, agent_id="b")
        state = self.event("SubagentStop", 7, agent_id="a")
        self.assertEqual(state["phase"], "resuming_main")
        self.assertEqual(state["active_agents"], {})

    def test_missing_start_and_agent_internal_events_do_not_create_or_finish(self):
        self.event("UserPromptSubmit", 1)
        self.event("SubagentStop", 2, agent_id="unknown")
        state = self.event("Stop", 3, agent_id="child")
        self.assertEqual(state["status"], "running")
        self.assertFalse(state["had_subagents"])
        self.assertEqual(ts.load_turn_state("s", "missing"), None)
        self.event(
            "SubagentStart", 4, prompt_id="missing", agent_id="orphan"
        )
        self.assertIsNone(ts.load_turn_state("s", "missing"))

    def test_prompt_id_falls_back_to_current_for_agent_hooks(self):
        self.event("UserPromptSubmit", 1)
        payload = {
            "session_id": "s",
            "hook_event_name": "SubagentStart",
            "agent_id": "a",
            "agent_type": "Explore",
        }
        with mock.patch.object(ts, "now_clocks", return_value=(2, 2, "boot")):
            ts.handle_event(payload)
        self.assertIn("a", ts.load_turn_state("s", "p")["active_agents"])


class MainStopTests(LifecycleTestCase):
    def test_authoritative_snapshot_filters_non_agents_and_can_reopen(self):
        self.event("UserPromptSubmit", 1)
        ts.reconcile_transcript_events(
            "s",
            [{"kind": "turn_duration", "wall_ns": 3, "duration_ms": 2}],
        )
        self.assertEqual(ts.load_turn_state("s", "p")["status"], "completed")
        state = self.event(
            "Stop",
            4,
            background_tasks=[
                {"id": "agent", "type": "subagent", "name": "Explore"},
                {"id": "shell", "type": "shell"},
                {"id": "server", "type": "server"},
                {"id": "monitor", "type": "monitor"},
                {"id": "workflow", "type": "workflow"},
            ],
        )
        self.assertEqual(state["status"], "running")
        self.assertEqual(state["phase"], "waiting_subagents")
        self.assertEqual(set(state["active_agents"]), {"agent"})
        self.assertIsNone(state["duration_ns"])

        state = self.event("Stop", 11, background_tasks=[])
        self.assertEqual(state["status"], "completed")
        self.assertEqual(state["ended_wall_ns"], 11)
        self.assertEqual(state["active_agents"], {})

    def test_missing_snapshot_uses_hook_ledger_and_empty_snapshot_finishes(self):
        self.event("UserPromptSubmit", 1)
        self.event("SubagentStart", 2, agent_id="a")
        state = self.event("Stop", 3)
        self.assertEqual(set(state["active_agents"]), {"a"})
        state = self.event("Stop", 4, background_tasks=[])
        self.assertEqual(state["status"], "completed")

    def test_resuming_waits_for_main_stop_and_suppresses_inference(self):
        self.event("UserPromptSubmit", 1_000_000_000)
        self.event("SubagentStart", 2_000_000_000, agent_id="a")
        self.event("Stop", 3_000_000_000)
        state = self.event("SubagentStop", 4_000_000_000, agent_id="a")
        self.assertEqual(state["phase"], "resuming_main")

        ts.reconcile_idle_state("s", "p", 5_000_000_000)
        state = ts.load_turn_state("s", "p")
        self.assertEqual(state["status"], "running")
        self.assertEqual(state["phase"], "resuming_main")

        ts.reconcile_transcript_events(
            "s",
            [{
                "kind": "turn_duration",
                "wall_ns": 6_000_000_000,
                "duration_ms": 100,
            }],
        )
        state = ts.load_turn_state("s", "p")
        self.assertEqual(state["status"], "running")
        self.assertEqual(state["phase"], "main")
        self.assertIsNone(state["duration_ns"])

        state = self.event("Stop", 9_000_000_000, background_tasks=[])
        self.assertEqual(state["status"], "completed")
        self.assertIsNone(state["duration_ns"])

    def test_strong_terminal_states_cannot_be_reopened(self):
        for event, expected in (
            ("StopFailure", "failed"),
            ("SessionEnd", "interrupted"),
        ):
            with self.subTest(event=event):
                self.tearDown()
                self.setUp()
                self.event("UserPromptSubmit", 1)
                if event == "StopFailure":
                    self.event(event, 2, error="boom")
                else:
                    self.event(event, 2, reason="logout")
                state = self.event(
                    "Stop",
                    3,
                    background_tasks=[{"id": "a", "type": "subagent"}],
                )
                self.assertEqual(state["status"], expected)
                self.assertEqual(state["active_agents"], {})

    def test_new_prompt_marks_old_unknown_and_clears_agents(self):
        self.event("UserPromptSubmit", 1, prompt_id="old")
        self.event("SubagentStart", 2, prompt_id="old", agent_id="a")
        self.event("UserPromptSubmit", 3, prompt_id="new")
        old = ts.load_turn_state("s", "old")
        new = ts.load_turn_state("s", "new")
        self.assertEqual(old["status"], "unknown")
        self.assertEqual(old["active_agents"], {})
        self.assertEqual(new["phase"], "main")
        self.assertFalse(new["had_subagents"])


class MigrationConcurrencyAndRenderingTests(LifecycleTestCase):
    def test_lifecycle_schema_two_migrates_to_three(self):
        state = {
            "schema": 1,
            "session_id": "s",
            "prompt_id": "p",
            "status": "running",
            "started_wall_ns": 1,
            "updated_wall_ns": 1,
            "lifecycle": {
                "schema": 2,
                "session_id": "s",
                "current_prompt_id": "p",
                "updated_wall_ns": 1,
                "turns": [{
                    "prompt_id": "p",
                    "status": "running",
                    "started_wall_ns": 1,
                    "updated_wall_ns": 1,
                }],
            },
        }
        os.makedirs(ts.TURN_DIR)
        with open(ts._state_path("s"), "w", encoding="utf-8") as stream:
            json.dump(state, stream)
        self.event("SubagentStart", 2, agent_id="a")
        with open(ts._state_path("s"), encoding="utf-8") as stream:
            published = json.load(stream)
        self.assertEqual(published["schema"], 1)
        self.assertEqual(published["lifecycle"]["schema"], 3)
        self.assertTrue(published["had_subagents"])

    def test_concurrent_agent_starts_publish_valid_complete_ledger(self):
        self.event("UserPromptSubmit", 1)
        barrier = threading.Barrier(8)
        errors = []

        def start(index):
            try:
                barrier.wait()
                self.event(
                    "SubagentStart",
                    index + 2,
                    agent_id=f"agent-{index}",
                )
            except Exception as exc:  # noqa: BLE001 - surfaced in parent test
                errors.append(exc)

        threads = [threading.Thread(target=start, args=(index,)) for index in range(8)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(timeout=5)
        self.assertEqual(errors, [])
        state = ts.load_turn_state("s", "p")
        self.assertEqual(len(state["active_agents"]), 8)
        with open(ts._state_path("s"), encoding="utf-8") as stream:
            self.assertIsInstance(json.load(stream), dict)

    def test_timer_phase_text_and_singular_plural(self):
        base = {
            "status": "running",
            "started_wall_ns": 1_000_000_000,
            "started_boot_ns": 1_000_000_000,
            "boot_id": "boot",
        }
        with mock.patch.object(
            sl, "now_clocks", return_value=(5_000_000_000, 5_000_000_000, "boot")
        ):
            one = sl._render_state_timer(
                dict(base, phase="waiting_subagents", active_agents={"a": {}}),
                None,
                sl.NO_COLOR_PALETTE,
            )
            two = sl._render_state_timer(
                dict(
                    base,
                    phase="waiting_subagents",
                    active_agents={"a": {}, "b": {}},
                ),
                None,
                sl.NO_COLOR_PALETTE,
            )
            wrap = sl._render_state_timer(
                dict(base, phase="resuming_main", active_agents={}),
                None,
                sl.NO_COLOR_PALETTE,
            )
        self.assertEqual(one, "⏳ 1 agent · 0m 04s")
        self.assertEqual(two, "⏳ 2 agents · 0m 04s")
        self.assertEqual(wrap, "⏳ main wrap-up · 0m 04s")


if __name__ == "__main__":
    unittest.main(verbosity=2)
