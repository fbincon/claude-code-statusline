"""Language additions change resources, not the runtime implementations."""

from contextlib import ExitStack, contextmanager
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest import mock

from claude_statusline.i18n import LANGUAGES, LANGUAGE_NAMES, translate
from claude_statusline.i18n.translator import catalogue, _catalogue
from tests.i18n.test_translation import generator, ROOT


class LanguageRegistryTests(unittest.TestCase):
    @contextmanager
    def fixture(self):
        with tempfile.TemporaryDirectory(prefix="i18n registry 日本語 ") as directory:
            root = Path(directory)
            package = root / "claude_statusline/i18n"
            locales = package / "locales"
            locales.mkdir(parents=True)
            names = package / "languages.json"
            names.write_text(json.dumps([{"code": "en", "name": "English"}, {"code": "fr", "name": "Français"}]))
            for code, entries in {
                "en": {"hello": "Hello {name}", "statusline.example": "Example {name}"},
                "fr": {"hello": "Bonjour {name}", "statusline.example": "Exemple {name}"},
            }.items():
                (locales / (code + ".json")).write_text(json.dumps(entries))
            with ExitStack() as stack:
                for name, value in {
                    "LOCALES": locales, "LANGUAGES_FILE": names,
                    "REGISTRY_OUTPUT": package / "_generated_languages.py",
                    "STATUSLINE_OUTPUT": package / "_generated_statusline",
                    "OUTPUT": root / "generated-locales.ts",
                }.items():
                    stack.enter_context(mock.patch.object(generator, name, value))
                yield root, package, locales, names

    def test_order_autonyms_coverage_and_real_translations(self):
        self.assertEqual(LANGUAGES, ("en", "zh-CN", "zh-Hant", "ja", "ko"))
        self.assertEqual(list(LANGUAGE_NAMES.values()), ["English", "简体中文", "繁體中文", "日本語", "한국어"])
        report = generator.coverage()
        for language in LANGUAGES:
            self.assertEqual(report[language]["missing"], [])
            self.assertEqual(report[language]["percent"], 100)
            self.assertEqual(report[language]["statusline_messages"], 220)
        for language, expected in {
            "zh-Hant": "界面語言：日本語",
            "ja": "UI 言語: 日本語",
            "ko": "UI 언어: 日本語",
        }.items():
            self.assertEqual(translate("cli.language", language, language="日本語"), expected)

    def test_new_registered_pack_generates_and_runs_without_business_code_edits(self):
        with self.fixture() as (root, package, _, _):
            for path, value in generator.generated_files().items():
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text(value, encoding="utf-8")
            (package.parent / "__init__.py").write_text("")
            for name in ("__init__.py", "translator.py", "registry.py", "statusline.py"):
                shutil.copyfile(ROOT / "src/claude_statusline/i18n" / name, package / name)
            result = subprocess.run(
                [sys.executable, "-c", "from claude_statusline.i18n import LANGUAGES, translate; "
                 "from claude_statusline.i18n.statusline import text; "
                 "assert LANGUAGES == ('en', 'fr'); "
                 "assert translate('hello', 'fr', name='Ada') == 'Bonjour Ada'; "
                 "assert text('example', 'fr', name='Ada') == 'Exemple Ada'; "
                 "assert text('example', 'unknown', name='Ada') == 'Example Ada'"],
                cwd=root, env=dict(os.environ, PYTHONPATH=str(root)),
                capture_output=True, text=True, encoding="utf-8",
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIn('["en", "fr"]', generator.OUTPUT.read_text())

    def test_partial_coverage_is_reported_but_cannot_generate_a_shipped_language(self):
        with self.fixture() as (_, _, locales, _):
            (locales / "fr.json").write_text('{"hello": "Bonjour {name}"}')
            self.assertEqual(generator.coverage()["fr"]["missing"], ["statusline.example"])
            with self.assertRaisesRegex(ValueError, "Translation keys differ"):
                generator.generated_files()

    def test_registry_rejects_duplicates_unsafe_names_missing_and_unregistered_packs(self):
        for entries in [
            [{"code": "en", "name": "English"}, {"code": "en", "name": "Duplicate"}],
            [{"code": "../en", "name": "English"}],
            [{"code": "fr", "name": "Français"}, {"code": "en", "name": "English"}],
            [{"code": "en", "name": "English\n"}],
            [{"code": "en", "name": ""}],
            [{"code": "en", "name": "English", "unknown": True}],
        ]:
            with self.subTest(entries=entries), self.fixture() as (_, _, _, names):
                names.write_text(json.dumps(entries))
                with self.assertRaises(ValueError):
                    generator.registry()
        with self.fixture() as (_, _, locales, _):
            (locales / "extra.json").write_text("{}")
            with self.assertRaisesRegex(ValueError, "unregistered"):
                generator.resources()
            (locales / "extra.json").unlink()
            (locales / "fr.json").unlink()
            with self.assertRaisesRegex(ValueError, "missing"):
                generator.resources()

    def test_cache_covers_registered_packs_and_unknown_names_do_not_evict_them(self):
        for language in LANGUAGES:
            catalogue(language)
        before = _catalogue.cache_info()
        for number in range(100):
            catalogue("unknown-" + str(number))
        after = _catalogue.cache_info()
        self.assertEqual(after.misses, before.misses)
        self.assertEqual(after.currsize, len(LANGUAGES))
        with mock.patch.dict(catalogue("ja"), {}, clear=True):
            self.assertEqual(translate("cli.language", "ja", language="x"), "UI language: x")

    def test_fresh_render_loads_only_selected_statusline_module_and_no_ui_json(self):
        for language, expected in {
            "en": "Context 50% left", "zh-Hant": "上下文 剩餘 50%",
            "ja": "コンテキスト 残り 50%", "ko": "컨텍스트 50% 남음",
        }.items():
            code = """
import json, sys
def audit(event, args):
    if event == 'open' and isinstance(args[0], str):
        name = args[0].replace(chr(92), '/')
        assert '/i18n/locales/' not in name and not name.endswith('statusline-ui.json'), name
sys.addaudithook(audit)
from claude_statusline.config import display
from claude_statusline.rendering import items
config = display.DEFAULT_CONFIG.with_updates(items=('context-remaining',), use_colors=False, scope_labels='off', statusline_language=sys.argv[1])
print(json.dumps({'rows':items.configured_rows({'context_window':{'remaining_percentage':50}},config,80),
 'modules':[name for name in sys.modules if name.startswith('claude_statusline.i18n._generated_statusline.')]}))
"""
            result = subprocess.run([sys.executable, "-c", code, language], capture_output=True, text=True, encoding="utf-8")
            self.assertEqual(result.returncode, 0, result.stderr)
            value = json.loads(result.stdout)
            self.assertEqual(value["rows"], [expected])
            self.assertEqual(value["modules"], ["claude_statusline.i18n._generated_statusline." + language.replace("-", "_").lower()])
