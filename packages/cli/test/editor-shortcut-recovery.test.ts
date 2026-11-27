import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { type TestContext } from 'node:test';
import { fileURLToPath } from 'node:url';
import { EDITOR_SHORTCUTS_FILENAME, PROTOCOL_VERSION, type EditorShortcutsResult } from '@fbincon/statusline-core/contracts/ui';
import { text } from '@fbincon/statusline-core/i18n/messages';
import { removeTree } from '@fbincon/statusline-platform/remove-tree';
import { readEditorShortcuts, setEditorShortcuts } from '../src/config/editor-shortcuts.js';
import { configurationLockPath, createStorage } from '../src/config/storage.js';
import { base, complete, hash, pending, persist, readJournal, type FileJournal } from '../src/recovery/journal.js';

const entry = fileURLToPath(new URL('../src/entry.js', import.meta.url));
const journalModule = new URL('../src/recovery/journal.js', import.meta.url).href;

function fixture(t: TestContext): string {
    const dir = fs.mkdtempSync(join(tmpdir(), 'shortcut recovery '));
    t.after(() => { removeTree(dir); assert.equal(fs.existsSync(dir), false); });
    return dir;
}

function interrupt(dir: string, bindings: Record<string, string>, expected: string | null, stage: string): void {
    const init = `import { observeTransactions } from ${JSON.stringify(journalModule)};
        observeTransactions((at, journal) => {
            if (journal.action !== 'editor-shortcuts') return;
            if (at === ${JSON.stringify(stage)}) process.exit(77);
            if (${JSON.stringify(stage)} === 'rolling-back' && at === 'applied:0') throw new Error('start rollback');
        });`;
    const preload = 'data:text/javascript;base64,' + Buffer.from(init).toString('base64');
    const result = spawnSync(process.execPath, ['--import', preload, entry, 'ui', '--config-dir', dir], {
        input: JSON.stringify({ operation: 'set_editor_shortcuts', protocol_version: PROTOCOL_VERSION, payload: { expected_revision: expected, bindings } }),
        encoding: 'utf8', timeout: 15000,
    });
    assert.equal(result.status, 77, result.error?.message ?? (result.stderr + result.stdout));
}

function state(dir: string): unknown {
    return fs.readdirSync(dir).sort().map(name => {
        const path = join(dir, name), stat = fs.statSync(path);
        return [name, stat.mode, stat.isDirectory() ? state(path) : hash(fs.readFileSync(path))];
    });
}

function recoveryWarning(result: EditorShortcutsResult): void {
    assert.deepEqual(result, { schema_version: 1, revision: null, bindings: {},
        warning: text('shortcuts.read-failed', { detail: text('shortcuts.read-recovery') }) });
}

const set: Record<string, string> = { save: 'J' }, changed: Record<string, string> = { save: 'Z' };
for (const [operation, before, after, stages] of [
    ['create', {}, changed, ['applied:0', 'committed']],
    ['replace', set, changed, ['prepared', 'before-write:0', 'applied:0', 'rolling-back', 'committed', 'cleared']],
    ['delete', set, {}, ['applied:0', 'committed']],
] as const) {
    test('shortcut readback agrees with real CLI recovery after interrupted ' + operation, t => {
        const io = createStorage();
        for (const stage of stages) {
            const dir = fixture(t);
            const initial = Object.keys(before).length ? setEditorShortcuts(dir, before, null, io) : readEditorShortcuts(dir, io);
            interrupt(dir, after, initial.revision, stage);
            const disk = state(dir);
            const snapshot = readEditorShortcuts(dir, io);
            assert.deepEqual(state(dir), disk, 'read modified the interrupted transaction: ' + stage);
            const committed = stage === 'committed' || stage === 'cleared';
            if (committed) {
                assert.equal(snapshot.warning, null);
                assert.deepEqual(snapshot.bindings, after);
            } else recoveryWarning(snapshot);
            const recovery = spawnSync(process.execPath, [entry, 'recover', '--config-dir', dir], { encoding: 'utf8', timeout: 15000 });
            assert.equal(recovery.status, 0, recovery.error?.message ?? recovery.stderr);
            assert.deepEqual(pending(dir), []);
            const current = readEditorShortcuts(dir, io);
            assert.equal(current.warning, null);
            assert.deepEqual(current.bindings, committed ? after : before, stage);
            if (committed) assert.deepEqual(current, snapshot);
        }
    });
}

