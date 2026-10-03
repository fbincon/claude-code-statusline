"""Generate exact-build Mod declarations through an unauthenticated host load.

The host writes .claude-plugin/types before refusing the unauthenticated print
session. No model credentials, project settings, or personal MCPs are supplied.
"""

from __future__ import annotations

import argparse
import os
from pathlib import Path
import re
import subprocess
import tempfile


def prepare(executable: str, plugin: Path) -> str:
    version = subprocess.run(
        [executable, "--version"], capture_output=True, text=True, check=True,
        encoding="utf-8", timeout=10,
    ).stdout
    match = re.search(r"\d+\.\d+\.\d+", version)
    if match is None:
        raise RuntimeError("Cannot determine the Claude Code build")
    version = match.group()
    plugin = plugin.resolve()
    # Remove stale declarations first so an old successful load cannot pass.
    declarations = plugin / ".claude-plugin/types/claude-code/index.d.ts"
    declarations.unlink(missing_ok=True)
    environment = {
        key: value for key, value in os.environ.items()
        if not key.startswith(("ANTHROPIC_", "AWS_", "GOOGLE_", "CLAUDE_", "CLAUDECODE"))
    }
    environment.update(DISABLE_AUTOUPDATER="1", CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC="1")
    with tempfile.TemporaryDirectory(prefix="statusline-mod-types-") as folder:
        environment["CLAUDE_CONFIG_DIR"] = folder
        subprocess.run(
            [executable, "-p", "/plugin-types", "--plugin-dir", str(plugin),
             "--max-budget-usd", "0.000001", "--no-session-persistence", "--setting-sources", ""],
            env=environment, cwd=folder, capture_output=True, timeout=30,
        )
    if not declarations.is_file():
        raise RuntimeError(f"Claude Code {version} did not emit Mod types; check host restrictions")
    header = declarations.read_text(encoding="utf-8").splitlines()[0]
    if header != f"// Written by Claude Code {version}.":
        raise RuntimeError(f"Unexpected generated declaration header: {header}")
    print(f"Generated official Mod declarations for Claude Code {version}")
    return version


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--claude", default="claude")
    parser.add_argument("--plugin", type=Path, default=Path("mods/statusline-native"))
    args = parser.parse_args()
    prepare(args.claude, args.plugin)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
