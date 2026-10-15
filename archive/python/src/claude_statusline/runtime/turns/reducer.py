"""Compatibility alias for the canonical task reducer module."""

import sys
from claude_statusline.runtime.tasks import reducer as _implementation

sys.modules[__name__] = _implementation
