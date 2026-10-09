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
from claude_statusline.ui import editor, forms, layout

if __package__:
    from tools.terminal_colors import (
        TERMINAL_THEMES,
        XTERM_PALETTE,
        cell_colors,
        contrast,
    )
else:
    from terminal_colors import TERMINAL_THEMES, XTERM_PALETTE, cell_colors, contrast


def verify_colors(cells, columns, rows, foreground, background):
    """Evaluate captured SGR using explicit terminal-default/palette fixtures."""
    panel = layout.dimensions(columns, rows).preview
    preview_contrasts = []
    for y, line in enumerate(cells):
        for x, cell in enumerate(line):
            preview = (
                panel.inner_y <= y < panel.inner_y + panel.inner_height
                and panel.inner_x <= x < panel.inner_x + panel.inner_width
            )
            fg, bg = cell_colors(cell, foreground, background, XTERM_PALETTE)
            if preview:
                assert cell["bg"] == "default" and not cell["reverse"], (
                    f"Artificial preview background: {y},{x}: {cell}"
                )
                if cell["data"].strip():
                    preview_contrasts.append(contrast(fg, bg))
            elif cell["data"].strip():
                assert cell["fg"] == cell["bg"] == "default", (
                    f"Fixed chrome color: {y},{x}"
                )
                assert contrast(fg, bg) >= 4.5, f"Unreadable chrome: {y},{x}"
    # Keys and descriptions have independently rendered emphasis.
    footer = cells[-2:]
    assert any(
        cell["bold"] and cell["data"].strip() for line in footer for cell in line
    ), "Missing bold shortcut"
    assert any(
        not cell["bold"] and cell["data"].strip() for line in footer for cell in line
    ), "Missing regular shortcut description"
    return min(preview_contrasts) if preview_contrasts else None


