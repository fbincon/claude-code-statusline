import * as fs from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { runSourceProcess, type SourceProcessResult } from '@fbincon/statusline-platform/source-process';
import { removeTree } from '@fbincon/statusline-platform/remove-tree';
import { readPrivateState } from '@fbincon/statusline-platform/private-state';
import { PackageError, type PackageIdentity } from '@fbincon/statusline-core/management/package';
import { integrationDetail } from '../integration/mod-diagnostic.js';
import { type ConfigHashes } from './configuration.js';

function integrationReceipt(process: SourceProcessResult, path: string): { valid?: boolean; hashes?: ConfigHashes } {
    if (process.reason === 'cancelled') throw new PackageError('interrupted');
    let result: { valid?: boolean; hashes?: ConfigHashes; detail?: unknown } | undefined;
    if (process.reason === 'completed' || process.reason === 'exit' && process.code === 2) {
        try { result = JSON.parse(readPrivateState(path, 32 * 1024).toString('utf8')); }
        catch { /* An absent or unreadable receipt cannot confirm integration. */ }
    }
    if (process.reason === 'completed' && result?.valid === true) return result;
    throw new PackageError('integration_failed', integrationDetail(result?.detail));
}

export async function refreshIntegration(root: string, identity: PackageIdentity, configDir: string, host: readonly number[] | null, hashes: ConfigHashes, workspace: string, dryRun: boolean, environment: NodeJS.ProcessEnv, signal?: AbortSignal, onProcess?: (pid: number | null) => void): Promise<void> {
    const id = randomUUID(), request = join(workspace, id + '-request.json'), receipt = join(workspace, id + '-result.json');
    const payload = { root, version: identity.version, entry: identity.entry, configDir, host, hashes, dryRun };
    fs.writeFileSync(request, JSON.stringify(payload), { mode: 0o600 });
    try {
        const transition = await runSourceProcess({ executable: process.execPath, args: [fileURLToPath(new URL('./mod-transition-runner.js', import.meta.url)), request, receipt], cwd: workspace, input: '', timeoutMs: 180000, environment, signal, onProcess });
        const prepared = integrationReceipt(transition, receipt);
        if (!prepared.hashes) throw new PackageError('integration_failed');
        fs.writeFileSync(request, JSON.stringify({ ...payload, hashes: prepared.hashes }), { mode: 0o600 });
        fs.unlinkSync(receipt);
        const result = await runSourceProcess({ executable: process.execPath, args: [fileURLToPath(new URL('./integration-runner.js', import.meta.url)), request, receipt], cwd: workspace, input: '', timeoutMs: 180000, environment, signal, onProcess });
        integrationReceipt(result, receipt);
    }
    finally {
        removeTree(request);
        removeTree(receipt);
    }
}
