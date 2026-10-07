"""Check relative Markdown links, heading anchors, and bilingual document pairs."""

from __future__ import annotations

import argparse
from collections import Counter
from pathlib import Path
import re
from urllib.parse import unquote

LOCAL_ONLY = {"ROADMAP.md", "ROADMAP.zh-CN.md", "MACOS_VALIDATION.md"}
LINKS = re.compile(r"\[[^\]\n]*\]\(([^\s)]+)(?:\s+[^)]*)?\)")
REPOSITORY_LINKS = (
    "https://github.com/fbincon/claude-code-statusline/blob/main/",
    "https://raw.githubusercontent.com/fbincon/claude-code-statusline/main/",
)


def anchors(body: str) -> set[str]:
    result = set(re.findall(r'<a\s+id="([^"]+)"', body))
    counts: Counter[str] = Counter()
    for heading in re.findall(r"^#{1,6}\s+(.+)$", body, re.M):
        heading = re.sub(r"<[^>]+>|[*`]", "", heading).lower()
        slug = re.sub(r"[^\w\- ]", "", heading).replace(" ", "-")
        suffix = f"-{counts[slug]}" if counts[slug] else ""
        result.add(slug + suffix)
        counts[slug] += 1
    return result


def check(root: Path) -> tuple[int, list[str]]:
    errors = []
    count = 0
    pages = list(root.glob("*.md")) + list((root / "docs").rglob("*.md"))
    pages = [p for p in pages if p.name not in LOCAL_ONLY]
    for page in pages:
        body = page.read_text(encoding="utf-8")
        if page.name.endswith(".zh-CN.md"):
            counterpart = page.with_name(page.name.replace(".zh-CN.md", ".md"))
            if not counterpart.is_file():
                errors.append(f"{page.relative_to(root)}: missing English counterpart")
        elif "releases" not in page.relative_to(root).parts:
            counterpart = page.with_name(page.stem + ".zh-CN.md")
            if not counterpart.is_file():
                errors.append(f"{page.relative_to(root)}: missing Chinese counterpart")
        for target in LINKS.findall(body):
            repository_target = next(
                (target.removeprefix(prefix) for prefix in REPOSITORY_LINKS if target.startswith(prefix)),
                None,
            )
            if repository_target is not None:
                target = repository_target
                origin = root
            else:
                if re.match(r"^[a-zA-Z][a-zA-Z0-9+.-]*:", target):
                    continue
                origin = page.parent
            path, _, fragment = unquote(target).partition("#")
            destination = (origin / path).resolve() if path else page
            count += 1
            if not destination.exists():
                errors.append(f"{page.relative_to(root)}: missing {target}")
            elif fragment and destination.suffix == ".md":
                if fragment not in anchors(destination.read_text(encoding="utf-8")):
                    errors.append(f"{page.relative_to(root)}: missing anchor {target}")
    for suffix, heading, native_anchor in (
        ("", "Common configuration", "native-configuration-editor"),
        (".zh-CN", "常用配置", "原生配置编辑器"),
    ):
        readme = root / f"README{suffix}.md"
        guide = root / "docs" / f"USER_GUIDE{suffix}.md"
        body = readme.read_text(encoding="utf-8")
        section = re.search(
            rf"^## {re.escape(heading)}\n(.*?)(?=^## |\Z)", body, re.M | re.S
        )
        for command in (
            "/statusline-configure-native",
            "/statusline-configure",
            "/statusline-config",
            "claude-statusline configure",
            "claude-statusline config",
        ):
            if section is None or not re.search(
                re.escape(command) + r"(?![\w-])", section[1]
            ):
                errors.append(f"{readme.name}: common configuration missing {command}")
        contents = guide.read_text(encoding="utf-8")
        for required in (
            f"](#{native_anchor})",
            "2.1.287",
            "2.1.258",
            "claude-statusline-native.json",
        ):
            if required not in contents:
                errors.append(
                    f"{guide.relative_to(root)}: missing editor documentation {required}"
                )
    legacy = {
        "README.md": "v130a2-external-tui-and-in-session-client",
        "README.zh-CN.md": "v130a2外部-tui-与会话内-client",
        "docs/USER_GUIDE.md": "v130a2-external-tui-and-in-session-client",
        "docs/USER_GUIDE.zh-CN.md": "v130a2外部-tui-与会话内-client",
        "docs/RELEASING.md": "v130-preview-rollout",
        "docs/RELEASING.zh-CN.md": "v130-预览推进",
    }
    for name, fragment in legacy.items():
        if fragment not in anchors((root / name).read_text(encoding="utf-8")):
            errors.append(f"{name}: missing legacy anchor {fragment}")
    return count, errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path.cwd())
    args = parser.parse_args()
    count, errors = check(args.root.resolve())
    for error in errors:
        print(error)
    print(f"Checked {count} relative documentation links and bilingual pairs.")
    return bool(errors)


if __name__ == "__main__":
    raise SystemExit(main())
