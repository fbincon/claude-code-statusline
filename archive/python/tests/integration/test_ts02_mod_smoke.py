"""A busy POSIX host must not hang evidence collection during PTY teardown."""
import importlib.util
import os
from pathlib import Path
import subprocess
import sys
import unittest
from unittest import mock

SPEC = importlib.util.spec_from_file_location(
    "ts02_mod_smoke", Path(__file__).resolve().parents[2] / "tools/migration/ts-02/scripts/mod-smoke.py"
)
SMOKE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(SMOKE)


@unittest.skipUnless(os.name == "posix", "POSIX PTY shutdown")
class HostCleanupTests(unittest.TestCase):
    def test_busy_host_ignoring_sigterm_is_drained_closed_and_reaped(self):
        import pty
        import select
        import signal
        master, slave = pty.openpty()
        code = "import os,signal;signal.signal(signal.SIGTERM,signal.SIG_IGN);os.write(1,b'READY\\n');\nwhile True: os.write(1,b'x'*65536)"
        child = subprocess.Popen([sys.executable, "-c", code], stdin=slave, stdout=slave, stderr=slave, start_new_session=True)
        os.close(slave)
        raw = bytearray()
        try:
            self.assertTrue(select.select([master], [], [], 5)[0])
            raw.extend(os.read(master, 4096))
            self.assertIn(b"READY", raw)
            initial_length = len(raw)
            SMOKE.stop_host(child, master, raw, grace=.5)
            self.assertEqual(child.returncode, -signal.SIGKILL)
            self.assertGreater(len(raw), initial_length)
            with self.assertRaises(OSError):
                os.fstat(master)
        finally:
            if child.poll() is None:
                child.kill()
            try:
                os.close(master)
            except OSError:
                pass
            child.wait(timeout=3)

    def test_unreapable_child_has_bounded_wait_and_master_is_closed(self):
        import pty
        master, slave = pty.openpty()
        child = mock.Mock(pid=12345)
        child.poll.return_value = None
        child.wait.side_effect = subprocess.TimeoutExpired("fixture", 0)
        os.write(slave, b"preserved-before-timeout")
        raw = bytearray()
        try:
            with mock.patch.object(os, "killpg"), self.assertRaises(subprocess.TimeoutExpired):
                SMOKE.stop_host(child, master, raw, grace=0)
            child.wait.assert_called_once_with(timeout=0)
            self.assertIn(b"preserved-before-timeout", raw)
            with self.assertRaises(OSError):
                os.fstat(master)
        finally:
            os.close(slave)


if __name__ == "__main__":
    unittest.main()
