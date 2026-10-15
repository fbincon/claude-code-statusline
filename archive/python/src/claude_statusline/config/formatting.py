"""Shared structured display options; validation has no persistence effects."""

from __future__ import annotations

from claude_statusline.i18n import message as msg

from dataclasses import asdict, dataclass, field, replace
import unicodedata
from claude_statusline.config import appearance


FORMAT_CHOICES = {
    "model_name": ("original", "short"),
    "number_format": ("legacy", "compact", "full", "grouped"),
    "labels": ("legacy", "short", "off"),
    "icons": ("legacy", "unicode", "ascii", "off"),
    "allowance": ("remaining", "used"),
    "reset_format": ("countdown", "time", "datetime"),
    "reset_timezone": ("local", "UTC"),
}


def exact(data, keys, name):
    if not isinstance(data, dict) or set(data) != set(keys):
        raise ValueError(msg('errors.formatting.must_contain_exactly', name=name, value1=', '.join(sorted(keys))))


def integer(value, minimum, maximum, name, *, nullable=False):
    if nullable and value is None:
        return None
    if type(value) is not int or not minimum <= value <= maximum:
        raise ValueError(msg('errors.formatting.must_be_an_integer_from_through', name=name, minimum=minimum, maximum=maximum))
    return value


def safe_text(value, name):
    if value is not None and (
        not isinstance(value, str)
        or len(value) > 256
        or any(unicodedata.category(c) in ("Cc", "Cs") for c in value)
    ):
        raise ValueError(
            msg('errors.formatting.must_be_null_or_text_without_control', name=name)
        )
    return value


def validate_overrides(data):
    if not isinstance(data, dict) or set(data) - set(FORMAT_CHOICES):
        raise ValueError(msg('errors.formatting.format_overrides_contain_unknown_fields'))
    for key, value in data.items():
        if not isinstance(value, str) or value not in FORMAT_CHOICES[key]:
            raise ValueError(msg('errors.formatting.must_be_one_of', field=key, value1=', '.join(FORMAT_CHOICES[key])))
    return dict(data)


@dataclass(frozen=True)
class Thresholds:
    enabled: bool = False
    warning: int = 70
    critical: int = 90

    def to_dict(self):
        return asdict(self)

    @classmethod
    def parse(cls, data):
        exact(data, asdict(cls()), "thresholds")
        if type(data["enabled"]) is not bool:
            raise ValueError(msg('errors.formatting.thresholds_enabled_must_be_a_boolean'))
        warning = integer(data["warning"], 0, 100, "thresholds.warning")
        critical = integer(data["critical"], 0, 100, "thresholds.critical")
        if warning >= critical:
            raise ValueError(msg('errors.formatting.thresholds_warning_must_be_below_critical'))
        return cls(data["enabled"], warning, critical)


@dataclass(frozen=True)
class Formatting:
    model_name: str = "original"
    number_format: str = "legacy"
    labels: str = "legacy"
    icons: str = "legacy"
    allowance: str = "remaining"
    reset_format: str = "countdown"
    reset_timezone: str = "local"
    thresholds: Thresholds = field(default_factory=Thresholds)

    def to_dict(self):
        return asdict(self)

    @classmethod
    def parse(cls, data):
        exact(data, asdict(cls()), "formatting")
        choices = validate_overrides(
            {k: v for k, v in data.items() if k != "thresholds"}
        )
        return cls(**choices, thresholds=Thresholds.parse(data["thresholds"]))

    def overridden(self, values):
        return replace(self, **validate_overrides(values)) if values else self


@dataclass(frozen=True)
class ItemOptions:
    label: str | None = None
    icon: str | None = None
    priority: int = 50
    max_width: int | None = None
    formatting: dict[str, str] = field(default_factory=dict)
    foreground: str | None = None
    background: str | None = None
    visibility: str = "always"
    visibility_threshold: int = 70

    def to_dict(self):
        return asdict(self)

    @classmethod
    def parse(cls, data):
        exact(data, asdict(cls()), "item options")
        return cls(
            safe_text(data["label"], "label"),
            safe_text(data["icon"], "icon"),
            integer(data["priority"], 0, 100, "priority"),
            integer(data["max_width"], 2, 10000, "max_width", nullable=True),
            validate_overrides(data["formatting"]),
            appearance.color(data["foreground"]),
            appearance.color(data["background"]),
            data["visibility"],
            integer(data["visibility_threshold"], 0, 100, "visibility_threshold"),
        )


LEGACY_ITEM_KEYS = {"label", "icon", "priority", "max_width", "formatting"}


def item_options(data, identifiers, scope="main", *, legacy=False):
    if not isinstance(data, dict) or set(data) - set(identifiers):
        raise ValueError(msg('errors.formatting.item_options_must_map_known_scoped_item'))
    result = {}
    for key, value in data.items():
        if legacy:
            exact(value, LEGACY_ITEM_KEYS, "item options")
            value = {**ItemOptions().to_dict(), **value}
        option = ItemOptions.parse(value)
        appearance.validate_visibility(scope, key, option.visibility)
        result[key] = option
    return result


@dataclass(frozen=True)
class Layout:
    mode: str = "auto"
    rows: tuple[tuple[str, ...], ...] = ()

    def to_dict(self):
        return {"mode": self.mode, "rows": [list(row) for row in self.rows]}

    @classmethod
    def parse(cls, data, items):
        exact(data, ("mode", "rows"), "layout")
        rows = data["rows"]
        if data["mode"] not in ("auto", "explicit") or not isinstance(rows, list):
            raise ValueError(msg('errors.formatting.layout_requires_auto_explicit_mode_and_an'))
        if any(
            not isinstance(row, list)
            or not row
            or any(not isinstance(i, str) for i in row)
            for row in rows
        ):
            raise ValueError(msg('errors.formatting.layout_rows_must_be_nonempty_arrays_of'))
        if data["mode"] == "auto" and rows:
            raise ValueError(msg('errors.formatting.auto_layout_requires_empty_rows'))
        if data["mode"] == "explicit" and [i for row in rows for i in row] != list(
            items
        ):
            raise ValueError(
                msg('errors.formatting.explicit_rows_must_flatten_to_items_in')
            )
        return cls(data["mode"], tuple(tuple(row) for row in rows))

    def reordered(self, items):
        if self.mode == "auto":
            return self
        remaining = list(items)
        selected = set(items)
        rows = []
        for row in self.rows:
            size = sum(item in selected for item in row)
            if size:
                rows.append(tuple(remaining[:size]))
                del remaining[:size]
        if remaining:
            if rows:
                rows[-1] += tuple(remaining)
            else:
                rows.append(tuple(remaining))
        return Layout("explicit", tuple(rows))


def legacy_fitting(options):
    """Appearance-only entries do not activate legacy subagent priority fitting."""
    return any(
        option.label is not None or option.icon is not None or option.formatting
        or option.priority != 50 or option.max_width is not None
        for option in options.values()
    )
