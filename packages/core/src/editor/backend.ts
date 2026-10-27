import { validAlignments } from './alignments.js';
import { GRADIENT_KEYS, validGradient } from './gradients.js';
import { validCostRateOptions } from './cost-rate.js';
import { validGroups } from './groups.js';
import { INDICATOR_KEYS, validIndicatorOptions } from './indicators.js';
import { SAMPLE_REASONS, EXPLAIN_REASONS, LAYOUT_REASONS, EVIDENCE_STATUSES } from '../contracts/ui.js';
import { text as localizedText } from '../i18n/messages.js';
/** Protocol parsing only. Host calls stay in the hooks entry for static analysis. */
import {
  PROTOCOL_VERSION,
  MAIN_ITEM_IDS,
  SUBAGENT_ITEM_IDS,
  PALETTE_VALUES, THEME_VALUES, POWERLINEGLYPH_VALUES,
  DIRECTORYSTYLE_VALUES,
  SEPARATORSTYLE_VALUES,
  SCOPELABELS_VALUES,
  STATUSLINELANGUAGE_VALUES,
  UNAVAILABLEREASON_VALUES,
  FORMAT_CHOICES, PRESETS, EDITOR_FIELDS, POWERLINE_FIELDS, GUIDANCE_KEYS, ITEM_DEFAULTS,
} from '../contracts/ui.js';
import type {
  Capabilities,
  CatalogItem,
  ConfigurationOptions,
  Draft,
  Operation,
  ResultFor,
  Span,
} from '../contracts/ui.js';
import { validColor, visibilityChoices } from './appearance.js';
import { isSourceResult } from './source-validation.js';
import { isLocalizedText } from '../i18n/messages.js';
import type { LocalizedText } from '../i18n/messages.js';

export class BackendError extends Error {
  constructor(
    public readonly code: string,
    message: string | LocalizedText,
    public readonly localization: LocalizedText | null = typeof message === 'string' ? null : message,
  ) {
    super(typeof message === 'string' ? message : message.fallback);
  }
}

export function processFailure(error: unknown): BackendError {
  if (error instanceof BackendError) return error;
  const message =
    error instanceof Error
      ? error.message
      : 'The backend process could not run.';
  const timedOut =
    error instanceof Error &&
    (error.name === 'TimeoutError' || /timed?\s*out|timeout/i.test(message));
  return new BackendError(
    timedOut ? 'backend_timeout' : 'backend_process',
    message,
  );
}

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function fail(): never {
  throw new BackendError(
    'invalid_backend_result',
    localizedText("native.lib.backend.the_backend_returned_an_invalid_configuration_result"),
  );
}

function exact(
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  return (
    Object.keys(value).length === keys.length &&
    keys.every((key) => key in value)
  );
}

function text(value: unknown): value is string {
  return typeof value === 'string' && !/[\p{Cc}\p{Cs}]/u.test(value);
}

function strings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(text);
}

function selection(value: unknown, ids: readonly string[]): value is string[] {
  return (
    strings(value) &&
    value.every((id) => ids.includes(id)) &&
    new Set(value).size === value.length
  );
}

function range(value: unknown, min: number, max: number, nullable = false): boolean {
  return (nullable && value === null) ||
    (typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max);
}

function formatOverrides(value: unknown): boolean {
  if (!object(value)) return false;
  return Object.entries(value).every(([key, v]) =>
    key in FORMAT_CHOICES && typeof v === 'string' &&
    (FORMAT_CHOICES[key as keyof typeof FORMAT_CHOICES] as readonly string[]).includes(v));
}

