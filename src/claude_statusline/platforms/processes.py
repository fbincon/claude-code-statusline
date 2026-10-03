"""platforms / processes implementation."""

from __future__ import annotations

import os
import subprocess
from claude_statusline.platforms import environment as platform_environment


_DOTNET_FILETIME_OFFSET_TICKS = 504_911_232_000_000_000


def _linux_process_start_token(pid: int) -> str | None:
    try:
        with open(f"/proc/{pid}/stat", "r", encoding="utf-8") as stream:
            value = stream.read()
        # comm (field 2) is parenthesized and may itself contain spaces.
        close = value.rfind(")")
        fields = value[close + 2 :].split() if close >= 0 else []
        return fields[19] if len(fields) > 19 else None
    except (OSError, ValueError):
        return None


def _macos_process_start_token(pid: int) -> str | None:
    # Match Claude's non-Linux POSIX token exactly, including interior spacing.
    # Its ps query uses the C locale and UTC and trims only the output's edges.
    environment = os.environ.copy()
    environment.update(LC_ALL="C", TZ="UTC")
    try:
        result = subprocess.run(
            ["/bin/ps", "-o", "lstart=", "-p", str(pid)],
            stdin=subprocess.DEVNULL,
            capture_output=True,
            text=True,
            encoding="utf-8",
            env=environment,
            timeout=1,
            check=False,
        )
    except (OSError, subprocess.SubprocessError, UnicodeError):
        return None
    return (result.stdout.strip() or None) if result.returncode == 0 else None


def _windows_process_creation_filetime(pid: int) -> int | None:
    try:
        import ctypes
        from ctypes import wintypes

        class SystemTime(ctypes.Structure):
            _fields_ = (
                ("year", wintypes.WORD),
                ("month", wintypes.WORD),
                ("day_of_week", wintypes.WORD),
                ("day", wintypes.WORD),
                ("hour", wintypes.WORD),
                ("minute", wintypes.WORD),
                ("second", wintypes.WORD),
                ("milliseconds", wintypes.WORD),
            )

        kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
        open_process = kernel32.OpenProcess
        open_process.argtypes = (wintypes.DWORD, wintypes.BOOL, wintypes.DWORD)
        open_process.restype = wintypes.HANDLE
        get_process_times = kernel32.GetProcessTimes
        get_process_times.argtypes = (
            wintypes.HANDLE,
            ctypes.POINTER(wintypes.FILETIME),
            ctypes.POINTER(wintypes.FILETIME),
            ctypes.POINTER(wintypes.FILETIME),
            ctypes.POINTER(wintypes.FILETIME),
        )
        get_process_times.restype = wintypes.BOOL
        filetime_to_system = kernel32.FileTimeToSystemTime
        filetime_to_system.argtypes = (
            ctypes.POINTER(wintypes.FILETIME),
            ctypes.POINTER(SystemTime),
        )
        filetime_to_system.restype = wintypes.BOOL
        system_to_local = kernel32.SystemTimeToTzSpecificLocalTimeEx
        system_to_local.argtypes = (
            ctypes.c_void_p,
            ctypes.POINTER(SystemTime),
            ctypes.POINTER(SystemTime),
        )
        system_to_local.restype = wintypes.BOOL
        system_to_filetime = kernel32.SystemTimeToFileTime
        system_to_filetime.argtypes = (
            ctypes.POINTER(SystemTime),
            ctypes.POINTER(wintypes.FILETIME),
        )
        system_to_filetime.restype = wintypes.BOOL
        close_handle = kernel32.CloseHandle
        close_handle.argtypes = (wintypes.HANDLE,)
        close_handle.restype = wintypes.BOOL

        handle = open_process(0x1000, False, int(pid))
        if not handle:
            return None
        try:
            creation = wintypes.FILETIME()
            exit_time = wintypes.FILETIME()
            kernel_time = wintypes.FILETIME()
            user_time = wintypes.FILETIME()
            if not get_process_times(
                handle,
                ctypes.byref(creation),
                ctypes.byref(exit_time),
                ctypes.byref(kernel_time),
                ctypes.byref(user_time),
            ):
                return None
            utc_system = SystemTime()
            local_system = SystemTime()
            local_creation = wintypes.FILETIME()
            if not filetime_to_system(ctypes.byref(creation), ctypes.byref(utc_system)):
                return None
            if not system_to_local(
                None, ctypes.byref(utc_system), ctypes.byref(local_system)
            ):
                return None
            if not system_to_filetime(
                ctypes.byref(local_system), ctypes.byref(local_creation)
            ):
                return None
            value = (int(local_creation.dwHighDateTime) << 32) | int(
                local_creation.dwLowDateTime
            )
            utc_value = (int(creation.dwHighDateTime) << 32) | int(
                creation.dwLowDateTime
            )
            value += utc_value % 10_000
            # Win32_Process.CreationDate, which Claude serializes via .Ticks,
            # has microsecond precision even though FILETIME carries 100 ns.
            return value - (value % 10)
        finally:
            close_handle(handle)
    except (AttributeError, OSError, TypeError, ValueError):
        return None


def process_start_token(pid: object) -> str | None:
    """Return the token Claude records to distinguish a PID from its reuse."""
    if isinstance(pid, bool) or not isinstance(pid, int) or pid <= 0:
        return None
    if platform_environment.is_linux():
        return _linux_process_start_token(pid)
    if platform_environment.is_windows():
        value = _windows_process_creation_filetime(pid)
        if value is None:
            return None
        # Claude obtains ``CreationDate.Ticks`` on Windows. Win32 FILETIME uses
        # the same 100 ns unit but starts at 1601 instead of .NET's year 1.
        return str(value + _DOTNET_FILETIME_OFFSET_TICKS)
    if platform_environment.is_macos():
        return _macos_process_start_token(pid)
    return None
