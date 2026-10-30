import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { removeTree } from '@fbincon/statusline-platform/remove-tree';
import { reserve } from '../budget.js';
import { paidArguments, verifyPaidEvents, withRecordingAuthentication, runRecordedProcess, budgetRecording, type TimedMessage } from '../showcase-paid.js';

test('showcase recordings always use print mode with a bounded budget and no external MCP', () => {
    for (const kind of ['single', 'parallel'] as const) {
        const args = paidArguments(kind, 'session', 1);
        assert(args.includes('--print'));
        assert.equal(args[args.indexOf('--max-budget-usd') + 1], '1');
        assert.equal(args[args.indexOf('--mcp-config') + 1], '{"mcpServers":{}}');
        assert.equal(args[args.indexOf('--permission-mode') + 1], 'dontAsk');
        assert(!args.includes('--dangerously-skip-permissions'));
    }
    assert.equal(paidArguments('single', 'session', 1)[paidArguments('single', 'session', 1).indexOf('--tools') + 1], '');
    const parallel = paidArguments('parallel', 'session', 2);
    assert(parallel.includes('Bash(sleep 2)') && parallel.includes('Bash(sleep 4)'));
    assert(!parallel.some(value => value.startsWith('Bash(') && value.includes('*')));
});

test('authentication exists only inside the recording and is restored after failure', async () => {
    const root = fs.mkdtempSync(join(tmpdir(), 'showcase-auth-'));
    try {
        const file = join(root, 'settings.json'), before = Buffer.from('{"theme":"dark","statusLine":{"command":"isolated-backend"}}\n');
        fs.writeFileSync(file, before, { mode: 0o600 });
        // Installation before-images are created before authentication is introduced.
        fs.mkdirSync(join(root, 'backups')); fs.writeFileSync(join(root, 'backups/settings.json.before'), before);
        await assert.rejects(withRecordingAuthentication(root, { apiKeyHelper: 'fixture-only-helper', env: { ANTHROPIC_API_KEY: 'not-a-key' } }, async () => {
            const active = JSON.parse(fs.readFileSync(file, 'utf8'));
            assert.equal(active.apiKeyHelper, 'fixture-only-helper');
            assert.equal(active.statusLine.command, 'isolated-backend');
            throw new Error('injected recording failure');
        }), /injected recording failure/u);
        assert(fs.readFileSync(file).equals(before));
        assert(fs.readFileSync(join(root, 'backups/settings.json.before')).equals(before));
        if (process.platform !== 'win32') assert.equal(fs.statSync(file).mode & 0o777, 0o600);
    } finally { removeTree(root); }
});

function parallelEvents(): TimedMessage[] {
    const event = (elapsed_ms: number, message: any) => ({ elapsed_ms, message });
    return [
        event(0, { type: 'assistant', message: { content: ['ALPHA', 'BETA'].map((name, i) => ({ type: 'tool_use', id: 'tool-' + i, name: 'Agent',
            input: { subagent_type: 'showcase-probe', run_in_background: true, prompt: 'Run Bash sleep ' + (i ? '4' : '2') + ' then reply SHOWCASE_' + name + '_OK' } })) } }),
        ...[0, 1].map(i => event(10 + i, { type: 'system', subtype: 'task_started', tool_use_id: 'tool-' + i, task_id: 'task-' + i, run_id: 'run-' + i,
            subagent_type: 'showcase-probe', is_backgrounded: true })),
        event(12, { type: 'assistant', message: { content: ['sleep 2', 'sleep 4'].map(command => ({ type: 'tool_use', name: 'Bash', input: { command } })) } }),
        ...[0, 1].map(i => event(100 + i, { type: 'system', subtype: 'task_notification', tool_use_id: 'tool-' + i, task_id: 'task-' + i, run_id: 'run-' + i,
            status: 'completed', summary: i ? 'SHOWCASE_BETA_OK' : 'SHOWCASE_ALPHA_OK' })),
        event(120, { type: 'result', is_error: false, result: 'SHOWCASE_PARALLEL_OK', total_cost_usd: 0 }),
    ];
}

