#!/usr/bin/env python3
"""Unit tests for the experimental terminal launchers and result bridge."""

from claude_statusline.integration import bridge as integration_bridge
from claude_statusline.integration import launcher as integration_launcher
from claude_statusline.integration import models as integration_models
from claude_statusline.platforms import environment as platform_environment
from claude_statusline.platforms import files as platform_files
from claude_statusline.platforms import macos_terminal as platform_macos_terminal

import json
import os
from pathlib import Path
import shlex
import stat
import tempfile
import time
import unittest
from unittest import mock


class SlashTuiTestCase(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="statusline-launcher-")
        self.root = Path(self.temporary.name)
        self.config_dir = self.root / "claude"
        self.executable = self.root / "bin" / "claude-statusline"
        self.executable.parent.mkdir()
        self.executable.write_text("#!/bin/sh\n", encoding="utf-8")
        self.executable.chmod(0o755)
        self.cwd = self.root / "working directory"
        self.cwd.mkdir()

    def tearDown(self):
        self.temporary.cleanup()

    @staticmethod
    def result_bytes(outcome="cancelled", exit_code=0, message="unchanged"):
        return (
            json.dumps(
                {
                    "schema_version": 1,
                    "outcome": outcome,
                    "exit_code": exit_code,
                    "message": message,
                }
            )
            + "\n"
        ).encode()


