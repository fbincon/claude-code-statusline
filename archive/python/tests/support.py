"""Stable repository locations for subprocess and terminal tests."""

from pathlib import Path

REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = REPOSITORY_ROOT / "src"


def render_main_items(data, *selected, now=2_000_000_000, width=2000):
    """Render selected production items with a fixed clock and no scope prefix."""
    from unittest import mock
    from claude_statusline.config import display
    from claude_statusline.rendering import items, layout

    config = display.DEFAULT_CONFIG.with_updates(
        items=selected, use_colors=False, scope_labels="off"
    )
    with mock.patch.object(items.time, "time", return_value=now):
        segments, separator, reset = items._configured_segments(data, config)
    return "\n".join(
        layout._layout_segments(segments, width, separator=separator, reset=reset)
    )
