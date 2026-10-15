"""Compatibility alias for the canonical task store module."""

import sys
from claude_statusline.runtime.tasks import store as _implementation

sys.modules[__name__] = _implementation
