import * as fs from 'node:fs';
import { dirname, join, resolve, isAbsolute } from 'node:path';
import { createHash } from 'node:crypto';
import { PACKAGE_NAME } from '@fbincon/statusline-core/release';
import { PackageError, exactVersion, type PackageIdentity } from '@fbincon/statusline-core/management/package';
import { which, resolvedPath, sameLaunchEntry } from './commands.js';
import { runSourceProcess, type SourceProcessOptions, type SourceProcessResult } from './source-process.js';
export interface NpmLayout {
    prefix: string;
    root: string;
    bin: string;
    registry: string;
    npmVersion: string;
    cache: string;
}
export function within(path: string, root: string): boolean { const normalized = resolvedPath(path), base = resolvedPath(root); return normalized === base || normalized.startsWith(base + (process.platform === 'win32' ? '\\' : '/')); }
export function productRoot(start: string): string | null {
    for (let root = dirname(start), n = 0; n < 12; n++, root = dirname(root)) {
        try {
            if (JSON.parse(fs.readFileSync(join(root, 'package.json'), 'utf8')).name === PACKAGE_NAME)
                return fs.realpathSync.native(root);
        }
        catch { /* Continue to the enclosing public package. */ }
        if (dirname(root) === root)
            break;
    }
    return null;
}
export function productIdentity(root: string, prefix = ''): PackageIdentity | null {
    if (!fs.existsSync(root))
        return null;
    try {
        if (fs.lstatSync(root).isSymbolicLink())
            throw new Error('linked product');
        const manifest = JSON.parse(fs.readFileSync(join(root, 'package.json'), 'utf8'));
        if (manifest.name !== PACKAGE_NAME || !exactVersion(manifest.version) || manifest.bin?.['claude-statusline'] !== 'bin/claude-statusline.js')
            throw new Error('identity');
        const entry = join(root, 'node_modules/@fbincon/statusline-cli/dist/src/entry.js');
        const inventory = JSON.parse(fs.readFileSync(join(root, 'candidate.json'), 'utf8'));
        if (inventory.name !== PACKAGE_NAME || inventory.version !== manifest.version || inventory.application_version !== manifest.version)
            throw new Error('inventory');
        for (const file of ['bin/claude-statusline.js', 'node_modules/@fbincon/statusline-cli/dist/src/entry.js', 'node_modules/@fbincon/statusline-core/dist/src/release.js']) {
            if (fs.lstatSync(join(root, file)).isSymbolicLink() || createHash('sha256').update(fs.readFileSync(join(root, file))).digest('hex') !== inventory.files?.[file])
                throw new Error('bytes');
        }
        return { version: manifest.version, root: fs.realpathSync.native(root), entry: fs.realpathSync.native(entry), prefix, integrity: null, registry: null };
    }
    catch {
        throw new PackageError('identity');
    }
}
export function npmEntry(environment: NodeJS.ProcessEnv = process.env): string {
    const found = which('npm', environment);
    const choices = [environment.npm_execpath, found && resolvedPath(found), found && join(dirname(found), 'node_modules/npm/bin/npm-cli.js'),
        join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js'), join(dirname(process.execPath), '../lib/node_modules/npm/bin/npm-cli.js')];
    for (const path of choices)
        if (path) {
            try {
                const actual = fs.realpathSync.native(path);
                if (actual.endsWith('npm-cli.js') && JSON.parse(fs.readFileSync(join(dirname(actual), '../package.json'), 'utf8')).name === 'npm')
                    return actual;
            }
            catch { /* Try another standard npm installation. Never execute a batch shim. */ }
        }
    throw new PackageError('npm_missing');
}
export function writablePrefix(prefix: string): void {
    let parent = prefix;
    while (!fs.existsSync(parent) && parent !== dirname(parent))
        parent = dirname(parent);
    try {
        if (!fs.statSync(parent).isDirectory())
            throw new Error();
        fs.accessSync(parent, fs.constants.W_OK | (process.platform === 'win32' ? 0 : fs.constants.X_OK));
    }
    catch {
        throw new PackageError('permissions');
    }
}
export class Npm {
    readonly entry: string;
    constructor(readonly environment: NodeJS.ProcessEnv = process.env, readonly runner: (options: SourceProcessOptions) => Promise<SourceProcessResult> = runSourceProcess, entry?: string, readonly signal?: AbortSignal) { this.entry = entry ?? npmEntry(environment); }
    async run(args: readonly string[], cwd = process.cwd(), timeoutMs = 30000): Promise<string> {
        const result = await this.runner({ executable: process.execPath, args: [this.entry, ...args], cwd, input: '', timeoutMs, signal: this.signal,
            environment: { ...this.environment, npm_config_update_notifier: 'false', npm_config_audit: 'false', npm_config_fund: 'false' } });
        if (result.reason !== 'completed')
            throw new PackageError(result.reason === 'cancelled' ? 'interrupted' : result.reason === 'timeout' ? 'timeout' : 'npm_failed');
        return result.stdout.trim();
    }
    async layout(explicit?: string): Promise<NpmLayout> {
        const reported = explicit ?? await this.run(['prefix', '--global']);
        if (explicit === undefined && !isAbsolute(reported))
            throw new PackageError('prefix');
        const prefix = resolvedPath(reported);
        if (!isAbsolute(prefix) || /[\0\r\n]/u.test(prefix))
            throw new PackageError('prefix');
        // npm invocations share configuration/cache initialization. Serialize
        // preflight, including the native Windows process supervisor startup.
        const moduleRoot=await this.run(['root', '--global', '--prefix', prefix]);
        const npmVersion=await this.run(['--version']);
        const scoped=await this.run(['config', 'get', '@fbincon:registry']);
        const cache=await this.run(['config', 'get', 'cache']);
        const registry = scoped && scoped !== 'undefined' && scoped !== 'null' ? scoped : await this.run(['config', 'get', 'registry']);
        try {
            const url = new URL(registry);
            if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash)
                throw new Error();
        }
        catch {
            throw new PackageError('registry');
        }
        if (!isAbsolute(moduleRoot) || /[\0\r\n]/u.test(moduleRoot))
            throw new PackageError('prefix');
        const expected = process.platform === 'win32' ? join(prefix, 'node_modules') : join(prefix, 'lib/node_modules');
        if (resolvedPath(moduleRoot) !== resolvedPath(expected))
            throw new PackageError('prefix');
        if (!isAbsolute(cache) || within(prefix, cache))
            throw new PackageError('prefix');
        return { prefix, root: join(moduleRoot, PACKAGE_NAME), bin: join(prefix, process.platform === 'win32' ? 'claude-statusline.cmd' : 'bin/claude-statusline'), registry, npmVersion, cache: resolvedPath(cache) };
    }
    async verify(identity: PackageIdentity, bin?: string): Promise<void> {
        if(bin && !sameLaunchEntry(bin,{executable:process.execPath,args:[identity.entry]}))throw new PackageError('identity');
        const result = await this.runner({ executable: process.execPath, args: [identity.entry, '--version'], cwd: identity.root, input: '', timeoutMs: 10000, signal: this.signal, environment: this.environment });
        if (result.reason !== 'completed' || result.stdout.trim() !== 'claude-statusline ' + identity.version)
            throw new PackageError('identity');
    }
    async install(version: string, layout: NpmLayout): Promise<void> {
        if (!exactVersion(version))
            throw new PackageError('version');
        await this.run(['install', '--global', '--prefix', layout.prefix, '--registry', layout.registry, '--ignore-scripts', '--bin-links=true', '--no-audit', '--no-fund', PACKAGE_NAME + '@' + version], process.cwd(), 180000);
    }
}
