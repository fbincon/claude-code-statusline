"""Verify fixed GitHub Release assets before tokenless package publication."""

from __future__ import annotations

import argparse
import configparser
import email
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile
import time
from urllib.error import HTTPError
from urllib.parse import quote, urlencode, urlparse
from urllib.request import HTTPRedirectHandler, Request, build_opener, urlopen
import zipfile

REPOSITORY = "fbincon/claude-code-statusline"
DISTRIBUTION = "fbincon-claude-code-statusline"
FILE_PREFIX = DISTRIBUTION.replace("-", "_")
ROOT = Path(__file__).resolve().parents[1]
INDEX_HOSTS = {"testpypi": "test.pypi.org", "pypi": "pypi.org"}
TAG = re.compile(r"v(\d+\.\d+\.\d+(?:(?:a|b|rc)\d+)?)\Z")
SHA256 = re.compile(r"[0-9a-f]{64}\Z")


class PublicationError(ValueError):
    """A release failed an identity, integrity or acceptance gate."""


class IndexNotReady(PublicationError):
    """A newly uploaded version is not fully visible in the index yet."""


def require(condition, message):
    if not condition:
        raise PublicationError(message)


def version_for(tag):
    match = TAG.fullmatch(tag)
    require(match is not None, "Use an exact version tag, such as v1.7.4")
    return match[1]


def filenames(version):
    return (
        f"{FILE_PREFIX}-{version}-py3-none-any.whl",
        f"{FILE_PREFIX}-{version}.tar.gz",
    )


def project_identity(root=ROOT):
    body = (root / "pyproject.toml").read_text(encoding="utf-8")
    section = re.search(r"(?ms)^\[project\]\s*\n(.*?)(?=^\[|\Z)", body)
    require(section is not None, "Missing project metadata")
    result = {}
    for field in ("name", "version"):
        match = re.search(rf'^\s*{field} = "([^"\n]+)"$', section[1], re.M)
        require(match is not None, f"Missing static project {field}")
        result[field] = match[1]
    require(result["name"] == DISTRIBUTION, "Unexpected project distribution name")
    version_source = (root / "src/claude_statusline/_version.py").read_text(
        encoding="utf-8"
    )
    require(
        f'__version__ = "{result["version"]}"' in version_source,
        "Python metadata and runtime versions differ",
    )
    version_match = re.fullmatch(
        r"(\d+\.\d+\.\d+)(?:(a|b|rc)(\d+))?", result["version"]
    )
    require(version_match is not None, "Unsupported backend release version")
    base, stage, number = version_match.groups()
    mod_version = base + (
        "-" + {"a": "alpha", "b": "beta", "rc": "rc"}[stage] + "." + number
        if stage
        else ""
    )
    for name in ("statusline-native", "statusline-runtime"):
        manifest = json.loads(
            (root / "mods" / name / ".claude-plugin/plugin.json").read_text(
                encoding="utf-8"
            )
        )
        require(manifest["version"] == mod_version, f"{name} version differs")
    return result


