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

from claude_statusline.config import native as preference
from claude_statusline.config import storage
from claude_statusline.integration import (
    capabilities,
    native_resources,
)
from claude_statusline.integration.models import ConfigurationError, Diagnostic
from claude_statusline.platforms import environment

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


def owner(config_dir: Path, *, allow_missing: bool = False) -> dict | None:
    config_dir = config_dir.resolve()
    root = config_dir / DIRECTORY
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
            or value["protocol_version"] != 1
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
                or "plugins/statusline-native/.claude-plugin/plugin.json"
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
                    or name.startswith("plugins/statusline-native/")
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
                or name.startswith("plugins/statusline-native/")
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
    config_dir: Path, marketplaces: list[dict], plugins: list[dict], marker: dict | None
):
    matches = [row for row in marketplaces if row.get("name") == MARKETPLACE]
    if matches and (
        len(matches) != 1
        or matches[0].get("source") != "directory"
        or Path(matches[0].get("path", "")).resolve() != config_dir / DIRECTORY
        or marker is None
    ):
        raise PluginError(
            f"Foreign marketplace {MARKETPLACE}; rename/remove its registration yourself before retrying"
        )
    rows = [row for row in plugins if row.get("id") == PLUGIN]
    if rows and (len(rows) != 1 or rows[0].get("scope") != "user" or marker is None):
        raise PluginError(
            f"Foreign or ambiguous plugin {PLUGIN}; resolve its scope/ownership before retrying"
        )
    return matches, rows[0] if rows else None


def _cache_owned(
    config_dir: Path, row: dict, marker: dict, *, require_current=False
) -> Path:
    path = Path(row.get("installPath", "")).resolve()
    expected = config_dir / "plugins/cache" / MARKETPLACE / "statusline-native"
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
            prefix = "plugins/statusline-native/"
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


def command_preflight(config_dir: Path):
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
    config_dir: Path, executable: Path, previous: dict | None
) -> tuple[dict, bool]:
    files, manifest = native_resources.bundled_files()
    market = {
        "name": MARKETPLACE,
        "owner": {"name": "fbincon"},
        "metadata": {
            "description": "Matching native editor bundled with claude-code-statusline"
        },
        "plugins": [
            {
                "name": "statusline-native",
                "source": "./plugins/statusline-native",
                "version": manifest["mod_version"],
            }
        ],
    }
    artifacts = {
        "plugins/statusline-native/" + name: raw for name, raw in files.items()
    }
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
    root = config_dir / DIRECTORY
    if previous:
        for name in previous["files"].keys() - artifacts.keys():
            artifacts[name] = None
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
        if owner(config_dir, allow_missing=True) != previous:
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
    return marker, True


def _suspended(config_dir: Path, marker: dict, enabled: bool):
    if marker["suspended"] != enabled:
        with storage._installation_lock(config_dir):
            if owner(config_dir) != marker:
                raise PluginError("Native ownership changed before suspension update")
            marker = dict(marker, suspended=enabled)
            storage._write_optional_bytes(
                config_dir / DIRECTORY / OWNER_FILE, storage._json_bytes(marker)
            )
    return marker


def active_on_disk(config_dir: Path, requested: bool, version) -> bool:
    if not requested or version is None or version < MIN_VERSION:
        return False
    try:
        marker = owner(config_dir)
        settings = storage._read_settings(config_dir / "settings.json")[0]
        return bool(
            marker
            and not marker["suspended"]
            and settings.get("disableAllHooks") is not True
            and settings.get("enabledPlugins", {}).get(PLUGIN) is True
        )
    except (ConfigurationError, AttributeError):
        return False


def _remove_resources(config_dir: Path, marker: dict):
    with storage._installation_lock(config_dir):
        if owner(config_dir, allow_missing=True) != marker:
            raise PluginError("Native ownership changed before removal; run doctor")
        root = config_dir / DIRECTORY
        paths = [_path(root, name) for name in marker["files"]]
        for path in paths:
            path.unlink(missing_ok=True)
        (root / OWNER_FILE).unlink()
        parents = {
            parent
            for path in paths
            for parent in path.parents
            if parent.is_relative_to(root)
        }
        for directory in sorted(
            parents, key=lambda path: len(path.parts), reverse=True
        ):
            try:
                directory.rmdir()
            except OSError:
                pass


