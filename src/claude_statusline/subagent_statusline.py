#!/usr/bin/env python3
"""Render Claude Code ``subagentStatusLine`` tasks as width-bounded NDJSON."""

from __future__ import annotations

import json
import math
import os
import re
import sys
import time
from dataclasses import dataclass, replace
from pathlib import Path
from typing import Any

from .display_config import (
    DEFAULT_CONFIG,
    DisplayConfig,
    DisplayConfigError,
    format_directory,
    load_display_config,
)
from .render_utils import (
    ANSI_RESET,
    display_width,
    format_duration,
    humanize_tokens,
    sanitize_payload_text,
    truncate_text,
)


DEFAULT_COLUMNS = 80
STATUS_ICONS = {
    "pending": "…",
    "running": "⏱",
    "completed": "✓",
    "failed": "✗",
    "killed": "■",
    "paused": "⏳",
    "waiting": "⏳",
}
OPTIONAL_DROP_ORDER = (
    "current-dir",
    "tokens",
    "context-used",
    "model-with-effort",
    "task",
)


@dataclass(frozen=True)
class _SubagentPalette:
    status: str
    name: str
    model: str
    context: str
    elapsed: str
    task: str
    tokens: str
    directory: str
    separator: str
    reset: str


DEFAULT_PALETTE = _SubagentPalette(
    status="\033[1;38;2;142;211;211m",
    name="\033[1;38;2;246;226;183m",
    model="\033[1;38;2;246;226;183m",
    context="\033[1;38;2;242;181;144m",
    elapsed="\033[1;38;2;142;211;211m",
    task="\033[1;38;2;171;223;167m",
    tokens="\033[1;38;2;233;144;169m",
    directory="\033[1;38;2;171;223;167m",
    separator="\033[90m",
    reset=ANSI_RESET,
)
ANSI_PALETTE = _SubagentPalette(
    status="\033[1;36m",
    name="\033[1;33m",
    model="\033[1;33m",
    context="\033[1;33m",
    elapsed="\033[1;36m",
    task="\033[1;32m",
    tokens="\033[1;35m",
    directory="\033[1;32m",
    separator="\033[90m",
    reset=ANSI_RESET,
)
NO_COLOR_PALETTE = _SubagentPalette(*("",) * 10)


@dataclass(frozen=True)
class _Part:
    item: str
    text: str
    style: str


def _palette_for(config: DisplayConfig) -> _SubagentPalette:
    if not config.use_colors:
        return NO_COLOR_PALETTE
    return ANSI_PALETTE if config.palette == "ansi" else DEFAULT_PALETTE


def _columns(value: object) -> int:
    if isinstance(value, int) and not isinstance(value, bool) and value > 0:
        return value
    return DEFAULT_COLUMNS


def _normalized_type(value: object) -> str | None:
    text = sanitize_payload_text(value)
    if not text:
        return None
    words = re.sub(r"[_-]+", " ", text).split()
    return " ".join(word[:1].upper() + word[1:] for word in words) or None


def _finite_number(value: object) -> float | None:
    if not isinstance(value, (int, float)) or isinstance(value, bool):
        return None
    try:
        parsed = float(value)
    except (TypeError, ValueError, OverflowError):
        return None
    return parsed if math.isfinite(parsed) else None


def _task_name(task: dict[str, Any]) -> str:
    return (
        sanitize_payload_text(task.get("name"))
        or _normalized_type(task.get("type"))
        or "Agent"
    )


def _model_with_effort(task: dict[str, Any]) -> str | None:
    model = sanitize_payload_text(task.get("model"))
    if not model:
        return None
    if model.startswith("claude-"):
        model = model[len("claude-") :]
    if not model:
        return None
    effort_value = task.get("effort")
    effort = None
    if isinstance(effort_value, str):
        effort = sanitize_payload_text(effort_value)
    elif isinstance(effort_value, int) and not isinstance(effort_value, bool):
        effort = str(effort_value)
    elif _finite_number(effort_value) is not None:
        effort = f"{effort_value:g}" if isinstance(effort_value, float) else str(effort_value)
    return f"{model}/{effort}" if effort else model


