"""Measure startup, Git and transcript refreshes using isolated local fixtures."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import platform
import re
import statistics
import subprocess
import sys
import tempfile
import time


def measure(action, samples, *, prepare=None, cleanup=None):
    if os.environ.get("CLAUDE_STATUSLINE_BENCHMARK_CASE_SYNC") == "1":
        print("@@statusline-benchmark-ready@@", flush=True)
        if sys.stdin.readline().strip() != "run":
            raise RuntimeError("Benchmark comparison controller disconnected")
    values = []
    for _ in range(samples):
        if prepare is not None:
            prepare()
        started = time.perf_counter_ns()
        try:
            action()
            values.append((time.perf_counter_ns() - started) / 1_000_000)
        finally:
            if cleanup is not None:
                cleanup()
    ordered = sorted(values)
    return {
        "samples": samples,
        "raw_ms": values,
        "p50_ms": round(statistics.median(values), 4),
        "p95_ms": round(ordered[math.ceil(samples * 0.95) - 1], 4),
    }


def benchmark(samples, bytecode_mode, display_case="legacy", language="en"):
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
        selected = DEFAULT_CONFIG.with_updates(items=("model-with-effort",))
        if display_case != "legacy":
            from claude_statusline.config import formatting

            selected = selected.with_updates(
                items=(
                    "model-with-effort",
                    "current-dir",
                    "context-used",
                    "context-tokens",
                    "session-cost",
                ),
                formatting=formatting.Formatting(
                    model_name="short",
                    number_format="grouped",
                    icons="ascii",
                    thresholds=formatting.Thresholds(True),
                ),
                item_options={
                    "current-dir": formatting.ItemOptions(max_width=24, priority=20)
                },
                layout=formatting.Layout(
                    "explicit",
                    (
                        ("model-with-effort", "current-dir"),
                        ("context-used", "context-tokens", "session-cost"),
                    ),
                )
                if display_case == "explicit"
                else formatting.Layout(),
            )
        if hasattr(selected, "statusline_language"):
            selected = selected.with_updates(statusline_language=language)
        elif language != "en":
            raise ValueError("This baseline does not support Chinese statusline output")
        (config / "claude-statusline.json").write_text(
            json.dumps(selected.to_dict()), encoding="utf-8"
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
        payload = json.dumps(
            {
                "model": {"id": "claude-sonnet-4-6"},
                "workspace": {"current_dir": str(project)},
                "context_window": {
                    "used_percentage": 85,
                    "context_window_size": 200000,
                    "current_usage": {"input_tokens": 140000, "output_tokens": 10000},
                },
                "cost": {"total_cost_usd": 1234.56},
            }
        )

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
    parser.add_argument("--language", choices=("en", "zh-CN"), default="en")
    parser.add_argument("--report", type=Path, required=True)
    parser.add_argument("--bytecode-mode", choices=("warm", "cold"), default="warm")
    parser.add_argument(
        "--display-case", choices=("legacy", "formatted", "explicit"), default="legacy"
    )
    parser.add_argument(
        "--suite", choices=("legacy", "representative", "appearance"), default="legacy"
    )
    parser.add_argument(
        "--profiles",
        nargs="+",
        choices=("small", "medium", "large"),
        default=["small", "medium", "large"],
    )
    parser.add_argument(
        "--source-root", type=Path, help="Immutable exported source tree"
    )
    parser.add_argument("--source-commit", help="Exact commit of the exported source")
    args = parser.parse_args()
    if bool(args.source_root) != bool(args.source_commit):
        parser.error("--source-root and --source-commit must be supplied together")
    if args.source_commit and not re.fullmatch(r"[0-9a-f]{40}", args.source_commit):
        parser.error("--source-commit must be an exact lowercase Git SHA")
    if args.source_root:
        args.source_root = args.source_root.resolve()
        sys.path.insert(0, str(args.source_root / "src"))
        os.environ["PYTHONPATH"] = str(args.source_root / "src")
    from benchmarking.source import identity

    source_root = args.source_root or Path.cwd()
    source_digest = identity(source_root, args.source_commit)
    if not 5 <= args.samples <= 1000:
        parser.error("samples must be between 5 and 1000")
    commit = (
        args.source_commit
        or subprocess.run(
            ["git", "rev-parse", "HEAD"],
            capture_output=True,
            text=True,
            check=True,
        ).stdout.strip()
    )
    if args.suite == "appearance":
        from benchmarking.appearance import run

        results = run(args.samples, args.bytecode_mode, measure)
    elif args.suite == "representative":
        from benchmarking.render import run

        results = run(args.samples, args.bytecode_mode, args.profiles, measure)
    else:
        results = {
            "metrics": benchmark(
                args.samples, args.bytecode_mode, args.display_case, args.language
            )
        }
    if identity(source_root) != source_digest:
        raise RuntimeError("Benchmark source changed during measurement")
    report = {
        "commit": commit,
        "source_tree_sha256": source_digest,
        "immutable_source_verified": bool(args.source_commit),
        "python": platform.python_version(),
        "platform": platform.platform(),
        **results,
        "suite": args.suite,
        "display_case": "matrix"
        if args.suite in ("representative", "appearance")
        else args.display_case,
        "statusline_language": ["en", "zh-CN"]
        if args.suite in ("representative", "appearance")
        else args.language,
        "working_tree_dirty": False
        if args.source_commit
        else bool(
            subprocess.check_output(["git", "status", "--porcelain"], text=True).strip()
        ),
        "bytecode_mode": args.bytecode_mode,
        "benchmark_sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        "fixtures": "isolated synthetic local files; no model calls",
        "fixture_source_sha256": hashlib.sha256(
            (Path(__file__).parent / ("benchmarking/appearance.py" if args.suite == "appearance" else "benchmarking/render.py")).read_bytes()
        ).hexdigest(),
    }
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
