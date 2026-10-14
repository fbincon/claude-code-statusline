"""Linux acceptance needs kernel events and independent suspend-aware clocks."""
import copy
import unittest

from tools.linux_clock_smoke import evaluate


class LinuxPowerEvidenceTests(unittest.TestCase):
    def fixture(self, kind="suspend"):
        start = 1_800_000_000_000_000_000
        before = {"kind": kind, "source_hashes": {"file": "hash"}, "runtimes": {"node": "pinned"},
                  "proc_boot_id": "boot1", "proc_btime": start // 1_000_000_000 - 100,
                  "diagnostic": {"boottime_ns": 100_000_000_000, "monotonic_ns": 100_000_000_000},
                  "host": {"virtualization": "none", "virtualization_exit": 1}}
        for side in ("python", "node", "reference"):
            before[side] = {"wall_ns": start, "boot_ns": 100_000_000_000, "boot_id": "boot1"}
        after = copy.deepcopy(before)
        for side in ("python", "node", "reference"):
            after[side]["wall_ns"] += 70_000_000_000
            after[side]["boot_ns"] += 70_000_000_000
        after["diagnostic"] = {"boottime_ns": 170_000_000_000, "monotonic_ns": 110_000_000_000}
        kernel = [{"__REALTIME_TIMESTAMP": str((start + second * 1_000_000_000) // 1000),
                   "_BOOT_ID": "boot1", "MESSAGE": message} for second, message in
                  ((5, "PM: suspend entry (s2idle)"), (65, "PM: suspend exit"))]
        replays = {side: {"delta_ns": 70_000_000_000, "trusted": kind == "suspend"} for side in ("python", "node")}
        if kind == "reboot":
            for side in ("python", "node", "reference"):
                after[side].update(boot_id="boot2", boot_ns=10_000_000_000)
            after.update(proc_boot_id="boot2", proc_btime=start // 1_000_000_000 + 60)
        boots = [{"boot_id": "boot2", "first_entry": (start + 60_000_000_000) // 1000}]
        commands = {name: {"exit_code": 0} for name in ("kernel", "boots")}
        return before, after, kernel, boots, replays, True, commands

    def test_sleep_requires_events_and_excluded_monotonic_time(self):
        values = list(self.fixture())
        self.assertEqual(evaluate(*values)["status"], "pass")
        values[2] = []
        self.assertEqual(evaluate(*values)["status"], "fail")
        values = list(self.fixture())
        values[1]["diagnostic"]["monotonic_ns"] = 170_000_000_000
        self.assertEqual(evaluate(*values)["status"], "fail")

    def test_old_boot_events_and_unconfirmed_actions_do_not_pass(self):
        values = list(self.fixture())
        for row in values[2]:
            row["_BOOT_ID"] = "older"
        self.assertEqual(evaluate(*values)["status"], "fail")
        values = list(self.fixture()); values[5] = False
        self.assertEqual(evaluate(*values)["status"], "fail")

    def test_reboot_needs_new_identity_new_journal_and_wall_fallback(self):
        values = list(self.fixture("reboot"))
        self.assertEqual(evaluate(*values)["status"], "pass")
        values[3] = []
        self.assertEqual(evaluate(*values)["status"], "fail")
        values = list(self.fixture("reboot")); values[4]["node"]["trusted"] = True
        self.assertEqual(evaluate(*values)["status"], "fail")
        values = list(self.fixture("reboot")); values[1]["reference"]["boot_id"] = "boot1"
        self.assertEqual(evaluate(*values)["status"], "fail")

    def test_changed_code_runtime_and_event_failures_are_rejected(self):
        for mutate in (lambda v: v[1]["source_hashes"].update(file="changed"),
                       lambda v: v[1]["runtimes"].update(node="changed"),
                       lambda v: v[6]["kernel"].update(exit_code=1)):
            values = list(self.fixture()); mutate(values)
            self.assertEqual(evaluate(*values)["status"], "fail")

    def test_guest_result_never_claims_physical_host(self):
        values = list(self.fixture())
        values[1]["host"].update(virtualization="kvm", virtualization_exit=0)
        self.assertFalse(evaluate(*values)["physical_host_coverage"])
