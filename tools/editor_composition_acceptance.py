"""Installed, bilingual component editing through actual native/curses keys."""

from claude_statusline.i18n import translate as t
from editor_discovery_acceptance import request, prefix


def exercise(
    *,
    native,
    language,
    backend,
    env,
    root,
    config,
    send,
    capture,
    reopen,
    close,
    description,
    case_id="",
    terminal_theme="dark",
):
    before = request(backend, env, root, "read")["draft"]
    paths = [config / "claude-statusline.json", config / "settings.json"]
    original = [path.read_bytes() for path in paths]
    main_title = t(
        "native.ui.client.draw.main_items" if native else "ui.drawing.main_items",
        language,
    )
    sub_title = t(
        "native.ui.client.draw.subagent_items"
        if native
        else "ui.drawing.subagent_items",
        language,
    )
    # Copy/edit operations stay in the draft; removing the copy restores the source.
    send(b"\x04", "(2)")
    send(b" ", "[ ]")
    send(b" ", "[x]")
    send(b"\x1b[C", "(2)")
    capture("composition-repeat-" + language)
    send(b"\x18", main_title)
    # The type picker is read-only until Enter; the new text starts empty.
    send(b"\x01", t("composition.picker", language))
    send(b"/text\r", t("items.main.text.label", language))
    capture("composition-picker-" + language, mode="picker")
    send(b"\r", main_title)
    send(b"\x05\x1b[H\x1b[B", t("fields.item.text.label", language))
    send(b"\r", t("ui.hints.accept", language))
    literal = "◆ ${model} 中文 👩🏽‍💻"
    send(b"\x15" + literal.encode() + b"\r", "${model}")
    send(b"\x07", main_title)
    capture("composition-text-" + language)
    send(b"2" if native else b"\t", sub_title)
    send(b"\x1b[H\x1b[B\x04", "(2)")
    send(b"\x05\r", t("ui.hints.accept", language))
    send(b"\x15Worker\r\x07", "Worker")
    capture("composition-subagent-" + language)
    assert [p.read_bytes() for p in paths] == original, (
        "Draft editing wrote configuration"
    )
    key = (
        "native.hooks.register.tool_configuration_saved_later_statusline_refreshes_use_these"
        if native
        else "ui.session.status_line_configuration_updated"
    )
    send(b"S" if native else b"\x13", prefix(key, language))
    saved = request(backend, env, root, "read")["draft"]
    text = [i for i in saved["display"]["instances"] if i["type_id"] == "text"]
    assert len(text) == 1 and text[0]["text"] == literal
    agents = saved["display"]["subagents"]["instances"]
    names = [i for i in agents if i["type_id"] == "name"]
    assert len(names) == 2 and names[0]["id"] != names[1]["id"]
    assert (
        names[0]["options"]["label"] is None
        and names[1]["options"]["label"] == "Worker"
    )
    assert saved["host"] == before["host"]
    assert (
        len([i for i in saved["display"]["instances"] if i["type_id"] == "spacer"]) == 1
    )
    close()
    reopen()
    capture("composition-reopened-" + language)
    send(b"\x04", "(2)")
    close()
    assert request(backend, env, root, "read")["draft"] == saved, (
        "Cancel changed identities or saved options"
    )
    return {
        "language": language,
        "checks": [
            "copy-toggle-move-remove",
            "type-picker",
            "literal-text-without-expansion",
            "independent-subagent-copy",
            "spacer-preview",
            "draft-no-write",
            "save-reopen-stable-identities",
            "cancel-preserves-saved-state",
        ],
    }
