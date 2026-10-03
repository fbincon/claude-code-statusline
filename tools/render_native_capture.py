"""Render real decoded terminal cells as a cropped native-pane PNG.

This is a reconstruction of captured terminal output, not an OS screenshot or
an invented UI. Requires Pillow and the supplied fonts, only for documentation.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path


def main() -> int:
    from PIL import Image, ImageDraw, ImageFont
    from PIL.PngImagePlugin import PngInfo

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("capture", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument(
        "--font",
        type=Path,
        default=Path("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"),
    )
    parser.add_argument(
        "--cjk-font",
        type=Path,
        default=Path("/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"),
    )
    parser.add_argument("--commit", required=True)
    parser.add_argument(
        "--symbols-font",
        type=Path,
        default=Path("/usr/share/fonts/truetype/noto/NotoSansSymbols2-Regular.ttf"),
    )
    args = parser.parse_args()
    raw = args.capture.read_bytes()
    data = json.loads(raw)
    cells = data["cells"]
    # Crop away the transcript, composer, live model and private configuration
    # paths. The dock separator and global footer come from actual cell data.
    separator = next(
        (col for col, cell in enumerate(cells[0]) if cell["data"] == "│"), None
    )
    if separator is None:
        parser.error(
            "This renderer expects a docked capture; choose the 120-column case"
        )
    end = next(
        (row for row, line in enumerate(cells) if line[separator]["data"] == "─"),
        len(cells),
    )
    first = separator + 1
    columns = data["columns"] - first
    width, height = 12, 24
    image = Image.new("RGB", (columns * width + 24, end * height + 24), "#17191e")
    draw = ImageDraw.Draw(image)
    font = ImageFont.truetype(str(args.font), 20)
    cjk = ImageFont.truetype(str(args.cjk_font), 20)
    symbols = ImageFont.truetype(str(args.symbols_font), 12)
    bold_path = args.font.with_name(args.font.stem + "-Bold" + args.font.suffix)
    bold = ImageFont.truetype(str(bold_path), 20) if bold_path.exists() else font
    colors = {
        "default": "#dedee7",
        "black": "#202127",
        "red": "#f08080",
        "green": "#85c99a",
        "brown": "#e5c07b",
        "yellow": "#e5c07b",
        "blue": "#87aade",
        "magenta": "#cba2e5",
        "cyan": "#85d1db",
        "white": "#dedee7",
        "brightblack": "#858895",
        "brightred": "#fca5a5",
        "brightgreen": "#a6e3a1",
        "brightyellow": "#f9e2af",
        "brightblue": "#89b4fa",
        "brightmagenta": "#cba6f7",
        "brightcyan": "#94e2d5",
        "brightwhite": "#ffffff",
    }

    def color(value):
        if value in colors:
            return colors[value]
        if len(value) == 6 and all(c in "0123456789abcdef" for c in value.lower()):
            return "#" + value
        return colors["default"]

    for row in range(end):
        for column in range(first, data["columns"]):
            cell = cells[row][column]
            if not cell["data"]:
                continue
            x, y = 12 + (column - first) * width, 12 + row * height
            fg, bg = (
                color(cell["fg"]),
                color(cell["bg"]) if cell["bg"] != "default" else "#17191e",
            )
            if cell["reverse"]:
                fg, bg = bg, fg
            draw.rectangle((x, y, x + width, y + height), fill=bg)
            selected = (
                symbols
                if "\u23f1" in cell["data"]
                else cjk
                if any(ord(char) > 0x2E80 for char in cell["data"])
                else bold
                if cell["bold"]
                else font
            )
            draw.text((x, y), cell["data"], font=selected, fill=fg, stroke_width=0)
    metadata = PngInfo()
    metadata.add_text(
        "source",
        "Decoded cells of a real Claude Code terminal session; cropped to the native pane",
    )
    metadata.add_text("commit", args.commit)
    metadata.add_text("capture_sha256", hashlib.sha256(raw).hexdigest())
    args.output.parent.mkdir(parents=True, exist_ok=True)
    image.save(args.output, pnginfo=metadata)
    print(f"{args.output}: {image.width}x{image.height}, captured commit {args.commit}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
