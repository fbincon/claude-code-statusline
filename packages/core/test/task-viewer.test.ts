import test from 'node:test';
import assert from 'node:assert/strict';
import type { TaskDetails } from '../src/contracts/ui.js';
import { taskViewer, taskViewerKey, taskViewerRows, taskViewerView, receiveTask, readTask, replaceTaskField } from '../src/editor/task-viewer.js';
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
test('compact reading always shows the selected report row and pages by its visible capacity', () => {
    const view = taskViewer('session');
    receiveTask(view, report());
    for (const height of [1, 2, 3, 4, 6]) {
        view.error = 'Refresh error';
        taskViewerKey(view, { key: 'home' });
        const first = taskViewerView(view, 76, height);
        assert.equal(first.length, height);
        assert(first.some(row => row.selected && row.key === 'captured:0'));
        const bodyKeys = new Set(view.rows.map(row => row.key));
        assert.equal(view.capacity, first.filter(row => bodyKeys.has(row.key)).length);
        taskViewerKey(view, { key: 'pagedown' });
        const page = taskViewerView(view, 76, height);
        assert(page.some(row => row.selected && row.key !== 'captured:0'));
    }
});
test('a complete host text replacement keeps spaces and rejects the entire invalid edit', () => {
    const view = taskViewer('session');
    taskViewerKey(view, { key: '/' });
    assert(replaceTaskField(view, 'search', '中 文 👩‍💻'));
    assert(!replaceTaskField(view, 'search', 'x'.repeat(257)));
    assert(!replaceTaskField(view, 'search', 'a\nb'));
    assert.equal(view.searchInput.value, '中 文 👩‍💻');
    assert(replaceTaskField(view, 'search', 'ok'));
    assert.equal(view.error, null);
    taskViewerKey(view, { key: 'enter' });
    assert.equal(view.query, 'ok');
});
test('the terminal task editor budgets the active field against its translated label', () => {
    const view = taskViewer('session', 'A界👩🏽‍💻', 'ru');
    taskViewerKey(view, { key: 's' });
    taskViewerKey(view, { key: 'tab' });
    taskViewerKey(view, { key: 'left' });
    const label = t('task.prompt', view.language, { value: '' });
    for (const width of [displayWidth(label) + 2, 64]) {
        const rows = taskViewerView(view, width, 12);
        const active = rows.find(row => row.caret)!;
        assert.equal(rows.filter(row => row.caret).length, 1);
        assert.equal(active.key, 'identity-prompt');
        assert.ok(active.text.startsWith(label));
        assert.equal(active.text.slice(active.caret!.start, active.caret!.end), '👩🏽‍💻');
        assert.ok(displayWidth(active.text) <= width);
    }
    assert.equal(view.promptInput.value, 'A界👩🏽‍💻');
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
test('the first read failure has no retained result and errors preserve an explicit interface language', async () => {
    const view = taskViewer('session', null, 'zh-CN');
    await readTask(view, { request() { throw new Error('private failure'); } }, undefined, 'zh-CN');
    assert.equal(view.language, 'zh-CN');
    assert.equal(view.warning?.key, 'task.language_kept');
    assert.equal(view.report, null);
    const rows = taskViewerView(view, 62, 9);
    assert(rows.some(row => row.key === 'error' && row.text === t('task.viewer.first_read_failed', view.language)));
    assert(rows.some(row => row.text === t('task.viewer.retry_read', view.language)));
    assert(!rows.some(row => row.key === 'retained'));

    receiveTask(view, report());
    await readTask(view, { request() { throw new Error('private failure'); } }, undefined, 'zh-CN');
    assert(taskViewerView(view, 62, 9).some(row => row.key === 'retained' && row.text.includes(report().captured_at)));
});
test('missing and conflicting current tasks show their status first and retain source evidence', () => {
    const view = taskViewer('session', null, 'zh-CN');
    for (const reason of ['no_current_task', 'ambiguous_current_task']) {
        const snapshot = { ...report(), prompt_id: null, status: null, phase: null, elapsed_seconds: null, progress: null, agents: [], limitations: [reason] };
        receiveTask(view, snapshot);
        const first = taskViewerRows(view, 32);
        assert.equal(first.filter(row => row.key.startsWith('current:')).map(row => row.text).join(''), t('task.limit.' + reason, view.language));
        assert(first[0]!.key.startsWith('current:'));
        assert(!first.some(row => /^(elapsed|active|status|no-agents):/u.test(row.key)));
        taskViewerKey(view, { key: 'e' });
        const evidence = taskViewerRows(view, 64);
        assert(evidence.some(row => row.heading && row.text.includes('task_store')));
        assert(evidence.some(row => row.text.includes(snapshot.evidence[0]!.observed_at!)));
        taskViewerKey(view, { key: 'e' });
    }
});
for (const language of LANGUAGES)
    test(`task viewer bounds large lists and preserves complete graphemes in ${language}`, () => {
        const view = taskViewer('session', null, language), value = report();
        value.agents = Array.from({ length: 256 }, (_, index) => ({ id: 'agent-' + index, parent_id: null, name: '代理👩‍💻é'.repeat(20), status: 'running', evidence: [] }));
        receiveTask(view, value);
        for (const width of [1, 16, 32, 80, 200])
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
