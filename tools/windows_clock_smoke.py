"""Capture and verify human-operated Windows sleep/reboot clock evidence.

Run `before --kind suspend|reboot --output NEW_DIR --node ABS_NODE`, perform the
physical action, then `after --output SAME_DIR --human-confirmed`. This tool
never initiates a power action and never changes the immutable TS-01 oracle.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
PACKAGE = ROOT / "tools/migration/ts-02"
sys.path.insert(0, str(ROOT / "src"))
from claude_statusline.platforms.clocks import now_clocks
from claude_statusline.platforms.processes import process_start_token
from claude_statusline.runtime.timing.clock import Sample, StatusTimer, delta


def stamp():
    return datetime.now(timezone.utc).isoformat()


def read(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def write(path, value):
    with path.open("x", encoding="utf-8", newline="\n") as stream:
        stream.write(json.dumps(value, ensure_ascii=False, indent=2) + "\n")


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def sources():
    names = [
        "tools/windows_clock_smoke.py", "src/claude_statusline/platforms/clocks.py",
        "src/claude_statusline/platforms/environment.py", "src/claude_statusline/platforms/processes.py",
        "src/claude_statusline/runtime/timing/clock.py",
    ]
    for name in ("package-lock.json", "runtime-lock.json", "policy.json"):
        names.append("tools/migration/ts-02/" + name)
    for name in ("cli", "clocks", "native", "json"):
        names.extend(f"tools/migration/ts-02/{folder}/{name}.{extension}"
                     for folder, extension in (("src", "ts"), ("dist", "js")))
    return {name: digest(ROOT / name) for name in names}


def capture(node):
    wall, boot, domain = now_clocks()
    python = dict(wall_ns=wall, boot_ns=boot, boot_id=domain, token=process_start_token(os.getpid()))
    candidate = json.loads(subprocess.check_output(
        [str(node), str(PACKAGE / "dist/cli.js"), "clock", str(os.getpid())],
        encoding="utf-8", timeout=20,
    ))
    if not domain or not domain.startswith("windows:v2:") or boot is None:
        raise RuntimeError("Fixed Windows boot identity is unavailable")
    if candidate["boot_id"] != domain or candidate["token"] != python["token"]:
        raise RuntimeError("Python/TS native identity mismatch")
    return dict(captured_utc=stamp(), python=python, node=candidate,
                source_hashes=sources(), python_version=sys.version.split()[0],
                node_version=subprocess.check_output([str(node), "--version"], text=True).strip(),
                node_sha256=digest(node))


def power_events(start):
    # Parse the unmodified ISO string in PowerShell. Event XML preserves UTC;
    # this avoids locale and ConvertFrom-Json date coercion in TimeCreated.
    script = r"""
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
$since = [datetime]::Parse([Console]::In.ReadLine(), [Globalization.CultureInfo]::InvariantCulture, [Globalization.DateTimeStyles]::RoundtripKind)
$providers = @('Microsoft-Windows-Kernel-Power','Microsoft-Windows-Kernel-General','Microsoft-Windows-Kernel-Boot')
try { $events = @(Get-WinEvent -FilterHashtable @{LogName='System'; StartTime=$since; Id=@(12,13,27,42,107,506,507)} -ErrorAction Stop) }
catch { if ($_.FullyQualifiedErrorId -like 'NoMatchingEventsFound*') { $events=@() } else { throw } }
$result = @($events | Where-Object { $_.ProviderName -in $providers } | ForEach-Object {
  [xml]$xml = $_.ToXml()
  $data = @{}
  foreach ($entry in $xml.Event.EventData.Data) { if ($entry.Name -eq 'BootType') { $data[$entry.Name] = $entry.'#text' } }
  [ordered]@{time_utc=[string]$xml.Event.System.TimeCreated.SystemTime; id=$_.Id; provider=$_.ProviderName; data=$data}
})
ConvertTo-Json -InputObject $result -Depth 5 -Compress
"""
    executable = Path(os.environ["SystemRoot"]) / "System32/WindowsPowerShell/v1.0/powershell.exe"
    return json.loads(subprocess.check_output(
        [str(executable), "-NoProfile", "-Command", script], input=start + "\n",
        encoding="utf-8", timeout=30,
    ))


def node_replay(node, before, after):
    script = """
