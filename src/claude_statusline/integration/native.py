"""Owned local marketplace integration through official Claude plugin commands.

Plugin operations are separate from the compatibility file transaction. Never
infer session loading from a successful installation or edit plugin registries.
"""

from __future__ import annotations

from claude_statusline.i18n import message as msg, as_message

import hashlib
import json
import os
import re
import subprocess
from dataclasses import dataclass
from pathlib import Path

from claude_statusline.config import storage
from claude_statusline.integration import (
    capabilities,
)
from claude_statusline.integration.mods import ModSpec, NATIVE
from claude_statusline.integration.models import ConfigurationError, Diagnostic
from claude_statusline.platforms import environment, files as platform_files

MARKETPLACE = "claude-statusline-local"
PLUGIN = "statusline-native@" + MARKETPLACE
DIRECTORY = "statusline-native"
OWNER_FILE = ".claude-statusline-owner.json"
MIN_VERSION = (2, 1, 287)


@dataclass(frozen=True)
class NativeResult:
    state: str
    active: bool = False
    changed: bool = False
    messages: tuple[str, ...] = ()


def _binding_matches(options: object, expected: dict) -> bool:
    inputs = options.get("inputs") if isinstance(options, dict) else None
    # Old official caches/settings may retain the removed primaryCommand input.
    # Only declared backend inputs bind this Mod; legacy inputs have no handler.
    return isinstance(inputs, dict) and all(
        inputs.get(key) == (str(value).lower() if isinstance(value, bool) else value)
        for key, value in expected.items()
    )


class PluginError(ConfigurationError):
    pass


def _path(root: Path, name: str) -> Path:
    relative = Path(name)
    if relative.is_absolute() or ".." in relative.parts or "\\" in name:
        raise PluginError(msg('errors.native.unsafe_owned_native_resource_path'))
    path = root / relative
    if any(
        parent.is_symlink() for parent in (path, *path.parents) if parent != root.parent
    ):
        # Config directories may themselves resolve through a user-selected link;
        # callers resolve config_dir first. No link inside an owned root is valid.
        raise PluginError(msg('errors.native.native_resource_contains_a_symlink', path=path))
    return path


def _prune_empty_parents(root: Path, paths: list[Path]) -> None:
    parents = {
        parent
        for path in paths
        for parent in path.parents
        if parent.is_relative_to(root)
    }
    for directory in sorted(parents, key=lambda path: len(path.parts), reverse=True):
        if any(
            platform_files.is_link_or_reparse(parent)
            for parent in (directory, *directory.parents)
            if parent.is_relative_to(root)
        ):
            continue
        try:
            directory.rmdir()
        except OSError:
            # Unknown files/nonempty directories are never recursively removed.
            pass


