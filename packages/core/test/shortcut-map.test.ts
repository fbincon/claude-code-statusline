import test from 'node:test';
import assert from 'node:assert/strict';
import { BackendError, parseResponse } from '../src/editor/backend.js';
import { PROTOCOL_VERSION } from '../src/contracts/ui.js';
import { t, text } from '../src/i18n/messages.js';
import { SHORTCUT_GROUPS, isBindingMap, listedShortcut, readShortcutBindings, resolveShortcut, shortcutAliases, shortcutConflict, shortcutHint } from '../src/editor/shortcut-map.js';
import { EditorShortcuts, shortcutPanelRows } from '../src/editor/shortcut-settings.js';

test('presets are reachable and shared overrides replace context-specific aliases', () => {
    assert.equal(shortcutConflict({}), null);
    for (const action of Object.values(SHORTCUT_GROUPS).flat())
        assert.ok(listedShortcut('terminal', action, {}) || listedShortcut('native', action, {}), action);
    assert.equal(resolveShortcut('native', 'list', { key: 'A', ctrl: true }, {}), 'add-item');
    assert.equal(resolveShortcut('native', 'list', { key: '_', ctrl: true }, {}), 'undo');
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

test('configured lists share toggle keys and keep their own save bindings', () => {
    for (const surface of ['terminal', 'native'] as const) {
        const saveKey = { key: 's', ctrl: surface === 'terminal' };
        const saveLabel = surface === 'terminal' ? 'Ctrl+S' : 'S';
        assert.equal(resolveShortcut(surface, 'list', { key: 'return' }, {}), 'toggle-item');
        assert.equal(resolveShortcut(surface, 'list', { key: ' ' }, {}), 'toggle-item');
        assert.equal(resolveShortcut(surface, 'list', saveKey, {}), 'save');
        assert.equal(shortcutAliases(surface, 'list', {}, 'toggle-item'), 'Enter/Space');
        assert.equal(shortcutHint(surface, 'list', {}, 'save'), saveLabel);
        assert.equal(shortcutAliases(surface, 'list', {}, 'save'), saveLabel);
        for (const context of ['picker', 'settings', 'detail', 'layout'] as const)
            assert.equal(resolveShortcut(surface, context, { key: 'return' }, {}), null);
    }
});

test('terminal Settings reserve Enter and use the active save binding', () => {
    const remapped = { save: 'Z' };
    for (const context of ['settings', 'numeric-settings', 'refresh-settings'] as const) {
        assert.equal(resolveShortcut('terminal', context, { key: 'return' }, {}), null);
        assert.equal(resolveShortcut('terminal', context, { key: 'return' }, remapped), null);
        assert.equal(resolveShortcut('terminal', context, { key: 's', ctrl: true }, {}), 'save');
        assert.equal(resolveShortcut('terminal', context, { key: 's', ctrl: true }, remapped), null);
        assert.equal(resolveShortcut('terminal', context, { key: 'z' }, remapped), 'save');
        assert.equal(shortcutAliases('terminal', context, {}, 'save'), 'Ctrl+S');
        assert.equal(shortcutAliases('terminal', context, remapped, 'save'), 'Z');
    }
});

test('refresh event mode retains its preset and accepts remaps that leave field keys free', () => {
    for (const key of ['Space', 'Left', 'Right', '0', '9']) {
        const bindings = { save: 'Z', 'event-refresh': key };
        assert.equal(isBindingMap(bindings), false, key);
        assert.equal(readShortcutBindings(bindings), null, key);
    }
    assert.equal(isBindingMap({ save: 'Z', 'event-refresh': 'Enter' }), false);
    assert.equal(readShortcutBindings({ 'event-refresh': 'Enter' }), null, 'Enter already belonged to the old Save preset');
    assert.equal(resolveShortcut('terminal', 'refresh-settings', { key: 'e' }, {}), 'event-refresh');
    assert.equal(resolveShortcut('terminal', 'numeric-settings', { key: 'e' }, {}), null);
    assert.equal(resolveShortcut('native', 'settings', { key: 'e' }, {}), null);
    const remapped = { save: 'Z', 'event-refresh': 'J' };
    assert.deepEqual(readShortcutBindings(remapped), { bindings: remapped, warning: null });
    assert.equal(resolveShortcut('terminal', 'refresh-settings', { key: 'e' }, remapped), null);
    assert.equal(resolveShortcut('terminal', 'refresh-settings', { key: 'j' }, remapped), 'event-refresh');
});

test('existing shared remaps keep precedence over the configured list presets', () => {
    const remapped = { save: 'Z', 'toggle-item': 'T', 'add-item': 'Enter' };
    const spaceOnly = { 'toggle-item': 'Space' };
    for (const bindings of [remapped, spaceOnly])
        assert.deepEqual(readShortcutBindings(bindings), { bindings, warning: null });
    for (const surface of ['terminal', 'native'] as const) {
        assert.equal(resolveShortcut(surface, 'list', { key: 'return' }, remapped), 'add-item');
        assert.equal(resolveShortcut(surface, 'list', { key: 't' }, remapped), 'toggle-item');
        assert.equal(shortcutAliases(surface, 'list', remapped, 'save'), 'Z');
        assert.equal(resolveShortcut(surface, 'list', { key: 'return' }, spaceOnly), null);
        assert.equal(shortcutAliases(surface, 'list', spaceOnly, 'toggle-item'), 'Space');
    }
    const enterOnly = { 'toggle-item': 'Enter' };
    assert.deepEqual(readShortcutBindings(enterOnly), { bindings: enterOnly, warning: null });
    assert.equal(shortcutAliases('terminal', 'list', enterOnly, 'toggle-item'), 'Enter');
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
    assert.equal(readShortcutBindings({ 'toggle-item': 'Enter', 'reload-profiles': 'Ctrl+D' }), null, 'The old terminal Enter save also conflicted');
    const result = { schema_version: 1, bindings, revision: '1'.repeat(64), warning: null };
    const response = { exitCode: 0, stdout: JSON.stringify({ protocol_version: PROTOCOL_VERSION, result }), stderr: '' };
    assert.deepEqual(parseResponse('read_editor_shortcuts', response), { ...result, ...compatible });
    assert.throws(() => parseResponse('set_editor_shortcuts', response), BackendError);
});

test('retired source arrows and refresh Enter preserve bindings valid in their editor generation', () => {
    for (const arrow of ['Left', 'Right']) {
        const previous = { 'toggle-item': 'Enter', search: 'T', 'reload-sources': arrow };
        assert.equal(isBindingMap(previous), false);
        const projected = readShortcutBindings(previous);
        assert.deepEqual(projected, { bindings: { 'toggle-item': 'Enter', search: 'T' },
            warning: text('shortcuts.ignored-bindings', { keys: arrow }) });
        for (const surface of ['native', 'terminal'] as const) {
            assert.equal(resolveShortcut(surface, 'sources', { key: arrow.toLowerCase() }, projected!.bindings), null);
            assert.equal(resolveShortcut(surface, 'sources', { key: 'r' }, projected!.bindings), 'reload-sources');
        }
    }
    const previous = { save: 'Z', search: 'T', history: 'E', sources: 'Ctrl+T', 'event-refresh': 'Enter', 'reload-sources': 'Left' };
    const projected = readShortcutBindings(previous);
    assert.deepEqual(projected, { bindings: { save: 'Z', search: 'T' },
        warning: text('shortcuts.ignored-bindings', { keys: 'Enter, Left, E, Ctrl+T' }) });
    assert.equal(resolveShortcut('terminal', 'refresh-settings', { key: 'return' }, projected!.bindings), null);
    assert.equal(resolveShortcut('terminal', 'refresh-settings', { key: 'e' }, projected!.bindings), 'event-refresh');

    const oldest = { save: 'Z', search: 'T', undo: 'Ctrl+Z', redo: 'U', 'event-refresh': 'Enter', 'reload-sources': 'Right' };
    assert.deepEqual(readShortcutBindings(oldest), { bindings: { save: 'Z', search: 'T' },
        warning: text('shortcuts.ignored-bindings', { keys: 'Ctrl+Z, Enter, Right, U' }) });
    for (const invalid of [
        { 'event-refresh': 'Enter', 'reload-sources': 'Right' },
        { ...previous, history: 'B', sources: 'B' },
        { ...oldest, unknown: 'M' },
        { 'toggle-item': 'Enter', undo: 'Ctrl+Z', 'reload-sources': 'Left' },
    ]) assert.equal(readShortcutBindings(invalid), null);
});

test('protocol 33 reads combine prior and current compatibility warnings while writes remain strict', () => {
    const reply = (bindings: unknown, warning: unknown) => ({ exitCode: 0, stderr: '', stdout: JSON.stringify({
        protocol_version: PROTOCOL_VERSION, result: { schema_version: 1, bindings, revision: 'a'.repeat(64), warning },
    }) });
    const previous = { save: 'Z', search: 'T', 'event-refresh': 'Enter', 'reload-sources': 'Right' };
    const skipped = text('shortcuts.ignored-bindings', { keys: 'Ctrl+Z, U' });
    const merged = parseResponse('read_editor_shortcuts', reply(previous, skipped));
    assert.deepEqual(merged, { schema_version: 1, revision: 'a'.repeat(64), bindings: { save: 'Z', search: 'T' },
        warning: text('shortcuts.ignored-bindings', { keys: 'Ctrl+Z, U, Enter, Right' }) });
    assert.deepEqual(parseResponse('read_editor_shortcuts', reply(merged.bindings, merged.warning)), merged);
    assert.throws(() => parseResponse('read_editor_shortcuts', reply({ 'event-refresh': 'Enter' }, skipped)), BackendError);
    assert.throws(() => parseResponse('read_editor_shortcuts', reply({ ...previous, undo: 'Ctrl+Z' }, skipped)), BackendError);
    assert.throws(() => parseResponse('set_editor_shortcuts', reply(previous, null)), BackendError);
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

test('shortcut settings put common editor and component actions first', () => {
    const keys = new EditorShortcuts('terminal');
    keys.open();
    for (const action of [
        'save', 'finish', 'close', 'undo', 'redo', 'history', 'reload', 'retry-preview',
        'toggle-item', 'search', 'category', 'item-details', 'add-item', 'copy-item', 'remove-item',
    ]) {
        assert.equal(keys.panel!.selected, action);
        keys.key({ key: 'down' }, 'en', 32, 11);
    }
});

test('shortcut settings show each editor’s save key at narrow widths', () => {
    for (const surface of ['terminal', 'native'] as const) {
        for (const language of ['en', 'zh-CN'] as const) {
            const keys = new EditorShortcuts(surface);
            keys.open();
            const tr = (key: string) => t('shortcuts.' + key, language);
            const rows = () => shortcutPanelRows(keys, language, 32, 11);
            const panelText = () => rows().map(row => row.text).join(' ');
            assert.equal(rows().find(row => row.selected)?.text,
                `› ${surface === 'terminal' ? 'Ctrl+S' : 'S'}  ${tr('action.save')}`);
            assert.ok(panelText().includes(`${tr('terminal-short')} Ctrl+S [Ctrl+S]`));
            assert.ok(panelText().includes(`${tr('native-short')} S [S]`));
            keys.panel!.draft.save = 'Z';
            assert.ok(panelText().includes(`${tr('terminal-short')} Z [Ctrl+S]`));
            assert.ok(panelText().includes(`${tr('native-short')} Z [S]`));
            assert.ok(!panelText().includes('[Ctrl+S / Enter]'));
            assert.ok(panelText().includes(tr('back-help')));
        }
    }
});

test('shortcut settings refuse Enter when capturing the refresh event action', () => {
    for (const surface of ['terminal', 'native'] as const) {
        const keys = new EditorShortcuts(surface);
        keys.snapshot.bindings = { save: 'Z' };
        keys.open();
        const press = (key: string, paste = false) => keys.key({ key, paste }, 'en', 32, 11);
        const panelText = () => shortcutPanelRows(keys, 'en', 32, 11).map(row => row.text).join(' ');
        press('/');
        press('event-refresh', true);
        press('return');
        assert.equal(keys.panel!.selected, 'event-refresh');
        assert.match(panelText(), /Terminal E \[E\]/);

        press('return');
        press('return');
        assert.equal(keys.panel!.capture, true);
        assert.equal(keys.panel!.message?.key, 'shortcuts.unavailable-key');
        assert.deepEqual(keys.panel!.draft, { save: 'Z' });

        press('j');
        assert.equal(keys.panel!.capture, false);
        assert.equal(keys.panel!.message, null);
        assert.deepEqual(keys.panel!.draft, { save: 'Z', 'event-refresh': 'J' });
        assert.match(panelText(), /Terminal J \[E\]/);
    }
});

test('page movement uses the action rows visible with wrapped warnings', () => {
    const keys = new EditorShortcuts('terminal');
    keys.open();
    const panel = keys.panel!;
    panel.message = text('shortcuts.read-failed', { detail: 'Simulated long warning. '.repeat(15) });
    for (const [width, height] of [[32, 11], [64, 13], [80, 23]] as const) {
        keys.key({ key: 'home' }, 'en', width, height);
        const rows = shortcutPanelRows(keys, 'en', width, height);
        const count = rows.filter(row => row.selected !== undefined).length;
        assert.ok(count > 0);
        if (width === 32) assert.equal(count, 2);
        for (let i = 0; i < count; i++) keys.key({ key: 'down' }, 'en', width, height);
        const expected = panel.selected;
        keys.key({ key: 'home' }, 'en', width, height);
        keys.key({ key: 'pagedown' }, 'en', width, height);
        assert.equal(panel.selected, expected);
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
