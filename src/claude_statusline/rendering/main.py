"""rendering / main implementation."""

from __future__ import annotations

import json
import sys
from pathlib import Path
from claude_statusline.config import display as config_display
from claude_statusline.rendering import items as rendering_items
from claude_statusline.rendering import layout as rendering_layout
from claude_statusline.runtime import paths as runtime_paths


def main():
    sys.stdout.reconfigure(encoding="utf-8", newline="\n")
    try:
        # Read bytes directly: PowerShell pipes strings to native commands
        # with a UTF-8 BOM, which plain json.load cannot handle.
        raw = sys.stdin.buffer.read()
        if raw.startswith(b"\xef\xbb\xbf"):
            raw = raw[3:]
        data = json.loads(raw.decode("utf-8"))
    except Exception:
        return

    try:
        config = config_display.load_display_config(Path(runtime_paths.CONFIG_DIR))
    except config_display.DisplayConfigError:
        config = config_display.DEFAULT_CONFIG

    rows = rendering_items.configured_rows(data, config, rendering_layout._terminal_content_width())
    if rows:
        sys.stdout.write("\n".join(rows) + "\n")
