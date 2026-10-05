"""Opt-in isolated real-session probes with one locked, persistent USD ledger.

All attempts and retries share the ledger. Unknown costs retain the call cap.
Verification can be rerun without model calls; private records stay ignored.
"""

import argparse
import json
import math
import os
from pathlib import Path
import signal
import subprocess
import sys
import time
import uuid

from claude_statusline.platforms import files


def reserve(ledger, case, cap):
    if type(cap) not in (int, float) or not math.isfinite(cap) or not 0 < cap <= 10:
        raise ValueError("call cap must be finite and in (0, 10]")
    with files.exclusive_file_lock(ledger.with_suffix(".lock")):
        value = json.loads(ledger.read_bytes())
        if value.get("authorized_total_usd") != 10 or not isinstance(
            value.get("attempts"), list
        ):
            raise ValueError("expected the shared authorized $10 ledger")
        used = sum(
            row.get("known_usd", 0) + row.get("reserved_usd", 0)
            for row in value["attempts"]
        )
        if used + cap > 10:
            raise ValueError(
                f"shared $10 budget exhausted; USD {10 - used:.4f} remains"
            )
        identity = str(uuid.uuid4())
        value["attempts"].append(
            {
                "id": identity,
                "case": case,
                "cap_usd": cap,
                "known_usd": 0,
                "reserved_usd": cap,
                "status": "reserved",
            }
        )
        value["reserved_total_usd"] = sum(
            row["reserved_usd"] for row in value["attempts"]
        )
        files.atomic_write_bytes(ledger, json.dumps(value, indent=2).encode(), 0o600)
        return identity


def settle(ledger, identity, cost):
    known = type(cost) in (int, float) and math.isfinite(cost) and cost >= 0
    with files.exclusive_file_lock(ledger.with_suffix(".lock")):
        value = json.loads(ledger.read_bytes())
        row = next(row for row in value["attempts"] if row["id"] == identity)
        row.update(
            status="finished",
            known_usd=cost if known else 0,
            reserved_usd=0 if known else row["cap_usd"],
            cost_known=known,
        )
        value["known_total_usd"] = sum(row["known_usd"] for row in value["attempts"])
        value["reserved_total_usd"] = sum(
            row["reserved_usd"] for row in value["attempts"]
        )
        files.atomic_write_bytes(ledger, json.dumps(value, indent=2).encode(), 0o600)
        return value["known_total_usd"] + value["reserved_total_usd"]


def rows(path):
    result = []
    for line in path.read_text(encoding="utf-8").splitlines():
        try:
            result.append(json.loads(line))
        except ValueError:
            pass
    return result


def verify(root, backend):
    config = root / "Claude config 中文"
    environment = dict(
        os.environ,
        CLAUDE_CONFIG_DIR=str(config),
        CLAUDE_STATUSLINE_RUNTIME_DIR=str(config / "statusline_runtime"),
    )
    stores = [
        json.loads(p.read_bytes())
        for p in (config / "statusline_runtime/live").glob("*.json")
    ]
    state = max(stores, key=lambda row: row["loaded_at_ms"])
    sid = state["session_id"]
    prompt = state["active_prompt_id"] or state["current_prompt_id"]

    def read():
        completed = subprocess.run(
            [str(backend), "runtime", "--config-dir", str(config)],
            input=json.dumps(
                {
                    "protocol_version": 1,
                    "operation": "read",
                    "payload": {"session_id": sid, "prompt_id": prompt},
                }
            ),
            capture_output=True,
            text=True,
            env=environment,
            check=True,
            timeout=10,
        )
        return json.loads(completed.stdout)["result"]

    result = read()
    metrics, state = result["metrics"], result["state"]
    prompt = state["active_prompt_id"] or state["current_prompt_id"]
    assert prompt, "A real human prompt must be bound"
    for item in ("ttft", "output-rate", "prompt-input-tokens", "prompt-output-tokens"):
        assert metrics[item]["value"] is not None, (
            f"{item} unavailable: {metrics[item]['reason']}"
        )
    requests = [
        row
        for row in state["requests"].values()
        if row["prompt_id"] == prompt
        and row["native"]
        and row["usage"] is not None
        and not row["conflict"]
    ]
    assert metrics["prompt-input-tokens"]["value"] == sum(
        row["usage"]["input_tokens"]
        + row["usage"]["cache_read_input_tokens"]
        + row["usage"]["cache_creation_input_tokens"]
        for row in requests
    )
    assert metrics["prompt-output-tokens"]["value"] == sum(
        row["usage"]["output_tokens"] for row in requests
    )
    agents = {
        key: row for key, row in state["agents"].items() if row["prompt_id"] == prompt
    }
    minimum = (
        2
        if root.name.startswith("parallel")
        else 1
        if root.name.startswith("single-agent")
        else 0
    )
    assert len(agents) >= minimum, f"expected {minimum} agents, observed {len(agents)}"
    assert all(row["ended_at_ms"] is not None for row in agents.values()), (
        "all captured agents must end"
    )
    frozen = []
    if agents:
        data = {
            "session_id": sid,
            "columns": 120,
            "tasks": [
                {
                    "id": key,
                    "status": "completed",
                    "name": "probe",
                    "startTime": row["started_at_ms"],
                }
                for key, row in agents.items()
            ],
        }
        for _ in range(2):
            completed = subprocess.run(
                [str(backend), "render-subagents"],
                input=json.dumps(data),
                env=environment,
                capture_output=True,
                text=True,
                check=True,
                timeout=10,
            )
            frozen.append(completed.stdout)
            time.sleep(1)
        assert frozen[0] == frozen[1], "finished agent durations must stay frozen"
    assert read()["metrics"] == metrics, "historical metrics must be stable"
    return {
        "passed": True,
        "session_id": sid,
        "prompt_id": prompt,
        "metrics": metrics,
        "requests": len(requests),
        "agents": len(agents),
        "agent_duration_frozen": bool(frozen),
        "partial_task_coverage": metrics["prompt-input-tokens"]["partial"],
        "manual_visual_acceptance": False,
    }


