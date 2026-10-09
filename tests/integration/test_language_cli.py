import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


class LanguageCliTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="language CLI 中文 ")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name) / "config"
        self.environment = dict(os.environ, CLAUDE_CONFIG_DIR=str(self.root), DISABLE_AUTOUPDATER="1")

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
        for ui_language in ("en", "zh-CN"):
            self.run_cli("config", "language", "set", ui_language)
            for output_language in ("en", "zh-CN"):
                with self.subTest(ui=ui_language, output=output_language):
                    result = self.run_cli("config", "set", "statusline-language", output_language)
                    self.assertEqual(result.returncode, 0, result.stderr)
                    expected = "Context 50% left" if output_language == "en" else "上下文 剩余 50%"
                    self.assertEqual(self.run_cli("render", content=payload).stdout.strip(), expected)
                    self.assertEqual(self.run_cli("--language", "en", "render", content=payload).stdout.strip(), expected)
                    self.assertEqual(self.run_cli("--language", "zh-CN", "render", content=payload).stdout.strip(), expected)
                    shown = json.loads(self.run_cli("config", "show", "--json").stdout)
                    self.assertEqual(shown["display"]["statusline_language"], output_language)
        self.run_cli("config", "language", "reset")
        self.assertEqual(self.run_cli("render", content=payload).stdout.strip(), "上下文 剩余 50%")

    def test_invalid_statusline_language_does_not_modify_configuration(self):
        self.run_cli("config", "set", "statusline-language", "zh-CN")
        path = self.root / "claude-statusline.json"
        before = path.read_bytes()
        result = self.run_cli("config", "set", "statusline-language", "auto")
        self.assertEqual(result.returncode, 2)
        self.assertEqual(path.read_bytes(), before)
