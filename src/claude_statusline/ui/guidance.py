"""Localized static item explanations; inspecting them never collects data."""

from claude_statusline.config import catalog
from claude_statusline.i18n import translate as t
from claude_statusline.ui.text_view import wrap_text


def paragraphs(scope, item, language):
    value = catalog.BY_SCOPE[scope][item].to_dict()
    guide = value["guidance"]
    result = [
        t(f"items.{scope}.{item}.label", language) + f" ({scope}:{item})",
        t("guidance.static", language), "",
        t("guidance.scope", language, value=t("guidance.scopes." + guide["measurement_scope"], language)),
        t("guidance.sources", language, value=", ".join(t("guidance.sources." + source, language) for source in guide["source_kinds"])),
        t("guidance.fields", language, value=", ".join(value["sources"])),
        t("guidance.version", language, value=value["minimum_version"]) if value["minimum_version"] else t("guidance.version_unknown", language),
        "", t("guidance.requirements", language),
        *[t("guidance.requirements." + requirement, language) for requirement in guide["requirements"]],
        "", t("guidance.reasons", language),
        *[t("guidance.reasons." + reason, language) for reason in value["unavailable_reasons"]],
        "", t("guidance.setup", language), *guide["setup"],
    ]
    return result


def lines(scope, item, language, width):
    return wrap_text(paragraphs(scope, item, language), width)
