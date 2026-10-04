"""Advanced curses forms; file operations stay in the terminal session."""

from claude_statusline.config import advanced, editor_fields, presets, catalog
from claude_statusline.ui import models


def special(state):
    return state.form_item is not None or state.page == "layout"


def shown(value):
    return (
        "inherit"
        if value is None
        else "on"
        if value is True
        else "off"
        if value is False
        else str(value)
    )


def rows(state):
    config = state.display
    if state.form_item:
        scope, item = state.form_item
        return [
            {
                **spec,
                "key": "item:" + spec["key"],
                "value": editor_fields.value(config, spec["key"], scope, item),
            }
            for spec in editor_fields.ITEM
        ]
    if state.page == "layout":
        result = [
            {
                **editor_fields.field(
                    "layout-mode", "Layout mode", "Layout", choices=("auto", "explicit")
                ),
                "value": config.layout.mode,
            }
        ]
        starts = {row[0] for row in config.layout.rows[1:]}
        for item in config.items:
            if item != config.items[0]:
                result.append(
                    {
                        **editor_fields.field(
                            "break:" + item,
                            "New row before " + item,
                            "Row boundaries",
                            "boolean",
                        ),
                        "value": item in starts,
                    }
                )
            for spec in editor_fields.ITEM[2:4]:
                result.append(
                    {
                        **spec,
                        "key": "fit:" + item + ":" + spec["key"],
                        "label": item + " " + spec["label"],
                        "value": editor_fields.value(config, spec["key"], "main", item),
                    }
                )
        return result
    result = [
        {"key": "legacy:" + str(i), "label": name, "value": value, "kind": "legacy"}
        for i, (name, value) in enumerate(
            zip(models.SETTING_NAMES, state.setting_values())
        )
    ]
    result.extend(
        {
            **spec,
            "key": "field:" + spec["key"],
            "value": editor_fields.value(config, spec["key"]),
        }
        for spec in editor_fields.GLOBAL
    )
    result.extend(
        [
            {
                **editor_fields.field(
                    "preset-select", "Preset", "Portable files", choices=presets.ROWS
                ),
                "value": state.preset,
            },
            {
                "key": "preset-apply",
                "label": "Expand selected preset",
                "kind": "action",
                "value": "Enter: replace draft",
            },
            {
                "key": "import-file",
                "label": "Import file",
                "kind": "action",
                "value": "Enter path; save later",
            },
            {
                "key": "export-file",
                "label": "Export current draft",
                "kind": "action",
                "value": "Enter new path (may be unsaved)",
            },
        ]
    )
    return result


def index(state):
    return state.form_index if special(state) else state.setting_index


def select(state, selected):
    selected = max(0, min(len(rows(state)) - 1, selected))
    if special(state):
        state.form_index = selected
    else:
        state.setting_index = selected


def current(state):
    select(state, index(state))
    return rows(state)[index(state)]


def set_value(state, row, raw):
    key = row["key"]
    if key == "preset-select":
        state.preset = raw
    elif key == "layout-mode":
        state.display = advanced.edit_layout(state.display, raw)
    elif key.startswith("break:"):
        state.display = editor_fields.break_before(state.display, key[6:], raw)
    elif key.startswith("fit:"):
        _, item, option = key.split(":")
        state.display = editor_fields.set_value(
            state.display, option, raw, "main", item
        )
    elif key.startswith("item:"):
        state.display = editor_fields.set_value(
            state.display, key[5:], raw, *state.form_item
        )
    elif key.startswith("field:"):
        state.display = editor_fields.set_value(state.display, key[6:], raw)
    state.notice = ""


def adjust(state, direction):
    row = current(state)
    if row["kind"] == "boolean":
        set_value(state, row, not row["value"])
    elif row["kind"] == "choice":
        choices = row["choices"]
        set_value(
            state,
            row,
            choices[(choices.index(row["value"]) + direction) % len(choices)],
        )
    elif row["kind"] == "integer":
        set_value(
            state,
            row,
            max(
                row["minimum"],
                min(row["maximum"], (row["value"] or row["minimum"]) + direction),
            ),
        )


def begin(state):
    row = current(state)
    if row["key"] == "preset-apply":
        state.pending_action = "preset"
        return "transfer"
    if row["key"] in ("import-file", "export-file"):
        state.form_input = {"row": row, "buffer": state.path}
    elif row["kind"] in ("integer", "text"):
        state.form_input = {"row": row, "buffer": shown(row["value"])}
    else:
        adjust(state, 1)
    return None


def accept(state):
    row, buffer = state.form_input["row"], state.form_input["buffer"]
    if row["key"] in ("import-file", "export-file"):
        if not buffer.strip():
            state.notice = "Enter a file path."
            return None
        state.path = buffer
        state.pending_action = row["key"].split("-")[0]
        state.form_input = None
        return "transfer"
    set_value(state, row, buffer)
    state.form_input = None
    return None


def replace_draft(state, draft):
    from claude_statusline.ui.protocol import validate_draft

    state.display, state.host = validate_draft(draft, require_current_schema=True)
    state.enabled = set(state.display.items)
    state.subagent_enabled = set(state.display.subagents.items)
    state.item_order = list(state.display.items) + [
        i for i in catalog.BY_SCOPE["main"] if i not in state.enabled
    ]
    state.subagent_item_order = list(state.display.subagents.items) + [
        i for i in catalog.BY_SCOPE["subagent"] if i not in state.subagent_enabled
    ]
    state.numeric_edit = None
    state.form_item = None
    state.form_index = state.form_scroll = state.setting_index = (
        state.settings_scroll
    ) = 0
