#!/usr/bin/env python3
# Claude Code status line renderer.
# Reads the statusline JSON from stdin and prints adaptive colored rows:
#   model-id effort | dir | branch ↑ahead↓behind● staged~unstaged
#   | Context N% left · size window
#   | 5h N% left · weekly N% left · spend N% left | in · out
# Rows are packed to the terminal width reported in COLUMNS. Long fields are
# preserved and split safely instead of being truncated; directory paths prefer
# slash boundaries when a single path is wider than the available row.
# The in/out segments are this session's cumulative API input/output tokens,
# computed from the session transcript (see session_token_totals); in the git
# segment ↑/↓ show upstream divergence and ●/~/!/? count staged, unstaged,
# conflicted, and untracked files. Zero counts are omitted, so a clean,
# synchronized repo shows just the branch; segments whose data is missing are
# omitted.
import datetime
import fcntl
import hashlib
import json
import math
import os
import re
import subprocess
import sys
import tempfile
import time
import unicodedata
from dataclasses import dataclass

from .turn_state import (
    load_turn_state,
    now_clocks,
    reconcile_idle_state,
    reconcile_transcript_events,
)

C_RESET = "\033[0m"
C_MODEL = "\033[1;38;2;246;226;183m"   # bold ivory/cream #F6E2B7
C_DIR = "\033[1;38;2;171;223;167m"     # bold light green #ABDFA7
C_BRANCH = "\033[1;38;2;200;169;238m"  # bold lavender #C8A9EE
C_GIT_ERROR = "\033[1;38;2;242;134;134m"  # bold warning red #F28686
C_PCT = "\033[1;38;2;242;181;144m"     # bold light peach-orange #F2B590
C_SIZE = "\033[1;38;2;242;181;144m"    # bold light peach-orange #F2B590
C_TOKENS = "\033[1;38;2;233;144;169m"  # bold pink #E990A9
C_TIMER = "\033[1;38;2;142;211;211m"   # bold light cyan #8ED3D3
C_SEP = "\033[90m | \033[0m"   # dim gray separator between top-level segments
C_JOIN = "\033[90m · \033[0m"  # dim gray middle dot, joins segments that read as one item

ANSI_SGR_RE = re.compile(r"\x1b\[[0-9;:]*m")
DEFAULT_TERMINAL_COLUMNS = 120
STATUSLINE_WIDTH_MARGIN = 2
MIN_CONTENT_WIDTH = 2  # a single terminal-wide Unicode character must fit


@dataclass(frozen=True)
class _LayoutSegment:
    text: str
    prefer_slash_breaks: bool = False


@dataclass(frozen=True)
class _StyledUnit:
    text: str
    width: int
    style: str


def _char_width(ch):
    """Return a dependency-free approximation of terminal cell width."""
    if not ch or unicodedata.combining(ch):
        return 0
    category = unicodedata.category(ch)
    if category in ("Cc", "Cf"):
        return 0
    return 2 if unicodedata.east_asian_width(ch) in ("W", "F") else 1


def _display_width(text):
    """Measure visible terminal cells while ignoring the SGR sequences we emit."""
    plain = ANSI_SGR_RE.sub("", text or "")
    return sum(_char_width(ch) for ch in plain)


def _terminal_content_width(env=None):
    """Return usable statusline cells, with a stable fallback for manual runs."""
    source = os.environ if env is None else env
    try:
        columns = int(source.get("COLUMNS", ""))
        if columns <= 0:
            raise ValueError
    except (TypeError, ValueError):
        columns = DEFAULT_TERMINAL_COLUMNS
    return max(MIN_CONTENT_WIDTH, columns - STATUSLINE_WIDTH_MARGIN)


def _sgr_style_after(sequence):
    """Track the simple full-style SGR sequences used by this renderer."""
    params = sequence[2:-1]
    values = params.replace(":", ";").split(";") if params else ["0"]
    resets = "0" in values
    non_reset = any(value not in ("", "0") for value in values)
    if resets and not non_reset:
        return ""
    # Every non-reset SGR emitted above is a complete style, not a partial
    # modifier, so replacing the active style is both sufficient and safer.
    return sequence


def _styled_units(text):
    """Convert ANSI-colored text into visible units carrying their active style."""
    units = []
    style = ""
    position = 0
    for match in ANSI_SGR_RE.finditer(text):
        for ch in text[position:match.start()]:
            width = _char_width(ch)
            if width == 0 and units and units[-1].style == style:
                previous = units[-1]
                units[-1] = _StyledUnit(previous.text + ch, previous.width, previous.style)
            else:
                units.append(_StyledUnit(ch, width, style))
        style = _sgr_style_after(match.group(0))
        position = match.end()
    for ch in text[position:]:
        width = _char_width(ch)
        if width == 0 and units and units[-1].style == style:
            previous = units[-1]
            units[-1] = _StyledUnit(previous.text + ch, previous.width, previous.style)
        else:
            units.append(_StyledUnit(ch, width, style))
    return units


def _render_styled_units(units):
    """Render a unit slice with self-contained ANSI state."""
    output = []
    active = ""
    for unit in units:
        if unit.style != active:
            if active:
                output.append(C_RESET)
            if unit.style:
                output.append(unit.style)
            active = unit.style
        output.append(unit.text)
    if active:
        output.append(C_RESET)
    return "".join(output)


