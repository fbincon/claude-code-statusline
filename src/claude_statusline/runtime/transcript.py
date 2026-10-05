"""runtime / transcript implementation."""

from __future__ import annotations

import datetime
import json
import math
from claude_statusline.runtime.turns import reducer as turn_reducer
from claude_statusline.runtime.turns import model as turn_model


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


def _turn_events(lines, prompt_context=None):
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
            if ts is not None and (
                assistant_activity is None or ts > assistant_activity
            ):
                assistant_activity = ts
            if ts is not None:
                observations.append(
                    {
                        "kind": "assistant",
                        "wall_ns": int(round(ts * 1_000_000_000)),
                        "prompt_id": d.get("promptId") or prompt_context,
                    }
                )
            continue
        if d.get("type") == "system" and d.get("subtype") == "stop_hook_summary":
            ts = _ts_to_epoch(d.get("timestamp"))
            if (
                ts is not None
                and d.get("preventedContinuation") is False
                and d.get("hookErrors") == []
                and d.get("hookAdditionalContext") in (None, [])
                and not d.get("stopReason")
            ):
                observations.append(
                    {
                        "kind": "confirmed_stop",
                        "wall_ns": int(round(ts * 1e9)),
                        "prompt_id": d.get("promptId") or prompt_context,
                    }
                )
            continue
        if d.get("type") == "system" and d.get("subtype") == "turn_duration":
            ts = _ts_to_epoch(d.get("timestamp"))
            duration_ms = d.get("durationMs")
            if (
                ts is not None
                and isinstance(duration_ms, (int, float))
                and not isinstance(duration_ms, bool)
                and duration_ms >= 0
                and duration_ms <= 1e15
                and math.isfinite(duration_ms)
            ):
                observations.append(
                    {
                        "kind": "turn_duration",
                        "wall_ns": int(round(ts * 1_000_000_000)),
                        "duration_ms": duration_ms,
                        "prompt_id": d.get("promptId") or prompt_context,
                    }
                )
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
            observations.append(
                {
                    "kind": "interrupt",
                    "prompt_id": prompt_id,
                    "wall_ns": int(round(ts * 1_000_000_000)),
                }
            )
        content = msg.get("content")
        notification_text = content
        if isinstance(content, list):
            notification_text = "\n".join(
                part.get("text", "")
                for part in content
                if isinstance(part, dict) and part.get("type") == "text"
            )
        agent_id = turn_model.agent_notification_id(notification_text)
        origin = d.get("origin")
        host_notification = d.get("isMeta") or (
            isinstance(origin, dict) and origin.get("kind") == "task-notification"
        )
        if agent_id and ts is not None and host_notification:
            observations.append(
                {
                    "kind": "agent_notification",
                    "agent_id": agent_id,
                    "prompt_id": prompt_id,
                    "wall_ns": int(round(ts * 1e9)),
                }
            )
            if prompt_id:
                prompt_context = prompt_id
            continue
        if ts is None or not isinstance(content, str):
            continue
        candidate = {"ts": ts, "prompt_id": prompt_id}
        if _is_local_command_record(content):
            if local_command is None or ts > local_command["ts"]:
                local_command = candidate
            observations.append(
                {
                    "kind": "local_command",
                    "prompt_id": prompt_id,
                    "wall_ns": int(round(ts * 1_000_000_000)),
                }
            )
        elif _is_real_prompt_record(d, content):
            prompt_context = prompt_id
            if prompt is None or ts > prompt["ts"]:
                prompt = candidate
            observations.append(
                {
                    "kind": "prompt",
                    "prompt_id": prompt_id,
                    "wall_ns": int(round(ts * 1_000_000_000)),
                }
            )
    return prompt, interrupt, local_command, assistant_activity, observations


def _maybe_update_turn(entry, lines, session_id=None, reset_context=False):
    # Max-merge: a transcript rewind or /compact truncation can never move
    # lifecycle metadata backwards.
    context = None if reset_context else entry.get("transcript_prompt_id")
    prompt, interrupt, local_command, assistant_activity, observations = _turn_events(
        lines, context
    )
    for event in observations:
        if event.get("kind") == "prompt":
            entry["transcript_prompt_id"] = event.get("prompt_id")
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
    if assistant_activity is not None and assistant_activity > entry.get(
        "last_assistant_ts", 0.0
    ):
        entry["last_assistant_ts"] = assistant_activity
    if session_id and observations:
        try:
            turn_reducer.reconcile_transcript_events(str(session_id), observations)
        except Exception:
            pass
