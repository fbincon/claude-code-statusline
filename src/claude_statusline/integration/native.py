"""Owned local marketplace integration through official Claude plugin commands.

Plugin operations are separate from the compatibility file transaction. Never
infer session loading from a successful installation or edit plugin registries.
"""

from __future__ import annotations

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
        inputs.get(key) == value for key, value in expected.items()
    )


class PluginError(ConfigurationError):
    pass


def _path(root: Path, name: str) -> Path:
    relative = Path(name)
    if relative.is_absolute() or ".." in relative.parts or "\\" in name:
        raise PluginError("Unsafe owned native resource path")
    path = root / relative
    if any(
        parent.is_symlink() for parent in (path, *path.parents) if parent != root.parent
    ):
        # Config directories may themselves resolve through a user-selected link;
        # callers resolve config_dir first. No link inside an owned root is valid.
        raise PluginError(f"Native resource contains a symlink: {path}")
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
        raise PluginError(f"Refusing unrelated native directory: {root}")
    raw = storage._read_optional_bytes(root / OWNER_FILE)
    if raw is None:
        if root.exists():
            raise PluginError(
                f"Unowned native directory: {root}; move it aside before retrying"
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
            or value["protocol_version"] not in (1, 2, 3)
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
                    f"Native resource changed or missing: {path}; restore the owned file or move the directory aside"
                )
        return value
    except (ValueError, TypeError, KeyError, AttributeError) as exc:
        raise PluginError(
            f"Untrusted native ownership marker: {root / OWNER_FILE}"
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
                f"Official plugin operation {args[0]} could not be confirmed: {type(exc).__name__}; run doctor before retrying"
            ) from exc
        if result.returncode:
            detail = (result.stderr or result.stdout).strip()
            detail = re.sub(r"[\x00-\x1f\x7f]", " ", detail)[:500]
            raise PluginError(f"Official plugin operation {args[0]} refused: {detail}")
        if json_result:
            try:
                return json.loads(result.stdout)
            except ValueError as exc:
                raise PluginError(
                    f"Official plugin operation {args[0]} returned invalid JSON"
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
            raise PluginError("Unexpected official plugin inventory")
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
            f"Foreign marketplace {spec.marketplace}; rename/remove its registration yourself before retrying"
        )
    rows = [row for row in plugins if row.get("id") == spec.plugin]
    if rows and (len(rows) != 1 or rows[0].get("scope") != "user" or marker is None):
        raise PluginError(
            f"Foreign or ambiguous plugin {spec.plugin}; resolve its scope/ownership before retrying"
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
            "Installed native Mod location/version differs from the owned inventory; run doctor"
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
        f"Installed native Mod resources/version differ: {path}; restore the owned cache before updating or removing"
    )


def command_preflight(config_dir: Path, *, spec: ModSpec = NATIVE):
    if spec.name == "statusline-runtime":
        return
    for command in ("statusline-configure-native",):
        if (config_dir / "commands" / (command + ".md")).exists():
            raise PluginError(
                f"Foreign /{command} command; rename it before native migration"
            )
        if command.endswith("-native") and (config_dir / "skills" / command).exists():
            raise PluginError(
                f"Foreign /{command} skill; rename it before native migration"
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
            raise PluginError("Native ownership changed while staging; rerun install")
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
                f"Cannot stage native resources: {exc}; rollback errors: {failures}"
            ) from exc
        _prune_empty_parents(root, obsolete)
    return marker, True


