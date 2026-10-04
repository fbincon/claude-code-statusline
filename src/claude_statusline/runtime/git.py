"""runtime / git implementation."""

from __future__ import annotations

import hashlib
import json
import os
import subprocess
import time
from pathlib import Path
from claude_statusline.platforms import environment as platform_environment
from claude_statusline.platforms import files as platform_files
from claude_statusline.rendering import palette as rendering_palette
from claude_statusline.rendering import git as rendering_git
from claude_statusline.runtime import paths as runtime_paths


_CACHE_MISS = object()


def _git_cache_path(session_id):
    raw = str(session_id).encode("utf-8")
    return os.path.join(
        runtime_paths.GIT_CACHE_DIR, hashlib.sha256(raw).hexdigest() + ".json"
    )


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
        if (
            cache.get("version") != runtime_paths.GIT_CACHE_VERSION
            or cache.get("cwd") != abs_cwd
        ):
            return _CACHE_MISS
        checked_ns = cache.get("checked_ns")
        age_ns = time.time_ns() - checked_ns if isinstance(checked_ns, int) else -1
        if age_ns < 0 or age_ns > runtime_paths.GIT_CACHE_TTL_NS:
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
        entries = list(os.scandir(runtime_paths.GIT_CACHE_DIR))
    except OSError:
        return
    for entry in entries:
        if not entry.is_file(follow_symlinks=False) or not entry.name.endswith(".json"):
            continue
        try:
            stat = entry.stat(follow_symlinks=False)
            age_ns = now_ns - stat.st_mtime_ns
            if age_ns >= 0 and age_ns > runtime_paths.GIT_CACHE_MAX_AGE_NS:
                os.unlink(entry.path)
            else:
                live.append((stat.st_mtime_ns, entry.path))
        except OSError:
            pass
    if len(live) > runtime_paths.GIT_CACHE_MAX_FILES:
        live.sort()
        for _mtime_ns, path in live[: len(live) - runtime_paths.GIT_CACHE_MAX_FILES]:
            try:
                os.unlink(path)
            except OSError:
                pass


def _write_git_cache(session_id, cwd, value):
    if not session_id or not _valid_git_result(value):
        return
    try:
        os.makedirs(runtime_paths.GIT_CACHE_DIR, mode=0o700, exist_ok=True)
        if platform_environment.uses_posix_files():
            try:
                os.chmod(runtime_paths.GIT_CACHE_DIR, 0o700)
            except OSError:
                pass
        content = json.dumps(
            {
                "version": runtime_paths.GIT_CACHE_VERSION,
                "checked_ns": time.time_ns(),
                "cwd": os.path.abspath(cwd),
                "value": value,
            },
            separators=(",", ":"),
        ).encode("utf-8")
        platform_files.atomic_write_bytes(
            Path(_git_cache_path(session_id)), content, 0o600
        )
        _prune_git_cache()
    except Exception:
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
                "git",
                "-C",
                cwd,
                "--no-optional-locks",
                "status",
                "--porcelain=v2",
                "--branch",
                "--ahead-behind",
                "--renames",
                "--untracked-files=all",
            ],
            capture_output=True,
            text=True,
            timeout=2,
            encoding="utf-8",
            errors="replace",
            creationflags=flags,
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
                if (
                    len(fields) != 2
                    or not fields[0].startswith("+")
                    or not fields[1].startswith("-")
                ):
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


def _git_segment(result, palette=rendering_palette.DEFAULT_PALETTE):
    if result["kind"] == "error":
        return f"{palette.git_error}Git!{palette.reset}"
    if result["kind"] != "ok":
        return None
    statuses = rendering_git.divergence_markers(result)
    statuses.extend(
        rendering_git.change_markers(
            result,
            compact_staged=platform_environment.is_windows()
            or platform_environment.is_wsl(),
        )
    )
    suffix = " " + "".join(statuses) if statuses else ""
    return f"{palette.branch}Git {result['branch']}{suffix}{palette.reset}"
