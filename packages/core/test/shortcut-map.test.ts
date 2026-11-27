import test from 'node:test';
import assert from 'node:assert/strict';
import { BackendError } from '../src/editor/backend.js';
import { text } from '../src/i18n/messages.js';
import { SHORTCUT_GROUPS, isBindingMap, listedShortcut, resolveShortcut, shortcutConflict } from '../src/editor/shortcut-map.js';
import { EditorShortcuts, shortcutPanelRows } from '../src/editor/shortcut-settings.js';

test('presets are reachable and shared overrides replace context-specific aliases', () => {
    assert.equal(shortcutConflict({}), null);
    for (const action of Object.values(SHORTCUT_GROUPS).flat())
        assert.ok(listedShortcut('terminal', action, {}) || listedShortcut('native', action, {}), action);
    assert.equal(resolveShortcut('native', 'list', { key: 'A', ctrl: true }, {}), 'add-item');
    assert.equal(resolveShortcut('native', 'list', { key: '_', ctrl: true }, {}), 'undo');
    assert.equal(resolveShortcut('terminal', 'list', { key: 'return' }, {}), 'save');
    assert.equal(resolveShortcut('native', 'list', { key: 'return' }, {}), 'toggle-item');

    const bindings = { save: 'Z', undo: 'Ctrl+Z', 'toggle-item': 'Enter', 'move-left': 'Right', 'move-right': 'Left' } as const;
    assert.ok(isBindingMap(bindings));
    assert.equal(shortcutConflict(bindings), null);
    for (const surface of ['terminal', 'native'] as const) {
        assert.equal(resolveShortcut(surface, 'list', { key: 'z' }, bindings), 'save');
        assert.equal(resolveShortcut(surface, 'list', { key: 's', ctrl: surface === 'terminal' }, bindings), null);
        assert.equal(resolveShortcut(surface, 'list', { key: 'right' }, bindings), 'move-left');
        assert.equal(resolveShortcut(surface, 'settings', { key: 'right' }, bindings), null);
        assert.equal(resolveShortcut(surface, 'list', { key: 'return' }, bindings), 'toggle-item');
        assert.equal(resolveShortcut(surface, 'history', { key: 'Z', ctrl: true }, bindings), 'undo');
        for (const flags of [{ paste: true }, { text: true }, { meta: true }, { overflow: true }])
            assert.equal(resolveShortcut(surface, 'list', { key: 'z', ...flags }, bindings), null);
    }
    assert.equal(resolveShortcut('native', 'list', { key: '/', ctrl: true }, bindings), null);
});

test('conflicts include defaults and the other editor while disjoint contexts can reuse keys', () => {
    assert.deepEqual(shortcutConflict({ save: 'Ctrl+D' }), { surface: 'terminal', context: 'list', key: 'Ctrl+D', first: 'save', second: 'copy-item' });
    assert.equal(shortcutConflict({ save: 'Z', 'reload-profiles': 'Z' }), null);
    for (const bindings of [{ save: 'Tab' }, { save: 'Ctrl+G' }, { save: 'Ctrl+H' }, { save: '1' }, { save: 'Enter' },
        { 'save-source': 'Z' }, { 'task-search': 'K' }, { 'open-unknown': 'Q' }, { save: 'Z\n' }, { save: 'Ctrl+Z\n' }])
        assert.equal(isBindingMap(bindings), false, JSON.stringify(bindings));
});

test('shortcut settings keep staging, conflict advice and reset separate from active keys', async () => {
    const keys = new EditorShortcuts('native');
    keys.open();
    const press = (key: string, ctrl = false) => keys.key({ key, ctrl }, 3);
    press('return');
    keys.key({ key: 'P', text: true }, 3);
    assert.equal(keys.panel!.capture, true);
    press('d', true);
    const conflict = shortcutPanelRows(keys, 'en', 32, 11).map(row => row.text).join(' ');
    assert.match(conflict, /Terminal editor.*Ctrl\+D.*Save display.*Copy component/);
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