function itemOptions(value: unknown, ids: readonly string[], scope: "main" | "subagent"): boolean {
  if (!object(value)) return false;
  return Object.entries(value).every(([id, option]) => ids.includes(id) && object(option) &&
    exact(option, [...GRADIENT_KEYS.filter(key => Object.hasOwn(option, key)), 'label', 'icon', 'priority', 'max_width', 'formatting', 'foreground', 'background', 'visibility', 'visibility_threshold', ...(option.link !== undefined ? ['link'] : []), ...INDICATOR_KEYS.filter(key => Object.hasOwn(option, key)), ...(Object.hasOwn(option, 'cost_rate_basis') ? ['cost_rate_basis'] : [])]) && (option.link === undefined || ['off','auto','on'].includes(String(option.link))) &&
    (option.label === null || (text(option.label) && [...option.label].length <= 256)) &&
    (option.icon === null || (text(option.icon) && [...option.icon].length <= 256)) &&
    GRADIENT_KEYS.every(key => option[key] === undefined || id !== 'spacer' && validGradient(option[key])) && validIndicatorOptions(option, scope, id) && validCostRateOptions(option, scope, id) && range(option.priority, 0, 100) && range(option.max_width, 2, 10000, true) &&
    formatOverrides(option.formatting) && validColor(option.foreground) && validColor(option.background) &&
    typeof option.visibility === "string" && visibilityChoices(scope, id).includes(option.visibility) &&
    range(option.visibility_threshold, 0, 100));
}

function formatting(value: unknown): boolean {
  if (!object(value) || !exact(value, [...Object.keys(FORMAT_CHOICES), 'thresholds'])) return false;
  const { thresholds, ...choices } = value;
  return formatOverrides(choices) && object(thresholds) &&
    exact(thresholds, ['enabled', 'warning', 'critical']) &&
    typeof thresholds.enabled === 'boolean' && range(thresholds.warning, 0, 100) &&
    range(thresholds.critical, 0, 100) && Number(thresholds.warning) < Number(thresholds.critical);
}

function instanceList(value: unknown, ids: readonly string[], scope: "main" | "subagent"): value is import('../contracts/ui.js').InstanceDraft[] {
  if (!Array.isArray(value)) return false;
  const seen = new Set<string>();
  return value.every(node => {
    if (!object(node) || !exact(node,['id','type_id','enabled','options','text', ...(node.source !== undefined ? ['source'] : [])]) || node.source !== undefined && (!object(node.source) || !exact(node.source,['binding','hint']) || !(node.source.binding === null || text(node.source.binding)) || !text(node.source.hint)) ||
        typeof node.id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,95}$/.test(node.id) || seen.has(node.id) ||
        typeof node.type_id !== 'string' || !ids.includes(node.type_id) || typeof node.enabled !== 'boolean' ||
        !itemOptions({[node.type_id]: node.options},ids,scope)) return false;
    seen.add(node.id);
    const option = node.options as Record<string,unknown>;
    if (node.type_id === 'spacer') {
      if (JSON.stringify(option) !== JSON.stringify(ITEM_DEFAULTS)) {
        if (Object.entries(ITEM_DEFAULTS).some(([key,v]) => JSON.stringify(option[key]) !== JSON.stringify(v))) return false;
      }
    }
    if (['text','spacer'].includes(node.type_id) && (option.visibility !== 'always' || Object.keys(option.formatting as object).length)) return false;
    return node.type_id === 'text' ? text(node.text) && [...node.text].length <= 256 : node.text === null;
  });
}

