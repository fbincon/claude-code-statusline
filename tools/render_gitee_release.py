"""Render Gitee Release notes from public GitHub metadata and actual Gitee assets.

This command reads local JSON and writes Markdown only. Platform writes and
attachment integrity checks belong to the maintainer synchronization procedure.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import re
from urllib.parse import quote, unquote, urlsplit

if __package__:
    from .markdown_links import (
        GITHUB,
        RAW_GITHUB,
        REPOSITORY,
        TAG,
        local_destination,
        rewrite_links,
    )
else:
    from markdown_links import (
        GITHUB,
        RAW_GITHUB,
        REPOSITORY,
        TAG,
        local_destination,
        rewrite_links,
    )

GITEE = f"https://gitee.com/{REPOSITORY}"


def require(condition, message):
    if not condition:
        raise ValueError(message)


def asset_catalog(releases):
    catalog = {}
    for release in releases:
        tag = release["tag_name"]
        require(TAG.fullmatch(tag), f"Unexpected Gitee tag: {tag}")
        for asset in release["assets"]:
            name = asset["name"]
            if not (
                name.endswith(".whl")
                or name == "SHA256SUMS"
                or name.endswith(".tar.gz")
            ):
                continue
            url = asset["browser_download_url"]
            # Gitee also exposes automatic source archives, which are not package assets.
            if "/archive/" in urlsplit(url).path:
                continue
            expected = f"{GITEE}/releases/download/{quote(tag, safe='')}/{quote(name, safe='')}"
            require(url == expected, f"Unexpected Gitee asset URL: {tag}/{name}")
            key = (tag, name)
            require(key not in catalog, f"Duplicate Gitee asset: {tag}/{name}")
            catalog[key] = url
    return catalog


def render(tag, source, releases):
    require(TAG.fullmatch(tag), "Use an exact version tag")
    require(
        source["tag_name"] == tag and not source.get("draft", False),
        "Source tag differs or is unpublished",
    )
    targets = [release for release in releases if release["tag_name"] == tag]
    require(len(targets) == 1, "Gitee target Release is missing or duplicated")
    require(
        targets[0]["prerelease"] == source["prerelease"], "Prerelease status differs"
    )
    catalog = asset_catalog(releases)
    names = [asset["name"] for asset in source["assets"]]
    wheels = [name for name in names if name.endswith(".whl")]
    sdists = [name for name in names if name.endswith(".tar.gz")]
    require(
        len(names) == len(set(names)) == 3
        and len(wheels) == len(sdists) == 1
        and "SHA256SUMS" in names,
        "Source must contain one wheel, one sdist and SHA256SUMS",
    )
    version = tag[1:]
    prefix = wheels[0].removesuffix(f"-{version}-py3-none-any.whl")
    require(
        prefix in {"claude_code_statusline", "fbincon_claude_code_statusline"}
        and wheels[0] == f"{prefix}-{version}-py3-none-any.whl"
        and sdists[0] == f"{prefix}-{version}.tar.gz",
        "Package asset identity differs",
    )
    for name in names:
        require((tag, name) in catalog, f"Missing matching Gitee asset: {tag}/{name}")
    wheel_url = catalog[tag, wheels[0]]
    wheel_path = "./" + wheels[0]

    def rewrite(target, is_image=False):
        if not target or target.startswith("#"):
            return target
        if target.startswith(GITHUB + "/releases/download/"):
            rest = unquote(target.removeprefix(GITHUB + "/releases/download/"))
            ref, _, name = rest.partition("/")
            require(
                (ref, name) in catalog, f"Missing matching Gitee asset: {ref}/{name}"
            )
            return catalog[ref, name]
        for base, route in (
            (GITHUB + "/blob/", "blob"),
            (GITHUB + "/raw/", "raw"),
            (RAW_GITHUB + "/", "raw"),
        ):
            if target.startswith(base):
                rest = target.removeprefix(base)
                ref, separator, path = rest.partition("/")
                require(
                    separator and (ref == "main" or TAG.fullmatch(ref)),
                    f"Unsupported documentation ref: {ref}",
                )
                return f"{GITEE}/{route}/{ref}/{path}"
        if target == GITHUB + "/releases" or target.startswith(
            GITHUB + "/releases/tag/"
        ):
            return target.replace(GITHUB, GITEE, 1)
        if urlsplit(target).scheme or target.startswith("//"):
            return target
        path, suffix = local_destination(target, f"docs/releases/{tag}.md")
        return f"{GITEE}/{'raw' if is_image else 'blob'}/{tag}/{path}{suffix}"

    body = rewrite_links(source["body"], rewrite)
    # Commands are deliberately excluded from generic Markdown rewriting.
    body = re.sub(
        re.escape(GITHUB) + r"/releases/download/[^\s\"'`<>]+",
        lambda match: rewrite(match[0]),
        body,
    )
    body = re.sub(
        r"git\+https://github\.com/fbincon/claude-code-statusline\.git@([^\s\"'`<>]+)",
        lambda match: f"git+{GITEE}.git@{match[1]}",
        body,
    )
    body = re.sub(
        r"\bpipx\s+(?:install|upgrade)\s+(?:--force\s+)?(?:fbincon-)?claude-code-statusline(?![\w-])",
        f'pipx install --force "{wheel_path}"',
        body,
    )

    def local_install(match):
        url = match[3]
        require(url in catalog.values(), "Unknown Gitee wheel installation URL")
        name = unquote(url.rsplit("/", 1)[1])
        return f'{match[1]} "./{name}"'

    body = re.sub(
        r"(\bpipx\s+install(?:\s+--force)?)\s+([\"']?)("
        + re.escape(GITEE)
        + r"/releases/download/[^\s\"'`<>]+\.whl)\2",
        local_install,
        body,
    )
    download = (
        f"> Download [{wheels[0]}]({wheel_url}) and "
        f"[SHA256SUMS]({catalog[tag, 'SHA256SUMS']}) from Gitee, verify the checksum, "
        "then run the wheel installation commands from the download directory. "
        "Gitee can reject direct pip/pipx URL downloads with HTTP 403.\n"
        "> 从 Gitee 下载上述 wheel 和 SHA256SUMS，核验校验和后，在下载目录运行 "
        "wheel 安装命令。Gitee 可能对 pip／pipx 直接 URL 下载返回 HTTP 403。\n\n"
    )
    if body.startswith("# ") and "\n" in body:
        heading, remainder = body.split("\n", 1)
        body = heading + "\n\n" + download + remainder.lstrip("\n")
    else:
        body = download + body
    source_url = f"{GITHUB}/releases/tag/{tag}"
    require(source.get("html_url") == source_url, "Original GitHub Release URL differs")
    published = source["published_at"]
    require(
        isinstance(published, str)
        and not any(character in published for character in "\r\n"),
        "Missing original publication time",
    )
    assets = "\n".join(f"[{name}]({catalog[tag, name]})" for name in names)
    return (
        body.rstrip()
        + f'''\n\n## Gitee installation and downloads / Gitee 安装与下载

Install or update this exact version / 安装或更新至此固定版本：

Download the wheel and SHA256SUMS using the Gitee links below, verify the checksum, and run from the download directory. / 从下方 Gitee 链接下载 wheel 和 SHA256SUMS，核验后在下载目录执行。

```text
pipx install --force "{wheel_path}"
pipx ensurepath
claude-statusline install --dry-run
claude-statusline install
claude-statusline doctor
```

Verify the downloaded package against SHA256SUMS before installation. Restart Claude Code after integration; on Windows use `claude-statusline.exe`. For package-name migration, follow this version's migration instructions above.

安装前按 SHA256SUMS 核验下载文件。接入后重启 Claude Code；Windows 使用 `claude-statusline.exe`。涉及分发名称迁移时，先按上文的对应版本说明操作。

{assets}

## Original publication / 原始发布信息

[Original GitHub Release / GitHub 原始发行版]({source_url})

Original GitHub publication time / GitHub 原始发布时间: {published}
'''
    )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--tag", required=True)
    parser.add_argument("--github-release-json", type=Path, required=True)
    parser.add_argument("--gitee-releases-json", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    try:
        source = json.loads(args.github_release_json.read_text(encoding="utf-8"))
        releases = json.loads(args.gitee_releases_json.read_text(encoding="utf-8"))
        notes = render(args.tag, source, releases)
    except (ValueError, KeyError, TypeError) as error:
        parser.exit(1, f"Cannot render Gitee Release: {error}\n")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(notes, encoding="utf-8")
    print(f"Rendered {args.tag}: {args.output}")


if __name__ == "__main__":
    main()
