"""Exercise installed grapheme/style drawing in isolated Linux/macOS curses PTYs."""

from __future__ import annotations

import argparse
import codecs
import hashlib
import json
import os
from pathlib import Path
import platform
import select
import struct
import subprocess
import sys
import time

if __package__:
    from .terminal_capture import Screen, Stream
else:
    from terminal_capture import Screen, Stream

PROGRAM = r"""
import curses
from claude_statusline.ui.terminal import screen_adapter
from claude_statusline.ui.theme import _ColorMapper
from claude_statusline.ui.drawing import _draw_ansi, _add_text
from claude_statusline.rendering.layout import truncate_styled

def run(raw):
    try:
        curses.curs_set(0)
    except curses.error:
        pass
    raw.keypad(True)
    mapper = _ColorMapper()
    with screen_adapter(raw) as screen:
        for stage in range(3):
            screen.erase()
            rows, columns = screen.getmaxyx()
            if stage == 1:
                samples = ['OK']
            else:
                samples = [
                    '\x1b[31;44m👩\x1b[1m🏽\u200d💻\x1b[49mX\x1b[0m',
                    '\x1b[38;5;200;48;5;25m🇨🇳 1️⃣ é\x1b[0m',
                    '\x1b[38:2::10:20:30;48:2::120:130:140mRGB\x1b[39m D\x1b[49m Z',
                    ('中文👨‍👩‍👧‍👦 é ' * 20),
                ]
            for index, value in enumerate(samples):
                _draw_ansi(screen, index, truncate_styled(value, columns - 1), columns - 1, mapper)
            _add_text(screen, 7, 0, f'READY{stage} VT={int(screen.vt)}', columns - 1)
            screen.refresh()
            while True:
                key = raw.get_wch()
                if key == curses.KEY_RESIZE:
                    try:
                        curses.resize_term(0, 0)
                    except curses.error:
                        pass
                    continue
                break
curses.wrapper(run)
"""


def run_case(python, root, columns, rows, term, source):
    import fcntl
    import pty
    import termios

    root.mkdir(parents=True)
    env = dict(
        os.environ, TERM=term, PYTHONIOENCODING="utf-8", PYTHONDONTWRITEBYTECODE="1"
    )
    env.pop("PYTHONPATH", None)
    if source:
        env["PYTHONPATH"] = str(source)
    master, slave = pty.openpty()
    fcntl.ioctl(slave, termios.TIOCSWINSZ, struct.pack("HHHH", rows, columns, 0, 0))

    def terminal():
        os.setsid()
        fcntl.ioctl(slave, termios.TIOCSCTTY, 0)

    child = subprocess.Popen(
        [str(python), "-c", PROGRAM],
        stdin=slave,
        stdout=slave,
        stderr=slave,
        cwd=root,
        env=env,
        preexec_fn=terminal,
        close_fds=True,
    )
    os.close(slave)
    screen, raw = Screen(columns, rows), bytearray()
    stream = Stream(screen)
    decoder = codecs.getincrementaldecoder("utf-8")("strict")
    captures = []

    def read_ready(stage):
        until = time.monotonic() + 15
        marker = f"READY{stage} VT=1"
        last = time.monotonic()
        while time.monotonic() < until:
            if select.select([master], [], [], 0.05)[0]:
                try:
                    chunk = os.read(master, 65536)
                except OSError:
                    break
                if not chunk:
                    break
                raw.extend(chunk)
                stream.feed(decoder.decode(chunk))
                last = time.monotonic()
            if marker in "\n".join(screen.display) and time.monotonic() - last > 0.1:
                return
            if child.poll() is not None:
                break
        raise AssertionError(f"PTY did not reach {marker}: {screen.display!r}")

    try:
        for stage in range(3):
            read_ready(stage)
            if stage != 1:
                assert screen.buffer[0][0].data == "👩🏽‍💻"
                assert screen.buffer[0][2].data == "X"
                assert (
                    screen.buffer[0][0].bold is False
                    and screen.buffer[0][2].bold is True
                )
                assert [screen.buffer[1][x].data for x in (0, 3, 6)] == ["🇨🇳", "1️⃣", "é"]
                if term == "xterm-256color":
                    assert (
                        screen.buffer[0][0].fg == "red"
                        and screen.buffer[0][0].bg == "blue"
                    )
                    assert screen.buffer[0][2].bg == "default"
            else:
                assert screen.display[0].strip() == "OK"
                assert all(not row.strip() for row in screen.display[1:7])
            from wcwidth import wcswidth

            assert all(
                sum(
                    max(0, wcswidth(screen.buffer[y][x].data))
                    for x in range(screen.columns)
                )
                <= screen.columns
                for y in range(screen.lines)
            )
            cells = [
                [screen.buffer[y][x]._asdict() for x in range(screen.columns)]
                for y in range(screen.lines)
            ]
            name = f"stage-{stage}.json"
            (root / name).write_text(
                json.dumps(
                    {"columns": screen.columns, "rows": screen.lines, "cells": cells},
                    ensure_ascii=False,
                    indent=2,
                )
                + "\n",
                encoding="utf-8",
            )
            captures.append(
                {
                    "stage": stage,
                    "capture": name,
                    "columns": screen.columns,
                    "rows": screen.lines,
                }
            )
            if stage == 1:
                new_columns = 32 if columns > 32 else 64
                fcntl.ioctl(
                    master,
                    termios.TIOCSWINSZ,
                    struct.pack("HHHH", rows, new_columns, 0, 0),
                )
                screen.resize(rows, new_columns)
            os.write(master, b"n")
        child.wait(timeout=10)
        assert child.returncode == 0
    finally:
        if child.poll() is None:
            child.terminate()
            child.wait(timeout=5)
        os.close(master)
        (root / "terminal.raw").write_bytes(raw)
    return {
        "term": term,
        "captures": captures,
        "raw_sha256": hashlib.sha256(raw).hexdigest(),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--python", type=Path, default=Path(sys.executable))
    parser.add_argument("--report-dir", type=Path, required=True)
    parser.add_argument("--commit", required=True)
    parser.add_argument(
        "--source",
        type=Path,
        help="Development-only PYTHONPATH; omit for installed-package acceptance",
    )
    args = parser.parse_args()
    root = args.report_dir.resolve()
    if root.exists():
        parser.error("Use a fresh report directory")
    root.mkdir(parents=True)
    report = {
        "commit": args.commit,
        "platform": platform.platform(),
        "python": str(args.python.absolute()),
        "source_override": str(args.source.resolve()) if args.source else None,
        "human_acceptance": False,
        "source_working_tree_dirty": bool(
            subprocess.check_output(
                ["git", "status", "--porcelain", "--untracked-files=no"], text=True
            ).strip()
        )
        if args.source
        else False,
        "cases": [],
    }
    try:
        for term in ("xterm-256color", "vt100"):
            for columns in (32, 64, 120):
                report["cases"].append(
                    run_case(
                        args.python.absolute(),
                        root / f"{term}-{columns}",
                        columns,
                        12,
                        term,
                        args.source.resolve() if args.source else None,
                    )
                )
    finally:
        (root / "report.json").write_text(
            json.dumps(report, indent=2) + "\n", encoding="utf-8"
        )
    print(f"Passed {len(report['cases'])} grapheme/style PTY cases: {root}")


if __name__ == "__main__":
    main()
