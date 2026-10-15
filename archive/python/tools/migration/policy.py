"""Reviewed behavior families and migration dispositions, not ported coverage."""

BEHAVIORS = {
    "CLI": (
        "Public commands, options, streams and exit behavior",
        "docs/reference/cli.md",
        "TS-03",
    ),
    "CONFIG": (
        "Strict display/host settings and historical in-memory migration",
        "docs/development/contracts.md",
        "TS-03",
    ),
    "INSTANCES": (
        "Stable identities, repeated types, text/spacer and layout references",
        "docs/COMPOSITION.md",
        "TS-03",
    ),
    "TRANSFER": (
        "Portable drafts, presets and read-only import review",
        "docs/development/contracts.md",
        "TS-03",
    ),
    "I18N": (
        "Independent UI/output languages and deterministic generated resources",
        "docs/development/i18n.md",
        "TS-03",
    ),
    "RENDER": (
        "Main/subagent output, metrics, fitting and lazy shared collection",
        "docs/development/rendering.md",
        "TS-03",
    ),
    "UNICODE": (
        "Fixed grapheme segmentation and terminal cell widths",
        "docs/development/rendering.md",
        "TS-03",
    ),
    "STYLES": (
        "ANSI/background resets, visibility and Powerline composition",
        "docs/APPEARANCE.md",
        "TS-03",
    ),
    "LIFECYCLE": (
        "Task ownership, Stop candidates, reports and frozen results",
        "docs/development/timer.md",
        "TS-03",
    ),
    "CLOCK": (
        "Lossless nanoseconds, overlapping waits, reboot and suspend clocks",
        "docs/development/timer.md",
        "TS-02",
    ),
    "USAGE": (
        "Incremental transcript/Git caches, attribution and byte cursors",
        "docs/DISPLAY_ITEMS.md",
        "TS-03",
    ),
    "LIVE": (
        "Strict observations, deduplication, bounded history and coverage",
        "docs/development/live.md",
        "TS-03",
    ),
    "FILES": (
        "Locks, atomic writes, file safety and process identities",
        "docs/development/architecture.md",
        "TS-02",
    ),
    "INSTALL": (
        "Ownership, opt-outs, install/upgrade/rollback/uninstall",
        "docs/USER_GUIDE.md",
        "TS-04",
    ),
    "TERMINAL": (
        "Terminal launch/input/restore, result bridge and resize",
        "docs/development/native.md",
        "TS-04",
    ),
    "EDITOR": (
        "Four-page drafts, forms, search, cancel and separate host Apply",
        "docs/development/native.md",
        "TS-04",
    ),
    "PROTOCOL": (
        "Editor JSON v11, complete saves, conflicts and revisions",
        "docs/development/contracts.md",
        "TS-03",
    ),
    "BUILD": (
        "Resource generation, packaging, documentation and release gates",
        "docs/RELEASING.md",
        "TS-05",
    ),
    "BENCHMARK": (
        "Frozen sources, isolated workloads and comparable measurements",
        "docs/development/performance-v2.0.0.md",
        "TS-02",
    ),
    "COMPAT": (
        "Legacy Python imports/module execution; retirement awaits D05",
        "docs/development/architecture.md",
        "TS-04",
    ),
}

TEST_OVERRIDES = {
    "test_compatibility": "COMPAT",
    "test_benchmark_render": "BENCHMARK",
    "test_cli": "CLI",
    "test_config_commands": "CLI",
    "test_language_cli": "I18N",
    "test_apply_protocol": "PROTOCOL",
    "test_protocol": "PROTOCOL",
    "test_instances": "INSTANCES",
    "test_instance_commands": "INSTANCES",
    "test_components": "INSTANCES",
    "test_instance_editor": "INSTANCES",
    "test_transfer": "TRANSFER",
    "test_import_review": "TRANSFER",
    "test_appearance": "STYLES",
    "test_styles": "STYLES",
    "test_theme": "STYLES",
    "test_graphemes": "UNICODE",
    "test_unicode_generation": "UNICODE",
    "test_feature_config": "INSTALL",
    "test_installer": "INSTALL",
    "test_native_installer": "INSTALL",
    "test_runtime_installer": "INSTALL",
    "test_native_resources": "BUILD",
    "test_publish_package": "BUILD",
    "test_release_documentation": "BUILD",
    "test_live_budget": "BUILD",
    "test_cli_tui": "TERMINAL",
    "test_slash_tui": "TERMINAL",
    "test_macos_terminal": "TERMINAL",
    "test_terminal": "TERMINAL",
    "test_tmux_popup": "TERMINAL",
    "test_windows_shells": "TERMINAL",
    "test_terminal_capture": "UNICODE",
    "test_terminal_colors": "STYLES",
    "test_slash_hook": "CLI",
    "test_clock": "CLOCK",
    "test_submission_index": "USAGE",
    "test_token_counts": "USAGE",
    "test_statusline_state": "USAGE",
    "test_branch_diff": "USAGE",
    "test_statusline_git": "USAGE",
    "test_live": "LIVE",
    "test_statusline_language": "I18N",
    "test_language": "I18N",
    "test_ui_preferences": "I18N",
}


