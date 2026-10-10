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
from claude_statusline.rendering import metrics, preferences
from claude_statusline.config.formatting import legacy_fitting
from claude_statusline.i18n import statusline


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
    used: float | None = None


def _palette_for(config: config_display.DisplayConfig) -> _SubagentPalette:
    if not config.use_colors:
        return NO_COLOR_PALETTE
    palette = ANSI_PALETTE if config.palette == "ansi" else DEFAULT_PALETTE
    if config.theme == "classic":
        return palette
    from .appearance import themed_palette

    return themed_palette(palette, config, subagent=True)


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


def _task_name(task: dict[str, Any], language="en") -> str:
    return (
        rendering_formatters.sanitize_payload_text(task.get("name"))
        or _normalized_type(task.get("type"))
        or statusline.text("agent.fallback", language)
    )


def _model_with_effort(task: dict[str, Any], language="en") -> str | None:
    model = _model(task)
    if not model:
        return None
    effort = statusline.value("effort", metrics.effort_text(task.get("effort")), language)
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


def _context_used(task: dict[str, Any], language="en") -> str | None:
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
        return statusline.text("context.used", language, percentage=percentage)
    return None


def _context_remaining(task: dict[str, Any], language="en") -> str | None:
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
        return statusline.text("context.remaining", language, percentage=remaining)
    return None


def _elapsed(task: dict[str, Any], now_ms: float) -> str | None:
    status = task.get("status")
    if status not in ("pending", "running", "waiting", "paused"):
        duration = _finite_number(task.get("_frozen_duration_ms"))
        return (
            rendering_formatters.format_duration(duration / 1000)
            if duration is not None and duration >= 0
            else None
        )
    started = task.get("startTime")
    started_number = _finite_number(started)
    if started_number is None:
        return None
    seconds = max(0.0, (now_ms - started_number) / 1000.0)
    return rendering_formatters.format_duration(seconds)


def _token_text(task: dict[str, Any], language="en") -> str | None:
    value = rendering_formatters.humanize_tokens(task.get("tokenCount"))
    return statusline.text("tokens.count", language, value=value) if value is not None else None


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
    icon = _status_text(task)
    formatted = _elapsed(task, now_ms)
    return f"{icon} {formatted}" if formatted else icon


