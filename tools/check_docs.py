"""Check relative Markdown links, heading anchors, and bilingual document pairs."""

from __future__ import annotations

import argparse
from collections import Counter
from pathlib import Path
import re
from urllib.parse import unquote

LOCAL_ONLY = {"ROADMAP.md", "ROADMAP.zh-CN.md", "MACOS_VALIDATION.md"}
LINKS = re.compile(r"\[[^\]\n]*\]\(([^\s)]+)(?:\s+[^)]*)?\)")


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
            if re.match(r"^[a-zA-Z][a-zA-Z0-9+.-]*:", target):
                continue
            path, _, fragment = unquote(target).partition("#")
            destination = (page.parent / path).resolve() if path else page
            count += 1
            if not destination.exists():
                errors.append(f"{page.relative_to(root)}: missing {target}")
            elif fragment and destination.suffix == ".md":
                if fragment not in anchors(destination.read_text(encoding="utf-8")):
                    errors.append(f"{page.relative_to(root)}: missing anchor {target}")
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
