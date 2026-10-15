import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { assessTask, assessMetrics, parse } from '../paid-evidence.js';
import { executePaid, type PaidOptions, type Query } from '../paid.js';
test('paid acceptance requires opt-in and an existing shared ledger before loading provider settings', async () => {
    const root = fs.mkdtempSync(join(tmpdir(), 'ts05-budget-'));
    try {
        const ledger = join(root, 'ledger.json');
        fs.writeFileSync(ledger, '{"authorized_total_usd":10,"attempts":[]}');
        const options: PaidOptions = { root: join(root, 'new'), ledger, real: false, cap: 1, case: 'single', suite: 'task', entry: '/installed/entry.js', claude: '/pinned/claude' };
        let prepared = 0, called = 0, closed = 0;
        const dependencies = {
            prepare: () => { prepared++; fs.mkdirSync(options.root); return { config: root, project: root, env: {}, run: () => '' }; },
            query: (() => { called++; return { async *[Symbol.asyncIterator]() { yield { type: 'result', total_cost_usd: .25, is_error: false }; }, interrupt: async () => { }, close: () => { closed++; } }; }) as Query,
            verify: async () => ({ passed: true }),
        };
        await assert.rejects(executePaid(options, dependencies), /explicit/);
        assert.equal(prepared, 0);
        assert.equal(called, 0);
        const report = await executePaid({ ...options, real: true }, dependencies);
        assert.equal(report.passed, true);
        assert.equal(report.cost_usd, .25);
        assert.equal(closed, 1);
        assert.equal(JSON.parse(fs.readFileSync(ledger, 'utf8')).known_total_usd, .25);
        await assert.rejects(executePaid({ ...options, real: true }, dependencies), /new private/);
        assert.equal(called, 1);
    }
    finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});
test('failed paid streams preserve unknown reservations and block later calls', async () => {
    const root = fs.mkdtempSync(join(tmpdir(), 'ts05-unknown-cost-'));
    try {
        const ledger = join(root, 'ledger.json');
        fs.writeFileSync(ledger, '{"authorized_total_usd":10,"attempts":[]}');
        const options: PaidOptions = { root: join(root, 'first'), ledger, real: true, cap: 2, case: 'single', suite: 'task', entry: '/installed/entry.js', claude: '/pinned/claude' };
        let closed = false;
        const dependencies = {
            prepare: () => { fs.mkdirSync(options.root); return { config: root, project: root, env: {}, run: () => '' }; },
            query: (() => ({ async *[Symbol.asyncIterator]() { throw new Error('lost transport'); }, interrupt: async () => { }, close: () => { closed = true; } })) as Query,
            verify: async () => ({ passed: true }),
        };
        const report = await executePaid(options, dependencies);
        assert.equal(report.passed, false);
        assert.equal(report.accounted_total_usd, 2);
        assert(closed);
        await assert.rejects(executePaid({ ...options, root: join(root, 'second') }, dependencies), /unknown-cost/);
    }
    finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});
test('captured task evidence rejects incomplete wait, continuation, agents and opt-out collection', () => {
    const state = { status: 'completed', duration_ns: 9007199254740993n, native_turns: {}, active_agents: {}, had_subagents: true, duration_source: 'task' };
    const hooks = [{ event: { hook_event_name: 'Stop' } }];
    const check = (name: any, current: any = state, active: any = { value: null, reason: 'native_timing_disabled' }, waits: any[] = []) => assessTask(name, hooks, current, active, waits, ['✓ 0m 2s', '✓ 0m 2s'], [state.duration_ns, state.duration_ns]);
    assert.equal(check('compat').passed, true);
    assert.throws(() => check('compat', { ...state, native_turns: { one: {} } }));
    assert.throws(() => check('wait'));
    assert.equal(check('wait', state, { value: null, reason: 'incomplete' }, [{ wait_seconds: 2 }]).passed, true);
    assert.throws(() => check('stop-continue'));
    assert.throws(() => check('parallel'));
    assert.throws(() => check('single', { ...state, duration_ns: 1n }));
    assert.equal(parse('{"duration_ns":9007199254740993}').duration_ns, 9007199254740993n);
});
test('captured live metrics require exact native usage totals and completed agents', () => {
    const result = { metrics: { ttft: { value: 1 }, 'output-rate': { value: 2 }, 'prompt-input-tokens': { value: 6 }, 'prompt-output-tokens': { value: 4 } }, state: {
            requests: { one: { prompt_id: 'p', native: true, conflict: false, usage: { input_tokens: 1, cache_read_input_tokens: 2, cache_creation_input_tokens: 3, output_tokens: 4 } } }, agents: { a: { prompt_id: 'p', ended_at_ms: 10 } },
        } };
    assert.equal(assessMetrics(result, 'p', 1).requests, 1);
    assert.throws(() => assessMetrics(result, 'p', 2));
    result.metrics['prompt-input-tokens'].value = 5;
    assert.throws(() => assessMetrics(result, 'p', 1));
});
