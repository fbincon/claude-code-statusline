"""Shared deterministic selector steps for installed-terminal acceptance."""

from claude_statusline.i18n import LANGUAGES


def language_steps(current, target):
    start, end = LANGUAGES.index(current), LANGUAGES.index(target)
    delta = 1 if end > start else -1
    return [(LANGUAGES[index], delta) for index in range(start + delta, end + delta, delta)]
