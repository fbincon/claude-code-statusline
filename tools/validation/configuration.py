"""Inspect both historical type selections and current instance wire fixtures."""

from copy import deepcopy
from claude_statusline.config.formatting import ItemOptions


def selected_ids(value):
    return (
        [i["id"] for i in value["instances"] if i["enabled"]]
        if "instances" in value
        else value["items"]
    )


def all_ids(value):
    return (
        [i["id"] for i in value["instances"]]
        if "instances" in value
        else value["items"]
    )


def options(value, identifier):
    return (
        next(i["options"] for i in value["instances"] if i["id"] == identifier)
        if "instances" in value
        else value["item_options"][identifier]
    )


def configure_types(value, types):
    if "instances" not in value:
        value["items"] = list(types)
        return
    old = {i["type_id"]: i for i in value["instances"]}
    value["instances"] = [
        {
            "id": kind,
            "type_id": kind,
            "enabled": True,
            "text": None,
            "options": deepcopy(old[kind]["options"])
            if kind in old
            else ItemOptions().to_dict(),
        }
        for kind in types
    ]
