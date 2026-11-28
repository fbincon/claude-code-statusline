import test from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import type { ReadStream, WriteStream } from 'node:tty';
import { LANGUAGES, t } from '@fbincon/statusline-core/i18n/messages';
import type { PackageReviewJob, PackageStatus, SourceContext, SourceJob, TaskDetails } from '@fbincon/statusline-core/contracts/ui';
import { packageManager } from '@fbincon/statusline-core/editor/package-manager';
import { packageView } from '@fbincon/statusline-core/editor/package-view';
import { openSources } from '@fbincon/statusline-core/editor/source-manager';
import { textInput } from '@fbincon/statusline-core/editor/text-input';
import { frame } from '../src/drawing.js';
import { dimensions } from '../src/layout.js';
import { fixture, plain } from './fixtures.js';
import { Session, type Backend } from '../src/session.js';
import { runTaskViewer, taskFrame } from '../src/task-viewer.js';
import { receiveTask, taskViewer } from '@fbincon/statusline-core/editor/task-viewer';

const report: TaskDetails = {
    version: 1, session_id: 'session', prompt_id: 'prompt', captured_at: '2026-11-27T00:00:00Z',
    status: 'running', phase: 'main', elapsed_seconds: 1, active_seconds: null, progress: null,
    agents: Array.from({ length: 50 }, (_, index) => ({
        id: 'agent-' + index, name: null, parent_id: null, status: 'running', evidence: [],
    })), evidence: [], limitations: [],
};
const reviewing: PackageReviewJob = {
    version: 1, id: 'review-example', owner: 'owner', state: 'running', started_at: report.captured_at,
    finished_at: null, review: null, error: null, request: {
        action: 'check', prefix: '/prefix', expected_revision: 'revision', target: null, channel: null,
        backup_id: null, expected_integrity: null,
    },
};
for (const language of LANGUAGES)
    test(`task viewer and version page retain unsaved editor state in ${language}`, async () => {
        const state = fixture(language);
        state.editor.draft.display.use_colors = false;
        state.editor.page = 'settings';
        state.editor.setting = 'task-details';
        const before = JSON.stringify({ draft: state.editor.draft, baseline: state.editor.baseline });
        state.key({ key: 'return' }, 120, 40);
        assert(state.editor.taskViewer);
        for (const size of [[64, 18], [120, 40], [220, 80]])
            assert(plain(state, ...size as [
                number,
                number
            ]).every(line => !line.includes('task.viewer.')));
        state.key({ key: 'escape' }, 120, 40); // Leave the identity input first.
        state.key({ key: 'q' }, 120, 40);
        assert.equal(state.editor.taskViewer, null);
        assert.equal(JSON.stringify({ draft: state.editor.draft, baseline: state.editor.baseline }), before);
        state.editor.packages = packageManager();
        packageView(state.editor.packages, language, 80, 10);
        const session = new Session(state, { request() { throw new Error('No backend call is needed to close an unopened page'); } });
        assert.equal(await session.key({ key: 'q' }, 120, 40), null);
        assert.equal(state.editor.packages, null);
        assert.equal(JSON.stringify({ draft: state.editor.draft, baseline: state.editor.baseline }), before);
        const view = taskViewer('session', null, language);
        const frame = taskFrame(view, 32, 8);
        assert.equal(frame.rows.length, 8);
        assert(frame.rows[6]!.some(span => span.bold && span.text === 'R'));
        const standalone = taskFrame(view, 160, 20).rows.flat().map(span => span.text).join('');
        assert(standalone.includes(t('ui.refresh.auto', language)));
        assert(!standalone.includes(t('task.readonly', language)));
    });

test('embedded reports use the preview space and return to the same settings row and scroll', () => {
    const state = fixture(), e = state.editor;
    e.page = 'settings';
    e.setting = 'task-details';
    const original = plain(state, 64, 18);
    const start = state.scroll.settings;
    const view = e.taskViewer = taskViewer('session');
    receiveTask(view, report);
    for (const [width, height] of [[64, 18], [80, 24], [120, 40]] as const) {
        const layout = dimensions(width, height);
        const screen = plain(state, width, height);
        assert.equal(layout.report.innerHeight, layout.content.innerHeight + layout.preview.height);
        assert.equal(layout.report.y + layout.report.height, layout.actionsY);
        assert(!screen.some(line => line.includes(t('ui.drawing.preview_sample_data', 'en'))));
        assert(!screen.some(line => line.includes('👩🏽‍💻')));
        assert.equal(view.capacity, layout.report.innerHeight - 1 - 3);
        assert.equal(start, state.scroll.settings);
    }

    // Read navigation can arrive for the new size before the first resized frame.
    state.key({ key: 'home' }, 80, 24);
    state.key({ key: 'pagedown' }, 80, 24);
    assert.equal(view.rows.findIndex(row => row.key === view.selected), dimensions(80, 24).report.innerHeight - 4);
    state.key({ key: 'escape' }, 32, 8);
    assert.deepEqual(plain(state, 64, 18), original);

    const packages = e.packages = packageManager();
    packages.job = reviewing;
    packages.selected = 'job';
    const screen = plain(state, 80, 24);
    assert.equal(packages.capacity, dimensions(80, 24).report.innerHeight - 1);
    assert.equal(packages.selected, 'job');
    assert(!screen.some(line => line.includes('👩🏽‍💻')));
    state.key({ key: 'pagedown' }, 64, 18);
    assert.equal(packages.capacity, dimensions(64, 18).report.innerHeight - 1);
    assert.equal(state.scroll.settings, start);
});

