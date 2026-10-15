import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest import mock

from claude_statusline.runtime.live import bindings, model, reducer, snapshot, store
from claude_statusline.runtime.turns import model as timer
from tests.runtime.live.support import observation


class LifecycleBindingTests(unittest.TestCase):
    def test_report_message_links_survive_alias_flattening_and_keep_the_human_task(
        self,
    ):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            state = store.empty("s")
            for key, stamp in (("human-message", 1000), ("report-message", 2000)):
                state["prompts"][key] = {
                    "epoch": "e",
                    "started_at_ms": stamp,
                    "updated_at_ms": stamp,
                    "complete": True,
                    "terminal": False,
                    "source": "otel",
                }
            state["prompt_aliases"].update(
                {"human-hook": "human-message", "report-hook": "human-message"}
            )
            state["prompt_links"].update(
                {"human-hook": "human-message", "report-hook": "report-message"}
            )
            record = timer._new_record("human-hook", (10**9, None, None))
            record["prompt_aliases"] = ["human-message", "report-hook"]
            record["report_aliases"] = ["report-hook"]
            path = store.root(root).parent / "turns" / store.path(root, "s").name
            path.parent.mkdir(parents=True)
            path.write_text(
                json.dumps(
                    {
                        "session_id": "s",
                        "lifecycle": {
                            "schema": 4,
                            "turns": [record],
                            "current_prompt_id": "human-hook",
                        },
                    }
                )
            )
            bindings.reconcile(state, root)
            self.assertEqual(state["prompt_aliases"]["report-message"], "human-message")
            self.assertNotIn("report-message", state["prompts"])
            self.assertEqual(state["prompt_links"]["report-hook"], "report-message")

    def test_completed_unique_window_binds_requests_and_nested_spawns_without_timer_writes(
        self,
    ):
        with (
            tempfile.TemporaryDirectory() as folder,
            mock.patch.dict(
                os.environ,
                {"CLAUDE_STATUSLINE_RUNTIME_DIR": str(Path(folder) / "runtime")},
            ),
        ):
            root = Path(folder)
            state = store.empty("s")
            rows = [
                observation(),
                observation("turn_start", 1, 1200, turn_id="t"),
                observation("agent_start", 2, 1300, agent="a", turn_id="t"),
                observation("turn_start", 3, 1400, agent="a", turn_id="child"),
                observation(
                    "agent_start",
                    4,
                    1450,
                    agent="nested",
                    parent_agent_id="a",
                    turn_id="child",
                ),
                observation(
                    "request_start",
                    5,
                    1500,
                    agent="nested",
                    turn_id="deep",
                    request_id="r",
                ),
                observation(
                    "tool_end",
                    6,
                    1600,
                    turn_id="t",
                    request_id="tool",
                    payload={"name": "Read", "status": "success"},
                ),
            ]
            for row in model.validate_batch(rows):
                reducer.apply(state, row)
            record = timer._new_record("p", (1100000000, 1100000000, "boot"))
            record.update(
                status="completed", ended_wall_ns=2000000000, updated_wall_ns=2000000000
            )
            path = store.root(root).parent / "turns" / store.path(root, "s").name
            path.parent.mkdir(parents=True)
            raw = json.dumps(
                {
                    "session_id": "s",
                    "schema": 1,
                    "lifecycle": {
                        "schema": 3,
                        "session_id": "s",
                        "current_prompt_id": "p",
                        "turns": [record],
                    },
                }
            ).encode()
            path.write_bytes(raw)
            bindings.reconcile(state, root)
            self.assertEqual(state["active_prompt_id"], "p")
            self.assertEqual(state["agents"]["nested"]["prompt_id"], "p")
            self.assertEqual(state["requests"]["e:r"]["prompt_id"], "p")
            self.assertEqual(state["tools"]["e:tool"]["prompt_id"], "p")
            self.assertEqual(path.read_bytes(), raw)
            points = snapshot.resolve(state, root, "s", "missing", now_ms=1600)
            self.assertIsNone(points["prompt-input-tokens"]["value"])
            # Overlapping terminal evidence has no unique owner.
            state["turns"]["e:main:t"]["prompt_id"] = None
            other = {**record, "prompt_id": "other"}
            path.write_bytes(
                json.dumps(
                    {
                        "session_id": "s",
                        "lifecycle": {"schema": 3, "turns": [record, other]},
                    }
                ).encode()
            )
            bindings.reconcile(state, root)
            self.assertIsNone(state["turns"]["e:main:t"]["prompt_id"])
