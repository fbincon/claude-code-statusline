"""Tests for deterministic display and Claude host configuration commands."""

import json
import tempfile
import threading
import unittest
from pathlib import Path
from unittest import mock

from claude_statusline import config_commands as cc
from claude_statusline import display_config as dc
from claude_statusline import installer


class ConfigCommandTestCase(unittest.TestCase):
    def setUp(self):
        self.tempdir = tempfile.TemporaryDirectory(prefix="statusline-command-test-")
        self.config_dir = Path(self.tempdir.name) / "claude"
        self.executable = Path(self.tempdir.name) / "bin" / "claude-statusline"
        self.executable.parent.mkdir()
        self.executable.write_text("#!/bin/sh\n", encoding="utf-8")

    def tearDown(self):
        self.tempdir.cleanup()

    @property
    def settings_path(self):
        return self.config_dir / "settings.json"

    def install_minimal_settings(self, **host):
        self.config_dir.mkdir(parents=True, exist_ok=True)
        status_line = {
            "type": "command",
            "command": installer.command_for(self.executable, "render"),
            "refreshInterval": 1,
        }
        status_line.update(host)
        self.settings_path.write_text(
            json.dumps({"statusLine": status_line}) + "\n", encoding="utf-8"
        )


class DisplayMutationTests(ConfigCommandTestCase):
    def test_set_enable_disable_and_order(self):
        cc.set_items(self.config_dir, self.executable, ["git", "tokens"])
        self.assertEqual(
            dc.load_display_config(self.config_dir).items, ("git", "tokens")
        )

        cc.enable_items(
            self.config_dir,
            self.executable,
            ["context-remaining", "model-with-effort"],
        )
        self.assertEqual(
            dc.load_display_config(self.config_dir).items,
            ("git", "tokens", "context-remaining", "model-with-effort"),
        )

        cc.disable_items(self.config_dir, self.executable, ["tokens"])
        self.assertEqual(
            dc.load_display_config(self.config_dir).items,
            ("git", "context-remaining", "model-with-effort"),
        )

        cc.order_items(
            self.config_dir,
            self.executable,
            ["model-with-effort", "git", "context-remaining"],
        )
        self.assertEqual(
            dc.load_display_config(self.config_dir).items,
            ("model-with-effort", "git", "context-remaining"),
        )

    def test_order_must_match_enabled_set_without_writing(self):
        cc.set_items(self.config_dir, self.executable, ["git", "tokens"])
        path = dc.config_path(self.config_dir)
        before = path.read_bytes()
        with self.assertRaises(cc.ConfigCommandError):
            cc.order_items(self.config_dir, self.executable, ["git"])
        self.assertEqual(path.read_bytes(), before)

    def test_empty_set_items_disables_everything(self):
        cc.set_items(self.config_dir, self.executable, [])
        self.assertEqual(dc.load_display_config(self.config_dir).items, ())

    def test_display_options_work_before_statusline_is_installed(self):
        cc.set_option(self.config_dir, self.executable, "colors", "off")
        cc.set_option(self.config_dir, self.executable, "palette", "ansi")
        cc.set_option(self.config_dir, self.executable, "directory-style", "basename")
        config = dc.load_display_config(self.config_dir)
        self.assertFalse(config.use_colors)
        self.assertEqual(config.palette, "ansi")
        self.assertEqual(config.directory_style, "basename")
        self.assertFalse(self.settings_path.exists())

    def test_unknown_or_duplicate_items_are_rejected(self):
        for items in (["clock"], ["git", "git"]):
            with self.subTest(items=items), self.assertRaises(cc.ConfigCommandError):
                cc.set_items(self.config_dir, self.executable, items)

    def test_concurrent_enables_are_serialized_without_lost_updates(self):
        cc.set_items(self.config_dir, self.executable, [])
        items = [
            "model-with-effort",
            "current-dir",
            "git",
            "context-remaining",
            "tokens",
        ]
        barrier = threading.Barrier(len(items))
        errors = []

        def enable(item):
            try:
                barrier.wait()
                cc.enable_items(self.config_dir, self.executable, [item])
            except Exception as exc:  # noqa: BLE001 - report worker failures in main thread
                errors.append(exc)

        threads = [threading.Thread(target=enable, args=(item,)) for item in items]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(timeout=5)

        self.assertFalse(any(thread.is_alive() for thread in threads))
        self.assertEqual(errors, [])
        self.assertEqual(set(dc.load_display_config(self.config_dir).items), set(items))

    def test_subagent_set_enable_disable_and_order(self):
        cc.set_subagent_items(self.config_dir, self.executable, ["name", "status"])
        cc.enable_subagent_items(
            self.config_dir, self.executable, ["elapsed", "tokens"]
        )
        cc.disable_subagent_items(self.config_dir, self.executable, ["status"])
        cc.order_subagent_items(
            self.config_dir, self.executable, ["tokens", "elapsed", "name"]
        )
        self.assertEqual(
            dc.load_display_config(self.config_dir).subagents.items,
            ("tokens", "elapsed", "name"),
        )
        with self.assertRaises(cc.ConfigCommandError):
            cc.order_subagent_items(
                self.config_dir, self.executable, ["tokens", "name"]
            )

    def test_scope_and_subagent_statusline_options(self):
        cc.set_option(self.config_dir, self.executable, "scope-labels", "always")
        cc.set_option(
            self.config_dir, self.executable, "subagent-statusline", "off"
        )
        display = dc.load_display_config(self.config_dir)
        self.assertEqual(display.scope_labels, "always")
        self.assertFalse(display.subagents.enabled)


