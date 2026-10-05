"""Format live points without collection or persistence."""

from claude_statusline.rendering import preferences

LABELS = {
    "run-state": "State",
    "permission-mode": "Mode",
    "active-agents": "Agents",
    "task-progress": "Tasks",
    "last-tool": "Tool",
    "ttft": "TTFT(host)",
    "output-rate": "Rate",
    "prompt-input-tokens": "Prompt in",
    "prompt-output-tokens": "Prompt out",
    "prompt-cost": "Prompt cost",
}


def metric(points, item, fmt):
    record = points.get(item, {})
    value = record.get("value")
    suffix = "*" if record.get("partial") else ""
    if value is None:
        value = "—"
    elif item in ("active-agents", "prompt-input-tokens", "prompt-output-tokens"):
        value = preferences.number(value, fmt)
    elif item == "task-progress":
        value = f"{value['completed']}/{value['total']}"
    elif item == "last-tool":
        value = f"{value['name']} {value['status']}"
    elif item == "ttft":
        value = f"{value:.3f}s"
    elif item == "output-rate":
        value = f"{value:.3g} tok/s"
    elif item == "prompt-cost":
        value = "$" + (
            preferences.money(value, fmt) if value >= 0.01 else f"{value:.6g}"
        )
    return f"{LABELS[item]} {value}{suffix}"
