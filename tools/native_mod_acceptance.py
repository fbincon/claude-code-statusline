"""Opt-in Linux native Mod PTY/manual acceptance using isolated configuration.

Only local slash commands are sent. No model prompt or timer suite is run.
Authentication settings are copied privately; raw terminal output stays ignored.
"""

from __future__ import annotations

import argparse
import codecs
import json
import os
from pathlib import Path
import platform
import re
import select
import signal
import shutil
import struct
import subprocess
import sys
import tempfile
import shlex
import time


def prepare(
    root: Path, backend: Path, *, persistent: bool = False, claude: str = "claude"
) -> tuple[Path, dict[str, str]]:
    root.mkdir(mode=0o700, parents=True, exist_ok=False)
    config = root / "Claude config 中文"
    project = root / "project with spaces 中文"
    config.mkdir(mode=0o700)
    project.mkdir(mode=0o700)
    source = Path(os.environ.get("CLAUDE_CONFIG_DIR", str(Path.home() / ".claude")))
    settings_path = source / "settings.json"
    settings = (
        json.loads(settings_path.read_text(encoding="utf-8"))
        if settings_path.exists()
        else {}
    )
    copied = {
        key: settings[key]
        for key in ("apiKeyHelper", "env", "model")
        if key in settings
    }
    path = config / "settings.json"
    path.write_text(json.dumps(copied, ensure_ascii=False), encoding="utf-8")
    path.chmod(0o600)
    (config / ".claude.json").write_text(
        json.dumps(
            {
                "hasCompletedOnboarding": True,
                "theme": "dark",
                "projects": {str(project): {"hasTrustDialogAccepted": True}},
            }
        ),
        encoding="utf-8",
    )
    (config / ".claude.json").chmod(0o600)
    env = dict(
        os.environ,
        CLAUDE_CONFIG_DIR=str(config),
        TERM="xterm-256color",
        DISABLE_AUTOUPDATER="1",
        CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC="1",
        CLAUDE_STATUSLINE_NATIVE_EXECUTABLE=str(backend),
    )
    env.pop("CLAUDECODE", None)
    # A fixed npm host resolves to a binary named claude.exe on Linux. Put a
    # private canonical name on PATH so the installer/backend use that host too.
    host_directory = root / "host-bin"
    host_directory.mkdir(mode=0o700)
    (host_directory / "claude").symlink_to(
        Path(shutil.which(claude) or claude).resolve()
    )
    env["PATH"] = os.pathsep.join((str(backend.parent), str(host_directory), env.get("PATH", "")))
    subprocess.run(
        [
            str(backend),
            "install",
            "--native-editor" if persistent else "--no-native-editor",
            *(["--experimental-slash-tui"] if persistent else []),
            "--config-dir",
            str(config),
        ],
        cwd=project,
        env=env,
        capture_output=True,
        check=True,
        timeout=180,
    )
    return project, env


