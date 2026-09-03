#!/usr/bin/env python3
"""Unit tests for the experimental tmux/GNOME launcher and result bridge."""

import json
import os
from pathlib import Path
import shlex
import stat
import tempfile
import time
import unittest
from unittest import mock

from claude_statusline import slash_tui as st


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
        return (json.dumps({
            "schema_version": 1,
            "outcome": outcome,
            "exit_code": exit_code,
            "message": message,
        }) + "\n").encode()


class SelectionAndArgumentsTests(SlashTuiTestCase):
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
            mock.patch.object(st.shutil, "which", side_effect=which),
            mock.patch.object(st.subprocess, "run", return_value=completed) as run,
        ):
            launcher = st.choose_launcher(environ)
        self.assertEqual(launcher, st.Launcher("tmux", "/usr/bin/tmux", "%12"))
        self.assertEqual(run.call_args.args[0][-2:], ["%12", "#{pane_id}"])
        self.assertEqual(
            run.call_args.kwargs["timeout"], st.PREFLIGHT_TIMEOUT_SECONDS
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
                st.shutil,
                "which",
                side_effect=lambda name, path=None: f"/usr/bin/{name}",
            ),
            mock.patch.object(st, "_tmux_preflight", return_value=False),
        ):
            self.assertEqual(
                st.choose_launcher(environ),
                st.Launcher("gnome", "/usr/bin/gnome-terminal"),
            )

        invalid = {**environ, "TMUX_PANE": "%3; touch /tmp/nope"}
        with mock.patch.object(
            st.shutil,
            "which",
            side_effect=lambda name, path=None: f"/usr/bin/{name}",
        ), mock.patch.object(st, "_tmux_preflight") as preflight:
            launcher = st.choose_launcher(invalid)
        self.assertEqual(launcher.kind, "gnome")
        preflight.assert_not_called()

    def test_no_tmux_or_graphical_gnome_returns_none(self):
        with mock.patch.object(st.shutil, "which", return_value=None):
            self.assertIsNone(st.choose_launcher({"PATH": "/bin"}))

    def test_tmux_command_uses_fixed_argv_and_shell_quotes_every_value(self):
        config_dir = self.root / "claude config; echo BAD"
        executable = self.root / "bin" / "tool; echo BAD"
        result_path = config_dir / "statusline_runtime" / "slash_tui" / (
            "invocation-x/result.json"
        )
        argv = st.build_launcher_argv(
            st.Launcher("tmux", "/usr/bin/tmux", "%7"),
            executable,
            config_dir,
            self.cwd,
            result_path,
        )
        self.assertEqual(argv[:10], [
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
        ])
        self.assertEqual(argv[10:13], [str(self.cwd), "-t", "%7"])
        self.assertEqual(shlex.split(argv[-1]), [
            "env",
            f"{st.RESULT_ENV}={result_path}",
            f"{st.DEADLINE_ENV}=570",
            str(executable),
            "configure",
            "--config-dir",
            str(config_dir),
        ])

    def test_gnome_uses_direct_argv_active_tab_wait_and_validated_cwd(self):
        result_path = self.root / "result.json"
        argv = st.build_launcher_argv(
            st.Launcher("gnome", "/usr/bin/gnome-terminal"),
            self.executable,
            self.config_dir,
            self.cwd,
            result_path,
        )
        self.assertEqual(argv[:7], [
            "/usr/bin/gnome-terminal",
            "--tab",
            "--active",
            "--wait",
            "--title=Configure Status Line",
            f"--working-directory={self.cwd}",
            "--",
        ])
        self.assertEqual(
            argv[7:],
            [
                str(self.executable),
                "configure",
                "--config-dir",
                str(self.config_dir),
            ],
        )
        self.assertEqual(st.validate_cwd(str(self.cwd)), self.cwd)
        self.assertEqual(st.validate_cwd("relative/path"), Path.home())
        self.assertEqual(st.validate_cwd(str(self.root / "missing")), Path.home())


