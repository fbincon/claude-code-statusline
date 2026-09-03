#!/usr/bin/env python3
"""Real tmux popup integration test without a Claude API call."""

import fcntl
import json
import os
from pathlib import Path
import pty
import select
import shlex
import shutil
import struct
import subprocess
import sys
import tempfile
import termios
import time
import unittest

from claude_statusline import display_config as dc


@unittest.skipUnless(
    sys.platform.startswith("linux") and shutil.which("tmux"),
    "tmux is required",
)
class TmuxPopupIntegrationTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="statusline-tmux-")
        self.root = Path(self.temporary.name)
        self.socket_path = self.root / "tmux.sock"
        self.client = None
        self.master = None

    def tearDown(self):
        if self.client is not None and self.client.poll() is None:
            self.client.terminate()
            try:
                self.client.wait(timeout=2)
            except subprocess.TimeoutExpired:
                self.client.kill()
                self.client.wait(timeout=2)
        if self.master is not None:
            try:
                os.close(self.master)
            except OSError:
                pass
        subprocess.run(
            ["tmux", "-S", str(self.socket_path), "kill-server"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=5,
            check=False,
        )
        self.temporary.cleanup()

    def tmux(self, *arguments, check=True):
        return subprocess.run(
            ["tmux", "-S", str(self.socket_path), *arguments],
            capture_output=True,
            text=True,
            encoding="utf-8",
            timeout=5,
            check=check,
        )

    def _attach(self):
        master, slave = pty.openpty()
        fcntl.ioctl(
            slave,
            termios.TIOCSWINSZ,
            struct.pack("HHHH", 30, 100, 0, 0),
        )

        def controlling_terminal():
            os.setsid()
            fcntl.ioctl(slave, termios.TIOCSCTTY, 0)

        env = os.environ.copy()
        env["TERM"] = "xterm-256color"
        self.client = subprocess.Popen(
            [
                "tmux",
                "-S",
                str(self.socket_path),
                "attach-session",
                "-t",
                "test",
            ],
            stdin=slave,
            stdout=slave,
            stderr=slave,
            env=env,
            close_fds=True,
            preexec_fn=controlling_terminal,
        )
        os.close(slave)
        self.master = master
        deadline = time.monotonic() + 5
        while time.monotonic() < deadline:
            clients = self.tmux("list-clients", check=False)
            if clients.returncode == 0 and clients.stdout.strip():
                return
            time.sleep(0.05)
        self.fail("tmux client did not attach")

    def _read_until(self, needle: bytes, timeout=10) -> bytes:
        output = b""
        deadline = time.monotonic() + timeout
        while needle not in output and time.monotonic() < deadline:
            ready, _, _ = select.select([self.master], [], [], 0.1)
            if not ready:
                continue
            try:
                output += os.read(self.master, 65536)
            except OSError:
                break
        return output

    def test_popup_cancel_isolated_from_underlying_pane_and_cleans_up(self):
        config_dir = self.root / "claude"
        config_dir.mkdir()
        executable = self.root / "bin" / "claude-statusline"
        executable.parent.mkdir()
        executable.write_text(
            f'#!/bin/sh\nexec "{sys.executable}" -m claude_statusline "$@"\n',
            encoding="utf-8",
        )
        executable.chmod(0o755)
        settings_path = config_dir / "settings.json"
        settings_path.write_text(
            json.dumps({
                "statusLine": {
                    "type": "command",
                    "command": f'"{executable}" render',
                    "refreshInterval": 1,
                }
            }) + "\n",
            encoding="utf-8",
        )
        display_path = dc.config_path(config_dir)
        dc.write_display_config(config_dir, dc.DEFAULT_CONFIG)
        before = (settings_path.read_bytes(), display_path.read_bytes())
        result_path = self.root / "driver-result.json"
        driver = self.root / "driver.py"
        driver.write_text(
            "import json, sys\n"
            "from pathlib import Path\n"
            "from claude_statusline import slash_tui\n"
            "result = slash_tui.launch(Path(sys.argv[1]), Path(sys.argv[2]), sys.argv[1])\n"
            "Path(sys.argv[3]).write_text(json.dumps(result.as_dict()), encoding='utf-8')\n",
            encoding="utf-8",
        )

        env = os.environ.copy()
        env["PYTHONPATH"] = str(Path(__file__).resolve().parents[1] / "src")
        env["PYTHONDONTWRITEBYTECODE"] = "1"
        self.tmux(
            "-f",
            "/dev/null",
            "new-session",
            "-d",
            "-s",
            "test",
            "-x",
            "100",
            "-y",
            "30",
        )
        self.tmux("set-environment", "-g", "PYTHONPATH", env["PYTHONPATH"])
        self.tmux("set-environment", "-g", "PYTHONDONTWRITEBYTECODE", "1")
        self.tmux(
            "set-environment",
            "-g",
            "PATH",
            str(executable.parent) + os.pathsep + env.get("PATH", ""),
        )
        self._attach()
        pane = self.tmux("display-message", "-p", "-t", "test", "#{pane_id}").stdout.strip()
        command = shlex.join([
            sys.executable,
            str(driver),
            str(config_dir),
            str(executable),
            str(result_path),
        ])
        self.tmux("send-keys", "-l", "-t", pane, command)
        self.tmux("send-keys", "-t", pane, "Enter")

        popup_output = self._read_until(b"Configure Status Line", timeout=10)
        self.assertIn(b"Configure Status Line", popup_output)
        self.assertFalse(result_path.exists(), "driver returned before popup input")
        os.write(self.master, b"\x1b")

        deadline = time.monotonic() + 10
        while not result_path.exists() and time.monotonic() < deadline:
            time.sleep(0.05)
        self.assertTrue(result_path.exists(), "popup driver did not return")
        result = json.loads(result_path.read_text(encoding="utf-8"))
        self.assertEqual(result["outcome"], "cancelled", result)
        self.assertEqual(
            (settings_path.read_bytes(), display_path.read_bytes()), before
        )
        pane_text = self.tmux(
            "capture-pane", "-p", "-t", pane, "-S", "-100"
        ).stdout
        self.assertNotIn("Preview (sample data)", pane_text)
        self.assertNotIn("Space toggle", pane_text)
        runtime = config_dir / "statusline_runtime" / "slash_tui"
        self.assertEqual(list(runtime.glob("invocation-*")), [])


if __name__ == "__main__":
    unittest.main(verbosity=2)