def validate_distributions(directory, version):
    """Verify package metadata and the two exact files named by SHA256SUMS."""
    expected = filenames(version)
    entries = (directory / "SHA256SUMS").read_text(encoding="ascii").splitlines()
    digests = {}
    for line in entries:
        match = re.fullmatch(r"([0-9a-f]{64})  ([A-Za-z0-9_.-]+)", line)
        require(match is not None, "Invalid SHA256SUMS entry")
        digest, name = match.groups()
        require(
            name in expected and name not in digests, "Unexpected checksum filename"
        )
        digests[name] = digest
    require(set(digests) == set(expected), "SHA256SUMS must name both distributions")
    require(
        {p.name for p in directory.iterdir()} == {*expected, "SHA256SUMS"},
        "Release assets must contain exactly the wheel, sdist and SHA256SUMS",
    )
    sizes = {}
    for name, digest in digests.items():
        path = directory / name
        require(
            path.is_file() and not path.is_symlink(), f"Missing regular asset: {name}"
        )
        raw = path.read_bytes()
        require(hashlib.sha256(raw).hexdigest() == digest, f"Checksum mismatch: {name}")
        sizes[name] = len(raw)

    info = f"{FILE_PREFIX}-{version}.dist-info"
    with zipfile.ZipFile(directory / expected[0]) as archive:
        metadata = email.message_from_bytes(archive.read(f"{info}/METADATA"))
        wheel = email.message_from_bytes(archive.read(f"{info}/WHEEL"))
        entry_points = configparser.ConfigParser()
        entry_points.read_string(
            archive.read(f"{info}/entry_points.txt").decode("utf-8")
        )
        require(
            entry_points.get("console_scripts", "claude-statusline", fallback="")
            == "claude_statusline.cli:main",
            "Unexpected console entry point",
        )
        require(wheel["Root-Is-Purelib"] == "true", "Expected a pure Python wheel")
        require("py3-none-any" in wheel.get_all("Tag", []), "Unexpected wheel platform")
        require(
            archive.read("claude_statusline/_version.py").decode("utf-8").strip()
            == f'__version__ = "{version}"',
            "Wheel runtime version differs",
        )
    with tarfile.open(directory / expected[1], "r:gz") as archive:
        member = archive.extractfile(f"{FILE_PREFIX}-{version}/PKG-INFO")
        require(member is not None, "Missing source distribution metadata")
        sdist_metadata = email.message_from_bytes(member.read())
    for label, value in (("wheel", metadata), ("sdist", sdist_metadata)):
        require(value["Name"] == DISTRIBUTION, f"Wrong {label} distribution name")
        require(value["Version"] == version, f"Wrong {label} version")
        require(
            value["Description-Content-Type"] == "text/markdown",
            f"Unexpected {label} long description format",
        )
    return {name: {"sha256": digests[name], "size": sizes[name]} for name in expected}


class GitHub:
    """Use the workflow's read-only token; never send it to index/CDN hosts."""

    def __init__(self, token, repository=REPOSITORY):
        require(repository == REPOSITORY, "Unexpected GitHub repository")
        self.token = token
        self.base = f"https://api.github.com/repos/{repository}"

    def get(self, path):
        request = Request(
            self.base + path,
            headers={
                "Accept": "application/vnd.github+json",
                "Authorization": f"Bearer {self.token}",
                "X-GitHub-Api-Version": "2022-11-28",
                "User-Agent": DISTRIBUTION,
            },
        )
        with urlopen(request, timeout=60) as response:
            return json.load(response)

    def pages(self, path, key=None):
        page = 1
        separator = "&" if "?" in path else "?"
        while True:
            response = self.get(f"{path}{separator}per_page=100&page={page}")
            values = response[key] if key is not None else response
            yield from values
            if len(values) < 100:
                return
            page += 1

    def download(self, asset, destination):
        class WithoutCredentials(HTTPRedirectHandler):
            def redirect_request(self, request, fp, code, message, headers, newurl):
                require(
                    urlparse(newurl).scheme == "https", "Insecure download redirect"
                )
                redirected = super().redirect_request(
                    request, fp, code, message, headers, newurl
                )
                if redirected is not None:
                    redirected.remove_header("Authorization")
                return redirected

        request = Request(
            self.base + f"/releases/assets/{asset['id']}",
            headers={
                "Accept": "application/octet-stream",
                "Authorization": f"Bearer {self.token}",
            },
        )
        with build_opener(WithoutCredentials).open(request, timeout=60) as response:
            destination.write_bytes(response.read())
        raw = destination.read_bytes()
        require(len(raw) == asset["size"], f"Download size differs: {asset['name']}")
        if asset.get("digest") is not None:
            require(
                asset["digest"] == "sha256:" + hashlib.sha256(raw).hexdigest(),
                f"GitHub asset digest differs: {asset['name']}",
            )


def tag_commit(client, tag):
    obj = client.get("/git/ref/tags/" + quote(tag, safe=""))["object"]
    for _ in range(8):
        if obj["type"] == "commit":
            return obj["sha"]
        require(obj["type"] == "tag", "Tag does not point to a commit")
        obj = client.get("/git/tags/" + obj["sha"])["object"]
    raise PublicationError("Excessively nested annotated tag")


