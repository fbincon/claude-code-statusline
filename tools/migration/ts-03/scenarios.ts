import { validateDraft } from '@fbincon/statusline-core/config/draft';
import { PROTOCOL_VERSION } from '@fbincon/statusline-core/contracts/ui';
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
import { StatusTimer, loadSample } from '@fbincon/statusline-core/timing/timer';
import type { Sample } from '@fbincon/statusline-core/timing/sample';
import { int, numeric, type Data } from '@fbincon/statusline-core/runtime/values';
import { renderTaskTimer } from '@fbincon/statusline-core/rendering/timer';
import { MESSAGES } from '@fbincon/statusline-core/i18n/statusline/en';
import { runtimeContext } from '@fbincon/statusline-cli/runtime/context';
import { runtimeIO } from '@fbincon/statusline-cli/runtime/io';
import { TaskService } from '@fbincon/statusline-cli/runtime/tasks/service';
import { SubmissionIndex } from '@fbincon/statusline-cli/runtime/tasks/submissions';
import { RuntimeProtocol } from '@fbincon/statusline-cli/runtime/live/protocol';
import { configuredRows } from '@fbincon/statusline-core/rendering/items';
import { previewRows } from '@fbincon/statusline-core/rendering/preview';
import { renderPayload, previewRows as agentPreview } from '@fbincon/statusline-core/rendering/subagents';
import { renderEnvironment, baseEnvironment, presentation } from '@fbincon/statusline-cli/rendering/environment';
import { previewAdapter } from '@fbincon/statusline-cli/rendering/preview';

export interface Case { id: string; kind: string; input: Record<string, unknown>; config?: unknown; config_id?: string; files?: Record<string, string> }
export type Handler = (fixture: Case) => unknown;

async function protocol(): Promise<ConfigurationProtocol> {
  return new ConfigurationProtocol(new ConfigurationService({ configDir: join(process.cwd(), 'config'), launch: { executable: '/ts01/claude-statusline', args: [] }, hostVersion: () => [2, 1, 294] }, createStorage(() => new Date('2033-05-18T03:33:20Z'))), await previewAdapter('/ts01/home'));
}
function call(protocol: ConfigurationProtocol, raw: string): { response: unknown; exit_code: number } {
  // Adapt the historical request version without rewriting frozen fixtures.
  const input = raw.replace(/("protocol_version"\s*:\s*)11\b/u, (_match,prefix:string) => prefix + PROTOCOL_VERSION);
  const result = protocol.handle(input);
  return { response: result.response, exit_code: result.status };
}

export function supported(fixture: Case): boolean {
  if (!Object.hasOwn(handlers, fixture.kind)) return false;
  return true;
}

