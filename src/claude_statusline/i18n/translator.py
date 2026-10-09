"""Named-placeholder messages with an English fallback and no global locale."""

from __future__ import annotations

from functools import lru_cache
from typing import Any

LANGUAGES = ("en", "zh-CN")
LANGUAGE_NAMES = {"en": "English", "zh-CN": "简体中文"}


@lru_cache(maxsize=2)
def catalogue(language: str) -> dict[str, str]:
    import json
    from importlib.resources import files

    language = language if language in LANGUAGES else "en"
    return json.loads(
        files("claude_statusline.i18n")
        .joinpath("locales", language + ".json")
        .read_text(encoding="utf-8")
    )


def translate(key: str, locale: str = "en", **params: Any) -> str:
    english = catalogue("en")
    template = catalogue(locale).get(key, english.get(key, key))
    return template.format_map(
        {name: _present(value, locale) for name, value in params.items()}
    )


def _present(value: Any, language: str) -> Any:
    if isinstance(value, Message):
        return value.render(language)
    if isinstance(value, BaseException):
        return _present(as_message(value), language)
    return value


class Message(str):
    """An English-compatible string carrying stable translation metadata."""

    key: str
    params: dict[str, Any]

    def __new__(cls, key: str, **params: Any):
        value = super().__new__(cls, translate(key, "en", **params))
        value.key, value.params = key, params
        return value

    def __str__(self):
        return self

    def __add__(self, other):
        return (
            message("message.concat", left=self, right=other)
            if isinstance(other, str)
            else NotImplemented
        )

    def __radd__(self, other):
        return (
            message("message.concat", left=other, right=self)
            if isinstance(other, str)
            else NotImplemented
        )

    def __reduce_ex__(self, protocol):
        return _restore_message, (self.key, self.params)

    def render(self, language: str = "en") -> str:
        return translate(self.key, language, **self.params)

    def wire(self) -> dict[str, Any]:
        def argument(value):
            value = as_message(value)
            if isinstance(value, Message):
                return value.wire()
            if value is None or isinstance(value, (str, int, float, bool)):
                return value
            return str(value)

        return {
            "key": self.key,
            "params": {key: argument(value) for key, value in self.params.items()},
            "fallback": str(self),
        }


def message(key: str, **params: Any) -> Message:
    return Message(key, **params)


def _restore_message(key, params):
    return message(key, **params)


def as_message(value: Any) -> Any:
    """Preserve metadata through exception wrapping; external errors stay raw."""
    if isinstance(value, BaseException):
        return value.args[0] if len(value.args) == 1 else str(value)
    return value


def present(value: Any, language: str = "en") -> str:
    return str(_present(as_message(value), language))