def owner(
    config_dir: Path, *, allow_missing: bool = False, spec: ModSpec = NATIVE
) -> dict | None:
    config_dir = config_dir.resolve()
    root = config_dir / spec.name
    if root.is_symlink():
        raise PluginError(msg('errors.native.refusing_unrelated_native_directory', root=root))
    raw = storage._read_optional_bytes(root / OWNER_FILE)
    if raw is None:
        if root.exists():
            raise PluginError(
                msg('errors.native.unowned_native_directory_move_it_aside_before', root=root)
            )
        return None
    try:
        value = json.loads(raw)
        if (
            set(value)
            != {
                "owner",
                "schema_version",
                "files",
                "backend_version",
                "mod_version",
                "protocol_version",
                "suspended",
                "cache_inventories",
            }
            or value["owner"] != "claude-code-statusline"
            or type(value["schema_version"]) is not int
            or value["schema_version"] != 1
            or type(value["suspended"]) is not bool
            or type(value["protocol_version"]) is not int
            or value["protocol_version"] not in (1, 2, 3, 4, 5, 6, 7, 8, 9)
            or not isinstance(value["files"], dict)
            or not value["files"]
            or any(
                not isinstance(value[key], str)
                for key in ("backend_version", "mod_version")
            )
        ):
            raise ValueError("invalid owner fields")
        if (
            not isinstance(value["cache_inventories"], list)
            or len(value["cache_inventories"]) > 3
        ):
            raise ValueError("invalid cache inventory")
        for snapshot in value["cache_inventories"]:
            if (
                not isinstance(snapshot, dict)
                or set(snapshot) != {"mod_version", "files"}
                or not isinstance(snapshot["mod_version"], str)
                or not isinstance(snapshot["files"], dict)
                or f"plugins/{spec.name}/.claude-plugin/plugin.json"
                not in snapshot["files"]
            ):
                raise ValueError("invalid cache snapshot")
            for name, digest in snapshot["files"].items():
                if (
                    not isinstance(name, str)
                    or not isinstance(digest, str)
                    or not re.fullmatch("[a-f0-9]{64}", digest)
                ):
                    raise ValueError("invalid cache resource digest")
                if not (
                    name == ".claude-plugin/marketplace.json"
                    or name.startswith(f"plugins/{spec.name}/")
                ):
                    raise ValueError("unexpected cached resource")
                _path(root, name)
        for name, digest in value["files"].items():
            if (
                not isinstance(name, str)
                or not isinstance(digest, str)
                or not re.fullmatch("[a-f0-9]{64}", digest)
            ):
                raise ValueError("invalid resource digest")
            if not (
                name == ".claude-plugin/marketplace.json"
                or name.startswith(f"plugins/{spec.name}/")
            ):
                raise ValueError("unexpected owned resource")
            path = _path(root, name)
            content = storage._read_optional_bytes(path)
            if content is None and allow_missing:
                continue
            if content is None or hashlib.sha256(content).hexdigest() != digest:
                raise PluginError(
                    msg('errors.native.native_resource_changed_or_missing_restore_the', path=path)
                )
        return value
    except (ValueError, TypeError, KeyError, AttributeError) as exc:
        raise PluginError(
            msg('errors.native.untrusted_native_ownership_marker', value0=root / OWNER_FILE)
        ) from exc


class Host:
    def __init__(self, config_dir: Path):
        self.config_dir = config_dir
        self.command = capabilities.claude_argv()

    def run(self, *args: str, values: dict | None = None, json_result: bool = False):
        env = dict(
            os.environ, CLAUDE_CONFIG_DIR=str(self.config_dir), DISABLE_AUTOUPDATER="1"
        )
        env.pop("CLAUDECODE", None)
        try:
            result = subprocess.run(
                [*self.command, "plugin", *args],
                cwd=self.config_dir,
                env=env,
                input=json.dumps(
                    {
                        key: str(value).lower() if isinstance(value, bool) else value
                        for key, value in values.items()
                    }
                )
                if values is not None
                else None,
                capture_output=True,
                text=True,
                encoding="utf-8",
                timeout=45,
                check=False,
                creationflags=environment.no_window_creation_flags(),
            )
        except (OSError, subprocess.SubprocessError) as exc:
            raise PluginError(
                msg('errors.native.official_plugin_operation_could_not_be_confirmed', value0=args[0], value1=type(exc).__name__)
            ) from exc
        if result.returncode:
            detail = (result.stderr or result.stdout).strip()
            detail = re.sub(r"[\x00-\x1f\x7f]", " ", detail)[:500]
            raise PluginError(msg('errors.native.official_plugin_operation_refused', value0=args[0], detail=detail))
        if json_result:
            try:
                return json.loads(result.stdout)
            except ValueError as exc:
                raise PluginError(
                    msg('errors.native.official_plugin_operation_returned_invalid_json', value0=args[0])
                ) from exc
        return None

    def listing(self) -> tuple[list[dict], list[dict]]:
        marketplaces = self.run("marketplace", "list", "--json", json_result=True)
        plugins = self.run("list", "--json", json_result=True)
        if (
            not isinstance(marketplaces, list)
            or not isinstance(plugins, list)
            or any(not isinstance(row, dict) for row in [*marketplaces, *plugins])
        ):
            raise PluginError(msg('errors.native.unexpected_official_plugin_inventory'))
        return marketplaces, plugins


