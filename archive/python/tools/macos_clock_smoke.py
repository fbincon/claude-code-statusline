"""Capture real macOS sleep/reboot evidence without initiating a power action.

Run before with --kind suspend|reboot, --node ABS_NODE and --output NEW_DIR.
After the human action, run after on that directory with --human-confirmed.
VM observations are explicitly scoped to the guest, never physical hardware.
"""
from __future__ import annotations

import argparse
import ctypes
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import platform
import re
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
PACKAGE = ROOT / "tools/migration/ts-02"
REFERENCE = "9b6d2fab4bf165be280d428a874521bfbf02c7e1"
sys.path.insert(0, str(ROOT / "src"))
from claude_statusline.platforms.clocks import now_clocks
from claude_statusline.runtime.timing.clock import Sample, StatusTimer, delta


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write(path, value):
    with path.open("x", encoding="utf-8", newline="\n") as stream:
        json.dump(value, stream, ensure_ascii=False, indent=2)
        stream.write("\n")


def command(argv, **kwargs):
    return subprocess.check_output(argv, text=True, timeout=60, **kwargs).strip()


def sources():
    names = ["tools/macos_clock_smoke.py", "src/claude_statusline/platforms/clocks.py",
             "src/claude_statusline/platforms/environment.py",
             "src/claude_statusline/platforms/processes.py",
             "src/claude_statusline/runtime/timing/clock.py"]
    names += [f"tools/migration/ts-02/{name}" for name in
              ("package-lock.json", "runtime-lock.json", "policy.json", "scripts/oracle.py")]
    names += [f"tools/migration/ts-02/{folder}/{name}.{extension}"
              for folder, extension in (("src", "ts"), ("dist", "js"))
              for name in ("cli", "clocks", "native", "json", "context")]
    return {name: digest(ROOT / name) for name in names}


def mach_diagnostic():
    class Timebase(ctypes.Structure):
        _fields_ = [("numer", ctypes.c_uint32), ("denom", ctypes.c_uint32)]
    lib = ctypes.CDLL("/usr/lib/libSystem.B.dylib")
    lib.mach_timebase_info.argtypes = [ctypes.POINTER(Timebase)]
    lib.mach_timebase_info.restype = ctypes.c_int
    tb = Timebase()
    if lib.mach_timebase_info(ctypes.byref(tb)) or not tb.numer or not tb.denom:
        raise RuntimeError("Mach timebase unavailable")
    values = {}
    for name in ("mach_absolute_time", "mach_continuous_time"):
        function = getattr(lib, name)
        function.argtypes = []
        function.restype = ctypes.c_uint64
        values[name + "_ns"] = function() * tb.numer // tb.denom
    return values


def capture(node):
    wall, boot, identity = now_clocks()
    python = dict(wall_ns=wall, boot_ns=boot, boot_id=identity)
    candidate = json.loads(command([str(node), str(PACKAGE / "dist/cli.js"), "clock", str(os.getpid())]))
    script = "import {exportReference} from './tools/migration/ts-02/dist/context.js'; console.log(exportReference())"
    reference_root = Path(command([str(node), "--input-type=module", "-e", script], cwd=ROOT))
    try:
        oracle = json.loads(command([sys.executable, str(PACKAGE / "scripts/oracle.py"), "clock", str(os.getpid())],
                                    env=dict(os.environ, TS02_REFERENCE_ROOT=str(reference_root))))
    finally:
        shutil.rmtree(reference_root)
    if not identity or not identity.startswith("darwin:") or boot is None:
        raise RuntimeError("macOS continuous clock / boot UUID unavailable")
    if any(value["boot_id"] != identity for value in (candidate, oracle)):
        raise RuntimeError("Current Python, immutable reference and Node boot identities differ")
    virtual = subprocess.run(["/usr/sbin/sysctl", "-n", "kern.hv_vmm_present"], capture_output=True, text=True)
    translated = subprocess.run(["/usr/sbin/sysctl", "-n", "sysctl.proc_translated"], capture_output=True, text=True)
    return dict(captured_utc=datetime.fromtimestamp(wall / 1e9, timezone.utc).isoformat(),
                python=python, node=candidate, reference=oracle, mach=mach_diagnostic(),
                source_hashes=sources(), commit=command(["git", "rev-parse", "HEAD"], cwd=ROOT),
                dirty=bool(command(["git", "status", "--porcelain=v1"], cwd=ROOT)),
                runtimes={"python": sys.version.split()[0], "python_sha256": digest(Path(sys.executable).resolve()),
                          "node": command([str(node), "--version"]), "node_sha256": digest(node)},
                host={"sw_vers": command(["/usr/bin/sw_vers"]), "machine": platform.machine(),
                      "hypervisor": virtual.stdout.strip(),
                      "rosetta_query": {"exit_code": translated.returncode, "stdout": translated.stdout, "stderr": translated.stderr}},
                kern_boottime=command(["/usr/sbin/sysctl", "-n", "kern.boottime"]))


