"""Exercise the installed CLI with an isolated config and synthetic session."""

from claude_statusline.platforms import clocks as platform_clocks
from claude_statusline.platforms import environment as platform_environment
from claude_statusline.platforms import files as platform_files
from claude_statusline.platforms import processes as platform_processes

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

from claude_statusline._version import __version__


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--report", type=Path)
    args = parser.parse_args()
    command = shutil.which(
        "claude-statusline.exe"
        if platform_environment.is_windows()
        else "claude-statusline"
    )
    assert command, "the installed CLI must be on PATH"
    _wall, boot, boot_id = platform_clocks.now_clocks()
    report = {
        "platform": sys.platform,
        "os_version": platform.mac_ver()[0]
        if platform_environment.is_macos()
        else platform.release(),
        "architecture": platform.machine(),
        "python": platform.python_version(),
        "package_version": __version__,
        "native_suspend_clock": boot is not None and boot_id is not None,
        "checks": [],
    }
    if platform_environment.is_macos():
        expected_arch = os.environ.get("STATUSLINE_EXPECTED_ARCH")
        if expected_arch:
            assert (
                platform.machine() == {"x64": "x86_64", "arm64": "arm64"}[expected_arch]
            )
        assert report["native_suspend_clock"], (
            "native macOS clock must work on the supported runners"
        )
        assert platform_processes.process_start_token(os.getpid()), (
            "native macOS process verification must work"
        )
    if platform_environment.uses_posix_files():
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

        def run(argv, payload=None, expected_returncode=0):
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
                creationflags=platform_environment.no_window_creation_flags(),
            )
            assert result.returncode == expected_returncode, (
                f"{argv}: {result.returncode}\n{result.stdout}\n{result.stderr}"
            )
            return result.stdout

        def cli(*arguments, payload=None, expected_returncode=0):
            # Core smoke keeps compatibility entry assertions independent of
            # release defaults. Native lifecycle/defaults have their own suite.
            if arguments and arguments[0] == "install":
                arguments = (*arguments, "--no-native-editor")
            return run([command, *arguments], payload, expected_returncode)

        assert cli("--version").strip() == f"claude-statusline {__version__}"

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

        # Exercise ownership conflicts against the installed wheel, including
        # rejection before any backup/write and an explicit takeover.
        foreign = root / "foreign config"
        foreign.mkdir()
        foreign_settings = foreign / "settings.json"
        platform_files.atomic_write_bytes(
            foreign_settings,
            json.dumps(
                {
                    "statusLine": {"type": "command", "command": "echo foreign"},
                    "unrelated": {"keep": True},
                }
            ).encode("utf-8"),
        )
        foreign_before = foreign_settings.read_bytes()
        cli("install", "--config-dir", str(foreign), expected_returncode=2)
        assert foreign_settings.read_bytes() == foreign_before
        assert not (foreign / "backups").exists()
        cli("install", "--config-dir", str(foreign), "--force")
        assert json.loads(foreign_settings.read_bytes())["unrelated"] == {"keep": True}
        assert len(list((foreign / "backups" / "statusline").iterdir())) == 1
        cli("uninstall", "--config-dir", str(foreign))
        assert "statusLine" not in json.loads(foreign_settings.read_bytes())
        report["checks"].append("ownership-conflict-rejection-and-explicit-takeover")

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
        if platform_environment.uses_posix_files():
            for path in (settings_path, config / "claude-statusline.json", state_file):
                assert stat.S_IMODE(path.stat().st_mode) == 0o600
            assert stat.S_IMODE(state_file.parent.stat().st_mode) == 0o700
            report["parent_directory_sync"] = platform_files._sync_parent_directory(
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
