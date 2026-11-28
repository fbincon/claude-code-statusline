import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import type { PackageControl, PackageExecution, PackageReviewJob, TaskDetails } from '@fbincon/statusline-core/contracts/ui';
import { packageManager } from '@fbincon/statusline-core/editor/package-manager';
import { packageNotice, packageView } from '@fbincon/statusline-core/editor/package-view';
import { receiveTask, taskViewer } from '@fbincon/statusline-core/editor/task-viewer';
import { t, text } from '@fbincon/statusline-core/i18n/messages';
import { ForegroundRefresh, type RefreshReason, type RefreshTarget } from '../src/foreground-refresh.js';
import { externalTaskRows, taskRefresh, packageRefresh, packageRefreshError, packageRefreshInterval } from '../src/report-refresh.js';
import type { Backend } from '../src/session.js';

function report(status: string | null = 'running', captured = 0): TaskDetails {
    return {
        version: 1, session_id: 'session', prompt_id: 'canonical', captured_at: new Date(captured).toISOString(),
        status, phase: 'main', elapsed_seconds: 2, active_seconds: null, progress: { completed: 1, total: 3 },
        agents: [{ id: 'agent', name: 'Worker', parent_id: null, status: 'running', evidence: [] }],
        evidence: [], limitations: [],
    };
}

function reader(observe: (op: string, payload: unknown, signal: AbortSignal, control?: PackageControl) => unknown): Backend {
    return { observe, request() { throw new Error('Unexpected foreground operation'); } } as Backend;
}

async function update(target: RefreshTarget | null, reason: RefreshReason = 'automatic') {
    assert(target);
    try { return (await target.read(new AbortController().signal, reason))(); }
    catch (error) { return target.failed(error); }
}

test('the same fixed task can complete, idle for ten seconds and resume without a key', async () => {
    const view = taskViewer('session', 'alias');
    let now = 0, observed: string | null = 'running';
    const reads: string[] = [];
    const backend = reader((op, payload) => {
        reads.push(op);
        if (op === 'read_ui_preferences') return { ui_language: 'zh-CN', warning: null };
        assert.deepEqual(payload, { session_id: 'session', prompt_id: 'alias' });
        return report(observed, now);
    });
    const refresh = new ForegroundRefresh(() => taskRefresh(view, backend), () => now);
    const writers: boolean[] = [];
    refresh.bind(apply => writers.push(apply()));
    async function tick(time: number) { now = time; refresh.tick(); await setImmediate(); }
    try {
        await tick(0);
        assert.equal(view.language, 'zh-CN');
        assert.equal(view.report?.prompt_id, 'canonical');
        await tick(1999);
        assert.equal(reads.length, 2);
        observed = 'completed';
        await tick(2000);
        assert.equal(view.report?.status, 'completed');
        observed = 'main wrap-up';
        await tick(11999);
        assert.equal(reads.length, 3);
        await tick(12000);
        assert.equal(view.report?.status, 'main wrap-up');
        await tick(14000);
        assert.deepEqual(writers, [true, true, true, false]);
        assert.equal(view.report?.captured_at, new Date(14000).toISOString());
        assert.equal(reads.filter(op => op === 'read_ui_preferences').length, 1);
        refresh.immediate(); await setImmediate();
        assert.equal(reads.filter(op => op === 'read_ui_preferences').length, 2);
    } finally { refresh.close(); }
});

