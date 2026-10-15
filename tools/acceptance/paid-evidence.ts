import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { encode, integer } from '@fbincon/statusline-core/json';
// Node's source lexeme preserves nanoseconds in old Python and new Node records.
const parseWithSource = JSON.parse as (text: string, reviver: (key: string, value: any, context: {
    source?: string;
}) => any) => any;
export const parse = (text: string): any => parseWithSource(text, (_key, value, context) => typeof value === 'number' && Number.isInteger(value) && !Number.isSafeInteger(value)
    ? BigInt(context.source!) : value);
export const read = (path: string): any => parse(fs.readFileSync(path, 'utf8'));
export function rows(path: string): any[] {
    if (!fs.existsSync(path))
        return [];
    return fs.readFileSync(path, 'utf8').split('\n').filter(Boolean).flatMap(line => {
        try {
            const row = parse(line);
            return row && typeof row === 'object' ? [row] : [];
        }
        catch {
            return [];
        } // A killed host may leave one incomplete final record.
    });
}
export const digest = (text: string) => createHash('sha256').update(text).digest('hex');
export const CASES = ['single', 'single-agent', 'parallel', 'stop-continue', 'wait', 'interrupt', 'compat'] as const;
export type Case = typeof CASES[number];
export type Backend = (args: string[], input?: unknown) => string;
export function backend(entry: string, config: string, env: NodeJS.ProcessEnv = process.env): Backend {
    return (args, input) => execFileSync(process.execPath, [entry, ...args], {
        env: { ...env, CLAUDE_CONFIG_DIR: config, CLAUDE_STATUSLINE_RUNTIME_DIR: join(config, 'statusline_runtime') },
        encoding: 'utf8', input: input === undefined ? '' : encode(input), timeout: 180000, maxBuffer: 8 * 1024 * 1024,
    });
}
export function assessTask(caseName: Case, hooks: any[], current: any, active: any, waits: any[], displays: string[], durations: unknown[]) {
    const expected = caseName === 'interrupt' ? 'interrupted' : 'completed';
    assert.equal(current.status, expected);
    assert.equal(displays.length, 2);
    assert.equal(displays[0], displays[1], 'Ending renderer must stay frozen');
    assert.equal(integer(durations[0]), integer(durations[1]), 'Ending duration must stay frozen');
    assert.equal(integer(current.duration_ns), integer(durations[0]));
    const stops = hooks.filter(row => row.event.hook_event_name === 'Stop');
    if (caseName !== 'interrupt')
        assert(stops.length, 'A real main Stop is required');
    if (['compat', 'wait'].includes(caseName))
        assert.equal(active.value, null);
    if (caseName === 'wait') {
        assert(waits.some(row => row.wait_seconds >= 2), 'No controlled SDK question wait');
        assert(['wait_coverage_missing', 'incomplete', 'abnormal_clock'].includes(active.reason));
    }
    if (caseName === 'compat') {
        assert.equal(active.reason, 'native_timing_disabled');
        assert.equal(Object.keys(current.native_turns).length, 0, 'Opt-out collected native timing');
    }
    if (caseName === 'stop-continue') {
        assert(stops.length >= 2, 'Blocked Stop did not continue');
        assert.equal(stops[0].state.phase, 'stop_pending');
        assert(integer(current.started_wall_ns) <= integer(stops[0].state.started_wall_ns));
        assert(integer(current.ended_wall_ns) > integer(stops[0].received_wall_ns));
        assert(integer(current.duration_ns) > integer(stops[0].state.stop_candidate.duration_ns));
    }
    const starts = hooks.filter(row => row.event.hook_event_name === 'SubagentStart');
    const ends = hooks.filter(row => row.event.hook_event_name === 'SubagentStop');
    if (['single-agent', 'parallel'].includes(caseName)) {
        const minimum = caseName === 'parallel' ? 2 : 1;
        assert(new Set(starts.map(row => row.event.agent_id)).size >= minimum);
        assert(ends.length >= minimum && Object.keys(current.active_agents).length === 0);
        if (caseName === 'parallel')
            assert(current.had_subagents && current.duration_source === 'task');
    }
    return { passed: true, case: caseName, status: expected, task_duration_ns: current.duration_ns,
        active_timer: active, frozen_renderer: displays[0], agent_starts: starts.length, agent_stops: ends.length,
        waiting_observed: hooks.some(row => row.state?.phase === 'waiting_subagents'),
        wrap_up_observed: hooks.some(row => row.state?.phase === 'resuming_main'),
        manual_interaction_acceptance: false, real_machine_suspend_acceptance: false };
}
export async function verifyTask(root: string, run: Backend, caseName: Case, config: string) {
    const hooks = rows(join(root, 'hooks.jsonl'));
    const submit = hooks.find(row => row.event.hook_event_name === 'UserPromptSubmit' && !row.event.agent_id);
    assert(submit, 'Missing prompt hook');
    const { session_id, prompt_id, transcript_path } = submit.event;
    const state = () => read(join(config, 'statusline_runtime/turns', digest(session_id) + '.json')).lifecycle.turns.find((row: any) => row.prompt_id === prompt_id);
    const displays: string[] = [], durations: unknown[] = [];
    for (let i = 0; i < 2; i++) {
        const plain = run(['render'], { session_id, prompt_id, transcript_path, model: { id: 'task-timer-probe' }, columns: 120 }).replace(/\x1b\[[0-9;:]*m/gu, '');
        const marker = caseName === 'interrupt' ? '■' : '✓';
        const match = plain.match(new RegExp(marker + '\\s+(?:\\d+h\\s+)?\\d+m\\s+\\d+s', 'u'));
        assert(match, 'Production renderer has no completed/interrupted timer');
        if (['compat', 'wait'].includes(caseName))
            assert(!plain.includes('Active '));
        displays.push(match[0]);
        durations.push(state().duration_ns);
        if (!i)
            await delay(1000);
    }
    const result = parse(run(['runtime'], { protocol_version: 2, operation: 'read', payload: { session_id, prompt_id } })).result;
    return assessTask(caseName, hooks, state(), result.metrics['task-active-timer'], rows(join(root, 'controlled-input.jsonl')), displays, durations);
}
export function assessMetrics(result: any, prompt: string, minimum: number) {
    assert(prompt, 'A captured prompt must be bound');
    const { metrics, state } = result;
    for (const name of ['ttft', 'output-rate', 'prompt-input-tokens', 'prompt-output-tokens'])
        assert.notEqual(metrics[name].value, null, name + ' unavailable');
    const requests: any[] = Object.values(state.requests).filter((row: any) => row.prompt_id === prompt && row.native && row.usage !== null && !row.conflict);
    const sum = (names: string[]) => requests.reduce((total, row) => total + names.reduce((n, name) => n + integer(row.usage[name]), 0n), 0n);
    assert.equal(integer(metrics['prompt-input-tokens'].value), sum(['input_tokens', 'cache_read_input_tokens', 'cache_creation_input_tokens']));
    assert.equal(integer(metrics['prompt-output-tokens'].value), sum(['output_tokens']));
    const agents = Object.fromEntries(Object.entries(state.agents).filter(([, row]: any) => row.prompt_id === prompt));
    assert(Object.keys(agents).length >= minimum, 'Insufficient real agents');
    assert(Object.values(agents).every((row: any) => row.ended_at_ms !== null), 'An agent has not ended');
    return { requests: requests.length, agents };
}
export async function verifyMetrics(config: string, run: Backend, caseName: Case) {
    const directory = join(config, 'statusline_runtime/live');
    const stores = fs.readdirSync(directory).filter(name => name.endsWith('.json')).map(name => read(join(directory, name))).sort((a, b) => Number(b.loaded_at_ms) - Number(a.loaded_at_ms));
    assert(stores.length, 'No captured runtime state');
    const session_id = stores[0].session_id;
    const current = () => parse(run(['runtime'], { protocol_version: 2, operation: 'read', payload: { session_id, prompt_id: null } })).result;
    const first = current(), prompt = first.state.active_prompt_id || first.state.current_prompt_id;
    const { requests, agents } = assessMetrics(first, prompt, caseName === 'parallel' ? 2 : caseName === 'single-agent' ? 1 : 0);
    if (Object.keys(agents).length) {
        const payload = { session_id, columns: 120, tasks: Object.entries(agents).map(([id, row]: any) => ({ id, status: 'completed', name: 'probe', startTime: row.started_at_ms })) };
        const output = run(['render-subagents'], payload);
        await delay(1000);
        assert.equal(run(['render-subagents'], payload), output, 'Completed agent durations changed');
    }
    assert.deepEqual(current().metrics, first.metrics, 'Historical metrics changed');
    return { passed: true, session_id, prompt_id: prompt, metrics: first.metrics, requests, agents: Object.keys(agents).length,
        agent_duration_frozen: Boolean(Object.keys(agents).length), manual_visual_acceptance: false };
}
