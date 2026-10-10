"""Compare immutable sources with the same harness in alternating local rounds."""

from __future__ import annotations
import argparse
from contextlib import ExitStack
import hashlib
import json
import os
from pathlib import Path
import statistics
import shutil
import subprocess
import sys
import zipfile

ROOT = Path(__file__).resolve().parents[1]


def run_pair(commands, order, logs, environment):
    """Alternate whole sample batches while the other source waits at a barrier.

    Wait for each next barrier (including untimed fixture setup) before releasing
    the other worker, so neither setup nor measurements overlap across sources.
    """
    workers = {}
    with ExitStack() as stack:
        try:
            for side in order:
                log = stack.enter_context(logs[side].open("w", encoding="utf-8"))
                process = subprocess.Popen(
                    commands[side],
                    cwd=ROOT,
                    env=dict(environment, CLAUDE_STATUSLINE_BENCHMARK_CASE_SYNC="1"),
                    stdin=subprocess.PIPE,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    text=True,
                    encoding="utf-8",
                )
                workers[side] = process, log

            def ready(side):
                process, log = workers[side]
                for line in process.stdout:
                    log.write(line)
                    if line.strip() == "@@statusline-benchmark-ready@@":
                        log.flush()
                        return True
                if process.wait() != 0:
                    raise RuntimeError(f"Benchmark worker failed; inspect {logs[side]}")
                return False

            pending = {side: ready(side) for side in order}
            batches = 0
            while any(pending.values()):
                if not all(pending.values()):
                    raise RuntimeError("Sources produced different benchmark cases")
                for side in order:
                    process, _ = workers[side]
                    process.stdin.write("run\n")
                    process.stdin.flush()
                    pending[side] = ready(side)
                batches += 1
            return batches
        finally:
            for process, _ in workers.values():
                if process.poll() is None:
                    process.terminate()
                process.wait()
                process.stdin.close()
                process.stdout.close()


