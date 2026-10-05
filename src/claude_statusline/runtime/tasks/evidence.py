"""Incremental, bounded index of real submissions used by terminal hooks."""

import hashlib
import json
from pathlib import Path

from claude_statusline.platforms import files
from claude_statusline.runtime import transcript
from claude_statusline.runtime.tasks import store


def _read_submission_chunk(source, cursor):
    """Parse only candidate submission rows, with bounded memory and complete lines."""
    prompts = {}
    with source.open("rb") as stream:
        stream.seek(cursor)
        end = cursor
        for line in stream:
            if not line.endswith(b"\n"):
                break
            end += len(line)
            if b'"promptId"' not in line:
                continue
            try:
                row = json.loads(line.decode("utf-8-sig"))
            except (ValueError, UnicodeError):
                continue
            if not isinstance(row, dict) or row.get("type") != "user":
                continue
            message = row.get("message")
            if not isinstance(message, dict) or not transcript._is_real_prompt_record(
                row, message.get("content")
            ):
                continue
            stamp = transcript._ts_to_epoch(row.get("timestamp"))
            prompt = row.get("promptId")
            if isinstance(prompt, str) and stamp is not None:
                prompts[prompt] = int(round(stamp * 1e9))
                while len(prompts) > 256:
                    prompts.pop(next(iter(prompts)))
    return prompts, end


def submission_time(path, prompt_id):
    source = Path(path)
    try:
        stat = source.stat()
        identity = [stat.st_dev, stat.st_ino]
        key = hashlib.sha256(str(source.resolve()).encode()).hexdigest()
        target = Path(store.RUNTIME_ROOT) / "submission-index" / (key + ".json")
        with files.exclusive_file_lock(target.with_suffix(".lock")):
            try:
                state = json.loads(target.read_bytes())
            except (OSError, ValueError):
                state = {}
            cursor = state.get("cursor", 0)
            if (
                state.get("identity") != identity
                or type(cursor) is not int
                or cursor > stat.st_size
                or (
                    state.get("size") == stat.st_size
                    and state.get("mtime_ns") != stat.st_mtime_ns
                )
            ):
                state, cursor = {}, 0
            prompts = state.get("prompts", {})
            if not isinstance(prompts, dict):
                prompts = {}
            rows, end = (
                _read_submission_chunk(source, cursor)
                if cursor < stat.st_size
                else ({}, cursor)
            )
            prompts.update(rows)
            while len(prompts) > 256:
                prompts.pop(next(iter(prompts)))
            updated = {
                "identity": identity,
                "cursor": end,
                "size": stat.st_size,
                "mtime_ns": stat.st_mtime_ns,
                "prompts": prompts,
            }
            if updated != state:
                files.atomic_write_bytes(target, json.dumps(updated).encode(), 0o600)
            value = prompts.get(prompt_id)
            return value if type(value) is int else None
    except OSError:
        return None
