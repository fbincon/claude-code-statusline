"""Ordering regressions for task timing, terminal evidence and prompt ownership."""

from claude_statusline.rendering import timer as rendering_timer
from claude_statusline.runtime import transcript as runtime_transcript
from claude_statusline.runtime.turns import reducer as turn_reducer
from claude_statusline.runtime.turns import store as turn_store

import math
from unittest import mock

from tests.runtime.test_statusline_timer import (
    TimerTestCase,
    assistant_line,
    duration_line,
    plain,
    prompt_line,
)


class TaskDurationRegressions(TimerTestCase):
    def event(self, name, second, prompt="p", **extra):
        return self.hook("s", prompt, name, int(second * 1e9), **extra)

    def task(self):
        self.event("UserPromptSubmit", 1)
        self.event("SubagentStart", 2, agent_id="a")
        self.event("Stop", 3)
        self.event("SubagentStop", 4, agent_id="a")

    def duration(self, second, milliseconds=1000, prompt="p"):
        turn_reducer.reconcile_transcript_events(
            "s",
            [
                {
                    "kind": "turn_duration",
                    "prompt_id": prompt,
                    "wall_ns": int(second * 1e9),
                    "duration_ms": milliseconds,
                }
            ],
        )

    def test_multi_agent_duration_before_and_after_final_stop(self):
        self.task()
        self.duration(5)
        self.event("Stop", 9, background_tasks=[])
        self.assertEqual(
            plain(
                rendering_timer._render_state_timer(
                    turn_store.load_turn_state("s", "p"), None
                )
            ),
            "✓ 0m 08s",
        )
        self.duration(10)
        self.duration(11, 2000)
        state = turn_store.load_turn_state("s", "p")
        self.assertEqual(state["duration_ns"], 8_000_000_000)
        self.assertEqual(
            plain(rendering_timer._render_state_timer(state, None)), "✓ 0m 08s"
        )

    def test_main_resumption_does_not_enable_weak_completion(self):
        self.task()
        turn_reducer.reconcile_transcript_events(
            "s",
            [
                {
                    "kind": "assistant",
                    "prompt_id": "p",
                    "wall_ns": 5_000_000_000,
                }
            ],
        )
        self.assertEqual(turn_store.load_turn_state("s", "p")["phase"], "main")
        self.duration(6)
        turn_reducer.reconcile_idle_state("s", "p", 7_000_000_000)
        turn_reducer.record_prompt_withdrawal("s", "p", 8_000_000_000)
        state = turn_store.load_turn_state("s", "p")
        self.assertEqual(state["status"], "running")
        self.assertIsNone(state["ended_wall_ns"])

    def test_missing_agent_start_still_protects_duration(self):
        self.event("UserPromptSubmit", 1)
        self.event("SubagentStop", 4, agent_id="a")
        self.duration(5)
        self.assertEqual(turn_store.load_turn_state("s", "p")["status"], "running")
        self.event("Stop", 9, background_tasks=[])
        self.duration(10)
        self.assertEqual(
            turn_store.load_turn_state("s", "p")["duration_ns"], 8_000_000_000
        )

    def test_interruption_and_failure_are_frozen_after_late_duration(self):
        for ending, expected in (
            ("SessionEnd", "interrupted"),
            ("StopFailure", "failed"),
        ):
            with self.subTest(ending=ending):
                self.event("UserPromptSubmit", 1, ending)
                self.event(ending, 9, ending, reason="logout", error="boom")
                before = turn_store.load_turn_state("s", ending)
                self.duration(10, prompt=ending)
                after = turn_store.load_turn_state("s", ending)
                self.assertEqual(after, before)
                self.assertEqual(after["status"], expected)
                self.assertEqual(after["duration_ns"], 8_000_000_000)

    def test_transcript_interrupt_outranks_duration_in_both_orders(self):
        for duration_first in (True, False):
            with self.subTest(duration_first=duration_first):
                prompt = str(duration_first)
                self.event("UserPromptSubmit", 1, prompt)
                if duration_first:
                    self.duration(10, prompt=prompt)
                turn_reducer.record_interrupt("s", prompt, 9_000_000_000)
                if not duration_first:
                    self.duration(10, prompt=prompt)
                state = turn_store.load_turn_state("s", prompt)
                self.assertEqual(state["status"], "interrupted")
                self.assertEqual(state["duration_ns"], 8_000_000_000)

    def test_failure_after_inferred_completion_uses_task_elapsed(self):
        self.event("UserPromptSubmit", 1)
        self.duration(5)
        self.event("StopFailure", 9, error="boom")
        self.assertEqual(
            turn_store.load_turn_state("s", "p")["duration_ns"], 8_000_000_000
        )

    def test_duplicate_terminal_hooks_and_native_calibration_are_idempotent(self):
        self.event("UserPromptSubmit", 1)
        self.event("Stop", 9, background_tasks=[])
        self.duration(10, 1500)
        before = turn_store.load_turn_state("s", "p")
        self.event("Stop", 20, background_tasks=[])
        self.duration(21, 2500)
        self.assertEqual(turn_store.load_turn_state("s", "p"), before)
        self.assertEqual(before["duration_ns"], 8_000_000_000)

    def test_single_turn_native_length_does_not_replace_final_task_elapsed(self):
        self.event("UserPromptSubmit", 1)
        self.duration(7, 1500)
        self.event("Stop", 9, background_tasks=[])
        self.assertEqual(
            turn_store.load_turn_state("s", "p")["duration_ns"], 8_000_000_000
        )

    def test_parallel_agents_and_local_command_keep_task_boundary(self):
        self.task()
        self.event("SubagentStart", 5, agent_id="b")
        self.event("SubagentStart", 6, agent_id="b")
        self.event("Stop", 7)
        turn_reducer.record_local_command("s", "local", 8_000_000_000)
        self.event("SubagentStop", 9, agent_id="b")
        self.event("SubagentStop", 10, agent_id="b")
        self.duration(11)
        self.assertEqual(turn_store.load_turn_state("s", "p")["status"], "running")
        self.event("Stop", 12, background_tasks=[])
        self.assertEqual(
            turn_store.load_turn_state("s", "p")["duration_ns"], 11_000_000_000
        )
        self.assertEqual(turn_store.load_turn_state("s", "local")["status"], "ignored")

    def test_late_agent_start_reopens_only_inferred_completion(self):
        self.event("UserPromptSubmit", 1)
        self.duration(3)
        self.event("SubagentStart", 4, agent_id="a")
        state = turn_store.load_turn_state("s", "p")
        self.assertEqual(state["status"], "running")
        self.assertTrue(state["had_subagents"])
        self.event("SubagentStop", 5, agent_id="a")
        self.event("Stop", 9, background_tasks=[])
        self.duration(10)
        self.assertEqual(
            turn_store.load_turn_state("s", "p")["duration_ns"], 8_000_000_000
        )

    def test_explicit_old_duration_does_not_finish_new_prompt(self):
        self.event("UserPromptSubmit", 1, "old")
        self.event("Stop", 3, "old")
        self.event("UserPromptSubmit", 4, "new")
        self.duration(5, prompt="old")
        self.assertEqual(turn_store.load_turn_state("s", "new")["status"], "running")
        self.assertEqual(turn_store.load_turn_store("s")["current_prompt_id"], "new")

    def test_incremental_transcript_context_survives_queued_hook(self):
        self.event("UserPromptSubmit", 1, "old")
        entry = {}
        runtime_transcript._maybe_update_turn(
            entry, [prompt_line("old", 1), assistant_line(2)], "s"
        )
        self.event("Stop", 3, "old")
        self.event("UserPromptSubmit", 4, "new")
        runtime_transcript._maybe_update_turn(entry, [duration_line(3.5, 1500)], "s")
        self.assertEqual(turn_store.load_turn_state("s", "new")["status"], "running")
        self.assertEqual(
            turn_store.load_turn_state("s", "old")["duration_ns"], 2_000_000_000
        )

    def test_replayed_old_prompt_does_not_replace_new_current_prompt(self):
        self.event("UserPromptSubmit", 1, "old")
        self.event("Stop", 3, "old")
        self.event("UserPromptSubmit", 4, "new")
        turn_reducer.reconcile_transcript_events(
            "s",
            [
                {
                    "kind": "prompt",
                    "prompt_id": "old",
                    "wall_ns": 1_000_000_000,
                }
            ],
        )
        self.event("UserPromptSubmit", 10, "old")
        self.assertEqual(turn_store.load_turn_store("s")["current_prompt_id"], "new")

    def test_unowned_duration_and_old_subagent_hook_do_not_attach_to_new_prompt(self):
        self.event("UserPromptSubmit", 1, "old")
        self.event("SubagentStart", 2, "old", agent_id="old-agent")
        self.event("UserPromptSubmit", 4, "new")
        self.hook("s", None, "SubagentStop", 5_000_000_000, agent_id="old-agent")
        runtime_transcript._maybe_update_turn({}, [duration_line(6, 1000)], "s")
        state = turn_store.load_turn_state("s", "new")
        self.assertEqual(state["status"], "running")
        self.assertFalse(state["had_subagents"])

    def test_frozen_native_clock_duration_survives_reboot(self):
        self.event("UserPromptSubmit", 1)
        self.event("SubagentStart", 2, agent_id="a")
        self.event("SubagentStop", 3, agent_id="a")
        with mock.patch.object(
            turn_store,
            "now_clocks",
            return_value=(101_000_000_000, 9_000_000_000, "test-boot"),
        ):
            turn_reducer.handle_event(
                {
                    "session_id": "s",
                    "prompt_id": "p",
                    "hook_event_name": "Stop",
                    "background_tasks": [],
                }
            )
        turn_reducer.confirm_completion("s", "p", wall_ns=101_000_000_000)
        state = turn_store.load_turn_state("s", "p")
        with mock.patch.object(
            turn_store, "now_clocks", return_value=(200_000_000_000, 1, "new-boot")
        ):
            self.assertEqual(
                plain(rendering_timer._render_state_timer(state, None)), "✓ 0m 08s"
            )

    def test_invalid_duration_values_are_ignored_without_mutation(self):
        self.event("UserPromptSubmit", 1)
        before = turn_store.load_turn_state("s", "p")
        for value in (True, -1, math.nan, math.inf, -math.inf, "1000"):
            with self.subTest(value=value):
                self.duration(5, value)
                self.assertEqual(turn_store.load_turn_state("s", "p"), before)

    def test_legacy_frozen_multi_agent_duration_is_preserved_as_recorded(self):
        self.task()
        self.event("Stop", 9, background_tasks=[])
        state = turn_store._load_unlocked("s")
        state["duration_ns"] = 1_000_000_000
        for record in state["lifecycle"]["turns"]:
            record["duration_ns"] = 1_000_000_000
            record.pop("duration_source", None)
        turn_store._atomic_write("s", state)
        self.assertEqual(
            turn_store.load_turn_state("s", "p")["duration_ns"], 1_000_000_000
        )
