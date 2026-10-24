import * as fs from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { runSourceProcess } from '@fbincon/statusline-platform/source-process';
import { removeTree } from '@fbincon/statusline-platform/remove-tree';
import { PackageError, type PackageIdentity } from '@fbincon/statusline-core/management/package';
import { type ConfigHashes } from './configuration.js';
export async function refreshIntegration(root: string, identity: PackageIdentity, configDir: string, host: readonly number[] | null, hashes: ConfigHashes, workspace: string, dryRun: boolean, environment: NodeJS.ProcessEnv, signal?: AbortSignal, onProcess?: (pid: number | null) => void): Promise<void> {
    const id = randomUUID(), request = join(workspace, id + '-request.json'), receipt = join(workspace, id + '-result.json');
    fs.writeFileSync(request, JSON.stringify({ root, entry: identity.entry, configDir, host, hashes, dryRun }), { mode: 0o600 });
    try {
        const result = await runSourceProcess({ executable: process.execPath, args: [fileURLToPath(new URL('./integration-runner.js', import.meta.url)), request, receipt], cwd: workspace, input: '', timeoutMs: 180000, environment, signal, onProcess });
        if (result.reason === 'cancelled')
            throw new PackageError('interrupted');
        if (result.reason !== 'completed' || !JSON.parse(fs.readFileSync(receipt, 'utf8')).valid)
            throw new PackageError('integration_failed');
    }
    finally {
        removeTree(request);
        removeTree(receipt);
    }
}
