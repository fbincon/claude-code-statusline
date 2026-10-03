"""Tests for the user-owned status line display configuration."""

from claude_statusline.config import display as config_display

import json
import os
import stat
import tempfile
import unittest
from pathlib import Path
from unittest import mock


class DisplayConfigTests(unittest.TestCase):
    def setUp(self):
        self.tempdir = tempfile.TemporaryDirectory(prefix="statusline-config-test-")
        self.config_dir = Path(self.tempdir.name)

    def tearDown(self):
        self.tempdir.cleanup()

    def test_missing_file_uses_legacy_compatible_defaults(self):
        config, raw = config_display.read_display_config(self.config_dir)
        self.assertIsNone(raw)
        self.assertEqual(config.items, config_display.DEFAULT_ITEMS)
        self.assertTrue(config.use_colors)
        self.assertEqual(config.palette, "default")
        self.assertEqual(config.directory_style, "full")
        self.assertEqual(config.separator_style, "classic")
        self.assertEqual(config.scope_labels, "when-subagents")
        self.assertTrue(config.subagents.enabled)
        self.assertEqual(config.subagents.items, config_display.DEFAULT_SUBAGENT_ITEMS)

    def test_round_trip_preserves_empty_ordered_items_and_private_mode(self):
        self.config_dir.chmod(0o775)
        config = config_display.DEFAULT_CONFIG.with_updates(
            items=(),
            use_colors=False,
            palette="ansi",
            directory_style="basename",
            separator_style="compact",
        )
        config_display.write_display_config(self.config_dir, config)
        loaded = config_display.load_display_config(self.config_dir)
        self.assertEqual(loaded, config)
        if os.name == "posix":
            self.assertEqual(
                stat.S_IMODE(
                    config_display.config_path(self.config_dir).stat().st_mode
                ),
                0o600,
            )
            self.assertEqual(stat.S_IMODE(self.config_dir.stat().st_mode), 0o775)
        self.assertEqual(
            list(self.config_dir.glob(".claude-statusline.json.*.tmp")), []
        )

    def test_strict_schema_rejects_missing_unknown_duplicate_and_invalid_values(self):
        valid = config_display.DEFAULT_CONFIG.to_dict()
        cases = []

        missing = dict(valid)
        missing.pop("palette")
        cases.append(missing)

        unknown = dict(valid, extra=True)
        cases.append(unknown)

        duplicate = dict(valid, items=["git", "git"])
        cases.append(duplicate)

        unknown_item = dict(valid, items=["clock"])
        cases.append(unknown_item)

        wrong_version = dict(valid, schema_version=3)
        cases.append(wrong_version)

        wrong_bool = dict(valid, use_colors=1)
        cases.append(wrong_bool)

        wrong_palette = dict(valid, palette="theme")
        cases.append(wrong_palette)

        missing_subagent = dict(valid)
        missing_subagent["subagents"] = {"enabled": True}
        cases.append(missing_subagent)

        duplicate_subagent = dict(valid)
        duplicate_subagent["subagents"] = {
            "enabled": True,
            "items": ["status", "status"],
        }
        cases.append(duplicate_subagent)

        unknown_subagent = dict(valid)
        unknown_subagent["subagents"] = {
            "enabled": True,
            "items": ["history"],
        }
        cases.append(unknown_subagent)

        conflict_combined_subagent = dict(valid)
        conflict_combined_subagent["subagents"] = {
            "enabled": True,
            "items": ["status-elapsed", "status"],
        }
        cases.append(conflict_combined_subagent)

        conflict_combined_elapsed = dict(valid)
        conflict_combined_elapsed["subagents"] = {
            "enabled": True,
            "items": ["elapsed", "status-elapsed", "name"],
        }
        cases.append(conflict_combined_elapsed)

        wrong_scope = dict(valid, scope_labels="sometimes")
        cases.append(wrong_scope)

        for value in cases:
            with (
                self.subTest(value=value),
                self.assertRaises(config_display.DisplayConfigError),
            ):
                config_display.validate_display_config(value)

    def test_subagent_status_elapsed_accepts_alone_rejects_legacy_pairs(self):
        self.assertEqual(
            config_display.validate_subagent_items(["status-elapsed", "name"]),
            ("status-elapsed", "name"),
        )
        for items in (
            ["status-elapsed", "status"],
            ["status-elapsed", "elapsed"],
            ["status", "status-elapsed", "elapsed"],
        ):
            with (
                self.subTest(items=items),
                self.assertRaises(config_display.DisplayConfigError),
            ):
                config_display.validate_subagent_items(items)

    def test_schema_one_loads_in_memory_as_v2_without_rewriting(self):
        path = config_display.config_path(self.config_dir)
        legacy = {
            "schema_version": 1,
            "items": ["git", "model-with-effort"],
            "use_colors": False,
            "palette": "ansi",
            "directory_style": "home",
            "separator_style": "compact",
        }
        raw = (json.dumps(legacy, separators=(",", ":")) + "\n").encode()
        path.write_bytes(raw)
        config = config_display.load_display_config(self.config_dir)
        self.assertEqual(config.schema_version, 2)
        self.assertEqual(config.items, ("git", "model-with-effort"))
        self.assertFalse(config.use_colors)
        self.assertEqual(config.scope_labels, "when-subagents")
        self.assertEqual(config.subagents.items, config_display.DEFAULT_SUBAGENT_ITEMS)
        self.assertEqual(config_display.read_display_config_schema(self.config_dir), 1)
        self.assertEqual(path.read_bytes(), raw)

    def test_duplicate_json_fields_are_rejected(self):
        path = config_display.config_path(self.config_dir)
        path.write_bytes(b'{"schema_version":2,"schema_version":2}\n')
        with self.assertRaisesRegex(
            config_display.DisplayConfigError, "duplicate JSON field"
        ):
            config_display.load_display_config(self.config_dir)

    def test_invalid_json_is_reported_without_rewrite(self):
        path = config_display.config_path(self.config_dir)
        path.write_text("{broken", encoding="utf-8")
        before = path.read_bytes()
        with self.assertRaises(config_display.DisplayConfigError):
            config_display.load_display_config(self.config_dir)
        self.assertEqual(path.read_bytes(), before)

    def test_atomic_write_failure_preserves_previous_file(self):
        path = config_display.config_path(self.config_dir)
        config_display.write_display_config(
            self.config_dir, config_display.DEFAULT_CONFIG
        )
        before = path.read_bytes()
        updated = config_display.DEFAULT_CONFIG.with_updates(use_colors=False)
        with (
            mock.patch(
                "claude_statusline.platforms.files.os.replace",
                side_effect=OSError("no"),
            ),
            self.assertRaises(config_display.DisplayConfigError),
        ):
            config_display.write_display_config(self.config_dir, updated)
        self.assertEqual(path.read_bytes(), before)


