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
import struct
import subprocess
import sys
import time


def prepare(root: Path, backend: Path) -> tuple[Path, dict[str, str]]:
    root.mkdir(mode=0o700, parents=True, exist_ok=False)
    config = root / "Claude config 中文"
    project = root / "project with spaces 中文"
    config.mkdir(mode=0o700)
    project.mkdir(mode=0o700)
    source = Path(os.environ.get("CLAUDE_CONFIG_DIR", str(Path.home() / ".claude")))
    settings_path = source / "settings.json"
    settings = json.loads(settings_path.read_text(encoding="utf-8")) if settings_path.exists() else {}
    copied = {key: settings[key] for key in ("apiKeyHelper", "env", "model") if key in settings}
    path = config / "settings.json"
    path.write_text(json.dumps(copied, ensure_ascii=False), encoding="utf-8")
    path.chmod(0o600)
    (config / ".claude.json").write_text(json.dumps({
        "hasCompletedOnboarding": True, "theme": "dark",
        "projects": {str(project): {"hasTrustDialogAccepted": True}},
    }), encoding="utf-8")
    (config / ".claude.json").chmod(0o600)
    env = dict(os.environ, CLAUDE_CONFIG_DIR=str(config), TERM="xterm-256color",
               DISABLE_AUTOUPDATER="1", CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC="1",
               CLAUDE_STATUSLINE_NATIVE_EXECUTABLE=str(backend))
    env.pop("CLAUDECODE", None)
    env["PATH"] = str(backend.parent) + os.pathsep + env.get("PATH", "")
    subprocess.run([str(backend), "install", "--config-dir", str(config)],
                   cwd=project, env=env, capture_output=True, check=True, timeout=30)
    return project, env


def run_pty(root: Path, project: Path, env: dict, claude: str, plugin: Path, columns: int) -> dict:
    import fcntl
    import pty
    import termios
    import pyte

    master, slave = pty.openpty()
    fcntl.ioctl(slave, termios.TIOCSWINSZ, struct.pack("HHHH", 30, columns, 0, 0))

    def terminal():
        os.setsid()
        fcntl.ioctl(slave, termios.TIOCSCTTY, 0)
        os.tcsetpgrp(slave, os.getpgrp())

    process = subprocess.Popen([claude, "--plugin-dir", str(plugin), "--debug-file", str(root / f"debug-{columns}.log")],
                               cwd=project, env=env, stdin=slave, stdout=slave, stderr=slave,
                               preexec_fn=terminal, close_fds=True)
    raw = bytearray()
    screen = pyte.Screen(columns, 30)
    stream = pyte.Stream(screen)
    decoder = codecs.getincrementaldecoder("utf-8")("replace")

    def read_until(text: str | tuple[str, ...], *, start: int = 0, timeout: int = 30):
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            if select.select([master], [], [], 0.2)[0]:
                try:
                    data = os.read(master, 65536)
                except OSError:
                    break
                raw.extend(data)
                stream.feed(decoder.decode(data))
            plain = "\n".join(screen.display)
            candidates = (text,) if isinstance(text, str) else text
            compact = re.sub(r"\s+", "", plain)
            for candidate in candidates:
                if re.sub(r"\s+", "", candidate) in compact:
                    return candidate
            if process.poll() is not None:
                break
        raise RuntimeError(f"PTY {columns} columns: did not observe {text!r}; inspect ignored raw/debug logs")

    try:
        # The fresh isolated project may still require its trust acknowledgement.
        ready = read_until(("❯", "trust this folder"))
        if ready != "❯":
            os.write(master, b"\r")
            read_until("❯")
        offset = len(raw)
        os.write(master, b"/statusline-configure-native\r")
        read_until("Colors: on", start=offset)
        offset = len(raw)
        os.write(master, b"c")
        read_until("Colors: off", start=offset)
        os.write(master, b"\x1b")
        # A local config query proves the prompt receives keys after Esc and
        # that the old skill/hook entry still resolves without a model turn.
        time.sleep(0.5)
        offset = len(raw)
        os.write(master, b"/statusline-config show\r")
        read_until("Scope: user", start=offset)
        config = Path(env["CLAUDE_CONFIG_DIR"])
        assert not (config / "claude-statusline.json").exists(), "Probe persisted a draft"
        return {"columns": columns, "passed": True, "opened": True,
                "toggle": True, "esc_return": True, "legacy_command": True,
                "draft_saved": False, "manual_visual_acceptance": False}
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
        (root / f"screen-{columns}.txt").write_text("\n".join(screen.display), encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--report-dir", type=Path, required=True)
    parser.add_argument("--backend", type=Path, default=Path(".venv/bin/claude-statusline"))
    parser.add_argument("--claude", default="claude")
    parser.add_argument("--plugin", type=Path, default=Path("mods/statusline-native"))
    parser.add_argument("--interactive", action="store_true")
    args = parser.parse_args()
    if not sys.platform.startswith("linux"):
        parser.error("This acceptance runner currently requires native Linux")
    root = args.report_dir.resolve()
    plugin = args.plugin.resolve()
    backend = args.backend.resolve()
    project, environment = prepare(root, backend)
    if args.interactive:
        print("Run /statusline-configure-native, toggle c, close with Esc, then /statusline-config show.\n"
              "Repeat in a narrow window. Send no model prompt. Use /exit when finished.", flush=True)
        return subprocess.call([args.claude, "--plugin-dir", str(plugin)], cwd=project, env=environment)
    report = {"os": platform.platform(), "terminal": "xterm-256color PTY",
              "claude": subprocess.check_output([args.claude, "--version"], text=True).strip(),
              "backend": subprocess.check_output([str(backend), "--version"], text=True).strip(),
              "commit": subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip(),
              "cases": []}
    try:
        for columns in (120, 80):
            report["cases"].append(run_pty(root, project, environment, args.claude, plugin, columns))
    finally:
        (root / "report.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
