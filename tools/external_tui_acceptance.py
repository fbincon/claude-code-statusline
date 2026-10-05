"""Capture and exercise the installed external TUI in isolated Linux/macOS PTYs.

Uses only local configuration commands, fixed sample previews and temporary
installation paths. Requires pyte; it never invokes a model.
"""

from __future__ import annotations

import argparse
import codecs
import hashlib
import json
import os
from pathlib import Path
import platform
import re
import select
import signal
import struct
import subprocess
import sys
import time
import unicodedata

from claude_statusline.config import display, models
from claude_statusline.ui import editor, forms


def run_case(backend: Path, root: Path, columns: int, rows: int, commit: str) -> dict:
    import fcntl
    import pty
    import termios
    import pyte

    config = root / f"config-{columns}x{rows} 中文"
    env = dict(os.environ, CLAUDE_CONFIG_DIR=str(config), TERM="xterm-256color")
    env.pop("PYTHONPATH", None)

    def cli(*arguments):
        return subprocess.run(
            [str(backend), *arguments],
            env=env,
            cwd=root,
            check=True,
            capture_output=True,
            text=True,
            timeout=180,
        ).stdout

    cli(
        "install",
        "--no-native-editor",
        "--no-experimental-slash-tui",
        "--no-live-metrics",
    )
    cli("config", "set-items", "model-with-effort", "current-dir", "context-used")
    config_path = config / "claude-statusline.json"
    settings_path = config / "settings.json"
    initial = (config_path.read_bytes(), settings_path.read_bytes())
    state = editor.EditorState.from_effective(
        models.EffectiveConfig(
            display.load_display_config(config), models.HostConfig(), True, config_path
        )
    )
    master, slave = pty.openpty()
    fcntl.ioctl(slave, termios.TIOCSWINSZ, struct.pack("HHHH", rows, columns, 0, 0))

    def terminal():
        os.setsid()
        fcntl.ioctl(slave, termios.TIOCSCTTY, 0)

    process = subprocess.Popen(
        [str(backend), "configure", "--config-dir", str(config)],
        env=env,
        cwd=root,
        stdin=slave,
        stdout=slave,
        stderr=slave,
        preexec_fn=terminal,
        close_fds=True,
    )
    os.close(slave)
    screen = pyte.Screen(columns, rows)
    stream = pyte.Stream(screen)
    decoder = codecs.getincrementaldecoder("utf-8")("replace")
    raw = bytearray()
    captures = []

    def wait_for(text, *, after=0):
        deadline = time.monotonic() + 15
        last = time.monotonic()
        while time.monotonic() < deadline:
            ended = False
            if select.select([master], [], [], 0.1)[0]:
                try:
                    chunk = os.read(master, 65536)
                except OSError:
                    chunk = b""
                if chunk:
                    raw.extend(chunk)
                    stream.feed(decoder.decode(chunk))
                    last = time.monotonic()
                else:
                    ended = True
            plain = re.sub(
                r"\s+", "", unicodedata.normalize("NFC", "\n".join(screen.display))
            )
            if (
                len(raw) > after
                and re.sub(r"\s+", "", unicodedata.normalize("NFC", text)) in plain
                and (ended or time.monotonic() - last > 0.15)
            ):
                return
            if ended:
                break
        raise RuntimeError(f"{columns}x{rows}: did not observe {text!r}")

    def send(data, text):
        after = len(raw)
        os.write(master, data)
        wait_for(text, after=after)

    def field(key):
        index = next(i for i, row in enumerate(forms.rows(state)) if row["key"] == key)
        send(b"\x1bOH" + b"\x1bOB" * index, forms.rows(state)[index]["label"])

    def capture(name):
        path = root / f"screen-{columns}x{rows}-{name}.json"
        cells = [
            [screen.buffer[y][x]._asdict() for x in range(screen.columns)]
            for y in range(screen.lines)
        ]
        payload = {
            "columns": screen.columns,
            "rows": screen.lines,
            "cells": cells,
            "surface": "external",
            "source_commit": commit,
            "sample_data": True,
        }
        path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
        captures.append(
            {"path": path.name, "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}
        )

    def resize(width, height):
        screen.resize(height, width)
        fcntl.ioctl(
            master, termios.TIOCSWINSZ, struct.pack("HHHH", height, width, 0, 0)
        )
        os.kill(process.pid, signal.SIGWINCH)

    try:
        wait_for("Preview (sample data)")
        capture("main")
        send(b"\t", "Subagent items")
        capture("subagents")
        send(b"\t", "Settings / global options")
        state.page = "settings"
        capture("settings")
        field("padding")
        send(b"3", "[3_]")
        after = len(raw)
        resize(80 if columns == 64 else 64, 24 if rows <= 20 else 18)
        wait_for("[3_]", after=after)
        after = len(raw)
        resize(columns, rows)
        wait_for("[3_]", after=after)
        send(b"\x1b", "Ctrl+S save")
        send(b"\t", "Layout / rows and fitting")
        state.page = "layout"
        field("fit:current-dir:priority")
        capture("layout")
        send(b"\t\x05", "Item format / main")
        state.page = "items"
        state.form_item = ("main", "model-with-effort")
        send(b"\r\x15" + "Engine 中文 é".encode("utf-8") + b"\r", "Engine 中文 é")
        capture("detail")
        send(b"\x07", "Main items")
        send(b"\x1b", "Status line configuration unchanged")
        assert process.wait(timeout=5) == 0
        assert (config_path.read_bytes(), settings_path.read_bytes()) == initial
    finally:
        if process.poll() is None:
            process.terminate()
            process.wait(timeout=5)
        os.close(master)
        (root / f"raw-{columns}x{rows}.ansi").write_bytes(raw)

    # Separate actual save/readback verifies the stable key after regrouping.
    master, slave = pty.openpty()
    fcntl.ioctl(slave, termios.TIOCSWINSZ, struct.pack("HHHH", rows, columns, 0, 0))
    process = subprocess.Popen(
        [str(backend), "configure", "--config-dir", str(config)],
        env=env,
        cwd=root,
        stdin=slave,
        stdout=slave,
        stderr=slave,
        preexec_fn=terminal,
        close_fds=True,
    )
    os.close(slave)
    screen = pyte.Screen(columns, rows)
    stream = pyte.Stream(screen)
    decoder = codecs.getincrementaldecoder("utf-8")("replace")
    raw = bytearray()
    try:
        wait_for("Preview (sample data)")
        send(b"\t\t", "Settings / global options")
        state.form_item = None
        state.page = "settings"
        field("padding")
        send(b"3\r", "Ctrl+S save")
        send(b"\x13", "Status line configuration updated")
        assert process.wait(timeout=5) == 0
        assert json.loads(settings_path.read_bytes())["statusLine"]["padding"] == 3
        assert config_path.read_bytes() == initial[0]
    finally:
        if process.poll() is None:
            process.terminate()
            process.wait(timeout=5)
        os.close(master)
        (root / f"raw-{columns}x{rows}-save.ansi").write_bytes(raw)
    return {
        "columns": columns,
        "rows": rows,
        "captures": captures,
        "checks": [
            "four-pages-and-detail",
            "cjk-and-combining-text",
            "resize-during-edit",
            "cancel-byte-identical",
            "regrouped-numeric-save-readback",
        ],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--backend", type=Path, required=True)
    parser.add_argument("--report-dir", type=Path, required=True)
    parser.add_argument("--commit", required=True)
    args = parser.parse_args()
    if not (sys.platform.startswith("linux") or sys.platform == "darwin"):
        parser.error("Native Linux/macOS PTYs are required")
    backend = args.backend.resolve(strict=True)
    root = args.report_dir.resolve()
    root.mkdir(mode=0o700, parents=True, exist_ok=False)
    version = subprocess.run(
        [str(backend), "--version"], capture_output=True, text=True, check=True
    ).stdout.strip()
    report = {
        "backend": str(backend),
        "version": version,
        "source_commit": args.commit,
        "platform": platform.platform(),
        "python": platform.python_version(),
        "sample_data": True,
        "manual_visual_acceptance": False,
        "cases": [],
    }
    for columns, rows in ((64, 18), (64, 20), (80, 24), (120, 30), (80, 48)):
        report["cases"].append(run_case(backend, root, columns, rows, args.commit))
    (root / "report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"External TUI: all five sizes passed; report: {root / 'report.json'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
