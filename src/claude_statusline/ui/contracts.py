"""Protocol v3 wire types; TypeScript is generated from these Python types."""

from __future__ import annotations

from typing import Literal, TypedDict

from claude_statusline.config import catalog, display


PROTOCOL_VERSION = 3
OPERATIONS = ("describe", "read", "preview", "apply", "import", "export", "preset")
MainItemId = Literal.__getitem__(tuple(catalog.BY_SCOPE["main"]))
SubagentItemId = Literal.__getitem__(tuple(catalog.BY_SCOPE["subagent"]))
Palette = Literal.__getitem__(display.PALETTES)
DirectoryStyle = Literal.__getitem__(display.DIRECTORY_STYLES)
SeparatorStyle = Literal.__getitem__(display.SEPARATOR_STYLES)
ScopeLabels = Literal.__getitem__(display.SCOPE_LABELS)
Scope = Literal["main", "subagent"]
UnavailableReason = Literal[
    "not_observed",
    "unsupported_host",
    "unknown_host_version",
    "source_unavailable",
    "condition_not_met",
    "runtime_disabled",
    "stale",
    "incomplete",
    "ambiguous_owner",
    "observed_only",
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


class ThresholdDraft(TypedDict):
    enabled: bool
    warning: int
    critical: int


class FormattingDraft(TypedDict):
    model_name: Literal["original", "short"]
    number_format: Literal["legacy", "compact", "full", "grouped"]
    labels: Literal["legacy", "short", "off"]
    icons: Literal["legacy", "unicode", "ascii", "off"]
    allowance: Literal["remaining", "used"]
    reset_format: Literal["countdown", "time", "datetime"]
    reset_timezone: Literal["local", "UTC"]
    thresholds: ThresholdDraft


class ItemOptionsDraft(TypedDict):
    label: str | None
    icon: str | None
    priority: int
    max_width: int | None
    formatting: dict[str, str]


class LayoutDraft(TypedDict):
    mode: Literal["auto", "explicit"]
    rows: list[list[MainItemId]]


class SubagentDraft(TypedDict):
    enabled: bool
    items: list[SubagentItemId]
    item_options: dict[SubagentItemId, ItemOptionsDraft]
    visibility: Literal["all", "running"]
    hide_completed: bool
    row_limit: int | None
    task_max_width: int | None


class MetricsDraft(TypedDict):
    branch_diff_base_ref: str | None


class DisplayDraft(TypedDict):
    schema_version: Literal[4]
    items: list[MainItemId]
    use_colors: bool
    palette: Palette
    directory_style: DirectoryStyle
    separator_style: SeparatorStyle
    scope_labels: ScopeLabels
    subagents: SubagentDraft
    formatting: FormattingDraft
    item_options: dict[MainItemId, ItemOptionsDraft]
    layout: LayoutDraft
    metrics: MetricsDraft


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


class PresetDescription(TypedDict):
    id: str
    label: str
    rows: list[list[MainItemId]]
    layout_mode: Literal["auto", "explicit"]


class TransferResult(TypedDict):
    draft: Draft


class ExportResult(TypedDict):
    path: str


class EditorField(TypedDict):
    key: str
    label: str
    group: str
    kind: Literal["choice", "boolean", "integer", "text"]
    choices: list[str]
    minimum: int
    maximum: int
    nullable: bool


class DescribeResult(TypedDict):
    catalog: list[CatalogItem]
    options: ConfigurationOptions
    capabilities: Capabilities
    backend_version: str
    operations: list[str]
    formatting_options: dict[str, list[str]]
    presets: list[PresetDescription]
    editor_fields: dict[str, list[EditorField]]


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
    ThresholdDraft,
    FormattingDraft,
    ItemOptionsDraft,
    LayoutDraft,
    SubagentDraft,
    MetricsDraft,
    DisplayDraft,
    HostDraft,
    Draft,
    Foreground,
    Span,
    PreviewResult,
    ProtocolError,
    ReadResult,
    EditorField,
    PresetDescription,
    TransferResult,
    ExportResult,
    DescribeResult,
    ApplyResult,
)
RESULTS = {
    "describe": DescribeResult,
    "read": ReadResult,
    "preview": PreviewResult,
    "apply": ApplyResult,
    "import": TransferResult,
    "export": ExportResult,
    "preset": TransferResult,
}
