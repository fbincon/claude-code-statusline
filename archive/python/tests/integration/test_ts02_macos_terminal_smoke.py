"""Synthetic evaluator fixtures are never human desktop acceptance records."""
import json
from pathlib import Path
import tempfile
import unittest

from tools.ts02_macos_terminal_smoke import ROOT, assess, hash_file


class TerminalEvidenceGates(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.folder = Path(self.temp.name)
        self.record = {"human": {name: "yes" for name in ("automatic_focus", "unicode_display", "restored_display")},
                       "echo": "TS02-RESTORED", "runs": [{"exit_code": code, "restored_without_harness_repair": True} for code in (0, 130, 1)]}
        self.saved = [{"event": "key", "data": "\x1b[A\x1b[B\x1b[C\x1b[D中文 e\u0301 👩🏽‍💻\x13"},
                      {"event": "resize", "data": [32, 12]}, {"event": "resize", "data": [80, 24]},
                      {"event": "restored", "data": "save"}]
        self.focus = {"nonce": "test-fixture", "input_tty": True, "output_tty": True, "status": 0, "frontmost": "Terminal"}
        self.save_json("launch.json", {"prepared": {"request": {"nonce": "test-fixture"}}})
        self.save_json("source.json", {"files": {"tools/ts02_macos_terminal_smoke.py": hash_file(ROOT / "tools/ts02_macos_terminal_smoke.py")}})

    def save_json(self, name, value):
        (self.folder / name).write_text(json.dumps(value))

    def result(self):
        self.save_json("interaction.json", self.record)
        self.save_json("focus.json", self.focus)
        (self.folder / "save.jsonl").write_text("\n".join(map(json.dumps, self.saved)))
        (self.folder / "cancel.jsonl").write_text(json.dumps({"event": "restored", "data": "cancel"}))
        return assess(self.folder, "direct")

    def test_complete_synthetic_fixture_passes_evaluator(self):
        self.assertEqual(self.result()["status"], "pass")

    def test_unconfirmed_visual_and_repaired_terminal_are_not_passes(self):
        self.record["human"]["unicode_display"] = "skip"
        self.assertEqual(self.result()["status"], "fail")
        self.record["human"]["unicode_display"] = "yes"
        self.record["runs"][0]["restored_without_harness_repair"] = False
        self.assertEqual(self.result()["status"], "fail")

    def test_wrong_nonce_or_wrong_focus_cannot_pass(self):
        self.focus["nonce"] = "wrong"
        self.assertEqual(self.result()["status"], "fail")
        self.focus.update(nonce="test-fixture", frontmost="Finder")
        self.assertEqual(self.result()["status"], "fail")

    def test_missing_unicode_directions_and_small_size_are_rejected(self):
        self.saved[0]["data"] = "just ordinary typing"
        self.saved[1]["data"] = [80, 24]
        report = self.result()
        for name in ("arrows", "unicode_input", "small_and_large_resize"):
            self.assertFalse(report["checks"][name])
        self.assertEqual(report["status"], "fail")


if __name__ == "__main__":
    unittest.main()
