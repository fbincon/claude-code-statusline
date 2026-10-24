import * as fs from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { productIdentity, productRoot } from '@fbincon/statusline-platform/npm';
import { VERSION } from '@fbincon/statusline-core/release';
import { t } from '@fbincon/statusline-core/i18n/messages';
import { managementOptions } from './arguments.js';
/** Do not load the original package's native adapter before replacing it on Windows. */
export async function bootstrap(argv: readonly string[], stderr: (text: string) => void): Promise<number> {
    let temporary: string | undefined;
    try {
        const flags = managementOptions(argv), origin = productRoot(fileURLToPath(import.meta.url));
        if (!origin || productIdentity(origin)?.version !== VERSION) {
            stderr(t('package.reason_development', flags.language ?? 'en') + '\n');
            return 2;
        }
        temporary = fs.realpathSync.native(fs.mkdtempSync(join(tmpdir(), 'claude-statusline-manager-')));
        fs.chmodSync(temporary, 0o700);
        const runner = join(temporary, 'runner');
        fs.cpSync(origin, runner, { recursive: true, errorOnExist: true, force: false });
        const entry = join(runner, 'node_modules/@fbincon/statusline-cli/dist/src/management/worker-entry.js');
        return await new Promise<number>((resolve, reject) => {
            const child = spawn(process.execPath, [entry, origin, JSON.stringify(argv)], { stdio: ['inherit', 'inherit', 'inherit', 'ipc'], shell: false, cwd: temporary });
            const stop = () => { if (child.connected)
                child.send({ type: 'cancel' }, () => { }); };
            process.on('SIGINT', stop);
            process.on('SIGTERM', stop);
            const cleanup = () => { process.off('SIGINT', stop); process.off('SIGTERM', stop); };
            child.once('error', error => { cleanup(); reject(error); });
            child.once('exit', (code, signal) => { cleanup(); resolve(code ?? (signal ? 130 : 2)); });
        });
    }
    catch (error) {
        stderr((error instanceof Error ? error.message : 'Package runner failed') + '\n');
        return 2;
    }
    finally {
        if (temporary)
            fs.rmSync(temporary, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
    }
}
