"""Concurrent token-cache publication tests."""

from claude_statusline.runtime import paths as runtime_paths
from claude_statusline.runtime import usage as runtime_usage

import json
from pathlib import Path
import tempfile
import threading
import unittest
from unittest import mock


class TokenStateConcurrencyTests(unittest.TestCase):
    def test_parallel_sessions_publish_without_lost_updates(self):
        with tempfile.TemporaryDirectory(prefix="statusline-token-state-") as root:
            runtime = Path(root)
            state_path = runtime / "statusline_state.json"
            lock_path = runtime / "statusline_state.json.lock"
            payloads = []
            for index in range(6):
                transcript = runtime / f"session-{index}.jsonl"
                transcript.write_text(
                    json.dumps(
                        {
                            "type": "assistant",
                            "message": {
                                "id": f"message-{index}",
                                "usage": {
                                    "input_tokens": index + 1,
                                    "output_tokens": index + 2,
                                    "cache_creation_input_tokens": index + 3,
                                    "cache_read_input_tokens": index + 4,
                                },
                            },
                        }
                    )
                    + "\n",
                    encoding="utf-8",
                )
                payloads.append(
                    {
                        "session_id": f"session-{index}",
                        "transcript_path": str(transcript),
                    }
                )

            barrier = threading.Barrier(len(payloads))
            errors = []

            def render(payload):
                try:
                    barrier.wait()
                    result = runtime_usage.session_token_totals(payload)
                    if result is None:
                        raise AssertionError("token totals were not returned")
                except Exception as exc:  # noqa: BLE001 - surfaced in test thread
                    errors.append(exc)

            with (
                mock.patch.object(runtime_paths, "STATEFILE", str(state_path)),
                mock.patch.object(runtime_paths, "STATE_LOCKFILE", str(lock_path)),
            ):
                threads = [
                    threading.Thread(target=render, args=(payload,))
                    for payload in payloads
                ]
                for thread in threads:
                    thread.start()
                for thread in threads:
                    thread.join(timeout=15)

            self.assertFalse(any(thread.is_alive() for thread in threads))
            self.assertEqual(errors, [])
            published = json.loads(state_path.read_text(encoding="utf-8"))
            self.assertEqual(
                set(published["sessions"]),
                {f"session-{index}" for index in range(6)},
            )
            self.assertEqual(list(runtime.glob("*.tmp")), [])


if __name__ == "__main__":
    unittest.main(verbosity=2)
