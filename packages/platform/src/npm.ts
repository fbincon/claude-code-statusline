import * as fs from 'node:fs';
import { dirname, join, resolve, isAbsolute } from 'node:path';
import { createHash } from 'node:crypto';
import { PACKAGE_NAME } from '@fbincon/statusline-core/release';
import { PackageError, exactVersion, type PackageIdentity } from '@fbincon/statusline-core/management/package';
import { compatibility, LEGACY_370_SHA256, type PackageCompatibility } from '@fbincon/statusline-core/management/compatibility';
import { equalSettings } from '@fbincon/statusline-core/json-equality';
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
export interface RegistryPackage {
    version: string;
    registry: string;
    integrity: string;
    nodeEngine: string;
    compatibility: PackageCompatibility;
    legacy: boolean;
}
export const globalPackageRoot = (prefix: string) => join(prefix, process.platform === 'win32' ? 'node_modules' : 'lib/node_modules', PACKAGE_NAME);
export const globalPackageBin = (prefix: string) => join(prefix, process.platform === 'win32' ? 'claude-statusline.cmd' : 'bin/claude-statusline');
export function verifyArchive(path: string, target: RegistryPackage): void {
    const stat = fs.lstatSync(path);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 64 * 1024 * 1024)
        throw new PackageError('integrity');
    const bytes = fs.readFileSync(path);
    if ('sha512-' + createHash('sha512').update(bytes).digest('base64') !== target.integrity || target.legacy && createHash('sha256').update(bytes).digest('hex') !== LEGACY_370_SHA256)
        throw new PackageError('integrity');
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
        const inventoryBytes = fs.readFileSync(join(root, 'candidate.json'));
        const inventory = JSON.parse(inventoryBytes.toString('utf8'));
        if (inventory.name !== PACKAGE_NAME || inventory.version !== manifest.version || inventory.application_version !== manifest.version)
            throw new Error('inventory');
        for (const file of ['bin/claude-statusline.js', 'node_modules/@fbincon/statusline-cli/dist/src/entry.js', 'node_modules/@fbincon/statusline-core/dist/src/release.js']) {
            if (fs.lstatSync(join(root, file)).isSymbolicLink() || createHash('sha256').update(fs.readFileSync(join(root, file))).digest('hex') !== inventory.files?.[file])
                throw new Error('bytes');
        }
        return { version: manifest.version, root: fs.realpathSync.native(root), entry: fs.realpathSync.native(entry), prefix, integrity: null, registry: null, inventory_sha256: createHash('sha256').update(inventoryBytes).digest('hex') };
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
        if (result.reason !== 'completed') {
            // npm's --json failure object has a stable code. Never forward its
            // free-form detail, which can contain private registry information.
            let code: unknown;
            try {
                code = JSON.parse(result.stdout)?.error?.code;
            }
            catch { /* Not JSON. */ }
            if (code === 'EINTEGRITY')
                throw new PackageError('integrity');
            throw new PackageError(result.reason === 'cancelled' ? 'interrupted' : result.reason === 'timeout' ? 'timeout' : 'npm_failed');
        }
        return result.stdout.trim();
    }
    async layout(explicit?: string): Promise<NpmLayout> {
        const reported = explicit ?? await this.run(['prefix', '--global']);
        if (explicit === undefined && !isAbsolute(reported))
            throw new PackageError('prefix');
        const prefix = resolvedPath(reported);
        if (!isAbsolute(prefix) || /[\0\r\n]/u.test(prefix))
            throw new PackageError('prefix');
        const [moduleRoot, npmVersion, scoped, cache] = await Promise.all([this.run(['root', '--global', '--prefix', prefix]), this.run(['--version']), this.run(['config', 'get', '@fbincon:registry']), this.run(['config', 'get', 'cache'])]);
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
        if (bin && !sameLaunchEntry(bin, { executable: process.execPath, args: [identity.entry] }))
            throw new PackageError('identity');
        const result = await this.runner({ executable: process.execPath, args: [identity.entry, '--version'], cwd: identity.root, input: '', timeoutMs: 10000, signal: this.signal, environment: this.environment });
        if (result.reason !== 'completed' || result.stdout.trim() !== 'claude-statusline ' + identity.version)
            throw new PackageError('identity');
    }
    async install(version: string, layout: NpmLayout): Promise<void> {
        if (!exactVersion(version))
            throw new PackageError('version');
        await this.run(['install', '--global', '--prefix', layout.prefix, '--registry', layout.registry, '--ignore-scripts', '--bin-links=true', '--no-audit', '--no-fund', PACKAGE_NAME + '@' + version], process.cwd(), 180000);
    }
    async metadata(selector: string, layout: NpmLayout): Promise<RegistryPackage> {
        if (!exactVersion(selector) && !['latest', 'beta'].includes(selector))
            throw new PackageError('version');
        let value: any;
        try {
            value = JSON.parse(await this.run(['view', PACKAGE_NAME + '@' + selector, '--json', '--registry', layout.registry]));
        }
        catch (error) {
            if (error instanceof PackageError)
                throw error;
            throw new PackageError('metadata');
        }
        if (!value || Array.isArray(value) || value.name !== PACKAGE_NAME || !exactVersion(value.version) || exactVersion(selector) && value.version !== selector ||
            typeof value.dist?.integrity !== 'string' || !/^sha512-[A-Za-z0-9+/]{86}==$/u.test(value.dist.integrity) || typeof value.engines?.node !== 'string' || value.engines.node.length > 256 || /[\p{Cc}\p{Cs}]/u.test(value.engines.node))
            throw new PackageError('metadata');
        if (value.version === '3.7.0' && value.statuslineCompatibility !== undefined)
            throw new PackageError('metadata');
        return { version: value.version, registry: layout.registry, integrity: value.dist.integrity, nodeEngine: value.engines.node,
            compatibility: compatibility(value.statuslineCompatibility, value.version), legacy: value.version === '3.7.0' };
    }
    async download(target: RegistryPackage, directory: string): Promise<string> {
        fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
        let result: any;
        try {
            result = JSON.parse(await this.run(['pack', PACKAGE_NAME + '@' + target.version, '--json', '--ignore-scripts', '--registry', target.registry, '--pack-destination', directory], directory, 180000));
        }
        catch (error) {
            if (error instanceof PackageError)
                throw error;
            throw new PackageError('metadata');
        }
        const filename = PACKAGE_NAME.replace('@', '').replace('/', '-') + '-' + target.version + '.tgz';
        if (!Array.isArray(result) || result.length !== 1 || result[0]?.filename !== filename)
            throw new PackageError('metadata');
        const path = join(directory, filename);
        verifyArchive(path, target);
        return path;
    }
    async installArchive(archive: string, prefix: string): Promise<void> {
        await this.run(['install', '--global', '--prefix', prefix, '--offline', '--ignore-scripts', '--bin-links=true', '--engine-strict=true', '--no-audit', '--no-fund', archive], dirname(archive), 180000);
    }
    async nodeCompatible(range: string): Promise<boolean> {
        const program = "const {createRequire}=require('node:module');const semver=createRequire(process.argv[1])('semver');process.stdout.write(String(!!semver.validRange(process.argv[2]) && semver.satisfies(process.versions.node,process.argv[2])));";
        const result = await this.runner({ executable: process.execPath, args: ['-e', program, this.entry, range], cwd: dirname(this.entry), input: '', timeoutMs: 10000, environment: this.environment, signal: this.signal });
        if (result.reason !== 'completed' || !['true', 'false'].includes(result.stdout))
            throw new PackageError('compatibility_unknown');
        return result.stdout === 'true';
    }
    async validateStaged(prefix: string, target: RegistryPackage): Promise<PackageIdentity> {
        const root = globalPackageRoot(prefix), identity = productIdentity(root, prefix);
        if (!identity || identity.version !== target.version)
            throw new PackageError('identity');
        const manifest = JSON.parse(fs.readFileSync(join(root, 'package.json'), 'utf8'));
        if (manifest.engines?.node !== target.nodeEngine || !equalSettings(compatibility(manifest.statuslineCompatibility, target.version), target.compatibility) || (manifest.statuslineCompatibility === undefined) !== target.legacy)
            throw new PackageError('identity');
        await this.verify(identity, globalPackageBin(prefix));
        for (const [name, protocol] of [['statusline-native', target.compatibility.editor_protocol], ['statusline-runtime', target.compatibility.runtime_protocol]] as const) {
            const resources = join(root, 'node_modules/@fbincon/statusline-cli/resources', name);
            const descriptor = JSON.parse(fs.readFileSync(join(resources, 'resource-manifest.json'), 'utf8'));
            if (descriptor.backend_version !== target.version || descriptor.mod_version !== target.version || descriptor.protocol_version !== protocol)
                throw new PackageError('identity');
            for (const [file, hash] of Object.entries(descriptor.files ?? {})) {
                if (file.startsWith('/') || file.includes('\\') || file.split('/').some(part => !part || part === '..' || part === '.') || typeof hash !== 'string')
                    throw new PackageError('identity');
                const path = join(resources, file);
                if (fs.lstatSync(path).isSymbolicLink() || createHash('sha256').update(fs.readFileSync(path)).digest('hex') !== hash)
                    throw new PackageError('identity');
            }
        }
        return { ...identity, integrity: target.integrity, registry: target.registry };
    }
}