def successful_run(client, workflow, commit, branch, event, minimum_jobs):
    query = urlencode({"head_sha": commit, "event": event})
    runs = [
        run
        for run in client.pages(
            f"/actions/workflows/{workflow}/runs?{query}", "workflow_runs"
        )
        if run["head_sha"] == commit
        and run["head_branch"] == branch
        and run["event"] == event
    ]
    require(runs, f"Missing {workflow} run for {branch} at {commit}")
    run = max(runs, key=lambda item: item["id"])
    require(
        run["status"] == "completed" and run["conclusion"] == "success",
        f"{workflow} has not passed for {branch}: {run['html_url']}",
    )
    jobs = list(
        client.pages(
            f"/actions/runs/{run['id']}/attempts/{run['run_attempt']}/jobs", "jobs"
        )
    )
    require(
        len(jobs) >= minimum_jobs
        and all(job["conclusion"] == "success" for job in jobs),
        f"Incomplete successful job matrix: {run['html_url']}",
    )
    return {"id": run["id"], "attempt": run["run_attempt"], "url": run["html_url"]}


def release_gates(client, tag, commit, target):
    require(tag_commit(client, tag) == commit, "Checkout and remote tag commits differ")
    comparison = client.get(f"/compare/{commit}...main")
    require(
        comparison["merge_base_commit"]["sha"] == commit,
        "Release commit is not on main",
    )
    ci = {}
    for workflow, count in (("ci.yml", 13), ("native.yml", 7)):
        for branch in ("main", tag):
            ci[f"{workflow}:{branch}"] = successful_run(
                client, workflow, commit, branch, "push", count
            )
    if target == "pypi":
        ci["testpypi"] = successful_run(
            client, "publish.yml", commit, tag, "workflow_dispatch", 9
        )
    return ci


def release_for_tag(client, tag):
    # The tag endpoint returns published releases only, even for their owner.
    # Authenticated release listings also include drafts visible to this actor.
    matches = [
        release for release in client.pages("/releases") if release["tag_name"] == tag
    ]
    require(len(matches) == 1, "Expected one visible Release for the exact tag")
    return matches[0]


def index_files(target, evidence, missing_ok=False):
    host = INDEX_HOSTS[target]
    url = f"https://{host}/pypi/{DISTRIBUTION}/{evidence['version']}/json"
    try:
        with urlopen(url, timeout=60) as response:
            data = json.load(response)
    except HTTPError as error:
        if error.code == 404 and missing_ok:
            error.close()
            return {}
        raise
    require(data["info"]["name"] == DISTRIBUTION, "Index project name differs")
    require(data["info"]["version"] == evidence["version"], "Index version differs")
    result = {}
    for asset in data["urls"]:
        name = asset["filename"]
        require(
            name in evidence["files"] and name not in result, "Unexpected index file"
        )
        expected = evidence["files"][name]
        require(
            asset["digests"]["sha256"] == expected["sha256"],
            f"Index digest differs: {name}",
        )
        require(asset["size"] == expected["size"], f"Index size differs: {name}")
        parsed = urlparse(asset["url"])
        require(
            parsed.scheme == "https"
            and parsed.hostname
            in {"files.pythonhosted.org", "test-files.pythonhosted.org"}
            and parsed.username is None
            and parsed.password is None,
            "Unexpected package download host",
        )
        result[name] = asset
    if not missing_ok:
        if set(result) != set(evidence["files"]):
            raise IndexNotReady("Index is missing a distribution")
    return result


def wait_for_index(target, evidence, timeout=180):
    """Poll incomplete/404 reads; reject integrity and permission errors immediately."""
    deadline = time.monotonic() + timeout
    while True:
        try:
            return index_files(target, evidence)
        except HTTPError as error:
            if error.code != 404:
                raise
            error.close()
        except IndexNotReady:
            pass
        remaining = deadline - time.monotonic()
        require(
            remaining > 0,
            f"{target} version {evidence['version']} did not become visible within {timeout}s",
        )
        print(f"Waiting for {target} version {evidence['version']} index visibility...")
        time.sleep(min(5, remaining))


