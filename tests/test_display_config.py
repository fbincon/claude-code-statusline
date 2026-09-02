"""Tests for the user-owned status line display configuration."""

import stat
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from claude_statusline import display_config as dc


class DisplayConfigTests(unittest.TestCase):
    def setUp(self):
        self.tempdir = tempfile.TemporaryDirectory(prefix="statusline-config-test-")
        self.config_dir = Path(self.tempdir.name)

    def tearDown(self):
        self.tempdir.cleanup()

    def test_missing_file_uses_legacy_compatible_defaults(self):
        config, raw = dc.read_display_config(self.config_dir)
        self.assertIsNone(raw)
        self.assertEqual(config.items, dc.DEFAULT_ITEMS)
        self.assertTrue(config.use_colors)
        self.assertEqual(config.palette, "default")
        self.assertEqual(config.directory_style, "full")
        self.assertEqual(config.separator_style, "classic")

    def test_round_trip_preserves_empty_ordered_items_and_private_mode(self):
        self.config_dir.chmod(0o775)
        config = dc.DEFAULT_CONFIG.with_updates(
            items=(),
            use_colors=False,
            palette="ansi",
            directory_style="basename",
            separator_style="compact",
        )
        dc.write_display_config(self.config_dir, config)
        loaded = dc.load_display_config(self.config_dir)
        self.assertEqual(loaded, config)
        self.assertEqual(
            stat.S_IMODE(dc.config_path(self.config_dir).stat().st_mode), 0o600
        )
        self.assertEqual(stat.S_IMODE(self.config_dir.stat().st_mode), 0o775)
        self.assertEqual(
            list(self.config_dir.glob(".claude-statusline.json.*.tmp")), []
        )

    def test_strict_schema_rejects_missing_unknown_duplicate_and_invalid_values(self):
        valid = dc.DEFAULT_CONFIG.to_dict()
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

        wrong_version = dict(valid, schema_version=2)
        cases.append(wrong_version)

        wrong_bool = dict(valid, use_colors=1)
        cases.append(wrong_bool)

        wrong_palette = dict(valid, palette="theme")
        cases.append(wrong_palette)

        for value in cases:
            with self.subTest(value=value), self.assertRaises(dc.DisplayConfigError):
                dc.validate_display_config(value)

    def test_invalid_json_is_reported_without_rewrite(self):
        path = dc.config_path(self.config_dir)
        path.write_text("{broken", encoding="utf-8")
        before = path.read_bytes()
        with self.assertRaises(dc.DisplayConfigError):
            dc.load_display_config(self.config_dir)
        self.assertEqual(path.read_bytes(), before)

    def test_atomic_write_failure_preserves_previous_file(self):
        path = dc.config_path(self.config_dir)
        dc.write_display_config(self.config_dir, dc.DEFAULT_CONFIG)
        before = path.read_bytes()
        updated = dc.DEFAULT_CONFIG.with_updates(use_colors=False)
        with (
            mock.patch(
                "claude_statusline.display_config.os.replace", side_effect=OSError("no")
            ),
            self.assertRaises(dc.DisplayConfigError),
        ):
            dc.write_display_config(self.config_dir, updated)
        self.assertEqual(path.read_bytes(), before)


class DirectoryStyleTests(unittest.TestCase):
    def test_directory_styles(self):
        with mock.patch(
            "claude_statusline.display_config.Path.home", return_value=Path("/home/u")
        ):
            self.assertEqual(
                dc.format_directory("/home/u/code/repo", "full"), "/home/u/code/repo"
            )
            self.assertEqual(
                dc.format_directory("/home/u/code/repo", "home"), "~/code/repo"
            )
            self.assertEqual(dc.format_directory("/home/u", "home"), "~")
        self.assertEqual(dc.format_directory("/code/repo", "basename"), "repo")
        self.assertEqual(
            dc.format_directory(
                "/code/repo/src", "project-relative", project_dir="/code/repo"
            ),
            "src",
        )
        self.assertEqual(
            dc.format_directory(
                "/other/src", "project-relative", project_dir="/code/repo"
            ),
            "/other/src",
        )


if __name__ == "__main__":
    unittest.main(verbosity=2)
