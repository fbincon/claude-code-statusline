"""Release identity, integrity and successful-CI gates without network writes."""

from __future__ import annotations

import hashlib
import io
import json
from pathlib import Path
import tarfile
import tempfile
from types import SimpleNamespace
import unittest
from unittest import mock
from urllib.error import HTTPError
from urllib.request import Request
import zipfile

from tools import publish_package as publish


class DistributionTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.directory = Path(temporary.name)
        self.version = "1.7.4"

    def distributions(
        self, *, wheel_name=None, wheel_version=None, sdist_name=None, entry=None
    ):
        info = f"{publish.FILE_PREFIX}-{self.version}"

        def metadata(name, version):
            return (
                f"Metadata-Version: 2.4\nName: {name}\nVersion: {version}\n"
                "Description-Content-Type: text/markdown\n\n# Description\n"
            ).encode("utf-8")

        wheel, sdist = publish.filenames(self.version)
        with zipfile.ZipFile(self.directory / wheel, "w") as archive:
            archive.writestr(
                f"{info}.dist-info/METADATA",
                metadata(
                    wheel_name or publish.DISTRIBUTION, wheel_version or self.version
                ),
            )
            archive.writestr(
                f"{info}.dist-info/WHEEL",
                "Wheel-Version: 1.0\nRoot-Is-Purelib: true\nTag: py3-none-any\n",
            )
            archive.writestr(
                f"{info}.dist-info/entry_points.txt",
                "[console_scripts]\nclaude-statusline = "
                + (entry or "claude_statusline.cli:main")
                + "\n",
            )
            archive.writestr(
                "claude_statusline/_version.py", f'__version__ = "{self.version}"\n'
            )
        with tarfile.open(self.directory / sdist, "w:gz") as archive:
            raw = metadata(sdist_name or publish.DISTRIBUTION, self.version)
            member = tarfile.TarInfo(f"{info}/PKG-INFO")
            member.size = len(raw)
            archive.addfile(member, io.BytesIO(raw))
        self.checksums()

    def checksums(self):
        (self.directory / "SHA256SUMS").write_text(
            "".join(
                f"{hashlib.sha256((self.directory / name).read_bytes()).hexdigest()}  {name}\n"
                for name in publish.filenames(self.version)
            ),
            encoding="ascii",
        )

    def test_accepts_only_the_expected_packages_and_entry_point(self):
        self.distributions()
        result = publish.validate_distributions(self.directory, self.version)
        self.assertEqual(set(result), set(publish.filenames(self.version)))

    def test_wrong_distribution_names_versions_and_entry_points_fail(self):
        for values, reason in (
            ({"wheel_name": "claude-code-statusline"}, "distribution name"),
            ({"wheel_version": "1.7.3"}, "wheel version"),
            ({"sdist_name": "claude-code-statusline"}, "distribution name"),
            ({"entry": "foreign.cli:main"}, "entry point"),
        ):
            with self.subTest(values=values):
                self.distributions(**values)
                with self.assertRaisesRegex(publish.PublicationError, reason):
                    publish.validate_distributions(self.directory, self.version)

    def test_missing_extra_and_corrupt_assets_fail(self):
        self.distributions()
        wheel = self.directory / publish.filenames(self.version)[0]
        wheel.write_bytes(wheel.read_bytes() + b"corruption")
        with self.assertRaisesRegex(publish.PublicationError, "Checksum mismatch"):
            publish.validate_distributions(self.directory, self.version)
        self.distributions()
        extra = self.directory / "other.whl"
        extra.write_bytes(b"unexpected")
        with self.assertRaisesRegex(publish.PublicationError, "exactly"):
            publish.validate_distributions(self.directory, self.version)
        extra.unlink()
        wheel.unlink()
        with self.assertRaisesRegex(publish.PublicationError, "exactly"):
            publish.validate_distributions(self.directory, self.version)

    def test_checksum_manifest_rejects_paths_duplicates_and_missing_entries(self):
        self.distributions()
        path = self.directory / "SHA256SUMS"
        original = path.read_text(encoding="ascii")
        for body in (
            original.splitlines()[0] + "\n",
            original + original,
            "0" * 64 + "  ../escape.whl\n",
        ):
            with self.subTest(body=body):
                path.write_text(body, encoding="ascii")
                with self.assertRaises(publish.PublicationError):
                    publish.validate_distributions(self.directory, self.version)

    def test_exact_index_downloads_are_verified_before_installation(self):
        self.distributions()
        files = publish.validate_distributions(self.directory, self.version)
        evidence = {
            "distribution": publish.DISTRIBUTION,
            "version": self.version,
            "tag": "v1.7.4",
            "files": files,
        }
        proof = self.directory / "proof.json"
        proof.write_text(json.dumps(evidence), encoding="utf-8")
        assets = {
            name: {"url": f"https://files.pythonhosted.org/{name}"} for name in files
        }
        args = SimpleNamespace(
            target="testpypi",
            evidence=proof,
            dist=self.directory / "download",
            install=False,
        )
        payloads = {
            (value["url"]): (self.directory / name).read_bytes()
            for name, value in assets.items()
        }
        with (
            mock.patch.object(publish, "index_files", return_value=assets),
            mock.patch.object(
                publish,
                "urlopen",
                side_effect=lambda url, **kwargs: io.BytesIO(payloads[url]),
            ),
        ):
            publish.verify_index(args)
        self.assertEqual(publish.validate_distributions(args.dist, self.version), files)


