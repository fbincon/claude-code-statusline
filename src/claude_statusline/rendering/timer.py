"""rendering / timer implementation."""

from __future__ import annotations

from claude_statusline.rendering import formatters as rendering_formatters
from claude_statusline.rendering import palette as rendering_palette
from claude_statusline.runtime.turns import store as turn_store
from claude_statusline.i18n import statusline


def _fmt_duration(seconds, nearest=False):
    return rendering_formatters.format_duration(seconds, nearest=nearest)


def _state_elapsed_seconds(state, last_pt):
    if not isinstance(state, dict):
        return None
    from claude_statusline.runtime.timing.clock import Sample, task_elapsed

    elapsed = task_elapsed(state, Sample(*turn_store.now_clocks()))
    return None if elapsed is None else elapsed / 1_000_000_000


def _render_state_timer(state, last_pt, palette=rendering_palette.DEFAULT_PALETTE, *, language="en"):
    if not isinstance(state, dict) or state.get("status") in ("ignored", "withdrawn"):
        return None
    elapsed = _state_elapsed_seconds(state, last_pt)
    status = state.get("status")
    formatted = _fmt_duration(elapsed, nearest=status != "running")
    if not formatted:
        return None
    if status == "running":
        phase = state.get("phase")
        if phase == "stop_pending":
            return f"{palette.timer}? {formatted}+{palette.reset}"
        if phase == "waiting_subagents":
            active = state.get("active_agents")
            count = len(active) if isinstance(active, dict) else 0
            agents = statusline.text("timer.waiting.one" if count == 1 else "timer.waiting.many", language, count=count)
            return f"{palette.timer}⏳ {agents} · {formatted}{palette.reset}"
        if phase == "resuming_main":
            return f"{palette.timer}⏳ {statusline.text('timer.wrap_up', language)} · {formatted}{palette.reset}"
    marker = {
        "running": "⏱",
        "completed": "✓",
        "interrupted": "■",
        "failed": "✗",
        "unknown": "?",
    }.get(status, "?")
    suffix = "+" if status == "unknown" else ""
    return f"{palette.timer}{marker} {formatted}{suffix}{palette.reset}"


def _timer_segment(
    sid, prompt_id, last_pt, entry, palette=rendering_palette.DEFAULT_PALETTE, *, language="en"
):
    """Compatibility entry: collect once, then format a lifecycle snapshot."""
    from claude_statusline.runtime.tasks.collect import collect

    return _render_state_timer(
        collect(sid, prompt_id, last_pt, entry), last_pt, palette, language=language
    )
