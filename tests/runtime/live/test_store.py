from pathlib import Path
import os
import tempfile
import threading
import unittest
from unittest import mock

from claude_statusline.runtime.live import model, store
from tests.runtime.live.support import observation


class LiveStoreTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="live state ")
        self.addCleanup(self.temp.cleanup)
        self.config = Path(self.temp.name)
        self.patch = mock.patch.dict(
            os.environ, {"CLAUDE_STATUSLINE_RUNTIME_DIR": str(self.config / "runtime")}
        )
        self.patch.start()
        self.addCleanup(self.patch.stop)

    def apply(self, *rows):
        return store.observe(self.config, model.validate_batch(list(rows)))

    def test_duplicate_and_out_of_order_events_preserve_ownership(self):
        self.apply(observation(), observation("prompt", 1, 1010, prompt="p"))
        self.apply(observation("agent_end", 3, 1050, prompt="p", agent="a"))
        start = observation("agent_start", 2, 1020, prompt="p", agent="a")
        self.apply(
            start, start, observation("agent_start", 4, 1100, prompt="new", agent="a")
        )
        state = store.load(self.config, "s")
        agent = state["agents"]["a"]
        self.assertEqual(
            (agent["prompt_id"], agent["started_at_ms"], agent["ended_at_ms"]),
            ("p", 1020, 1050),
        )
        self.assertFalse(state["prompts"]["p"]["complete"])

    def test_old_epoch_cannot_replace_reloaded_live_observations(self):
        self.apply(observation(), observation("prompt", 1, 1010, prompt="p"))
        new = observation(
            epoch="new",
            at=2000,
            payload={"host_version": "2.1.289", "loaded_at_ms": 2000},
        )
        self.apply(new, observation("permission", 1, 2010, epoch="new"))
        self.apply(
            observation(
                "permission", 2, 9999, payload={"mode": "default", "live": False}
            )
        )
        state = store.load(self.config, "s")
        self.assertEqual(state["permission"]["mode"], "plan")
        self.assertEqual(state["epoch"], "new")
        self.assertFalse(state["prompts"]["p"]["complete"])
        self.assertFalse(self.apply(observation(epoch="older", at=3000))["accepted"])

    def test_freshness_and_resume_invalidation(self):
        self.apply(observation())
        state = store.load(self.config, "s")
        self.assertTrue(store.fresh(state, 16000))
        self.assertFalse(store.fresh(state, 16001))
        self.assertFalse(store.fresh(state, 999))
        self.apply(observation("invalidate", 1, 1010), observation(seq=2, at=1020))
        self.assertFalse(store.fresh(store.load(self.config, "s"), 1030))

    def test_multiple_process_writers_do_not_lose_agents_or_other_sessions(self):
        self.apply(observation(), observation("prompt", 1, 1010, prompt="p"))
        errors = []

        def writer(index):
            try:
                self.apply(
                    observation(
                        "agent_start",
                        index + 2,
                        1020 + index,
                        prompt="p",
                        agent=str(index),
                    )
                )
            except Exception as exc:
                errors.append(exc)

        threads = [threading.Thread(target=writer, args=(i,)) for i in range(20)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join()
        self.assertFalse(errors)
        self.assertEqual(len(store.load(self.config, "s")["agents"]), 20)
        self.apply(observation(session="another"))
        self.assertEqual(len(store.load(self.config, "s")["agents"]), 20)
        self.assertEqual(store.load(self.config, "another")["session_id"], "another")
