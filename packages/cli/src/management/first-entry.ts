import * as fs from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { t, type Language } from '@fbincon/statusline-core/i18n/messages';
import { VERSION, PACKAGE_NAME } from '@fbincon/statusline-core/release';
import { supportedNode } from '@fbincon/statusline-core/node-runtime';
import { PackageError, entryAction, type PackageIdentity } from '@fbincon/statusline-core/management/package';
import { Npm, productRoot, productIdentity, writablePrefix, within } from '@fbincon/statusline-platform/npm';
import { lock } from '@fbincon/statusline-platform/files';
import { sameLaunchEntry, which } from '@fbincon/statusline-platform/commands';
import { ArgumentError, optionToken } from '../config/arguments.js';
import { createPrefix, pendingPath, startOperation, saveOperation, recordInstallation, finishOperation } from './store.js';
import { previousBinding } from '../integration/ownership.js';
import { createStorage } from '../config/storage.js';
export function entryOptions(args: readonly string[]): {
    prefix?: string;
    dryRun: boolean;
} {
    const result: {
        prefix?: string;
        dryRun: boolean;
    } = { dryRun: false }, seen = new Set<string>();
    for (let i = 0; i < args.length; i++) {
        const [name] = args[i]!.split('=');
        if (seen.has(name!))
            throw new ArgumentError('duplicate ' + name);
        seen.add(name!);
        if (name === '--dry-run' && args[i] === name) {
            result.dryRun = true;
            continue;
        }
        if (!['--prefix', '--config-dir'].includes(name!))
            throw new ArgumentError('unrecognized arguments: ' + args[i]);
        const value = args[i]!.includes('=') ? args[i]!.slice(name!.length + 1) : args[++i];
        if (!value || optionToken(value) || /[\0\r\n]/u.test(value))
            throw new ArgumentError(name + ' requires a path');
        if (name === '--prefix')
            result.prefix = value;
    }
    return result;
}
export async function confirmPackage(language: Language, output: (value: string) => void, signal?: AbortSignal): Promise<boolean> {
    output(t('package.confirm', language) + ' ');
    const reader = createInterface({ input: process.stdin, output: process.stdout, terminal: false });
    const closed = new AbortController();
    reader.once('close', () => closed.abort());
    try {
        return /^(?:y|yes)$/iu.test((await reader.question('', { signal: signal ? AbortSignal.any([signal, closed.signal]) : closed.signal })).trim());
    }
    catch {
        return false;
    }
    finally {
        reader.close();
    }
}
export interface FirstEntryOptions {
    configDir: string;
    language: Language;
    stdout: (value: string) => void;
    stderr: (value: string) => void;
    tty?: boolean;
    origin?: string | null;
    npm?: Npm;
    confirm?: () => Promise<boolean>;
    handoff?: (identity: PackageIdentity) => Promise<number>;
}
export async function firstEntry(args: readonly string[], options: FirstEntryOptions): Promise<number> {
    const flags = entryOptions(args), { language, stdout, stderr, configDir } = options;
    if (!(options.tty ?? (process.stdin.isTTY && process.stdout.isTTY)) && !flags.dryRun) {
        stderr(t('package.tty', language) + '\n');
        return 2;
    }
    let stage = 'review', release: (() => void) | undefined;
    const controller = new AbortController(), cancel = () => controller.abort();
    process.on('SIGINT', cancel);
    process.on('SIGTERM', cancel);
    try {
        if (!supportedNode(process.versions.node))
            throw new PackageError('runtime');
        const origin = options.origin === undefined ? productRoot(fileURLToPath(import.meta.url)) : options.origin;
        if (!origin || productIdentity(origin)?.version !== VERSION)
            throw new PackageError('development');
        const npm = options.npm ?? new Npm(process.env, undefined, undefined, controller.signal), layout = await npm.layout(flags.prefix);
        const before = productIdentity(layout.root, layout.prefix), action = entryAction(before, VERSION);
        if (within(configDir, layout.root))
            throw new PackageError('prefix');
        if (action === 'version_conflict') {
            stdout(JSON.stringify({installed:before!.version,target:VERSION,prefix:layout.prefix},null,2)+'\n');
            throw new PackageError('version_conflict');
        }
        const pathEntry = which('claude-statusline');
        const previous = previousBinding(configDir, createStorage());
        const priorRoot = previous?.args.length === 1 ? productRoot(previous.args[0]!) : null;
        const inferredPrefix = (root: string) => dirname(dirname(dirname(process.platform === 'win32' ? root : dirname(root))));
        for (const root of [origin, priorRoot])
            if (!flags.prefix && root && !within(root, layout.cache)) {
                const prefix = inferredPrefix(root), expected = join(prefix, process.platform === 'win32' ? 'node_modules' : 'lib/node_modules', PACKAGE_NAME);
                if (root === expected && root !== layout.root)
                    throw new PackageError('prefix_ambiguous');
            }
        if (!flags.prefix && pathEntry && !sameLaunchEntry(pathEntry, { executable: process.execPath, args: [join(layout.root, 'node_modules/@fbincon/statusline-cli/dist/src/entry.js')] }))
            throw new PackageError('prefix_ambiguous');
        if (fs.existsSync(pendingPath(layout.prefix)))
            throw new PackageError('pending');
        if (!before)
            writablePrefix(layout.prefix);
        stdout(t('package.review', language, { action: t('package.action_' + action, language), name: PACKAGE_NAME, version: VERSION, prefix: layout.prefix, node: process.execPath, npm: layout.npmVersion, registry: layout.registry }) + '\n');
        if (flags.dryRun)
            return 0;
        const approved = await (options.confirm?.() ?? confirmPackage(language, stdout, controller.signal));
        if (controller.signal.aborted)
            throw new PackageError('interrupted');
        if (!approved) {
            stdout(t('package.cancelled', language) + '\n');
            return 0;
        }
        const handoff = async (installed: PackageIdentity): Promise<number> => {
            stdout(t('package.verified', language, { prefix: layout.prefix }) + '\n');
            if (options.handoff)
                return options.handoff(installed);
            return new Promise<number>((resolve, reject) => {
                const child = spawn(process.execPath, [installed.entry, '--language', language, 'setup', '--config-dir', configDir], { stdio: 'inherit', shell: false });
                const stop = () => child.kill('SIGTERM');
                controller.signal.addEventListener('abort', stop, { once: true });
                child.once('error', reject);
                child.once('exit', code => { controller.signal.removeEventListener('abort', stop); resolve(code ?? 2); });
            });
        };
        if (before) {
            await npm.verify(before,layout.bin);
            if (JSON.stringify(productIdentity(layout.root, layout.prefix)) !== JSON.stringify(before))
                throw new PackageError('conflict');
            stage = 'package_verified';
            return await handoff(before);
        }
        createPrefix(layout.prefix);
        release = lock(join(layout.prefix, '.claude-statusline-install.lock'), true);
        if (JSON.stringify(productIdentity(layout.root, layout.prefix)) !== JSON.stringify(before) || fs.existsSync(pendingPath(layout.prefix)))
            throw new PackageError('conflict');
        const operation = startOperation(configDir, layout.prefix, VERSION, layout.registry, before);
        try {
            if (!before) {
                stage = 'installing';
                operation.stage = 'installing';
                saveOperation(operation);
                await npm.install(VERSION, layout);
            }
            const installed = productIdentity(layout.root, layout.prefix);
            if (!installed || installed.version !== VERSION)
                throw new PackageError('identity');
            await npm.verify(installed,layout.bin);
            operation.after = { ...installed, registry: layout.registry };
            stage = 'package_verified';
            operation.stage = 'package_verified';
            saveOperation(operation);
            recordInstallation(operation);
            finishOperation(operation);
            release();
            release = undefined;
            return await handoff(installed);
        }
        catch (error) {
            if (operation.stage !== 'complete') {
                operation.stage = 'uncertain';
                saveOperation(operation);
            }
            throw error;
        }
    }
    catch (error) {
        const reason = error instanceof PackageError ? error.code : 'io_error';
        stderr(t('package.failure', language, { reason: t('package.reason_' + reason, language) }) + '\n');
        if (stage !== 'review')
            stderr(t('package.partial', language, { stage }) + '\n');
        return reason === 'interrupted' ? 130 : 2;
    }
    finally {
        release?.();
        process.off('SIGINT', cancel);
        process.off('SIGTERM', cancel);
    }
}
