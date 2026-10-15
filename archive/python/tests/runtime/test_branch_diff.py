from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest import mock

from claude_statusline.runtime import branch_diff, paths


class BranchDiffTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="git diff ")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.git("init", "-b", "main")
        self.git("config", "user.name", "Test")
        self.git("config", "user.email", "test@example.invalid")
        patch = mock.patch.object(paths, "GIT_CACHE_DIR", str(self.root / "cache"))
        patch.start()
        self.addCleanup(patch.stop)
        (self.root / "text").write_text("one\ntwo\n")
        self.commit()
        self.git("checkout", "-b", "feature")

    def git(self, *args):
        return subprocess.run(
            ["git", "-C", str(self.root), *args], capture_output=True, check=True
        )

    def commit(self):
        self.git("add", "--all")
        self.git("commit", "-m", "test")

    def test_merge_base_excludes_worktree_and_binary_counts_only_files(self):
        (self.root / "text").write_text("one\nnew\nextra\n")
        (self.root / "binary").write_bytes(b"\0binary")
        self.commit()
        (self.root / "text").write_text("uncommitted")
        result = branch_diff.collect(self.root)
        self.assertEqual(result["value"], {"files": 2, "added": 2, "removed": 1})
        self.assertEqual(result["base_ref"], "main")
        self.git("checkout", "--detach")
        self.assertEqual(branch_diff.collect(self.root)["value"], result["value"])
        self.assertEqual(
            branch_diff.collect(self.root, "HEAD")["value"],
            {"files": 0, "added": 0, "removed": 0},
        )

    def test_cache_reuses_diff_and_invalidates_when_base_or_head_changes(self):
        (self.root / "text").write_text("one\ntwo\nthree\n")
        self.commit()
        first = branch_diff.collect(self.root)
        original = branch_diff.subprocess.run
        with mock.patch.object(branch_diff.subprocess, "run", wraps=original) as run:
            self.assertEqual(branch_diff.collect(self.root)["value"], first["value"])
            self.assertFalse(
                any(
                    "diff" in call.args[0] or "merge-base" in call.args[0]
                    for call in run.call_args_list
                )
            )
        self.git("branch", "-f", "main", "HEAD")
        self.assertEqual(branch_diff.collect(self.root)["value"]["files"], 0)

    def test_unavailable_ref_or_unrelated_history_never_invent_zero(self):
        self.assertEqual(
            branch_diff.collect(self.root, "missing")["reason"], "base_unavailable"
        )
        self.git("checkout", "--orphan", "unrelated")
        (self.root / "other").write_text("other")
        self.commit()
        self.assertEqual(
            branch_diff.collect(self.root, "main")["reason"], "merge_base_unavailable"
        )
        self.assertIsNone(branch_diff.collect(self.root, "main")["value"])

    def test_origin_head_precedes_local_main_and_timeout_is_shared(self):
        self.git("update-ref", "refs/remotes/origin/trunk", "HEAD")
        self.git(
            "symbolic-ref", "refs/remotes/origin/HEAD", "refs/remotes/origin/trunk"
        )
        self.assertEqual(branch_diff.collect(self.root)["base_ref"], "origin/HEAD")
        with mock.patch.object(
            branch_diff.subprocess,
            "run",
            side_effect=subprocess.TimeoutExpired("git", 2),
        ):
            self.assertEqual(branch_diff.collect(self.root)["reason"], "timeout")
        self.assertEqual(branch_diff.collect(self.root, timeout=0)["reason"], "timeout")

    def test_nul_filenames_and_rename_numstat_are_parsed(self):
        self.assertEqual(
            branch_diff._numstat(b"1\t2\tline\nfile\0-\t-\tbinary\0"),
            {"files": 2, "added": 1, "removed": 2},
        )
        self.assertEqual(
            branch_diff._numstat(b"1\t0\t\0old\0new\0"),
            {"files": 1, "added": 1, "removed": 0},
        )

    def test_shallow_clone_without_merge_base_is_unavailable(self):
        (self.root / "text").write_text("changed\n")
        self.commit()
        clone = self.root / "clone"
        subprocess.run(
            [
                "git",
                "clone",
                "--depth",
                "1",
                "--branch",
                "feature",
                self.root.as_uri(),
                str(clone),
            ],
            check=True,
            capture_output=True,
        )
        original_main = self.git("rev-parse", "main").stdout.strip().decode()
        # The shallow clone has no main; neither missing base nor a missing
        # ancestor may look like a clean branch.
        self.assertIsNone(branch_diff.collect(clone, original_main)["value"])
