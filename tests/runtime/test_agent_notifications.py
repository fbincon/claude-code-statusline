"""Real CLI ordering regressions: result notifications change the host prompt ID."""

from claude_statusline.runtime.turns import reducer, store
from claude_statusline.runtime import transcript
from tests.runtime.test_statusline_timer import TimerTestCase, prompt_line


def notification(agent):
    return f"<task-notification>\n<task-id>{agent}</task-id>\n<status>completed</status>\n</task-notification>"


class AgentNotificationTests(TimerTestCase):
    def event(self, name, second, prompt_id="original", **extra):
        return self.hook("s", prompt_id, name, int(second * 1e9), **extra)

    def start(self):
        self.event("UserPromptSubmit", 1, prompt_id="original", prompt="user task")
        self.event("SubagentStart", 2, agent_id="a")
        self.event("SubagentStart", 3, agent_id="b")
        self.event(
            "Stop",
            4,
            background_tasks=[
                {"id": "a", "type": "subagent"},
                {"id": "b", "type": "subagent"},
            ],
        )

    def notify(self, agent, second, host_prompt):
        return self.event(
            "UserPromptSubmit", second, host_prompt, **{"prompt": notification(agent)}
        )

    def test_notification_prompt_ids_keep_full_task_and_pending_reports(self):
        self.start()
        self.event("SubagentStop", 5, agent_id="a")
        self.notify("a", 6, "notice-a")
        self.event("SubagentStop", 7, "notice-a", agent_id="b")
        self.event("Stop", 8, "notice-a", background_tasks=[])
        state = store.load_turn_state("s", "original")
        self.assertEqual(state["status"], "running")
        self.assertEqual(state["phase"], "resuming_main")
        self.notify("b", 9, "notice-b")
        self.event("Stop", 10, "notice-b", background_tasks=[])
        state = store.load_turn_state("s", "original")
        self.assertEqual(state["status"], "completed")
        self.assertEqual(state["duration_ns"], 9_000_000_000)
        self.assertEqual(
            store.load_turn_state("s", "notice-b")["prompt_id"], "original"
        )
        self.assertEqual(len(store.load_turn_store("s")["turns"]), 1)
        self.assertEqual(store.load_turn_store("s")["current_prompt_id"], "original")

    def test_duplicate_notifications_after_final_stop_do_not_reopen(self):
        self.start()
        self.event("SubagentStop", 5, agent_id="a")
        self.notify("a", 6, "notice-a")
        self.event("SubagentStop", 7, "notice-a", agent_id="b")
        self.notify("b", 8, "notice-b")
        self.event("Stop", 9, "notice-b", background_tasks=[])
        before = store.load_turn_state("s", "original")
        self.notify("b", 10, "notice-b")
        self.event("Stop", 11, "notice-b", background_tasks=[])
        self.assertEqual(store.load_turn_state("s", "original"), before)

    def test_old_notification_and_stop_do_not_attach_to_new_human_task(self):
        self.start()
        self.event("UserPromptSubmit", 5, "new")
        self.notify("a", 6, "notice-a")
        self.event("SubagentStop", 7, "new", agent_id="b")
        self.event("Stop", 8, "notice-a", background_tasks=[])
        current = store.load_turn_state("s", "new")
        self.assertEqual(current["status"], "running")
        self.assertFalse(current["had_subagents"])
        self.assertEqual(store.load_turn_store("s")["current_prompt_id"], "new")

    def test_notification_transcript_restores_alias_without_submit_hook(self):
        self.start()
        self.event("SubagentStop", 5, agent_id="a")
        row = prompt_line("notice-a", 6, notification("a"))
        row["promptSource"] = "system"
        row["origin"] = {"kind": "task-notification", "producer": "session-task"}
        events = transcript._turn_events([row])[4]
        reducer.reconcile_transcript_events("s", events)
        self.assertEqual(
            store.load_turn_state("s", "notice-a")["prompt_id"], "original"
        )

    def test_unknown_notification_and_its_stop_are_not_timed_prompts(self):
        self.event("UserPromptSubmit", 1)
        self.notify("shell", 2, "shell-notice")
        self.event("Stop", 3, "shell-notice", background_tasks=[])
        self.assertEqual(store.load_turn_store("s")["current_prompt_id"], "original")
        self.assertEqual(
            store.load_turn_state("s", "shell-notice")["status"], "ignored"
        )
        self.assertEqual(store.load_turn_state("s", "original")["status"], "running")

    def test_new_report_continues_an_apparent_stop_without_reopening_failure(self):
        self.start()
        self.event("SubagentStop", 5, agent_id="a")
        self.event("SubagentStop", 6, agent_id="b")
        self.event("Stop", 7, background_tasks=[])
        self.notify("a", 8, "notice-a")
        self.assertEqual(store.load_turn_state("s", "original")["status"], "running")
        self.event("Stop", 9, "notice-a", background_tasks=[])
        self.assertEqual(store.load_turn_state("s", "original")["status"], "running")
        self.notify("b", 10, "notice-b")
        self.event("Stop", 11, "notice-b", background_tasks=[])
        self.assertEqual(
            store.load_turn_state("s", "original")["duration_ns"], 10_000_000_000
        )

    def test_agent_notifications_preserve_failure_and_interruption(self):
        for event, expected in (
            ("StopFailure", "failed"),
            ("SessionEnd", "interrupted"),
        ):
            with self.subTest(event=event):
                prompt = event
                self.event("UserPromptSubmit", 1, prompt)
                self.event("SubagentStart", 2, prompt, agent_id=event)
                self.event(event, 4, prompt, reason="logout", error="boom")
                self.notify(event, 5, "notice-" + event)
                self.event("Stop", 6, "notice-" + event, background_tasks=[])
                state = store.load_turn_state("s", prompt)
                self.assertEqual(state["status"], expected)
                self.assertEqual(state["duration_ns"], 3_000_000_000)

    def test_unseen_old_stop_never_replaces_the_current_human_prompt(self):
        self.event("UserPromptSubmit", 1)
        self.event("UserPromptSubmit", 5, "new")
        self.event("Stop", 6, "unseen-old", background_tasks=[])
        self.assertEqual(store.load_turn_store("s")["current_prompt_id"], "new")
        self.assertEqual(store.load_turn_state("s", "new")["status"], "running")

    def test_final_stop_collects_submission_evidence_before_freezing(self):
        import json
        from pathlib import Path

        path = Path(self.runtime) / "transcript.jsonl"
        path.write_text(
            json.dumps(prompt_line("original", 0.9)) + "\n", encoding="utf-8"
        )
        self.event("UserPromptSubmit", 1)
        self.event("SubagentStart", 2, agent_id="a")
        self.event("SubagentStop", 3, agent_id="a")
        self.event("Stop", 9, background_tasks=[], transcript_path=str(path))
        before = store.load_turn_state("s", "original")
        self.assertEqual(before["started_wall_ns"], 900_000_000)
        self.assertEqual(before["duration_ns"], 8_100_000_000)
        transcript._maybe_update_turn({}, [prompt_line("original", 0.9)], "s")
        self.assertEqual(store.load_turn_state("s", "original"), before)

    def test_later_transcript_cannot_revise_a_strong_frozen_start(self):
        self.event("UserPromptSubmit", 1)
        self.event("Stop", 9, background_tasks=[])
        before = store.load_turn_state("s", "original")
        transcript._maybe_update_turn({}, [prompt_line("original", 0.9)], "s")
        self.assertEqual(store.load_turn_state("s", "original"), before)