class SelectionAndArgumentsTests(SlashTuiTestCase):
    def setUp(self):
        super().setUp()
        platform_patcher = mock.patch.object(
            platform_environment, "is_windows", return_value=False
        )
        platform_patcher.start()
        self.addCleanup(platform_patcher.stop)
        macos_patcher = mock.patch.object(
            platform_environment, "is_macos", return_value=False
        )
        macos_patcher.start()
        self.addCleanup(macos_patcher.stop)

    def test_macos_without_desktop_requires_valid_tmux_and_never_selects_gnome(self):

        environ = {
            "PATH": "/bin",
            "DISPLAY": ":0",
            "TMUX": "server",
            "TMUX_PANE": "%3",
        }
        with (
            mock.patch.object(platform_environment, "is_macos", return_value=True),
            mock.patch.object(
                integration_launcher.shutil,
                "which",
                side_effect=lambda name, path=None: f"/usr/bin/{name}",
            ) as which,
            mock.patch.object(
                integration_launcher, "_tmux_preflight", return_value=False
            ),
            mock.patch.object(
                platform_macos_terminal,
                "availability",
                return_value=(False, "headless"),
            ),
        ):
            self.assertIsNone(integration_launcher.choose_launcher(environ))
            self.assertEqual([call.args[0] for call in which.call_args_list], ["tmux"])
        with (
            mock.patch.object(platform_environment, "is_macos", return_value=True),
            mock.patch.object(
                integration_launcher.shutil,
                "which",
                return_value="/opt/homebrew/bin/tmux",
            ),
            mock.patch.object(
                integration_launcher, "_tmux_preflight", return_value=True
            ),
            mock.patch.object(platform_macos_terminal, "availability") as terminal,
        ):
            self.assertEqual(
                integration_launcher.choose_launcher(environ),
                integration_models.Launcher("tmux", "/opt/homebrew/bin/tmux", "%3"),
            )
            terminal.assert_not_called()

    def test_tmux_preflight_has_two_second_limit_and_takes_priority(self):
        completed = mock.Mock(returncode=0, stdout=b"%12\n", stderr=b"")
        environ = {
            "PATH": "/bin",
            "TMUX": "/tmp/tmux/default,1,0",
            "TMUX_PANE": "%12",
            "DISPLAY": ":0",
        }

        def which(name, path=None):
            return f"/usr/bin/{name}"

        with (
            mock.patch.object(integration_launcher.shutil, "which", side_effect=which),
            mock.patch.object(
                integration_launcher.subprocess, "run", return_value=completed
            ) as run,
        ):
            launcher = integration_launcher.choose_launcher(environ)
        self.assertEqual(
            launcher, integration_models.Launcher("tmux", "/usr/bin/tmux", "%12")
        )
        self.assertEqual(run.call_args.args[0][-2:], ["%12", "#{pane_id}"])
        self.assertEqual(
            run.call_args.kwargs["timeout"],
            integration_models.PREFLIGHT_TIMEOUT_SECONDS,
        )

    def test_failed_or_invalid_tmux_preflight_falls_back_to_gnome(self):
        environ = {
            "PATH": "/bin",
            "TMUX": "server",
            "TMUX_PANE": "%3",
            "WAYLAND_DISPLAY": "wayland-0",
        }
        with (
            mock.patch.object(
                integration_launcher.shutil,
                "which",
                side_effect=lambda name, path=None: f"/usr/bin/{name}",
            ),
            mock.patch.object(
                integration_launcher, "_tmux_preflight", return_value=False
            ),
        ):
            self.assertEqual(
                integration_launcher.choose_launcher(environ),
                integration_models.Launcher("gnome", "/usr/bin/gnome-terminal"),
            )

        invalid = {**environ, "TMUX_PANE": "%3; touch /tmp/nope"}
        with (
            mock.patch.object(
                integration_launcher.shutil,
                "which",
                side_effect=lambda name, path=None: f"/usr/bin/{name}",
            ),
            mock.patch.object(integration_launcher, "_tmux_preflight") as preflight,
        ):
            launcher = integration_launcher.choose_launcher(invalid)
        self.assertEqual(launcher.kind, "gnome")
        preflight.assert_not_called()

    def test_no_tmux_or_graphical_gnome_returns_none(self):
        with mock.patch.object(integration_launcher.shutil, "which", return_value=None):
            self.assertIsNone(integration_launcher.choose_launcher({"PATH": "/bin"}))

    def test_tmux_command_uses_fixed_argv_and_shell_quotes_every_value(self):
        config_dir = self.root / "claude config; echo BAD"
        executable = self.root / "bin" / "tool; echo BAD"
        result_path = (
            config_dir
            / "statusline_runtime"
            / "slash_tui"
            / ("invocation-x/result.json")
        )
        argv = integration_launcher.build_launcher_argv(
            integration_models.Launcher("tmux", "/usr/bin/tmux", "%7"),
            executable,
            config_dir,
            self.cwd,
            result_path,
        )
        self.assertEqual(
            argv[:10],
            [
                "/usr/bin/tmux",
                "display-popup",
                "-E",
                "-T",
                "Configure Status Line",
                "-w",
                "90%",
                "-h",
                "90%",
                "-d",
            ],
        )
        self.assertEqual(argv[10:13], [str(self.cwd), "-t", "%7"])
        self.assertEqual(
            shlex.split(argv[-1]),
            [
                "env",
                f"{integration_models.RESULT_ENV}={result_path}",
                f"{integration_models.DEADLINE_ENV}=570",
                str(executable),
                "configure",
                "--config-dir",
                str(config_dir),
            ],
        )

    def test_gnome_uses_direct_argv_active_tab_wait_and_validated_cwd(self):
        result_path = self.root / "result.json"
        argv = integration_launcher.build_launcher_argv(
            integration_models.Launcher("gnome", "/usr/bin/gnome-terminal"),
            self.executable,
            self.config_dir,
            self.cwd,
            result_path,
        )
        self.assertEqual(
            argv[:7],
            [
                "/usr/bin/gnome-terminal",
                "--tab",
                "--active",
                "--wait",
                "--title=Configure Status Line",
                f"--working-directory={self.cwd}",
                "--",
            ],
        )
        self.assertEqual(
            argv[7:],
            [
                str(self.executable),
                "configure",
                "--config-dir",
                str(self.config_dir),
            ],
        )
        self.assertEqual(integration_launcher.validate_cwd(str(self.cwd)), self.cwd)
        self.assertEqual(
            integration_launcher.validate_cwd("relative/path"), Path.home()
        )
        self.assertEqual(
            integration_launcher.validate_cwd(str(self.root / "missing")), Path.home()
        )


