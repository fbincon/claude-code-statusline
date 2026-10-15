"""platforms / environment implementation."""

from __future__ import annotations

import os
import platform
import subprocess
import sys


def is_windows(platform_name: str | None = None) -> bool:
    return (sys.platform if platform_name is None else platform_name) == "win32"


def is_linux(platform_name: str | None = None) -> bool:
    return (sys.platform if platform_name is None else platform_name).startswith(
        "linux"
    )


def is_macos(platform_name: str | None = None) -> bool:
    return (sys.platform if platform_name is None else platform_name) == "darwin"


def uses_posix_files(platform_name: str | None = None) -> bool:
    """Share file semantics only between the supported POSIX runtimes."""
    return is_linux(platform_name) or is_macos(platform_name)


def is_wsl(platform_name: str | None = None) -> bool:
    """Return whether the current Linux runtime is Windows Subsystem for Linux."""
    if not is_linux(platform_name):
        return False
    if os.environ.get("WSL_INTEROP") or os.environ.get("WSL_DISTRO_NAME"):
        return True
    return "microsoft" in platform.release().casefold()


def is_supported_platform(platform_name: str | None = None) -> bool:
    """Return whether the native runtime is part of the supported contract."""
    return uses_posix_files(platform_name) or is_windows(platform_name)


def no_window_creation_flags() -> int:
    """Hide short-lived subprocess consoles on native Windows."""
    if not is_windows():
        return 0
    return int(getattr(subprocess, "CREATE_NO_WINDOW", 0x08000000))


def new_console_creation_flags() -> int:
    """Return the Win32 flag used by the slash-command TUI launcher."""
    if not is_windows():
        return 0
    return int(getattr(subprocess, "CREATE_NEW_CONSOLE", 0x00000010))
