#!/usr/bin/env python3
"""Regression tests for the statusline lifecycle timer."""

import datetime
import json
import os
import re
import tempfile
import unittest
from unittest import mock

from claude_statusline import statusline as sl
from claude_statusline import turn_state as ts


ANSI_RE = re.compile(r"\x1b\[[0-9;:]*m")


def plain(value):
    return ANSI_RE.sub("", value or "")


def iso(epoch_seconds):
    return datetime.datetime.fromtimestamp(
        epoch_seconds, datetime.timezone.utc
    ).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def prompt_line(prompt_id, epoch_seconds, text="continue"):
    return {
        "type": "user",
        "timestamp": iso(epoch_seconds),
        "promptId": prompt_id,
        "origin": {"kind": "human"},
        "promptSource": "queued",
        "message": {"role": "user", "content": text},
    }


def interrupt_line(marker_prompt_id, epoch_seconds):
    return {
        "type": "user",
        "timestamp": iso(epoch_seconds),
        "promptId": marker_prompt_id,
        "interruptedMessageId": "message-being-interrupted",
        "message": {
            "role": "user",
            "content": [{"type": "text", "text": "[Request interrupted by user]"}],
        },
    }


def assistant_line(epoch_seconds):
    return {
        "type": "assistant",
        "timestamp": iso(epoch_seconds),
        "message": {"role": "assistant", "content": [{"type": "text", "text": "done"}]},
    }


def duration_line(epoch_seconds, duration_ms):
    return {
        "type": "system",
        "subtype": "turn_duration",
        "timestamp": iso(epoch_seconds),
        "durationMs": duration_ms,
    }


class TimerTestCase(unittest.TestCase):
    def setUp(self):
        self.tempdir = tempfile.TemporaryDirectory(prefix="statusline-timer-test-")
        self.runtime = self.tempdir.name
        self.sessions = os.path.join(self.runtime, "sessions")
        os.makedirs(self.sessions)
        self.patchers = [
            mock.patch.object(ts, "RUNTIME_ROOT", self.runtime),
            mock.patch.object(ts, "TURN_DIR", os.path.join(self.runtime, "turns")),
            mock.patch.object(sl, "SESSIONS_DIR", self.sessions),
        ]
        for patcher in self.patchers:
            patcher.start()

    def tearDown(self):
        for patcher in reversed(self.patchers):
            patcher.stop()
        self.tempdir.cleanup()

    def hook(self, sid, prompt_id, name, wall_ns, **extra):
        payload = {
            "session_id": sid,
            "prompt_id": prompt_id,
            "hook_event_name": name,
        }
        payload.update(extra)
        clocks = (wall_ns, wall_ns, "test-boot")
        with mock.patch.object(ts, "now_clocks", return_value=clocks):
            return ts.handle_event(payload)