def _split_ansi_text(text, width, prefer_slashes=False):
    """Split colored text without data loss, optionally preferring path slashes."""
    width = max(MIN_CONTENT_WIDTH, int(width))
    if _display_width(text) <= width:
        return [text]
    units = _styled_units(text)
    if not units:
        return [text]

    chunks = []
    start = 0
    while start < len(units):
        used = 0
        end = start
        while end < len(units):
            next_width = units[end].width
            if end > start and used + next_width > width:
                break
            if end == start and next_width > width:
                end += 1
                break
            used += next_width
            end += 1
        if end >= len(units):
            chunks.append(_render_styled_units(units[start:]))
            break

        if prefer_slashes:
            # Break before the last slash that fits so concatenating the plain
            # chunks reconstructs the exact original absolute path.
            slash = None
            for index in range(start + 1, end):
                if units[index].text.startswith("/"):
                    slash = index
            if slash is not None:
                end = slash
        if end <= start:  # defensive progress guarantee for pathological input
            end = start + 1
        chunks.append(_render_styled_units(units[start:end]))
        start = end
    return chunks


def _ensure_reset(text):
    return text if text.endswith(C_RESET) else text + C_RESET


def _layout_segments(segments, width):
    """Pack ordered top-level segments into complete, width-bounded rows."""
    width = max(MIN_CONTENT_WIDTH, int(width))
    separator_width = _display_width(C_SEP)
    rows = []
    current = ""
    current_width = 0

    for segment in segments:
        if not isinstance(segment, _LayoutSegment):
            segment = _LayoutSegment(str(segment))
        if not segment.text:
            continue
        segment_width = _display_width(segment.text)
        if segment_width <= width:
            if current and current_width + separator_width + segment_width <= width:
                current += C_SEP + segment.text
                current_width += separator_width + segment_width
            else:
                if current:
                    rows.append(_ensure_reset(current))
                current = segment.text
                current_width = segment_width
            continue

        if current:
            rows.append(_ensure_reset(current))
            current = ""
            current_width = 0
        chunks = _split_ansi_text(
            segment.text, width,
            prefer_slashes=segment.prefer_slash_breaks,
        )
        rows.extend(_ensure_reset(chunk) for chunk in chunks[:-1])
        current = chunks[-1]
        current_width = _display_width(current)

    if current:
        rows.append(_ensure_reset(current))
    return rows


def deep_get(d, path):
    for key in path:
        if not isinstance(d, dict):
            return None
        d = d.get(key)
    return d


CONFIG_DIR = os.path.abspath(os.path.expanduser(
    os.environ.get("CLAUDE_CONFIG_DIR", "~/.claude")
))
BASE_DIR = CONFIG_DIR
RUNTIME_ROOT = os.environ.get("CLAUDE_STATUSLINE_RUNTIME_DIR", BASE_DIR)
STATEFILE = os.path.join(RUNTIME_ROOT, "statusline_state.json")
STATE_LOCKFILE = STATEFILE + ".lock"
MAX_SESSIONS = 100
MAX_IDS_PER_SESSION = 5000
_BASE = {"i": 0, "o": 0, "cc": 0, "cr": 0}
TURN_SCAN_VERSION = 4
USAGE_SCAN_VERSION = 2
GIT_CACHE_VERSION = 2
GIT_CACHE_TTL_NS = 500_000_000
GIT_CACHE_MAX_AGE_NS = 7 * 24 * 60 * 60 * 1_000_000_000
GIT_CACHE_MAX_FILES = 128
GIT_CACHE_DIR = os.path.join(RUNTIME_ROOT, "git_cache")
SESSIONS_DIR = os.environ.get(
    "CLAUDE_STATUSLINE_SESSIONS_DIR",
    os.path.join(BASE_DIR, "sessions"),
)


def _load_state():
    try:
        with open(STATEFILE, "r", encoding="utf-8") as f:
            state = json.load(f)
        if isinstance(state, dict) and isinstance(state.get("sessions"), dict):
            dropped = False
            for sid in list(state["sessions"]):
                s = state["sessions"][sid]
                # The old schema ({cum,prev} delta counters) is superseded by
                # transcript-derived totals; drop those entries, don't migrate.
                if not (isinstance(s, dict) and isinstance(s.get("files"), dict)
                        and isinstance(s.get("ids"), dict)):
                    del state["sessions"][sid]
                    dropped = True
            return state, dropped
    except Exception:
        pass
    return {"sessions": {}}, False


def _save_state(state):
    # Atomic publication prevents readers from observing a torn JSON file.
    # The caller also holds STATE_LOCKFILE across load/update/save so multiple
    # Claude sessions cannot overwrite one another's newly parsed records.
    tmp = None
    try:
        os.makedirs(os.path.dirname(STATEFILE), mode=0o700, exist_ok=True)
        fd, tmp = tempfile.mkstemp(
            prefix=".statusline-state-", suffix=".tmp",
            dir=os.path.dirname(STATEFILE),
        )
        os.fchmod(fd, 0o600)
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(state, f)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp, STATEFILE)
        tmp = None
    except Exception:
        pass
    finally:
        if tmp is not None:
            try:
                os.unlink(tmp)
            except OSError:
                pass


def _acquire_state_lock():
    os.makedirs(os.path.dirname(STATE_LOCKFILE), mode=0o700, exist_ok=True)
    fd = os.open(STATE_LOCKFILE, os.O_CREAT | os.O_RDWR, 0o600)
    try:
        os.fchmod(fd, 0o600)
    except OSError:
        pass
    fcntl.flock(fd, fcntl.LOCK_EX)
    return fd


def _proc_start_time(pid):
    try:
        with open(f"/proc/{pid}/stat", "r", encoding="utf-8") as f:
            stat = f.read()
        # comm (field 2) is parenthesized and may itself contain spaces.
        close = stat.rfind(")")
        fields = stat[close + 2:].split() if close >= 0 else []
        return fields[19] if len(fields) > 19 else None  # field 22: starttime
    except (OSError, ValueError):
        return None