def run(root, backend, plugin, case, ledger, cap):
    from native_mod_acceptance import prepare
    from claude_statusline.config.runtime import preference_bytes

    project, environment = prepare(root, backend)
    config = Path(environment["CLAUDE_CONFIG_DIR"])
    (config / "claude-statusline-runtime.json").write_bytes(preference_bytes(True))
    environment.update(
        CLAUDE_STATUSLINE_RUNTIME_EXECUTABLE=str(backend),
        CLAUDE_STATUSLINE_RUNTIME_DIR=str(config / "statusline_runtime"),
    )
    prompt = "Reply with exactly LIVE_SINGLE_OK. Do not use tools."
    if case == "single-agent":
        prompt = (
            "Start exactly one live-probe subagent. Ask it to run Bash command sleep 1 and reply LIVE_AGENT_OK. "
            "After it finishes, run Bash sleep 1 yourself for final wrap-up, then reply LIVE_WRAP_OK. Use no other tools or data."
        )
    elif case == "parallel":
        prompt = (
            "Start exactly two live-probe subagents concurrently with Agent and run_in_background=true. "
            "Ask the first to run Bash sleep 2 then reply LIVE_A_OK, and the second Bash sleep 4 then LIVE_B_OK. "
            "After launching both return WAITING_FOR_LIVE_PROBES without polling. "
            "When their completion notifications arrive, reply LIVE_PARALLEL_OK only after both reports. Use no other tools or data."
        )
    argv = [
        "claude",
        "-p",
        "--verbose",
        "--output-format",
        "stream-json",
        "--include-hook-events",
        "--plugin-dir",
        str(plugin),
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
        "" if case == "single" else "Agent,Bash",
        "--allowedTools",
        "Agent,Bash(sleep *)",
        "--agents",
        json.dumps(
            {
                "live-probe": {
                    "description": "Run a tiny live metrics acceptance probe",
                    "prompt": "Follow the requested sleep command exactly, then reply with its marker. Do not access files or other data.",
                    "tools": ["Bash"],
                }
            }
        ),
        prompt,
    ]
    identity = reserve(ledger, str(root), cap)
    started = time.monotonic()
    code = None
    report = {"case": case, "attempt_id": identity, "cap_usd": cap}
    try:
        with (
            (root / "stream.jsonl").open("w", encoding="utf-8") as stdout,
            (root / "stderr.log").open("w", encoding="utf-8") as stderr,
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
    finally:
        stream = rows(root / "stream.jsonl") if (root / "stream.jsonl").exists() else []
        final = next(
            (row for row in reversed(stream) if row.get("type") == "result"), {}
        )
        cost = final.get("total_cost_usd")
        accounted = settle(ledger, identity, cost)
        report.update(
            exit_code=code,
            cost_usd=cost,
            accounted_total_usd=accounted,
            seconds=round(time.monotonic() - started, 3),
        )
        (root / "cost.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    try:
        assert code == 0 and not final.get("is_error"), (
            "real session failed; inspect private stream/stderr"
        )
        report.update(verify(root, backend))
    except (
        AssertionError,
        OSError,
        ValueError,
        KeyError,
        TypeError,
        subprocess.SubprocessError,
    ) as error:
        report.update(passed=False, error=str(error))
    (root / "report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, required=True)
    parser.add_argument(
        "--backend",
        type=Path,
        default=Path(sys.executable).parent / "claude-statusline",
    )
    parser.add_argument("--plugin", type=Path, default=Path("mods/statusline-runtime"))
    parser.add_argument(
        "--case", choices=("single", "single-agent", "parallel"), default="single"
    )
    parser.add_argument("--budget-ledger", type=Path)
    parser.add_argument("--cap-usd", type=float, default=1.25)
    parser.add_argument("--run-real-calls", action="store_true")
    args = parser.parse_args()
    if args.run_real_calls:
        if args.budget_ledger is None or args.root.exists():
            parser.error(
                "real probes require an existing shared ledger and a new output root"
            )
        report = run(
            args.root.resolve(),
            args.backend.resolve(),
            args.plugin.resolve(),
            args.case,
            args.budget_ledger.resolve(),
            args.cap_usd,
        )
    else:
        report = verify(args.root.resolve(), args.backend.resolve())
    print(json.dumps(report, indent=2))
    return 0 if report["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
