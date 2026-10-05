"""Format live points without collection or persistence."""

from claude_statusline.rendering import preferences

LABELS = {
    "run-state": "State",
    "permission-mode": "Mode",
    "active-agents": "Agents",
    "task-progress": "Tasks",
    "last-tool": "Tool",
}


def metric(points, item, fmt):
    record = points.get(item, {})
    value = record.get("value")
    suffix = "*" if record.get("partial") else ""
    if value is None:
        value = "—"
    elif item == "active-agents":
        value = preferences.number(value, fmt)
    elif item == "task-progress":
        value = f"{value['completed']}/{value['total']}"
    elif item == "last-tool":
        value = f"{value['name']} {value['status']}"
    return f"{LABELS[item]} {value}{suffix}"
