import test from 'node:test';
import assert from 'node:assert/strict';
import type { Operation, ResultFor, SourceContext, SourceDefinition, SourceInspection, SourceJob, SourcesResult } from '@fbincon/statusline-core/contracts/ui';
import { Editor } from '@fbincon/statusline-core/editor/draft';
import { readShortcutBindings } from '@fbincon/statusline-core/editor/shortcut-map';
import { openProfiles, performProfileAction, profilesKey } from '@fbincon/statusline-core/editor/profile-manager';
import { closeSources, openSources, performSourceAction, sourceActions, sourcesKey, sourcesView } from '@fbincon/statusline-core/editor/source-manager';
import { sourceObservationJob } from '@fbincon/statusline-core/editor/source-observation';
import { fixture } from './fixtures.js';
import { footer } from '../src/drawing/shortcuts.js';
import type { Backend } from '../src/session.js';
import { managerRefresh, manualManagerRefresh } from '../src/manager-refresh.js';

const context: SourceContext = { project: '/project', branch: 'main', head: 'a'.repeat(40), session: null, agent: null };
const definition: SourceDefinition = { id: 'ci', name: 'CI', revision: 'rev', kind: 'github', enabled: true, ttl_seconds: 60,
    settings: { branch: null }, scope: { project: null, session: null, agent: null } };
const library: SourcesResult = { version: 4, sources: [definition], automatic: [], bindings: [], revision: 'lib' };
const job: SourceJob = { version: 4, id: 'job', source_id: definition.id, source_revision: definition.revision, identity: 'a'.repeat(64),
    owner: 'other-creator', trigger: 'automatic', consumers: [], context, started_at: '2026-01-01T10:00:00Z', deadline_at: '2026-01-01T10:00:30Z',
    state: 'running', reason: 'running', result: null };
const report = (jobs: SourceJob[], offset = 0): SourceInspection => ({ source: definition, jobs, checks: [], offset, total: offset,
    checks_context: null, checks_observed_at: null, last_success: null,
    automatic: { state: 'off', reason: 'off', next_at: null, last_attempt: null, last_success: null, interval_seconds: 60 },
    view: { source_id: 'ci', name: 'CI', state: 'missing', reason: 'not_observed', observed_at: null, freshness: 'unknown', value: null, unit: null } });
function backendFor(result: (op: Operation, payload: unknown) => unknown): Backend {
    return { request<O extends Operation>(op: O, payload?: unknown) { return result(op, payload) as ResultFor<O>; } };
}
const signal = () => new AbortController().signal;

test('returning to the source list reads only the registry and anchors rows without pinning the draft again', async () => {
    const editor = fixture().editor, calls: string[] = [];
    let current = library;
    const backend = backendFor(op => {
        calls.push(op);
        if (op === 'sources_read') return current;
        if (op === 'source_context') return context;
        if (op === 'source_draft') return { revision: 'pinned' };
        return assert.fail(op);
    });
    openSources(editor);
    await performSourceAction(editor, backend);
    const view = editor.sources!;
    assert.equal(managerRefresh(editor, backend), null, 'initial load already returned the library');
    const state = JSON.stringify([editor.draft, editor.baseline, editor.history]);
    sourcesKey(editor, { key: 'return' });
    sourcesKey(editor, { key: 'escape' });
    current = { ...library, revision: 'added', sources: [{ ...definition, id: 'first' }, definition] };
    let target = managerRefresh(editor, backend)!;
    assert.equal(target.interval, null);
    assert.equal((await target.read(signal(), 'entry'))(), true);
    assert.equal(view.cursor, 1);
    assert.equal(managerRefresh(editor, backend), null);
    current = { ...library, revision: 'removed', sources: [] };
    sourcesKey(editor, { key: 'r' });
    assert(manualManagerRefresh(editor));
    target = managerRefresh(editor, backend)!;
    assert.equal((await target.read(signal(), 'manual'))(), true);
    assert.equal(view.cursor, 0, 'the deleted source falls back to Add');
    assert.deepEqual(calls, ['sources_read','source_context','source_draft','sources_read','sources_read']);
    assert.equal(JSON.stringify([editor.draft, editor.baseline, editor.history]), state);
    await closeSources(editor, backend);
    openSources(editor);
    await performSourceAction(editor, backend);
    assert.equal(calls.filter(op => op === 'source_draft').length, 1);
});

