"""Compare timer startup, incremental refresh and indexed endings on local fixtures."""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import platform
import subprocess
import sys
import tempfile
import time

from benchmark_render import measure


def benchmark(samples, sizes, counts):
    from claude_statusline.runtime import transcript, usage
    from claude_statusline.runtime.turns import model, reducer, store

    try:
        from claude_statusline.runtime.tasks.evidence import submission_time
    except ImportError:
        submission_time = None

    result = {}
    with tempfile.TemporaryDirectory(prefix="task-clock-benchmark-") as directory:
        root = Path(directory)
        store.RUNTIME_ROOT = str(root / "runtime")
        store.TURN_DIR = str(root / "runtime" / "turns")
        for size in sizes:
            for count in counts:
                path = root / f"history-{size}-{count}.jsonl"
                started_ns = time.time_ns() - 10_000_000_000
                stamp = datetime.fromtimestamp(
                    started_ns / 1e9, timezone.utc
                ).isoformat()
                filler = (
                    json.dumps(
                        {
                            "type": "system",
                            "subtype": "benchmark_history",
                            "padding": "x" * 100,
                        }
                    )
                    + "\n"
                )
                with path.open("w") as stream:
                    for _ in range(size):
                        stream.write(filler)
                    for i in range(count):
                        stream.write(
                            json.dumps(
                                {
                                    "type": "user",
                                    "promptId": f"p-{i}",
                                    "timestamp": stamp,
                                    "promptSource": "typed",
                                    "message": {
                                        "role": "user",
                                        "content": "timer benchmark",
                                    },
                                }
                            )
                            + "\n"
                        )
                prompt = f"p-{count - 1}"
                entry = {"files": {}, "ids": {}}
                initial = time.perf_counter_ns()
                usage._update_file(entry, str(path))
                cold_ms = (time.perf_counter_ns() - initial) / 1e6
                reads = []
                original = transcript._read_transcript_chunk

                def read(source, start):
                    reads.append(start)
                    return original(source, start)

                transcript._read_transcript_chunk = read
                try:
                    hot = measure(lambda: usage._update_file(entry, str(path)), samples)
                    assert not reads, (
                        "unchanged hot refresh must not read transcript data"
                    )
                    history = {
                        "schema": model.LIFECYCLE_SCHEMA,
                        "session_id": "fixture",
                        "current_prompt_id": prompt,
                        "turns": [
                            model._new_record(f"p-{i}", (started_ns, None, None))
                            for i in range(count)
                        ],
                    }

                    # Both versions verify an ending's submission through the same
                    # reducer entry. The new implementation reuses its cursor index.
                    def ending():
                        record = model._new_record(prompt, (started_ns, None, None))
                        reducer._refresh_start_evidence(
                            record, {"transcript_path": str(path)}, "hook_stop"
                        )
                        assert record["started_wall_ns"] <= started_ns

                    initial = time.perf_counter_ns()
                    ending()
                    index_cold = (time.perf_counter_ns() - initial) / 1e6
                    reads.clear()
                    terminal = measure(ending, samples)
                    if submission_time:
                        assert all(cursor == path.stat().st_size for cursor in reads), (
                            "indexed ending rescanned history"
                        )
                    lookup = measure(lambda: model._find_turn(history, prompt), samples)
                finally:
                    transcript._read_transcript_chunk = original
                result[f"{size}_rows_{count}_tasks"] = {
                    "bytes": path.stat().st_size,
                    "transcript_cold_ms": round(cold_ms, 4),
                    "submission_index_cold_ms": round(index_cold, 4),
                    "hot_refresh": hot,
                    "terminal_submission": terminal,
                    "task_lookup": lookup,
                    "hot_data_reads": 0,
                    "indexed_terminal": bool(submission_time),
                }
        env = dict(
            os.environ,
            CLAUDE_CONFIG_DIR=str(root / "config"),
            CLAUDE_STATUSLINE_RUNTIME_DIR=str(root / "runtime"),
        )

        def process(code):
            subprocess.run(
                [sys.executable, "-c", code],
                env=env,
                check=True,
                stdout=subprocess.DEVNULL,
            )

        process("from claude_statusline.rendering import main")
        result["python_startup"] = measure(lambda: process("pass"), samples)
        result["timer_import_startup"] = measure(
            lambda: process(
                "from claude_statusline.rendering import timer; from claude_statusline.runtime.turns import reducer"
            ),
            samples,
        )
        config = root / "config"
        config.mkdir()
        (config / "claude-statusline.json").write_text(
            json.dumps(
                {
                    "schema_version": 1,
                    "items": ["prompt-timer"],
                    "use_colors": False,
                    "palette": "default",
                    "directory_style": "full",
                    "separator_style": "classic",
                }
            )
        )
        state_path = Path(store._state_path("fixture"))
        state_path.parent.mkdir(parents=True, exist_ok=True)
        state_path.write_text(
            json.dumps(
                {
                    "schema": 1,
                    "session_id": "fixture",
                    "prompt_id": prompt,
                    "status": "completed",
                    "started_wall_ns": started_ns,
                    "ended_wall_ns": started_ns + 5 * 10**9,
                    "duration_ns": 5 * 10**9,
                    "updated_wall_ns": started_ns + 5 * 10**9,
                    "end_source": "hook_stop",
                }
            )
        )
        startup_transcript = root / "startup.jsonl"
        startup_transcript.write_text(
            json.dumps(
                {
                    "type": "user",
                    "promptId": prompt,
                    "timestamp": stamp,
                    "promptSource": "typed",
                    "message": {"role": "user", "content": "timer benchmark"},
                }
            )
            + "\n"
        )
        payload = json.dumps(
            {
                "session_id": "fixture",
                "prompt_id": prompt,
                "transcript_path": str(startup_transcript),
                "columns": 120,
            }
        )

        def render():
            completed = subprocess.run(
                [sys.executable, "-m", "claude_statusline", "render"],
                input=payload,
                env=env,
                text=True,
                capture_output=True,
                check=True,
            )
            assert "✓" in completed.stdout, (
                f"the timed startup must exercise the real task renderer: {completed.stdout!r}"
            )

        render()
        result["timer_render_process"] = measure(render, samples)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--samples", type=int, default=30)
    parser.add_argument("--sizes", type=int, nargs="+", default=[100, 10000, 100000])
    parser.add_argument("--tasks", type=int, nargs="+", default=[1, 32])
    parser.add_argument("--report", type=Path, required=True)
    args = parser.parse_args()
    if (
        not 5 <= args.samples <= 1000
        or any(n < 1 for n in args.sizes)
        or any(not 1 <= n <= 32 for n in args.tasks)
    ):
        parser.error("samples: 5–1000; sizes: positive; task counts: 1–32")
    report = {
        "python": platform.python_version(),
        "platform": platform.platform(),
        "source": os.environ.get("PYTHONPATH", "installed"),
        "benchmark_sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        "metrics": benchmark(args.samples, args.sizes, args.tasks),
    }
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