def _context_used(task: dict[str, Any]) -> str | None:
    tokens = task.get("tokenCount")
    window = task.get("contextWindowSize")
    token_number = _finite_number(tokens)
    window_number = _finite_number(window)
    if token_number is not None and token_number >= 0 and window_number is not None and window_number > 0:
        ratio = token_number * 100.0 / window_number
        if not math.isfinite(ratio):
            return None
        percentage = int(ratio + 0.5)
        return f"ctx {percentage}%"
    return None


def _elapsed(task: dict[str, Any], now_ms: float) -> str | None:
    started = task.get("startTime")
    started_number = _finite_number(started)
    if started_number is None:
        return None
    seconds = max(0.0, (now_ms - started_number) / 1000.0)
    return format_duration(seconds)


def _token_text(task: dict[str, Any]) -> str | None:
    value = humanize_tokens(task.get("tokenCount"))
    return f"{value} tokens" if value is not None else None


def _task_text(task: dict[str, Any], name: str) -> str | None:
    value = sanitize_payload_text(task.get("label")) or sanitize_payload_text(
        task.get("description")
    )
    if value and value.casefold() != name.casefold():
        return value
    return None


def _directory_text(task: dict[str, Any], config: DisplayConfig) -> str | None:
    value = sanitize_payload_text(task.get("cwd"))
    if not value:
        return None
    return format_directory(value, config.directory_style)


def _status_text(task: dict[str, Any]) -> str:
    status = sanitize_payload_text(task.get("status"))
    return STATUS_ICONS.get(status.casefold() if status else "", "?")


def _parts_for_task(
    task: dict[str, Any],
    config: DisplayConfig,
    now_ms: float,
) -> list[_Part]:
    palette = _palette_for(config)
    name = _task_name(task)
    values: dict[str, tuple[str | None, str]] = {
        "status": (_status_text(task), palette.status),
        "name": (name, palette.name),
        "model-with-effort": (_model_with_effort(task), palette.model),
        "context-used": (_context_used(task), palette.context),
        "elapsed": (_elapsed(task, now_ms), palette.elapsed),
        "task": (_task_text(task, name), palette.task),
        "tokens": (_token_text(task), palette.tokens),
        "current-dir": (_directory_text(task, config), palette.directory),
    }
    return [
        _Part(item, values[item][0], values[item][1])
        for item in config.subagents.items
        if values[item][0]
    ]


def _plain_line(parts: list[_Part]) -> str:
    output = ""
    previous = None
    for part in parts:
        if output:
            output += " " if previous == "status" and part.item == "name" else " · "
        output += part.text
        previous = part.item
    return output


def _replace_part(parts: list[_Part], item: str, text: str) -> list[_Part]:
    return [replace(part, text=text) if part.item == item else part for part in parts]


def _without_part(parts: list[_Part], item: str) -> list[_Part]:
    return [part for part in parts if part.item != item]


def _fit_parts(parts: list[_Part], columns: int) -> list[_Part]:
    if display_width(_plain_line(parts)) <= columns:
        return parts

    task_part = next((part for part in parts if part.item == "task"), None)
    if task_part is not None:
        excess = display_width(_plain_line(parts)) - columns
        allowed = display_width(task_part.text) - excess
        shortened = truncate_text(task_part.text, max(0, allowed))
        parts = (
            _replace_part(parts, "task", shortened)
            if shortened
            else _without_part(parts, "task")
        )

    for item in OPTIONAL_DROP_ORDER:
        if display_width(_plain_line(parts)) <= columns:
            break
        parts = _without_part(parts, item)

    if display_width(_plain_line(parts)) > columns:
        name_part = next((part for part in parts if part.item == "name"), None)
        if name_part is not None:
            excess = display_width(_plain_line(parts)) - columns
            allowed = display_width(name_part.text) - excess
            shortened = truncate_text(name_part.text, max(0, allowed))
            parts = (
                _replace_part(parts, "name", shortened)
                if shortened
                else _without_part(parts, "name")
            )

    # At extremely small widths retain the status marker. If status was
    # explicitly disabled, retain and truncate the earliest configured core
    # field instead of turning a valid task into an empty row.
    if any(part.item == "status" for part in parts):
        for item in ("name", "elapsed"):
            if display_width(_plain_line(parts)) <= columns:
                break
            parts = _without_part(parts, item)
    while len(parts) > 1 and display_width(_plain_line(parts)) > columns:
        removable = next(
            (part for part in reversed(parts) if part.item != "status"),
            parts[-1],
        )
        parts = _without_part(parts, removable.item)
    if parts and display_width(_plain_line(parts)) > columns:
        first = parts[0]
        parts = [replace(first, text=truncate_text(first.text, columns, ellipsis=""))]
        if not parts[0].text:
            return []
    return parts


