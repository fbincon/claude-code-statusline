"""Appearance controls and portable review through installed editor keyboards."""

import json

from claude_statusline.config import display, editor_fields, models
from claude_statusline.i18n import translate as t
from claude_statusline.i18n.presentation import field_label
from claude_statusline.ui import editor, forms
from editor_discovery_acceptance import request, native_setting_keys, prefix


def verify_capture(cells, *, native):
    """Identify actual sample text, rather than editor labels or synthetic spans."""
    matches = []
    for row in cells:
        for x in range(len(row) - 4):
            if "".join(c["data"] for c in row[x:x + 5]) == "Paint":
                run = row[x:x + 5]
                if run[0]["bg"] != "default":
                    matches.append(run)
    assert matches, "Explicit item background was not visible on the Paint sample"
    if native:
        assert any(all(c["fg"] == "abcdef" and c["bg"] == "123456" for c in run) for run in matches)
    else:
        assert any(len({(c["fg"], c["bg"]) for c in run}) == 1 for run in matches)


def exercise(*, native, language, backend, env, root, config, send, capture,
             reopen, close, description, case_id="", terminal_theme="dark"):
    original = request(backend, env, root, "read")["draft"]
    paths = [config / "claude-statusline.json", config / "settings.json"]
    initial = [p.read_bytes() for p in paths]
    portable = root / f"appearance-{language}-{case_id}.json"

    def unchanged():
        assert [p.read_bytes() for p in paths] == initial

    def field(key, item=None):
        if item:
            specs = sorted(editor_fields.item_fields("main", item),
                           key=lambda s: ("Item format", "Conditional visibility", "Item colors", "Item fitting").index(s["group"]))
            keys = ["item-guidance", *["item:" + s["key"] for s in specs]]
            index = keys.index(key)
            label = t("fields.item." + key[5:] + ".label", language)
        elif native:
            index = native_setting_keys(description).index(key)
            label = t("fields.global." + key[6:] + ".label" if key.startswith("field:") else "native.settings." + key, language)
        else:
            state = editor.EditorState.from_effective(models.EffectiveConfig(
                display.validate_display_config(original["display"]), models.HostConfig(), True, paths[0]), language=language)
            state.page = "settings"
            rows = forms.rows(state)
            index = next(i for i, r in enumerate(rows) if r["key"] == key)
            label = field_label(rows[index], language)
        send(b"\x1b[H" + b"\x1b[B" * index, label[:16])

    def text(value, observed=None):
        send(b"\r\x15" + value.encode() + b"\r", observed or value)

    def detail(item):
        send(b"/\x15" + item.encode() + b"\r", t("items.main." + item + ".label", language))
        send(b"\x05", t("fields.item.label.label", language)[:12])

    detail("model")
    for key, value in (("label", "Paint"), ("foreground", "#abcdef"), ("background", "#123456")):
        field("item:" + key, "model")
        text(value)
    capture("appearance-colors-" + language, mode="appearance")
    send(b"\x07", t("native.ui.client.draw.main_items" if native else "ui.drawing.main_items", language))
    detail("context-used")
    field("item:visibility", "context-used")
    send(b"\x1b[C", t("values.used-at-least", language)[:14])
    field("item:visibility_threshold", "context-used")
    text("90")
    send(b"\x07", t("native.ui.client.draw.main_items" if native else "ui.drawing.main_items", language))
    send(b"3" if native else b"\t\t", t("native.ui.client.draw.tool_settings" if native else "ui.drawing.settings_global_options", language))
    field("field:theme")
    send(b"\x1b[C", t("values.dark", language))
    theme = "dark"
    if terminal_theme == "light":
        send(b"\x1b[C", t("values.light", language))
        theme = "light"
    field("separator-style")
    send(b"\x1b[C", t("values.compact", language))
    send(b"\x1b[C", t("values.powerline", language))
    capture("appearance-powerline-" + language, mode="appearance")
    unchanged()
    field("export-file")
    text(str(portable), prefix("native.hooks.register.exported_current_draft_may_be_unsaved" if native else "ui.session.exported_current_draft_may_be_unsaved", language))
    exported = json.loads(portable.read_bytes())["draft"]
    assert exported["display"]["theme"] == theme
    assert exported["display"]["separator_style"] == "powerline"
    assert exported["display"]["powerline_glyph"] == "ascii"
    assert exported["display"]["item_options"]["model"]["foreground"] == "#abcdef"
    assert exported["display"]["item_options"]["model"]["background"] == "#123456"
    assert exported["display"]["item_options"]["context-used"]["visibility"] == "used-at-least"
    assert exported["display"]["item_options"]["context-used"]["visibility_threshold"] == 90
    assert exported["host"] == original["host"]
    close()
    unchanged()
    reopen()
    send(b"3" if native else b"\t\t", t("native.ui.client.draw.tool_settings" if native else "ui.drawing.settings_global_options", language))
    field("import-file")
    text(str(portable), t("review.title", language))
    capture("appearance-import-" + language, mode="review")
    send(b"A", prefix("review.accepted", language))
    unchanged()
    send(b"S" if native else b"\x13", prefix("native.hooks.register.tool_configuration_saved_later_statusline_refreshes_use_these" if native else "ui.session.status_line_configuration_updated", language))
    assert request(backend, env, root, "read")["draft"] == exported
    close()
    reopen()
    capture("appearance-saved-" + language, mode="appearance")
    close()
    assert request(backend, env, root, "read")["draft"] == exported
    return {"language": language, "checks": [
        "item-channel-keyboard-edits", "raw-usage-condition-controls", "theme-preserves-item-overrides",
        "powerline-preview", "export-unsaved-appearance", "cancel-byte-identical",
        "review-and-accept-before-save", "saved-draft-roundtrip", "real-installed-preview-colors",
    ]}
