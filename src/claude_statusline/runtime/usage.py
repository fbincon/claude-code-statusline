"""runtime / usage implementation."""

from __future__ import annotations

import hashlib
import math
import os
from dataclasses import dataclass
from claude_statusline.rendering import formatters as rendering_formatters
from claude_statusline.rendering import items as rendering_items
from claude_statusline.runtime import cache as runtime_cache
from claude_statusline.runtime import paths as runtime_paths
from claude_statusline.runtime import transcript as runtime_transcript


@dataclass(frozen=True)
class SessionTokenCounts:
    """Observed integer totals, using the same all-session accounting as tokens."""

    hit: int
    miss: int
    out: int

    @property
    def input_tokens(self):
        return self.hit + self.miss


def _has_usage(usage, fields):
    return isinstance(usage, dict) and any(
        isinstance(usage.get(field), int)
        and not isinstance(usage[field], bool)
        and usage[field] >= 0
        for field in fields
    )


def session_token_counts(entry):
    """Extract one raw snapshot from collected state, without I/O or rounding.

    A missing observation is None; an observed all-zero response is a snapshot.
    Counts include cached input, uncached/written input and agent transcripts.
    """
    if not isinstance(entry, dict):
        return None
    records = entry.get("ids", {})
    snapshot = entry.get("api_snapshot")
    base = entry.get("base", {})
    observed = (
        isinstance(records, dict)
        and any(_has_usage(rec, runtime_paths._BASE) for rec in records.values())
        or _has_usage(snapshot, ("hit", "miss", "out"))
        or isinstance(base, dict)
        and any(_usage_int(value) > 0 for value in base.values())
    )
    if not observed:
        return None
    raw = entry.get("_raw_token_counts")
    if not isinstance(raw, dict) or set(raw) != {"hit", "miss", "out"}:
        raw = _display_usage_totals(entry)
    try:
        if not all(math.isfinite(value) and value >= 0 for value in raw.values()):
            return None
    except (TypeError, OverflowError):
        return None
    return SessionTokenCounts(raw["hit"], raw["miss"], raw["out"])


def _parse_usage(lines):
    # Only top-level "assistant" lines carry message.usage. The same
    # message.id is re-written as several snapshot lines (in subagent
    # transcripts usage even grows: output 0 first, final value later), so
    # within a batch keep the max of each field per id.
    out = {}
    for d in lines:
        if not isinstance(d, dict) or d.get("type") != "assistant":
            continue
        msg = d.get("message")
        if not isinstance(msg, dict):
            continue
        mid = msg.get("id")
        if not isinstance(mid, str) or not mid:
            continue  # cannot attribute usage: skip this snapshot
        usage = msg.get("usage")
        if not _has_usage(
            usage,
            (
                "input_tokens",
                "output_tokens",
                "cache_creation_input_tokens",
                "cache_read_input_tokens",
            ),
        ):
            continue  # snapshot without usage: a later one fills it in
        rec = out.setdefault(mid, dict(runtime_paths._BASE))
        for key, field in (
            ("i", "input_tokens"),
            ("o", "output_tokens"),
            ("cc", "cache_creation_input_tokens"),
            ("cr", "cache_read_input_tokens"),
        ):
            v = usage.get(field)
            if isinstance(v, int) and not isinstance(v, bool) and v > rec[key]:
                rec[key] = v
    return out


def _usage_int(value):
    return (
        value
        if isinstance(value, int) and not isinstance(value, bool) and value >= 0
        else 0
    )


