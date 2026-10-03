"""Opt-in Linux lifecycle acceptance using real Claude calls and an explicit budget.

Raw hook, transcript and stream records remain in the report directory. Nothing
is installed into the user's real configuration. This checks event ordering and
production rendering; it does not claim interactive terminal visual acceptance.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import re
import signal
import subprocess
import sys
import time


def capture_hook(directory: Path) -> int:
    from claude_statusline.platforms import files
    from claude_statusline.runtime.turns import reducer, store

    payload = json.loads(sys.stdin.buffer.read().decode("utf-8-sig"))
    observed = time.time_ns()
    reducer.handle_event(payload)
    state = store.load_turn_state(payload.get("session_id"), payload.get("prompt_id"))
    row = {"received_wall_ns": observed, "event": payload, "state": state}
    directory.mkdir(mode=0o700, parents=True, exist_ok=True)
    with files.exclusive_file_lock(directory / "hooks.lock"):
        with (directory / "hooks.jsonl").open("a", encoding="utf-8") as stream:
            stream.write(json.dumps(row, ensure_ascii=False) + "\n")
    return 0


def records(path: Path) -> list[dict]:
    rows = []
    if path.exists():
        for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
            try:
                value = json.loads(line)
            except ValueError:
                continue
            if isinstance(value, dict):
                rows.append(value)
    return rows


def verify(directory: Path, executable: Path, environment: dict, multi: bool) -> dict:
    hooks = records(directory / "hooks.jsonl")
    submit = next(
        row
        for row in hooks
        if row["event"].get("hook_event_name") == "UserPromptSubmit"
    )
    sid = submit["event"]["session_id"]
    prompt = submit["event"]["prompt_id"]
    state_path = (
        Path(environment["CLAUDE_STATUSLINE_RUNTIME_DIR"])
        / "turns"
        / (hashlib.sha256(sid.encode()).hexdigest() + ".json")
    )
    state = json.loads(state_path.read_text(encoding="utf-8"))
    state = next(
        row for row in state["lifecycle"]["turns"] if row["prompt_id"] == prompt
    )
    assert state["status"] == "completed", f"Unexpected task ending: {state['status']}"
    assert state["end_source"] == "hook_stop", "A real final main Stop is required"
    assert isinstance(state["duration_ns"], int)
    transcript = Path(submit["event"]["transcript_path"])
    transcript_rows = records(transcript)
    durations = [
        row for row in transcript_rows if row.get("subtype") == "turn_duration"
    ]
    starts = [
        row for row in hooks if row["event"].get("hook_event_name") == "SubagentStart"
    ]
    stops = [
        row for row in hooks if row["event"].get("hook_event_name") == "SubagentStop"
    ]
    waiting = any(
        (row.get("state") or {}).get("phase") == "waiting_subagents" for row in hooks
    )
    wrap_up = any(
        (row.get("state") or {}).get("phase") == "resuming_main" for row in hooks
    )
    if multi:
        assert len({row["event"]["agent_id"] for row in starts}) >= 2, (
            "Two real agents are required"
        )
        assert len(stops) >= 2, "Both agents must stop"
        assert state["had_subagents"] and state["duration_source"] == "task"
    payload = {
        "session_id": sid,
        "prompt_id": prompt,
        "transcript_path": str(transcript),
        "model": {"id": "live-timer-probe"},
        "workspace": {"current_dir": str(directory)},
    }
    rendered = []
    for _ in range(2):
        completed = subprocess.run(
            [str(executable), "render"],
            input=json.dumps(payload),
            env=environment,
            capture_output=True,
            text=True,
            encoding="utf-8",
            timeout=20,
            check=True,
        )
        plain = re.sub(r"\x1b\[[0-9;:]*m", "", completed.stdout)
        timer = re.search(r"✓\s+(?:\d+h\s+)?\d+m\s+\d+s", plain)
        assert timer, "Production renderer must show a completed task"
        rendered.append(timer.group())
        time.sleep(1)
    assert rendered[0] == rendered[1], "Frozen renderer values must remain stable"
    final = json.loads(state_path.read_text(encoding="utf-8"))
    final = next(
        row for row in final["lifecycle"]["turns"] if row["prompt_id"] == prompt
    )
    assert final["duration_ns"] == state["duration_ns"], (
        "Transcript refresh must preserve task duration"
    )
    return {
        "passed": True,
        "hook_sequence": [row["event"]["hook_event_name"] for row in hooks],
        "agent_starts": len(starts),
        "agent_stops": len(stops),
        "waiting_observed": waiting,
        "wrap_up_observed": wrap_up,
        "native_duration_records": len(durations),
        "task_duration_ns": state["duration_ns"],
        "rendered_timer": rendered[0],
    }


def run_case(directory: Path, executable: Path, cap: float, multi: bool) -> dict:
    directory.mkdir(mode=0o700, parents=True)
    config = directory / "Claude config"
    project = directory / "project"
    project.mkdir()
    config.mkdir()
    environment = os.environ.copy()
    source_config = Path(
        environment.get("CLAUDE_CONFIG_DIR", str(Path.home() / ".claude"))
    )
    settings_path = source_config / "settings.json"
    settings = (
        json.loads(settings_path.read_text(encoding="utf-8"))
        if settings_path.exists()
        else {}
    )
    # Preserve authentication, gateway environment and model selection without plugins or personal context.
    copied = {
        key: settings[key]
        for key in ("apiKeyHelper", "model", "env")
        if key in settings
    }
    (config / "settings.json").write_text(json.dumps(copied), encoding="utf-8")
    os.chmod(config / "settings.json", 0o600)
    environment.update(
        CLAUDE_CONFIG_DIR=str(config),
        CLAUDE_STATUSLINE_RUNTIME_DIR=str(config / "statusline_runtime"),
    )
    environment["PATH"] = (
        str(executable.parent) + os.pathsep + environment.get("PATH", "")
    )
    environment.pop("CLAUDECODE", None)
    subprocess.run(
        [str(executable), "install", "--config-dir", str(config)],
        env=environment,
        cwd=project,
        capture_output=True,
        check=True,
        timeout=30,
    )
    configured = json.loads((config / "settings.json").read_text(encoding="utf-8"))
    import shlex

    hook_command = shlex.join(
        [sys.executable, str(Path(__file__).resolve()), "capture-hook", str(directory)]
    )
    for groups in configured.get("hooks", {}).values():
        for group in groups:
            for hook in group.get("hooks", []):
                if hook.get("type") == "command" and shlex.split(
                    hook.get("command", "")
                ) == [str(executable), "hook"]:
                    hook["command"] = hook_command
    assert all(
        any(
            h.get("command") == hook_command
            for g in configured["hooks"][event]
            for h in g["hooks"]
        )
        for event in ("UserPromptSubmit", "Stop", "SubagentStart", "SubagentStop")
    ), "Live probes must use the current package through the recording hook"
    (config / "settings.json").write_text(json.dumps(configured), encoding="utf-8")
    prompt = "Reply with exactly TIMER_SINGLE_OK. Do not use tools."
    if multi:
        prompt = (
            "Start exactly two timer-probe subagents concurrently with the Agent tool, both with run_in_background=true. "
            "Ask the first to run exactly Bash command sleep 2 and then reply TIMER_A_OK. "
            "Ask the second to run exactly Bash command sleep 4 and then reply TIMER_B_OK. "
            "After launching both, return WAITING_FOR_TIMER_PROBES immediately without polling or waiting. "
            "When their completion notifications arrive, return TIMER_MULTI_OK only after both reports. "
            "Use no other tools or data."
        )
    argv = [
        "claude",
        "-p",
        "--verbose",
        "--output-format",
        "stream-json",
        "--include-hook-events",
        "--max-budget-usd",
        str(cap),
        "--max-turns",
        "12",
        "--setting-sources",
        "user",
        "--disable-slash-commands",
        "--strict-mcp-config",
        "--mcp-config",
        '{"mcpServers":{}}',
        "--tools",
        "Agent,Bash" if multi else "",
        "--allowedTools",
        "Agent,Bash(sleep *)",
        "--agents",
        json.dumps(
            {
                "timer-probe": {
                    "description": "Run a tiny timer acceptance probe",
                    "prompt": "Follow the requested sleep command exactly, then reply with the requested marker. Do not access files or other data.",
                    "tools": ["Bash"],
                }
            }
        ),
        prompt,
    ]
    started = time.monotonic()
    with (
        (directory / "stream.jsonl").open("w", encoding="utf-8") as stdout,
        (directory / "stderr.log").open("w", encoding="utf-8") as stderr,
    ):
        process = subprocess.Popen(
            argv,
            cwd=project,
            env=environment,
            stdout=stdout,
            stderr=stderr,
            start_new_session=True,
        )
        try:
            code = process.wait(timeout=180)
        except subprocess.TimeoutExpired:
            os.killpg(process.pid, signal.SIGTERM)
            try:
                code = process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                os.killpg(process.pid, signal.SIGKILL)
                code = process.wait()
    result = next(
        (
            row
            for row in reversed(records(directory / "stream.jsonl"))
            if row.get("type") == "result"
        ),
        {},
    )
    cost = result.get("total_cost_usd")
    known = (
        isinstance(cost, (int, float))
        and not isinstance(cost, bool)
        and math.isfinite(cost)
        and cost >= 0
    )
    report = {
        "case": directory.name,
        "cap_usd": cap,
        "cost_known": known,
        "cost_usd": cost if known else None,
        "reserved_spend_usd": cost if known else cap,
        "exit_code": code,
        "elapsed_seconds": round(time.monotonic() - started, 3),
    }
    try:
        if code != 0 or result.get("is_error"):
            raise AssertionError(
                "Claude did not finish successfully; inspect the private stream and stderr files"
            )
        report.update(verify(directory, executable, environment, multi))
    except (
        AssertionError,
        OSError,
        ValueError,
        KeyError,
        StopIteration,
        subprocess.SubprocessError,
    ) as error:
        report.update(passed=False, error=str(error))
    return report


def finish_report(root: Path, report: dict) -> int:
    phase_coverage = any(
        case.get("waiting_observed") and case.get("wrap_up_observed")
        for case in report["cases"]
    )
    report["waiting_and_wrap_up_covered"] = phase_coverage
    report["passed"] = (
        len(report["cases"]) == 3
        and all(case["passed"] for case in report["cases"])
        and phase_coverage
    )
    (root / "report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    return 0 if report["passed"] else 1


def verify_existing(root: Path) -> int:
    """Recheck genuine captured sessions with the current renderer, without API calls."""
    root = root.resolve()
    report = json.loads((root / "report.json").read_text(encoding="utf-8"))
    executable = Path(sys.executable).parent / "claude-statusline"
    for case in report["cases"]:
        if case.get("exit_code") != 0 or not case.get("cost_known"):
            continue
        directory = root / case["case"]
        config = directory / "Claude config"
        environment = os.environ.copy()
        environment.update(
            CLAUDE_CONFIG_DIR=str(config),
            CLAUDE_STATUSLINE_RUNTIME_DIR=str(config / "statusline_runtime"),
        )
        try:
            case.update(
                verify(directory, executable, environment, case["case"] != "single")
            )
            case.pop("error", None)
        except (
            AssertionError,
            OSError,
            ValueError,
            KeyError,
            StopIteration,
            subprocess.SubprocessError,
        ) as error:
            case.update(passed=False, error=str(error))
        print(json.dumps(case, ensure_ascii=False), flush=True)
    return finish_report(root, report)


def main() -> int:
    if len(sys.argv) == 3 and sys.argv[1] == "capture-hook":
        return capture_hook(Path(sys.argv[2]))
    if len(sys.argv) == 3 and sys.argv[1] == "verify-existing":
        return verify_existing(Path(sys.argv[2]))
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--budget-usd", type=float, required=True)
    parser.add_argument("--report-dir", type=Path, required=True)
    args = parser.parse_args()
    if sys.platform != "linux":
        parser.error("This opt-in real-session acceptance currently requires Linux")
    if not math.isfinite(args.budget_usd) or not 0 < args.budget_usd <= 10:
        parser.error(
            "Explicit total budget must be greater than zero and at most 10 USD"
        )
    root = args.report_dir.resolve()
    root.mkdir(mode=0o700, parents=True, exist_ok=False)
    executable = Path(sys.executable).parent / "claude-statusline"
    import platform
    from claude_statusline import __version__

    report = {
        "budget_usd": args.budget_usd,
        "reserved_spend_usd": 0,
        "cases": [],
        "package_version": __version__,
        "python": platform.python_version(),
        "platform": platform.platform(),
        "claude_version": subprocess.check_output(
            ["claude", "--version"], text=True
        ).strip(),
        "acceptance_mode": "real print-mode hooks/transcripts and production renderer; no visual acceptance claim",
    }
    for name, cap, multi in (
        ("single", 1.0, False),
        ("parallel", 4.5, True),
        ("parallel-repeat", 4.5, True),
    ):
        remaining = args.budget_usd - report["reserved_spend_usd"]
        if remaining <= 0:
            break
        case = run_case(root / name, executable, min(cap, remaining), multi)
        report["cases"].append(case)
        report["reserved_spend_usd"] += case["reserved_spend_usd"]
        (root / "report.json").write_text(
            json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        print(json.dumps(case, ensure_ascii=False), flush=True)
        if not case["cost_known"]:
            break
    return finish_report(root, report)


if __name__ == "__main__":
    raise SystemExit(main())
