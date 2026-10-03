"""Opt-in Terminal.app smoke with temporary config and no Claude API call.

Run using a venv containing the wheel. This opens a Terminal window and
shortens only the test editor's screen-loop deadline; no automated keystrokes
or Apple events are needed to finish the production TUI.
"""

from claude_statusline.integration import launcher as integration_launcher
from claude_statusline.platforms import environment as platform_environment
from claude_statusline.platforms import files as platform_files
from claude_statusline.platforms import macos_terminal as platform_macos_terminal

import argparse
import json
import os
from pathlib import Path
import platform
import shlex
import subprocess
import sys
import tempfile
from unittest import mock


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--report", type=Path)
    args = parser.parse_args()
    if not platform_environment.is_macos():
        parser.error("native macOS is required")
    environment = os.environ.copy()
    for name in ("TMUX", "TMUX_PANE"):
        environment.pop(name, None)
    available, detail = platform_macos_terminal.availability(environment)
    assert available, detail
    executable = Path(sys.executable).parent / "claude-statusline"
    assert executable.is_file(), "install the wheel in this Python venv first"
    with tempfile.TemporaryDirectory(prefix="statusline-terminal-smoke-") as directory:
        root = Path(directory)
        config = root / "Claude 中文 ' config"
        cwd = root / "项目 $ with spaces"
        cwd.mkdir()
        environment.update(
            CLAUDE_CONFIG_DIR=str(config),
            CLAUDE_STATUSLINE_RUNTIME_DIR=str(config / "statusline_runtime"),
            CLAUDE_STATUSLINE_SESSIONS_DIR=str(config / "sessions"),
        )
        subprocess.run(
            [str(executable), "install", "--config-dir", str(config)],
            capture_output=True,
            text=True,
            env=environment,
            check=True,
            timeout=20,
        )
        settings = config / "settings.json"
        before = settings.read_bytes()
        bootstrap = root / "bounded_editor.py"
        screen_report = root / "screen.json"
        bootstrap.write_text(
            "import json, sys, time\n"
            "from pathlib import Path\n"
            "from claude_statusline.ui import session as ic\nfrom claude_statusline.platforms import macos_terminal as mt\n"
            "original = ic._screen_loop\n"
            "def bounded(screen, state, deadline_at=None, guard=None):\n"
            "    report = {'dimensions': list(screen.getmaxyx()), 'stdin_tty': sys.stdin.isatty(), 'stdout_tty': sys.stdout.isatty()}\n"
            "    Path(__file__).with_name('screen.json').write_text(json.dumps(report))\n"
            "    return original(screen, state, time.monotonic() + 1, guard)\n"
            "ic._screen_loop = bounded\n"
            "raise SystemExit(mt.main())\n",
            encoding="utf-8",
        )
        original_prepare = platform_macos_terminal.prepare

        def prepare(*arguments, **kwargs):
            script = original_prepare(*arguments, **kwargs)
            content = script.read_text(encoding="utf-8").replace(
                "-m claude_statusline.macos_terminal", shlex.quote(str(bootstrap))
            )
            platform_files.atomic_write_bytes(script, content.encode("utf-8"), 0o700)
            return script

        with mock.patch.object(platform_macos_terminal, "prepare", side_effect=prepare):
            result = integration_launcher.launch(
                config, executable, str(cwd), environ=environment
            )
        assert result.outcome == "timed-out" and result.exit_code == 0, result
        screen = json.loads(screen_report.read_bytes())
        assert screen["stdin_tty"] and screen["stdout_tty"], screen
        assert screen["dimensions"][0] >= 18 and screen["dimensions"][1] >= 64, screen
        assert settings.read_bytes() == before
        assert not (config / "claude-statusline.json").exists()
        assert not list((config / "statusline_runtime" / "slash_tui").iterdir())
        report = {
            "platform": sys.platform,
            "os_version": platform.mac_ver()[0],
            "architecture": platform.machine(),
            "python": platform.python_version(),
            "launcher": "Terminal.app via open",
            "screen": screen,
            "outcome": result.outcome,
            "config_unchanged": True,
            "invocation_cleaned": True,
        }
    rendered = json.dumps(report, ensure_ascii=False, indent=2)
    print(rendered)
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(rendered + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
