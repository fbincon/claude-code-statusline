import * as fs from 'node:fs';
import { join, dirname, relative, isAbsolute } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { atomicWrite, durableUnlink, privateDirectory, syncDirectory, isLinkOrReparse, sameFileIdentity, fileIdentity } from '@fbincon/statusline-platform/files';
import { processToken, processMatches } from '@fbincon/statusline-platform/processes';
import { decode } from '@fbincon/statusline-core/json';
import { ConfigError } from '@fbincon/statusline-core/config/validation';
import { decodeUtf8 } from '@fbincon/statusline-platform/utf8';
import { resolvedPath } from '@fbincon/statusline-platform/commands';
import { safeTarget } from '../integration/paths.js';
export const ROOT = 'statusline_runtime/transactions';
export const hash = (raw: Buffer | null): string | null => raw === null ? null : createHash('sha256').update(raw).digest('hex');
export class RecoveryRequired extends ConfigError {
    constructor(message = 'An unfinished transaction requires `claude-statusline recover` before another configuration write') { super('recovery.required', { detail: message }, 'configuration_conflict'); this.message = message; this.name = 'RecoveryRequired'; }
}
export interface Base {
    schema_version: 1;
    id: string;
    configDir: string;
    action: string;
    created: string;
    process: {
        pid: number;
        token: string;
    };
    kind: 'files' | 'official';
}
export interface FileEntry {
    path: string;
    snapshot: string | null;
    before: string | null;
    after: string | null;
    mode: number | null;
}
export interface FileJournal extends Base {
    kind: 'files';
    backup: string | null;
    phase: 'prepared' | 'applying' | 'rolling-back' | 'committed';
    progress: number;
    entries: FileEntry[];
}
export interface OfficialJournal extends Base {
    kind: 'official';
    spec: 'statusline-native' | 'statusline-runtime';
    args: string[];
    values: Record<string, string> | null;
    before: unknown;
    phase: 'prepared' | 'uncertain';
}
export type Journal = FileJournal | OfficialJournal;
export type Checkpoint = (stage: string, journal: Journal) => void;
let observer: Checkpoint = () => { };
/** Dependency injection for crash tests; production never reads fault-injection environment variables. */
export function observeTransactions(next: Checkpoint): () => void { const previous = observer; observer = next; return () => { observer = previous; }; }
export function checkpoint(stage: string, journal: Journal): void { observer(stage, journal); }
export function base(directory: string, action: string, kind: Base['kind']): Base {
    const token = processToken(process.pid);
    if (!token)
        throw new Error('Cannot establish transaction process identity');
    return { schema_version: 1, id: 'txn-' + randomUUID(), configDir: directory, action, kind, created: new Date().toISOString(), process: { pid: process.pid, token } };
}
export function journalPath(journal: Base): string { return join(journal.configDir, ROOT, journal.id + '.json'); }
export function persist(journal: Journal): void {
    const path = journalPath(journal);
    safeTarget(journal.configDir, path);
    privateDirectory(dirname(path));
    atomicWrite(path, JSON.stringify(journal, null, 2) + '\n');
    syncDirectory(dirname(path));
    syncDirectory(dirname(dirname(path)));
}
export function complete(journal: Journal): void { durableUnlink(journalPath(journal)); checkpoint('cleared', journal); }
export function pending(directory: string): string[] {
    const root = join(directory, ROOT);
    safeTarget(directory, root);
    try {
        const entries = fs.readdirSync(root);
        if (entries.length > 4096)
            throw new RecoveryRequired('Too many transaction artifacts; inspect recovery directory');
        return entries.filter(name => name.endsWith('.json')).sort().map(name => join(root, name));
    }
    catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT')
            return [];
        throw error;
    }
}
const refreshing = new Set<string>();
export function refreshIntents(directory: string): string[] {
    const path = join(directory, 'statusline_runtime/installation.json');
    safeTarget(directory, path);
    let raw: Buffer;
    try {
        raw = readRegular(path);
    }
    catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT')
            return [];
        throw error;
    }
    const source = decodeUtf8(raw);
    decode(source);
    const record = JSON.parse(source);
    if (!Object.hasOwn(record, 'refresh_disabled'))
        return [];
    if (record.owner !== 'claude-code-statusline' || record.schema_version !== 1 || !Array.isArray(record.refresh_disabled) || record.refresh_disabled.some((name: unknown) => !['statusline-native', 'statusline-runtime'].includes(String(name))) || new Set(record.refresh_disabled).size !== record.refresh_disabled.length)
        throw new RecoveryRequired('Invalid plugin refresh intent');
    return record.refresh_disabled;
}
export function permitRefresh<T>(directory: string, action: () => T): T {
    const already = refreshing.has(directory);
    refreshing.add(directory);
    try {
        return action();
    }
    finally {
        if (!already)
            refreshing.delete(directory);
    }
}
export function assertClear(directory: string, allowRefresh = false): void { if (pending(directory).length || !allowRefresh && !refreshing.has(directory) && refreshIntents(directory).length)
    throw new RecoveryRequired(); }
