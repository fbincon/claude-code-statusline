"""Representative local workloads, with fixture setup outside measured regions."""

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time
from unittest.mock import patch

PROFILES = {
    "small": (100, 0, 32),
    "medium": (10_000, 8, 1000),
    "large": (100_000, 32, 10_000),
}


def record(index, prefix="main"):
    return (
        json.dumps(
            {
                "type": "assistant",
                "message": {
                    "id": f"{prefix}-{index}",
                    "content": [{"type": "text", "text": "local fixture " * 8}],
                    "usage": {
                        "input_tokens": 12,
                        "output_tokens": 5,
                        "cache_creation_input_tokens": 3,
                        "cache_read_input_tokens": 7,
                    },
                },
            },
            separators=(",", ":"),
        )
        + "\n"
    )


def fixtures(root, rows, agents, files):
    transcript = root / "history.jsonl"
    transcript.write_text("".join(record(i) for i in range(rows)), encoding="utf-8")
    for agent in range(agents):
        directory = root / "history" / "subagents"
        if agent % 2:
            directory /= "nested"
        directory.mkdir(parents=True, exist_ok=True)
        (directory / f"agent-{agent}.jsonl").write_text(
            "".join(record(i, f"agent-{agent}") for i in range(100)), encoding="utf-8"
        )
    project = root / "project"
    subprocess.run(["git", "init", "-q", str(project)], check=True)
    for i in range(files):
        path = project / f"group-{i // 100}" / f"file-{i}.txt"
        path.parent.mkdir(exist_ok=True)
        path.write_text("tracked local benchmark fixture\n", encoding="utf-8")
    subprocess.run(["git", "-C", str(project), "add", "."], check=True)
    subprocess.run(
        [
            "git",
            "-C",
            str(project),
            "-c",
            "user.name=Benchmark",
            "-c",
            "user.email=benchmark@example.invalid",
            "-c",
            "commit.gpgsign=false",
            "-c",
            "core.hooksPath=" + str(root / "no-hooks"),
            "commit",
            "-qm",
            "Local fixture",
        ],
        check=True,
    )
    return transcript, project


def run(samples, bytecode_mode, profiles, measure):
    with tempfile.TemporaryDirectory(prefix="statusline-representative-") as temporary:
        root = Path(temporary)
        environment = {
            "CLAUDE_CONFIG_DIR": str(root / "config"),
            "CLAUDE_STATUSLINE_RUNTIME_DIR": str(root / "runtime"),
            "PYTHONDONTWRITEBYTECODE": "1",
            "PYTHONPYCACHEPREFIX": str(root / "bytecode"),
        }
        with patch.dict(os.environ, environment):
            return _run(root, samples, bytecode_mode, profiles, measure)


