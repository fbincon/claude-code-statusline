import unittest
from unittest import mock

from claude_statusline.config import display, formatting
from claude_statusline.rendering import items, live, palette, preview


class LiveRenderingTests(unittest.TestCase):
    def test_unavailable_zero_and_partial_are_distinct(self):
        fmt = formatting.Formatting()
        self.assertEqual(live.metric({}, "active-agents", fmt), "Agents —")
        self.assertEqual(
            live.metric({"active-agents": {"value": 0}}, "active-agents", fmt),
            "Agents 0",
        )
        self.assertEqual(
            live.metric(
                {"active-agents": {"value": 0, "partial": True}}, "active-agents", fmt
            ),
            "Agents 0*",
        )

    def test_live_collection_is_lazy_and_shared_and_preview_does_not_collect(self):
        config = display.DEFAULT_CONFIG.with_updates(
            items=tuple(items._LIVE_ITEMS), use_colors=False
        )
        state = items._RenderState(
            {"session_id": "s"}, config, palette.NO_COLOR_PALETTE, " | "
        )
        with mock.patch(
            "claude_statusline.runtime.live.snapshot.collect", return_value={}
        ) as collect:
            self.assertIsNotNone(state.render("hostname"))
            collect.assert_not_called()
            self.assertTrue(all(state.render(item) for item in items._LIVE_ITEMS))
            self.assertEqual(collect.call_count, 1)
            self.assertTrue(preview.render_preview_rows(config, 80))
            self.assertEqual(collect.call_count, 1)
