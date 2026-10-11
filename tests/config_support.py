"""Readable schema-8 wire fixtures and explicit historical wire conversion."""

from copy import deepcopy
from claude_statusline.config import display, instances


def selected_ids(value):
    return [i["id"] for i in value["instances"] if i["enabled"]]


def instance_options(value, identifier):
    return next(i["options"] for i in value["instances"] if i["id"] == identifier)


def set_selection(value, identifiers):
    existing = {i["id"]: deepcopy(i) for i in value["instances"]}
    result = []
    for identifier in identifiers:
        node = existing.pop(
            identifier, instances.DisplayInstance(identifier, identifier).to_dict()
        )
        node["enabled"] = True
        result.append(node)
    for node in existing.values():
        node["enabled"] = False
        result.append(node)
    value["instances"] = result


def legacy_display(value):
    result = display.validate_display_config(value).legacy_dict()
    result["schema_version"] = 7
    return result


def set_instance_options(value, identifier, options):
    node = next((i for i in value["instances"] if i["id"] == identifier), None)
    if node is None:
        node = instances.DisplayInstance(identifier, identifier, False).to_dict()
        value["instances"].append(node)
    node["options"] = options
