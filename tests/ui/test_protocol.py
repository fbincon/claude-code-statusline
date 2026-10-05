"""Strict JSON input, locked snapshots and side-effect-free sample previews."""

import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest import mock

from claude_statusline.config import display, models, service
from claude_statusline.rendering import layout, preview, spans
from claude_statusline.runtime import git, usage
from claude_statusline.ui import protocol


def draft():
    return {
        "display": display.DEFAULT_CONFIG.to_dict(),
        "host": models.DEFAULT_HOST_CONFIG.to_dict(),
    }


class ProtocolTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="contract 中文 $` quote' ")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name) / "not created"
        self.exe = Path(sys.executable).parent / "claude-statusline"

    def request(self, operation, payload=None, **extra):
        return protocol.handle(
            json.dumps(
                {
                    "protocol_version": 4,
                    "operation": operation,
                    "payload": {} if payload is None else payload,
                    **extra,
                }
            ),
            self.root,
            self.exe,
        )

    def test_invalid_envelopes_and_json_do_not_create_paths(self):
        for raw in ("", "[]", "{", '{"x":1,"x":2}', '{"x":NaN}'):
            result, status = protocol.handle(raw, self.root, self.exe)
            self.assertEqual(status, 2)
            self.assertIn("error", result)
        for op, extra in (
            ("unknown", {}),
            ("read", {"protocol_version": True}),
            ("read", {"extra": 1}),
        ):
            result, status = self.request(op, **extra)
            self.assertEqual(status, 2)
            self.assertIn("error", result)
        self.assertFalse(self.root.exists())

    def test_describe_and_missing_observations_are_not_host_support(self):
        with mock.patch.object(
            protocol.capabilities, "detect_claude_version", return_value=None
        ):
            result, status = self.request("describe")
        self.assertEqual(status, 0)
        self.assertEqual(len(result["result"]["catalog"]), 74)
        caps = result["result"]["capabilities"]
        self.assertEqual(caps["native_mod"], "unknown")
        self.assertEqual(caps["data_observation"], "not_observed")
        self.assertIsNone(caps["native_mod_loaded"])
        self.assertFalse(self.root.exists())

    def test_read_revision_ignores_unrelated_settings_and_json_formatting(self):
        self.root.mkdir()
        settings = {
            "statusLine": {
                "type": "command",
                "command": f'"{self.exe}" render',
                "refreshInterval": 1,
            }
        }
        path = self.root / "settings.json"
        path.write_text(json.dumps(settings), encoding="utf-8")
        first, status = self.request("read")
        self.assertEqual(status, 0)
        settings["permissions"] = {"allow": ["Read"]}
        path.write_text(json.dumps(settings, indent=4), encoding="utf-8")
        second, _ = self.request("read")
        self.assertEqual(first["result"]["revision"], second["result"]["revision"])
        settings["statusLine"]["command"] = '"/a new path/claude-statusline" render'
        path.write_text(json.dumps(settings), encoding="utf-8")
        third, _ = self.request("read")
        self.assertNotEqual(first["result"]["revision"], third["result"]["revision"])

    def test_preview_reuses_production_formatting_without_live_sources(self):
        value = draft()
        value["display"]["items"] = list(display.ITEM_CATALOG)
        value["display"]["subagents"]["items"] = [
            item
            for item in display.SUBAGENT_ITEM_CATALOG
            if item not in ("status", "elapsed")
        ]
        for colors in (True, False):
            value["display"]["use_colors"] = colors
            for width in (2, 24, 80, 120):
                with (
                    mock.patch.object(
                        git, "git_status", side_effect=AssertionError("live git")
                    ),
                    mock.patch.object(
                        usage,
                        "session_token_totals",
                        side_effect=AssertionError("live transcript"),
                    ),
                    mock.patch.object(
                        service,
                        "read_effective_config",
                        side_effect=AssertionError("read config"),
                    ),
                    mock.patch.object(
                        protocol.capabilities,
                        "detect_claude_version",
                        side_effect=AssertionError("host process"),
                    ),
                ):
                    result, status = self.request(
                        "preview", {"draft": value, "width": width}
                    )
                self.assertEqual(status, 0, result)
                rows = result["result"]["main"]
                plain = ["".join(span["text"] for span in row) for row in rows]
                expected = [
                    layout.ANSI_SGR_RE.sub("", row)
                    for row in preview.render_preview_rows(
                        display.validate_display_config(value["display"]), width
                    )
                ]
                self.assertEqual(plain, expected)
                self.assertNotIn("\x1b", json.dumps(result))
        self.assertFalse(self.root.exists())

    def test_invalid_drafts_width_and_strict_host_types(self):
        cases = []
        for field, bad in (
            ("padding", True),
            ("padding", 2.5),
            ("padding", 33),
            ("refresh_interval", 0),
            ("hide_vim_mode_indicator", "off"),
        ):
            value = draft()
            value["host"][field] = bad
            cases.append({"draft": value, "width": 80})
        for width in (True, 0, 1, 80.5, 10001):
            cases.append({"draft": draft(), "width": width})
        for ids in (["unknown"], ["git", "git"]):
            value = draft()
            value["display"]["items"] = ids
            cases.append({"draft": value, "width": 80})
        for payload in cases:
            result, status = self.request("preview", payload)
            self.assertEqual(status, 2, result)
        self.assertFalse(self.root.exists())

    def test_color_channels_are_not_interpreted_as_sgr_codes(self):
        self.assertEqual(
            spans.row_spans("\x1b[38;2;30;95;1m中é\x1b[0m"),
            [
                {
                    "text": "中é",
                    "bold": False,
                    "foreground": {"kind": "rgb", "value": "#1e5f01"},
                }
            ],
        )

    def test_legacy_draft_empty_rows_and_mutual_exclusions(self):
        value = draft()
        value["display"] = {k: v for k, v in value["display"].items() if k in display.V1_DISPLAY_KEYS}
        value["display"]["schema_version"] = 1
        value["display"].pop("subagents", None)
        value["display"].pop("scope_labels", None)
        result, status = self.request("preview", {"draft": value, "width": 80})
        self.assertEqual(status, 0, result)
        empty = draft()
        empty["display"]["items"] = []
        empty["display"]["subagents"]["enabled"] = False
        result, status = self.request("preview", {"draft": empty, "width": 24})
        self.assertEqual(status, 0)
        self.assertEqual(result["result"]["main"], [])
        self.assertEqual(result["result"]["subagents"], [])
        empty["display"]["subagents"]["items"] = ["status-elapsed", "elapsed"]
        result, status = self.request("preview", {"draft": empty, "width": 80})
        self.assertEqual(status, 2)
        self.assertEqual(result["error"]["code"], "invalid_configuration")
        self.assertFalse(self.root.exists())

    def test_actual_cli_preview_and_utf8_errors_are_json_only(self):
        import os

        env = dict(os.environ, CLAUDE_CONFIG_DIR=str(self.root))
        raw = json.dumps(
            {
                "protocol_version": 4,
                "operation": "preview",
                "payload": {"draft": draft(), "width": 80},
            }
        ).encode()
        for content, expected in ((raw, 0), (b"\xff", 2), (b"{", 2)):
            result = subprocess.run(
                [
                    sys.executable,
                    "-m",
                    "claude_statusline",
                    "ui",
                    "--config-dir",
                    str(self.root),
                ],
                input=content,
                env=env,
                capture_output=True,
                check=False,
            )
            self.assertEqual(result.returncode, expected, result.stderr)
            self.assertEqual(json.loads(result.stdout)["protocol_version"], 4)
        self.assertFalse(self.root.exists())