def release_context(args):
    version = version_for(args.tag)
    require(
        project_identity()["version"] == version, "Checkout and tag versions differ"
    )
    require(
        os.environ.get("GITHUB_REPOSITORY", REPOSITORY) == REPOSITORY,
        "Unexpected workflow repository",
    )
    require(
        os.environ.get("GITHUB_REF", f"refs/tags/{args.tag}")
        == f"refs/tags/{args.tag}",
        "Dispatch the workflow on the exact version tag, not main",
    )
    token = os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN")
    require(token, "A scoped GitHub token is required")
    client = GitHub(token)
    commit = subprocess.check_output(
        ["git", "rev-parse", "HEAD"], cwd=ROOT, text=True
    ).strip()
    ci = release_gates(client, args.tag, commit, args.target)
    release = release_for_tag(client, args.tag)
    require(release["tag_name"] == args.tag, "Release tag differs")
    prerelease = bool(re.search(r"(?:a|b|rc)\d+$", version))
    require(
        release["prerelease"] == prerelease,
        "Release prerelease flag and version differ",
    )
    if args.target == "pypi":
        require(
            not release["draft"],
            "Formal publication requires a published GitHub Release",
        )
    assets = {asset["name"]: asset for asset in release["assets"]}
    require(
        len(assets) == len(release["assets"])
        and set(assets) == {*filenames(version), "SHA256SUMS"},
        "Release is missing an asset or contains unexpected filenames",
    )
    return client, commit, version, ci, release


def fetch(args):
    # GitHub hides draft listings from the read-only Actions actor. This task
    # uses a short-lived Contents:write token solely for authenticated GETs;
    # it neither installs dependencies nor builds/executes distribution code.
    client, commit, version, ci, release = release_context(args)
    directory = args.assets / "artifacts"
    directory.mkdir(parents=True, exist_ok=True)
    require(not any(directory.iterdir()), "Use an empty asset download directory")
    for asset in release["assets"]:
        client.download(asset, directory / asset["name"])
    files = validate_distributions(directory, version)
    receipt = {
        "commit": commit,
        "release": {
            key: release[key] for key in ("id", "tag_name", "draft", "prerelease")
        },
        "files": files,
        "ci": ci,
    }
    (args.assets / "release.json").write_text(
        json.dumps(receipt, indent=2) + "\n", encoding="utf-8"
    )
    print(f"Downloaded and verified {args.tag} assets from Release {release['id']}.")


def prepare(args):
    version = version_for(args.tag)
    require(
        project_identity()["version"] == version, "Checkout and tag versions differ"
    )
    require(
        os.environ.get("GITHUB_REF", f"refs/tags/{args.tag}")
        == f"refs/tags/{args.tag}",
        "Dispatch on the exact version tag",
    )
    token = os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN")
    require(token, "A read-only GitHub token is required")
    client = GitHub(token)
    commit = subprocess.check_output(
        ["git", "rev-parse", "HEAD"], cwd=ROOT, text=True
    ).strip()
    ci = release_gates(client, args.tag, commit, args.target)
    receipt = json.loads((args.assets / "release.json").read_text(encoding="utf-8"))
    release = receipt["release"]
    require(
        receipt["commit"] == commit and release["tag_name"] == args.tag,
        "Downloaded release source differs",
    )
    require(
        release["prerelease"] == bool(re.search(r"(?:a|b|rc)\d+$", version)),
        "Release prerelease flag differs",
    )
    if args.target == "pypi":
        require(not release["draft"], "Formal publication requires a published Release")
    args.dist.mkdir(parents=True, exist_ok=True)
    require(not any(args.dist.iterdir()), "Use an empty distribution output directory")
    directory = args.assets / "artifacts"
    require(directory.is_dir(), "Missing downloaded Release assets")
    files = validate_distributions(directory, version)
    require(files == receipt["files"], "Downloaded receipt and distributions differ")
    # Inspect all resources and exclusions against this exact tagged source.
    subprocess.run(
        [
            sys.executable,
            str(ROOT / "tools/inspect_dist.py"),
            "--source",
            str(ROOT),
            "--dist",
            str(directory),
            "--check-long-description",
        ],
        check=True,
    )
    subprocess.run(
        [
            sys.executable,
            "-m",
            "twine",
            "check",
            "--strict",
            *(str(directory / name) for name in files),
        ],
        check=True,
    )
    evidence = {
        "distribution": DISTRIBUTION,
        "version": version,
        "tag": args.tag,
        "commit": commit,
        "release_id": release["id"],
        "files": files,
        "ci": ci,
    }
    if args.target == "pypi":
        index_files("testpypi", evidence)
    present = index_files(args.target, evidence, missing_ok=True)
    for name in files.keys() - present.keys():
        shutil.copyfile(directory / name, args.dist / name)
    args.evidence.parent.mkdir(parents=True, exist_ok=True)
    args.evidence.write_text(json.dumps(evidence, indent=2) + "\n", encoding="utf-8")
    output = os.environ.get("GITHUB_OUTPUT")
    if output:
        with open(output, "a", encoding="utf-8") as stream:
            stream.write(f"upload_required={str(len(present) != len(files)).lower()}\n")
    print(
        f"Verified {args.tag} at {commit}; {len(files) - len(present)} files need upload to {args.target}."
    )