def _read_cli_session_status(session_id):
    """Return the newest live, process-verified registry entry for a session."""
    if not session_id:
        return None
    best = None
    try:
        entries = os.scandir(SESSIONS_DIR)
    except OSError:
        return None
    with entries:
        for entry in entries:
            if (not entry.is_file(follow_symlinks=False)
                    or not entry.name.endswith(".json")):
                continue
            stem = entry.name[:-5]
            if not stem.isdigit():
                continue
            try:
                with open(entry.path, "r", encoding="utf-8") as f:
                    data = json.load(f)
            except (OSError, ValueError, TypeError):
                continue
            pid = data.get("pid")
            updated_ms = data.get("statusUpdatedAt")
            if (data.get("sessionId") != str(session_id)
                    or not isinstance(pid, int) or isinstance(pid, bool)
                    or pid != int(stem)
                    or not isinstance(updated_ms, int) or isinstance(updated_ms, bool)
                    or str(data.get("procStart") or "") != str(_proc_start_time(pid) or "")):
                continue
            candidate = {
                "status": data.get("status"),
                "status_updated_wall_ns": updated_ms * 1_000_000,
                "pid": pid,
            }
            if (best is None
                    or candidate["status_updated_wall_ns"]
                    > best["status_updated_wall_ns"]):
                best = candidate
    return best


def _read_transcript_chunk(path, start):
    # Read only complete lines beginning at byte offset `start`. The file is
    # appended concurrently, so a partial tail line is left for the next tick;
    # `start` never advances past a finished line.
    try:
        with open(path, "rb") as f:
            f.seek(start)
            raw = f.read()
    except OSError:
        return [], start
    if not raw:
        return [], start
    nl = raw.rfind(b"\n")
    if nl < 0:
        return [], start  # no complete line yet: retry on the next tick
    # A leading BOM (harmless stray, but it would break json.loads of line 1)
    text = raw[: nl + 1].decode("utf-8", errors="replace")
    if text.startswith("\ufeff"):
        text = text[1:]
    lines = []
    for line in text.split("\n"):
        line = line.strip()
        if not line:
            continue
        try:
            lines.append(json.loads(line))
        except Exception:
            pass  # malformed line: skip permanently, never retry (no live-lock)
    return lines, start + nl + 1


def _ts_to_epoch(s):
    # ISO-8601 transcript timestamp -> epoch seconds (UTC), or None.
    try:
        s = s.strip()
        if not s:
            return None
        if s.endswith("Z"):
            s = s[:-1] + "+00:00"
        return datetime.datetime.fromisoformat(s).timestamp()
    except Exception:
        return None  # missing/malformed timestamp: line is simply not counted


_REAL_PROMPT_SOURCES = {"typed", "queued", "sdk"}
_LOCAL_COMMAND_PREFIXES = (
    "<command-name>",
    "<local-command-",
    "<bash-input>",
    "<bash-stdout>",
)


def _is_local_command_record(content):
    if not isinstance(content, str):
        return False
    return content.lstrip().startswith(_LOCAL_COMMAND_PREFIXES)


def _is_real_prompt_record(record, content):
    if not isinstance(content, str) or record.get("isMeta"):
        return False
    if _is_local_command_record(content):
        return False
    origin = record.get("origin")
    origin_kind = origin.get("kind") if isinstance(origin, dict) else None
    if origin_kind == "human":
        return True
    source = record.get("promptSource")
    return source in _REAL_PROMPT_SOURCES and origin_kind in (None, "human")


def _turn_events(lines):
    # Keep the legacy newest-event summaries and also return every lifecycle
    # observation in transcript order for the prompt-indexed turn ledger.
    prompt = None
    interrupt = None
    local_command = None
    assistant_activity = None
    observations = []
    for d in lines:
        if not isinstance(d, dict):
            continue
        if d.get("type") == "assistant":
            ts = _ts_to_epoch(d.get("timestamp"))
            if ts is not None and (assistant_activity is None or ts > assistant_activity):
                assistant_activity = ts
            if ts is not None:
                observations.append({
                    "kind": "assistant", "wall_ns": int(round(ts * 1_000_000_000)),
                })
            continue
        if d.get("type") == "system" and d.get("subtype") == "turn_duration":
            ts = _ts_to_epoch(d.get("timestamp"))
            duration_ms = d.get("durationMs")
            if (ts is not None and isinstance(duration_ms, (int, float))
                    and not isinstance(duration_ms, bool) and duration_ms >= 0):
                observations.append({
                    "kind": "turn_duration",
                    "wall_ns": int(round(ts * 1_000_000_000)),
                    "duration_ms": duration_ms,
                })
            continue
        if d.get("type") != "user":
            continue
        msg = d.get("message")
        if not isinstance(msg, dict) or msg.get("role") != "user":
            continue
        ts = _ts_to_epoch(d.get("timestamp"))
        prompt_id = d.get("promptId")
        prompt_id = str(prompt_id) if prompt_id else None
        if d.get("interruptedMessageId") and ts is not None:
            candidate = {"ts": ts, "prompt_id": prompt_id}
            if interrupt is None or ts > interrupt["ts"]:
                interrupt = candidate
            observations.append({
                "kind": "interrupt",
                "prompt_id": prompt_id,
                "wall_ns": int(round(ts * 1_000_000_000)),
            })
        content = msg.get("content")
        if ts is None or not isinstance(content, str):
            continue
        candidate = {"ts": ts, "prompt_id": prompt_id}
        if _is_local_command_record(content):
            if local_command is None or ts > local_command["ts"]:
                local_command = candidate
            observations.append({
                "kind": "local_command",
                "prompt_id": prompt_id,
                "wall_ns": int(round(ts * 1_000_000_000)),
            })
        elif _is_real_prompt_record(d, content):
            if prompt is None or ts > prompt["ts"]:
                prompt = candidate
            observations.append({
                "kind": "prompt",
                "prompt_id": prompt_id,
                "wall_ns": int(round(ts * 1_000_000_000)),
            })
    return prompt, interrupt, local_command, assistant_activity, observations


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
        if not isinstance(usage, dict):
            continue  # snapshot without usage: a later one fills it in
        rec = out.setdefault(mid, dict(_BASE))
        for key, field in (("i", "input_tokens"), ("o", "output_tokens"),
                           ("cc", "cache_creation_input_tokens"),
                           ("cr", "cache_read_input_tokens")):
            v = usage.get(field)
            if isinstance(v, int) and not isinstance(v, bool) and v > rec[key]:
                rec[key] = v
    return out