def _registered(
    config_dir: Path,
    marketplaces: list[dict],
    plugins: list[dict],
    marker: dict | None,
    *,
    spec: ModSpec = NATIVE,
):
    matches = [row for row in marketplaces if row.get("name") == spec.marketplace]
    if matches and (
        len(matches) != 1
        or matches[0].get("source") != "directory"
        or Path(matches[0].get("path", "")).resolve() != config_dir / spec.name
        or marker is None
    ):
        raise PluginError(
            msg('errors.native.foreign_marketplace_rename_remove_its_registration_yourself', value0=spec.marketplace)
        )
    rows = [row for row in plugins if row.get("id") == spec.plugin]
    if rows and (len(rows) != 1 or rows[0].get("scope") != "user" or marker is None):
        raise PluginError(
            msg('errors.native.foreign_or_ambiguous_plugin_resolve_its_scope', value0=spec.plugin)
        )
    return matches, rows[0] if rows else None


def _cache_owned(
    config_dir: Path,
    row: dict,
    marker: dict,
    *,
    require_current=False,
    spec: ModSpec = NATIVE,
) -> Path:
    path = Path(row.get("installPath", "")).resolve()
    expected = config_dir / "plugins/cache" / spec.marketplace / spec.name
    if not path.is_relative_to(expected) or path == expected:
        raise PluginError(
            msg('errors.native.installed_native_mod_location_version_differs_from')
        )
    snapshots = [{"mod_version": marker["mod_version"], "files": marker["files"]}]
    if not require_current:
        snapshots += marker["cache_inventories"]
    for snapshot in snapshots:
        if row.get("version") != snapshot["mod_version"]:
            continue
        matched = True
        for name, digest in snapshot["files"].items():
            prefix = f"plugins/{spec.name}/"
            if name.startswith(prefix):
                target = _path(path, name[len(prefix) :])
                content = storage._read_optional_bytes(target)
                if content is None or hashlib.sha256(content).hexdigest() != digest:
                    matched = False
                    break
        if matched:
            return path
    raise PluginError(
        msg('errors.native.installed_native_mod_resources_version_differ_restore', path=path)
    )


def command_preflight(config_dir: Path, *, spec: ModSpec = NATIVE):
    if spec.name == "statusline-runtime":
        return
    for command in ("statusline-configure-native",):
        if (config_dir / "commands" / (command + ".md")).exists():
            raise PluginError(
                msg('errors.native.foreign_command_rename_it_before_native_migration', command=command)
            )
        if command.endswith("-native") and (config_dir / "skills" / command).exists():
            raise PluginError(
                msg('errors.native.foreign_skill_rename_it_before_native_migration', command=command)
            )


