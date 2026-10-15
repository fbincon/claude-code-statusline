import os
from pathlib import Path
import tempfile
import unittest
from unittest import mock

from claude_statusline.config import display
from claude_statusline.rendering import subagents
from claude_statusline.runtime.live import durations


class FrozenAgentTests(unittest.TestCase):
    def test_repeated_refreshes_freeze_ended_agent_without_live_metrics(self):
        with (
            tempfile.TemporaryDirectory() as folder,
            mock.patch.dict(
                os.environ,
                {"CLAUDE_STATUSLINE_RUNTIME_DIR": str(Path(folder) / "runtime")},
            ),
        ):
            root = Path(folder)
            history = {"turns": [{"prompt_id": "p", "agent_ids": ["a"]}]}
            event = {
                "session_id": "s",
                "agent_id": "a",
                "hook_event_name": "SubagentStart",
            }
            with mock.patch(
                "claude_statusline.runtime.turns.store.load_turn_store",
                return_value=history,
            ):
                durations.observe(event, now_ms=1000, config_dir=root)
                durations.observe(event, now_ms=1500, config_dir=root)
            durations.observe(
                {**event, "hook_event_name": "SubagentStop"},
                now_ms=43000,
                config_dir=root,
            )
            durations.observe(
                {**event, "hook_event_name": "SubagentStop"},
                now_ms=99000,
                config_dir=root,
            )
            config = display.DEFAULT_CONFIG.with_updates(
                use_colors=False,
                subagents=display.SubagentDisplayConfig(items=("status-elapsed",)),
            )
            data = {
                "session_id": "s",
                "tasks": [{"id": "a", "status": "completed", "startTime": 1000}],
            }
            with mock.patch.object(subagents, "CONFIG_DIR", str(root)):
                for now in (45000, 100000, 999999):
                    self.assertEqual(
                        subagents.render_payload(data, config, now_ms=now)[0][
                            "content"
                        ],
                        "✓ 0m 42s",
                    )
            self.assertFalse((root / "claude-statusline-runtime.json").exists())

    def test_terminal_agent_without_end_evidence_keeps_status_only(self):
        config = display.DEFAULT_CONFIG.with_updates(
            use_colors=False,
            subagents=display.SubagentDisplayConfig(items=("status-elapsed",)),
        )
        task = {"id": "a", "status": "completed", "startTime": 1000}
        self.assertEqual(subagents.render_task(task, config, now_ms=999999), "✓")
        self.assertEqual(
            subagents.render_task(
                {**task, "_frozen_duration_ms": -1}, config, now_ms=999999
            ),
            "✓",
        )

    def test_unowned_start_or_missing_start_cannot_create_end_evidence(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            event = {
                "session_id": "s",
                "agent_id": "a",
                "hook_event_name": "SubagentStart",
            }
            with mock.patch(
                "claude_statusline.runtime.turns.store.load_turn_store",
                return_value={"turns": []},
            ):
                durations.observe(event, now_ms=1000, config_dir=root)
            durations.observe(
                {**event, "hook_event_name": "SubagentStop"},
                now_ms=2000,
                config_dir=root,
            )
            self.assertEqual(durations.load(root, "s"), {})
