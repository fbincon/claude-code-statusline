import * as fs from 'node:fs';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { atomicWrite, privateDirectory, durableUnlink } from '@fbincon/statusline-platform/files';
import { PackageError, type PackageIdentity } from '@fbincon/statusline-core/management/package';
import { safeTarget } from '../integration/paths.js';
import { readRegular } from '../recovery/journal.js';
import { exactVersion } from '@fbincon/statusline-core/management/package';
import { compatibility } from '@fbincon/statusline-core/management/compatibility';
import type { PackageCompatibility } from '@fbincon/statusline-core/management/compatibility';
import { globalPackageRoot } from '@fbincon/statusline-platform/npm';
import type { RegistryPackage } from '@fbincon/statusline-platform/npm';
import type { ConfigHashes } from './configuration.js';
import { processToken, processMatches } from '@fbincon/statusline-platform/processes';
export const MANAGEMENT_ROOT = 'statusline_runtime/package-management';
export interface PackageOperation {
    schema_version: 1;
    id: string;
    configDir: string;
    prefix: string;
    action: 'install' | 'update' | 'rollback';
    version: string;
    registry: string;
    before: PackageIdentity | null;
    after: PackageIdentity | null;
    stage: 'reviewed' | 'installing' | 'package_verified' | 'integrating' | 'complete' | 'uncertain';
    created: string;
    target?: RegistryPackage;
    archive?: string;
    snapshot?: ConfigHashes;
    beforeCompatibility?: PackageCompatibility;
    integrated?: boolean;
    channel?: 'latest' | 'beta' | null;
    previousChannel?: 'latest' | 'beta' | null;
    results?: {
        package: boolean;
        integration: boolean;
        error?: string;
    };
    executors?: {
        pid: number;
        token: string;
    }[];
}
export const prefixKey = (prefix: string) => createHash('sha256').update(prefix).digest('hex');
export const pendingPath = (prefix: string) => join(prefix, '.claude-statusline-operation.json');
export function operationPath(operation: PackageOperation): string { return join(operation.configDir, MANAGEMENT_ROOT, 'transactions', operation.id, 'operation.json'); }
export function saveOperation(operation: PackageOperation): void {
    const path = operationPath(operation);
    safeTarget(operation.configDir, path);
    atomicWrite(path, JSON.stringify(operation, null, 2) + '\n');
}
export function startOperation(configDir: string, prefix: string, version: string, registry: string, before: PackageIdentity | null, action: PackageOperation['action'] = 'install'): PackageOperation {
    if (fs.existsSync(pendingPath(prefix)))
        throw new PackageError('pending');
    const operation: PackageOperation = { schema_version: 1, id: 'pkg-' + randomUUID(), configDir, prefix, version, registry, before, after: null, action, stage: 'reviewed', created: new Date().toISOString() };
    saveOperation(operation);
    atomicWrite(pendingPath(prefix), JSON.stringify({ owner: 'claude-code-statusline', schema_version: 1, id: operation.id, configDir, prefix }) + '\n');
    return operation;
}
export function recordInstallation(operation: PackageOperation): void {
    if (!operation.after)
        throw new PackageError('identity');
    const path = join(operation.configDir, MANAGEMENT_ROOT, 'installations', prefixKey(operation.prefix) + '.json');
    safeTarget(operation.configDir, path);
    atomicWrite(path, JSON.stringify({ schema_version: 1, current: operation.after, previous: operation.before, transaction: operation.id, channel: operation.channel ?? (operation.after.version.includes('-') ? null : 'latest'), previousChannel: operation.previousChannel ?? null }, null, 2) + '\n');
}
export function finishOperation(operation: PackageOperation): void {
    operation.stage = 'complete';
    saveOperation(operation);
    durableUnlink(pendingPath(operation.prefix));
}
export function observeOperation(operation: PackageOperation): (pid: number | null) => void {
    return pid => {
        operation.executors = (operation.executors ?? []).filter(p => processMatches(p.pid, p.token));
        if (pid !== null) {
            const token = processToken(pid);
            if (!token)
                throw new PackageError('busy');
            operation.executors.push({ pid, token });
        }
        saveOperation(operation);
    };
}
export function createPrefix(prefix: string): void {
    if (!fs.existsSync(prefix))
        privateDirectory(prefix);
}
export interface InstallationRecord {
    schema_version: 1;
    current: PackageIdentity;
    previous: PackageIdentity | null;
    transaction: string;
    channel: 'latest' | 'beta' | null;
    previousChannel?: 'latest' | 'beta' | null;
}
export function readInstallation(configDir: string, prefix: string): InstallationRecord | null {
    const path = join(configDir, MANAGEMENT_ROOT, 'installations', prefixKey(prefix) + '.json');
    safeTarget(configDir, path);
    if (!fs.existsSync(path))
        return null;
    const value = JSON.parse(readRegular(path, 1024 * 1024).toString('utf8'));
    if (value.schema_version !== 1 || !exactVersion(value.current?.version) || value.current.prefix !== prefix || value.previous && !exactVersion(value.previous.version) || ![null, 'latest', 'beta'].includes(value.channel))
        throw new PackageError('journal');
    return value;
}
export function readOperation(configDir: string, prefix: string, id?: string): PackageOperation {
    if (!id) {
        const marker = pendingPath(prefix);
        safeTarget(prefix, marker);
        if (!fs.existsSync(marker))
            throw new PackageError('no_pending');
        const value = JSON.parse(readRegular(marker, 65536).toString('utf8'));
        if (value.owner !== 'claude-code-statusline' || value.schema_version !== 1 || value.prefix !== prefix || value.configDir !== configDir)
            throw new PackageError('journal');
        id = value.id;
    }
    if (typeof id !== 'string' || !/^pkg-[0-9a-f-]{36}$/u.test(id))
        throw new PackageError('journal');
    const path = join(configDir, MANAGEMENT_ROOT, 'transactions', id, 'operation.json');
    safeTarget(configDir, path);
    let value: PackageOperation;
    try {
        value = JSON.parse(readRegular(path, 1024 * 1024).toString('utf8'));
    }
    catch {
        throw new PackageError('journal');
    }
    if (value.schema_version !== 1 || value.id !== id || value.configDir !== configDir || value.prefix !== prefix || !exactVersion(value.version) || !['install', 'update', 'rollback'].includes(value.action) || !['reviewed', 'installing', 'package_verified', 'integrating', 'complete', 'uncertain'].includes(value.stage))
        throw new PackageError('journal');
    for (const identity of [value.before, value.after])
        if (identity && (!exactVersion(identity.version) || identity.prefix !== prefix || identity.root !== globalPackageRoot(prefix)))
            throw new PackageError('journal');
    if (value.target) {
        if (value.target.version !== value.version || value.target.registry !== value.registry || !/^sha512-[A-Za-z0-9+/]{86}==$/u.test(value.target.integrity) || typeof value.target.nodeEngine !== 'string' || typeof value.target.legacy !== 'boolean')
            throw new PackageError('journal');
        compatibility(value.target.compatibility, value.target.version);
    }
    if (value.archive !== undefined && value.archive !== 'target.tgz')
        throw new PackageError('journal');
    if (value.executors && (!Array.isArray(value.executors) || value.executors.length > 16 || value.executors.some(p => !Number.isSafeInteger(p.pid) || p.pid < 1 || typeof p.token !== 'string' || p.token.length > 256)))
        throw new PackageError('journal');
    if (value.target && value.target.legacy !== (value.version === '3.7.0'))
        throw new PackageError('journal');
    try {
        const url = new URL(value.registry);
        if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash)
            throw new Error();
    }
    catch {
        throw new PackageError('journal');
    }
    if (value.beforeCompatibility)
        compatibility(value.beforeCompatibility, value.before!.version);
    return value;
}
