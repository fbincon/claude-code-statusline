"""Verify legacy Python entry points still execute the canonical implementations."""

import importlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

from claude_statusline.integration import bridge
from claude_statusline.platforms import macos_terminal
import claude_statusline


class CompatibilityTests(unittest.TestCase):
    def test_forwarded_functions_and_types_share_identity(self):
        pairs = (
            ("statusline", "render_preview_rows", "rendering.preview"),
            ("turn_state", "load_turn_state", "runtime.turns.store"),
            ("installer", "ConfigurationError", "integration.models"),
            ("config_commands", "apply_configuration", "config.service"),
            ("interactive_config", "EditorState", "ui.editor"),
            ("_platform", "atomic_write_bytes", "platforms.files"),
        )
        for legacy, name, canonical in pairs:
            with self.subTest(legacy=legacy, name=name):
                old = importlib.import_module("claude_statusline." + legacy)
                new = importlib.import_module("claude_statusline." + canonical)
                self.assertIs(getattr(old, name), getattr(new, name))

    def test_legacy_render_modules_match_cli_output(self):
        with tempfile.TemporaryDirectory() as directory:
            env = os.environ.copy()
            env["CLAUDE_CONFIG_DIR"] = directory
            env["CLAUDE_STATUSLINE_RUNTIME_DIR"] = directory
            payloads = (
                ("render", "statusline", {"model": {"id": "compat-model"}}),
                (
                    "render-subagents",
                    "subagent_statusline",
                    {"tasks": [{"id": "a", "status": "running", "name": "Probe"}]},
                ),
            )
            for command, module, payload in payloads:
                with self.subTest(module=module):
                    results = [
                        subprocess.run(
                            argv,
                            input=json.dumps(payload),
                            env=env,
                            capture_output=True,
                            text=True,
                            timeout=20,
                        )
                        for argv in (
                            [sys.executable, "-m", "claude_statusline", command],
                            [sys.executable, "-m", "claude_statusline." + module],
                        )
                    ]
                    self.assertEqual(results[0].returncode, 0, results[0].stderr)
                    self.assertEqual(results[1].returncode, 0, results[1].stderr)
                    self.assertEqual(results[0].stdout, results[1].stdout)

    def test_terminal_script_uses_package_root_after_relocation(self):
        with tempfile.TemporaryDirectory() as directory:
            config = Path(directory) / "config with spaces"
            invocation, _ = bridge._create_invocation_dir(config)
            script = macos_terminal.prepare(
                config,
                Path(sys.executable),
                Path(directory),
                invocation,
                os.environ,
            )
            content = script.read_text(encoding="utf-8")
            package_parent = Path(claude_statusline.__file__).resolve().parent.parent
            self.assertIn("PYTHONPATH=" + str(package_parent), content)
            self.assertIn("claude_statusline.macos_terminal", content)

    def test_legacy_terminal_entry_point_preserves_error_exit_code(self):
        completed = subprocess.run(
            [sys.executable, "-m", "claude_statusline.macos_terminal"],
            capture_output=True,
            text=True,
            timeout=20,
        )
        self.assertEqual(completed.returncode, 2)