def _stage(
    config_dir: Path, executable: Path, previous: dict | None, *, spec: ModSpec = NATIVE
) -> tuple[dict, bool]:
    files, manifest = spec.bundled_files()
    market = {
        "name": spec.marketplace,
        "owner": {"name": "fbincon"},
        "metadata": {
            "description": "Matching native editor bundled with claude-code-statusline"
        },
        "plugins": [
            {
                "name": spec.name,
                "source": f"./plugins/{spec.name}",
                "version": manifest["mod_version"],
            }
        ],
    }
    artifacts = {f"plugins/{spec.name}/" + name: raw for name, raw in files.items()}
    artifacts[".claude-plugin/marketplace.json"] = storage._json_bytes(market)
    marker = {
        "owner": "claude-code-statusline",
        "schema_version": 1,
        "backend_version": manifest["backend_version"],
        "mod_version": manifest["mod_version"],
        "protocol_version": manifest["protocol_version"],
        "suspended": bool(previous and previous["suspended"]),
        "files": {
            name: hashlib.sha256(raw).hexdigest() for name, raw in artifacts.items()
        },
        "cache_inventories": [],
    }
    if previous:
        snapshots = [
            {"mod_version": previous["mod_version"], "files": previous["files"]},
            *previous["cache_inventories"],
        ]
        for snapshot in snapshots:
            if (
                snapshot["mod_version"] == marker["mod_version"]
                and snapshot["files"] == marker["files"]
            ):
                continue
            if snapshot not in marker["cache_inventories"]:
                marker["cache_inventories"].append(snapshot)
        marker["cache_inventories"] = marker["cache_inventories"][:3]
    root = config_dir / spec.name
    obsolete = []
    if previous:
        for name in previous["files"].keys() - artifacts.keys():
            artifacts[name] = None
            obsolete.append(_path(root, name))
    artifacts[OWNER_FILE] = storage._json_bytes(marker)
    changed = []
    for name, raw in artifacts.items():
        path = _path(root, name)
        before = storage._read_optional_bytes(path)
        if before != raw:
            changed.append((name, path, before, raw))
    if not changed:
        return marker, False
    with storage._installation_lock(config_dir):
        # Recheck ownership after waiting for a concurrent file transaction.
        if owner(config_dir, allow_missing=True, spec=spec) != previous:
            raise PluginError(msg('errors.native.native_ownership_changed_while_staging_rerun_install'))
        storage._backup_artifacts(
            config_dir,
            "native-stage",
            [(name, path, raw) for name, path, raw, _ in changed],
        )
        try:
            for _name, path, _raw, desired in changed:
                storage._write_optional_bytes(path, desired)
        except OSError as exc:
            failures = []
            for _name, path, raw, _desired in reversed(changed):
                try:
                    storage._write_optional_bytes(path, raw)
                except OSError as rollback:
                    failures.append(str(rollback))
            raise PluginError(
                msg('errors.native.cannot_stage_native_resources_rollback_errors', exc=exc, failures=failures)
            ) from exc
        _prune_empty_parents(root, obsolete)
    return marker, True


def _suspended(
    config_dir: Path, marker: dict, enabled: bool, *, spec: ModSpec = NATIVE
):
    if marker["suspended"] != enabled:
        with storage._installation_lock(config_dir):
            if owner(config_dir, spec=spec) != marker:
                raise PluginError(msg('errors.native.native_ownership_changed_before_suspension_update'))
            marker = dict(marker, suspended=enabled)
            storage._write_optional_bytes(
                config_dir / spec.name / OWNER_FILE, storage._json_bytes(marker)
            )
    return marker


def active_on_disk(
    config_dir: Path, requested: bool, version, *, spec: ModSpec = NATIVE
) -> bool:
    if not requested or version is None or version < spec.minimum_version:
        return False
    try:
        marker = owner(config_dir, spec=spec)
        settings = storage._read_settings(config_dir / "settings.json")[0]
        return bool(
            marker
            and not marker["suspended"]
            and settings.get("disableAllHooks") is not True
            and settings.get("enabledPlugins", {}).get(spec.plugin) is True
        )
    except (ConfigurationError, AttributeError):
        return False


def _remove_resources(config_dir: Path, marker: dict, *, spec: ModSpec = NATIVE):
    with storage._installation_lock(config_dir):
        if owner(config_dir, allow_missing=True, spec=spec) != marker:
            raise PluginError(msg('errors.native.native_ownership_changed_before_removal_run_doctor'))
        root = config_dir / spec.name
        paths = [_path(root, name) for name in marker["files"]]
        historical = [
            _path(root, name)
            for snapshot in marker["cache_inventories"]
            for name in snapshot["files"]
        ]
        for path in paths:
            path.unlink(missing_ok=True)
        (root / OWNER_FILE).unlink()
        _prune_empty_parents(root, paths + historical)