def _usage_int(value):
    return value if isinstance(value, int) and not isinstance(value, bool) and value >= 0 else 0


def _parse_cost_snapshot(lines):
    """Return the last valid cumulative cost-state token snapshot in a batch."""
    latest = None
    latest_index = None
    last_timestamp = None
    for index, d in enumerate(lines):
        if isinstance(d, dict):
            timestamp = _ts_to_epoch(d.get("timestamp"))
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
            if not isinstance(usage, dict):
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
        latest["_post_ids"] = _parse_usage(lines[latest_index + 1:])
    return latest


def _stage_cost_snapshot(entry, lines, force=False):
    snapshot = _parse_cost_snapshot(lines)
    if not isinstance(snapshot, dict):
        return
    current = entry.get("api_snapshot")
    current_fingerprint = current.get("fingerprint") if isinstance(current, dict) else None
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
        timestamp = _ts_to_epoch(record.get("timestamp"))
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


def _maybe_update_turn(entry, lines, session_id=None):
    # Max-merge: a transcript rewind or /compact truncation can never move
    # lifecycle metadata backwards.
    prompt, interrupt, local_command, assistant_activity, observations = _turn_events(lines)
    if prompt is not None and prompt["ts"] > entry.get("last_pt", 0.0):
        entry["last_pt"] = prompt["ts"]
        entry["last_prompt_id"] = prompt.get("prompt_id")
    old_interrupt = entry.get("last_interrupt")
    old_ts = old_interrupt.get("ts", 0.0) if isinstance(old_interrupt, dict) else 0.0
    if interrupt is not None and interrupt["ts"] > old_ts:
        entry["last_interrupt"] = interrupt
    old_local = entry.get("last_local_command")
    old_local_ts = old_local.get("ts", 0.0) if isinstance(old_local, dict) else 0.0
    if local_command is not None and local_command["ts"] > old_local_ts:
        entry["last_local_command"] = local_command
    if (assistant_activity is not None
            and assistant_activity > entry.get("last_assistant_ts", 0.0)):
        entry["last_assistant_ts"] = assistant_activity
    if session_id and observations:
        try:
            reconcile_transcript_events(str(session_id), observations)
        except Exception:
            pass


def _update_file(entry, path, session_id=None,
                 track_prompts=False, track_cost=False):
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
        lines, end = _read_transcript_chunk(path, 0)
        if not lines:
            return False
        entry["files"][path] = {"size": end, "mtime_ns": mtime}
        _merge_ids(entry["ids"], _parse_usage(lines))
        if track_prompts:
            _maybe_update_turn(entry, lines, session_id)
        if track_cost:
            _stage_cost_snapshot(entry, lines)
        else:
            _stage_subagent_snapshot_delta(entry, lines)
        return True
    esize = f["size"]
    if size < esize or (size == esize and mtime != f["mtime_ns"]):
        # Truncated or same-size rewrite: re-parse the whole file and max-merge
        # without resetting per-id records.
        lines, end = _read_transcript_chunk(path, 0)
        if not lines:
            return False
        f["size"], f["mtime_ns"] = end, mtime
        _merge_ids(entry["ids"], _parse_usage(lines))
        if track_prompts:
            _maybe_update_turn(entry, lines, session_id)
        if track_cost:
            _stage_cost_snapshot(entry, lines)
        else:
            _stage_subagent_snapshot_delta(entry, lines)
        return True
    if size > esize:
        lines, end = _read_transcript_chunk(path, esize)
        if not lines:
            return False  # only a partial tail: offset unchanged, retry later
        f["size"], f["mtime_ns"] = end, mtime
        _merge_ids(entry["ids"], _parse_usage(lines))
        if track_prompts:
            _maybe_update_turn(entry, lines, session_id)
        if track_cost:
            _stage_cost_snapshot(entry, lines)
        else:
            _stage_subagent_snapshot_delta(entry, lines)
        return True
    return False  # unchanged: steady-state cost is one stat per file


def _aggregate_visible(entry):
    totals = dict(_BASE)
    records = [entry.get("base", _BASE)]
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
    post_visible = _visible_semantic_totals({
        "base": dict(_BASE),
        "ids": post_ids if isinstance(post_ids, dict) else {},
    })
    candidate_display = {
        key: _usage_int(pending.get(key)) + post_visible[key]
        for key in ("hit", "miss", "out")
    }
    current = entry.get("api_snapshot")
    first_snapshot = not isinstance(current, dict)
    if not first_snapshot:
        displayed = _display_usage_totals(entry, visible)
        if any(candidate_display[key] < displayed[key]
               for key in ("hit", "miss", "out")):
            return False
    entry["api_snapshot"] = {
        key: pending[key] for key in ("fingerprint", "hit", "miss", "out")
    }
    entry["api_visible_anchor"] = {
        key: max(0, visible[key] - post_visible[key])
        for key in ("hit", "miss", "out")
    }
    return True


