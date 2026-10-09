"""Full-draft atomic saves share CLI/curses transactions and ownership checks."""

from contextlib import contextmanager
from dataclasses import replace
import copy
import io
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import sysconfig
import tempfile
import unittest
from unittest import mock

from claude_statusline.config import display, host, models, service, storage
from claude_statusline.integration import ownership
from claude_statusline.ui import editor, protocol


class ApplyProtocolTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="apply 中文 ' $` ")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.exe = self.root / "bin with spaces" / "claude-statusline"
        self.settings = self.root / "settings.json"
        self.settings.write_text(
            json.dumps(
                {
                    "statusLine": {
                        "type": "command",
                        "command": ownership.command_for(self.exe, "render"),
                        "refreshInterval": 1,
                    },
                    "subagentStatusLine": {
                        "type": "command",
                        "command": ownership.command_for(self.exe, "render-subagents"),
                    },
                    "permissions": {"allow": ["Read"]},
                }
            ),
            encoding="utf-8",
        )

    def request(self, operation, payload=None):
        return protocol.handle(
            json.dumps(
                {
                    "protocol_version": 6,
                    "operation": operation,
                    "payload": payload or {},
                }
            ),
            self.root,
            self.exe,
        )

    def read(self):
        response, status = self.request("read")
        self.assertEqual(status, 0, response)
        return response["result"]

    def test_external_and_client_saves_conflict_in_both_orders(self):
        for client_first in (False, True):
            with self.subTest(client_first=client_first):
                current = self.read()
                external = editor.EditorState.from_effective(
                    service.read_effective_config(self.root, self.exe)
                )
                external.host = replace(external.host, padding=2 if current["draft"]["host"]["padding"] != 2 else 3)
                client_draft = copy.deepcopy(current["draft"])
                client_draft["display"]["use_colors"] = not client_draft["display"]["use_colors"]
                settings = json.loads(self.settings.read_text())
                settings["permissions"]["allow"].append("Glob")
                self.settings.write_text(json.dumps(settings))
                if client_first:
                    _, status = self.request("apply", {
                        "draft": client_draft, "expected_revision": current["revision"],
                    })
                    self.assertEqual(status, 0)
                    before = self.settings.read_bytes(), display.config_path(self.root).read_bytes()
                    with mock.patch.object(service, "_backup_transaction") as backup:
                        with self.assertRaises(models.ConfigCommandError):
                            editor.save_configuration(self.root, self.exe, external)
                else:
                    editor.save_configuration(self.root, self.exe, external)
                    before = self.settings.read_bytes(), display.config_path(self.root).read_bytes()
                    with mock.patch.object(service, "_backup_transaction") as backup:
                        response, status = self.request("apply", {
                            "draft": client_draft, "expected_revision": current["revision"],
                        })
                        self.assertEqual(status, 2)
                        self.assertEqual(response["error"]["code"], "configuration_conflict")
                backup.assert_not_called()
                self.assertEqual(before, (self.settings.read_bytes(), display.config_path(self.root).read_bytes()))
                self.assertIn("Glob", json.loads(self.settings.read_text())["permissions"]["allow"])

    def test_two_editors_noop_and_unrelated_settings_preserved(self):
        first = self.read()
        second = self.read()
        settings = json.loads(self.settings.read_text())
        settings["permissions"]["allow"].append("Glob")
        settings["theme"] = "dark"
        self.settings.write_text(json.dumps(settings, indent=4), encoding="utf-8")
        first["draft"]["display"]["use_colors"] = False
        result, status = self.request(
            "apply", {"draft": first["draft"], "expected_revision": first["revision"]}
        )
        self.assertEqual(status, 0, result)
        self.assertTrue(result["result"]["changed"])
        self.assertIsNotNone(result["result"]["backup_dir"])
        updated = json.loads(self.settings.read_text())
        self.assertEqual(updated["permissions"]["allow"], ["Read", "Glob"])
        self.assertEqual(updated["theme"], "dark")
        before = display.config_path(self.root).read_bytes()
        with mock.patch.object(service, "_backup_transaction") as backup:
            stale, status = self.request(
                "apply",
                {"draft": second["draft"], "expected_revision": second["revision"]},
            )
        self.assertEqual(status, 2)
        self.assertEqual(stale["error"]["code"], "configuration_conflict")
        backup.assert_not_called()
        self.assertEqual(display.config_path(self.root).read_bytes(), before)
        current = result["result"]
        repeated, status = self.request(
            "apply",
            {"draft": current["draft"], "expected_revision": current["revision"]},
        )
        self.assertEqual(status, 0)
        self.assertFalse(repeated["result"]["changed"])
        self.assertIsNone(repeated["result"]["backup_dir"])

    def test_main_subagent_and_type_ownership_changes_conflict(self):
        original = self.settings.read_bytes()
        for key, field, value in (
            ("statusLine", "command", '"/different/claude-statusline" render'),
            (
                "subagentStatusLine",
                "command",
                '"/different/claude-statusline" render-subagents',
            ),
            ("statusLine", "type", "prompt"),
            ("subagentStatusLine", "type", "prompt"),
        ):
            self.settings.write_bytes(original)
            baseline = self.read()
            changed = json.loads(original)
            changed[key][field] = value
            self.settings.write_text(json.dumps(changed), encoding="utf-8")
            before = self.settings.read_bytes()
            result, status = self.request(
                "apply",
                {"draft": baseline["draft"], "expected_revision": baseline["revision"]},
            )
            self.assertEqual(status, 2, result)
            self.assertEqual(result["error"]["code"], "configuration_conflict")
            self.assertEqual(self.settings.read_bytes(), before)
            self.assertFalse(display.config_path(self.root).exists())

    def test_revision_is_checked_after_lock_acquisition(self):
        baseline = self.read()
        real_lock = storage._installation_lock

        @contextmanager
        def changed_while_waiting(directory):
            with real_lock(directory):
                changed = json.loads(self.settings.read_text())
                changed["statusLine"]["padding"] = 4
                self.settings.write_text(json.dumps(changed), encoding="utf-8")
                yield

        with mock.patch.object(storage, "_installation_lock", changed_while_waiting):
            result, status = self.request(
                "apply",
                {"draft": baseline["draft"], "expected_revision": baseline["revision"]},
            )
        self.assertEqual(status, 2)
        self.assertEqual(result["error"]["code"], "configuration_conflict")
        self.assertEqual(
            json.loads(self.settings.read_text())["statusLine"]["padding"], 4
        )

    def test_rollback_after_settings_write_and_missing_installation(self):
        baseline = self.read()
        baseline["draft"]["host"]["padding"] = 3
        before = self.settings.read_bytes()
        with mock.patch.object(
            display,
            "write_display_config",
            side_effect=display.DisplayConfigError("injected late failure"),
        ):
            result, status = self.request(
                "apply",
                {"draft": baseline["draft"], "expected_revision": baseline["revision"]},
            )
        self.assertEqual(status, 2)
        self.assertEqual(result["error"]["code"], "io_error")
        self.assertEqual(self.settings.read_bytes(), before)
        self.assertFalse(display.config_path(self.root).exists())
        self.settings.unlink()
        uninstalled = self.read()
        result, status = self.request(
            "apply",
            {
                "draft": uninstalled["draft"],
                "expected_revision": uninstalled["revision"],
            },
        )
        self.assertEqual(status, 2)
        self.assertEqual(result["error"]["code"], "not_installed")
        self.assertFalse(self.settings.exists())
        self.assertFalse(display.config_path(self.root).exists())

    def test_invalid_apply_never_locks_or_backs_up(self):
        baseline = self.read()
        for revision in (None, "", "x" * 64, True):
            with (
                mock.patch.object(storage, "_installation_lock") as lock,
                mock.patch.object(service, "_backup_transaction") as backup,
            ):
                result, status = self.request(
                    "apply", {"draft": baseline["draft"], "expected_revision": revision}
                )
            self.assertEqual(status, 2)
            lock.assert_not_called()
            backup.assert_not_called()
        invalid = baseline["draft"]
        invalid["display"]["items"] = ["git", "git"]
        with mock.patch.object(storage, "_installation_lock") as lock:
            result, status = self.request(
                "apply", {"draft": invalid, "expected_revision": baseline["revision"]}
            )
        self.assertEqual(status, 2)
        lock.assert_not_called()

    def test_apply_requires_every_draft_field_before_locking(self):
        baseline = self.read()
        drafts = []
        for section in ("display", "host"):
            for field in baseline["draft"][section]:
                draft = copy.deepcopy(baseline["draft"])
                del draft[section][field]
                drafts.append(draft)
        for field in ("enabled", "items"):
            draft = copy.deepcopy(baseline["draft"])
            del draft["display"]["subagents"][field]
            drafts.append(draft)
        legacy = copy.deepcopy(baseline["draft"])
        legacy["display"] = {k: v for k, v in legacy["display"].items() if k in display.V1_DISPLAY_KEYS}
        legacy["display"]["schema_version"] = 1
        legacy["display"].pop("scope_labels", None)
        legacy["display"].pop("subagents", None)
        drafts.append(legacy)
        before = self.settings.read_bytes()
        with mock.patch.object(storage, "_installation_lock") as lock:
            for draft in drafts:
                response, status = self.request(
                    "apply", {"draft": draft, "expected_revision": baseline["revision"]}
                )
                self.assertEqual(status, 2, response)
            lock.assert_not_called()
        self.assertEqual(self.settings.read_bytes(), before)
        self.assertFalse(display.config_path(self.root).exists())

    def test_legacy_draft_error_tracks_the_supported_schema_without_writes(self):
        baseline = self.read()
        legacy = copy.deepcopy(baseline["draft"])
        legacy["display"] = {
            key: value
            for key, value in legacy["display"].items()
            if key in display.V1_DISPLAY_KEYS
        }
        legacy["display"]["schema_version"] = 1
        before = self.settings.read_bytes()
        for version in (display.SCHEMA_VERSION, display.SCHEMA_VERSION + 1):
            with (
                self.subTest(version=version),
                mock.patch.object(display, "SCHEMA_VERSION", version),
                mock.patch.object(storage, "_installation_lock") as lock,
            ):
                response, status = self.request(
                    "apply", {"draft": legacy, "expected_revision": baseline["revision"]}
                )
                self.assertEqual(status, 2)
                self.assertEqual(response["error"]["code"], "invalid_configuration")
                self.assertEqual(
                    response["error"]["message"],
                    f"apply requires the complete schema v{version} draft returned by read",
                )
                lock.assert_not_called()
        self.assertEqual(self.settings.read_bytes(), before)
        self.assertFalse(display.config_path(self.root).exists())

    def test_legacy_file_is_read_without_writes_and_migrated_on_apply(self):
        legacy = display.DEFAULT_CONFIG.to_dict()
        legacy = {k: v for k, v in legacy.items() if k in display.V1_DISPLAY_KEYS}
        legacy["schema_version"] = 1
        legacy.pop("scope_labels", None)
        legacy.pop("subagents", None)
        path = display.config_path(self.root)
        original = json.dumps(legacy, indent=4).encode("utf-8")
        path.write_bytes(original)
        baseline = self.read()
        self.assertEqual(path.read_bytes(), original)
        self.assertEqual(baseline["draft"]["display"]["schema_version"], 6)
        saved, status = self.request(
            "apply",
            {"draft": baseline["draft"], "expected_revision": baseline["revision"]},
        )
        self.assertEqual(status, 0, saved)
        self.assertEqual(json.loads(path.read_bytes())["schema_version"], 6)
        backup = Path(saved["result"]["backup_dir"]) / "claude-statusline.json.before"
        self.assertEqual(backup.read_bytes(), original)

    def test_fresh_snapshot_cannot_save_foreign_installation(self):
        original = self.settings.read_bytes()
        for key, field, value in (
            ("statusLine", "command", '"/different/claude-statusline" render'),
            (
                "subagentStatusLine",
                "command",
                '"/different/claude-statusline" render-subagents',
            ),
            ("statusLine", "type", "prompt"),
            ("subagentStatusLine", "type", "prompt"),
        ):
            with self.subTest(key=key, field=field):
                settings = json.loads(original)
                settings[key][field] = value
                self.settings.write_text(json.dumps(settings), encoding="utf-8")
                baseline = self.read()
                self.assertEqual(baseline["installation"][key]["state"], "foreign")
                baseline["draft"]["host"]["padding"] = 5
                before = self.settings.read_bytes()
                with mock.patch.object(service, "_backup_transaction") as backup:
                    response, status = self.request(
                        "apply",
                        {
                            "draft": baseline["draft"],
                            "expected_revision": baseline["revision"],
                        },
                    )
                self.assertEqual(status, 2, response)
                self.assertEqual(response["error"]["code"], "ownership_mismatch")
                backup.assert_not_called()
                self.assertEqual(self.settings.read_bytes(), before)
                self.assertFalse(display.config_path(self.root).exists())

    def test_bound_entry_uses_its_own_identity(self):
        stdout = io.StringIO()
        args = type("Args", (), {"config_dir": self.root})()
        with (
            mock.patch.object(sys, "argv", [str(self.exe)]),
            mock.patch.object(
                sys,
                "stdin",
                io.StringIO('{"protocol_version":6,"operation":"read","payload":{}}'),
            ),
            mock.patch.object(sys, "stdout", stdout),
            mock.patch.object(
                ownership,
                "resolve_cli_executable",
                wraps=ownership.resolve_cli_executable,
            ) as resolve,
        ):
            self.assertEqual(protocol.main(args), 0)
        resolve.assert_called_once_with(self.exe)
        self.assertTrue(json.loads(stdout.getvalue())["result"]["installed"])

    def test_actual_cli_read_apply_and_stale_request_are_json_only(self):
        executable = Path(sysconfig.get_path("scripts")) / (
            "claude-statusline.exe" if os.name == "nt" else "claude-statusline"
        )
        self.assertTrue(executable.is_file())
        if os.name != "nt":
            # Bind a source entry through a path containing spaces, Chinese,
            # quotes, dollar signs and backticks while PATH names another CLI.
            self.exe.parent.mkdir()
            shutil.copy2(executable, self.exe)
            executable = self.exe
        settings = json.loads(self.settings.read_text(encoding="utf-8"))
        for key, operation in (
            ("statusLine", "render"),
            ("subagentStatusLine", "render-subagents"),
        ):
            settings[key]["command"] = ownership.command_for(
                Path(executable), operation
            )
        self.settings.write_text(json.dumps(settings), encoding="utf-8")

        def invoke(operation, payload):
            process = subprocess.run(
                [str(executable), "ui", "--config-dir", str(self.root)],
                input=json.dumps(
                    {"protocol_version": 6, "operation": operation, "payload": payload}
                ).encode("utf-8"),
                capture_output=True,
                check=False,
                timeout=30,
            )
            self.assertEqual(process.stderr, b"")
            return json.loads(process.stdout), process.returncode

        baseline, status = invoke("read", {})
        self.assertEqual(status, 0, baseline)
        original = copy.deepcopy(baseline["result"]["draft"])
        baseline["result"]["draft"]["display"]["items"] = ["git"]
        payload = {
            "draft": baseline["result"]["draft"],
            "expected_revision": baseline["result"]["revision"],
        }
        saved, status = invoke("apply", payload)
        self.assertEqual(status, 0, saved)
        self.assertEqual(saved["result"]["draft"]["display"]["items"], ["git"])
        stale, status = invoke("apply", {**payload, "draft": original})
        self.assertEqual(status, 2, stale)
        self.assertEqual(stale["error"]["code"], "configuration_conflict")

    def test_cli_curses_and_json_apply_equivalence(self):
        selected = {
            "items": ["git", "model-with-effort"],
            "colors": False,
            "palette": "ansi",
            "directory_style": "basename",
            "separator_style": "compact",
            "scope_labels": "always",
            "subagent_items": ["status", "name", "elapsed"],
            "subagent_statusline": False,
            "padding": 4,
            "refresh_interval": "event",
            "hide_vim_mode_indicator": True,
        }
        initial = self.settings.read_bytes()
        outputs = []
        for frontend in ("cli", "curses", "json"):
            self.settings.write_bytes(initial)
            display.config_path(self.root).unlink(missing_ok=True)
            effective = service.read_effective_config(self.root, self.exe)
            if frontend == "cli":
                service.apply_configuration(self.root, self.exe, **selected)
            else:
                edited = effective.display.with_updates(
                    items=tuple(selected["items"]),
                    use_colors=False,
                    palette="ansi",
                    directory_style="basename",
                    separator_style="compact",
                    scope_labels="always",
                    subagents=effective.display.subagents.with_updates(
                        enabled=False, items=tuple(selected["subagent_items"])
                    ),
                )
                edited_host = models.HostConfig(4, None, True)
                if frontend == "curses":
                    state = editor.EditorState.from_effective(effective)
                    state.display, state.host = edited, edited_host
                    state.item_order, state.enabled = (
                        list(edited.items),
                        set(edited.items),
                    )
                    state.subagent_item_order, state.subagent_enabled = (
                        list(edited.subagents.items),
                        set(edited.subagents.items),
                    )
                    editor.save_configuration(self.root, self.exe, state)
                else:
                    response, status = self.request(
                        "apply",
                        {
                            "draft": {
                                "display": edited.to_dict(),
                                "host": edited_host.to_dict(),
                            },
                            "expected_revision": effective.revision,
                        },
                    )
                    self.assertEqual(status, 0, response)
            outputs.append(service.read_effective_config(self.root, self.exe).to_dict())
        self.assertEqual(outputs[0], outputs[1])
        self.assertEqual(outputs[1], outputs[2])

    def test_curses_expected_snapshot_protects_subagent_owner(self):
        state = editor.EditorState.from_effective(
            service.read_effective_config(self.root, self.exe)
        )
        changed = json.loads(self.settings.read_text())
        changed["subagentStatusLine"]["command"] = "foreign-renderer"
        self.settings.write_text(json.dumps(changed), encoding="utf-8")
        with self.assertRaises(models.ConfigConflict):
            editor.save_configuration(self.root, self.exe, state)

    def test_owned_command_whitespace_is_semantically_equivalent(self):
        baseline = self.read()
        changed = json.loads(self.settings.read_text())
        changed["statusLine"]["command"] += "  "
        self.settings.write_text(json.dumps(changed, indent=3), encoding="utf-8")
        self.assertEqual(baseline["revision"], self.read()["revision"])
        self.assertTrue(host._host_from_settings(changed, self.exe)[1])

    @unittest.skipIf(os.name == "nt", "POSIX symbolic path aliases")
    def test_symbolic_backend_aliases_with_shell_characters_share_owned_identity(self):
        real = self.root / "real backend" / "claude-statusline"
        real.parent.mkdir()
        real.write_text("backend")
        alias = self.root / "alias backend" / "claude-statusline"
        alias.parent.mkdir()
        alias.symlink_to(real)
        settings = json.loads(self.settings.read_text())
        for key, operation in [
            ("statusLine", "render"),
            ("subagentStatusLine", "render-subagents"),
        ]:
            settings[key]["command"] = ownership.command_for(alias, operation)
        self.settings.write_text(json.dumps(settings))
        baseline, status = protocol.handle(
            json.dumps({"protocol_version": 6, "operation": "read", "payload": {}}),
            self.root,
            real,
        )
        self.assertEqual(status, 0)
        self.assertEqual(
            baseline["result"]["installation"]["subagentStatusLine"]["state"], "owned"
        )
        draft = baseline["result"]["draft"]
        draft["display"]["use_colors"] = False
        response, status = protocol.handle(
            json.dumps(
                {
                    "protocol_version": 6,
                    "operation": "apply",
                    "payload": {
                        "draft": draft,
                        "expected_revision": baseline["result"]["revision"],
                    },
                }
            ),
            self.root,
            real,
        )
        self.assertEqual(status, 0, response)
        self.assertTrue(response["result"]["changed"])
