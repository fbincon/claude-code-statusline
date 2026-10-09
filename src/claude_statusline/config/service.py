"""config / service implementation."""

from __future__ import annotations

from claude_statusline.i18n import message as msg, as_message

from collections.abc import Callable
from dataclasses import replace
from pathlib import Path
from typing import Any
from claude_statusline.config import display as config_display
from claude_statusline.config import advanced
from claude_statusline.config.formatting import FORMAT_CHOICES
from claude_statusline.config import host as config_host
from claude_statusline.config import models as config_models
from claude_statusline.config import storage as config_storage
from claude_statusline.config import revisions
from claude_statusline.integration import capabilities as integration_capabilities
from claude_statusline.integration import models as integration_models
from claude_statusline.platforms import files as platform_files


def _subagent_info(
    display: config_display.DisplayConfig,
    settings: dict,
    executable: Path,
) -> config_models.SubagentStatuslineInfo:
    version = integration_capabilities.detect_claude_version()
    state = (
        revisions.installation_identity(settings, executable)["subagentStatusLine"][
            "state"
        ]
        if integration_capabilities.supports_subagent_statusline(version)
        else "unsupported"
    )
    return config_models.SubagentStatuslineInfo(
        enabled=display.subagents.enabled,
        installed=state == "owned",
        state=state,
    )


def read_effective_config(
    config_dir: Path, executable: Path
) -> config_models.EffectiveConfig:
    try:
        with config_storage._installation_lock(config_dir):
            display = config_display.load_display_config(config_dir)
            settings, _ = config_storage._read_settings(config_dir / "settings.json")
            return _effective_snapshot(display, settings, config_dir, executable)
    except (
        config_display.DisplayConfigError,
        integration_models.ConfigurationError,
    ) as exc:
        raise config_models.ConfigCommandError(as_message(exc)) from exc


def _effective_snapshot(display, settings, config_dir, executable):
    host, installed = config_host._host_from_settings(settings, executable)
    return config_models.EffectiveConfig(
        display,
        host,
        installed,
        config_display.config_path(config_dir),
        _subagent_info(display, settings, executable),
        revisions.semantic_revision(display, host, settings, executable),
        revisions.installation_identity(settings, executable),
    )


def _read_display_for_mutation(
    config_dir: Path, *, tolerate_invalid: bool
) -> tuple[config_display.DisplayConfig, bytes | None]:
    try:
        return config_display.read_display_config(config_dir)
    except config_display.DisplayConfigError:
        if not tolerate_invalid:
            raise
        path = config_display.config_path(config_dir)
        try:
            return config_display.DEFAULT_CONFIG, path.read_bytes()
        except FileNotFoundError:
            return config_display.DEFAULT_CONFIG, None
        except OSError as exc:
            raise config_models.ConfigCommandError(
                msg('errors.service.cannot_read', path=path, exc=exc)
            ) from exc


def _backup_transaction(
    config_dir: Path,
    action: str,
    *,
    display_raw: bytes | None | object = config_models._UNCHANGED,
    settings_raw: bytes | None | object = config_models._UNCHANGED,
) -> Path:
    artifacts = []
    if display_raw is not config_models._UNCHANGED:
        artifacts.append(
            (
                "claude-statusline.json",
                config_display.config_path(config_dir),
                display_raw,
            )
        )
    if settings_raw is not config_models._UNCHANGED:
        artifacts.append(
            (
                "settings.json",
                config_dir / "settings.json",
                settings_raw,
            )
        )
    return config_storage._backup_artifacts(config_dir, action, artifacts)


def _delete_file(path: Path) -> None:
    platform_files.durable_unlink(path)