def family(path, doc=""):
    from pathlib import PurePosixPath

    p = PurePosixPath(path)
    if path.startswith("tests/"):
        if "/runtime/live/" in path:
            return "LIVE"
        if p.stem in TEST_OVERRIDES:
            return TEST_OVERRIDES[p.stem]
        return {
            "config": "CONFIG",
            "i18n": "I18N",
            "integration": "CLI",
            "platforms": "FILES",
            "rendering": "RENDER",
            "runtime": "LIFECYCLE",
            "ui": "EDITOR",
        }.get(p.parts[1], "BUILD")
    if path == "src/build_native.py":
        return "BUILD"
    if path.startswith("tools/"):
        if "benchmark" in path:
            return "BENCHMARK"
        if "timer_acceptance" in path:
            return "LIFECYCLE"
        if "live_metrics" in path:
            return "LIVE"
        if "install_smoke" in path or "upgrade_" in path or "ci_smoke" in path:
            return "INSTALL"
        if "acceptance" in path or "terminal" in path or "capture" in path:
            return "TERMINAL"
        return "BUILD"
    if "Compatibility" in doc or p.stem in ("_compat", "_platform"):
        return "COMPAT"
    if "/i18n/" in path:
        return "I18N"
    if "/platforms/" in path:
        return "CLOCK" if p.stem == "clocks" else "FILES"
    if "/config/" in path:
        return {
            "commands": "CLI",
            "instance_commands": "INSTANCES",
            "instances": "INSTANCES",
            "transfer": "TRANSFER",
            "presets": "TRANSFER",
            "import_review": "TRANSFER",
            "appearance": "STYLES",
            "revisions": "PROTOCOL",
            "service": "PROTOCOL",
            "storage": "FILES",
            "ui_preferences": "I18N",
            "runtime": "INSTALL",
            "features": "INSTALL",
            "native": "INSTALL",
        }.get(p.stem, "CONFIG")
    if "/rendering/" in path:
        return {
            "text": "UNICODE",
            "_unicode_tables": "UNICODE",
            "styles": "STYLES",
            "powerline": "STYLES",
            "visibility": "STYLES",
            "timer": "LIFECYCLE",
        }.get(p.stem, "RENDER")
    if "/runtime/" in path:
        if "/live/" in path:
            return "LIVE"
        if "/timing/" in path:
            return "CLOCK"
        return "LIFECYCLE" if "/tasks/" in path or "/turns/" in path else "USAGE"
    if "/ui/" in path:
        return "PROTOCOL" if p.stem in ("protocol", "contracts") else "EDITOR"
    if "/integration/" in path:
        return {
            "lifecycle_hook": "LIFECYCLE",
            "slash_hook": "CLI",
            "bridge": "TERMINAL",
            "launcher": "TERMINAL",
        }.get(p.stem, "INSTALL")
    return "CLI"


def disposition(path, test_id=None, generated=False):
    if test_id and test_id.endswith(
        ".test_forwarded_functions_and_types_share_identity"
    ):
        return (
            "retire_python_detail",
            "D05 pending: Python object identity has no cross-language equivalent; retain the reference test until entry retirement is decided.",
        )
    if generated:
        return (
            "reuse_fixture",
            "Preserve data/expected bytes; transfer generator ownership without competing definitions.",
        )
    if path.endswith("__init__.py") or path in (
        "tests/support.py",
        "tests/config_support.py",
        "tests/runtime/live/support.py",
    ):
        return (
            "reuse_fixture",
            "Port shared fixtures/setup where needed; Python packaging glue itself is not a product capability.",
        )
    return (
        "port_behavior",
        "Preserve observable assertions; replace Python-specific adapters in the assigned migration stage.",
    )