export function isDraft(value: unknown): value is Draft {
  if (
    !object(value) ||
    !exact(value, ['display', 'host']) ||
    !object(value.display) ||
    !object(value.host)
  )
    return false;
  const d = value.display;
  const h = value.host;
  if (
    !exact(d, [
      'schema_version', 'groups',
      'statusline_language',
      'instances',
      'use_colors',
      'palette', 'theme', 'powerline_glyph', 'powerline',
      'directory_style',
      'separator_style',
      'scope_labels',
      'subagents',
      'formatting', 'layout', 'metrics',
    ]) ||
    !exact(h, ['padding', 'refresh_interval', 'hide_vim_mode_indicator'])
  )
    return false;
  if (
    d.schema_version !== 15 ||
    !object(d.powerline) || !exact(d.powerline, POWERLINE_FIELDS.map(f => f.key.slice(10))) ||
    !POWERLINE_FIELDS.every(f => f.kind === 'boolean' ? typeof (d.powerline as Record<string, unknown>)[f.key.slice(10)] === 'boolean' :
      (f.choices as readonly unknown[]).includes((d.powerline as Record<string, unknown>)[f.key.slice(10)])) ||
    !THEME_VALUES.some(x => x === d.theme) || !POWERLINEGLYPH_VALUES.some(x => x === d.powerline_glyph) ||
    !STATUSLINELANGUAGE_VALUES.some((x) => x === d.statusline_language) ||
    !object(d.metrics) || !exact(d.metrics, ['branch_diff_base_ref']) ||
    !(d.metrics.branch_diff_base_ref === null || (text(d.metrics.branch_diff_base_ref) && [...d.metrics.branch_diff_base_ref].length <= 256 &&
      d.metrics.branch_diff_base_ref.length > 0 && !/[\s]|^-/.test(d.metrics.branch_diff_base_ref))) ||
    !formatting(d.formatting) ||
    typeof d.use_colors !== 'boolean' ||
    !instanceList(d.instances, MAIN_ITEM_IDS, "main") ||
    !PALETTE_VALUES.some((x) => x === d.palette) ||
    !DIRECTORYSTYLE_VALUES.some((x) => x === d.directory_style) ||
    !SEPARATORSTYLE_VALUES.some((x) => x === d.separator_style) ||
    !SCOPELABELS_VALUES.some((x) => x === d.scope_labels)
  )
    return false;
  const sub = d.subagents;
  if (
    !object(sub) ||
    !exact(sub, ['enabled', 'instances', 'groups', 'visibility', 'hide_completed', 'row_limit', 'task_max_width']) ||
    !['all', 'running'].includes(String(sub.visibility)) ||
    typeof sub.hide_completed !== 'boolean' || !range(sub.row_limit, 0, 10000, true) ||
    !range(sub.task_max_width, 2, 10000, true) ||
    typeof sub.enabled !== 'boolean' ||
    !instanceList(sub.instances, SUBAGENT_ITEM_IDS, "subagent")
  )
    return false;
  if (sub.instances.filter(i => i.type_id === 'spacer').length > 1) return false;
  const types = new Set(sub.instances.filter(i=>i.enabled).map(i=>i.type_id));
  if (types.has('status-elapsed') && (types.has('status') || types.has('elapsed'))) return false;
  const ids = d.instances.map(i=>i.id);
  const spacers = new Set(d.instances.filter(i=>i.type_id==='spacer').map(i=>i.id));
  const layout = d.layout;
  if (!object(layout) || !exact(layout, ['mode', 'rows', ...(Object.hasOwn(layout, 'alignments') ? ['alignments'] : [])]) ||
      !['auto', 'explicit'].includes(String(layout.mode)) || !Array.isArray(layout.rows) ||
      !layout.rows.every((r) => selection(r, ids) && r.length > 0 && r.filter(id => spacers.has(id)).length <= 1) ||
      (layout.mode === 'auto' ? layout.rows.length !== 0 || spacers.size > 0 :
        JSON.stringify(layout.rows.flat()) !== JSON.stringify(ids))) return false;
  if (!validGroups(d.groups, d.instances, layout as unknown as import('../contracts/ui.js').LayoutDraft) || !validGroups(sub.groups, sub.instances)) return false;
  if (!validAlignments(layout.alignments, layout as unknown as import('../contracts/ui.js').LayoutDraft, d.instances, d.groups)) return false;
  // Exclusions come from describe; the backend remains the final draft validator.
  return (
    typeof h.padding === 'number' &&
    Number.isInteger(h.padding) &&
    h.padding >= 0 &&
    h.padding <= 32 &&
    typeof h.hide_vim_mode_indicator === 'boolean' &&
    (h.refresh_interval === 'event' ||
      (typeof h.refresh_interval === 'number' &&
        Number.isInteger(h.refresh_interval) &&
        h.refresh_interval >= 1 &&
        h.refresh_interval <= 3600))
  );
}