def _collapse_ids(entry):
    # If per-id records ever grow past MAX_IDS_PER_SESSION, fold the oldest
    # half into `base` with a sum (not a max: removed ids leave the max-merge
    # domain, so their contribution must be frozen). The aggregated total is
    # unchanged by construction.
    ids = entry["ids"]
    if len(ids) <= MAX_IDS_PER_SESSION:
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
    sid = deep_get(data, ("session_id",))
    tpath = deep_get(data, ("transcript_path",))
    if not sid or not tpath:
        return None
    sid = str(sid)
    tpath = os.path.abspath(tpath)
    try:
        lock_fd = _acquire_state_lock()
    except OSError:
        return None
    try:
        state, dropped = _load_state()
        entry = state["sessions"].setdefault(
            sid, {"files": {}, "ids": {}, "base": dict(_BASE)}
        )
        changed = dropped
        usage_rescan = False
        if _update_file(
                entry, tpath, session_id=sid,
                track_prompts=True, track_cost=True):
            changed = True

        # Old entries already point at EOF. Do one lifecycle-only full scan to
        # recover prompt_id and interrupt markers without resetting counters.
        if entry.get("turn_scan_version") != TURN_SCAN_VERSION:
            for key in ("last_pt", "last_prompt_id", "last_interrupt",
                        "last_local_command", "last_assistant_ts"):
                entry.pop(key, None)
            lines, _end = _read_transcript_chunk(tpath, 0)
            if lines:
                _maybe_update_turn(entry, lines, sid)
            entry["turn_scan_version"] = TURN_SCAN_VERSION
            changed = True

        # Existing state entries already point at EOF. Scan only for the latest
        # authoritative cost snapshot; assistant message IDs remain untouched.
        if entry.get("usage_scan_version") != USAGE_SCAN_VERSION:
            lines, _end = _read_transcript_chunk(tpath, 0)
            if lines:
                _stage_cost_snapshot(entry, lines, force=True)
            entry["usage_scan_version"] = USAGE_SCAN_VERSION
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
                sub_lines, _sub_end = _read_transcript_chunk(sp, 0)
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
            while len(state["sessions"]) > MAX_SESSIONS:
                state["sessions"].pop(next(iter(state["sessions"])))
            _save_state(state)
        displayed = _display_usage_totals(entry, visible)
        return (
            humanize_api_tokens(displayed["hit"]),
            humanize_api_tokens(displayed["miss"]),
            humanize_api_tokens(displayed["out"]),
            entry.get("last_pt"),
            entry,
        )
    finally:
        os.close(lock_fd)


_CACHE_MISS = object()


def _git_cache_path(session_id):
    raw = str(session_id).encode("utf-8")
    return os.path.join(GIT_CACHE_DIR, hashlib.sha256(raw).hexdigest() + ".json")


def _valid_git_result(value):
    if not isinstance(value, dict):
        return False
    kind = value.get("kind")
    if kind in ("not_repo", "error"):
        return True
    if kind != "ok":
        return False
    if not isinstance(value.get("branch"), str) or not value["branch"]:
        return False
    for key in ("oid", "upstream"):
        if value.get(key) is not None and not isinstance(value[key], str):
            return False
    if not isinstance(value.get("upstream_gone"), bool):
        return False
    for key in ("ahead", "behind", "staged", "unstaged", "conflicts", "untracked"):
        if not isinstance(value.get(key), int) or isinstance(value.get(key), bool):
            return False
        if value[key] < 0:
            return False
    return True


def _read_git_cache(session_id, cwd):
    if not session_id:
        return _CACHE_MISS
    abs_cwd = os.path.abspath(cwd)
    try:
        with open(_git_cache_path(session_id), "r", encoding="utf-8") as f:
            cache = json.load(f)
        if cache.get("version") != GIT_CACHE_VERSION or cache.get("cwd") != abs_cwd:
            return _CACHE_MISS
        checked_ns = cache.get("checked_ns")
        age_ns = time.time_ns() - checked_ns if isinstance(checked_ns, int) else -1
        if age_ns < 0 or age_ns > GIT_CACHE_TTL_NS:
            return _CACHE_MISS
        value = cache.get("value")
        if _valid_git_result(value):
            return value
    except (OSError, ValueError, TypeError):
        pass
    return _CACHE_MISS


def _prune_git_cache():
    now_ns = time.time_ns()
    live = []
    try:
        entries = list(os.scandir(GIT_CACHE_DIR))
    except OSError:
        return
    for entry in entries:
        if not entry.is_file(follow_symlinks=False) or not entry.name.endswith(".json"):
            continue
        try:
            stat = entry.stat(follow_symlinks=False)
            age_ns = now_ns - stat.st_mtime_ns
            if age_ns >= 0 and age_ns > GIT_CACHE_MAX_AGE_NS:
                os.unlink(entry.path)
            else:
                live.append((stat.st_mtime_ns, entry.path))
        except OSError:
            pass
    if len(live) > GIT_CACHE_MAX_FILES:
        live.sort()
        for _mtime_ns, path in live[:len(live) - GIT_CACHE_MAX_FILES]:
            try:
                os.unlink(path)
            except OSError:
                pass


