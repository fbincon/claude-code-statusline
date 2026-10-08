"""Portable repository Markdown, fixed package links and Gitee Release rendering."""

from __future__ import annotations

import copy
import json
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import unittest
from urllib.parse import unquote

from tools.markdown_links import GITHUB, RAW_GITHUB, pypi_readme, rewrite_links
from tools.render_gitee_release import GITEE, render

ROOT = Path(__file__).resolve().parents[2]


def release(tag, body=""):
    version = tag[1:]
    prefix = (
        "fbincon_claude_code_statusline"
        if version in {"1.7.4", "1.7.5"}
        else "claude_code_statusline"
    )
    assets = [
        {
            "name": name,
            "browser_download_url": f"{GITEE}/releases/download/{tag}/{name}",
        }
        for name in (
            f"{prefix}-{version}-py3-none-any.whl",
            f"{prefix}-{version}.tar.gz",
            "SHA256SUMS",
        )
    ]
    source = {
        "tag_name": tag,
        "prerelease": bool(re.search(r"(?:a|b|rc)\d+$", version)),
        "draft": False,
        "body": body,
        "html_url": f"{GITHUB}/releases/tag/{tag}",
        "published_at": "2026-10-08T01:00:00Z",
        "assets": copy.deepcopy(assets),
    }
    target = {"tag_name": tag, "prerelease": source["prerelease"], "assets": assets}
    return source, target


class MarkdownTests(unittest.TestCase):
    def test_fixed_tag_links_images_fragments_and_titles(self):
        body = '[Guide](docs/USER_GUIDE.md#要求 "title") ![image](docs/a(1).png) [here](#features)'
        actual = pypi_readme(body, "1.7.5")
        self.assertIn(
            f'{GITHUB}/blob/v1.7.5/docs/USER_GUIDE.md#%E8%A6%81%E6%B1%82 "title"',
            actual,
        )
        self.assertIn(f"{RAW_GITHUB}/v1.7.5/docs/a%281%29.png", actual)
        self.assertIn(f"{GITHUB}/blob/v1.7.5/README.md#features", actual)

    def test_nested_badges_reference_images_and_html(self):
        body = '[![badge](docs/badge.svg)](docs/guide.md)\n![screenshot][photo]\n[photo]: <docs/my image.png> "caption"\n<a href="README.zh-CN.md">中文</a><img src="docs/a.png">\n'
        actual = pypi_readme(body, "1.7.5")
        self.assertIn(f"{RAW_GITHUB}/v1.7.5/docs/badge.svg", actual)
        self.assertIn(f"{GITHUB}/blob/v1.7.5/docs/guide.md", actual)
        self.assertIn(f'<{RAW_GITHUB}/v1.7.5/docs/my%20image.png> "caption"', actual)
        self.assertIn(f'href="{GITHUB}/blob/v1.7.5/README.zh-CN.md"', actual)
        self.assertIn(f'src="{RAW_GITHUB}/v1.7.5/docs/a.png"', actual)

    def test_commands_code_spans_and_external_links_are_unchanged(self):
        body = '`[literal](docs/a.md)`\n```text\npipx install "git+https://github.com/fbincon/claude-code-statusline.git@main"\n[example](docs/b.md)\n```\n~~~md\n[another](docs/c.md)\n~~~\n[external](https://example.com/a) [mail](mailto:user@example.com)\n'
        self.assertEqual(pypi_readme(body, "1.7.5"), body)

    def test_relative_escape_and_invalid_version_are_rejected(self):
        with self.assertRaises(ValueError):
            pypi_readme("[outside](../secret)", "1.7.5")
        with self.assertRaises(ValueError):
            pypi_readme("[doc](docs/a.md)", "../../main")

    def test_conversion_is_idempotent_and_source_is_unchanged(self):
        before = (ROOT / "README.md").read_bytes()
        rendered = pypi_readme(before.decode("utf-8"), "1.7.5")
        self.assertEqual(pypi_readme(rendered, "1.7.5"), rendered)
        self.assertEqual((ROOT / "README.md").read_bytes(), before)
        self.assertNotIn(GITEE, rendered)

    def test_only_destinations_change(self):
        body = '[nested [label]](docs/a.md "a title") and `[code](docs/a.md)`'
        self.assertEqual(
            rewrite_links(body, lambda target, image: "new"),
            '[nested [label]](new "a title") and `[code](docs/a.md)`',
        )


