#!/usr/bin/env python3
"""Subprocess tests for the public command-line interface."""

from claude_statusline.integration import ownership as integration_ownership

import json
import builtins
from io import StringIO
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from claude_statusline import cli


class CliTests(unittest.TestCase):
    def setUp(self):
        self.launcher_temp = tempfile.TemporaryDirectory(
            prefix="statusline-cli-launcher-"
        )
        self.addCleanup(self.launcher_temp.cleanup)
        binary_dir = Path(self.launcher_temp.name)
        name = "claude-statusline.exe" if os.name == "nt" else "claude-statusline"
        launcher = binary_dir / name
        launcher.write_text("#!/bin/sh\nexit 0\n", encoding="utf-8")
        if os.name == "posix":
            launcher.chmod(0o755)
        self.cli_env = os.environ.copy()
        self.cli_env["PATH"] = (
            str(binary_dir) + os.pathsep + self.cli_env.get("PATH", "")
        )

    def test_administration_uses_the_invoked_console_entry_instead_of_another_path_install(
        self,
    ):
        from claude_statusline import installer
        from claude_statusline.integration.models import ChangeResult
        from contextlib import redirect_stdout

        name = "claude-statusline.exe" if os.name == "nt" else "claude-statusline"
        entry = Path(self.launcher_temp.name) / name
        with (
            mock.patch.object(cli.sys, "argv", [str(entry)]),
            mock.patch.object(
                installer, "resolve_cli_executable", return_value=entry
            ) as resolve,
            mock.patch.object(
                installer,
                "install_configuration",
                return_value=ChangeResult(
                    "install", False, entry.parent / "settings.json"
                ),
            ),
            redirect_stdout(StringIO()),
        ):
            self.assertEqual(
                cli.main(["install", "--config-dir", self.launcher_temp.name]), 0
            )
        resolve.assert_called_once_with(entry.resolve())

    def run_cli(self, *arguments, input_text=None, env=None):
        return subprocess.run(
            [sys.executable, "-m", "claude_statusline", *arguments],
            input=input_text,
            capture_output=True,
            text=True,
            encoding="utf-8",
            env=self.cli_env if env is None else env,
            check=False,
        )

    def run_cli_bytes(self, *arguments, input_bytes=b"", env=None):
        return subprocess.run(
            [sys.executable, "-m", "claude_statusline", *arguments],
            input=input_bytes,
            capture_output=True,
            env=self.cli_env if env is None else env,
            check=False,
        )

    def test_version(self):
        result = self.run_cli("--version")
        self.assertEqual(result.returncode, 0)
        self.assertEqual(result.stdout.strip(), "claude-statusline 1.6.0a1")
        self.assertEqual(result.stderr, "")

    def test_help_lists_public_commands(self):
        result = self.run_cli("--help")
        self.assertEqual(result.returncode, 0)
        self.assertIn("Linux, Windows and macOS", result.stdout)
        for command in (
            "render",
            "render-subagents",
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

    def test_configure_reports_missing_curses_without_traceback(self):
        class TerminalBuffer(StringIO):
            def isatty(self):
                return True

        original_import = builtins.__import__

        def missing_curses(name, globals=None, locals=None, fromlist=(), level=0):
            if "interactive_config" in (fromlist or ()):
                raise ImportError("No module named '_curses'")
            return original_import(name, globals, locals, fromlist, level)

        errors = StringIO()
        with (
            mock.patch.object(cli.sys, "stdin", TerminalBuffer()),
            mock.patch.object(cli.sys, "stdout", TerminalBuffer()),
            mock.patch.object(cli.sys, "stderr", errors),
            mock.patch.object(
                integration_ownership,
                "resolve_cli_executable",
                return_value=Path("/unused/claude-statusline"),
            ),
            mock.patch.object(builtins, "__import__", side_effect=missing_curses),
        ):
            code = cli.main(["configure", "--config-dir", self.launcher_temp.name])
        self.assertEqual(code, 2)
        self.assertIn("available curses backend", errors.getvalue())
        self.assertNotIn("Traceback", errors.getvalue())

    def test_render_invalid_json_is_silent_and_successful(self):
        result = self.run_cli("render", input_text="not-json")
        self.assertEqual(result.returncode, 0)
        self.assertEqual(result.stdout, "")
        self.assertEqual(result.stderr, "")

    def test_render_subagents_invalid_json_is_silent_and_successful(self):
        result = self.run_cli("render-subagents", input_text="not-json")
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

    def test_all_hot_commands_accept_utf8_bom(self):
        with tempfile.TemporaryDirectory(prefix="statusline-cli-bom-") as root:
            environment = self.cli_env.copy()
            environment["CLAUDE_CONFIG_DIR"] = root
            environment["CLAUDE_STATUSLINE_RUNTIME_DIR"] = str(Path(root) / "runtime")
            payloads = {
                "render": {
                    "model": {"id": "claude-测试"},
                    "workspace": {"current_dir": root, "project_dir": root},
                    "context_window": {
                        "remaining_percentage": 50,
                        "context_window_size": 200000,
                    },
                },
                "render-subagents": {
                    "columns": 80,
                    "tasks": [{"id": "a", "name": "测试", "status": "running"}],
                },
                "hook": {
                    "session_id": "session-bom",
                    "prompt_id": "prompt-bom",
                    "hook_event_name": "UserPromptSubmit",
                },
                "slash-hook": {
                    "hook_event_name": "UserPromptExpansion",
                    "expansion_type": "slash_command",
                    "command_name": "statusline-config",
                    "command_args": "help",
                },
            }
            for command, payload in payloads.items():
                with self.subTest(command=command):
                    raw = b"\xef\xbb\xbf" + json.dumps(
                        payload, ensure_ascii=False
                    ).encode("utf-8")
                    result = self.run_cli_bytes(
                        command, input_bytes=raw, env=environment
                    )
                    self.assertEqual(result.returncode, 0, result.stderr)
                    self.assertEqual(result.stderr, b"")
                    if command != "hook":
                        self.assertTrue(result.stdout)
            turn_files = list((Path(root) / "runtime" / "turns").glob("*.json"))
            self.assertEqual(len(turn_files), 1)

    def test_experimental_slash_help_is_one_block_json_object(self):
        value = {
            "hook_event_name": "UserPromptExpansion",
            "expansion_type": "slash_command",
            "command_name": "statusline-configure",
            "command_args": "--help",
        }
        result = self.run_cli("slash-hook", input_text=json.dumps(value))
        self.assertEqual(result.returncode, 0)
        self.assertEqual(result.stderr, "")
        self.assertEqual(result.stdout.count("\n"), 1)
        parsed = json.loads(result.stdout)
        self.assertEqual(parsed["decision"], "block")
        self.assertEqual(parsed["reason"], "Usage: /statusline-configure")

    def test_install_experimental_flags_are_mutually_exclusive(self):
        enabled = cli.build_parser().parse_args(["install", "--experimental-slash-tui"])
        disabled = cli.build_parser().parse_args(
            ["install", "--no-experimental-slash-tui"]
        )
        default = cli.build_parser().parse_args(["install"])
        self.assertIs(enabled.experimental_slash_tui, True)
        self.assertIs(disabled.experimental_slash_tui, False)
        self.assertIsNone(default.experimental_slash_tui)
        with mock.patch("sys.stderr"):
            with self.assertRaises(SystemExit):
                cli.build_parser().parse_args(
                    [
                        "install",
                        "--experimental-slash-tui",
                        "--no-experimental-slash-tui",
                    ]
                )

    def test_hot_paths_do_not_import_curses_or_slash_launcher(self):
        snippets = (
            (
                "from claude_statusline import cli\n"
                "cli.main(['render'])\n"
                "import json,sys\n"
                "print(json.dumps(sorted(n for n in sys.modules "
                "if n == 'curses' or n.endswith('.slash_tui') or n.endswith('.launcher') or n.endswith('.session'))))\n",
                "not-json",
            ),
            (
                "from claude_statusline import cli\n"
                "cli.main(['render-subagents'])\n"
                "import json,sys\n"
                "print(json.dumps(sorted(n for n in sys.modules "
                "if n == 'curses' or n.endswith('.installer') or "
                "n.endswith('.slash_tui') or n.endswith('.launcher') or n.endswith('.session'))))\n",
                "not-json",
            ),
            (
                "from claude_statusline import slash_hook\n"
                "slash_hook.handle_payload({"
                "'hook_event_name':'UserPromptExpansion',"
                "'expansion_type':'slash_command',"
                "'command_name':'statusline-config',"
                "'command_args':'help'})\n"
                "import json,sys\n"
                "print(json.dumps(sorted(n for n in sys.modules "
                "if n == 'curses' or n.endswith('.slash_tui') or n.endswith('.launcher') or n.endswith('.session'))))\n",
                None,
            ),
        )
        for code, input_text in snippets:
            with self.subTest(code=code[:30]):
                result = subprocess.run(
                    [sys.executable, "-c", code],
                    input=input_text,
                    capture_output=True,
                    text=True,
                    encoding="utf-8",
                    env=os.environ.copy(),
                    check=False,
                )
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertEqual(json.loads(result.stdout), [])

    def test_config_set_items_and_show_json(self):
        with tempfile.TemporaryDirectory(prefix="statusline-cli-config-") as root:
            updated = self.run_cli(
                "config", "--config-dir", root, "set-items", "git", "tokens"
            )
            self.assertEqual(updated.returncode, 0, updated.stderr)
            shown = self.run_cli("config", "--config-dir", root, "show", "--json")
            self.assertEqual(shown.returncode, 0, shown.stderr)
            value = json.loads(shown.stdout)
            self.assertEqual(value["display"]["items"], ["git", "tokens"])

    def test_new_items_support_every_cli_item_mutation(self):
        with tempfile.TemporaryDirectory(prefix="statusline-cli-new-items-") as root:
            commands = (
                (
                    "set-items",
                    "project-name",
                    "hostname",
                    "context-used",
                ),
                ("disable", "hostname"),
                ("enable", "hostname"),
                (
                    "order",
                    "context-used",
                    "hostname",
                    "project-name",
                ),
            )
            for command in commands:
                with self.subTest(command=command):
                    result = self.run_cli("config", "--config-dir", root, *command)
                    self.assertEqual(result.returncode, 0, result.stderr)

            shown = self.run_cli("config", "--config-dir", root, "show", "--json")
            self.assertEqual(shown.returncode, 0, shown.stderr)
            self.assertEqual(
                json.loads(shown.stdout)["display"]["items"],
                ["context-used", "hostname", "project-name"],
            )

            listed = self.run_cli(
                "config", "--config-dir", root, "list-items", "--json"
            )
            self.assertEqual(listed.returncode, 0, listed.stderr)
            by_id = {item["id"]: item for item in json.loads(listed.stdout)}
            for item_id in ("context-used", "hostname", "project-name"):
                self.assertFalse(by_id[item_id]["default_enabled"])
                self.assertTrue(by_id[item_id]["enabled"])

    def test_config_validation_error_has_no_traceback(self):
        with tempfile.TemporaryDirectory(prefix="statusline-cli-config-") as root:
            result = self.run_cli("config", "--config-dir", root, "set-items", "clock")
        self.assertEqual(result.returncode, 2)
        self.assertIn("unknown status line item: clock", result.stderr)
        self.assertNotIn("Traceback", result.stderr)

    def test_config_rejects_status_elapsed_with_status_or_elapsed(self):
        with tempfile.TemporaryDirectory(prefix="statusline-cli-mutex-") as root:
            result = self.run_cli(
                "config",
                "--config-dir",
                root,
                "subagents",
                "set-items",
                "status-elapsed",
                "status",
            )
        self.assertEqual(result.returncode, 2)
        self.assertIn(
            "cannot combine status-elapsed with status or elapsed",
            result.stderr,
        )
        self.assertNotIn("Traceback", result.stderr)

    def test_config_apply_updates_display_and_host_settings(self):
        with tempfile.TemporaryDirectory(prefix="statusline-cli-apply-") as root:
            root_path = Path(root)
            binary_dir = root_path / "bin"
            binary_dir.mkdir()
            executable_name = (
                "claude-statusline.exe" if os.name == "nt" else "claude-statusline"
            )
            executable = binary_dir / executable_name
            executable.write_text("#!/bin/sh\n", encoding="utf-8")
            if os.name == "posix":
                executable.chmod(0o755)
            config_dir = root_path / "claude"
            config_dir.mkdir()
            (config_dir / "settings.json").write_text(
                json.dumps(
                    {
                        "statusLine": {
                            "type": "command",
                            "command": (
                                "claude-statusline.exe render"
                                if os.name == "nt"
                                else f'"{executable}" render'
                            ),
                            "refreshInterval": 1,
                        }
                    }
                )
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
                "--subagent-items",
                "status",
                "tokens",
                "--subagent-statusline",
                "off",
                "--scope-labels",
                "always",
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
            self.assertEqual(display["subagents"]["items"], ["status", "tokens"])
            self.assertFalse(display["subagents"]["enabled"])
            self.assertEqual(display["scope_labels"], "always")
            self.assertFalse(display["use_colors"])
            self.assertEqual(settings["statusLine"]["padding"], 2)
            self.assertEqual(settings["statusLine"]["refreshInterval"], 5)
            self.assertTrue(settings["statusLine"]["hideVimModeIndicator"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
