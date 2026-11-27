import test from 'node:test';
import assert from 'node:assert/strict';
import { BackendError, parseResponse } from '../src/editor/backend.js';
import { PROTOCOL_VERSION } from '../src/contracts/ui.js';
import { text } from '../src/i18n/messages.js';
import { SHORTCUT_GROUPS, isBindingMap, listedShortcut, readShortcutBindings, resolveShortcut, shortcutAliases, shortcutConflict } from '../src/editor/shortcut-map.js';
import { EditorShortcuts, shortcutPanelRows } from '../src/editor/shortcut-settings.js';

test('presets are reachable and shared overrides replace context-specific aliases', () => {
    assert.equal(shortcutConflict({}), null);
    for (const action of Object.values(SHORTCUT_GROUPS).flat())
        assert.ok(listedShortcut('terminal', action, {}) || listedShortcut('native', action, {}), action);
    assert.equal(resolveShortcut('native', 'list', { key: 'A', ctrl: true }, {}), 'add-item');
    assert.equal(resolveShortcut('native', 'list', { key: '_', ctrl: true }, {}), 'undo');
    assert.equal(resolveShortcut('terminal', 'list', { key: 'return' }, {}), 'save');
    assert.equal(resolveShortcut('native', 'list', { key: 'return' }, {}), 'toggle-item');

    const bindings = { save: 'Z', undo: 'Ctrl+Q', 'toggle-item': 'Enter', 'move-left': 'Right', 'move-right': 'Left' } as const;
    assert.ok(isBindingMap(bindings));
    assert.equal(shortcutConflict(bindings), null);
    for (const surface of ['terminal', 'native'] as const) {
        assert.equal(resolveShortcut(surface, 'list', { key: 'z' }, bindings), 'save');
        assert.equal(resolveShortcut(surface, 'list', { key: 's', ctrl: surface === 'terminal' }, bindings), null);
        assert.equal(resolveShortcut(surface, 'list', { key: 'right' }, bindings), 'move-left');
        assert.equal(resolveShortcut(surface, 'settings', { key: 'right' }, bindings), null);
        assert.equal(resolveShortcut(surface, 'list', { key: 'return' }, bindings), 'toggle-item');
        assert.equal(resolveShortcut(surface, 'history', { key: 'q', ctrl: true }, bindings), 'undo');
        for (const flags of [{ paste: true }, { text: true }, { meta: true }, { overflow: true }])
            assert.equal(resolveShortcut(surface, 'list', { key: 'z', ...flags }, bindings), null);
    }
    assert.equal(resolveShortcut('native', 'list', { key: '/', ctrl: true }, bindings), null);
});

test('conflicts include defaults and the other editor while disjoint contexts can reuse keys', () => {
    assert.deepEqual(shortcutConflict({ save: 'Ctrl+A' }), { surface: 'terminal', context: 'list', key: 'Ctrl+A', first: 'save', second: 'add-item' });
    assert.equal(shortcutConflict({ save: 'Z', 'reload-profiles': 'Z' }), null);
    for (const bindings of [{ save: 'Tab' }, { save: 'Ctrl+G' }, { save: 'Ctrl+H' }, { save: '1' }, { save: 'Enter' },
        { 'save-source': 'Z' }, { 'task-search': 'K' }, { 'open-unknown': 'Q' }, { save: 'Z\n' }, { save: 'Ctrl+Z\n' }])
        assert.equal(isBindingMap(bindings), false, JSON.stringify(bindings));
});

test('host-owned keys are available for terminal-only actions and terminal presets', () => {
    const entries = [
        { key: 'd', action: 'copy-item', terminalOnly: 'task-identity' },
        { key: 'x', action: 'remove-item', terminalOnly: 'task-filter' },
        { key: 'z', action: 'undo', terminalOnly: 'task-evidence' },
    ] as const;
    for (const { key, action, terminalOnly } of entries) {
        const token = 'Ctrl+' + key.toUpperCase();
        const bindings = { [terminalOnly]: token };
        assert.ok(isBindingMap(bindings));
        assert.equal(shortcutConflict(bindings), null);
        assert.equal(isBindingMap({ [action]: token }), false);
        assert.equal(isBindingMap({ 'reload-profiles': token }), false);
        assert.equal(resolveShortcut('terminal', 'list', { key, ctrl: true }, {}), action);
        assert.equal(resolveShortcut('terminal', 'tasks', { key, ctrl: true }, bindings), terminalOnly);
        assert.equal(resolveShortcut('native', 'list', { key, ctrl: true }, {}), null);
        assert.ok(!listedShortcut('native', action, {}).includes(token));
    }
    assert.equal(resolveShortcut('native', 'list', { key: 'd' }, {}), 'copy-item');
    assert.equal(resolveShortcut('native', 'list', { key: 'x' }, {}), 'remove-item');
    assert.equal(resolveShortcut('native', 'list', { key: '_', ctrl: true }, {}), 'undo');
});