class WindowsConsoleTests(SlashTuiTestCase):
    def test_selection_and_argv_use_current_python_module(self):
        with mock.patch.object(platform_environment, "is_windows", return_value=True):
            launcher = integration_launcher.choose_launcher({})
            argv = integration_launcher.build_launcher_argv(
                launcher,
                self.executable,
                self.config_dir,
                self.cwd,
                self.root / "result.json",
            )
        self.assertEqual(
            launcher,
            integration_models.Launcher(
                "windows-console", integration_launcher.sys.executable
            ),
        )
        self.assertEqual(
            argv,
            [
                integration_launcher.sys.executable,
                "-m",
                "claude_statusline",
                "configure",
                "--config-dir",
                str(self.config_dir),
            ],
        )

    def test_popen_uses_new_console_real_cwd_and_no_redirection(self):
        launcher = integration_models.Launcher(
            "windows-console", integration_launcher.sys.executable
        )
        process = mock.Mock()
        process.wait.return_value = 0
        environment = {"PATH": "test"}
        with (
            mock.patch.object(platform_environment, "is_windows", return_value=True),
            mock.patch.object(
                integration_launcher.subprocess, "Popen", return_value=process
            ) as popen,
        ):
            result = integration_launcher._run_launcher(
                [integration_launcher.sys.executable, "-m", "claude_statusline"],
                environment,
                launcher=launcher,
                cwd=self.cwd,
            )
        self.assertEqual(result, (0, b"", b"", False))
        kwargs = popen.call_args.kwargs
        self.assertEqual(kwargs["cwd"], str(self.cwd))
        self.assertEqual(kwargs["env"], environment)
        self.assertNotEqual(kwargs["creationflags"], 0)
        for stream in ("stdin", "stdout", "stderr"):
            self.assertNotIn(stream, kwargs)

    def test_timeout_terminates_and_reaps_windows_child(self):
        launcher = integration_models.Launcher(
            "windows-console", integration_launcher.sys.executable
        )
        process = mock.Mock()
        process.wait.side_effect = [
            integration_launcher.subprocess.TimeoutExpired(
                ["python"], integration_models.LAUNCHER_TIMEOUT_SECONDS
            ),
            7,
        ]
        with (
            mock.patch.object(platform_environment, "is_windows", return_value=True),
            mock.patch.object(
                integration_launcher.subprocess, "Popen", return_value=process
            ),
        ):
            result = integration_launcher._run_launcher(
                ["python"], {}, launcher=launcher, cwd=self.cwd
            )
        self.assertEqual(result, (7, b"", b"", True))
        process.terminate.assert_called_once_with()
        process.kill.assert_not_called()

    def test_abnormal_exit_cannot_return_a_success_result(self):
        launcher = integration_models.Launcher(
            "windows-console", integration_launcher.sys.executable
        )

        def run(_argv, environ, **_kwargs):
            Path(environ[integration_models.RESULT_ENV]).write_bytes(
                self.result_bytes("updated", 0, "updated")
            )
            return 9, b"", b"", False

        with (
            mock.patch.object(
                integration_launcher, "choose_launcher", return_value=launcher
            ),
            mock.patch.object(integration_launcher, "_run_launcher", side_effect=run),
        ):
            result = integration_launcher.launch(
                self.config_dir,
                self.executable,
                str(self.cwd),
                environ={"PATH": "test"},
            )
        self.assertEqual(result.outcome, "error")
        self.assertEqual(result.exit_code, 9)
        self.assertIn("exited with code 9", result.message)


