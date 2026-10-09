"""Per-parser help and error localization without modifying argparse globals."""

from __future__ import annotations

import argparse
from functools import partial
from copy import copy
import re

from .translator import present, translate


def parser_message(value: str, locale: str) -> str:
    # These are argparse's display grammar, not application state/error tests.
    # Unknown Python-version diagnostics retain their original detail.
    patterns = (
        (r"the following arguments are required: (.*)", "cli.required", ("arguments",)),
        (r"unrecognized arguments: (.*)", "cli.unrecognized", ("arguments",)),
        (r"argument (.*?): (.*)", "cli.argument_error", ("argument", "detail")),
        (r"invalid choice: (.*?) \(choose from (.*)\)", "cli.invalid_choice", ("value", "choices")),
        (r"invalid (.*?) value: (.*)", "cli.invalid_type", ("type", "value")),
        (r"expected (\d+) arguments", "cli.expected_arguments", ("count",)),
        (r"not allowed with argument (.*)", "cli.not_allowed", ("argument",)),
    )
    for pattern, key, names in patterns:
        matched = re.fullmatch(pattern, value)
        if matched:
            params = dict(zip(names, matched.groups()))
            if "detail" in params:
                params["detail"] = parser_message(params["detail"], locale)
            return translate(key, locale, **params)
    for text, key in (("expected one argument", "cli.expected_one"),
                      ("expected at least one argument", "cli.expected_at_least_one")):
        if value == text:
            return translate(key, locale)
    return value


class _Formatter(argparse.HelpFormatter):
    def __init__(self, *args, locale="en", **kwargs):
        self.locale = locale
        super().__init__(*args, **kwargs)

    def add_usage(self, usage, actions, groups, prefix=None):
        super().add_usage(usage, actions, groups,
                          translate("cli.usage", self.locale) if prefix is None else prefix)

    def _expand_help(self, action):
        translated = copy(action)
        translated.help = present(action.help, self.locale)
        return super()._expand_help(translated)


class _Subparsers(argparse._SubParsersAction):
    def __init__(self, *args, locale="en", **kwargs):
        self.locale = locale
        super().__init__(*args, **kwargs)

    def add_parser(self, name, **kwargs):
        if "help" in kwargs:
            kwargs["help"] = present(kwargs["help"], self.locale)
        return super().add_parser(name, **kwargs)


class LocalizedParser(argparse.ArgumentParser):
    def __init__(self, *args, locale="en", **kwargs):
        self.locale = locale
        help_enabled = kwargs.pop("add_help", True)
        if "description" in kwargs:
            kwargs["description"] = present(kwargs["description"], locale)
        kwargs.setdefault("formatter_class", partial(_Formatter, locale=locale))
        super().__init__(*args, add_help=False, **kwargs)
        self._positionals.title = translate("cli.positionals", locale)
        self._optionals.title = translate("cli.options", locale)
        if help_enabled:
            self.add_argument("-h", "--help", action="help", default=argparse.SUPPRESS,
                              help=translate("cli.help.help", locale))

    def add_argument(self, *args, **kwargs):
        if "help" in kwargs:
            kwargs["help"] = present(kwargs["help"], self.locale)
        return super().add_argument(*args, **kwargs)

    def add_subparsers(self, **kwargs):
        kwargs.setdefault("parser_class", partial(type(self), locale=self.locale))
        kwargs.setdefault("action", partial(_Subparsers, locale=self.locale))
        return super().add_subparsers(**kwargs)

    def error(self, value):
        self.print_usage(__import__("sys").stderr)
        self.exit(2, translate("cli.parser_error", self.locale, prog=self.prog,
                               detail=parser_message(str(value), self.locale)))
