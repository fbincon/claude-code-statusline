"""Installed editor discovery/import scenarios shared by actual PTY runners.

Only configuration commands and fixed previews are used; no model prompts.
"""

from copy import deepcopy
import json
import os
import subprocess
import time

from claude_statusline.config import display, models
from claude_statusline.i18n import translate as t
from claude_statusline.i18n.translator import catalogue
from claude_statusline.ui import editor, forms
from claude_statusline.ui.contracts import PROTOCOL_VERSION


def prefix(key, language):
    return catalogue(language)[key].split("{", 1)[0].split(".", 1)[0].strip()


def backend_call(backend, env, cwd, *arguments, payload=None):
    result = subprocess.run([str(backend), *arguments], input=payload, text=True,
                            capture_output=True, check=True, timeout=90, env=env, cwd=cwd)
    return result.stdout


def request(backend, env, cwd, operation, payload=None):
    return json.loads(backend_call(backend, env, cwd, "ui", payload=json.dumps({
        "protocol_version": PROTOCOL_VERSION, "operation": operation, "payload": payload or {},
    })))["result"]


def native_setting_keys(description):
    fields = description["editor_fields"]["global"]
    return ["colors", "palette", "preview-background", "directory-style", "separator-style", "scope-labels",
            *["field:" + f["key"] for f in fields if f["group"] == "Appearance"],
            "padding", "refresh_interval", "vim-indicator", "settings-subagent-statusline",
            *["field:" + f["key"] for f in fields if f["group"] != "Appearance"],
            "ui-language", "preset-select", "preset-apply", "import-file", "export-file"]


def verify_native_capture(cells, language, mode, terminal_theme):
    from claude_statusline.rendering.formatters import display_width
    from terminal_colors import TERMINAL_THEMES, XTERM_PALETTE, cell_colors, contrast

    def find(label):
        width=display_width(label)
        return next((row[col:col+width] for row in cells for col in range(len(row)-width+1)
                     if "".join(cell["data"] for cell in row[col:col+width])==label),None)
    assert find(t("native.ui.client.draw.configure_status_line",language)), "Missing actual Client heading"
    key,action={"filtered":("S","save"),"guidance":("Ctrl+G","back"),"review":("A","accept_draft")}[mode]
    footer=find(key+" "+t("ui.hints."+action,language))
    assert footer and footer[0]["bold"], "Missing or unstyled modal action"
    assert all(not cell["bold"] for cell in footer[len(key)+1:]), "Action description inherited bold"
    fg,bg=TERMINAL_THEMES[terminal_theme]
    assert contrast(*cell_colors(footer[0],fg,bg,XTERM_PALETTE))>=4.5
    if mode=="guidance":assert find(t("guidance.title",language))
    if mode=="review":assert find(t("review.title",language))
    if mode=="filtered":
        plain="\n".join("".join(cell["data"] for cell in row) for row in cells)
        assert "←→ "+t("ui.hints.order",language) not in plain, "Filtered reorder is still advertised"


