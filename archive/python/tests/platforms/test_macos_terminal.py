"""Terminal.app selection, detached launch, trusted handshake and cancellation."""

from claude_statusline.config import service as config_service
from claude_statusline.integration import bridge as integration_bridge
from claude_statusline.integration import installer as integration_installer
from claude_statusline.integration import launcher as integration_launcher
from claude_statusline.integration import models as integration_models
from claude_statusline.platforms import environment as platform_environment
from claude_statusline.platforms import files as platform_files
from claude_statusline.platforms import macos_terminal as platform_macos_terminal
from claude_statusline.platforms import processes as platform_processes
from claude_statusline.ui import models as ui_models
from claude_statusline.ui import session as ui_session

import io
import json
import os
from pathlib import Path
import signal
import shlex
import stat
import subprocess
import tempfile
import time
import unittest
from unittest import mock


class TTY(io.StringIO):
    def isatty(self):
        return True


class AvailabilityTests(unittest.TestCase):
    def test_desktop_preflight_is_read_only_and_bounded(self):
        with (
            mock.patch.object(platform_environment, "is_macos", return_value=True),
            mock.patch.object(platform_macos_terminal.os, "access", return_value=True),
            mock.patch.object(Path, "is_dir", return_value=True),
            mock.patch.object(
                platform_macos_terminal.os, "getuid", return_value=501, create=True
            ),
            mock.patch.object(
                platform_macos_terminal.subprocess,
                "run",
                return_value=mock.Mock(returncode=0),
            ) as run,
        ):
            available, detail = platform_macos_terminal.availability({"PATH": "/bin"})
        self.assertTrue(available)
        self.assertIn("Terminal.app", detail)
        self.assertEqual(run.call_args.args[0], ["/bin/launchctl", "print", "gui/501"])
        self.assertEqual(run.call_args.kwargs["timeout"], 2)

    def test_ssh_and_missing_terminal_do_not_launch_or_probe_desktop(self):
        with (
            mock.patch.object(platform_environment, "is_macos", return_value=True),
            mock.patch.object(platform_macos_terminal.os, "access", return_value=False),
            mock.patch.object(platform_macos_terminal.subprocess, "run") as run,
        ):
            for env in ({"SSH_TTY": "/dev/ttys0"}, {"SSH_CONNECTION": "remote"}, {}):
                self.assertFalse(platform_macos_terminal.availability(env)[0])
            run.assert_not_called()

    def test_no_gui_and_failed_gui_probe_are_unavailable(self):
        with (
            mock.patch.object(platform_environment, "is_macos", return_value=True),
            mock.patch.object(platform_macos_terminal.os, "access", return_value=True),
            mock.patch.object(Path, "is_dir", return_value=True),
            mock.patch.object(
                platform_macos_terminal.os, "getuid", return_value=501, create=True
            ),
            mock.patch.object(platform_macos_terminal.subprocess, "run") as run,
        ):
            run.return_value = mock.Mock(returncode=1)
            self.assertFalse(platform_macos_terminal.availability({})[0])
            run.side_effect = subprocess.TimeoutExpired("launchctl", 2)
            self.assertFalse(platform_macos_terminal.availability({})[0])

    def test_macos_desktop_falls_back_from_invalid_tmux_to_terminal(self):
        with (
            mock.patch.object(platform_environment, "is_windows", return_value=False),
            mock.patch.object(platform_environment, "is_macos", return_value=True),
            mock.patch.object(
                integration_launcher, "_tmux_preflight", return_value=False
            ),
            mock.patch.object(integration_launcher, "_which", return_value="/bin/tmux"),
            mock.patch.object(
                platform_macos_terminal, "availability", return_value=(True, "desktop")
            ),
        ):
            launcher = integration_launcher.choose_launcher(
                {"TMUX": "server", "TMUX_PANE": "%1"}
            )
        self.assertEqual(
            launcher, integration_models.Launcher("macos-terminal", "/usr/bin/open")
        )


class InvocationTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="statusline-terminal-")
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.config = self.root / "Claude 中文 '$HOME;`quoted`"
        self.executable = self.root / "tool with '$HOME; quotes"
        self.cwd = self.root / "项目 with spaces"
        self.cwd.mkdir()
        self.invocation, self.result = integration_bridge._create_invocation_dir(
            self.config
        )
        self.request = self.invocation / platform_macos_terminal.REQUEST_FILENAME

    def prepare(self):
        with mock.patch.object(
            platform_processes, "process_start_token", return_value="parent"
        ):
            return platform_macos_terminal.prepare(
                self.config,
                self.executable,
                self.cwd,
                self.invocation,
                {"PATH": "/custom/bin"},
            )

    def write_started(self, value=None):
        value = value or {"schema_version": 1, "pid": 123456789, "proc_start": "child"}
        platform_files.atomic_write_bytes(
            self.invocation / platform_macos_terminal.STARTED_FILENAME,
            platform_macos_terminal._json_bytes(value),
        )

    @unittest.skipUnless(os.name == "posix", "POSIX shell execution")
    def test_command_quotes_paths_environment_and_uses_exact_python(self):
        capture = self.root / "arguments.txt"
        python = self.root / "python ' 中文"
        python.write_text(
            '#!/bin/sh\nprintf "%s\\n" "$PATH" "$PYTHONUTF8" "$@" > '
            + shlex.quote(str(capture))
            + "\n",
            encoding="utf-8",
        )
        python.chmod(0o700)
        hostile_path = str(self.root / "bin'; touch SHOULD_NOT_EXIST; '$HOME`")
        with (
            mock.patch.object(
                platform_processes, "process_start_token", return_value="parent"
            ),
            mock.patch.object(platform_macos_terminal.sys, "executable", str(python)),
        ):
            script = platform_macos_terminal.prepare(
                self.config,
                self.executable,
                self.cwd,
                self.invocation,
                {"PATH": hostile_path},
            )
        subprocess.run(["/bin/sh", str(script)], check=True, timeout=5)
        self.assertEqual(
            capture.read_text().splitlines(),
            [
                hostile_path,
                "1",
                "-m",
                "claude_statusline.macos_terminal",
                str(self.request),
            ],
        )
        self.assertFalse((self.root / "SHOULD_NOT_EXIST").exists())
        self.assertEqual(stat.S_IMODE(script.stat().st_mode), 0o700)
        self.assertEqual(stat.S_IMODE(self.request.stat().st_mode), 0o600)
        request = json.loads(self.request.read_bytes())
        self.assertEqual(request["cwd"], str(self.cwd))
        self.assertEqual(request["executable"], str(self.executable))

    def launch(self, opened, **patches):
        with (
            mock.patch.object(
                platform_processes, "process_start_token", return_value="parent"
            ),
            mock.patch.object(
                platform_macos_terminal.subprocess, "run", side_effect=opened
            ),
            mock.patch.object(platform_macos_terminal, "_stop_owned") as stop,
            mock.patch.object(
                platform_macos_terminal,
                "_alive",
                return_value=patches.get("alive", True),
            ),
            mock.patch.object(
                platform_macos_terminal,
                "STARTUP_TIMEOUT_SECONDS",
                patches.get("startup", 30),
            ),
            mock.patch.object(
                integration_models,
                "LAUNCHER_TIMEOUT_SECONDS",
                patches.get("deadline", 585),
            ),
        ):
            result = platform_macos_terminal.launch(
                self.config, self.executable, self.cwd, self.invocation, {}
            )
        self.assertFalse(self.request.exists())
        return result, stop

    def test_open_success_waits_for_handshake_and_editor_result(self):
        def opened(argv, **kwargs):
            self.assertEqual(argv[:3], ["/usr/bin/open", "-b", "com.apple.Terminal"])
            self.assertEqual(kwargs["stdin"], subprocess.DEVNULL)
            self.write_started()
            platform_files.atomic_write_bytes(
                self.result,
                platform_macos_terminal._json_bytes(
                    integration_models.TuiResult(
                        1, "cancelled", 0, "unchanged"
                    ).as_dict()
                ),
            )
            return mock.Mock(returncode=0)

        result, stop = self.launch(opened)
        self.assertEqual(result.outcome, "cancelled")
        stop.assert_called_once_with((123456789, "child"))

    def test_open_exit_zero_without_handshake_is_not_editor_success(self):
        result, _ = self.launch(
            lambda *args, **kwargs: mock.Mock(returncode=0), startup=0.01
        )
        self.assertEqual(result.outcome, "error")
        self.assertIn("did not start", result.message)

    def test_open_errors_and_timeout_revoke_invocation(self):
        for failure in (
            OSError("open unavailable"),
            subprocess.TimeoutExpired("open", 30),
        ):
            with self.subTest(failure=failure):
                result, _ = self.launch(mock.Mock(side_effect=failure))
                self.assertEqual(result.outcome, "error")
                self.assertIn("configure", result.message)
        result, _ = self.launch(
            lambda *args, **kwargs: mock.Mock(
                returncode=3, stderr=b"launch rejected\n", stdout=b""
            )
        )
        self.assertIn("launch rejected", result.message)

    def test_close_and_total_timeout_are_errors_without_a_result(self):
        def opened(*args, **kwargs):
            self.write_started()
            return mock.Mock(returncode=0)

        closed, _ = self.launch(opened, alive=False)
        self.assertIn("closed without a result", closed.message)
        timed_out, _ = self.launch(opened, deadline=0.01)
        self.assertIn("585 seconds", timed_out.message)

    def test_malformed_handshake_and_result_are_rejected(self):
        def invalid_started(*args, **kwargs):
            self.write_started(
                {"schema_version": 1, "pid": True, "proc_start": "child"}
            )
            return mock.Mock(returncode=0)

        result, stop = self.launch(invalid_started)
        self.assertIn("process identity", result.message)
        stop.assert_called_once_with(None)

        def invalid_result(*args, **kwargs):
            self.write_started()
            platform_files.atomic_write_bytes(self.result, b"{}")
            return mock.Mock(returncode=0)

        result, _ = self.launch(invalid_result)
        self.assertEqual(result.outcome, "error")

    def test_cleanup_removes_only_current_invocation_artifacts(self):
        self.prepare()
        self.write_started()
        neighbour, _ = integration_bridge._create_invocation_dir(self.config)
        integration_bridge._clean_current_invocation(self.invocation, self.result)
        self.assertFalse(self.invocation.exists())
        self.assertTrue(neighbour.exists())

    def test_editor_uses_explicit_executable_and_guards_revoked_request(self):
        self.prepare()
        with (
            mock.patch.object(platform_macos_terminal.sys, "stdin", TTY()),
            mock.patch.object(platform_macos_terminal.sys, "stdout", TTY()),
            mock.patch.object(platform_macos_terminal.os, "chdir") as chdir,
            mock.patch.object(
                platform_processes, "process_start_token", return_value="editor"
            ),
            mock.patch.object(platform_macos_terminal, "_alive", return_value=True),
            mock.patch.object(ui_session, "run", return_value=0) as run,
        ):
            self.assertEqual(platform_macos_terminal.run_editor(self.request), 0)
            self.assertEqual(run.call_args.args, (self.config, self.executable))
            chdir.assert_called_once_with(str(self.cwd))
            guard = run.call_args.kwargs["guard"]
            guard()
            with mock.patch.object(
                platform_macos_terminal, "_alive", return_value=False
            ):
                with self.assertRaises(ui_models.ConfigureAborted):
                    guard()
            self.request.unlink()
            with self.assertRaises(ui_models.ConfigureAborted) as aborted:
                guard()
            self.assertEqual(aborted.exception.outcome.outcome, "interrupted")

    def test_editor_rejects_non_tty_and_expired_request(self):
        self.prepare()
        with (
            mock.patch.object(platform_macos_terminal, "_alive", return_value=True),
            mock.patch.object(platform_macos_terminal.sys, "stdin", io.StringIO()),
        ):
            with self.assertRaisesRegex(
                integration_models.ResultError, "terminal stdin"
            ):
                platform_macos_terminal.run_editor(self.request)
        self.assertFalse(
            (self.invocation / platform_macos_terminal.STARTED_FILENAME).exists()
        )
        request = json.loads(self.request.read_bytes())
        request.update(
            startup_deadline=time.monotonic() - 2, deadline=time.monotonic() - 1
        )
        platform_files.atomic_write_bytes(
            self.request, platform_macos_terminal._json_bytes(request)
        )
        with mock.patch.object(platform_macos_terminal, "_alive", return_value=True):
            with self.assertRaises(ui_models.ConfigureAborted):
                platform_macos_terminal.run_editor(self.request)

    @unittest.skipUnless(os.name == "posix", "POSIX Terminal signals")
    def test_stop_never_signals_reused_process_identity(self):
        with (
            mock.patch.object(
                platform_processes, "process_start_token", return_value="different"
            ),
            mock.patch.object(platform_macos_terminal.os, "kill") as kill,
        ):
            platform_macos_terminal._stop_owned((123456789, "child"))
        kill.assert_not_called()

    @unittest.skipUnless(os.name == "posix", "POSIX Terminal signals")
    def test_stop_terminates_only_verified_editor_and_escalates(self):
        signals = []
        with (
            mock.patch.object(
                platform_macos_terminal,
                "_alive",
                side_effect=lambda identity: len(signals) < 2,
            ),
            mock.patch.object(
                platform_macos_terminal.time, "monotonic", side_effect=range(100)
            ),
            mock.patch.object(
                platform_macos_terminal.os,
                "kill",
                side_effect=lambda pid, sig: signals.append((pid, sig)),
            ),
        ):
            platform_macos_terminal._stop_owned((123456789, "child"))
        self.assertEqual(
            signals, [(123456789, signal.SIGTERM), (123456789, signal.SIGKILL)]
        )


class CommitGuardTests(unittest.TestCase):
    def test_parent_ending_after_ui_save_prevents_transaction_under_lock(self):
        with tempfile.TemporaryDirectory(
            prefix="statusline-terminal-guard-"
        ) as directory:
            config, executable = Path(directory), Path(directory) / "claude-statusline"
            integration_installer.install_configuration(
                config, executable, claude_version=(2, 1, 258)
            )
            before = (config / "settings.json").read_bytes()
            calls = []

            def guard():
                calls.append(True)
                if len(calls) > 1:
                    raise ui_models.ConfigureAborted(
                        ui_models.ConfigureOutcome("interrupted", 130, "caller ended")
                    )

            with (
                mock.patch.object(
                    ui_session, "_run_curses", return_value=ui_models.SAVE
                ),
                mock.patch.object(config_service, "_backup_transaction") as backup,
            ):
                outcome = ui_session.execute(
                    config,
                    executable,
                    input_stream=TTY(),
                    output_stream=TTY(),
                    guard=guard,
                )
            self.assertEqual(outcome.outcome, "interrupted")
            self.assertEqual(len(calls), 2)
            self.assertEqual((config / "settings.json").read_bytes(), before)
            backup.assert_not_called()


if __name__ == "__main__":
    unittest.main()