def _write_git_cache(session_id, cwd, value):
    if not session_id or not _valid_git_result(value):
        return
    tmp = None
    try:
        os.makedirs(GIT_CACHE_DIR, mode=0o700, exist_ok=True)
        try:
            os.chmod(GIT_CACHE_DIR, 0o700)
        except OSError:
            pass
        fd, tmp = tempfile.mkstemp(prefix=".git-", suffix=".tmp", dir=GIT_CACHE_DIR)
        os.fchmod(fd, 0o600)
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(
                {
                    "version": GIT_CACHE_VERSION,
                    "checked_ns": time.time_ns(),
                    "cwd": os.path.abspath(cwd),
                    "value": value,
                },
                f, separators=(",", ":"),
            )
        os.replace(tmp, _git_cache_path(session_id))
        tmp = None
        _prune_git_cache()
    except Exception:
        pass
    finally:
        if tmp is not None:
            try:
                os.unlink(tmp)
            except OSError:
                pass


def _uncached_git_status(cwd):
    # A single porcelain-v2 call gives stable branch/upstream headers and
    # distinct ordinary, renamed, unmerged, and untracked records. Force the
    # child locale only so the non-repository diagnostic can be classified
    # without making error handling depend on the user's locale.
    try:
        flags = getattr(subprocess, "CREATE_NO_WINDOW", 0)
        env = os.environ.copy()
        env["LC_ALL"] = "C"
        r = subprocess.run(
            [
                "git", "-C", cwd, "--no-optional-locks", "status",
                "--porcelain=v2", "--branch", "--ahead-behind", "--renames",
                "--untracked-files=all",
            ],
            capture_output=True, text=True, timeout=2,
            encoding="utf-8", errors="replace", creationflags=flags,
            env=env,
        )
    except Exception:
        return {"kind": "error"}
    if r.returncode != 0:
        if "not a git repository" in r.stderr:
            return {"kind": "not_repo"}
        return {"kind": "error"}

    lines = r.stdout.splitlines()
    oid = branch_head = upstream = None
    ahead = behind = 0
    ab_seen = False
    staged = unstaged = conflicts = untracked = 0
    for line in lines:
        if line.startswith("# "):
            key, separator, value = line[2:].partition(" ")
            if not separator or not value:
                return {"kind": "error"}
            if key == "branch.oid":
                oid = value
            elif key == "branch.head":
                branch_head = value
            elif key == "branch.upstream":
                upstream = value
            elif key == "branch.ab":
                fields = value.split()
                if (len(fields) != 2 or not fields[0].startswith("+")
                        or not fields[1].startswith("-")):
                    return {"kind": "error"}
                try:
                    ahead = int(fields[0][1:])
                    behind = int(fields[1][1:])
                except ValueError:
                    return {"kind": "error"}
                if ahead < 0 or behind < 0:
                    return {"kind": "error"}
                ab_seen = True
            continue

        if line.startswith(("1 ", "2 ")):
            fields = line.split(" ", 2)
            if len(fields) < 3 or len(fields[1]) != 2:
                return {"kind": "error"}
            x, y = fields[1]
            if x != ".":
                if x not in "MTADRC":
                    return {"kind": "error"}
                staged += 1
            if y != ".":
                if y not in "MTADRC":
                    return {"kind": "error"}
                unstaged += 1
        elif line.startswith("u "):
            conflicts += 1
        elif line.startswith("? "):
            untracked += 1
        elif line.startswith("! "):
            continue
        elif line:
            return {"kind": "error"}

    if not branch_head or not oid:
        return {"kind": "error"}
    if branch_head == "(detached)":
        if oid == "(initial)":
            return {"kind": "error"}
        branch = "HEAD@" + oid[:7]
    else:
        branch = branch_head
    return {
        "kind": "ok",
        "branch": branch,
        "oid": None if oid == "(initial)" else oid,
        "upstream": upstream,
        "ahead": ahead,
        "behind": behind,
        "upstream_gone": upstream is not None and not ab_seen,
        "staged": staged,
        "unstaged": unstaged,
        "conflicts": conflicts,
        "untracked": untracked,
    }


def git_status(cwd, session_id=None):
    cached = _read_git_cache(session_id, cwd)
    if cached is not _CACHE_MISS:
        return cached
    result = _uncached_git_status(cwd)
    _write_git_cache(session_id, cwd, result)
    return result


def _live_directory(data):
    candidates = (
        deep_get(data, ("workspace", "current_dir")),
        deep_get(data, ("cwd",)),
        deep_get(data, ("worktree", "path")),
        deep_get(data, ("workspace", "project_dir")),
    )
    for candidate in candidates:
        if isinstance(candidate, str) and candidate:
            return candidate
    return None


def _git_segment(result):
    if result["kind"] == "error":
        return f"{C_GIT_ERROR}git!{C_RESET}"
    if result["kind"] != "ok":
        return None
    statuses = []
    if result["upstream_gone"]:
        statuses.append("[gone]")
    else:
        if result["ahead"]:
            statuses.append(f"↑{result['ahead']}")
        if result["behind"]:
            statuses.append(f"↓{result['behind']}")
    if result["staged"]:
        statuses.append(f"● {result['staged']}")
    if result["unstaged"]:
        statuses.append(f"~{result['unstaged']}")
    if result["conflicts"]:
        statuses.append(f"!{result['conflicts']}")
    if result["untracked"]:
        statuses.append(f"?{result['untracked']}")
    suffix = " " + "".join(statuses) if statuses else ""
    return f"{C_BRANCH}{result['branch']}{suffix}{C_RESET}"


