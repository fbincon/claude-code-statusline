"""Opt-in display costs in fresh render processes; synthetic observations only."""

from __future__ import annotations

from dataclasses import replace
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile


def run(samples, bytecode_mode, measure):
    from claude_statusline.config import display, formatting

    if display.SCHEMA_VERSION < 7:
        raise ValueError("Appearance benchmarks require display schema 7")
    with tempfile.TemporaryDirectory(prefix="statusline-appearance-benchmark-") as folder:
        root = Path(folder)
        config_dir = root / "config"
        config_dir.mkdir()
        env = dict(os.environ, CLAUDE_CONFIG_DIR=str(config_dir), PYTHONDONTWRITEBYTECODE="1",
                   PYTHONPYCACHEPREFIX=str(root / "bytecode"), CLAUDE_STATUSLINE_RUNTIME_DIR=str(root / "runtime"))
        base = display.DEFAULT_CONFIG.with_updates(items=("model", "context-used", "session-cost"), scope_labels="off")
        base = base.with_updates(subagents=replace(base.subagents, items=("name", "model", "context-used", "task")))
        colored = base.with_updates(item_options={"model": formatting.ItemOptions(foreground="#abcdef", background="#123456")},
                                    subagents=replace(base.subagents, item_options={"name": formatting.ItemOptions(background="ansi:25")}))
        conditional = base.with_updates(item_options={"context-used": formatting.ItemOptions(visibility="used-at-least")},
                                        subagents=replace(base.subagents, item_options={"context-used": formatting.ItemOptions(visibility="used-at-least")}))
        cases = {"disabled": base, "conditions": conditional, "item-colors": colored,
                 **{theme: base.with_updates(theme=theme) for theme in ("dark", "light", "terminal")},
                 "powerline-ascii": colored.with_updates(separator_style="powerline"),
                 "powerline-arrow": colored.with_updates(separator_style="powerline", powerline_glyph="powerline"),
                 "powerline-light": colored.with_updates(separator_style="powerline", theme="light"),
                 "powerline-no-color": base.with_updates(separator_style="powerline", use_colors=False)}
        metrics = {}
        for language in ("en", "zh-CN"):
            for name, config in cases.items():
                config = config.with_updates(statusline_language=language)
                (config_dir / display.CONFIG_FILENAME).write_text(json.dumps(config.to_dict()), encoding="utf-8")
                for width in (40, 120):
                    env["COLUMNS"] = str(width)
                    payloads = {
                        "main": ("render", {"model": {"id": "claude-sonnet-5"}, "context_window": {"used_percentage": 42},
                                            "cost": {"total_cost_usd": 12.34}}),
                        "agents": ("render-subagents", {"columns": width, "tasks": [
                            {"id": str(i), "name": f"Review-{i} 中文", "model": "claude-sonnet-5", "status": "running",
                             "tokenCount": 84000, "contextWindowSize": 200000, "description": "Review é 👩🏽‍💻 change " * 4}
                            for i in range(32)
                        ]}),
                    }
                    for scope, (command, payload) in payloads.items():
                        raw = json.dumps(payload).encode()

                        def process(environment=env):
                            return subprocess.run([sys.executable, "-m", "claude_statusline", command], input=raw,
                                                  stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True, env=environment).stdout

                        if bytecode_mode == "warm":
                            warm = dict(env)
                            warm.pop("PYTHONDONTWRITEBYTECODE", None)
                            process(warm)
                        output = process()
                        if not output:
                            raise AssertionError("The measured renderer returned no rows")
                        if scope == "agents":
                            assert len(output.splitlines()) == 32
                        metrics[f"{name}/{language}/{scope}/{width}"] = measure(process, samples)
        return {"metrics": metrics, "profiles": {"agents": 32},
                "comparison": "candidate-only opt-in costs; disabled case is the same candidate without new features"}
