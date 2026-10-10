"""Synthetic protocol spans through the installed native preview and real host.

The proxy preserves the installed backend for every operation. Only preview
sample rows are replaced, since user color controls are intentionally deferred.
"""

from pathlib import Path
import json


def install_fixture(root: Path, backend: Path) -> Path:
    def span(text, foreground=None, background=None, bold=False):
        return dict(text=text, foreground=foreground, background=background, bold=bold)

    rows = [
        [
            span("BG "),
            span("👩", {"kind": "ansi", "value": 200}, {"kind": "ansi", "value": 25}),
            span(
                "🏽‍💻",
                {"kind": "ansi", "value": 2},
                {"kind": "rgb", "value": "#123456"},
                True,
            ),
            span("X "),
            span(
                "R",
                {"kind": "rgb", "value": "#8ed3d3"},
                {"kind": "rgb", "value": "#123456"},
                True,
            ),
            span(" Z"),
        ],
        [span("CLIP " + "👨‍👩‍👧‍👦 é 🇨🇳 1️⃣ " * 30)],
    ]
    short = [[span("OK")]]
    (root / "preview-fixture.json").write_text(
        json.dumps(rows, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    wrapper = root / "preview-backend"
    wrapper.write_text(
        f"#!{backend.parent / 'python'}\n"
        "import json, subprocess, sys\n"
        f"backend = {str(backend)!r}\n"
        "payload = sys.stdin.read() if sys.argv[1:2] == ['ui'] else None\n"
        "result = subprocess.run([backend, *sys.argv[1:]], input=payload, text=True, capture_output=True)\n"
        "output = result.stdout\n"
        "if result.returncode == 0 and payload and json.loads(payload).get('operation') == 'preview':\n"
        "    response = json.loads(output)\n"
        f"    rows = {rows!r} if json.loads(payload)['payload']['draft']['display']['use_colors'] else {short!r}\n"
        "    response['result'] = {'sample': True, 'main': rows[:1], 'subagents': rows[1:] or rows}\n"
        "    output = json.dumps(response, ensure_ascii=False) + '\\n'\n"
        "sys.stdout.write(output)\n"
        "sys.stderr.write(result.stderr)\n"
        "sys.exit(result.returncode)\n",
        encoding="utf-8",
    )
    wrapper.chmod(0o700)
    return wrapper


def verify_capture(cells, background, *, short=False, clipping=False):
    def locate(label):
        return next(
            (
                row[column:]
                for row in cells
                for column in range(len(row))
                if "".join(cell["data"] for cell in row[column:]).startswith(label)
            ),
            None,
        )

    base = "ffffff" if background == "light" else "17191e"
    if short:
        row = locate("OK")
        assert row and row[0]["bg"] == base
        assert not locate("BG 👩🏽‍💻X") and not locate("CLIP "), (
            "Stale long preview survived redraw"
        )
        return
    if clipping:
        clipped = locate("CLIP ")
        assert clipped and any(cell["data"] == "…" for cell in clipped)
        allowed = {"C", "L", "I", "P", " ", "", "👨‍👩‍👧‍👦", "é", "🇨🇳", "1️⃣", "…", "│"}
        assert all(cell["data"] in allowed for cell in clipped), (
            "Clipping split a grapheme"
        )
        return
    row = locate("BG 👩🏽‍💻X")
    assert row, "Combined emoji or following column was lost in native preview"
    assert row[3]["data"] == "👩🏽‍💻" and row[4]["data"] == ""
    assert row[3]["fg"] == "ff00d7" and row[3]["bg"] == "005faf"
    assert not row[3]["bold"], "Cluster did not keep its first visible style"
    assert row[5]["data"] == "X" and row[5]["bg"] == base and not row[5]["bold"]
    assert row[7]["data"] == "R" and row[7]["bg"] == "123456" and row[7]["bold"]
    assert row[9]["data"] == "Z" and row[9]["bg"] == base and not row[9]["bold"]