test('profile list reads preserve binding and profile identities and never adopt revisions inside a review', async () => {
    const editor = fixture().editor, display = editor.draft.display;
    const a = { id: 'a', name: 'A', display }, b = { id: 'b', name: 'B', display };
    let result = { version: 1, revision: 'one', profiles: [a,b], bindings: [{ root: '/work', profile_id: 'a' }] };
    const backend = backendFor(op => { assert.equal(op, 'profiles_read'); return result; });
    openProfiles(editor);
    await performProfileAction(editor, backend);
    const view = editor.profiles!;
    assert.equal(managerRefresh(editor, backend), null);
    view.cursor = 2;
    profilesKey(editor, { key: 'enter' });
    profilesKey(editor, { key: 'escape' });
    result = { ...result, revision: 'two', profiles: [b,a] };
    await managerRefresh(editor, backend)!.read(signal(), 'entry').then(apply => apply());
    assert.equal(view.cursor, 1, 'profile B follows its id');
    view.cursor = 3;
    profilesKey(editor, { key: 'r' });
    assert(manualManagerRefresh(editor));
    result = { ...result, revision: 'three', profiles: [b] };
    await managerRefresh(editor, backend)!.read(signal(), 'manual').then(apply => apply());
    assert.equal(view.cursor, 2, 'binding follows its root');
    view.cursor = 1;
    profilesKey(editor, { key: 'r' });
    assert(manualManagerRefresh(editor));
    result = { ...result, revision: 'external' };
    const late = await managerRefresh(editor, backend)!.read(signal(), 'manual');
    profilesKey(editor, { key: 'enter' });
    view.cursor = 3;
    profilesKey(editor, { key: 'enter' });
    assert.equal(view.page, 'confirm');
    assert.equal(late(), false);
    assert.equal(view.library!.revision, 'three');
    assert.equal(managerRefresh(editor, backend), null);
    view.uncertain = true;
    profilesKey(editor, { key: 'r' });
    assert.equal(manualManagerRefresh(editor), false, 'unknown write keeps the explicit recovery effect');
    assert.deepEqual(view.effect, { kind: 'load' });
});

test('job observation follows the selected context through provisional expiry and refreshes the final inspection in place', async () => {
    const editor = fixture().editor, calls: Operation[] = [];
    openSources(editor);
    const view = editor.sources!;
    view.library = library; view.page = 'checks'; view.selected = 'ci'; view.effect = null; view.offset = 16; view.scroll = 4; view.cursor = 3;
    view.observation = { id: 'ci', revision: 'rev', context };
    const foreign = { ...job, id: 'other', context: { ...context, branch: 'next' }, started_at: '2026-01-01T10:00:01Z' };
    view.inspection = report([foreign, job], 16);
    let current: SourceJob = { ...job, state: 'failed', reason: 'timeout' };
    const backend = backendFor((op, payload) => {
        calls.push(op);
        if (op === 'source_status') { assert.deepEqual(payload, { id: 'job' }); return current; }
        if (op === 'source_inspect') { assert.deepEqual(payload, { id: 'ci', context, offset: 16 }); return report([foreign, current], 16); }
        return assert.fail(op);
    });
    assert.equal(sourceObservationJob(editor)?.id, 'job');
    let target = managerRefresh(editor, backend)!;
    assert.equal(target.interval, 2000);
    assert.equal((await target.read(signal(), 'entry'))(), true);
    target = managerRefresh(editor, backend)!;
    assert.equal(target.interval, 10000);
    current = { ...job, state: 'completed', reason: 'valid' };
    assert.equal((await target.read(signal(), 'automatic'))(), true);
    assert.deepEqual(calls, ['source_status','source_status','source_inspect']);
    assert.deepEqual([view.page, view.cursor, view.scroll, view.offset], ['checks',3,4,16]);
    assert.equal(sourceObservationJob(editor), current);
    assert.equal(managerRefresh(editor, backend)!.interval, null);
    await closeSources(editor, backend);
    assert(!calls.includes('source_release'), 'an observed job does not acquire a consumer');
});

