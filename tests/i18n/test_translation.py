import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest import mock

from claude_statusline.config import catalog
from claude_statusline.i18n import message, translate
from claude_statusline.i18n.translator import catalogue, present

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("i18n_generator", ROOT / "tools/generate_i18n.py")
generator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(generator)


class TranslationTests(unittest.TestCase):
    def test_catalogue_translations_are_complete_and_generated(self):
        resources = generator.resources()
        for item in catalog.ITEMS:
            for part in ("label", "description"):
                key = f"items.{item.scope}.{item.id}.{part}"
                self.assertEqual(resources["en"][key], getattr(item, part))
                self.assertTrue(resources["zh-CN"][key])
        self.assertEqual(generator.OUTPUT.read_text(encoding="utf-8"), generator.generated())

    def test_language_and_key_fallback_are_explicit(self):
        self.assertEqual(translate("cli.language", "unknown", language="zh-CN"), "UI language: zh-CN")
        self.assertEqual(translate("missing.key", "zh-CN"), "missing.key")
        with mock.patch.dict(catalogue("zh-CN"), {"cli.language": catalogue("en")["cli.language"]}):
            self.assertEqual(translate("cli.language", "zh-CN", language="en"), "UI language: en")

    def test_nested_error_metadata_preserves_english_and_translates_details(self):
        inner = message("errors.host.padding_must_be_an_integer_from_0")
        outer = message("cli.error", detail=RuntimeError(inner))
        self.assertEqual(str(outer), "error: padding must be an integer from 0 through 32")
        self.assertEqual(present(RuntimeError(outer), "zh-CN"), "错误：padding 必须为 0 至 32 的整数")
        self.assertEqual(outer.wire()["params"]["detail"]["key"], inner.key)
        self.assertEqual(present(OSError("external detail"), "zh-CN"), "external detail")

    def test_invalid_keys_placeholders_duplicates_and_controls_are_rejected(self):
        cases = [('{"k":"{value}"}', '{"k":"{other}"}'),
                 ('{"k":"ok"}', '{"different":"好"}'),
                 ('{"k":"ok"}', '{"k":"好","k":"重复"}'),
                 ('{"k":"ok"}', '{"k":"\\u001b"}'),
                 ('{"k":"{value.foo}"}', '{"k":"{value.foo}"}')]
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            for english, chinese in cases:
                with self.subTest(english=english, chinese=chinese):
                    (root / "en.json").write_text(english, encoding="utf-8")
                    (root / "zh-CN.json").write_text(chinese, encoding="utf-8")
                    with mock.patch.object(generator, "LOCALES", root), self.assertRaises(ValueError):
                        generator.resources()

    def test_resources_are_json_strings_only(self):
        for language in ("en", "zh-CN"):
            self.assertTrue(all(isinstance(k, str) and isinstance(v, str) for k, v in catalogue(language).items()))
        self.assertEqual(json.loads(json.dumps(message("cli.language", language="en"))), "UI language: en")