def _suspend_for_version(
    config_dir: Path, marker: dict, *, spec: ModSpec = NATIVE
) -> bool:
    """Suspend a verified owned plugin without requiring newer host APIs."""
    with storage._installation_lock(config_dir):
        if owner(config_dir, spec=spec) != marker:
            raise PluginError(msg('errors.native.native_ownership_changed_before_version_suspension'))
        settings, original = storage._read_settings(config_dir / "settings.json")
        if settings.get("enabledPlugins", {}).get(spec.plugin) is not True:
            # A user's own disablement must not become tool-restorable suspension.
            return False
        marker_path = config_dir / spec.name / OWNER_FILE
        marker_raw = storage._read_optional_bytes(marker_path)
        settings["enabledPlugins"][spec.plugin] = False
        changes = [
            (
                "settings.json",
                config_dir / "settings.json",
                original,
                storage._json_bytes(settings),
            ),
            (
                "native-owner.json",
                marker_path,
                marker_raw,
                storage._json_bytes(dict(marker, suspended=True)),
            ),
        ]
        storage._backup_artifacts(
            config_dir, "suspend", [change[:3] for change in changes]
        )
        try:
            for _name, path, _raw, desired in changes:
                storage._write_optional_bytes(path, desired)
        except OSError as exc:
            failures = []
            for _name, path, raw, _desired in reversed(changes):
                try:
                    storage._write_optional_bytes(path, raw)
                except OSError as rollback:
                    failures.append(str(rollback))
            raise PluginError(
                msg('errors.native.cannot_suspend_native_editor_rollback_errors', exc=exc, failures=failures)
            ) from exc
    return True