test('terminal Esc remains a fallback for remapped close in ordinary editor contexts', () => {
    const bindings = { close: 'Z' };
    assert.equal(shortcutConflict(bindings), null);
    for (const context of ['list', 'detail', 'settings', 'layout'] as const) {
        assert.equal(shortcutAliases('terminal', context, bindings, 'close'), 'Z/Esc');
        assert.equal(resolveShortcut('terminal', context, { key: 'escape' }, bindings), 'close');
        assert.equal(resolveShortcut('terminal', context, { key: 'Z' }, bindings), 'close');
        assert.equal(resolveShortcut('native', context, { key: 'escape' }, bindings), null);
        assert.equal(resolveShortcut('native', context, { key: 'Q' }, bindings), null);
    }
    assert.equal(resolveShortcut('terminal', 'picker', { key: 'escape' }, bindings), null);
});

test('legacy reads preserve valid overrides while restoring presets and strict saves reject host keys', () => {
    const bindings = { save: 'Z', undo: 'Ctrl+Z', redo: 'U', 'reload-profiles': 'Ctrl+D', 'reload-sources': 'Ctrl+X', 'task-identity': 'Ctrl+D' };
    const compatible = readShortcutBindings(bindings);
    assert.deepEqual(compatible?.bindings, { save: 'Z', 'task-identity': 'Ctrl+D' });
    assert.equal(compatible?.warning?.key, 'shortcuts.ignored-bindings');
    assert.deepEqual(compatible?.warning?.params, { keys: 'Ctrl+Z, Ctrl+D, Ctrl+X, U' });
    assert.equal(readShortcutBindings({ save: 'Ctrl+D' }), null, 'The old terminal preset also conflicted');
    assert.equal(readShortcutBindings({ finish: 'Ctrl+X' }), null, 'The old Client preset also conflicted');
    assert.equal(readShortcutBindings({ save: '1' }), null);
    assert.equal(readShortcutBindings({ undo: 'Ctrl+Z', redo: 'U', 'open-unknown': 'O' }), null);
    const result = { schema_version: 1, bindings, revision: '1'.repeat(64), warning: null };
    const response = { exitCode: 0, stdout: JSON.stringify({ protocol_version: PROTOCOL_VERSION, result }), stderr: '' };
    assert.deepEqual(parseResponse('read_editor_shortcuts', response), { ...result, ...compatible });
    assert.throws(() => parseResponse('set_editor_shortcuts', response), BackendError);
});

test('shortcut settings keep staging, conflict advice and reset separate from active keys', async () => {
    const keys = new EditorShortcuts('native');
    keys.open();
    const press = (key: string, ctrl = false) => keys.key({ key, ctrl }, 'en', 32, 11);
    press('return');
    const panelText = () => shortcutPanelRows(keys, 'en', 32, 11).map(row => row.text).join(' ');
    assert.match(panelText(), /Claude reserves Ctrl\+D, Ctrl\+X, Ctrl\+Z/);
    keys.key({ key: 'P', text: true }, 'en', 32, 11);
    assert.equal(keys.panel!.capture, true);
    press('d', true);
    assert.equal(keys.panel!.capture, true);
    assert.equal(keys.panel!.message?.key, 'shortcuts.host-key');
    assert.deepEqual(keys.panel!.draft, {});
    press('a', true);
    assert.match(panelText(), /Terminal editor.*Ctrl\+A.*Save display.*Open component catalog/);
    assert.equal(press('tab'), null);
    assert.equal(press('return'), null);
    press('tab'); press('delete');
    assert.deepEqual(keys.panel!.draft, {});
    press('return'); press('z'); press('tab');
    assert.equal(keys.action('list', { key: 's' }), 'save');
    assert.equal(press('return'), 'save-shortcuts');
    const revision = '1'.repeat(64);
    await keys.perform('save-shortcuts', async (operation, payload) => {
        assert.equal(operation, 'set_editor_shortcuts');
        assert.deepEqual(payload, { bindings: { save: 'Z' }, expected_revision: null });
        return { schema_version: 1, bindings: { save: 'Z' }, revision, warning: null };
    });
    assert.equal(keys.action('list', { key: 'z' }), 'save');
    press('down'); press('return');
    assert.deepEqual(keys.panel!.draft, {});
    assert.equal(keys.action('list', { key: 'z' }), 'save');
    press('g', true); press('return'); // Keep editing is initially selected.
    assert.ok(keys.panel);
    press('g', true); press('down'); press('return');
    assert.equal(keys.panel, null);
    assert.equal(keys.action('list', { key: 'z' }), 'save');
});

