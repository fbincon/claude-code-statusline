"""Tests for the curses-independent interactive configuration state."""

import io
import os
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from claude_statusline import config_commands as cc
from claude_statusline import display_config as dc
from claude_statusline import interactive_config as ic


class TTYStringIO(io.StringIO):
    def isatty(self):
        return True


def effective(
    *,
    items=("git", "model-with-effort"),
    host=cc.HostConfig(),
    installed=True,
    **display_updates,
):
    display = dc.DEFAULT_CONFIG.with_updates(items=items, **display_updates)
    return cc.EffectiveConfig(
        display=display,
        host=host,
        installed=installed,
        config_path=Path("/tmp/example/claude-statusline.json"),
    )


class ItemStateTests(unittest.TestCase):
    def test_initial_order_keeps_enabled_order_then_catalog_order(self):
        state = ic.EditorState.from_effective(effective())
        self.assertEqual(state.item_order[:2], ["git", "model-with-effort"])
        self.assertEqual(
            state.item_order[2:],
            [item for item in dc.ITEM_CATALOG if item not in state.enabled],
        )

    def test_new_main_items_are_discoverable_and_toggleable(self):
        state = ic.EditorState.from_effective(effective())
        for item in ("project-name", "hostname", "context-used"):
            self.assertIn(item, state.item_order)
            self.assertNotIn(item, state.enabled)
            state.selected_item = item
            self.assertTrue(state.toggle_selected_item())
        self.assertTrue(
            {"project-name", "hostname", "context-used"}.issubset(
                state.final_items()
            )
        )

    def test_toggle_empty_set_and_repeated_moves(self):
        state = ic.EditorState.from_effective(effective(items=("git",)))
        self.assertTrue(state.toggle_selected_item())
        self.assertEqual(state.final_items(), ())
        self.assertEqual(state.display.items, ())
        self.assertFalse(state.move_selected_item(-1))
        self.assertTrue(state.move_selected_item(1))
        self.assertEqual(state.item_order[1], "git")
        self.assertTrue(state.move_selected_item(1))
        self.assertEqual(state.item_order[2], "git")
        state.navigate_end()
        self.assertFalse(state.move_selected_item(1))

    def test_moving_disabled_item_marks_draft_but_does_not_enable_it(self):
        state = ic.EditorState.from_effective(effective(items=("git",)))
        state.selected_item = "model-with-effort"
        self.assertNotIn(state.selected_item, state.enabled)
        self.assertFalse(state.modified)
        self.assertTrue(state.move_selected_item(1))
        self.assertTrue(state.modified)
        self.assertEqual(state.final_items(), ("git",))

    def test_search_matches_id_and_description_case_insensitively(self):
        state = ic.EditorState.from_effective(effective())
        state.append_search("VIM")
        self.assertEqual(state.visible_items(), ["vim-mode"])
        state.clear_search()
        state.append_search("working-TREE")
        self.assertEqual(state.visible_items(), ["git"])
        state.backspace_search()
        self.assertEqual(state.search, "working-TRE")
        state.clear_search()
        self.assertEqual(state.visible_items(), state.item_order)

    def test_no_matches_make_toggle_and_move_noops(self):
        state = ic.EditorState.from_effective(effective())
        original_order = list(state.item_order)
        original_enabled = set(state.enabled)
        state.append_search("does-not-exist")
        self.assertEqual(state.visible_items(), [])
        self.assertFalse(state.toggle_selected_item())
        self.assertFalse(state.move_selected_item(1))
        self.assertEqual(state.item_order, original_order)
        self.assertEqual(state.enabled, original_enabled)

    def test_filtered_move_targets_visible_neighbor_and_preserves_hidden_order(self):
        state = ic.EditorState.from_effective(
            effective(items=tuple(dc.ITEM_CATALOG))
        )
        state.append_search("current")
        self.assertEqual(
            state.visible_items(),
            ["model-with-effort", "current-dir", "pr", "vim-mode"],
        )
        hidden_before = [
            item for item in state.item_order if item not in state.visible_items()
        ]
        self.assertTrue(state.move_selected_item(1))
        self.assertEqual(
            state.item_order[:4],
            ["fast-mode", "thinking", "current-dir", "model-with-effort"],
        )
        hidden_after = [
            item for item in state.item_order if item not in state.visible_items()
        ]
        self.assertEqual(hidden_after, hidden_before)
        self.assertEqual(state.selected_item, "model-with-effort")

    def test_navigation_and_scroll_stay_valid_across_viewport_changes(self):
        state = ic.EditorState.from_effective(effective())
        for _ in range(12):
            state.navigate(1)
        state.ensure_visible(4)
        selected = state.selected_item
        self.assertGreater(state.item_scroll, 0)
        state.ensure_visible(20)
        self.assertEqual(state.selected_item, selected)
        self.assertLessEqual(state.item_scroll, max(0, len(state.item_order) - 20))
        state.navigate_home()
        self.assertEqual(state.selected_item, state.visible_items()[0])
        state.navigate_end()
        self.assertEqual(state.selected_item, state.visible_items()[-1])

    def test_subagent_items_have_independent_search_order_and_selection(self):
        state = ic.EditorState.from_effective(effective())
        state.page = "subagents"
        self.assertEqual(
            state.final_subagent_items(), dc.DEFAULT_SUBAGENT_ITEMS
        )
        state.append_search("token")
        self.assertEqual(state.visible_subagent_items(), ["tokens"])
        state.toggle_selected_item()
        self.assertIn("tokens", state.final_subagent_items())
        state.clear_search()
        state.selected_subagent_item = "tokens"
        self.assertTrue(state.move_selected_item(-1))
        self.assertNotEqual(state.item_order, state.subagent_item_order)

    def test_subagent_enabling_status_or_elapsed_disables_status_elapsed(self):
        state = ic.EditorState.from_effective(effective())
        state.page = "subagents"
        state.selected_subagent_item = "status"
        self.assertTrue(state.toggle_selected_item())
        self.assertIn("status", state.subagent_enabled)
        self.assertNotIn("status-elapsed", state.subagent_enabled)
        state.selected_subagent_item = "elapsed"
        self.assertTrue(state.toggle_selected_item())
        self.assertIn("elapsed", state.subagent_enabled)
        self.assertNotIn("status-elapsed", state.subagent_enabled)
        # status 与 elapsed 共存合法
        self.assertIn("status", state.final_subagent_items())

    def test_subagent_enabling_status_elapsed_disables_status_and_elapsed(self):
        state = ic.EditorState.from_effective(effective())
        state.page = "subagents"
        # 默认已开启 status-elapsed;先开启 status(自动关 status-elapsed),再切回
        state.selected_subagent_item = "status"
        self.assertTrue(state.toggle_selected_item())
        self.assertNotIn("status-elapsed", state.subagent_enabled)
        state.selected_subagent_item = "status-elapsed"
        self.assertTrue(state.toggle_selected_item())
        self.assertIn("status-elapsed", state.subagent_enabled)
        self.assertNotIn("status", state.subagent_enabled)
        self.assertNotIn("elapsed", state.subagent_enabled)
        self.assertIn("status-elapsed", state.final_subagent_items())
        self.assertIn("status-elapsed", state.display.subagents.items)

    def test_tabs_cycle_main_subagents_settings_in_both_directions(self):
        state = ic.EditorState.from_effective(effective())
        self.assertEqual(state.page, "items")
        state.switch_page()
        self.assertEqual(state.page, "subagents")
        state.switch_page()
        self.assertEqual(state.page, "settings")
        state.switch_page()
        self.assertEqual(state.page, "items")
        state.switch_page(-1)
        self.assertEqual(state.page, "settings")


