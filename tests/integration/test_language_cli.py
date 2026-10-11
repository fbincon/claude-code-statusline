import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

from claude_statusline.i18n import LANGUAGES
from claude_statusline.i18n.statusline import text as statusline_text

REMAINING = {
    "en": "Context 50% left",
    "zh-CN": "上下文 剩余 50%",
    "zh-Hant": "上下文 剩餘 50%",
    "ja": "コンテキスト 残り 50%",
    "ko": "컨텍스트 50% 남음",
}

class LanguageCliTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="language CLI 中文 ")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name) / "config"
        self.environment = dict(os.environ, CLAUDE_CONFIG_DIR=str(self.root), DISABLE_AUTOUPDATER="1")
        executable_dir = Path(sys.executable).parent
        self.environment["PATH"] = os.pathsep.join((str(executable_dir), str(executable_dir / "Scripts"), os.environ.get("PATH", "")))

    def run_cli(self, *arguments, content=None):
        return subprocess.run([sys.executable, "-m", "claude_statusline", *arguments], input=content,
                              env=self.environment, capture_output=True, text=True, encoding="utf-8")

    def test_default_set_override_and_reset(self):
        self.assertIn("show effective configuration", self.run_cli("config", "--help").stdout)
        self.assertFalse(self.root.exists())
        self.assertEqual(self.run_cli("config", "language", "set", "zh-CN").returncode, 0)
        path = self.root / "statusline-ui.json"
        before = path.read_bytes()
        self.assertIn("查看有效配置", self.run_cli("config", "--help").stdout)
        self.assertIn("show effective configuration", self.run_cli("--language", "en", "config", "--help").stdout)
        self.assertEqual(path.read_bytes(), before)
        shown = self.run_cli("config", "language", "show", "--json")
        self.assertEqual(json.loads(shown.stdout), {"schema_version": 1, "ui_language": "zh-CN"})
        self.assertEqual(self.run_cli("config", "language", "reset").returncode, 0)
        self.assertIn("show effective configuration", self.run_cli("config", "--help").stdout)

    def test_help_and_parser_errors_are_localized_including_groups(self):
        help_text = self.run_cli("--language", "zh-CN", "install", "--help").stdout
        self.assertIn("选项", help_text)
        self.assertIn("持续禁用", help_text)
        rejected = self.run_cli("--language", "zh-CN", "config", "set", "invalid-option", "x")
        self.assertEqual(rejected.returncode, 2)
        self.assertIn("无效选项", rejected.stderr)
        self.assertEqual(rejected.stdout, "")
        missing = self.run_cli("--language", "zh-CN", "config", "language", "set")
        self.assertIn("缺少必填参数", missing.stderr)

    def test_config_directory_is_resolved_before_help(self):
        other = Path(self.temp.name) / "other"
        self.run_cli("config", "--config-dir", str(other), "language", "set", "zh-CN")
        result = self.run_cli("config", "--config-dir", str(other), "--help")
        self.assertIn("查看有效配置", result.stdout)
        self.assertFalse(self.root.exists())

    def test_json_catalogue_and_actual_rendering_are_language_independent(self):
        a = self.run_cli("--language", "en", "config", "list-items", "--json")
        b = self.run_cli("--language", "zh-CN", "config", "list-items", "--json")
        self.assertEqual(a.stdout, b.stdout)
        self.assertEqual(json.loads(a.stdout)[0]["label"], "Model and effort")
        self.assertIn("当前模型标识", self.run_cli("--language", "zh-CN", "config", "list-items").stdout)
        payload = '{"model":{"id":"same-model"}}'
        before = self.run_cli("render", content=payload).stdout
        self.run_cli("config", "language", "set", "zh-CN")
        self.assertEqual(self.run_cli("render", content=payload).stdout, before)

    def test_all_interface_and_statusline_language_combinations_are_independent(self):
        self.assertEqual(self.run_cli("config", "set", "colors", "off").returncode, 0)
        payload = '{"context_window":{"remaining_percentage":50}}'
        for ui_language in LANGUAGES:
            self.run_cli("config", "language", "set", ui_language)
            for output_language in LANGUAGES:
                with self.subTest(ui=ui_language, output=output_language):
                    result = self.run_cli("config", "set", "statusline-language", output_language)
                    self.assertEqual(result.returncode, 0, result.stderr)
                    expected = REMAINING.get(output_language, statusline_text("context.remaining", output_language, percentage=50))
                    self.assertEqual(self.run_cli("render", content=payload).stdout.strip(), expected)
                    self.assertEqual(self.run_cli("--language", "en", "render", content=payload).stdout.strip(), expected)
                    self.assertEqual(self.run_cli("--language", "zh-CN", "render", content=payload).stdout.strip(), expected)
                    shown = json.loads(self.run_cli("config", "show", "--json").stdout)
                    self.assertEqual(shown["display"]["statusline_language"], output_language)
        self.run_cli("config", "language", "reset")
        self.assertEqual(self.run_cli("render", content=payload).stdout.strip(), statusline_text("context.remaining", LANGUAGES[-1], percentage=50))

    def test_new_language_help_errors_and_machine_catalogue(self):
        catalogue = self.run_cli("--language", "en", "config", "list-items", "--json").stdout
        for language, heading, required in (
            ("zh-Hant", "選項", "缺少必填參數"),
            ("ja", "オプション", "次の引数が必要です"),
            ("ko", "옵션", "다음 인수가 필요합니다"),
        ):
            with self.subTest(language=language):
                self.assertIn(heading, self.run_cli("--language", language, "--help").stdout)
                self.assertIn(required, self.run_cli("--language", language, "config", "language", "set").stderr)
                self.assertEqual(catalogue, self.run_cli("--language", language, "config", "list-items", "--json").stdout)

    def test_every_output_language_survives_portable_roundtrip_without_ui_changes(self):
        installed = self.run_cli("install", "--no-native-editor", "--no-experimental-slash-tui", "--no-native-timing", "--no-live-metrics")
        self.assertEqual(installed.returncode, 0, installed.stderr)
        label = "ラベル 한국어 自訂"
        self.assertEqual(self.run_cli("config", "item", "main", "model", "label", label).returncode, 0)
        for language in LANGUAGES:
            with self.subTest(language=language):
                self.assertEqual(self.run_cli("config", "language", "set", language).returncode, 0)
                preference = (self.root / "statusline-ui.json").read_bytes()
                self.assertEqual(self.run_cli("config", "set", "statusline-language", language).returncode, 0)
                exported = Path(self.temp.name) / (language + ".json")
                self.assertEqual(self.run_cli("config", "export", str(exported)).returncode, 0)
                self.assertEqual(self.run_cli("config", "set", "statusline-language", "en").returncode, 0)
                imported = self.run_cli("config", "import", str(exported))
                self.assertEqual(imported.returncode, 0, imported.stderr)
                shown = json.loads(self.run_cli("config", "show", "--json").stdout)["display"]
                self.assertEqual(shown["statusline_language"], language)
                self.assertEqual(shown["item_options"]["model"]["label"], label)
                self.assertEqual((self.root / "statusline-ui.json").read_bytes(), preference)

    def test_import_requires_installation_with_localized_owned_error(self):
        exported = Path(self.temp.name) / "before-install.json"
        self.assertEqual(self.run_cli("config", "export", str(exported)).returncode, 0)
        for language, expected in (
            ("zh-CN", "此 claude-statusline 可执行文件尚未配置"),
            ("zh-Hant", "此 claude-statusline 可執行文件尚未配置"),
            ("ja", "インストールされていません"),
            ("ko", "설치되지 않았습니다"),
        ):
            result = self.run_cli("--language", language, "config", "import", str(exported))
            self.assertEqual(result.returncode, 2)
            self.assertIn(expected, result.stderr)
            self.assertFalse((self.root / "settings.json").exists())

    def test_invalid_statusline_language_does_not_modify_configuration(self):
        self.run_cli("config", "set", "statusline-language", "zh-CN")
        path = self.root / "claude-statusline.json"
        before = path.read_bytes()
        result = self.run_cli("config", "set", "statusline-language", "auto")
        self.assertEqual(result.returncode, 2)
        self.assertEqual(path.read_bytes(), before)