def _parse_cost_snapshot(lines):
    """Return the last valid cumulative cost-state token snapshot in a batch."""
    latest = None
    latest_index = None
    last_timestamp = None
    for index, d in enumerate(lines):
        if isinstance(d, dict):
            timestamp = runtime_transcript._ts_to_epoch(d.get("timestamp"))
            if timestamp is not None:
                last_timestamp = timestamp
        if not isinstance(d, dict) or d.get("type") != "cost-state":
            continue
        model_usage = d.get("modelUsage")
        if not isinstance(model_usage, dict) or not model_usage:
            continue
        hit = miss = out = 0
        valid_models = 0
        for usage in model_usage.values():
            if not _has_usage(
                usage,
                (
                    "inputTokens",
                    "outputTokens",
                    "cacheCreationInputTokens",
                    "cacheReadInputTokens",
                ),
            ):
                continue
            valid_models += 1
            hit += _usage_int(usage.get("cacheReadInputTokens"))
            miss += _usage_int(usage.get("inputTokens"))
            miss += _usage_int(usage.get("cacheCreationInputTokens"))
            out += _usage_int(usage.get("outputTokens"))
        if valid_models:
            fingerprint = hashlib.sha256(
                f"{hit}:{miss}:{out}".encode("ascii")
            ).hexdigest()
            latest = {
                "fingerprint": fingerprint,
                "hit": hit,
                "miss": miss,
                "out": out,
                "_snapshot_ts": last_timestamp,
            }
            latest_index = index
    if latest is not None and latest_index is not None:
        latest["_post_ids"] = _parse_usage(lines[latest_index + 1 :])
    return latest


def _stage_cost_snapshot(entry, lines, force=False):
    snapshot = _parse_cost_snapshot(lines)
    if not isinstance(snapshot, dict):
        return
    current = entry.get("api_snapshot")
    current_fingerprint = (
        current.get("fingerprint") if isinstance(current, dict) else None
    )
    if force or snapshot.get("fingerprint") != current_fingerprint:
        entry["_pending_api_snapshot"] = snapshot


def _stage_subagent_snapshot_delta(entry, lines):
    pending = entry.get("_pending_api_snapshot")
    if not isinstance(pending, dict):
        return
    snapshot_ts = pending.get("_snapshot_ts")
    if not isinstance(snapshot_ts, (int, float)):
        return
    after_snapshot = []
    for record in lines:
        if not isinstance(record, dict) or record.get("type") != "assistant":
            continue
        timestamp = runtime_transcript._ts_to_epoch(record.get("timestamp"))
        if timestamp is not None and timestamp > snapshot_ts:
            after_snapshot.append(record)
    post_ids = pending.setdefault("_post_ids", {})
    _merge_ids(post_ids, _parse_usage(after_snapshot))


def _merge_ids(ids, new_ids):
    # Max-merge new records into `ids` in place. Values never decrease, so
    # rebuilt or rewound transcript files cannot shrink the session totals.
    changed = False
    for mid, nrec in new_ids.items():
        rec = ids.get(mid)
        if rec is None:
            ids[mid] = nrec
            changed = True
            continue
        for key in ("i", "o", "cc", "cr"):
            if nrec[key] > rec[key]:
                rec[key] = nrec[key]
                changed = True
    return changed


def _update_file(entry, path, session_id=None, track_prompts=False, track_cost=False):
    # One file per state check: stat first, then chunk-parse only what is new.
    # Per-id records live at session level so the same message.id seen in two
    # different files (e.g. after a resume writes a new transcript path) is
    # max-merged once instead of counted twice. With track_prompts set (main
    # transcript only), real user-prompt timestamps in the parsed lines
    # max-merge into entry["last_pt"].
    try:
        st = os.stat(path)
    except OSError:
        return False  # missing file: keep prior records, totals stay monotone
    size, mtime = st.st_size, st.st_mtime_ns
    f = entry["files"].get(path)
    if f is None:
        # First look at this file: parse it fully from offset 0. Creating the
        # file slot is a state change even when nothing was merged: it records
        # size/mtime so the next tick can skip this full parse.
        lines, end = runtime_transcript._read_transcript_chunk(path, 0)
        if not lines:
            return False
        entry["files"][path] = {"size": end, "mtime_ns": mtime}
        _merge_ids(entry["ids"], _parse_usage(lines))
        if track_prompts:
            runtime_transcript._maybe_update_turn(
                entry, lines, session_id, reset_context=True
            )
        if track_cost:
            _stage_cost_snapshot(entry, lines)
        else:
            _stage_subagent_snapshot_delta(entry, lines)
        return True
    esize = f["size"]
    if size < esize or (size == esize and mtime != f["mtime_ns"]):
        # Truncated or same-size rewrite: re-parse the whole file and max-merge
        # without resetting per-id records.
        lines, end = runtime_transcript._read_transcript_chunk(path, 0)
        if not lines:
            return False
        f["size"], f["mtime_ns"] = end, mtime
        _merge_ids(entry["ids"], _parse_usage(lines))
        if track_prompts:
            runtime_transcript._maybe_update_turn(
                entry, lines, session_id, reset_context=True
            )
        if track_cost:
            _stage_cost_snapshot(entry, lines)
        else:
            _stage_subagent_snapshot_delta(entry, lines)
        return True
    if size > esize:
        lines, end = runtime_transcript._read_transcript_chunk(path, esize)
        if not lines:
            return False  # only a partial tail: offset unchanged, retry later
        f["size"], f["mtime_ns"] = end, mtime
        _merge_ids(entry["ids"], _parse_usage(lines))
        if track_prompts:
            runtime_transcript._maybe_update_turn(entry, lines, session_id)
        if track_cost:
            _stage_cost_snapshot(entry, lines)
        else:
            _stage_subagent_snapshot_delta(entry, lines)
        return True
    return False  # unchanged: steady-state cost is one stat per file


