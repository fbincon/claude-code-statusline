"""Lazy, explicit-language translation shared by administrative interfaces.

Rendering and hooks never need to load language resources. Messages retain their
English string value for diagnostics and machine interfaces until presented.
"""

from .translator import LANGUAGES, LANGUAGE_NAMES, Message, as_message, message, translate

__all__ = ["LANGUAGES", "LANGUAGE_NAMES", "Message", "as_message", "message", "translate"]