class QueueAndCompletionTests(TimerTestCase):
    def test_real_queue_interrupt_sequence_freezes_at_brewed_duration(self):
        sid, old_prompt, new_prompt = "session", "A", "B"
        old_start = 1_788_057_372.402
        new_start = 1_788_058_007.310
        interrupted = new_start - 0.028
        duration_ms = 1_824_621
        ended = new_start + duration_ms / 1000
        self.hook(sid, old_prompt, "UserPromptSubmit", int(old_start * 1e9))

        entry = {}
        sl._maybe_update_turn(entry, [
            prompt_line(old_prompt, old_start),
            interrupt_line(new_prompt, interrupted),
            prompt_line(new_prompt, new_start),
            assistant_line(ended - 0.160),
        ], sid)
        self.hook(sid, new_prompt, "Stop", int(ended * 1e9))
        sl._maybe_update_turn(entry, [duration_line(ended, duration_ms)], sid)

        old_state = ts.load_turn_state(sid, old_prompt)
        new_state = ts.load_turn_state(sid, new_prompt)
        self.assertEqual(old_state["status"], "interrupted")
        self.assertEqual(new_state["status"], "completed")
        self.assertEqual(new_state["duration_ns"], duration_ms * 1_000_000)

        first = sl._timer_segment(sid, new_prompt, entry["last_pt"], entry)
        with mock.patch.object(
                sl, "now_clocks",
                return_value=(int((ended + 600) * 1e9), None, "other-boot")):
            second = sl._timer_segment(sid, new_prompt, entry["last_pt"], entry)
        self.assertEqual(plain(first), "✓ 30m 25s")
        self.assertEqual(plain(second), "✓ 30m 25s")

    def test_missing_stop_uses_verified_idle_after_assistant(self):
        sid, prompt_id = "missing-stop", "A"
        start = 1000.0
        ended = 1060.6
        entry = {}
        sl._maybe_update_turn(entry, [
            prompt_line(prompt_id, start),
            assistant_line(ended - 0.1),
        ], sid)
        registry = {
            "status": "idle",
            "status_updated_wall_ns": int(ended * 1e9),
            "pid": os.getpid(),
        }
        with mock.patch.object(sl, "_read_cli_session_status", return_value=registry):
            rendered = sl._timer_segment(sid, prompt_id, entry["last_pt"], entry)
        self.assertEqual(plain(rendered), "✓ 1m 01s")
        self.assertEqual(ts.load_turn_state(sid, prompt_id)["end_source"], "registry_idle")

    def test_idle_without_assistant_hides_withdrawn_prompt(self):
        sid, prompt_id = "withdrawn", "A"
        entry = {}
        sl._maybe_update_turn(entry, [prompt_line(prompt_id, 1000.0)], sid)
        registry = {
            "status": "idle",
            "status_updated_wall_ns": int(1002.0 * 1e9),
            "pid": os.getpid(),
        }
        with mock.patch.object(sl, "_read_cli_session_status", return_value=registry):
            rendered = sl._timer_segment(sid, prompt_id, entry["last_pt"], entry)
        self.assertIsNone(rendered)
        self.assertEqual(ts.load_turn_state(sid, prompt_id)["status"], "withdrawn")

    def test_local_command_preserves_previous_completed_display(self):
        sid, prompt_id = "local", "A"
        start, ended = 1000.0, 1065.0
        entry = {}
        sl._maybe_update_turn(entry, [
            prompt_line(prompt_id, start),
            assistant_line(ended - 0.1),
            duration_line(ended, 65_000),
            {
                "type": "user",
                "timestamp": iso(ended + 1),
                "promptId": "LOCAL",
                "message": {
                    "role": "user",
                    "content": "<command-name>/cost</command-name>",
                },
            },
        ], sid)
        rendered = sl._timer_segment(sid, "LOCAL", entry["last_pt"], entry)
        self.assertEqual(plain(rendered), "✓ 1m 05s")
        self.assertEqual(ts.load_turn_state(sid, "LOCAL")["status"], "ignored")