test('report controls follow embedded remaps, input and confirmation; standalone uses its own defaults', () => {
    const state = fixture(), e = state.editor;
    e.shortcuts.snapshot.bindings = {
        'reload-tasks': 'X', 'close-tasks': 'Z', 'refresh-package': 'V', 'close-packages': 'Q',
        'reload-packages': 'J', 'cancel-package-review': 'B',
    };
    const view = e.taskViewer = taskViewer('session', null, 'zh-CN');
    const taskScreen = plain(state, 120, 40);
    assert(taskScreen.at(-2)!.includes('X ' + t('ui.refresh.read_now', 'zh-CN')));
    assert(taskScreen.at(-2)!.includes('Z/Esc'));
    state.key({ key: '/' }, 120, 40);
    assert.equal(view.input, 'search');
    const editing = plain(state, 120, 40).join('\n');
    assert(!editing.includes(t('ui.refresh.auto', 'zh-CN')));
    assert(!editing.includes(t('ui.refresh.read_now', 'zh-CN')));
    assert(editing.includes(t('ui.hints.move_cursor', 'zh-CN')));
    state.key({ key: 'escape' }, 120, 40);
    const separate = taskFrame(view, 80, 16).rows[14]!.map(span => span.text).join('');
    assert(separate.includes('R ' + t('ui.refresh.read_now', 'zh-CN')));

    e.taskViewer = null;
    const pkg = e.packages = packageManager();
    pkg.job = reviewing;
    const packageScreen = plain(state, 120, 40);
    assert(packageScreen.at(-2)!.includes('V ' + t('ui.refresh.read_now', 'en')));
    assert(packageScreen.at(-1)!.includes('J ' + t('ui.hints.reload', 'en')));
    assert(packageScreen.at(-1)!.includes('B ' + t('ui.hints.cancel', 'en')));
    assert(packageScreen.some(line => line.includes(t('ui.refresh.auto', 'en'))));
    assert(!packageScreen.some(line => line.includes('checks progress') || line.includes('R progress')));
    assert(packageView(pkg, 'en', 180, 100).some(row => row.text.includes('R checks progress')));
    pkg.mode = 'execute-confirm';
    assert(!plain(state, 120, 40).some(line => line.includes(t('ui.refresh.auto', 'en'))));
    pkg.mode = 'status';
    pkg.editing = 'target';
    pkg.input = textInput('draft-target');
    const packageInput = plain(state, 120, 40);
    assert(!packageInput.at(-2)!.includes(t('ui.refresh.read_now', 'en')));
    assert(packageInput.at(-1)!.includes(t('ui.hints.move_cursor', 'en')));
});

test('embedded and standalone task identity inputs style the same grapheme without shifting the suffix', () => {
    const state = fixture('de');
    const view = state.editor.taskViewer = taskViewer('', null, 'de');
    const value = 'ab 中👩🏽‍💻z';
    state.key({ key: value, paste: true });
    state.key({ key: 'left' });
    state.key({ key: 'left' });
    const identity = t('task.session', view.language, { value });
    for (const rendered of [frame(state, 64, 18), taskFrame(view, 32, 8)]) {
        const row = rendered.rows.find(row => row.map(span => span.text).join('').includes(identity));
        assert.ok(row);
        assert.deepEqual(row.filter(span => span.reverse).map(span => span.text), ['👩🏽‍💻']);
    }
    state.key({ key: 'return' });
    assert.equal(view.session, value);
});