class SettingStateTests(unittest.TestCase):
    def state(self, **kwargs):
        result = ic.EditorState.from_effective(effective(**kwargs))
        result.page = "settings"
        return result

    def test_booleans_and_all_enumerations_cycle(self):
        state = self.state()
        state.setting_index = 0
        self.assertTrue(state.toggle_setting())
        self.assertFalse(state.display.use_colors)
        self.assertTrue(state.adjust_setting(-1))
        self.assertTrue(state.display.use_colors)

        for index, field, choices in (
            (1, "palette", dc.PALETTES),
            (2, "directory_style", dc.DIRECTORY_STYLES),
            (3, "separator_style", dc.SEPARATOR_STYLES),
        ):
            state.setting_index = index
            original = getattr(state.display, field)
            state.adjust_setting(-1)
            self.assertEqual(getattr(state.display, field), choices[-1])
            state.adjust_setting(1)
            self.assertEqual(getattr(state.display, field), original)

        state.setting_index = 6
        state.toggle_setting()
        self.assertTrue(state.host.hide_vim_mode_indicator)
        self.assertEqual(state.setting_values()[6], "hide")

        state.setting_index = 7
        state.adjust_setting(-1)
        self.assertEqual(state.display.scope_labels, "off")
        state.adjust_setting(1)
        self.assertEqual(state.display.scope_labels, "when-subagents")

        state.setting_index = 8
        state.toggle_setting()
        self.assertFalse(state.display.subagents.enabled)
        self.assertEqual(state.setting_values()[8], "off")

    def test_padding_clamps_and_refresh_custom_value_joins_cycle(self):
        state = self.state(host=cc.HostConfig(0, 7, False))
        state.setting_index = 4
        state.adjust_setting(-1)
        self.assertEqual(state.host.padding, 0)
        state.host = cc.HostConfig(32, 7, False)
        state.adjust_setting(1)
        self.assertEqual(state.host.padding, 32)

        state.setting_index = 5
        self.assertEqual(
            state.refresh_choices(),
            (None, 1, 2, 5, 7, 10, 30, 60, 300, 600, 3600),
        )
        state.adjust_setting(-1)
        self.assertEqual(state.host.refresh_interval, 5)
        state.set_refresh_event()
        self.assertIsNone(state.host.refresh_interval)
        state.adjust_setting(-1)
        self.assertEqual(state.host.refresh_interval, 3600)

    def test_numeric_edit_accept_error_backspace_and_escape_restore(self):
        state = self.state(host=cc.HostConfig(4, 7, False))
        state.setting_index = 4
        self.assertTrue(state.input_digit("3"))
        self.assertEqual(state.host.padding, 3)
        self.assertTrue(state.input_digit("3"))
        self.assertEqual(state.host.padding, 3)
        self.assertIn("0 through 32", state.numeric_edit.error)
        self.assertFalse(state.accept_numeric())
        state.backspace_numeric()
        self.assertIsNone(state.numeric_edit.error)
        self.assertTrue(state.accept_numeric())
        self.assertEqual(state.host.padding, 3)

        state.input_digit("5")
        self.assertEqual(state.host.padding, 5)
        self.assertTrue(state.cancel_numeric())
        self.assertEqual(state.host.padding, 3)

        state.setting_index = 5
        state.input_digit("0")
        self.assertIn("1 through 3600", state.numeric_edit.error)
        self.assertFalse(state.accept_numeric())
        self.assertTrue(state.cancel_numeric())
        self.assertEqual(state.host.refresh_interval, 7)

    def test_numeric_edit_blocks_tabs_and_needs_second_enter_to_save(self):
        state = self.state()
        state.setting_index = 4
        state.input_digit("2")
        self.assertIsNone(ic.handle_key(state, "\t", 8))
        self.assertEqual(state.page, "settings")
        self.assertIsNotNone(state.numeric_edit)
        self.assertIsNone(ic.handle_key(state, "\n", 8))
        self.assertIsNone(state.numeric_edit)
        self.assertEqual(ic.handle_key(state, "\n", 8), ic.SAVE)


