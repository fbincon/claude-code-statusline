"""Verify real official runtime plugin installation without credentials/models."""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import platform
import shutil
import subprocess
import sys
import tempfile
import time


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--report", type=Path, required=True)
    args = parser.parse_args()
    from claude_statusline._version import __version__
    from claude_statusline.integration import installer, capabilities, native
    from claude_statusline.integration.mods import RUNTIME

    backend = Path(sys.executable).parent / (
        "claude-statusline.exe" if os.name == "nt" else "claude-statusline"
    )
    if not backend.is_file():
        backend = Path(shutil.which("claude-statusline") or "").resolve()
    assert backend.is_file(), "Installed backend missing"
    version = capabilities.detect_claude_version()
    assert version is not None and version >= RUNTIME.minimum_version
    results = {}
    with tempfile.TemporaryDirectory(prefix="runtime smoke ") as temporary:
        config = Path(temporary).resolve() / "config with spaces"

        def command(*tail, data=None):
            completed = subprocess.run(
                [str(backend), *tail, "--config-dir", str(config)],
                input=json.dumps(data) if data else None,
                capture_output=True,
                text=True,
                encoding="utf-8",
                timeout=180,
                env=dict(os.environ, DISABLE_AUTOUPDATER="1"),
            )
            assert completed.returncode == 0, completed.stderr + completed.stdout
            return completed.stdout

        command("install", "--live-metrics", "--no-native-editor")
        results["independent_install"] = (
            bool(native.owner(config, spec=RUNTIME)) and native.owner(config) is None
        )
        before = ((config / "settings.json").read_bytes(), native.owner(config, spec=RUNTIME))
        command("install")
        after = ((config / "settings.json").read_bytes(), native.owner(config, spec=RUNTIME))
        results["repeat"] = before == after
        now = time.time() * 1000
        observation = {
            "session_id": "runtime-smoke",
            "epoch": "smoke",
            "seq": 0,
            "observed_at_ms": now,
            "source": "native",
            "kind": "heartbeat",
            "prompt_id": None,
            "turn_id": None,
            "agent_id": None,
            "parent_agent_id": None,
            "request_id": None,
            "payload": {
                "host_version": ".".join(map(str, version)),
                "loaded_at_ms": now,
            },
        }
        response = json.loads(
            command(
                "runtime",
                data={
                    "protocol_version": 2,
                    "operation": "observe",
                    "payload": {"observations": [observation]},
                },
            )
        )
        assert response["result"]["accepted"] == 1
        read = json.loads(
            command(
                "runtime",
                data={
                    "protocol_version": 2,
                    "operation": "read",
                    "payload": {"session_id": "runtime-smoke", "prompt_id": None},
                },
            )
        )
        results["runtime_handshake"] = read["result"]["fresh"]
        command("install", "--native-editor")
        results["both_mods"] = bool(
            native.owner(config, spec=RUNTIME) and native.owner(config)
        )
        suspended = installer.install_configuration(
            config, backend, claude_version=(2, 1, 288)
        )
        assert not suspended.native_failed, suspended.messages
        results["suspended_on_older_host"] = native.owner(config, spec=RUNTIME)[
            "suspended"
        ]
        command("install")
        results["restored"] = not native.owner(config, spec=RUNTIME)["suspended"]
        command("install", "--no-live-metrics")
        results["independent_disable"] = (
            native.owner(config, spec=RUNTIME) is None
            and native.owner(config) is not None
        )
        command("uninstall")
        results["uninstall"] = native.owner(config) is None
    assert all(results.values()), results
    report = {
        "package_version": __version__,
        "host_version": version,
        "platform": platform.platform(),
        "python": platform.python_version(),
        "results": results,
        "model_calls": 0,
        "manual_acceptance": False,
    }
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
