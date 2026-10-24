// This process loads only the target package's native adapter. Do not import
// the transaction runner's platform modules here (Windows cannot unload Koffi).
import * as fs from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
const [requestPath, receipt] = process.argv.slice(2);
const request = JSON.parse(fs.readFileSync(requestPath!, 'utf8'));
const load = (path: string) => import(pathToFileURL(join(request.root, 'node_modules/@fbincon/statusline-cli/dist/src', path + '.js')).href);
try {
    const [{ install, installContext }, { doctor }, { safeTarget }] = await Promise.all([load('integration/install'), load('integration/doctor'), load('integration/paths')]);
    const guard = () => {
        for (const [name, expected] of Object.entries(request.hashes)) {
            const path = join(request.configDir, name);
            safeTarget(request.configDir, path);
            let hash: string | null = null;
            try {
                const stat = fs.lstatSync(path);
                if (!stat.isFile() || stat.size > 32 * 1024 * 1024)
                    throw new Error('Invalid configuration file');
                hash = createHash('sha256').update(fs.readFileSync(path)).digest('hex');
            }
            catch (error) {
                if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
                    throw error;
            }
            if (hash !== expected)
                throw new Error('Configuration changed after review');
        }
    };
    guard();
    const context = installContext(request.configDir, { executable: process.execPath, args: [request.entry] }, request.host);
    const result = install(context, { dryRun: request.dryRun, beforeCommit: guard });
    const diagnostics = request.dryRun ? [] : doctor(context);
    const valid = !result.failed && !diagnostics.some((row: any) => row.level === 'ERROR');
    fs.writeFileSync(receipt!, JSON.stringify({ valid, result, diagnostics }) + '\n', { mode: 0o600 });
    process.exitCode = valid ? 0 : 2;
}
catch {
    fs.writeFileSync(receipt!, JSON.stringify({ valid: false, error: 'integration_failed' }) + '\n', { mode: 0o600 });
    process.exitCode = 2;
}