def collect_events(output, phase, start):
    # Keep command status and original bytes, including access failures. Event
    # collection is read-only; no assertion or power setting is changed.
    commands = {"pmset": ["/usr/bin/pmset", "-g", "log"],
                "last-reboot": ["/usr/bin/last", "reboot"],
                "power-capabilities": ["/usr/bin/pmset", "-g", "cap"],
                "unified": ["/usr/bin/log", "show", "--style", "json", "--start", start,
                            "--predicate", '(process == "powerd" OR process == "kernel" OR process == "loginwindow") AND (eventMessage CONTAINS[c] "sleep" OR eventMessage CONTAINS[c] "wake" OR eventMessage CONTAINS[c] "boot" OR eventMessage CONTAINS[c] "shutdown")']}
    records = {}
    for name, argv in commands.items():
        try:
            result = subprocess.run(argv, capture_output=True, timeout=60,
                                    env=dict(os.environ, LC_ALL="C", TZ="UTC"))
            stdout, stderr, code = result.stdout, result.stderr, result.returncode
        except subprocess.TimeoutExpired as exc:
            stdout, stderr, code = exc.stdout or b"", exc.stderr or b"", 124
        for suffix, data in (("log", stdout), ("stderr", stderr)):
            with (output / f"{phase}-{name}.{suffix}").open("xb") as stream:
                stream.write(data)
        records[name] = {"command": argv, "exit_code": code}
    write(output / f"{phase}-commands.json", records)
    return records


def sleep_intervals(text, start, end):
    events, intervals, entered = [], [], None
    pattern = r"^(\d{4}-\d\d-\d\d \d\d:\d\d:\d\d [+-]\d{4})\s+(Sleep|Wake|DarkWake)\s+(.+)$"
    for line in text.splitlines():
        match = re.match(pattern, line)
        if not match:
            continue
        instant = datetime.strptime(match[1], "%Y-%m-%d %H:%M:%S %z").timestamp()
        if not start <= instant <= end:
            continue
        kind, message = match[2], match[3]
        if kind == "Sleep" and "Entering Sleep" in message:
            entered = instant
            events.append(line)
        elif kind in ("Wake", "DarkWake") and re.search(r"\b(?:Dark)?Wake from\b", message) and entered is not None:
            intervals.append(instant - entered)
            events.append(line)
            entered = None
    return intervals, events


def reboot_event(text, boot_seconds, start, end):
    if not start < boot_seconds <= end:
        return False
    # last(1) on this target exposes minute precision; kern.boottime supplies
    # the seconds and year. Both independently captured sources must agree.
    expected = datetime.fromtimestamp(boot_seconds, timezone.utc).strftime("%a %b %d %H:%M")
    return any(re.sub(r"\s+", " ", line.strip()) == "reboot time " + re.sub(r"\s+", " ", expected)
               for line in text.splitlines())


def node_replay(node, before, after):
    script = """
const {readFileSync} = await import('node:fs');
const {decode,integer} = await import('./tools/migration/ts-02/dist/json.js');
const {delta,trusted} = await import('./tools/migration/ts-02/dist/clocks.js');
const [a,b]=decode(readFileSync(0,'utf8')).map(x=>({wall_ns:integer(x.wall_ns),boot_ns:integer(x.boot_ns),boot_id:x.boot_id}));
console.log(JSON.stringify({delta_ns:delta(a,b)?.toString() ?? null,trusted:trusted(a,b)}));
"""
    value = json.loads(command([str(node), "--input-type=module", "-e", script], cwd=ROOT,
                               input=json.dumps([before, after])))
    if value["delta_ns"] is not None:
        value["delta_ns"] = int(value["delta_ns"])
    return value


