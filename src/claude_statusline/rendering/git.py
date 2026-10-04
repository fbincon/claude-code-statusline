"""Git component formatting shared by compound and independent display items."""

from __future__ import annotations

from claude_statusline.rendering import formatters


def change_markers(result, *, compact_staged=False):
    markers = []
    for key, symbol in (
        ("staged", "●" if compact_staged else "● "),
        ("unstaged", "~"),
        ("conflicts", "!"),
        ("untracked", "?"),
    ):
        if result[key]:
            markers.append(f"{symbol}{result[key]}")
    return markers


def divergence_markers(result, *, show_zero=False):
    if result["upstream_gone"]:
        return ["[gone]"]
    return [
        f"{symbol}{result[key]}"
        for key, symbol in (("ahead", "↑"), ("behind", "↓"))
        if result[key] or show_zero
    ]


def component(result, item, *, compact_staged=False):
    if not isinstance(result, dict) or result.get("kind") == "not_repo":
        return None
    if result.get("kind") == "error":
        return "Git!"
    if result.get("kind") != "ok":
        return None
    if item == "git-branch":
        branch = formatters.sanitize_payload_text(result["branch"])
        return f"Git {branch}" if branch else None
    if item == "git-changes":
        markers = change_markers(result, compact_staged=compact_staged)
        return "Git " + (" ".join(markers) if markers else "clean")
    if not result.get("upstream"):
        return None
    return "Git " + " ".join(divergence_markers(result, show_zero=True))
