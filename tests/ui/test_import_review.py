"""Review modal acceptance is separate from saving and preserves cancellation."""

from copy import deepcopy
import curses
import unittest

from claude_statusline.config.import_review import differences
from claude_statusline.ui import drawing, keys
from claude_statusline.ui.editor import EditorState
from claude_statusline.ui.import_review import ReviewState, localized
from tests.ui.test_interactive_config import effective
from tests.ui.test_layout import Screen, Mapper


class ReviewUiTests(unittest.TestCase):
    def state(self, language="en"):
        state = EditorState.from_effective(effective(),language=language)
        state.page = "settings"
        state.display = state.display.with_updates(palette="ansi")
        current = {"display":state.display.to_dict(),"host":state.host.to_dict()}
        candidate = deepcopy(current)
        candidate["host"]["padding"] = 7
        candidate["display"]["statusline_language"] = "zh-CN"
        candidate["display"]["item_options"]["model"] = {"label":"长标签中文 " * 30,"icon":None,"priority":50,"max_width":None,"formatting":{},"foreground":None,"background":None,"visibility":"always","visibility_threshold":70}
        state.import_review = ReviewState.from_result({"draft":candidate,"changes":differences(current,candidate)})
        return state

    def test_cancel_preserves_unsaved_draft_revision_and_editor_state(self):
        state = self.state()
        previous = state.display, state.host, state.baseline, list(state.item_order), state.setting_index
        keys.handle_key(state,"\n",4)
        keys.handle_key(state,curses.KEY_NPAGE,4)
        self.assertIsNone(keys.handle_key(state,"\x13",4))
        keys.handle_key(state,"\x1b",4)
        self.assertIsNone(state.import_review)
        self.assertEqual((state.display,state.host,state.baseline,state.item_order,state.setting_index),previous)

    def test_accept_replaces_only_draft_and_keeps_opening_revision(self):
        state = self.state()
        baseline = state.baseline
        candidate = deepcopy(state.import_review.result["draft"])
        keys.handle_key(state,"a",4)
        self.assertEqual(state.display.to_dict(),candidate["display"])
        self.assertEqual(state.host.to_dict(),candidate["host"])
        self.assertIs(state.baseline,baseline)
        self.assertIsNone(state.import_review)
        self.assertTrue(state.modified)
        self.assertEqual(keys.handle_key(state,"\x13",4),"save")

    def test_review_sections_long_values_and_previews_resize_in_both_languages(self):
        for language in ("en","zh-CN"):
            for width,height in ((64,18),(64,20),(80,24),(120,30),(80,48)):
                state = self.state(language)
                state.import_review.expanded = state.import_review.sections()
                screen=Screen(width,height)
                drawing._draw_screen(screen,state,Mapper())
                self.assertNotIn("review.",screen.text)
                self.assertIn("Enter",screen.text)
                keys.handle_key(state,curses.KEY_END,4)
                drawing._draw_screen(screen,state,Mapper())
                self.assertIn('7',screen.text)
                self.assertEqual(state.host.padding,0)
                keys.handle_key(state,"\t",4)
                self.assertEqual(state.import_review.preview_scope,"subagent")
                drawing._draw_screen(screen,state,Mapper())

    def test_empty_review_and_nested_localized_labels(self):
        state=self.state("zh-CN")
        state.import_review.result["changes"]=[]
        rows,total=state.import_review.window("zh-CN",60,3)
        self.assertEqual(total,1)
        self.assertIn("没有差异",rows[0]["text"])
        current={"display":state.display.to_dict(),"host":state.host.to_dict()}
        candidate=deepcopy(current);candidate["display"]["items"]=[]
        change=differences(current,candidate)[0]
        text=localized(change["label"],"zh-CN")
        self.assertIn("停用",text)
        self.assertNotIn("'key'",text)