def evaluate(before, after, pmset, last, replay, human, event_commands):
    checks = {"human_confirmed": human, "source_unchanged": before["source_hashes"] == after["source_hashes"],
              "runtime_unchanged": before["runtimes"] == after["runtimes"],
              "event_collection_ok": all(event_commands[name]["exit_code"] == 0 for name in ("pmset", "last-reboot"))}
    start, end = before["python"]["wall_ns"] / 1e9, after["python"]["wall_ns"] / 1e9
    intervals, events = sleep_intervals(pmset, start, end)
    values = {side: {clock: after[side][clock] - before[side][clock] for clock in ("wall_ns", "boot_ns")}
              for side in ("python", "node", "reference")}
    for side, value in values.items():
        same = before[side]["boot_id"] == after[side]["boot_id"]
        if before["kind"] == "suspend":
            checks[side + "_stable_boot"] = same
            checks[side + "_includes_sleep"] = value["boot_ns"] > 0 and abs(value["boot_ns"] - value["wall_ns"]) < 2_000_000_000
        else:
            checks[side + "_new_boot"] = not same
        if side in replay:
            elapsed = value["boot_ns"] if before["kind"] == "suspend" else value["wall_ns"]
            expected = elapsed if elapsed >= 0 else None
            checks[side + "_elapsed"] = replay[side]["delta_ns"] == expected and replay[side]["trusted"] == (before["kind"] == "suspend")
    paused = (after["mach"]["mach_continuous_time_ns"] - before["mach"]["mach_continuous_time_ns"]
              - after["mach"]["mach_absolute_time_ns"] + before["mach"]["mach_absolute_time_ns"]) / 1e9
    if before["kind"] == "suspend":
        checks["system_sleep_wake_event"] = any(seconds >= 30 for seconds in intervals)
        checks["absolute_clock_excluded_sleep"] = paused >= 28
    else:
        match = re.search(r"sec\s*=\s*(\d+)", after["kern_boottime"])
        checks["system_reboot_event"] = bool(match and reboot_event(last, int(match[1]), start, end))
    virtual = after["host"]["hypervisor"] == "1"
    return {"status": "pass" if all(checks.values()) else "fail", "kind": before["kind"], "checks": checks,
            "deltas_ns": values, "replays": replay, "sleep_intervals_seconds": intervals,
            "mach_sleep_seconds": paused if before["kind"] == "suspend" else None,
            "selected_events": events, "scope": "macOS virtual guest only" if virtual else "this macOS host only",
            "physical_host_coverage": False if virtual else None}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("phase", choices=("before", "after"))
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--node", type=Path)
    parser.add_argument("--kind", choices=("suspend", "reboot"))
    parser.add_argument("--human-confirmed", action="store_true")
    args = parser.parse_args()
    if sys.platform != "darwin":
        parser.error("macOS required; this tool does not initiate power actions")
    output = args.output.resolve()
    if args.phase == "before":
        if not args.kind or not args.node or not args.node.is_absolute():
            parser.error("before requires --kind and an absolute --node")
        node = args.node.resolve(strict=True)
        if sys.version.split()[0] != "3.14.4" or command([str(node), "--version"]) != "v24.21.0":
            parser.error("Use Python 3.14.4 and Node 24.21.0")
        output.mkdir(mode=0o700)
        snapshot = capture(node)
        snapshot.update(kind=args.kind, node_executable=str(node), reference_commit=REFERENCE)
        write(output / "before.json", snapshot)
        since = datetime.fromtimestamp(snapshot["python"]["wall_ns"] / 1e9, timezone.utc).strftime("%Y-%m-%d %H:%M:%S+0000")
        collect_events(output, "before", since)
        print(f"Captured {args.kind} before snapshot: {output}. No power action was performed.")
        return 0
    before = json.loads((output / "before.json").read_text())
    if before["source_hashes"] != sources():
        raise RuntimeError("Source bytes changed since before capture")
    node = Path(before["node_executable"])
    after = capture(node)
    write(output / "after.json", after)
    since = datetime.fromtimestamp(before["python"]["wall_ns"] / 1e9, timezone.utc).strftime("%Y-%m-%d %H:%M:%S+0000")
    commands = collect_events(output, "after", since)
    a, b = Sample.load(before["python"]), Sample.load(after["python"])
    replay = {"python": {"delta_ns": delta(a, b), "trusted": StatusTimer.start(a).trusted_sample(b)},
              "node": node_replay(node, before["node"], after["node"])}
    report = evaluate(before, after, (output / "after-pmset.log").read_text(),
                      (output / "after-last-reboot.log").read_text(), replay, args.human_confirmed, commands)
    report["reference_commit"] = REFERENCE
    report["artifacts"] = {path.name: digest(path) for path in sorted(output.iterdir()) if path.is_file()}
    write(output / "evidence.json", report)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return int(report["status"] != "pass")


if __name__ == "__main__":
    raise SystemExit(main())