test('shortcut readback isolates verified unrelated transactions and rejects unclassifiable journals', t => {
    const dir = fixture(t), io = createStorage(), saved = setEditorShortcuts(dir, set, null, io);
    const other: FileJournal = { ...base(dir, 'editor-shortcuts', 'files'), kind: 'files', phase: 'applying', progress: 0, backup: null,
        entries: [{ path: 'statusline-ui.json', before: null, after: null, mode: null, snapshot: null }] };
    persist(other);
    assert.deepEqual(readEditorShortcuts(dir, io), saved, 'the target entry, not the action label, identifies a shortcut transaction');
    persist({ ...base(dir, 'unrelated', 'official'), kind: 'official', phase: 'prepared', spec: 'statusline-native', args: [], values: null, before: null });
    assert.deepEqual(readEditorShortcuts(dir, io), saved);
    const [journal] = pending(dir);
    fs.writeFileSync(journal!, 'broken');
    const disk = state(dir);
    recoveryWarning(readEditorShortcuts(dir, io));
    assert.deepEqual(state(dir), disk);
});

test('committed shortcut verification refuses mismatched targets, before-images and orphaned journals', t => {
    const dir = fixture(t), io = createStorage(), initial = setEditorShortcuts(dir, set, null, io);
    interrupt(dir, changed, initial.revision, 'committed');
    const path = join(dir, EDITOR_SHORTCUTS_FILENAME), desired = fs.readFileSync(path);
    fs.writeFileSync(path, '{}');
    recoveryWarning(readEditorShortcuts(dir, io));
    fs.writeFileSync(path, desired);
    const [journalPath] = pending(dir), journal = readJournal(dir, journalPath!);
    assert.equal(journal.kind, 'files');
    if (journal.kind !== 'files') assert.fail('expected file journal');
    const backup = join(dir, journal.entries[0]!.snapshot!), original = fs.readFileSync(backup);
    fs.writeFileSync(backup, 'unexpected');
    recoveryWarning(readEditorShortcuts(dir, io));
    fs.writeFileSync(backup, original);
    assert.deepEqual(readEditorShortcuts(dir, io).bindings, changed);
    persist({ ...journal, progress: 0 });
    recoveryWarning(readEditorShortcuts(dir, io));
    persist(journal);
    const duplicate = { ...journal, id: base(dir, 'second', 'files').id };
    persist(duplicate);
    recoveryWarning(readEditorShortcuts(dir, io));
    complete(duplicate);
    fs.unlinkSync(configurationLockPath(dir));
    recoveryWarning(readEditorShortcuts(dir, io));
    assert.equal(fs.existsSync(configurationLockPath(dir)), false);
});

test('fresh shortcut reads create no storage and return the first fully locked publication', t => {
    const dir = fixture(t), io = createStorage(), path = join(dir, EDITOR_SHORTCUTS_FILENAME);
    assert.equal(readEditorShortcuts(dir, io).warning, null);
    assert.deepEqual(fs.readdirSync(dir), []);
    let published = false;
    const read = readEditorShortcuts(dir, { ...io, read(file) {
        const raw = io.read(file);
        if (!published && file === path) {
            published = true;
            setEditorShortcuts(dir, changed, null, io);
        }
        return raw;
    } });
    assert.equal(published, true);
    assert.deepEqual(read, readEditorShortcuts(dir, io));
    assert.deepEqual(read.bindings, changed);
});

test('the wire reader returns a distinct retryable warning while a live writer holds the lock', t => {
    const dir = fixture(t), io = createStorage(), saved = setEditorShortcuts(dir, set, null, io);
    io.lock(dir, () => {
        const disk = state(dir);
        const reply = spawnSync(process.execPath, [entry, 'ui', '--config-dir', dir], {
            input: JSON.stringify({ operation: 'read_editor_shortcuts', protocol_version: PROTOCOL_VERSION, payload: {} }),
            encoding: 'utf8', timeout: 10000,
        });
        assert.equal(reply.status, 0, reply.error?.message ?? reply.stderr);
        assert.deepEqual(JSON.parse(reply.stdout), { protocol_version: PROTOCOL_VERSION, result: {
            schema_version: 1, revision: null, bindings: {}, warning: text('shortcuts.read-failed', { detail: text('shortcuts.read-busy') }),
        } });
        assert.deepEqual(state(dir), disk);
    });
    assert.deepEqual(readEditorShortcuts(dir, io), saved);
});
