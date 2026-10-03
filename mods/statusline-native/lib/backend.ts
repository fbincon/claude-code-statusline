/** Protocol-only logic. Host calls stay in hooks/register.ts for static analysis. */
import { PROTOCOL_VERSION, MAIN_ITEM_IDS, SUBAGENT_ITEM_IDS, PALETTE_VALUES,
  DIRECTORYSTYLE_VALUES, SEPARATORSTYLE_VALUES, SCOPELABELS_VALUES } from './generated-contracts.ts';
import type { Draft, Operation, ResultFor, Span } from './generated-contracts.ts';

export class BackendError extends Error {
  constructor(public readonly code: string, message: string) { super(message); }
}

export function processFailure(error: unknown): BackendError {
  if (error instanceof BackendError) return error;
  const message = error instanceof Error ? error.message : 'The backend process could not run.';
  const timedOut = error instanceof Error && (error.name === 'TimeoutError' || /timed?\s*out|timeout/i.test(message));
  return new BackendError(timedOut ? 'backend_timeout' : 'backend_process', message);
}

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function fail(): never { throw new BackendError('invalid_backend_result', 'The backend returned an invalid configuration result.'); }
function exact(value: Record<string, unknown>, keys: string[]): boolean {
  return Object.keys(value).length === keys.length && keys.every(key => key in value);
}
function selection(value: unknown, ids: readonly string[]): boolean {
  return Array.isArray(value) && value.every(id => typeof id === 'string' && ids.includes(id)) && new Set(value).size === value.length;
}

export function isDraft(value: unknown): value is Draft {
  if (!object(value) || !exact(value, ['display', 'host']) || !object(value.display) || !object(value.host)) return false;
  const d = value.display, h = value.host;
  if (!exact(d, ['schema_version', 'items', 'use_colors', 'palette', 'directory_style', 'separator_style', 'scope_labels', 'subagents']) ||
      !exact(h, ['padding', 'refresh_interval', 'hide_vim_mode_indicator'])) return false;
  if (d.schema_version !== 2 || typeof d.use_colors !== 'boolean' || !selection(d.items, MAIN_ITEM_IDS) ||
      !PALETTE_VALUES.some(x => x === d.palette) || !DIRECTORYSTYLE_VALUES.some(x => x === d.directory_style) ||
      !SEPARATORSTYLE_VALUES.some(x => x === d.separator_style) || !SCOPELABELS_VALUES.some(x => x === d.scope_labels)) return false;
  const sub = d.subagents;
  if (!object(sub) || !exact(sub, ['enabled', 'items']) || typeof sub.enabled !== 'boolean' || !selection(sub.items, SUBAGENT_ITEM_IDS)) return false;
  // The authoritative backend enforces catalog exclusions. Reject malformed
  // transport data here without maintaining a second catalog.
  return typeof h.padding === 'number' && Number.isInteger(h.padding) && h.padding >= 0 && h.padding <= 32 &&
    typeof h.hide_vim_mode_indicator === 'boolean' && (h.refresh_interval === 'event' ||
      typeof h.refresh_interval === 'number' && Number.isInteger(h.refresh_interval) && h.refresh_interval >= 1 && h.refresh_interval <= 3600);
}

export function isSpan(value: unknown): value is Span {
  if (!object(value) || typeof value.text !== 'string' || /[\x00-\x1f\x7f]/.test(value.text) || typeof value.bold !== 'boolean') return false;
  const color = value.foreground;
  return color === null || object(color) && (color.kind === 'rgb' && typeof color.value === 'string' && /^#[0-9a-f]{6}$/i.test(color.value) ||
    color.kind === 'ansi' && typeof color.value === 'number' && Number.isInteger(color.value) && color.value >= 0 && color.value <= 15);
}

export function requestText(operation: Operation, payload: unknown = {}): string {
  return JSON.stringify({ protocol_version: PROTOCOL_VERSION, operation, payload });
}

export function parseResponse<O extends Operation>(operation: O, process: { exitCode: number; stdout: string; stderr: string; isStdoutTruncated?: boolean }): ResultFor<O> {
  if (process.isStdoutTruncated) throw new BackendError('backend_output_truncated', 'The backend JSON was truncated by the host.');
  let response: unknown;
  try { response = JSON.parse(process.stdout); }
  catch {
    if (process.exitCode !== 0) throw new BackendError('backend_exit', `The backend exited with status ${process.exitCode}. Bind a backend from this checkout with CLAUDE_STATUSLINE_NATIVE_EXECUTABLE.`);
    throw new BackendError('invalid_backend_json', 'The backend did not return complete JSON. Bind a backend from this checkout with CLAUDE_STATUSLINE_NATIVE_EXECUTABLE.');
  }
  if (!object(response) || response.protocol_version !== PROTOCOL_VERSION) throw new BackendError('protocol_mismatch', 'The frontend and backend protocol versions do not match.');
  if (('error' in response) === ('result' in response) || !exact(response, ['protocol_version', 'error' in response ? 'error' : 'result'])) fail();
  if ('error' in response) {
    if (!object(response.error) || !exact(response.error, ['code', 'message']) || typeof response.error.code !== 'string' || typeof response.error.message !== 'string') fail();
    throw new BackendError(response.error.code, response.error.message);
  }
  if (process.exitCode !== 0) throw new BackendError('backend_exit', `The backend exited with status ${process.exitCode}.`);
  const result = response.result;
  if (!object(result)) fail();
  if (operation === 'read' || operation === 'apply') {
    if (!isDraft(result.draft) || typeof result.revision !== 'string' || !/^[0-9a-f]{64}$/.test(result.revision) ||
        typeof result.installed !== 'boolean' || !object(result.installation) || !object(result.capabilities) || typeof result.backend_version !== 'string') fail();
    if (operation === 'apply' && (typeof result.changed !== 'boolean' || !(result.backup_dir === null || typeof result.backup_dir === 'string'))) fail();
  } else if (operation === 'preview') {
    if (result.sample !== true || !Array.isArray(result.main) || !Array.isArray(result.subagents) ||
        ![...result.main, ...result.subagents].every(row => Array.isArray(row) && row.every(isSpan))) fail();
  } else if (operation === 'describe') {
    if (typeof result.backend_version !== 'string' || !object(result.options) || !object(result.capabilities) || !Array.isArray(result.operations) ||
        !Array.isArray(result.catalog) || !result.catalog.every(item => object(item) && typeof item.id === 'string' && typeof item.label === 'string' && typeof item.description === 'string' &&
          (item.scope === 'main' || item.scope === 'subagent') && typeof item.default_enabled === 'boolean' && Array.isArray(item.excludes))) fail();
  }
  return result as unknown as ResultFor<O>;
}

const ANSI = ['black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white',
  'gray', 'redBright', 'greenBright', 'yellowBright', 'blueBright', 'magentaBright', 'cyanBright', 'whiteBright'];
export function spanColor(span: Span): string | undefined {
  return span.foreground?.kind === 'rgb' ? String(span.foreground.value) :
    span.foreground?.kind === 'ansi' ? ANSI[Number(span.foreground.value)] : undefined;
}