test('external version navigation shows the current controls and returns to the original row after resize', async () => {
    const state = fixture('zh-CN'), editor = state.editor;
    editor.page = 'settings';
    editor.setting = 'package-management';
    editor.shortcuts.snapshot.bindings = { 'close-packages': 'Z' };
    const originalDraft = JSON.stringify(editor.draft);
    const local: PackageStatus = {
        version: 1, backend_version: 'test', captured_at: report.captured_at, revision: 'a'.repeat(64),
        prefix: '/prefix', entry: '/prefix/path with spaces/中文/cli.js', config_dir: '/config',
        current: '3.17.0', previous: '3.16.5', channel: 'latest', node_version: '24.21.0', host: '2.1.332',
        compatible: true, reasons: [], pending: null, history: [], offset: 0, total: 0,
    };
    const calls: string[] = [];
    const session = new Session(state, { request(operation) {
        calls.push(operation);
        assert.equal(operation, 'package_status');
        return local;
    } } as Backend);
    await session.key({ key: 'return' }, 64, 18);
    const view = editor.packages!;
    assert(view);
    const overview = plain(state, 64, 18).join('\n');
    assert(overview.includes('3.17.0') && overview.includes('Enter 编辑') && overview.includes('Enter 选择'));
    assert(overview.includes('─ ' + t('package.ui.version_options', 'zh-CN') + ' ─'));
    const wide = plain(state, 120, 30);
    for (const group of ['version_options', 'version_actions', 'installation_actions'])
        assert(wide.some(row => row.includes('─ ' + t('package.ui.' + group, 'zh-CN') + ' ─')));
    assert(!overview.includes(local.entry!));
    await session.key({ key: 'down' }, 64, 18);
    assert.equal(view.selected, 'channel');
    await session.key({ key: 'return' }, 64, 18);
    assert.equal(view.mode, 'channel');
    const choosing = plain(state, 64, 18);
    assert(choosing.some(line => line.includes('latest')) && choosing.some(line => line.includes('beta')));
    assert(choosing.at(-2)!.includes('Z/Esc ' + t('ui.hints.back', 'zh-CN')));
    await session.key({ key: 'end' }, 80, 26);
    await session.key({ key: 'return' }, 80, 26);
    assert.equal(view.channel, 'beta');
    assert.equal(view.selected, 'channel');
    await session.key({ key: 'return' }, 64, 18);
    await session.key({ key: 'home' }, 64, 18);
    await session.key({ key: 'escape' }, 64, 18);
    assert.equal(view.channel, 'beta');
    assert.equal(view.selected, 'channel');
    assert(plain(state, 64, 18).some(line => line.includes('› Enter 选择') && line.includes('beta')));
    await session.key({ key: 'z' }, 64, 18);
    assert.equal(editor.packages, null);
    assert.equal(editor.setting, 'package-management');
    assert.equal(JSON.stringify(editor.draft), originalDraft);
    assert.deepEqual(calls, ['package_status']);
});

test('standalone paging uses the current terminal size for every key in a decoded chunk', async () => {
    const view = taskViewer('session');
    receiveTask(view, report);
    const input = Object.assign(new PassThrough(), {
        isTTY: true, isRaw: false, setRawMode(raw: boolean) { this.isRaw = raw; return this; },
    });
    const output = Object.assign(new PassThrough(), { isTTY: true, columns: 80, rows: 12 });
    output.resume();
    const backend = { request(operation: string) {
        if (operation === 'read_ui_preferences') return { ui_language: 'en', warning: null };
        if (operation === 'task_details') return report;
        throw new Error('Unexpected report operation ' + operation);
    } } as Backend;
    const run = runTaskViewer(view, backend, {
        term: 'xterm', input: input as unknown as ReadStream, output: output as unknown as WriteStream,
    });
    try {
        await new Promise(resolve => setImmediate(resolve));
        const initialCapacity = view.capacity;
        output.rows = 24;
        // The new dimensions are already visible before SIGWINCH or another draw.
        input.write('\x1b[H\x1b[6~q');
        assert.equal(await run, 0);
        assert.equal(initialCapacity, 6);
        assert.equal(view.capacity, 18);
        assert.equal(view.rows.findIndex(row => row.key === view.selected), view.capacity);
    } finally {
        input.end();
        output.destroy();
    }
});

test('observed source jobs show progress, provisional timeouts and manual reads in place', () => {
    const state = fixture(), e = state.editor;
    openSources(e);
    const m = e.sources!, context: SourceContext = { project: null, branch: null, head: null, session: null, agent: null };
    const source = { id: 'build', revision: 'version', name: 'Build', kind: 'command' as const, scope: context,
        enabled: true, ttl_seconds: 60, settings: {} };
    m.library = { version: 4, revision: 'registry', sources: [source], bindings: [], automatic: [] };
    m.page = 'actions';
    m.selected = source.id;
    m.observation = { id: source.id, revision: source.revision, context };
    const job: SourceJob = { version: 4, id: 'job-1', source_id: source.id, source_revision: source.revision,
        owner: 'viewer', trigger: 'manual', identity: 'identity', consumers: [], context,
        started_at: report.captured_at, deadline_at: report.captured_at, state: 'running', reason: 'running' };
    m.jobs = [job];
    e.shortcuts.snapshot.bindings = { 'reload-sources': 'X' };
    const current = plain(state, 120, 40);
    assert(current[3]!.includes(t('ui.refresh.auto', 'en')));
    assert(current[3]!.includes(job.id));
    assert(current.at(-1)!.includes('X ' + t('ui.refresh.read_now', 'en')));
    assert(current.some(line => line.includes(t('sources.refresh', 'en'))));
    job.state = 'failed';
    job.reason = 'timeout';
    assert(plain(state, 120, 40)[3]!.includes(t('ui.refresh.checking_timeout', 'en')));
    job.state = 'completed';
    job.reason = 'completed';
    const settled = plain(state, 120, 40);
    assert(settled[3]!.includes(t('sources.reason.completed', 'en')));
    assert(!settled[3]!.includes(t('ui.refresh.auto', 'en')));
    m.page = 'review';
    assert(!plain(state, 120, 40).at(-1)!.includes(t('ui.refresh.read_now', 'en')));
});
