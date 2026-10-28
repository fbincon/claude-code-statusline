import test from 'node:test';
import assert from 'node:assert/strict';
import type { TaskDetails } from '../src/contracts/ui.js';
import { taskViewer, taskViewerKey, taskViewerRows, taskViewerView, receiveTask, readTask } from '../src/editor/task-viewer.js';
import { LANGUAGES, t } from '../src/i18n/messages.js';
import { displayWidth } from '../src/unicode/index.js';
const report = (): TaskDetails => ({ version: 1, session_id: 'session', prompt_id: 'prompt', captured_at: '2026-10-28T00:00:00Z', status: 'running', phase: 'main', elapsed_seconds: 0, active_seconds: null, progress: { completed: 0, total: 3 },
    agents: [{ id: 'parent', name: 'Parent', parent_id: null, status: 'running', evidence: [] }, { id: 'child', name: 'Child 👩‍💻', parent_id: 'parent', status: 'failed', evidence: [{ source: 'live_store', scope: 'subagent:child', status: 'stale', observed_at: '2026-10-27T00:00:00Z', freshness: 'stale' }] },
        { id: 'orphan', name: null, parent_id: 'missing', status: null, evidence: [] }], evidence: [{ source: 'task_store', scope: 'task', status: 'observed', observed_at: '2026-10-28T00:00:00Z', freshness: 'current' }], limitations: ['parent_not_observed', 'independent_snapshots'] });
test('task filters preserve ancestor context, explicit zero, unknown status and immutable evidence', () => {
    const view = taskViewer('session'), original = report(), before = JSON.stringify(original);
    receiveTask(view, original);
    view.query = 'CHILD';
    view.status = 'failed';
    const rows = taskViewerRows(view, 120);
    assert(rows.some(row => row.agent === 'parent'));
    assert(rows.some(row => row.agent === 'child'));
    assert(!rows.some(row => row.agent === 'orphan'));
    assert(rows.some(row => row.text.includes('0/3')));
    assert(rows.some(row => row.text.includes('0.0s')));
    view.evidence = true;
    assert(taskViewerRows(view, 120).some(row => row.text.includes('2026-10-27')));
    view.query = '';
    view.status = 'unknown';
    assert(taskViewerRows(view, 120).some(row => row.agent === 'orphan'));
    assert.equal(JSON.stringify(original), before);
});
test('collapse keeps descendants hidden and search exposes matching descendants', () => {
    const view = taskViewer('session');
    receiveTask(view, report());
    view.collapsed = ['parent'];
    assert(!taskViewerRows(view, 100).some(row => row.agent === 'child'));
    view.query = 'child';
    assert(taskViewerRows(view, 100).some(row => row.agent === 'child'));
});
test('refresh and Unicode resize retain the selected agent, while identity change clears old results', () => {
    const view = taskViewer('session');
    receiveTask(view, report());
    taskViewerView(view, 90, 10);
    view.selected = 'agent:child:0';
    taskViewerView(view, 32, 10);
    assert.equal(view.selected, 'agent:child:0');
    receiveTask(view, { ...report(), captured_at: '2026-10-28T01:00:00Z' });
    taskViewerView(view, 80, 12);
    assert.equal(view.selected, 'agent:child:0');
    taskViewerKey(view, { key: 's' });
    taskViewerKey(view, { key: 'u', ctrl: true });
    taskViewerKey(view, { key: 'different', paste: true });
    assert.equal(taskViewerKey(view, { key: 'return' }), 'read');
    assert.equal(view.session, 'different');
    assert.equal(view.report, null);
    assert.equal(view.selected, '');
});
test('failed reads retain the last report and language; late closed replies cannot repopulate it', async () => {
    const view = taskViewer('session');
    receiveTask(view, report());
    await readTask(view, { request(operation) {
            if (operation === 'read_ui_preferences')
                return { ui_language: 'ja', warning: null };
            throw new Error('private error');
        } });
    assert.equal(view.language, 'ja');
    assert.equal(view.report?.captured_at, report().captured_at);
    assert(view.error);
    assert(!JSON.stringify(view.error).includes('private error'));
    let complete!: (value: unknown) => void;
    const pending = readTask(view, { request(operation) { return operation === 'read_ui_preferences' ? { ui_language: 'ko', warning: null } : new Promise(resolve => { complete = resolve; }); } });
    await Promise.resolve();
    taskViewerKey(view, { key: 'q' });
    complete({ ...report(), captured_at: '2099' });
    await pending;
    assert.equal(view.report?.captured_at, report().captured_at);
});
test('preference errors use the documented fallback without preventing evidence reads', async () => {
    const view = taskViewer('session', null, 'ja');
    await readTask(view, { request(operation) {
            if (operation === 'read_ui_preferences')
                throw new Error('bad preferences');
            return report();
        } });
    assert.equal(view.language, 'en');
    assert(view.warning);
    assert(view.report);
});
for (const language of LANGUAGES)
    test(`task viewer bounds large lists and preserves complete graphemes in ${language}`, () => {
        const view = taskViewer('session', null, language), value = report();
        value.agents = Array.from({ length: 256 }, (_, index) => ({ id: 'agent-' + index, parent_id: null, name: '代理👩‍💻é'.repeat(20), status: 'running', evidence: [] }));
        receiveTask(view, value);
        for (const width of [16, 32, 80, 200])
            for (const height of [6, 12, 40]) {
                const rows = taskViewerView(view, width, height);
                assert(rows.length <= height);
                assert(rows.every(row => displayWidth(row.text) <= width));
                assert(!rows.some(row => /task\.viewer\./u.test(row.text)));
            }
        taskViewerKey(view, { key: 'end' });
        const rows = taskViewerView(view, 80, 12);
        assert(rows.some(row => row.selected));
        assert.equal(value.agents.length, 256);
        assert.notEqual(t('task.viewer.help', language), 'task.viewer.help');
    });
