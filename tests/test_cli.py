#!/usr/bin/env python3
"""Subprocess tests for the public command-line interface."""

import os
import subprocess
import sys
import tempfile
import unittest


class CliTests(unittest.TestCase):
    def run_cli(self, *arguments, input_text=None, env=None):
        return subprocess.run(
            [sys.executable, "-m", "claude_statusline", *arguments],
            input=input_text,
            capture_output=True,
            text=True,
            encoding="utf-8",
            env=env,
        )

    def test_version(self):
        result = self.run_cli("--version")
        self.assertEqual(result.returncode, 0)
        self.assertEqual(result.stdout.strip(), "claude-statusline 0.1.0")
        self.assertEqual(result.stderr, "")

    def test_help_lists_public_commands(self):
        result = self.run_cli("--help")
        self.assertEqual(result.returncode, 0)
        for command in ("render", "hook", "install", "uninstall", "doctor"):
            self.assertIn(command, result.stdout)

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


if __name__ == "__main__":
    unittest.main(verbosity=2)