def _parts_for_task(
    task: dict[str, Any],
    config: config_display.DisplayConfig,
    now_ms: float,
) -> list[_Part]:
    palette = _palette_for(config)
    language = config.statusline_language
    name = _task_name(task, language)
    values: dict[str, tuple[str | None, str]] = {
        "status": (_status_text(task), palette.status),
        "status-elapsed": (_status_elapsed(task, now_ms), palette.elapsed),
        "name": (name, palette.name),
        "model-with-effort": (_model_with_effort(task, language), palette.model),
        "model": (_model(task), palette.model),
        "effort": (statusline.value("effort", metrics.effort_text(task.get("effort")), language), palette.model),
        "context-tokens": (
            metrics.token_ratio(task.get("tokenCount"), task.get("contextWindowSize"), language=language),
            palette.context,
        ),
        "context-window-size": (
            statusline.text("context.window", language, value=rendering_formatters.humanize_tokens(task["contextWindowSize"]))
            if metrics.token_count(task.get("contextWindowSize")) not in (None, 0)
            else None,
            palette.context,
        ),
        "context-remaining": (_context_remaining(task, language), palette.context),
        "context-used": (_context_used(task, language), palette.context),
        "elapsed": (_elapsed(task, now_ms), palette.elapsed),
        "task": (_task_text(task, name), palette.task),
        "tokens": (_token_text(task, language), palette.tokens),
        "current-dir": (_directory_text(task, config), palette.directory),
    }
    result = []
    for item in config.subagents.items:
        text, style = values[item]
        fmt, options = preferences.options_for(config, item, "subagent")
        if item in ("model", "model-with-effort"):
            model = preferences.model_name(_model(task), fmt)
            effort = statusline.value("effort", metrics.effort_text(task.get("effort")), language)
            text = (
                f"{model}/{effort}"
                if item == "model-with-effort" and model and effort
                else model
            )
        elif item == "tokens" and fmt.number_format != "legacy":
            count = metrics.token_count(task.get("tokenCount"))
            text = preferences.number(count, fmt)
        elif item == "context-tokens":
            text = metrics.token_ratio(
                task.get("tokenCount"), task.get("contextWindowSize"), fmt, language
            )
        elif item == "context-window-size" and fmt.number_format != "legacy":
            value = preferences.number(task.get("contextWindowSize"), fmt)
            text = statusline.text("context.window", language, value=value) if value else None
        if not text:
            continue
        risk = None
        if options.visibility != "always":
            from . import visibility

            risk = visibility.used_percentage(task, item, scope="subagent")
            if not visibility.visible(options, item, used=risk):
                continue
        text = preferences.decorate(text, item, "subagent", fmt, options, language=language)
        maximum = options.max_width
        if item == "task" and config.subagents.task_max_width is not None:
            maximum = (
                min(maximum, config.subagents.task_max_width)
                if maximum
                else config.subagents.task_max_width
            )
        if maximum is not None:
            text = rendering_formatters.truncate_text(text, maximum)
        if item in ("context-used", "context-remaining"):
            count, capacity = (
                metrics.token_count(task.get("tokenCount")),
                metrics.token_count(task.get("contextWindowSize")),
            )
            risk = count / capacity * 100 if count is not None and capacity else None
            styled = preferences.threshold(
                style + text, risk, fmt, config, palette.context
            )
            style = styled[: -len(text)] if text else style
        result.append(_Part(item, text, style, risk))
    return result


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
        text = f"{part.style}{part.text}{palette.reset}" if part.style else part.text
        options = config.subagents.item_options.get(part.item)
        if config.theme != "classic" or options and (options.foreground is not None or options.background is not None):
            from . import appearance

            options = preferences.options_for(config, part.item, "subagent")[1]
            text = appearance.apply(text, config, part.item, options, scope="subagent", used=part.used)
        rendered.append(text)
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
    parts = _parts_for_task(task, config, current_ms)
    if config.separator_style == "powerline":
        from . import appearance, powerline

        blocks = []
        for part in parts:
            options = preferences.options_for(config, part.item, "subagent")[1]
            text = part.style + part.text + (_palette_for(config).reset if part.style else "")
            blocks.append(powerline.Block(appearance.apply(text, config, part.item, options, scope="subagent", used=part.used), options.priority))
        return powerline.fit(blocks, columns, config)
    if legacy_fitting(config.subagents.item_options):
        while (
            len(parts) > 1
            and rendering_formatters.display_width(_plain_line(parts)) > columns
        ):
            index = min(
                range(len(parts)),
                key=lambda n: (
                    preferences.options_for(config, parts[n].item, "subagent")[
                        1
                    ].priority,
                    -n,
                ),
            )
            del parts[index]
    parts = _fit_parts(parts, columns)
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
    visible = 0
    endings = None
    for task in data["tasks"]:
        if not isinstance(task, dict):
            continue
        task_id = task.get("id")
        if not isinstance(task_id, str) or not task_id.strip() or task_id in seen:
            continue
        seen.add(task_id)
        hidden = (
            (
                config.subagents.visibility == "running"
                and task.get("status") != "running"
            )
            or (config.subagents.hide_completed and task.get("status") == "completed")
            or (
                config.subagents.row_limit is not None
                and visible >= config.subagents.row_limit
            )
        )
        try:
            if (
                task.get("status") in ("completed", "failed", "killed", "interrupted")
                and "_frozen_duration_ms" not in task
            ):
                session = data.get("session_id")
                if isinstance(session, str) and session:
                    if endings is None:
                        from claude_statusline.runtime.live import durations

                        endings = durations.ended_at(Path(CONFIG_DIR), session)
                    end = endings.get(task_id)
                    start = _finite_number(task.get("startTime"))
                    if end is not None and start is not None and 0 <= start <= end:
                        task = {**task, "_frozen_duration_ms": end - start}
            content = (
                ""
                if hidden
                else render_task(
                    task,
                    config,
                    columns=columns,
                    now_ms=now_ms,
                )
            )
        except Exception:
            content = ""
        if content:
            visible += 1
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
                "_frozen_duration_ms": 42_000,
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
