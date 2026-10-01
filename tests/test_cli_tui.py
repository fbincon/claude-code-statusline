"""Linux/macOS PTY smoke tests for the interactive configure command."""

import json
import os
import select
import signal
import stat
import struct
import subprocess
import sys
import tempfile
import time
import unittest
from pathlib import Path

SUPPORTS_PTY = sys.platform.startswith("linux") or sys.platform == "darwin"

if SUPPORTS_PTY:
    import fcntl
    import pty
    import termios


@unittest.skipUnless(SUPPORTS_PTY, "Linux/macOS PTY required")
class ConfigurePtyTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="statusline-tui-pty-")
        self.root = Path(self.temporary.name)
        self.executable = self.root / "bin" / "claude-statusline"
        self.executable.parent.mkdir()
        self.executable.write_text(
            f'#!/bin/sh\nexec "{sys.executable}" -m claude_statusline "$@"\n',
            encoding="utf-8",
        )
        self.executable.chmod(0o755)
        self.config_dir = self.root / "claude"
        self.config_dir.mkdir()
        self.settings_path = self.config_dir / "settings.json"
        self.display_path = self.config_dir / "claude-statusline.json"
        self._write_installed_settings()
        self.process = None
        self.master = None

    def tearDown(self):
        if self.process is not None and self.process.poll() is None:
            self.process.kill()
            self.process.wait(timeout=5)
        if self.master is not None:
            try:
                os.close(self.master)
            except OSError:
                pass
        self.temporary.cleanup()

    def _write_installed_settings(self):
        settings = {
            "statusLine": {
                "type": "command",
                "command": f'"{self.executable}" render',
                "refreshInterval": 1,
            }
        }
        self.settings_path.write_text(
            json.dumps(settings) + "\n", encoding="utf-8"
        )

    def _start(
        self,
        *,
        rows=24,
        columns=100,
        term="xterm-256color",
        extra_env=None,
    ):
        env = os.environ.copy()
        env["PATH"] = str(self.executable.parent) + os.pathsep + env.get("PATH", "")
        env["PYTHONPATH"] = str(Path(__file__).resolve().parents[1] / "src")
        env["PYTHONDONTWRITEBYTECODE"] = "1"
        env["TERM"] = term
        if extra_env:
            env.update(extra_env)
        master, slave = pty.openpty()
        fcntl.ioctl(
            slave,
            termios.TIOCSWINSZ,
            struct.pack("HHHH", rows, columns, 0, 0),
        )
        process = subprocess.Popen(
            [
                sys.executable,
                "-m",
                "claude_statusline",
                "configure",
                "--config-dir",
                str(self.config_dir),
            ],
            stdin=slave,
            stdout=slave,
            stderr=slave,
            env=env,
            close_fds=True,
        )
        os.close(slave)
        self.master = master
        self.process = process
        return process, master

    def _bridge_environment(self, deadline="570"):
        base = self.config_dir / "statusline_runtime" / "slash_tui"
        base.mkdir(mode=0o700, parents=True, exist_ok=True)
        base.chmod(0o700)
        invocation = Path(tempfile.mkdtemp(prefix="invocation-", dir=base))
        invocation.chmod(0o700)
        result_path = invocation / "result.json"
        return {
            "CLAUDE_STATUSLINE_SLASH_RESULT": str(result_path),
            "CLAUDE_STATUSLINE_SLASH_DEADLINE_SECONDS": deadline,
        }, result_path

    def _read_until(self, needle: bytes, timeout=5):
        output = b""
        deadline = time.monotonic() + timeout
        while needle not in output and time.monotonic() < deadline:
            ready, _, _ = select.select([self.master], [], [], 0.1)
            if not ready:
                if self.process.poll() is not None:
                    break
                continue
            try:
                chunk = os.read(self.master, 65536)
                if not chunk:
                    break
                output += chunk
            except OSError:
                break
        return output

    def _finish_output(self, initial=b""):
        output = initial
        deadline = time.monotonic() + 1
        while time.monotonic() < deadline:
            ready, _, _ = select.select([self.master], [], [], 0.05)
            if not ready:
                if self.process.poll() is not None:
                    break
                continue
            try:
                chunk = os.read(self.master, 65536)
                if not chunk:
                    break
                output += chunk
            except OSError:
                break
        return output

    def test_toggle_move_settings_numeric_edit_and_save(self):
        process, master = self._start()
        output = self._read_until(b"Configure Status Line")
        if b"Preview (sample data)" not in output:
            output += self._read_until(b"Preview (sample data)")
        self.assertIn(b"Preview (sample data)", output)

        # Down, disable current-dir, select git, move it right, open Settings,
        # toggle colors, select Padding, enter 3, accept it, then save.
        os.write(
            master,
            b"\x1bOB \x1bOB\x1bOC\t\t\x1bOC"
            + b"\x1bOB" * 4
            + b"3\r\r",
        )
        self.assertEqual(process.wait(timeout=5), 0)
        output = self._finish_output(output)
        self.assertIn(b"Status line configuration updated.", output)

        display = json.loads(self.display_path.read_text(encoding="utf-8"))
        settings = json.loads(self.settings_path.read_text(encoding="utf-8"))
        self.assertNotIn("current-dir", display["items"])
        self.assertLess(
            display["items"].index("context-remaining"),
            display["items"].index("git"),
        )
        self.assertFalse(display["use_colors"])
        self.assertEqual(settings["statusLine"]["padding"], 3)

    def test_escape_leaves_both_files_byte_identical(self):
        self.display_path.write_text(
            json.dumps(
                {
                    "schema_version": 1,
                    "items": ["git"],
                    "use_colors": True,
                    "palette": "default",
                    "directory_style": "full",
                    "separator_style": "classic",
                },
                indent=2,
            )
            + "\n",
            encoding="utf-8",
        )
        before = (self.settings_path.read_bytes(), self.display_path.read_bytes())
        process, master = self._start()
        output = self._read_until(b"Configure Status Line")
        os.write(master, b"\x1b")
        self.assertEqual(process.wait(timeout=5), 0)
        output = self._finish_output(output)
        self.assertIn(b"Status line configuration unchanged.", output)
        self.assertEqual(
            (self.settings_path.read_bytes(), self.display_path.read_bytes()), before
        )

    def test_first_save_migrates_built_in_defaults_to_schema_two(self):
        before = self.settings_path.read_bytes()
        process, master = self._start()
        output = self._read_until(b"Configure Status Line")
        os.write(master, b"\r")
        self.assertEqual(process.wait(timeout=5), 0)
        output = self._finish_output(output)
        self.assertIn(b"Status line configuration updated.", output)
        self.assertEqual(self.settings_path.read_bytes(), before)
        self.assertTrue((self.config_dir / "backups").exists())
        display = json.loads(self.display_path.read_text(encoding="utf-8"))
        self.assertEqual(display["schema_version"], 2)

    def test_too_small_resize_recovers_and_can_cancel(self):
        before = self.settings_path.read_bytes()
        process, master = self._start(rows=10, columns=40)
        output = self._read_until(b"Terminal too small")
        if b"40x10" not in output:
            output += self._read_until(b"40x10")
        self.assertIn(b"need 64x18", output)
        self.assertIn(b"40x10", output)
        fcntl.ioctl(
            master,
            termios.TIOCSWINSZ,
            struct.pack("HHHH", 24, 100, 0, 0),
        )
        os.kill(process.pid, signal.SIGWINCH)
        output += self._read_until(b"Preview (sample data)")
        self.assertIn(b"Preview (sample data)", output)
        os.write(master, b"\x1b")
        self.assertEqual(process.wait(timeout=5), 0)
        self.assertEqual(self.settings_path.read_bytes(), before)

    def test_uninstalled_invalid_config_and_terminal_failure_are_clean_errors(self):
        cases = []
        self.settings_path.write_text('{"unrelated": true}\n', encoding="utf-8")
        cases.append(("uninstalled", "xterm-256color"))

        for name, term in cases:
            with self.subTest(name=name):
                before = self.settings_path.read_bytes()
                process, _master = self._start(term=term)
                self.assertEqual(process.wait(timeout=5), 2)
                output = self._finish_output()
                self.assertIn(b"error:", output)
                self.assertNotIn(b"Traceback", output)
                self.assertEqual(self.settings_path.read_bytes(), before)
                os.close(self.master)
                self.master = None
                self.process = None

        self._write_installed_settings()
        self.display_path.write_text("{broken", encoding="utf-8")
        before = (
            self.settings_path.read_bytes(),
            self.display_path.read_bytes(),
        )
        process, _master = self._start()
        self.assertEqual(process.wait(timeout=5), 2)
        output = self._finish_output()
        self.assertIn(b"invalid JSON", output)
        self.assertNotIn(b"Traceback", output)
        self.assertEqual(
            (self.settings_path.read_bytes(), self.display_path.read_bytes()), before
        )
        os.close(self.master)
        self.master = None
        self.process = None

        self.display_path.unlink()
        process, _master = self._start(term="definitely-not-a-terminal")
        self.assertEqual(process.wait(timeout=5), 2)
        output = self._finish_output()
        self.assertIn(b"cannot initialize terminal", output)
        self.assertNotIn(b"Traceback", output)

    def test_signals_restore_terminal_and_use_standard_exit_codes(self):
        for signum, expected in (
            (signal.SIGINT, 130),
            (signal.SIGHUP, 129),
            (signal.SIGTERM, 143),
        ):
            with self.subTest(signum=signum):
                before = self.settings_path.read_bytes()
                process, _master = self._start()
                output = self._read_until(b"Configure Status Line")
                os.kill(process.pid, signum)
                self.assertEqual(process.wait(timeout=5), expected)
                output = self._finish_output(output)
                self.assertNotIn(b"Traceback", output)
                self.assertEqual(self.settings_path.read_bytes(), before)
                os.close(self.master)
                self.master = None
                self.process = None

    def test_bridge_save_current_and_cancel_write_results_without_summary(self):
        cases = (
            (b" ", "updated", "updated"),
            (b"\r", "updated", "updated"),
            (b"\x1b", "cancelled", "unchanged"),
        )
        for keys, expected_outcome, expected_message in cases:
            with self.subTest(outcome=expected_outcome):
                self._write_installed_settings()
                if self.display_path.exists():
                    self.display_path.unlink()
                bridge_env, result_path = self._bridge_environment()
                process, master = self._start(extra_env=bridge_env)
                output = self._read_until(b"Configure Status Line")
                os.write(master, keys)
                if keys == b" ":
                    os.write(master, b"\r")
                self.assertEqual(process.wait(timeout=5), 0)
                output = self._finish_output(output)
                result = json.loads(result_path.read_text(encoding="utf-8"))
                self.assertEqual(result["schema_version"], 1)
                self.assertEqual(result["outcome"], expected_outcome)
                self.assertIn(expected_message, result["message"].lower())
                self.assertEqual(
                    stat.S_IMODE(result_path.stat().st_mode), 0o600
                )
                self.assertNotIn(b"Status line configuration updated.", output)
                self.assertNotIn(b"Status line configuration unchanged.", output)
                self.assertNotIn(b"already current", output.lower())
                os.close(self.master)
                self.master = None
                self.process = None

    def test_bridge_ctrl_c_and_signals_write_interrupted_results(self):
        cases = (
            ("signal", signal.SIGINT, 130),
            ("signal", signal.SIGHUP, 129),
            ("signal", signal.SIGTERM, 143),
        )
        for kind, signum, expected_code in cases:
            with self.subTest(kind=kind, signum=signum):
                before = self.settings_path.read_bytes()
                bridge_env, result_path = self._bridge_environment()
                process, master = self._start(extra_env=bridge_env)
                self._read_until(b"Configure Status Line")
                os.kill(process.pid, signum)
                self.assertEqual(process.wait(timeout=5), expected_code)
                result = json.loads(result_path.read_text(encoding="utf-8"))
                self.assertEqual(result["outcome"], "interrupted")
                self.assertIn("no changes were saved", result["message"])
                self.assertEqual(self.settings_path.read_bytes(), before)
                os.close(self.master)
                self.master = None
                self.process = None

    def test_bridge_short_deadline_times_out_without_writes(self):
        before = self.settings_path.read_bytes()
        bridge_env, result_path = self._bridge_environment("0.05")
        process, _master = self._start(extra_env=bridge_env)
        self.assertEqual(process.wait(timeout=5), 0)
        result = json.loads(result_path.read_text(encoding="utf-8"))
        self.assertEqual(result["outcome"], "timed-out")
        self.assertIn("timed out", result["message"])
        self.assertEqual(self.settings_path.read_bytes(), before)
        self.assertFalse(self.display_path.exists())

    def test_bridge_editor_error_writes_error_result_without_traceback(self):
        self.settings_path.write_text('{"unrelated":true}\n', encoding="utf-8")
        before = self.settings_path.read_bytes()
        bridge_env, result_path = self._bridge_environment()
        process, _master = self._start(extra_env=bridge_env)
        self.assertEqual(process.wait(timeout=5), 2)
        output = self._finish_output()
        result = json.loads(result_path.read_text(encoding="utf-8"))
        self.assertEqual(result["outcome"], "error")
        self.assertIn("not installed", result["message"])
        self.assertNotIn(b"Traceback", output)
        self.assertEqual(self.settings_path.read_bytes(), before)


if __name__ == "__main__":
    unittest.main(verbosity=2)
