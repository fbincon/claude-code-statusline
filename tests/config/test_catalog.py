"""Scoped catalog and legacy frontend compatibility contracts."""

import unittest
from pathlib import Path

from claude_statusline.config import catalog, commands, display
from claude_statusline.integration import resources
from claude_statusline.ui import contracts
from tools.generate_ui_contracts import generated


class CatalogTests(unittest.TestCase):
    def test_scopes_defaults_and_legacy_descriptions(self):
        self.assertEqual(len(catalog.BY_SCOPE["main"]), 44)
        self.assertEqual(len(catalog.BY_SCOPE["subagent"]), 14)
        self.assertEqual(
            display.DEFAULT_ITEMS,
            (
                "model-with-effort",
                "current-dir",
                "git",
                "context-remaining",
                "context-window-size",
                "five-hour-limit",
                "weekly-limit",
                "spend-limit",
                "tokens",
                "prompt-timer",
            ),
        )
        self.assertEqual(
            display.DEFAULT_SUBAGENT_ITEMS,
            (
                "status-elapsed",
                "name",
                "model-with-effort",
                "context-remaining",
                "task",
            ),
        )
        for scope, listing in (
            ("main", commands.item_listing()),
            ("subagent", commands.subagent_item_listing()),
        ):
            for row in listing:
                item = catalog.BY_SCOPE[scope][row["id"]]
                self.assertEqual(row["description"], item.description)
                self.assertEqual(
                    row["default_enabled"], item.default_position is not None
                )
                self.assertTrue(row["label"] and row["sources"] and row["examples"])
                self.assertIn("not_observed", row["unavailable_reasons"])
                self.assertIn("unsupported_host", row["unavailable_reasons"])

    def test_wizard_uses_generated_groups_and_constraints(self):
        skill = resources.render_skill(
            Path("/tmp/CLI with spaces/claude-statusline")
        ).decode()
        self.assertIn(catalog.wizard_groups(), skill)
        self.assertNotIn("__CLAUDE_STATUSLINE_", skill)
        for item in catalog.ITEMS:
            self.assertIn(item.id, skill)
        self.assertTrue(catalog.conflicts("subagent", ["status-elapsed", "elapsed"]))
        self.assertFalse(catalog.conflicts("subagent", ["status", "elapsed"]))

    def test_wire_display_fields_and_generated_frontend_are_current(self):
        self.assertEqual(
            set(contracts.DisplayDraft.__annotations__),
            set(display.DEFAULT_CONFIG.to_dict()),
        )
        self.assertEqual(
            set(contracts.SubagentDraft.__annotations__),
            set(display.DEFAULT_CONFIG.subagents.to_dict()),
        )
        path = (
            Path(__file__).resolve().parents[2]
            / "mods/statusline-native/lib/generated-contracts.ts"
        )
        self.assertTrue(path.is_file(), "Generated frontend contract is missing")
        self.assertEqual(path.read_text(encoding="utf-8"), generated())
