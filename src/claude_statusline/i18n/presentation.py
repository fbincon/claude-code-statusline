"""Localized editor metadata; identifiers and editable values stay canonical."""

from claude_statusline.i18n import LANGUAGE_NAMES, translate
from claude_statusline.config import catalog

SETTING_LABELS = {
    "colors": "Use colors",
    "palette": "Palette",
    "directory-style": "Directory style",
    "separator-style": "Separator style",
    "padding": "Padding",
    "refresh_interval": "Refresh interval",
    "vim-indicator": "Built-in Vim indicator",
    "scope-labels": "Scope labels",
    "custom-subagent-rows": "Custom subagent rows",
    "ui-language": "Interface language (saved immediately)",
}


def group_key(group):
    return "groups." + group.lower().replace(" / ", ".").replace(" ", "-")


def field_label(row, language):
    key = row["key"]
    if key in SETTING_LABELS:
        return translate("settings." + key, language)
    if key.startswith("field:"):
        return translate("fields.global." + key[6:] + ".label", language)
    if key.startswith("item:"):
        return translate("fields.item." + key[5:] + ".label", language)
    if key.startswith("fit:"):
        _, item, field = key.split(":")
        return item + " " + translate("fields.item." + field + ".label", language)
    if key.startswith("break:"):
        return translate("layout.break_before", language, item=key[6:])
    return translate("settings." + key, language)


def value_label(row, language):
    value, key = row["value"], row["key"]
    if key == "ui-language":
        return LANGUAGE_NAMES[value]
    if key == "preset-select":
        return translate("presets." + value, language)
    if row["kind"] == "action":
        return translate("actions." + key, language)
    if row["kind"] in ("choice", "boolean", "legacy"):
        value = (
            "inherit"
            if value is None
            else "on"
            if value is True
            else "off"
            if value is False
            else str(value)
        )
        if value in (
            "on",
            "off",
            "inherit",
            "default",
            "ansi",
            "full",
            "home",
            "project-relative",
            "basename",
            "classic",
            "compact",
            "when-subagents",
            "always",
            "event",
            "hide",
            "show",
            "auto",
            "explicit",
            "original",
            "short",
            "legacy",
            "grouped",
            "unicode",
            "ascii",
            "remaining",
            "used",
            "countdown",
            "time",
            "datetime",
            "local",
            "UTC",
            "all",
            "running",
        ):
            return translate("values." + value, language)
    return translate("values.inherit", language) if value is None else str(value)


def rows(state):
    from claude_statusline.ui import forms

    return [
        {
            **row,
            "label": field_label(row, state.language),
            "group": translate(group_key(row["group"]), state.language),
            "display_value": value_label(row, state.language),
        }
        for row in forms.rows(state)
    ]


def search_text(scope, item, custom_label=None):
    definition = catalog.BY_SCOPE[scope][item]
    return " ".join(
        [
            item,
            definition.label,
            definition.description,
            custom_label or "",
            translate(f"items.{scope}.{item}.label", "zh-CN"),
            translate(f"items.{scope}.{item}.description", "zh-CN"),
        ]
    ).casefold()
