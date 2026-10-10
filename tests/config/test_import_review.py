"""Review reads once, reports semantic differences and never writes a config."""

from copy import deepcopy
import json
from pathlib import Path
import tempfile
import unittest

from claude_statusline.config import display, formatting, import_review, models, transfer
from claude_statusline.ui import contracts, protocol


class ImportReviewTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="review 中文 spaces ")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.config = self.root / "missing config"
        self.file = self.root / "portable 中文.json"
        self.current = {"display": display.DEFAULT_CONFIG.to_dict(), "host": models.DEFAULT_HOST_CONFIG.to_dict()}

    def write(self, draft):
        self.file.write_text(json.dumps({"format":transfer.FORMAT,"version":1,"draft":draft},ensure_ascii=False))

    def review(self, current=None):
        response, code = protocol.handle(json.dumps({"protocol_version":contracts.PROTOCOL_VERSION,"operation":"review_import","payload":{"draft":current or self.current,"path":str(self.file)}}), self.config, Path("/tool"))
        self.assertEqual(code, 0, response)
        self.assertFalse(self.config.exists())
        return response["result"]

    def test_empty_review_and_file_snapshot_do_not_touch_inputs(self):
        self.write(self.current)
        raw, original = self.file.read_bytes(), deepcopy(self.current)
        result = self.review()
        self.assertEqual(result, {"draft":original,"changes":[]})
        self.assertEqual(self.current, original)
        self.assertEqual(self.file.read_bytes(), raw)
        self.file.unlink()
        self.assertEqual(result["draft"], original)

    def test_additions_removals_do_not_fake_reordering(self):
        candidate = deepcopy(self.current)
        candidate["display"]["items"] = ["model", *self.current["display"]["items"][1:]]
        self.write(candidate)
        changes = self.review()["changes"]
        self.assertEqual([(c["kind"],c["item_id"]) for c in changes], [("disable","model-with-effort"),("enable","model")])
        candidate["display"]["items"][-2:] = list(reversed(candidate["display"]["items"][-2:]))
        self.write(candidate)
        reorder = [c for c in self.review()["changes"] if c["kind"] == "reorder"]
        self.assertEqual(len(reorder), 1)
        self.assertNotIn("model", reorder[0]["after"])
        self.assertEqual(set(reorder[0]["before"]), set(reorder[0]["after"]))

    def test_every_configuration_section_and_scoped_override_is_reviewed(self):
        candidate = deepcopy(self.current)
        cfg = display.DEFAULT_CONFIG.with_updates(
            items=("model", "task-timer"), use_colors=False, palette="ansi",
            statusline_language="zh-CN", layout=formatting.Layout("explicit", (("model",),("task-timer",))),
            item_options={"model":formatting.ItemOptions(label="我的模型")},
            subagents=display.SubagentDisplayConfig(enabled=False,items=("name",),item_options={"name":formatting.ItemOptions(label="Agent 名称")}),
        )
        candidate["display"] = cfg.to_dict()
        candidate["host"] = models.HostConfig(4,None,True).to_dict()
        self.write(candidate)
        result = self.review()
        self.assertEqual(result["draft"], candidate)
        self.assertEqual({c["section"] for c in result["changes"]}, set(import_review.SECTIONS))
        self.assertEqual({(c["scope"],c["item_id"]) for c in result["changes"] if "item_options" in c["path"]}, {("main","model"),("subagent","name")})
        self.assertEqual(len([c for c in result["changes"] if c["section"] == "host"]),3)
        self.assertTrue(all(set(c["label"]) == {"key","params","fallback"} for c in result["changes"]))

    def test_unsaved_draft_and_legacy_display_only_host_are_the_baseline(self):
        draft = deepcopy(self.current)
        draft["display"]["palette"] = "ansi"
        draft["host"]["padding"] = 9
        self.write(draft)
        self.assertEqual(self.review(draft)["changes"], [])
        self.file.write_text(json.dumps({"schema_version":1,"items":["model"],"use_colors":True,"palette":"default","directory_style":"full","separator_style":"classic"}))
        result = self.review(draft)
        self.assertEqual(result["draft"]["host"],draft["host"])
        self.assertEqual(result["draft"]["display"]["schema_version"],7)
        self.assertFalse(any(c["section"] == "host" for c in result["changes"]))

    def test_invalid_reviews_preserve_draft_and_never_create_configuration(self):
        original = deepcopy(self.current)
        for raw in ('{bad', '{"x":NaN}', '{"x":1,"x":2}', ' ' * (transfer.MAX_BYTES + 1)):
            self.file.write_text(raw)
            response, code = protocol.handle(json.dumps({"protocol_version":contracts.PROTOCOL_VERSION,"operation":"review_import","payload":{"draft":self.current,"path":str(self.file)}}), self.config, Path("/tool"))
            self.assertEqual(code,2,response)
            self.assertEqual(self.current,original)
            self.assertFalse(self.config.exists())
