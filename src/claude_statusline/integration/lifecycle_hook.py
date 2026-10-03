"""integration / lifecycle_hook implementation."""

from __future__ import annotations

import json
import sys
from claude_statusline.runtime.turns import reducer as turn_reducer


def main():
    try:
        raw = sys.stdin.buffer.read()
        if raw.startswith(b"\xef\xbb\xbf"):
            raw = raw[3:]
        data = json.loads(raw.decode("utf-8"))
        turn_reducer.handle_event(data)
    except Exception:
        # Lifecycle hooks must never block, restart, or fail a Claude turn.
        pass
