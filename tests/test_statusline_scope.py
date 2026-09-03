"""Tests for the Main/Session scope label on the global status line."""

import unittest
from unittest import mock

from claude_statusline import display_config as dc
from claude_statusline import statusline as sl


def render(config):
    data = {
        "session_id": "session",
        "prompt_id": "prompt",
        "model": {"id": "claude-opus"},
    }
    segments, separator, reset = sl._configured_segments(data, config)
    rows = sl._layout_segments(segments, 200, separator=separator, reset=reset)
    return "\n".join(sl.ANSI_SGR_RE.sub("", row) for row in rows)


class ScopeLabelTests(unittest.TestCase):
    def config(self, scope="when-subagents", items=("model-with-effort",)):
        return dc.DEFAULT_CONFIG.with_updates(
            items=items, use_colors=False, scope_labels=scope
        )

    def test_off_always_and_conditional_modes(self):
        with mock.patch.object(sl, "load_turn_state", return_value={"had_subagents": True}):
            self.assertEqual(render(self.config("off")), "claude-opus")
            self.assertEqual(
                render(self.config("always")), "Main/Session | claude-opus"
            )
            self.assertEqual(
                render(self.config("when-subagents")),
                "Main/Session | claude-opus",
            )
        with mock.patch.object(sl, "load_turn_state", return_value={"had_subagents": False}):
            self.assertEqual(render(self.config()), "claude-opus")

    def test_no_subagent_output_remains_byte_compatible(self):
        with mock.patch.object(sl, "load_turn_state", return_value=None):
            conditional = render(self.config("when-subagents"))
            disabled = render(self.config("off"))
        self.assertEqual(conditional, disabled)

    def test_completed_agent_history_keeps_label_and_empty_main_stays_empty(self):
        completed = {
            "status": "completed",
            "had_subagents": True,
            "active_agents": {},
        }
        with mock.patch.object(sl, "load_turn_state", return_value=completed):
            self.assertEqual(
                render(self.config()), "Main/Session | claude-opus"
            )
            self.assertEqual(render(self.config(items=())), "")

    def test_preview_simulates_a_prompt_with_subagents(self):
        rows = sl.render_preview_rows(self.config(), 200)
        self.assertTrue(rows)
        self.assertTrue(
            sl.ANSI_SGR_RE.sub("", rows[0]).startswith("Main/Session | ")
        )


if __name__ == "__main__":
    unittest.main(verbosity=2)
