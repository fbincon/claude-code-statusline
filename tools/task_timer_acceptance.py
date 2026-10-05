"""Opt-in real task-clock probes sharing the existing locked USD 10 ledger.

Default native timing and explicitly disabled collection use installed resources.
SDK responses to questions and interruptions are automated acceptance inputs,
not human interaction or terminal visual acceptance. Raw evidence stays private.
"""

from __future__ import annotations

import argparse
import asyncio
from dataclasses import asdict
import hashlib
import json
import os
from pathlib import Path
import re
import shlex
import shutil
import subprocess
import sys
import time

from live_metrics_acceptance import reserve, settle
from live_timer_acceptance import capture_hook, records
from native_mod_acceptance import prepare

CASES = (
    "single",
    "single-agent",
    "parallel",
    "stop-continue",
    "wait",
    "interrupt",
    "compat",
)


def record_hook(root, case):
    # Preserve production behavior and take a snapshot before the host responds.
    payload = sys.stdin.buffer.read()
    import io

    sys.stdin = io.TextIOWrapper(io.BytesIO(payload), encoding="utf-8")
    capture_hook(root)
    event = json.loads(payload)
    if case == "stop-continue" and event.get("hook_event_name") == "Stop":
        from claude_statusline.platforms import files

        with files.exclusive_file_lock(root / "continuation.lock"):
            flag = root / "continuation.json"
            if not flag.exists():
                flag.write_text(json.dumps({"wall_ns": time.time_ns()}))
                print(
                    json.dumps(
                        {
                            "decision": "block",
                            "reason": "Continue the same task: run Bash sleep 1 and then reply TIMER_CONTINUED_OK.",
                        }
                    )
                )
    return 0


def verify(root, backend, case):
    config = next(
        p for p in root.iterdir() if p.is_dir() and (p / "settings.json").exists()
    )
    env = dict(
        os.environ,
        CLAUDE_CONFIG_DIR=str(config),
        CLAUDE_STATUSLINE_RUNTIME_DIR=str(config / "statusline_runtime"),
    )
    hooks = records(root / "hooks.jsonl")
    submit = next(
        row
        for row in hooks
        if row["event"]["hook_event_name"] == "UserPromptSubmit"
        and not row["event"].get("agent_id")
    )
    sid, prompt = submit["event"]["session_id"], submit["event"]["prompt_id"]
    target = (
        config
        / "statusline_runtime"
        / "turns"
        / (hashlib.sha256(sid.encode()).hexdigest() + ".json")
    )

    def state():
        return next(
            row
            for row in json.loads(target.read_bytes())["lifecycle"]["turns"]
            if row["prompt_id"] == prompt
        )

    payload = {
        "session_id": sid,
        "prompt_id": prompt,
        "transcript_path": submit["event"]["transcript_path"],
        "model": {"id": "task-timer-probe"},
        "columns": 120,
    }
    displays = []
    elapsed = []
    expected = "interrupted" if case == "interrupt" else "completed"
    for _ in range(2):
        rendered = subprocess.run(
            [str(backend), "render"],
            input=json.dumps(payload),
            env=env,
            capture_output=True,
            text=True,
            check=True,
            timeout=15,
        )
        plain = re.sub(r"\x1b\[[0-9;:]*m", "", rendered.stdout)
        marker = "■" if case == "interrupt" else "✓"
        match = re.search(marker + r"\s+(?:\d+h\s+)?\d+m\s+\d+s", plain)
        assert match, f"production task marker missing: {plain!r}"
        displays.append(match.group())
        current = state()
        assert current["status"] == expected, current["status"]
        elapsed.append(current["duration_ns"])
        time.sleep(1)
    assert displays[0] == displays[1] and elapsed[0] == elapsed[1], (
        "ending must stay frozen"
    )
    current = state()
    result = subprocess.run(
        [str(backend), "runtime", "--config-dir", str(config)],
        input=json.dumps(
            {
                "protocol_version": 2,
                "operation": "read",
                "payload": {"session_id": sid, "prompt_id": prompt},
            }
        ),
        env=env,
        capture_output=True,
        text=True,
        check=True,
        timeout=15,
    )
    active = json.loads(result.stdout)["result"]["metrics"]["task-active-timer"]
    if case in ("compat", "wait"):
        assert active["value"] is None, "missing execution evidence must be hidden"
        assert "Active " not in plain, "unavailable execution timer was rendered"
    if case == "wait":
        waits = records(root / "controlled-input.jsonl")
        assert any(row.get("wait_seconds", 0) >= 2 for row in waits), (
            "no real SDK question wait"
        )
        assert active["reason"] in (
            "wait_coverage_missing",
            "incomplete",
            "abnormal_clock",
        )
    if case == "compat":
        assert active["reason"] == "native_timing_disabled"
        assert not current["native_turns"], "explicit opt-out collected native timing"
    if case == "stop-continue":
        stops = [row for row in hooks if row["event"]["hook_event_name"] == "Stop"]
        assert len(stops) >= 2, "a real blocked Stop must continue"
        assert stops[0]["state"]["phase"] == "stop_pending"
        assert current["started_wall_ns"] <= stops[0]["state"]["started_wall_ns"]
        assert current["ended_wall_ns"] > stops[0]["received_wall_ns"]
        assert (
            current["duration_ns"] > stops[0]["state"]["stop_candidate"]["duration_ns"]
        )
    starts = [
        row for row in hooks if row["event"]["hook_event_name"] == "SubagentStart"
    ]
    stops = [row for row in hooks if row["event"]["hook_event_name"] == "SubagentStop"]
    if case in ("single-agent", "parallel"):
        minimum = 2 if case == "parallel" else 1
        assert len({row["event"]["agent_id"] for row in starts}) >= minimum
        assert len(stops) >= minimum and not current["active_agents"]
    return {
        "passed": True,
        "case": case,
        "status": expected,
        "end_source": current["end_source"],
        "task_duration_ns": elapsed[0],
        "native_duration_ms": current["native_duration_ms"],
        "active_timer": active,
        "frozen_renderer": displays[0],
        "agent_starts": len(starts),
        "agent_stops": len(stops),
        "waiting_observed": any(
            (row.get("state") or {}).get("phase") == "waiting_subagents"
            for row in hooks
        ),
        "wrap_up_observed": any(
            (row.get("state") or {}).get("phase") == "resuming_main" for row in hooks
        ),
        "manual_interaction_acceptance": False,
        "real_machine_suspend_acceptance": False,
    }


