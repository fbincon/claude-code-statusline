"""Real official plugin lifecycle and JSON bridge checks in isolated config.

Requires an installed matching wheel/source backend and fixed Claude executable.
No credentials or model requests. UI focus/visual acceptance is a separate gate.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import platform
import shutil
import subprocess
import tempfile
from pathlib import Path

from claude_statusline._version import __version__
from claude_statusline.config import catalog
from claude_statusline.config.editor_defaults import enabled_by_default
from claude_statusline.integration import capabilities, native


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--report", type=Path, required=True)
    args = parser.parse_args()
    backend = shutil.which("claude-statusline")
    if backend is None:
        parser.error("Install the matching package before running this check")
    backend = str(Path(backend).resolve())
    report = {
        "os": platform.platform(),
        "architecture": platform.machine(),
        "python": platform.python_version(),
        "backend": __version__,
        "host": ".".join(map(str, capabilities.detect_claude_version() or ())),
        "manual_visual_acceptance": False,
    }
    with tempfile.TemporaryDirectory(prefix="statusline native install ") as directory:
        config = Path(directory).resolve() / "config 中文 $` & with spaces"
        env = dict(os.environ, CLAUDE_CONFIG_DIR=str(config), PYTHONUTF8="1")
        env.pop("CLAUDECODE", None)

        def run(*argv, payload=None, expected=0):
            result = subprocess.run(
                [backend, *argv],
                input=json.dumps(payload, ensure_ascii=False)
                if payload is not None
                else None,
                env=env,
                cwd=directory,
                capture_output=True,
                text=True,
                encoding="utf-8",
                timeout=120,
                check=False,
            )
            assert result.returncode == expected, (
                f"{argv}: {result.returncode}\n{result.stdout}\n{result.stderr}"
            )
            return result.stdout

        assert run("--version").strip() == f"claude-statusline {__version__}", (
            "PATH must select the matching installed backend"
        )
        run("install")
        stable_defaults = enabled_by_default()
        assert bool(native.owner(config)) == stable_defaults
        assert (
            config / "skills/statusline-configure/SKILL.md"
        ).exists() == stable_defaults
        assert not (config / "claude-statusline-features.json").exists()
        assert not (config / "claude-statusline-native.json").exists()
        assert "install: already correct:" in run("install")
        report["release_defaults_verified"] = True
        report["default_both_enabled"] = stable_defaults
        run("install", "--no-experimental-slash-tui", "--no-native-editor")
        assert native.owner(config) is None
        assert not (config / "skills/statusline-configure/SKILL.md").exists()
        assert "install: already correct:" in run("install")
        assert not (config / "skills/statusline-configure/SKILL.md").exists()
        assert native.owner(config) is None
        run("install", "--experimental-slash-tui", "--no-native-editor")
        assert (config / "skills/statusline-configure/SKILL.md").is_file()
        run("install", "--native-editor")
        assert (config / "skills/statusline-configure/SKILL.md").is_file()
        run("install", "--no-experimental-slash-tui")
        assert native.owner(config)
        assert not (config / "skills/statusline-configure/SKILL.md").exists()
        run("install", "--experimental-slash-tui")
        assert (config / "skills/statusline-configure/SKILL.md").is_file()
        marker = native.owner(config)
        assert marker is not None and marker["backend_version"] == __version__
        settings = (config / "settings.json").read_bytes()
        repeated = run("install")
        assert "install: already correct:" in repeated, repeated
        assert (config / "settings.json").read_bytes() == settings
        doctor = run("doctor")
        assert (
            "native backend binding: matches" in doctor
            and "native session loading: unverified" in doctor
        )
        host = native.Host(config)
        markets, plugins = host.listing()
        row = next(row for row in plugins if row["id"] == native.PLUGIN)
        cache = native._cache_owned(config, row, marker, require_current=True)
        host.run("validate", "--strict", str(cache))
        for operation, payload in [("describe", {}), ("read", {})]:
            response = json.loads(
                run(
                    "ui",
                    payload={
                        "protocol_version": 4,
                        "operation": operation,
                        "payload": payload,
                    },
                )
            )
            assert response["protocol_version"] == 4 and "result" in response
            if operation == "describe":
                rows = response["result"]["catalog"]
                expected_items = {(item.scope, item.id) for item in catalog.ITEMS}
                assert len(rows) == len(expected_items)
                assert {(item["scope"], item["id"]) for item in rows} == expected_items
            else:
                saved = response["result"]
        assert all(
            saved["installation"][key]["state"] == "owned"
            for key in ("statusLine", "subagentStatusLine")
        ), f"Invoked {backend}: {saved['installation']}"
        saved["draft"]["display"]["use_colors"] = not saved["draft"]["display"][
            "use_colors"
        ]
        saved["draft"]["display"]["items"] = list(catalog.BY_SCOPE["main"])
        saved["draft"]["display"]["subagents"]["items"] = [
            item
            for item in catalog.BY_SCOPE["subagent"]
            if item not in ("status", "elapsed")
        ]
        applied = json.loads(
            run(
                "ui",
                payload={
                    "protocol_version": 4,
                    "operation": "apply",
                    "payload": {
                        "draft": saved["draft"],
                        "expected_revision": saved["revision"],
                    },
                },
            )
        )["result"]
        assert applied["changed"] and applied["draft"] == saved["draft"]
        report["complete_scoped_catalog_saved"] = True
        preview = json.loads(
            run(
                "ui",
                payload={
                    "protocol_version": 4,
                    "operation": "preview",
                    "payload": {"draft": applied["draft"], "width": 24},
                },
            )
        )["result"]
        assert preview["sample"] and "main" in preview
        host.run("disable", native.PLUGIN, "--scope", "user", "--json")
        preserved = run("install")
        assert "explicitly disabled" in preserved
        assert (
            next(row for row in host.listing()[1] if row["id"] == native.PLUGIN)[
                "enabled"
            ]
            is False
        )
        run("install", "--no-native-editor")
        assert not (config / native.DIRECTORY).exists()
        assert (config / "skills/statusline-configure/SKILL.md").is_file()
        run("install", "--native-editor")
        assert native.owner(config)
        run("uninstall")
        assert not (config / native.DIRECTORY).exists()
        assert not any(row["id"] == native.PLUGIN for row in host.listing()[1])
        report.update(
            installed=True,
            four_install_combinations=True,
            repeat=True,
            bridge_saved=True,
            preview=True,
            external_disable_preserved=True,
            external_entry_preserved=True,
            uninstalled=True,
            resource_files=len(marker["files"]),
            runtime_fingerprint=hashlib.sha256(
                json.dumps(marker["files"], sort_keys=True).encode()
            ).hexdigest(),
        )
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
