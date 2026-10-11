"""Semantic differences between complete, normalized drafts; no I/O or merge."""

from copy import deepcopy
from claude_statusline.i18n import message, translate

SECTIONS = ("main", "subagent", "formatting", "layout", "language", "host")
KINDS = ("add", "remove", "enable", "disable", "reorder", "change")


def field_message(path):
    """Reuse editable field labels; all fallbacks are literal canonical paths."""
    if "options" in path:
        tail = path[path.index("options") + 1 :]
        name = tail[-1] if tail else "overrides"
        key = (
            "review.overrides"
            if name == "overrides"
            else "fields.item." + name + ".label"
        )
    elif path[0] == "host":
        key = "review.fields." + path[-1]
    elif len(path) == 2 and path[1] in (
        "use_colors",
        "palette",
        "directory_style",
        "separator_style",
        "scope_labels",
        "layout",
    ):
        key = "review.fields." + path[1]
    elif path == ["display", "subagents", "enabled"]:
        key = "review.fields.subagents_enabled"
    else:
        key = "fields.global." + ".".join(path[1:]) + ".label"
    if translate(key, "en") == key:
        return message("review.field", path=".".join(path))
    return message(key)


def differences(before, after):
    changes = []

    def add(section, kind, scope, identifier, path, old, new, type_id=None):
        label = message("review.component", item=identifier or ".".join(path))
        if identifier and type_id:
            name = message(f"items.{scope}.{type_id}.label")
            label = (
                message("review." + kind, item=name)
                if kind in ("enable", "disable", "add", "remove")
                else message("review.item_field", item=name, field=field_message(path))
            )
        elif kind == "reorder":
            label = message("review.reorder")
        elif kind == "change":
            label = field_message(path)
        changes.append(
            {
                "section": section,
                "kind": kind,
                "scope": scope,
                "item_id": identifier,
                "path": path,
                "before": deepcopy(old),
                "after": deepcopy(new),
                "label": label.wire(),
            }
        )

    def walk(old, new, path, section, scope=None, identifier=None, type_id=None):
        if old == new:
            return
        if isinstance(old, dict) and isinstance(new, dict):
            for key in sorted(set(old) | set(new)):
                walk(
                    old.get(key),
                    new.get(key),
                    [*path, key],
                    section,
                    scope,
                    identifier,
                    type_id,
                )
        else:
            add(section, "change", scope, identifier, path, old, new, type_id)

    old, new = before["display"], after["display"]
    for scope in ("main", "subagent"):
        left = old if scope == "main" else old["subagents"]
        right = new if scope == "main" else new["subagents"]
        root = ["display"] if scope == "main" else ["display", "subagents"]
        a = {i["id"]: i for i in left["instances"]}
        b = {i["id"]: i for i in right["instances"]}
        for identifier in dict.fromkeys([*a, *b]):
            previous, following = a.get(identifier), b.get(identifier)
            node = following or previous
            path = [*root, "instances", identifier]
            if previous is None or following is None:
                add(
                    scope,
                    "add" if following else "remove",
                    scope,
                    identifier,
                    path,
                    previous,
                    following,
                    node["type_id"],
                )
                continue
            if previous["enabled"] != following["enabled"]:
                add(
                    scope,
                    "enable" if following["enabled"] else "disable",
                    scope,
                    identifier,
                    [*path, "enabled"],
                    previous["enabled"],
                    following["enabled"],
                    node["type_id"],
                )
            for key in ("type_id", "options", "text"):
                walk(
                    previous[key],
                    following[key],
                    [*path, key],
                    "formatting" if key == "options" else scope,
                    scope,
                    identifier,
                    node["type_id"],
                )
        retained = set(a) & set(b)
        left_order, right_order = (
            [i for i in a if i in retained],
            [i for i in b if i in retained],
        )
        if left_order != right_order:
            add(
                scope,
                "reorder",
                scope,
                None,
                [*root, "instances"],
                left_order,
                right_order,
            )
    for key in sorted(
        set(old)
        - {
            "schema_version",
            "instances",
            "subagents",
            "layout",
            "statusline_language",
            "metrics",
        }
    ):
        walk(old[key], new[key], ["display", key], "formatting")
    for key in sorted(set(old["subagents"]) - {"instances"}):
        walk(
            old["subagents"][key],
            new["subagents"][key],
            ["display", "subagents", key],
            "subagent",
        )
    walk(old["metrics"], new["metrics"], ["display", "metrics"], "main")
    walk(old["layout"], new["layout"], ["display", "layout"], "layout")
    walk(
        old["statusline_language"],
        new["statusline_language"],
        ["display", "statusline_language"],
        "language",
    )
    walk(before["host"], after["host"], ["host"], "host")
    return sorted(changes, key=lambda c: SECTIONS.index(c["section"]))
