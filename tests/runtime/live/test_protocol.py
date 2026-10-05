from pathlib import Path
import json
import os
import subprocess
import sys
import tempfile
import unittest
from unittest import mock

from claude_statusline.config import runtime
from claude_statusline.runtime.live import model, protocol, store
from tests.runtime.live.support import observation
from tests.support import SOURCE_ROOT


class RuntimeProtocolTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="runtime protocol ")
        self.addCleanup(self.temp.cleanup)
        self.config = Path(self.temp.name) / "config with spaces"
        self.config.mkdir()
        self.config.joinpath(runtime.FILENAME).write_bytes(
            runtime.preference_bytes(True)
        )
        self.patch = mock.patch.dict(
            os.environ, {"CLAUDE_STATUSLINE_RUNTIME_DIR": str(self.config / "state")}
        )
        self.patch.start()
        self.addCleanup(self.patch.stop)

    def observe(self, rows):
        return protocol.dispatch(
            {
                "protocol_version": 1,
                "operation": "observe",
                "payload": {"observations": rows},
            },
            self.config,
        )

    def read(self):
        return protocol.dispatch(
            {
                "protocol_version": 1,
                "operation": "read",
                "payload": {"session_id": "s", "prompt_id": None},
            },
            self.config,
        )

    def test_read_and_disabled_observe_never_create_runtime_files(self):
        self.assertEqual(self.read()["reason"], "not_observed")
        self.assertFalse(store.root(self.config).exists())
        self.config.joinpath(runtime.FILENAME).write_bytes(
            runtime.preference_bytes(False)
        )
        result = self.observe([observation()])
        self.assertEqual((result["accepted"], result["ignored"]), (0, 1))
        self.assertEqual(self.read()["reason"], "runtime_disabled")
        self.assertFalse(store.root(self.config).exists())

    def test_entire_invalid_batch_is_rejected_before_persistence(self):
        wrong = observation(seq=1)
        wrong["seq"] = True
        with self.assertRaises(model.ObservationError):
            self.observe([observation(), wrong])
        self.assertFalse(store.root(self.config).exists())
        for field, value in (
            ("observed_at_ms", float("nan")),
            ("observed_at_ms", -(10**1000)),
            ("source", "unknown"),
            ("session_id", "bad\x1bpath"),
        ):
            with self.subTest(field=field):
                wrong = observation()
                wrong[field] = value
                with self.assertRaises(model.ObservationError):
                    self.observe([wrong])

    def test_permission_snapshot_cannot_claim_a_live_change_feed(self):
        wrong = observation("permission", payload={"mode": "plan", "live": True})
        with self.assertRaises(model.ObservationError):
            self.observe([wrong])

    def test_json_stdout_errors_and_utf8_cli_paths(self):
        env = dict(os.environ, PYTHONPATH=str(SOURCE_ROOT), PYTHONDONTWRITEBYTECODE="1")
        for raw, status in (
            (
                json.dumps(
                    {
                        "protocol_version": 1,
                        "operation": "observe",
                        "payload": {"observations": [observation(at=-(10**1000))]},
                    }
                ),
                2,
            ),
            (
                '{"protocol_version":1,"protocol_version":1,"operation":"read","payload":{}}',
                2,
            ),
            (
                '{"protocol_version":1,"operation":"observe","payload":{"observations":[NaN]}}',
                2,
            ),
            (
                json.dumps(
                    {
                        "protocol_version": 1,
                        "operation": "observe",
                        "payload": {"observations": [observation()]},
                    }
                ),
                0,
            ),
        ):
            result = subprocess.run(
                [
                    sys.executable,
                    "-m",
                    "claude_statusline",
                    "runtime",
                    "--config-dir",
                    str(self.config),
                ],
                input=raw,
                text=True,
                encoding="utf-8",
                capture_output=True,
                env=env,
                check=False,
            )
            self.assertEqual(result.returncode, status, result.stderr)
            self.assertEqual(result.stderr, "")
            self.assertEqual(json.loads(result.stdout)["protocol_version"],
                             2 if raw.startswith(('{"protocol_version":1,"protocol_version"', '{"protocol_version":1,"operation":"observe","payload":{"observations":[NaN]')) else 1)

    def test_corrupt_state_is_unavailable_and_read_does_not_repair(self):
        self.observe([observation()])
        target = store.path(self.config, "s")
        target.write_bytes(b"broken")
        self.assertEqual(self.read()["reason"], "not_observed")
        self.assertEqual(target.read_bytes(), b"broken")

    def test_preference_is_strict_and_explicit_repair_is_supported(self):
        for raw in (
            b'{"schema_version":true,"live_metrics":true}',
            b'{"schema_version":1,"live_metrics":"on"}',
            b'{"schema_version":1,"live_metrics":true,"live_metrics":false}',
        ):
            self.config.joinpath(runtime.FILENAME).write_bytes(raw)
            with self.assertRaises(Exception):
                runtime.requested(self.config)
            self.assertFalse(runtime.requested(self.config, False))
