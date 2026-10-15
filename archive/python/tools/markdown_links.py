"""Rewrite Markdown destinations without changing prose or command examples."""

from __future__ import annotations

import posixpath
import re
from urllib.parse import quote, unquote, urlsplit

REPOSITORY = "fbincon/claude-code-statusline"
GITHUB = f"https://github.com/{REPOSITORY}"
RAW_GITHUB = f"https://raw.githubusercontent.com/{REPOSITORY}"
TAG = re.compile(r"v\d+\.\d+\.\d+(?:(?:a|b|rc)\d+)?\Z")


def local_destination(target: str, source: str) -> tuple[str, str]:
    """Resolve a repository destination and retain its query and fragment."""
    parsed = urlsplit(target)
    path = unquote(parsed.path)
    if not path:
        destination = source
    elif path.startswith("/"):
        destination = posixpath.normpath(path.lstrip("/"))
    else:
        destination = posixpath.normpath(
            posixpath.join(posixpath.dirname(source), path)
        )
    if destination == ".." or destination.startswith("../"):
        raise ValueError(f"Markdown destination leaves the repository: {target}")
    suffix = ("?" + parsed.query if parsed.query else "") + (
        "#" + quote(unquote(parsed.fragment), safe="-._~") if parsed.fragment else ""
    )
    return quote(destination, safe="/-._~"), suffix


def _destination(line: str, start: int) -> tuple[int, int] | None:
    while start < len(line) and line[start].isspace():
        start += 1
    if start >= len(line):
        return None
    if line[start] == "<":
        end = line.find(">", start + 1)
        return (start + 1, end) if end >= 0 else None
    end, depth = start, 0
    while end < len(line):
        character = line[end]
        if character == "\\":
            end += 2
            continue
        if character == "(":
            depth += 1
        elif character == ")":
            if not depth:
                break
            depth -= 1
        elif character.isspace() and not depth:
            break
        end += 1
    return (start, end) if end > start else None


def _label_start(line: str, end: int) -> int | None:
    depth = 1
    for index in range(end - 1, -1, -1):
        if index and line[index - 1] == "\\":
            continue
        if line[index] == "]":
            depth += 1
        elif line[index] == "[":
            depth -= 1
            if not depth:
                return index
    return None


def rewrite_links(markdown: str, rewrite) -> str:
    """Rewrite inline/reference links and HTML href/src outside code spans."""
    image_references = {
        (match[2] or match[1]).strip().casefold()
        for match in re.finditer(r"!\[([^\]\n]*)\]\[([^\]\n]*)\]", markdown)
    }
    lines, fence = [], None
    for line in markdown.splitlines(keepends=True):
        marker = re.match(r"^ {0,3}(`{3,}|~{3,})", line)
        if fence:
            lines.append(line)
            if marker and marker[1][0] == fence[0] and len(marker[1]) >= len(fence):
                fence = None
            continue
        if marker:
            fence = marker[1]
            lines.append(line)
            continue
        masked = line
        for code in re.finditer(r"(`+)(?!`)(.*?)\1(?!`)", line):
            masked = masked[: code.start()] + " " * len(code[0]) + masked[code.end() :]
        spans = []
        for match in re.finditer(r"\]\(", masked):
            label = _label_start(masked, match.start())
            destination = _destination(masked, match.end())
            if label is not None and destination:
                spans.append((*destination, label > 0 and masked[label - 1] == "!"))
        reference = re.match(r"^ {0,3}\[([^\]\n]+)\]:\s*", masked)
        if reference and (destination := _destination(masked, reference.end())):
            spans.append(
                (*destination, reference[1].strip().casefold() in image_references)
            )
        for match in re.finditer(r"\b(href|src)\s*=\s*([\"'])(.*?)\2", masked, re.I):
            spans.append((match.start(3), match.end(3), match[1].lower() == "src"))
        cursor, rewritten = 0, []
        for start, end, is_image in sorted(set(spans)):
            if start < cursor:
                continue
            rewritten.extend((line[cursor:start], rewrite(line[start:end], is_image)))
            cursor = end
        rewritten.append(line[cursor:])
        lines.append("".join(rewritten))
    return "".join(lines)


def pypi_readme(markdown: str, version: str) -> str:
    """Give package metadata fixed-tag GitHub links; leave source Markdown intact."""
    tag = "v" + version
    if not TAG.fullmatch(tag):
        raise ValueError(f"Unsupported package version: {version}")

    def rewrite(target, is_image):
        if not target or urlsplit(target).scheme or target.startswith("//"):
            return target
        path, suffix = local_destination(target, "README.md")
        base = f"{RAW_GITHUB}/{tag}" if is_image else f"{GITHUB}/blob/{tag}"
        return f"{base}/{path}{suffix}"

    return rewrite_links(markdown, rewrite)