export function isSpan(value: unknown): value is Span {
  if (!object(value) || !text(value.text) || typeof value.bold !== 'boolean')
    return false;
  return [value.foreground, value.background].every(color =>
    color === null ||
    (object(color) &&
      ((color.kind === 'rgb' && typeof color.value === 'string' && /^#[0-9a-f]{6}$/i.test(color.value)) ||
       (color.kind === 'ansi' && typeof color.value === 'number' && Number.isInteger(color.value) &&
        color.value >= 0 && color.value <= 255))));
}

function isCapabilities(value: unknown): value is Capabilities {
  return (
    object(value) &&
    (value.host_version === null || text(value.host_version)) &&
    ['unknown', 'supported', 'unsupported'].includes(
      String(value.subagent_rows),
    ) &&
    ['unknown', 'unverified', 'unsupported'].includes(
      String(value.native_mod),
    ) &&
    value.native_mod_loaded === null &&
    value.data_observation === 'not_observed'
  );
}

function isGuidance(value: unknown): boolean {
  return object(value) && selection(value.source_kinds, GUIDANCE_KEYS.source_kinds) && value.source_kinds.length > 0 &&
    GUIDANCE_KEYS.scopes.some(scope => scope === value.measurement_scope) &&
    selection(value.requirements, GUIDANCE_KEYS.requirements) && strings(value.setup);
}

function isImportChange(value: unknown): boolean {
  if (!object(value) || !exact(value, ['section', 'kind', 'scope', 'item_id', 'path', 'before', 'after', 'label']) ||
      !['main','subagent','formatting','layout','language','host'].includes(String(value.section)) ||
      !['add','remove','enable','disable','reorder','change'].includes(String(value.kind)) ||
      !(value.scope === null || value.scope === 'main' || value.scope === 'subagent') ||
      !strings(value.path) || !value.path.length || value.path.length > 8 ||
      !['display','host'].includes(value.path[0]!) || !isLocalizedText(value.label)) return false;
  if (value.item_id !== null && (typeof value.item_id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,95}$/.test(value.item_id))) return false;
  if (value.kind === 'enable' || value.kind === 'disable')
    return value.item_id !== null && value.before === (value.kind === 'disable') && value.after === (value.kind === 'enable');
  if (value.kind === 'add' || value.kind === 'remove')
    return value.item_id !== null && (value.kind === 'add' ? value.before === null && object(value.after) : object(value.before) && value.after === null);
  if (value.kind === 'reorder')
    return value.item_id === null && strings(value.before) && strings(value.after) &&
      new Set(value.before).size === value.before.length && new Set(value.after).size === value.after.length &&
      value.before.length === value.after.length && value.before.every(id => (value.after as string[]).includes(id));
  return true;
}

function isCatalog(value: unknown): value is CatalogItem[] {
  if (
    !Array.isArray(value) ||
    value.length !== MAIN_ITEM_IDS.length + SUBAGENT_ITEM_IDS.length
  )
    return false;
  const seen = new Set<string>();
  return value.every((item) => {
    if (
      !object(item) ||
      !text(item.id) ||
      !text(item.label) ||
      !text(item.description) ||
      !text(item.group) ||
      !strings(item.sources) ||
      !strings(item.examples) ||
      !strings(item.format_options) ||
      !strings(item.unavailable_reasons) ||
      !isGuidance(item.guidance) ||
      typeof item.default_enabled !== 'boolean' ||
      !(item.minimum_version === null || text(item.minimum_version)) ||
      !(
        item.default_position === null ||
        (typeof item.default_position === 'number' &&
          Number.isInteger(item.default_position) &&
          item.default_position >= 0)
      ) ||
      item.default_enabled !== (item.default_position !== null) ||
      item.minimum_version_status !==
        (item.minimum_version ? 'verified' : 'unknown')
    )
      return false;
    const ids =
      item.scope === 'main'
        ? MAIN_ITEM_IDS
        : item.scope === 'subagent'
          ? SUBAGENT_ITEM_IDS
          : [];
    const key = `${item.scope}:${item.id}`;
    if (
      !ids.some((id) => id === item.id) ||
      !selection(item.excludes, ids) ||
      item.excludes.includes(item.id) ||
      seen.has(key)
    )
      return false;
    seen.add(key);
    return item.unavailable_reasons.every((reason) =>
      UNAVAILABLEREASON_VALUES.some((known) => known === reason),
    );
  });
}