class AcceptanceTests(unittest.TestCase):
    def test_existing_python_and_mod_prerelease_identifiers_remain_compatible(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / "src/claude_statusline").mkdir(parents=True)
            for python_version, mod_version in (
                ("1.7.4a1", "1.7.4-alpha.1"),
                ("1.7.4b2", "1.7.4-beta.2"),
                ("1.7.4rc3", "1.7.4-rc.3"),
            ):
                with self.subTest(version=python_version):
                    (root / "pyproject.toml").write_text(
                        f'[project]\nname = "{publish.DISTRIBUTION}"\nversion = "{python_version}"\n',
                        encoding="utf-8",
                    )
                    (root / "src/claude_statusline/_version.py").write_text(
                        f'__version__ = "{python_version}"\n', encoding="utf-8"
                    )
                    for name in ("statusline-native", "statusline-runtime"):
                        path = root / "mods" / name / ".claude-plugin/plugin.json"
                        path.parent.mkdir(parents=True, exist_ok=True)
                        path.write_text(
                            json.dumps({"version": mod_version}), encoding="utf-8"
                        )
                    self.assertEqual(
                        publish.project_identity(root)["version"], python_version
                    )
                    path.write_text(
                        json.dumps({"version": python_version}), encoding="utf-8"
                    )
                    with self.assertRaisesRegex(
                        publish.PublicationError, "version differs"
                    ):
                        publish.project_identity(root)

    def client(self, conclusion="success", count=13, *, latest_failed=False):
        run = {
            "id": 42,
            "head_sha": "a" * 40,
            "head_branch": "v1.7.4",
            "event": "push",
            "status": "completed",
            "conclusion": conclusion,
            "run_attempt": 2,
            "html_url": "https://github.com/fbincon/claude-code-statusline/actions/runs/42",
        }
        runs = [run]
        if latest_failed:
            runs.append(dict(run, id=43, conclusion="failure"))
        client = mock.Mock()
        client.pages.side_effect = lambda path, key: iter(
            runs if key == "workflow_runs" else [{"conclusion": "success"}] * count
        )
        return client

    def test_completed_matrix_is_required(self):
        result = publish.successful_run(
            self.client(), "ci.yml", "a" * 40, "v1.7.4", "push", 13
        )
        self.assertEqual(result["id"], 42)
        for client in (
            self.client("failure"),
            self.client(count=12),
            self.client(latest_failed=True),
        ):
            with (
                self.subTest(client=client),
                self.assertRaises(publish.PublicationError),
            ):
                publish.successful_run(client, "ci.yml", "a" * 40, "v1.7.4", "push", 13)

    def test_other_commits_refs_events_and_skipped_jobs_do_not_pass(self):
        for commit, branch, event in (
            ("b" * 40, "v1.7.4", "push"),
            ("a" * 40, "main", "push"),
            ("a" * 40, "v1.7.4", "pull_request"),
        ):
            with (
                self.subTest(branch=branch, event=event),
                self.assertRaises(publish.PublicationError),
            ):
                publish.successful_run(
                    self.client(), "ci.yml", commit, branch, event, 13
                )
        client = self.client()
        original = client.pages.side_effect
        client.pages.side_effect = lambda path, key: (
            original(path, key)
            if key == "workflow_runs"
            else iter([{"conclusion": "skipped"}] * 13)
        )
        with self.assertRaisesRegex(publish.PublicationError, "Incomplete"):
            publish.successful_run(client, "ci.yml", "a" * 40, "v1.7.4", "push", 13)

    def test_formal_release_requires_testpypi_acceptance_at_the_same_tag(self):
        client = mock.Mock()
        commit = "a" * 40
        client.get.return_value = {"merge_base_commit": {"sha": commit}}
        with (
            mock.patch.object(publish, "tag_commit", return_value=commit),
            mock.patch.object(
                publish, "successful_run", return_value={"id": 42}
            ) as check,
        ):
            publish.release_gates(client, "v1.7.4", commit, "pypi")
        self.assertEqual(check.call_count, 5)
        self.assertEqual(
            check.call_args.args[1:],
            ("publish.yml", commit, "v1.7.4", "workflow_dispatch", 8),
        )

    def test_unmerged_or_moved_tags_fail_before_acceptance_checks(self):
        client = mock.Mock()
        client.get.return_value = {"merge_base_commit": {"sha": "b" * 40}}
        for remote in ("a" * 40, "b" * 40):
            with (
                mock.patch.object(publish, "tag_commit", return_value=remote),
                mock.patch.object(publish, "successful_run") as check,
            ):
                with self.assertRaises(publish.PublicationError):
                    publish.release_gates(client, "v1.7.4", "a" * 40, "pypi")
                check.assert_not_called()

    def test_annotated_tag_is_peeled(self):
        client = mock.Mock()
        client.get.side_effect = [
            {"object": {"type": "tag", "sha": "a" * 40}},
            {"object": {"type": "commit", "sha": "b" * 40}},
        ]
        self.assertEqual(publish.tag_commit(client, "v1.7.4"), "b" * 40)

    def test_dispatching_on_main_is_rejected(self):
        args = SimpleNamespace(tag="v1.7.4", target="testpypi")
        with (
            mock.patch.object(
                publish, "project_identity", return_value={"version": "1.7.4"}
            ),
            mock.patch.dict(
                publish.os.environ, {"GITHUB_REF": "refs/heads/main"}, clear=True
            ),
        ):
            with self.assertRaisesRegex(publish.PublicationError, "exact version tag"):
                publish.prepare(args)

    def test_asset_redirect_drops_github_credentials(self):
        def opener(handler):
            request = Request(
                "https://api.github.com/repos/example",
                headers={"Authorization": "Bearer fixture-token"},
            )
            redirected = handler().redirect_request(
                request,
                None,
                302,
                "Found",
                {},
                "https://release-assets.githubusercontent.com/example",
            )
            self.assertFalse(redirected.has_header("Authorization"))
            with self.assertRaisesRegex(publish.PublicationError, "Insecure"):
                handler().redirect_request(
                    request, None, 302, "Found", {}, "http://example.com"
                )
            result = mock.MagicMock()
            result.open.return_value.__enter__.return_value = io.BytesIO(b"asset")
            return result

        with (
            tempfile.TemporaryDirectory() as temporary,
            mock.patch.object(publish, "build_opener", side_effect=opener),
        ):
            publish.GitHub("fixture-token").download(
                {
                    "id": 1,
                    "name": "asset",
                    "size": 5,
                    "digest": "sha256:" + hashlib.sha256(b"asset").hexdigest(),
                },
                Path(temporary) / "asset",
            )


