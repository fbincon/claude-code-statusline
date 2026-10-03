"""Bundle the sole Mod source into wheels; keep development files in sdist."""

import json
from pathlib import Path

from setuptools.command.build_py import build_py


class BuildPy(build_py):
    def run(self):
        super().run()
        if self.editable_mode:
            return
        source = Path(__file__).resolve().parents[1]
        # Load only stdlib inventory helpers with the build's source package.
        import sys

        sys.path.insert(0, str(source / "src"))
        try:
            from claude_statusline._version import __version__
            from claude_statusline.integration.native_resources import (
                inventory,
                source_files,
            )

            files = source_files(source / "mods/statusline-native")
            manifest = inventory(files, __version__)
        finally:
            sys.path.pop(0)
        destination = (
            Path(self.build_lib) / "claude_statusline/resources/statusline-native"
        )
        for name, raw in files.items():
            path = destination / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(raw)
        (destination / "resource-manifest.json").write_text(
            json.dumps(manifest, indent=2) + "\n", encoding="utf-8"
        )
