import * as fs from 'node:fs';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { atomicWrite, privateDirectory, durableUnlink } from '@fbincon/statusline-platform/files';
import { PackageError, type PackageIdentity } from '@fbincon/statusline-core/management/package';
import { safeTarget } from '../integration/paths.js';
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
    atomicWrite(path, JSON.stringify({ schema_version: 1, current: operation.after, previous: operation.before, transaction: operation.id, channel: operation.after.version.includes('-') ? null : 'latest' }, null, 2) + '\n');
}
export function finishOperation(operation: PackageOperation): void {
    operation.stage = 'complete';
    saveOperation(operation);
    durableUnlink(pendingPath(operation.prefix));
}
export function createPrefix(prefix: string): void { if (!fs.existsSync(prefix))
    privateDirectory(prefix); }
