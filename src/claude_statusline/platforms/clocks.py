"""platforms / clocks implementation."""

from __future__ import annotations

import time
from functools import lru_cache
from claude_statusline.platforms import environment as platform_environment


_MINUTE_NS = 60 * 1_000_000_000


def _linux_boot_id() -> str | None:
    try:
        with open("/proc/sys/kernel/random/boot_id", "r", encoding="ascii") as stream:
            value = stream.read().strip()
        return value or None
    except OSError:
        return None


def _windows_uptime_ns() -> int:
    import ctypes

    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    get_tick_count = kernel32.GetTickCount64
    get_tick_count.argtypes = ()
    get_tick_count.restype = ctypes.c_ulonglong
    return int(get_tick_count()) * 1_000_000


@lru_cache(maxsize=1)
def _macos_clock_api():
    """Bind the user-space LibSystem APIs lazily, with both 64-bit ABIs."""
    import ctypes

    class TimebaseInfo(ctypes.Structure):
        _fields_ = (("numer", ctypes.c_uint32), ("denom", ctypes.c_uint32))

    library = ctypes.CDLL("/usr/lib/libSystem.B.dylib", use_errno=True)
    continuous = library.mach_continuous_time
    continuous.argtypes = ()
    continuous.restype = ctypes.c_uint64
    timebase_info = library.mach_timebase_info
    timebase_info.argtypes = (ctypes.POINTER(TimebaseInfo),)
    timebase_info.restype = ctypes.c_int
    sysctl = library.sysctlbyname
    sysctl.argtypes = (
        ctypes.c_char_p,
        ctypes.c_void_p,
        ctypes.POINTER(ctypes.c_size_t),
        ctypes.c_void_p,
        ctypes.c_size_t,
    )
    sysctl.restype = ctypes.c_int

    timebase = TimebaseInfo()
    if timebase_info(ctypes.byref(timebase)) != 0:
        raise OSError("mach_timebase_info failed")
    if timebase.numer <= 0 or timebase.denom <= 0:
        raise ValueError("invalid Mach timebase")
    return continuous, sysctl, int(timebase.numer), int(timebase.denom)


def _macos_boot_clock() -> tuple[int, str]:
    import ctypes
    import uuid

    continuous, sysctl, numer, denom = _macos_clock_api()
    value = ctypes.create_string_buffer(128)
    length = ctypes.c_size_t(len(value))
    if (
        sysctl(
            b"kern.bootsessionuuid",
            value,
            ctypes.byref(length),
            None,
            0,
        )
        != 0
    ):
        raise OSError(ctypes.get_errno(), "kern.bootsessionuuid unavailable")
    if not 0 < length.value <= len(value):
        raise ValueError("invalid boot session UUID length")
    boot_id = str(uuid.UUID(value.value.decode("ascii")))
    ticks = int(continuous())
    if ticks < 0:
        raise ValueError("invalid Mach continuous time")
    return ticks * numer // denom, f"darwin:{boot_id}"


def now_clocks() -> tuple[int, int | None, str | None]:
    """Return wall time, suspend-aware boot time, and a reboot identifier."""
    wall_ns = time.time_ns()
    if platform_environment.is_windows():
        try:
            boot_ns = _windows_uptime_ns()
        except (AttributeError, OSError, TypeError, ValueError):
            return wall_ns, None, None
        if boot_ns < 0 or boot_ns > wall_ns:
            return wall_ns, None, None
        boot_minute = (wall_ns - boot_ns) // _MINUTE_NS
        return wall_ns, boot_ns, f"windows:{boot_minute}"

    if platform_environment.is_linux():
        boot_ns = None
        clock = getattr(time, "CLOCK_BOOTTIME", None)
        if clock is not None:
            try:
                boot_ns = time.clock_gettime_ns(clock)
            except (OSError, ValueError):
                pass
        return wall_ns, boot_ns, _linux_boot_id()
    if platform_environment.is_macos():
        try:
            boot_ns, boot_id = _macos_boot_clock()
        except (AttributeError, OSError, TypeError, ValueError):
            # A clock without a reboot identifier cannot safely span processes.
            return wall_ns, None, None
        return wall_ns, boot_ns, boot_id
    return wall_ns, None, None
