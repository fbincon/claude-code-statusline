"""rendering / subagents implementation."""

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
from claude_statusline.config import display as config_display
from claude_statusline.rendering import formatters as rendering_formatters
from claude_statusline.rendering import metrics


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
    "context-window-size",
    "context-tokens",
    "context-used",
    "context-remaining",
    "model-with-effort",
    "effort",
    "model",
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
    reset=rendering_formatters.ANSI_RESET,
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
    reset=rendering_formatters.ANSI_RESET,
)


NO_COLOR_PALETTE = _SubagentPalette(*("",) * 10)


@dataclass(frozen=True)
class _Part:
    item: str
    text: str
    style: str


def _palette_for(config: config_display.DisplayConfig) -> _SubagentPalette:
    if not config.use_colors:
        return NO_COLOR_PALETTE
    return ANSI_PALETTE if config.palette == "ansi" else DEFAULT_PALETTE


def _columns(value: object) -> int:
    if isinstance(value, int) and not isinstance(value, bool) and value > 0:
        return value
    return DEFAULT_COLUMNS


def _normalized_type(value: object) -> str | None:
    text = rendering_formatters.sanitize_payload_text(value)
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
        rendering_formatters.sanitize_payload_text(task.get("name"))
        or _normalized_type(task.get("type"))
        or "Agent"
    )


def _model_with_effort(task: dict[str, Any]) -> str | None:
    model = _model(task)
    if not model:
        return None
    effort = metrics.effort_text(task.get("effort"))
    return f"{model}/{effort}" if effort else model


def _model(task: dict[str, Any]) -> str | None:
    model = rendering_formatters.sanitize_payload_text(task.get("model"))
    if not model:
        return None
    if model.startswith("claude-"):
        model = model[len("claude-") :]
    if not model:
        return None
    return model


def _context_used(task: dict[str, Any]) -> str | None:
    tokens = task.get("tokenCount")
    window = task.get("contextWindowSize")
    token_number = _finite_number(tokens)
    window_number = _finite_number(window)
    if (
        token_number is not None
        and token_number >= 0
        and window_number is not None
        and window_number > 0
    ):
        ratio = token_number * 100.0 / window_number
        if not math.isfinite(ratio):
            return None
        percentage = int(ratio + 0.5)
        return f"Context {percentage}% used"
    return None


def _context_remaining(task: dict[str, Any]) -> str | None:
    tokens = task.get("tokenCount")
    window = task.get("contextWindowSize")
    token_number = _finite_number(tokens)
    window_number = _finite_number(window)
    if (
        token_number is not None
        and token_number >= 0
        and window_number is not None
        and window_number > 0
    ):
        ratio = token_number * 100.0 / window_number
        if not math.isfinite(ratio):
            return None
        used = int(ratio + 0.5)
        remaining = max(0, min(100, 100 - used))
        return f"Context {remaining}% left"
    return None


def _elapsed(task: dict[str, Any], now_ms: float) -> str | None:
    started = task.get("startTime")
    started_number = _finite_number(started)
    if started_number is None:
        return None
    seconds = max(0.0, (now_ms - started_number) / 1000.0)
    return rendering_formatters.format_duration(seconds)


def _token_text(task: dict[str, Any]) -> str | None:
    value = rendering_formatters.humanize_tokens(task.get("tokenCount"))
    return f"{value} tokens" if value is not None else None


def _task_text(task: dict[str, Any], name: str) -> str | None:
    value = rendering_formatters.sanitize_payload_text(
        task.get("label")
    ) or rendering_formatters.sanitize_payload_text(task.get("description"))
    if value and value.casefold() != name.casefold():
        return value
    return None


def _directory_text(
    task: dict[str, Any], config: config_display.DisplayConfig
) -> str | None:
    value = rendering_formatters.sanitize_payload_text(task.get("cwd"))
    if not value:
        return None
    return config_display.format_directory(value, config.directory_style)


def _status_text(task: dict[str, Any]) -> str:
    status = rendering_formatters.sanitize_payload_text(task.get("status"))
    return STATUS_ICONS.get(status.casefold() if status else "", "?")


def _status_elapsed(task: dict[str, Any], now_ms: float) -> str:
    # Completed tasks keep counting because the payload has no endTime,
    # matching the standalone `elapsed` item.
    icon = _status_text(task)
    formatted = _elapsed(task, now_ms)
    return f"{icon} {formatted}" if formatted else icon


