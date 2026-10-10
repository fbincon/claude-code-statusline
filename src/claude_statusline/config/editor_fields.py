"""Canonical form descriptors and pure edits for Client and curses."""

from claude_statusline.i18n import message as msg

from claude_statusline.config import advanced, display, formatting, presets, appearance
import re


def field(
    key,
    label,
    group,
    kind="choice",
    choices=(),
    minimum=0,
    maximum=10000,
    nullable=False,
):
    return {
        "key": key,
        "label": label,
        "group": group,
        "kind": kind,
        "choices": list(choices),
        "minimum": minimum,
        "maximum": maximum,
        "nullable": nullable,
    }


GLOBAL = (
    [
        field("theme", "Statusline theme", "Appearance", choices=appearance.THEMES),
        field("powerline_glyph", "Powerline separator", "Appearance", choices=appearance.POWERLINE_GLYPHS),
        field(
            "statusline_language",
            "Statusline language (save with display settings)",
            "Appearance",
            choices=display.STATUSLINE_LANGUAGES,
        ),
        field(
            "metrics.branch_diff_base_ref",
            "Branch diff base (inherit = auto)",
            "Git metrics",
            "text",
            nullable=True,
        ),
    ]
    + [
        field(
            "formatting." + key,
            key.replace("_", " ").title(),
            "Formatting",
            choices=choices,
        )
        for key, choices in formatting.FORMAT_CHOICES.items()
    ]
    + [
        field(
            "formatting.thresholds.enabled",
            "Threshold colors",
            "Risk colors",
            "boolean",
        ),
        field(
            "formatting.thresholds.warning",
            "Warning (%)",
            "Risk colors",
            "integer",
            maximum=100,
        ),
        field(
            "formatting.thresholds.critical",
            "Critical (%)",
            "Risk colors",
            "integer",
            maximum=100,
        ),
        field(
            "subagents.visibility",
            "Visible agents",
            "Subagent visibility",
            choices=("all", "running"),
        ),
        field(
            "subagents.hide_completed",
            "Hide completed",
            "Subagent visibility",
            "boolean",
        ),
        field(
            "subagents.row_limit",
            "Agent row limit",
            "Subagent visibility",
            "integer",
            nullable=True,
        ),
        field(
            "subagents.task_max_width",
            "Task text width",
            "Subagent visibility",
            "integer",
            minimum=2,
            nullable=True,
        ),
    ]
)
ITEM = [
    field("foreground", "Foreground (inherit/default/ansi:N/#RRGGBB)", "Item colors", "text", nullable=True),
    field("background", "Background (inherit/default/ansi:N/#RRGGBB)", "Item colors", "text", nullable=True),
    field("visibility", "Visibility rule", "Conditional visibility", choices=appearance.VISIBILITY_RULES),
    field("visibility_threshold", "Minimum used (%)", "Conditional visibility", "integer", maximum=100),
    field("label", "Label (inherit = default)", "Item format", "text", nullable=True),
    field("icon", "Icon (inherit = default)", "Item format", "text", nullable=True),
    field("priority", "Priority", "Item fitting", "integer", maximum=100),
    field(
        "max_width",
        "Maximum width",
        "Item fitting",
        "integer",
        minimum=2,
        nullable=True,
    ),
] + [
    field(
        key, key.replace("_", " ").title(), "Item format", choices=("inherit", *choices)
    )
    for key, choices in formatting.FORMAT_CHOICES.items()
]


def item_fields(scope, item):
    choices = appearance.visibility_choices(scope, item)
    return [
        {**spec, "choices": list(choices)} if spec["key"] == "visibility" else spec
        for spec in ITEM
        if (spec["key"] != "visibility" or len(choices) > 1)
        and (spec["key"] != "visibility_threshold" or "used-at-least" in choices)
    ]


def descriptions():
    return {"global": GLOBAL, "item": ITEM}


def value(config, key, scope=None, item=None):
    if scope is not None:
        options = (
            config.item_options if scope == "main" else config.subagents.item_options
        ).get(item, formatting.ItemOptions())
        return (
            options.formatting.get(key, "inherit")
            if key in formatting.FORMAT_CHOICES
            else options.to_dict()[key]
        )
    data = config.to_dict()
    for part in key.split("."):
        data = data[part]
    return data


def parse_value(spec, raw):
    if spec["kind"] == "boolean":
        if type(raw) is bool:
            return raw
        if raw not in ("on", "off"):
            raise display.DisplayConfigError(msg('errors.editor_fields.expected_on_off'))
        return raw == "on"
    if spec["kind"] == "integer":
        if spec["nullable"] and raw in (None, "none", "inherit"):
            return None
        try:
            if type(raw) is not int and not (
                isinstance(raw, str) and re.fullmatch(r"[0-9]+", raw)
            ):
                raise ValueError(msg('errors.editor_fields.expected_an_integer'))
            raw = int(raw)
            return formatting.integer(
                raw, spec["minimum"], spec["maximum"], spec["key"]
            )
        except (ValueError, TypeError) as exc:
            raise display.DisplayConfigError(str(exc) or "expected an integer") from exc
    if spec["kind"] == "choice" and raw not in spec["choices"]:
        raise display.DisplayConfigError(
            msg('errors.editor_fields.expected_one_of', value0=', '.join(spec['choices']))
        )
    return None if spec["nullable"] and raw == "inherit" else raw


def set_value(config, key, raw, scope=None, item=None):
    fields = item_fields(scope, item) if scope is not None else GLOBAL
    spec = next((spec for spec in fields if spec["key"] == key), None)
    if spec is None:
        raise display.DisplayConfigError(msg('errors.editor_fields.unknown_editor_field'))
    parsed = parse_value(spec, raw)
    if scope is not None:
        return advanced.edit_item(
            config,
            scope,
            item,
            key,
            "inherit" if parsed is None and spec["kind"] == "text" else parsed,
        )
    data = config.to_dict()
    target = data
    parts = key.split(".")
    for part in parts[:-1]:
        target = target[part]
    target[parts[-1]] = parsed
    return display.validate_display_config(data)


def break_before(config, item, enabled):
    breaks = {row[0] for row in config.layout.rows[1:]}
    breaks.add(item) if enabled else breaks.discard(item)
    rows = []
    for current in config.items:
        if not rows or current in breaks:
            rows.append([])
        rows[-1].append(current)
    return advanced.edit_layout(config, "explicit", rows)


def preset_names():
    return list(presets.ROWS)