class SaveAndRunTests(unittest.TestCase):
    def test_save_calls_apply_once_with_complete_draft_and_baseline(self):
        state = ic.EditorState.from_effective(
            effective(items=("git", "tokens"), host=cc.HostConfig(2, None, True))
        )
        state.selected_item = "model-with-effort"
        state.toggle_selected_item()
        state.display = state.display.with_updates(
            use_colors=False,
            palette="ansi",
            directory_style="home",
            separator_style="compact",
        )
        mutation = cc.MutationResult(False, state.baseline)
        with mock.patch.object(cc, "apply_configuration", return_value=mutation) as apply:
            result = ic.save_configuration(Path("/config"), Path("/bin/tool"), state)
        self.assertIs(result, mutation)
        apply.assert_called_once_with(
            Path("/config"),
            Path("/bin/tool"),
            items=["git", "tokens", "model-with-effort"],
            colors="off",
            palette="ansi",
            directory_style="home",
            separator_style="compact",
            padding=2,
            refresh_interval="event",
            hide_vim_mode_indicator="on",
            subagent_items=list(dc.DEFAULT_SUBAGENT_ITEMS),
            subagent_statusline="on",
            scope_labels="when-subagents",
            expected=state.baseline,
        )

    def test_cancel_and_interrupt_do_not_save(self):
        for action, expected_code, expected_output in (
            (ic.CANCEL, 0, "Status line configuration unchanged.\n"),
            (ic.INTERRUPT, 130, ""),
        ):
            with self.subTest(action=action):
                output = TTYStringIO()
                with (
                    mock.patch.object(cc, "read_effective_config", return_value=effective()),
                    mock.patch.object(ic, "_run_curses", return_value=action),
                    mock.patch.object(ic, "_install_signal_handlers", return_value={}),
                    mock.patch.object(ic, "save_configuration") as save,
                ):
                    code = ic.run(
                        Path("/config"),
                        Path("/bin/tool"),
                        input_stream=TTYStringIO(),
                        output_stream=output,
                    )
                self.assertEqual(code, expected_code)
                self.assertEqual(output.getvalue(), expected_output)
                save.assert_not_called()

    def test_non_tty_and_uninstalled_are_rejected(self):
        with self.assertRaisesRegex(cc.ConfigCommandError, "stdin and stdout"):
            ic.run(
                Path("/config"),
                Path("/bin/tool"),
                input_stream=io.StringIO(),
                output_stream=TTYStringIO(),
            )
        with (
            mock.patch.object(
                cc, "read_effective_config", return_value=effective(installed=False)
            ),
            self.assertRaisesRegex(cc.ConfigCommandError, "not installed"),
        ):
            ic.run(
                Path("/config"),
                Path("/bin/tool"),
                input_stream=TTYStringIO(),
                output_stream=TTYStringIO(),
            )

    def test_bridge_write_failure_happens_after_completed_editor_outcome(self):
        with tempfile.TemporaryDirectory(prefix="statusline-bridge-write-") as root:
            config_dir = Path(root) / "claude"
            invocation = (
                config_dir
                / "statusline_runtime"
                / "slash_tui"
                / "invocation-test"
            )
            invocation.mkdir(mode=0o700, parents=True)
            invocation.chmod(0o700)
            result_path = invocation / "result.json"
            completed = ic.ConfigureOutcome(
                "updated", 0, "Status line configuration updated."
            )
            with (
                mock.patch.object(ic, "execute", return_value=completed) as execute,
                mock.patch.object(
                    ic, "_write_bridge_result", side_effect=OSError("disk full")
                ),
            ):
                code = ic.run(
                    config_dir,
                    Path("/bin/tool"),
                    input_stream=TTYStringIO(),
                    output_stream=TTYStringIO(),
                    environ={
                        "CLAUDE_STATUSLINE_SLASH_RESULT": str(result_path),
                        "CLAUDE_STATUSLINE_SLASH_DEADLINE_SECONDS": "570",
                    },
                )
            self.assertEqual(code, 2)
            execute.assert_called_once()
            self.assertFalse(result_path.exists())

    def test_bridge_path_rejects_escape_and_reparse_chain(self):
        with tempfile.TemporaryDirectory(prefix="statusline-bridge-path-") as root:
            config_dir = Path(root) / "claude"
            invocation = (
                config_dir
                / "statusline_runtime"
                / "slash_tui"
                / "invocation-random"
            )
            invocation.mkdir(mode=0o700, parents=True)
            if os.name == "posix":
                invocation.chmod(0o700)
            result_path = invocation / "result.json"
            self.assertEqual(
                ic._validated_bridge_path(config_dir, str(result_path)), result_path
            )

            escaped = invocation / ".." / "result.json"
            with self.assertRaises(cc.ConfigCommandError):
                ic._validated_bridge_path(config_dir, str(escaped))

            reparse = config_dir / "statusline_runtime" / "slash_tui"
            original = ic._platform.is_link_or_reparse
            with (
                mock.patch.object(
                    ic._platform,
                    "is_link_or_reparse",
                    side_effect=lambda value: Path(value) == reparse or original(value),
                ),
                self.assertRaises(cc.ConfigCommandError),
            ):
                ic._validated_bridge_path(config_dir, str(result_path))


