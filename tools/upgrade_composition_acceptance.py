"""Verify released-wheel migration, compatible-backup downgrade and re-upgrade."""

import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--baseline", type=Path, required=True)
    parser.add_argument("--candidate", type=Path, required=True)
    parser.add_argument("--report-dir", type=Path, required=True)
    args = parser.parse_args()
    root = args.report_dir.resolve()
    root.mkdir(parents=True, exist_ok=False)
    config = root / "Claude 配置"
    venv = root / "venv"
    subprocess.run([sys.executable, "-m", "venv", str(venv)], check=True)
    scripts = venv / ("Scripts" if os.name == "nt" else "bin")
    python = scripts / ("python.exe" if os.name == "nt" else "python")
    cli = scripts / (
        "claude-statusline.exe" if os.name == "nt" else "claude-statusline"
    )
    env = dict(
        os.environ,
        CLAUDE_CONFIG_DIR=str(config),
        CLAUDE_STATUSLINE_RUNTIME_DIR=str(config / "statusline_runtime"),
    )
    env.pop("PYTHONPATH", None)

    def run(*argv, input=None):
        return subprocess.run(
            [str(v) for v in argv],
            input=input,
            env=env,
            cwd=root,
            text=True,
            capture_output=True,
            check=True,
            timeout=180,
        ).stdout

    def install(wheel):
        run(
            python,
            "-m",
            "pip",
            "install",
            "--no-deps",
            "--force-reinstall",
            wheel.resolve(),
        )

    def command(*args):
        return run(cli, *args)

    install(args.baseline)
    old_version = command("--version").strip()
    command(
        "install",
        "--no-native-editor",
        "--no-experimental-slash-tui",
        "--no-native-timing",
        "--no-live-metrics",
    )
    command("config", "set-items", "model", "git", "context-used", "tokens")
    command("config", "item", "main", "hostname", "label", "Saved disabled 中文")
    command("config", "item", "main", "tokens", "number-format", "full")
    command("config", "layout", "explicit", "model,git", "context-used,tokens")
    command("config", "language", "set", "zh-CN")
    command("config", "set", "statusline-language", "zh-CN")
    path = config / "claude-statusline.json"
    old = path.read_bytes()
    assert json.loads(old)["schema_version"] == 7
    preserved = {
        p.name: p.read_bytes()
        for p in config.glob("*.json")
        if p.name not in {path.name, "settings.json"}
    }
    runtime = config / "statusline_runtime" / "retained-fixture.json"
    runtime.parent.mkdir(exist_ok=True)
    runtime.write_text('{"retained":true}\n')
    install(args.candidate)
    new_version = command("--version").strip()
    normalized = json.loads(command("--language", "en", "config", "show", "--json"))[
        "display"
    ]
    command("install", "--dry-run")
    assert path.read_bytes() == old, "Read/dry-run migrated the old file"
    assert normalized["schema_version"] == 8
    command("install")
    migrated = json.loads(path.read_bytes())
    assert migrated == normalized
    assert [i["id"] for i in migrated["instances"] if i["enabled"]] == [
        "model",
        "git",
        "context-used",
        "tokens",
    ]
    disabled = next(i for i in migrated["instances"] if i["type_id"] == "hostname")
    assert (
        disabled["enabled"] is False
        and disabled["options"]["label"] == "Saved disabled 中文"
    )
    assert migrated["layout"]["rows"][-1][-1] == "hostname"
    assert any(
        p.read_bytes() == old
        for p in (config / "backups" / "statusline").rglob("*.before")
    ), "Original display bytes were not backed up"
    duplicate = command(
        "--language", "en", "config", "instance", "main", "copy", "tokens"
    ).splitlines()[-1]
    command("config", "instance", "main", "set", duplicate, "label", "Copy 中文")
    portable = root / "composition.json"
    command("config", "export", portable)
    copied = json.loads(portable.read_bytes())["draft"]["display"]
    assert len({i["id"] for i in copied["instances"]}) == len(copied["instances"])
    assert (
        next(i for i in copied["instances"] if i["id"] == duplicate)["options"]["label"]
        == "Copy 中文"
    )
    assert {name: (config / name).read_bytes() for name in preserved} == preserved
    # Restore the compatible backed-up display before downgrading; preserve the new portable copy.
    path.write_bytes(old)
    install(args.baseline)
    command("install")
    assert json.loads(path.read_bytes())["schema_version"] == 7
    assert command("--version").strip() == old_version
    install(args.candidate)
    command("install")
    assert json.loads(path.read_bytes()) == migrated
    assert {name: (config / name).read_bytes() for name in preserved} == preserved
    assert runtime.read_text() == '{"retained":true}\n'
    report = {
        "baseline": old_version,
        "candidate": new_version,
        "wheel_sha256": {
            p.name: hashlib.sha256(p.read_bytes()).hexdigest()
            for p in (args.baseline, args.candidate)
        },
        "checks": [
            "read-and-dry-run-no-write",
            "actual-install-migration",
            "exact-byte-backup",
            "stable-identity-and-disabled-overrides",
            "explicit-layout",
            "copy-and-export",
            "editor-and-collector-opt-outs",
            "interface-and-output-languages",
            "compatible-backup-downgrade",
            "reupgrade-equivalence",
            "runtime-preservation",
        ],
    }
    (root / "report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n"
    )
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
