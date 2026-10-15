"""Identity, JSON and process isolation shared by the TS-01 tools."""

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import subprocess

REFERENCE = "9b6d2fab4bf165be280d428a874521bfbf02c7e1"
ROOT = Path(__file__).resolve().parents[2]
CORPUS = ROOT / "tests/fixtures/migration/ts-01"


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def encoded(value):
    return (
        json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + "\n"
    ).encode("utf-8")


def read_json(path):
    def unique(pairs):
        result = {}
        for key, value in pairs:
            if key in result:
                raise ValueError(f"Duplicate key: {key}")
            result[key] = value
        return result

    def constant(value):
        raise ValueError(f"Non-finite number: {value}")

    return json.loads(
        Path(path).read_bytes(), object_pairs_hook=unique, parse_constant=constant
    )


def git(*args):
    return subprocess.check_output(["git", *args], cwd=ROOT)


def reference_files():
    """Read immutable blobs in one Git process, without checking out a branch."""
    names = git("ls-tree", "-rz", REFERENCE).split(b"\0")
    entries = []
    for entry in names:
        if entry:
            header, path = entry.split(b"\t", 1)
            mode, kind, oid = header.split()
            if kind != b"blob" or mode not in (b"100644", b"100755"):
                raise ValueError("Reference contains unsupported tree entries")
            entries.append((path.decode("utf-8"), oid))
    if not entries:
        raise ValueError("Empty reference tree")
    raw = subprocess.check_output(
        ["git", "cat-file", "--batch"],
        input=b"\n".join(oid for _, oid in entries) + b"\n",
        cwd=ROOT,
    )
    result, offset = {}, 0
    for path, _ in entries:
        end = raw.index(b"\n", offset)
        size = int(raw[offset:end].split()[2])
        offset = end + 1
        result[path] = raw[offset : offset + size]
        offset += size + 1
    return result


def isolated_environment(source, root):
    """Explicit child environment: no model credentials or real user stores."""
    keys = (
        "SYSTEMROOT",
        "WINDIR",
        "COMSPEC",
        "PATHEXT",
        "TMP",
        "TEMP",
        "TMPDIR",
        "LD_LIBRARY_PATH",
    )
    env = {key: os.environ[key] for key in keys if key in os.environ}
    env.update(
        PATH=str(root / "bin"),
        PYTHONPATH=str(source / "src"),
        PYTHONDONTWRITEBYTECODE="1",
        PYTHONUTF8="1",
        PYTHONHASHSEED="0",
        LC_ALL="C.UTF-8",
        TZ="UTC",
        TERM="xterm-256color",
        COLUMNS="80",
        LINES="24",
        HOME=str(root / "home"),
        USERPROFILE=str(root / "home"),
        CLAUDE_CONFIG_DIR=str(root / "config"),
        CLAUDE_STATUSLINE_RUNTIME_DIR=str(root / "runtime"),
        CLAUDE_STATUSLINE_SESSIONS_DIR=str(root / "sessions"),
        GIT_CONFIG_GLOBAL=os.devnull,
        GIT_CONFIG_SYSTEM=os.devnull,
        DISABLE_AUTOUPDATER="1",
        CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC="1",
    )
    return env


def check_source(source, files):
    """Hash execution inputs, including assets and tests; reject extra Python."""
    prefixes = ("src/", "tests/", "tools/", "mods/")
    expected_python = set()
    for name, raw in files.items():
        if not name.startswith(prefixes):
            continue
        path = source / name
        if (
            path.is_symlink()
            or not path.is_file()
            or digest(path.read_bytes()) != digest(raw)
        ):
            raise ValueError(f"Reference source mismatch: {name}")
        if name.endswith(".py"):
            expected_python.add(name)
    actual_python = {
        p.relative_to(source).as_posix()
        for top in ("src", "tests", "tools")
        for p in (source / top).rglob("*.py")
    }
    if actual_python != {p for p in expected_python if not p.startswith("mods/")}:
        raise ValueError("Reference source has additional/missing Python modules")