async def run_sdk(root, project, env, case, cap):
    # Optional acceptance-only dependency; the package itself does not need it.
    from claude_agent_sdk import ClaudeAgentOptions, ClaudeSDKClient, ResultMessage
    from claude_agent_sdk.types import (
        HookMatcher,
        PermissionResultAllow,
        PermissionResultDeny,
    )

    async def dummy(*args):
        return {"continue_": True}

    async def approve(tool, inputs, context):
        if tool != "AskUserQuestion":
            return PermissionResultDeny(
                message="Only the acceptance question is permitted"
            )
        started = time.monotonic()
        await asyncio.sleep(2)
        answers = {q["question"]: q["options"][0]["label"] for q in inputs["questions"]}
        with (root / "controlled-input.jsonl").open("a") as stream:
            stream.write(
                json.dumps({"tool": tool, "wait_seconds": time.monotonic() - started})
                + "\n"
            )
        return PermissionResultAllow(updated_input={**inputs, "answers": answers})

    options = ClaudeAgentOptions(
        cli_path=shutil.which("claude", path=env["PATH"]),
        cwd=str(project),
        env=env,
        setting_sources=["user"],
        max_budget_usd=cap,
        max_turns=6,
        tools=["AskUserQuestion"] if case == "wait" else ["Bash"],
        allowed_tools=[] if case == "wait" else ["Bash(sleep *)"],
        can_use_tool=approve if case == "wait" else None,
        hooks={"PreToolUse": [HookMatcher(hooks=[dummy])]},
    )
    prompt = (
        "Use AskUserQuestion exactly once to ask 'Proceed with the timer probe?' with Yes and No options. "
        "Then reply TIMER_WAIT_OK. Use no other tools."
        if case == "wait"
        else "Run exactly Bash sleep 20 in the foreground, then reply TIMER_INTERRUPT_UNEXPECTED. Use no other tools."
    )
    result, interrupted = None, False
    async with ClaudeSDKClient(options=options) as client:
        await client.query(prompt)
        with (root / "sdk-messages.jsonl").open("w") as stream:
            async for message in client.receive_response():
                stream.write(json.dumps(asdict(message), default=str) + "\n")
                stream.flush()
                if (
                    case == "interrupt"
                    and not interrupted
                    and any(
                        getattr(block, "name", None) == "Bash"
                        for block in getattr(message, "content", [])
                    )
                ):
                    await asyncio.sleep(1)
                    await client.interrupt()
                    interrupted = True
                if isinstance(message, ResultMessage):
                    result = asdict(message)
    if case == "interrupt":
        assert interrupted, "no actual running tool was interrupted"
    return result


