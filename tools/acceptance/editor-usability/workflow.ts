import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { t } from '@fbincon/statusline-core/i18n/messages';
import { back, captureWhen, clear, enter, open, pageDown, snapshot, type EditorJourney } from './terminal.js';

export const dropApplyReplyFile = 'editor-audit-drop-apply';

export async function verifyInitialFocus(j: EditorJourney, focusBody: () => Promise<void>): Promise<void> {
    const tr = (key: string) => t(key, j.language);
    await captureWhen(j, 'native-focus-instruction', t('native.ui.client.draw.click_region_for_keys', j.language, { escape: 'Esc' }));
    await j.key('2', 'a key before focusing stays in Claude');
    await j.until(screen => /❯[\s\u00a0]+2(?:\s|$)/u.test(screen), 'Claude prompt received 2');
    j.frame('native-before-focus');
    await j.key('\x7f', 'erase the key in Claude without submitting a prompt');
    await focusBody();
    await j.key('2', 'the same key reaches the focused editor');
    await captureWhen(j, 'native-focused-subagents', tr('composition.configured_subagents').split('{state}')[0]!.trim());
    assert(!/❯[\s\u00a0]+2(?:\s|$)/u.test(j.read()));
    await j.key('\x1b', 'Esc returns focus to Claude');
    await j.key('1', 'verify Claude receives keys after releasing focus');
    await j.until(screen => /❯[\s\u00a0]+1(?:\s|$)/u.test(screen), 'Claude prompt received 1 after Esc');
    j.frame('native-released-focus');
    await j.key('\x7f', 'erase the key without submitting a prompt');
    await focusBody();
    await j.key('1', 'return to Main');
    await j.until(screen => screen.includes(tr('composition.configured_title')), 'main editor restored');
}

