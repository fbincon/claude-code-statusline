import test from 'node:test';
import assert from 'node:assert/strict';
import { nodes } from '@fbincon/statusline-core/editor/instances';
import { fixture, plain } from './fixtures.js';
import { State } from '../src/state.js';
import { validateDisplay } from '@fbincon/statusline-core/config/display';

test('external editor saves and reopens the timer composition and session effort setting', () => {
    const state = fixture('zh-CN'), editor = state.editor;
    editor.page = 'subagents';
    const ctrl = (key: string) => state.key({ key, ctrl: true });
    for (const type of ['status', 'elapsed', 'effort']) {
        ctrl('a'); state.search(type); state.key({ key: 'return' }); ctrl('g');
    }
    const enabled = () => nodes(editor.draft, 'subagent').filter(item => item.enabled).map(item => item.type_id);
    for (const id of ['status-elapsed', 'status', 'elapsed']) assert(enabled().includes(id));
    const ids = ['model-with-effort', editor.typeStates('subagent').get('effort')!.firstId];
    for (const id of ids) {
        editor.selectItem('subagent', id);
        ctrl('e');
        editor.setting = 'item:effort_fallback';
        assert(plain(state).some(line => line.includes('会话强度回退') && line.includes('使用会话强度')));
        state.key({ key: 'right' });
        assert.equal(editor.instance('subagent', id)!.options.effort_fallback, 'off');
        ctrl('g');
    }
    assert.equal(ctrl('s'), 'save');
    const saved = editor.beginSave();
    const reopened = new State(editor.description, { ...editor.baseline, draft: { ...saved.draft, display: validateDisplay(saved.draft.display) } });
    assert.deepEqual(nodes(reopened.editor.draft, 'subagent').filter(item => item.enabled).map(item => item.type_id), enabled());
    reopened.editor.page = 'subagents';
    for (const id of ids) {
        assert.equal(reopened.editor.instance('subagent', id)!.options.effort_fallback, 'off');
        reopened.editor.selectItem('subagent', id);
        reopened.key({ key: 'e', ctrl: true });
        reopened.editor.setting = 'item:effort_fallback';
        reopened.key({ key: 'right' });
        assert.equal(reopened.editor.instance('subagent', id)!.options.effort_fallback, 'session');
        reopened.key({ key: 'g', ctrl: true });
    }
});

test('terminal catalog shows scoped type states for new, copied and disabled instances', () => {
    for (const scope of ['main', 'subagent'] as const) {
        const state = fixture(), e = state.editor;
        e.page = scope === 'main' ? 'main' : 'subagents';
        const type = scope === 'main' ? 'session-duration' : 'effort';
        const ctrl = (key: string) => state.key({ key, ctrl: true });
        const row = () => plain(state).find(line => line.includes('› ['));
        ctrl('a');
        state.search(type);
        assert.match(row()!, /› \[ \]/u);
        assert.equal(state.key({ key: 'return' }), null);
        assert.match(row()!, /› \[x\]/u);
        assert.equal(e.listContext(scope).selected, type);
        assert.equal(e.listContext(scope).search, type);
        const original = e.typeStates(scope).get(type)!.firstId;
        assert.match(original, /^i-/u);
        const history = e.history.undo.length;
        state.key({ key: ' ' });
        assert.equal(e.typeStates(scope).get(type)!.count, 1);
        assert.equal(e.history.undo.length, history);
        assert.match(plain(state)[1]!, /Already enabled.*Ctrl\+D/u);

        ctrl('g');
        assert.equal(e.selected[scope], original);
        ctrl('d');
        const copy = e.selected[scope];
        assert.notEqual(copy, original);
        ctrl('a');
        state.search(type);
        assert.match(row()!, /› \[x\].*\(2\)/u);
        ctrl('g');
        e.selectItem(scope, original);
        ctrl('x');
        assert.equal(e.instance(scope, original), undefined);
        ctrl('a');
        state.search(type);
        assert.match(row()!, /› \[x\]/u);
        ctrl('g');
        e.selectItem(scope, copy);
        state.key({ key: ' ' });
        ctrl('a');
        state.search(type);
        assert.match(row()!, /› \[–\]/u);
        state.key({ key: ' ' });
        assert.match(row()!, /› \[x\]/u);
        assert.deepEqual(nodes(e.draft, scope).filter(item => item.type_id === type).map(item => item.id), [copy]);
        ctrl('g');
        assert.equal(state.key({ key: 'return' }), 'save');
    }
});

test('terminal catalog inherits filters and keeps them separate during continuous adds', () => {
    const state = fixture(), e = state.editor;
    const ctrl = (key: string) => state.key({ key, ctrl: true });
    ctrl('f');
    state.key({ key: 'home' });
    for (let index = 0; index < e.categories('main').indexOf('model'); index++) state.key({ key: 'down' });
    state.key({ key: 'return' });
    state.search('model-with-effort');
    const original = e.listContext('main');
    let output = plain(state).join('\n');
    assert.match(output, /Configured 1 · Unconfigured 4/u);
    assert.match(output, /Ctrl\+A catalog · Ctrl\+G clear filters/u);

    ctrl('a');
    assert.deepEqual([e.listContext('main').category, e.listContext('main').search], ['model', 'model-with-effort']);
    ctrl('u');
    assert.equal(e.listContext('main').search, '');
    assert.match(plain(state).join('\n'), /Enabled types 1\/5/u);
    e.selectItem('main', 'effort');
    state.key({ key: 'return' });
    e.selectItem('main', 'fast-mode');
    state.key({ key: ' ' });
    assert.deepEqual(e.draft.display.instances.slice(0, 3).map(item => item.type_id), ['model-with-effort', 'effort', 'fast-mode']);
    output = plain(state, 64, 18).join('\n');
    assert.match(output, /Component catalog/u);
    assert.match(output, /Enabled types 3\/5/u);
    assert.match(output, /Enter\/Space add\/enable/u);

    state.key({ key: '/' });
    state.key({ key: 'no-catalog-row-zxq', text: true });
    assert.equal(e.listContext('main').selected, '');
    ctrl('g');
    assert.equal(e.adding, true);
    assert.equal(e.listContext('main').selected, 'fast-mode');
    ctrl('g');
    assert.deepEqual(e.listContext('main'), original);
    ctrl('g');
    assert.equal(e.category.main, 'all');
    assert.equal(e.search.main, '');
    assert.equal(e.history.undo.length, 2);
});