def _aggregate_visible(entry):
    totals = dict(runtime_paths._BASE)
    records = [entry.get("base", runtime_paths._BASE)]
    records.extend(entry.get("ids", {}).values())
    for rec in records:
        for key in totals:
            totals[key] += _usage_int(rec.get(key)) if isinstance(rec, dict) else 0
    return totals


def _visible_semantic_totals(entry):
    raw = _aggregate_visible(entry)
    return {
        "hit": raw["cr"],
        "miss": raw["i"] + raw["cc"],
        "out": raw["o"],
    }


def _display_usage_totals(entry, visible=None):
    if visible is None:
        visible = _visible_semantic_totals(entry)
    snapshot = entry.get("api_snapshot")
    anchor = entry.get("api_visible_anchor")
    if not (isinstance(snapshot, dict) and isinstance(anchor, dict)):
        return visible
    return {
        key: _usage_int(snapshot.get(key))
        + max(0, _usage_int(visible.get(key)) - _usage_int(anchor.get(key)))
        for key in ("hit", "miss", "out")
    }


def _accept_pending_snapshot(entry, visible):
    pending = entry.pop("_pending_api_snapshot", None)
    if not isinstance(pending, dict):
        return False
    post_ids = pending.get("_post_ids")
    post_visible = _visible_semantic_totals(
        {
            "base": dict(runtime_paths._BASE),
            "ids": post_ids if isinstance(post_ids, dict) else {},
        }
    )
    candidate_display = {
        key: _usage_int(pending.get(key)) + post_visible[key]
        for key in ("hit", "miss", "out")
    }
    current = entry.get("api_snapshot")
    first_snapshot = not isinstance(current, dict)
    if not first_snapshot:
        displayed = _display_usage_totals(entry, visible)
        if any(
            candidate_display[key] < displayed[key] for key in ("hit", "miss", "out")
        ):
            return False
    entry["api_snapshot"] = {
        key: pending[key] for key in ("fingerprint", "hit", "miss", "out")
    }
    entry["api_visible_anchor"] = {
        key: max(0, visible[key] - post_visible[key]) for key in ("hit", "miss", "out")
    }
    return True


