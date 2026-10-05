import json
from pathlib import Path
import tempfile
import unittest
from unittest import mock

from claude_statusline.config import display, runtime, formatting
from claude_statusline.platforms import clocks
from claude_statusline.runtime.tasks import reducer, store
from claude_statusline.rendering import timer
from claude_statusline.runtime.timing.clock import Sample


class TaskTimingTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        for key, value in (
            ("RUNTIME_ROOT", str(self.root)),
            ("TURN_DIR", str(self.root / "turns")),
        ):
            patch = mock.patch.object(store, key, value)
            patch.start()
            self.addCleanup(patch.stop)

    def event(self, event, second):
        with mock.patch.object(
            store, "now_clocks", return_value=(second * 10**9, second * 10**9, "boot")
        ):
            reducer.handle_event(
                {"session_id": "s", "prompt_id": "p", "hook_event_name": event}
            )
        return store.load_turn_state("s", "p")

    def test_blocked_stop_and_verified_continuation_finish_at_eight_seconds(self):
        self.event("UserPromptSubmit", 1)
        state = self.event("Stop", 3)
        self.assertEqual(state["phase"], "stop_pending")
        self.assertEqual(state["status"], "running")
        self.assertIn("? 0m 02s+", timer._render_state_timer(state, None))
        reducer.reconcile_transcript_events(
            "s", [{"kind": "assistant", "prompt_id": "p", "wall_ns": 4 * 10**9}]
        )
        self.assertIsNone(store.load_turn_state("s", "p")["stop_candidate"])
        self.event("Stop", 9)
        reducer.confirm_completion("s", "p", wall_ns=9 * 10**9)
        result = store.load_turn_state("s", "p")
        self.assertEqual(result["duration_ns"], 8 * 10**9)
        self.assertEqual(result["status"], "completed")

    def test_native_duration_is_stored_separately_and_cannot_shorten_task(self):
        self.event("UserPromptSubmit", 1)
        self.event("Stop", 9)
        reducer.confirm_completion("s", "p", wall_ns=9 * 10**9)
        reducer.reconcile_transcript_events(
            "s",
            [
                {
                    "kind": "turn_duration",
                    "prompt_id": "p",
                    "wall_ns": 10 * 10**9,
                    "duration_ms": 1500,
                }
            ],
        )
        record = store.load_turn_state("s", "p")
        self.assertEqual(record["duration_ns"], 8 * 10**9)
        self.assertEqual(record["native_duration_ms"], 1500)

    def test_aliases_normalize_layout_and_options_without_dropping_settings(self):
        draft = display.DEFAULT_CONFIG.to_dict()
        draft.update(
            items=["prompt-timer"],
            item_options={
                "prompt-timer": formatting.ItemOptions(
                    max_width=20, priority=15
                ).to_dict()
            },
            layout={"mode": "explicit", "rows": [["prompt-timer"]]},
        )
        parsed = display.validate_display_config(draft)
        self.assertEqual(parsed.items, ("task-timer",))
        self.assertEqual(parsed.layout.rows, (("task-timer",),))
        self.assertEqual(parsed.item_options["task-timer"].max_width, 20)
        self.assertFalse((self.root / "claude-statusline.json").exists())

    def test_runtime_default_and_old_explicit_opt_out(self):
        self.assertEqual(runtime.load(self.root), runtime.Preferences(True, False))
        target = runtime.preference_path(self.root)
        original = b'{"schema_version":1,"live_metrics":false}'
        target.write_bytes(original)
        self.assertEqual(runtime.load(self.root), runtime.Preferences(False, False))
        self.assertEqual(target.read_bytes(), original)
        self.assertEqual(
            runtime.load(self.root, False, True), runtime.Preferences(True, False)
        )
        self.assertEqual(
            json.loads(runtime.preference_bytes(True))["schema_version"], 2
        )

    def test_aliases_work_in_item_mutations_and_explicit_layouts(self):
        from claude_statusline.config import advanced

        config = display.DEFAULT_CONFIG.with_updates(items=("task-timer",))
        config = advanced.edit_item(config, "main", "prompt-timer", "label", "Task")
        config = advanced.edit_layout(config, "explicit", [["prompt-timer"]])
        self.assertEqual(config.layout.rows, (("task-timer",),))
        self.assertEqual(config.item_options["task-timer"].label, "Task")
        for updates in (
            {"items": ["prompt-timer", "task-timer"]},
            {"item_options": {"prompt-timer": {}, "task-timer": {}}},
            {"layout": {"mode": "explicit", "rows": [["prompt-timer", "task-timer"]]}},
        ):
            with (
                self.subTest(updates=updates),
                self.assertRaises(display.DisplayConfigError),
            ):
                display.validate_display_config({**config.to_dict(), **updates})

    def test_duration_does_not_complete_an_unexecuted_queued_prompt(self):
        self.event("UserPromptSubmit", 1)
        reducer.reconcile_transcript_events(
            "s",
            [
                {
                    "kind": "turn_duration",
                    "prompt_id": "p",
                    "wall_ns": 3 * 10**9,
                    "duration_ms": 1000,
                }
            ],
        )
        self.assertEqual(store.load_turn_state("s", "p")["status"], "running")

    def test_old_frozen_native_duration_is_preserved_without_a_read_migration(self):
        self.event("UserPromptSubmit", 1)
        path = Path(store._state_path("s"))
        value = json.loads(path.read_bytes())
        old = value["lifecycle"]["turns"][0]
        old.update(
            status="completed",
            ended_wall_ns=9 * 10**9,
            duration_ns=1500 * 10**6,
            duration_source="native",
            end_source="hook_stop",
        )
        value["lifecycle"]["schema"] = 3
        value.update(old)
        path.write_text(json.dumps(value))
        original = path.read_bytes()
        self.assertEqual(store.load_turn_state("s", "p")["duration_ns"], 1500 * 10**6)
        self.assertEqual(path.read_bytes(), original)
        reducer.confirm_completion("s", "p", wall_ns=10 * 10**9)
        self.assertEqual(store.load_turn_state("s", "p")["duration_ns"], 1500 * 10**6)

    def test_windows_wall_adjustment_does_not_change_the_boot_domain(self):
        with (
            mock.patch.object(
                clocks.platform_environment, "is_windows", return_value=True
            ),
            mock.patch.object(clocks, "_windows_boot_id", return_value="windows:guid"),
        ):
            with (
                mock.patch.object(
                    clocks.time, "time_ns", return_value=1800000000 * 10**9
                ),
                mock.patch.object(
                    clocks, "_windows_uptime_ns", return_value=100 * 10**9
                ),
            ):
                start = clocks.now_clocks()
            with (
                mock.patch.object(
                    clocks.time, "time_ns", return_value=1800000310 * 10**9
                ),
                mock.patch.object(
                    clocks, "_windows_uptime_ns", return_value=110 * 10**9
                ),
            ):
                end = clocks.now_clocks()
        from claude_statusline.runtime.tasks import model

        self.assertEqual(
            model._elapsed_ns(model._new_record("p", start), *end), 10 * 10**9
        )