test('task observation compares the visible pane and retains the selected row, filters and latest read time', async () => {
    const view = taskViewer('session'), first = report('completed');
    receiveTask(view, first);
    view.query = 'worker';
    view.collapsed = ['agent'];
    externalTaskRows(view, 80, 8);
    const selection = view.selected, scroll = view.scroll;
    let next = { ...report('completed', 10000), agents: [{ ...first.agents[0]!, status: 'completed' }] };
    const backend = reader(() => next);
    assert.equal(await update(taskRefresh(view, backend)), false, 'an agent outside the viewport caused a repaint');
    assert.equal(view.report?.agents[0]?.status, 'completed');
    assert.equal(view.report?.captured_at, next.captured_at);
    assert.equal(view.selected, selection);
    assert.equal(view.scroll, scroll);
    assert.equal(view.query, 'worker');
    assert.deepEqual(view.collapsed, ['agent']);
    next = { ...next, elapsed_seconds: 5 };
    assert.equal(await update(taskRefresh(view, backend)), true);
    view.input = 'search';
    assert.equal(taskRefresh(view, backend), null);
    view.input = null;
    const apply = await taskRefresh(view, backend)!.read(new AbortController().signal, 'automatic');
    view.generation++; view.session = 'replacement'; view.report = null;
    assert.equal(apply(), false);
    assert.equal(view.report, null);
});

test('failed task reads retain the report, localize through the selected language and recover without resetting the view', async () => {
    const view = taskViewer('session', null, 'en'), original = report('completed');
    receiveTask(view, original);
    let fail = true;
    const backend = reader(op => {
        if (op === 'read_ui_preferences') throw new Error('private preferences path');
        if (fail) throw new Error('private task path');
        return { ...original, captured_at: new Date(20000).toISOString() };
    });
    const target = () => taskRefresh(view, backend, 'ja');
    assert.equal(await update(target(), 'manual'), true);
    assert.equal(view.language, 'ja');
    assert.equal(view.warning?.key, 'task.language_unavailable');
    assert.equal(view.report, original);
    assert.equal(typeof view.error === 'object' && view.error?.key, 'task.viewer.read_failed');
    assert.equal(await update(target()), false, 'identical read failures should not keep writing the screen');
    assert(!JSON.stringify(view.error).includes('private task path'));
    fail = false;
    assert.equal(await update(target()), true);
    assert.equal(view.error, null);
    assert.equal(view.report?.status, 'completed');
});

test('clock-only snapshots reuse the wrapped rows of a large agent tree and its evidence', async () => {
    const view = taskViewer('session'), first = report();
    first.agents = Array.from({ length: 256 }, (_, index) => ({
        id: 'agent-' + index, parent_id: null, status: 'running', name: '代理👩‍💻é'.repeat(40),
        evidence: [{ source: 'live_store', scope: String(index), status: 'observed', observed_at: null, freshness: 'current' }],
    }));
    first.evidence = [{ source: 'task_store', scope: 'task', status: 'observed', observed_at: null, freshness: 'current' }];
    view.evidence = true;
    receiveTask(view, first);
    externalTaskRows(view, 64, 18);
    view.selected = view.rows.at(-1)!.key;
    externalTaskRows(view, 64, 18);
    const details = () => view.rows.filter(row => row.agent || row.key.includes('evidence:'));
    const before = details();
    assert(before.length > 512);
    const next = structuredClone(first);
    next.captured_at = new Date(2000).toISOString();
    next.elapsed_seconds = 4;
    const backend = reader(() => next);
    assert.equal(await update(taskRefresh(view, backend)), false);
    assert(details().every((row, index) => row === before[index]), 'stable agent/evidence rows were laid out again');
    const changed = structuredClone(next);
    changed.agents.at(-1)!.name = 'An updated agent';
    assert.equal(await update(taskRefresh(view, reader(() => changed))), true);
    assert(view.rows.some(row => row.text.includes('An updated agent')));
});

function review(owner: string): PackageReviewJob {
    return {
        version: 1, id: 'review-00000000-0000-0000-0000-000000000001', owner, state: 'running',
        started_at: new Date(0).toISOString(), finished_at: null, review: null, error: null,
        request: { action: 'check', prefix: '/prefix', expected_revision: '0'.repeat(64),
            channel: 'latest', target: null, backup_id: null, expected_integrity: null },
    };
}

function execution(): PackageExecution {
    return {
        version: 1, id: 'execution-00000000-0000-0000-0000-000000000001', transaction_id: null,
        action: 'update', prefix: '/prefix', started_at: 'start', updated_at: 'stamp', finished_at: null, running: true,
        state: 'running', stage: 'queued', error: null, results: { package: false, integration: false, configuration: null },
        control: { executable: '/node', args: ['/private/runner/entry'], config_dir: '/config' },
    };
}

