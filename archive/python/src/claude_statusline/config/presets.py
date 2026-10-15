"""Portable presets expand to editable display settings, never host behavior."""

from claude_statusline.i18n import message as msg

from dataclasses import replace

from claude_statusline.config import display, formatting


ROWS = {
    "left-right": (("model-with-effort", "git", "spacer", "context-remaining"),),
    "repeated-metrics": (("input-tokens", "input-tokens"),),
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
        raise display.DisplayConfigError(
            msg("errors.presets.unknown_preset_choose", value0=", ".join(ROWS))
        )
    rows = ROWS[name]
    from .instances import DisplayInstance

    nodes, mapped_rows = [], []
    import uuid

    for row in rows:
        mapped = []
        for kind in row:
            identifier = (
                kind if all(i.id != kind for i in nodes) else "i-" + uuid.uuid4().hex
            )
            option = (
                formatting.ItemOptions()
                if kind == "spacer"
                else formatting.ItemOptions(priority=100 - len(nodes))
            )
            if name == "repeated-metrics":
                option = replace(
                    option,
                    formatting={"number_format": "full" if not nodes else "compact"},
                )
            nodes.append(DisplayInstance(identifier, kind, options=option))
            mapped.append(identifier)
        mapped_rows.append(tuple(mapped))
    subagents = display.SubagentDisplayConfig(enabled=config.subagents.enabled)
    if name == "multi-agent":
        subagents = replace(
            subagents, hide_completed=True, row_limit=6, task_max_width=48
        )
    if name == "left-right":
        subagents = display.SubagentDisplayConfig(
            enabled=config.subagents.enabled,
            instances=tuple(
                DisplayInstance(i, i) for i in ("status", "name", "spacer", "elapsed")
            ),
        )
    layout = (
        formatting.Layout()
        if name == "minimal"
        else formatting.Layout("explicit", tuple(mapped_rows))
    )
    return config.with_updates(
        instances=tuple(nodes),
        layout=layout,
        subagents=subagents,
        formatting=replace(
            config.formatting, model_name="short", number_format="compact"
        ),
    )