class HostAndTransactionTests(ConfigCommandTestCase):
    def test_host_option_requires_owned_statusline(self):
        with self.assertRaises(cc.ConfigCommandError):
            cc.set_option(self.config_dir, self.executable, "padding", "2")

    def test_host_options_update_only_owned_statusline_fields(self):
        self.install_minimal_settings(custom="kept")
        cc.set_option(self.config_dir, self.executable, "padding", "2")
        cc.set_option(self.config_dir, self.executable, "refresh-interval", "event")
        cc.set_option(self.config_dir, self.executable, "hide-vim-mode-indicator", "on")
        settings = json.loads(self.settings_path.read_text(encoding="utf-8"))
        status_line = settings["statusLine"]
        self.assertEqual(status_line["padding"], 2)
        self.assertNotIn("refreshInterval", status_line)
        self.assertTrue(status_line["hideVimModeIndicator"])
        self.assertEqual(status_line["custom"], "kept")

    def test_complete_apply_updates_both_files_and_creates_one_backup(self):
        self.install_minimal_settings()
        result = cc.apply_configuration(
            self.config_dir,
            self.executable,
            items=["git", "context-remaining"],
            colors="off",
            palette="ansi",
            directory_style="home",
            separator_style="compact",
            padding="4",
            refresh_interval="5",
            hide_vim_mode_indicator="on",
        )
        self.assertTrue(result.changed)
        self.assertTrue((result.backup_dir / "settings.json.before").is_file())
        self.assertTrue((result.backup_dir / "claude-statusline.json.absent").is_file())
        effective = cc.read_effective_config(self.config_dir, self.executable)
        self.assertEqual(effective.display.items, ("git", "context-remaining"))
        self.assertFalse(effective.display.use_colors)
        self.assertEqual(effective.host, cc.HostConfig(4, 5, True))

    def test_expected_conflict_fails_before_backup_without_changing_bytes(self):
        self.install_minimal_settings()
        baseline = cc.read_effective_config(self.config_dir, self.executable)
        cc.set_option(self.config_dir, self.executable, "padding", "3")
        settings_before = self.settings_path.read_bytes()
        display_path = dc.config_path(self.config_dir)
        display_before = display_path.read_bytes() if display_path.exists() else None

        with (
            mock.patch.object(cc, "_backup_transaction") as backup,
            self.assertRaisesRegex(cc.ConfigCommandError, "changed while"),
        ):
            cc.apply_configuration(
                self.config_dir,
                self.executable,
                items=["git"],
                colors="off",
                palette="ansi",
                directory_style="home",
                separator_style="compact",
                padding="2",
                refresh_interval="5",
                hide_vim_mode_indicator="on",
                expected=baseline,
            )
        backup.assert_not_called()
        self.assertEqual(self.settings_path.read_bytes(), settings_before)
        self.assertEqual(
            display_path.read_bytes() if display_path.exists() else None,
            display_before,
        )

    def test_expected_ignores_unrelated_settings_and_merges_latest_fields(self):
        self.install_minimal_settings()
        baseline = cc.read_effective_config(self.config_dir, self.executable)
        settings = json.loads(self.settings_path.read_text(encoding="utf-8"))
        settings["permissions"] = {"allow": ["Read"]}
        self.settings_path.write_text(json.dumps(settings) + "\n", encoding="utf-8")
        result = cc.apply_configuration(
            self.config_dir,
            self.executable,
            items=list(baseline.display.items),
            colors="on",
            palette="default",
            directory_style="full",
            separator_style="classic",
            padding="2",
            refresh_interval="1",
            hide_vim_mode_indicator="off",
            expected=baseline,
        )
        self.assertTrue(result.changed)
        updated = json.loads(self.settings_path.read_text(encoding="utf-8"))
        self.assertEqual(updated["permissions"], {"allow": ["Read"]})
        self.assertEqual(updated["statusLine"]["padding"], 2)

    def test_late_display_write_failure_rolls_back_settings(self):
        self.install_minimal_settings()
        before = self.settings_path.read_bytes()
        with (
            mock.patch.object(
                dc, "write_display_config", side_effect=dc.DisplayConfigError("boom")
            ),
            self.assertRaises(cc.ConfigCommandError),
        ):
            cc.apply_configuration(
                self.config_dir,
                self.executable,
                items=["git"],
                colors="on",
                palette="default",
                directory_style="full",
                separator_style="classic",
                padding="2",
                refresh_interval="2",
                hide_vim_mode_indicator="off",
            )
        self.assertEqual(self.settings_path.read_bytes(), before)
        self.assertFalse(dc.config_path(self.config_dir).exists())

    def test_reset_repairs_invalid_display_and_restores_host_defaults(self):
        self.install_minimal_settings(
            padding=4,
            refreshInterval=5,
            hideVimModeIndicator=True,
        )
        path = dc.config_path(self.config_dir)
        path.write_text("{broken", encoding="utf-8")
        result = cc.reset_configuration(self.config_dir, self.executable)
        self.assertTrue(result.changed)
        self.assertFalse(path.exists())
        status_line = json.loads(self.settings_path.read_text(encoding="utf-8"))[
            "statusLine"
        ]
        self.assertEqual(status_line["refreshInterval"], 1)
        self.assertNotIn("padding", status_line)
        self.assertNotIn("hideVimModeIndicator", status_line)

    def test_bounds_are_enforced(self):
        self.install_minimal_settings()
        for option, value in (
            ("padding", "33"),
            ("padding", "-1"),
            ("refresh-interval", "0"),
            ("refresh-interval", "3601"),
        ):
            with (
                self.subTest(option=option, value=value),
                self.assertRaises(cc.ConfigCommandError),
            ):
                cc.set_option(self.config_dir, self.executable, option, value)

    def test_v1_is_read_only_until_first_save_then_backed_up_as_raw_bytes(self):
        self.install_minimal_settings()
        path = dc.config_path(self.config_dir)
        legacy = {
            "schema_version": 1,
            "items": ["git"],
            "use_colors": True,
            "palette": "default",
            "directory_style": "full",
            "separator_style": "classic",
        }
        raw = (json.dumps(legacy, separators=(",", ":")) + "\n").encode()
        path.write_bytes(raw)
        cc.read_effective_config(self.config_dir, self.executable)
        self.assertEqual(path.read_bytes(), raw)

        result = cc.set_option(
            self.config_dir, self.executable, "scope-labels", "always"
        )
        self.assertEqual(
            (result.backup_dir / "claude-statusline.json.before").read_bytes(),
            raw,
        )
        stored = json.loads(path.read_text(encoding="utf-8"))
        self.assertEqual(stored["schema_version"], 2)
        self.assertEqual(stored["items"], ["git"])
        self.assertEqual(stored["scope_labels"], "always")

    def test_old_apply_shape_preserves_v2_subagent_values(self):
        self.install_minimal_settings()
        custom = dc.DEFAULT_CONFIG.with_updates(
            scope_labels="always",
            subagents=dc.SubagentDisplayConfig(
                enabled=False, items=("name", "elapsed")
            ),
        )
        dc.write_display_config(self.config_dir, custom)
        cc.apply_configuration(
            self.config_dir,
            self.executable,
            items=["git"],
            colors="off",
            palette="ansi",
            directory_style="home",
            separator_style="compact",
            padding=2,
            refresh_interval=5,
            hide_vim_mode_indicator="on",
        )
        display = dc.load_display_config(self.config_dir)
        self.assertEqual(display.scope_labels, "always")
        self.assertFalse(display.subagents.enabled)
        self.assertEqual(display.subagents.items, ("name", "elapsed"))


