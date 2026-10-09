"""External editor saves and refusals use the real shared configuration service."""

from io import StringIO
from unittest import mock

from claude_statusline.config import display, models, ui_preferences
from claude_statusline.ui import forms, session
from tests.config.test_config_commands import ConfigCommandTestCase
from tests.ui.test_layout import select


class StatuslineLanguageSessionTests(ConfigCommandTestCase):
    def tty(self):
        stream = StringIO()
        stream.isatty = lambda: True
        return stream

    def edit(self, action, states):
        def run(state, *unused):
            states.append(state)
            state.page = "settings"
            select(state, "field:statusline_language")
            forms.set_value(state, forms.current(state), "zh-CN")
            self.assertEqual(display.load_display_config(self.config_dir).statusline_language, "en")
            return action
        return run

    def test_save_and_cancel_share_draft_semantics_in_both_interface_languages(self):
        self.install_minimal_settings()
        for language in ("en", "zh-CN"):
            for action, expected in (("cancel", "en"), ("save", "zh-CN")):
                with self.subTest(language=language, action=action):
                    display.write_display_config(self.config_dir, display.DEFAULT_CONFIG)
                    ui_preferences.set_language(self.config_dir, language)
                    preferences_before = (self.config_dir / "statusline-ui.json").read_bytes()
                    states = []
                    with mock.patch.object(session, "_run_curses", side_effect=self.edit(action, states)):
                        result = session.execute(self.config_dir, self.executable, input_stream=self.tty(), output_stream=self.tty())
                    self.assertEqual(result.language, language)
                    self.assertEqual(states[0].language, language)
                    self.assertEqual(display.load_display_config(self.config_dir).statusline_language, expected)
                    self.assertEqual((self.config_dir / "statusline-ui.json").read_bytes(), preferences_before)

    def test_save_failure_preserves_file_and_draft(self):
        self.install_minimal_settings()
        display.write_display_config(self.config_dir, display.DEFAULT_CONFIG)
        before = display.config_path(self.config_dir).read_bytes()
        states = []
        with mock.patch.object(session, "_run_curses", side_effect=self.edit("save", states)), mock.patch.object(display, "write_display_config", side_effect=display.DisplayConfigError("Write refused")), self.assertRaises(models.ConfigCommandError):
            session.execute(self.config_dir, self.executable, input_stream=self.tty(), output_stream=self.tty())
        self.assertEqual(display.config_path(self.config_dir).read_bytes(), before)
        self.assertEqual(states[0].display.statusline_language, "zh-CN")
        self.assertTrue(states[0].modified)
