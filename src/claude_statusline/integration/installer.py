"""integration / installer implementation."""

from __future__ import annotations

import json
from pathlib import Path
from dataclasses import replace
from claude_statusline.config import display as config_display
from claude_statusline.config import features as config_features
from claude_statusline.config import native as native_preference
from claude_statusline.config import runtime as runtime_preference
from claude_statusline.config import storage as config_storage
from claude_statusline.integration import capabilities as integration_capabilities
from claude_statusline.integration import install_plan as integration_install_plan
from claude_statusline.integration import models as integration_models
from claude_statusline.integration import ownership as integration_ownership
from claude_statusline.integration import resources as integration_resources
from claude_statusline.integration import native as native_integration
from claude_statusline.integration import runtime as runtime_integration
from claude_statusline.platforms import files as platform_files


def _change_configuration(
    action: str,
    config_dir: Path,
    executable: Path,
    dry_run: bool,
    force: bool = False,
    claude_version: tuple[int, int, int] | None = None,
    experimental_slash_tui: bool | None = None,
    native_editor: bool | None = None,
    live_metrics: bool | None = None,
    native_timing: bool | None = None,
) -> integration_models.ChangeResult:
    settings_path = config_dir / "settings.json"
    skill_path, owner_path = integration_resources.skill_paths(config_dir)
    experimental_skill_path, experimental_owner_path = (
        integration_resources.experimental_skill_paths(config_dir)
    )
    preference_path = config_features.feature_path(config_dir)
    native_path = native_preference.preference_path(config_dir)

    def private_mode(path: Path) -> bool:
        return platform_files.private_mode_matches(path, 0o600) is not False

    def prepare():
        settings, settings_raw = config_storage._read_settings(settings_path)
        preference_raw = config_storage._read_optional_bytes(preference_path)
        preference_enabled = (
            action == "install" and config_features.enabled_by_default()
        )
        if action == "install" and preference_raw is not None:
            try:
                preference_enabled = config_features.parse_feature_bytes(
                    preference_raw, preference_path
                )
            except config_features.FeatureConfigError as exc:
                if experimental_slash_tui is None:
                    raise integration_models.ConfigurationError(str(exc)) from exc
        if action == "install" and experimental_slash_tui is not None:
            preference_enabled = experimental_slash_tui

        fast_slash_hook = integration_capabilities.supports_fast_slash_hook(
            claude_version
        )
        subagent_supported = integration_capabilities.supports_subagent_statusline(
            claude_version
        )
        try:
            display = config_display.load_display_config(config_dir)
        except config_display.DisplayConfigError:
            display = config_display.DEFAULT_CONFIG
        experimental_active = preference_enabled and fast_slash_hook
        external_command = (
            config_dir
            / "commands"
            / (integration_models.EXPERIMENTAL_SLASH_COMMAND_NAME + ".md")
        )
        if (
            action == "install"
            and experimental_active
            and (external_command.exists() or external_command.is_symlink())
        ):
            raise integration_models.ConfigurationError(
                "Foreign /statusline-configure command; rename it before enabling "
                "the external TUI"
            )
        if action == "install":
            updated_settings = integration_install_plan._prepare_install(
                settings,
                config_dir,
                executable,
                force,
                fast_slash_hook=fast_slash_hook,
                experimental_slash_tui=experimental_active,
                subagent_supported=subagent_supported,
                subagent_enabled=display.subagents.enabled,
            )
        else:
            updated_settings = integration_install_plan._prepare_uninstall(
                settings, config_dir, executable
            )

        skill_raw = config_storage._read_optional_bytes(skill_path)
        owner_raw = config_storage._read_optional_bytes(owner_path)
        skill_owned = integration_ownership._is_owned_skill_marker(owner_raw)
        experimental_skill_raw = config_storage._read_optional_bytes(
            experimental_skill_path
        )
        experimental_owner_raw = config_storage._read_optional_bytes(
            experimental_owner_path
        )
        experimental_skill_owned = integration_ownership._is_owned_skill_marker(
            experimental_owner_raw
        )
        desired_skill: bytes | None | object = integration_models._UNCHANGED_ARTIFACT
        desired_owner: bytes | None | object = integration_models._UNCHANGED_ARTIFACT
        desired_experimental_skill: bytes | None | object = (
            integration_models._UNCHANGED_ARTIFACT
        )
        desired_experimental_owner: bytes | None | object = (
            integration_models._UNCHANGED_ARTIFACT
        )
        desired_preference: bytes | None | object = (
            integration_models._UNCHANGED_ARTIFACT
        )
        if action == "install":
            if (
                (skill_raw is not None or owner_raw is not None)
                and not skill_owned
                and not force
            ):
                raise integration_models.ConfigurationError(
                    f"an unrelated /{integration_models.SLASH_COMMAND_NAME} skill already exists; "
                    "rerun with --force only if replacing it is intentional"
                )
            desired_skill = integration_resources.render_skill(executable)
            desired_owner = integration_resources._skill_owner_bytes()

            if experimental_active:
                if (
                    (
                        experimental_skill_raw is not None
                        or experimental_owner_raw is not None
                    )
                    and not experimental_skill_owned
                    and not force
                ):
                    raise integration_models.ConfigurationError(
                        f"an unrelated /{integration_models.EXPERIMENTAL_SLASH_COMMAND_NAME} skill "
                        "already exists; rerun with --force only if replacing it "
                        "is intentional"
                    )
                desired_experimental_skill = (
                    integration_resources.render_experimental_skill()
                )
                desired_experimental_owner = integration_resources._skill_owner_bytes()
            elif experimental_skill_owned:
                desired_experimental_skill = None
                desired_experimental_owner = None

            if experimental_slash_tui is not None:
                desired_preference = config_features.preference_bytes(
                    experimental_slash_tui
                )
            elif preference_raw is not None:
                # Preserve valid bytes while still repairing private permissions.
                desired_preference = preference_raw
        else:
            if skill_owned:
                desired_skill = None
                desired_owner = None
            if experimental_skill_owned:
                desired_experimental_skill = None
                desired_experimental_owner = None

        def artifact_changed(
            path: Path,
            raw: bytes | None,
            desired: bytes | None | object,
            *,
            enforce_private: bool = False,
        ) -> bool:
            return desired is not integration_models._UNCHANGED_ARTIFACT and (
                desired != raw
                or (enforce_private and desired is not None and not private_mode(path))
            )

        candidates = [
            (
                "settings.json",
                settings_path,
                settings_raw,
                config_storage._json_bytes(updated_settings),
                updated_settings != settings,
            ),
            (
                config_features.FEATURE_FILENAME,
                preference_path,
                preference_raw,
                desired_preference,
                artifact_changed(
                    preference_path,
                    preference_raw,
                    desired_preference,
                    enforce_private=True,
                ),
            ),
            (
                "skill/SKILL.md",
                skill_path,
                skill_raw,
                desired_skill,
                desired_skill is not integration_models._UNCHANGED_ARTIFACT
                and desired_skill != skill_raw,
            ),
            (
                "skill/.claude-statusline-owner.json",
                owner_path,
                owner_raw,
                desired_owner,
                desired_owner is not integration_models._UNCHANGED_ARTIFACT
                and desired_owner != owner_raw,
            ),
            (
                "experimental-skill/SKILL.md",
                experimental_skill_path,
                experimental_skill_raw,
                desired_experimental_skill,
                artifact_changed(
                    experimental_skill_path,
                    experimental_skill_raw,
                    desired_experimental_skill,
                ),
            ),
            (
                "experimental-skill/.claude-statusline-owner.json",
                experimental_owner_path,
                experimental_owner_raw,
                desired_experimental_owner,
                artifact_changed(
                    experimental_owner_path,
                    experimental_owner_raw,
                    desired_experimental_owner,
                ),
            ),
        ]
        if action == "install" and native_editor is not None:
            native_raw = config_storage._read_optional_bytes(native_path)
            desired_native = native_preference.preference_bytes(native_editor)
            candidates.append(
                (
                    native_preference.FILENAME,
                    native_path,
                    native_raw,
                    desired_native,
                    artifact_changed(
                        native_path, native_raw, desired_native, enforce_private=True
                    ),
                )
            )
        if action == "install":
            display_path = config_display.config_path(config_dir)
            display_raw = config_storage._read_optional_bytes(display_path)
            if (
                display_raw is not None
                and json.loads(display_raw.decode("utf-8-sig"))["schema_version"]
                != config_display.SCHEMA_VERSION
            ):
                desired_display = config_storage._json_bytes(display.to_dict())
                candidates.append(
                    (
                        config_display.CONFIG_FILENAME,
                        display_path,
                        display_raw,
                        desired_display,
                        True,
                    )
                )
            runtime_path = runtime_preference.preference_path(config_dir)
            runtime_raw = config_storage._read_optional_bytes(runtime_path)
            if (
                runtime_raw is not None
                or live_metrics is not None
                or native_timing is not None
            ):
                desired_runtime = runtime_preference.preference_bytes(
                    live_metrics, native_timing=native_timing, config_dir=config_dir
                )
                candidates.append(
                    (
                        runtime_preference.FILENAME,
                        runtime_path,
                        runtime_raw,
                        desired_runtime,
                        artifact_changed(
                            runtime_path,
                            runtime_raw,
                            desired_runtime,
                            enforce_private=True,
                        ),
                    )
                )
        return [candidate for candidate in candidates if candidate[4]]

    if dry_run:
        changes = prepare()
        return integration_models.ChangeResult(
            action,
            bool(changes),
            settings_path,
            changed_paths=tuple(change[1] for change in changes),
        )

    config_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
    with config_storage._installation_lock(config_dir):
        changes = prepare()
        if not changes:
            return integration_models.ChangeResult(action, False, settings_path)
        backup_dir = config_storage._backup_artifacts(
            config_dir,
            action,
            [(name, path, raw) for name, path, raw, _desired, _ in changes],
        )
        try:
            for _name, path, _raw, desired, _changed in changes:
                config_storage._write_optional_bytes(path, desired)
        except OSError as exc:
            rollback_errors = []
            for _name, path, raw, _desired, _changed in reversed(changes):
                try:
                    config_storage._write_optional_bytes(path, raw)
                except OSError as rollback_exc:
                    rollback_errors.append(str(rollback_exc))
            suffix = (
                "; rollback also failed: " + "; ".join(rollback_errors)
                if rollback_errors
                else ""
            )
            raise integration_models.ConfigurationError(
                f"cannot {action} statusline configuration: {exc}{suffix}"
            ) from exc

        if action == "uninstall":
            for directory in (skill_path.parent, experimental_skill_path.parent):
                try:
                    directory.rmdir()
                except OSError:
                    pass
        elif action == "install":
            try:
                experimental_skill_path.parent.rmdir()
            except OSError:
                pass
        return integration_models.ChangeResult(
            action,
            True,
            settings_path,
            backup_dir,
            tuple(change[1] for change in changes),
        )