def mutate_configuration(
    config_dir: Path,
    executable: Path,
    action: str,
    mutation: config_models.Mutation,
    *,
    tolerate_invalid_display: bool = False,
) -> config_models.MutationResult:
    config_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
    try:
        with config_storage._installation_lock(config_dir):
            display, display_raw = _read_display_for_mutation(
                config_dir, tolerate_invalid=tolerate_invalid_display
            )
            settings, settings_raw = config_storage._read_settings(
                config_dir / "settings.json"
            )
            host, installed = config_host._host_from_settings(settings, executable)
            new_display, new_settings = mutation(display, settings, host, installed)

            display_changed = False
            if new_display is config_models._DELETE:
                display_changed = display_raw is not None
            elif new_display is not config_models._UNCHANGED:
                if not isinstance(new_display, config_display.DisplayConfig):
                    raise AssertionError("display mutation returned an invalid value")
                display_changed = (
                    config_display.display_config_bytes(new_display) != display_raw
                )

            settings_changed = (
                new_settings is not config_models._UNCHANGED
                and new_settings != settings
            )
            if not display_changed and not settings_changed:
                effective = _effective_snapshot(
                    display, settings, config_dir, executable
                )
                return config_models.MutationResult(False, effective)

            backup_dir = _backup_transaction(
                config_dir,
                action,
                display_raw=display_raw
                if display_changed
                else config_models._UNCHANGED,
                settings_raw=settings_raw
                if settings_changed
                else config_models._UNCHANGED,
            )
            try:
                if settings_changed:
                    config_storage._atomic_write_settings(
                        config_dir / "settings.json", new_settings
                    )
                if display_changed:
                    if new_display is config_models._DELETE:
                        _delete_file(config_display.config_path(config_dir))
                    else:
                        config_display.write_display_config(config_dir, new_display)
            except (OSError, config_display.DisplayConfigError) as exc:
                rollback_errors = []
                if display_changed:
                    try:
                        config_display.restore_bytes(
                            config_display.config_path(config_dir), display_raw
                        )
                    except config_display.DisplayConfigError as rollback_exc:
                        rollback_errors.append(str(rollback_exc))
                if settings_changed:
                    try:
                        config_display.restore_bytes(
                            config_dir / "settings.json", settings_raw
                        )
                    except config_display.DisplayConfigError as rollback_exc:
                        rollback_errors.append(str(rollback_exc))
                suffix = (
                    "; rollback also failed: " + "; ".join(rollback_errors)
                    if rollback_errors
                    else ""
                )
                raise config_models.ConfigWriteError(
                    msg('errors.service.configuration_update_failed', exc=exc, suffix=suffix)
                ) from exc

            effective_display = (
                config_display.DEFAULT_CONFIG
                if new_display is config_models._DELETE
                else new_display
                if new_display is not config_models._UNCHANGED
                else display
            )
            effective_settings = (
                new_settings
                if new_settings is not config_models._UNCHANGED
                else settings
            )
            effective = _effective_snapshot(
                effective_display, effective_settings, config_dir, executable
            )
            return config_models.MutationResult(True, effective, backup_dir)
    except (
        config_display.DisplayConfigError,
        integration_models.ConfigurationError,
    ) as exc:
        raise config_models.ConfigCommandError(as_message(exc)) from exc


def _validated_items(items: list[str]) -> tuple[str, ...]:
    try:
        return config_display.validate_items(items)
    except config_display.DisplayConfigError as exc:
        raise config_models.ConfigCommandError(as_message(exc)) from exc


def _validated_subagent_items(items: list[str]) -> tuple[str, ...]:
    try:
        return config_display.validate_subagent_items(items)
    except config_display.DisplayConfigError as exc:
        raise config_models.ConfigCommandError(as_message(exc)) from exc


def set_items(
    config_dir: Path, executable: Path, items: list[str]
) -> config_models.MutationResult:
    validated = _validated_items(items)
    return mutate_configuration(
        config_dir,
        executable,
        "config-set-items",
        lambda display, settings, host, installed: (
            display.with_updates(items=validated),
            config_models._UNCHANGED,
        ),
    )


def enable_items(
    config_dir: Path, executable: Path, items: list[str]
) -> config_models.MutationResult:
    validated = _validated_items(items)

    def mutation(display, settings, host, installed):
        enabled = list(display.items)
        enabled.extend(item for item in validated if item not in enabled)
        return display.with_updates(items=tuple(enabled)), config_models._UNCHANGED

    return mutate_configuration(config_dir, executable, "config-enable", mutation)


def disable_items(
    config_dir: Path, executable: Path, items: list[str]
) -> config_models.MutationResult:
    validated = _validated_items(items)
    disabled = set(validated)
    return mutate_configuration(
        config_dir,
        executable,
        "config-disable",
        lambda display, settings, host, installed: (
            display.with_updates(
                items=tuple(item for item in display.items if item not in disabled)
            ),
            config_models._UNCHANGED,
        ),
    )


def order_items(
    config_dir: Path, executable: Path, items: list[str]
) -> config_models.MutationResult:
    validated = _validated_items(items)

    def mutation(display, settings, host, installed):
        if set(validated) != set(display.items) or len(validated) != len(display.items):
            missing = [item for item in display.items if item not in validated]
            extra = [item for item in validated if item not in display.items]
            details = []
            if missing:
                details.append("missing: " + ", ".join(missing))
            if extra:
                details.append("not enabled: " + ", ".join(extra))
            raise config_models.ConfigCommandError(
                msg('errors.service.order_must_contain_every_enabled_item_exactly', value0=' (' + '; '.join(details) + ')' if details else '')
            )
        return display.with_updates(items=validated), config_models._UNCHANGED

    return mutate_configuration(config_dir, executable, "config-order", mutation)