def summarize(reports):
    result = {}
    for mode in ("warm", "cold"):
        baseline = [r for r in reports if r["side"] == "baseline" and r["mode"] == mode]
        candidate = [
            r for r in reports if r["side"] == "candidate" and r["mode"] == mode
        ]
        if not baseline or len(baseline) != len(candidate):
            continue
        metrics = {}
        for key in baseline[0]["report"]["metrics"]:
            before = [r["report"]["metrics"][key] for r in baseline]
            after = [r["report"]["metrics"][key] for r in candidate]
            b50 = [v["p50_ms"] for v in before]
            a50 = [v["p50_ms"] for v in after]
            b95 = [v["p95_ms"] for v in before]
            a95 = [v["p95_ms"] for v in after]
            delta = statistics.median(a50) - statistics.median(b50)
            tail_delta = statistics.median(a95) - statistics.median(b95)
            noise = max(b50) - min(b50)
            tail_noise = max(b95) - min(b95)
            regression = len(before) >= 3 and (
                all(a > b for a, b in zip(a50, b50))
                and delta > max(noise, 0.0001)
                or all(a > b for a, b in zip(a95, b95))
                and tail_delta > max(tail_noise, 0.0001)
            )
            metrics[key] = {
                "baseline_p50_ms": statistics.median(b50),
                "candidate_p50_ms": statistics.median(a50),
                "baseline_p95_ms": statistics.median(b95),
                "candidate_p95_ms": statistics.median(a95),
                "p50_delta_ms": delta,
                "baseline_p50_round_range_ms": noise,
                "p95_delta_ms": tail_delta,
                "baseline_p95_round_range_ms": tail_noise,
                "rounds": len(before),
                "review_regression": regression,
            }
        result[mode] = metrics
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--baseline", required=True)
    parser.add_argument("--candidate", default="HEAD")
    parser.add_argument("--report-dir", required=True, type=Path)
    parser.add_argument("--samples", type=int, default=50)
    parser.add_argument("--rounds", type=int, default=3)
    parser.add_argument(
        "--profiles",
        nargs="+",
        choices=("small", "medium", "large"),
        default=["small", "medium", "large"],
    )
    parser.add_argument(
        "--modes", nargs="+", choices=("warm", "cold"), default=["warm", "cold"]
    )
    args = parser.parse_args()
    if not 5 <= args.samples <= 1000 or not 1 <= args.rounds <= 10:
        parser.error("Use 5–1000 samples and 1–10 rounds")
    root = args.report_dir.resolve()
    if root.exists():
        parser.error("Use a new report directory")
    root.mkdir(parents=True)
    refs, receipts = {}, {}
    harness = root / "harness"
    (harness / "benchmarking").mkdir(parents=True)
    harness_hashes = {}
    for relative in (
        "benchmark_compare.py",
        "benchmark_render.py",
        "benchmarking/__init__.py",
        "benchmarking/render.py",
        "benchmarking/source.py",
    ):
        original = ROOT / "tools" / relative
        shutil.copyfile(original, harness / relative)
        harness_hashes[relative] = hashlib.sha256(original.read_bytes()).hexdigest()
    for side, ref in (("baseline", args.baseline), ("candidate", args.candidate)):
        commit = subprocess.check_output(
            ["git", "rev-parse", "--verify", "--end-of-options", ref + "^{commit}"],
            cwd=ROOT,
            text=True,
        ).strip()
        archive = root / f"{side}.zip"
        subprocess.run(
            ["git", "archive", "--format=zip", "--output=" + str(archive), commit],
            cwd=ROOT,
            check=True,
        )
        source = root / side
        with zipfile.ZipFile(archive) as files:
            for name in files.namelist():
                if Path(name).is_absolute() or ".." in Path(name).parts:
                    raise ValueError("Unsafe archive member")
            files.extractall(source)
        refs[side] = commit
        receipts[side] = {
            "commit": commit,
            "archive_sha256": hashlib.sha256(archive.read_bytes()).hexdigest(),
        }
    reports = []
    environment = dict(
        os.environ,
        PYTHONDONTWRITEBYTECODE="1",
        CLAUDE_STATUSLINE_BENCHMARK_REPO=str(ROOT),
    )
    for round_ in range(args.rounds):
        for mode in args.modes:
            order = (
                ("baseline", "candidate")
                if round_ % 2 == 0
                else ("candidate", "baseline")
            )
            commands, paths, logs = {}, {}, {}
            for side in order:
                name = f"round-{round_ + 1}-{mode}-{side}"
                paths[side] = root / (name + ".json")
                logs[side] = root / (name + ".log")
                commands[side] = [
                    sys.executable,
                    str(harness / "benchmark_render.py"),
                    "--suite",
                    "representative",
                    "--samples",
                    str(args.samples),
                    "--bytecode-mode",
                    mode,
                    "--source-root",
                    str(root / side),
                    "--source-commit",
                    refs[side],
                    "--report",
                    str(paths[side]),
                    "--profiles",
                    *args.profiles,
                ]
            batches = run_pair(commands, order, logs, environment)
            pair = {
                side: json.loads(paths[side].read_text(encoding="utf-8"))
                for side in order
            }
            expected_keys = list(pair[order[0]]["metrics"])
            if batches != len(expected_keys) or any(
                list(report["metrics"]) != expected_keys for report in pair.values()
            ):
                raise RuntimeError("Measured case order differs across sources")
            for side in order:
                report = pair[side]
                reports.append(
                    {"round": round_ + 1, "side": side, "mode": mode, "report": report}
                )
                result = {
                    "sources": receipts,
                    "harness_sha256": harness_hashes,
                    "completed_runs": len(reports),
                    "expected_runs": args.rounds * len(args.modes) * 2,
                    "samples_per_case": args.samples,
                    "sampling_order": "case-interleaved; one timed batch at a time; peer waits through following setup",
                    "summary": summarize(reports),
                }
                (root / "comparison.json").write_text(
                    json.dumps(result, indent=2) + "\n", encoding="utf-8"
                )
                print(
                    f"Completed round-{round_ + 1}-{mode}-{side} ({len(reports)}/{result['expected_runs']})",
                    flush=True,
                )
    print(f"Comparison saved to {root / 'comparison.json'}", flush=True)


if __name__ == "__main__":
    main()
