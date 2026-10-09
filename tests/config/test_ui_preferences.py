from concurrent.futures import ThreadPoolExecutor
import json
from pathlib import Path
import tempfile
import unittest
from unittest import mock

from claude_statusline.config import models, storage, ui_preferences as preferences
from claude_statusline.ui import protocol


class UiPreferenceTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="UI 中文 language '")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name) / "absent"
        self.path = self.root / preferences.FILENAME

    def test_missing_read_creates_nothing(self):
        self.assertEqual(preferences.read(self.root).ui_language, "en")
        self.assertFalse(self.root.exists())

    def test_save_reopen_idempotence_and_unrelated_files(self):
        self.root.mkdir()
        settings = self.root / "settings.json"
        settings.write_bytes(b'{"unrelated":true}')
        for language in ("zh-CN", "en"):
            preferences.set_language(self.root, language)
            self.assertEqual(preferences.read(self.root).ui_language, language)
            raw = self.path.read_bytes()
            backups = list((self.root / "backups").rglob("metadata.json"))
            preferences.set_language(self.root, language)
            self.assertEqual(raw, self.path.read_bytes())
            self.assertEqual(backups, list((self.root / "backups").rglob("metadata.json")))
        self.assertEqual(settings.read_bytes(), b'{"unrelated":true}')

    def test_invalid_preferences_are_read_only_and_explicitly_repaired(self):
        self.root.mkdir()
        for raw in (b"broken", b"\xff", b"[]", b'{"schema_version":true,"ui_language":"zh-CN"}',
                    b'{"schema_version":1,"ui_language":"ja"}', b'{"schema_version":1,"schema_version":1,"ui_language":"en"}'):
            with self.subTest(raw=raw):
                self.path.write_bytes(raw)
                read = preferences.read(self.root)
                self.assertEqual(read.ui_language, "en")
                self.assertIsNotNone(read.warning)
                self.assertEqual(self.path.read_bytes(), raw)
                preferences.set_language(self.root, "zh-CN")
                self.assertEqual(preferences.read(self.root).ui_language, "zh-CN")
                self.assertTrue(any(p.read_bytes() == raw for p in (self.root / "backups").rglob("*.before")))

    def test_future_schema_and_unknown_languages_are_never_written(self):
        with self.assertRaises(models.ConfigCommandError):
            preferences.set_language(self.root, "ja")
        self.assertFalse(self.root.exists())
        self.root.mkdir()
        raw = b'{"schema_version":2,"ui_language":"zh-CN","future":true}'
        self.path.write_bytes(raw)
        with self.assertRaisesRegex(models.ConfigCommandError, "newer"):
            preferences.set_language(self.root, "en")
        self.assertEqual(self.path.read_bytes(), raw)
        self.assertFalse((self.root / "backups").exists())

    def test_write_failure_after_replace_restores_last_choice(self):
        preferences.set_language(self.root, "en")
        before = self.path.read_bytes()
        original = storage._atomic_write_bytes
        calls = 0

        def fail_once(path, data, **kwargs):
            nonlocal calls
            calls += 1
            original(path, data, **kwargs)
            if calls == 1:
                raise OSError("directory sync failed after replace")

        with mock.patch.object(storage, "_atomic_write_bytes", side_effect=fail_once):
            with self.assertRaises(models.ConfigWriteError):
                preferences.set_language(self.root, "zh-CN")
        self.assertEqual(self.path.read_bytes(), before)

    def test_concurrent_writers_publish_valid_complete_preferences(self):
        with ThreadPoolExecutor(max_workers=4) as pool:
            results = list(pool.map(lambda locale: preferences.set_language(self.root, locale).ui_language,
                                    ["en", "zh-CN"] * 8))
        self.assertEqual(results, ["en", "zh-CN"] * 8)
        self.assertIn(preferences.read(self.root).ui_language, ("en", "zh-CN"))
        self.assertEqual(set(json.loads(self.path.read_bytes())), {"schema_version", "ui_language"})

    def test_protocol_preferences_work_without_renderer_and_errors_keep_metadata(self):
        def request(operation, payload):
            return protocol.handle(json.dumps({"protocol_version": 6, "operation": operation, "payload": payload}),
                                   self.root, Path("/missing/renderer"))
        response, status = request("read_ui_preferences", {})
        self.assertEqual(status, 0)
        self.assertEqual(response["result"], {"schema_version": 1, "ui_language": "en", "warning": None})
        self.assertFalse(self.root.exists())
        response, status = request("set_ui_language", {"ui_language": "zh-CN"})
        self.assertEqual(status, 0)
        self.assertEqual(response["result"]["ui_language"], "zh-CN")
        response, status = request("set_ui_language", {"ui_language": "unknown"})
        self.assertEqual(status, 2)
        self.assertIn("Unsupported UI language", response["error"]["message"])
        self.assertEqual(response["error"]["localization"]["key"], "preferences.unsupported_language")
