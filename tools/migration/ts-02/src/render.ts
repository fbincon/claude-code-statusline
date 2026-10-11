import { readFileSync } from 'node:fs';
import { decode, integer } from './json.js';
import { clip } from './generated/unicode.js';

// Deliberately narrow real render profile, not the TS-03 renderer. Unsupported
// configurations fail rather than silently presenting partial production parity.
export function render(raw: string, path: string, width: number): string {
  const config = decode(readFileSync(path, 'utf8')) as Record<string, unknown>;
  if (!config || integer(config.schema_version) !== 8n || typeof config.use_colors !== 'boolean' || !Array.isArray(config.instances)) throw new Error('Invalid probe configuration');
  const active = config.instances.filter((x: unknown) => (x as { enabled?: unknown }).enabled === true);
  if (active.length !== 1 || active[0].type_id !== 'model' || !Number.isSafeInteger(width) || width < 1) throw new Error('Unsupported probe profile');
  let input: { model?: { id?: unknown } };
  try { input = decode(raw) as typeof input; } catch { return ''; }
  if (!input || typeof input.model?.id !== 'string') return '';
  const label = clip(input.model.id.replace(/[\x00-\x1f\x7f-\x9f\ud800-\udfff]/gu, ' '), width);
  return (config.use_colors ? '\x1b[1;38;2;246;226;183m' + label + '\x1b[0m' : label) + '\n';
}