def verify_index(args):
    evidence = json.loads(args.evidence.read_text(encoding="utf-8"))
    version = version_for(evidence["tag"])
    require(
        evidence["distribution"] == DISTRIBUTION and evidence["version"] == version,
        "Invalid verification evidence",
    )
    require(
        set(evidence["files"]) == set(filenames(version)), "Invalid evidence filenames"
    )
    for value in evidence["files"].values():
        require(
            SHA256.fullmatch(value["sha256"]) is not None, "Invalid evidence digest"
        )
    assets = wait_for_index(args.target, evidence)
    args.dist.mkdir(parents=True, exist_ok=True)
    require(not any(args.dist.iterdir()), "Use an empty package download directory")
    for name, asset in assets.items():
        with urlopen(asset["url"], timeout=60) as response:
            (args.dist / name).write_bytes(response.read())
    (args.dist / "SHA256SUMS").write_text(
        "".join(
            f"{evidence['files'][name]['sha256']}  {name}\n"
            for name in filenames(version)
        ),
        encoding="ascii",
    )
    require(
        validate_distributions(args.dist, version) == evidence["files"],
        "Downloaded files differ",
    )
    if args.install:
        wheel = (args.dist / filenames(version)[0]).resolve()
        subprocess.run(
            [
                sys.executable,
                "-m",
                "pip",
                "install",
                "--disable-pip-version-check",
                str(wheel),
            ],
            check=True,
        )
        # Only this wheel comes from TestPyPI; platform dependencies use normal PyPI.
        with tempfile.TemporaryDirectory(prefix="statusline-installed-") as temporary:
            subprocess.run(
                [
                    sys.executable,
                    str(ROOT / "tools/ci_smoke.py"),
                    "--report",
                    str(args.report.resolve()),
                ],
                cwd=temporary,
                check=True,
            )
    print(
        f"Verified both {args.target} downloads for {evidence['tag']} against GitHub Release assets."
    )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)
    for name in ("fetch", "prepare", "verify-index"):
        command = subparsers.add_parser(name)
        command.add_argument("--target", choices=INDEX_HOSTS, required=True)
        if name != "fetch":
            command.add_argument("--dist", type=Path, required=True)
            command.add_argument("--evidence", type=Path, required=True)
        if name in ("fetch", "prepare"):
            command.add_argument("--tag", required=True)
            command.add_argument("--assets", type=Path, required=True)
        else:
            command.add_argument("--install", action="store_true")
            command.add_argument(
                "--report", type=Path, default=Path("index-installation.json")
            )
    args = parser.parse_args()
    try:
        {"fetch": fetch, "prepare": prepare, "verify-index": verify_index}[
            args.command
        ](args)
    except (
        ValueError,
        OSError,
        KeyError,
        zipfile.BadZipFile,
        tarfile.TarError,
        subprocess.CalledProcessError,
    ) as error:
        parser.exit(1, f"Publication verification failed: {error}\n")


if __name__ == "__main__":
    main()