export function active(journal: Base): boolean { return journal.process.pid !== process.pid && processMatches(journal.process.pid, journal.process.token); }
export function readRegular(path: string, maximum = 32 * 1024 * 1024): Buffer {
    const stat = fs.lstatSync(path, { bigint: true });
    if (!stat.isFile() || isLinkOrReparse(path) || stat.size > BigInt(maximum) || process.platform !== 'win32' && (stat.mode & 0o077n) !== 0n)
        throw new RecoveryRequired('Unsafe, non-private or oversized recovery artifact: ' + path);
    const identity = fileIdentity(path, stat);
    const fd = fs.openSync(path, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0));
    try {
        const opened = fs.fstatSync(fd, { bigint: true });
        if (!sameFileIdentity(opened, identity) || !opened.isFile())
            throw new RecoveryRequired('Recovery artifact changed while opening');
        const bytes = fs.readFileSync(fd);
        if (bytes.length > maximum)
            throw new RecoveryRequired('Recovery artifact grew past its limit');
        return bytes;
    }
    finally {
        fs.closeSync(fd);
    }
}
function record(value: unknown): value is Record<string, any> { return !!value && typeof value === 'object' && !Array.isArray(value); }
export function readJournal(directory: string, path: string): Journal {
    safeTarget(directory, path);
    // Duplicate keys are forbidden even when their values happen to agree.
    const raw = decodeUtf8(readRegular(path, 4 * 1024 * 1024));
    decode(raw);
    const value = JSON.parse(raw);
    if (!record(value) || value.schema_version !== 1 || !/^txn-[0-9a-f-]{36}$/u.test(value.id) || typeof value.configDir !== 'string' || !isAbsolute(value.configDir) || resolvedPath(value.configDir) !== resolvedPath(directory) || resolvedPath(journalPath(value as Base)) !== resolvedPath(path) || typeof value.action !== 'string' || typeof value.created !== 'string' || !record(value.process) || !Number.isSafeInteger(value.process.pid) || value.process.pid <= 0 || typeof value.process.token !== 'string' || !['files', 'official'].includes(value.kind))
        throw new RecoveryRequired('Untrusted recovery journal: ' + path);
    const expected = ['schema_version', 'id', 'configDir', 'action', 'created', 'process', 'kind', ...(value.kind === 'files' ? ['backup', 'phase', 'progress', 'entries'] : ['spec', 'args', 'values', 'before', 'phase'])].sort().join(',');
    if (Object.keys(value).sort().join(',') !== expected || Object.keys(value.process).sort().join(',') !== 'pid,token')
        throw new RecoveryRequired('Unknown recovery fields');
    if (value.kind === 'files') {
        if (!['prepared', 'applying', 'rolling-back', 'committed'].includes(value.phase) || !Number.isInteger(value.progress) || !Array.isArray(value.entries) || !value.entries.length || value.entries.length > 4096 || value.progress < 0 || value.progress > value.entries.length || !(value.backup === null || typeof value.backup === 'string' && /^backups\/statusline\/cli-[A-Za-z0-9_.-]+$/u.test(value.backup)))
            throw new RecoveryRequired('Invalid file recovery checkpoint');
        const seen = new Set<string>();
        for (const entry of value.entries) {
            if (!record(entry) || typeof entry.path !== 'string' || seen.has(entry.path) || !allowedArtifact(entry.path) || ![entry.before, entry.after].every(item => item === null || typeof item === 'string' && /^[a-f0-9]{64}$/u.test(item)) || !(entry.mode === null || Number.isInteger(entry.mode) && entry.mode >= 0 && entry.mode <= 0o777) || !(entry.snapshot === null && entry.before === null || typeof entry.snapshot === 'string' && value.backup !== null && entry.snapshot.startsWith(value.backup + '/') && entry.snapshot.endsWith('.before')))
                throw new RecoveryRequired('Invalid file recovery entry');
            if (Object.keys(entry).sort().join(',') !== 'after,before,mode,path,snapshot' || entry.snapshot !== null && (entry.snapshot.includes('\\') || entry.snapshot.split('/').some((part: string) => !part || part === '.' || part === '..')))
                throw new RecoveryRequired('Unsafe backup snapshot path');
            safeTarget(directory, join(directory, entry.path));
            if (entry.snapshot !== null)
                safeTarget(directory, join(directory, entry.snapshot));
            seen.add(entry.path);
        }
    }
    else if (!['statusline-native', 'statusline-runtime'].includes(value.spec) || !['prepared', 'uncertain'].includes(value.phase) || !Array.isArray(value.args) || value.args.some((x: unknown) => typeof x !== 'string' || /[\0\r\n]/u.test(x)) || !(value.values === null || record(value.values) && Object.values(value.values).every(x => typeof x === 'string')))
        throw new RecoveryRequired('Invalid official operation checkpoint');
    return { ...value, configDir: directory } as Journal;
}
export function allowedArtifact(path: string): boolean {
    if (path.includes('\\') || isAbsolute(path) || path.split('/').some(x => !x || x === '.' || x === '..'))
        return false;
    return ['settings.json', 'claude-statusline.json', 'claude-statusline-profiles.json', 'statusline-ui.json', 'claude-statusline-features.json', 'claude-statusline-native.json', 'claude-statusline-runtime.json', 'statusline_runtime/installation.json'].includes(path) || /^skills\/statusline-(?:config|configure)\/(?:SKILL\.md|\.claude-statusline-owner\.json)$/u.test(path) || /^statusline-(?:native|runtime)\/(?:\.claude-statusline-owner\.json|\.claude-plugin\/marketplace\.json|plugins\/statusline-(?:native|runtime)\/(?:resource-manifest\.json|\.claude-plugin\/plugin\.json|hooks\/hooks\.json|(?:hooks|lib|ui)\/.+\.ts))$/u.test(path);
}
export function relativePath(directory: string, path: string): string { safeTarget(directory, path); return relative(directory, path).replaceAll('\\', '/'); }
