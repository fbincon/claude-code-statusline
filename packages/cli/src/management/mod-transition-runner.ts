// A separate process keeps this runner's native adapter out of the target installer's process.
import { readFileSync, writeFileSync } from 'node:fs';
import { PackageError } from '@fbincon/statusline-core/management/package';
import { installContext } from '../integration/install.js';
import { prepareModDowngrade } from './mod-transition.js';
const [requestPath, receipt] = process.argv.slice(2);
try {
    const request = JSON.parse(readFileSync(requestPath!, 'utf8'));
    const context = installContext(request.configDir, { executable: process.execPath, args: [request.entry] }, request.host);
    const hashes = prepareModDowngrade(context, request.root, request.version, request.hashes, request.dryRun);
    writeFileSync(receipt!, JSON.stringify({ valid: true, hashes }) + '\n', { mode: 0o600 });
} catch (error) {
    writeFileSync(receipt!, JSON.stringify({ valid: false, detail: error instanceof PackageError ? error.detail : undefined }) + '\n', { mode: 0o600 });
    process.exitCode = 2;
}