def run(root, backend, case, ledger, cap):
    project, env = prepare(root, backend)
    config = Path(env["CLAUDE_CONFIG_DIR"])
    env["CLAUDE_STATUSLINE_RUNTIME_DIR"] = str(config / "statusline_runtime")
    if case == "compat":
        subprocess.run(
            [
                str(backend),
                "install",
                "--no-native-editor",
                "--no-live-metrics",
                "--config-dir",
                str(config),
            ],
            env=env,
            cwd=project,
            check=True,
            stdout=subprocess.DEVNULL,
            timeout=180,
        )
    subprocess.run(
        [str(backend), "config", "set-items", "task-timer", "task-active-timer"],
        env=env,
        check=True,
        stdout=subprocess.DEVNULL,
        timeout=10,
    )
    settings_path = config / "settings.json"
    settings = json.loads(settings_path.read_bytes())
    command = shlex.join(
        [
            sys.executable,
            str(Path(__file__).resolve()),
            "--capture-hook",
            str(root),
            "--case",
            case,
        ]
    )
    for groups in settings["hooks"].values():
        for group in groups:
            for hook in group.get("hooks", []):
                if hook.get("type") == "command" and shlex.split(
                    hook.get("command", "")
                ) == [str(backend), "hook"]:
                    hook["command"] = command
    settings_path.write_text(json.dumps(settings))
    prompts = {
        "single": "Reply exactly TIMER_SINGLE_OK. Use no tools.",
        "compat": "Reply exactly TIMER_COMPAT_OK. Use no tools.",
        "stop-continue": "Reply exactly TIMER_INITIAL_STOP. Use no tools until instructed by a hook.",
        "single-agent": "Start one timer-probe Agent synchronously. Ask it to run Bash sleep 1 then reply TIMER_AGENT_OK. After it finishes run Bash sleep 1 yourself and reply TIMER_WRAP_OK. Use no other tools or data.",
        "parallel": "Start two timer-probe Agents concurrently with run_in_background=true. Ask one to run Bash sleep 2 then reply TIMER_A_OK and the other Bash sleep 4 then TIMER_B_OK. Return WAITING_FOR_TIMER_PROBES without polling. After both reports arrive run Bash sleep 1 yourself and reply TIMER_PARALLEL_OK. Use no other tools or data.",
    }
    identity = reserve(ledger, str(root), cap)
    final, code = None, None
    started = time.monotonic()
    report = {"case": case, "attempt_id": identity, "cap_usd": cap}
    try:
        if case in ("wait", "interrupt"):
            final = asyncio.run(
                asyncio.wait_for(run_sdk(root, project, env, case, cap), 150)
            )
            code = 0
        else:
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
                "10",
                "--setting-sources",
                "user",
                "--disable-slash-commands",
                "--strict-mcp-config",
                "--mcp-config",
                '{"mcpServers":{}}',
                "--tools",
                "" if case in ("single", "compat") else "Agent,Bash",
                "--allowedTools",
                "Agent,Bash(sleep *)",
                "--agents",
                json.dumps(
                    {
                        "timer-probe": {
                            "description": "Run only a requested tiny timer acceptance sleep",
                            "prompt": "Run only the requested sleep and return its marker; do not access files or other data.",
                            "tools": ["Bash"],
                        }
                    }
                ),
                prompts[case],
            ]
            with (
                (root / "stream.jsonl").open("w") as stdout,
                (root / "stderr.log").open("w") as stderr,
            ):
                completed = subprocess.run(
                    argv,
                    env=env,
                    cwd=project,
                    stdout=stdout,
                    stderr=stderr,
                    timeout=180,
                )
                code = completed.returncode
            final = next(
                (
                    row
                    for row in reversed(records(root / "stream.jsonl"))
                    if row.get("type") == "result"
                ),
                None,
            )
        assert (
            code == 0
            and final is not None
            and (case == "interrupt" or not final.get("is_error"))
        ), "real session failed"
    except Exception as error:
        report.update(passed=False, error=str(error))
    finally:
        cost = final.get("total_cost_usd") if final else None
        accounted = settle(ledger, identity, cost)
        report.update(
            cost_usd=cost,
            accounted_total_usd=accounted,
            exit_code=code,
            seconds=round(time.monotonic() - started, 3),
        )
        (root / "cost.json").write_text(json.dumps(report, indent=2))
    if "error" not in report:
        try:
            report.update(verify(root, backend, case))
        except Exception as error:
            report.update(passed=False, error=str(error))
    (root / "report.json").write_text(json.dumps(report, indent=2))
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path)
    parser.add_argument(
        "--backend",
        type=Path,
        default=Path(sys.executable).parent / "claude-statusline",
    )
    parser.add_argument("--case", choices=CASES, default="single")
    parser.add_argument("--capture-hook", type=Path)
    parser.add_argument("--budget-ledger", type=Path)
    parser.add_argument("--cap-usd", type=float, default=1)
    parser.add_argument("--run-real-calls", action="store_true")
    args = parser.parse_args()
    if args.capture_hook:
        return record_hook(args.capture_hook, args.case)
    if args.root is None:
        parser.error("--root is required")
    if args.run_real_calls:
        if args.budget_ledger is None or args.root.exists():
            parser.error("paid calls require the existing shared ledger and a new root")
        report = run(
            args.root.resolve(),
            args.backend.resolve(),
            args.case,
            args.budget_ledger.resolve(),
            args.cap_usd,
        )
    else:
        report = verify(args.root.resolve(), args.backend.resolve(), args.case)
    print(json.dumps(report, indent=2))
    return 0 if report["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