function isOptions(value: unknown): value is ConfigurationOptions {
  if (!object(value)) return false;
  const choices: Record<string, readonly (string | boolean)[]> = {
    colors: [true, false],
    palette: PALETTE_VALUES,
    theme: THEME_VALUES,
    "powerline-glyph": POWERLINEGLYPH_VALUES,
    ...Object.fromEntries(POWERLINE_FIELDS.map(f => [f.key.replaceAll('.', '-').replaceAll('_', '-'), f.kind === 'boolean' ? [true, false] : f.choices])),
    'directory-style': DIRECTORYSTYLE_VALUES,
    'separator-style': SEPARATORSTYLE_VALUES,
    'scope-labels': SCOPELABELS_VALUES,
    'statusline-language': STATUSLINELANGUAGE_VALUES,
    'subagent-statusline': [true, false],
    'hide-vim-mode-indicator': [true, false],
  };
  for (const [key, allowed] of Object.entries(choices)) {
    const option = value[key];
    if (
      !object(option) ||
      !Array.isArray(option.choices) ||
      option.choices.length !== allowed.length ||
      new Set(option.choices).size !== option.choices.length ||
      !option.choices.every((choice) => allowed.includes(choice))
    )
      return false;
  }
  for (const [key, minimum, maximum] of [
    ['padding', 0, 32],
    ['refresh-interval', 1, 3600],
  ] as const) {
    const option = value[key];
    if (
      !object(option) ||
      option.minimum !== minimum ||
      option.maximum !== maximum
    )
      return false;
    if (key === 'refresh-interval' && option.special !== 'event') return false;
  }
  return true;
}

export function requestText(
  operation: Operation,
  payload: unknown = {},
): string {
  return JSON.stringify({
    protocol_version: PROTOCOL_VERSION,
    operation,
    payload,
  });
}