def _fmt_duration(seconds, nearest=False):
    try:
        value = float(seconds)
    except (TypeError, ValueError):
        return None
    s = int(value + 0.5) if nearest and value >= 0 else int(value)
    if s < 0:
        s = 0
    if s >= 3600:
        return f"{s // 3600}h {s % 3600 // 60:02d}m {s % 60:02d}s"
    return f"{s // 60}m {s % 60:02d}s"


def _state_elapsed_seconds(state, last_pt):
    if not isinstance(state, dict):
        return None
    status = state.get("status")
    duration_ns = state.get("duration_ns")
    if status != "running" and isinstance(duration_ns, int) and duration_ns >= 0:
        return duration_ns / 1_000_000_000
    start_wall = state.get("started_wall_ns")
    if not isinstance(start_wall, int) and last_pt is not None:
        start_wall = int(last_pt * 1_000_000_000)
    if not isinstance(start_wall, int):
        return None

    now_wall, now_boot, boot_id = now_clocks()
    end_wall = now_wall if status == "running" else state.get("ended_wall_ns")
    start_boot = state.get("started_boot_ns")
    end_boot = now_boot if status == "running" else state.get("ended_boot_ns")
    if (state.get("boot_id") == boot_id
            and isinstance(start_boot, int) and isinstance(end_boot, int)):
        return max(0.0, (end_boot - start_boot) / 1_000_000_000)
    if not isinstance(end_wall, int):
        return None
    return max(0.0, (end_wall - start_wall) / 1_000_000_000)


def _render_state_timer(state, last_pt):
    if (not isinstance(state, dict)
            or state.get("status") in ("ignored", "withdrawn")):
        return None
    elapsed = _state_elapsed_seconds(state, last_pt)
    status = state.get("status")
    formatted = _fmt_duration(elapsed, nearest=status != "running")
    if not formatted:
        return None
    marker = {
        "running": "⏱",
        "completed": "✓",
        "interrupted": "■",
        "failed": "✗",
        "unknown": "?",
    }.get(status, "?")
    suffix = "+" if status == "unknown" else ""
    return f"{C_TIMER}{marker} {formatted}{suffix}{C_RESET}"


def _local_command_is_current(local_command, payload_prompt_id,
                              real_prompt_id, last_pt):
    if not isinstance(local_command, dict):
        return False
    local_prompt_id = local_command.get("prompt_id")
    if (local_prompt_id and real_prompt_id
            and str(local_prompt_id) == str(real_prompt_id)):
        return False  # a real human record with the same ID wins
    if payload_prompt_id:
        return bool(local_prompt_id) and str(local_prompt_id) == str(payload_prompt_id)
    local_ts = local_command.get("ts")
    return (isinstance(local_ts, (int, float))
            and (last_pt is None or local_ts > last_pt))


def _timer_segment(sid, prompt_id, last_pt, entry):
    if not sid:
        return None
    sid = str(sid)
    payload_prompt_id = str(prompt_id) if prompt_id else None
    real_prompt_id = entry.get("last_prompt_id")
    real_prompt_id = str(real_prompt_id) if real_prompt_id else None
    local_command = entry.get("last_local_command")

    local_is_current = _local_command_is_current(
        local_command, payload_prompt_id, real_prompt_id, last_pt
    )

    # A local command never becomes a timed turn. Preserve the most recent
    # real prompt's frozen or running display until another real prompt begins.
    if local_is_current and not real_prompt_id:
        return None

    effective_prompt_id = real_prompt_id or payload_prompt_id
    if payload_prompt_id and payload_prompt_id != real_prompt_id:
        payload_state = load_turn_state(sid, payload_prompt_id)
        payload_start = (payload_state.get("started_wall_ns")
                         if isinstance(payload_state, dict) else None)
        transcript_start = (int(last_pt * 1_000_000_000)
                            if isinstance(last_pt, (int, float)) else None)
        if (isinstance(payload_state, dict)
                and payload_state.get("status") == "running"
                and (not isinstance(transcript_start, int)
                     or (isinstance(payload_start, int)
                         and payload_start > transcript_start))):
            # UserPromptSubmit can lead the transcript by one refresh tick.
            effective_prompt_id = payload_prompt_id

    if not effective_prompt_id:
        return None
    state = load_turn_state(sid, effective_prompt_id)

    # A complete transcript prompt is sufficient evidence to self-heal a
    # missing enqueue/dequeue hook record. Never use an older prompt timestamp
    # for a different payload id.
    if (not isinstance(state, dict) and real_prompt_id == effective_prompt_id
            and isinstance(last_pt, (int, float))):
        try:
            reconcile_transcript_events(sid, [{
                "kind": "prompt",
                "prompt_id": effective_prompt_id,
                "wall_ns": int(round(last_pt * 1_000_000_000)),
            }])
            state = load_turn_state(sid, effective_prompt_id)
        except Exception:
            state = None

    if not isinstance(state, dict):
        return None

    if state.get("status") == "running":
        session = _read_cli_session_status(sid)
        if isinstance(session, dict) and session.get("status") == "idle":
            ended_wall_ns = session.get("status_updated_wall_ns")
            start_wall_ns = state.get("started_wall_ns")
            if (isinstance(ended_wall_ns, int)
                    and (not isinstance(start_wall_ns, int)
                         or ended_wall_ns >= start_wall_ns)):
                try:
                    reconcile_idle_state(sid, effective_prompt_id, ended_wall_ns)
                    state = load_turn_state(sid, effective_prompt_id) or state
                except Exception:
                    pass

    return _render_state_timer(state, last_pt)