class ResultValidationTests(SlashTuiTestCase):
    def make_invocation(self):
        invocation, result = st._create_invocation_dir(self.config_dir)
        self.assertEqual(stat.S_IMODE(invocation.stat().st_mode), 0o700)
        return invocation, result

    def test_valid_result_round_trip(self):
        invocation, path = self.make_invocation()
        path.write_bytes(self.result_bytes("updated", 0, "updated"))
        path.chmod(0o600)
        result = st.read_result(path, invocation)
        self.assertEqual(result.outcome, "updated")
        self.assertEqual(result.message, "updated")

    def test_missing_oversized_symlink_and_non_regular_results_fail(self):
        invocation, path = self.make_invocation()
        with self.assertRaises(st.ResultError):
            st.read_result(path, invocation)

        path.write_bytes(b"x" * (st.RESULT_SIZE_LIMIT + 1))
        with self.assertRaisesRegex(st.ResultError, "16 KiB"):
            st.read_result(path, invocation)
        path.unlink()

        target = self.root / "outside.json"
        target.write_bytes(self.result_bytes())
        path.symlink_to(target)
        with self.assertRaises(st.ResultError):
            st.read_result(path, invocation)
        path.unlink()

        path.mkdir()
        with self.assertRaises(st.ResultError):
            st.read_result(path, invocation)

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
                with self.assertRaises(st.ResultError):
                    st.read_result(path, invocation)


class LaunchAndCleanupTests(SlashTuiTestCase):
    def test_unavailable_does_not_create_runtime_directory(self):
        with mock.patch.object(st, "choose_launcher", return_value=None):
            result = st.launch(
                self.config_dir, self.executable, str(self.cwd), environ={}
            )
        self.assertEqual(result.outcome, "error")
        self.assertEqual(result.message, st.UNAVAILABLE_MESSAGE)
        self.assertFalse(self.config_dir.exists())

    def test_launch_passes_bridge_environment_reads_and_cleans_result(self):
        captured = {}

        def run(argv, environ):
            captured["argv"] = argv
            captured["environ"] = environ
            path = Path(environ[st.RESULT_ENV])
            path.write_bytes(
                self.result_bytes(
                    "cancelled", 0, "Status line configuration unchanged."
                )
            )
            path.chmod(0o600)
            return 0, b"terminal stdout", b"terminal stderr", False

        with (
            mock.patch.object(
                st,
                "choose_launcher",
                return_value=st.Launcher("gnome", "/usr/bin/gnome-terminal"),
            ),
            mock.patch.object(st, "_run_launcher", side_effect=run),
        ):
            result = st.launch(
                self.config_dir,
                self.executable,
                str(self.cwd),
                environ={"DISPLAY": ":0", "PATH": "/bin"},
            )
        self.assertEqual(result.outcome, "cancelled")
        self.assertEqual(captured["environ"][st.DEADLINE_ENV], "570")
        result_path = Path(captured["environ"][st.RESULT_ENV])
        self.assertFalse(result_path.exists())
        self.assertFalse(result_path.parent.exists())

    def test_selected_tmux_failure_does_not_try_gnome(self):
        chooser = mock.Mock(
            return_value=st.Launcher("tmux", "/usr/bin/tmux", "%1")
        )
        with (
            mock.patch.object(st, "choose_launcher", chooser),
            mock.patch.object(
                st,
                "_run_launcher",
                return_value=(1, b"ignored stdout", b"popup failed\nmore", False),
            ),
        ):
            result = st.launch(
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
                st,
                "choose_launcher",
                return_value=st.Launcher("gnome", "/usr/bin/gnome-terminal"),
            ),
            mock.patch.object(
                st, "_run_launcher", return_value=(-15, b"", b"", True)
            ),
        ):
            result = st.launch(
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
        (linked / "link").symlink_to(self.root / "outside")
        recent = base / "invocation-recent"
        recent.mkdir()
        foreign = base / "keep-me"
        foreign.mkdir()
        old_time = time.time() - st.STALE_AFTER_SECONDS - 60
        for path in (old, linked, foreign):
            os.utime(path, (old_time, old_time))

        st.cleanup_stale_invocations(base)
        self.assertFalse(old.exists())
        self.assertTrue(linked.exists())
        self.assertTrue(recent.exists())
        self.assertTrue(foreign.exists())


if __name__ == "__main__":
    unittest.main(verbosity=2)