def run_pty(
    root: Path,
    project: Path,
    env: dict,
    claude: str,
    plugin: Path,
    columns: int,
    *,
    persistent: bool = False,
) -> dict:
    import fcntl
    import pty
    import termios
    import pyte

    config = Path(env["CLAUDE_CONFIG_DIR"])
    subprocess.run(
        [env["CLAUDE_STATUSLINE_NATIVE_EXECUTABLE"], "config", "set", "colors", "on"],
        env=env,
        cwd=project,
        capture_output=True,
        check=True,
        timeout=30,
    )
    settings_before = (config / "settings.json").read_bytes()
    terminal_rows = 48 if columns < 110 else 30
    master, slave = pty.openpty()
    fcntl.ioctl(slave, termios.TIOCSWINSZ, struct.pack("HHHH", terminal_rows, columns, 0, 0))

    def terminal():
        os.setsid()
        fcntl.ioctl(slave, termios.TIOCSCTTY, 0)
        os.tcsetpgrp(slave, os.getpgrp())

    command_argv = [claude, *([] if persistent else ["--plugin-dir", str(plugin)]),
                    "--debug-file", str(root / f"debug-{columns}.log")]
    tmux_directory = tempfile.TemporaryDirectory(prefix="statusline-client-tmux-") if persistent else None
    tmux_socket = Path(tmux_directory.name) / "server.sock" if tmux_directory else None
    if tmux_socket:
        command_argv = ["tmux", "-f", "/dev/null", "-S", str(tmux_socket),
                        "new-session", "-s", "validation", shlex.join(command_argv)]
    process = subprocess.Popen(
        command_argv,
        cwd=project,
        env=env,
        stdin=slave,
        stdout=slave,
        stderr=slave,
        preexec_fn=terminal,
        close_fds=True,
    )
    raw = bytearray()
    class CaptureScreen(pyte.Screen):
        def write_process_input(self, data):
            os.write(master, data.encode("utf-8"))

        def report_device_status(self, mode, **kwargs):
            # tmux queries the outer terminal's private cursor position. pyte
            # lacks that keyword; answer it as a normal terminal would.
            if kwargs.get("private"):
                if mode == 6:
                    self.write_process_input(
                        f"\x1b[?{self.cursor.y + 1};{self.cursor.x + 1}R"
                    )
                return
            super().report_device_status(mode)

    screen = CaptureScreen(columns, terminal_rows)
    stream = pyte.Stream(screen)
    decoder = codecs.getincrementaldecoder("utf-8")("replace")

    def read_until(
        text: str | tuple[str, ...], *, start: int = 0,
        timeout: int = 30, quiet: bool = True,
    ):
        deadline = time.monotonic() + timeout
        last_output = time.monotonic()
        while time.monotonic() < deadline:
            if select.select([master], [], [], 0.2)[0]:
                try:
                    data = os.read(master, 65536)
                except OSError:
                    break
                raw.extend(data)
                stream.feed(decoder.decode(data))
                last_output = time.monotonic()
            plain = "\n".join(screen.display)
            candidates = (text,) if isinstance(text, str) else text
            compact = re.sub(r"\s+", "", plain)
            for candidate in candidates:
                if (
                    len(raw) > start
                    and (not quiet or time.monotonic() - last_output >= 0.25)
                    and re.sub(r"\s+", "", candidate) in compact
                ):
                    return candidate
            if process.poll() is not None:
                break
        raise RuntimeError(
            f"PTY {columns} columns: did not observe {text!r}; inspect ignored raw/debug logs"
        )

    def capture(name):
        # Exact decoded terminal cells from the real host; no synthetic UI.
        path = root / f"screen-{columns}-{name}.json"
        cells = [
            [screen.buffer[row][column]._asdict() for column in range(columns)]
            for row in range(screen.lines)
        ]
        path.write_text(
            json.dumps(
                {"columns": columns, "rows": screen.lines, "cells": cells}, ensure_ascii=False
            ),
            encoding="utf-8",
        )
        path.chmod(0o600)

    def command(text):
        prompts = [line for line in screen.display if line.lstrip().startswith("❯")]
        if not prompts or prompts[-1].split("❯", 1)[1].strip():
            raise RuntimeError(
                "Refusing to send a command while the composer is not empty"
            )
        os.write(master, text.encode("utf-8") + b"\r")

    def click_client():
        row = next((i for i, line in enumerate(screen.display) if "Filter:" in line), None)
        if row is None:
            raise RuntimeError("Client filter row is not visible for focus click")
        col = screen.display[row].index("Filter:") + 3
        os.write(master, f"\x1b[<0;{col+1};{row+1}M\x1b[<0;{col+1};{row+1}m".encode())
        time.sleep(0.3)

    try:
        # The fresh isolated project may still require its trust acknowledgement.
        ready = read_until(("❯", "trust this folder"))
        if ready != "❯":
            os.write(master, b"\r")
            read_until("❯")
        offset = len(raw)
        command("/statusline-configure-native")
        placed = read_until(("Client TUI", "Resize pane to 32x12"), start=offset)
        resized = placed != "Client TUI"
        if resized:
            fcntl.ioctl(slave, termios.TIOCSWINSZ, struct.pack("HHHH", 48, columns, 0, 0))
            screen.resize(lines=48, columns=columns)
            os.killpg(process.pid, signal.SIGWINCH)
            read_until("Client TUI")
        read_until("sample data")
        capture("main")
        click_client()
        os.write(master, b" ")
        read_until("[ ] Model and effort")
        os.write(master, b" ")
        read_until("[x] Model and effort")
        os.write(master, b"/git")
        read_until("Filter: git")
        os.write(master, b"\x07")
        read_until("Filter: [/ search]")
        os.write(master, b"\x1b[B\x1b[B")
        read_until("Detail: Git")
        offset = len(raw)
        os.write(master, b"\x1b[D")
        read_until("Main items", start=offset)
        os.write(master, b"s")
        read_until("Tool configuration saved")
        ordered = json.loads((config / "claude-statusline.json").read_bytes())["items"]
        assert ordered.index("git") < ordered.index("current-dir"), "Left arrow did not move Git before Directory"
        offset = len(raw)
        os.write(master, b"\x1b[C")
        read_until("Main items", start=offset)
        os.write(master, b"\x1b[H")
        read_until("[x] Model and effort")
        os.write(master, b"\x1b[6~")
        read_until("2/")
        capture("main-next")
        os.write(master, b"\x1b[H")
        read_until("[x] Model and effort")
        os.write(master, b"\t")
        read_until("Subagent items")
        capture("subagents")
        os.write(master, b"\t")
        read_until("Tool settings")
        capture("settings")
        os.write(master, b"\x1b[B" * 5 + b"\r\x159")
        read_until("Padding 9 _")
        os.write(master, b"\x07")
        read_until("Padding 0")
        os.write(master, b"\x1b[H")
        read_until("Colors on")
        os.write(master, b" ")
        read_until("Colors off")
        os.write(master, b"s")
        read_until("Tool configuration saved")
        saved = (config / "claude-statusline.json").read_bytes()
        assert json.loads(saved)["use_colors"] is False
        capture("saved")
        os.write(master, b" ")
        read_until("Colors on")
        os.write(master, b"q")
        read_until("❯")
        command("/statusline-configure-native")
        read_until("Client TUI")
        click_client()
        os.write(master, b"3")
        read_until("Colors off")
        os.write(master, b"\x1b")
        read_until("Tool settings")
        assert any("Tool settings" in row for row in screen.display), "First Esc closed Client pane"
        os.write(master, b"\x1b")
        read_until("❯")
        command("/statusline-config show")
        read_until("Hide Vim mode indicator:")
        assert (config / "claude-statusline.json").read_bytes() == saved, "Cancel changed persisted display"
        assert (config / "settings.json").read_bytes() == settings_before, "Unchanged host fields were rewritten"
        command("/statusline-configure-native")
        read_until("Client TUI")
        click_client()
        os.write(master, b"f")
        read_until("❯")
        external_verified = False
        if persistent:
            command("/statusline-configure")
            # The guarded curses loop repaints continuously. Wait for its
            # actual title/search content rather than a silent terminal.
            read_until("Configure Status Line", quiet=False)
            read_until("Type to search", quiet=False)
            capture("external")
            # Original curses flow: Tab changes page, Space toggles, Enter saves.
            os.write(master, b"\t\t")
            read_until("Use arrows to change values", quiet=False)
            os.write(master, b" ")
            os.write(master, b"\r")
            read_until("Status line configuration updated")
            assert json.loads((config / "claude-statusline.json").read_bytes())["use_colors"] is True
            command("/statusline-configure-native")
            read_until("Client TUI")
            click_client()
            os.write(master, b"3")
            read_until("Colors on")
            os.write(master, b"q")
            read_until("❯")
            external_verified = True
        command("/statusline-config show")
        read_until("Hide Vim mode indicator:")
        return {
            "columns": columns,
            "rows": screen.lines,
            "resized_from_minimum_prompt": resized,
            "passed": True,
            "opened": True,
            "pages": ["main", "subagents", "settings"],
            "toggle": True,
            "space_toggles_item": True,
            "keyboard_after_click": True,
            "pagination": True,
            "arrow_ordering": True,
            "search_ctrl_g": True,
            "numeric_ctrl_g": True,
            "save_and_close": True,
            "saved": True,
            "cancel_reopen": True,
            "esc_return": True,
            "external_entry_verified": external_verified,
            "catalog_items": 34,
            "sample_preview": True,
            "persistent_plugin": persistent,
            "manual_visual_acceptance": False,
        }
    finally:
        (root / f"screen-{columns}.txt").write_text(
            "\n".join(screen.display), encoding="utf-8"
        )
        if tmux_socket:
            subprocess.run(["tmux", "-S", str(tmux_socket), "kill-server"], capture_output=True, timeout=5)
        if process.poll() is None:
            os.killpg(process.pid, signal.SIGTERM)
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                os.killpg(process.pid, signal.SIGKILL)
                process.wait(timeout=5)
        if tmux_directory:
            tmux_directory.cleanup()
        os.close(master)
        os.close(slave)
        output = root / f"terminal-{columns}.bin"
        output.write_bytes(raw)
        output.chmod(0o600)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--report-dir", type=Path, required=True)
    parser.add_argument(
        "--backend", type=Path, default=Path(".venv/bin/claude-statusline")
    )
    parser.add_argument("--claude", default="claude")
    parser.add_argument("--plugin", type=Path, default=Path("mods/statusline-native"))
    parser.add_argument("--interactive", action="store_true")
    parser.add_argument(
        "--persistent",
        action="store_true",
        help="Install the bundled Mod through the official marketplace, then start without --plugin-dir",
    )
    parser.add_argument(
        "--terminal", help="Terminal name/version to record for manual acceptance"
    )
    args = parser.parse_args()
    args.claude = str(Path(shutil.which(args.claude) or args.claude).resolve())
    if not sys.platform.startswith("linux"):
        parser.error("This acceptance runner currently requires native Linux")
    root = args.report_dir.resolve()
    plugin = args.plugin.resolve()
    backend = args.backend.resolve()
    project, environment = prepare(root, backend, persistent=args.persistent, claude=args.claude)
    report = {
        "os": platform.platform(),
        "architecture": platform.machine(),
        "persistent_plugin": args.persistent,
        "terminal": args.terminal or os.environ.get("TERM_PROGRAM", "unknown")
        if args.interactive
        else "xterm-256color PTY",
        "claude": subprocess.check_output(
            [args.claude, "--version"], text=True
        ).strip(),
        "backend": subprocess.check_output(
            [str(backend), "--version"], text=True
        ).strip(),
        "commit": subprocess.check_output(
            ["git", "rev-parse", "HEAD"], text=True
        ).strip(),
        "working_tree_dirty": bool(
            subprocess.check_output(["git", "status", "--porcelain"], text=True).strip()
        ),
        "manual_visual_acceptance": False,
        "cases": [],
    }
    if args.interactive:
        report_path = root / "report.json"
        report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
        print(
            "Run /statusline-configure-native, click the Client region, verify all three pages, Space/Tab/arrows, numeric Ctrl+G, save/finish, Esc focus/close, cancel, Claude preferences and return to the same session. /statusline-configure separately opens the external TUI.\n"
            "Repeat in a narrow window. Send no model prompt. Use /exit when finished.\n"
            f"Environment recorded in {report_path}; manual acceptance stays pending until you report the result.",
            flush=True,
        )
        report["interactive_exit_code"] = subprocess.call(
            [args.claude, *([] if args.persistent else ["--plugin-dir", str(plugin)])],
            cwd=project,
            env=environment,
        )
        report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
        return report["interactive_exit_code"]
    try:
        for columns in (120, 80):
            report["cases"].append(
                run_pty(
                    root,
                    project,
                    environment,
                    args.claude,
                    plugin,
                    columns,
                    persistent=args.persistent,
                )
            )
    finally:
        (root / "report.json").write_text(
            json.dumps(report, indent=2) + "\n", encoding="utf-8"
        )
    print(json.dumps(report, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