export async function workflowJourney(j: EditorJourney): Promise<void> {
    const tr = (key: string, params: Record<string, unknown> = {}) => t(key, j.language, params);
    const displayPath = join(j.config, 'claude-statusline.json');
    const profilePath = join(j.config, 'claude-statusline-profiles.json');
    const displayBefore = snapshot(displayPath);
    if (j.external) j.resize(64, 18);

    await j.key('\x05', 'Ctrl+E opens item format');
    await open(j, tr('reuse.style'));
    await open(j, tr('reuse.portable'));
    await j.until(text => text.includes(tr('reuse.path')), 'visual reuse path input is open');
    const missing = 'missing-audit.json';
    await j.key(clear, 'clear the reuse path');
    await j.key(missing, 'enter a missing fixture path');
    await j.key(enter, 'attempt to read the missing file');
    await captureWhen(j, 'reuse-path-error', missing, tr('history.file_missing'));
    await j.key(back, 'leave the failed reuse path');
    await j.key(back, 'leave the reuse or item format page');
    for (let step = 0; step < 2 && !j.read().includes(tr('composition.configured_title')); step++)
        await j.key(back, 'return to configured components');
    assert.deepEqual(snapshot(displayPath), displayBefore);

    const destination = 'occupied-audit.json', occupied = join(j.project, destination);
    writeFileSync(occupied, '{"mustRemain":true}\n', { mode: 0o600 });
    const original = snapshot(occupied);
    await j.key('\x14', 'Ctrl+T opens draft history');
    await j.key('e', 'E opens export to a new file');
    await j.until(text => text.includes(tr('history.export_path')), 'export path input is open');
    await j.key(clear, 'clear the export path');
    await j.key(occupied, 'enter the existing isolated file');
    await j.key(enter, 'try exporting without overwriting');
    await captureWhen(j, 'export-path-error', destination, tr('history.file_exists'));
    assert.deepEqual(snapshot(occupied), original, 'An existing export target changed');
    await j.key(back, 'return from export path to history');
    await j.key(back, 'return from history to editor');

    const project = join(j.project, 'audit-binding'), profile = 'Audit scheme';
    mkdirSync(project, { mode: 0o700, recursive: true });
    const profilesBefore = snapshot(profilePath), profileWrites = j.requestCount('profiles_apply');
    await j.key('\x0f', 'Ctrl+O opens configuration schemes');
    await open(j, tr('profiles.action.save_bind'));
    await j.until(text => text.includes(tr('profiles.field.name')), 'new scheme name is editable');
    await j.key(profile, 'type the proposed scheme name');
    await j.key(enter, 'focus the project path');
    await j.key(clear, 'clear the default project path');
    await j.key(project, 'enter the intended project path');
    await j.key(enter, 'review save and bind');
    await captureWhen(j, 'profile-confirmation-first-page', tr('profiles.confirm_title.save_bind'), profile);
    for (let i = 0; i < 4 && !j.read().includes('audit-binding'); i++)
        await j.key(pageDown, 'read the reviewed project path');
    await captureWhen(j, 'profile-confirmation-target', 'audit-binding');
    assert(j.selected(tr('profiles.cancel')), 'Cancel is not selected by default');
    await j.key(enter, 'confirm the selected cancellation');
    await captureWhen(j, 'profile-confirmation-cancelled', tr('profiles.title'), tr('profiles.action.save_bind'));
    assert.equal(j.requestCount('profiles_apply'), profileWrites, 'Confirmation cancel issued a profile write');
    assert.deepEqual(snapshot(profilePath), profilesBefore);
    assert.deepEqual(snapshot(displayPath), displayBefore);
    for (let step = 0; step < 3 && !j.read().includes(tr('composition.configured_title')); step++)
        await j.key(back, 'return to configured components');

    await j.key(j.external ? '\x04' : 'd', 'create one unsaved component copy');
    await captureWhen(j, 'draft-before-lost-reply', tr('native.ui.client.draw.configure_status_line') + ' *');
    assert.deepEqual(snapshot(displayPath), displayBefore);
    writeFileSync(join(j.config, dropApplyReplyFile), '', { mode: 0o600, flag: 'wx' });
    const applyBefore = j.requestCount('apply');
    const check = tr(j.external ? 'editor.check_saved' : 'ui.hints.check_saved_state').toLowerCase();
    await j.key(j.external ? '\x13' : 's', 'write once and lose only the reply');
    await j.until(text => text.toLowerCase().includes(check), 'a real save can now be checked');
    const submitted = snapshot(displayPath);
    assert(submitted && !submitted.bytes.equals(displayBefore!.bytes), 'The dropped reply did not follow a real save');
    assert.equal(j.requestCount('apply'), applyBefore + 1);
    j.frame('save-unknown');
    await j.key('\x19', 'open read-only sources despite the unresolved save');
    await captureWhen(j, 'save-unknown-sources', tr('sources.title'), 'Ctrl+G');
    if (!j.external) {
        await j.until(text => text.includes(tr('editor.save_check_from_editor')), 'source modal explains the return route');
        assert(!j.read().includes(tr('ui.hints.check_saved_state')), 'Native source modal advertises a check key it does not handle');
        await j.key('k', 'the Native source modal does not consume K as readback');
    }
    await j.key(back, 'leave sources for the save check');
    await j.until(text => text.toLowerCase().includes(check), 'save check is visible again');
    const reads = j.requestCount('read');
    await j.key(j.external ? '\x0b' : 'k', 'check the saved revision without resaving');
    await captureWhen(j, 'save-confirmed', tr(j.external ? 'editor.saved' : 'native.hooks.register.the_submitted_tool_configuration_is_saved'));
    assert.equal(j.requestCount('read'), reads + 1);
    assert.equal(j.requestCount('apply'), applyBefore + 1);
    assert.deepEqual(snapshot(displayPath), submitted);

    if (!j.external) {
        await j.key('d', 'change the draft before shrinking the Native pane');
        const modified = tr('native.ui.client.draw.configure_status_line') + ' *';
        await captureWhen(j, 'native-before-resize', modified);
        j.resize(96, 20);
        const minimum = tr('native.ui.client.draw.body_minimum', { columns: 32, rows: 12 });
        const sizePrefix = tr('native.ui.client.draw.body_size', { columns: '', rows: '' }).split('×')[0]!.trim();
        await captureWhen(j, 'native-small-body', minimum, sizePrefix);
        j.resize(200, 50);
        await captureWhen(j, 'native-widened-draft', modified);
        assert.deepEqual(snapshot(displayPath), submitted);
    }
}
