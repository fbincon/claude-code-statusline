"""Inspect release metadata, resources, documentation and distribution exclusions."""

from __future__ import annotations

import argparse
import os
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=Path.cwd())
    parser.add_argument("--dist", type=Path, default=Path("dist"))
    parser.add_argument("--write-exclusion-fixtures", action="store_true")
    parser.add_argument("--check-long-description", action="store_true")
    args = parser.parse_args()
    args.dist = args.dist.resolve()
    os.chdir(args.source)
    if args.write_exclusion_fixtures:
        for name in (
            "docs/MACOS_VALIDATION.md",
            "docs/ROADMAP.md",
            "docs/ROADMAP.zh-CN.md",
            "docs/.DS_Store",
        ):
            path = Path(name)
            if path.exists():
                raise SystemExit(
                    f"Refusing to overwrite an existing fixture target: {path}"
                )
            path.write_text("Local-only packaging fixture\n", encoding="utf-8")
        return
    import email
    import runpy
    import tarfile
    import re
    import zipfile
    import json
    import sys

    sys.path.insert(0, str(Path("src").resolve()))
    sys.path.insert(0, str(Path("tools").resolve()))
    from markdown_links import pypi_readme
    from claude_statusline.integration.native_resources import source_files, inventory
    from claude_statusline.integration.mods import SPECS

    project_body = Path("pyproject.toml").read_text(encoding="utf-8")
    project = {
        key: re.search(rf'(?m)^{key} = "([^"\n]+)"$', project_body).group(1)
        for key in ("name", "version")
    }
    version = runpy.run_path("src/claude_statusline/_version.py")["__version__"]
    assert project["version"] == version
    wheel = list(args.dist.glob("*.whl"))
    sdist = list(args.dist.glob("*.tar.gz"))
    assert len(wheel) == len(sdist) == 1
    distributions = []
    with zipfile.ZipFile(wheel[0]) as archive:
        names = set(archive.namelist())
        distributions.append(names)
        metadata_name = next(
            name for name in names if name.endswith(".dist-info/METADATA")
        )
        metadata = email.message_from_bytes(archive.read(metadata_name))
        assert metadata["Name"] == project["name"] == "fbincon-claude-code-statusline"
        assert metadata["Version"] == version
        for resource in Path("src/claude_statusline/i18n/locales").glob("*.json"):
            assert archive.read("claude_statusline/i18n/locales/" + resource.name) == resource.read_bytes()
        generated_statusline = Path("src/claude_statusline/i18n/_generated_statusline.py")
        assert archive.read("claude_statusline/i18n/_generated_statusline.py") == generated_statusline.read_bytes()
        assert metadata["Description-Content-Type"] == "text/markdown"
        english_readme = Path("README.md").read_text(encoding="utf-8")
        long_description = pypi_readme(english_readme, version)
        assert metadata.get_payload(decode=True).decode("utf-8") == long_description
        if args.check_long_description:
            from readme_renderer.markdown import render

            rendered = render(long_description)
            assert rendered is not None, "Install readme-renderer[md] to check Markdown"
            rendered_anchors = set(re.findall(r'id="([^"\n]+)"', rendered))
            for target in re.findall(r'(?:href|src)="([^"\n]+)"', rendered):
                assert target.startswith("https://") or (
                    target.startswith("#") and target[1:] in rendered_anchors
                ), (
                    f"PyPI long description has an unresolved link: {target}"
                )
        assert "A Claude Code status line for Linux" in english_readme
        assert (
            archive.read("claude_statusline/_version.py")
            == Path("src/claude_statusline/_version.py").read_bytes()
        )
        assert "Operating System :: MacOS :: MacOS X" in metadata.get_all(
            "Classifier", []
        )
        requirements = metadata.get_all("Requires-Dist", [])
        assert any(
            "windows-curses>=2.4.2" in value and "win32" in value
            for value in requirements
        )
        for suffix in (
            "claude_statusline/_platform.py",
            "claude_statusline/macos_terminal.py",
            "claude_statusline/resources/statusline-config/SKILL.md",
            "claude_statusline/resources/statusline-configure/SKILL.md",
        ):
            assert any(name.endswith(suffix) for name in names), suffix
        for spec in SPECS:
            runtime = source_files(Path("mods") / spec.name)
            prefix = "claude_statusline/resources/" + spec.name + "/"
            expected = {prefix + name for name in runtime} | {
                prefix + "resource-manifest.json"
            }
            assert {name for name in names if name.startswith(prefix)} == expected
            for name, raw in runtime.items():
                assert archive.read(prefix + name) == raw, name
            assert json.loads(
                archive.read(prefix + "resource-manifest.json")
            ) == inventory(runtime, version, spec.name)
        assert not any(
            part in name.split("/")
            for name in names
            for part in (
                "tests",
                "node_modules",
                "package.json",
                "package-lock.json",
                "tsconfig.json",
            )
        )
    with tarfile.open(sdist[0], "r:gz") as archive:
        names = set(archive.getnames())
        distributions.append(names)
        root = next(name.split("/")[0] for name in names)
        assert archive.extractfile(f"{root}/README.md").read() == Path("README.md").read_bytes()
        sdist_metadata = email.message_from_bytes(archive.extractfile(f"{root}/PKG-INFO").read())
        assert sdist_metadata.get_payload(decode=True).decode("utf-8") == long_description
        for suffix in (
            "README.md",
            "README.zh-CN.md",
            "CHANGELOG.md",
            "CHANGELOG.zh-CN.md",
            "docs/USER_GUIDE.md",
            "docs/USER_GUIDE.zh-CN.md",
            "docs/RELEASING.md",
            "docs/RELEASING.zh-CN.md",
            "src/claude_statusline/_platform.py",
            "src/claude_statusline/macos_terminal.py",
            "src/claude_statusline/resources/statusline-config/SKILL.md",
            "src/claude_statusline/resources/statusline-configure/SKILL.md",
            "docs/images/README.md",
            "docs/images/README.zh-CN.md",
            "docs/releases/v1.0.0.md",
            "docs/releases/v1.1.0a1.md",
            "docs/releases/v1.1.0.md",
            "tools/ci_smoke.py",
            "src/build_native.py",
        ):
            assert any(name.endswith(suffix) for name in names), suffix
        for notes in Path("docs/releases").glob("*.md"):
            suffix = notes.as_posix()
            assert any(name.endswith(suffix) for name in names), suffix
        for image in Path("docs/images").rglob("*.png"):
            suffix = image.as_posix()
            assert any(name.endswith(suffix) for name in names), suffix
    excluded = {
        "MACOS_VALIDATION.md",
        "ROADMAP.md",
        "ROADMAP.zh-CN.md",
        ".DS_Store",
        "__pycache__",
        ".pytest_cache",
        ".ruff_cache",
        ".git",
    }
    for names in distributions:
        for name in names:
            path = Path(name)
            assert not excluded.intersection(path.parts), name
            assert path.suffix not in {".pyc", ".pyo"}, name

    for module in Path("src/claude_statusline").rglob("*.py"):
        suffix = module.relative_to("src").as_posix()
        assert suffix in distributions[0], suffix
        assert any(name.endswith(module.as_posix()) for name in distributions[1]), (
            module
        )
    for directory in ("tests", "tools", "docs/development"):
        for source in Path(directory).rglob("*"):
            if source.is_file() and source.suffix in {".py", ".md"}:
                assert any(
                    name.endswith(source.as_posix()) for name in distributions[1]
                ), source
    for source in (
        path for spec in SPECS for path in (Path("mods") / spec.name).rglob("*")
    ):
        if (
            source.is_file()
            and source.suffix in {".json", ".ts"}
            and "node_modules" not in source.parts
            and ".claude-plugin/types" not in source.as_posix()
        ):
            assert any(name.endswith(source.as_posix()) for name in distributions[1]), (
                source
            )
    for names in distributions:
        assert not any(
            "/node_modules/" in name or ".claude-plugin/types/" in name
            for name in names
        )
    print(
        f"Verified {version}: {len(distributions[0])} wheel entries and {len(distributions[1])} sdist entries."
    )


if __name__ == "__main__":
    main()
