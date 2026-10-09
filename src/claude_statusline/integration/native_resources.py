"""Runtime Mod inventory shared by packaging and local source development."""

from __future__ import annotations

from claude_statusline.i18n import message as msg

import hashlib
import json
import runpy
import re
from importlib import resources
from pathlib import Path

from claude_statusline._version import __version__
from claude_statusline.integration.models import ConfigurationError


def source_files(root: Path) -> dict[str, bytes]:
    paths = [root / ".claude-plugin/plugin.json", root / "hooks/hooks.json"]
    for directory in ("hooks", "lib", "ui"):
        subtree = root / directory
        entries = sorted(subtree.rglob("*"))
        if subtree.is_symlink() or any(path.is_symlink() for path in entries):
            raise ConfigurationError(msg('errors.native_resources.native_mod_source_contains_symlinks'))
        paths.extend(path for path in entries if path.suffix == ".ts")
    if any(not path.is_file() or path.is_symlink() for path in paths):
        raise ConfigurationError(msg('errors.native_resources.native_mod_source_is_incomplete_or_contains'))
    return {path.relative_to(root).as_posix(): path.read_bytes() for path in paths}


def inventory(files: dict[str, bytes], version: str, name="statusline-native") -> dict:
    plugin = json.loads(files[".claude-plugin/plugin.json"])
    if plugin.get("name") != name:
        raise ConfigurationError(msg('errors.native_resources.unexpected_native_mod_identity'))
    match = re.fullmatch(r"(\d+\.\d+\.\d+)(?:(a|b|rc)(\d+))?", version)
    if match is None:
        raise ConfigurationError(msg('errors.native_resources.unsupported_backend_release_version'))
    base, stage, number = match.groups()
    expected = base + (
        "-" + {"a": "alpha", "b": "beta", "rc": "rc"}[stage] + "." + number
        if stage
        else ""
    )
    if plugin.get("version") != expected:
        raise ConfigurationError(msg('errors.native_resources.native_mod_and_backend_release_versions_differ'))
    return {
        "schema_version": 1,
        "backend_version": version,
        "mod_version": plugin["version"],
        "protocol_version": 2 if name == "statusline-runtime" else 6,
        "files": {
            name: hashlib.sha256(raw).hexdigest() for name, raw in sorted(files.items())
        },
    }


def bundled_files(name="statusline-native") -> tuple[dict[str, bytes], dict]:
    root = resources.files("claude_statusline").joinpath("resources/" + name)
    try:
        manifest = json.loads(root.joinpath("resource-manifest.json").read_bytes())
        files = {name: root.joinpath(name).read_bytes() for name in manifest["files"]}
    except FileNotFoundError as exc:
        # Editable/source checkouts use the same maintained files, never a copy.
        checkout = Path(__file__).resolve().parents[3]
        if not (checkout / "pyproject.toml").is_file():
            raise ConfigurationError(
                msg('errors.native_resources.bundled_native_mod_is_missing_reinstall_the')
            ) from exc
        files = source_files(checkout / "mods" / name)
        manifest = inventory(
            files,
            runpy.run_path(checkout / "src/claude_statusline/_version.py")[
                "__version__"
            ],
            name,
        )
    except (OSError, ValueError, KeyError, TypeError) as exc:
        raise ConfigurationError(msg('errors.native_resources.cannot_read_bundled_native_mod', exc=exc)) from exc
    if manifest != inventory(files, __version__, name):
        raise ConfigurationError(
            msg('errors.native_resources.bundled_native_mod_resources_version_protocol_do')
        )
    files["resource-manifest.json"] = (json.dumps(manifest, indent=2) + "\n").encode()
    return files, manifest
