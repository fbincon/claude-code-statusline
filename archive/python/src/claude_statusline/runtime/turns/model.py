"""Compatibility alias for the canonical task model module."""

import sys
from claude_statusline.runtime.tasks import model as _implementation

sys.modules[__name__] = _implementation
