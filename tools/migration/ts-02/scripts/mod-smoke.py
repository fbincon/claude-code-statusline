"""Free, local-only host process-API probe using temporary copies of both Mods.

No real credentials: an invalid synthetic key and an unreachable local API URL
prevent model calls. Terminal bytes stay in the caller's ignored output folder.
"""
import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess
import time


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--claude", required=True, type=Path)
    parser.add_argument("--node", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    import fcntl
    import pty
    import select
    import signal
    import struct
    import termios

    root = args.output.resolve()
    root.mkdir(mode=0o700, parents=True, exist_ok=False)
    repository = Path(__file__).resolve().parents[4]
    entry = repository / "tools/migration/ts-02/dist/cli.js"
    receipt = root / "bridge.jsonl"
    config = root / "config"
    project = root / "project 中文 & space"
    config.mkdir(); project.mkdir()
    (config / "settings.json").write_text('{"theme":"dark"}\n')
    (config / ".claude.json").write_text(json.dumps({"hasCompletedOnboarding": True, "theme": "dark",
        "projects": {str(project): {"hasTrustDialogAccepted": True}}}))
    env = {key: value for key, value in os.environ.items() if key in ("PATH", "SYSTEMROOT", "WINDIR", "LANG", "TMPDIR")}
    env.update(HOME=str(root), USERPROFILE=str(root), CLAUDE_CONFIG_DIR=str(config), TERM="xterm-256color",
        ANTHROPIC_API_KEY="ts02-synthetic-not-a-real-key", ANTHROPIC_BASE_URL="http://127.0.0.1:9",
        DISABLE_AUTOUPDATER="1", CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC="1")
    copies = []
    validations = []
    for name, hook in (("statusline-native", "register.ts"), ("statusline-runtime", "observe.ts")):
        target = root / name
        shutil.copytree(repository / "mods" / name, target, ignore=shutil.ignore_patterns("node_modules", "types"))
        manifest = target / ".claude-plugin/plugin.json"
        data = json.loads(manifest.read_text())
        data["userConfig"]["backendExecutable"]["default"] = str(args.node.resolve())
        data["userConfig"]["backendVersion"]["default"] = ""
        data["userConfig"]["backendArgs"] = {"type": "string", "multiple": True, "title": "Probe backend arguments",
            "description": "Temporary TS-02 argv prefix", "default": [str(entry), "bridge", str(receipt)]}
        manifest.write_text(json.dumps(data, ensure_ascii=False, indent=2))
        path = target / "hooks" / hook
        source = path.read_text()
        prefix = "...(Array.isArray(options.backendArgs) ? options.backendArgs : []), "
        source = source.replace("[executable, 'ui'", "[executable, " + prefix + "'ui'")
        source = source.replace("[state.executable, 'runtime'", "[state.executable, " + prefix + "'runtime'")
        path.write_text(source)
        validation = subprocess.run([str(args.claude.resolve()), "plugin", "validate", "--strict", str(target)],
            env=env, capture_output=True, text=True, timeout=30)
        (root / (name + "-validation.log")).write_text(validation.stdout + validation.stderr)
        if validation.returncode:
            raise RuntimeError("Temporary Mod manifest validation failed; inspect private log")
        validations.append(name)
        copies.extend(["--plugin-dir", str(target)])
    master, slave = pty.openpty()
    fcntl.ioctl(slave, termios.TIOCSWINSZ, struct.pack("HHHH", 30, 120, 0, 0))
    def terminal():
        os.setsid()
        fcntl.ioctl(0, termios.TIOCSCTTY, 0)
    child = subprocess.Popen([str(args.claude.resolve()), *copies, "--strict-mcp-config", "--mcp-config", '{"mcpServers":{}}'],
        cwd=project, env=env, stdin=slave, stdout=slave, stderr=slave, preexec_fn=terminal)
    os.close(slave)
    raw = bytearray()
    try:
        deadline = time.monotonic() + 35
        sent = False
        key_confirmed = False
        started = time.monotonic()
        while time.monotonic() < deadline and child.poll() is None:
            if select.select([master], [], [], .1)[0]:
                try:
                    chunk = os.read(master, 65536)
                except OSError:
                    break
                raw.extend(chunk)
                if b"\x1b[6n" in chunk:
                    os.write(master, b"\x1b[1;1R")
                if not key_confirmed and b"ANTHROPIC_API_KEY" in raw:
                    # Select the synthetic key. The unreachable loopback URL
                    # still prevents model requests; never select a real key.
                    os.write(master, b"\x1b[A\r")
                    key_confirmed = True
                    started = time.monotonic()
            if not sent and time.monotonic() - started > 5:
                os.write(master, b"/statusline-configure-native\r")
                sent = True
            if receipt.exists():
                rows = [json.loads(line) for line in receipt.read_text().splitlines()]
                if {row["command"] for row in rows} >= {"ui", "runtime"}:
                    break
        rows = [json.loads(line) for line in receipt.read_text().splitlines()] if receipt.exists() else []
        commands = sorted({row["command"] for row in rows})
        report = {"host": subprocess.check_output([str(args.claude.resolve()), "--version"], env=env, text=True).strip(),
            "manifest_validation": validations, "real_process_api_commands": commands, "model_calls": 0,
            "credentials": "synthetic key; unreachable loopback API", "temporary_mod_copies": True,
            "state": "pass" if commands == ["runtime", "ui"] else "unverified"}
        (root / "report.json").write_text(json.dumps(report, indent=2) + "\n")
        print(json.dumps(report))
        return 0 if report["state"] == "pass" else 1
    finally:
        if child.poll() is None:
            os.killpg(child.pid, signal.SIGTERM)
            try:
                child.wait(timeout=3)
            except subprocess.TimeoutExpired:
                os.killpg(child.pid, signal.SIGKILL); child.wait()
        os.close(master)
        (root / "terminal.bin").write_bytes(raw)


if __name__ == "__main__":
    raise SystemExit(main())
