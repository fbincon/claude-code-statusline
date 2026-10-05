"""Portable presets expand to editable display settings, never host behavior."""

from dataclasses import replace

from claude_statusline.config import display, formatting


ROWS = {
    "minimal": (
        ("model-with-effort", "current-dir", "context-remaining", "task-timer"),
    ),
    "developer": (
        ("model-with-effort", "current-dir", "git"),
        ("context-remaining", "tokens", "task-timer", "session-cost"),
    ),
    "monitoring": (
        ("context-used", "five-hour-limit", "weekly-limit", "spend-limit"),
        ("five-hour-reset", "weekly-reset", "cache-state", "cache-expires"),
        (
            "session-cost",
            "session-duration",
            "api-duration",
            "api-requests",
            "cache-misses",
        ),
    ),
    "multi-agent": (
        ("model-with-effort", "current-dir", "git"),
        ("context-remaining", "tokens", "task-timer"),
    ),
}


def descriptions():
    return [
        {
            "id": name,
            "label": name.replace("-", " ").title(),
            "rows": [list(row) for row in rows],
            "layout_mode": "auto" if name == "minimal" else "explicit",
        }
        for name, rows in ROWS.items()
    ]


def apply(config, name):
    if name not in ROWS:
        raise display.DisplayConfigError("unknown preset; choose " + ", ".join(ROWS))
    rows = ROWS[name]
    items = tuple(item for row in rows for item in row)
    subagents = display.SubagentDisplayConfig(enabled=config.subagents.enabled)
    if name == "multi-agent":
        subagents = replace(
            subagents, hide_completed=True, row_limit=6, task_max_width=48
        )
    layout = (
        formatting.Layout()
        if name == "minimal"
        else formatting.Layout("explicit", rows)
    )
    return config.with_updates(
        items=items,
        layout=layout,
        subagents=subagents,
        formatting=replace(
            config.formatting, model_name="short", number_format="compact"
        ),
        item_options={
            item: formatting.ItemOptions(priority=100 - index)
            for index, item in enumerate(items)
        },
    )
