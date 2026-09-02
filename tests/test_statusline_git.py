#!/usr/bin/env python3
"""Regression tests for the Git portion of statusline.py."""

import json
import os
from pathlib import Path
import re
import stat
import subprocess
import sys
import tempfile
import time
import unittest
from unittest import mock

from claude_statusline import statusline as sl


OID = "0123456789abcdef0123456789abcdef01234567"
ANSI_RE = re.compile(r"\x1b\[[0-9;]*m")


def ok_result(**updates):
    result = {
        "kind": "ok",
        "branch": "main",
        "oid": OID,
        "upstream": None,
        "ahead": 0,
        "behind": 0,
        "upstream_gone": False,
        "staged": 0,
        "unstaged": 0,
        "conflicts": 0,
        "untracked": 0,
    }
    result.update(updates)
    return result


def git(cwd, *args):
    return subprocess.run(
        ["git", "-C", str(cwd), *map(str, args)],
        check=True,
        capture_output=True,
        text=True,
        encoding="utf-8",
    ).stdout


def init_repo(path, branch="main"):
    path.mkdir(parents=True)
    git(path, "init", "-q", "-b", branch)
    git(path, "config", "user.name", "Statusline Test")
    git(path, "config", "user.email", "statusline@example.invalid")


def commit_file(repo, name="tracked.txt", content="initial\n"):
    target = repo / name
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")
    git(repo, "add", name)
    git(repo, "commit", "-q", "-m", f"add {name}")
    return target


class GitParserTests(unittest.TestCase):
    def parse(self, stdout="", returncode=0, stderr="", side_effect=None):
        completed = subprocess.CompletedProcess(
            args=["git"], returncode=returncode, stdout=stdout, stderr=stderr,
        )
        with mock.patch.object(
            sl.subprocess, "run", side_effect=side_effect,
            return_value=None if side_effect else completed,
        ) as run_mock:
            result = sl._uncached_git_status("/example/repo")
        return result, run_mock

    def test_all_change_codes_and_all_conflicts(self):
        records = [
            f"# branch.oid {OID}",
            "# branch.head main",
            "# branch.upstream origin/main",
            "# branch.ab +2 -1",
        ]
        for code in "MTADC":
            records.append(f"1 {code}. N... metadata staged-{code}")
            records.append(f"1 .{code} N... metadata unstaged-{code}")
        records.extend([
            "2 R. N... metadata renamed-new\trenamed-old",
            "2 .R N... metadata renamed-new\trenamed-old",
            "1 MM N... metadata both.txt",
        ])
        for xy in ("DD", "AU", "UD", "UA", "DU", "AA", "UU"):
            records.append(f"u {xy} N... metadata conflict-{xy}")
        records.extend(["? nested/one.txt", "? nested/two.txt", "! ignored.log"])

        result, run_mock = self.parse("\n".join(records) + "\n")

        self.assertEqual(result, ok_result(
            upstream="origin/main", ahead=2, behind=1,
            staged=7, unstaged=7, conflicts=7, untracked=2,
        ))
        command = run_mock.call_args.args[0]
        self.assertIn("--porcelain=v2", command)
        self.assertIn("--ahead-behind", command)
        self.assertIn("--renames", command)
        self.assertIn("--untracked-files=all", command)
        self.assertEqual(run_mock.call_args.kwargs["timeout"], 2)
        self.assertEqual(run_mock.call_args.kwargs["env"]["LC_ALL"], "C")

    def test_branch_variants(self):
        cases = {
            "synchronized": (
                f"# branch.oid {OID}\n# branch.head main\n"
                "# branch.upstream origin/main\n# branch.ab +0 -0\n",
                ok_result(upstream="origin/main"),
            ),
            "no-upstream": (
                f"# branch.oid {OID}\n# branch.head local\n",
                ok_result(branch="local"),
            ),
            "gone": (
                f"# branch.oid {OID}\n# branch.head main\n"
                "# branch.upstream origin/main\n",
                ok_result(upstream="origin/main", upstream_gone=True),
            ),
            "detached": (
                f"# branch.oid {OID}\n# branch.head (detached)\n",
                ok_result(branch=f"HEAD@{OID[:7]}"),
            ),
            "unborn": (
                "# branch.oid (initial)\n# branch.head newborn\n",
                ok_result(branch="newborn", oid=None),
            ),
        }
        for name, (stdout, expected) in cases.items():
            with self.subTest(name=name):
                result, _run_mock = self.parse(stdout)
                self.assertEqual(result, expected)

    def test_non_repo_and_git_failures_are_distinct(self):
        result, _ = self.parse(
            returncode=128,
            stderr="fatal: not a git repository (or any parent): .git\n",
        )
        self.assertEqual(result, {"kind": "not_repo"})

        for stderr in (
            "fatal: detected dubious ownership in repository\n",
            "fatal: cannot open .git/index: Permission denied\n",
            "fatal: bad object HEAD\n",
        ):
            with self.subTest(stderr=stderr):
                result, _ = self.parse(returncode=128, stderr=stderr)
                self.assertEqual(result, {"kind": "error"})

        for error in (
            subprocess.TimeoutExpired(["git"], 2),
            PermissionError("denied"),
            FileNotFoundError("git"),
        ):
            with self.subTest(error=type(error).__name__):
                result, _ = self.parse(side_effect=error)
                self.assertEqual(result, {"kind": "error"})

    def test_malformed_porcelain_is_an_error(self):
        malformed = (
            "",
            f"# branch.oid {OID}\n",
            f"# branch.oid {OID}\n# branch.head main\n# branch.ab ahead behind\n",
            f"# branch.oid {OID}\n# branch.head main\nx unknown\n",
            f"# branch.oid {OID}\n# branch.head main\n1 U. metadata\n",
        )
        for stdout in malformed:
            with self.subTest(stdout=stdout):
                result, _ = self.parse(stdout)
                self.assertEqual(result, {"kind": "error"})


