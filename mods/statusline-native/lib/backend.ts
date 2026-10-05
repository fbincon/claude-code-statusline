/** Protocol parsing only. Host calls stay in the hooks entry for static analysis. */
import {
  PROTOCOL_VERSION,
  MAIN_ITEM_IDS,
  SUBAGENT_ITEM_IDS,
  PALETTE_VALUES,
  DIRECTORYSTYLE_VALUES,
  SEPARATORSTYLE_VALUES,
  SCOPELABELS_VALUES,
  UNAVAILABLEREASON_VALUES,
  FORMAT_CHOICES, PRESETS, EDITOR_FIELDS,
} from './generated-contracts.ts';
import type {
  Capabilities,
  CatalogItem,
  ConfigurationOptions,
  Draft,
  Operation,
  ResultFor,
  Span,
} from './generated-contracts.ts';

export class BackendError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
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
    'The backend returned an invalid configuration result.',
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

function itemOptions(value: unknown, ids: readonly string[]): boolean {
  if (!object(value)) return false;
  return Object.entries(value).every(([id, option]) => ids.includes(id) && object(option) &&
    exact(option, ['label', 'icon', 'priority', 'max_width', 'formatting']) &&
    (option.label === null || (text(option.label) && [...option.label].length <= 256)) &&
    (option.icon === null || (text(option.icon) && [...option.icon].length <= 256)) &&
    range(option.priority, 0, 100) && range(option.max_width, 2, 10000, true) &&
    formatOverrides(option.formatting));
}

function formatting(value: unknown): boolean {
  if (!object(value) || !exact(value, [...Object.keys(FORMAT_CHOICES), 'thresholds'])) return false;
  const { thresholds, ...choices } = value;
  return formatOverrides(choices) && object(thresholds) &&
    exact(thresholds, ['enabled', 'warning', 'critical']) &&
    typeof thresholds.enabled === 'boolean' && range(thresholds.warning, 0, 100) &&
    range(thresholds.critical, 0, 100) && Number(thresholds.warning) < Number(thresholds.critical);
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
      'schema_version',
      'items',
      'use_colors',
      'palette',
      'directory_style',
      'separator_style',
      'scope_labels',
      'subagents',
      'formatting', 'item_options', 'layout', 'metrics',
    ]) ||
    !exact(h, ['padding', 'refresh_interval', 'hide_vim_mode_indicator'])
  )
    return false;
  if (
    d.schema_version !== 5 ||
    !object(d.metrics) || !exact(d.metrics, ['branch_diff_base_ref']) ||
    !(d.metrics.branch_diff_base_ref === null || (text(d.metrics.branch_diff_base_ref) && [...d.metrics.branch_diff_base_ref].length <= 256 &&
      d.metrics.branch_diff_base_ref.length > 0 && !/[\s]|^-/.test(d.metrics.branch_diff_base_ref))) ||
    !formatting(d.formatting) || !itemOptions(d.item_options, MAIN_ITEM_IDS) ||
    typeof d.use_colors !== 'boolean' ||
    !selection(d.items, MAIN_ITEM_IDS) ||
    !PALETTE_VALUES.some((x) => x === d.palette) ||
    !DIRECTORYSTYLE_VALUES.some((x) => x === d.directory_style) ||
    !SEPARATORSTYLE_VALUES.some((x) => x === d.separator_style) ||
    !SCOPELABELS_VALUES.some((x) => x === d.scope_labels)
  )
    return false;
  const sub = d.subagents;
  if (
    !object(sub) ||
    !exact(sub, ['enabled', 'items', 'item_options', 'visibility', 'hide_completed', 'row_limit', 'task_max_width']) ||
    !itemOptions(sub.item_options, SUBAGENT_ITEM_IDS) ||
    !['all', 'running'].includes(String(sub.visibility)) ||
    typeof sub.hide_completed !== 'boolean' || !range(sub.row_limit, 0, 10000, true) ||
    !range(sub.task_max_width, 2, 10000, true) ||
    typeof sub.enabled !== 'boolean' ||
    !selection(sub.items, SUBAGENT_ITEM_IDS)
  )
    return false;
  const layout = d.layout;
  if (!object(layout) || !exact(layout, ['mode', 'rows']) ||
      !['auto', 'explicit'].includes(String(layout.mode)) || !Array.isArray(layout.rows) ||
      !layout.rows.every((r) => selection(r, MAIN_ITEM_IDS) && r.length > 0) ||
      (layout.mode === 'auto' ? layout.rows.length !== 0 :
        JSON.stringify(layout.rows.flat()) !== JSON.stringify(d.items))) return false;
  // Exclusions come from describe; Python remains the final draft validator.
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
  const color = value.foreground;
  return (
    color === null ||
    (object(color) &&
      ((color.kind === 'rgb' &&
        typeof color.value === 'string' &&
        /^#[0-9a-f]{6}$/i.test(color.value)) ||
        (color.kind === 'ansi' &&
          typeof color.value === 'number' &&
          Number.isInteger(color.value) &&
          color.value >= 0 &&
          color.value <= 15)))
  );
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
    'directory-style': DIRECTORYSTYLE_VALUES,
    'separator-style': SEPARATORSTYLE_VALUES,
    'scope-labels': SCOPELABELS_VALUES,
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
      'The backend JSON was truncated by the host.',
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
      message +
        ' Check the bound backend executable and reinstall matching resources.',
    );
  }
  if (!object(response) || response.protocol_version !== PROTOCOL_VERSION) {
    throw new BackendError(
      'protocol_mismatch',
      'The frontend and backend protocol versions do not match.',
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
      !exact(response.error, ['code', 'message']) ||
      !text(response.error.code) ||
      typeof response.error.message !== 'string'
    )
      fail();
    throw new BackendError(response.error.code, response.error.message);
  }
  if (process.exitCode !== 0) {
    throw new BackendError(
      'backend_exit',
      `The backend exited with status ${process.exitCode}.`,
    );
  }
  const result = response.result;
  if (!object(result)) fail();
  if (operation === 'read' || operation === 'apply') {
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
  } else if (operation === 'import' || operation === 'preset') {
    if (!isDraft(result.draft)) fail();
  } else if (operation === 'export') {
    if (!text(result.path) || !result.path) fail();
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
      !selection(result.operations, ['describe', 'read', 'preview', 'apply', 'import', 'export', 'preset']) ||
      result.operations.length !== 7 ||
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

const ANSI = [
  'black',
  'red',
  'green',
  'yellow',
  'blue',
  'magenta',
  'cyan',
  'white',
  'gray',
  'redBright',
  'greenBright',
  'yellowBright',
  'blueBright',
  'magentaBright',
  'cyanBright',
  'whiteBright',
];

export function spanColor(span: Span): string | undefined {
  if (span.foreground?.kind === 'rgb') return String(span.foreground.value);
  if (span.foreground?.kind === 'ansi')
    return ANSI[Number(span.foreground.value)];
  return undefined;
}