def set_subagent_items(
    config_dir: Path, executable: Path, items: list[str]
) -> config_models.MutationResult:
    validated = _validated_subagent_items(items)
    return mutate_configuration(
        config_dir,
        executable,
        "config-subagents-set-items",
        lambda display, settings, host, installed: (
            display.with_updates(
                subagents=display.subagents.with_updates(items=validated)
            ),
            config_models._UNCHANGED,
        ),
    )


def enable_subagent_items(
    config_dir: Path, executable: Path, items: list[str]
) -> config_models.MutationResult:
    validated = _validated_subagent_items(items)

    def mutation(display, settings, host, installed):
        enabled = list(display.subagents.items)
        enabled.extend(item for item in validated if item not in enabled)
        return (
            display.with_updates(
                subagents=display.subagents.with_updates(items=tuple(enabled))
            ),
            config_models._UNCHANGED,
        )

    return mutate_configuration(
        config_dir, executable, "config-subagents-enable", mutation
    )


def disable_subagent_items(
    config_dir: Path, executable: Path, items: list[str]
) -> config_models.MutationResult:
    validated = _validated_subagent_items(items)
    disabled = set(validated)
    return mutate_configuration(
        config_dir,
        executable,
        "config-subagents-disable",
        lambda display, settings, host, installed: (
            display.with_updates(
                subagents=display.subagents.with_updates(
                    items=tuple(
                        item for item in display.subagents.items if item not in disabled
                    )
                )
            ),
            config_models._UNCHANGED,
        ),
    )


def order_subagent_items(
    config_dir: Path, executable: Path, items: list[str]
) -> config_models.MutationResult:
    validated = _validated_subagent_items(items)

    def mutation(display, settings, host, installed):
        current = display.subagents.items
        if set(validated) != set(current) or len(validated) != len(current):
            missing = [item for item in current if item not in validated]
            extra = [item for item in validated if item not in current]
            details = []
            if missing:
                details.append("missing: " + ", ".join(missing))
            if extra:
                details.append("not enabled: " + ", ".join(extra))
            raise config_models.ConfigCommandError(
                msg('errors.service.subagent_order_must_contain_every_enabled_item', value0=' (' + '; '.join(details) + ')' if details else '')
            )
        return (
            display.with_updates(
                subagents=display.subagents.with_updates(items=validated)
            ),
            config_models._UNCHANGED,
        )

    return mutate_configuration(
        config_dir, executable, "config-subagents-order", mutation
    )


def _display_with_option(
    display: config_display.DisplayConfig, option: str, value: Any
) -> config_display.DisplayConfig:
    try:
        if option == "branch-diff-base":
            return display.with_updates(
                metrics=replace(
                    display.metrics,
                    branch_diff_base_ref=None if value == "auto" else value,
                )
            )
        if option.startswith("subagent-") and option != "subagent-statusline":
            return advanced.edit_subagent(
                display, option.removeprefix("subagent-").replace("-", "_"), value
            )
        name = option.replace("-", "_")
        if name in FORMAT_CHOICES:
            return display.with_updates(
                formatting=replace(display.formatting, **{name: value})
            )
        if option in ("threshold-colors", "warning-threshold", "critical-threshold"):
            key = {
                "threshold-colors": "enabled",
                "warning-threshold": "warning",
                "critical-threshold": "critical",
            }[option]
            if key == "enabled":
                value = config_host._parse_toggle(value, option)
            else:
                try:
                    value = int(value)
                except (ValueError, TypeError) as exc:
                    raise config_models.ConfigCommandError(
                        msg('errors.service.threshold_must_be_an_integer')
                    ) from exc
            thresholds = replace(display.formatting.thresholds, **{key: value})
            return display.with_updates(
                formatting=replace(display.formatting, thresholds=thresholds)
            )
        if option == "colors":
            return display.with_updates(
                use_colors=config_host._parse_toggle(value, option)
            )
        if option == "palette":
            return display.with_updates(palette=value)
        if option == "directory-style":
            return display.with_updates(directory_style=value)
        if option == "separator-style":
            return display.with_updates(separator_style=value)
        if option == "scope-labels":
            return display.with_updates(scope_labels=value)
        if option == "subagent-statusline":
            return display.with_updates(
                subagents=display.subagents.with_updates(
                    enabled=config_host._parse_toggle(value, option)
                )
            )
    except config_display.DisplayConfigError as exc:
        raise config_models.ConfigCommandError(as_message(exc)) from exc
    raise config_models.ConfigCommandError(msg('errors.service.unknown_display_option', option=option))