class GitDisplayTests(unittest.TestCase):
    def test_directory_precedence(self):
        data = {
            "cwd": "/cwd",
            "workspace": {"current_dir": "/current", "project_dir": "/project"},
            "worktree": {"path": "/worktree"},
        }
        self.assertEqual(sl._live_directory(data), "/current")
        del data["workspace"]["current_dir"]
        self.assertEqual(sl._live_directory(data), "/cwd")
        del data["cwd"]
        self.assertEqual(sl._live_directory(data), "/worktree")
        del data["worktree"]
        self.assertEqual(sl._live_directory(data), "/project")
        self.assertIsNone(sl._live_directory({}))

    def test_compact_segment_contract(self):
        result = ok_result(
            upstream="origin/main", ahead=2, behind=1,
            staged=5, unstaged=3, conflicts=1, untracked=2,
        )
        plain = ANSI_RE.sub("", sl._git_segment(result))
        self.assertEqual(plain, "git main ↑2↓1● 5~3!1?2")
        self.assertIsNone(sl._git_segment({"kind": "not_repo"}))
        self.assertEqual(ANSI_RE.sub("", sl._git_segment({"kind": "error"})), "git!")

    def test_gone_suppresses_divergence_numbers(self):
        result = ok_result(
            upstream="origin/main", ahead=9, behind=8, upstream_gone=True,
        )
        self.assertEqual(ANSI_RE.sub("", sl._git_segment(result)), "git main [gone]")