def integrate(
    config_dir: Path, executable: Path, requested: bool, version, *, uninstall=False
) -> NativeResult:
    config_dir = config_dir.resolve()
    changed = False
    try:
        marker = owner(config_dir, allow_missing=True)
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
        compatible = version is not None and version >= MIN_VERSION
        if requested and marker is None and (not compatible or restriction):
            return NativeResult(
                "suspended",
                messages=(
                    f"Native editor suspended: {restriction or 'Claude Code 2.1.287+ is required'}; preference retained.",
                ),
            )
        host = Host(config_dir)
        markets, plugins = host.listing()
        registration, row = _registered(config_dir, markets, plugins, marker)
        if row:
            _cache_owned(config_dir, row, marker)
        if not requested or uninstall:
            if row:
                host.run("uninstall", PLUGIN, "--scope", "user", "--json")
                changed = True
                if any(value.get("id") == PLUGIN for value in host.listing()[1]):
                    raise PluginError(
                        "Plugin removal could not be confirmed; native resources retained"
                    )
            if registration:
                host.run(
                    "marketplace", "remove", MARKETPLACE, "--scope", "user", "--json"
                )
                changed = True
                if any(value.get("name") == MARKETPLACE for value in host.listing()[0]):
                    raise PluginError(
                        "Marketplace removal could not be confirmed; native resources retained"
                    )
            if marker:
                _remove_resources(config_dir, marker)
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
                host.run("disable", PLUGIN, "--scope", "user", "--json")
                changed = True
                if any(
                    value.get("id") == PLUGIN and value.get("enabled")
                    for value in host.listing()[1]
                ):
                    raise PluginError("Plugin suspension could not be confirmed")
                _suspended(config_dir, marker, True)
            return NativeResult(
                "suspended",
                changed=changed,
                messages=(
                    f"Native editor suspended: {restriction or 'unsupported host'}; preference retained. Rerun install after upgrading.",
                ),
            )
        if row and row.get("enabled") is not True and not marker["suspended"]:
            return NativeResult(
                "plugin-disabled",
                messages=(
                    f"{PLUGIN} is explicitly disabled; enable it through claude plugin enable before retrying. Compatibility entry retained.",
                ),
            )
        command_preflight(config_dir)
        current, staged = _stage(config_dir, executable, marker)
        changed |= staged
        root = config_dir / DIRECTORY
        host.run("validate", "--strict", str(root))
        host.run("validate", "--strict", str(root / "plugins/statusline-native"))
        if not registration:
            host.run("marketplace", "add", str(root))
            changed = True
        elif staged:
            host.run("marketplace", "update", MARKETPLACE)
        values = {
            "backendExecutable": str(executable.resolve()),
            "configDir": str(config_dir),
            "backendVersion": current["backend_version"],
        }
        if row and staged and row.get("version") == current["mod_version"]:
            # Official update is a no-op at the same version. Reinstall only
            # after verifying every owned cached runtime resource above.
            host.run("uninstall", PLUGIN, "--scope", "user", "--json")
            row = None
        if row:
            if staged:
                host.run("update", PLUGIN, "--scope", "user", "--json")
            host.run("configure", PLUGIN, "--values-stdin", values=values)
            if marker["suspended"]:
                host.run("enable", PLUGIN, "--scope", "user", "--json")
                changed = True
        else:
            argv = ["install", PLUGIN, "--scope", "user", "--json"]
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
        _registration, saved = _registered(config_dir, markets, plugins, current)
        if not saved or saved.get("enabled") is not True:
            raise PluginError(
                "Native plugin enablement could not be confirmed; compatibility entry retained"
            )
        _cache_owned(config_dir, saved, current, require_current=True)
        options = host.run("configure", PLUGIN, "--json", json_result=True)
        bound = {
            key: str(value).lower() if isinstance(value, bool) else value
            for key, value in values.items()
        }
        if not _binding_matches(options, bound):
            raise PluginError(
                "Native backend binding could not be confirmed; compatibility entry retained"
            )
        _suspended(config_dir, current, False)
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


def diagnostics(config_dir: Path, executable: Path | None, version) -> list[Diagnostic]:
    result = []
    try:
        enabled = preference.requested(config_dir, None)
        result.append(
            Diagnostic(
                "OK",
                f"native editor preference: {'enabled' if enabled else 'disabled'}",
            )
        )
        marker = owner(config_dir)
        result.append(
            Diagnostic(
                "OK" if version and version >= MIN_VERSION else "WARN",
                "native Mod host: "
                + (".".join(map(str, version)) if version else "unknown")
                + "; requires 2.1.287+",
            )
        )
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
        _files, manifest = native_resources.bundled_files()
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
        registration, row = _registered(config_dir.resolve(), markets, plugins, marker)
        result.append(
            Diagnostic(
                "OK" if registration else "ERROR",
                "native marketplace on disk: "
                + ("registered" if registration else "missing"),
            )
        )
        if row:
            _cache_owned(config_dir.resolve(), row, marker, require_current=True)
            result.append(
                Diagnostic(
                    "OK" if row.get("enabled") else "WARN",
                    f"native plugin on disk: installed, enabled={row.get('enabled')}, tool-suspended={marker['suspended']}",
                )
            )
            options = host.run("configure", PLUGIN, "--json", json_result=True)
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
        command_preflight(config_dir)
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
