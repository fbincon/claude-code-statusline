"""Scoped display instances and pure composition edits.

Types describe observations; instance IDs identify editable placements. Nothing in
this module reads configuration, collects observations, or writes files.
"""

from __future__ import annotations

from dataclasses import dataclass, field, replace
import re
from claude_statusline.i18n import message as msg

from . import catalog, formatting, appearance

NODE_TYPES = ("text", "spacer")
ID_PATTERN = re.compile(r"[A-Za-z0-9][A-Za-z0-9_-]{0,95}\Z")


@dataclass(frozen=True)
class DisplayInstance:
    id: str
    type_id: str
    enabled: bool = True
    options: formatting.ItemOptions = field(default_factory=formatting.ItemOptions)
    text: str | None = None

    def to_dict(self):
        return {
            "id": self.id,
            "type_id": self.type_id,
            "enabled": self.enabled,
            "options": self.options.to_dict(),
            "text": self.text,
        }

    @classmethod
    def parse(cls, value, scope):
        formatting.exact(
            value, ("id", "type_id", "enabled", "options", "text"), "instance"
        )
        identifier, type_id = value["id"], value["type_id"]
        if not isinstance(identifier, str) or not ID_PATTERN.fullmatch(identifier):
            raise ValueError(msg("composition.errors.id"))
        if not isinstance(type_id, str) or type_id not in (
            *catalog.BY_SCOPE[scope],
            *NODE_TYPES,
        ):
            raise ValueError(msg("composition.errors.unknown_type"))
        if type(value["enabled"]) is not bool:
            raise ValueError(msg("composition.errors.enabled"))
        options = formatting.ItemOptions.parse(value["options"])
        if type_id in NODE_TYPES:
            if options.visibility != "always" or options.formatting:
                raise ValueError(msg("composition.errors.node_options"))
            if type_id == "spacer" and options != formatting.ItemOptions():
                raise ValueError(msg("composition.errors.spacer_options"))
        else:
            appearance.validate_visibility(scope, type_id, options.visibility)
        text = value["text"]
        if type_id == "text":
            if not isinstance(text, str):
                raise ValueError(msg("composition.errors.literal"))
            formatting.safe_text(text, "text")
        elif text is not None:
            raise ValueError(msg("composition.errors.only_text"))
        return cls(identifier, type_id, value["enabled"], options, text)


def parse_instances(value, scope):
    if not isinstance(value, list):
        raise ValueError(msg("composition.errors.array"))
    result = tuple(DisplayInstance.parse(item, scope) for item in value)
    if len({i.id for i in result}) != len(result):
        raise ValueError(msg("composition.errors.duplicate"))
    types = [i.type_id for i in result if i.enabled and i.type_id not in NODE_TYPES]
    if catalog.conflicts(scope, types):
        raise ValueError(msg("composition.errors.conflict"))
    if scope == "subagent" and sum(i.type_id == "spacer" for i in result) > 1:
        raise ValueError(msg("composition.errors.subagent_spacer"))
    return result


def legacy_instances(scope, items, options):
    """The scoped canonical type is the deterministic ID of a migrated instance."""
    order = list(items) + [
        i for i in catalog.BY_SCOPE[scope] if i in options and i not in items
    ]
    return tuple(
        DisplayInstance(i, i, i in items, options.get(i, formatting.ItemOptions()))
        for i in order
    )


def projections(instances):
    return (
        tuple(i.id for i in instances if i.enabled),
        {i.id: i.options for i in instances if i.options != formatting.ItemOptions()},
    )


def update_projection(instances, scope, items=None, options=None):
    """Compatibility for the former Python selection/options constructors."""
    result = list(instances)
    by_id = {i.id: i for i in result}
    if items is not None:
        items = tuple(
            catalog.canonical_item(i) if scope == "main" and i not in by_id else i
            for i in items
        )
        for identifier in items:
            if identifier not in by_id:
                if identifier not in catalog.BY_SCOPE[scope]:
                    raise ValueError(msg("composition.errors.unknown_id"))
                node = DisplayInstance(identifier, identifier)
                result.append(node)
                by_id[identifier] = node
        result = [replace(by_id[i], enabled=True) for i in items] + [
            replace(i, enabled=False) for i in result if i.id not in items
        ]
    if options is not None:
        for identifier, option in options.items():
            if identifier not in {i.id for i in result}:
                if identifier not in catalog.BY_SCOPE[scope]:
                    raise ValueError(msg("composition.errors.options_id"))
                result.append(DisplayInstance(identifier, identifier, False, option))
        result = [
            replace(i, options=options.get(i.id, formatting.ItemOptions()))
            for i in result
        ]
    return tuple(result)


