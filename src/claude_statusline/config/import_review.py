"""Semantic differences between complete, normalized drafts; no I/O or merge."""

from copy import deepcopy
from claude_statusline.i18n import message, translate

SECTIONS = ("main", "subagent", "formatting", "layout", "language", "host")
KINDS = ("enable", "disable", "reorder", "change")


def field_message(path):
    """Reuse editable field labels; all fallbacks are literal canonical paths."""
    if "item_options" in path:
        tail = path[path.index("item_options") + 2:]
        name = tail[-1] if tail else "overrides"
        key = "review.overrides" if name == "overrides" else "fields.item." + name + ".label"
    elif path[0] == "host":
        key = "review.fields." + path[-1]
    elif len(path) == 2 and path[1] in ("use_colors", "palette", "directory_style", "separator_style", "scope_labels", "layout"):
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

    def add(section, kind, scope, item, path, old, new):
        if kind in ("enable", "disable"):
            label = message("review." + kind, item=message(f"items.{scope}.{item}.label"))
        elif kind == "reorder":
            label = message("review.reorder")
        else:
            label = field_message(path)
            if item:
                label = message("review.item_field", item=message(f"items.{scope}.{item}.label"), field=label)
        changes.append({"section": section, "kind": kind, "scope": scope, "item_id": item,
                        "path": path, "before": deepcopy(old), "after": deepcopy(new), "label": label.wire()})

    def walk(old, new, path, section, scope=None, item=None):
        if old == new:
            return
        if isinstance(old, dict) and isinstance(new, dict):
            for key in sorted(set(old) | set(new)):
                walk(old.get(key), new.get(key), [*path, key], section, scope, item)
        else:
            add(section, "change", scope, item, path, old, new)

    old, new = before["display"], after["display"]
    for scope, path, old_items, new_items in (
        ("main", ["display", "items"], old["items"], new["items"]),
        ("subagent", ["display", "subagents", "items"], old["subagents"]["items"], new["subagents"]["items"]),
    ):
        for item in old_items:
            if item not in new_items:
                add(scope, "disable", scope, item, path, True, False)
        for item in new_items:
            if item not in old_items:
                add(scope, "enable", scope, item, path, False, True)
        retained = set(old_items) & set(new_items)
        previous, following = [i for i in old_items if i in retained], [i for i in new_items if i in retained]
        if previous != following:
            add(scope, "reorder", scope, None, path, previous, following)
        root = ["display"] if scope == "main" else ["display", "subagents"]
        left = old if scope == "main" else old["subagents"]
        right = new if scope == "main" else new["subagents"]
        for item in sorted(set(left["item_options"]) | set(right["item_options"])):
            walk(left["item_options"].get(item), right["item_options"].get(item), [*root, "item_options", item], "formatting", scope, item)
    for key in sorted(set(old) - {"schema_version", "items", "item_options", "subagents", "layout", "statusline_language", "metrics"}):
        walk(old[key], new[key], ["display", key], "formatting")
    for key in sorted(set(old["subagents"]) - {"items", "item_options"}):
        walk(old["subagents"][key], new["subagents"][key], ["display", "subagents", key], "subagent", "subagent")
    walk(old["metrics"], new["metrics"], ["display", "metrics"], "main", "main", "branch-diff")
    if old["layout"] != new["layout"]:
        add("layout", "change", None, None, ["display", "layout"], old["layout"], new["layout"])
    walk(old["statusline_language"], new["statusline_language"], ["display", "statusline_language"], "language")
    walk(before["host"], after["host"], ["host"], "host")
    return sorted(changes, key=lambda change: SECTIONS.index(change["section"]))
