"""Compatibility entry point; implementation lives in the documented subpackages."""

from importlib import import_module

_EXPORTS = {
    "ALLOWED_OUTCOMES": ("claude_statusline.integration.models", "ALLOWED_OUTCOMES"),
    "DEADLINE_ENV": ("claude_statusline.integration.models", "DEADLINE_ENV"),
    "DEADLINE_SECONDS": ("claude_statusline.integration.models", "DEADLINE_SECONDS"),
    "INVOCATION_PREFIX": ("claude_statusline.integration.models", "INVOCATION_PREFIX"),
    "LAUNCHER_TIMEOUT_SECONDS": (
        "claude_statusline.integration.models",
        "LAUNCHER_TIMEOUT_SECONDS",
    ),
    "Launcher": ("claude_statusline.integration.models", "Launcher"),
    "Mapping": ("claude_statusline.integration.launcher", "Mapping"),
    "PREFLIGHT_TIMEOUT_SECONDS": (
        "claude_statusline.integration.models",
        "PREFLIGHT_TIMEOUT_SECONDS",
    ),
    "Path": ("claude_statusline.integration.bridge", "Path"),
    "RESULT_ENV": ("claude_statusline.integration.models", "RESULT_ENV"),
    "RESULT_FILENAME": ("claude_statusline.integration.models", "RESULT_FILENAME"),
    "RESULT_SCHEMA_VERSION": (
        "claude_statusline.integration.models",
        "RESULT_SCHEMA_VERSION",
    ),
    "RESULT_SIZE_LIMIT": ("claude_statusline.integration.models", "RESULT_SIZE_LIMIT"),
    "ResultError": ("claude_statusline.integration.models", "ResultError"),
    "STALE_AFTER_SECONDS": (
        "claude_statusline.integration.models",
        "STALE_AFTER_SECONDS",
    ),
    "TuiResult": ("claude_statusline.integration.models", "TuiResult"),
    "UNAVAILABLE_MESSAGE": (
        "claude_statusline.integration.models",
        "UNAVAILABLE_MESSAGE",
    ),
    "_CONTROL_PATTERN": ("claude_statusline.integration.models", "_CONTROL_PATTERN"),
    "_INVOCATION_PATTERN": (
        "claude_statusline.integration.models",
        "_INVOCATION_PATTERN",
    ),
    "_PANE_PATTERN": ("claude_statusline.integration.models", "_PANE_PATTERN"),
    "_clean_current_invocation": (
        "claude_statusline.integration.bridge",
        "_clean_current_invocation",
    ),
    "_configure_argv": ("claude_statusline.integration.launcher", "_configure_argv"),
    "_create_invocation_dir": (
        "claude_statusline.integration.bridge",
        "_create_invocation_dir",
    ),
    "_decode_result": ("claude_statusline.integration.bridge", "_decode_result"),
    "_error": ("claude_statusline.integration.models", "_error"),
    "_failure_message": ("claude_statusline.integration.launcher", "_failure_message"),
    "_read_capture": ("claude_statusline.integration.bridge", "_read_capture"),
    "_read_invocation_file": (
        "claude_statusline.integration.bridge",
        "_read_invocation_file",
    ),
    "_remove_stale_directory": (
        "claude_statusline.integration.bridge",
        "_remove_stale_directory",
    ),
    "_run_launcher": ("claude_statusline.integration.launcher", "_run_launcher"),
    "_safe_first_line": ("claude_statusline.integration.launcher", "_safe_first_line"),
    "_tmux_preflight": ("claude_statusline.integration.launcher", "_tmux_preflight"),
    "_tree_without_symlinks": (
        "claude_statusline.integration.bridge",
        "_tree_without_symlinks",
    ),
    "_which": ("claude_statusline.integration.launcher", "_which"),
    "build_launcher_argv": (
        "claude_statusline.integration.launcher",
        "build_launcher_argv",
    ),
    "choose_launcher": ("claude_statusline.integration.launcher", "choose_launcher"),
    "cleanup_stale_invocations": (
        "claude_statusline.integration.bridge",
        "cleanup_stale_invocations",
    ),
    "dataclass": ("claude_statusline.integration.models", "dataclass"),
    "json": ("claude_statusline.integration.bridge", "json"),
    "launch": ("claude_statusline.integration.launcher", "launch"),
    "os": ("claude_statusline.integration.bridge", "os"),
    "re": ("claude_statusline.integration.models", "re"),
    "read_result": ("claude_statusline.integration.bridge", "read_result"),
    "shlex": ("claude_statusline.integration.launcher", "shlex"),
    "shutil": ("claude_statusline.integration.launcher", "shutil"),
    "signal": ("claude_statusline.integration.launcher", "signal"),
    "stat": ("claude_statusline.integration.bridge", "stat"),
    "subprocess": ("claude_statusline.integration.launcher", "subprocess"),
    "sys": ("claude_statusline.integration.launcher", "sys"),
    "tempfile": ("claude_statusline.integration.launcher", "tempfile"),
    "time": ("claude_statusline.integration.bridge", "time"),
    "validate_cwd": ("claude_statusline.integration.launcher", "validate_cwd"),
}

_MODULES = {"_platform": "claude_statusline._platform"}


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