// Subsystems register actual production adapters as their migration lands.
// An absent handler is an incomplete stage, never a successful fixture replay.
export const handlers: Readonly<Record<string, Handler>> = {
  preview: async fixture => {
    const config = validateDisplay(fixture.config), env = baseEnvironment(await presentation(config.statusline_language), { home: '/ts01/home' }), width = numeric(fixture.input.width)!;
    return fixture.input.scope === 'subagent' ? agentPreview(config, width, env) : previewRows(config, width, env, '/ts01/home');
  },
  render: async fixture => {
    const config = validateDisplay(fixture.config), base = runtimeContext(join(process.cwd(), 'config')), context = { ...base, nowMs: () => 2_000_000_000_000, sample: () => ({ ...base.sample(), wall_ns: 2_000_000_000_000_000_001n }) };
    const env = await renderEnvironment(config, fixture.input.payload, { home: '/ts01/home', runtime: context, now: () => 2_000_000_000 });
    return configuredRows(fixture.input.payload, config, numeric(fixture.input.width)!, env);
  },
  subagents: async fixture => {
    const config = validateDisplay(fixture.config), env = await renderEnvironment(config, fixture.input.payload, { home: '/ts01/home', now: () => 2_000_000_000 }, true);
    return renderPayload(fixture.input.payload, config, env, numeric(fixture.input.now_ms)!);
  },
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
  ui: async fixture => call(await protocol(), fixture.input.raw as string),
  transaction: async fixture => {
    const p = await protocol(), request = (operation: string, payload: unknown) => call(p, pythonJson({ protocol_version: 19, operation, payload }));
    const initial = request('read', {}) as { response: { result: { revision: string; draft: unknown } }; exit_code: number };
    const revision = initial.response.result.revision;
    const first = request('apply', { draft: validateDraft(fixture.input.draft), expected_revision: revision }), after = snapshot(process.cwd());
    const conflict = request('apply', { draft: initial.response.result.draft, expected_revision: revision });
    return { initial, first_save: first, stale_save: conflict, after_first_save: after, stale_save_unchanged: JSON.stringify(after) === JSON.stringify(snapshot(process.cwd())), reopen: request('read', {}) };
  },
  transfer: async fixture => {
    const p = await protocol(), target = join(process.cwd(), 'portable.json'), responses = [];
    for (const operation of ['export', 'import', 'review_import']) {
      const payload: Record<string, unknown> = { draft: validateDraft(fixture.input.draft), path: target };
      if (operation === 'export') payload.overwrite = false;
      responses.push({ operation, ...call(p, pythonJson({ protocol_version: 19, operation, payload })) });
    }
    return { responses, portable: fs.readFileSync(target, 'utf8') };
  },
  clock: fixture => {
    let timer = StatusTimer.load(fixture.input.initial)!;
    return (fixture.input.events as Data[]).map(event => {
      const sample = loadSample(event.sample)!;
      if (event.action === 'restore') timer = StatusTimer.load(decode(pythonJson(timer.toDict())))!;
      else if (event.action === 'pause') timer = timer.pause(event.token as string, sample);
      else if (event.action === 'resume') timer = timer.resume(event.token as string, sample);
      else if (event.action === 'finish') timer = timer.finish(sample);
      else if (event.action === 'reset') timer = timer.reset(sample);
      else throw new Error('Unknown clock action');
      return { state: timer.toDict(), elapsed_ns: timer.elapsed(sample) };
    });
  },
  lifecycle: fixture => {
    let sample: Sample;
    const context = { ...runtimeContext(join(process.cwd(), 'config')), sample: () => sample, nowMs: () => 2_000_000_000_000 };
    const service = new TaskService(context);
    const translate = (key: string, params: Record<string, unknown> = {}) => ((MESSAGES as Record<string, string>)[key] ?? key).replace(/\{([A-Za-z_][A-Za-z_0-9]*)\}/gu, (_match, name: string) => String(params[name]));
    return (fixture.input.events as Data[]).map(step => {
      sample = { wall_ns: int(step.wall_ns)!, boot_ns: int(step.boot_ns), boot_id: step.boot_id as string | null };
      if (step.action === 'hook') service.handle(step.payload);
      else if (step.action === 'confirm') service.confirm(fixture.input.session_id, fixture.input.prompt_id, sample.wall_ns);
      else if (step.action === 'transcript') service.transcript(fixture.input.session_id, step.observations);
      else throw new Error('Unknown lifecycle action');
      const state = service.store.state(fixture.input.session_id, fixture.input.prompt_id);
      return { state, rendered: state ? renderTaskTimer(state, sample, translate) : null };
    });
  },
  cursor: fixture => {
    const context = runtimeContext(join(process.cwd(), 'config')), path = join(context.runtimeRoot, 'synthetic.jsonl');
    fs.mkdirSync(dirname(path), { recursive: true });
    let identity = 100n, mtime = 1n, offsets: bigint[] = [];
    const base = runtimeIO();
    const io = { ...base, stat(target: string, follow = true) { const stat = base.stat(target, follow); return target === path ? { ...stat, dev: 7n, ino: identity, mtimeNs: mtime } : stat; },
      resolve(target: string) { return target === path ? '/ts01/synthetic.jsonl' : base.resolve(target); },
      lines(target: string, start: bigint, visit: (line: Buffer) => void) { offsets.push(start); return base.lines(target, start, visit); } };
    const index = new SubmissionIndex(context, io);
    return (fixture.input.steps as Data[]).map(step => {
      mtime++; const raw = Buffer.from(step.text as string);
      if (step.action === 'append') fs.appendFileSync(path, raw);
      else if (step.action === 'replace') { identity++; const replacement = path.replace(/\.jsonl$/u, '.new'); fs.writeFileSync(replacement, raw); fs.renameSync(replacement, path); }
      else fs.writeFileSync(path, raw);
      offsets = [];
      const value = index.time(path, step.prompt_id as string);
      return { submission_ns: value, file_bytes: fs.statSync(path).size, read_offsets: offsets };
    });
  },
  runtime: async fixture => {
    const context = { ...runtimeContext(join(process.cwd(), 'config')), nowMs: () => 2_000_000_000_000 };
    const protocol = new RuntimeProtocol(context), records = [];
    for (const raw of fixture.input.requests as string[]) {
      const result = await protocol.handle(raw); records.push({ exit_code: result.status, stdout: result.stdout });
    }
    return records;
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
