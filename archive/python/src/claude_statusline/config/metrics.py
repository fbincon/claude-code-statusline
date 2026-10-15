"""Validated advanced-metric preferences, with no runtime probes."""

from claude_statusline.i18n import message as msg

from dataclasses import dataclass
import unicodedata


def base_ref(value):
    if value is None:
        return None
    if (
        not isinstance(value, str)
        or not value
        or len(value) > 256
        or value.startswith("-")
        or any(c.isspace() or unicodedata.category(c) in ("Cc", "Cs") for c in value)
    ):
        raise ValueError(
            msg('errors.metrics.branch_diff_base_ref_must_be_null')
        )
    return value


@dataclass(frozen=True)
class Metrics:
    branch_diff_base_ref: str | None = None

    def to_dict(self):
        return {"branch_diff_base_ref": self.branch_diff_base_ref}

    @classmethod
    def parse(cls, value):
        if not isinstance(value, dict) or set(value) != {"branch_diff_base_ref"}:
            raise ValueError(msg('errors.metrics.metrics_requires_exactly_branch_diff_base_ref'))
        return cls(base_ref(value["branch_diff_base_ref"]))