test('fixed source arrows read both saved check pages in each editor after loading an old binding', async () => {
    const state = fixture();
    const checks = Array.from({ length: 32 }, (_, i) => ({ name: 'check-' + i, state: 'success', bucket: 'pass', url: null }));
    for (const surface of ['terminal', 'native'] as const) {
        const editor = surface === 'terminal' ? state.editor : new Editor(state.editor.description, state.editor.baseline, surface);
        editor.shortcuts.snapshot.bindings = readShortcutBindings({ 'reload-sources': surface === 'terminal' ? 'Right' : 'Left' })!.bindings;
        openSources(editor);
        const view = editor.sources!;
        view.library = library; view.selected = 'ci'; view.effect = 'checks';
        const offsets: number[] = [];
        const backend = backendFor((op, payload) => {
            if (op === 'source_context') return context;
            assert.equal(op, 'source_inspect');
            const { offset } = payload as { offset: number };
            offsets.push(offset);
            return { ...report([job], offset), checks: checks.slice(offset, offset + 16), total: checks.length };
        });
        await performSourceAction(editor, backend);
        for (const [key, offset] of [['right', 16], ['left', 0]] as const) {
            const effect = surface === 'terminal' ? state.key({ key }) : sourcesKey(editor, { key });
            assert.equal(effect, 'sources'); assert.equal(view.effect, 'checks');
            assert.equal(manualManagerRefresh(editor, { key }), false);
            await performSourceAction(editor, backend);
            assert.equal(view.inspection!.checks[0]!.name, checks[offset]!.name);
        }
        assert.deepEqual(offsets, [0, 16, 0]);
        if (surface === 'terminal') {
            assert(footer(state).help.some(([key]) => key === '←→'));
            assert(footer(state).help.some(([key]) => key === 'R'));
            assert.equal(state.key({ key: 'r' }), 'sources');
            assert(manualManagerRefresh(editor, { key: 'r' }));
        } else assert.equal(sourcesKey(editor, { key: 'r' }), 'sources');
    }
});

test('manual read is advertised for saved observations and uses the foreground target for an applicable job', () => {
    const state = fixture(), editor = state.editor;
    editor.shortcuts.snapshot.bindings = { 'reload-sources': 'X' };
    openSources(editor);
    const view = editor.sources!;
    view.library = library; view.selected = 'ci'; view.page = 'checks'; view.effect = null;
    view.observation = { id: 'ci', revision: 'rev', context };
    for (const jobs of [[], [{ ...job, context: { ...context, head: 'other' } }], [job]]) {
        view.inspection = report(jobs);
        const observable = jobs[0] === job;
        assert(footer(state).help.some(([key]) => key === 'X'));
        assert.equal(state.key({ key: 'r' }), null);
        assert.equal(state.key({ key: 'x' }), 'sources');
        assert.equal(view.effect, 'observe-job');
        assert.equal(manualManagerRefresh(editor, { key: 'x' }), observable);
    }
});

test('release a joined consumer on close during a provisional timeout and ignore late status', async () => {
    const editor = fixture().editor;
    openSources(editor);
    const view = editor.sources!, provisional: SourceJob = { ...job, state: 'failed', reason: 'timeout' };
    view.library = library; view.selected = 'ci'; view.page = 'actions'; view.jobs = [provisional]; view.effect = null;
    view.observation = { id: 'ci', revision: 'rev', context };
    let releases = 0;
    const backend = backendFor((op, payload) => {
        if (op === 'source_status') return { ...job, state: 'completed', reason: 'valid' };
        if (op === 'source_inspect') return report([]);
        assert.equal(op, 'source_release'); assert.deepEqual(payload, { id: job.id, owner: view.owner }); releases++; return provisional;
    });
    sourcesKey(editor, { key: 'r' });
    assert(manualManagerRefresh(editor));
    const apply = await managerRefresh(editor, backend)!.read(signal(), 'manual');
    await closeSources(editor, backend);
    assert.equal(apply(), false);
    assert.equal(releases, 1);
    assert.equal(view.jobs[0], provisional);
});

