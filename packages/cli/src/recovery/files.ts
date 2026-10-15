import * as fs from 'node:fs';
import { join, dirname } from 'node:path';
import type { Storage } from '../config/storage.js';
import type { Change } from '../integration/transaction.js';
import { safeTarget } from '../integration/paths.js';
import { assertClear, allowedArtifact, hash, base, persist, complete, checkpoint, relativePath, readRegular, active, RecoveryRequired, type FileJournal } from './journal.js';
function mode(path: string): number | null {
    if (process.platform === 'win32' || !fs.existsSync(path))
        return null;
    return fs.statSync(path).mode & 0o777;
}
function restoreMode(path: string, value: number | null): void {
    if (value === null || process.platform === 'win32')
        return;
    const fd = fs.openSync(path, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
    try {
        fs.fchmodSync(fd, value);
        fs.fsyncSync(fd);
    }
    finally {
        fs.closeSync(fd);
    }
}
function verify(journal: FileJournal, io: Storage): (Buffer | null)[] {
    if (active(journal))
        throw new RecoveryRequired('Transaction owner is still running');
    return journal.entries.map(entry => {
        const path = join(journal.configDir, entry.path);
        safeTarget(journal.configDir, path);
        const actual = hash(io.read(path)), expected = journal.phase === 'committed' ? [entry.after] : [entry.before, entry.after];
        if (!expected.includes(actual))
            throw new RecoveryRequired('Recovery conflict; a file changed after the transaction: ' + path);
        const actualMode = mode(path);
        if (actualMode !== null && ![entry.mode, 0o600].includes(actualMode))
            throw new RecoveryRequired('Recovery conflict; file permissions changed after the transaction: ' + path);
        if (entry.snapshot === null)
            return null;
        const target = join(journal.configDir, entry.snapshot);
        safeTarget(journal.configDir, target);
        const bytes = readRegular(target);
        if (hash(bytes) !== entry.before)
            throw new RecoveryRequired('Backup hash mismatch; original files are left untouched: ' + target);
        return bytes;
    });
}
/** All targets and snapshots are checked before the first restoration write. */
export function recoverFiles(journal: FileJournal, io: Storage, dryRun = false): 'rollback' | 'committed' {
    const originals = verify(journal, io);
    if (journal.phase === 'committed') {
        if (!dryRun)
            complete(journal);
        return 'committed';
    }
    if (dryRun)
        return 'rollback';
    journal.phase = 'rolling-back';
    persist(journal);
    checkpoint('rolling-back', journal);
    for (let i = journal.entries.length - 1; i >= 0; i--) {
        const entry = journal.entries[i]!, path = join(journal.configDir, entry.path), bytes = originals[i]!;
        const actual = hash(io.read(path));
        if (![entry.before, entry.after].includes(actual))
            throw new RecoveryRequired('Recovery target changed during restoration: ' + path);
        if (actual !== entry.before) {
            if (bytes === null)
                io.remove(path);
            else
                io.write(path, bytes);
        }
        if (bytes !== null && mode(path) !== entry.mode)
            restoreMode(path, entry.mode);
        checkpoint('restored:' + i, journal);
    }
    for (const entry of journal.entries.filter(entry => entry.before === null)) {
        for (let path = dirname(join(journal.configDir, entry.path)); path !== journal.configDir; path = dirname(path)) {
            try {
                safeTarget(journal.configDir, path);
                fs.rmdirSync(path);
            }
            catch {
                break;
            }
        }
    }
    complete(journal);
    return 'rollback';
}
/** Called under the common installation lock. Immutable before-images precede the durable journal. */
export function commit(directory: string, action: string, changes: Change[], io: Storage, backupAbsent = true): string | null {
    assertClear(directory);
    if (!changes.length)
        return null;
    for (const change of changes) {
        safeTarget(directory, change.path);
        if (!allowedArtifact(relativePath(directory, change.path)))
            throw new Error('Unsupported transactional artifact: ' + change.path);
        if (hash(io.read(change.path)) !== hash(change.raw))
            throw new RecoveryRequired('Configuration changed before transaction publication');
    }
    const backup = backupAbsent || changes.some(change => change.raw !== null) ? io.backup(directory, action, changes) : null;
    const journal: FileJournal = { ...base(directory, action, 'files'), kind: 'files', backup: backup === null ? null : relativePath(directory, backup), phase: 'prepared', progress: 0, entries: changes.map(change => ({ path: relativePath(directory, change.path), snapshot: change.raw === null ? null : relativePath(directory, join(backup!, change.name + '.before')), before: hash(change.raw), after: hash(change.desired), mode: mode(change.path) })) };
    verify(journal, io);
    persist(journal);
    checkpoint('prepared', journal);
    try {
        journal.phase = 'applying';
        persist(journal);
        for (let i = 0; i < changes.length; i++) {
            const change = changes[i]!;
            if (hash(io.read(change.path)) !== journal.entries[i]!.before)
                throw new RecoveryRequired('Configuration changed during transaction');
            checkpoint('before-write:' + i, journal);
            change.desired === null ? io.remove(change.path) : io.write(change.path, change.desired);
            journal.progress = i + 1;
            persist(journal);
            checkpoint('applied:' + i, journal);
        }
        journal.phase = 'committed';
        persist(journal);
        checkpoint('committed', journal);
        complete(journal);
    }
    catch (error) {
        if (journal.phase === 'committed')
            throw new RecoveryRequired('Configuration publication needs recovery verification');
        try {
            recoverFiles(journal, io);
        }
        catch (rollback) {
            throw new RecoveryRequired(`${String(error)}; rollback incomplete: ${String(rollback)}`);
        }
        throw error;
    }
    return backup;
}
