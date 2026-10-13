"""Evidence gates must reject elapsed time without real OS power events."""
import copy
from datetime import datetime, timezone
import unittest

from tools.macos_clock_smoke import evaluate, reboot_event, sleep_intervals


START = datetime(2026, 10, 14, 0, 0, tzinfo=timezone.utc).timestamp()
PMSET = """2026-10-14 08:00:05 +0800 Sleep Entering Sleep state due to 'Software Sleep pid=42': Using AC 60 secs
2026-10-14 08:01:05 +0800 Wake Wake from Normal Sleep [CDNVA] : due to HID Activity Using AC
"""


class MacOSPowerEvidenceTests(unittest.TestCase):
    def fixtures(self, kind="suspend"):
        before = {"kind": kind, "source_hashes": {"fixture": "hash"}, "runtimes": {"node": "pinned"},
                  "host": {"hypervisor": "1"},
                  "mach": {"mach_absolute_time_ns": 100_000_000_000, "mach_continuous_time_ns": 100_000_000_000}}
        for side in ("python", "node", "reference"):
            before[side] = {"wall_ns": int(START * 1e9), "boot_ns": 100_000_000_000, "boot_id": "darwin:before"}
        after = copy.deepcopy(before)
        for side in ("python", "node", "reference"):
            after[side]["wall_ns"] += 70_000_000_000
            after[side]["boot_ns"] += 70_000_000_000
        after["mach"] = {"mach_absolute_time_ns": 110_000_000_000, "mach_continuous_time_ns": 170_000_000_000}
        replay = {side: {"delta_ns": 70_000_000_000, "trusted": kind == "suspend"} for side in ("python", "node")}
        commands = {name: {"exit_code": 0} for name in ("pmset", "last-reboot")}
        if kind == "reboot":
            for side in ("python", "node", "reference"):
                after[side].update(boot_id="darwin:after", boot_ns=10_000_000_000)
            after["kern_boottime"] = "{ sec = %s, usec = 0 }" % int(START + 60)
        return before, after, replay, commands

    def report(self, kind="suspend", pmset=PMSET, human=True, change=None):
        before, after, replay, commands = self.fixtures(kind)
        if change:
            change(before, after, replay, commands)
        return evaluate(before, after, pmset, "reboot time Wed Oct 14 00:01\n", replay, human, commands)

    def test_sleep_pairs_only_in_capture_window_and_respects_offset(self):
        intervals, events = sleep_intervals(PMSET, START, START + 70)
        self.assertEqual(intervals, [60])
        self.assertEqual(len(events), 2)
        self.assertEqual(sleep_intervals(PMSET, START + 10, START + 70)[0], [])

    def test_vm_pass_never_claims_physical_host(self):
        report = self.report()
        self.assertEqual(report["status"], "pass")
        self.assertFalse(report["physical_host_coverage"])
        self.assertEqual(report["scope"], "macOS virtual guest only")

    def test_no_event_no_human_and_display_only_are_failures(self):
        for options in ({"pmset": ""}, {"human": False},
                        {"pmset": PMSET.replace("Sleep Entering Sleep", "Assertions Display Sleep")}):
            with self.subTest(options=options):
                self.assertEqual(self.report(**options)["status"], "fail")

    def test_short_sleep_does_not_meet_gate(self):
        self.assertEqual(self.report(pmset=PMSET.replace("08:01:05", "08:00:15"))["status"], "fail")

    def test_monotonic_sleep_exclusion_is_independent_evidence(self):
        report = self.report(change=lambda a, b, r, c: b["mach"].update(mach_absolute_time_ns=170_000_000_000))
        self.assertFalse(report["checks"]["absolute_clock_excluded_sleep"])
        self.assertEqual(report["status"], "fail")

    def test_changed_source_runtime_or_unreadable_events_cannot_pass(self):
        for mutate in (lambda a, b, r, c: b["source_hashes"].update(fixture="changed"),
                       lambda a, b, r, c: b["runtimes"].update(node="changed"),
                       lambda a, b, r, c: c["pmset"].update(exit_code=1)):
            self.assertEqual(self.report(change=mutate)["status"], "fail")

    def test_reboot_requires_new_domain_and_wall_fallback(self):
        self.assertEqual(self.report("reboot")["status"], "pass")
        self.assertEqual(self.report("reboot", change=lambda a, b, r, c: b["node"].update(boot_id="darwin:before"))["status"], "fail")
        self.assertEqual(self.report("reboot", change=lambda a, b, r, c: r["node"].update(trusted=True))["status"], "fail")

    def test_reboot_rejects_historical_or_missing_boot_events(self):
        self.assertFalse(reboot_event("reboot time Wed Oct 14 00:01", START - 1, START, START + 70))
        self.assertFalse(reboot_event("", START + 60, START, START + 70))
        self.assertFalse(reboot_event("reboot time Wed Oct 14 00:02", START + 60, START, START + 70))


if __name__ == "__main__":
    unittest.main()
