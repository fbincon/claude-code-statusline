import curses
from io import StringIO
from pathlib import Path
import tempfile
import unittest
from unittest import mock

from claude_statusline.config import display, formatting, models, ui_preferences
from claude_statusline.i18n import message
from claude_statusline.ui import drawing, editor, forms, session
from tests.ui.test_layout import Screen, Mapper, select


class InputScreen(Screen):
    repainted = False

    def clearok(self, enabled):
        self.repainted = enabled

    def keypad(self, enabled):
        pass

    def timeout(self, milliseconds):
        pass


class LanguageUiTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="language UI 中文 ")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.baseline = models.EffectiveConfig(
            display.DEFAULT_CONFIG,
            models.DEFAULT_HOST_CONFIG,
            True,
            self.root / display.CONFIG_FILENAME,
        )

    def state(self, language="en"):
        return editor.EditorState.from_effective(self.baseline, language=language)

    def test_search_matches_both_languages_ids_and_custom_labels(self):
        for language in ("en", "zh-CN"):
            state = self.state(language)
            for query in (
                "context-remaining",
                "Percentage of context window remaining",
                "剩余上下文",
            ):
                state.search = query
                self.assertIn("context-remaining", state.visible_items())
            state.display = state.display.with_updates(
                item_options={"model": formatting.ItemOptions(label="Engine 中文 é")}
            )
            state.search = "engine 中文"
            self.assertEqual(state.visible_items(), ["model"])
            state.subagent_search = "代理名称"
            self.assertIn("name", state.visible_subagent_items())

    def test_all_pages_and_forms_draw_chinese_inside_cell_bounds(self):
        for width, height in (
            (32, 12),
            (64, 18),
            (64, 20),
            (80, 24),
            (120, 30),
            (80, 48),
        ):
            for page in ("items", "subagents", "settings", "layout", "detail"):
                with self.subTest(size=(width, height), page=page):
                    state = self.state("zh-CN")
                    state.page = "items" if page == "detail" else page
                    if page == "detail":
                        state.form_item = ("main", "model-with-effort")
                    screen = Screen(width, height)
                    drawing._draw_screen(screen, state, Mapper())
                    self.assertIn("配置状态栏", screen.text)
                    self.assertNotIn("Configure Status Line", screen.text)
                    if width >= 64:
                        self.assertIn("预览", screen.text)
                        self.assertNotIn("ui.", screen.text)
                        self.assertNotIn("fields.", screen.text)

    def test_language_persists_immediately_while_draft_and_cancel_are_independent(self):
        state = self.state()
        state.page = "settings"
        state.display = state.display.with_updates(use_colors=False)
        select(state, "ui-language")
        selected = forms.index(state)
        before = state.display.to_dict()
        screen = InputScreen(80, 24)
        events = iter((curses.KEY_RIGHT, "\x1b"))
        screen.get_wch = lambda: next(events)
        with (
            mock.patch.object(drawing, "_draw_screen", return_value=12),
            mock.patch.object(drawing, "_ColorMapper", return_value=Mapper()),
        ):
            self.assertEqual(session._screen_loop(screen, state), "cancel")
        self.assertEqual(state.language, "zh-CN")
        self.assertTrue(screen.repainted)
        self.assertEqual(ui_preferences.read(self.root).ui_language, "zh-CN")
        self.assertEqual(state.display.to_dict(), before)
        self.assertEqual(forms.index(state), selected)
        self.assertTrue(state.modified)
        self.assertFalse((self.root / display.CONFIG_FILENAME).exists())
        self.assertFalse((self.root / "settings.json").exists())

    def test_failed_language_save_retains_language_draft_and_field(self):
        state = self.state()
        state.page = "settings"
        select(state, "ui-language")
        screen = InputScreen(80, 24)
        events = iter((curses.KEY_RIGHT, "\x1b"))
        screen.get_wch = lambda: next(events)
        failure = models.ConfigWriteError(
            message("preferences.write_failed", path=self.root, detail="refused")
        )
        with (
            mock.patch.object(drawing, "_draw_screen", return_value=12),
            mock.patch.object(drawing, "_ColorMapper", return_value=Mapper()),
            mock.patch.object(ui_preferences, "set_language", side_effect=failure),
        ):
            session._screen_loop(screen, state)
        self.assertEqual(state.language, "en")
        self.assertFalse(screen.repainted)
        self.assertIn("previous choice kept", state.notice)
        self.assertEqual(forms.current(state)["key"], "ui-language")
        self.assertFalse(state.modified)

    def test_open_reads_shared_preference_and_override_only_changes_initial_locale(
        self,
    ):
        ui_preferences.set_language(self.root, "zh-CN")
        tty = StringIO()
        tty.isatty = lambda: True
        seen = []

        def cancel(state, *args):
            seen.append(state.language)
            return "cancel"

        with (
            mock.patch.object(
                session.config_service,
                "read_effective_config",
                return_value=self.baseline,
            ),
            mock.patch.object(session, "_run_curses", side_effect=cancel),
        ):
            first = session.execute(
                self.root, Path("/renderer"), input_stream=tty, output_stream=tty
            )
            second = session.execute(
                self.root,
                Path("/renderer"),
                input_stream=tty,
                output_stream=tty,
                language="en",
            )
        self.assertEqual(seen, ["zh-CN", "en"])
        self.assertEqual(first.language, "zh-CN")
        self.assertEqual(second.language, "en")
        self.assertEqual(ui_preferences.read(self.root).ui_language, "zh-CN")
