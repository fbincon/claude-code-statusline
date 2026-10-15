"""Capture Linux power evidence; this collector never suspends or reboots.

Use before --kind suspend|reboot, then after --action-confirmed after the
authorized OS action. A delay or display blank alone cannot pass the gate.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import platform
import shutil
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
PACKAGE = ROOT / "tools/migration/ts-02"
sys.path.insert(0, str(ROOT))
from tools.macos_clock_smoke import REFERENCE, command, digest, node_replay, write
from claude_statusline.platforms.clocks import now_clocks
from claude_statusline.runtime.timing.clock import Sample, StatusTimer, delta


def sources():
    names = ["tools/linux_clock_smoke.py", "tools/macos_clock_smoke.py",
             "src/claude_statusline/platforms/clocks.py", "src/claude_statusline/platforms/environment.py",
             "src/claude_statusline/platforms/processes.py", "src/claude_statusline/runtime/timing/clock.py"]
    names += [f"tools/migration/ts-02/{name}" for name in
              ("package-lock.json", "runtime-lock.json", "policy.json", "scripts/oracle.py")]
    names += [f"tools/migration/ts-02/{folder}/{name}.{ext}"
              for folder, ext in (("src", "ts"), ("dist", "js"))
              for name in ("cli", "clocks", "native", "json", "context")]
    return {name: digest(ROOT / name) for name in names}


def capture(node):
    wall, boot, identity = now_clocks()
    current = dict(wall_ns=wall, boot_ns=boot, boot_id=identity)
    candidate = json.loads(command([str(node), str(PACKAGE / "dist/cli.js"), "clock", str(os.getpid())]))
    script = "import {exportReference} from './tools/migration/ts-02/dist/context.js'; console.log(exportReference())"
    reference_root = Path(command([str(node), "--input-type=module", "-e", script], cwd=ROOT))
    try:
        oracle = json.loads(command([sys.executable, str(PACKAGE / "scripts/oracle.py"), "clock", str(os.getpid())],
                                    env=dict(os.environ, TS02_REFERENCE_ROOT=str(reference_root))))
    finally:
        shutil.rmtree(reference_root)
    proc_id = Path("/proc/sys/kernel/random/boot_id").read_text().strip()
    if not identity or boot is None or any(value["boot_id"] != proc_id for value in (current, candidate, oracle)):
        raise RuntimeError("Python, immutable reference, Node and /proc boot identities must agree")
    virtual = subprocess.run(["systemd-detect-virt"], capture_output=True, text=True, timeout=10)
    return dict(captured_utc=datetime.fromtimestamp(wall / 1e9, timezone.utc).isoformat(),
                python=current, node=candidate, reference=oracle, proc_boot_id=proc_id,
                proc_btime=int(next(line.split()[1] for line in Path("/proc/stat").read_text().splitlines()
                                    if line.startswith("btime "))),
                diagnostic={"boottime_ns": time.clock_gettime_ns(time.CLOCK_BOOTTIME),
                            "monotonic_ns": time.monotonic_ns()},
                source_hashes=sources(), commit=command(["git", "rev-parse", "HEAD"], cwd=ROOT),
                dirty=bool(command(["git", "status", "--porcelain=v1"], cwd=ROOT)),
                runtimes={"python": sys.version.split()[0], "python_sha256": digest(Path(sys.executable).resolve()),
                          "node": command([str(node), "--version"]), "node_sha256": digest(node)},
                host={"system": platform.system(), "kernel": platform.release(), "machine": platform.machine(),
                      "virtualization": virtual.stdout.strip(), "virtualization_exit": virtual.returncode,
                      "os_release": Path("/etc/os-release").read_text(),
                      "mem_sleep": Path("/sys/power/mem_sleep").read_text().strip()})


def collect_events(output, phase):
    commands = {"kernel": ["journalctl", "-b", "0", "-k", "-o", "json", "--no-pager",
                           "--grep=^PM: suspend (entry|exit)|^Linux version "],
                "boots": ["journalctl", "--list-boots", "-o", "json", "--no-pager"]}
    records = {}
    for name, argv in commands.items():
        result = subprocess.run(argv, capture_output=True, timeout=30, env=dict(os.environ, LC_ALL="C"))
        for suffix, data in (("log", result.stdout), ("stderr", result.stderr)):
            with (output / f"{phase}-{name}.{suffix}").open("xb") as stream:
                stream.write(data)
        records[name] = {"command": argv, "exit_code": result.returncode}
    write(output / f"{phase}-commands.json", records)
    return records


def evaluate(before, after, kernel, boots, replays, confirmed, commands):
    checks = {"action_confirmed": confirmed, "source_unchanged": before["source_hashes"] == after["source_hashes"],
              "runtime_unchanged": before["runtimes"] == after["runtimes"],
              "event_collection_ok": all(commands[name]["exit_code"] == 0 for name in ("kernel", "boots"))}
    start, end = before["python"]["wall_ns"], after["python"]["wall_ns"]
    boot_id = after["proc_boot_id"].replace("-", "")
    selected, intervals, entered = [], [], None
    for event in kernel:
        stamp = int(event["__REALTIME_TIMESTAMP"]) * 1000
        if event.get("_BOOT_ID") != boot_id or not start <= stamp <= end:
            continue
        message = event.get("MESSAGE", "")
        if message.startswith("PM: suspend entry"):
            entered = stamp
            selected.append({"unix_ns": stamp, "message": message})
        elif message == "PM: suspend exit" and entered is not None:
            intervals.append((stamp - entered) / 1e9)
            selected.append({"unix_ns": stamp, "message": message})
            entered = None
    values = {}
    for side in ("python", "node", "reference"):
        a, b = before[side], after[side]
        value = {key: b[key] - a[key] for key in ("wall_ns", "boot_ns")}
        values[side] = value
        if before["kind"] == "suspend":
            checks[side + "_stable_boot"] = a["boot_id"] == b["boot_id"]
            checks[side + "_includes_sleep"] = value["boot_ns"] > 0 and abs(value["boot_ns"] - value["wall_ns"]) < 2_000_000_000
        else:
            checks[side + "_new_boot"] = a["boot_id"] != b["boot_id"]
        expected = value["boot_ns"] if before["kind"] == "suspend" else value["wall_ns"]
        if side in replays:
            checks[side + "_elapsed"] = (replays[side]["delta_ns"] == (expected if expected >= 0 else None)
                                         and replays[side]["trusted"] == (before["kind"] == "suspend"))
    excluded = ((after["diagnostic"]["boottime_ns"] - before["diagnostic"]["boottime_ns"])
                - (after["diagnostic"]["monotonic_ns"] - before["diagnostic"]["monotonic_ns"])) / 1e9
    if before["kind"] == "suspend":
        checks["kernel_suspend_resume_pair"] = any(seconds >= 30 for seconds in intervals)
        checks["monotonic_excluded_sleep"] = excluded >= 28
    else:
        checks["proc_boot_changed"] = before["proc_boot_id"] != after["proc_boot_id"]
        checks["proc_boot_time_in_window"] = start < after["proc_btime"] * 1_000_000_000 <= end
        checks["journal_new_boot"] = any(row["boot_id"] == boot_id and start < row["first_entry"] * 1000 <= end for row in boots)
    physical = after["host"]["virtualization"] == "none" and after["host"]["virtualization_exit"] == 1
    return {"status": "pass" if all(checks.values()) else "fail", "kind": before["kind"], "checks": checks,
            "deltas_ns": values, "replays": replays, "sleep_intervals_seconds": intervals,
            "monotonic_excluded_seconds": excluded if before["kind"] == "suspend" else None,
            "selected_events": selected, "scope": "this physical Linux host" if physical else "this Linux guest only",
            "physical_host_coverage": physical}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("phase", choices=("before", "after"))
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--node", type=Path)
    parser.add_argument("--kind", choices=("suspend", "reboot"))
    parser.add_argument("--action-confirmed", action="store_true")
    args = parser.parse_args()
    if sys.platform != "linux":
        parser.error("Linux required; the collector never initiates a power action")
    output = args.output.resolve()
    if args.phase == "before":
        if not args.kind or not args.node or not args.node.is_absolute():
            parser.error("before requires --kind and absolute --node")
        node = args.node.resolve(strict=True)
        if sys.version.split()[0] != "3.14.4" or command([str(node), "--version"]) != "v24.21.0":
            parser.error("Use locked Python 3.14.4 and Node 24.21.0")
        output.mkdir(mode=0o700)
        snapshot = capture(node)
        snapshot.update(kind=args.kind, node_executable=str(node), reference_commit=REFERENCE)
        write(output / "before.json", snapshot)
        collect_events(output, "before")
        print(f"Captured {args.kind} before snapshot; no power action performed: {output}")
        return 0
    before = json.loads((output / "before.json").read_text())
    if before["source_hashes"] != sources():
        raise RuntimeError("Source bytes changed since before capture")
    node = Path(before["node_executable"])
    after = capture(node)
    write(output / "after.json", after)
    commands = collect_events(output, "after")
    a, b = Sample.load(before["python"]), Sample.load(after["python"])
    replays = {"python": {"delta_ns": delta(a, b), "trusted": StatusTimer.start(a).trusted_sample(b)},
               "node": node_replay(node, before["node"], after["node"])}
    kernel = [json.loads(line) for line in (output / "after-kernel.log").read_text().splitlines() if line.strip()]
    boots = json.loads((output / "after-boots.log").read_text() or "[]")
    report = evaluate(before, after, kernel, boots, replays, args.action_confirmed, commands)
    report["reference_commit"] = REFERENCE
    report["artifacts"] = {path.name: digest(path) for path in sorted(output.iterdir()) if path.is_file()}
    write(output / "evidence.json", report)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return int(report["status"] != "pass")


if __name__ == "__main__":
    raise SystemExit(main())
