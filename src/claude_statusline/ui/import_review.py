"""Read-only import review state and rows, separate from transfer and saving."""

from dataclasses import dataclass, field
import json

from claude_statusline.config import display, models
from claude_statusline.config.import_review import SECTIONS
from claude_statusline.i18n import translate
from claude_statusline.ui.text_view import wrap_text


def localized(value, language):
    if isinstance(value, dict) and set(value) == {"key", "params", "fallback"}:
        params = {key: localized(item, language) for key, item in value["params"].items()}
        text = translate(value["key"], language, **params)
        return value["fallback"] if text == value["key"] else text
    return value


@dataclass
class ReviewState:
    result: dict
    display: display.DisplayConfig
    host: models.HostConfig
    selected: str = ""
    expanded: list[str] = field(default_factory=list)
    scroll: int = 0
    preview_scope: str = "main"
    follow_selection: bool = True

    @classmethod
    def from_result(cls, result):
        from claude_statusline.ui.protocol import validate_draft

        parsed, host = validate_draft(result["draft"], require_current_schema=True)
        state = cls(result, parsed, host)
        state.selected = next(iter(state.sections()), "")
        return state

    def sections(self):
        return [section for section in SECTIONS if any(change["section"] == section for change in self.result["changes"])]

    def rows(self, language, width):
        rows = []
        for section in self.sections():
            changes = [change for change in self.result["changes"] if change["section"] == section]
            heading = ("› " if section == self.selected else "  ") + ("[-] " if section in self.expanded else "[+] ") + translate("review.sections." + section, language) + f" ({len(changes)})"
            rows.append({"text": heading, "section": section, "heading": True})
            if section in self.expanded:
                for change in changes:
                    paragraphs = [localized(change["label"], language)]
                    for key in ("before", "after"):
                        value = json.dumps(change[key], ensure_ascii=False, sort_keys=True)
                        paragraphs.append(translate("review." + key, language, value=value))
                    for line in wrap_text(paragraphs, width):
                        rows.append({"text": line, "section": section, "heading": False})
        return rows or [{"text": translate("review.empty", language), "section": "", "heading": False}]

    def move_section(self, direction):
        sections = self.sections()
        if sections:
            index = sections.index(self.selected)
            self.selected = sections[max(0, min(len(sections) - 1, index + direction))]
            self.follow_selection = True

    def toggle(self):
        if self.selected:
            if self.selected in self.expanded:
                self.expanded.remove(self.selected)
            else:
                self.expanded.append(self.selected)
            self.follow_selection = True

    def window(self, language, width, capacity):
        rows = self.rows(language, width)
        if self.follow_selection:
            self.scroll = next((i for i, row in enumerate(rows) if row["heading"] and row["section"] == self.selected), 0)
            self.follow_selection = False
        self.scroll = max(0, min(self.scroll, max(0, len(rows) - capacity)))
        return rows[self.scroll:self.scroll + capacity], len(rows)
