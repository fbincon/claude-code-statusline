import assert from 'node:assert/strict';
import type { TestContext } from 'node:test';
import * as fs from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { pythonJson } from '@fbincon/statusline-core/json-text';
import { readJson } from '@fbincon/statusline-core/json-read';
import { validate, validateBatch, type Observation } from '@fbincon/statusline-core/runtime/live/model';
import { resolveMetrics } from '@fbincon/statusline-core/runtime/live/snapshot';
import type { Data } from '@fbincon/statusline-core/runtime/values';
import { runtimeContext } from '../src/runtime/context.js';
import { LiveStore } from '../src/runtime/live/store.js';
import { RuntimeProtocol } from '../src/runtime/live/protocol.js';
import { TaskService } from '../src/runtime/tasks/service.js';
export { fs, join, readJson, pythonJson, assert };
export function plain<T = any>(value: unknown): T { return JSON.parse(pythonJson(value, { allowNan: true })) as T; }
export function setup(t: TestContext) {
    const root = fs.mkdtempSync(join(tmpdir(), 'ts03-runtime-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    let wall = 1000000000n, boot: bigint | null = wall, domain: string | null = 'test';
    const context = { ...runtimeContext(root, {}), runtimeRoot: join(root, 'runtime'), cacheRoot: root, sessionsDir: join(root, 'sessions'),
        sample: () => ({ wall_ns: wall, boot_ns: boot, boot_id: domain }), nowMs: () => Number(wall) / 1e6, processToken: (_pid: number) => null as string | null };
    const store = new LiveStore(context), tasks = new TaskService(context), protocol = new RuntimeProtocol(context);
    return { root, context, store, tasks, protocol,
        clock(w: bigint, b: bigint | null = w, d: string | null = 'test') { wall = w; boot = b; domain = d; },
        apply(...rows: Observation[]) { return store.observe(validateBatch(rows)); },
        points(prompt: string | null = 'p', now = 2000) { return plain(resolveMetrics(store.load('s'), store.history('s'), prompt, now)); },
        event(name: string, second: number, payload: Data = {}) { wall = BigInt(second * 1e9); boot = wall; return tasks.handle({ session_id: 's', prompt_id: 'p', hook_event_name: name, ...payload }); },
        preferences(live: boolean, timing = live) { fs.writeFileSync(join(root, 'claude-statusline-runtime.json'), pythonJson({ schema_version: 2, native_timing: timing, live_metrics: live })); },
    };
}
export function observation(kind = 'heartbeat', seq = 0, at = 1000, values: Data = {}): Observation {
    const { session = 's', epoch = 'e', prompt = null, agent = null, payload, source = 'native', ...identity } = values;
    const defaults: Record<string, unknown> = { heartbeat: { host_version: '2.1.289', loaded_at_ms: 1000 }, prompt: {}, permission: { mode: 'plan', live: false },
        agent_start: { started_at_ms: at }, agent_end: { ended_at_ms: at, status: 'completed' }, invalidate: { reason: 'session_resume' } };
    return { session_id: session, epoch, seq, observed_at_ms: at, source, kind, prompt_id: prompt, agent_id: agent, parent_agent_id: null,
        turn_id: null, request_id: null, payload: payload ?? defaults[kind] ?? {}, ...identity } as Observation;
}
export function writeLines(path: string, rows: unknown[], append = false): void {
    fs.mkdirSync(dirname(path), { recursive: true });
    const raw = rows.map(row => pythonJson(row, { allowNan: true }) + '\n').join('');
    if (append)
        fs.appendFileSync(path, raw);
    else
        fs.writeFileSync(path, raw);
}
export function allFiles(root: string): Record<string, string> {
    if (!fs.existsSync(root))
        return {};
    return Object.fromEntries(fs.readdirSync(root, { recursive: true }).map(String).filter(name => fs.statSync(join(root, name)).isFile()).sort().map(name => [name, fs.readFileSync(join(root, name), 'hex')]));
}
