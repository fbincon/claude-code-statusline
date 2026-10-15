import { oracle, referenceDirectory as exportReference } from '@fbincon/statusline-test-support/oracle';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { join, relative } from 'node:path';
import { tmpdir } from 'node:os';

import { repoRoot } from '../common.js';
import { canonical, decode, encode } from '@fbincon/statusline-core/json';
import { object, int, type Data } from '@fbincon/statusline-core/runtime/values';
import { runtimeContext } from '@fbincon/statusline-cli/runtime/context';
import { RuntimeProtocol } from '@fbincon/statusline-cli/runtime/live/protocol';
import { AgentDurations } from '@fbincon/statusline-cli/runtime/live/durations';
import { TaskService } from '@fbincon/statusline-cli/runtime/tasks/service';
test('runtime action traces match frozen Python task, live and duration state including numeric JSON kinds', { skip: process.platform !== 'linux' }, t => {
    const reference = exportReference(), root = fs.mkdtempSync(join(tmpdir(), 'ts03-runtime-parity-'));
    t.after(() => { fs.rmSync(reference, { recursive: true, force: true }); fs.rmSync(root, { recursive: true, force: true }); });
    const actions: Data[] = [], names = ['p', '__proto__', 'constructor', 'toString', '中文', '😀', '0', '02'];
    for (let index = 0; index < 24; index++) {
        const session = names[index % names.length]! + '-' + index, prompt = names[index % names.length]!, agent = names[(index + 1) % names.length]!, epoch = 'e';
        let seq = 0;
        const action = (kind: string, wall: bigint, payload: unknown) => actions.push({ kind, wall, session, payload });
        const hook = (name: string, second: number, extra = {}) => action('hook', BigInt(second) * 1000000000n, { session_id: session, prompt_id: prompt, hook_event_name: name, ...extra });
        const observe = (kind: string, at: number, payload: Data, identity = {}) => {
            const row = { session_id: session, epoch, seq: seq++, observed_at_ms: at, source: 'native', kind, prompt_id: prompt, turn_id: null, agent_id: null, parent_agent_id: null, request_id: null, payload, ...identity };
            action('protocol', BigInt(at) * 1000000n, { protocol_version: 2, operation: 'observe', payload: { observations: [row] } });
            return row;
        };
        const read = (at: number) => action('protocol', BigInt(at) * 1000000n, { protocol_version: 2, operation: 'read', payload: { session_id: session, prompt_id: prompt } });
        hook('UserPromptSubmit', 1);
        observe('heartbeat', 1000, { host_version: '2.1.294', loaded_at_ms: 1000 }, { prompt_id: null });
        observe('prompt', 1010, {}, { source: 'classic_hook' });
        observe('turn_start', 1100, {}, { turn_id: 't' });
        const usage = { input_tokens: index, output_tokens: 0, cache_read_input_tokens: 5, cache_creation_input_tokens: 7 };
        observe('request_start', 1200, {}, { turn_id: 't', request_id: 'r' });
        observe('request_first', 1300, {}, { turn_id: 't', request_id: 'r' });
        if (index % 3 === 0) {
            observe('wait_start', 1400, {}, { turn_id: 't', request_id: 'question' });
            observe('wait_start', 1500, {}, { turn_id: 't', request_id: 'approval' });
            observe('wait_end', 1600, {}, { turn_id: 't', request_id: 'question' });
            observe('wait_end', 1700, {}, { turn_id: 't', request_id: 'approval' });
        }
        if (index % 3 === 1) {
            hook('SubagentStart', 2, { agent_id: agent });
            observe('agent_start', 2000, { started_at_ms: 2000 }, { agent_id: agent, turn_id: 't' });
            observe('turn_start', 2100, {}, { agent_id: agent, turn_id: 'child' });
            observe('turn_end', 2600, { status: 'completed', duration_ms: 500, wait_coverage: true }, { agent_id: agent, turn_id: 'child' });
            hook('SubagentStop', 3, { agent_id: agent });
            observe('agent_end', 3000, { ended_at_ms: 3000, status: 'completed' }, { agent_id: agent });
        }
        const end = observe('request_end', 3500, { native: true, usage, status: 'completed' }, { turn_id: 't', request_id: 'r' });
        action('protocol', 3600000000n, { protocol_version: 2, operation: 'observe', payload: { observations: [end] } });
        observe('turn_usage', 3600, { usage }, { turn_id: 't' });
        observe('task_snapshot', 3700, { provider: 'tasks', tasks: [{ id: agent, status: 'completed' }] }, { turn_id: 't' });
        observe('tool_end', 3800, { name: 'Read', status: 'success' }, { request_id: '__proto__', turn_id: 't' });
        read(3900);
        hook(index % 4 === 0 ? 'StopFailure' : 'Stop', 4, index % 4 === 0 ? { error: 'failure' } : {});
        observe('turn_end', 4100, { status: index % 4 === 0 ? 'failed' : 'completed', duration_ms: 3000, wait_coverage: index % 5 !== 0 }, { turn_id: 't' });
        observe('request_cost', 4200, { cost_usd: index % 2 === 0 ? decode('0.0') : decode('0.0123'), usage }, { request_id: 'cost', source: 'otel' });
        read(4300);
        read(50000);
    }
    const pyRoot = join(root, 'python'), tsRoot = join(root, 'typescript');
    const expected = decode(oracle(['-B', join(repoRoot, 'tools/migration/ts-03/test/runtime-oracle.py')], { input: encode(actions), encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
        env: { ...process.env, PYTHONPATH: join(reference, 'src'), PYTHONDONTWRITEBYTECODE: '1', PYTHONHASHSEED: '0', CLAUDE_CONFIG_DIR: pyRoot, CLAUDE_STATUSLINE_RUNTIME_DIR: join(pyRoot, 'runtime') } })) as Data;
    fs.mkdirSync(tsRoot);
    fs.writeFileSync(join(tsRoot, 'claude-statusline-runtime.json'), '{"schema_version":2,"native_timing":true,"live_metrics":true}');
    let wall = 0n;
    const context = { ...runtimeContext(tsRoot, {}), runtimeRoot: join(tsRoot, 'runtime'), sample: () => ({ wall_ns: wall, boot_ns: wall, boot_id: 'test' }), nowMs: () => Number(wall) / 1e9 * 1000 };
    const protocol = new RuntimeProtocol(context), tasks = new TaskService(context), durations = new AgentDurations(context), results: unknown[] = [];
    for (const action of actions) {
        wall = int(action.wall)!;
        let value: unknown;
        if (action.kind === 'hook') {
            value = tasks.handle(action.payload);
            durations.observe(action.payload);
        }
        else if (action.kind === 'transcript')
            value = tasks.transcript(action.session, action.payload);
        else
            value = protocol.dispatch(action.payload);
        results.push(decode(encode(value)));
        assert.equal(canonical(results.at(-1)), canonical((expected.results as unknown[])[results.length - 1]), `action ${results.length - 1}: ${encode(action)}`);
    }
    const files: Data = {};
    for (const path of fs.readdirSync(tsRoot, { recursive: true }).map(String).sort())
        if (fs.statSync(join(tsRoot, path)).isFile()) {
            const raw = fs.readFileSync(join(tsRoot, path), 'utf8');
            files[path.split('\\').join('/')] = raw ? decode(raw) : raw;
        }
    assert.equal(canonical(files), canonical(expected.files));
});
