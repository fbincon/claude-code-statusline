"""Exercise the installed CLI with an isolated config and synthetic session."""

import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import platform
import shutil
import stat
import subprocess
import sys
import tempfile
import time

from claude_statusline import _platform


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--report", type=Path)
    args = parser.parse_args()
    command = shutil.which(
        "claude-statusline.exe" if _platform.is_windows() else "claude-statusline"
    )
    assert command, "the installed CLI must be on PATH"
    _wall, boot, boot_id = _platform.now_clocks()
    report = {
        "platform": sys.platform,
        "os_version": platform.mac_ver()[0]
        if _platform.is_macos()
        else platform.release(),
        "architecture": platform.machine(),
        "python": platform.python_version(),
        "native_suspend_clock": boot is not None and boot_id is not None,
        "checks": [],
    }
    if _platform.is_macos():
        expected_arch = os.environ.get("STATUSLINE_EXPECTED_ARCH")
        if expected_arch:
            assert (
                platform.machine() == {"x64": "x86_64", "arm64": "arm64"}[expected_arch]
            )
        assert report["native_suspend_clock"], (
            "native macOS clock must work on the supported runners"
        )
        assert _platform.process_start_token(os.getpid()), (
            "native macOS process verification must work"
        )
    if _platform.uses_posix_files():
        import curses

        assert curses.wrapper
        assert shutil.which("tmux"), "PTY/tmux integration tests must not be skipped"

    with tempfile.TemporaryDirectory(prefix="statusline-ci-") as directory:
        root = Path(directory)
        config = root / "Claude 配置 with spaces"
        project = root / "项目 with spaces"
        project.mkdir()
        environment = os.environ.copy()
        environment.update(
            CLAUDE_CONFIG_DIR=str(config),
            CLAUDE_STATUSLINE_RUNTIME_DIR=str(config / "statusline_runtime"),
            CLAUDE_STATUSLINE_SESSIONS_DIR=str(config / "sessions"),
            GIT_CONFIG_GLOBAL=os.devnull,
            GIT_CONFIG_SYSTEM=os.devnull,
        )

        def run(argv, payload=None):
            result = subprocess.run(
                argv,
                input=json.dumps(payload) if payload is not None else None,
                capture_output=True,
                text=True,
                encoding="utf-8",
                env=environment,
                cwd=project,
                check=False,
                timeout=20,
                creationflags=_platform.no_window_creation_flags(),
            )
            assert result.returncode == 0, (
                f"{argv}: {result.returncode}\n{result.stdout}\n{result.stderr}"
            )
            return result.stdout

        def cli(*arguments, payload=None):
            return run([command, *arguments], payload)

        cli("install", "--dry-run")
        assert not config.exists(), "dry-run must not create a config directory"
        cli("install")
        settings_path = config / "settings.json"
        before = settings_path.read_bytes()
        backups = list((config / "backups" / "statusline").iterdir())
        cli("install")
        assert settings_path.read_bytes() == before
        assert list((config / "backups" / "statusline").iterdir()) == backups
        report["checks"].append("install-dry-run-and-idempotency")

        cli(
            "config",
            "set-items",
            "model-with-effort",
            "current-dir",
            "git",
            "tokens",
            "prompt-timer",
        )
        cli("config", "set", "colors", "off")
        value = json.loads(cli("config", "show", "--json"))
        assert value["display"]["items"][-2:] == ["tokens", "prompt-timer"]
        report["checks"].append("config-round-trip")

        run(["git", "init", "-q"])
        source = project / "fixture.txt"
        source.write_text("initial\n", encoding="utf-8")
        run(["git", "add", "fixture.txt"])
        run(
            [
                "git",
                "-c",
                "user.name=Statusline CI",
                "-c",
                "user.email=statusline-ci@example.invalid",
                "commit",
                "-qm",
                "fixture",
            ]
        )
        source.write_text("changed\n", encoding="utf-8")

        session_id, prompt_id = "ci-session", "ci-prompt"
        event = {"session_id": session_id, "prompt_id": prompt_id}
        cli("hook", payload={**event, "hook_event_name": "UserPromptSubmit"})
        transcript = root / "transcript.jsonl"
        timestamp = datetime.now(timezone.utc).isoformat()
        records = [
            {
                "type": "user",
                "timestamp": timestamp,
                "promptId": prompt_id,
                "origin": {"kind": "human"},
                "message": {"role": "user", "content": "fixture"},
            },
            {
                "type": "assistant",
                "timestamp": timestamp,
                "message": {
                    "id": "ci-message",
                    "role": "assistant",
                    "content": [{"type": "text", "text": "done"}],
                    "usage": {
                        "input_tokens": 1000,
                        "output_tokens": 500,
                        "cache_read_input_tokens": 2000,
                        "cache_creation_input_tokens": 200,
                    },
                },
            },
        ]
        transcript.write_text(
            "".join(json.dumps(record) + "\n" for record in records), encoding="utf-8"
        )
        payload = {
            **event,
            "transcript_path": str(transcript),
            "model": {"id": "claude-ci", "display_name": "CI"},
            "workspace": {"current_dir": str(project), "project_dir": str(project)},
        }
        output = cli("render", payload=payload)
        assert "Git " in output and "~1" in output
        assert all(label in output for label in ("hit", "miss", "out")), output
        assert "⏱" in output, output
        cli("hook", payload={**event, "hook_event_name": "Stop"})
        output = cli("render", payload=payload)
        assert "✓" in output, output
        state_file = (
            config
            / "statusline_runtime"
            / "turns"
            / (hashlib.sha256(session_id.encode()).hexdigest() + ".json")
        )
        state = json.loads(state_file.read_text(encoding="utf-8"))
        assert state["status"] == "completed"
        report["checks"].append("git-tokens-and-hook-lifecycle")

        subagent_output = cli(
            "render-subagents",
            payload={
                "columns": 120,
                "tasks": [
                    {
                        "id": "ci-agent",
                        "name": "CI agent",
                        "status": "running",
                        "model": "claude-sonnet-5",
                        "startTime": int(time.time() * 1000) - 1000,
                        "description": "synthetic task",
                        "contextWindowSize": 200000,
                        "tokenCount": 1000,
                    }
                ],
            },
        )
        tasks = [json.loads(line) for line in subagent_output.splitlines()]
        assert len(tasks) == 1
        assert tasks[0]["id"] == "ci-agent" and "CI agent" in tasks[0]["content"]
        assert "sonnet-5" in tasks[0]["content"]
        decision = json.loads(
            cli(
                "slash-hook",
                payload={
                    "hook_event_name": "UserPromptExpansion",
                    "expansion_type": "slash_command",
                    "command_name": "statusline-config",
                    "command_args": "show",
                },
            )
        )
        assert decision["decision"] == "block" and "tokens" in decision["reason"]
        report["checks"].append("subagent-render-and-local-slash-config")

        doctor = cli("doctor")
        assert "[ERROR]" not in doctor, doctor
        if _platform.uses_posix_files():
            for path in (settings_path, config / "claude-statusline.json", state_file):
                assert stat.S_IMODE(path.stat().st_mode) == 0o600
            assert stat.S_IMODE(state_file.parent.stat().st_mode) == 0o700
            report["parent_directory_sync"] = _platform._sync_parent_directory(
                settings_path
            )
        report["checks"].append("doctor-and-private-permissions")
        before = settings_path.read_bytes()
        cli("uninstall", "--dry-run")
        assert settings_path.read_bytes() == before
        cli("uninstall")
        settings = json.loads(settings_path.read_text(encoding="utf-8"))
        assert "statusLine" not in settings and "subagentStatusLine" not in settings
        assert (config / "claude-statusline.json").exists()
        report["checks"].append("uninstall-dry-run-and-owned-artifact-removal")

    rendered = json.dumps(report, ensure_ascii=False, indent=2)
    print(rendered)
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(rendered + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
