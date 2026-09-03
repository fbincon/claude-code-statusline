#!/usr/bin/env python3
"""Subprocess tests for the public command-line interface."""

import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


class CliTests(unittest.TestCase):
    def run_cli(self, *arguments, input_text=None, env=None):
        return subprocess.run(
            [sys.executable, "-m", "claude_statusline", *arguments],
            input=input_text,
            capture_output=True,
            text=True,
            encoding="utf-8",
            env=env,
            check=False,
        )

    def test_version(self):
        result = self.run_cli("--version")
        self.assertEqual(result.returncode, 0)
        self.assertEqual(result.stdout.strip(), "claude-statusline 0.4.0")
        self.assertEqual(result.stderr, "")

    def test_help_lists_public_commands(self):
        result = self.run_cli("--help")
        self.assertEqual(result.returncode, 0)
        for command in (
            "render",
            "hook",
            "slash-hook",
            "configure",
            "config",
            "install",
            "uninstall",
            "doctor",
        ):
            self.assertIn(command, result.stdout)

    def test_configure_rejects_non_tty_without_traceback_or_changes(self):
        with tempfile.TemporaryDirectory(prefix="statusline-cli-tui-") as root:
            path = Path(root) / "settings.json"
            path.write_text('{"unrelated": true}\n', encoding="utf-8")
            before = path.read_bytes()
            result = self.run_cli("configure", "--config-dir", root)
            self.assertEqual(path.read_bytes(), before)
        self.assertEqual(result.returncode, 2)
        self.assertIn("stdin and stdout", result.stderr)
        self.assertNotIn("Traceback", result.stderr)

    def test_render_invalid_json_is_silent_and_successful(self):
        result = self.run_cli("render", input_text="not-json")
        self.assertEqual(result.returncode, 0)
        self.assertEqual(result.stdout, "")
        self.assertEqual(result.stderr, "")

    def test_hook_invalid_json_is_silent_and_successful(self):
        with tempfile.TemporaryDirectory(prefix="statusline-cli-test-") as runtime:
            env = os.environ.copy()
            env["CLAUDE_STATUSLINE_RUNTIME_DIR"] = runtime
            result = self.run_cli("hook", input_text="not-json", env=env)
        self.assertEqual(result.returncode, 0)
        self.assertEqual(result.stdout, "")
        self.assertEqual(result.stderr, "")

    def test_slash_hook_invalid_json_is_silent_and_successful(self):
        result = self.run_cli("slash-hook", input_text="not-json")
        self.assertEqual(result.returncode, 0)
        self.assertEqual(result.stdout, "")
        self.assertEqual(result.stderr, "")

    def test_config_set_items_and_show_json(self):
        with tempfile.TemporaryDirectory(prefix="statusline-cli-config-") as root:
            updated = self.run_cli(
                "config", "--config-dir", root, "set-items", "git", "tokens"
            )
            self.assertEqual(updated.returncode, 0, updated.stderr)
            shown = self.run_cli(
                "config", "--config-dir", root, "show", "--json"
            )
            self.assertEqual(shown.returncode, 0, shown.stderr)
            value = json.loads(shown.stdout)
            self.assertEqual(value["display"]["items"], ["git", "tokens"])

    def test_config_validation_error_has_no_traceback(self):
        with tempfile.TemporaryDirectory(prefix="statusline-cli-config-") as root:
            result = self.run_cli(
                "config", "--config-dir", root, "set-items", "clock"
            )
        self.assertEqual(result.returncode, 2)
        self.assertIn("unknown status line item: clock", result.stderr)
        self.assertNotIn("Traceback", result.stderr)

    def test_config_apply_updates_display_and_host_settings(self):
        with tempfile.TemporaryDirectory(prefix="statusline-cli-apply-") as root:
            root_path = Path(root)
            binary_dir = root_path / "bin"
            binary_dir.mkdir()
            executable = binary_dir / "claude-statusline"
            executable.write_text("#!/bin/sh\n", encoding="utf-8")
            executable.chmod(0o755)
            config_dir = root_path / "claude"
            config_dir.mkdir()
            (config_dir / "settings.json").write_text(
                json.dumps({
                    "statusLine": {
                        "type": "command",
                        "command": f'"{executable}" render',
                        "refreshInterval": 1,
                    }
                })
                + "\n",
                encoding="utf-8",
            )
            env = os.environ.copy()
            env["PATH"] = str(binary_dir) + os.pathsep + env.get("PATH", "")
            result = self.run_cli(
                "config",
                "--config-dir",
                str(config_dir),
                "apply",
                "--items",
                "git",
                "tokens",
                "--colors",
                "off",
                "--palette",
                "ansi",
                "--directory-style",
                "home",
                "--separator-style",
                "compact",
                "--padding",
                "2",
                "--refresh-interval",
                "5",
                "--hide-vim-mode-indicator",
                "on",
                env=env,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            display = json.loads(
                (config_dir / "claude-statusline.json").read_text(encoding="utf-8")
            )
            settings = json.loads(
                (config_dir / "settings.json").read_text(encoding="utf-8")
            )
            self.assertEqual(display["items"], ["git", "tokens"])
            self.assertFalse(display["use_colors"])
            self.assertEqual(settings["statusLine"]["padding"], 2)
            self.assertEqual(settings["statusLine"]["refreshInterval"], 5)
            self.assertTrue(settings["statusLine"]["hideVimModeIndicator"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
