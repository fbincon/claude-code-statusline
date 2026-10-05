"""Pure mutations used by CLI and interactive draft editors."""

from dataclasses import replace

from claude_statusline.config import catalog, display, formatting


def edit_item(config, scope, item, option, value):
    if scope == "main":
        item = catalog.canonical_item(item)
    definitions = (
        display.ITEM_CATALOG if scope == "main" else display.SUBAGENT_ITEM_CATALOG
    )
    if scope not in ("main", "subagent") or item not in definitions:
        raise display.DisplayConfigError("unknown scoped item")
    current = config.item_options if scope == "main" else config.subagents.item_options
    options = dict(current)
    data = options.get(item, formatting.ItemOptions()).to_dict()
    key = option.replace("-", "_")
    if key in formatting.FORMAT_CHOICES:
        if value == "inherit":
            data["formatting"].pop(key, None)
        else:
            data["formatting"][key] = value
    elif key in ("label", "icon", "priority", "max_width"):
        if key in ("priority", "max_width"):
            try:
                value = None if value in (None, "none") else int(value)
            except (ValueError, TypeError) as exc:
                raise display.DisplayConfigError(
                    "width/priority must be an integer or none"
                ) from exc
        elif value == "inherit":
            value = None
        data[key] = value
    else:
        raise display.DisplayConfigError("unknown item option")
    try:
        options[item] = formatting.ItemOptions.parse(data)
    except ValueError as exc:
        raise display.DisplayConfigError(str(exc)) from exc
    return (
        config.with_updates(item_options=options)
        if scope == "main"
        else config.with_updates(
            subagents=config.subagents.with_updates(item_options=options)
        )
    )


def edit_layout(config, mode, rows=None):
    draft = {
        "mode": mode,
        "rows": rows
        or ([list(config.items)] if mode == "explicit" and config.items else []),
    }
    data = config.to_dict()
    data["layout"] = draft
    return display.validate_display_config(data)


def edit_subagent(config, field, value):
    if field == "hide_completed":
        if value not in ("on", "off", True, False):
            raise display.DisplayConfigError("hide-completed must be on/off")
        value = value in ("on", True)
    elif field in ("row_limit", "task_max_width"):
        try:
            value = None if value in ("none", None) else int(value)
        except (ValueError, TypeError) as exc:
            raise display.DisplayConfigError(
                "limit must be an integer or none"
            ) from exc
    return config.with_updates(subagents=replace(config.subagents, **{field: value}))
