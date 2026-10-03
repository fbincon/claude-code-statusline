"""Protocol v1 wire types; TypeScript is generated from these Python types."""

from __future__ import annotations

from typing import Literal, TypedDict

from claude_statusline.config import catalog, display


PROTOCOL_VERSION = 1
OPERATIONS = ("describe", "read", "preview", "apply")
MainItemId = Literal.__getitem__(tuple(catalog.BY_SCOPE["main"]))
SubagentItemId = Literal.__getitem__(tuple(catalog.BY_SCOPE["subagent"]))
Palette = Literal.__getitem__(display.PALETTES)
DirectoryStyle = Literal.__getitem__(display.DIRECTORY_STYLES)
SeparatorStyle = Literal.__getitem__(display.SEPARATOR_STYLES)
ScopeLabels = Literal.__getitem__(display.SCOPE_LABELS)
Scope = Literal["main", "subagent"]
UnavailableReason = Literal[
    "not_observed", "unsupported_host", "unknown_host_version",
    "source_unavailable", "condition_not_met",
]


class CatalogItem(TypedDict):
    scope: Scope
    id: MainItemId | SubagentItemId
    label: str
    description: str
    group: str
    sources: list[str]
    examples: list[str]
    default_position: int | None
    minimum_version: str | None
    format_options: list[str]
    excludes: list[str]
    unavailable_reasons: list[UnavailableReason]
    default_enabled: bool
    minimum_version_status: Literal["verified", "unknown"]


class ChoiceOptions(TypedDict):
    choices: list[str | bool]


class RangeOptions(TypedDict):
    minimum: int
    maximum: int


class RefreshOptions(RangeOptions):
    special: Literal["event"]


ConfigurationOptions = TypedDict(
    "ConfigurationOptions",
    {
        "colors": ChoiceOptions,
        "palette": ChoiceOptions,
        "directory-style": ChoiceOptions,
        "separator-style": ChoiceOptions,
        "scope-labels": ChoiceOptions,
        "subagent-statusline": ChoiceOptions,
        "padding": RangeOptions,
        "refresh-interval": RefreshOptions,
        "hide-vim-mode-indicator": ChoiceOptions,
    },
)


class Capabilities(TypedDict):
    host_version: str | None
    subagent_rows: Literal["unknown", "supported", "unsupported"]
    native_mod: Literal["unknown", "unverified", "unsupported"]
    native_mod_loaded: None
    data_observation: Literal["not_observed"]


class SubagentDraft(TypedDict):
    enabled: bool
    items: list[SubagentItemId]


class DisplayDraft(TypedDict):
    schema_version: Literal[2]
    items: list[MainItemId]
    use_colors: bool
    palette: Palette
    directory_style: DirectoryStyle
    separator_style: SeparatorStyle
    scope_labels: ScopeLabels
    subagents: SubagentDraft


class HostDraft(TypedDict):
    padding: int
    refresh_interval: int | Literal["event"]
    hide_vim_mode_indicator: bool


class Draft(TypedDict):
    display: DisplayDraft
    host: HostDraft


class Foreground(TypedDict):
    kind: Literal["rgb", "ansi"]
    value: str | int


class Span(TypedDict):
    text: str
    bold: bool
    foreground: Foreground | None


class PreviewResult(TypedDict):
    sample: Literal[True]
    main: list[list[Span]]
    subagents: list[list[Span]]


class ProtocolError(TypedDict):
    code: str
    message: str


class ReadResult(TypedDict):
    draft: Draft
    revision: str
    installed: bool
    installation: dict[str, object]
    capabilities: Capabilities
    backend_version: str


class DescribeResult(TypedDict):
    catalog: list[CatalogItem]
    options: ConfigurationOptions
    capabilities: Capabilities
    backend_version: str
    operations: list[str]


class ApplyResult(ReadResult):
    changed: bool
    backup_dir: str | None


ALIASES = {
    "MainItemId": MainItemId,
    "SubagentItemId": SubagentItemId,
    "Palette": Palette,
    "DirectoryStyle": DirectoryStyle,
    "SeparatorStyle": SeparatorStyle,
    "ScopeLabels": ScopeLabels,
    "Scope": Scope,
    "UnavailableReason": UnavailableReason,
}
WIRE_TYPES = (
    CatalogItem,
    ChoiceOptions,
    RangeOptions,
    RefreshOptions,
    ConfigurationOptions,
    Capabilities,
    SubagentDraft,
    DisplayDraft,
    HostDraft,
    Draft,
    Foreground,
    Span,
    PreviewResult,
    ProtocolError,
    ReadResult,
    DescribeResult,
    ApplyResult,
)
RESULTS = {
    "describe": DescribeResult,
    "read": ReadResult,
    "preview": PreviewResult,
    "apply": ApplyResult,
}
