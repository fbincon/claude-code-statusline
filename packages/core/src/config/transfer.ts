import { unboundDisplay } from '../extensions/portable.js';
import type { Draft } from '../contracts/ui.js';
import { decode } from '../json.js';
import { pythonJson } from '../json-text.js';
import { object, fail } from './validation.js';
import { isSchema } from './display.js';
import { validateDraft } from './draft.js';

export const FORMAT = 'claude-code-statusline';
export const VERSION = 1;
export const MAX_BYTES = 1_048_576;

export function importText(raw: string, current: Draft): Draft {
  const data = decode(raw);
  if (object(data) && Object.hasOwn(data, 'schema_version')) return { ...validateDraft({ display: data, host: current.host }), display: unboundDisplay(validateDraft({ display: data, host: current.host }).display) };
  if (!object(data) || Object.keys(data).length !== 3 || !['format', 'version', 'draft'].every(key => Object.hasOwn(data, key))) {
    fail('errors.transfer.import_requires_a_portable_envelope_or_a');
  }
  if (data.format !== FORMAT || !isSchema(data.version, VERSION)) fail('errors.transfer.unsupported_portable_configuration_format_version');
  const parsed = validateDraft(data.draft); return { ...parsed, display: unboundDisplay(parsed.display) };
}

export function exportText(draft: Draft): string {
  return pythonJson({ format: FORMAT, version: VERSION, draft: { ...validateDraft(draft, true), display: unboundDisplay(draft.display) } }, { ensureAscii: false, indent: 2 }) + '\n';
}
