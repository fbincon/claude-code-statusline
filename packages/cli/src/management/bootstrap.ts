import * as fs from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { productIdentity, productRoot } from '@fbincon/statusline-platform/npm';
import { copyPackage } from '@fbincon/statusline-platform/package-copy';
import { VERSION } from '@fbincon/statusline-core/release';
import { t } from '@fbincon/statusline-core/i18n/messages';
import { managementOptions } from './arguments.js';
import { expandUser, resolvedPath } from '@fbincon/statusline-platform/commands';
/** Resolve user paths before moving the executor's working directory. */
export function managementPaths(argv: readonly string[], environment: NodeJS.ProcessEnv, cwd = process.cwd()): {
    args: string[];
    environment: NodeJS.ProcessEnv;
} {
    const args = [...argv], absolute = (value: string) => resolvedPath(resolve(cwd, expandUser(value)));
    for (let i = 0; i < args.length; i++) {
        const name = args[i]!.split('=')[0]!;
        if (!['--prefix', '--config-dir'].includes(name))
            continue;
        if (args[i]!.includes('='))
            args[i] = name + '=' + absolute(args[i]!.slice(name.length + 1));
        else {
            args[i + 1] = absolute(args[i + 1]!);
            i++;
        }
    }
    const selected = environment.CLAUDE_CONFIG_DIR;
    const result = Object.fromEntries(Object.entries(environment).filter(([key]) => key.toUpperCase() !== 'CLAUDE_CONFIG_DIR'));
    if (selected?.trim())
        result.CLAUDE_CONFIG_DIR = absolute(selected);
    return { args, environment: result };
}
/** Do not load the original package's native adapter before replacing it on Windows. */
export async function bootstrap(argv: readonly string[], stderr: (text: string) => void): Promise<number> {
    let temporary: string | undefined;
    try {
        const flags = managementOptions(argv), request = managementPaths(argv, process.env), origin = productRoot(fileURLToPath(import.meta.url));
        if (!origin || productIdentity(origin)?.version !== VERSION) {
            stderr(t('package.reason_development', flags.language ?? 'en') + '\n');
            return 2;
        }
        temporary = fs.realpathSync.native(fs.mkdtempSync(join(tmpdir(), 'claude-statusline-manager-')));
        fs.chmodSync(temporary, 0o700);
        const runner = join(temporary, 'runner');
        copyPackage(origin, runner);
        const entry = join(runner, 'node_modules/@fbincon/statusline-cli/dist/src/management/worker-entry.js');
        return await new Promise<number>((resolve, reject) => {
            const child = spawn(process.execPath, [entry, origin, JSON.stringify(request.args)], { stdio: ['inherit', 'inherit', 'inherit', 'ipc'], shell: false, cwd: temporary, env: request.environment });
            const stop = () => {
                if (child.connected)
                    child.send({ type: 'cancel' }, () => { });
            };
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
