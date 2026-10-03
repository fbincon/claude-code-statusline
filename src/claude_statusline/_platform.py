"""Compatibility entry point; implementation lives in the documented subpackages."""

from importlib import import_module

_EXPORTS = {
    "Iterator": ("claude_statusline.platforms.files", "Iterator"),
    "Path": ("claude_statusline.platforms.files", "Path"),
    "_DOTNET_FILETIME_OFFSET_TICKS": (
        "claude_statusline.platforms.processes",
        "_DOTNET_FILETIME_OFFSET_TICKS",
    ),
    "_MINUTE_NS": ("claude_statusline.platforms.clocks", "_MINUTE_NS"),
    "_THREAD_LOCKS": ("claude_statusline.platforms.files", "_THREAD_LOCKS"),
    "_THREAD_LOCKS_GUARD": ("claude_statusline.platforms.files", "_THREAD_LOCKS_GUARD"),
    "_WINDOWS_RETRY_DELAYS": (
        "claude_statusline.platforms.files",
        "_WINDOWS_RETRY_DELAYS",
    ),
    "_WINDOWS_TRANSIENT_ERRORS": (
        "claude_statusline.platforms.files",
        "_WINDOWS_TRANSIENT_ERRORS",
    ),
    "_acquire_thread_lock": (
        "claude_statusline.platforms.files",
        "_acquire_thread_lock",
    ),
    "_is_transient_windows_error": (
        "claude_statusline.platforms.files",
        "_is_transient_windows_error",
    ),
    "_linux_boot_id": ("claude_statusline.platforms.clocks", "_linux_boot_id"),
    "_linux_process_start_token": (
        "claude_statusline.platforms.processes",
        "_linux_process_start_token",
    ),
    "_macos_boot_clock": ("claude_statusline.platforms.clocks", "_macos_boot_clock"),
    "_macos_clock_api": ("claude_statusline.platforms.clocks", "_macos_clock_api"),
    "_macos_process_start_token": (
        "claude_statusline.platforms.processes",
        "_macos_process_start_token",
    ),
    "_release_thread_lock": (
        "claude_statusline.platforms.files",
        "_release_thread_lock",
    ),
    "_retry_windows_file_operation": (
        "claude_statusline.platforms.files",
        "_retry_windows_file_operation",
    ),
    "_set_private_mode": ("claude_statusline.platforms.files", "_set_private_mode"),
    "_sync_parent_directory": (
        "claude_statusline.platforms.files",
        "_sync_parent_directory",
    ),
    "_windows_process_creation_filetime": (
        "claude_statusline.platforms.processes",
        "_windows_process_creation_filetime",
    ),
    "_windows_uptime_ns": ("claude_statusline.platforms.clocks", "_windows_uptime_ns"),
    "atomic_write_bytes": ("claude_statusline.platforms.files", "atomic_write_bytes"),
    "contextmanager": ("claude_statusline.platforms.files", "contextmanager"),
    "durable_unlink": ("claude_statusline.platforms.files", "durable_unlink"),
    "errno": ("claude_statusline.platforms.files", "errno"),
    "exclusive_file_lock": ("claude_statusline.platforms.files", "exclusive_file_lock"),
    "is_link_or_reparse": ("claude_statusline.platforms.files", "is_link_or_reparse"),
    "is_linux": ("claude_statusline.platforms.environment", "is_linux"),
    "is_macos": ("claude_statusline.platforms.environment", "is_macos"),
    "is_supported_platform": (
        "claude_statusline.platforms.environment",
        "is_supported_platform",
    ),
    "is_windows": ("claude_statusline.platforms.environment", "is_windows"),
    "is_wsl": ("claude_statusline.platforms.environment", "is_wsl"),
    "lru_cache": ("claude_statusline.platforms.clocks", "lru_cache"),
    "new_console_creation_flags": (
        "claude_statusline.platforms.environment",
        "new_console_creation_flags",
    ),
    "no_window_creation_flags": (
        "claude_statusline.platforms.environment",
        "no_window_creation_flags",
    ),
    "now_clocks": ("claude_statusline.platforms.clocks", "now_clocks"),
    "os": ("claude_statusline.platforms.files", "os"),
    "platform": ("claude_statusline.platforms.environment", "platform"),
    "private_mode_matches": (
        "claude_statusline.platforms.files",
        "private_mode_matches",
    ),
    "process_start_token": (
        "claude_statusline.platforms.processes",
        "process_start_token",
    ),
    "stat": ("claude_statusline.platforms.files", "stat"),
    "subprocess": ("claude_statusline.platforms.processes", "subprocess"),
    "sys": ("claude_statusline.platforms.environment", "sys"),
    "tempfile": ("claude_statusline.platforms.files", "tempfile"),
    "threading": ("claude_statusline.platforms.files", "threading"),
    "time": ("claude_statusline.platforms.clocks", "time"),
    "uses_posix_files": ("claude_statusline.platforms.environment", "uses_posix_files"),
}

_MODULES = {}


def __getattr__(name):
    if name in _MODULES:
        return import_module(_MODULES[name])
    try:
        module, attribute = _EXPORTS[name]
    except KeyError:
        raise AttributeError(name) from None
    return getattr(import_module(module), attribute)


def __dir__():
    return sorted(set(globals()) | set(_EXPORTS))
