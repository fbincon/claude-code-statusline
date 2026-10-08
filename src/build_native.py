"""Bundle Mods and resolve README destinations for package metadata."""

import importlib.util
import json
from pathlib import Path

from setuptools.command.build_py import build_py
from setuptools.command.egg_info import egg_info


class EggInfo(egg_info):
    def run(self):
        source = Path(__file__).resolve().parents[1]
        spec = importlib.util.spec_from_file_location(
            "statusline_build_markdown", source / "tools" / "markdown_links.py"
        )
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        metadata = self.distribution.metadata
        metadata.long_description = module.pypi_readme(
            (source / "README.md").read_text(encoding="utf-8"), metadata.version
        )
        super().run()


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

            from claude_statusline.integration.mods import SPECS

            inventories = [
                (spec.name, source_files(source / "mods" / spec.name)) for spec in SPECS
            ]
            manifests = {
                name: inventory(files, __version__, name) for name, files in inventories
            }
        finally:
            sys.path.pop(0)
        for name, files in inventories:
            destination = Path(self.build_lib) / "claude_statusline/resources" / name
            for relative, raw in files.items():
                path = destination / relative
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(raw)
            (destination / "resource-manifest.json").write_text(
                json.dumps(manifests[name], indent=2) + "\n", encoding="utf-8"
            )