def run_case(
    backend: Path,
    root: Path,
    columns: int,
    rows: int,
    commit: str,
    terminal_theme="dark",
    language_only=False,
) -> dict:
    import fcntl
    import pty
    import termios
    import pyte

    config = root / f"config-{columns}x{rows} 中文"
    env = dict(os.environ, CLAUDE_CONFIG_DIR=str(config), TERM="xterm-256color")
    env.pop("PYTHONPATH", None)

    def cli(*arguments, payload=None):
        return subprocess.run(
            [str(backend), *arguments],
            env=env,
            cwd=root,
            check=True,
            capture_output=True,
            text=True,
            input=payload,
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
    language = "en"

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
        foreground, background = TERMINAL_THEMES[terminal_theme]
        preview_contrast = verify_colors(
            cells, screen.columns, screen.lines, foreground, background
        )
        if not state.display.use_colors:
            panel = layout.dimensions(screen.columns, screen.lines).preview
            assert all(
                cells[y][x]["fg"] == "default"
                for y in range(panel.inner_y, panel.inner_y + panel.inner_height)
                for x in range(panel.inner_x, panel.inner_x + panel.inner_width)
            )
        payload = {
            "columns": screen.columns,
            "rows": screen.lines,
            "cells": cells,
            "surface": "external",
            "source_commit": commit,
            "ui_language": language,
            "sample_data": True,
            "terminal_theme": terminal_theme,
            "terminal_foreground": foreground,
            "terminal_background": background,
            "terminal_palette": XTERM_PALETTE,
            "terminal_defaults_source": "explicit capture-analysis fixture",
            "palette": state.display.palette,
            "use_colors": state.display.use_colors,
            "preview_min_contrast": preview_contrast,
            "preview_colors_adjusted": False,
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
        if language_only:
            send(b"\t\t", "Settings / global options")
            state.page = "settings"
            field("colors")
            send(b"\x1bOC", "Colors: off")
            state.display = state.display.with_updates(use_colors=False)
            index = next(
                i
                for i, row in enumerate(forms.rows(state))
                if row["key"] == "ui-language"
            )
            send(b"\x1bOH" + b"\x1bOB" * index, "Interface language")
            capture("language-settings-en")
            send(b"\x1bOC", "配置状态栏")
            language = state.language = "zh-CN"
            assert (
                json.loads((config / "statusline-ui.json").read_bytes())["ui_language"]
                == "zh-CN"
            )
            wait_for("颜色：关闭")
            capture("language-settings-zh")
            for data, page, label in (
                (b"\t", "layout", "布局／分行与适配"),
                (b"\t", "items", "主状态栏项目"),
                (b"\t", "subagents", "子代理项目"),
            ):
                send(data, label)
                state.page = page
                capture("language-" + page + "-zh")
            send(b"\x1b", "状态栏显示配置保持原状")
            assert process.wait(timeout=5) == 0
            assert (config_path.read_bytes(), settings_path.read_bytes()) == initial
            assert (
                json.loads((config / "statusline-ui.json").read_bytes())["ui_language"]
                == "zh-CN"
            )
            return {
                "columns": columns,
                "rows": rows,
                "captures": captures,
                "checks": [
                    "english-to-chinese-through-real-keys",
                    "unsaved-color-draft-preserved",
                    "language-retained-on-cancel",
                    "display-and-host-byte-identical",
                    "chinese-pages-and-cell-bounds",
                ],
            }
        send(b"\t", "Subagent items")
        capture("subagents")
        send(b"\t", "Settings / global options")
        state.page = "settings"
        capture("settings")
        field("palette")
        send(b"\x1bOC", "Palette: ansi")
        state.display = state.display.with_updates(palette="ansi")
        capture("settings-ansi")
        field("colors")
        send(b"\x1bOC", "Colors: off")
        state.display = state.display.with_updates(use_colors=False)
        capture("settings-colors-off")
        send(b"\x1bOC", "Palette: ansi")
        state.display = state.display.with_updates(use_colors=True)
        field("palette")
        send(b"\x1bOC", "Palette: default")
        state.display = state.display.with_updates(palette="default")
        field("padding")
        send(b"3", "[3_]")
        capture("numeric-edit")
        after = len(raw)
        resize(80 if columns == 64 else 64, 24 if rows <= 20 else 18)
        wait_for("[3_]", after=after)
        after = len(raw)
        resize(columns, rows)
        wait_for("[3_]", after=after)
        send(b"9", "Padding must be from 0 through 32")
        capture("numeric-error")
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
        field("palette")
        send(b"\x1bOC", "Palette: ansi")
        send(b"\x13", "Status line configuration updated")
        assert process.wait(timeout=5) == 0
        assert json.loads(settings_path.read_bytes())["statusLine"]["padding"] == 3
        expected_config = dict(json.loads(initial[0]), palette="ansi")
        assert json.loads(config_path.read_bytes()) == expected_config
        rendered = cli(
            "render",
            payload=json.dumps(
                {
                    "model": {"id": "claude-sample"},
                    "workspace": {"current_dir": "/demo"},
                    "context_window": {"used_percentage": 42},
                }
            ),
        )
        assert "\x1b[1;33m" in rendered and "38;2" not in rendered
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
            "default-color-chrome-and-reversed-selection",
            "bold-keys-and-regular-descriptions",
            "chrome-contrast-at-least-4.5",
            "terminal-background-preview-without-color-adjustment",
            "palette-change-preview-and-color-disable",
            "saved-ansi-palette-used-by-production-render",
        ],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--backend", type=Path, required=True)
    parser.add_argument("--report-dir", type=Path, required=True)
    parser.add_argument("--commit", required=True)
    parser.add_argument(
        "--language-only",
        action="store_true",
        help="Exercise immediate language switching and draft cancellation",
    )
    parser.add_argument(
        "--terminal-theme",
        choices=tuple(TERMINAL_THEMES),
        default="dark",
        help="Default-color fixture for capture analysis; does not change a physical terminal",
    )
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
        "terminal_theme": args.terminal_theme,
        "terminal_defaults_source": "explicit capture-analysis fixture",
        "manual_visual_acceptance": False,
        "cases": [],
    }
    for columns, rows in ((64, 18), (64, 20), (80, 24), (120, 30), (80, 48)):
        report["cases"].append(
            run_case(
                backend,
                root,
                columns,
                rows,
                args.commit,
                args.terminal_theme,
                args.language_only,
            )
        )
    (root / "report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"External TUI: all five sizes passed; report: {root / 'report.json'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