export function parseResponse<O extends Operation>(
  operation: O,
  process: {
    exitCode: number;
    stdout: string;
    stderr: string;
    isStdoutTruncated?: boolean;
  },
): ResultFor<O> {
  if (process.isStdoutTruncated) {
    throw new BackendError(
      'backend_output_truncated',
      localizedText("native.lib.backend.the_backend_json_was_truncated_by_the_host"),
    );
  }
  let response: unknown;
  try {
    response = JSON.parse(process.stdout);
  } catch {
    const message =
      process.exitCode !== 0
        ? `The backend exited with status ${process.exitCode}.`
        : 'The backend did not return complete JSON.';
    throw new BackendError(
      process.exitCode !== 0 ? 'backend_exit' : 'invalid_backend_json',
      localizedText("native.lib.backend.check_the_bound_backend_executable_and_reinstall_matching", {message: message}),
    );
  }
  if (!object(response) || response.protocol_version !== PROTOCOL_VERSION) {
    throw new BackendError(
      'protocol_mismatch',
      localizedText("native.lib.backend.the_frontend_and_backend_protocol_versions_do_not"),
    );
  }
  if (
    'error' in response === 'result' in response ||
    !exact(response, [
      'protocol_version',
      'error' in response ? 'error' : 'result',
    ])
  )
    fail();
  if ('error' in response) {
    if (
      !object(response.error) ||
      !exact(response.error, ['code', 'message', ...('localization' in response.error ? ['localization'] : [])]) ||
      !text(response.error.code) ||
      typeof response.error.message !== 'string' ||
      !(!('localization' in response.error) || response.error.localization === null || isLocalizedText(response.error.localization))
    )
      fail();
    throw new BackendError(response.error.code, response.error.message, isLocalizedText(response.error.localization) ? response.error.localization : null);
  }
  if (process.exitCode !== 0) {
    throw new BackendError(
      'backend_exit',
      localizedText("native.lib.backend.the_backend_exited_with_status", {exitCode: process.exitCode}),
    );
  }
  const result = response.result;
  if (!object(result)) fail();
  if (operation === 'read_ui_preferences' || operation === 'set_ui_language') {
    if (!exact(result, ['schema_version', 'ui_language', 'warning']) || result.schema_version !== 1 ||
        !STATUSLINELANGUAGE_VALUES.some(language => language === result.ui_language) ||
        !(result.warning === null || isLocalizedText(result.warning))) fail();
  } else if (operation === 'read' || operation === 'apply') {
    if (result.configuration !== undefined && !isConfiguration(result.configuration)) fail();
    if (
      !isDraft(result.draft) ||
      typeof result.revision !== 'string' ||
      !/^[0-9a-f]{64}$/.test(result.revision) ||
      typeof result.installed !== 'boolean' ||
      !object(result.installation) ||
      !isCapabilities(result.capabilities) ||
      !text(result.backend_version) ||
      !result.backend_version
    )
      fail();
    if (
      operation === 'apply' &&
      (typeof result.changed !== 'boolean' ||
        !(result.backup_dir === null || typeof result.backup_dir === 'string'))
    )
      fail();
  } else if (operation === 'review_import') {
    if (!exact(result, ['draft','changes']) || !isDraft(result.draft) || !Array.isArray(result.changes) || !result.changes.every(isImportChange)) fail();
  } else if (operation === 'import' || operation === 'preset') {
    if (!isDraft(result.draft)) fail();
  } else if (operation.startsWith('source')) {
    if (!isSourceResult(operation,result)) fail();
  } else if (operation === 'profiles_read' || operation === 'profiles_apply') {
    if (!isProfiles(result) || operation === 'profiles_apply' && (typeof result.changed !== 'boolean' || !(result.backup_dir === null || text(result.backup_dir)))) fail();
  } else if (operation === 'profile_import') {
    if (!exact(result, ['name','display']) || !text(result.name) || !displayDraft(result.display)) fail();
  } else if (operation === 'task_details') {
    if (!isTaskDetails(result)) fail();
  } else if (operation === 'export' || operation === 'profile_export') {
    if (!text(result.path) || !result.path) fail();
  } else if (operation === 'explain') {
    if (!exact(result,['sample','scope','width','actual_availability','preview','instances']) || result.sample!==true ||
        !['main','subagent'].includes(String(result.scope)) || !Number.isInteger(result.width) || Number(result.width)<2 || Number(result.width)>10000 || result.actual_availability!=='not_observed' ||
        !object(result.preview) || result.preview.sample!==true || !Array.isArray(result.preview.main) || !Array.isArray(result.preview.subagents) ||
        ![...result.preview.main,...result.preview.subagents].every(row=>Array.isArray(row)&&row.every(isSpan)) ||
        !Array.isArray(result.instances) || result.instances.length>10000) fail();
    const ids=new Set<string>();
    for(const item of result.instances as unknown[]) {
      if(!object(item)||!exact(item,['id','type_id','enabled','reasons','samples'])||!text(item.id)||ids.has(item.id)||!text(item.type_id)||typeof item.enabled!=='boolean'||!Array.isArray(item.reasons)||!Array.isArray(item.samples)) fail();
      ids.add(item.id as string);
      if(!item.reasons.every((reason:unknown)=>object(reason)&&exact(reason,['code','origin'])&&EXPLAIN_REASONS.includes(reason.code as typeof EXPLAIN_REASONS[number])&&['configuration','local_configuration','host_capability','unknown'].includes(String(reason.origin)))) fail();
      if(!item.samples.every((row:unknown)=>object(row)&&exact(row,['row_id','outcome','truncated'])&&text(row.row_id)&&SAMPLE_REASONS.includes(row.outcome as typeof SAMPLE_REASONS[number])&&typeof row.truncated==='boolean')) fail();
    }
  } else if (operation === 'diagnose') {
    if (!isDiagnosis(result)) fail();
  } else if (operation === 'preview') {
    if (
      result.sample !== true ||
      !Array.isArray(result.main) ||
      !Array.isArray(result.subagents) ||
      ![...result.main, ...result.subagents].every(
        (row) => Array.isArray(row) && row.every(isSpan),
      )
    )
      fail();
  } else if (operation === 'describe') {
    if (
      !text(result.backend_version) ||
      !result.backend_version ||
      !isOptions(result.options) ||
      !isCapabilities(result.capabilities) ||
      !selection(result.operations, ['sources_read','sources_apply','source_review','source_context','source_refresh','source_status','source_release','source_cancel','source_diagnose','describe', 'read', 'preview', 'apply', 'import', 'export', 'preset', 'read_ui_preferences', 'set_ui_language', 'review_import', 'explain', 'diagnose', 'profiles_read', 'profiles_apply', 'profile_import', 'profile_export', 'task_details']) ||
      result.operations.length !== 25 ||
      JSON.stringify(result.editor_fields) !== JSON.stringify(EDITOR_FIELDS) ||
      JSON.stringify(result.presets) !== JSON.stringify(PRESETS) ||
      !object(result.formatting_options) ||
      JSON.stringify(result.formatting_options) !== JSON.stringify(FORMAT_CHOICES) ||
      !isCatalog(result.catalog)
    )
      fail();
  }
  return result as unknown as ResultFor<O>;
}

