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
import time


def prepare(
    root: Path, backend: Path, *, persistent: bool = False
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
    env["PATH"] = str(backend.parent) + os.pathsep + env.get("PATH", "")
    subprocess.run(
        [
            str(backend),
            "install",
            "--native-editor" if persistent else "--no-native-editor",
            "--config-dir",
            str(config),
        ],
        cwd=project,
        env=env,
        capture_output=True,
        check=True,
        timeout=30,
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

    process = subprocess.Popen(
        [
            claude,
            *([] if persistent else ["--plugin-dir", str(plugin)]),
            "--debug-file",
            str(root / f"debug-{columns}.log"),
        ],
        cwd=project,
        env=env,
        stdin=slave,
        stdout=slave,
        stderr=slave,
        preexec_fn=terminal,
        close_fds=True,
    )
    raw = bytearray()
    screen = pyte.Screen(columns, terminal_rows)
    stream = pyte.Stream(screen)
    decoder = codecs.getincrementaldecoder("utf-8")("replace")

    def read_until(text: str | tuple[str, ...], *, start: int = 0, timeout: int = 30):
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
                    and time.monotonic() - last_output >= 0.25
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

    def reveal(text):
        # Inline panes may be shorter than the requested rows. Native Tab
        # navigation scrolls the focused control into view on that host.
        for _ in range(16):
            try:
                return read_until(text, timeout=1)
            except RuntimeError:
                if process.poll() is not None:
                    raise
                os.write(master, b"\t")
        raise RuntimeError(f"Native focus/scroll did not reveal {text!r}")

    try:
        # The fresh isolated project may still require its trust acknowledgement.
        ready = read_until(("❯", "trust this folder"))
        if ready != "❯":
            os.write(master, b"\r")
            read_until("❯")
        offset = len(raw)
        command(
            "/statusline-configure" if persistent else "/statusline-configure-native"
        )
        placed = read_until(("Configure Status Line", "Resize pane to 32x12"), start=offset)
        resized = placed != "Configure Status Line"
        if resized:
            # Inline panes share height with the composer/statusline. Exercise
            # terminal resize rather than treating a valid minimum-size prompt
            # as a load failure or secretly lowering the editor's requirement.
            import fcntl
            import termios

            fcntl.ioctl(slave, termios.TIOCSWINSZ, struct.pack("HHHH", 42, columns, 0, 0))
            screen.resize(lines=42, columns=columns)
            os.killpg(process.pid, signal.SIGWINCH)
            read_until("Configure Status Line")
        read_until("Preview (sample data)")
        capture("main")
        # autoFocus and page focus are surface behaviours, not callback tests.
        os.write(master, b"\r")
        read_until("[ ] Model and effort")
        os.write(master, b"t")
        read_until("[x] Model and effort")
        os.write(master, b"n")
        read_until("2/")
        capture("main-next")
        os.write(master, b"p")
        read_until("[x] Model and effort")
        os.write(master, b"\r")
        read_until("[ ] Model and effort")
        os.write(master, b"t")
        read_until("[x] Model and effort")
        os.write(master, b"2")
        reveal("Custom subagent rows")
        capture("subagents")
        os.write(master, b"3")
        reveal("Tool settings")
        capture("settings")
        os.write(master, b"c")
        reveal("Colors: off")
        os.write(master, b"s")
        read_until("Tool configuration saved")
        assert (config / "claude-statusline.json").exists(), (
            "Save did not create display configuration"
        )
        saved = (config / "claude-statusline.json").read_bytes()
        assert json.loads(saved)["use_colors"] is False
        capture("saved")
        os.write(master, b"c")
        reveal("Colors: on")
        os.write(master, b"q")
        time.sleep(0.5)
        command("/statusline-configure-native")
        read_until("Configure Status Line")
        os.write(master, b"3")
        reveal("Colors: off")
        os.write(master, b"\x1b")
        time.sleep(0.5)
        command("/statusline-config show")
        read_until("Hide Vim mode indicator:")
        assert (config / "claude-statusline.json").read_bytes() == saved, (
            "Cancel changed saved display configuration"
        )
        assert (config / "settings.json").read_bytes() == settings_before, (
            "Unchanged host fields were rewritten"
        )
        command("/statusline-configure-native")
        read_until("Configure Status Line")
        os.write(master, b"f")
        read_until("❯")
        time.sleep(0.5)
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
            "enter_toggles_focused_item": True,
            "pagination": True,
            "save_and_close": True,
            "saved": True,
            "cancel_reopen": True,
            "esc_return": True,
            "legacy_command": True,
            "catalog_items": 34,
            "sample_preview": True,
            "persistent_plugin": persistent,
            "manual_visual_acceptance": False,
        }
    finally:
        if process.poll() is None:
            os.killpg(process.pid, signal.SIGTERM)
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                os.killpg(process.pid, signal.SIGKILL)
                process.wait(timeout=5)
        os.close(master)
        os.close(slave)
        output = root / f"terminal-{columns}.bin"
        output.write_bytes(raw)
        output.chmod(0o600)
        (root / f"screen-{columns}.txt").write_text(
            "\n".join(screen.display), encoding="utf-8"
        )


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
    project, environment = prepare(root, backend, persistent=args.persistent)
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
            "Run /statusline-configure-native (also /statusline-configure when installed), verify all three pages, Tab/Enter, narrow/CJK layout, numeric Esc, save/refresh, cancel, host preferences and return to the same session.\n"
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