class ResultValidationTests(SlashTuiTestCase):
    def make_invocation(self):
        invocation, result = integration_bridge._create_invocation_dir(self.config_dir)
        if os.name == "posix":
            self.assertEqual(stat.S_IMODE(invocation.stat().st_mode), 0o700)
        return invocation, result

    def test_valid_result_round_trip(self):
        invocation, path = self.make_invocation()
        path.write_bytes(self.result_bytes("updated", 0, "updated"))
        path.chmod(0o600)
        result = integration_bridge.read_result(path, invocation)
        self.assertEqual(result.outcome, "updated")
        self.assertEqual(result.message, "updated")

    def test_result_requires_exact_random_invocation_parent(self):
        invocation = self.root / "not-an-invocation"
        invocation.mkdir()
        path = invocation / integration_models.RESULT_FILENAME
        path.write_bytes(self.result_bytes())
        with self.assertRaisesRegex(
            integration_models.ResultError, "outside this invocation"
        ):
            integration_bridge.read_result(path, invocation)

        real_invocation, real_path = self.make_invocation()
        outside = self.root / integration_models.RESULT_FILENAME
        outside.write_bytes(self.result_bytes())
        with self.assertRaisesRegex(
            integration_models.ResultError, "outside this invocation"
        ):
            integration_bridge.read_result(outside, real_invocation)

    def test_missing_oversized_symlink_and_non_regular_results_fail(self):
        invocation, path = self.make_invocation()
        with self.assertRaises(integration_models.ResultError):
            integration_bridge.read_result(path, invocation)

        path.write_bytes(b"x" * (integration_models.RESULT_SIZE_LIMIT + 1))
        with self.assertRaisesRegex(integration_models.ResultError, "16 KiB"):
            integration_bridge.read_result(path, invocation)
        path.unlink()

        target = self.root / "outside.json"
        target.write_bytes(self.result_bytes())
        if os.name == "posix":
            path.symlink_to(target)
            with self.assertRaises(integration_models.ResultError):
                integration_bridge.read_result(path, invocation)
            path.unlink()
        else:
            path.write_bytes(self.result_bytes())
            with (
                mock.patch.object(
                    platform_files,
                    "is_link_or_reparse",
                    side_effect=lambda value: Path(value) == path,
                ),
                self.assertRaises(integration_models.ResultError),
            ):
                integration_bridge.read_result(path, invocation)
            path.unlink()

        path.mkdir()
        with self.assertRaises(integration_models.ResultError):
            integration_bridge.read_result(path, invocation)

    def test_strict_result_schema_and_outcome(self):
        invalid_values = [
            {},
            {
                "schema_version": 2,
                "outcome": "cancelled",
                "exit_code": 0,
                "message": "x",
            },
            {
                "schema_version": 1,
                "outcome": "unknown",
                "exit_code": 0,
                "message": "x",
            },
            {
                "schema_version": 1,
                "outcome": "cancelled",
                "exit_code": True,
                "message": "x",
            },
            {
                "schema_version": 1,
                "outcome": "cancelled",
                "exit_code": 0,
                "message": "two\nlines",
            },
        ]
        invocation, path = self.make_invocation()
        for value in invalid_values:
            with self.subTest(value=value):
                path.write_text(json.dumps(value), encoding="utf-8")
                with self.assertRaises(integration_models.ResultError):
                    integration_bridge.read_result(path, invocation)


