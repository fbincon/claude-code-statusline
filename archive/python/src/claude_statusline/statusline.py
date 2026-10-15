"""Compatibility entry point; implementation lives in the documented subpackages."""

from importlib import import_module

_EXPORTS = {
    "ANSI_PALETTE": ("claude_statusline.rendering.palette", "ANSI_PALETTE"),
    "ANSI_SGR_RE": ("claude_statusline.rendering.layout", "ANSI_SGR_RE"),
    "BASE_DIR": ("claude_statusline.runtime.paths", "BASE_DIR"),
    "CONFIG_DIR": ("claude_statusline.runtime.paths", "CONFIG_DIR"),
    "C_BRANCH": ("claude_statusline.rendering.palette", "C_BRANCH"),
    "C_DIR": ("claude_statusline.rendering.palette", "C_DIR"),
    "C_GIT_ERROR": ("claude_statusline.rendering.palette", "C_GIT_ERROR"),
    "C_JOIN": ("claude_statusline.rendering.palette", "C_JOIN"),
    "C_MODEL": ("claude_statusline.rendering.palette", "C_MODEL"),
    "C_PCT": ("claude_statusline.rendering.palette", "C_PCT"),
    "C_RESET": ("claude_statusline.rendering.palette", "C_RESET"),
    "C_SEP": ("claude_statusline.rendering.palette", "C_SEP"),
    "C_SIZE": ("claude_statusline.rendering.palette", "C_SIZE"),
    "C_TIMER": ("claude_statusline.rendering.palette", "C_TIMER"),
    "C_TOKENS": ("claude_statusline.rendering.palette", "C_TOKENS"),
    "DEFAULT_CONFIG": ("claude_statusline.config.display", "DEFAULT_CONFIG"),
    "DEFAULT_PALETTE": ("claude_statusline.rendering.palette", "DEFAULT_PALETTE"),
    "DEFAULT_TERMINAL_COLUMNS": (
        "claude_statusline.rendering.layout",
        "DEFAULT_TERMINAL_COLUMNS",
    ),
    "DisplayConfig": ("claude_statusline.config.display", "DisplayConfig"),
    "DisplayConfigError": ("claude_statusline.config.display", "DisplayConfigError"),
    "GIT_CACHE_DIR": ("claude_statusline.runtime.paths", "GIT_CACHE_DIR"),
    "GIT_CACHE_MAX_AGE_NS": ("claude_statusline.runtime.paths", "GIT_CACHE_MAX_AGE_NS"),
    "GIT_CACHE_MAX_FILES": ("claude_statusline.runtime.paths", "GIT_CACHE_MAX_FILES"),
    "GIT_CACHE_TTL_NS": ("claude_statusline.runtime.paths", "GIT_CACHE_TTL_NS"),
    "GIT_CACHE_VERSION": ("claude_statusline.runtime.paths", "GIT_CACHE_VERSION"),
    "MAX_IDS_PER_SESSION": ("claude_statusline.runtime.paths", "MAX_IDS_PER_SESSION"),
    "MAX_SESSIONS": ("claude_statusline.runtime.paths", "MAX_SESSIONS"),
    "MIN_CONTENT_WIDTH": ("claude_statusline.rendering.layout", "MIN_CONTENT_WIDTH"),
    "NO_COLOR_PALETTE": ("claude_statusline.rendering.palette", "NO_COLOR_PALETTE"),
    "Path": ("claude_statusline.runtime.cache", "Path"),
    "RUNTIME_ROOT": ("claude_statusline.runtime.paths", "RUNTIME_ROOT"),
    "SESSIONS_DIR": ("claude_statusline.runtime.paths", "SESSIONS_DIR"),
    "STATEFILE": ("claude_statusline.runtime.paths", "STATEFILE"),
    "STATE_LOCKFILE": ("claude_statusline.runtime.paths", "STATE_LOCKFILE"),
    "STATUSLINE_WIDTH_MARGIN": (
        "claude_statusline.rendering.layout",
        "STATUSLINE_WIDTH_MARGIN",
    ),
    "TURN_SCAN_VERSION": ("claude_statusline.runtime.paths", "TURN_SCAN_VERSION"),
    "USAGE_SCAN_VERSION": ("claude_statusline.runtime.paths", "USAGE_SCAN_VERSION"),
    "_BASE": ("claude_statusline.runtime.paths", "_BASE"),
    "_CACHE_MISS": ("claude_statusline.runtime.git", "_CACHE_MISS"),
    "_ITEM_METHODS": ("claude_statusline.rendering.items", "_ITEM_METHODS"),
    "_LOCAL_COMMAND_PREFIXES": (
        "claude_statusline.runtime.transcript",
        "_LOCAL_COMMAND_PREFIXES",
    ),
    "_LayoutSegment": ("claude_statusline.rendering.layout", "_LayoutSegment"),
    "_NOT_LOADED": ("claude_statusline.rendering.items", "_NOT_LOADED"),
    "_Palette": ("claude_statusline.rendering.palette", "_Palette"),
    "_RATE_LIMIT_ITEMS": ("claude_statusline.rendering.items", "_RATE_LIMIT_ITEMS"),
    "_REAL_PROMPT_SOURCES": (
        "claude_statusline.runtime.transcript",
        "_REAL_PROMPT_SOURCES",
    ),
    "_RenderState": ("claude_statusline.rendering.items", "_RenderState"),
    "_RenderedItem": ("claude_statusline.rendering.items", "_RenderedItem"),
    "_STATE_LOCK_CONTEXTS": ("claude_statusline.runtime.cache", "_STATE_LOCK_CONTEXTS"),
    "_SampleRenderState": ("claude_statusline.rendering.preview", "_SampleRenderState"),
    "_StyledUnit": ("claude_statusline.rendering.layout", "_StyledUnit"),
    "_accept_pending_snapshot": (
        "claude_statusline.runtime.usage",
        "_accept_pending_snapshot",
    ),
    "_acquire_state_lock": ("claude_statusline.runtime.cache", "_acquire_state_lock"),
    "_aggregate_visible": ("claude_statusline.runtime.usage", "_aggregate_visible"),
    "_char_width": ("claude_statusline.rendering.layout", "_char_width"),
    "_coalesce_items": ("claude_statusline.rendering.items", "_coalesce_items"),
    "_collapse_ids": ("claude_statusline.runtime.usage", "_collapse_ids"),
    "_collect_subagent_files": (
        "claude_statusline.runtime.usage",
        "_collect_subagent_files",
    ),
    "_configured_segments": (
        "claude_statusline.rendering.items",
        "_configured_segments",
    ),
    "_configured_segments_with_state": (
        "claude_statusline.rendering.items",
        "_configured_segments_with_state",
    ),
    "_display_usage_totals": (
        "claude_statusline.runtime.usage",
        "_display_usage_totals",
    ),
    "_display_width": ("claude_statusline.rendering.layout", "_display_width"),
    "_ensure_reset": ("claude_statusline.rendering.layout", "_ensure_reset"),
    "_fmt_duration": ("claude_statusline.rendering.timer", "_fmt_duration"),
    "_git_cache_path": ("claude_statusline.runtime.git", "_git_cache_path"),
    "_git_segment": ("claude_statusline.runtime.git", "_git_segment"),
    "_is_local_command_record": (
        "claude_statusline.runtime.transcript",
        "_is_local_command_record",
    ),
    "_is_real_prompt_record": (
        "claude_statusline.runtime.transcript",
        "_is_real_prompt_record",
    ),
    "_layout_segments": ("claude_statusline.rendering.layout", "_layout_segments"),
    "_live_directory": ("claude_statusline.rendering.items", "_live_directory"),
    "_load_state": ("claude_statusline.runtime.cache", "_load_state"),
    "_local_command_is_current": (
        "claude_statusline.rendering.timer",
        "_local_command_is_current",
    ),
    "_maybe_update_turn": (
        "claude_statusline.runtime.transcript",
        "_maybe_update_turn",
    ),
    "_merge_ids": ("claude_statusline.runtime.usage", "_merge_ids"),
    "_palette_for": ("claude_statusline.rendering.palette", "_palette_for"),
    "_parse_cost_snapshot": ("claude_statusline.runtime.usage", "_parse_cost_snapshot"),
    "_parse_usage": ("claude_statusline.runtime.usage", "_parse_usage"),
    "_proc_start_time": ("claude_statusline.runtime.registry", "_proc_start_time"),
    "_prune_git_cache": ("claude_statusline.runtime.git", "_prune_git_cache"),
    "_rate_limit_item": ("claude_statusline.rendering.items", "_rate_limit_item"),
    "_rate_limit_segment": ("claude_statusline.rendering.items", "_rate_limit_segment"),
    "_read_cli_session_status": (
        "claude_statusline.runtime.registry",
        "_read_cli_session_status",
    ),
    "_read_git_cache": ("claude_statusline.runtime.git", "_read_git_cache"),
    "_read_transcript_chunk": (
        "claude_statusline.runtime.transcript",
        "_read_transcript_chunk",
    ),
    "_release_state_lock": ("claude_statusline.runtime.cache", "_release_state_lock"),
    "_render_state_timer": ("claude_statusline.rendering.timer", "_render_state_timer"),
    "_render_styled_units": (
        "claude_statusline.rendering.layout",
        "_render_styled_units",
    ),
    "_sample_preview_data": (
        "claude_statusline.rendering.preview",
        "_sample_preview_data",
    ),
    "_save_state": ("claude_statusline.runtime.cache", "_save_state"),
    "_separators": ("claude_statusline.rendering.palette", "_separators"),
    "_sgr_style_after": ("claude_statusline.rendering.layout", "_sgr_style_after"),
    "_shared_format_duration": (
        "claude_statusline.rendering.formatters",
        "format_duration",
    ),
    "_shared_humanize_tokens": (
        "claude_statusline.rendering.formatters",
        "humanize_tokens",
    ),
    "_split_ansi_text": ("claude_statusline.rendering.layout", "_split_ansi_text"),
    "_stage_cost_snapshot": ("claude_statusline.runtime.usage", "_stage_cost_snapshot"),
    "_stage_subagent_snapshot_delta": (
        "claude_statusline.runtime.usage",
        "_stage_subagent_snapshot_delta",
    ),
    "_state_elapsed_seconds": (
        "claude_statusline.rendering.timer",
        "_state_elapsed_seconds",
    ),
    "_styled_separator": ("claude_statusline.rendering.palette", "_styled_separator"),
    "_styled_units": ("claude_statusline.rendering.layout", "_styled_units"),
    "_terminal_content_width": (
        "claude_statusline.rendering.layout",
        "_terminal_content_width",
    ),
    "_timer_segment": ("claude_statusline.rendering.timer", "_timer_segment"),
    "_ts_to_epoch": ("claude_statusline.runtime.transcript", "_ts_to_epoch"),
    "_turn_events": ("claude_statusline.runtime.transcript", "_turn_events"),
    "_uncached_git_status": ("claude_statusline.runtime.git", "_uncached_git_status"),
    "_update_file": ("claude_statusline.runtime.usage", "_update_file"),
    "_usage_int": ("claude_statusline.runtime.usage", "_usage_int"),
    "_valid_git_result": ("claude_statusline.runtime.git", "_valid_git_result"),
    "_visible_semantic_totals": (
        "claude_statusline.runtime.usage",
        "_visible_semantic_totals",
    ),
    "_write_git_cache": ("claude_statusline.runtime.git", "_write_git_cache"),
    "dataclass": ("claude_statusline.rendering.layout", "dataclass"),
    "datetime": ("claude_statusline.runtime.transcript", "datetime"),
    "deep_get": ("claude_statusline.rendering.formatters", "deep_get"),
    "format_directory": ("claude_statusline.config.display", "format_directory"),
    "git_status": ("claude_statusline.runtime.git", "git_status"),
    "hashlib": ("claude_statusline.runtime.usage", "hashlib"),
    "humanize_api_tokens": ("claude_statusline.rendering.items", "humanize_api_tokens"),
    "humanize_tokens": ("claude_statusline.rendering.formatters", "humanize_tokens"),
    "json": ("claude_statusline.runtime.cache", "json"),
    "load_display_config": ("claude_statusline.config.display", "load_display_config"),
    "load_turn_state": ("claude_statusline.runtime.turns.store", "load_turn_state"),
    "main": ("claude_statusline.rendering.main", "main"),
    "math": ("claude_statusline.rendering.items", "math"),
    "now_clocks": ("claude_statusline.runtime.turns.store", "now_clocks"),
    "os": ("claude_statusline.runtime.usage", "os"),
    "re": ("claude_statusline.rendering.layout", "re"),
    "reconcile_idle_state": (
        "claude_statusline.runtime.turns.reducer",
        "reconcile_idle_state",
    ),
    "reconcile_transcript_events": (
        "claude_statusline.runtime.turns.reducer",
        "reconcile_transcript_events",
    ),
    "render_preview_rows": (
        "claude_statusline.rendering.preview",
        "render_preview_rows",
    ),
    "sanitize_payload_text": (
        "claude_statusline.rendering.formatters",
        "sanitize_payload_text",
    ),
    "session_token_totals": ("claude_statusline.runtime.usage", "session_token_totals"),
    "socket": ("claude_statusline.rendering.items", "socket"),
    "subprocess": ("claude_statusline.runtime.git", "subprocess"),
    "sys": ("claude_statusline.rendering.main", "sys"),
    "time": ("claude_statusline.runtime.git", "time"),
    "unicodedata": ("claude_statusline.rendering.layout", "unicodedata"),
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


if __name__ == "__main__":
    raise SystemExit(__getattr__("main")())
