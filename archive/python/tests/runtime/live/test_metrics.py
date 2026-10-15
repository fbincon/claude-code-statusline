from pathlib import Path
import os
import tempfile
import unittest
from unittest import mock

from claude_statusline.runtime.live import model, snapshot, store
from tests.runtime.live.support import observation


class LiveMetricsTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.config = Path(self.temp.name)
        patch = mock.patch.dict(
            os.environ, {"CLAUDE_STATUSLINE_RUNTIME_DIR": str(self.config / "runtime")}
        )
        patch.start()
        self.addCleanup(patch.stop)
        self.apply(
            observation(),
            observation("prompt", 1, 1010, prompt="p"),
            observation("turn_start", 2, 1020, turn_id="t"),
        )

    def apply(self, *rows):
        store.observe(self.config, model.validate_batch(list(rows)))

    def points(self, prompt="p", now=2000):
        return snapshot.resolve(
            store.load(self.config, "s"), self.config, "s", prompt, now_ms=now
        )

    def test_queued_prompt_does_not_steal_tools_or_nested_agents(self):
        self.apply(
            observation("prompt", 3, 1030, prompt="queued"),
            observation("agent_start", 4, 1040, agent="a", turn_id="t"),
            observation("agent_start", 5, 1050, agent="nested", parent_agent_id="a"),
            observation(
                "tool_start",
                6,
                1060,
                request_id="tool",
                turn_id="t",
                payload={"name": "Read"},
            ),
            observation(
                "agents",
                7,
                1070,
                payload={
                    "agents": [
                        {
                            "id": "a",
                            "parent_id": None,
                            "status": "running",
                            "local": True,
                        },
                        {
                            "id": "nested",
                            "parent_id": "a",
                            "status": "waiting",
                            "local": True,
                        },
                        {
                            "id": "remote",
                            "parent_id": None,
                            "status": "running",
                            "local": False,
                        },
                    ]
                },
            ),
        )
        points = self.points()
        self.assertEqual(points["active-agents"]["value"], 2)
        self.assertTrue(points["active-agents"]["partial"])
        self.assertEqual(points["last-tool"]["value"]["name"], "Read")
        self.assertIsNone(self.points("queued")["last-tool"]["value"])
        self.assertEqual(self.points("queued")["run-state"]["value"], "queued")
        self.assertEqual(
            store.load(self.config, "s")["agents"]["nested"]["prompt_id"], "p"
        )

    def test_out_of_order_tool_end_does_not_replace_latest_started_tool(self):
        self.apply(
            observation(
                "tool_end",
                4,
                1100,
                turn_id="t",
                request_id="old",
                payload={"name": "Read", "status": "denied"},
            ),
            observation(
                "tool_start",
                3,
                1030,
                turn_id="t",
                request_id="old",
                payload={"name": "Read"},
            ),
            observation(
                "tool_start",
                5,
                1110,
                turn_id="t",
                request_id="new",
                payload={"name": "Bash"},
            ),
            observation(
                "tool_end",
                6,
                1200,
                turn_id="t",
                request_id="old",
                payload={"name": "Read", "status": "success"},
            ),
        )
        self.assertEqual(
            self.points()["last-tool"]["value"], {"name": "Bash", "status": "started"}
        )
        self.assertEqual(
            store.load(self.config, "s")["tools"]["e:old"]["status"], "denied"
        )

    def test_checklist_snapshots_zero_and_updates_are_prompt_scoped(self):
        self.apply(
            observation(
                "task_update",
                3,
                1030,
                turn_id="t",
                payload={"provider": "tasks", "id": "1", "status": "completed"},
            )
        )
        self.assertTrue(self.points()["task-progress"]["partial"])
        self.apply(
            observation(
                "task_snapshot",
                4,
                1040,
                turn_id="t",
                payload={"provider": "tasks", "tasks": []},
            )
        )
        self.assertEqual(
            self.points()["task-progress"]["value"], {"completed": 0, "total": 0}
        )
        self.assertFalse(self.points()["task-progress"]["partial"])
        self.apply(
            observation(
                "task_snapshot",
                5,
                1050,
                turn_id="t",
                payload={
                    "provider": "tasks",
                    "tasks": [{"id": "1", "status": "pending"}],
                },
            ),
            observation(
                "task_update",
                6,
                1060,
                turn_id="t",
                payload={"provider": "tasks", "id": "1", "status": "completed"},
            ),
            observation(
                "task_snapshot",
                7,
                1049,
                turn_id="t",
                payload={"provider": "tasks", "tasks": []},
            ),
            observation("prompt", 8, 1080, prompt="next"),
        )
        self.assertEqual(
            self.points()["task-progress"]["value"], {"completed": 1, "total": 1}
        )
        self.assertIsNone(self.points("next")["task-progress"]["value"])

    def test_stale_live_sources_preserve_terminal_history(self):
        self.apply(
            observation("permission", 3, 1030),
            observation(
                "tool_end",
                4,
                1040,
                turn_id="t",
                request_id="r",
                payload={"name": "Read", "status": "success"},
            ),
            observation(
                "turn_end", 5, 1050, turn_id="t", payload={"status": "completed"}
            ),
        )
        self.assertTrue(self.points()["permission-mode"]["partial"])
        points = self.points(now=20000)
        self.assertIsNone(points["permission-mode"]["value"])
        self.assertIsNone(points["active-agents"]["value"])
        self.assertEqual(points["run-state"]["value"], "completed")
        self.assertEqual(
            points["last-tool"]["value"], {"name": "Read", "status": "success"}
        )

    def test_reload_and_unknown_turn_cannot_bind_old_prompt(self):
        self.apply(
            observation(
                epoch="new",
                at=2000,
                payload={"host_version": "2.1.289", "loaded_at_ms": 2000},
            ),
            observation(
                "tool_start",
                1,
                2010,
                epoch="new",
                prompt="p",
                request_id="r",
                payload={"name": "Read"},
            ),
        )
        self.assertIsNone(self.points(now=2100)["last-tool"]["value"])
        self.assertIsNone(self.points(now=2100)["run-state"]["value"])

    def test_duplicate_snapshot_id_and_malformed_status_rejected_before_writes(self):
        row = {"id": "a", "parent_id": None, "status": "running", "local": True}
        with self.assertRaises(model.ObservationError):
            self.apply(observation("agents", 3, 1030, payload={"agents": [row, row]}))
