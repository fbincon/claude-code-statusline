import test from 'node:test';
import assert from 'node:assert/strict';
import { packageManager, packageView, packageKey, performPackage, closePackage, type PackageBackend } from '../src/editor/package-manager.js';
import { isPackageRequest, isPackageResult } from '../src/editor/package-validation.js';
import type { PackageStatus, PackageReviewJob, PackageReviewRequest } from '../src/contracts/ui.js';
import { LANGUAGES } from '../src/i18n/messages.js';
const status: PackageStatus = { version: 1, backend_version: 'test', captured_at: '2026-10-28T00:00:00Z', revision: 'a'.repeat(64), prefix: '/prefix', entry: '/prefix/entry', config_dir: '/config', current: '3.10.0', previous: '3.9.2', channel: 'latest', node_version: '24.21.0', host: '2.1.310', compatible: true, reasons: [], pending: null, history: [], offset: 0, total: 0 };
const request: PackageReviewRequest = { action: 'check', prefix: '/prefix', expected_revision: status.revision, target: null, channel: 'latest', backup_id: null, expected_integrity: null };
function job(owner: string): PackageReviewJob { return { version: 1, id: 'review-00000000-0000-0000-0000-000000000000', owner, state: 'running', started_at: status.captured_at, finished_at: null, request, review: null, error: null }; }
test('opening a version page only inspects local state; metadata binds the next verified review to exact bytes', async () => {
    const view = packageManager(), calls: {
        operation: string;
        payload: any;
    }[] = [];
    const backend = { request(operation: string, payload: any) { calls.push({ operation, payload }); return operation === 'package_status' ? status : job(view.owner); } } as PackageBackend;
    await performPackage(view, backend);
    assert.deepEqual(calls.map(x => x.operation), ['package_status']);
    view.job = { ...job(view.owner), state: 'complete', review: { action: 'check', current: '3.10.0', target: '3.11.0', prefix: '/prefix', entry: '/prefix/entry', config_dir: '/config', channel: 'latest', registry: 'https://registry.npmjs.org/', integrity: 'sha512-' + Buffer.alloc(64).toString('base64'), node_engine: '>=22', host: '2.1.310', artifact_verified: false, compatible: true, reasons: [], configuration_conflicts: [], backup_id: null, files: [] } };
    view.action = 'update';
    view.effect = 'start';
    await performPackage(view, backend);
    const submitted = calls.find(x => x.operation === 'package_review_start')!.payload.request;
    assert.equal(submitted.target, '3.11.0');
    assert.equal(submitted.channel, null);
    assert(submitted.expected_integrity);
    assert(isPackageRequest(submitted));
    assert(!calls.some(x => ['apply', 'sources_apply', 'set_ui_language'].includes(x.operation)));
});
test('closing during a slow start cancels its late job without reviving the view', async () => {
    const view = packageManager();
    view.status = status;
    view.effect = 'start';
    let finish!: (value: PackageReviewJob) => void;
    const cancelled: string[] = [];
    const backend = { request(operation: string, payload: any) {
            if (operation === 'package_review_start')
                return new Promise<PackageReviewJob>(resolve => { finish = resolve; });
            cancelled.push(payload.id);
            return job(view.owner);
        } } as PackageBackend;
    const pending = performPackage(view, backend);
    await closePackage(view, backend);
    finish(job(view.owner));
    await pending;
    assert.equal(view.job, null);
    assert.equal(cancelled.length, 1);
    assert.equal(view.closed, true);
});
test('package response validation rejects incomplete and mismatched shapes', () => {
    assert(isPackageResult('package_status', status));
    assert(!isPackageResult('package_status', { ...status, revision: 'bad' }));
    assert(!isPackageRequest({ ...request, target: '3.11.0' }));
    assert(!isPackageRequest({ ...request, action: 'restore-config' }));
    assert(!isPackageResult('package_review_status', { ...job('owner'), state: 'installed' }));
});
for (const language of LANGUAGES)
    test(`version status, actions, errors and progress are localized and bounded in ${language}`, () => {
        const view = packageManager();
        view.status = status;
        view.job = { ...job(view.owner), state: 'failed', error: 'integrity' };
        for (const [width, height] of [[32, 8], [80, 24], [200, 100]]) {
            const rows = packageView(view, language, width!, height!);
            assert(rows.length <= height!);
            assert(!rows.some(row => row.text.includes('package.ui.')));
        }
        packageKey(view, { key: 'end' });
        assert(packageView(view, language, 80, 12).some(row => row.key === 'job-error'));
    });
test('local reload invalidates a prior verified result when its configuration revision changes', async () => {
    const view = packageManager();
    view.status = status;
    view.job = { ...job(view.owner), state: 'complete' };
    view.effect = 'load';
    await performPackage(view, { request: () => ({ ...status, revision: 'b'.repeat(64) }) } as PackageBackend);
    assert.equal(view.job?.state, 'failed');
    assert.equal(view.job?.review, null);
    assert.equal(view.job?.error, 'conflict');
    assert.equal(view.selected, 'message');
});
test('wrapped prefix rows still open the same literal path editor', () => {
    const view = packageManager();
    view.status = status;
    view.prefix = '/prefix/中文 path/'.repeat(8);
    packageView(view, 'en', 32, 12);
    view.selected = 'prefix:1';
    packageKey(view, { key: 'return' });
    assert.equal(view.editing, 'prefix');
    assert.equal(view.input?.value, view.prefix);
});
