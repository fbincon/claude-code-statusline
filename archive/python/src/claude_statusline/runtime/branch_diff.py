"""Committed merge-base diff with a shared deadline and immutable-commit cache."""

import hashlib
import json
from pathlib import Path
import subprocess
import time

from claude_statusline.platforms import files
from claude_statusline.runtime import paths


def _numstat(raw):
    rows = iter(raw.split(b"\0"))
    count = added = removed = 0
    for row in rows:
        if not row:
            continue
        a, r, name = row.split(b"\t", 2)
        if not name:  # A rename carries two more NUL-delimited paths.
            next(rows)
            next(rows)
        if a != b"-" or r != b"-":
            added += int(a)
            removed += int(r)
        count += 1
    return {"files": count, "added": added, "removed": removed}


def collect(cwd, base_ref=None, *, timeout=2):
    deadline = time.monotonic() + timeout

    def git(*args):
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise subprocess.TimeoutExpired("git", timeout)
        return subprocess.run(
            ["git", "-C", str(cwd), "--no-optional-locks", *args],
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            timeout=remaining,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )

    def commit(ref):
        result = git("rev-parse", "--verify", "--end-of-options", ref + "^{commit}")
        return result.stdout.strip().decode("ascii") if result.returncode == 0 else None

    try:
        repository = git("rev-parse", "--show-toplevel")
        if repository.returncode:
            return {"value": None, "reason": "not_repo"}
        head = commit("HEAD")
        base = None
        selected = base_ref
        for ref in (
            (base_ref,) if base_ref is not None else ("origin/HEAD", "main", "master")
        ):
            base = commit(ref)
            if base:
                selected = ref
                break
        if not head or not base:
            return {"value": None, "reason": "base_unavailable"}
        key = hashlib.sha256(
            repository.stdout.strip() + b"\0" + head.encode() + b"\0" + base.encode()
        ).hexdigest()
        target = Path(paths.GIT_CACHE_DIR) / ("diff-" + key + ".json")
        try:
            cached = (
                json.loads(target.read_bytes()) if not target.is_symlink() else None
            )
            if (
                isinstance(cached, dict)
                and set(cached) == {"files", "added", "removed"}
                and all(type(v) is int and v >= 0 for v in cached.values())
            ):
                return {
                    "value": cached,
                    "reason": None,
                    "base_ref": selected,
                    "head": head,
                    "base": base,
                }
        except (OSError, ValueError):
            pass
        ancestor = git("merge-base", base, head)
        if ancestor.returncode:
            return {"value": None, "reason": "merge_base_unavailable"}
        diff = git(
            "diff",
            "--no-ext-diff",
            "--no-textconv",
            "--numstat",
            "-z",
            ancestor.stdout.strip().decode("ascii"),
            head,
            "--",
        )
        if diff.returncode:
            return {"value": None, "reason": "source_unavailable"}
        value = _numstat(diff.stdout)
        try:
            files.atomic_write_bytes(target, json.dumps(value).encode(), 0o600)
            from claude_statusline.runtime.git import _prune_git_cache

            _prune_git_cache()
        except OSError:
            pass
        return {
            "value": value,
            "reason": None,
            "base_ref": selected,
            "head": head,
            "base": base,
        }
    except subprocess.TimeoutExpired:
        return {"value": None, "reason": "timeout"}
    except (OSError, ValueError, StopIteration, TypeError):
        return {"value": None, "reason": "source_unavailable"}
