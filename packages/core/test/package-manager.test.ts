import { BackendError } from '../src/editor/backend.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { packageManager, packageKey, performPackage, closePackage, type PackageBackend, type PackageManager } from '../src/editor/package-manager.js';
import { packageView } from '../src/editor/package-view.js';
import { displayWidth } from '../src/unicode/index.js';
import { isPackageRequest, isPackageResult } from '../src/editor/package-validation.js';
import type { PackageCleanupReview, PackageStatus, PackageReviewJob, PackageReviewRequest } from '../src/contracts/ui.js';
import { LANGUAGES, t } from '../src/i18n/messages.js';
const status: PackageStatus = { version: 1, backend_version: 'test', captured_at: '2026-10-28T00:00:00Z', revision: 'a'.repeat(64), prefix: '/prefix', entry: '/prefix/entry', config_dir: '/config', current: '3.10.0', previous: '3.9.2', channel: 'latest', node_version: '24.21.0', host: '2.1.310', compatible: true, reasons: [], pending: null, history: [], offset: 0, total: 0 };
const request: PackageReviewRequest = { action: 'check', prefix: '/prefix', expected_revision: status.revision, target: null, channel: 'latest', backup_id: null, expected_integrity: null };
function job(owner: string): PackageReviewJob { return { version: 1, id: 'review-00000000-0000-0000-0000-000000000000', owner, state: 'running', started_at: status.captured_at, finished_at: null, request, review: null, error: null }; }
test('opening a version page only inspects local state; metadata binds the next verified review to exact bytes', async () => {
    const view = packageManager(), calls: {
        operation: string;
        payload: any;
    }[] = [];
    const backend = { request(operation: string, payload: any) { calls.push({ operation, payload }); return operation === 'package_status' ? status : operation==='package_review_cancel'?{...job(view.owner),state:'cancelled'}:job(view.owner); } } as PackageBackend;
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
        for (const mode of ['status', 'installation', 'channel', 'review'] as const) {
            view.mode = mode;
            for (const [width, height] of [[32, 4], [80, 24], [200, 100]] as const) {
                const rows = packageView(view, language, width, height);
                assert(rows.length <= height);
                assert(rows.every(row => displayWidth(row.text) <= width && !row.text.includes('package.ui.')));
            }
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
    assert.equal(view.selected, 'target');
    assert.equal(typeof view.message === 'object' && view.message?.key, 'package.ui.changed');
});
test('wrapped prefix rows still open the same literal path editor', () => {
    const view = packageManager();
    view.status = status;
    view.prefix = '/prefix/中文 path/'.repeat(8);
    view.mode = 'installation';
    view.selected = 'prefix';
    view.part = 1;
    packageView(view, 'en', 32, 12);
    assert.equal(view.part, 1);
    packageKey(view, { key: 'return' });
    assert.equal(view.editing, 'prefix');
    assert.equal(view.input?.value, view.prefix);
});

function openStatus(): PackageManager {
    const view = packageManager();
    view.status = status;
    view.prefix = status.prefix!;
    view.effect = null;
    return view;
}

function press(view: PackageManager, key: string, selected?: string, width = 64, height = 8) {
    if (selected) {
        view.selected = selected;
        view.part = 0;
    }
    packageView(view, 'en', width, height);
    return packageKey(view, { key });
}

test('the overview keeps its summary visible and moves only between actions', () => {
    const view = openStatus();
    const rows = packageView(view, 'zh-CN', 32, 4);
    assert(rows.some(row => row.key === 'summary' && row.text.includes(status.current!)));
    assert(rows.some(row => row.selected && row.key === 'target' && row.keys?.length));
    assert(!view.rows.some(row => row.text.includes(status.config_dir) || row.text.includes(status.entry!)));
    assert(view.rows.filter(row => row.heading).every(row => !row.command && !row.selected));
    press(view, 'down');
    assert.equal(view.selected, 'channel');
    press(view, 'down');
    assert.equal(view.selected, 'check');
    press(view, 'home');
    assert.equal(view.selected, 'target');
});

test('the channel chooser uses a pending selection and returns to the same overview position', async () => {
    const view = openStatus();
    press(view, 'return', 'channel', 32, 4);
    assert.equal(view.mode, 'channel');
    assert.equal(view.selected, 'channel:inherit');
    press(view, 'down');
    press(view, 'down');
    const choices = packageView(view, 'en', 64, 8);
    assert(choices.some(row => row.key === 'channel:inherit' && row.text.includes('(current)')));
    assert(choices.some(row => row.key === 'channel:beta' && row.selected));
    press(view, 'escape', undefined, 72, 12);
    assert.equal(view.mode, 'status');
    assert.equal(view.selected, 'channel');
    assert.equal(view.channel, null);
    assert.equal(view.effect, null);

    view.job = { ...job(view.owner), state: 'complete' };
    press(view, 'return');
    assert.equal(press(view, 'return'), null, 'confirming the same channel keeps the current review');
    press(view, 'return');
    press(view, 'end');
    assert.equal(press(view, 'return'), 'packages');
    assert.equal(view.channel, 'beta');
    assert.equal(view.selected, 'channel');
    assert.equal(view.reviewInvalidated, true);
    const calls: string[] = [];
    await performPackage(view, { request(operation) {
        calls.push(operation);
        return { ...job(view.owner), state: 'cancelled' };
    } } as PackageBackend);
    assert.deepEqual(calls, ['package_review_cancel']);
    assert.equal(view.selected, 'channel');
    assert.equal(view.job, null);
    press(view, 'return');
    assert.equal(view.selected, 'channel:beta');
});

test('literal input keeps Q available and cancellation preserves the field and draft values', () => {
    const view = openStatus();
    press(view, 'return', 'target');
    const rows = packageView(view, 'zh-CN', 64, 8);
    assert(rows.some(row => row.text.includes(t('package.ui.target_help', 'zh-CN').slice(0, 12))));
    press(view, 'q');
    assert.equal(view.input?.value, 'q');
    assert.equal(view.mode, 'status');
    press(view, 'escape');
    assert.equal(view.input, null);
    assert.equal(view.target, '');
    assert.equal(view.selected, 'target');
    assert.equal(view.effect, null);

    press(view, 'return', 'installation');
    assert.equal(view.selected, 'prefix');
    press(view, 'return');
    assert.equal(view.editing, 'prefix');
    packageKey(view, { key: 'g', ctrl: true });
    press(view, 'q');
    assert.equal(view.mode, 'status');
    assert.equal(view.selected, 'installation');
});

test('exact versions take priority over the channel sent in a review request', async () => {
    const view = openStatus();
    view.channel = 'beta';
    view.target = '3.11.0';
    assert.equal(press(view, 'return', 'check'), 'packages');
    let submitted: PackageReviewRequest | undefined;
    await performPackage(view, { request(operation, payload) {
        assert.equal(operation, 'package_review_start');
        submitted = (payload as { request: PackageReviewRequest }).request;
        return { ...job(view.owner), request: submitted };
    } } as PackageBackend);
    assert.equal(submitted?.target, '3.11.0');
    assert.equal(submitted?.channel, null);
    assert.equal(view.mode, 'review');
    press(view, 'q');
    assert.equal(view.selected, 'check');
    assert(view.job, 'returning from the report keeps the review available');
});

function recordId(index: number) {
    return 'pkg-00000000-0000-0000-0000-' + index.toString().padStart(12, '0');
}

test('history and cleanup remember their independent pages and restore the confirmed record on back', async () => {
    const view = openStatus();
    const reads: { operation: string; offset: number }[] = [];
    let total = 18;
    let doomed = false;
    const backend = { request(operation: string, payload: { offset: number }) {
        reads.push({ operation, offset: payload.offset });
        const { offset } = payload;
        const ids = Array.from({ length: Math.min(16, Math.max(0, total - offset)) }, (_, index) => recordId(offset + index))
            .filter(id => !doomed || id !== recordId(16));
        if (operation === 'package_status') return {
            ...status, offset, total, history: ids.map(id => ({ id, version: status.current, created: status.captured_at,
                stage: 'complete', backup: 'missing', running: false })),
        };
        assert.equal(operation, 'package_cleanup_review');
        return { version: 1, revision: status.revision, prefix: status.prefix, offset, total, uncertain: false,
            rows: ids.map(id => ({ id, version: status.current, removable: true, reasons: [] })) } as PackageCleanupReview;
    } } as PackageBackend;
    view.effect = 'load';
    await performPackage(view, backend);
    press(view, 'return', 'history');
    assert.equal(press(view, 'return', 'next-page'), 'packages');
    await performPackage(view, backend);
    assert.equal(view.historyOffset, 16);
    assert.equal(press(view, 'return', 'cleanup-review'), 'packages');
    await performPackage(view, backend);
    assert.equal(view.cleanupOffset, 0);
    assert.equal(press(view, 'return', 'next-page'), 'packages');
    await performPackage(view, backend);
    assert.equal(view.cleanupOffset, 16);
    press(view, 'return', 'cleanup:' + recordId(16), 32, 4);
    assert.equal(view.mode, 'cleanup-confirm');
    assert.equal(view.cleanupId, recordId(16));
    press(view, 'escape', undefined, 120, 24);
    assert.equal(view.mode, 'cleanup');
    assert.equal(view.selected, 'cleanup:' + recordId(16));
    assert.equal(view.cleanupId, null);
    assert.equal(view.effect, null);

    doomed = true;
    assert.equal(press(view, 'r'), 'packages');
    await performPackage(view, backend);
    assert(packageView(view, 'en', 64, 8).some(row => row.selected && row.key === 'cleanup:' + recordId(17)));
    press(view, 'q');
    assert.equal(view.selected, 'cleanup-review');
    assert.equal(view.historyOffset, 16);
    press(view, 'return');
    await performPackage(view, backend);
    assert.equal(view.cleanupOffset, 16);
    total = 15;
    press(view, 'r');
    await performPackage(view, backend);
    assert.equal(view.cleanupOffset, 0);
    assert.deepEqual(reads.slice(-2), [{ operation: 'package_cleanup_review', offset: 16 }, { operation: 'package_cleanup_review', offset: 0 }]);
    press(view, 'q');
    press(view, 'q');
    assert.equal(view.mode, 'status');
    assert.equal(view.selected, 'history');
});

test('cleanup confirms exactly the reviewed removable record and removes its stale backup entry', async () => {
    const view = openStatus();
    const protectedId = recordId(0), removableId = recordId(1);
    view.status = { ...status, total: 2, history: [protectedId, removableId].map(id => ({
        id, version: status.current, created: status.captured_at, stage: 'complete', backup: 'verified', running: false,
    })) };
    const protectedRecord = { id: protectedId, version: status.current, removable: false, reasons: ['current'] };
    const cleanup: PackageCleanupReview = {
        version: 1, prefix: view.prefix, revision: 'b'.repeat(64), offset: 0, total: 2, uncertain: false,
        rows: [protectedRecord, { id: removableId, version: status.current, removable: true, reasons: [] }],
    };
    const requests: { operation: string; payload: unknown }[] = [];
    const backend = { request(operation: string, payload: unknown) {
        requests.push({ operation, payload });
        return operation === 'package_cleanup_review' ? cleanup : { ...cleanup, total: 1, rows: [protectedRecord] };
    } } as PackageBackend;
    press(view, 'return', 'history');
    press(view, 'return', 'cleanup-review');
    await performPackage(view, backend);
    assert.equal(press(view, 'return', 'cleanup:' + protectedId), null);
    assert.equal(view.mode, 'cleanup');
    press(view, 'return', 'cleanup:' + removableId);
    assert.equal(requests.length, 1);
    assert.equal(press(view, 'return'), 'packages');
    await performPackage(view, backend);
    assert.deepEqual(requests[1], { operation: 'package_cleanup_apply',
        payload: { prefix: status.prefix, revision: cleanup.revision, ids: [removableId] } });
    assert.equal(view.mode, 'cleanup');
    assert.equal(view.status.history.some(row => row.id === removableId), false);
    assert.equal(view.status.total, 1);
    assert(packageView(view, 'en', 80, 12).some(row => row.selected && row.key === 'cleanup:' + protectedId));
});

test('an unconfirmed cancellation cannot start a replacement review',async()=>{
    const view=packageManager();view.status=status;view.job={...job(view.owner),state:'failed'};view.effect='start';
    const calls:string[]=[];
    await performPackage(view,{request(operation){calls.push(operation);return job(view.owner);}} as PackageBackend);
    assert.deepEqual(calls,['package_review_cancel']);assert.equal(view.job?.state,'running');assert(view.message);
});

test('an unconfirmed cancellation retains the original job when the prefix changes', async () => {
    const view = packageManager();
    view.prefix = '/other-prefix';
    view.job = job(view.owner);
    const calls: string[] = [];
    await performPackage(view, { request(operation) { calls.push(operation); return job(view.owner); } } as PackageBackend);
    assert.deepEqual(calls, ['package_review_cancel']);
    assert.equal(view.job?.request.prefix, '/prefix');
    assert.equal(view.status, null);
    assert(view.message);
});

test('closing during replacement cancellation never starts another review', async () => {
    const view = packageManager();
    view.status = status;
    view.job = { ...job(view.owner), state: 'complete' };
    view.effect = 'start';
    const calls: string[] = [];
    let finish!: (value: PackageReviewJob) => void;
    const backend = { request(operation: string) {
        calls.push(operation);
        return calls.length === 1 ? new Promise<PackageReviewJob>(resolve => { finish = resolve; }) : { ...job(view.owner), state: 'cancelled' };
    } } as PackageBackend;
    const pending = performPackage(view, backend);
    await closePackage(view, backend);
    finish({ ...job(view.owner), state: 'cancelled' });
    await pending;
    assert(!calls.includes('package_review_start'));
    assert.equal(view.closed, true);
});

import { Editor } from '../src/editor/draft.js';
import { defaultDisplay } from '../src/config/display.js';
import { DEFAULT_HOST } from '../src/config/draft.js';
import type { ReadResult, DescribeResult, PackageExecution } from '../src/contracts/ui.js';
function editorFixture(){return new Editor({catalog:[],options:{padding:{minimum:0,maximum:32},'refresh-interval':{minimum:1,maximum:3600}}}as unknown as DescribeResult,{draft:{display:defaultDisplay(),host:{...DEFAULT_HOST}},revision:'0'.repeat(64),installed:true,installation:{}}as ReadResult);}
function verifiedJob(view:ReturnType<typeof packageManager>):PackageReviewJob{return {...job(view.owner),state:'complete',request:{...request,action:'update'},review:{action:'update',current:'3.10.0',target:'3.12.0',prefix:'/prefix',entry:'/prefix/entry',config_dir:'/config',channel:'latest',registry:'https://registry.npmjs.org/',integrity:'sha512-'+Buffer.alloc(64).toString('base64'),node_engine:'>=22',host:'2.1.310',artifact_verified:true,compatible:true,reasons:[],configuration_conflicts:[],backup_id:null,files:[]}};}

test('returning from clean or dirty execution preparation restores the execute action', async () => {
    for (const dirty of [false, true]) {
        const editor = editorFixture(), view = openStatus();
        if (dirty) editor.draft.display.statusline_language = 'ko';
        view.job = verifiedJob(view);
        const backend = { request() { throw new Error('Cancellation must not reach the execution backend'); } } as PackageBackend;
        press(view, 'return', 'job');
        assert.equal(press(view, 'return', 'execute'), 'packages');
        await performPackage(view, backend, editor);
        assert.equal(view.mode, dirty ? 'draft' : 'execute-confirm');
        press(view, 'q', undefined, 32, 4);
        assert.equal(view.mode, 'review');
        assert.equal(view.selected, 'execute');
        assert.equal(view.draftPrepared, false);
        assert.equal(editor.modified, dirty);
        assert.equal(editor.packageLocked, false);
        assert.equal(view.effect, null);
        press(view, 'q');
        assert.equal(view.mode, 'status');
        assert.equal(view.selected, 'job');
    }
});

test('dirty drafts require an explicit choice and exporting never marks them saved',async()=>{
    const e=editorFixture(),view=packageManager(),calls:string[]=[];e.draft.display.statusline_language='ko';view.job=verifiedJob(view);view.status=status;view.effect='execute';
    const backend={request(operation:string){calls.push(operation);return {path:'/export'};}}as PackageBackend;
    await performPackage(view,backend,e);assert.equal(view.mode,'draft');assert.equal(calls.length,0);
    view.effect='export-draft';await performPackage(view,backend,e);assert.equal(e.modified,true);assert.equal(view.mode,'execute-confirm');assert.equal(calls.join(','),'export');
    press(view,'q');view.effect='execute';await performPackage(view,backend,e);assert.equal(view.mode,'draft');
    press(view,'return','draft-discard');await performPackage(view,backend,e);assert.equal(e.modified,false);assert.equal(view.mode,'execute-confirm');assert(!calls.includes('apply'));
});
test('unknown saves block execution and accepted handoffs lock editing while close only detaches',async()=>{
    const e=editorFixture(),view=packageManager();view.job=verifiedJob(view);view.effect='execute';e.setSaveState('unknown');const calls:string[]=[];
    const execution:PackageExecution={version:1,id:'execution-00000000-0000-0000-0000-000000000001',transaction_id:null,action:'update',prefix:'/prefix',state:'running',stage:'queued',started_at:status.captured_at,updated_at:status.captured_at,finished_at:null,error:null,running:null,results:{package:false,integration:false,configuration:null},control:{executable:'/node',args:['/runner/entry'],config_dir:'/config'}};
    const backend={request(operation:string){calls.push(operation);return operation==='package_execute_start'?execution:{...job(view.owner),state:'cancelled'};},control(_control:unknown,operation:string){calls.push(operation);return execution;}}as PackageBackend;
    await performPackage(view,backend,e);assert.equal(view.mode,'draft');assert.equal(calls.length,0);
    e.setSaveState('idle');view.draftPrepared=true;view.effect='execute';await performPackage(view,backend,e);assert.equal(e.packageLocked,true);assert.equal(e.canMutateDraft(),false);await closePackage(view,backend);assert(calls.includes('package_execute_detach'));assert(!calls.includes('package_execute_cancel'));
});

test('a definitive handoff refusal retains draft reservations and unlocks the original editor',async()=>{
    const e=editorFixture(),view=packageManager();e.sourceDraftRegistered=true;view.job=verifiedJob(view);view.draftPrepared=true;view.effect='execute';const calls:string[]=[];
    const backend={request(operation:string){calls.push(operation);throw new BackendError('conflict','Installation changed');}}as PackageBackend;
    await performPackage(view,backend,e);assert.equal(e.packageLocked,false);assert.equal(e.sourceDraftRegistered,true);assert.deepEqual(calls,['package_execute_start']);assert.equal(view.execution,null);
});