def integrate(
    config_dir: Path,
    executable: Path,
    requested: bool,
    version,
    *,
    uninstall=False,
    spec: ModSpec = NATIVE,
) -> NativeResult:
    config_dir = config_dir.resolve()
    changed = False
    try:
        marker = owner(config_dir, allow_missing=True, spec=spec)
        if not requested and marker is None:
            return NativeResult(
                "disabled",
                messages=(
                    msg('native.notice.native_editor_is_disabled_enable_with_install'),
                ),
            )
        restriction = (
            "disableAllHooks is enabled"
            if storage._read_settings(config_dir / "settings.json")[0].get(
                "disableAllHooks"
            )
            is True
            else ""
        )
        compatible = version is not None and version >= spec.minimum_version
        if requested and marker is None and (not compatible or restriction):
            return NativeResult(
                "suspended",
                messages=(
                    msg('native.notice.native_editor_suspended_preference_retained', value0=restriction or 'Claude Code 2.1.287+ is required'),
                ),
            )
        if requested and not compatible:
            changed = _suspend_for_version(config_dir, marker, spec=spec)
            return NativeResult(
                "suspended",
                changed=changed,
                messages=(
                    msg('native.notice.native_editor_suspended_claude_code_2_1'),
                ),
            )
        host = Host(config_dir)
        markets, plugins = host.listing()
        registration, row = _registered(config_dir, markets, plugins, marker, spec=spec)
        if row:
            _cache_owned(config_dir, row, marker, spec=spec)
        if not requested or uninstall:
            if row:
                # Removal also runs after a host downgrade. Older hosts support
                # these operations without the newer machine-readable flag;
                # listing below independently verifies each result.
                host.run("uninstall", spec.plugin, "--scope", "user")
                changed = True
                if any(value.get("id") == spec.plugin for value in host.listing()[1]):
                    raise PluginError(
                        msg('errors.native.plugin_removal_could_not_be_confirmed_native')
                    )
            if registration:
                host.run("marketplace", "remove", spec.marketplace, "--scope", "user")
                changed = True
                if any(
                    value.get("name") == spec.marketplace for value in host.listing()[0]
                ):
                    raise PluginError(
                        msg('errors.native.marketplace_removal_could_not_be_confirmed_native')
                    )
            if marker:
                _remove_resources(config_dir, marker, spec=spec)
                changed = True
            return NativeResult(
                "disabled",
                changed=changed,
                messages=(
                    msg('native.notice.owned_native_plugin_and_marketplace_removed_preference'),
                ),
            )
        if not compatible or restriction:
            if row and row.get("enabled") is True:
                host.run("disable", spec.plugin, "--scope", "user", "--json")
                changed = True
                if any(
                    value.get("id") == spec.plugin and value.get("enabled")
                    for value in host.listing()[1]
                ):
                    raise PluginError(msg('errors.native.plugin_suspension_could_not_be_confirmed'))
                _suspended(config_dir, marker, True, spec=spec)
            return NativeResult(
                "suspended",
                changed=changed,
                messages=(
                    msg('native.notice.native_editor_suspended_preference_retained_rerun_install', value0=restriction or 'unsupported host'),
                ),
            )
        user_disabled = bool(
            row and row.get("enabled") is not True and not marker["suspended"]
        )
        command_preflight(config_dir, spec=spec)
        current, staged = _stage(config_dir, executable, marker, spec=spec)
        changed |= staged
        root = config_dir / spec.name
        host.run("validate", "--strict", str(root))
        host.run("validate", "--strict", str(root / f"plugins/{spec.name}"))
        if not registration:
            host.run("marketplace", "add", str(root))
            changed = True
        elif staged:
            host.run("marketplace", "update", spec.marketplace)
        values = {
            "backendExecutable": str(executable.resolve()),
            "configDir": str(config_dir),
            "backendVersion": current["backend_version"],
            **_runtime_modes(config_dir, spec),
        }
        if row and staged and row.get("version") == current["mod_version"]:
            # Official update is a no-op at the same version. Reinstall only
            # after verifying every owned cached runtime resource above.
            host.run("uninstall", spec.plugin, "--scope", "user")
            row = None
        if row:
            if staged:
                host.run("update", spec.plugin, "--scope", "user", "--json")
            host.run("configure", spec.plugin, "--values-stdin", values=values)
            if marker["suspended"]:
                host.run("enable", spec.plugin, "--scope", "user", "--json")
                changed = True
        else:
            argv = ["install", spec.plugin, "--scope", "user", "--json"]
            for key, value in values.items():
                argv.extend(
                    [
                        "--config",
                        key
                        + "="
                        + (str(value).lower() if isinstance(value, bool) else value),
                    ]
                )
            host.run(*argv)
            changed = True
        markets, plugins = host.listing()
        _registration, saved = _registered(
            config_dir, markets, plugins, current, spec=spec
        )
        if user_disabled and saved and saved.get("enabled") is True:
            # Updates normally preserve enablement; a same-version reinstall
            # enables the plugin, so restore the user's choice and verify it.
            host.run("disable", spec.plugin, "--scope", "user", "--json")
            changed = True
            markets, plugins = host.listing()
            _registration, saved = _registered(
                config_dir, markets, plugins, current, spec=spec
            )
        if not saved or saved.get("enabled") is not (not user_disabled):
            raise PluginError(
                msg('errors.native.native_plugin_enablement_preference_could_not_be')
            )
        _cache_owned(config_dir, saved, current, require_current=True, spec=spec)
        options = host.run("configure", spec.plugin, "--json", json_result=True)
        bound = {
            key: str(value).lower() if isinstance(value, bool) else value
            for key, value in values.items()
        }
        if not _binding_matches(options, bound):
            raise PluginError(
                msg('errors.native.native_backend_binding_could_not_be_confirmed')
            )
        _suspended(config_dir, current, False, spec=spec)
        if user_disabled:
            return NativeResult(
                "plugin-disabled",
                changed=changed,
                messages=(
                    msg('native.notice.is_explicitly_disabled_owned_resources_and_backend', value0=spec.plugin),
                ),
            )
        return NativeResult(
            "installed",
            True,
            changed,
            (
                msg('native.notice.native_plugin_installed_enabled_on_disk_restart'),
            ),
        )
    except (ConfigurationError, OSError, ValueError, TypeError) as exc:
        return NativeResult(
            "blocked",
            changed=changed,
            messages=(
                msg('native.notice.compatibility_configuration_is_retained_run_doctor_before', value0=as_message(exc)),
            ),
        )


