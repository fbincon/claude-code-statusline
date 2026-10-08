"""Render real decoded terminal cells as a cropped editor-region PNG.

This is a reconstruction of captured terminal output, not an OS screenshot or
an invented UI. Requires Pillow and the supplied fonts, only for documentation.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from terminal_colors import cell_colors


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
    parser.add_argument("--surface", choices=("native", "external"), default="native")
    parser.add_argument(
        "--bounds",
        nargs=4,
        type=int,
        metavar=("X", "Y", "WIDTH", "HEIGHT"),
        help="Explicit cell crop for inline Client or external popup captures",
    )
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
    if args.bounds:
        left, top, columns, end = args.bounds
        if (
            min(left, top) < 0
            or min(columns, end) < 1
            or left + columns > data["columns"]
            or top + end > data["rows"]
        ):
            parser.error("Crop bounds must fit inside the captured terminal")
        cells = [line[left : left + columns] for line in cells[top : top + end]]
        first = 0
    else:
        separator = next(
            (col for col, cell in enumerate(cells[0]) if cell["data"] == "│"), None
        )
        if separator is None:
            parser.error(
                "Use --bounds for an inline capture, or choose a docked 120-column capture"
            )
        end = next(
            (row for row, line in enumerate(cells) if line[separator]["data"] == "─"),
            len(cells),
        )
        first = separator + 1
        columns = data["columns"] - first
    width, height = 12, 24
    default_fg = data.get("terminal_foreground", "#dedee7")
    default_bg = data.get("terminal_background", "#17191e")
    image = Image.new("RGB", (columns * width + 24, end * height + 24), default_bg)
    draw = ImageDraw.Draw(image)
    font = ImageFont.truetype(str(args.font), 20)
    cjk = ImageFont.truetype(str(args.cjk_font), 20)
    symbols = ImageFont.truetype(str(args.symbols_font), 12)
    bold_path = args.font.with_name(args.font.stem + "-Bold" + args.font.suffix)
    bold = ImageFont.truetype(str(bold_path), 20) if bold_path.exists() else font
    # Paint backgrounds first, including wide-character continuation cells.
    # Later cell backgrounds must not erase the second half of a CJK glyph.
    for row in range(end):
        for column in range(first, first + columns):
            cell = cells[row][column]
            x, y = 12 + (column - first) * width, 12 + row * height
            _, bg = cell_colors(cell, default_fg, default_bg)
            draw.rectangle((x, y, x + width, y + height), fill=bg)
    for row in range(end):
        for column in range(first, first + columns):
            cell = cells[row][column]
            if not cell["data"]:
                continue
            x, y = 12 + (column - first) * width, 12 + row * height
            fg, bg = cell_colors(cell, default_fg, default_bg)
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
        "Decoded cells of a real Claude Code terminal session; cropped to the native pane"
        if args.surface == "native"
        else "Decoded cells of a real external curses TUI terminal; fixed sample preview",
    )
    metadata.add_text("commit", args.commit)
    metadata.add_text("capture_sha256", hashlib.sha256(raw).hexdigest())
    if args.bounds:
        metadata.add_text("cell_bounds", json.dumps(args.bounds))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    image.save(args.output, pnginfo=metadata)
    print(f"{args.output}: {image.width}x{image.height}, captured commit {args.commit}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