def _run(root, samples, bytecode_mode, profiles, measure):
    # Invoke in a fresh process: collectors bind their paths at first import.
    from claude_statusline.config import display, formatting
    from claude_statusline.runtime import git, usage, paths, transcript as reader
    from claude_statusline.rendering import subagents

    config_dir = root / "config"
    config_dir.mkdir()
    metrics, metadata = {}, {}

    def process(code=None, payload=None):
        command = (
            [sys.executable, "-c", code]
            if code is not None
            else [sys.executable, "-m", "claude_statusline", "render"]
        )
        return subprocess.run(
            command,
            input=payload,
            text=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
            check=True,
        )

    # Prime imports separately from collector/data cache setup.
    warm_env = dict(os.environ)
    if bytecode_mode == "warm":
        warm_env.pop("PYTHONDONTWRITEBYTECODE", None)
        subprocess.run(
            [
                sys.executable,
                "-c",
                "import claude_statusline.rendering.main; import claude_statusline.rendering.subagents",
            ],
            env=warm_env,
            check=True,
        )
    metrics["process/startup"] = measure(lambda: process("pass"), samples)
    metrics["process/render_import"] = measure(
        lambda: process("import claude_statusline.rendering.main"), samples
    )

    for profile in profiles:
        rows, count, files = PROFILES[profile]
        directory = root / profile
        directory.mkdir()
        history, project = fixtures(directory, rows, count, files)
        data = {"session_id": profile, "transcript_path": str(history)}
        metadata[profile] = {
            "history_rows": rows,
            "history_bytes": history.stat().st_size,
            "agent_count": count,
            "agent_rows_each": 100,
            "tracked_files": files,
            "history_sha256": hashlib.sha256(history.read_bytes()).hexdigest(),
        }

        def clear_state():
            Path(paths.STATEFILE).unlink(missing_ok=True)

        def collect():
            return usage.session_token_totals(data)

        metrics[f"{profile}/transcript/cold"] = measure(
            collect, samples, prepare=clear_state
        )
        collect()
        # Restore the exact primed cache, excluding re-priming from measured time.
        cache = Path(paths.STATEFILE).read_bytes()
        original = history.read_bytes()
        original_stat = history.stat()

        def restore_history():
            history.write_bytes(original)
            os.utime(history, ns=(original_stat.st_atime_ns, original_stat.st_mtime_ns))

        def reset_warm():
            Path(paths.STATEFILE).write_bytes(cache)

        metrics[f"{profile}/transcript/warm"] = measure(
            collect, samples, prepare=reset_warm
        )

        def append():
            reset_warm()
            with history.open("a", encoding="utf-8") as stream:
                stream.write(record(rows, "append"))

        metrics[f"{profile}/transcript/append"] = measure(
            collect, samples, prepare=append, cleanup=restore_history
        )
        reset_warm()
        with patch.object(
            reader, "_read_transcript_chunk", wraps=reader._read_transcript_chunk
        ) as read:
            collect()
            assert read.call_count == 0, (
                "Warm collector unexpectedly read transcript bytes"
            )

        for state in ("clean", "dirty"):
            if state == "dirty":
                (project / "group-0" / "file-0.txt").write_text(
                    "changed\n", encoding="utf-8"
                )
                (project / "untracked.txt").write_text("untracked\n", encoding="utf-8")
            session = f"{profile}-{state}"
            cache_path = Path(git._git_cache_path(session))
            action = lambda: git.git_status(str(project), session)
            metrics[f"{profile}/git/{state}/miss"] = measure(
                action, samples, prepare=lambda: cache_path.unlink(missing_ok=True)
            )
            value = git._uncached_git_status(str(project))

            def prime():
                git._write_git_cache(session, str(project), value)

            metrics[f"{profile}/git/{state}/hit"] = measure(
                action, samples, prepare=prime
            )

            def expire():
                prime()
                cached = json.loads(cache_path.read_text(encoding="utf-8"))
                cached["checked_ns"] = (
                    time.time_ns() - paths.GIT_CACHE_TTL_NS - 1_000_000_000
                )
                cache_path.write_text(json.dumps(cached), encoding="utf-8")

            metrics[f"{profile}/git/{state}/expired"] = measure(
                action, samples, prepare=expire
            )
            prime()
            with patch.object(
                git, "_uncached_git_status", wraps=git._uncached_git_status
            ) as uncached:
                action()
                assert uncached.call_count == 0, "Git cache hit launched a collector"

        items = ("model-with-effort", "current-dir", "context-used", "session-cost")
        for language in ("en", "zh-CN"):
            for case in ("ascii-auto", "unicode-explicit"):
                unicode = case.startswith("unicode")
                selected = display.DEFAULT_CONFIG.with_updates(
                    items=items,
                    statusline_language=language,
                    formatting=formatting.Formatting(
                        icons="ascii" if not unicode else "legacy"
                    ),
                    item_options={
                        "current-dir": formatting.ItemOptions(
                            label="目录 👩🏽‍💻 é 🇨🇳 1️⃣" if unicode else "Directory"
                        )
                    },
                    layout=formatting.Layout("explicit", (items[:2], items[2:]))
                    if unicode
                    else formatting.Layout(),
                )
                # Use the catalog's accepted default icon choice for Unicode.
                if unicode:
                    selected = selected.with_updates(formatting=formatting.Formatting())
                (config_dir / "claude-statusline.json").write_text(
                    json.dumps(selected.to_dict()), encoding="utf-8"
                )
                payload = json.dumps(
                    {
                        "model": {"id": "claude-sonnet-4-6"},
                        "workspace": {"current_dir": str(project)},
                        "context_window": {"used_percentage": 85},
                        "cost": {"total_cost_usd": 12.34},
                    }
                )
                for width in (40, 120):
                    os.environ["COLUMNS"] = str(width)
                    if bytecode_mode == "warm":
                        render_env = dict(os.environ)
                        render_env.pop("PYTHONDONTWRITEBYTECODE", None)
                        subprocess.run(
                            [sys.executable, "-m", "claude_statusline", "render"],
                            input=payload,
                            text=True,
                            stdout=subprocess.DEVNULL,
                            env=render_env,
                            check=True,
                        )
                    metrics[f"{profile}/render/{language}/{case}/{width}"] = measure(
                        lambda: process(payload=payload), samples
                    )
        tasks = [
            {
                "id": f"agent-{i}",
                "name": f"Review-{i} 👩🏽‍💻",
                "type": "local_agent",
                "status": "running",
                "description": f"Task {i}: " + "长目录 é 🇨🇳 1️⃣ " * 12,
                "model": "claude-sonnet-5",
                "effort": "high",
                "startTime": 1788400000000,
                "tokenCount": 84000,
                "contextWindowSize": 200000,
            }
            for i in range(count)
        ]
        for width in (40, 120):
            metrics[f"{profile}/agents/{width}"] = measure(
                lambda: subagents.render_payload(
                    {"tasks": tasks, "columns": width}, now_ms=1788400078000
                ),
                samples,
            )
            agent_payload = json.dumps({"tasks": tasks, "columns": width})

            def agent_process():
                subprocess.run(
                    [sys.executable, "-m", "claude_statusline", "render-subagents"],
                    input=agent_payload,
                    text=True,
                    check=True,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.PIPE,
                )

            if bytecode_mode == "warm":
                prime_env = dict(os.environ)
                prime_env.pop("PYTHONDONTWRITEBYTECODE", None)
                subprocess.run(
                    [sys.executable, "-m", "claude_statusline", "render-subagents"],
                    input=agent_payload,
                    text=True,
                    check=True,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.PIPE,
                    env=prime_env,
                )
            metrics[f"{profile}/agent_process/{width}"] = measure(
                agent_process, samples
            )
    return {
        "metrics": metrics,
        "profiles": metadata,
        "data_cache_checks": "no transcript reads or Git subprocesses on unchanged hits",
        "filesystem_cache": "OS cache uncontrolled; cold means application data or bytecode cache only",
    }