test('package review observes only its owned job without moving the selection or erasing its notices', async () => {
    const view = packageManager(), initial = review(view.owner);
    view.effect = null; view.job = initial; view.selected = 'prefix'; view.scroll = 2;
    const notice = view.message = text('package.ui.exported');
    let next = initial;
    const backend = reader((op, payload, _signal, control) => {
        assert.equal(op, 'package_review_status'); assert.equal(control, undefined);
        assert.deepEqual(payload, { id: initial.id, owner: view.owner });
        return next;
    });
    assert.equal(await update(packageRefresh(view, backend)), false);
    next = { ...initial, owner: 'different-viewer' };
    assert.equal(await update(packageRefresh(view, backend)), true);
    assert.equal(packageRefreshError(view)?.key, 'package.reason_identity');
    assert.equal(view.message, notice);
    next = { ...initial, state: 'failed', error: 'conflict' };
    assert.equal(await update(packageRefresh(view, backend)), true);
    assert.equal(packageRefreshError(view), null);
    assert.equal(view.job, next);
    assert.equal(view.selected, 'prefix');
    assert.equal(view.scroll, 2);
    assert.equal(view.message, notice);
    assert.equal(packageRefreshInterval(view), null);
    view.mode = 'review'; view.job = initial;
    assert.equal(packageRefreshInterval(view), 2000);
    view.mode = 'channel';
    assert.equal(packageRefresh(view, backend), null);
    view.mode = 'execute-confirm';
    assert.equal(packageRefresh(view, backend), null);
});

test('execution observation retains its control identity and distinguishes unknown liveness from confirmed exit', async () => {
    const view = packageManager(), initial = execution();
    view.execution = initial;
    let next = initial;
    const backend = reader((op, payload, _signal, control) => {
        assert.equal(op, 'package_execute_status'); assert.deepEqual(payload, { id: initial.id });
        assert.deepEqual(control, initial.control); return next;
    });
    next = { ...initial, control: { ...initial.control, executable: '/replacement' } };
    await update(packageRefresh(view, backend));
    assert.equal(view.execution, initial);
    assert.equal(packageRefreshError(view)?.key, 'package.reason_identity');
    next = { ...initial, state: 'interrupted', running: null };
    assert.equal(await update(packageRefresh(view, backend)), true);
    assert.equal(view.execution.running, null);
    assert.equal(packageRefreshInterval(view), 10000);
    next = { ...initial, state: 'complete', running: false, results: { package: true, integration: true, configuration: null } };
    assert.equal(await update(packageRefresh(view, backend)), true);
    assert.equal(packageRefreshInterval(view), null);
    const late = await packageRefresh(view, backend)!.read(new AbortController().signal, 'manual');
    view.closed = true;
    assert.equal(late(), false);
});

test('the externally observed review retains its cancellation notice until the final state arrives', async () => {
    const view = packageManager(), initial = review(view.owner);
    view.job = initial; view.message = text('package.ui.cancel_requested', { key: 'R' });
    let next = initial;
    const backend = reader(() => next);
    assert.equal(packageNotice(view, 'en', undefined, true), t('ui.refresh.cancel_requested', 'en'));
    const native = packageNotice(view, 'en');
    assert(typeof native !== 'string' && native.text.includes('R checks whether') && native.keys?.length === 1);
    assert.equal(await update(packageRefresh(view, backend)), false);
    next = { ...initial, state: 'cancelled', finished_at: new Date(1000).toISOString() };
    assert.equal(await update(packageRefresh(view, backend)), true);
    assert.equal(view.message.key, 'package.cancelled');
    view.mode = 'review';
    view.selected = 'job';
    view.part = 9;
    packageView(view, 'en', 120, 40, undefined, true);
    assert.equal(view.selected, 'job', 'an updated or resized logical row keeps focus when its wrapping changes');
    assert.equal(view.part, 0);
});