def exercise(*, native, language, backend, env, root, config, send, capture, reopen, close, description):
    """Run the same user operations through each editor's real keyboard path."""
    original = request(backend, env, root, "read")["draft"]
    paths = [config / "claude-statusline.json", config / "settings.json"]
    initial = [path.read_bytes() for path in paths]
    ui_path = config / "statusline-ui.json"
    ui_initial = ui_path.read_bytes() if ui_path.exists() else None
    candidate = deepcopy(original)
    candidate["display"].update(items=["model", "context-used", "task-active-timer"],
                                layout={"mode":"explicit", "rows":[["model", "context-used"],["task-active-timer"]]},
                                statusline_language="zh-CN")
    candidate["host"]["padding"] = 7
    portable = root / f"discovery-{language}.json"
    portable.write_text(json.dumps({"format":"claude-code-statusline","version":1,"draft":candidate},ensure_ascii=False))
    invalid = root / f"invalid-{language}.json"
    invalid.write_text("[]")

    def unchanged():
        assert [path.read_bytes() for path in paths] == initial, "Review/browsing unexpectedly saved configuration"
        assert (ui_path.read_bytes() if ui_path.exists() else None) == ui_initial, "Import changed interface preferences"

    def search(query):
        send(b"/\x15", t("native.ui.client.draw.filter",language) + "_" if native else t("ui.drawing.type_to_search",language) + "_")
        send(query.encode() + b"\r", t("items.main.model-with-effort.label",language) if query == "mwe" else (query if query else t("catalog.categories.all",language)))

    def setting(key):
        if native:
            index=native_setting_keys(description).index(key)
            label=t("native.settings." + key,language)
        else:
            state=editor.EditorState.from_effective(models.EffectiveConfig(display.validate_display_config(original["display"]),models.HostConfig(),True,paths[0]),language=language)
            state.page="settings"
            rows=forms.rows(state);index=next(i for i,row in enumerate(rows) if row["key"]==key)
            from claude_statusline.i18n.presentation import field_label
            label=field_label(rows[index],language)
        send(b"\x1b[H" + b"\x1b[B" * index,label)

    def file_action(key, path, observed):
        setting(key)
        if native:
            editing="Enter "+t("ui.hints.accept",language)
            send(b"\r",editing)
            send(b"\x15",editing)
            send(str(path).encode(),"› "+t("native.settings."+key,language)+": "+str(path)[:12])
            send(b"\r",observed)
        else:
            send(b"\r\x15" + str(path).encode() + b"\r",observed)

    search("mwe")
    capture("discovery-search-"+language, mode="filtered", preview_language="en")
    send(b"\x1b[D",t("catalog.search.order_disabled",language).split(".")[0])
    search("")
    send(b"\x06",t("catalog.search.categories",language))
    send(b"\x1b[H\x1b[B\x1b[B\x1b[B\r",t("catalog.categories.repository",language))
    capture("discovery-category-"+language,mode="filtered",preview_language="en")
    send(b"\x1b[D",t("catalog.search.order_disabled",language).split(".")[0])
    send(b"\x06\x1b[H\r",t("catalog.categories.all",language))
    search("task-active-timer")
    send(b"\x05\x1b[H\r",t("guidance.title",language))
    capture("discovery-guidance-"+language,mode="guidance",preview_language="en")
    send(b"\x1b[F","claude-statusline doctor")
    send(b"\x07\x07",t("native.ui.client.draw.main_items" if native else "ui.drawing.main_items",language))
    unchanged()
    send(b"3" if native else b"\t\t",t("native.ui.client.draw.tool_settings" if native else "ui.drawing.settings_global_options",language))
    setting("palette")
    send(b"\x1b[C","ansi")
    file_action("import-file",invalid,prefix("errors.transfer.import_requires_a_portable_envelope_or_a",language))
    unchanged()
    file_action("import-file",portable,t("review.title",language))
    send(b"\r",prefix("review.before",language))
    capture("discovery-review-"+language,mode="review",preview_language="zh-CN")
    send(b"\t",t("review.preview",language,scope=t("review.sections.subagent",language)))
    send(b"\x07",t("review.cancelled",language))
    unchanged()
    exported=root/f"kept-draft-{language}.json"
    export_key="native.hooks.register.exported_current_draft_may_be_unsaved" if native else "ui.session.exported_current_draft_may_be_unsaved"
    file_action("export-file",exported,prefix(export_key,language))
    kept=json.loads(exported.read_bytes())["draft"]
    assert kept["display"]["palette"]=="ansi" and kept["host"]==original["host"]
    file_action("import-file",portable,t("review.title",language))
    # Deleting the source proves that acceptance uses the reviewed snapshot.
    portable.unlink()
    send(b"A",prefix("review.accepted",language))
    unchanged()
    save_key="native.hooks.register.tool_configuration_saved_later_statusline_refreshes_use_these" if native else "ui.session.status_line_configuration_updated"
    saved=prefix(save_key,language)
    send(b"S" if native else b"\x13",saved)
    actual=request(backend,env,root,"read")["draft"]
    assert actual==candidate, "Saved draft differs from the reviewed candidate"
    close()
    reopen()
    capture("discovery-main-reopened-"+language,mode="editor",preview_language="zh-CN")
    close()
    assert request(backend,env,root,"read")["draft"]==candidate
    return {"language":language,"checks":["ranked-search-highlights","category-filter-no-reorder","source-guidance",
            "invalid-import-preserves-draft","review-cancel-retains-unsaved-palette","reviewed-file-not-reread",
            "accept-does-not-save","candidate-main-and-subagent-preview","explicit-save-and-reopen","ui-preference-preserved"]}


