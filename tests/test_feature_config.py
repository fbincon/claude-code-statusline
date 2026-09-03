#!/usr/bin/env python3
"""Tests for the persistent experimental feature preference."""

import json
import os
from pathlib import Path
import stat
import tempfile
import unittest
from unittest import mock

from claude_statusline import feature_config as fc


class FeatureConfigTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="statusline-feature-")
        self.config_dir = Path(self.temporary.name) / "claude"
        self.path = fc.feature_path(self.config_dir)

    def tearDown(self):
        self.temporary.cleanup()

    def test_missing_file_is_disabled(self):
        self.assertFalse(fc.load_experimental_slash_tui(self.config_dir))
        self.assertFalse(self.config_dir.exists())

    def test_enabled_round_trip_is_canonical_private_and_atomic(self):
        written = fc.write_enabled(self.config_dir)
        self.assertEqual(written, self.path)
        self.assertTrue(fc.load_experimental_slash_tui(self.config_dir))
        self.assertEqual(self.path.read_bytes(), fc.enabled_bytes())
        self.assertEqual(stat.S_IMODE(self.path.stat().st_mode), 0o600)
        self.assertEqual(
            list(self.config_dir.glob(".*.claude-statusline-*.tmp")), []
        )

    def test_strict_schema_rejects_unknown_missing_duplicate_and_types(self):
        values = [
            b"[]\n",
            b'{"schema_version":1}\n',
            b'{"schema_version":1,"experimental_slash_tui":true,"extra":1}\n',
            b'{"schema_version":true,"experimental_slash_tui":true}\n',
            b'{"schema_version":2,"experimental_slash_tui":true}\n',
            b'{"schema_version":1,"experimental_slash_tui":"true"}\n',
            b'{"schema_version":1,"experimental_slash_tui":0}\n',
            (
                b'{"schema_version":1,"schema_version":1,'
                b'"experimental_slash_tui":true}\n'
            ),
        ]
        self.config_dir.mkdir()
        for raw in values:
            with self.subTest(raw=raw):
                self.path.write_bytes(raw)
                with self.assertRaises(fc.FeatureConfigError):
                    fc.load_experimental_slash_tui(self.config_dir)

    def test_explicit_false_boolean_is_valid_and_disabled(self):
        self.config_dir.mkdir()
        self.path.write_text(
            '{"schema_version":1,"experimental_slash_tui":false}\n',
            encoding="utf-8",
        )
        self.assertFalse(fc.load_experimental_slash_tui(self.config_dir))

    def test_atomic_replace_failure_preserves_original(self):
        self.config_dir.mkdir()
        original = json.dumps({"custom": "do not replace"}).encode()
        self.path.write_bytes(original)
        with (
            mock.patch.object(os, "replace", side_effect=OSError("simulated")),
            self.assertRaises(fc.FeatureConfigError),
        ):
            fc.write_enabled(self.config_dir)
        self.assertEqual(self.path.read_bytes(), original)
        self.assertEqual(
            list(self.config_dir.glob(".*.claude-statusline-*.tmp")), []
        )


if __name__ == "__main__":
    unittest.main(verbosity=2)