def humanize_tokens(v):
    try:
        v = int(v)
    except (TypeError, ValueError):
        return None
    if v >= 1_000_000:
        s = f"{v / 1_000_000:.2f}".rstrip("0").rstrip(".")
        return s + "M"
    if v >= 1000:
        s = f"{v / 1000:.1f}".rstrip("0").rstrip(".")
        return s + "K"
    return str(v)


def humanize_api_tokens(v):
    try:
        v = int(v)
    except (TypeError, ValueError):
        return "0"
    if v >= 1_000_000:
        value = f"{v / 1_000_000:.2f}".rstrip("0").rstrip(".")
        return value + "M"
    if v >= 1000:
        return f"{v / 1000:.1f}K"
    return str(max(0, v))


def _rate_limit_segment(data):
    """Render whichever Claude Code rate-limit windows are present."""
    rate_limits = deep_get(data, ("rate_limits",))
    if not isinstance(rate_limits, dict):
        return None

    parts = []
    for field, label in (
            ("five_hour", "5h"),
            ("seven_day", "weekly"),
            ("spend_limit", "spend")):
        window = rate_limits.get(field)
        if not isinstance(window, dict):
            continue
        used = window.get("used_percentage")
        if isinstance(used, bool) or not isinstance(used, (int, float)):
            continue
        if (isinstance(used, float) and not math.isfinite(used)) or used < 0:
            continue
        left = 0 if used >= 100 else round(100 - used)
        parts.append(f"{C_PCT}{label} {left}% left{C_RESET}")

    return C_JOIN.join(parts) if parts else None


def main():
    sys.stdout.reconfigure(encoding="utf-8", newline="\n")
    try:
        # Read bytes directly: PowerShell pipes strings to native commands
        # with a UTF-8 BOM, which plain json.load cannot handle.
        raw = sys.stdin.buffer.read()
        if raw.startswith(b"\xef\xbb\xbf"):
            raw = raw[3:]
        data = json.loads(raw.decode("utf-8"))
    except Exception:
        return

    segments = []

    # model id shown verbatim, plus effort, e.g. "deepseek-v4-pro[1M] max"
    model = deep_get(data, ("model", "id")) or deep_get(data, ("model", "display_name"))
    if model:
        seg = f"{C_MODEL}{model}"
        effort = deep_get(data, ("effort", "level"))
        if effort:
            seg += f" {effort}"
        segments.append(_LayoutSegment(seg + C_RESET))

    # Directory and Git share the same live-cwd/worktree semantics so they stay
    # aligned after Bash `cd` or a worktree transition. project_dir is retained
    # only as a compatibility fallback for older payloads.
    live_dir = _live_directory(data)
    if live_dir:
        segments.append(_LayoutSegment(
            f"{C_DIR}{live_dir}{C_RESET}",
            prefer_slash_breaks=True,
        ))

    # Git follows the live cwd/worktree rather than the fixed launch directory.
    # ↑/↓ are upstream divergence; ●/~ are staged/unstaged file categories;
    # conflicts are a separate ! bucket; ? counts individual untracked files.
    # Zero values are omitted. The branch is separated once and status markers
    # are otherwise concatenated. Only ● gets an internal space because its
    # wide glyph visually overlaps an immediately adjacent digit in some fonts.
    if live_dir:
        gs = git_status(live_dir, deep_get(data, ("session_id",)))
        git_segment = _git_segment(gs)
        if git_segment:
            segments.append(_LayoutSegment(git_segment))

    # context window info: percentage and size read as one item, so they are
    # joined with the middle dot (e.g. "Context 94% left · 1M window")
    ctx = []
    # remaining context percentage, e.g. "Context 88% left"
    remaining = deep_get(data, ("context_window", "remaining_percentage"))
    if remaining is not None:
        try:
            pct = round(float(remaining))
            ctx.append(f"{C_PCT}Context {pct}% left{C_RESET}")
        except (TypeError, ValueError):
            pass
    # context window size, e.g. "828K window"
    size = humanize_tokens(deep_get(data, ("context_window", "context_window_size")))
    if size:
        ctx.append(f"{C_SIZE}{size} window{C_RESET}")
    if ctx:
        segments.append(_LayoutSegment(C_JOIN.join(ctx)))

    # Claude.ai subscription windows and gateway spend limits are optional and
    # independent. Omit both missing fields and the entire segment when empty.
    rate_limit_segment = _rate_limit_segment(data)
    if rate_limit_segment:
        segments.append(_LayoutSegment(rate_limit_segment))

    # Cumulative all-API usage: cache hits, cache misses (including cache
    # creation), and output. All three fields remain visible at zero.
    totals = session_token_totals(data)
    if totals:
        thit, tmiss, tout, last_pt, entry = totals
        tok = [
            f"{C_TOKENS}hit {thit}{C_RESET}",
            f"{C_TOKENS}miss {tmiss}{C_RESET}",
            f"{C_TOKENS}out {tout}{C_RESET}",
        ]
        segments.append(_LayoutSegment(C_JOIN.join(tok)))

    # Per-prompt lifecycle timer (rightmost segment). Hooks are authoritative;
    # transcript duration and a process-verified idle registry are fallbacks.
    if totals:
        timer = _timer_segment(
            deep_get(data, ("session_id",)),
            deep_get(data, ("prompt_id",)),
            last_pt,
            entry,
        )
        if timer:
            segments.append(_LayoutSegment(timer))

    rows = _layout_segments(segments, _terminal_content_width())
    sys.stdout.write("\n".join(rows) + "\n")


if __name__ == "__main__":
    main()
