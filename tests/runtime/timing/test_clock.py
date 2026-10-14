import unittest
import json

from claude_statusline.runtime.timing.clock import Sample, StatusTimer, delta, task_elapsed
from tests.support import REPOSITORY_ROOT


class StatusTimerTests(unittest.TestCase):
    def test_overlapping_waits_and_duplicate_events(self):
        timer = StatusTimer.start(Sample(0))
        timer = timer.pause("approval", Sample(2))
        timer = timer.pause("question", Sample(3))
        self.assertEqual(timer.elapsed(Sample(100)), 2)
        self.assertEqual(timer.pause("approval", Sample(200)), timer)
        timer = timer.resume("approval", Sample(7))
        self.assertEqual(timer.elapsed(Sample(100)), 2)
        timer = timer.resume("question", Sample(10))
        self.assertEqual(timer.elapsed(Sample(12)), 4)
        self.assertEqual(timer.resume("missing", Sample(30)), timer)

    def test_reset_preserves_an_open_modal_and_freezing_survives_restart(self):
        timer = StatusTimer.start(Sample(0)).pause("question", Sample(2))
        timer = timer.reset(Sample(10), 5)
        self.assertEqual(timer.elapsed(Sample(99)), 5)
        timer = timer.resume("question", Sample(100)).finish(Sample(103))
        restored = StatusTimer.load(timer.to_dict())
        self.assertEqual(restored.elapsed(Sample(1000)), 8)

    def test_uptime_ignores_wall_clock_adjustment_and_includes_suspend(self):
        self.assertEqual(delta(Sample(100, 10, "boot"), Sample(500, 20, "boot")), 10)
        self.assertEqual(delta(Sample(100, 10, "boot"), Sample(80, 20, "boot")), 10)
        self.assertEqual(delta(Sample(100, 10, "boot"), Sample(105, 5, "new")), 5)
        self.assertIsNone(delta(Sample(100), Sample(80)))

    def test_confirmed_resume_reopens_the_same_clock_origin(self):
        timer = StatusTimer.start(Sample(1)).finish(Sample(3))
        self.assertEqual(timer.reopen().finish(Sample(9)).elapsed(Sample(99)), 8)

    def test_clock_loss_during_a_wait_survives_restore_and_hides_precision(self):
        timer = StatusTimer.start(Sample(0, 0, "boot"))
        timer = timer.pause("question", Sample(2, 2, "boot"))
        timer = timer.resume("question", Sample(5)).finish(Sample(8, 8, "boot"))
        self.assertTrue(StatusTimer.load(timer.to_dict()).degraded)

    def test_reboot_and_backwards_uptime_cannot_claim_execution_coverage(self):
        timer = StatusTimer.start(Sample(100, 10, "boot"))
        self.assertFalse(timer.trusted_sample(Sample(110, 5, "reboot")))
        self.assertFalse(timer.trusted_sample(Sample(110, 9, "boot")))
        self.assertTrue(timer.finish(Sample(110, 5, "reboot")).degraded)

    def test_a_wait_ending_before_its_start_invalidates_precision(self):
        timer = StatusTimer.start(Sample(0, 0, "boot")).pause("q", Sample(5, 5, "boot"))
        self.assertTrue(timer.resume("q", Sample(3, 3, "boot")).degraded)

    def test_captured_legacy_windows_reboot_degrades_to_wall_time(self):
        fixture = json.loads((REPOSITORY_ROOT / "tools/migration/ts-02/fixtures/windows-reboot.json").read_text(encoding="utf-8"))
        start, end = Sample.load(fixture["before"]), Sample.load(fixture["after"])
        self.assertEqual(start.boot_id, end.boot_id)
        self.assertLess(end.boot_ns, start.boot_ns)
        self.assertEqual(delta(start, end), end.wall_ns - start.wall_ns)
        timer = StatusTimer.start(start)
        self.assertFalse(timer.trusted_sample(end))
        self.assertTrue(timer.finish(end).degraded)
        # A reused GUID is still ambiguous after the new uptime catches up.
        later = Sample(end.wall_ns, start.boot_ns + 1, start.boot_id)
        self.assertFalse(timer.trusted_sample(later))
        self.assertEqual(delta(start, later), end.wall_ns - start.wall_ns)
        self.assertIsNone(delta(start, Sample(start.wall_ns - 1, end.boot_ns, end.boot_id)))

    def test_versioned_windows_domain_keeps_clock_adjustment_and_frozen_semantics(self):
        identity = "windows:v2:a37ac4ce-5dc5-11ee-ba22-d380a9a2ae53:41"
        start = Sample(1000, 100, identity)
        timer = StatusTimer.start(start)
        self.assertEqual(delta(start, Sample(1, 130, identity)), 30)
        self.assertTrue(timer.trusted_sample(Sample(1, 130, identity)))
        reboot = Sample(2000, 5, identity[:-2] + "42")
        self.assertEqual(delta(start, reboot), 1000)
        self.assertFalse(timer.trusted_sample(reboot))
        legacy = Sample(1000, 100, "windows:a37ac4ce-5dc5-11ee-ba22-d380a9a2ae53")
        self.assertEqual(delta(legacy, start), 0)
        self.assertFalse(StatusTimer.start(legacy).trusted_sample(start))
        frozen = StatusTimer.load(dict(accumulated_ns=0, last_resume=legacy.__dict__, frozen_ns=9007199254740993))
        self.assertEqual(frozen.elapsed(reboot), 9007199254740993)
        self.assertEqual(task_elapsed(dict(status="complete", duration_ns=9007199254740993), reboot), 9007199254740993)