class RenderingAndFallbackTests(TimerTestCase):
    def test_running_uses_floor_and_terminal_uses_nearest_second(self):
        running = {
            "status": "running",
            "started_wall_ns": 1_000_000_000,
            "started_boot_ns": None,
            "ended_wall_ns": None,
            "ended_boot_ns": None,
            "duration_ns": None,
            "boot_id": None,
        }
        with mock.patch.object(
                sl, "now_clocks", return_value=(2_999_999_999, None, "boot")):
            self.assertEqual(plain(sl._render_state_timer(running, None)), "⏱ 0m 01s")
        completed = dict(running, status="completed", duration_ns=1_600_000_000)
        self.assertEqual(plain(sl._render_state_timer(completed, None)), "✓ 0m 02s")

    def test_boot_clock_used_when_valid_and_wall_clock_after_reboot(self):
        state = {
            "status": "running",
            "started_wall_ns": 1_000_000_000,
            "started_boot_ns": 10_000_000_000,
            "ended_wall_ns": None,
            "ended_boot_ns": None,
            "duration_ns": None,
            "boot_id": "same",
        }
        with mock.patch.object(
                sl, "now_clocks",
                return_value=(101_000_000_000, 12_000_000_000, "same")):
            self.assertEqual(sl._state_elapsed_seconds(state, None), 2.0)
        with mock.patch.object(
                sl, "now_clocks",
                return_value=(4_000_000_000, 12_000_000_000, "new")):
            self.assertEqual(sl._state_elapsed_seconds(state, None), 3.0)

    def test_unknown_state_is_frozen_and_marked_as_lower_bound(self):
        state = {
            "status": "unknown",
            "started_wall_ns": 1_000_000_000,
            "started_boot_ns": None,
            "ended_wall_ns": 11_400_000_000,
            "ended_boot_ns": None,
            "duration_ns": None,
            "boot_id": None,
        }
        first = sl._render_state_timer(state, None)
        with mock.patch.object(
                sl, "now_clocks", return_value=(999_000_000_000, None, None)):
            second = sl._render_state_timer(state, None)
        self.assertEqual(plain(first), "? 0m 10s+")
        self.assertEqual(plain(second), "? 0m 10s+")

    def test_missing_state_has_no_open_ended_time_fallback(self):
        entry = {"last_prompt_id": "A", "last_pt": 1000.0}
        with (
            mock.patch.object(sl, "load_turn_state", return_value=None),
            mock.patch.object(sl, "reconcile_transcript_events", return_value=None),
        ):
            self.assertIsNone(sl._timer_segment("s", "A", 1000.0, entry))

    def test_registry_requires_live_pid_and_matching_process_start(self):
        path = os.path.join(self.sessions, f"{os.getpid()}.json")
        invalid = {
            "pid": os.getpid(),
            "sessionId": "s",
            "status": "idle",
            "statusUpdatedAt": 1234,
            "procStart": "wrong",
        }
        with open(path, "w", encoding="utf-8") as stream:
            json.dump(invalid, stream)
        self.assertIsNone(sl._read_cli_session_status("s"))

        invalid["procStart"] = sl._proc_start_time(os.getpid())
        with open(path, "w", encoding="utf-8") as stream:
            json.dump(invalid, stream)
        accepted = sl._read_cli_session_status("s")
        self.assertEqual(accepted["status"], "idle")
        self.assertEqual(accepted["status_updated_wall_ns"], 1_234_000_000)

    def test_registry_filters_other_sessions_and_invalid_records_before_process_lookup(self):
        records = {
            "42": {"pid": 42, "sessionId": "other", "statusUpdatedAt": 1234},
            "43": {"pid": 43, "sessionId": "s", "statusUpdatedAt": True},
            "44": ["invalid registry"],
        }
        for pid, record in records.items():
            with open(os.path.join(self.sessions, f"{pid}.json"), "w", encoding="utf-8") as stream:
                json.dump(record, stream)
        with mock.patch.object(sl, "_proc_start_time") as process_start:
            self.assertIsNone(sl._read_cli_session_status("s"))
        process_start.assert_not_called()

    def test_unchanged_transcript_is_not_reparsed(self):
        transcript = os.path.join(self.runtime, "transcript.jsonl")
        with open(transcript, "w", encoding="utf-8") as stream:
            stream.write(json.dumps(prompt_line("A", 1000.0)) + "\n")
        entry = {"files": {}, "ids": {}, "base": dict(sl._BASE)}
        with mock.patch.object(
                sl, "reconcile_transcript_events",
                wraps=sl.reconcile_transcript_events) as reconcile:
            self.assertTrue(sl._update_file(
                entry, transcript, session_id="s",
                track_prompts=True, track_cost=True,
            ))
            self.assertFalse(sl._update_file(
                entry, transcript, session_id="s",
                track_prompts=True, track_cost=True,
            ))
        self.assertEqual(reconcile.call_count, 1)


if __name__ == "__main__":
    unittest.main(verbosity=2)