test('source cancellation confirms the exact current job and leaves other contexts alone', async () => {
    const editor = fixture().editor;
    openSources(editor);
    const view = editor.sources!;
    const other = { ...job, id: 'other-job', context: { ...context, branch: 'other' } };
    view.library = library;
    view.selected = definition.id;
    view.page = 'actions';
    view.inspection = report([job, other]);
    view.observation = { id: definition.id, revision: definition.revision, context };
    view.effect = null;
    assert(sourceActions(editor).some(row => row.id === 'cancel'));
    view.action = 'cancel';
    sourcesKey(editor, { key: 'enter' });
    assert.equal(view.page, 'cancel');
    sourcesKey(editor, { key: 'escape' });
    assert.equal(view.page, 'actions');
    assert.equal(view.effect, null);
    const cancelled: SourceJob = { ...job, state: 'cancelled', reason: 'cancelled' };
    const calls: Operation[] = [];
    const backend = backendFor((operation, payload) => {
        calls.push(operation);
        if (operation === 'source_context') return context;
        if (operation === 'source_inspect') return report([cancelled, other]);
        assert.deepEqual(payload, { id: job.id });
        return operation === 'source_status' ? job : operation === 'source_cancel' ? cancelled : assert.fail(operation);
    });
    sourcesKey(editor, { key: 'enter' });
    sourcesKey(editor, { key: 'enter' });
    await performSourceAction(editor, backend);
    assert.deepEqual(calls, ['source_context', 'source_status', 'source_cancel', 'source_inspect']);
    assert.equal(sourceObservationJob(editor)?.state, 'cancelled');
    assert(sourcesView(editor, 'en', 62, 8).some(row => row.text.includes('Refresh cancelled')));
    sourcesKey(editor, { key: 'escape' });
    assert(!sourceActions(editor).some(row => row.id === 'cancel'));
});

test('another consumer joining changes the raw report without repainting a readable status or checks page', async () => {
    for (const page of ['actions', 'checks', 'diagnose', 'raw'] as const) {
        const editor = fixture().editor;
        openSources(editor);
        const view = editor.sources!;
        view.library = library; view.selected = 'ci'; view.page = page === 'raw' ? 'diagnose' : page;
        view.inspection = report([job]); view.observation = { id: 'ci', revision: 'rev', context }; view.effect = null;
        if (page === 'raw') view.details = JSON.stringify(view.inspection, null, 2).split('\n');
        const update = { ...job, consumers: [{ owner: 'other-view', expires_at: job.deadline_at }] };
        const backend = backendFor(op => { assert.equal(op, 'source_status'); return update; });
        const target = managerRefresh(editor, backend)!;
        assert.equal((await target.read(signal(), 'automatic'))(), page === 'raw', page);
        assert.equal(sourceObservationJob(editor), update);
        assert.equal(view.inspection.jobs[0], update);
    }
});

test('reject a mismatched job and retain a verified terminal state when the final inspection changes checkout', async () => {
    const editor = fixture().editor;
    openSources(editor);
    const view = editor.sources!;
    view.library = library; view.selected = 'ci'; view.page = 'diagnose'; view.effect = null;
    view.inspection = report([job]); view.observation = { id: 'ci', revision: 'rev', context };
    for (const mismatched of [{ ...job, owner: 'wrong' }, { ...job, source_revision: 'changed' },
        { ...job, context: { ...context, head: 'b'.repeat(40) } }]) {
        const target = managerRefresh(editor, backendFor(() => mismatched))!;
        await assert.rejects(target.read(signal(), 'automatic'));
    }
    const backend = backendFor(op => op === 'source_status' ? { ...job, state: 'cancelled', reason: 'cancelled' } :
        { ...report([job]), checks_context: { ...context, branch: 'other' } });
    const target = managerRefresh(editor, backend)!;
    assert.equal((await target.read(signal(), 'automatic'))(), true);
    assert.equal(sourceObservationJob(editor)?.state, 'cancelled');
    assert.equal(view.inspection.checks_context, null);
    assert.equal(view.message?.key, 'sources.error.identity');
    assert.equal(managerRefresh(editor, backend)?.interval, null);
    const retry = backendFor(op => op === 'source_status' ? sourceObservationJob(editor) : report([sourceObservationJob(editor)!]));
    assert.equal((await managerRefresh(editor, retry)!.read(signal(), 'manual'))(), true);
    assert.equal(view.message, null);
});