def install_configuration(
    config_dir: Path,
    executable: Path,
    *,
    dry_run: bool = False,
    force: bool = False,
    experimental_slash_tui: bool | None = None,
    native_editor: bool | None = None,
    live_metrics: bool | None = None,
    native_timing: bool | None = None,
    claude_version: tuple[int, int, int]
    | None
    | object = integration_models._DETECT_CLAUDE_VERSION,
) -> integration_models.ChangeResult:
    if claude_version is integration_models._DETECT_CLAUDE_VERSION:
        claude_version = integration_capabilities.detect_claude_version()
    requested = native_preference.requested(config_dir, native_editor)
    runtime_requested = runtime_preference.load(
        config_dir, live_metrics, native_timing
    ).enabled
    try:
        external_requested = (
            experimental_slash_tui
            if experimental_slash_tui is not None
            else config_features.load_experimental_slash_tui(config_dir)
        )
    except config_features.FeatureConfigError as exc:
        raise integration_models.ConfigurationError(str(exc)) from exc
    external_supported = integration_capabilities.supports_fast_slash_hook(
        claude_version
    )
    native_supported = (
        claude_version is not None and claude_version >= native_integration.MIN_VERSION
    )
    fallback = "Use claude-statusline configure, /statusline-config, or claude-statusline config in the meantime."
    external_message = (
        "External TUI disabled by preference."
        if not external_requested
        else "External TUI enabled: /statusline-configure opens the existing platform terminal."
        if external_supported
        else "External TUI suspended: Claude Code 2.1.258+ is required; preference retained. "
        "Rerun install after upgrading. " + fallback
    )
    if (
        requested
        and claude_version is not None
        and claude_version >= native_integration.MIN_VERSION
    ):
        native_integration.command_preflight(config_dir)
    # Prepare the compatibility transaction before any official plugin mutation.
    planned = _change_configuration(
        "install",
        config_dir,
        executable,
        True,
        force,
        claude_version=claude_version,
        experimental_slash_tui=experimental_slash_tui,
        native_editor=native_editor,
        live_metrics=live_metrics,
        native_timing=native_timing,
    )
    if dry_run:
        return replace(
            planned,
            native_state="requested"
            if requested and native_supported
            else "suspended"
            if requested
            else "disabled",
            messages=(
                external_message,
                f"Native editor {'requested' if native_supported else 'suspended: Claude Code 2.1.287+ is required'}; "
                "plugin operations are not executed by dry-run. " + fallback
                if requested
                else "Native editor disabled by preference; plugin operations are not executed by dry-run.",
            )
            + (
                f"Runtime collection {'requested' if runtime_requested else 'disabled'}; requires Claude Code 2.1.289+; dry-run performs no plugin operations.",
            ),
        )
    result = _change_configuration(
        "install",
        config_dir,
        executable,
        dry_run,
        force,
        claude_version=claude_version,
        experimental_slash_tui=experimental_slash_tui,
        native_editor=native_editor,
        live_metrics=live_metrics,
        native_timing=native_timing,
    )
    native = native_integration.integrate(
        config_dir, executable, requested, claude_version
    )
    runtime = runtime_integration.integrate(
        config_dir, executable, runtime_requested, claude_version
    )
    return replace(
        result,
        changed=result.changed or native.changed or runtime.changed,
        native_state=native.state,
        messages=(external_message,)
        + native.messages
        + runtime.messages
        + ((fallback,) if requested and not native_supported else ()),
        native_failed=native.state == "blocked"
        or runtime.state == "blocked"
        or (
            (live_metrics is True or native_timing is True)
            and not runtime.active
            and runtime.state != "suspended"
        )
        or (
            native_editor is True
            and not native.active
            and not (native.state == "suspended" and not native_supported)
        ),
    )


def uninstall_configuration(
    config_dir: Path,
    executable: Path,
    *,
    dry_run: bool = False,
) -> integration_models.ChangeResult:
    planned = _change_configuration("uninstall", config_dir, executable, True)
    if dry_run:
        return planned
    runtime = runtime_integration.integrate(
        config_dir, executable, False, None, uninstall=True
    )
    if runtime.state == "blocked":
        return replace(
            planned,
            changed=runtime.changed,
            changed_paths=(),
            messages=runtime.messages,
            native_failed=True,
        )
    native = native_integration.integrate(
        config_dir, executable, False, None, uninstall=True
    )
    if native.state == "blocked":
        return replace(
            planned,
            changed=native.changed,
            changed_paths=(),
            native_state=native.state,
            messages=native.messages,
            native_failed=True,
        )
    result = _change_configuration("uninstall", config_dir, executable, False)
    return replace(
        result,
        changed=result.changed or native.changed or runtime.changed,
        native_state=native.state,
        messages=native.messages + runtime.messages,
    )
