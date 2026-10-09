"""ui / editor implementation."""

from __future__ import annotations

from claude_statusline.i18n import message as msg

from collections.abc import Callable
from dataclasses import dataclass, replace
from pathlib import Path
from claude_statusline.config import display as config_display
from claude_statusline.config import catalog
from claude_statusline.config import models as config_models
from claude_statusline.config import service as config_service
from claude_statusline.ui import models as ui_models
from claude_statusline.ui import forms
from claude_statusline.ui import layout as ui_layout
from claude_statusline.i18n.presentation import search_text


@dataclass
class EditorState:
    """Curses-independent configuration draft and navigation state."""

    baseline: config_models.EffectiveConfig
    item_order: list[str]
    enabled: set[str]
    subagent_item_order: list[str]
    subagent_enabled: set[str]
    display: config_display.DisplayConfig
    host: config_models.HostConfig
    page: str = "items"
    search: str = ""
    selected_item: str | None = None
    item_scroll: int = 0
    setting_index: int = 0
    settings_scroll: int = 0
    subagent_search: str = ""
    selected_subagent_item: str | None = None
    subagent_scroll: int = 0
    numeric_edit: ui_models.NumericEdit | None = None
    form_item: tuple[str, str] | None = None
    form_index: int = 0
    form_scroll: int = 0
    form_input: dict | None = None
    pending_action: str | None = None
    preset: str = "minimal"
    path: str = "statusline.json"
    notice: str = ""
    language: str = "en"
    pending_language: str | None = None

    @classmethod
    def from_effective(
        cls, effective: config_models.EffectiveConfig, *, language="en"
    ) -> EditorState:
        enabled = list(effective.display.items)
        full_order = enabled + [
            item
            for item in config_display.ITEM_CATALOG
            if item not in effective.display.items
        ]
        subagent_enabled = list(effective.display.subagents.items)
        subagent_order = subagent_enabled + [
            item
            for item in config_display.SUBAGENT_ITEM_CATALOG
            if item not in effective.display.subagents.items
        ]
        return cls(
            baseline=effective,
            item_order=full_order,
            enabled=set(enabled),
            subagent_item_order=subagent_order,
            subagent_enabled=set(subagent_enabled),
            display=effective.display,
            host=effective.host,
            selected_item=full_order[0] if full_order else None,
            language=language,
            selected_subagent_item=(subagent_order[0] if subagent_order else None),
        )

    @property
    def modified(self) -> bool:
        initial_order = list(self.baseline.display.items) + [
            item
            for item in config_display.ITEM_CATALOG
            if item not in self.baseline.display.items
        ]
        initial_subagent_order = list(self.baseline.display.subagents.items) + [
            item
            for item in config_display.SUBAGENT_ITEM_CATALOG
            if item not in self.baseline.display.subagents.items
        ]
        draft_changed = (
            self.display != self.baseline.display
            or self.host != self.baseline.host
            or self.item_order != initial_order
            or self.subagent_item_order != initial_subagent_order
        )
        if self.numeric_edit is None:
            return draft_changed or self.form_input is not None
        original = (
            "event"
            if self.numeric_edit.original is None
            else str(self.numeric_edit.original)
        )
        return draft_changed or self.numeric_edit.buffer != original

    def final_items(self) -> tuple[str, ...]:
        return tuple(item for item in self.item_order if item in self.enabled)

    def final_subagent_items(self) -> tuple[str, ...]:
        return tuple(
            item for item in self.subagent_item_order if item in self.subagent_enabled
        )

    def visible_items(self) -> list[str]:
        needle = self.search.casefold()
        if not needle:
            return list(self.item_order)
        return [
            item
            for item in self.item_order
            if needle
            in search_text(
                "main",
                item,
                getattr(self.display.item_options.get(item), "label", None),
            )
        ]

    def visible_subagent_items(self) -> list[str]:
        needle = self.subagent_search.casefold()
        if not needle:
            return list(self.subagent_item_order)
        return [
            item
            for item in self.subagent_item_order
            if needle
            in search_text(
                "subagent",
                item,
                getattr(self.display.subagents.item_options.get(item), "label", None),
            )
        ]

    def _sync_display_items(self) -> None:
        self.display = self.display.with_updates(items=self.final_items())

    def _sync_subagent_items(self) -> None:
        self.display = self.display.with_updates(
            subagents=self.display.subagents.with_updates(
                items=self.final_subagent_items()
            )
        )

    def _normalize_item_selection(self) -> list[str]:
        visible = self.visible_items()
        if visible and self.selected_item not in visible:
            self.selected_item = visible[0]
            self.item_scroll = 0
        return visible

    def _normalize_subagent_selection(self) -> list[str]:
        visible = self.visible_subagent_items()
        if visible and self.selected_subagent_item not in visible:
            self.selected_subagent_item = visible[0]
            self.subagent_scroll = 0
        return visible

    def append_search(self, text: str) -> None:
        if self.page == "subagents":
            self.subagent_search += text
            self._normalize_subagent_selection()
        else:
            self.search += text
            self._normalize_item_selection()

    def backspace_search(self) -> None:
        if self.page == "subagents":
            if self.subagent_search:
                self.subagent_search = self.subagent_search[:-1]
                self._normalize_subagent_selection()
        elif self.search:
            self.search = self.search[:-1]
            self._normalize_item_selection()

    def clear_search(self) -> None:
        if self.page == "subagents":
            if self.subagent_search:
                self.subagent_search = ""
                self._normalize_subagent_selection()
        elif self.search:
            self.search = ""
            self._normalize_item_selection()

    def navigate(self, delta: int) -> None:
        if forms.special(self):
            forms.select(self, self.form_index + delta)
            return
        if self.page == "settings":
            self.setting_index = min(
                len(forms.rows(self)) - 1,
                max(0, self.setting_index + delta),
            )
            return
        visible = (
            self._normalize_subagent_selection()
            if self.page == "subagents"
            else self._normalize_item_selection()
        )
        if not visible:
            return
        selected = (
            self.selected_subagent_item
            if self.page == "subagents"
            else self.selected_item
        )
        current = visible.index(selected)
        selected = visible[min(len(visible) - 1, max(0, current + delta))]
        if self.page == "subagents":
            self.selected_subagent_item = selected
        else:
            self.selected_item = selected

    def navigate_page(self, direction: int, page_size: int) -> None:
        if forms.special(self) or self.page == "settings":
            self.ensure_visible(page_size)
            scroll = self.form_scroll if forms.special(self) else self.settings_scroll
            rows = forms.rows(self)
            if direction < 0:
                window = ui_layout.form_window(
                    rows[: forms.index(self)][::-1], 0, 0, page_size
                )
            else:
                window = ui_layout.form_window(
                    rows, forms.index(self), scroll, page_size
                )
            page_size = window.end - window.start
        self.navigate(direction * max(1, page_size))

    def navigate_home(self) -> None:
        if forms.special(self):
            self.form_index = 0
            return
        if self.page == "settings":
            self.setting_index = 0
            return
        visible = (
            self._normalize_subagent_selection()
            if self.page == "subagents"
            else self._normalize_item_selection()
        )
        if visible:
            if self.page == "subagents":
                self.selected_subagent_item = visible[0]
            else:
                self.selected_item = visible[0]

    def navigate_end(self) -> None:
        if forms.special(self):
            self.form_index = len(forms.rows(self)) - 1
            return
        if self.page == "settings":
            self.setting_index = len(forms.rows(self)) - 1
            return
        visible = (
            self._normalize_subagent_selection()
            if self.page == "subagents"
            else self._normalize_item_selection()
        )
        if visible:
            if self.page == "subagents":
                self.selected_subagent_item = visible[-1]
            else:
                self.selected_item = visible[-1]

    def ensure_visible(self, viewport_height: int) -> None:
        height = max(1, viewport_height)
        if forms.special(self) or self.page == "settings":
            forms.select(self, forms.index(self))
            scroll = self.form_scroll if forms.special(self) else self.settings_scroll
            window = ui_layout.form_window(
                forms.rows(self), forms.index(self), scroll, height
            )
            if forms.special(self):
                self.form_scroll = window.start
            else:
                self.settings_scroll = window.start
            return
        if self.page == "subagents":
            visible = self._normalize_subagent_selection()
            maximum = max(0, len(visible) - height)
            self.subagent_scroll = min(maximum, max(0, self.subagent_scroll))
            if not visible:
                self.subagent_scroll = 0
                return
            index = visible.index(self.selected_subagent_item)
            if index < self.subagent_scroll:
                self.subagent_scroll = index
            elif index >= self.subagent_scroll + height:
                self.subagent_scroll = index - height + 1
            return
        visible = self._normalize_item_selection()
        maximum = max(0, len(visible) - height)
        self.item_scroll = min(maximum, max(0, self.item_scroll))
        if not visible:
            self.item_scroll = 0
            return
        index = visible.index(self.selected_item)
        if index < self.item_scroll:
            self.item_scroll = index
        elif index >= self.item_scroll + height:
            self.item_scroll = index - height + 1

    def toggle_selected_item(self) -> bool:
        if self.page == "subagents":
            visible = self._normalize_subagent_selection()
            if not visible or self.selected_subagent_item is None:
                return False
            if self.selected_subagent_item in self.subagent_enabled:
                self.subagent_enabled.remove(self.selected_subagent_item)
            else:
                self.subagent_enabled.add(self.selected_subagent_item)
                # Keep the enabled set valid: status-elapsed is mutually
                # exclusive with status/elapsed, so enabling one side drops
                # the other before _sync_subagent_items validates the list.
                self.subagent_enabled.difference_update(
                    catalog.BY_SCOPE["subagent"][self.selected_subagent_item].excludes
                )
            self._sync_subagent_items()
            return True
        visible = self._normalize_item_selection()
        if not visible or self.selected_item is None:
            return False
        if self.selected_item in self.enabled:
            self.enabled.remove(self.selected_item)
        else:
            self.enabled.add(self.selected_item)
        self._sync_display_items()
        return True

    def move_selected_item(self, direction: int) -> bool:
        if direction not in (-1, 1):
            raise ValueError("item direction must be -1 or 1")
        subagents = self.page == "subagents"
        visible = (
            self._normalize_subagent_selection()
            if subagents
            else self._normalize_item_selection()
        )
        selected = self.selected_subagent_item if subagents else self.selected_item
        if not visible or selected is None:
            return False
        visible_index = visible.index(selected)
        target_index = visible_index + direction
        if target_index < 0 or target_index >= len(visible):
            return False
        moving = selected
        target = visible[target_index]
        order = self.subagent_item_order if subagents else self.item_order
        order.remove(moving)
        full_target_index = order.index(target)
        insertion = full_target_index if direction < 0 else full_target_index + 1
        order.insert(insertion, moving)
        if subagents:
            self._sync_subagent_items()
        else:
            self._sync_display_items()
        return True

    def switch_page(self, direction: int = 1) -> bool:
        if self.numeric_edit is not None:
            return False
        pages = ("items", "subagents", "settings", "layout")
        current = pages.index(self.page) if self.page in pages else 0
        self.page = pages[(current + direction) % len(pages)]
        self.form_item = None
        return True

    def _cycle(self, value, choices: tuple, direction: int):
        index = choices.index(value)
        return choices[(index + direction) % len(choices)]

    def refresh_choices(self) -> tuple[int | None, ...]:
        current = self.host.refresh_interval
        if current is None or current in ui_models.REFRESH_PRESETS:
            return ui_models.REFRESH_PRESETS
        numeric = sorted(
            {choice for choice in ui_models.REFRESH_PRESETS if choice is not None}
            | {current}
        )
        return (None, *numeric)

    def toggle_setting(self) -> bool:
        if self.numeric_edit is not None:
            return False
        key = forms.current(self)["key"]
        if key == "colors":
            self.display = self.display.with_updates(
                use_colors=not self.display.use_colors
            )
            return True
        if key == "vim-indicator":
            self.host = replace(
                self.host,
                hide_vim_mode_indicator=not self.host.hide_vim_mode_indicator,
            )
            return True
        if key == "custom-subagent-rows":
            self.display = self.display.with_updates(
                subagents=self.display.subagents.with_updates(
                    enabled=not self.display.subagents.enabled
                )
            )
            return True
        return False

    def adjust_setting(self, direction: int) -> bool:
        if direction not in (-1, 1):
            raise ValueError("setting direction must be -1 or 1")
        if self.numeric_edit is not None:
            return False
        key = forms.current(self)["key"]
        if key in ("colors", "vim-indicator", "custom-subagent-rows"):
            return self.toggle_setting()
        if key == "palette":
            self.display = self.display.with_updates(
                palette=self._cycle(
                    self.display.palette, config_display.PALETTES, direction
                )
            )
        elif key == "directory-style":
            self.display = self.display.with_updates(
                directory_style=self._cycle(
                    self.display.directory_style,
                    config_display.DIRECTORY_STYLES,
                    direction,
                )
            )
        elif key == "separator-style":
            self.display = self.display.with_updates(
                separator_style=self._cycle(
                    self.display.separator_style,
                    config_display.SEPARATOR_STYLES,
                    direction,
                )
            )
        elif key == "padding":
            value = min(
                config_models.PADDING_MAX,
                max(config_models.PADDING_MIN, self.host.padding + direction),
            )
            self.host = replace(self.host, padding=value)
        elif key == "refresh_interval":
            choices = self.refresh_choices()
            value = self._cycle(self.host.refresh_interval, choices, direction)
            self.host = replace(self.host, refresh_interval=value)
        elif key == "scope-labels":
            self.display = self.display.with_updates(
                scope_labels=self._cycle(
                    self.display.scope_labels, config_display.SCOPE_LABELS, direction
                )
            )
        else:
            return False
        return True

    def set_refresh_event(self) -> bool:
        if (
            self.numeric_edit is not None
            or forms.current(self)["key"] != "refresh_interval"
        ):
            return False
        self.host = replace(self.host, refresh_interval=None)
        return True

    def input_digit(self, digit: str) -> bool:
        if len(digit) != 1 or not digit.isascii() or not digit.isdigit():
            return False
        field = {"padding": "padding", "refresh_interval": "refresh"}.get(
            forms.current(self)["key"]
        )
        if field is None:
            return False
        if self.numeric_edit is None:
            original = (
                self.host.padding if field == "padding" else self.host.refresh_interval
            )
            self.numeric_edit = ui_models.NumericEdit(field, digit, original)
        else:
            self.numeric_edit.buffer += digit
        self._apply_numeric_buffer()
        return True

    def backspace_numeric(self) -> bool:
        if self.numeric_edit is None:
            return False
        self.numeric_edit.buffer = self.numeric_edit.buffer[:-1]
        self._apply_numeric_buffer()
        return True

    def _numeric_value(self) -> tuple[int | None, str | None]:
        edit = self.numeric_edit
        if edit is None:
            return None, msg("ui.editor.not_editing_a_number")
        if not edit.buffer:
            return None, msg("ui.editor.enter_a_number")
        value = int(edit.buffer)
        if edit.field == "padding":
            if not config_models.PADDING_MIN <= value <= config_models.PADDING_MAX:
                return None, msg("ui.editor.padding_must_be_from_0_through_32")
        elif (
            not config_models.REFRESH_INTERVAL_MIN
            <= value
            <= config_models.REFRESH_INTERVAL_MAX
        ):
            return None, msg("ui.editor.refresh_interval_must_be_from_1_through")
        return value, None

    def _apply_numeric_buffer(self) -> None:
        edit = self.numeric_edit
        if edit is None:
            return
        value, error = self._numeric_value()
        edit.error = error
        if error is not None or value is None:
            return
        if edit.field == "padding":
            self.host = replace(self.host, padding=value)
        else:
            self.host = replace(self.host, refresh_interval=value)

    def accept_numeric(self) -> bool:
        if self.numeric_edit is None:
            return False
        value, error = self._numeric_value()
        self.numeric_edit.error = error
        if error is not None or value is None:
            return False
        if self.numeric_edit.field == "padding":
            self.host = replace(self.host, padding=value)
        else:
            self.host = replace(self.host, refresh_interval=value)
        self.numeric_edit = None
        return True

    def cancel_numeric(self) -> bool:
        edit = self.numeric_edit
        if edit is None:
            return False
        if edit.field == "padding":
            self.host = replace(self.host, padding=int(edit.original or 0))
        else:
            self.host = replace(self.host, refresh_interval=edit.original)
        self.numeric_edit = None
        return True

    def setting_values(self) -> tuple[str, ...]:
        values = [
            "on" if self.display.use_colors else "off",
            self.display.palette,
            self.display.directory_style,
            self.display.separator_style,
            str(self.host.padding),
            "event"
            if self.host.refresh_interval is None
            else str(self.host.refresh_interval),
            "hide" if self.host.hide_vim_mode_indicator else "show",
            self.display.scope_labels,
            "on" if self.display.subagents.enabled else "off",
        ]
        if self.numeric_edit is not None:
            edit_index = 4 if self.numeric_edit.field == "padding" else 5
            values[edit_index] = f"[{self.numeric_edit.buffer}_]"
        return tuple(values)


# A descriptive alias for callers that prefer the longer public-internal name.
InteractiveConfigState = EditorState


def save_configuration(
    config_dir: Path,
    executable: Path,
    state: EditorState,
    *,
    before_commit: Callable[[], None] | None = None,
) -> config_models.MutationResult:
    """Commit one complete draft through the existing atomic transaction."""
    return config_service.apply_configuration(
        config_dir,
        executable,
        items=list(state.final_items()),
        colors="on" if state.display.use_colors else "off",
        palette=state.display.palette,
        directory_style=state.display.directory_style,
        separator_style=state.display.separator_style,
        padding=state.host.padding,
        refresh_interval=(
            "event"
            if state.host.refresh_interval is None
            else state.host.refresh_interval
        ),
        hide_vim_mode_indicator=("on" if state.host.hide_vim_mode_indicator else "off"),
        subagent_items=list(state.final_subagent_items()),
        subagent_statusline=("on" if state.display.subagents.enabled else "off"),
        scope_labels=state.display.scope_labels,
        display_draft=state.display.with_updates(
            items=state.final_items(),
            subagents=state.display.subagents.with_updates(
                items=state.final_subagent_items()
            ),
        ),
        expected=state.baseline,
        before_commit=before_commit,
    )