class GitCacheTests(unittest.TestCase):
    def setUp(self):
        self.tempdir = tempfile.TemporaryDirectory(prefix="statusline-cache-test-")
        self.addCleanup(self.tempdir.cleanup)
        patcher = mock.patch.object(sl, "GIT_CACHE_DIR", self.tempdir.name)
        patcher.start()
        self.addCleanup(patcher.stop)
        self.result = ok_result(staged=1)

    def test_write_read_permissions_ttl_and_atomicity(self):
        now_ns = 1_000_000_000_000
        with mock.patch.object(sl.time, "time_ns", return_value=now_ns):
            sl._write_git_cache("session-a", "/repo", self.result)

        cache_path = Path(sl._git_cache_path("session-a"))
        self.assertTrue(cache_path.is_file())
        self.assertEqual(stat.S_IMODE(cache_path.stat().st_mode), 0o600)
        self.assertEqual(stat.S_IMODE(Path(sl.GIT_CACHE_DIR).stat().st_mode), 0o700)
        self.assertEqual(list(Path(sl.GIT_CACHE_DIR).glob("*.tmp")), [])
        stored = json.loads(cache_path.read_text(encoding="utf-8"))
        self.assertEqual(stored["version"], sl.GIT_CACHE_VERSION)
        self.assertEqual(stored["cwd"], "/repo")

        with mock.patch.object(sl.time, "time_ns", return_value=now_ns + sl.GIT_CACHE_TTL_NS):
            self.assertEqual(sl._read_git_cache("session-a", "/repo"), self.result)
        with mock.patch.object(
            sl.time, "time_ns", return_value=now_ns + sl.GIT_CACHE_TTL_NS + 1,
        ):
            self.assertIs(sl._read_git_cache("session-a", "/repo"), sl._CACHE_MISS)

    def test_schema_and_directory_mismatch_are_misses(self):
        sl._write_git_cache("session-b", "/repo-one", self.result)
        self.assertIs(sl._read_git_cache("session-b", "/repo-two"), sl._CACHE_MISS)

        path = Path(sl._git_cache_path("legacy"))
        path.write_text(json.dumps({
            "checked_ns": time.time_ns(), "cwd": "/repo", "value": ["main", 0, 0, 0],
        }), encoding="utf-8")
        self.assertIs(sl._read_git_cache("legacy", "/repo"), sl._CACHE_MISS)

    def test_git_status_caches_each_session_current_directory(self):
        with mock.patch.object(sl, "_uncached_git_status", return_value=self.result) as query:
            self.assertEqual(sl.git_status("/repo-one", "session-c"), self.result)
            self.assertEqual(sl.git_status("/repo-one", "session-c"), self.result)
            self.assertEqual(query.call_count, 1)
            self.assertEqual(sl.git_status("/repo-two", "session-c"), self.result)
            self.assertEqual(query.call_count, 2)

    def test_pruning_removes_stale_and_oldest_excess_files(self):
        root = Path(sl.GIT_CACHE_DIR)
        now_ns = time.time_ns()
        stale = root / "stale.json"
        stale.write_text("{}", encoding="utf-8")
        stale_ns = now_ns - 10_000_000_000
        os.utime(stale, ns=(stale_ns, stale_ns))
        for index in range(5):
            path = root / f"live-{index}.json"
            path.write_text("{}", encoding="utf-8")
            mtime_ns = now_ns - index * 100_000_000
            os.utime(path, ns=(mtime_ns, mtime_ns))

        with (
            mock.patch.object(sl, "GIT_CACHE_MAX_AGE_NS", 1_000_000_000),
            mock.patch.object(sl, "GIT_CACHE_MAX_FILES", 3),
            mock.patch.object(sl.time, "time_ns", return_value=now_ns),
        ):
            sl._prune_git_cache()

        remaining = sorted(path.name for path in root.glob("*.json"))
        self.assertEqual(len(remaining), 3)
        self.assertNotIn("stale.json", remaining)
        self.assertEqual(remaining, ["live-0.json", "live-1.json", "live-2.json"])