function displayDraft(display: unknown): boolean {
  return isDraft({ display, host: { padding: 0, refresh_interval: 'event', hide_vim_mode_indicator: false } });
}
function isConfiguration(value: unknown): boolean {
  if (!object(value) || !exact(value, ['target','profile_id','profile_name','project_root','reason','shared_projects']) || !object(value.target)) return false;
  const target = value.target;
  return (target.kind === 'user' && exact(target,['kind']) || target.kind === 'profile' && exact(target,['kind','id']) && text(target.id) ||
    target.kind === 'project' && exact(target,['kind','path']) && text(target.path)) &&
    ['profile_id','profile_name','project_root'].every(k => value[k] === null || text(value[k])) && text(value.reason) && strings(value.shared_projects);
}
function isProfiles(value: Record<string, unknown>): boolean {
  if (value.version !== 1 || !text(value.revision) || !/^[a-f0-9]{64}$/u.test(value.revision) ||
      !Array.isArray(value.profiles) || !Array.isArray(value.bindings) || value.profiles.length > 128 || value.bindings.length > 512) return false;
  const ids = new Set<string>(), names = new Set<string>(), roots = new Set<string>();
  return value.profiles.every(p => {
    if (!object(p) || !exact(p,['id','name','display']) || !text(p.id) || !text(p.name) || ids.has(p.id) || names.has(p.name) || !displayDraft(p.display)) return false;
    ids.add(p.id); names.add(p.name); return true;
  }) && value.bindings.every(b => {
    if (!object(b) || !exact(b,['root','profile_id']) || !text(b.root) || !text(b.profile_id) || roots.has(b.root)) return false;
    roots.add(b.root); return true;
  });
}
function isTaskDetails(value: Record<string, unknown>): boolean {
  const nullable = (v: unknown) => v === null || text(v);
  const count = (v: unknown) => v === null || typeof v === 'number' && Number.isFinite(v) && v >= 0;
  const stamp = (v: unknown) => v === null || text(v) && Number.isFinite(Date.parse(v));
  const evidence = (v: unknown) => object(v) && exact(v,['source','scope','status','observed_at','freshness']) && text(v.source) &&
    text(v.scope) && text(v.status) && stamp(v.observed_at) && ['current','stale','unknown','newer_than_input'].includes(String(v.freshness));
  if (!exact(value,['version','session_id','prompt_id','captured_at','status','phase','elapsed_seconds','active_seconds','progress','agents','evidence','limitations']) ||
      value.version !== 1 || !text(value.session_id) || !nullable(value.prompt_id) || !text(value.captured_at) || !stamp(value.captured_at) ||
      !nullable(value.status) || !nullable(value.phase) || !count(value.elapsed_seconds) || !count(value.active_seconds) ||
      !Array.isArray(value.evidence) || !value.evidence.every(evidence) || !strings(value.limitations) || !Array.isArray(value.agents)) return false;
  if (value.progress !== null && (!object(value.progress) || !exact(value.progress,['completed','total']) || !range(value.progress.completed,0,100000) ||
      !range(value.progress.total,0,100000) || Number(value.progress.completed) > Number(value.progress.total))) return false;
  const ids = new Set<string>();
  return value.agents.every(agent => {
    if (!object(agent) || !exact(agent,['id','parent_id','name','status','evidence']) || !text(agent.id) || ids.has(agent.id) ||
        !nullable(agent.parent_id) || !nullable(agent.name) || !nullable(agent.status) || !Array.isArray(agent.evidence) || !agent.evidence.every(evidence)) return false;
    ids.add(agent.id); return true;
  });
}