class IndexTests(unittest.TestCase):
    def setUp(self):
        self.files = {
            name: {"sha256": "a" * 64, "size": 100}
            for name in publish.filenames("1.7.4")
        }
        self.evidence = {"version": "1.7.4", "files": self.files}
        self.data = {
            "info": {"name": publish.DISTRIBUTION, "version": "1.7.4"},
            "urls": [
                {
                    "filename": name,
                    "digests": {"sha256": value["sha256"]},
                    "size": value["size"],
                    "url": f"https://files.pythonhosted.org/{name}",
                }
                for name, value in self.files.items()
            ],
        }

    def test_only_identical_existing_files_can_be_skipped_on_retry(self):
        for field, value in (
            ("size", 99),
            ("digests", {"sha256": "b" * 64}),
            ("url", "https://foreign.example/package.whl"),
        ):
            data = json.loads(json.dumps(self.data))
            data["urls"][0][field] = value
            with (
                self.subTest(field=field),
                mock.patch.object(
                    publish,
                    "urlopen",
                    return_value=io.BytesIO(json.dumps(data).encode()),
                ),
            ):
                with self.assertRaises(publish.PublicationError):
                    publish.index_files("pypi", self.evidence, missing_ok=True)

    def test_partial_upload_can_resume_but_is_not_verified_as_complete(self):
        self.data["urls"].pop()
        with mock.patch.object(
            publish,
            "urlopen",
            side_effect=lambda *args, **kwargs: io.BytesIO(
                json.dumps(self.data).encode()
            ),
        ):
            self.assertEqual(
                len(publish.index_files("testpypi", self.evidence, missing_ok=True)), 1
            )
            with self.assertRaisesRegex(publish.PublicationError, "missing"):
                publish.index_files("testpypi", self.evidence)

    def test_only_a_404_means_the_version_is_unpublished(self):
        for code in (404, 403):
            error = HTTPError("https://pypi.org", code, "test", {}, None)
            with mock.patch.object(publish, "urlopen", side_effect=error):
                if code == 404:
                    self.assertEqual(
                        publish.index_files("pypi", self.evidence, missing_ok=True), {}
                    )
                else:
                    with self.assertRaises(HTTPError):
                        publish.index_files("pypi", self.evidence, missing_ok=True)
            error.close()


if __name__ == "__main__":
    unittest.main()