class DirectoryStyleTests(unittest.TestCase):
    def test_directory_styles(self):
        with mock.patch(
            "claude_statusline.config.display.Path.home", return_value=Path("/home/u")
        ):
            self.assertEqual(
                config_display.format_directory("/home/u/code/repo", "full"),
                "/home/u/code/repo",
            )
            self.assertEqual(
                config_display.format_directory("/home/u/code/repo", "home"),
                "~/code/repo",
            )
            self.assertEqual(config_display.format_directory("/home/u", "home"), "~")
        self.assertEqual(
            config_display.format_directory("/code/repo", "basename"), "repo"
        )
        self.assertEqual(
            config_display.format_directory(
                "/code/repo/src", "project-relative", project_dir="/code/repo"
            ),
            "src",
        )
        self.assertEqual(
            config_display.format_directory(
                "/other/src", "project-relative", project_dir="/code/repo"
            ),
            "/other/src",
        )

    @unittest.skipUnless(os.name == "nt", "native Windows path semantics")
    def test_windows_drive_unc_unicode_case_and_long_paths(self):
        home = Path(r"C:\Users\测试 User")
        with mock.patch(
            "claude_statusline.config.display.Path.home", return_value=home
        ):
            self.assertEqual(
                config_display.format_directory(r"c:\users\测试 User\项目\src", "home"),
                "~/项目/src",
            )
        self.assertEqual(
            config_display.format_directory(
                r"c:\WORK\项目\src\包",
                "project-relative",
                project_dir=r"C:\work\项目",
            ),
            "src/包",
        )
        self.assertEqual(
            config_display.format_directory(
                r"\\SERVER\Share\项目\src",
                "project-relative",
                project_dir=r"\\server\share\项目",
            ),
            "src",
        )
        raw = r"C:\mixed/原始\separators" + "\\" + ("很长" * 100)
        self.assertEqual(config_display.format_directory(raw, "full"), raw)
        self.assertEqual(
            config_display.format_directory(r"\\server\share\项目", "basename"), "项目"
        )


if __name__ == "__main__":
    unittest.main(verbosity=2)