function isDiagnosis(value: Record<string, unknown>): boolean {
  const nullable = (v: unknown) => v === null || text(v);
  const stamp = (v: unknown) => v === null || typeof v === 'string' && Number.isFinite(Date.parse(v));
  if (!exact(value, ['sample','scope','width','source','observed_at','diagnosed_at','session_id','prompt_id','host_version','include_local','output','instances','host_fields', ...(value.configuration !== undefined ? ['configuration'] : [])]) ||
      value.configuration !== undefined && !isConfiguration(value.configuration) ||
      value.sample !== false || !['main','subagent'].includes(String(value.scope)) || !range(value.width,2,10000) || !text(value.source) ||
      !stamp(value.observed_at) || value.diagnosed_at === null || !stamp(value.diagnosed_at) || !nullable(value.session_id) || !nullable(value.prompt_id) ||
      !nullable(value.host_version) || typeof value.include_local !== 'boolean' || !Array.isArray(value.output) || !Array.isArray(value.instances) || !object(value.host_fields)) return false;
  if (!value.output.every(row => object(row) && exact(row,['id','spans']) && text(row.id) && Array.isArray(row.spans) && row.spans.every(isSpan))) return false;
  const ids = new Set<string>();
  if (!value.instances.every(item => {
    if (!object(item) || !exact(item,['id','type_id','enabled','reasons','evidence','rows']) || !text(item.id) || ids.has(item.id) || !text(item.type_id) || typeof item.enabled !== 'boolean' || !Array.isArray(item.reasons) || !Array.isArray(item.evidence) || !Array.isArray(item.rows)) return false;
    ids.add(item.id);
    return item.reasons.every((reason: unknown) => object(reason) && exact(reason,['code','origin']) && EXPLAIN_REASONS.includes(reason.code as typeof EXPLAIN_REASONS[number]) && ['configuration','local_configuration','host_capability','unknown'].includes(String(reason.origin))) &&
      item.evidence.every((e: unknown) => object(e) && exact(e,['source','scope','status','observed_at','freshness','fields']) && text(e.source) && text(e.scope) && EVIDENCE_STATUSES.includes(e.status as typeof EVIDENCE_STATUSES[number]) && stamp(e.observed_at) && ['current','stale','unknown','newer_than_input'].includes(String(e.freshness)) && Array.isArray(e.fields) && e.fields.every((f: unknown) => object(f) && exact(f,['path','status']) && text(f.path) && ['observed','not_observed','invalid_field'].includes(String(f.status)))) &&
      item.rows.every((row: unknown) => object(row) && exact(row,['row_id','outcome','truncated']) && text(row.row_id) && LAYOUT_REASONS.includes(row.outcome as typeof LAYOUT_REASONS[number]) && typeof row.truncated === 'boolean');
  })) return false;
  const tree = value.host_fields.worktree, cache = value.host_fields.cache_miss;
  return exact(value.host_fields,['worktree','cache_miss']) && object(tree) && exact(tree,['session_name','git_name','selected_source']) && nullable(tree.session_name) && nullable(tree.git_name) && [null,'worktree.name','workspace.git_worktree'].includes(tree.selected_source as string | null) &&
    object(cache) && exact(cache,['status','causes','last_miss_at','tools_added','tools_removed','system_char_delta']) && ['observed','not_observed','no_misses','unidentified','invalid_field'].includes(String(cache.status)) && strings(cache.causes) &&
    ['last_miss_at','tools_added','tools_removed','system_char_delta'].every(key => cache[key] === null || typeof cache[key] === 'number' && Number.isFinite(cache[key]));
}

export function spanColor(span: Span, channel: 'foreground' | 'background' = 'foreground'): string | undefined {
  const color = span[channel];
  if (color?.kind === 'rgb') return String(color.value);
  if (color?.kind === 'ansi')
    return `ansi256(${Number(color.value)})`;
  return undefined;
}