class LaunchAndCleanupTests(SlashTuiTestCase):
    def test_unavailable_does_not_create_runtime_directory(self):
        with mock.patch.object(
            integration_launcher, "choose_launcher", return_value=None
        ):
            result = integration_launcher.launch(
                self.config_dir, self.executable, str(self.cwd), environ={}
            )
        self.assertEqual(result.outcome, "error")
        self.assertEqual(result.message, integration_models.UNAVAILABLE_MESSAGE)
        self.assertFalse(self.config_dir.exists())

    def test_launch_passes_bridge_environment_reads_and_cleans_result(self):
        captured = {}

        def run(argv, environ, **_kwargs):
            captured["argv"] = argv
            captured["environ"] = environ
            path = Path(environ[integration_models.RESULT_ENV])
            path.write_bytes(
                self.result_bytes(
                    "cancelled", 0, "Status line configuration unchanged."
                )
            )
            path.chmod(0o600)
            return 0, b"terminal stdout", b"terminal stderr", False

        with (
            mock.patch.object(
                integration_launcher,
                "choose_launcher",
                return_value=integration_models.Launcher(
                    "gnome", "/usr/bin/gnome-terminal"
                ),
            ),
            mock.patch.object(integration_launcher, "_run_launcher", side_effect=run),
        ):
            result = integration_launcher.launch(
                self.config_dir,
                self.executable,
                str(self.cwd),
                environ={"DISPLAY": ":0", "PATH": "/bin"},
            )
        self.assertEqual(result.outcome, "cancelled")
        self.assertEqual(captured["environ"][integration_models.DEADLINE_ENV], "570")
        result_path = Path(captured["environ"][integration_models.RESULT_ENV])
        self.assertFalse(result_path.exists())
        self.assertFalse(result_path.parent.exists())

    def test_selected_tmux_failure_does_not_try_gnome(self):
        chooser = mock.Mock(
            return_value=integration_models.Launcher("tmux", "/usr/bin/tmux", "%1")
        )
        with (
            mock.patch.object(integration_launcher, "choose_launcher", chooser),
            mock.patch.object(
                integration_launcher,
                "_run_launcher",
                return_value=(1, b"ignored stdout", b"popup failed\nmore", False),
            ),
        ):
            result = integration_launcher.launch(
                self.config_dir,
                self.executable,
                str(self.cwd),
                environ={"DISPLAY": ":0"},
            )
        self.assertEqual(chooser.call_count, 1)
        self.assertEqual(result.outcome, "error")
        self.assertIn("popup failed", result.message)
        self.assertNotIn("more", result.message)

    def test_launcher_timeout_and_missing_result_are_safe_errors(self):
        with (
            mock.patch.object(
                integration_launcher,
                "choose_launcher",
                return_value=integration_models.Launcher(
                    "gnome", "/usr/bin/gnome-terminal"
                ),
            ),
            mock.patch.object(
                integration_launcher,
                "_run_launcher",
                return_value=(-15, b"", b"", True),
            ),
        ):
            result = integration_launcher.launch(
                self.config_dir, self.executable, None, environ={"DISPLAY": ":0"}
            )
        self.assertEqual(result.outcome, "error")
        self.assertIn("585 seconds", result.message)

    def test_stale_cleanup_is_age_name_and_symlink_limited(self):
        base = self.config_dir / "statusline_runtime" / "slash_tui"
        base.mkdir(parents=True)
        old = base / "invocation-old"
        old.mkdir()
        (old / "result.json").write_text("old", encoding="utf-8")
        linked = base / "invocation-linked"
        linked.mkdir()
        if os.name == "posix":
            (linked / "link").symlink_to(self.root / "outside")
        else:
            (linked / "link").write_text("reparse stand-in", encoding="utf-8")
        recent = base / "invocation-recent"
        recent.mkdir()
        foreign = base / "keep-me"
        foreign.mkdir()
        old_time = time.time() - integration_models.STALE_AFTER_SECONDS - 60
        for path in (old, linked, foreign):
            os.utime(path, (old_time, old_time))

        original_check = platform_files.is_link_or_reparse
        with mock.patch.object(
            platform_files,
            "is_link_or_reparse",
            side_effect=lambda value: (
                Path(value) == linked / "link" or original_check(value)
            ),
        ):
            integration_bridge.cleanup_stale_invocations(base)
        self.assertFalse(old.exists())
        self.assertTrue(linked.exists())
        self.assertTrue(recent.exists())
        self.assertTrue(foreign.exists())


if __name__ == "__main__":
    unittest.main(verbosity=2)