class GitIntegrationTests(unittest.TestCase):
    def setUp(self):
        self.tempdir = tempfile.TemporaryDirectory(prefix="statusline-git-test-")
        self.addCleanup(self.tempdir.cleanup)
        self.root = Path(self.tempdir.name)

    def test_real_status_counts_types_rename_both_and_nested_untracked(self):
        repo = self.root / "repo"
        init_repo(repo)
        for name in ("staged-type", "unstaged-type", "rename-old", "both"):
            (repo / name).write_text("initial\n", encoding="utf-8")
        git(repo, "add", ".")
        git(repo, "commit", "-q", "-m", "initial")

        (repo / "staged-type").unlink()
        (repo / "staged-type").symlink_to("target")
        git(repo, "add", "staged-type")
        (repo / "unstaged-type").unlink()
        (repo / "unstaged-type").symlink_to("target")
        git(repo, "mv", "rename-old", "rename-new")
        (repo / "both").write_text("staged\n", encoding="utf-8")
        git(repo, "add", "both")
        (repo / "both").write_text("staged\nunstaged\n", encoding="utf-8")
        (repo / "nested").mkdir()
        (repo / "nested" / "one.txt").write_text("one\n", encoding="utf-8")
        (repo / "nested" / "two.txt").write_text("two\n", encoding="utf-8")
        (repo / "root-untracked.txt").write_text("three\n", encoding="utf-8")

        result = sl._uncached_git_status(str(repo))
        self.assertEqual(result["kind"], "ok")
        self.assertEqual(result["staged"], 3)
        self.assertEqual(result["unstaged"], 2)
        self.assertEqual(result["conflicts"], 0)
        self.assertEqual(result["untracked"], 3)

    def test_real_submodule_dirty_state(self):
        source = self.root / "submodule-source"
        init_repo(source)
        commit_file(source, "seed.txt")

        repo = self.root / "parent"
        init_repo(repo)
        git(repo, "commit", "-q", "--allow-empty", "-m", "initial")
        git(repo, "-c", "protocol.file.allow=always", "submodule", "add", "-q", source, "vendor/lib")
        git(repo, "commit", "-q", "-am", "add submodule")
        (repo / "vendor" / "lib" / "seed.txt").write_text("changed\n", encoding="utf-8")

        result = sl._uncached_git_status(str(repo))
        self.assertEqual(result["kind"], "ok")
        self.assertEqual(result["unstaged"], 1)

    def test_real_divergence_gone_detached_unborn_and_worktree(self):
        remote = self.root / "remote.git"
        subprocess.run(
            ["git", "init", "-q", "--bare", "--initial-branch=main", str(remote)],
            check=True,
        )
        local = self.root / "local"
        init_repo(local)
        commit_file(local)
        git(local, "remote", "add", "origin", remote)
        git(local, "push", "-q", "-u", "origin", "main")

        peer = self.root / "peer"
        subprocess.run(["git", "clone", "-q", str(remote), str(peer)], check=True)
        git(peer, "config", "user.name", "Statusline Test")
        git(peer, "config", "user.email", "statusline@example.invalid")
        git(peer, "commit", "-q", "--allow-empty", "-m", "remote commit")
        git(peer, "push", "-q", "origin", "main")
        git(local, "commit", "-q", "--allow-empty", "-m", "local commit")
        git(local, "fetch", "-q", "origin")

        diverged = sl._uncached_git_status(str(local))
        self.assertEqual((diverged["ahead"], diverged["behind"]), (1, 1))

        worktree = self.root / "linked-worktree"
        git(local, "worktree", "add", "-q", "-b", "feature", worktree)
        self.assertEqual(sl._uncached_git_status(str(worktree))["branch"], "feature")

        git(local, "checkout", "-q", "--detach")
        detached_oid = git(local, "rev-parse", "HEAD").strip()
        self.assertEqual(
            sl._uncached_git_status(str(local))["branch"], f"HEAD@{detached_oid[:7]}",
        )
        git(local, "checkout", "-q", "main")

        subprocess.run(
            ["git", f"--git-dir={remote}", "update-ref", "-d", "refs/heads/main"],
            check=True,
        )
        git(local, "fetch", "-q", "--prune", "origin")
        gone = sl._uncached_git_status(str(local))
        self.assertTrue(gone["upstream_gone"])

        unborn = self.root / "unborn"
        init_repo(unborn, branch="newborn")
        unborn_result = sl._uncached_git_status(str(unborn))
        self.assertEqual(unborn_result["branch"], "newborn")
        self.assertIsNone(unborn_result["oid"])

    def test_end_to_end_statusline_uses_live_directory_for_dir_and_git(self):
        launch = self.root / "launch"
        launch.mkdir()
        live = self.root / "live"
        init_repo(live, branch="live-branch")
        git(live, "commit", "-q", "--allow-empty", "-m", "initial")
        payload = {
            "model": {"id": "test-model"},
            "cwd": str(live),
            "workspace": {"project_dir": str(launch), "current_dir": str(live)},
        }
        runtime = self.root / "runtime"
        env = os.environ.copy()
        env["CLAUDE_CONFIG_DIR"] = str(self.root / "claude-config")
        env["CLAUDE_STATUSLINE_RUNTIME_DIR"] = str(runtime)
        env["COLUMNS"] = "1000"
        rendered = subprocess.run(
            [sys.executable, "-m", "claude_statusline", "render"],
            input=json.dumps(payload),
            check=True, capture_output=True, text=True, encoding="utf-8", env=env,
        ).stdout.strip()
        plain = ANSI_RE.sub("", rendered)
        segments = plain.split(" | ")
        self.assertEqual(segments[1], str(live))
        self.assertEqual(segments[2], "git live-branch")
        self.assertNotIn(str(launch), plain)


if __name__ == "__main__":
    unittest.main(verbosity=2)
