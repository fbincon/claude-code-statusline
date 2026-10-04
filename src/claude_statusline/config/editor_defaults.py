"""Release defaults shared by the independent configuration editors."""

import re

from claude_statusline._version import __version__


def enabled_by_default(version: str = __version__) -> bool:
    return re.search(r"(?:a|b|rc|dev)\d", version) is None