class TerminalColorTests(unittest.TestCase):
    def test_rgb_quantizes_for_256_basic_and_no_color_terminals(self):
        self.assertIsNotNone(ic.nearest_terminal_color(246, 226, 183, 256))
        self.assertLess(ic.nearest_terminal_color(246, 226, 183, 256), 256)
        self.assertLess(ic.nearest_terminal_color(246, 226, 183, 16), 16)
        self.assertLess(ic.nearest_terminal_color(246, 226, 183, 8), 8)
        self.assertIsNone(ic.nearest_terminal_color(246, 226, 183, 0))

        sgr = "\033[1;38;2;246;226;183m"
        self.assertEqual(ic._ansi_style(sgr, 0), (True, None))
        self.assertIsNotNone(ic._ansi_style(sgr, 8)[1])
        self.assertIsNotNone(ic._ansi_style(sgr, 256)[1])

    def test_resize_key_refreshes_pdcurses_dimensions(self):
        state = ic.EditorState.from_effective(effective())
        screen = mock.Mock()
        screen.get_wch.side_effect = [ic.curses.KEY_RESIZE, "\x1b"]
        screen.getmaxyx.return_value = (24, 100)
        with (
            mock.patch.object(ic, "_draw_screen", return_value=12),
            mock.patch.object(ic, "_ColorMapper", return_value=mock.Mock()),
            mock.patch.object(ic.curses, "curs_set"),
            mock.patch.object(ic.curses, "set_escdelay", create=True),
            mock.patch.object(ic.curses, "resize_term") as resize,
        ):
            self.assertEqual(ic._screen_loop(screen, state), ic.CANCEL)
        resize.assert_called_once_with(0, 0)

    def test_signal_registration_uses_only_available_platform_signals(self):
        expected = {
            getattr(ic.signal, name)
            for name in ("SIGINT", "SIGHUP", "SIGTERM")
            if hasattr(ic.signal, name)
        }
        with (
            mock.patch.object(ic.signal, "getsignal", return_value="previous"),
            mock.patch.object(ic.signal, "signal") as register,
        ):
            previous = ic._install_signal_handlers()
        self.assertEqual(set(previous), expected)
        self.assertEqual(
            {call.args[0] for call in register.call_args_list}, expected
        )


if __name__ == "__main__":
    unittest.main(verbosity=2)