test('a newer job in the same checkout cannot replace the selected finished job, even outside the inspection page', async () => {
    for (const evicted of [false, true]) {
        const editor = fixture().editor;
        openSources(editor);
        const view = editor.sources!;
        view.library = library; view.selected = 'ci'; view.page = 'diagnose'; view.effect = null;
        view.observation = { id: 'ci', revision: 'rev', context, job }; view.jobs = [job];
        const complete: SourceJob = { ...job, state: 'completed', reason: 'valid' };
        const newer = { ...job, id: 'someone-elses', started_at: '2026-01-01T10:00:04Z' };
        const backend = backendFor((operation, data) => {
            if (operation === 'source_status') { assert.deepEqual(data, { id: job.id }); return complete; }
            assert.equal(operation, 'source_inspect');
            return report(evicted ? [newer] : [newer, complete]);
        });
        const target = managerRefresh(editor, backend)!;
        assert.equal((await target.read(signal(), 'automatic'))(), true);
        assert.equal(sourceObservationJob(editor), complete);
        assert.equal(managerRefresh(editor, backend)?.interval, null);
    }
});

test('temporary final inspection errors retry the cached result at a bounded cadence after the job has finished', async () => {
    const editor = fixture().editor;
    openSources(editor);
    const view = editor.sources!;
    view.library = library; view.selected = 'ci'; view.page = 'diagnose'; view.effect = null;
    view.observation = { id: 'ci', revision: 'rev', context, job };
    const complete: SourceJob = { ...job, state: 'completed', reason: 'valid' };
    let statusReads = 0, inspections = 0;
    const backend = backendFor(op => {
        if (op === 'source_status') { statusReads++; return complete; }
        assert.equal(op, 'source_inspect');
        if (++inspections < 5) throw new Error('temporarily unavailable');
        return report([complete]);
    });
    for (const delay of [2000, 10000, 20000, 30000, 30000]) {
        const target = managerRefresh(editor, backend)!;
        assert.equal(target.interval, delay);
        (await target.read(signal(), 'automatic'))();
        assert.equal(sourceObservationJob(editor)?.state, 'completed');
    }
    assert.equal(managerRefresh(editor, backend)?.interval, null);
    assert.equal(statusReads, 1);
    assert.equal(inspections, 5);
    assert.equal(view.message, null);
});

test('mutating a source keeps its actions open and returning restores its row; profile mutations and exports restore their row', async () => {
    const editor = fixture().editor;
    const a = { ...definition, id: 'a', name: 'A' };
    openSources(editor);
    const sources = editor.sources!;
    sources.library = { ...library, sources: [a, definition] }; sources.effect = null; sources.cursor = 1;
    sourcesKey(editor, { key: 'enter' });
    sources.effect = 'disable';
    await performSourceAction(editor, backendFor(op => {
        assert.equal(op, 'sources_apply');
        return { ...library, revision: 'disabled', sources: [a, { ...definition, enabled: false }] };
    }));
    assert.equal(sources.page, 'actions'); assert.equal(sources.selected, definition.id);
    sourcesKey(editor, { key: 'escape' });
    assert.equal(sources.page, 'list'); assert.equal(sources.cursor, 1); assert.equal(sources.refreshList, true);
    editor.sources = null;
    openProfiles(editor);
    const view = editor.profiles!;
    const display = editor.draft.display, profiles = [a, definition].map(({ id, name }) => ({ id, name, display }));
    view.library = { version: 1, revision: 'old', profiles, bindings: [] }; view.effect = null; view.cursor = 2;
    profilesKey(editor, { key: 'enter' });
    view.effect = { kind: 'mutation', payload: { action: 'rename', id: definition.id, name: 'Renamed', expected_revision: 'old' } };
    await performProfileAction(editor, backendFor(op => {
        assert.equal(op, 'profiles_apply');
        return { version: 1, revision: 'new', profiles: [...profiles].reverse(), bindings: [] };
    }));
    assert.equal(view.cursor, 1); assert.equal(view.refreshList, false);
    profilesKey(editor, { key: 'enter' });
    view.effect = { kind: 'export', path: '/export', display, name: 'Renamed', overwrite: false };
    await performProfileAction(editor, backendFor(op => { assert.equal(op, 'profile_export'); return {}; }));
    assert.equal(view.cursor, 1); assert.equal(view.refreshList, true);
});
