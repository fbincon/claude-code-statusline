import * as fs from 'node:fs';
import { join, relative, isAbsolute, dirname } from 'node:path';
import { isLosslessNumber } from '@fbincon/statusline-core/json';
import { decode } from '@fbincon/statusline-core/json';
import { validateDisplay, defaultDisplay, CONFIG_FILENAME } from '@fbincon/statusline-core/config/display';

export interface Case { id: string; kind: string; input: Record<string, unknown>; config?: unknown; config_id?: string; files?: Record<string, string> }
export type Handler = (fixture: Case) => unknown;

// Subsystems register actual production adapters as their migration lands.
// An absent handler is an incomplete stage, never a successful fixture replay.
export const handlers: Readonly<Record<string, Handler>> = {
  display: () => {
    const path = join(process.cwd(), 'config', CONFIG_FILENAME);
    let raw: string;
    try { raw = fs.readFileSync(path, 'utf8'); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { effective: defaultDisplay(), raw: null }; throw error; }
    return { effective: validateDisplay(decode(raw)), raw };
  },
};

function snapshot(root: string): Record<string, string> {
  const files: Record<string, string> = {};
  function walk(path: string) {
    if (!fs.existsSync(path)) return;
    for (const entry of fs.readdirSync(path, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const child = join(path, entry.name);
      if (entry.isDirectory()) walk(child);
      else if (entry.isFile()) files[relative(root, child).split('\\').join('/')] = fs.readFileSync(child, 'utf8');
      else throw new Error('Unexpected non-file case artifact');
    }
  }
  for (const name of ['config', 'runtime', 'sessions']) walk(join(root, name));
  return files;
}

export function runCase(fixture: Case, handler: Handler): unknown {
  const root = process.cwd();
  for (const [name, raw] of Object.entries(fixture.files ?? {})) {
    const parts = name.split(/[\\/]/u);
    if (isAbsolute(name) || parts.includes('..') || !['config', 'runtime', 'sessions'].includes(parts[0]!) || typeof raw !== 'string') throw new Error('Unsafe fixture path');
    const path = join(root, ...parts); fs.mkdirSync(dirname(path), { recursive: true }); fs.writeFileSync(path, raw);
  }
  const before = snapshot(root);
  const value = handler(fixture);
  function normalize(item: unknown): unknown {
    if (typeof item === 'string') return item.replaceAll(root, '<CASE>');
    if (Array.isArray(item)) return item.map(normalize);
    if (item && typeof item === 'object' && !isLosslessNumber(item)) return Object.fromEntries(Object.entries(item).map(([key, val]) => [key.replaceAll(root, '<CASE>'), normalize(val)]));
    return item;
  }
  return normalize({ value, files_before: before, files_after: snapshot(root), directories_after: ['config', 'runtime', 'sessions'].filter(name => fs.existsSync(join(root, name))) });
}