def _suspended(
    config_dir: Path, marker: dict, enabled: bool, *, spec: ModSpec = NATIVE
):
    if marker["suspended"] != enabled:
        with storage._installation_lock(config_dir):
            if owner(config_dir, spec=spec) != marker:
                raise PluginError("Native ownership changed before suspension update")
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
            raise PluginError("Native ownership changed before removal; run doctor")
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
            raise PluginError("Native ownership changed before version suspension")
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
                f"Cannot suspend native editor: {exc}; rollback errors: {failures}"
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
                    "Native editor is disabled; enable with install --native-editor.",
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
                    f"Native editor suspended: {restriction or 'Claude Code 2.1.287+ is required'}; preference retained.",
                ),
            )
        if requested and not compatible:
            changed = _suspend_for_version(config_dir, marker, spec=spec)
            return NativeResult(
                "suspended",
                changed=changed,
                messages=(
                    "Native editor suspended: Claude Code 2.1.287+ is required; preference retained. Rerun install after upgrading.",
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
                        "Plugin removal could not be confirmed; native resources retained"
                    )
            if registration:
                host.run("marketplace", "remove", spec.marketplace, "--scope", "user")
                changed = True
                if any(
                    value.get("name") == spec.marketplace for value in host.listing()[0]
                ):
                    raise PluginError(
                        "Marketplace removal could not be confirmed; native resources retained"
                    )
            if marker:
                _remove_resources(config_dir, marker, spec=spec)
                changed = True
            return NativeResult(
                "disabled",
                changed=changed,
                messages=(
                    "Owned native plugin and marketplace removed; preference retained.",
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
                    raise PluginError("Plugin suspension could not be confirmed")
                _suspended(config_dir, marker, True, spec=spec)
            return NativeResult(
                "suspended",
                changed=changed,
                messages=(
                    f"Native editor suspended: {restriction or 'unsupported host'}; preference retained. Rerun install after upgrading.",
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
                "Native plugin enablement preference could not be confirmed; compatibility entry retained"
            )
        _cache_owned(config_dir, saved, current, require_current=True, spec=spec)
        options = host.run("configure", spec.plugin, "--json", json_result=True)
        bound = {
            key: str(value).lower() if isinstance(value, bool) else value
            for key, value in values.items()
        }
        if not _binding_matches(options, bound):
            raise PluginError(
                "Native backend binding could not be confirmed; compatibility entry retained"
            )
        _suspended(config_dir, current, False, spec=spec)
        if user_disabled:
            return NativeResult(
                "plugin-disabled",
                changed=changed,
                messages=(
                    f"{spec.plugin} is explicitly disabled; owned resources and backend binding are current. "
                    "Enable it through claude plugin enable when wanted. Compatibility entry retained.",
                ),
            )
        return NativeResult(
            "installed",
            True,
            changed,
            (
                "Native plugin installed/enabled on disk. Restart Claude Code; current session loading is unverified.",
            ),
        )
    except (ConfigurationError, OSError, ValueError, TypeError) as exc:
        return NativeResult(
            "blocked",
            changed=changed,
            messages=(
                str(exc)
                + " Compatibility configuration is retained; run doctor before retrying.",
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
                f"native editor preference: {'enabled' if enabled else 'disabled'}",
            )
        )
        marker = owner(config_dir, spec=spec)
        result.append(
            Diagnostic(
                "OK" if version and version >= spec.minimum_version else "WARN",
                "native Mod host: "
                + (".".join(map(str, version)) if version else "unknown")
                + "; requires 2.1.287+",
            )
        )
        if enabled and (version is None or version < spec.minimum_version):
            result.append(
                Diagnostic(
                    "WARN",
                    "native editor: suspended; preference retained; rerun install after upgrading. "
                    "Use claude-statusline configure, /statusline-config, or claude-statusline config",
                )
            )
            if marker is None:
                return result
        if marker is None:
            result.append(
                Diagnostic(
                    "WARN" if enabled else "OK",
                    "native plugin on disk: absent"
                    + ("; rerun install --native-editor" if enabled else ""),
                )
            )
            return result
        result.append(
            Diagnostic(
                "OK",
                f"native resources: owned and complete; Mod {marker['mod_version']}, backend {marker['backend_version']}, protocol {marker['protocol_version']}",
            )
        )
        if version is None or version < spec.minimum_version:
            settings = storage._read_settings(config_dir / "settings.json")[0]
            if settings.get("enabledPlugins", {}).get(spec.plugin) is True:
                result.append(
                    Diagnostic(
                        "ERROR",
                        "native plugin is still enabled on an unsupported host; rerun install to suspend",
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
                    "native Mod/backend version or protocol differs; reinstall the matching package",
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
                "native marketplace on disk: "
                + ("registered" if registration else "missing"),
            )
        )
        if row:
            _cache_owned(
                config_dir.resolve(), row, marker, require_current=True, spec=spec
            )
            result.append(
                Diagnostic(
                    "OK" if row.get("enabled") else "WARN",
                    f"native plugin on disk: installed, enabled={row.get('enabled')}, tool-suspended={marker['suspended']}",
                )
            )
            options = host.run("configure", spec.plugin, "--json", json_result=True)
            expected = {
                "backendExecutable": str(executable.resolve()) if executable else None,
                "configDir": str(config_dir.resolve()),
                "backendVersion": manifest["backend_version"],
            }
            result.append(
                Diagnostic(
                    "OK" if _binding_matches(options, expected) else "ERROR",
                    "native backend binding: "
                    + (
                        "matches"
                        if _binding_matches(options, expected)
                        else "differs; rerun install"
                    ),
                )
            )
        else:
            result.append(
                Diagnostic("ERROR", "native plugin on disk: missing; rerun install")
            )
        command_preflight(config_dir, spec=spec)
        settings = storage._read_settings(config_dir / "settings.json")[0]
        if settings.get("disableAllHooks") is True:
            result.append(
                Diagnostic(
                    "WARN",
                    "native loading restricted by disableAllHooks; rerun install to suspend",
                )
            )
        result.append(
            Diagnostic(
                "WARN",
                "native session loading: unverified; restart in a trusted terminal, check /plugin and open /statusline-configure-native. Safe/bare mode and managed policy may block loading.",
            )
        )
    except (ConfigurationError, OSError, ValueError, TypeError) as exc:
        result.append(Diagnostic("ERROR", "native editor: " + str(exc)))
    return result
