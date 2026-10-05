"""ui / models implementation."""

from __future__ import annotations

from dataclasses import dataclass


MIN_TERMINAL_WIDTH = 64


MIN_TERMINAL_HEIGHT = 18


REFRESH_PRESETS = (None, 1, 2, 5, 10, 30, 60, 300, 600, 3600)


SETTING_NAMES = (
    "Use colors",
    "Palette",
    "Directory style",
    "Separator style",
    "Padding",
    "Refresh interval",
    "Built-in Vim indicator",
    "Scope labels",
    "Custom subagent rows",
)

# Stable identities retain the original value-tuple order for compatibility.
SETTING_KEYS = (
    "colors",
    "palette",
    "directory-style",
    "separator-style",
    "padding",
    "refresh_interval",
    "vim-indicator",
    "scope-labels",
    "custom-subagent-rows",
)


SAVE = "save"


CANCEL = "cancel"


INTERRUPT = "interrupt"


TIMED_OUT = "timed-out"


@dataclass(frozen=True)
class ConfigureOutcome:
    outcome: str
    exit_code: int
    message: str


class ConfigureAborted(Exception):
    """End an external editor invocation without committing its draft."""

    def __init__(self, outcome: ConfigureOutcome):
        super().__init__(outcome.message)
        self.outcome = outcome


@dataclass
class NumericEdit:
    field: str
    buffer: str
    original: int | None
    error: str | None = None