class NativeTimingTests(unittest.TestCase):
    def setUp(self):
        import os

        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        patch = mock.patch.dict(
            os.environ, {"CLAUDE_STATUSLINE_RUNTIME_DIR": str(self.root / "runtime")}
        )
        patch.start()
        self.addCleanup(patch.stop)

    def observations(self, *, unknown=False, gap=False):
        rows = []

        def append(kind, second, payload, **identity):
            rows.append(
                {
                    "session_id": "s",
                    "epoch": "e",
                    "seq": len(rows),
                    "observed_at_ms": second * 1000,
                    "source": "native",
                    "kind": kind,
                    "prompt_id": None,
                    "turn_id": None,
                    "agent_id": None,
                    "parent_agent_id": None,
                    "request_id": None,
                    "payload": payload,
                    **identity,
                }
            )

        append("heartbeat", 0, {"host_version": "2.1.289", "loaded_at_ms": 0})
        append("prompt", 1, {}, prompt_id="p")
        append("turn_start", 2, {}, prompt_id="p", turn_id="t")
        if unknown:
            append(
                "wait_unknown", 3, {"reason": "permission_wait_unobserved"}, turn_id="t"
            )
        else:
            append("wait_start", 3, {}, turn_id="t", request_id="question")
            append("wait_end", 4, {}, turn_id="t", request_id="question")
        append(
            "turn_end",
            6,
            {"status": "completed", "duration_ms": 1000, "wait_coverage": not unknown},
            turn_id="t",
        )
        if gap:
            rows[-1]["seq"] += 1
        return rows

    def test_native_task_and_pause_clock_are_separate_and_replays_are_idempotent(self):
        from claude_statusline.runtime.live import store as live
        from claude_statusline.runtime.tasks.view import active_point

        rows = self.observations()
        with mock.patch(
            "claude_statusline.runtime.tasks.native._sample",
            side_effect=lambda wall, *args, **kwargs: Sample(wall, wall, "test"),
        ):
            live.observe(self.root, rows, timing=True)
        record = store.load_turn_state("s", "p", config_dir=self.root)
        self.assertEqual(record["status"], "completed")
        self.assertEqual(record["duration_ns"], 5 * 10**9)
        self.assertEqual(record["native_duration_ms"], 1000)
        self.assertEqual(active_point(self.root, "s", "p")["value"], 3)
        live.observe(self.root, rows, timing=True)
        self.assertEqual(store.load_turn_state("s", "p", config_dir=self.root), record)

    def test_unknown_wait_and_missing_events_hide_execution_time(self):
        from claude_statusline.runtime.live import store as live
        from claude_statusline.runtime.tasks.view import active_point

        for unknown, gap in ((True, False), (False, True)):
            with self.subTest(unknown=unknown, gap=gap):
                live.path(self.root, "s").unlink(missing_ok=True)
                Path(store._state_path("s", self.root)).unlink(missing_ok=True)
                live.observe(
                    self.root, self.observations(unknown=unknown, gap=gap), timing=True
                )
                point = active_point(self.root, "s", "p")
                self.assertIsNone(point["value"])
                self.assertIn(point["reason"], ("wait_coverage_missing", "incomplete"))

    def test_unclosed_wait_hides_execution_time_even_with_a_coverage_claim(self):
        from claude_statusline.runtime.live import store as live
        from claude_statusline.runtime.tasks.view import active_point

        rows = self.observations()
        rows.pop(4)  # A wait_end is absent, although turn_end claims full coverage.
        for seq, row in enumerate(rows):
            row["seq"] = seq
        with mock.patch(
            "claude_statusline.runtime.tasks.native._sample",
            side_effect=lambda wall, *args, **kwargs: Sample(wall, wall, "test"),
        ):
            live.observe(self.root, rows, timing=True)
        self.assertIsNone(active_point(self.root, "s", "p")["value"])
        self.assertEqual(active_point(self.root, "s", "p")["reason"], "incomplete")

    def test_native_ending_before_session_exit_corrects_delayed_exit_inference(self):
        from claude_statusline.runtime.live import store as live

        raw = self.root / "runtime"
        with (
            mock.patch.object(store, "RUNTIME_ROOT", str(raw)),
            mock.patch.object(store, "TURN_DIR", str(raw / "turns")),
        ):

            def event(name, second):
                with mock.patch.object(
                    store,
                    "now_clocks",
                    return_value=(second * 10**9, second * 10**9, "test"),
                ):
                    reducer.handle_event(
                        {"session_id": "s", "prompt_id": "p", "hook_event_name": name}
                    )

            event("UserPromptSubmit", 1)
            rows = self.observations()
            live.observe(self.root, rows[:3], timing=True)
            event("Stop", 5)
            event("SessionEnd", 7)
            self.assertEqual(store.load_turn_state("s", "p")["status"], "unknown")
            live.observe(self.root, rows[3:], timing=True)
            record = store.load_turn_state("s", "p")
            self.assertEqual(record["status"], "completed")
            self.assertEqual(record["duration_ns"], 5 * 10**9)

    def test_unbound_native_turn_does_not_attach_to_the_latest_queued_task(self):
        from claude_statusline.runtime.live import store as live

        rows = self.observations()
        other = dict(
            rows[1],
            seq=2,
            observed_at_ms=1500,
            prompt_id="queued",
            source="classic_hook",
        )
        rows[1]["source"] = "classic_hook"
        rows.insert(2, other)
        for index, row in enumerate(rows):
            row["seq"] = index
        rows[3]["prompt_id"] = None
        live.observe(self.root, rows, timing=True)
        self.assertEqual(
            store.load_turn_state("s", "queued", config_dir=self.root)["status"],
            "running",
        )
        self.assertEqual(
            store.load_turn_state("s", "queued", config_dir=self.root)["native_turns"],
            {},
        )