class GiteeNotesTests(unittest.TestCase):
    def test_all_repository_release_bodies(self):
        pages = list((ROOT / "docs/releases").glob("v*.md"))
        sources, targets = [], []
        for page in pages:
            source, target = release(page.stem, page.read_text(encoding="utf-8"))
            sources.append(source)
            targets.append(target)
        for source in sources:
            with self.subTest(tag=source["tag_name"]):
                notes = render(source["tag_name"], source, targets)
                self.assertNotIn(GITHUB + "/releases/download/", notes)
                self.assertEqual(notes.count("## Gitee installation and downloads"), 1)
                self.assertIn("简体中文", notes)

    def test_relative_docs_resolve_from_release_file(self):
        source, target = release(
            "v1.7.2", "[guide](../USER_GUIDE.zh-CN.md#安装与接入) [English](#english)"
        )
        notes = render("v1.7.2", source, [target])
        self.assertIn(
            f"{GITEE}/blob/v1.7.2/docs/USER_GUIDE.zh-CN.md#安装与接入", unquote(notes)
        )
        self.assertIn("[English](#english)", notes)

    def test_commands_use_actual_assets_and_preserve_git_refs(self):
        source, target = release(
            "v1.7.5",
            '```text\npipx upgrade fbincon-claude-code-statusline\npipx install "git+https://github.com/fbincon/claude-code-statusline.git@v1.7.5"\npipx uninstall claude-code-statusline\n```',
        )
        notes = render("v1.7.5", source, [target])
        self.assertIn(
            f'pipx install --force "./{target["assets"][0]["name"]}"',
            notes,
        )
        self.assertIn(f"git+{GITEE}.git@v1.7.5", notes)
        self.assertIn("pipx uninstall claude-code-statusline", notes)

    def test_download_link_retained_but_pipx_installs_local_wheel(self):
        source, target = release("v1.7.2")
        name = source["assets"][0]["name"]
        source["body"] = (
            f'# v1.7.2\n\n```text\npipx install --force "{GITHUB}/releases/download/v1.7.2/{name}"\n```\n'
        )
        notes = render("v1.7.2", source, [target])
        self.assertTrue(notes.startswith("# v1.7.2\n"))
        self.assertIn(f'pipx install --force "./{name}"', notes)
        self.assertIn(target["assets"][0]["browser_download_url"], notes)
        self.assertIn("download directory", notes)
        self.assertNotIn(f'pipx install --force "{GITEE}/', notes)

    def test_keep_github_workflows_issues_and_original_provenance(self):
        source, target = release(
            "v1.7.2",
            f"[CI]({GITHUB}/actions/runs/42) [issues]({GITHUB}/issues) [doc]({GITHUB}/blob/main/README.md)",
        )
        notes = render("v1.7.2", source, [target])
        self.assertIn(f"{GITHUB}/actions/runs/42", notes)
        self.assertIn(f"{GITHUB}/issues", notes)
        self.assertIn(f"{GITEE}/blob/main/README.md", notes)
        self.assertIn(source["html_url"], notes)
        self.assertIn(source["published_at"], notes)

    def test_missing_asset_duplicate_target_and_prerelease_mismatch(self):
        source, target = release("v1.7.0a1")
        for changed in (
            [],
            [target, target],
            [{**target, "assets": target["assets"][:-1]}],
            [{**target, "prerelease": False}],
        ):
            with self.subTest(changed=changed), self.assertRaises(ValueError):
                render("v1.7.0a1", source, changed)

    def test_wrong_identity_tag_url_and_unpublished_source(self):
        source, target = release("v1.7.5")
        for changed in (
            {**source, "tag_name": "v1.7.4"},
            {**source, "draft": True},
            {**source, "html_url": "https://example.com/release"},
            {**source, "assets": [{"name": "foreign.whl"}, *source["assets"][1:]]},
        ):
            with self.subTest(changed=changed), self.assertRaises(ValueError):
                render("v1.7.5", changed, [target])
        invalid = copy.deepcopy(target)
        invalid["assets"][0]["browser_download_url"] = "https://example.com/foreign.whl"
        with self.assertRaises(ValueError):
            render("v1.7.5", source, [invalid])

    def test_cross_version_asset_requires_matching_release(self):
        source, target = release("v1.7.2")
        earlier, earlier_target = release("v1.7.1")
        name = earlier["assets"][0]["name"]
        source["body"] = f"[previous]({GITHUB}/releases/download/v1.7.1/{name})"
        with self.assertRaises(ValueError):
            render("v1.7.2", source, [target])
        self.assertIn(
            earlier_target["assets"][0]["browser_download_url"],
            render("v1.7.2", source, [target, earlier_target]),
        )

    def test_repeat_render_retains_source_and_release_metadata(self):
        source, target = release(
            "v1.7.0a1", "Old package and support claims remain here."
        )
        before = copy.deepcopy((source, target))
        first = render("v1.7.0a1", source, [target])
        self.assertEqual(render("v1.7.0a1", source, [target]), first)
        self.assertEqual((source, target), before)
        self.assertIn(source["body"], first)

    def test_cli_rejects_missing_assets_before_overwriting_output(self):
        source, target = release("v1.7.5")
        target["assets"] = target["assets"][:-1]
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "source.json").write_text(json.dumps(source), encoding="utf-8")
            (root / "targets.json").write_text(json.dumps([target]), encoding="utf-8")
            output = root / "notes.md"
            output.write_text("Previous reviewed notes\n", encoding="utf-8")
            result = subprocess.run(
                [
                    sys.executable,
                    str(ROOT / "tools/render_gitee_release.py"),
                    "--tag",
                    "v1.7.5",
                    "--github-release-json",
                    str(root / "source.json"),
                    "--gitee-releases-json",
                    str(root / "targets.json"),
                    "--output",
                    str(output),
                ],
                capture_output=True,
                text=True,
            )
            self.assertEqual(result.returncode, 1)
            self.assertIn("Missing matching Gitee asset", result.stderr)
            self.assertEqual(
                output.read_text(encoding="utf-8"), "Previous reviewed notes\n"
            )


if __name__ == "__main__":
    unittest.main()
