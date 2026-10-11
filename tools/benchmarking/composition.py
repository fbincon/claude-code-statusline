"""Opt-in instance costs using fixed observations and isolated CLI processes."""

import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile


def run(samples, bytecode_mode, measure):
    from claude_statusline.config import display, formatting, instances, presets
    from claude_statusline.rendering import subagents

    base = display.DisplayConfig(
        items=("model", "context-used", "input-tokens"), scope_labels="off"
    )
    repeated = base
    for n in range(7):
        repeated, identifier = instances.edit(repeated, "main", "copy", "input-tokens")
        repeated, _ = instances.edit(
            repeated,
            "main",
            "set",
            identifier,
            option="number-format",
            value="full" if n % 2 else "compact",
        )
    repeated = repeated.with_updates(
        subagents=display.SubagentDisplayConfig(
            instances=tuple(
                instances.DisplayInstance(
                    f"tokens-{n}",
                    "tokens",
                    options=formatting.ItemOptions(
                        formatting={"number_format": "full" if n % 2 else "compact"}
                    ),
                )
                for n in range(4)
            )
        )
    )
    aligned = presets.apply(base, "left-right")
    aligned, _ = instances.edit(
        aligned, "main", "add", type_id="text", text="é 中文 👩🏽‍💻", after="git"
    )
    cases = {
        "default": display.DEFAULT_CONFIG,
        "single": base,
        "repeated": repeated,
        "aligned": aligned,
        "powerline": aligned.with_updates(separator_style="powerline"),
    }
    metrics = {}
    with tempfile.TemporaryDirectory(
        prefix="statusline-composition-benchmark-"
    ) as temporary:
        root = Path(temporary)
        config_dir = root / "config"
        config_dir.mkdir()
        transcript = root / "history.jsonl"
        transcript.write_text(
            json.dumps(
                {
                    "type": "assistant",
                    "message": {
                        "id": "sample",
                        "usage": {"input_tokens": 1287500, "output_tokens": 45},
                    },
                }
            )
            + "\n"
        )
        env = dict(
            os.environ,
            CLAUDE_CONFIG_DIR=str(config_dir),
            CLAUDE_STATUSLINE_RUNTIME_DIR=str(root / "runtime"),
            PYTHONDONTWRITEBYTECODE="1",
            PYTHONPYCACHEPREFIX=str(root / "bytecode"),
        )
        for language in ("en", "zh-CN"):
            for name, cfg in cases.items():
                cfg = cfg.with_updates(statusline_language=language)
                (config_dir / display.CONFIG_FILENAME).write_text(
                    json.dumps(cfg.to_dict()), encoding="utf-8"
                )
                for width in (40, 120):
                    env["COLUMNS"] = str(width)
                    main = {
                        "transcript_path": str(transcript),
                        "session_id": "composition-benchmark",
                        "model": {"id": "claude-sonnet-5"},
                        "context_window": {
                            "used_percentage": 42,
                            "total_input_tokens": 1287500,
                        },
                    }
                    for count in (0, 8, 32):
                        data = (
                            main
                            if not count
                            else {
                                "columns": width,
                                "tasks": [
                                    {
                                        "id": str(n),
                                        "name": f"Review-{n} 中文",
                                        "model": "claude-sonnet-5",
                                        "status": "running",
                                        "elapsedMs": 75000,
                                        "tokenCount": 84000,
                                        "contextWindowSize": 200000,
                                        "description": "Review é 👩🏽‍💻",
                                    }
                                    for n in range(count)
                                ],
                            }
                        )
                        command = "render" if not count else "render-subagents"
                        raw = json.dumps(data).encode()

                        def action(environment=env):
                            return subprocess.run(
                                [sys.executable, "-m", "claude_statusline", command],
                                input=raw,
                                env=environment,
                                stdout=subprocess.PIPE,
                                stderr=subprocess.PIPE,
                                check=True,
                            ).stdout

                        if bytecode_mode == "warm":
                            warm = dict(env)
                            warm.pop("PYTHONDONTWRITEBYTECODE")
                            action(warm)
                        result = action()
                        assert result and (
                            not count or len(result.splitlines()) == count
                        )
                        key = f"{name}/{language}/{width}/{count or 'main'}"
                        metrics[key + "/process"] = measure(action, samples)
                        if count:
                            metrics[key + "/refresh"] = measure(
                                lambda: subagents.render_payload(data, cfg), samples
                            )
    return {
        "metrics": metrics,
        "comparison": "candidate-only defaults/single instances versus repeated instances and flexible layout; no live I/O fixtures",
    }