class ParserAndFormattingTests(ConfigCommandTestCase):
    def test_slash_parser_accepts_documented_commands_and_rejects_unknown(self):
        parsed = cc.parse_slash_arguments("set colors off")
        self.assertEqual(parsed.config_action, "set")
        self.assertEqual(parsed.option, "colors")
        self.assertEqual(parsed.value, "off")
        with self.assertRaises(cc.ConfigCommandError):
            cc.parse_slash_arguments("unknown")

    def test_show_and_list_json_are_machine_readable(self):
        show = cc.parse_slash_arguments("show --json")
        shown = json.loads(
            cc.execute_config_namespace(show, self.config_dir, self.executable)
        )
        self.assertEqual(shown["display"]["items"], list(dc.DEFAULT_ITEMS))
        listing = cc.parse_slash_arguments("list-items --json")
        listed = json.loads(
            cc.execute_config_namespace(listing, self.config_dir, self.executable)
        )
        self.assertEqual([item["id"] for item in listed], list(dc.ITEM_CATALOG))
        subagents = cc.parse_slash_arguments("subagents list-items --json")
        subagent_list = json.loads(
            cc.execute_config_namespace(
                subagents, self.config_dir, self.executable
            )
        )
        self.assertEqual(
            [item["id"] for item in subagent_list],
            list(dc.SUBAGENT_ITEM_CATALOG),
        )
        self.assertIn("subagent_statusline", shown)
        self.assertEqual(
            set(shown["subagent_statusline"]),
            {"enabled", "installed", "state"},
        )

    def test_slash_parser_accepts_all_subagent_commands(self):
        for command, action in (
            ("subagents set-items", "set-items"),
            ("subagents enable tokens", "enable"),
            ("subagents disable task", "disable"),
            ("subagents order", "order"),
        ):
            with self.subTest(command=command):
                parsed = cc.parse_slash_arguments(command)
                self.assertEqual(parsed.config_action, "subagents")
                self.assertEqual(parsed.subagent_action, action)

    def test_show_classifies_all_subagent_statusline_states(self):
        self.install_minimal_settings()
        cases = (
            (None, (2, 1, 205), "absent", False),
            (
                installer.command_for(self.executable, "render-subagents"),
                (2, 1, 205),
                "owned",
                True,
            ),
            ("third-party", (2, 1, 205), "foreign", False),
            (
                installer.command_for(self.executable, "render-subagents"),
                (2, 1, 204),
                "unsupported",
                False,
            ),
        )
        for command, version, state, installed in cases:
            with self.subTest(state=state):
                settings = json.loads(
                    self.settings_path.read_text(encoding="utf-8")
                )
                if command is None:
                    settings.pop("subagentStatusLine", None)
                else:
                    settings["subagentStatusLine"] = {
                        "type": "command",
                        "command": command,
                    }
                self.settings_path.write_text(
                    json.dumps(settings) + "\n", encoding="utf-8"
                )
                with mock.patch.object(
                    installer, "detect_claude_version", return_value=version
                ):
                    effective = cc.read_effective_config(
                        self.config_dir, self.executable
                    )
                self.assertEqual(effective.subagent_statusline.state, state)
                self.assertEqual(
                    effective.subagent_statusline.installed, installed
                )


if __name__ == "__main__":
    unittest.main(verbosity=2)