def _collapse_ids(entry):
    # If per-id records ever grow past MAX_IDS_PER_SESSION, fold the oldest
    # half into `base` with a sum (not a max: removed ids leave the max-merge
    # domain, so their contribution must be frozen). The aggregated total is
    # unchanged by construction.
    ids = entry["ids"]
    if len(ids) <= runtime_paths.MAX_IDS_PER_SESSION:
        return False
    base = entry["base"]
    for mid in list(ids)[: len(ids) // 2]:
        rec = ids.pop(mid)
        for key in ("i", "o", "cc", "cr"):
            base[key] += rec[key]
    return True


def _collect_subagent_files(subs_root):
    # Every spawned agent gets its own transcript file; nested spawns create
    # nested directories, so walk the whole tree. Only the agent-*.jsonl files
    # carry usage; their .meta.json siblings are irrelevant here.
    paths = []
    try:
        for root, _dirs, files in os.walk(subs_root):
            for fn in files:
                if fn.startswith("agent-") and fn.endswith(".jsonl"):
                    paths.append(os.path.join(root, fn))
    except OSError:
        return paths
    return sorted(paths)  # stable order keeps the saved state reproducible


def session_token_totals(data):
    # Cumulative API usage for this session. cost-state.modelUsage is the
    # authoritative all-call snapshot; main/subagent assistant messages add a
    # live delta after that snapshot. Returns (hit, miss, out, last_pt, entry).
    sid = rendering_formatters.deep_get(data, ("session_id",))
    tpath = rendering_formatters.deep_get(data, ("transcript_path",))
    if not sid or not tpath:
        return None
    sid = str(sid)
    tpath = os.path.abspath(tpath)
    try:
        lock_fd = runtime_cache._acquire_state_lock()
    except OSError:
        return None
    try:
        state, dropped = runtime_cache._load_state()
        entry = state["sessions"].setdefault(
            sid, {"files": {}, "ids": {}, "base": dict(runtime_paths._BASE)}
        )
        changed = dropped
        usage_rescan = False
        if _update_file(
            entry, tpath, session_id=sid, track_prompts=True, track_cost=True
        ):
            changed = True

        # Old entries already point at EOF. Do one lifecycle-only full scan to
        # recover prompt_id and interrupt markers without resetting counters.
        if entry.get("turn_scan_version") != runtime_paths.TURN_SCAN_VERSION:
            for key in (
                "last_pt",
                "last_prompt_id",
                "last_interrupt",
                "last_local_command",
                "last_assistant_ts",
            ):
                entry.pop(key, None)
            lines, _end = runtime_transcript._read_transcript_chunk(tpath, 0)
            if lines:
                runtime_transcript._maybe_update_turn(entry, lines, sid)
            entry["turn_scan_version"] = runtime_paths.TURN_SCAN_VERSION
            changed = True

        # Existing state entries already point at EOF. Scan only for the latest
        # authoritative cost snapshot; assistant message IDs remain untouched.
        if entry.get("usage_scan_version") != runtime_paths.USAGE_SCAN_VERSION:
            lines, _end = runtime_transcript._read_transcript_chunk(tpath, 0)
            if lines:
                _stage_cost_snapshot(entry, lines, force=True)
            entry["usage_scan_version"] = runtime_paths.USAGE_SCAN_VERSION
            usage_rescan = True
            changed = True
        # <transcript>.jsonl -> <transcript>/subagents (fallback: project dir).
        subs_root = os.path.splitext(tpath)[0] + os.sep + "subagents"
        if not os.path.isdir(subs_root):
            alt = os.path.join(os.path.dirname(tpath), sid, "subagents")
            if os.path.isdir(alt):
                subs_root = alt
        for sp in _collect_subagent_files(subs_root):
            if _update_file(entry, sp):
                changed = True
            if usage_rescan and isinstance(entry.get("_pending_api_snapshot"), dict):
                sub_lines, _sub_end = runtime_transcript._read_transcript_chunk(sp, 0)
                if sub_lines:
                    _stage_subagent_snapshot_delta(entry, sub_lines)
        if _collapse_ids(entry):
            changed = True
        visible = _visible_semantic_totals(entry)
        if _accept_pending_snapshot(entry, visible):
            changed = True
        if changed:
            state["sessions"].pop(sid, None)
            state["sessions"][sid] = entry  # re-insert = LRU touch
            while len(state["sessions"]) > runtime_paths.MAX_SESSIONS:
                state["sessions"].pop(next(iter(state["sessions"])))
            runtime_cache._save_state(state)
        displayed = _display_usage_totals(entry, visible)
        # Reuse these integers when independent items are selected. The extra
        # view belongs to this result only; it never enters the saved cache.
        result_entry = dict(entry, _raw_token_counts=displayed)
        return (
            rendering_items.humanize_api_tokens(displayed["hit"]),
            rendering_items.humanize_api_tokens(displayed["miss"]),
            rendering_items.humanize_api_tokens(displayed["out"]),
            entry.get("last_pt"),
            result_entry,
        )
    finally:
        runtime_cache._release_state_lock(lock_fd)
