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
from terminal_colors import TERMINAL_THEMES, XTERM_PALETTE, cell_colors, contrast
import sys
import tempfile
import shlex
import time

from claude_statusline.ui.contracts import PROTOCOL_VERSION
from claude_statusline.ui import editor, forms
from claude_statusline.config import display, models


def current_theme(config: Path) -> str:
    settings = json.loads((config / "settings.json").read_text(encoding="utf-8"))
    legacy = json.loads((config / ".claude.json").read_text(encoding="utf-8"))
    return settings["theme"] if "theme" in settings else legacy.get("theme", "auto")


def prepare(
    root: Path,
    backend: Path,
    *,
    persistent: bool = False,
    claude: str = "claude",
    theme: str = "dark",
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
    version = subprocess.check_output([claude, "--version"], text=True, timeout=10)
    build = tuple(map(int, re.search(r"\d+\.\d+\.\d+", version).group().split(".")))
    if build >= (2, 1, 294):
        # Current hosts resolve settings.theme before the legacy global value.
        copied["theme"] = theme
    path = config / "settings.json"
    path.write_text(json.dumps(copied, ensure_ascii=False), encoding="utf-8")
    path.chmod(0o600)
    (config / ".claude.json").write_text(
        json.dumps(
            {
                "hasCompletedOnboarding": True,
                "theme": theme,
                "projects": {str(project): {"hasTrustDialogAccepted": True}},
            }
        ),
        encoding="utf-8",
    )
    (config / ".claude.json").chmod(0o600)
    if theme == "custom:statusline-validation-light":
        themes = config / "themes"
        themes.mkdir()
        (themes / "statusline-validation-light.json").write_text(
            json.dumps(
                {
                    "name": "Statusline validation light",
                    "base": "light",
                    "overrides": {
                        "text": "#213547",
                        "inverseText": "#f6f3ec",
                        "inactive": "#4b5563",
                        "suggestion": "#2458a6",
                    },
                }
            ),
            encoding="utf-8",
        )
    env = dict(
        os.environ,
        CLAUDE_CONFIG_DIR=str(config),
        TERM="xterm-256color",
        COLORTERM="truecolor",
        DISABLE_AUTOUPDATER="1",
        CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC="1",
        CLAUDE_STATUSLINE_NATIVE_EXECUTABLE=str(backend),
    )
    env.pop("CLAUDECODE", None)
    # Exercise real terminal styles even when the parent automation disables
    # ANSI output. Colorless geometry is covered separately by UI tests.
    env.pop("NO_COLOR", None)
    env["FORCE_COLOR"] = "3"
    # A fixed npm host resolves to a binary named claude.exe on Linux. Put a
    # private canonical name on PATH so the installer/backend use that host too.
    host_directory = root / "host-bin"
    host_directory.mkdir(mode=0o700)
    (host_directory / "claude").symlink_to(
        Path(shutil.which(claude) or claude).resolve()
    )
    env["PATH"] = os.pathsep.join(
        (str(backend.parent), str(host_directory), env.get("PATH", ""))
    )
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
    advanced: bool = False,
    theme_only: bool = False,
    terminal_theme: str = "dark",
    language_only: bool = False,
    discovery: bool = False,
    appearance: bool = False,
    rendering_only: bool = False,
) -> dict:
    import fcntl
    import pty
    import termios
    if __package__:
        from . import terminal_capture as pyte
    else:
        import terminal_capture as pyte

    config = Path(env["CLAUDE_CONFIG_DIR"])
    initial_theme = current_theme(config)
    if discovery or appearance:
        from editor_discovery_acceptance import request, backend_call
        backend=Path(env["CLAUDE_STATUSLINE_NATIVE_EXECUTABLE"])
        current=request(backend,env,project,"read")
        request(backend,env,project,"apply",{"draft":{"display":display.DEFAULT_CONFIG.to_dict(),"host":models.DEFAULT_HOST_CONFIG.to_dict()},"expected_revision":current["revision"]})
        backend_call(backend,env,project,"config","language","set","en")
        if appearance:
            backend_call(backend,env,project,"config","set-items","model","context-used")
            backend_call(backend,env,project,"config","set","scope-labels","off")
    if language_only:
        subprocess.run([env["CLAUDE_STATUSLINE_NATIVE_EXECUTABLE"], "config", "set-items", "context-used"], env=env, cwd=project, check=True, capture_output=True, timeout=30)
        subprocess.run([env["CLAUDE_STATUSLINE_NATIVE_EXECUTABLE"], "config", "set", "statusline-language", "en"], env=env, cwd=project, check=True, capture_output=True, timeout=30)
    description = subprocess.run(
        [env["CLAUDE_STATUSLINE_NATIVE_EXECUTABLE"], "ui"],
        input=json.dumps(
            {
                "protocol_version": PROTOCOL_VERSION,
                "operation": "describe",
                "payload": {},
            }
        ),
        text=True,
        capture_output=True,
        env=env,
        cwd=project,
        check=True,
        timeout=30,
    )
    described = json.loads(description.stdout)["result"]
    catalog_count = len(described["catalog"])
    subprocess.run(
        [env["CLAUDE_STATUSLINE_NATIVE_EXECUTABLE"], "config", "set", "colors", "on"],
        env=env,
        cwd=project,
        capture_output=True,
        check=True,
        timeout=30,
    )
    settings_before = (config / "settings.json").read_bytes()
    language = "en"
    output_language = "en"
    terminal_rows = 48 if columns < 110 else 30
    master, slave = pty.openpty()
    fcntl.ioctl(
        slave, termios.TIOCSWINSZ, struct.pack("HHHH", terminal_rows, columns, 0, 0)
    )

    def terminal():
        os.setsid()
        fcntl.ioctl(slave, termios.TIOCSCTTY, 0)
        os.tcsetpgrp(slave, os.getpgrp())

    command_argv = [
        claude,
        *([] if persistent else ["--plugin-dir", str(plugin)]),
        "--debug-file",
        str(root / f"debug-{columns}.log"),
    ]
    tmux_directory = (
        tempfile.TemporaryDirectory(prefix="statusline-client-tmux-")
        if persistent and not discovery and not appearance and not rendering_only
        else None
    )
    tmux_socket = Path(tmux_directory.name) / "server.sock" if tmux_directory else None
    if tmux_socket:
        command_argv = [
            "tmux",
            "-T",
            "RGB",
            "-f",
            "/dev/null",
            "-S",
            str(tmux_socket),
            "new-session",
            "-s",
            "validation",
            shlex.join(command_argv),
        ]
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

    def screen_lines():
        return ["".join(screen.buffer[y][x].data for x in range(screen.columns)) for y in range(screen.lines)]

    def read_until(
        text: str | tuple[str, ...],
        *,
        start: int = 0,
        timeout: int = 30,
        quiet: bool = True,
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
            plain = "\n".join(screen_lines())
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

    def capture(name, *, palette=None, colors=True, mode="editor", preview_language=None):
        # Exact decoded terminal cells from the real host; no synthetic UI.
        path = root / f"screen-{columns}-{name}.json"
        cells = [
            [screen.buffer[row][column]._asdict() for column in range(columns)]
            for row in range(screen.lines)
        ]
        if mode == "rendering":
            from native_preview_acceptance import verify_capture
            verify_capture(cells, terminal_theme, short=name.endswith("short"), clipping=name.endswith("clip"))
        elif mode == "appearance":
            from editor_appearance_acceptance import verify_capture
            verify_capture(cells, native=True)
        elif mode != "editor":
            from editor_discovery_acceptance import verify_native_capture
            verify_native_capture(cells,language,mode,terminal_theme)
        elif "external" not in name:

            def find_cells(label):
                from claude_statusline.rendering.formatters import display_width

                size = display_width(label)
                return next(
                    (
                        (index, row[col : col + size])
                        for index, row in enumerate(cells)
                        for col in range(columns - size + 1)
                        if "".join(cell["data"] for cell in row[col : col + size])
                        == label
                    ),
                    None,
                )

            from claude_statusline.i18n import translate as t

            heading = find_cells(
                t("native.ui.client.draw.configure_status_line", language)
            )
            preview = find_cells(t("native.preview.heading", language))
            assert heading and preview, "Client title or preview heading is missing"
            assert heading[1][0]["bold"], "Client heading lost its bold style"
            assert heading[1][0]["fg"] == preview[1][0]["fg"], (
                "Client heading must match the preview heading color"
            )
            footer = find_cells("S " + t("ui.hints.save", language))
            assert footer is not None, "Native action row is missing from capture"
            key_cell = footer[1][0]
            assert key_cell["bold"] and not key_cell["blink"], (
                "Save key lost its emphasis"
            )
            foreground, background = TERMINAL_THEMES[terminal_theme]
            assert (
                contrast(*cell_colors(key_cell, foreground, background, XTERM_PALETTE))
                >= 4.5
            ), "Save key is unreadable against its actual background"
            assert all(not cell["bold"] for cell in footer[1][2:]), (
                "Save description inherited the key's bold style"
            )
            description_cell = footer[1][2]
            description_fg, description_bg = cell_colors(
                description_cell, foreground, background, XTERM_PALETTE
            )
            assert description_fg != description_bg, (
                "Save description matches its background"
            )
            # ANSI slots are user-defined; the capture palette is illustrative.
            # Numeric contrast is evidence only for explicit RGB cells.
            if re.fullmatch(r"[0-9a-fA-F]{6}", description_cell["fg"]):
                assert contrast(description_fg, description_bg) >= 4.5, (
                    "Save description is unreadable"
                )
            frame = cells[preview[0]]
            left = next(
                (i for i, cell in enumerate(frame) if cell["data"] == "╭"), None
            )
            if left is not None:
                right = next(
                    i for i in range(left + 1, columns) if frame[i]["data"] == "╮"
                )
                bottom = next(
                    i
                    for i in range(preview[0] + 1, len(cells))
                    if cells[i][left]["data"] == "╰"
                )
                start_column = left + 1
            else:
                start_column = next(
                    i for i, cell in enumerate(frame) if cell["data"] == "─"
                )
                right = (
                    max(i for i, cell in enumerate(frame) if cell["data"] == "─") + 1
                )
                bottom = footer[0]
            sample_cells = [
                cell
                for row in cells[preview[0] + 1 : bottom]
                for cell in row[start_column:right]
            ]
            assert sample_cells and all(
                cell["bg"] == background.removeprefix("#") and not cell["reverse"]
                for cell in sample_cells
            ), "Preview background differs from the chosen terminal fixture"
            if palette is not None:
                label = (
                    t("native.preview.palette", language, palette=palette)
                    if colors
                    else t("ui.drawing.colors_off", language)
                )
                assert label in "".join(cell["data"] for cell in frame), (
                    "Preview caption does not match the palette draft"
                )
            if not colors:
                assert all(cell["fg"] == "default" for cell in sample_cells), (
                    "Colors off inherited host text"
                )
            help_text = " ".join(
                "".join(cell["data"] for cell in row) for row in cells[footer[0] :]
            )
            expected = ["Tab page", "↑↓ select", "←→ adjust", "Enter edit"]
            if "main" in name or "subagents" in name:
                expected = [
                    "Tab page",
                    "Space toggle",
                    "↑↓ select",
                    "←→ order",
                    "Ctrl+E format",
                    "/ search",
                ]
            if language == "zh-CN":
                expected = [
                    key + " " + t("ui.hints." + action, language)
                    for key, action in (label.split(" ", 1) for label in expected)
                ]
            positions = [help_text.index(label) for label in expected]
            assert positions == sorted(positions), (
                "Client page shortcuts are out of order"
            )
        path.write_text(
            json.dumps(
                {
                    "columns": columns,
                    "rows": screen.lines,
                    "cells": cells,
                    "ui_language": language,
                    "statusline_language": preview_language or output_language,
                    "theme": current_theme(config),
                    "terminal_theme": terminal_theme,
                    "terminal_foreground": TERMINAL_THEMES[terminal_theme][0],
                    "terminal_background": TERMINAL_THEMES[terminal_theme][1],
                    "terminal_palette": XTERM_PALETTE,
                    "terminal_defaults_source": "explicit capture-analysis fixture",
                },
                ensure_ascii=False,
            ),
            encoding="utf-8",
        )
        path.chmod(0o600)

    def command(text):
        prompts = [line for line in screen_lines() if line.lstrip().startswith("❯")]
        if not prompts or prompts[-1].split("❯", 1)[1].strip():
            raise RuntimeError(
                "Refusing to send a command while the composer is not empty"
            )
        os.write(master, text.encode("utf-8") + b"\r")

    def click_client():
        from claude_statusline.i18n import translate as t
        label=t("native.ui.client.draw.filter",language).strip()
        row = next(
            (i for i, line in enumerate(screen_lines()) if label in line), None
        )
        if row is None:
            raise RuntimeError("Client filter row is not visible for focus click")
        col = screen_lines()[row].index(label) + 3
        os.write(
            master, f"\x1b[<0;{col + 1};{row + 1}M\x1b[<0;{col + 1};{row + 1}m".encode()
        )
        time.sleep(0.3)

    try:
        # The fresh isolated project may still require its trust acknowledgement.
        ready = read_until(("❯", "trust this folder"))
        if ready != "❯":
            os.write(master, b"\r")
            read_until("❯")
        offset = len(raw)
        command("/statusline-configure-native")
        placed = read_until(
            ("Configure Status Line", "Resize pane to 32x12"), start=offset
        )
        resized = placed != "Configure Status Line"
        if resized:
            fcntl.ioctl(
                slave, termios.TIOCSWINSZ, struct.pack("HHHH", 48, columns, 0, 0)
            )
            screen.resize(lines=48, columns=columns)
            os.killpg(process.pid, signal.SIGWINCH)
            read_until("Configure Status Line")
        read_until("sample data")
        click_client()
        if discovery or appearance:
            from editor_discovery_acceptance import exercise, request, backend_call
            from claude_statusline.i18n import translate as t
            backend=Path(env["CLAUDE_STATUSLINE_NATIVE_EXECUTABLE"])
            if appearance:
                from editor_appearance_acceptance import exercise
            base=request(backend,env,project,"read")["draft"]
            cases=[]
            def send(data,text):
                start=len(raw);os.write(master,data);read_until(text,start=start)
            def close_pane():
                send(b"Q","❯")
            def reopen_pane():
                command("/statusline-configure-native")
                read_until(t("native.ui.client.draw.configure_status_line",language))
                click_client()
            for language in ("en","zh-CN"):
                if language!="en":
                    current=request(backend,env,project,"read")
                    request(backend,env,project,"apply",{"draft":base,"expected_revision":current["revision"]})
                    backend_call(backend,env,project,"config","language","set",language)
                    reopen_pane()
                cases.append(exercise(native=True,language=language,backend=backend,env=env,root=project,config=config,
                                      send=send,capture=capture,reopen=reopen_pane,close=close_pane,description=described,case_id=str(columns),terminal_theme=terminal_theme))
            return {"columns":columns,"rows":screen.lines,"discovery":cases,"persistent_plugin":persistent,"transport":"direct PTY","manual_visual_acceptance":False}
        if language_only or rendering_only:
            # Select the explicit capture surface as in the full acceptance path.
            os.write(master, b"3\x1b[H\x1b[B\x1b[B")
            read_until("› Preview background (UI only):")
            selected = next(
                line for line in screen.display if "› Preview background (UI only):" in line
            )
            if not re.search(r"\b" + terminal_theme + r"\b", selected):
                os.write(master, b"\x1b[C")
                read_until("Preview background remembered")
            os.write(master, b"1")
            read_until("Main items")
        if rendering_only:
            read_until("BG 👩🏽‍💻X")
            capture("rendering-full", mode="rendering")
            os.write(master, b"2")
            read_until("CLIP ")
            capture("rendering-clip", mode="rendering")
            os.write(master, b"3\x1b[H\x1b[C1")
            read_until("OK")
            capture("rendering-short", mode="rendering")
            os.write(master, b"q")
            read_until("❯")
            command("/exit")
            assert process.wait(timeout=10) == 0
            return {"columns": columns, "rows": screen.lines, "transport": "direct PTY",
                    "synthetic_protocol_preview": True, "installed_native_component": True,
                    "explicit_ansi_rgb_backgrounds": True, "cross_span_grapheme": True,
                    "background_reset": True, "whole_cluster_clipping": True,
                    "short_redraw": True, "manual_visual_acceptance": False}
        if language_only:
            backend = env["CLAUDE_STATUSLINE_NATIVE_EXECUTABLE"]
            display_path = config / "claude-statusline.json"
            before = (
                display_path.read_bytes(),
                (config / "settings.json").read_bytes(),
            )
            capture("language-main-en", palette="default")
            os.write(master, b"3\x1b[H\x1b[C")
            read_until("Colors: off")
            language_index = 10 + len(described["editor_fields"]["global"])
            os.write(master, b"\x1b[H" + b"\x1b[B" * language_index)
            read_until("› Interface language")
            capture("language-settings-en", colors=False)
            os.write(master, b"\x1b[C")
            read_until("配置状态栏")
            language = "zh-CN"
            read_until("颜色：关闭")
            assert (
                json.loads((config / "statusline-ui.json").read_bytes())["ui_language"]
                == "zh-CN"
            )
            capture("language-settings-zh", colors=False)
            appearance = [f for f in described["editor_fields"]["global"] if f["group"] == "Appearance"]
            output_index = 6 + next(i for i, f in enumerate(appearance) if f["key"] == "statusline_language")
            os.write(master, b"\x1b[H" + b"\x1b[B" * output_index)
            read_until("状态栏语言")
            os.write(master, b"\x1b[C")
            read_until("上下文")
            output_language = "zh-CN"
            capture("statusline-settings-zh", colors=False)
            os.write(master, b"\x1b[D")
            read_until("Context")
            output_language = "en"
            capture("statusline-settings-en", colors=False)
            os.write(master, b"\x1b[C")
            read_until("上下文")
            output_language = "zh-CN"
            # Restore colors through the current draft before documenting samples.
            os.write(master, b"\x1b[H\x1b[C1")
            read_until("主状态栏项目")
            capture("language-main-zh", palette="default")
            for key, label, name in (
                (b"2", "子代理项目", "language-subagents-zh"),
                (b"4", "布局／适配", "language-layout-zh"),
                (b"1\x05", "项目格式", "language-format-zh"),
            ):
                os.write(master, key)
                read_until(label)
                capture(name)
            os.write(master, b"\x07q")
            read_until("❯")
            output_language = "en"
            assert (
                display_path.read_bytes(),
                (config / "settings.json").read_bytes(),
            ) == before
            if persistent:
                command("/statusline-configure")
                read_until("配置状态栏", quiet=False)
                capture("language-external-zh")
                os.write(master, b"\x1b")
                read_until("❯")
                assert (
                    display_path.read_bytes(),
                    (config / "settings.json").read_bytes(),
                ) == before
            subprocess.run(
                [backend, "config", "language", "set", "en"],
                env=env,
                cwd=project,
                check=True,
                capture_output=True,
                timeout=30,
            )
            language = "en"
            output_language = "en"
            command("/statusline-configure-native")
            read_until("Configure Status Line")
            click_client()
            capture("language-main-reopened-en", palette="default")
            os.write(master, b"3\x1b[H" + b"\x1b[B" * output_index)
            read_until("Statusline language")
            os.write(master, b"\x1b[C")
            read_until("上下文")
            output_language = "zh-CN"
            os.write(master, b"S")
            read_until("Tool configuration saved")
            assert json.loads(display_path.read_bytes())["statusline_language"] == "zh-CN"
            capture("statusline-settings-saved-zh", palette="default")
            os.write(master, b"1")
            read_until("Main items")
            capture("statusline-main-saved-zh", palette="default")
            rendered = subprocess.run([backend, "render"], input=json.dumps({"model":{"id":"claude-sample"},"context_window":{"remaining_percentage":73,"used_percentage":27}}), env=env, cwd=project, check=True, capture_output=True, text=True).stdout
            assert "上下文" in rendered
            os.write(master, b"q")
            read_until("❯")
            command("/exit")
            assert process.wait(timeout=10) == 0
            return {
                "columns": columns,
                "terminal_rows": screen.lines,
                "persistent_plugin": persistent,
                "sample_preview": True,
                "manual_visual_acceptance": False,
                "checks": [
                    "language-immediate-save",
                    "unsaved-color-draft-preserved",
                    "cancel-byte-identical",
                    "statusline-draft-preview-switches-both-directions",
                    "statusline-save-affects-next-production-render",
                    "external-shared-language",
                    "cli-reset-native-reopen",
                    "bilingual-pages-and-forms",
                ],
            }
        os.write(master, b"3\x1b[H\x1b[B\x1b[B")
        read_until("› Preview background (UI only):")
        selected = next(
            line for line in screen.display if "› Preview background (UI only):" in line
        )
        if not re.search(r"\b" + terminal_theme + r"\b", selected):
            os.write(master, b"\x1b[C")
            read_until("Preview background remembered")
        os.write(master, b"1")
        read_until("Main items")
        capture("main", palette="default")
        if theme_only:
            tool_before = (config / "claude-statusline.json").read_bytes()
            os.write(master, b"3\x1b[H\x1b[B")
            read_until("› Palette:")
            os.write(master, b"\x1b[C1")
            read_until("Palette: ansi")
            capture("main-ansi", palette="ansi")
            os.write(master, b"3\x1b[H\x1b[C1")
            read_until("Colors: off")
            capture("main-colors-off", palette="ansi", colors=False)
            os.write(master, b"3\x1b[H\x1b[C\x1b[B\x1b[C1")
            read_until("Palette: default")
            for key, label, name in (
                (b"2", "Subagent items", "subagents"),
                (b"3", "Tool settings", "settings"),
                (b"4", "Layout / fitting", "advanced-layout"),
                (b"1\x05", "Item format:", "advanced-item-format"),
            ):
                os.write(master, key)
                read_until(label)
                capture(name)
            os.write(master, b"\x073H")
            read_until("Claude preferences")
            # H selects the actual host theme row. Draft changes must not apply.
            theme_before = current_theme(config)
            os.write(master, b"\x1b[C")
            read_until("Theme:")
            assert current_theme(config) == theme_before
            os.write(master, b"A")
            read_until("Theme: dark · Applied.")
            assert current_theme(config) != theme_before
            os.write(master, b"1")
            read_until("Main items")
            capture("main-after-theme-apply")
            assert (config / "claude-statusline.json").read_bytes() == tool_before
            os.write(master, b"q")
            read_until("❯")
            command("/exit")
            process.wait(timeout=10)
            return {
                "columns": columns,
                "rows": screen.lines,
                "theme": theme_before,
                "four_pages_and_item_form": True,
                "theme_apply_separate": True,
                "sample_preview": True,
                "palette_and_colors_off": True,
                "chosen_preview_background": terminal_theme,
                "manual_visual_acceptance": False,
            }
        os.write(master, b" ")
        read_until("[ ] Model and effort")
        os.write(master, b" ")
        read_until("[x] Model and effort")
        os.write(master, b"/git")
        read_until("Filter: git")
        os.write(master, b"\x07")
        read_until("Ctrl+F All categories")
        os.write(master, b"\x1b[B\x1b[B")
        read_until("Detail: Git")
        offset = len(raw)
        os.write(master, b"\x1b[D")
        read_until("Main items", start=offset)
        os.write(master, b"S")
        read_until("Tool configuration saved")
        ordered = json.loads((config / "claude-statusline.json").read_bytes())["items"]
        assert ordered.index("git") < ordered.index("current-dir"), (
            "Left arrow did not move Git before Directory"
        )
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
        os.write(master, b"\x1b[H" + b"\x1b[B" * (6 + sum(f["group"] == "Appearance" for f in described["editor_fields"]["global"])) + b"\r\x159")
        read_until("Padding: 9 _")
        os.write(master, b"\x07")
        read_until("Padding: 0")
        os.write(master, b"\x1b[H")
        read_until("Colors: on")
        os.write(master, b" ")
        read_until("Colors: off")
        os.write(master, b"S")
        read_until("Tool configuration saved")
        saved = (config / "claude-statusline.json").read_bytes()
        assert json.loads(saved)["use_colors"] is False
        capture("saved")
        os.write(master, b" ")
        read_until("Colors: on")
        os.write(master, b"Q")
        read_until("❯")
        command("/statusline-configure-native")
        read_until("Configure Status Line")
        click_client()
        os.write(master, b"3")
        read_until("Colors: off")
        os.write(master, b"\x1b")
        read_until("Tool settings")
        assert any("Tool settings" in row for row in screen.display), (
            "First Esc closed Client pane"
        )
        os.write(master, b"\x1b")
        read_until("❯")
        command("/statusline-config show")
        read_until("Hide Vim mode indicator:")
        assert (config / "claude-statusline.json").read_bytes() == saved, (
            "Cancel changed persisted display"
        )
        assert (config / "settings.json").read_bytes() == settings_before, (
            "Unchanged host fields were rewritten"
        )
        command("/statusline-configure-native")
        read_until("Configure Status Line")
        click_client()
        os.write(master, b"F")
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
            assert (
                json.loads((config / "claude-statusline.json").read_bytes())[
                    "use_colors"
                ]
                is True
            )
            command("/statusline-configure-native")
            read_until("Configure Status Line")
            click_client()
            os.write(master, b"3")
            read_until("Colors: on")
            os.write(master, b"Q")
            read_until("❯")
            external_verified = True
        command("/statusline-config show")
        read_until("Hide Vim mode indicator:")
        if advanced:
            if not persistent:
                raise RuntimeError(
                    "Advanced acceptance requires both persistent entries"
                )
            display_path = config / "claude-statusline.json"
            base = display_path.read_bytes()

            def client_setting(key, label):
                if key == "layout.mode" or key.startswith(("break:", "fit:")):
                    items = json.loads(display_path.read_bytes())["items"]
                    field_keys = ["layout.mode"] + [
                        "break:" + item for item in items[1:]
                    ]
                    field_keys += [
                        "fit:" + item + ":" + name
                        for item in items
                        for name in ("priority", "max_width")
                    ]
                else:
                    field_keys = [
                        "colors",
                        "palette",
                        "preview-background",
                        "directory-style",
                        "separator-style",
                        "scope-labels",
                        "padding",
                        "refresh_interval",
                        "vim-indicator",
                        "settings-subagent-statusline",
                    ]
                    field_keys += [
                        "field:" + field["key"]
                        for field in described["editor_fields"]["global"]
                    ]
                    appearance_keys = ["field:" + f["key"] for f in described["editor_fields"]["global"] if f["group"] == "Appearance"]
                    field_keys = field_keys[:6] + appearance_keys + [key for key in field_keys[6:] if key not in appearance_keys]
                    field_keys += [
                        "ui-language",
                        "preset-select",
                        "preset-apply",
                        "import-file",
                        "export-file",
                    ]
                    # Canonical identities keep the spec order even for missing host rows.
                    field_keys += [
                        "host-" + name
                        for name in (
                            "theme",
                            "verbose",
                            "showTurnDuration",
                            "prefersReducedMotion",
                            "spinnerTipsEnabled",
                            "terminalProgressBarEnabled",
                            "preferredNotifChannel",
                            "timeFormat",
                            "timeZone",
                            "title",
                            "model",
                            "effort",
                            "thinking",
                            "fast",
                        )
                    ]
                index = field_keys.index(key)
                os.write(master, b"\x1b[H" + b"\x1b[B" * index)
                read_until("› " + label)

            def client_value(value, observed):
                os.write(master, b"\r\x15" + value.encode("utf-8") + b"\r")
                read_until(observed)

            def external_setting(key, label, draft=None):
                config_value = (
                    display.load_display_config(config)
                    if draft is None
                    else display.validate_display_config(draft)
                )
                state = editor.EditorState.from_effective(
                    models.EffectiveConfig(
                        config_value, models.HostConfig(), True, display_path
                    )
                )
                state.page = (
                    "layout"
                    if key.startswith(("fit:", "break:")) or key == "layout-mode"
                    else "settings"
                )
                index = next(
                    i for i, row in enumerate(forms.rows(state)) if row["key"] == key
                )
                os.write(master, b"\x1b[H" + b"\x1b[B" * index)
                read_until(label, quiet=False)

            def external_value(value, observed):
                os.write(master, b"\r\x15" + value.encode("utf-8") + b"\r")
                read_until(observed, quiet=False)

            command("/statusline-configure-native")
            read_until("Configure Status Line")
            click_client()
            os.write(master, b"\x1b[H\x05")
            read_until("Item format:")
            client_value("Engine SfQ 中文", "Engine SfQ 中文")
            capture("advanced-item-format")
            os.write(master, b"\x07" + b"4")
            read_until("Layout / fitting")
            client_setting("layout.mode", "Layout mode")
            os.write(master, b"\r")
            read_until("Layout mode: explicit")
            first_item = json.loads(base)["items"][0]
            first_label = next(
                i["label"]
                for i in described["catalog"]
                if i["scope"] == "main" and i["id"] == first_item
            )
            client_setting("fit:" + first_item + ":priority", first_label + " Priority")
            client_value("100", "Priority: 100")
            client_setting(
                "fit:" + first_item + ":max_width", first_label + " Maximum width"
            )
            client_value("28", "Maximum width: 28")
            client_setting("break:" + json.loads(base)["items"][1], "New row before")
            os.write(master, b" ")
            read_until("New row before")
            capture("advanced-layout")
            os.write(master, b"3")
            read_until("Tool settings")
            client_setting("palette", "Palette")
            os.write(master, b"\x1b[C")
            read_until("Palette: ansi")
            os.write(master, b"S")
            read_until("Tool configuration saved")
            saved_advanced = display_path.read_bytes()
            saved_config = json.loads(saved_advanced)
            assert (
                saved_config["item_options"][first_item]["label"] == "Engine SfQ 中文"
            )
            assert saved_config["item_options"][first_item]["priority"] == 100
            assert saved_config["item_options"][first_item]["max_width"] == 28
            assert len(saved_config["layout"]["rows"]) == 2
            assert saved_config["palette"] == "ansi"

            client_setting("preset-select", "Preset")
            os.write(master, b"\x1b[C")
            read_until("Preset: developer")
            client_setting("preset-apply", "Expand selected preset")
            os.write(master, b"\r")
            read_until("Draft replaced")
            capture("advanced-preset")
            portable = project / f"draft-{columns} 中文.json"
            client_setting("export-file", "Export current draft")
            client_value(portable.name, "Exported current draft")
            exported = json.loads(portable.read_bytes())
            assert exported["draft"]["display"]["items"] != saved_config["items"]
            assert (
                exported["draft"]["display"]["formatting"]["number_format"] == "compact"
            )
            assert display_path.read_bytes() == saved_advanced, (
                "Export saved an unsaved draft"
            )

            bad = project / f"invalid-{columns}.json"
            bad.write_text("[]", encoding="utf-8")
            client_setting("import-file", "Import file")
            client_value(bad.name, "import requires")
            assert display_path.read_bytes() == saved_advanced
            client_value(portable.name, "Review import")
            os.write(master,b"A")
            read_until("Imported candidate accepted")
            capture("advanced-import")
            os.write(master, b"Q")
            read_until("❯")
            assert display_path.read_bytes() == saved_advanced, (
                "Cancel saved an imported draft"
            )

            command("/statusline-configure-native")
            read_until("Configure Status Line")
            click_client()
            os.write(master, b"3H")
            read_until("Claude preferences")
            # Exercise actual menu aliases through the interactive writer.
            client_setting("host-theme", "Theme")
            os.write(master, b"\x1b[C")
            read_until("Theme: light")
            client_setting("host-showTurnDuration", "Show turn duration")
            os.write(master, b" ")
            read_until("Show turn duration: off")
            os.write(master, b"A")
            read_until("Show turn duration: off · Applied.")
            assert display_path.read_bytes() == saved_advanced
            os.write(master, b"R")
            read_until("Main items")
            click_client()
            os.write(master, b"3H")
            read_until("Claude preferences")
            client_setting("host-theme", "Theme")
            read_until("Theme: light")
            client_setting("host-showTurnDuration", "Show turn duration")
            read_until("Show turn duration: off")
            capture("advanced-host-preferences")
            # Restore through the same API; tool saves must preserve its result.
            os.write(master, b" A")
            read_until("Show turn duration: on · Applied.")
            client_setting("host-theme", "Theme")
            os.write(master, b"\x1b[DA")
            read_until(f"Theme: {initial_theme} · Applied.")
            assert current_theme(config) == initial_theme
            settings_after_preferences = (config / "settings.json").read_bytes()
            os.write(master, b"Q")
            read_until("❯")

            command("/statusline-configure")
            read_until("Configure Status Line", quiet=False)
            os.write(master, b"\t\t")
            read_until("Use arrows to change values", quiet=False)
            external_setting("preset-select", "Preset:")
            os.write(master, b"\x1b[C\x1b[C")
            read_until("Preset: monitoring", quiet=False)
            external_setting("preset-apply", "Expand selected preset")
            os.write(master, b"\r")
            read_until("Preset expanded", quiet=False)
            external_portable = project / f"external-{columns} 中文.json"
            external_setting("export-file", "Export current draft")
            external_value(external_portable.name, "Exported current draft")
            assert display_path.read_bytes() == saved_advanced
            assert (
                len(
                    json.loads(external_portable.read_bytes())["draft"]["display"][
                        "layout"
                    ]["rows"]
                )
                == 3
            )
            os.write(master, b"\x1b")
            read_until("❯")
            assert display_path.read_bytes() == saved_advanced

            command("/statusline-configure")
            read_until("Configure Status Line", quiet=False)
            os.write(master, b"\t\t")
            read_until("Use arrows to change values", quiet=False)
            external_setting("import-file", "Import file")
            external_value(external_portable.name, "Review import")
            assert display_path.read_bytes() == saved_advanced
            os.write(master, b"A")
            read_until("Imported candidate accepted", quiet=False)
            assert display_path.read_bytes() == saved_advanced
            os.write(master, b"\t")
            read_until("Set explicit rows", quiet=False)
            imported_display = json.loads(external_portable.read_bytes())["draft"][
                "display"
            ]
            external_setting(
                "fit:context-used:priority", "context-used Priority:", imported_display
            )
            external_value("100", "context-used Priority: 100")
            external_setting(
                "fit:context-used:max_width",
                "context-used Maximum width:",
                imported_display,
            )
            external_value("12", "context-used Maximum width: 12")
            capture("advanced-external-layout")
            os.write(master, b"\x13")
            read_until("Status line configuration updated")
            external_saved = display_path.read_bytes()
            external_config = json.loads(external_saved)
            assert external_config["items"][0] == "context-used"
            assert external_config["item_options"]["context-used"]["priority"] == 100
            assert external_config["item_options"]["context-used"]["max_width"] == 12
            assert len(external_config["layout"]["rows"]) == 3
            assert external_config["palette"] == "ansi"
            command("/statusline-configure-native")
            read_until("Configure Status Line")
            click_client()
            read_until("[x] Context used")
            os.write(master, b"4")
            read_until("Layout / fitting")
            client_setting("fit:context-used:priority", "Context used Priority")
            read_until("Priority: 100")
            capture("advanced-shared-draft")
            os.write(master, b"Q")
            read_until("❯")
            assert display_path.read_bytes() == external_saved
            assert (config / "settings.json").read_bytes() == settings_after_preferences
            # Restore the base display so the next terminal size has the same fixture.
            display_path.write_bytes(base)
        return {
            "columns": columns,
            "rows": screen.lines,
            "resized_from_minimum_prompt": resized,
            "passed": True,
            "opened": True,
            "pages": [
                "main",
                "subagents",
                "settings",
                *(["layout"] if advanced else []),
            ],
            "advanced_forms": advanced,
            "preset_export_import_cancel": advanced,
            "shared_advanced_save": advanced,
            "interactive_host_preferences": advanced,
            "shortcut_styles": True,
            "heading_color_and_page_order": True,
            "uppercase_controls_and_literal_case": True,
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
            "catalog_items": catalog_count,
            "sample_preview": True,
            "persistent_plugin": persistent,
            "manual_visual_acceptance": False,
        }
    finally:
        (root / f"screen-{columns}.txt").write_text(
            "\n".join(screen_lines()), encoding="utf-8"
        )
        if tmux_socket:
            subprocess.run(
                ["tmux", "-S", str(tmux_socket), "kill-server"],
                capture_output=True,
                timeout=5,
            )
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
    parser.add_argument("--appearance", action="store_true", help="Verify appearance controls, import review and saved colors")
    parser.add_argument("--discovery", action="store_true", help="Verify bilingual discovery and import review in the installed native editor")
    parser.add_argument("--rendering-only", action="store_true", help="Send synthetic style/grapheme spans through the installed native preview in a direct PTY")
    parser.add_argument(
        "--backend", type=Path, default=Path(".venv/bin/claude-statusline")
    )
    parser.add_argument("--claude", default="claude")
    parser.add_argument(
        "--theme",
        default="dark",
        choices=(
            "dark",
            "light",
            "dark-daltonized",
            "light-daltonized",
            "dark-ansi",
            "light-ansi",
            "auto",
            "custom:statusline-validation-light",
        ),
    )
    parser.add_argument(
        "--theme-only",
        action="store_true",
        help="Capture all pages and verify separate theme Apply without changing tool configuration",
    )
    parser.add_argument(
        "--language-only",
        action="store_true",
        help="Verify language switching, shared preferences, draft preservation and bilingual captures",
    )
    parser.add_argument(
        "--terminal-theme",
        choices=("dark", "light"),
        default="dark",
        help="Independent terminal-default fixture for capture analysis; does not change a physical terminal",
    )
    parser.add_argument("--plugin", type=Path, default=Path("mods/statusline-native"))
    parser.add_argument("--interactive", action="store_true")
    parser.add_argument(
        "--advanced",
        action="store_true",
        help="Check Phase 4 forms, layout, presets and portable files in both entries",
    )
    parser.add_argument(
        "--persistent",
        action="store_true",
        help="Install the bundled Mod through the official marketplace, then start without --plugin-dir",
    )
    parser.add_argument(
        "--terminal", help="Terminal name/version to record for manual acceptance"
    )
    args = parser.parse_args()
    if args.advanced and not args.persistent:
        parser.error("--advanced requires --persistent to check both editor entries")
    if args.language_only and not args.persistent:
        parser.error(
            "--language-only requires --persistent to check both editor entries"
        )
    if (args.discovery or args.appearance) and not args.persistent:
        parser.error("--discovery requires --persistent")
    if args.rendering_only and (
        not args.persistent or args.discovery or args.appearance or args.language_only or args.advanced or args.theme_only
    ):
        parser.error("--rendering-only requires --persistent and no other scenario selector")
    args.claude = str(Path(shutil.which(args.claude) or args.claude).resolve())
    if not sys.platform.startswith("linux"):
        parser.error("This acceptance runner currently requires native Linux")
    root = args.report_dir.resolve()
    plugin = args.plugin.resolve()
    backend = args.backend.resolve()
    project, environment = prepare(
        root, backend, persistent=args.persistent, claude=args.claude, theme=args.theme
    )
    if args.rendering_only:
        from native_preview_acceptance import install_fixture
        environment["CLAUDE_STATUSLINE_NATIVE_EXECUTABLE"] = str(install_fixture(root, backend))
    report = {
        "os": platform.platform(),
        "architecture": platform.machine(),
        "persistent_plugin": args.persistent,
        "theme": args.theme,
        "terminal_theme": args.terminal_theme,
        "terminal_defaults_source": "explicit capture-analysis fixture",
        "terminal": args.terminal or os.environ.get("TERM_PROGRAM", "unknown")
        if args.interactive
        else "xterm-256color / truecolor PTY",
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
            "Run /statusline-configure-native, click the Client region, verify Main/Subagents/Settings/Layout, Ctrl+E item format, presets, import/export, Space/Tab/arrows, numeric Ctrl+G, save/finish, Esc focus/close, cancel, Claude preferences and return to the same session. /statusline-configure separately opens the external TUI.\n"
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
            # Each viewport starts in the requested theme even after Apply in
            # the preceding case; preserve all other private fixture settings.
            config = Path(environment["CLAUDE_CONFIG_DIR"])
            for filename in (".claude.json", "settings.json"):
                path = config / filename
                settings = json.loads(path.read_text(encoding="utf-8"))
                if "theme" in settings:
                    settings["theme"] = args.theme
                    path.write_text(json.dumps(settings), encoding="utf-8")
            report["cases"].append(
                run_pty(
                    root,
                    project,
                    environment,
                    args.claude,
                    plugin,
                    columns,
                    persistent=args.persistent,
                    advanced=args.advanced,
                    theme_only=args.theme_only,
                    terminal_theme=args.terminal_theme,
                    language_only=args.language_only,
                    discovery=args.discovery,
                    appearance=args.appearance,
                    rendering_only=args.rendering_only,
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