def diagnostics(
    config_dir: Path, executable: Path | None, version, *, spec: ModSpec = NATIVE
) -> list[Diagnostic]:
    result = []
    try:
        enabled = spec.requested(config_dir)
        result.append(
            Diagnostic(
                "OK",
                msg('doctor.native.native_editor_preference', value0='enabled' if enabled else 'disabled'),
            )
        )
        marker = owner(config_dir, spec=spec)
        result.append(
            Diagnostic(
                "OK" if version and version >= spec.minimum_version else "WARN",
                msg('doctor.native.native_mod_host_requires_2_1_287', value0='.'.join(map(str, version)) if version else 'unknown'),
            )
        )
        if enabled and (version is None or version < spec.minimum_version):
            result.append(
                Diagnostic(
                    "WARN",
                    msg('doctor.native.native_editor_suspended_preference_retained_rerun_install'),
                )
            )
            if marker is None:
                return result
        if marker is None:
            result.append(
                Diagnostic(
                    "WARN" if enabled else "OK",
                    msg('doctor.native.native_plugin_on_disk_absent', value0='; rerun install --native-editor' if enabled else ''),
                )
            )
            return result
        result.append(
            Diagnostic(
                "OK",
                msg('doctor.native.native_resources_owned_and_complete_mod_backend', value0=marker['mod_version'], value1=marker['backend_version'], value2=marker['protocol_version']),
            )
        )
        if version is None or version < spec.minimum_version:
            settings = storage._read_settings(config_dir / "settings.json")[0]
            if settings.get("enabledPlugins", {}).get(spec.plugin) is True:
                result.append(
                    Diagnostic(
                        "ERROR",
                        msg('doctor.native.native_plugin_is_still_enabled_on_an'),
                    )
                )
            return result
        _files, manifest = spec.bundled_files()
        if any(
            marker[key] != manifest[key]
            for key in ("backend_version", "mod_version", "protocol_version")
        ):
            result.append(
                Diagnostic(
                    "ERROR",
                    msg('doctor.native.native_mod_backend_version_or_protocol_differs'),
                )
            )
        host = Host(config_dir.resolve())
        markets, plugins = host.listing()
        registration, row = _registered(
            config_dir.resolve(), markets, plugins, marker, spec=spec
        )
        result.append(
            Diagnostic(
                "OK" if registration else "ERROR",
                msg('doctor.native.native_marketplace_on_disk', value0='registered' if registration else 'missing'),
            )
        )
        if row:
            _cache_owned(
                config_dir.resolve(), row, marker, require_current=True, spec=spec
            )
            result.append(
                Diagnostic(
                    "OK" if row.get("enabled") else "WARN",
                    msg('doctor.native.native_plugin_on_disk_installed_enabled_tool', value0=row.get('enabled'), value1=marker['suspended']),
                )
            )
            options = host.run("configure", spec.plugin, "--json", json_result=True)
            expected = {
                "backendExecutable": str(executable.resolve()) if executable else None,
                "configDir": str(config_dir.resolve()),
                "backendVersion": manifest["backend_version"],
                **_runtime_modes(config_dir, spec),
            }
            result.append(
                Diagnostic(
                    "OK" if _binding_matches(options, expected) else "ERROR",
                    msg('doctor.native.native_backend_binding', value0='matches' if _binding_matches(options, expected) else 'differs; rerun install'),
                )
            )
        else:
            result.append(
                Diagnostic("ERROR", msg('doctor.native.native_plugin_on_disk_missing_rerun_install'))
            )
        command_preflight(config_dir, spec=spec)
        settings = storage._read_settings(config_dir / "settings.json")[0]
        if settings.get("disableAllHooks") is True:
            result.append(
                Diagnostic(
                    "WARN",
                    msg('doctor.native.native_loading_restricted_by_disableallhooks_rerun_install'),
                )
            )
        result.append(
            Diagnostic(
                "WARN",
                msg('doctor.native.native_session_loading_unverified_restart_in_a'),
            )
        )
    except (ConfigurationError, OSError, ValueError, TypeError) as exc:
        result.append(Diagnostic("ERROR", msg('doctor.native.native_editor', value0=str(exc))))
    return result


def _runtime_modes(config_dir, spec):
    if spec.name != "statusline-runtime":
        return {}
    from claude_statusline.config import runtime

    preferences = runtime.load(config_dir)
    return {
        "nativeTiming": preferences.native_timing,
        "liveMetrics": preferences.live_metrics,
    }