const { readFileSync } = await import('node:fs');
const { pathToFileURL } = await import('node:url');
const { decode, integer } = await import(pathToFileURL(process.argv[1] + '/dist/json.js'));
const { delta, trusted } = await import(pathToFileURL(process.argv[1] + '/dist/clocks.js'));
const [a,b] = decode(readFileSync(0, 'utf8')).map(x => ({wall_ns:integer(x.wall_ns), boot_ns:integer(x.boot_ns), boot_id:x.boot_id}));
console.log(JSON.stringify({delta_ns:delta(a,b)?.toString() ?? null, trusted:trusted(a,b)}));
"""
    value = json.loads(subprocess.check_output(
        [str(node), "--input-type=module", "-e", script, str(PACKAGE)],
        input=json.dumps([before, after]), encoding="utf-8", timeout=20,
    ))
    if value["delta_ns"] is not None:
        value["delta_ns"] = int(value["delta_ns"])
    return value


def verify(before, after, events, node, human):
    def instant(value):
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    events = sorted((e for e in events if instant(before["captured_utc"]) <= instant(e["time_utc"]) <= instant(after["captured_utc"])), key=lambda e: e["time_utc"])
    checks = dict(human_confirmed=human, source_unchanged=before["source_hashes"] == after["source_hashes"], runtime_unchanged=before["node_sha256"] == after["node_sha256"] and before["python_version"] == after["python_version"])
    values = {side: {clock:after[side][clock] - before[side][clock] for clock in ("wall_ns", "boot_ns")} for side in ("python", "node")}
    p_start, p_end = Sample.load(before["python"]), Sample.load(after["python"])
    replays = dict(python=dict(delta_ns=delta(p_start,p_end), trusted=StatusTimer.start(p_start).trusted_sample(p_end)), node=node_replay(node,before["node"],after["node"]))
    intervals, entered = [], None
    for event in events:
        if event["provider"] != "Microsoft-Windows-Kernel-Power":
            continue
        if event["id"] in (42,506):
            entered = event
        elif event["id"] in (107,507) and entered:
            intervals.append((instant(event["time_utc"]) - instant(entered["time_utc"])).total_seconds())
            entered = None
    for side in ("python", "node"):
        same = before[side]["boot_id"] == after[side]["boot_id"]
        if before["kind"] == "suspend":
            checks[side + "_stable_boot"] = same
            checks[side + "_includes_sleep"] = values[side]["boot_ns"] > 0 and abs(values[side]["boot_ns"] - values[side]["wall_ns"]) < 2_000_000_000
            checks[side + "_trusted_elapsed"] = replays[side]["trusted"] and replays[side]["delta_ns"] == values[side]["boot_ns"]
        else:
            checks[side + "_new_boot"] = not same
            checks[side + "_changed_sequence"] = before[side]["boot_id"].rsplit(":",1)[-1] != after[side]["boot_id"].rsplit(":",1)[-1]
            expected = values[side]["wall_ns"] if values[side]["wall_ns"] >= 0 else None
            checks[side + "_degraded_wall_fallback"] = not replays[side]["trusted"] and replays[side]["delta_ns"] == expected
    checks["physical_event"] = any(seconds >= 30 for seconds in intervals) if before["kind"] == "suspend" else any(e["provider"] == "Microsoft-Windows-Kernel-General" and e["id"] == 12 for e in events)
    return dict(status="pass" if all(checks.values()) else "fail", kind=before["kind"], checked_utc=stamp(), checks=checks, deltas_ns=values, replays=replays, events=events, sleep_intervals_seconds=intervals, scope="This Windows host and observed sleep mode only; no other platform or power-loss claim")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("phase", choices=["before", "after"])
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--kind", choices=["suspend", "reboot"])
    parser.add_argument("--node", type=Path)
    parser.add_argument("--human-confirmed", action="store_true")
    args = parser.parse_args()
    if sys.platform != "win32":
        parser.error("Physical Windows host required")
    output = args.output.resolve()
    if args.phase == "before":
        if not args.node or not args.kind:
            parser.error("before requires --kind and --node")
        node = args.node.resolve(strict=True)
        output.mkdir()
        snapshot = capture(node)
        snapshot.update(kind=args.kind, node_executable=str(node), reference_commit="9b6d2fab4bf165be280d428a874521bfbf02c7e1")
        write(output / "before.json", snapshot)
        print(f"Saved before {args.kind}: {output}. Perform the physical action manually, then run after.")
        return 0
    before = read(output / "before.json")
    if sources() != before["source_hashes"]:
        raise RuntimeError("Sources changed after the before snapshot")
    node = Path(before["node_executable"])
    after = capture(node)
    write(output / "after.json", after)
    events = power_events(before["captured_utc"])
    write(output / "events.json", events)
    report = verify(before,after,events,node,args.human_confirmed)
    report["artifacts"] = {name:digest(output/name) for name in ("before.json","after.json","events.json")}
    write(output / "evidence.json", report)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return int(report["status"] != "pass")


if __name__ == "__main__":
    raise SystemExit(main())