def _parts_for_task(
    task: dict[str, Any],
    config: config_display.DisplayConfig,
    now_ms: float,
) -> list[_Part]:
    palette = _palette_for(config)
    name = _task_name(task)
    values: dict[str, tuple[str | None, str]] = {
        "status": (_status_text(task), palette.status),
        "status-elapsed": (_status_elapsed(task, now_ms), palette.elapsed),
        "name": (name, palette.name),
        "model-with-effort": (_model_with_effort(task), palette.model),
        "model": (_model(task), palette.model),
        "effort": (metrics.effort_text(task.get("effort")), palette.model),
        "context-tokens": (
            metrics.token_ratio(task.get("tokenCount"), task.get("contextWindowSize")),
            palette.context,
        ),
        "context-window-size": (
            f"{rendering_formatters.humanize_tokens(task['contextWindowSize'])} window"
            if metrics.token_count(task.get("contextWindowSize")) not in (None, 0)
            else None,
            palette.context,
        ),
        "context-remaining": (_context_remaining(task), palette.context),
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
    if rendering_formatters.display_width(_plain_line(parts)) <= columns:
        return parts

    task_part = next((part for part in parts if part.item == "task"), None)
    if task_part is not None:
        excess = rendering_formatters.display_width(_plain_line(parts)) - columns
        allowed = rendering_formatters.display_width(task_part.text) - excess
        shortened = rendering_formatters.truncate_text(task_part.text, max(0, allowed))
        parts = (
            _replace_part(parts, "task", shortened)
            if shortened
            else _without_part(parts, "task")
        )

    for item in OPTIONAL_DROP_ORDER:
        if rendering_formatters.display_width(_plain_line(parts)) <= columns:
            break
        parts = _without_part(parts, item)

    if rendering_formatters.display_width(_plain_line(parts)) > columns:
        name_part = next((part for part in parts if part.item == "name"), None)
        if name_part is not None:
            excess = rendering_formatters.display_width(_plain_line(parts)) - columns
            allowed = rendering_formatters.display_width(name_part.text) - excess
            shortened = rendering_formatters.truncate_text(
                name_part.text, max(0, allowed)
            )
            parts = (
                _replace_part(parts, "name", shortened)
                if shortened
                else _without_part(parts, "name")
            )

    # At extremely small widths retain the status marker (or the combined
    # status-elapsed unit). If both were explicitly disabled, retain and
    # truncate the earliest configured core field instead of turning a valid
    # task into an empty row.
    if any(part.item in ("status", "status-elapsed") for part in parts):
        for item in ("name", "elapsed"):
            if rendering_formatters.display_width(_plain_line(parts)) <= columns:
                break
            parts = _without_part(parts, item)
    while (
        len(parts) > 1
        and rendering_formatters.display_width(_plain_line(parts)) > columns
    ):
        removable = next(
            (
                part
                for part in reversed(parts)
                if part.item not in ("status", "status-elapsed")
            ),
            parts[-1],
        )
        parts = _without_part(parts, removable.item)
    if parts and rendering_formatters.display_width(_plain_line(parts)) > columns:
        first = parts[0]
        parts = [
            replace(
                first,
                text=rendering_formatters.truncate_text(
                    first.text, columns, ellipsis=""
                ),
            )
        ]
        if not parts[0].text:
            return []
    return parts


def _render_parts(parts: list[_Part], config: config_display.DisplayConfig) -> str:
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
                " " if previous == "status" and part.item == "name" else separator
            )
        if part.style:
            rendered.append(f"{part.style}{part.text}{palette.reset}")
        else:
            rendered.append(part.text)
        previous = part.item
    return "".join(rendered)


def render_task(
    task: dict[str, Any],
    config: config_display.DisplayConfig = config_display.DEFAULT_CONFIG,
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
    if rendering_formatters.display_width(content) > columns:
        return rendering_formatters.truncate_text(_plain_line(parts), columns)
    return content


def render_payload(
    data: object,
    config: config_display.DisplayConfig = config_display.DEFAULT_CONFIG,
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


def preview_rows(config: config_display.DisplayConfig, columns: int) -> list[str]:
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
        config = config_display.load_display_config(Path(CONFIG_DIR))
    except config_display.DisplayConfigError:
        config = config_display.DEFAULT_CONFIG
    for item in render_payload(data, config):
        sys.stdout.write(
            json.dumps(item, ensure_ascii=False, separators=(",", ":")) + "\n"
        )
