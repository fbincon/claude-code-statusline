"""Runtime Mod inventory shared by packaging and local source development."""

from __future__ import annotations

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
            raise ConfigurationError("Native Mod source contains symlinks")
        paths.extend(path for path in entries if path.suffix == ".ts")
    if any(not path.is_file() or path.is_symlink() for path in paths):
        raise ConfigurationError("Native Mod source is incomplete or contains symlinks")
    return {path.relative_to(root).as_posix(): path.read_bytes() for path in paths}


def inventory(files: dict[str, bytes], version: str) -> dict:
    plugin = json.loads(files[".claude-plugin/plugin.json"])
    if plugin.get("name") != "statusline-native":
        raise ConfigurationError("Unexpected native Mod identity")
    match = re.fullmatch(r"(\d+\.\d+\.\d+)(?:(a|b|rc)(\d+))?", version)
    if match is None:
        raise ConfigurationError("Unsupported backend release version")
    base, stage, number = match.groups()
    expected = base + (
        "-" + {"a": "alpha", "b": "beta", "rc": "rc"}[stage] + "." + number
        if stage
        else ""
    )
    if plugin.get("version") != expected:
        raise ConfigurationError("Native Mod and backend release versions differ")
    return {
        "schema_version": 1,
        "backend_version": version,
        "mod_version": plugin["version"],
        "protocol_version": 2,
        "files": {
            name: hashlib.sha256(raw).hexdigest() for name, raw in sorted(files.items())
        },
    }


def bundled_files() -> tuple[dict[str, bytes], dict]:
    root = resources.files("claude_statusline").joinpath("resources/statusline-native")
    try:
        manifest = json.loads(root.joinpath("resource-manifest.json").read_bytes())
        files = {name: root.joinpath(name).read_bytes() for name in manifest["files"]}
    except FileNotFoundError as exc:
        # Editable/source checkouts use the same maintained files, never a copy.
        checkout = Path(__file__).resolve().parents[3]
        if not (checkout / "pyproject.toml").is_file():
            raise ConfigurationError(
                "Bundled native Mod is missing; reinstall the matching wheel"
            ) from exc
        files = source_files(checkout / "mods/statusline-native")
        manifest = inventory(
            files,
            runpy.run_path(checkout / "src/claude_statusline/_version.py")[
                "__version__"
            ],
        )
    except (OSError, ValueError, KeyError, TypeError) as exc:
        raise ConfigurationError(f"Cannot read bundled native Mod: {exc}") from exc
    if manifest != inventory(files, __version__):
        raise ConfigurationError(
            "Bundled native Mod resources/version/protocol do not match the backend"
        )
    files["resource-manifest.json"] = (json.dumps(manifest, indent=2) + "\n").encode()
    return files, manifest
