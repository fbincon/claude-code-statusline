import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import type { SourceContext, SourceDefinition, SourceExecutionResult, SourceJob, SourceObservation } from '@fbincon/statusline-core/contracts/ui';
import { emptyObservation } from '@fbincon/statusline-core/extensions/model';
import { removeTree } from '@fbincon/statusline-platform/remove-tree';
import { ConfigurationService } from '../src/config/service.js';
import { createStorage } from '../src/config/storage.js';
import { SourceService } from '../src/sources/service.js';
import { contextFor } from '../src/sources/context.js';
import { readAutomatic, writeAutomatic, refreshIdentity, LEASE_MS } from '../src/sources/automatic-state.js';

type Provider = (source: SourceDefinition, context: SourceContext, signal: AbortSignal) => Promise<SourceObservation>;
function fixture(t: TestContext, now = Date.now, provider?: Provider, command?: { script: string; timeout: number }) {
    const root = mkdtempSync(join(tmpdir(), 'source deadline 中文 ')), configDir = join(root, 'config');
    t.after(() => { removeTree(root); assert.equal(existsSync(root), false); });
    execFileSync('git', ['init', '--initial-branch=main', root], { stdio: 'pipe' });
    execFileSync('git', ['-C', root, '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '--allow-empty', '-m', 'fixture'], { stdio: 'pipe' });
    const storage = createStorage(), lock = storage.lock;
    let beforeLock: (() => void) | null = null;
    storage.lock = (directory, action) => {
        const pending = beforeLock; beforeLock = null; pending?.();
        return lock(directory, action);
    };
    const configuration = new ConfigurationService({ configDir, hostVersion: () => null, launch: { executable: process.execPath, args: [] } }, storage);
    const service = new SourceService(configuration, now, () => {}, provider), context = contextFor(root);
    const spec = command ? { name: 'Command', kind: 'command', scope: { project: root, session: null, agent: null }, ttl_seconds: 300,
        settings: { executable: process.execPath, args: ['-e', command.script], cwd: root, input: {}, output: 'text', timeout_ms: command.timeout } } :
        { name: 'GitHub', kind: 'github', scope: { project: root, session: null, agent: null }, ttl_seconds: 300,
            settings: { repository: 'example/project', branch: 'main', account: 'example' } };
    const change = (action: string, fields: object = {}) => service.mutate({ action, id: 'source', expected_revision: service.read().revision, ...fields });
    change('add', { source: spec }); change('enable', { review_revision: service.review('source').review_revision });
    const binding = change('bind').binding!;
    const path = (job: SourceJob) => join(service.root, 'jobs', job.id + '.json');
    const stored = (job: SourceJob) => JSON.parse(readFileSync(path(job), 'utf8')) as SourceJob;
    const start = (owner = 'manual') => service.start('source', context, owner);
    const approveAutomatic = (job: Pick<SourceJob, 'identity'>, expires = now() + LEASE_MS) => {
        change('auto-on', { review_revision: service.review('source').review_revision });
        writeAutomatic(configDir, { version: 1, schedules: [], leases: [{ id: 'a'.repeat(64), session: 'session', epoch: 'epoch', seq: 0, expires, closed: false, keys: [job.identity] }] });
    };
    return { root, configDir, service, context, binding, spec, change, start, path, stored, approveAutomatic,
        beforeLock: (callback: () => void) => { beforeLock = callback; } };
}
function observation(source: SourceDefinition, context: SourceContext, execution: SourceExecutionResult, value = 'result'): SourceObservation {
    return { ...emptyObservation(source, context, 'valid', 'valid'), observed_at: execution.finished_at, value, execution };
}

test('real command deadlines retain timeout execution and publish an error without a consumer release', { timeout: 15000 }, async t => {
    for (const timeout of [250, 1000]) {
        const f = fixture(t, Date.now, undefined, { timeout, script: 'process.stdout.write("started");setTimeout(()=>process.stdout.write("late"),5000)' });
        const job = f.start();
        await f.service.work(job.id);
        const done = f.service.job(job.id), diagnosis = f.service.diagnose('source', f.context);
        assert.equal(done.state, 'failed'); assert.equal(done.reason, 'timeout');
        assert(done.result); assert.equal(done.result.reason, 'timeout');
        assert(Number.isFinite(Date.parse(done.result.finished_at))); assert(done.result.duration_ms > 0);
        assert.notEqual(done.result.exit_code, 0); assert(!done.result.summary.includes('late'));
        assert.equal(diagnosis.view.state, 'error'); assert.equal(diagnosis.view.reason, 'timeout');
        assert.equal(diagnosis.view.value, null); assert.deepEqual(f.stored(job).result, done.result);
    }
});

test('a later command timeout keeps the last good value with failure status on the same revision', { timeout: 15000 }, async t => {
    const f = fixture(t, Date.now, undefined, { timeout: 1000, script: 'const fs=require("node:fs");if(fs.existsSync("slow")){process.stdout.write("partial");setTimeout(()=>process.stdout.write("late"),5000);}else process.stdout.write("42");' });
    const first = f.start(); await f.service.work(first.id);
    const good = f.service.inspect('source', f.context), revision = f.service.source('source').revision;
    assert.equal(f.service.job(first.id).result?.exit_code, 0);
    assert.equal(good.view.state, 'valid'); assert.equal(good.view.value, '42'); assert(good.last_success);
    writeFileSync(join(f.root, 'slow'), '');
    const next = f.start(); await f.service.work(next.id);
    const failed = f.service.inspect('source', f.context), done = f.service.job(next.id);
    assert.equal(f.service.source('source').revision, revision);
    assert.equal(failed.view.state, 'error'); assert.equal(failed.view.reason, 'timeout'); assert.equal(failed.view.value, '42');
    assert.equal(failed.last_success, good.last_success); assert.equal(failed.view.observed_at, good.view.observed_at);
    assert.equal(done.result?.reason, 'timeout'); assert.equal(done.result?.summary, 'partial');
    assert.notEqual(done.result?.exit_code, 0); assert(done.result!.duration_ms > 0);
});

test('deadline and lifecycle settlement preserve diagnostics while public expired reads stay bounded and read-only', async t => {
    let now = Date.parse('2026-10-31T00:00:00Z');
    let execution!: SourceExecutionResult, expected!: SourceExecutionResult, job!: SourceJob;
    const f = fixture(t, () => now, async (source, context, signal) => {
        // Advance to the durable deadline and let the real deadline watcher abort.
        now = Date.parse(job.deadline_at);
        await new Promise<void>(resolve => signal.addEventListener('abort', () => resolve(), { once: true }));
        execution = { finished_at: new Date(now + 50).toISOString(), duration_ms: 30050, exit_code: 137, reason: 'cancelled', summary: 'retained output' };
        expected = { ...execution, reason: 'timeout' };
        f.service.cancelInactiveAutomatic();
        assert.equal(f.stored(job).state, 'running', 'natural manual expiry cannot win the terminal write');
        f.beforeLock(() => {
            now += 2501;
            const bytes = readFileSync(f.path(job)), mode = statSync(f.path(job)).mode;
            assert.equal(f.service.job(job.id).state, 'failed'); assert.equal(f.service.job(job.id).reason, 'timeout');
            assert.deepEqual(readFileSync(f.path(job)), bytes, 'timeout projection must never rewrite the record');
            assert.equal(statSync(f.path(job)).mode, mode, 'timeout projection must preserve the record mode');
        });
        return { ...emptyObservation(source, context, 'cancelled'), execution };
    });
    job = f.start();
    await f.service.work(job.id);
    const done = f.service.job(job.id);
    assert.equal(done.state, 'failed'); assert.equal(done.reason, 'timeout'); assert.deepEqual(done.result, expected);
    assert.equal(f.service.diagnose('source', f.context).view.reason, 'timeout');
});

test('success before the deadline survives lock settlement after the public expiry projection', async t => {
    let now = Date.parse('2026-10-31T01:00:00Z'), job!: SourceJob, execution!: SourceExecutionResult;
    const f = fixture(t, () => now, async (source, context) => {
        now = Date.parse(job.deadline_at) - 1;
        execution = { finished_at: new Date(now).toISOString(), duration_ms: 29999, exit_code: 0, reason: 'completed', summary: 'before deadline' };
        f.beforeLock(() => { now += 2502; assert.equal(f.service.job(job.id).reason, 'timeout'); });
        return observation(source, context, execution, 'before deadline');
    });
    job = f.start(); await f.service.work(job.id);
    const done = f.service.job(job.id);
    assert.equal(done.state, 'completed'); assert.equal(done.reason, 'valid'); assert.deepEqual(done.result, execution);
    assert.equal(f.service.view(f.binding, f.context).value, 'before deadline');
});

test('late results and cancellation cannot replace a newer same-identity observation', async t => {
    for (const cancel of [false, true]) {
        let now = Date.parse('2026-10-31T02:00:00Z'), old!: SourceJob, first = true;
        const f = fixture(t, () => now, async (source, context) => {
            const summary = first ? 'old' : 'new';
            const execution = { finished_at: new Date(now).toISOString(), duration_ms: 10, exit_code: 0, reason: 'completed', summary };
            if (first) {
                first = false;
                now = Date.parse(old.deadline_at) + 2001;
                const replacement = f.start('replacement');
                await f.service.work(replacement.id);
                assert.equal(f.service.view(f.binding, f.context).value, 'new');
                if (cancel) assert.equal(f.service.cancel(old.id).state, 'cancelled');
            }
            return observation(source, context, execution, summary);
        });
        old = f.start(); await f.service.work(old.id);
        assert.equal(f.service.job(old.id).state, cancel ? 'cancelled' : 'completed');
        assert.equal(f.service.job(old.id).result?.summary ?? null, cancel ? null : 'old');
        assert.equal(f.service.view(f.binding, f.context).value, 'new');
    }
});

test('explicit withdrawal wins even after public timeout projection', async t => {
    for (const operation of ['release', 'cancel', 'disable', 'edit', 'auto-off', 'close'] as const) {
        let now = Date.parse('2026-10-31T03:00:00Z'), job!: SourceJob;
        const f = fixture(t, () => now, async (source, context) => {
            const result = observation(source, context, { finished_at: new Date(now).toISOString(), duration_ms: 10, exit_code: 0, reason: 'completed', summary: 'late' });
            f.beforeLock(() => {
                now = Date.parse(job.deadline_at) + 2001;
                assert.equal(f.service.job(job.id).state, 'failed');
                if (operation === 'disable') f.change('disable');
                else if (operation === 'edit') f.change('edit', { source: { ...f.spec, name: 'Edited' } });
                else if (operation === 'auto-off') f.change('auto-off');
                else if (operation === 'close') {
                    const automatic = readAutomatic(f.configDir); automatic.leases[0]!.closed = true; writeAutomatic(f.configDir, automatic);
                    f.service.cancelInactiveAutomatic();
                }
                const cancelled = operation === 'release' ? f.service.release(job.id, 'manual') : operation === 'cancel' ? f.service.cancel(job.id) : f.service.job(job.id);
                assert.equal(cancelled.state, 'cancelled');
                assert.equal(cancelled.reason, operation === 'release' || operation === 'close' ? 'no_consumers' : 'cancelled');
            });
            return result;
        });
        job = f.start();
        if (operation === 'auto-off' || operation === 'close') { f.approveAutomatic(job, now + 60000); f.service.release(job.id, 'manual'); }
        await f.service.work(job.id);
        assert.equal(f.stored(job).state, 'cancelled'); assert.equal(f.stored(job).result, null);
        assert.notEqual(f.service.view(f.binding, f.context).value, 'result');
    }
});

test('mixed manual and automatic interest settles at the deadline and explicit withdrawal remains cancellation', async t => {
    for (const action of ['expiry', 'auto-off', 'release', 'close', 'disable', 'edit'] as const) {
        let now = Date.parse('2026-10-31T04:00:00Z'), job!: SourceJob;
        const f = fixture(t, () => now, async (source, context) => {
            now = Date.parse(job.deadline_at);
            if (action === 'auto-off') f.change('auto-off');
            else if (action === 'release') f.service.release(job.id, 'manual');
            else if (action === 'close') {
                f.service.release(job.id, 'manual');
                const automatic = readAutomatic(f.configDir); automatic.leases[0]!.closed = true; writeAutomatic(f.configDir, automatic);
            }
            else if (action === 'disable') f.change('disable');
            else if (action === 'edit') f.change('edit', { source: { ...f.spec, name: 'Edited' } });
            f.service.cancelInactiveAutomatic();
            const execution = { finished_at: new Date(now).toISOString(), duration_ms: 30000, exit_code: null, reason: 'timeout', summary: 'partial' };
            return { ...emptyObservation(source, context, 'timeout'), execution };
        });
        job = f.start();
        f.approveAutomatic(job, Date.parse(job.deadline_at) + 1);
        await f.service.work(job.id);
        const done = f.service.job(job.id);
        if (['expiry', 'auto-off', 'release'].includes(action)) {
            assert.equal(done.state, 'failed', action); assert.equal(done.reason, 'timeout', action); assert.equal(done.result?.summary, 'partial');
        } else {
            assert.equal(done.state, 'cancelled', action); assert.equal(done.result, null);
            assert.notEqual(f.service.view(f.binding, f.context).reason, 'timeout', action);
        }
    }
});

test('automatic interest lost before the deadline stays cancelled even when abort cleanup finishes later', async t => {
    let now = Date.parse('2026-10-31T05:00:00Z'), job!: SourceJob;
    const f = fixture(t, () => now, async (source, context, signal) => {
        now += LEASE_MS + 1;
        await new Promise<void>(resolve => signal.addEventListener('abort', () => resolve(), { once: true }));
        now = Date.parse(job.deadline_at) + 50;
        // Renewed interest can authorize new work, but cannot revive a process
        // whose earlier lease loss already initiated cancellation.
        const automatic = readAutomatic(f.configDir); automatic.leases[0]!.expires = now + LEASE_MS; writeAutomatic(f.configDir, automatic);
        return { ...emptyObservation(source, context, 'cancelled'), execution: { finished_at: new Date(now).toISOString(), duration_ms: 30050, exit_code: null, reason: 'cancelled', summary: 'cancelled output' } };
    });
    f.approveAutomatic({ identity: refreshIdentity(f.service.source('source'), f.context) });
    job = f.service.start('source', f.context, 'automatic', 'automatic');
    await f.service.work(job.id);
    assert.equal(f.service.job(job.id).state, 'cancelled'); assert.equal(f.service.job(job.id).reason, 'lease_expired');
    assert.equal(f.service.diagnose('source', f.context).view.reason, 'not_refreshed');
});

test('a naturally expiring automatic lease retains the deadline result without extending execution', async t => {
    let now = Date.parse('2026-10-31T06:00:00Z'), job!: SourceJob;
    const f = fixture(t, () => now, async (source, context) => {
        now = Date.parse(job.deadline_at) + 50;
        f.service.cancelInactiveAutomatic();
        assert.equal(f.stored(job).state, 'running');
        return { ...emptyObservation(source, context, 'timeout'), execution: { finished_at: new Date(now).toISOString(), duration_ms: 30050, exit_code: null, reason: 'timeout', summary: 'partial' } };
    });
    f.approveAutomatic({ identity: refreshIdentity(f.service.source('source'), f.context) }, now + 30001);
    job = f.service.start('source', f.context, 'automatic', 'automatic');
    await f.service.work(job.id);
    assert.equal(f.service.job(job.id).state, 'failed'); assert.equal(f.service.job(job.id).reason, 'timeout');
    assert.equal(f.service.job(job.id).result?.summary, 'partial');
});

test('an overdue command never starts a process or invents missing execution diagnostics', async t => {
    let now = Date.parse('2026-10-31T07:00:00Z');
    const f = fixture(t, () => now, undefined, { timeout: 1000, script: 'require("node:fs").writeFileSync("unexpected", "");' });
    const job = f.start(); now = Date.parse(job.deadline_at);
    await f.service.work(job.id);
    assert.equal(existsSync(join(f.root, 'unexpected')), false);
    assert.equal(f.service.job(job.id).state, 'failed'); assert.equal(f.service.job(job.id).reason, 'timeout');
    assert.equal(f.service.job(job.id).result, null); assert.equal(f.service.diagnose('source', f.context).view.reason, 'timeout');
});
