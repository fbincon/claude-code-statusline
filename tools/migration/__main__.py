"""Inventory, capture and verify the Python reference; never refresh goldens."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import subprocess
import sys

from .capture import capture, source_tree, verify
from .common import encoded, reference_files
from .inventory import build


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    for name in ("inventory", "capture", "verify"):
        command = commands.add_parser(name)
        command.add_argument(
            "--source-root",
            type=Path,
            help="Existing exact reference export; otherwise create a temporary export",
        )
        command.add_argument("--python", type=Path, default=Path(sys.executable))
        if name == "inventory":
            command.add_argument(
                "--output", type=Path, required=True, help="New JSON file"
            )
        elif name == "capture":
            command.add_argument(
                "--output-dir", type=Path, required=True, help="New capture directory"
            )
        else:
            command.add_argument(
                "--capture-dir",
                type=Path,
                help="Verify a saved receipt/output instead of replaying",
            )
    args = parser.parse_args()
    try:
        files = reference_files()
        with source_tree(files, args.source_root) as source:
            if args.command == "inventory":
                result = build(files, source, args.python.absolute())
                with args.output.open("xb") as output:
                    output.write(encoded(result))
                result = result["counts"]
            elif args.command == "capture":
                result = {
                    "cases": len(
                        capture(source, args.output_dir, args.python.absolute())
                    )
                }
            else:
                result = verify(files, source, args.capture_dir, args.python.absolute())
        print(json.dumps(result, ensure_ascii=False))
        return 0
    except (ValueError, OSError, subprocess.SubprocessError) as exc:
        print(str(exc), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
