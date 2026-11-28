import assert from 'node:assert/strict';
import test from 'node:test';
import { BackendError } from '../src/editor/backend.js';
import { defaultShortcuts, EditorShortcuts, shortcutPanelView } from '../src/editor/shortcut-settings.js';
import { wrapText } from '../src/editor/text.js';
import { LANGUAGES, renderMessage, text } from '../src/i18n/messages.js';

const prior = { ...defaultShortcuts(), revision: 'a'.repeat(64), bindings: { save: 'J' } };
const persisted = { ...defaultShortcuts(), revision: 'b'.repeat(64), bindings: { save: 'Z' } };
const warning = text('shortcuts.read-failed', { detail: text('shortcuts.read-recovery') });

for (const surface of ['terminal', 'native'] as const) {
    test(surface + ' preserves its active map and staged save until readback is authoritative', async () => {
        const keys = new EditorShortcuts(surface);
        keys.snapshot = prior;
        keys.open();
        const calls: string[] = [];
        keys.panel!.draft.save = 'Z';
        await keys.perform('save-shortcuts', async operation => {
            calls.push(operation);
            if (operation === 'set_editor_shortcuts') throw new BackendError('backend_exit', 'no reply');
            return defaultShortcuts(warning);
        });
        assert.deepEqual(calls, ['set_editor_shortcuts', 'read_editor_shortcuts']);
        assert.equal(keys.snapshot, prior);
        assert.deepEqual(keys.panel!.draft, { save: 'Z' });
        assert.equal(keys.panel!.message, warning);
        assert.equal(keys.panel!.needsReload, true);
        await keys.perform('read-shortcuts', async () => defaultShortcuts(warning));
        assert.deepEqual(keys.panel!.draft, { save: 'Z' });
        keys.key({ key: 'escape' }, 'en', 32, 12);
        keys.key({ key: 'down' }, 'en', 32, 12);
        keys.key({ key: 'return' }, 'en', 32, 12);
        assert.equal(keys.panel, null);
        keys.open();
        assert.equal(keys.panel!.needsReload, true);
        await keys.perform('save-shortcuts', async () => assert.fail('sent a second write'));
        await keys.perform('read-shortcuts', async () => persisted);
        assert.equal(keys.snapshot, persisted);
        assert.equal(keys.panel!.needsReload, false);
        assert.deepEqual(keys.panel!.draft, { save: 'Z' });
    });

    test(surface + ' requires a successful read after startup or manual read failure', async () => {
        const keys = new EditorShortcuts(surface);
        keys.snapshot = defaultShortcuts(warning);
        keys.open();
        assert.equal(keys.panel!.needsReload, true);
        await keys.perform('read-shortcuts', async () => prior);
        keys.panel!.draft.save = 'Z';
        await keys.perform('read-shortcuts', async () => { throw new Error('offline'); });
        assert.equal(keys.snapshot, prior);
        assert.deepEqual(keys.panel!.draft, { save: 'Z' });
        assert.equal(keys.panel!.needsReload, true);
        await keys.perform('read-shortcuts', async () => persisted);
        assert.equal(keys.panel!.needsReload, false);
    });
}

test('a recovery error permits only a readback and confirms a committed matching value', async () => {
    for (const result of [persisted, prior, defaultShortcuts(warning)]) {
        const keys = new EditorShortcuts('native'), calls: string[] = [];
        keys.snapshot = prior;
        keys.open();
        keys.panel!.draft.save = 'Z';
        await keys.perform('save-shortcuts', async operation => {
            calls.push(operation);
            if (operation === 'set_editor_shortcuts') throw new BackendError('configuration_conflict', text('recovery.required', { detail: 'unfinished' }));
            return result;
        });
        assert.deepEqual(calls, ['set_editor_shortcuts', 'read_editor_shortcuts']);
        assert.equal(keys.panel!.needsReload, result !== persisted);
        assert.equal(keys.snapshot, result === persisted ? persisted : prior);
        assert.deepEqual(keys.panel!.draft, { save: 'Z' });
        assert.equal(keys.panel!.message?.key, result === persisted ? 'shortcuts.saved' : result.warning ? 'shortcuts.read-failed' : 'shortcuts.read-recovery');
    }
});

test('both recovery instructions fit with the selected action and controls in all languages at 32×12', () => {
    for (const language of LANGUAGES) for (const surface of ['native', 'terminal'] as const) {
        for (const reason of ['shortcuts.read-busy', 'shortcuts.read-recovery']) {
            const keys = new EditorShortcuts(surface), detail = text(reason);
            keys.snapshot = defaultShortcuts(text('shortcuts.read-failed', { detail }));
            keys.open();
            for (const query of ['', 'save']) {
                keys.panel!.query = query;
                const view = shortcutPanelView(keys, language, 32, 12);
                assert.ok(view.body.length + 1 <= view.bodyHeight);
                assert.ok(view.body.some(row => row.selected === true));
                for (const line of wrapText([renderMessage(detail, language)], view.innerWidth))
                    assert.ok(view.body.some(row => row.text === line), language + '/' + reason + ': ' + line);
                assert.ok(view.footer.some(row => row.text === renderMessage(text('shortcuts.back-help', { tab: 'Tab', back: 'Ctrl+G' }), language)));
                assert.ok(view.menu.some(item => item.text.includes(renderMessage(text('shortcuts.save'), language))));
            }
        }
    }
});