def scoped(config, scope):
    if scope not in ("main", "subagent"):
        raise ValueError(msg("composition.errors.scope"))
    return config if scope == "main" else config.subagents


def find(config, scope, identifier):
    return next(
        (i for i in scoped(config, scope).instances if i.id == identifier), None
    )


def legacy_id(config, scope, type_id, *, allow_absent=False):
    type_id = catalog.canonical_item(type_id) if scope == "main" else type_id
    matches = [i.id for i in scoped(config, scope).instances if i.type_id == type_id]
    if len(matches) > 1:
        raise ValueError(
            msg("composition.errors.ambiguous", type_id=type_id, scope=scope)
        )
    if matches:
        return matches[0]
    if allow_absent and type_id in catalog.BY_SCOPE[scope]:
        if find(config, scope, type_id) is not None:
            raise ValueError(msg("composition.errors.legacy", scope=scope))
        return type_id
    raise ValueError(msg("composition.errors.absent", type_id=type_id, scope=scope))


def replace_scope(config, scope, nodes):
    target = scoped(config, scope).with_updates(instances=tuple(nodes))
    return target if scope == "main" else config.with_updates(subagents=target)


def edit(
    config,
    scope,
    action,
    identifier=None,
    *,
    type_id=None,
    after=None,
    before=None,
    option=None,
    value=None,
    text=None,
):
    """Apply a pure edit, returning a validated configuration and selection ID."""
    if action == "add" and text is not None and type_id != "text":
        raise ValueError(msg("composition.errors.only_text"))
    nodes = list(scoped(config, scope).instances)
    node = next((i for i in nodes if i.id == identifier), None)
    if action not in ("add", "copy") and node is None:
        raise ValueError(msg("composition.errors.unknown_id"))
    selected = identifier
    if action in ("add", "copy"):
        if action == "copy" and node is None:
            raise ValueError(msg("composition.errors.unknown_id"))
        import uuid

        selected = "i-" + uuid.uuid4().hex
        new = (
            replace(node, id=selected)
            if action == "copy"
            else DisplayInstance(
                selected, type_id, text=(text or "") if type_id == "text" else None
            )
        )
        anchor = (
            after if after is not None else identifier if action == "copy" else None
        )
        index = (
            len(nodes)
            if anchor is None
            else next((n + 1 for n, i in enumerate(nodes) if i.id == anchor), -1)
        )
        if index < 0:
            raise ValueError(msg("composition.errors.anchor"))
        nodes.insert(index, new)
    elif action == "remove":
        index = nodes.index(node)
        nodes.remove(node)
        selected = nodes[min(index, len(nodes) - 1)].id if nodes else None
    elif action == "move":
        if (after is None) == (before is None):
            raise ValueError(msg("composition.errors.move"))
        anchor = after if after is not None else before
        if anchor == identifier:
            return config, selected
        nodes.remove(node)
        index = next((n for n, i in enumerate(nodes) if i.id == anchor), -1)
        if index < 0:
            raise ValueError(msg("composition.errors.anchor"))
        nodes.insert(index + (after is not None), node)
    elif action in ("enable", "disable"):
        nodes[nodes.index(node)] = replace(node, enabled=action == "enable")
    elif action == "set":
        if option == "text":
            nodes[nodes.index(node)] = replace(node, text=value)
        else:
            from .advanced import edited_options

            nodes[nodes.index(node)] = replace(
                node, options=edited_options(node.options, option, value)
            )
    else:
        raise ValueError(msg("composition.errors.action"))
    return replace_scope(config, scope, nodes), selected


def reconcile_rows(layout, nodes):
    """Retain row boundaries, growing the insertion row for newly added nodes."""
    if layout.mode != "explicit":
        return layout
    identities = [i.id for i in nodes]
    if not layout.rows:
        return formatting.Layout("explicit", (tuple(identities),) if identities else ())
    membership = {
        identifier: n for n, row in enumerate(layout.rows) for identifier in row
    }
    sizes = [0] * len(layout.rows)
    current = next((membership[i] for i in identities if i in membership), 0)
    for identifier in identities:
        current = membership.get(identifier, current)
        sizes[current] += 1
    rows, offset = [], 0
    for size in sizes:
        if size:
            rows.append(tuple(identities[offset : offset + size]))
            offset += size
    return formatting.Layout("explicit", tuple(rows))
