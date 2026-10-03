"""integration / models implementation."""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path


HOOK_EVENTS = (
    "SessionStart",
    "UserPromptSubmit",
    "Stop",
    "StopFailure",
    "SessionEnd",
)


SUBAGENT_HOOK_EVENTS = ("SubagentStart", "SubagentStop")


SLASH_HOOK_EVENT = "UserPromptExpansion"


SLASH_COMMAND_NAME = "statusline-config"


EXPERIMENTAL_SLASH_COMMAND_NAME = "statusline-configure"


MIN_FAST_SLASH_VERSION = (2, 1, 258)


MIN_SUBAGENT_STATUSLINE_VERSION = (2, 1, 205)


SKILL_OWNER = "claude-code-statusline"


SKILL_OWNER_SCHEMA = 1


SKILL_RELATIVE_PATH = Path("skills") / SLASH_COMMAND_NAME / "SKILL.md"


SKILL_OWNER_RELATIVE_PATH = (
    Path("skills") / SLASH_COMMAND_NAME / ".claude-statusline-owner.json"
)


EXPERIMENTAL_SKILL_RELATIVE_PATH = (
    Path("skills") / EXPERIMENTAL_SLASH_COMMAND_NAME / "SKILL.md"
)


EXPERIMENTAL_SKILL_OWNER_RELATIVE_PATH = (
    Path("skills") / EXPERIMENTAL_SLASH_COMMAND_NAME / ".claude-statusline-owner.json"
)


_DETECT_CLAUDE_VERSION = object()


_UNCHANGED_ARTIFACT = object()


class ConfigurationError(RuntimeError):
    """Raised when settings cannot be changed without losing user intent."""


@dataclass(frozen=True)
class ChangeResult:
    action: str
    changed: bool
    settings_path: Path
    backup_dir: Path | None = None
    changed_paths: tuple[Path, ...] = ()


@dataclass(frozen=True)
class Diagnostic:
    level: str
    message: str


RESULT_ENV = "CLAUDE_STATUSLINE_SLASH_RESULT"


DEADLINE_ENV = "CLAUDE_STATUSLINE_SLASH_DEADLINE_SECONDS"


RESULT_SCHEMA_VERSION = 1


DEADLINE_SECONDS = 570


LAUNCHER_TIMEOUT_SECONDS = 585


PREFLIGHT_TIMEOUT_SECONDS = 2


RESULT_SIZE_LIMIT = 16 * 1024


STALE_AFTER_SECONDS = 24 * 60 * 60


INVOCATION_PREFIX = "invocation-"


RESULT_FILENAME = "result.json"


ALLOWED_OUTCOMES = {
    "updated",
    "already-current",
    "cancelled",
    "interrupted",
    "timed-out",
    "error",
}


UNAVAILABLE_MESSAGE = (
    "Interactive status line configuration is unavailable here.\n"
    "Run `claude-statusline configure` in a terminal, or use `/statusline-config`."
)


_PANE_PATTERN = re.compile(r"%[0-9]+\Z")


_INVOCATION_PATTERN = re.compile(r"invocation-[A-Za-z0-9_.-]+\Z")


_CONTROL_PATTERN = re.compile(r"[\x00-\x08\x0b-\x1f\x7f]")


@dataclass(frozen=True)
class TuiResult:
    schema_version: int
    outcome: str
    exit_code: int
    message: str

    def as_dict(self) -> dict[str, object]:
        return {
            "schema_version": self.schema_version,
            "outcome": self.outcome,
            "exit_code": self.exit_code,
            "message": self.message,
        }


@dataclass(frozen=True)
class Launcher:
    kind: str
    executable: str
    pane: str | None = None


class ResultError(RuntimeError):
    """Raised when a bridge result cannot be trusted."""


def _error(message: str, exit_code: int = 1) -> TuiResult:
    return TuiResult(RESULT_SCHEMA_VERSION, "error", exit_code, message)