test('offline parallel verification binds approved inputs to both overlapping completions', () => {
    assert.deepEqual(verifyPaidEvents('parallel', parallelEvents()), { kind: 'parallel', requested_result_observed: true,
        agent_calls: 2, completed_agents: 2, allowed_sleep_calls: 2, concurrent: true });
    const wrongAgent = parallelEvents(); wrongAgent[0]!.message.message.content[0].input.subagent_type = 'other';
    assert.throws(() => verifyPaidEvents('parallel', wrongAgent));
    const foreground = parallelEvents(); foreground[0]!.message.message.content[0].input.run_in_background = false;
    assert.throws(() => verifyPaidEvents('parallel', foreground), /backgrounded/u);
    const missing = parallelEvents().filter(row => row.message.task_id !== 'task-1' || row.message.subtype !== 'task_notification');
    assert.throws(() => verifyPaidEvents('parallel', missing), /completion event/u);
    const failed = parallelEvents(); failed.find(row => row.message.subtype === 'task_notification')!.message.status = 'failed';
    assert.throws(() => verifyPaidEvents('parallel', failed), /did not complete/u);
    const wrongIdentity = parallelEvents(); wrongIdentity.find(row => row.message.subtype === 'task_notification')!.message.run_id = 'different';
    assert.throws(() => verifyPaidEvents('parallel', wrongIdentity));
    const forbidden = parallelEvents(); forbidden[3]!.message.message.content[0].input.command = 'sleep 20';
    assert.throws(() => verifyPaidEvents('parallel', forbidden), /Unexpected command/u);
    const sequential = parallelEvents(); sequential[2]!.elapsed_ms = 100.5;
    assert.throws(() => verifyPaidEvents('parallel', sequential), /overlap/u);
});

function ledgerFixture() {
    const root = fs.mkdtempSync(join(tmpdir(), 'showcase-recording-')), ledger = join(root, 'ledger.json');
    fs.writeFileSync(ledger, JSON.stringify({ authorized_total_usd: 10, attempts: [] }));
    return { root, ledger };
}

test('stdout log failure terminates a real local process group and reserves unknown cost', { skip: process.platform !== 'linux' }, async () => {
    const { root, ledger } = ledgerFixture(); let childPid = 0;
    try {
        const result = await budgetRecording(ledger, 'zero-fee-observer-fixture', 1, () => runRecordedProcess({
            executable: process.execPath, args: ['-e', 'console.log(JSON.stringify({type:"fixture",pid:process.pid}));setInterval(()=>{},1000)'],
            cwd: root, environment: process.env, input: '', timeoutMs: 5000,
            stdout: chunk => { childPid = JSON.parse(chunk.toString('utf8')).pid; throw new Error('injected disk write failure'); }, stderr: () => {},
        }));
        assert.equal(result.started, true); assert.equal(result.reason, 'observer_error');
        assert.equal(result.process_group_terminated, true); assert(childPid > 0);
        assert.throws(() => process.kill(-childPid, 0), (error: NodeJS.ErrnoException) => error.code === 'ESRCH');
        const recorded = JSON.parse(fs.readFileSync(ledger, 'utf8'));
        assert.equal(recorded.attempts[0].cost_known, false); assert.equal(recorded.reserved_total_usd, 1);
        assert.throws(() => reserve(ledger, 'retry', 1), /unknown-cost/u);
    } finally { removeTree(root); }
});

test('final stderr log failure cannot convert a truncated record into known cost', { skip: process.platform !== 'linux' }, async () => {
    const { root, ledger } = ledgerFixture();
    try {
        const result = await budgetRecording(ledger, 'zero-fee-final-log-fixture', 2, () => runRecordedProcess({
            executable: process.execPath, args: ['-e', 'console.log(JSON.stringify({type:"result",result:"MOCK",total_cost_usd:0}));'],
            cwd: root, environment: process.env, input: '', stdout: () => {}, stderr: () => { throw new Error('injected final write failure'); },
        }));
        assert.equal(result.reason, 'observer_error'); assert.equal(result.process_group_terminated, true);
        assert.equal(result.result.total_cost_usd, 0);
        assert.equal(JSON.parse(fs.readFileSync(ledger, 'utf8')).attempts[0].cost_known, false);
    } finally { removeTree(root); }
});

test('spawn failure is settled as zero while an interrupted observer retains its reservation', async () => {
    const { root, ledger } = ledgerFixture();
    try {
        await budgetRecording(ledger, 'no-process', 1, async () => ({ started: false, reason: 'spawn_error', exit_code: null,
            process_group_terminated: true, events: [], result: null }));
        assert.equal(JSON.parse(fs.readFileSync(ledger, 'utf8')).known_total_usd, 0);
        await assert.rejects(budgetRecording(ledger, 'unknown-process', 2, async () => { throw new Error('injected loss of observer'); }), /injected/u);
        const recorded = JSON.parse(fs.readFileSync(ledger, 'utf8'));
        assert.equal(recorded.attempts[1].cost_known, false); assert.equal(recorded.reserved_total_usd, 2);
    } finally { removeTree(root); }
});

test('recording caps reject invalid values and do not consume the entire task allowance at once', () => {
    for (const cap of [0, -1, NaN, Infinity, 2.01, 10]) assert.throws(() => paidArguments('single', 'session', cap));
});
