"""CLI identity edits preserve transactions, transfer and ambiguity protection."""

import json
import shlex
from pathlib import Path
from claude_statusline.config import commands, display, models
from tests.config.test_config_commands import ConfigCommandTestCase


class InstanceCommandTests(ConfigCommandTestCase):
    def command(self, *args):
        return commands.execute_config_namespace(
            commands.parse_slash_arguments(shlex.join(args)),
            self.config_dir,
            self.executable,
        )

    def test_copy_options_and_roundtrip_keep_identity(self):
        first = self.command("instance", "main", "add", "model").splitlines()[-1]
        second = self.command("instance", "main", "copy", first).splitlines()[-1]
        self.command("instance", "main", "set", second, "label", "副本 中文")
        self.command("instance", "main", "set", second, "number-format", "full")
        values = json.loads(self.command("instance", "main", "list", "--json"))
        by_id = {i["id"]: i for i in values}
        self.assertEqual(by_id[second]["options"]["label"], "副本 中文")
        self.assertIsNone(by_id[first]["options"]["label"])
        target = Path(self.tempdir.name) / "portable.json"
        self.command("export", str(target))
        self.assertEqual(
            json.loads(target.read_text())["draft"]["display"]["instances"], values
        )
        before = display.config_path(self.config_dir).read_bytes()
        self.command("import", str(target), "--dry-run")
        self.assertEqual(display.config_path(self.config_dir).read_bytes(), before)

    def test_legacy_ambiguity_and_invalid_edit_never_write_or_backup(self):
        self.command("instance", "main", "copy", "model-with-effort")
        path = display.config_path(self.config_dir)
        before = path.read_bytes()
        backups = set((self.config_dir / "backups" / "statusline").iterdir())
        for args in [
            ("item", "main", "model-with-effort", "label", "bad"),
            ("set-items", "model-with-effort"),
            ("layout", "explicit", "model-with-effort"),
            ("instance", "main", "set", "missing", "label", "bad"),
        ]:
            with self.assertRaises(models.ConfigCommandError):
                self.command(*args)
            self.assertEqual(path.read_bytes(), before)
            self.assertEqual(
                set((self.config_dir / "backups" / "statusline").iterdir()), backups
            )

    def test_unique_type_command_resolves_a_generated_id(self):
        identifier = self.command("instance", "main", "add", "hostname").splitlines()[
            -1
        ]
        self.command("item", "main", "hostname", "label", "Host")
        self.command("disable", "hostname")
        value = display.load_display_config(self.config_dir)
        node = next(i for i in value.instances if i.id == identifier)
        self.assertEqual(node.options.label, "Host")
        self.assertFalse(node.enabled)
        self.command("enable", "hostname")
        self.assertIn(identifier, display.load_display_config(self.config_dir).items)

    def test_presets_spacers_literal_text_and_instance_rows(self):
        self.install_minimal_settings()
        self.command("preset", "left-right")
        self.command(
            "layout",
            "--by-instance",
            "explicit",
            "model-with-effort,git,spacer,context-remaining",
        )
        identifier = self.command(
            "instance", "main", "add", "text", "--text", "inherit"
        ).splitlines()[-1]
        value = display.load_display_config(self.config_dir)
        self.assertEqual(
            next(i.text for i in value.instances if i.id == identifier), "inherit"
        )
        before = display.config_path(self.config_dir).read_bytes()
        with self.assertRaises(models.ConfigCommandError):
            self.command("instance", "main", "copy", "spacer")
        self.assertEqual(display.config_path(self.config_dir).read_bytes(), before)
        self.command("instance", "main", "move", identifier, "--before", "git")
        self.command("instance", "main", "disable", identifier)
        value = display.load_display_config(self.config_dir)
        self.assertEqual(value.layout.rows[0][1], identifier)
        self.command("instance", "main", "remove", identifier)
        self.assertNotIn(
            identifier, display.load_display_config(self.config_dir).layout.rows[0]
        )
