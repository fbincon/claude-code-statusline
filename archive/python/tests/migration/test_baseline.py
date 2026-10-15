"""Reject silent reference movement, incomplete coverage and permissive equality."""

from pathlib import Path
import tempfile
import unittest
from unittest import mock

from tools.migration import capture, inventory
from tools.migration.common import (
    CORPUS,
    ROOT,
    REFERENCE,
    check_source,
    digest,
    encoded,
    isolated_environment,
    read_json,
)


class ComparisonTests(unittest.TestCase):
    def test_missing_null_zero_boolean_and_large_integers_remain_distinct(self):
        for first, second in (
            ({}, {"x": None}),
            (None, 0),
            (False, 0),
            (2_000_000_000_000_000_001, 2_000_000_000_000_000_000),
            (1, 1.0),
            ([1, 2], [2, 1]),
            ("\x1b[0m", ""),
        ):
            with self.subTest(first=first, second=second):
                self.assertTrue(capture.differences(first, second))
        self.assertFalse(capture.differences({"a": 1, "b": 2}, {"b": 2, "a": 1}))

    def test_strict_fixture_json_rejects_duplicates_and_nonfinite_values(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "value.json"
            for raw in ('{"x":0,"x":1}', '{"x":NaN}', '{"x":Infinity}'):
                path.write_text(raw, encoding="utf-8")
                with self.assertRaises(ValueError):
                    read_json(path)
            path.write_text('{"ns":2000000000000000001}', encoding="utf-8")
            self.assertEqual(read_json(path)["ns"], 2_000_000_000_000_000_001)

    def test_unmapped_or_duplicate_cases_are_refused(self):
        case = {"id": "example-case", "behaviors": ["CLI"], "kind": "cli", "input": {}}
        for cases in (
            [],
            [case, case],
            [{**case, "behaviors": []}],
            [{**case, "behaviors": ["UNKNOWN"]}],
        ):
            with self.subTest(cases=cases), self.assertRaises(ValueError):
                capture.validate_cases({"cases": cases, "configs": {}})

    def test_unmapped_discovered_test_cannot_pass_inventory(self):
        files = {
            "tests/test_sample.py": b"class Sample:\n    def test_one(self): pass\n"
        }
        with mock.patch.object(
            inventory,
            "runtime_inventory",
            return_value={"discovered_test_ids": ["tests.test_sample.Sample.test_two"]},
        ):
            with self.assertRaisesRegex(ValueError, "Unmapped discovered tests"):
                inventory.build(files, ROOT)

    def test_source_tampering_and_extra_python_are_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "src").mkdir()
            source = root / "src/reference.py"
            source.write_bytes(b"reference\n")
            files = {"src/reference.py": source.read_bytes()}
            check_source(root, files)
            (root / "src/injected.py").write_bytes(b"unexpected\n")
            with self.assertRaisesRegex(ValueError, "additional/missing"):
                check_source(root, files)
            (root / "src/injected.py").unlink()
            source.write_bytes(b"changed\n")
            with self.assertRaisesRegex(ValueError, "source mismatch"):
                check_source(root, files)

    def test_lock_rejects_wrong_reference_and_tampered_expectations(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for name in (
                "baseline.json",
                "cases.json",
                "expected.json",
                "platforms.json",
            ):
                (root / name).write_bytes(b"{}\n")
            lock = {
                "reference_commit": REFERENCE,
                "harness": capture.harness_hashes(),
                "fixtures": {
                    p.name: digest(p.read_bytes()) for p in root.glob("*.json")
                },
            }
            (root / "lock.json").write_bytes(encoded(lock))
            capture.check_lock(root)
            lock["reference_commit"] = "0" * 40
            (root / "lock.json").write_bytes(encoded(lock))
            with self.assertRaisesRegex(ValueError, "Wrong reference"):
                capture.check_lock(root)
            lock["reference_commit"] = REFERENCE
            (root / "lock.json").write_bytes(encoded(lock))
            (root / "expected.json").write_bytes(b'{"silently":"refreshed"}\n')
            with self.assertRaisesRegex(ValueError, "Fixture hash mismatch"):
                capture.check_lock(root)

    def test_independent_captures_are_identical_and_existing_output_is_protected(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            fixture = {
                "configs": {},
                "cases": [
                    {
                        "id": "hook-invalid",
                        "kind": "cli",
                        "behaviors": ["CLI"],
                        "input": {"argv": ["hook"], "stdin": "{"},
                    }
                ],
            }
            (root / "cases.json").write_bytes(encoded(fixture))
            one = capture.capture(ROOT, root / "one", corpus=root)
            two = capture.capture(ROOT, root / "two", corpus=root)
            self.assertEqual(one, two)
            self.assertEqual(
                one["hook-invalid"]["value"],
                {"exit_code": 0, "stdout": "", "stderr": ""},
            )
            with self.assertRaises(FileExistsError):
                capture.capture(ROOT, root / "one", corpus=root)

    def test_verify_rejects_difference_without_rewriting_expected(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            names = ["baseline.json", "cases.json", "expected.json"]
            values = [
                {"reference_commit": REFERENCE},
                {"configs": {}, "cases": [{"id": "case-one", "behaviors": ["CLI"]}]},
                {"case-one": {"stdout": "expected"}},
            ]
            for name, value in zip(names, values):
                (root / name).write_bytes(encoded(value))
            before = (root / "expected.json").read_bytes()
            with (
                mock.patch.object(capture, "check_lock"),
                mock.patch.object(capture, "build", return_value=values[0]),
                mock.patch.object(
                    capture, "capture", return_value={"case-one": {"stdout": "changed"}}
                ),
            ):
                with self.assertRaisesRegex(ValueError, "Behavior mismatch"):
                    capture.verify({}, ROOT, corpus=root)
            self.assertEqual((root / "expected.json").read_bytes(), before)

    def test_child_has_no_user_credentials_or_real_claude_on_path(self):
        with mock.patch.dict(
            "os.environ",
            {
                "ANTHROPIC_API_KEY": "synthetic-test-value",
                "CLAUDE_CONFIG_DIR": "/real-config",
            },
        ):
            env = isolated_environment(Path("/source"), Path("/isolated"))
        self.assertNotIn("ANTHROPIC_API_KEY", env)
        self.assertEqual(env["CLAUDE_CONFIG_DIR"], str(Path("/isolated/config")))
        self.assertEqual(env["PATH"], str(Path("/isolated/bin")))


class CorpusTests(unittest.TestCase):
    def test_every_frozen_definition_and_command_has_a_behavior_mapping(self):
        baseline = read_json(CORPUS / "baseline.json")
        self.assertEqual(
            baseline["counts"],
            {
                "source_python_files": 153,
                "test_python_files": 96,
                "tool_python_files": 42,
                "static_test_methods": 815,
                "discovered_test_ids": 815,
            },
        )
        ids = {row["id"] for row in baseline["test_methods"]}
        self.assertEqual(ids, set(baseline["public_surface"]["discovered_test_ids"]))
        known = {row["id"] for row in baseline["behaviors"]}
        for row in baseline["modules"] + baseline["test_methods"] + baseline["tools"]:
            self.assertIn(row["behavior"], known)
            self.assertTrue(row["reason"])
        commands = {tuple(row["argv"]) for row in baseline["public_surface"]["cli"]}
        for row in baseline["public_surface"]["cli"]:
            self.assertIn(row["behavior"], known)
        environment = {row["name"] for row in baseline["environment_reads"]}
        self.assertTrue(
            {
                "CLAUDE_STATUSLINE_NATIVE_EXECUTABLE",
                "CLAUDE_STATUSLINE_RUNTIME_EXECUTABLE",
            }
            <= environment
        )
        self.assertTrue(
            {("render",), ("config", "instance", "copy"), ("ui",), ("runtime",)}
            <= commands
        )

    def test_successful_saves_conflicts_and_read_only_cases_are_not_error_goldens(self):
        results = read_json(CORPUS / "expected.json")
        self.assertEqual(results["cli-config-show"]["value"]["exit_code"], 0)
        self.assertEqual(results["cli-instances-list"]["value"]["exit_code"], 0)
        transaction = results["transaction-save-conflict-backup"]["value"]
        self.assertEqual(transaction["first_save"]["exit_code"], 0)
        self.assertEqual(
            transaction["stale_save"]["response"]["error"]["code"],
            "configuration_conflict",
        )
        self.assertTrue(transaction["stale_save_unchanged"])
        self.assertTrue(
            any("backups/" in path for path in transaction["after_first_save"])
        )
        self.assertFalse(
            results["portable-roundtrip-review-no-save"]["directories_after"]
        )
        for version in range(1, 9):
            case = results[f"display-v{version}-read"]
            self.assertEqual(case["files_before"], case["files_after"])
        ending = results["lifecycle-continuation-frozen"]["value"][-1]["state"]
        self.assertEqual(ending["duration_ns"], 8_000_000_000)
        self.assertEqual(ending["started_wall_ns"], 2_000_000_001_000_000_001)

    def test_all_catalog_types_and_languages_have_replay_cases(self):
        document = read_json(CORPUS / "cases.json")
        baseline = read_json(CORPUS / "baseline.json")
        ids = {case["id"] for case in document["cases"]}
        for scope, types in baseline["public_surface"]["catalog"].items():
            for name in types:
                self.assertIn("preview-" + scope + "-" + name, ids)
        for language in ("en", "zh-cn", "zh-hant", "ja", "ko"):
            for width in (40, 80, 120):
                self.assertIn(f"production-{language}-{width}", ids)
                self.assertIn(f"subagents-{language}-{width}", ids)