def _render_parts(parts: list[_Part], config: DisplayConfig) -> str:
    palette = _palette_for(config)
    if palette.separator:
        separator = f"{palette.separator} · {palette.reset}"
    else:
        separator = " · "
    rendered = []
    previous = None
    for part in parts:
        if rendered:
            rendered.append(
                " "
                if previous == "status" and part.item == "name"
                else separator
            )
        if part.style:
            rendered.append(f"{part.style}{part.text}{palette.reset}")
        else:
            rendered.append(part.text)
        previous = part.item
    return "".join(rendered)


def render_task(
    task: dict[str, Any],
    config: DisplayConfig = DEFAULT_CONFIG,
    *,
    columns: int = DEFAULT_COLUMNS,
    now_ms: float | None = None,
) -> str:
    if not config.subagents.enabled or not config.subagents.items:
        return ""
    current_ms = time.time() * 1000.0 if now_ms is None else float(now_ms)
    parts = _fit_parts(_parts_for_task(task, config, current_ms), columns)
    content = _render_parts(parts, config)
    # Keep the protocol guarantee defensive even if a future style or field is
    # added without updating the fitting logic.
    if display_width(content) > columns:
        return truncate_text(_plain_line(parts), columns)
    return content


def render_payload(
    data: object,
    config: DisplayConfig = DEFAULT_CONFIG,
    *,
    now_ms: float | None = None,
) -> list[dict[str, str]]:
    if not isinstance(data, dict) or not isinstance(data.get("tasks"), list):
        return []
    columns = _columns(data.get("columns"))
    seen: set[str] = set()
    output: list[dict[str, str]] = []
    for task in data["tasks"]:
        if not isinstance(task, dict):
            continue
        task_id = task.get("id")
        if not isinstance(task_id, str) or not task_id.strip() or task_id in seen:
            continue
        seen.add(task_id)
        try:
            content = render_task(
                task,
                config,
                columns=columns,
                now_ms=now_ms,
            )
        except Exception:
            content = ""
        output.append({"id": task_id, "content": content})
    return output


def preview_rows(config: DisplayConfig, columns: int) -> list[str]:
    """Return deterministic running/completed rows for the TUI preview."""
    now_ms = 1_788_400_120_000
    sample = {
        "columns": columns,
        "tasks": [
            {
                "id": "preview-running",
                "name": "Explore",
                "type": "local_agent",
                "status": "running",
                "label": "searching auth flow",
                "startTime": now_ms - 78_000,
                "model": "claude-sonnet-5",
                "effort": "high",
                "contextWindowSize": 200_000,
                "tokenCount": 84_000,
                "cwd": "/project/src",
            },
            {
                "id": "preview-completed",
                "name": "Reviewer",
                "type": "local_agent",
                "status": "completed",
                "description": "reviewed lifecycle tests",
                "startTime": now_ms - 42_000,
                "model": "claude-haiku-4-5",
                "contextWindowSize": 200_000,
                "tokenCount": 18_500,
                "cwd": "/project/tests",
            },
        ],
    }
    return [
        item["content"]
        for item in render_payload(sample, config, now_ms=now_ms)
        if item["content"]
    ]


CONFIG_DIR = os.path.abspath(
    os.path.expanduser(os.environ.get("CLAUDE_CONFIG_DIR", "~/.claude"))
)


def main() -> None:
    try:
        sys.stdout.reconfigure(encoding="utf-8", newline="\n")
    except AttributeError:
        pass
    try:
        raw = sys.stdin.buffer.read()
        if raw.startswith(b"\xef\xbb\xbf"):
            raw = raw[3:]
        data = json.loads(raw.decode("utf-8"))
    except Exception:
        return
    try:
        config = load_display_config(Path(CONFIG_DIR))
    except DisplayConfigError:
        config = DEFAULT_CONFIG
    for item in render_payload(data, config):
        sys.stdout.write(json.dumps(item, ensure_ascii=False, separators=(",", ":")) + "\n")


if __name__ == "__main__":
    main()
