"""Measure startup, Git and transcript refreshes using isolated local fixtures."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import platform
import statistics
import subprocess
import sys
import tempfile
import time


def measure(action, samples):
    values = []
    for _ in range(samples):
        started = time.perf_counter_ns()
        action()
        values.append((time.perf_counter_ns() - started) / 1_000_000)
    ordered = sorted(values)
    return {
        "samples": samples,
        "p50_ms": round(statistics.median(values), 4),
        "p95_ms": round(ordered[math.ceil(samples * 0.95) - 1], 4),
    }


def benchmark(samples, bytecode_mode):
    with tempfile.TemporaryDirectory(prefix="statusline-benchmark-") as directory:
        root = Path(directory)
        os.environ["CLAUDE_CONFIG_DIR"] = str(root / "config")
        os.environ["CLAUDE_STATUSLINE_RUNTIME_DIR"] = str(root / "runtime")
        os.environ["PYTHONDONTWRITEBYTECODE"] = "1"
        os.environ["PYTHONPYCACHEPREFIX"] = str(root / "bytecode")
        from claude_statusline.config.display import DEFAULT_CONFIG
        from claude_statusline.runtime import git, usage

        config = root / "config"
        config.mkdir()
        (config / "claude-statusline.json").write_text(
            json.dumps(
                DEFAULT_CONFIG.with_updates(items=("model-with-effort",)).to_dict()
            ),
            encoding="utf-8",
        )
        project = root / "project"
        subprocess.run(["git", "init", "-q", str(project)], check=True)
        (project / "example.txt").write_text("local fixture\n", encoding="utf-8")
        transcript = root / "transcript.jsonl"
        transcript.write_text(
            json.dumps(
                {
                    "type": "assistant",
                    "message": {
                        "id": "benchmark-response",
                        "usage": {
                            "input_tokens": 1200,
                            "output_tokens": 250,
                            "cache_creation_input_tokens": 3000,
                            "cache_read_input_tokens": 5000,
                        },
                    },
                }
            )
            + "\n",
            encoding="utf-8",
        )
        cold_index = 0

        def cold_usage():
            nonlocal cold_index
            cold_index += 1
            usage.session_token_totals(
                {
                    "session_id": f"cold-{cold_index}",
                    "transcript_path": str(transcript),
                }
            )

        warm_data = {"session_id": "warm", "transcript_path": str(transcript)}
        usage.session_token_totals(warm_data)
        git.git_status(str(project), "warm")
        payload = json.dumps({"model": {"id": "benchmark-model"}})

        def render():
            subprocess.run(
                [sys.executable, "-m", "claude_statusline", "render"],
                input=payload,
                text=True,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.PIPE,
                check=True,
            )

        if bytecode_mode == "warm":
            warm_env = dict(os.environ)
            warm_env.pop("PYTHONDONTWRITEBYTECODE", None)
            subprocess.run(
                [sys.executable, "-m", "claude_statusline", "render"],
                input=payload,
                text=True,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.PIPE,
                env=warm_env,
                check=True,
            )

        result = {
            "python_startup": measure(
                lambda: subprocess.run(
                    [sys.executable, "-c", "pass"],
                    check=True,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.PIPE,
                ),
                samples,
            ),
            "official_render_process": measure(render, samples),
            "git_cold": measure(
                lambda: git._uncached_git_status(str(project)), samples
            ),
            "transcript_cold": measure(cold_usage, samples),
            "transcript_warm": measure(
                lambda: usage.session_token_totals(warm_data), samples
            ),
        }
        git.git_status(str(project), "warm")
        result["git_warm"] = measure(
            lambda: git.git_status(str(project), "warm"), samples
        )
        return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--samples", type=int, default=30)
    parser.add_argument("--report", type=Path, required=True)
    parser.add_argument("--bytecode-mode", choices=("warm", "cold"), default="warm")
    args = parser.parse_args()
    if not 5 <= args.samples <= 1000:
        parser.error("samples must be between 5 and 1000")
    commit = subprocess.run(
        ["git", "rev-parse", "HEAD"],
        capture_output=True,
        text=True,
        check=True,
    ).stdout.strip()
    report = {
        "commit": commit,
        "python": platform.python_version(),
        "platform": platform.platform(),
        "metrics": benchmark(args.samples, args.bytecode_mode),
        "bytecode_mode": args.bytecode_mode,
        "benchmark_sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        "fixtures": "isolated local Git repository and one assistant response; no model calls",
    }
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
