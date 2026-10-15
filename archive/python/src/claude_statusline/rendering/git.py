"""Git component formatting shared by compound and independent display items."""

from __future__ import annotations

from claude_statusline.rendering import formatters
from claude_statusline.i18n import statusline


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


def divergence_markers(result, *, show_zero=False, language="en"):
    if result["upstream_gone"]:
        return [statusline.text("git.gone", language)]
    return [
        f"{symbol}{result[key]}"
        for key, symbol in (("ahead", "↑"), ("behind", "↓"))
        if result[key] or show_zero
    ]


def component(result, item, *, compact_staged=False, language="en"):
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
        return "Git " + (" ".join(markers) if markers else statusline.text("git.clean", language))
    if not result.get("upstream"):
        return None
    return "Git " + " ".join(divergence_markers(result, show_zero=True, language=language))
