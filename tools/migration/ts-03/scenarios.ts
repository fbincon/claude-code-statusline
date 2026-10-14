import * as fs from 'node:fs';
import { join, relative, isAbsolute, dirname } from 'node:path';
import { isLosslessNumber } from '@fbincon/statusline-core/json';
import { decode } from '@fbincon/statusline-core/json';
import { validateDisplay, defaultDisplay, CONFIG_FILENAME } from '@fbincon/statusline-core/config/display';
import { ConfigurationService } from '@fbincon/statusline-cli/config/service';
import { ConfigurationProtocol } from '@fbincon/statusline-cli/ui/protocol';
import { createStorage } from '@fbincon/statusline-cli/config/storage';
import { main } from '@fbincon/statusline-cli/main';
import { pythonJson } from '@fbincon/statusline-core/json-text';

export interface Case { id: string; kind: string; input: Record<string, unknown>; config?: unknown; config_id?: string; files?: Record<string, string> }
export type Handler = (fixture: Case) => unknown;

function protocol(): ConfigurationProtocol {
  return new ConfigurationProtocol(new ConfigurationService({ configDir: join(process.cwd(), 'config'), launch: { executable: '/ts01/claude-statusline', args: [] }, hostVersion: () => [2, 1, 294] }, createStorage(() => new Date('2033-05-18T03:33:20Z'))));
}
function call(protocol: ConfigurationProtocol, raw: string): { response: unknown; exit_code: number } {
  const result = protocol.handle(raw);
  return { response: result.response, exit_code: result.status };
}

export function supported(fixture: Case): boolean {
  if (!Object.hasOwn(handlers, fixture.kind)) return false;
  // Successful preview rendering and runtime entry points land in 03-D/E.
  if (fixture.kind === 'ui' && fixture.id === 'ui-preview') return false;
  if (fixture.kind === 'cli' && ['render', 'render-subagents', 'hook', 'slash-hook', 'runtime'].includes((fixture.input.argv as string[])[0]!)) return false;
  return true;
}

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
  cli: async fixture => {
    let stdout = '', stderr = '';
    const exit_code = await main(fixture.input.argv as string[], {
      configDir: join(process.cwd(), 'config'), launch: { executable: join(process.cwd(), 'bin/claude-statusline'), args: [] }, hostVersion: () => null,
      stdin: () => fixture.input.stdin as string, stdout: text => { stdout += text; }, stderr: text => { stderr += text; },
    });
    return { exit_code, stdout, stderr };
  },
  ui: fixture => call(protocol(), fixture.input.raw as string),
  transaction: fixture => {
    const p = protocol(), request = (operation: string, payload: unknown) => call(p, pythonJson({ protocol_version: 11, operation, payload }));
    const initial = request('read', {}) as { response: { result: { revision: string; draft: unknown } }; exit_code: number };
    const revision = initial.response.result.revision;
    const first = request('apply', { draft: fixture.input.draft, expected_revision: revision }), after = snapshot(process.cwd());
    const conflict = request('apply', { draft: initial.response.result.draft, expected_revision: revision });
    return { initial, first_save: first, stale_save: conflict, after_first_save: after, stale_save_unchanged: JSON.stringify(after) === JSON.stringify(snapshot(process.cwd())), reopen: request('read', {}) };
  },
  transfer: fixture => {
    const p = protocol(), target = join(process.cwd(), 'portable.json'), responses = [];
    for (const operation of ['export', 'import', 'review_import']) {
      const payload: Record<string, unknown> = { draft: fixture.input.draft, path: target };
      if (operation === 'export') payload.overwrite = false;
      responses.push({ operation, ...call(p, pythonJson({ protocol_version: 11, operation, payload })) });
    }
    return { responses, portable: fs.readFileSync(target, 'utf8') };
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

export async function runCase(fixture: Case, handler: Handler): Promise<unknown> {
  const root = process.cwd();
  for (const [name, raw] of Object.entries(fixture.files ?? {})) {
    const parts = name.split(/[\\/]/u);
    if (isAbsolute(name) || parts.includes('..') || !['config', 'runtime', 'sessions'].includes(parts[0]!) || typeof raw !== 'string') throw new Error('Unsafe fixture path');
    const path = join(root, ...parts); fs.mkdirSync(dirname(path), { recursive: true }); fs.writeFileSync(path, raw);
  }
  const before = snapshot(root);
  const value = await handler(fixture);
  function normalize(item: unknown): unknown {
    if (typeof item === 'string') return item.replaceAll(root, '<CASE>');
    if (Array.isArray(item)) return item.map(normalize);
    if (item && typeof item === 'object' && !isLosslessNumber(item)) return Object.fromEntries(Object.entries(item).map(([key, val]) => [key.replaceAll(root, '<CASE>'), normalize(val)]));
    return item;
  }
  return normalize({ value, files_before: before, files_after: snapshot(root), directories_after: ['config', 'runtime', 'sessions'].filter(name => fs.existsSync(join(root, name))) });
}
