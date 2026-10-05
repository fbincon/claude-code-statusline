import unittest

from claude_statusline.runtime.timing.clock import Sample, StatusTimer, delta


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