test('filter input matches labels and action IDs, preserves selection, and leaves commands available', () => {
    const keys = new EditorShortcuts('terminal');
    keys.open();
    const panel = keys.panel!;
    const press = (key: string, flags = {}) => keys.key({ key, ...flags }, 'zh-CN', 32, 11);
    press('down');
    assert.equal(panel.selected, 'finish');
    press('/');
    press('撤销', { text: true });
    assert.equal(panel.selected, 'undo');
    press('g', { ctrl: true });
    assert.equal(panel.selected, 'finish');
    assert.equal(panel.query, '');

    press('/');
    press('task-evidence', { paste: true });
    press('return');
    assert.equal(panel.selected, 'task-evidence');
    assert.equal(panel.query, 'task-evidence');
    assert.ok(shortcutPanelRows(keys, 'zh-CN', 32, 11).some(row => row.selected && row.text.includes('切换任务证据')));
    assert.ok(shortcutPanelRows(keys, 'zh-CN', 96, 29).some(row => row.selected && row.text.includes('切换任务证据')));
    press('return');
    press('z');
    assert.deepEqual(panel.draft, { 'task-evidence': 'Z' });

    press('/');
    press('u', { ctrl: true });
    press('此查询没有结果', { paste: true });
    press('return');
    press('return');
    press('delete');
    assert.equal(panel.selected, null);
    assert.equal(panel.capture, false);
    assert.ok(shortcutPanelRows(keys, 'zh-CN', 32, 11).some(row => row.text.includes('没有匹配的动作')));
    press('tab');
    assert.equal(press('return'), 'save-shortcuts');
    assert.deepEqual(panel.draft, { 'task-evidence': 'Z' });
});

test('page movement uses the action rows visible with wrapped warnings', () => {
    const keys = new EditorShortcuts('terminal');
    keys.open();
    const panel = keys.panel!;
    panel.message = text('shortcuts.read-failed', { detail: 'Simulated long warning. '.repeat(15) });
    const actions = Object.values(SHORTCUT_GROUPS).flat();
    for (const [width, height] of [[32, 11], [64, 13], [80, 23]] as const) {
        keys.key({ key: 'home' }, 'en', width, height);
        const rows = shortcutPanelRows(keys, 'en', width, height);
        const count = rows.filter(row => row.selected !== undefined).length;
        assert.ok(count > 0);
        if (width === 32) assert.equal(count, 1);
        keys.key({ key: 'pagedown' }, 'en', width, height);
        assert.equal(panel.selected, actions[count]);
        keys.key({ key: 'home' }, 'en', width, height);
        assert.equal(panel.selected, 'save');
    }
});

test('an ignored binding warning survives readback and permits an explicit cleanup save', async () => {
    const keys = new EditorShortcuts('terminal'), revision = '1'.repeat(64);
    const warning = text('shortcuts.ignored-bindings', { keys: 'Ctrl+D' });
    const result = { schema_version: 1 as const, bindings: { save: 'Z' }, revision, warning };
    keys.open();
    const press = (key: string, ctrl = false) => keys.key({ key, ctrl }, 'en', 80, 23);
    await keys.perform('read-shortcuts', async () => result);
    assert.equal(keys.panel!.message?.key, warning.key);
    press('g', true);
    assert.equal(keys.panel, null);
    keys.open();
    press('tab');
    assert.equal(press('return'), 'save-shortcuts');
    await keys.perform('save-shortcuts', async (operation, payload) => {
        assert.equal(operation, 'set_editor_shortcuts');
        assert.deepEqual(payload, { bindings: result.bindings, expected_revision: revision });
        return { ...result, revision: '2'.repeat(64), warning: null };
    });
    assert.equal(keys.snapshot.warning, null);
    assert.equal(keys.panel!.message?.key, 'shortcuts.saved');
});

test('a lost save reply is read back without resubmitting and a conflict needs an explicit reload', async () => {
    const keys = new EditorShortcuts('terminal');
    keys.open();
    const panel = keys.panel!, calls: string[] = [], revision = '1'.repeat(64);
    panel.draft.save = 'Z';
    await keys.perform('save-shortcuts', async operation => {
        calls.push(operation);
        if (operation === 'set_editor_shortcuts') throw new BackendError('backend_timeout', 'Timed out');
        return { schema_version: 1, bindings: { save: 'Z' }, revision, warning: null };
    });
    assert.deepEqual(calls, ['set_editor_shortcuts', 'read_editor_shortcuts']);
    assert.equal(keys.snapshot.revision, revision);
    panel.draft.save = 'X';
    await keys.perform('save-shortcuts', async () => { throw new BackendError('configuration_conflict', text('shortcuts.changed')); });
    assert.equal(panel.needsReload, true);
    assert.deepEqual(panel.draft, { save: 'X' });
    assert.deepEqual(keys.snapshot.bindings, { save: 'Z' });
});
