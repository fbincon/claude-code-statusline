"""Verify an exported benchmark source against its immutable Git commit."""

from __future__ import annotations
import hashlib
import os
from pathlib import Path
import subprocess


def identity(root: Path, commit: str | None = None):
    paths = sorted((root / "src/claude_statusline").rglob("*.py"))
    paths += sorted((root / "src/claude_statusline/i18n/locales").glob("*.json"))
    digest = hashlib.sha256()
    actual = {}
    for path in paths:
        relative = path.relative_to(root).as_posix()
        raw = path.read_bytes()
        blob = hashlib.sha1(
            b"blob " + str(len(raw)).encode("ascii") + b"\0" + raw
        ).hexdigest()
        actual[relative] = blob
        digest.update(relative.encode("utf-8") + b"\0" + raw + b"\0")
    if commit:
        repo = Path(
            os.environ.get(
                "CLAUDE_STATUSLINE_BENCHMARK_REPO", Path(__file__).resolve().parents[2]
            )
        )
        result = subprocess.check_output(
            ["git", "ls-tree", "-rz", commit, "--", "src/claude_statusline"], cwd=repo
        )
        expected = {}
        for entry in result.split(b"\0"):
            if not entry:
                continue
            header, name = entry.split(b"\t", 1)
            relative = name.decode("utf-8")
            if relative.endswith(".py") or relative.startswith(
                "src/claude_statusline/i18n/locales/"
            ):
                expected[relative] = header.decode("ascii").split()[2]
        if not expected or expected != actual:
            raise ValueError("Benchmark source does not match the supplied Git commit")
    return digest.hexdigest()
