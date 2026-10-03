"""runtime / paths implementation."""

from __future__ import annotations

import os


CONFIG_DIR = os.path.abspath(
    os.path.expanduser(os.environ.get("CLAUDE_CONFIG_DIR", "~/.claude"))
)


BASE_DIR = CONFIG_DIR


RUNTIME_ROOT = os.environ.get("CLAUDE_STATUSLINE_RUNTIME_DIR", BASE_DIR)


STATEFILE = os.path.join(RUNTIME_ROOT, "statusline_state.json")


STATE_LOCKFILE = STATEFILE + ".lock"


MAX_SESSIONS = 100


MAX_IDS_PER_SESSION = 5000


_BASE = {"i": 0, "o": 0, "cc": 0, "cr": 0}


TURN_SCAN_VERSION = 5


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