def external_case(backend, root, columns, rows, commit, language, terminal_theme):
    import codecs
    import fcntl
    import pty
    import select
    import signal
    import struct
    import termios
    import pyte
    from external_tui_acceptance import verify_colors
    from terminal_colors import TERMINAL_THEMES, XTERM_PALETTE

    root.mkdir(mode=0o700,parents=True,exist_ok=False)
    config=root/"config 中文"
    env=dict(os.environ,CLAUDE_CONFIG_DIR=str(config),TERM="xterm-256color")
    env.pop("PYTHONPATH",None)
    backend_call(backend,env,root,"install","--no-native-editor","--no-experimental-slash-tui","--no-live-metrics")
    backend_call(backend,env,root,"config","set-items","model-with-effort","current-dir","context-used")
    backend_call(backend,env,root,"config","language","set",language)
    description=request(backend,env,root,"describe")
    process=None;master=None;raw=bytearray();captures=[]
    screen=pyte.Screen(columns,rows);stream=pyte.Stream(screen);decoder=codecs.getincrementaldecoder("utf-8")("replace")

    def wait(text,after=-1):
        import re,unicodedata
        compact=lambda value:re.sub(r"\s+","",unicodedata.normalize("NFC",value))
        deadline=time.monotonic()+20;last=time.monotonic()
        while time.monotonic()<deadline:
            ended=False
            if select.select([master],[],[],.1)[0]:
                try:chunk=os.read(master,65536)
                except OSError:chunk=b""
                if chunk:raw.extend(chunk);stream.feed(decoder.decode(chunk));last=time.monotonic()
                elif process.poll() is not None:ended=True
            if len(raw)>after and compact(text) in compact("\n".join(screen.display)) and (ended or time.monotonic()-last>.15):return
            if ended:break
        (root/"last-screen.txt").write_text("\n".join(screen.display))
        raise RuntimeError(f"External {language} {columns}x{rows}: did not observe {text!r}")

    def send(data,text):
        # curses keypad mode uses application-cursor (SS3) keys, unlike Client.
        for char in b"ABCDHF":
            data=data.replace(b"\x1b["+bytes([char]),b"\x1bO"+bytes([char]))
        after=len(raw);os.write(master,data);wait(text,after)

    def open_editor():
        nonlocal process,master,screen,stream,decoder
        master,slave=pty.openpty();fcntl.ioctl(slave,termios.TIOCSWINSZ,struct.pack("HHHH",rows,columns,0,0))
        def setup():
            os.setsid();fcntl.ioctl(slave,termios.TIOCSCTTY,0)
        process=subprocess.Popen([str(backend),"configure"],env=env,cwd=root,stdin=slave,stdout=slave,stderr=slave,preexec_fn=setup,close_fds=True)
        os.close(slave);screen=pyte.Screen(columns,rows);stream=pyte.Stream(screen);decoder=codecs.getincrementaldecoder("utf-8")("replace")
        wait(t("ui.drawing.preview_sample_data",language).rstrip(" ·"))

    def close_editor():
        nonlocal master
        if process and process.poll() is None:
            os.write(master,b"\x1b")
            try:process.wait(timeout=5)
            except subprocess.TimeoutExpired:os.killpg(process.pid,signal.SIGTERM);process.wait(timeout=5)
        if master is not None:os.close(master);master=None

    def capture(name,mode="editor",preview_language="en"):
        cells=[[screen.buffer[y][x]._asdict() for x in range(columns)] for y in range(rows)]
        fg,bg=TERMINAL_THEMES[terminal_theme]
        contrast=verify_colors(cells,columns,rows,fg,bg)
        path=root/(name+".json")
        path.write_text(json.dumps({"columns":columns,"rows":rows,"cells":cells,"surface":"external","source_commit":commit,
          "ui_language":language,"statusline_language":preview_language,"sample_data":True,"terminal_theme":terminal_theme,
          "terminal_foreground":fg,"terminal_background":bg,"terminal_palette":XTERM_PALETTE,"preview_min_contrast":contrast},ensure_ascii=False))
        captures.append(path.name)

    try:
        open_editor()
        result=exercise(native=False,language=language,backend=backend,env=env,root=root,config=config,send=send,capture=capture,
                        reopen=open_editor,close=close_editor,description=description)
        return {**result,"columns":columns,"rows":rows,"captures":captures}
    finally:
        close_editor();(root/"terminal.ansi").write_bytes(raw)