def set_option(
    config_dir: Path,
    executable: Path,
    option: str,
    value: Any,
) -> config_models.MutationResult:
    if option not in config_models.OPTION_NAMES:
        raise config_models.ConfigCommandError(
            msg('errors.service.unknown_option_expected_one_of', value0=', '.join(sorted(config_models.OPTION_NAMES)))
        )

    def mutation(display, settings, host, installed):
        if option in config_models.DISPLAY_OPTION_NAMES:
            return _display_with_option(
                display, option, value
            ), config_models._UNCHANGED
        updated_host = config_host._host_with_option(host, option, value)
        return config_models._UNCHANGED, config_host._settings_with_host(
            settings, executable, updated_host
        )

    return mutate_configuration(
        config_dir, executable, f"config-set-{option}", mutation
    )


def apply_configuration(
    config_dir: Path,
    executable: Path,
    *,
    items: list[str],
    colors: Any,
    palette: str,
    directory_style: str,
    separator_style: str,
    padding: Any,
    refresh_interval: Any,
    hide_vim_mode_indicator: Any,
    subagent_items: list[str] | None = None,
    subagent_statusline: Any | None = None,
    scope_labels: str | None = None,
    expected: config_models.EffectiveConfig | None = None,
    expected_revision: str | None = None,
    display_draft: config_display.DisplayConfig | None = None,
    before_commit: Callable[[], None] | None = None,
) -> config_models.MutationResult:
    if display_draft is not None:
        display_draft = config_display.validate_display_config(display_draft.to_dict())
    validated_items = _validated_items(items)
    validated_subagent_items = (
        _validated_subagent_items(subagent_items)
        if subagent_items is not None
        else None
    )
    parsed_colors = config_host._parse_toggle(colors, "colors")
    parsed_subagent_statusline = (
        config_host._parse_toggle(subagent_statusline, "subagent-statusline")
        if subagent_statusline is not None
        else None
    )
    if scope_labels is not None and scope_labels not in config_display.SCOPE_LABELS:
        raise config_models.ConfigCommandError(
            msg('errors.service.scope_labels_must_be_one_of', value0=', '.join(config_display.SCOPE_LABELS))
        )
    host = config_models.HostConfig(
        config_host._parse_padding(padding),
        config_host._parse_refresh_interval(refresh_interval),
        config_host._parse_toggle(hide_vim_mode_indicator, "hide-vim-mode-indicator"),
    )

    def mutation(current_display, settings, current_host, installed):
        # This runs under the installation lock, including after a lock wait.
        if before_commit is not None:
            before_commit()
        baseline_revision = expected_revision
        if baseline_revision is None and expected is not None:
            baseline_revision = expected.revision
        if baseline_revision is not None:
            conflict = (
                revisions.semantic_revision(
                    current_display, current_host, settings, executable
                )
                != baseline_revision
            )
        else:
            conflict = expected is not None and (
                current_display != expected.display
                or current_host != expected.host
                or installed != expected.installed
            )
        if conflict:
            raise config_models.ConfigConflict(
                msg('errors.service.status_line_configuration_changed_while_the_editor')
            )
        if (
            revisions.installation_identity(settings, executable)["subagentStatusLine"][
                "state"
            ]
            == "foreign"
        ):
            raise config_models.ConfigOwnershipError(
                msg('errors.service.claude_code_subagentstatusline_belongs_to_another_renderer')
            )
        subagents = current_display.subagents
        if validated_subagent_items is not None:
            subagents = subagents.with_updates(items=validated_subagent_items)
        if parsed_subagent_statusline is not None:
            subagents = subagents.with_updates(enabled=parsed_subagent_statusline)
        try:
            display = current_display.with_updates(
                items=validated_items,
                use_colors=parsed_colors,
                palette=palette,
                directory_style=directory_style,
                separator_style=separator_style,
                scope_labels=(
                    current_display.scope_labels
                    if scope_labels is None
                    else scope_labels
                ),
                subagents=subagents,
            )
        except config_display.DisplayConfigError as exc:
            raise config_models.ConfigCommandError(as_message(exc)) from exc
        return display_draft or display, config_host._settings_with_host(
            settings, executable, host
        )

    return mutate_configuration(
        config_dir,
        executable,
        "config-apply",
        mutation,
    )


def reset_configuration(
    config_dir: Path, executable: Path
) -> config_models.MutationResult:
    def mutation(display, settings, host, installed):
        updated_settings = (
            config_host._settings_with_host(
                settings, executable, config_models.DEFAULT_HOST_CONFIG
            )
            if installed
            else config_models._UNCHANGED
        )
        return config_models._DELETE, updated_settings

    return mutate_configuration(
        config_dir,
        executable,
        "config-reset",
        mutation,
        tolerate_invalid_display=True,
    )
