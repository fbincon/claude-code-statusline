"""Read-only task metric views with explicit coverage and clock limitations."""

from claude_statusline.config import runtime
from claude_statusline.runtime.live import store as live_store
from claude_statusline.runtime.tasks import store
from claude_statusline.runtime.timing.clock import Sample, StatusTimer


def active_point(config_dir, session_id, prompt_id=None):
    result = {
        "value": None,
        "reason": "not_observed",
        "source": "native_task_timing",
        "partial": False,
        "observed_at_ms": None,
    }
    if not session_id:
        return result
    if not runtime.load(config_dir).native_timing:
        return dict(result, reason="native_timing_disabled")
    record = store.load_turn_state(session_id, prompt_id, config_dir=config_dir)
    if record is None:
        return result
    if record.get("historical_frozen"):
        return dict(result, reason="incomplete")
    reason = record.get("active_coverage") or "not_observed"
    if reason != "complete":
        return dict(result, reason=reason)
    if record["status"] == "running" and not live_store.fresh(
        live_store.load(config_dir, session_id)
    ):
        return dict(result, reason="stale")
    timer = StatusTimer.load(record.get("active_clock"))
    if timer is None or (record["status"] != "running" and timer.frozen_ns is None):
        return dict(result, reason="incomplete")
    if record["status"] != "running" and timer.waits:
        return dict(result, reason="incomplete")
    if (
        timer.degraded
        or timer.last_resume.boot_id is None
        or timer.last_resume.boot_ns is None
    ):
        return dict(result, reason="abnormal_clock")
    now = Sample(*store.now_clocks())
    if timer.frozen_ns is None and not timer.trusted_sample(now):
        return dict(result, reason="abnormal_clock")
    value = timer.elapsed(now)
    return dict(
        result,
        value=None if value is None else value / 1e9,
        reason="abnormal_clock" if value is None else None,
        observed_at_ms=record.get("updated_wall_ns", 0) / 1e6,
    )
