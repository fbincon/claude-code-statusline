"""Synthetic fixtures test the evaluator, never claim human desktop evidence."""
import json
from pathlib import Path
import tempfile
import unittest

from tools.ts02_linux_terminal_smoke import assess


class LinuxManualEvidenceTests(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.folder = Path(temp.name)
        self.record = {"human": dict.fromkeys(("automatic_focus", "unicode_display", "restored_display"), "yes"),
                       "echo": "TS02-RESTORED", "runs": [{"exit_code": code, "restored_without_harness_repair": True}
                                                          for code in (0, 130, 1)]}
        self.handshake = {"nonce": "fixture", "input_tty": True, "output_tty": True}
        self.save("launch.json", {"prepared": {"request": {"nonce": "fixture"}}})
        self.save("source.json", {"files": {}})
        rows = [{"event": "key", "data": "\x1b[A\x1b[B\x1b[C\x1b[D中文é👩🏽‍💻"},
                {"event": "resize", "data": [32, 12]}, {"event": "resize", "data": [80, 24]},
                {"event": "restored", "data": "save"}]
        (self.folder / "save.jsonl").write_text("\n".join(map(json.dumps, rows)))
        (self.folder / "cancel.jsonl").write_text(json.dumps({"event": "restored", "data": "cancel"}))

    def save(self, name, value):
        (self.folder / name).write_text(json.dumps(value))

    def result(self, mode="direct"):
        self.save("interaction.json", self.record)
        self.save("handshake.json", self.handshake)
        return assess(self.folder, mode)

    def test_complete_fixture_uses_human_focus_without_claiming_os_query(self):
        report = self.result()
        self.assertEqual(report["status"], "pass")
        self.assertIn("no OS active-window query", report["focus_evidence"])

    def test_unconfirmed_focus_wrong_nonce_and_terminal_repair_fail(self):
        self.record["human"]["automatic_focus"] = "skip"
        self.assertEqual(self.result()["status"], "fail")
        self.record["human"]["automatic_focus"] = "yes"
        self.handshake["nonce"] = "wrong"
        self.assertEqual(self.result()["status"], "fail")
        self.handshake["nonce"] = "fixture"
        self.record["runs"][0]["restored_without_harness_repair"] = False
        self.assertEqual(self.result()["status"], "fail")

    def test_popup_needs_parent_input_and_visual_confirmation(self):
        self.save("popup-parent.json", {"exit_code": 0, "echo": "TS02-PARENT", "human_visual": "yes"})
        self.assertEqual(self.result("popup")["status"], "pass")
        self.save("popup-parent.json", {"exit_code": 0, "echo": "", "human_visual": "yes"})
        self.assertEqual(self.result("popup")["status"], "fail")
