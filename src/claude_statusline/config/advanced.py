"""Pure mutations used by CLI and interactive draft editors."""

from claude_statusline.i18n import message as msg, as_message

from dataclasses import replace

from claude_statusline.config import catalog, display, formatting


def edit_item(config, scope, item, option, value):
    from . import instances

    node = instances.find(config, scope, item)
    if node is None and scope == "main":
        item = catalog.canonical_item(item)
        node = instances.find(config, scope, item)
    if node is None:
        if item not in catalog.BY_SCOPE.get(scope, {}):
            raise display.DisplayConfigError(msg("errors.advanced.unknown_scoped_item"))
    current = config.item_options if scope == "main" else config.subagents.item_options
    options = dict(current)
    options[item] = edited_options(
        options.get(item, formatting.ItemOptions()), option, value
    )
    return (
        config.with_updates(item_options=options)
        if scope == "main"
        else config.with_updates(
            subagents=config.subagents.with_updates(item_options=options)
        )
    )


def edited_options(current, option, value):
    data = current.to_dict()
    key = option.replace("-", "_")
    if key in formatting.FORMAT_CHOICES:
        if value == "inherit":
            data["formatting"].pop(key, None)
        else:
            data["formatting"][key] = value
    elif key in (
        "label",
        "icon",
        "priority",
        "max_width",
        "foreground",
        "background",
        "visibility",
        "visibility_threshold",
    ):
        if key in ("priority", "max_width", "visibility_threshold"):
            try:
                value = None if value in (None, "none") else int(value)
            except (ValueError, TypeError) as exc:
                raise display.DisplayConfigError(
                    msg("errors.advanced.width_priority_must_be_an_integer_or")
                ) from exc
        elif value == "inherit":
            value = None
        data[key] = value
    else:
        raise display.DisplayConfigError(msg("errors.advanced.unknown_item_option"))
    try:
        return formatting.ItemOptions.parse(data)
    except ValueError as exc:
        raise display.DisplayConfigError(as_message(exc)) from exc


def edit_layout(config, mode, rows=None):
    if rows:
        known = {i.id for i in config.instances}
        rows = [
            [i if i in known else catalog.canonical_item(i) for i in row]
            for row in rows
        ]
    draft = {
        "mode": mode,
        "rows": rows
        or (
            [[i.id for i in config.instances]]
            if mode == "explicit" and config.items
            else []
        ),
    }
    try:
        parsed = formatting.Layout.parse(
            draft,
            tuple(i for row in draft["rows"] for i in row)
            if mode == "explicit"
            else (),
        )
        return config.with_updates(layout=parsed)
    except ValueError as exc:
        raise display.DisplayConfigError(as_message(exc)) from exc


def edit_subagent(config, field, value):
    if field == "hide_completed":
        if value not in ("on", "off", True, False):
            raise display.DisplayConfigError(
                msg("errors.advanced.hide_completed_must_be_on_off")
            )
        value = value in ("on", True)
    elif field in ("row_limit", "task_max_width"):
        try:
            value = None if value in ("none", None) else int(value)
        except (ValueError, TypeError) as exc:
            raise display.DisplayConfigError(
                msg("errors.advanced.limit_must_be_an_integer_or_none")
            ) from exc
    return config.with_updates(subagents=replace(config.subagents, **{field: value}))
