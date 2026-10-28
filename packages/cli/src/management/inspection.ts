import * as fs from 'node:fs';
import { dirname, join } from 'node:path';
import { VERSION } from '@fbincon/statusline-core/release';
import { PackageError } from '@fbincon/statusline-core/management/package';
import { compatibility, runtimeCompatibility } from '@fbincon/statusline-core/management/compatibility';
import type { PackageHistoryRow, PackageStatus } from '@fbincon/statusline-core/contracts/ui';
import { globalPackageRoot, productIdentity, productRoot } from '@fbincon/statusline-platform/npm';
import { resolvedPath, which } from '@fbincon/statusline-platform/commands';
import { sha256 } from '@fbincon/statusline-platform/hash';
import { processMatches } from '@fbincon/statusline-platform/processes';
import { previousBinding } from '../integration/ownership.js';
import { safeTarget } from '../integration/paths.js';
import { createStorage } from '../config/storage.js';
import { readRegular } from '../recovery/journal.js';
import { configurationBytes, configurationHashes, configurationCompatibility, readSnapshot } from './configuration.js';
import { MANAGEMENT_ROOT, operationPath, pendingPath, readInstallation, readOperation, type PackageOperation } from './store.js';
export interface InspectionContext {
    configDir: string;
    origin: string;
    hostVersion: () => readonly number[] | null;
}
export const packageReason = (error: unknown): string => error instanceof PackageError ? error.code : 'io_error';
function prefixFor(entry: string): string | null {
    const root = productRoot(resolvedPath(entry));
    if (!root)
        return null;
    let prefix = root;
    for (let i = 0; i < (process.platform === 'win32' ? 3 : 4); i++)
        prefix = dirname(prefix);
    return resolvedPath(globalPackageRoot(prefix)) === root ? prefix : null;
}
export function inspectPackage(context: InspectionContext, explicit: string | null = null, offset = 0): PackageStatus {
    const reasons: string[] = [], { configDir } = context;
    let prefix: string | null = explicit ? resolvedPath(explicit) : null;
    if (!prefix) {
        const candidates = new Set<string>();
        try {
            const binding = previousBinding(configDir, createStorage());
            const path = binding?.args.length === 1 ? binding.args[0] : binding?.executable;
            for (const entry of [path, context.origin, which('claude-statusline')])
                if (entry) {
                    const candidate = prefixFor(entry);
                    if (candidate)
                        candidates.add(candidate);
                }
        }
        catch (error) {
            reasons.push(packageReason(error));
        }
        if (candidates.size === 1)
            prefix = [...candidates][0]!;
        else
            reasons.push(candidates.size ? 'prefix_ambiguous' : 'not_installed');
    }
    let identity: ReturnType<typeof productIdentity> = null, history: ReturnType<typeof readInstallation> = null, pending: PackageOperation | null = null;
    let host: string | null = null;
    try {
        host = context.hostVersion()?.join('.') ?? null;
    }
    catch {
        reasons.push('host');
    }
    let hashes: Record<string, string | null> = {};
    try {
        hashes = configurationHashes(configurationBytes(configDir));
    }
    catch (error) {
        reasons.push(packageReason(error));
    }
    if (prefix) {
        try {
            identity = productIdentity(globalPackageRoot(prefix), prefix);
            if (!identity)
                reasons.push('not_installed');
            else {
                const manifest = JSON.parse(readRegular(join(identity.root, 'package.json'), 1024 * 1024).toString('utf8'));
                const declared = compatibility(manifest.statuslineCompatibility, identity.version);
                const binding = previousBinding(configDir, createStorage());
                reasons.push(...runtimeCompatibility(declared, process.versions.node, process.platform + '-' + process.arch, host, binding !== null));
                if (binding && (binding.args.length !== 1 || resolvedPath(binding.args[0]!) !== identity.entry))
                    reasons.push('prefix_ambiguous');
                if (configurationCompatibility(configurationBytes(configDir), declared).length)
                    reasons.push('configuration');
            }
        }
        catch (error) {
            reasons.push(packageReason(error));
        }
        try {
            history = readInstallation(configDir, prefix);
            if (history && (!identity || history.current.version !== identity.version || history.current.inventory_sha256 !== identity.inventory_sha256 || history.current.entry !== identity.entry)) {
                reasons.push('conflict');
                history = null;
            }
        }
        catch (error) {
            reasons.push(packageReason(error));
        }
        try {
            if (fs.existsSync(pendingPath(prefix)))
                pending = readOperation(configDir, prefix);
        }
        catch (error) {
            reasons.push(packageReason(error));
        }
    }
    const row = (operation: PackageOperation): PackageHistoryRow => {
        let backup: PackageHistoryRow['backup'] = 'missing';
        if (operation.snapshot)
            try {
                readSnapshot(configDir, dirname(operationPath(operation)), operation.snapshot);
                backup = 'verified';
            }
            catch {
                backup = 'invalid';
            }
        return { id: operation.id, version: operation.version, created: operation.created, stage: operation.stage, backup,
            running: operation.executors?.some(p => processMatches(p.pid, p.token)) ?? false };
    };
    const records: PackageHistoryRow[] = [];
    let total = 0;
    const folder = join(configDir, MANAGEMENT_ROOT, 'transactions');
    try {
        safeTarget(configDir, folder);
        if (fs.existsSync(folder)) {
            const ids = fs.readdirSync(folder).filter(id => /^pkg-[0-9a-f-]{36}$/u.test(id)).sort();
            total = ids.length;
            if (prefix)
                for (const id of ids.slice(offset, offset + 16)) {
                    try {
                        const path = join(folder, id, 'operation.json');
                        safeTarget(configDir, path);
                        const raw = JSON.parse(readRegular(path, 1024 * 1024).toString('utf8'));
                        if (raw.prefix !== prefix)
                            continue;
                        records.push(row(readOperation(configDir, prefix, id)));
                    }
                    catch {
                        records.push({ id, version: null, created: null, stage: 'invalid', backup: 'invalid', running: false });
                    }
                }
        }
    }
    catch (error) {
        reasons.push(packageReason(error));
    }
    const unique = [...new Set(reasons)];
    return { version: 1, backend_version: VERSION, captured_at: new Date().toISOString(),
        revision: sha256(JSON.stringify({ identity, history, pending, hashes, prefix, configDir, host })), prefix, entry: identity?.entry ?? null, config_dir: configDir,
        current: identity?.version ?? null, previous: history?.previous?.version ?? null, channel: history?.channel ?? null, node_version: process.versions.node, host,
        compatible: !!identity && !unique.length, reasons: unique, pending: pending ? row(pending) : null, history: records, offset, total };
}
