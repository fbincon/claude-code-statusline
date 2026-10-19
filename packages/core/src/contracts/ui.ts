/** Canonical editor protocol and static descriptors. Emit Mod copies with the TS resource generator. */
import { LANGUAGES } from "../i18n/registry.js";
import type { Language } from "../i18n/registry.js";
import { MAIN_ITEM_IDS as generatedMAIN_ITEM_IDS, SUBAGENT_ITEM_IDS as generatedSUBAGENT_ITEM_IDS, PRESETS as generatedPRESETS } from "./generated-catalog.js";
export const PROTOCOL_VERSION = 13 as const;
export const ITEM_DEFAULTS = {"label": null, "icon": null, "priority": 50, "max_width": null, "formatting": {}, "foreground": null, "background": null, "visibility": "always", "visibility_threshold": 70};
export const VISIBILITY_ITEMS = {"main": {"git": "git-dirty", "git-changes": "git-dirty", "active-agents": "nonzero", "task-progress": "nonzero", "context-used": "used-at-least", "context-remaining": "used-at-least", "five-hour-limit": "used-at-least", "weekly-limit": "used-at-least", "spend-limit": "used-at-least"}, "subagent": {"context-used": "used-at-least", "context-remaining": "used-at-least"}} as const;
export const GUIDANCE_KEYS = {"source_kinds": ["configuration", "official_input", "local_git", "local_system", "transcript", "local_state", "lifecycle", "native_timing", "live_metrics", "telemetry"], "scopes": ["main", "main_context", "session", "all_sessions", "task", "subagent", "subagent_context", "repository", "local", "latest_request"], "requirements": ["observed_field", "subagent_rows", "agent_context", "configured_effort", "agent_effort_optional", "git_repository", "git_upstream", "git_base", "pull_request", "worktree_session", "usage_records", "task_observation", "native_timing", "complete_waits", "live_metrics", "owned_agents", "checklist_events", "tool_events", "complete_stream", "request_coverage", "existing_telemetry", "gateway", "gateway_284", "valid_window", "warm_cache", "fast_mode", "thinking", "agent_mode", "vim_mode", "context_observation"]} as const;
export const EDITOR_FIELDS = {"global": [{"key": "theme", "label": "Statusline theme", "group": "Appearance", "kind": "choice", "choices": ["classic", "dark", "light", "terminal"], "minimum": 0, "maximum": 10000, "nullable": false}, {"key": "powerline_glyph", "label": "Powerline separator", "group": "Appearance", "kind": "choice", "choices": ["ascii", "powerline"], "minimum": 0, "maximum": 10000, "nullable": false}, {"key": "statusline_language", "label": "Statusline language (save with display settings)", "group": "Appearance", "kind": "choice", "choices": LANGUAGES, "minimum": 0, "maximum": 10000, "nullable": false}, {"key": "metrics.branch_diff_base_ref", "label": "Branch diff base (inherit = auto)", "group": "Git metrics", "kind": "text", "choices": [], "minimum": 0, "maximum": 10000, "nullable": true}, {"key": "formatting.model_name", "label": "Model Name", "group": "Formatting", "kind": "choice", "choices": ["original", "short"], "minimum": 0, "maximum": 10000, "nullable": false}, {"key": "formatting.number_format", "label": "Number Format", "group": "Formatting", "kind": "choice", "choices": ["legacy", "compact", "full", "grouped"], "minimum": 0, "maximum": 10000, "nullable": false}, {"key": "formatting.labels", "label": "Labels", "group": "Formatting", "kind": "choice", "choices": ["legacy", "short", "off"], "minimum": 0, "maximum": 10000, "nullable": false}, {"key": "formatting.icons", "label": "Icons", "group": "Formatting", "kind": "choice", "choices": ["legacy", "unicode", "ascii", "off"], "minimum": 0, "maximum": 10000, "nullable": false}, {"key": "formatting.allowance", "label": "Allowance", "group": "Formatting", "kind": "choice", "choices": ["remaining", "used"], "minimum": 0, "maximum": 10000, "nullable": false}, {"key": "formatting.reset_format", "label": "Reset Format", "group": "Formatting", "kind": "choice", "choices": ["countdown", "time", "datetime"], "minimum": 0, "maximum": 10000, "nullable": false}, {"key": "formatting.reset_timezone", "label": "Reset Timezone", "group": "Formatting", "kind": "choice", "choices": ["local", "UTC"], "minimum": 0, "maximum": 10000, "nullable": false}, {"key": "formatting.thresholds.enabled", "label": "Threshold colors", "group": "Risk colors", "kind": "boolean", "choices": [], "minimum": 0, "maximum": 10000, "nullable": false}, {"key": "formatting.thresholds.warning", "label": "Warning (%)", "group": "Risk colors", "kind": "integer", "choices": [], "minimum": 0, "maximum": 100, "nullable": false}, {"key": "formatting.thresholds.critical", "label": "Critical (%)", "group": "Risk colors", "kind": "integer", "choices": [], "minimum": 0, "maximum": 100, "nullable": false}, {"key": "subagents.visibility", "label": "Visible agents", "group": "Subagent visibility", "kind": "choice", "choices": ["all", "running"], "minimum": 0, "maximum": 10000, "nullable": false}, {"key": "subagents.hide_completed", "label": "Hide completed", "group": "Subagent visibility", "kind": "boolean", "choices": [], "minimum": 0, "maximum": 10000, "nullable": false}, {"key": "subagents.row_limit", "label": "Agent row limit", "group": "Subagent visibility", "kind": "integer", "choices": [], "minimum": 0, "maximum": 10000, "nullable": true}, {"key": "subagents.task_max_width", "label": "Task text width", "group": "Subagent visibility", "kind": "integer", "choices": [], "minimum": 2, "maximum": 10000, "nullable": true}], "item": [{"key": "foreground", "label": "Foreground (inherit/default/ansi:N/#RRGGBB)", "group": "Item colors", "kind": "text", "choices": [], "minimum": 0, "maximum": 10000, "nullable": true}, {"key": "background", "label": "Background (inherit/default/ansi:N/#RRGGBB)", "group": "Item colors", "kind": "text", "choices": [], "minimum": 0, "maximum": 10000, "nullable": true}, {"key": "visibility", "label": "Visibility rule", "group": "Conditional visibility", "kind": "choice", "choices": ["always", "git-dirty", "nonzero", "used-at-least"], "minimum": 0, "maximum": 10000, "nullable": false}, {"key": "visibility_threshold", "label": "Minimum used (%)", "group": "Conditional visibility", "kind": "integer", "choices": [], "minimum": 0, "maximum": 100, "nullable": false}, {"key": "label", "label": "Label (inherit = default)", "group": "Item format", "kind": "text", "choices": [], "minimum": 0, "maximum": 10000, "nullable": true}, {"key": "icon", "label": "Icon (inherit = default)", "group": "Item format", "kind": "text", "choices": [], "minimum": 0, "maximum": 10000, "nullable": true}, {"key": "priority", "label": "Priority", "group": "Item fitting", "kind": "integer", "choices": [], "minimum": 0, "maximum": 100, "nullable": false}, {"key": "max_width", "label": "Maximum width", "group": "Item fitting", "kind": "integer", "choices": [], "minimum": 2, "maximum": 10000, "nullable": true}, {"key": "model_name", "label": "Model Name", "group": "Item format", "kind": "choice", "choices": ["inherit", "original", "short"], "minimum": 0, "maximum": 10000, "nullable": false}, {"key": "number_format", "label": "Number Format", "group": "Item format", "kind": "choice", "choices": ["inherit", "legacy", "compact", "full", "grouped"], "minimum": 0, "maximum": 10000, "nullable": false}, {"key": "labels", "label": "Labels", "group": "Item format", "kind": "choice", "choices": ["inherit", "legacy", "short", "off"], "minimum": 0, "maximum": 10000, "nullable": false}, {"key": "icons", "label": "Icons", "group": "Item format", "kind": "choice", "choices": ["inherit", "legacy", "unicode", "ascii", "off"], "minimum": 0, "maximum": 10000, "nullable": false}, {"key": "allowance", "label": "Allowance", "group": "Item format", "kind": "choice", "choices": ["inherit", "remaining", "used"], "minimum": 0, "maximum": 10000, "nullable": false}, {"key": "reset_format", "label": "Reset Format", "group": "Item format", "kind": "choice", "choices": ["inherit", "countdown", "time", "datetime"], "minimum": 0, "maximum": 10000, "nullable": false}, {"key": "reset_timezone", "label": "Reset Timezone", "group": "Item format", "kind": "choice", "choices": ["inherit", "local", "UTC"], "minimum": 0, "maximum": 10000, "nullable": false}]} as const;
export const PRESETS = generatedPRESETS;
export const FORMAT_CHOICES = {"model_name": ["original", "short"], "number_format": ["legacy", "compact", "full", "grouped"], "labels": ["legacy", "short", "off"], "icons": ["legacy", "unicode", "ascii", "off"], "allowance": ["remaining", "used"], "reset_format": ["countdown", "time", "datetime"], "reset_timezone": ["local", "UTC"]} as const;
export const FORMAT_DEFAULTS = {"model_name": "original", "number_format": "legacy", "labels": "legacy", "icons": "legacy", "allowance": "remaining", "reset_format": "countdown", "reset_timezone": "local", "thresholds": {"enabled": false, "warning": 70, "critical": 90}} as const;
export type MainItemId = typeof MAIN_ITEM_IDS[number];
export type SubagentItemId = typeof SUBAGENT_ITEM_IDS[number];
export type Palette = "default" | "ansi";
export type Theme = "classic" | "dark" | "light" | "terminal";
export type PowerlineGlyph = "ascii" | "powerline";
export type VisibilityRule = "always" | "git-dirty" | "nonzero" | "used-at-least";
export type DirectoryStyle = "full" | "home" | "project-relative" | "basename";
export type SeparatorStyle = "classic" | "compact" | "powerline";
export type ScopeLabels = "off" | "when-subagents" | "always";
export type StatuslineLanguage = Language;
export type Scope = "main" | "subagent";
export type UnavailableReason = "not_observed" | "unsupported_host" | "unknown_host_version" | "source_unavailable" | "condition_not_met" | "runtime_disabled" | "native_timing_disabled" | "wait_coverage_missing" | "stale" | "incomplete" | "ambiguous_owner" | "observed_only" | "missing_stream" | "synthetic_response" | "abnormal_clock" | "inconsistent_request" | "request_join_unavailable";
export const MAIN_ITEM_IDS = generatedMAIN_ITEM_IDS;
export const SUBAGENT_ITEM_IDS = generatedSUBAGENT_ITEM_IDS;
export const PALETTE_VALUES = ["default", "ansi"] as const;
export const THEME_VALUES = ["classic", "dark", "light", "terminal"] as const;
export const POWERLINEGLYPH_VALUES = ["ascii", "powerline"] as const;
export const VISIBILITYRULE_VALUES = ["always", "git-dirty", "nonzero", "used-at-least"] as const;
export const DIRECTORYSTYLE_VALUES = ["full", "home", "project-relative", "basename"] as const;
export const SEPARATORSTYLE_VALUES = ["classic", "compact", "powerline"] as const;
export const SCOPELABELS_VALUES = ["off", "when-subagents", "always"] as const;
export const STATUSLINELANGUAGE_VALUES = LANGUAGES;
export const UNAVAILABLEREASON_VALUES = ["not_observed", "unsupported_host", "unknown_host_version", "source_unavailable", "condition_not_met", "runtime_disabled", "native_timing_disabled", "wait_coverage_missing", "stale", "incomplete", "ambiguous_owner", "observed_only", "missing_stream", "synthetic_response", "abnormal_clock", "inconsistent_request", "request_join_unavailable"] as const;
export type Operation = "describe" | "read" | "preview" | "apply" | "import" | "export" | "preset" | "read_ui_preferences" | "set_ui_language" | "review_import" | "explain";
export interface ItemGuidance {
  source_kinds: string[];
  measurement_scope: string;
  requirements: string[];
  setup: string[];
}
export interface CatalogItem {
  scope: Scope;
  id: string;
  label: string;
  description: string;
  group: string;
  sources: string[];
  examples: string[];
  default_position: number | null;
  minimum_version: string | null;
  format_options: string[];
  excludes: string[];
  unavailable_reasons: UnavailableReason[];
  default_enabled: boolean;
  minimum_version_status: "verified" | "unknown";
  guidance: ItemGuidance;
}
export interface ChoiceOptions {
  choices: (string | boolean)[];
}
export interface RangeOptions {
  minimum: number;
  maximum: number;
}
export interface RefreshOptions {
  minimum: number;
  maximum: number;
  special: "event";
}
export interface ConfigurationOptions {
  colors: ChoiceOptions;
  palette: ChoiceOptions;
  theme: ChoiceOptions;
  "powerline-glyph": ChoiceOptions;
  "directory-style": ChoiceOptions;
  "separator-style": ChoiceOptions;
  "scope-labels": ChoiceOptions;
  "statusline-language": ChoiceOptions;
  "subagent-statusline": ChoiceOptions;
  padding: RangeOptions;
  "refresh-interval": RefreshOptions;
  "hide-vim-mode-indicator": ChoiceOptions;
}
export interface Capabilities {
  host_version: string | null;
  subagent_rows: "unknown" | "supported" | "unsupported";
  native_mod: "unknown" | "unverified" | "unsupported";
  native_mod_loaded: null;
  data_observation: "not_observed";
}
export interface ThresholdDraft {
  enabled: boolean;
  warning: number;
  critical: number;
}
export interface FormattingDraft {
  model_name: "original" | "short";
  number_format: "legacy" | "compact" | "full" | "grouped";
  labels: "legacy" | "short" | "off";
  icons: "legacy" | "unicode" | "ascii" | "off";
  allowance: "remaining" | "used";
  reset_format: "countdown" | "time" | "datetime";
  reset_timezone: "local" | "UTC";
  thresholds: ThresholdDraft;
}
export interface ItemOptionsDraft {
  label: string | null;
  icon: string | null;
  priority: number;
  max_width: number | null;
  formatting: Record<string, string>;
  foreground: string | null;
  background: string | null;
  visibility: VisibilityRule;
  visibility_threshold: number;
}
export interface InstanceDraft {
  id: string;
  type_id: string;
  enabled: boolean;
  options: ItemOptionsDraft;
  text: string | null;
}
export interface LayoutDraft {
  mode: "auto" | "explicit";
  rows: string[][];
}
export interface SubagentDraft {
  enabled: boolean;
  instances: InstanceDraft[];
  visibility: "all" | "running";
  hide_completed: boolean;
  row_limit: number | null;
  task_max_width: number | null;
}
export interface MetricsDraft {
  branch_diff_base_ref: string | null;
}
export interface DisplayDraft {
  schema_version: 8;
  statusline_language: StatuslineLanguage;
  instances: InstanceDraft[];
  use_colors: boolean;
  palette: Palette;
  theme: Theme;
  powerline_glyph: PowerlineGlyph;
  directory_style: DirectoryStyle;
  separator_style: SeparatorStyle;
  scope_labels: ScopeLabels;
  subagents: SubagentDraft;
  formatting: FormattingDraft;
  layout: LayoutDraft;
  metrics: MetricsDraft;
}
export interface HostDraft {
  padding: number;
  refresh_interval: number | "event";
  hide_vim_mode_indicator: boolean;
}
export interface Draft {
  display: DisplayDraft;
  host: HostDraft;
}
export interface Foreground {
  kind: "rgb" | "ansi";
  value: string | number;
}
export interface Span {
  text: string;
  bold: boolean;
  foreground: Foreground | null;
  background: Foreground | null;
}
export interface PreviewResult {
  sample: true;
  main: Span[][];
  subagents: Span[][];
}
export const SAMPLE_REASONS = ['sample_visible','sample_empty','sample_condition_hidden','sample_truncated','sample_priority_omitted','sample_width_omitted','sample_row_hidden','sample_spacer'] as const;
export type SampleReason = typeof SAMPLE_REASONS[number];
export const EXPLAIN_REASONS = ['configured_on','configured_off','scope_disabled','installation_owned','installation_absent','installation_foreign','installation_unknown','unknown_host_version','host_supported','unsupported_host','host_requirement_unknown','collector_unknown','native_timing_on','native_timing_off','live_metrics_on','live_metrics_off','actual_not_observed'] as const;
export interface ExplainReason { code: string; origin: 'configuration' | 'local_configuration' | 'host_capability' | 'unknown'; }
export interface InstanceSample { row_id: string; outcome: SampleReason; truncated: boolean; }
export interface ExplainInstance {
  id: string; type_id: string; enabled: boolean;
  reasons: ExplainReason[];
  samples: InstanceSample[];
}
export interface ExplainResult {
  sample: true;
  scope: Scope;
  width: number;
  actual_availability: 'not_observed';
  preview: PreviewResult;
  instances: ExplainInstance[];
}
export interface LocalizedMessage {
  key: string;
  params: Record<string, unknown>;
  fallback: string;
}
export interface UiPreferencesResult {
  schema_version: 1;
  ui_language: StatuslineLanguage;
  warning: LocalizedMessage | null;
}
export interface ProtocolError {
  code: string;
  message: string;
  localization: LocalizedMessage | null;
}
export interface ReadResult {
  draft: Draft;
  revision: string;
  installed: boolean;
  installation: Record<string, unknown>;
  capabilities: Capabilities;
  backend_version: string;
}
export interface EditorField {
  key: string;
  label: string;
  group: string;
  kind: "choice" | "boolean" | "integer" | "text";
  choices: string[];
  minimum: number;
  maximum: number;
  nullable: boolean;
}
export interface PresetDescription {
  purpose_key: string;
  requirements_key: string;
  example: boolean;
  id: string;
  label: string;
  rows: string[][];
  layout_mode: "auto" | "explicit";
}
export interface TransferResult {
  draft: Draft;
}
export interface ImportChange {
  section: "main" | "subagent" | "formatting" | "layout" | "language" | "host";
  kind: "add" | "remove" | "enable" | "disable" | "reorder" | "change";
  scope: Scope | null;
  item_id: string | null;
  path: string[];
  before: unknown;
  after: unknown;
  label: LocalizedMessage;
}
export interface ImportReviewResult {
  draft: Draft;
  changes: ImportChange[];
}
export interface ExportResult {
  path: string;
}
export interface DescribeResult {
  catalog: CatalogItem[];
  options: ConfigurationOptions;
  capabilities: Capabilities;
  backend_version: string;
  operations: string[];
  formatting_options: Record<string, string[]>;
  presets: PresetDescription[];
  editor_fields: Record<string, EditorField[]>;
}
export interface ApplyResult {
  draft: Draft;
  revision: string;
  installed: boolean;
  installation: Record<string, unknown>;
  capabilities: Capabilities;
  backend_version: string;
  changed: boolean;
  backup_dir: string | null;
}
export interface ResultMap {
  describe: DescribeResult;
  read: ReadResult;
  preview: PreviewResult;
  explain: ExplainResult;
  apply: ApplyResult;
  import: TransferResult;
  review_import: ImportReviewResult;
  export: ExportResult;
  preset: TransferResult;
  read_ui_preferences: UiPreferencesResult;
  set_ui_language: UiPreferencesResult;
}
export type ResultFor<O extends Operation> = ResultMap[O];
export interface Request {
  protocol_version: typeof PROTOCOL_VERSION;
  operation: Operation;
  payload: unknown;
}
export type Result = ExplainResult | PreviewResult | UiPreferencesResult | ReadResult | TransferResult | ImportReviewResult | ExportResult | DescribeResult | ApplyResult;
export type Response = { protocol_version: typeof PROTOCOL_VERSION; result: Result } | { protocol_version: typeof PROTOCOL_VERSION; error: ProtocolError };
